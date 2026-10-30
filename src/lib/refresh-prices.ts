import { and, eq, isNotNull, gt } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export type ListingStatus = "live" | "sold" | "unsold" | "ended" | "unknown";

export type PriceCheckResult = {
  slug: string;
  name: string;
  channel: string;
  previousCents: number | null;
  currentCents: number | null;
  changed: boolean;
  status: ListingStatus;
  /** Set when the auction has ended and the piece was marked unavailable. */
  markedUnavailable?: boolean;
  error?: string;
};

/**
 * Reads a rendered Catawiki lot. Returns the current bid (in cents) and
 * whether the auction is still running. An ended lot shows "Sold" / "Final bid"
 * (or "not sold") instead of "Current bid" / "Place bid".
 */
async function readCatawikiPrice(
  url: string,
): Promise<{ cents: number | null; status: ListingStatus }> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { "User-Agent": UA },
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) return { cents: null, status: "unknown" };
  const text = await res.text();

  // Cut the text before the "other lots" carousel: every entry there says
  // "Current bid €… · N days left" and would be mistaken for this lot.
  const carouselAt = text.search(/\n\*\s+\[!\[Image \d+\]\(https:\/\/assets\.catawiki/i);
  const head = carouselAt > 0 ? text.slice(0, carouselAt) : text.slice(0, 9000);

  // "Not sold" / reserve not met → the piece returns to Site Only.
  // A running auction can show "Reserve price not met" while bidding is open,
  // so that phrase alone never ends an auction. "Place bid" with no closing
  // marker is the reliable sign that the lot is still live.
  const hasPlaceBid = /\bPlace bid\b/i.test(head);
  const hasFinalBid = /\bFinal bid\b/i.test(head);
  const soldLine = /^\s*Sold\s*$/im.test(head);
  const notSold = /\bNot sold\b/i.test(head);
  const closed = /\bBidding closed\b/i.test(head) || hasFinalBid || soldLine || notSold;
  const reserveNotMet = /reserve (price )?(was )?not (been )?met/i.test(head);

  let status: ListingStatus = "unknown";
  if (hasPlaceBid && !closed) status = "live";
  else if (closed) {
    status = !notSold && !reserveNotMet && (hasFinalBid || soldLine) ? "sold" : "unsold";
  }

  // A lot with no bids yet shows "Starting bid"; once bidding starts it shows
  // "Current bid". Either is the price the shop should display.
  const patterns = [
    /(?:Current|Starting) bid\s*\n?\s*€\s?([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/i,
    /(?:Current|Starting) bid[^€\d]{0,20}€\s?([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/i,
    /(?:Buy now|price)\s*[:\n]?\s*€\s?([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/i,
  ];
  for (const re of patterns) {
    const m = head.match(re);
    if (m?.[1]) {
      const value = Number(m[1].replace(/[.,](?=\d{3}\b)/g, "").replace(",", "."));
      if (Number.isFinite(value) && value >= 1 && value <= 500_000) {
        return { cents: Math.round(value * 100), status };
      }
    }
  }
  return { cents: null, status };
}

/** Reads the current price of an eBay item from the store page it is listed on. */
async function readEbayPrice(itemUrl: string, storeUrl: string): Promise<number | "ended" | null> {
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
  // Store page loaded fine but the item is gone from it: the listing ended.
  if (positions.length === 0) return "ended";

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
): Promise<{ results: PriceCheckResult[]; checked: number; changed: number; ended: number }> {
  const rows = await db
    .select()
    .from(products)
    .where(and(isNotNull(products.externalListingUrl), gt(products.stock, 0)));

  const results: PriceCheckResult[] = [];

  for (const p of rows) {
    const url = p.externalListingUrl!;
    const channel = p.listingChannel ?? "direct";
    // Read the marketplace the listing URL points to (not the current channel),
    // so a piece moved off its auction by mistake is restored automatically.
    const marketplace = url.includes("catawiki.") ? "catawiki" : url.includes("ebay.") ? "ebay" : null;
    const onMarketplace = channel === "catawiki" || channel === "ebay";
    let currentCents: number | null = null;
    let status: ListingStatus = "unknown";
    let error: string | undefined;

    try {
      if (marketplace === "catawiki") {
        const read = await readCatawikiPrice(url);
        currentCents = read.cents;
        status = read.status;
      } else if (marketplace === "ebay") {
        // eBay rate-limits aggressively; one retry after a pause usually clears it.
        let read = await readEbayPrice(url, ebayStoreUrl);
        if (read === null) {
          await wait(3_000);
          read = await readEbayPrice(url, ebayStoreUrl);
        }
        if (read === "ended") {
          status = "sold";
        } else if (read !== null) {
          currentCents = read;
          status = "live";
        }
      }
    } catch {
      error = "could not read the listing";
    }

    // Sold (no reserve, or reserve met): unavailable, no price, into the public archive.
    if (status === "sold") {
      await db
        .update(products)
        .set({ stock: 0, listingChannel: null, archived: true, lastPriceCheck: new Date() })
        .where(eq(products.id, p.id));
      results.push({
        slug: p.slug, name: p.name, channel,
        previousCents: p.priceCents, currentCents: null,
        changed: true, status: "sold", markedUnavailable: true,
      });
      continue;
    }

    // Ended unsold: back to Site Only, at the price set in "When in Site Only".
    if (status === "unsold" && onMarketplace) {
      const newPrice = p.siteOnlyPriceCents ?? p.priceCents;
      await db
        .update(products)
        .set({ listingChannel: "direct", priceCents: newPrice, lastPriceCheck: new Date() })
        .where(eq(products.id, p.id));
      results.push({
        slug: p.slug, name: p.name, channel,
        previousCents: p.priceCents, currentCents: newPrice,
        changed: true, status: "unsold",
      });
      continue;
    }

    if (status === "unsold") {
      // Already off the auction (e.g. Site Only): leave it exactly as it is.
      await db.update(products).set({ lastPriceCheck: new Date() }).where(eq(products.id, p.id));
      results.push({ slug: p.slug, name: p.name, channel, previousCents: p.priceCents, currentCents: p.priceCents, changed: false, status });
      continue;
    }

    if (currentCents === null) {
      results.push({
        slug: p.slug,
        name: p.name,
        channel,
        previousCents: p.priceCents,
        currentCents: null,
        changed: false,
        status,
        error: error ?? "no price found",
      });
      continue;
    }

    // Live auction: keep the price current and the right marketplace badge.
    const restoreChannel = status === "live" && marketplace !== null && channel !== marketplace;
    const changed = currentCents !== p.priceCents || restoreChannel;
    if (changed) {
      await db
        .update(products)
        .set({ priceCents: currentCents, ...(restoreChannel ? { listingChannel: marketplace } : {}) })
        .where(eq(products.id, p.id));
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
      status,
    });
  }

  return {
    results,
    checked: results.length,
    changed: results.filter((r) => r.changed).length,
    ended: results.filter((r) => r.changed && (r.status === "sold" || r.status === "unsold")).length,
  };
}
