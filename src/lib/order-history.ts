import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, productDeletions } from "@/db/schema";
import { ensureSchema } from "@/lib/schema-migrate";

type OrderLine = typeof orderItems.$inferSelect;

/** A restored live line wins over its historical copy; preserve quantities and prices exactly. */
export function combineOrderLines(current: OrderLine[], retained: OrderLine[]): OrderLine[] {
  const live = new Set(current.map((item) => `${item.orderId}:${item.productSlug}`));
  const seen = new Set<string>();
  return [...current, ...retained.filter((item) => {
    const key = `${item.orderId}:${item.id}:${item.productSlug}`;
    if (live.has(`${item.orderId}:${item.productSlug}`) || seen.has(key)) return false;
    seen.add(key);
    return true;
  })];
}

/** Receipts, CSV, tracking and buyer messages must survive a catalogue deletion. */
export async function getStoredOrderItems(orderId?: string): Promise<OrderLine[]> {
  await ensureSchema();
  const [current, history] = await Promise.all([
    orderId ? db.select().from(orderItems).where(eq(orderItems.orderId, orderId)) : db.select().from(orderItems),
    db.select({ items: productDeletions.orderItemsSnapshot }).from(productDeletions),
  ]);
  const retained = history.flatMap((row) => row.items).filter((item) => !orderId || item.orderId === orderId);
  return combineOrderLines(current, retained);
}
