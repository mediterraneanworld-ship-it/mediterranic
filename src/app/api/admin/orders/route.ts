import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { markOrderStatus } from "@/lib/order-service";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Curator actions on received orders. Deliberately narrow:
 *  - PATCH only accepts the confirmed → shipped transition;
 *  - DELETE never touches an order that is still awaiting payment. */
export async function PATCH(request: Request) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { id?: unknown; status?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const status = typeof body?.status === "string" ? body.status.trim() : "";
  if (!UUID.test(id)) return Response.json({ error: "Invalid order reference." }, { status: 400 });
  if (status !== "shipped") {
    return Response.json({ error: "Only the “shipped” status can be set from the back-office." }, { status: 400 });
  }
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
  if (order.status === "shipped") {
    return Response.json({ error: "This order is already marked as shipped." }, { status: 409 });
  }
  if (order.status !== "confirmed") {
    return Response.json(
      { error: `Only paid (confirmed) orders can be marked as shipped — current status: ${order.status}.` },
      { status: 409 },
    );
  }
  await markOrderStatus(id, "shipped");
  return Response.json({ ok: true, id, status: "shipped" });
}

export async function DELETE(request: Request) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!UUID.test(id)) return Response.json({ error: "Invalid order reference." }, { status: 400 });
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
  if (["pending_payment", "payment_pending", "payment_review"].includes(order.status)) {
    return Response.json(
      { error: "This order is still awaiting payment resolution and cannot be deleted. Confirm the payment in PayPal first." },
      { status: 409 },
    );
  }
  await db.transaction(async (tx) => {
    await tx.delete(orderItems).where(eq(orderItems.orderId, id));
    await tx.delete(orders).where(eq(orders.id, id));
  });
  return Response.json({ ok: true });
}
