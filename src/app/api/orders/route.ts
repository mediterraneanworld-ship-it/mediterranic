import { buildOrder, insertOrder, OrderError, parseOrderInput } from "@/lib/order-service";
import { notifyOrder } from "@/lib/order-notify";

export const dynamic = "force-dynamic";

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
    // Fire-and-record: a mail failure never cancels or changes the order.
    await notifyOrder(id, "placed");
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    if (error instanceof OrderError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Order placement failed", error);
    return Response.json({ error: "We could not place your order. Please try again." }, { status: 500 });
  }
}
