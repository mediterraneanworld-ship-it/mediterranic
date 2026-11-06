import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { orderId?: unknown } | null;
  const id = typeof body?.orderId === "string" ? body.orderId.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return Response.json({ error: "Invalid order reference." }, { status: 400 });
  // A cancellation must never overwrite a concurrently confirmed payment.
  await db.update(orders).set({ status: "cancelled" }).where(and(eq(orders.id, id), eq(orders.status, "pending_payment"), eq(orders.paymentMethod, "paypal")));
  return Response.json({ ok: true });
}
