import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { ensureSchema } from "@/lib/schema-migrate";
import { canonicalListing, listingKey, rememberListing, rememberedLinks, savedListing, type Marketplace } from "@/lib/marketplace-links";

export class MarketplaceError extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}

/** Explicit admin action: move the same record to a confirmed listing, not import a second fossil. */
export async function attachMarketplaceListing(input: {
  productId: number; channel: Marketplace; url: string; priceCents?: number | null; restoreStock?: boolean;
  identityTokens?: string[];
  expected?: { listingChannel: string | null; priceCents: number; externalListingUrl: string | null };
}) {
  await ensureSchema();
  const url = canonicalListing(input.url, input.channel);
  if (!url) throw new MarketplaceError("Enter a valid listing URL for the selected marketplace.", 400);
  return db.transaction(async (tx) => {
    // Two requests must not attach the same listing to two different products.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${listingKey(url)!}))`);
    const [product] = await tx.select().from(products).where(eq(products.id, input.productId)).limit(1).for("update");
    if (!product) throw new MarketplaceError("Specimen not found.", 404);
    if (input.expected && (product.listingChannel !== input.expected.listingChannel || product.priceCents !== input.expected.priceCents || product.externalListingUrl !== input.expected.externalListingUrl)) {
      throw new MarketplaceError("The specimen was edited during synchronization. Your edit was kept; this item will be checked again.");
    }
    if (product.archived) throw new MarketplaceError("This specimen is in the archive. Restore its availability in the editor before linking a live listing.");
    if (product.stock <= 0 && !input.restoreStock) throw new MarketplaceError("This specimen is unavailable. Confirm restocking in the editor first.");
    const all = await tx.select().from(products);
    const duplicate = all.find((row) => row.id !== product.id && rememberedLinks(row).some((entry) => listingKey(entry.url) === listingKey(url)));
    if (duplicate) throw new MarketplaceError(`This listing is already linked to ${duplicate.name}. No record was changed.`);
    const metadata = rememberListing(product, input.channel, url, new Date().toISOString(), input.identityTokens);
    const [updated] = await tx.update(products).set({
      ...metadata,
      listingChannel: input.channel,
      externalListingUrl: url,
      ...(input.priceCents != null && input.priceCents > 0 ? { priceCents: input.priceCents } : {}),
      ...(input.restoreStock && product.stock <= 0 ? { stock: 1 } : {}),
      lastPriceCheck: new Date(), marketplaceActive: true, marketplaceCheckedAt: new Date(),
    }).where(eq(products.id, product.id)).returning();
    return updated;
  });
}

/** Quick switch uses a remembered URL, never another platform's old URL. */
export async function switchSpecimenChannel(id: number, target: "direct" | Marketplace, stock?: number) {
  await ensureSchema();
  return db.transaction(async (tx) => {
    const [product] = await tx.select().from(products).where(eq(products.id, id)).limit(1).for("update");
    if (!product) throw new MarketplaceError("Specimen not found.", 404);
    if (product.archived && stock === undefined) throw new MarketplaceError("Restore the archived specimen explicitly before offering it again.");
    const metadata = {
      ebayListingUrl: savedListing(product, "ebay"),
      catawikiListingUrl: savedListing(product, "catawiki"),
      marketplaceHistory: rememberedLinks(product),
    };
    if (target === "direct") {
      if ((product.listingChannel === "ebay" || product.listingChannel === "catawiki") && !product.siteOnlyPriceCents) {
        throw new MarketplaceError("Set 'When in Site Only' before moving this piece to direct sale. The auction bid will not be used as a sale price.");
      }
      const [updated] = await tx.update(products).set({
        ...metadata, listingChannel: "direct", archived: false, marketplaceActive: null, marketplaceCheckedAt: null,
        ...(product.siteOnlyPriceCents ? { priceCents: product.siteOnlyPriceCents } : {}),
        ...(stock !== undefined ? { stock } : {}),
      }).where(eq(products.id, id)).returning();
      return updated;
    }
    const url = savedListing(product, target);
    if (!url) throw new MarketplaceError(`No ${target === "ebay" ? "eBay" : "Catawiki"} link is saved for this specimen. Paste its listing URL in the editor first.`);
    const [updated] = await tx.update(products).set({
      ...metadata, listingChannel: target, externalListingUrl: url, archived: false, marketplaceActive: null, marketplaceCheckedAt: null,
      ...(stock !== undefined ? { stock } : {}),
    }).where(eq(products.id, id)).returning();
    return updated;
  });
}
