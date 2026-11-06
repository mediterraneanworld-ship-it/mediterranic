import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { notifyOrder, type OrderEvent } from "@/lib/order-notify";
import { mailTransport, orderNotificationRecipient } from "@/lib/order-email";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resends the curator e-mail for one order. Never touches the order itself. */
export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { id?: unknown; event?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const event: OrderEvent = body?.event === "paid" ? "paid" : "placed";
  if (!UUID.test(id)) return Response.json({ error: "Invalid order reference." }, { status: 400 });
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return Response.json({ error: "Order not found." }, { status: 404 });

  const result = await notifyOrder(id, event, { force: true });
  return Response.json(
    {
      ...result,
      recipient: orderNotificationRecipient(),
      transport: mailTransport() ?? "none",
    },
    { status: result.status === "sent" ? 200 : 502 },
  );
}
