import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { loadOrderContext, sendBuyerMessage } from "@/lib/order-messages";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sends one message to the buyer, with the order quoted. Never changes the order. */
export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as
    | { id?: unknown; message?: unknown }
    | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 4000) : "";
  if (!UUID.test(id)) return Response.json({ error: "Invalid order reference." }, { status: 400 });
  if (message.length < 2) return Response.json({ error: "Write the message you want to send." }, { status: 400 });

  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return Response.json({ error: "Order not found." }, { status: 404 });

  const context = await loadOrderContext(id);
  if (!context) return Response.json({ error: "Order not found." }, { status: 404 });

  const result = await sendBuyerMessage(context, message);
  if (!result.ok) {
    return Response.json(
      { error: result.notConfigured ? result.detail : `The message was not sent: ${result.detail}` },
      { status: 502 },
    );
  }
  return Response.json({ ok: true, to: order.email, detail: result.detail });
}
