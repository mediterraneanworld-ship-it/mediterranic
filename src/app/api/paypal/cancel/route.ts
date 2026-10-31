import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { markOrderStatus } from "@/lib/order-service";

export const dynamic = "force-dynamic";

/** Marks a pending PayPal order as cancelled when the buyer goes back. */
export async function POST(request: Request) {
  let body: { orderId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const orderId = (body.orderId ?? "").trim();
  if (!orderId) return Response.json({ error: "Missing order reference." }, { status: 400 });

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (order && order.status === "pending_payment") {
    await markOrderStatus(orderId, "cancelled");
  }
  return Response.json({ ok: true });
}
