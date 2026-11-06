import { and, eq, inArray, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { activeListing, savedListing, rememberedLinks } from "@/lib/marketplace-links";
import { ebayErrorMessage, ebayItemIdFromUrl, getEbayItem, hasEbayCredentials } from "@/lib/ebay";

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
  signal?: AbortSignal,
): Promise<{ cents: number | null; status: ListingStatus }> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { "User-Agent": UA, "X-No-Cache": "true", "X-Cache-Tolerance": "0" },
    cache: "no-store",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000),
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
async function readEbayPagePrice(itemUrl: string, storeUrl: string, signal?: AbortSignal): Promise<number | null> {
  const itemId = ebayItemIdFromUrl(itemUrl);
  if (!itemId) return null;

  const res = await fetch(storeUrl, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
    cache: "no-store",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  const html = await res.text();

  // eBay often answers servers with a 200 "security check" page instead of the
  // store. Such a page has no listings, and must NEVER be read as "the item is
  // gone" — that would archive a live piece as sold. Only a real store page,
  // with several listings on it, can prove that this one has ended.
  const otherListings = new Set(Array.from(html.matchAll(/\/itm\/(\d{6,13})/g), (m) => m[1]));
  const looksBlocked = /pardon our interruption|security measure|captcha|access denied|are you a robot/i.test(
    html.slice(0, 20_000),
  );
  if (looksBlocked || otherListings.size < 3) return null;

  const positions: [string, number][] = [];
  for (const m of html.matchAll(new RegExp(`/itm/${itemId}`, "g"))) {
    positions.push([itemId, m.index ?? 0]);
  }
  // Missing from one page is not evidence of a sale (pagination/relisting).
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

/** The cron and manual refresh use exactly the same authenticated eBay reader. */
async function readEbayPrice(itemUrl: string, storeUrl: string, signal?: AbortSignal): Promise<{
  cents: number | null; status: ListingStatus; error?: string;
}> {
  if (hasEbayCredentials()) {
    const item = await getEbayItem(itemUrl, signal);
    if (!item?.active) return {
      cents: null, status: "unknown",
      error: "eBay did not confirm an active listing. Existing data kept; an absent item does not prove a sale.",
    };
    if (item.priceCents === null) return {
      cents: null, status: "unknown",
      error: `eBay returned no EUR price (${item.currency || "unknown currency"}). Existing euro price kept.`,
    };
    return { cents: item.priceCents, status: "live" };
  }
  const price = await readEbayPagePrice(itemUrl, storeUrl, signal);
  return price === null
    ? { cents: null, status: "unknown", error: "eBay keys are missing in this deployment and the page could not be read. Existing data kept." }
    : { cents: price, status: "live" };
}

/**
 * Refreshes the displayed price of every piece that is currently listed on a
 * marketplace. Only pieces with stock are touched.
 */
export async function refreshMarketplacePrices(ebayStoreUrl: string, options: { deadline?: number; hints?: Map<string, { cents: number | null; status: ListingStatus }> } = {}): Promise<{
  results: PriceCheckResult[]; checked: number; changed: number; ended: number;
}> {
  const rows = await db.select().from(products).where(and(
    inArray(products.listingChannel, ["catawiki", "ebay"]), gt(products.stock, 0),
    eq(products.archived, false), eq(products.published, true),
  ));
  const reports = new Map<number, PriceCheckResult>();
  const deadline = options.deadline ?? Date.now() + 70_000;
  let cursor = 0;
  async function inspect(p: typeof products.$inferSelect) {
    const channel = p.listingChannel;
    if (channel !== "ebay" && channel !== "catawiki") return;
    const result: PriceCheckResult = {
      slug: p.slug, name: p.name, channel, previousCents: p.priceCents,
      currentCents: null, changed: false, status: "unknown",
    };
    reports.set(p.id, result);
    if (Date.now() >= deadline) { result.error = "Not checked within this run's time budget. Existing data kept; check again."; return; }
    const active = activeListing(p);
    if (!active) { result.error = `No ${channel} URL is saved. Set the active link in the editor.`; return; }
    try {
      const signal = AbortSignal.timeout(Math.max(1000, deadline - Date.now()));
      const read = options.hints?.get(active.url) ?? (channel === "ebay" ? await readEbayPrice(active.url, ebayStoreUrl, signal) : await readCatawikiPrice(active.url, signal));
      result.status = read.status;
      if ("error" in read && typeof read.error === "string") result.error = read.error;
      if (read.status === "unknown") { result.error ||= "The listing state could not be confirmed; existing data kept."; return; }
      if (read.status === "live" && p.marketplaceActive === false && !options.hints?.has(active.url)) {
        result.error = "This saved URL is absent from the verified active inventory. A related/redirected page was not allowed to reactivate it without a confirmed listing match.";
        return;
      }
      const values: Partial<typeof products.$inferInsert> = { lastPriceCheck: new Date() };
      if (read.status === "sold") {
        Object.assign(values, { stock: 0, archived: true, listingChannel: null,
          ebayListingUrl: savedListing(p, "ebay"), catawikiListingUrl: savedListing(p, "catawiki"), marketplaceHistory: rememberedLinks(p) });
      } else if (read.status === "unsold") {
        if (!p.siteOnlyPriceCents || p.siteOnlyPriceCents <= 0) { result.error = "Set 'When in Site Only' before returning an unpurchased specimen to direct sale. The auction bid was not used."; return; }
        Object.assign(values, { listingChannel: "direct", priceCents: p.siteOnlyPriceCents,
          ebayListingUrl: savedListing(p, "ebay"), catawikiListingUrl: savedListing(p, "catawiki"), marketplaceHistory: rememberedLinks(p) });
      } else if (read.status === "live" && read.cents !== null) {
        values.priceCents = read.cents;
        values.marketplaceActive = true; values.marketplaceCheckedAt = new Date();
      } else { result.error ||= "No current price was confirmed; existing data kept."; return; }
      // Optimistic concurrency: a manual channel, stock, URL or price edit made
      // during the fetch wins. A stale external result never overwrites it.
      const changed = await db.update(products).set(values).where(and(
        eq(products.id, p.id), eq(products.listingChannel, channel),
        eq(products.priceCents, p.priceCents), eq(products.stock, p.stock),
        eq(products.archived, false), eq(products.published, true),
        sql`${products.externalListingUrl} IS NOT DISTINCT FROM ${p.externalListingUrl}`,
      )).returning({ id: products.id });
      if (!changed.length) { result.error = "Specimen changed during this check. Your edit was kept; check again."; return; }
      result.currentCents = read.status === "sold" ? null : values.priceCents ?? p.priceCents;
      result.changed = read.status === "sold" || read.status === "unsold" || values.priceCents !== p.priceCents;
      if (read.status === "sold") result.markedUnavailable = true;
    } catch (error) {
      result.error = channel === "ebay" ? ebayErrorMessage(error) : "Could not read the listing; existing data kept.";
    }
  }
  async function worker() {
    while (cursor < rows.length) {
      const index = cursor++;
      await inspect(rows[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, rows.length) }, worker));
  const results = rows.map((row) => reports.get(row.id)).filter((row): row is PriceCheckResult => Boolean(row));
  return {
    results, checked: results.length, changed: results.filter((row) => row.changed).length,
    ended: results.filter((row) => row.changed && (row.status === "sold" || row.status === "unsold")).length,
  };
}
