import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { products, productDeletions, reviews, orders, orderItems, newsletterSettings } from "@/db/schema";
import { listingKey, rememberedLinks } from "@/lib/marketplace-links";
import { PAYMENT_IN_PROGRESS } from "@/lib/admin-product-rules";
import { ensureSchema } from "@/lib/schema-migrate";

export class ProductDeletionError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** Only called by an authenticated, explicitly confirmed admin DELETE request. */
export async function permanentlyDeleteProduct(id: number, confirmation: string) {
  await ensureSchema();
  return db.transaction(async (tx) => {
    // This lock also prevents checkout from adding new FK-linked lines mid-delete.
    const [product] = await tx.select().from(products).where(eq(products.id, id)).limit(1).for("update");
    if (!product) throw new ProductDeletionError("Specimen not found. It may already have been deleted.", 404);
    if (confirmation !== product.slug) throw new ProductDeletionError("Confirm the exact specimen before deleting permanently.", 400);
    const items = await tx.select().from(orderItems).where(eq(orderItems.productId, id)).for("update");
    if (items.length) {
      const relatedOrders = await tx.select({ status: orders.status }).from(orders).where(inArray(orders.id, [...new Set(items.map((item) => item.orderId))]));
      if (relatedOrders.some((order) => (PAYMENT_IN_PROGRESS as readonly string[]).includes(order.status))) {
        throw new ProductDeletionError("This specimen belongs to an order awaiting payment or invoice settlement. Resolve that order first; nothing was deleted.", 409);
      }
    }
    const relatedReviews = await tx.select().from(reviews).where(eq(reviews.productId, id)).for("update");
    await tx.insert(productDeletions).values({
      originalProductId: product.id, slug: product.slug, name: product.name, deletedAt: new Date(),
      specimenReference: product.specimenReference,
      listingKeys: [...new Set(rememberedLinks(product).map((link) => listingKey(link.url)).filter((key): key is string => Boolean(key)))],
      orderItemsSnapshot: items,
      reviewsSnapshot: relatedReviews.map((review) => ({ ...review, createdAt: review.createdAt.toISOString(), moderatedAt: review.moderatedAt?.toISOString() ?? null })),
    });
    // Remove only this manual newsletter selection; cadence, auto_enabled and send history stay intact.
    const [newsletter] = await tx.select().from(newsletterSettings).where(eq(newsletterSettings.id, 1)).limit(1).for("update");
    if (newsletter?.pieceIds.includes(id)) {
      await tx.update(newsletterSettings).set({ pieceIds: newsletter.pieceIds.filter((pieceId) => pieceId !== id), updatedAt: new Date() }).where(eq(newsletterSettings.id, 1));
    }
    // The actual catalogue row is removed, not moved to Archive or Draft.
    // Its FK-dependent rows have already been retained above in the same transaction.
    await tx.delete(products).where(eq(products.id, id));
    return { id, slug: product.slug, name: product.name, retainedOrderLines: items.length, retainedReviews: relatedReviews.length };
  });
}
