import { count } from "drizzle-orm";
import { db } from "@/db";
import { products, reviews } from "@/db/schema";
import { SEED_PRODUCTS, SEED_REVIEWS } from "@/lib/seed-data";

let seedPromise: Promise<void> | null = null;

/**
 * Seeds the demo catalogue the first time the store is read against an empty
 * database. Runs at most once per process; safe to call from any server code.
 */
export function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      const [{ value }] = await db.select({ value: count() }).from(products);
      if (Number(value) > 0) return;

      await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(products)
          .values(SEED_PRODUCTS)
          .returning({ id: products.id, slug: products.slug });

        const idBySlug = new Map(inserted.map((p) => [p.slug, p.id]));
        const rows = SEED_REVIEWS.flatMap((r) => {
          const productId = idBySlug.get(r.product);
          if (!productId) return [];
          const { product: _product, ...rest } = r;
          return [{ ...rest, productId }];
        });
        if (rows.length > 0) await tx.insert(reviews).values(rows);
      });
    })().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}
