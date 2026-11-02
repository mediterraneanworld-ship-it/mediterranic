import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, products } from "@/db/schema";
import { confirmOrder, OrderError } from "@/lib/order-service";
import { capturePaypalOrder, getPaypalOrder, isPaypalConfigured } from "@/lib/paypal";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lock order and stock through capture; retries never deduct stock twice. */
export async function POST(request: Request) {
  if (!isPaypalConfigured()) return Response.json({ error: "PayPal is not configured.", code: "PAYPAL_NOT_CONFIGURED" }, { status: 503 });
  const body = await request.json().catch(() => null) as { orderId?: unknown; paypalOrderId?: unknown } | null;
  const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";
  const paypalOrderId = typeof body?.paypalOrderId === "string" ? body.paypalOrderId.trim() : "";
  if (!UUID.test(orderId) || !/^[A-Z0-9]{8,40}$/i.test(paypalOrderId)) return Response.json({ error: "Invalid payment reference." }, { status: 400 });
  let moneyCaptured = false;
  try {
    const outcome = await db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1).for("update");
      if (!order) throw new OrderError("Order not found.", 404);
      if (order.paypalOrderId !== paypalOrderId || order.paymentMethod !== "paypal") throw new OrderError("This payment does not match the order.", 409);
      if (order.status === "confirmed") return { ok: true, orderId, alreadyConfirmed: true };
      if (!["pending_payment", "payment_pending", "payment_review"].includes(order.status)) throw new OrderError("This order is not awaiting PayPal payment.", 409);
      const paypal = await getPaypalOrder(paypalOrderId);
      if (!["APPROVED", "COMPLETED"].includes(paypal.status)) throw new OrderError(`PayPal status is ${paypal.status}. The payment has not been confirmed.`, 409);
      const unit = paypal.purchase_units?.[0];
      if (unit?.reference_id !== orderId || unit.amount?.currency_code !== "EUR" || Math.round(Number(unit.amount?.value) * 100) !== order.totalCents) {
        throw new OrderError("PayPal amount, currency or order reference does not match. Contact us before paying again.", 409);
      }
      // Reconcile an earlier completed capture instead of attempting a second charge.
      moneyCaptured = paypal.status === "COMPLETED";
      const lines = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      if (!lines.length) throw new OrderError("The order has no items. Contact us before paying again.", 409);
      const inventory = await tx.select().from(products).where(inArray(products.id, lines.map((line) => line.productId))).orderBy(asc(products.id)).for("update");
      for (const line of lines) {
        const product = inventory.find((row) => row.id === line.productId);
        if (!product || !product.published || product.archived || product.listingChannel !== "direct" || product.stock < line.quantity) {
          throw new OrderError(`${line.productName} is no longer available for direct purchase. Contact us before paying again.`, 409);
        }
      }
      const capture = paypal.status === "COMPLETED" ? paypal : await capturePaypalOrder(paypalOrderId);
      const receipt = capture.purchase_units?.[0]?.payments?.captures?.[0];
      if (receipt?.status === "PENDING") {
        await tx.update(orders).set({ status: "payment_pending" }).where(eq(orders.id, orderId));
        return { ok: false, pending: true, orderId, error: "PayPal is reviewing the payment. Do not pay again; we will verify it before dispatch." };
      }
      if (capture.status !== "COMPLETED" || receipt?.status !== "COMPLETED") throw new OrderError("PayPal did not confirm a completed payment. Check your PayPal activity before retrying.", 402);
      moneyCaptured = true;
      if (receipt.amount?.currency_code !== "EUR" || Math.round(Number(receipt.amount.value) * 100) !== order.totalCents) {
        throw new OrderError("Payment requires manual review. Contact us and do not pay again.", 409);
      }
      await confirmOrder(orderId, tx);
      return { ok: true, orderId, paypalOrderId, captureId: receipt.id };
    });
    return Response.json(outcome, { status: outcome.ok ? 200 : 202 });
  } catch (error) {
    if (moneyCaptured) {
      await db.update(orders).set({ status: "payment_review" }).where(and(eq(orders.id, orderId), ne(orders.status, "confirmed"))).catch(() => {});
      return Response.json({ error: "PayPal reports a payment, but the order needs manual review. Do not pay again; contact us with your order reference." }, { status: 409 });
    }
    if (error instanceof OrderError) return Response.json({ error: error.message }, { status: error.status });
    console.error("PayPal confirmation could not be verified", error);
    return Response.json({ error: "The payment result could not be verified. Check your PayPal activity and contact us before paying again." }, { status: 502 });
  }
}
