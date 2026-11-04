import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { newsletterSubscribers, orderItems, orders, products, reviews, siteSettings, uploadedImages, inventorySyncState } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { ensureSchema } from "@/lib/schema-migrate";
import { DEFAULT_SITE_SETTINGS } from "@/lib/catalog";
import { rememberedLinks } from "@/lib/marketplace-links";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type JsonRow = Record<string, unknown>;
function revive(row: JsonRow): JsonRow {
  const result = { ...row };
  for (const name of ["createdAt", "lastPriceCheck", "updatedAt", "marketplaceCheckedAt", "moderatedAt"]) {
    if (typeof result[name] === "string") {
      const parsed = new Date(result[name] as string);
      if (Number.isNaN(parsed.getTime())) delete result[name]; else result[name] = parsed;
    }
  }
  return result;
}

/** Restore is explicit, transactional and never deletes rows absent from the file. */
export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const payload = await request.json().catch(() => null) as {
    format?: string; products?: JsonRow[]; settings?: JsonRow | null; subscribers?: JsonRow[];
    uploadedImages?: JsonRow[]; orders?: JsonRow[]; orderItems?: JsonRow[]; reviews?: JsonRow[];
  } | null;
  if (payload?.format !== "mediterranic-backup" || !Array.isArray(payload.products)) return Response.json({ error: "That is not a Mediterranic backup file." }, { status: 400 });
  try {
    await ensureSchema();
    const result = await db.transaction(async (tx) => {
      const imageIds = new Map<number, number>();
      let imagesRestored = 0, updated = 0, inserted = 0, subscribersAdded = 0, ordersAdded = 0, reviewsAdded = 0;
      // Content-addressed reuse: an image ID in an old backup may now belong to another file.
      for (const raw of payload.uploadedImages ?? []) {
        if (!raw || typeof raw.dataBase64 !== "string" || typeof raw.mimeType !== "string" || !Number.isInteger(Number(raw.id))) continue;
        const digest = createHash("md5").update(raw.dataBase64).digest("hex");
        const [same] = await tx.select({ id: uploadedImages.id }).from(uploadedImages)
          .where(and(eq(uploadedImages.mimeType, raw.mimeType), sql`md5(${uploadedImages.dataBase64}) = ${digest}`)).limit(1);
        if (same) { imageIds.set(Number(raw.id), same.id); continue; }
        const [image] = await tx.insert(uploadedImages).values({
          filename: typeof raw.filename === "string" ? raw.filename : "restored-photo",
          mimeType: raw.mimeType, dataBase64: raw.dataBase64,
        }).returning({ id: uploadedImages.id });
        imageIds.set(Number(raw.id), image.id); imagesRestored++;
      }
      const remap = (value: unknown): unknown => {
        if (typeof value === "string") {
          const local = value.match(/^(?:https?:\/\/[^/]+)?\/api\/uploads\/(\d+)(.*)$/);
          if (local && imageIds.has(Number(local[1]))) return `/api/uploads/${imageIds.get(Number(local[1]))}${local[2]}`;
          return value;
        }
        if (Array.isArray(value)) return value.map(remap);
        if (value && typeof value === "object" && !(value instanceof Date)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, remap(item)]));
        return value;
      };
      const productIds = new Map<number, number>();
      for (const raw of payload.products!) {
        if (!raw || typeof raw.slug !== "string" || !raw.slug) continue;
        const { id: oldId, ...rest } = raw;
        const piece = revive(remap(rest) as JsonRow) as typeof products.$inferInsert;
        const [existing] = await tx.select().from(products).where(eq(products.slug, piece.slug)).limit(1);
        if (existing) {
          const combinedHistory = rememberedLinks({ ...existing, ...piece,
            marketplaceHistory: [...(existing.marketplaceHistory ?? []), ...(piece.marketplaceHistory ?? [])] });
          await tx.update(products).set({ ...piece,
            ebayListingUrl: piece.ebayListingUrl ?? existing.ebayListingUrl,
            catawikiListingUrl: piece.catawikiListingUrl ?? existing.catawikiListingUrl,
            marketplaceHistory: combinedHistory,
          }).where(eq(products.id, existing.id));
          productIds.set(Number(oldId), existing.id); updated++;
        } else {
          const [created] = await tx.insert(products).values(piece).returning({ id: products.id });
          productIds.set(Number(oldId), created.id); inserted++;
        }
      }
      let settingsRestored = false;
      if (payload.settings && typeof payload.settings === "object") {
        const { id: _id, updatedAt: _date, ...rest } = payload.settings;
        const settings = remap(rest) as Partial<typeof siteSettings.$inferInsert>;
        const [existing] = await tx.select({ id: siteSettings.id }).from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
        if (existing) await tx.update(siteSettings).set({ ...settings, updatedAt: new Date() }).where(eq(siteSettings.id, 1));
        else await tx.insert(siteSettings).values({ ...DEFAULT_SITE_SETTINGS, ...settings, id: 1, updatedAt: new Date() });
        settingsRestored = true;
      }
      for (const row of payload.subscribers ?? []) {
        const email = typeof row?.email === "string" ? row.email.trim().toLowerCase() : "";
        if (!email) continue;
        const [created] = await tx.insert(newsletterSubscribers).values({ email, source: typeof row.source === "string" ? row.source : "backup" })
          .onConflictDoNothing({ target: newsletterSubscribers.email }).returning({ id: newsletterSubscribers.id });
        if (created) subscribersAdded++;
      }
      // Never overwrite a more recent payment/order state with an old backup.
      for (const raw of payload.orders ?? []) {
        if (typeof raw?.id !== "string") continue;
        const [created] = await tx.insert(orders).values(revive(raw) as typeof orders.$inferInsert)
          .onConflictDoNothing({ target: orders.id }).returning({ id: orders.id });
        if (created) ordersAdded++;
      }
      for (const raw of payload.orderItems ?? []) {
        const { id: _id, ...rest } = raw;
        if (typeof rest.orderId !== "string" || typeof rest.productSlug !== "string") continue;
        const [order] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, rest.orderId)).limit(1);
        const [product] = await tx.select({ id: products.id }).from(products).where(eq(products.slug, rest.productSlug)).limit(1);
        if (!order || !product) continue;
        const [existing] = await tx.select({ id: orderItems.id }).from(orderItems).where(and(eq(orderItems.orderId, order.id), eq(orderItems.productSlug, rest.productSlug))).limit(1);
        if (!existing) await tx.insert(orderItems).values({ ...(rest as typeof orderItems.$inferInsert), orderId: order.id, productId: product.id });
      }
      for (const raw of payload.reviews ?? []) {
        const productId = productIds.get(Number(raw?.productId));
        if (!productId || typeof raw.authorName !== "string" || typeof raw.title !== "string") continue;
        const [existing] = await tx.select({ id: reviews.id }).from(reviews).where(and(eq(reviews.productId, productId), eq(reviews.authorName, raw.authorName), eq(reviews.title, raw.title))).limit(1);
        if (existing) continue;
        const { id: _id, ...rest } = raw;
        // Old backups contain already-public reviews; never auto-publish a
        // pending/rejected status carried by a newer backup.
        const moderationStatus = rest.moderationStatus == null ? null
          : ["pending", "approved", "rejected"].includes(String(rest.moderationStatus)) ? String(rest.moderationStatus) : "pending";
        await tx.insert(reviews).values({ ...(revive(rest) as typeof reviews.$inferInsert), productId, moderationStatus }); reviewsAdded++;
      }
      // A restored catalogue is not the previously verified remote snapshot.
      // Keep run logs and any current lease; a later sync re-verifies it.
      await tx.update(inventorySyncState).set({ report: null }).where(eq(inventorySyncState.id, 1));
      const [{ total }] = await tx.select({ total: sql<number>`count(*)::int` }).from(products);
      return { ok: true, updated, inserted, settingsRestored, subscribersAdded, imagesRestored, ordersAdded, reviewsAdded, totalProducts: total };
    });
    return Response.json(result);
  } catch (error) {
    console.error("Backup restoration failed; transaction rolled back", error);
    return Response.json({ error: "Could not restore this backup. The transaction was rolled back; no partial restore was kept." }, { status: 400 });
  }
}

export async function GET() {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401 });
  await ensureSchema();
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(products);
  const [{ reviewTotal }] = await db.select({ reviewTotal: sql<number>`count(*)::int` }).from(reviews);
  return Response.json({ products: total, reviews: reviewTotal });
}
