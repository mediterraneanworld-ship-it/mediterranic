import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { confirmOrder, markOrderStatus, OrderError } from "@/lib/order-service";
import { capturePaypalOrder, getPaypalOrder, isPaypalConfigured } from "@/lib/paypal";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Called from /checkout after PayPal redirects back with ?paypal=return.
 * Verifies the PayPal order was approved, captures the payment, and only then
 * confirms the order and decrements stock.
 */
export async function POST(request: Request) {
  if (!isPaypalConfigured()) {
    return Response.json({ error: "PayPal is not configured.", code: "PAYPAL_NOT_CONFIGURED" }, { status: 503 });
  }

  let body: { orderId?: string; paypalOrderId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const orderId = (body.orderId ?? "").trim();
  const paypalOrderId = (body.paypalOrderId ?? "").trim();
  if (!orderId || !paypalOrderId) {
    return Response.json({ error: "Missing order reference." }, { status: 400 });
  }

  try {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
    if (order.status === "confirmed") {
      return Response.json({ ok: true, orderId, alreadyConfirmed: true });
    }
    if (order.status !== "pending_payment" || order.paypalOrderId !== paypalOrderId) {
      return Response.json({ error: "This payment does not match the order." }, { status: 409 });
    }

    // Confirm with PayPal that the buyer actually approved this order.
    const paypalOrder = await getPaypalOrder(paypalOrderId);
    if (paypalOrder.status !== "APPROVED") {
      await markOrderStatus(orderId, "payment_failed", paypalOrderId);
      return Response.json(
        { error: `Payment was not approved (status: ${paypalOrder.status}). Nothing was charged.` },
        { status: 402 },
      );
    }

    const capture = await capturePaypalOrder(paypalOrderId);
    const captured = capture.purchase_units?.[0]?.payments?.captures?.[0];
    const capturedCents = captured?.amount?.value ? Math.round(Number(captured.amount.value) * 100) : null;

    if (capture.status !== "COMPLETED" || !captured || captured.status !== "COMPLETED") {
      await markOrderStatus(orderId, "payment_failed", paypalOrderId);
      return Response.json(
        { error: `Payment was not completed (status: ${capture.status}). Nothing was charged.` },
        { status: 402 },
      );
    }

    // Guard against a mismatched amount (e.g. tampered order).
    if (capturedCents !== order.totalCents) {
      await markOrderStatus(orderId, "payment_failed", paypalOrderId);
      return Response.json({ error: "The paid amount does not match the order. Nothing was confirmed." }, { status: 409 });
    }

    await confirmOrder(orderId);
    return Response.json({ ok: true, orderId, paypalOrderId, captureId: captured.id });
  } catch (error) {
    if (error instanceof OrderError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("PayPal capture failed", error);
    return Response.json({ error: "Could not confirm the payment. Nothing was charged — please try again." }, { status: 500 });
  }
}
