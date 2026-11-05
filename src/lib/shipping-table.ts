import { asc, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { products, shippingRates, shippingWeightClasses } from "@/db/schema";
import { ensureSchema } from "@/lib/schema-migrate";
import {
  DEFAULT_WEIGHT_LIMITS,
  ZONES,
  ZONE_ORDER,
  type ShippingRowInput,
  type ShippingTable,
  type ShippingZone,
} from "@/lib/shipping";

/** The table changed on the server since the back-office loaded it. */
export class ShippingTableError extends Error {}

let seeding: Promise<void> | null = null;

/**
 * Creates the default weight classes and rates, only while the table is empty.
 * A transaction-scoped advisory lock stops two first requests from seeding twice,
 * and a value that was already saved is never overwritten.
 */
export function ensureShippingSeeded(): Promise<void> {
  if (!seeding) {
    seeding = (async () => {
      await ensureSchema();
      await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext('shipping-table-seed'))`);
        const [{ value }] = await tx.select({ value: count() }).from(shippingWeightClasses);
        if (Number(value) > 0) return;
        const inserted = await tx
          .insert(shippingWeightClasses)
          .values(DEFAULT_WEIGHT_LIMITS.map((maxGrams, index) => ({ position: index + 1, maxGrams })))
          .returning({ id: shippingWeightClasses.id });
        await tx.insert(shippingRates).values(
          inserted.flatMap((cls) =>
            ZONES.map((zone) => ({ classId: cls.id, region: zone.id, priceCents: zone.rateCents })),
          ),
        );
      });
    })().catch((error) => {
      seeding = null;
      throw error;
    });
  }
  return seeding;
}

/** Classes in order, with their prices in euro cents. */
export async function getShippingTable(): Promise<ShippingTable> {
  await ensureShippingSeeded();
  const classes = await db
    .select({
      id: shippingWeightClasses.id,
      position: shippingWeightClasses.position,
      maxGrams: shippingWeightClasses.maxGrams,
    })
    .from(shippingWeightClasses)
    .orderBy(asc(shippingWeightClasses.position));
  const rows = await db.select().from(shippingRates);
  const rates: ShippingTable["rates"] = {};
  for (const row of rows) {
    const zone = row.region as ShippingZone;
    rates[row.classId] = { ...(rates[row.classId] ?? {}), [zone]: row.priceCents };
  }
  return { classes, rates };
}

/** Weight in grams of every product, by slug (null when it is not recorded). */
export async function getWeightsBySlug(): Promise<Record<string, number | null>> {
  await ensureSchema();
  const rows = await db.select({ slug: products.slug, weightGrams: products.weightGrams }).from(products);
  return Object.fromEntries(rows.map((row) => [row.slug, row.weightGrams ?? null]));
}

/** Live pieces without a recorded weight. Their baskets are charged in the heaviest class until fixed. */
export async function getMissingWeightPieces(): Promise<{ id: number; name: string; slug: string }[]> {
  await ensureSchema();
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      weightGrams: products.weightGrams,
      published: products.published,
      archived: products.archived,
    })
    .from(products);
  return rows
    .filter((row) => row.published && !row.archived && (row.weightGrams === null || row.weightGrams <= 0))
    .map(({ id, name, slug }) => ({ id, name, slug }));
}

/** Saves limits and prices. The rows must be the current classes, in order. Either all rows are saved or none. */
export async function saveShippingTable(rows: ShippingRowInput[]): Promise<ShippingTable> {
  await ensureShippingSeeded();
  const current = await db
    .select({ id: shippingWeightClasses.id })
    .from(shippingWeightClasses)
    .orderBy(asc(shippingWeightClasses.position));
  const same = current.length === rows.length && current.every((cls, index) => cls.id === rows[index].classId);
  if (!same) {
    throw new ShippingTableError("The weight classes changed in another window. Reload the page and try again.");
  }
  await db.transaction(async (tx) => {
    for (const row of rows) {
      await tx
        .update(shippingWeightClasses)
        .set({ maxGrams: row.maxGrams })
        .where(eq(shippingWeightClasses.id, row.classId));
      for (const zone of ZONE_ORDER) {
        await tx
          .insert(shippingRates)
          .values({ classId: row.classId, region: zone, priceCents: row.prices[zone] })
          .onConflictDoUpdate({
            target: [shippingRates.classId, shippingRates.region],
            set: { priceCents: row.prices[zone] },
          });
      }
    }
  });
  return getShippingTable();
}
