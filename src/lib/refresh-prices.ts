import { and, eq, isNotNull, gt } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export type PriceCheckResult = {
  slug: string;
  name: string;
  channel: string;
  previousCents: number | null;
  currentCents: number | null;
  changed: boolean;
  error?: string;
};

/** Reads the live current-bid amount (in cents) from a rendered Catawiki lot. */
async function readCatawikiPrice(url: string): Promise<number | null> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { "User-Agent": UA },
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) return null;
  const text = await res.text();

  const patterns = [
    /Current bid\s*\n?\s*€\s?([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/i,
    /Current bid[^€\d]{0,20}€\s?([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/i,
    /(?:Buy now|price)\s*[:\n]?\s*€\s?([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const value = Number(m[1].replace(/[.,](?=\d{3}\b)/g, "").replace(",", "."));
      if (Number.isFinite(value) && value >= 1 && value <= 500_000) {
        return Math.round(value * 100);
      }
    }
  }
  return null;
}

/** Reads the current price of an eBay item from the store page it is listed on. */
async function readEbayPrice(itemUrl: string, storeUrl: string): Promise<number | null> {
  const itemId = itemUrl.match(/\/itm\/(\d{6,13})/)?.[1];
  if (!itemId) return null;

  const res = await fetch(storeUrl, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
    cache: "no-store",
    signal: AbortSignal.timeout(40_000),
  });
  if (!res.ok) return null;
  const html = await res.text();

  const positions: [string, number][] = [];
  for (const m of html.matchAll(new RegExp(`/itm/${itemId}`, "g"))) {
    positions.push([itemId, m.index ?? 0]);
  }
  if (positions.length === 0) return null;

  const pos = positions[0][1];
  const chunk = html.slice(pos, pos + 6000);
  const priceMatch = chunk.match(/displayPrice[^>]*>\s*([^<]{2,30}?)\s*</);
  if (!priceMatch) return null;

  const raw = priceMatch[1].replace(/[^\d.,]/g, "");
  const value = Number(raw.replace(/[.,](?=\d{3}\b)/g, "").replace(",", "."));
  if (Number.isFinite(value) && value >= 1 && value <= 500_000) {
    return Math.round(value * 100);
  }
  return null;
}

/**
 * Refreshes the displayed price of every piece that is currently listed on a
 * marketplace. Only pieces with stock are touched.
 */
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function refreshMarketplacePrices(
  ebayStoreUrl: string,
): Promise<{ results: PriceCheckResult[]; checked: number; changed: number }> {
  const rows = await db
    .select()
    .from(products)
    .where(and(isNotNull(products.externalListingUrl), gt(products.stock, 0)));

  const results: PriceCheckResult[] = [];

  for (const p of rows) {
    const url = p.externalListingUrl!;
    const channel = p.listingChannel ?? "direct";
    let currentCents: number | null = null;
    let error: string | undefined;

    try {
      if (channel === "catawiki") {
        currentCents = await readCatawikiPrice(url);
      } else if (channel === "ebay") {
        // eBay rate-limits aggressively; one retry after a pause usually clears it.
        currentCents = await readEbayPrice(url, ebayStoreUrl);
        if (currentCents === null) {
          await wait(3_000);
          currentCents = await readEbayPrice(url, ebayStoreUrl);
        }
      }
    } catch {
      error = "could not read the listing";
    }

    if (currentCents === null) {
      results.push({
        slug: p.slug,
        name: p.name,
        channel,
        previousCents: p.priceCents,
        currentCents: null,
        changed: false,
        error: error ?? "no price found",
      });
      continue;
    }

    const changed = currentCents !== p.priceCents;
    if (changed) {
      await db.update(products).set({ priceCents: currentCents }).where(eq(products.id, p.id));
    }
    await db
      .update(products)
      .set({ lastPriceCheck: new Date() })
      .where(eq(products.id, p.id));

    results.push({
      slug: p.slug,
      name: p.name,
      channel,
      previousCents: p.priceCents,
      currentCents,
      changed,
    });
  }

  return { results, checked: results.length, changed: results.filter((r) => r.changed).length };
}
