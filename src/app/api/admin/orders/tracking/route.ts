import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { loadOrderContext, normalizeTracking, sendTrackingEmails } from "@/lib/order-messages";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Saves the tracking link/number on the order and, unless `saveOnly`, sends it
 * to the buyer and to the curator. The order status is never changed here.
 */
export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as
    | { id?: unknown; tracking?: unknown; saveOnly?: unknown }
    | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const raw = typeof body?.tracking === "string" ? body.tracking : "";
  const saveOnly = body?.saveOnly === true;
  if (!UUID.test(id)) return Response.json({ error: "Invalid order reference." }, { status: 400 });

  const tracking = normalizeTracking(raw);
  if (!tracking) {
    return Response.json(
      { error: "Paste the carrier tracking link (https://…) or the tracking number (at least 4 characters)." },
      { status: 400 },
    );
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return Response.json({ error: "Order not found." }, { status: 404 });

  const context = await loadOrderContext(id);
  if (!context) return Response.json({ error: "Order not found." }, { status: 404 });

  const sent = saveOnly ? null : await sendTrackingEmails(context, tracking);

  await db
    .update(orders)
    .set({ trackingUrl: tracking.url, ...(sent?.buyer.ok ? { trackingSentAt: new Date() } : {}) })
    .where(eq(orders.id, id));

  if (!sent) return Response.json({ ok: true, tracking, saved: true, sent: false });

  return Response.json(
    {
      ok: sent.buyer.ok,
      tracking,
      saved: true,
      sent: true,
      buyer: { ok: sent.buyer.ok, detail: sent.buyer.detail },
      curator: { ok: sent.curator.ok, detail: sent.curator.detail },
      error: sent.buyer.ok ? undefined : `Tracking saved, but the buyer e-mail failed: ${sent.buyer.detail}`,
    },
    { status: sent.buyer.ok ? 200 : 502 },
  );
}
