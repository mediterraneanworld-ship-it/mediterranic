import { buildOrder, insertOrder, OrderError, parseOrderInput } from "@/lib/order-service";
import { sendNewOrderNotification } from "@/lib/order-notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Places an order paid later by invoice. Shipping is priced server-side. */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const input = parseOrderInput(body);
    const built = await buildOrder(input);
    const id = await insertOrder(input, built, { status: "pending_invoice", paymentMethod: "direct" });
    const notification = await sendNewOrderNotification({
      order: {
        id,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        country: input.country,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        city: input.city,
        postalCode: input.postalCode,
        shippingMethod: built.shippingMethod,
        subtotalCents: built.subtotalCents,
        shippingCents: built.shippingCents,
        totalCents: built.totalCents,
        status: "pending_invoice",
        paymentMethod: "direct",
      },
      items: built.lines,
      siteUrl: new URL(request.url).origin,
    });
    if (!notification.sent) {
      console.error("Owner order email notification failed", { orderId: id, reason: notification.reason, status: notification.status, detail: notification.detail });
    }
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    if (error instanceof OrderError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Order placement failed", error);
    return Response.json({ error: "We could not place your order. Please try again." }, { status: 500 });
  }
}
