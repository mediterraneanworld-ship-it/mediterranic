import { canonicalListing, extractSpecimenReference } from "@/lib/marketplace-links";
import type { InventorySource, RemoteListing } from "@/lib/inventory-rules";

const UA = "Mediterranic inventory synchronizer";
export function euroCents(input: string): number | null {
  const match = input.match(/€\s*([0-9][0-9.,]*)/);
  if (!match) return null;
  let amount = match[1];
  const comma = amount.lastIndexOf(","), dot = amount.lastIndexOf(".");
  const separator = Math.max(comma, dot);
  if (separator >= 0 && amount.length - separator - 1 === 2) {
    amount = amount.slice(0, separator).replace(/[.,]/g, "") + "." + amount.slice(separator + 1);
  } else amount = amount.replace(/[.,]/g, "");
  const value = Number(amount);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
}

/** Only cards inside this seller's "In auction now" section are offers. */
export function parseCatawikiInventory(text: string, checkedAt = new Date().toISOString()): InventorySource {
  if (/Warning: Target URL returned error|Title: (?:Error|Just a moment)|captcha/i.test(text.slice(0, 1200))) {
    return { ok: false, complete: false, checkedAt, count: null, listings: [], error: "Catawiki seller inventory could not be verified." };
  }
  const expectedMatch = text.match(/All lots\s*\((\d+)\)/i);
  const expected = expectedMatch ? Number(expectedMatch[1]) : null;
  const start = text.search(/In auction now/i);
  if (start < 0 && expected !== 0) return { ok: false, complete: false, checkedAt, count: null, listings: [], error: "The seller's active-lot section was not found; existing data kept." };
  const rest = start < 0 ? "" : text.slice(start);
  const end = rest.search(/\nSeller story\b|\nAbout the seller\b|\nYou may also like\b/i);
  const scoped = end < 0 ? rest : rest.slice(0, end);
  const seen = new Set<string>(); const listings: RemoteListing[] = [];
  const excluded = /ammonit|nautil|shell|mineral|meteorit|tooth|amber|fish|coral|crustacean|echinoid|bivalve|gastropod|orthoceras|goniatit|stromatolit|crinoid|brachiopod/i;
  for (const match of scoped.matchAll(/\[([^\]]+)\]\((https?:\/\/(?:www\.)?catawiki\.com\/[a-z]{2}\/l\/\d+[^\s)]*)(?:\s+"([^"]*)")?\)/gi)) {
    const url = canonicalListing(match[2], "catawiki");
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const title = (match[3] || match[1].replace(/^\d+\s+(?:Free shipping\s+)?/i, "").split(/(?:Current|Starting) bid/i)[0]).trim();
    if (excluded.test(title) && !/trilobit|bigotina|perrector|comura|cyphaspis|dicranurus|daguinaspis/i.test(title)) continue;
    listings.push({ channel: "catawiki", url, title, description: "", reference: extractSpecimenReference(title), priceCents: euroCents(match[1]), imageUrls: [] });
  }
  const complete = expected !== null && seen.size === expected;
  return { ok: complete || listings.length > 0, complete, checkedAt, count: complete ? listings.length : null, listings,
    ...(complete ? {} : { error: "Only part of the active seller inventory was readable. Missing items were not treated as ended." }) };
}

export async function readFreshMarketplaceText(url: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(`https://r.jina.ai/${url}`, {
    headers: { "User-Agent": UA, Accept: "text/plain", "X-No-Cache": "true", "X-Cache-Tolerance": "0" },
    cache: "no-store",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(18_000)]) : AbortSignal.timeout(18_000),
  });
  if (!response.ok) throw new Error(`Marketplace reader returned HTTP ${response.status}; existing data kept.`);
  const text = await response.text();
  if (/Warning: Target URL returned error|Title: (?:Error|Just a moment)/i.test(text.slice(0, 1200))) throw new Error("Marketplace page could not be verified; existing data kept.");
  return text;
}

export async function discoverCatawikiInventory(sellerUrl: string, signal?: AbortSignal): Promise<InventorySource> {
  const parsed = new URL(sellerUrl);
  if (!/(^|\.)catawiki\.com$/i.test(parsed.hostname) || !/\/[a-z]{2}\/u\/\d+/.test(parsed.pathname)) throw new Error("Set a valid Catawiki seller profile URL in the admin.");
  return parseCatawikiInventory(await readFreshMarketplaceText(sellerUrl, signal));
}

/** A relisted Catawiki lot may redirect to a new number while retaining #specimen ID. */
export function parseCatawikiIdentity(text: string, requestedUrl: string) {
  const finalUrl = canonicalListing(text.match(/^Final URL:\s*(\S+)/mi)?.[1] || requestedUrl, "catawiki");
  const title = text.match(/^Title:\s*(.+)/mi)?.[1]?.trim() ?? "";
  const description = text.split(/Markdown Content:\s*/i)[1] || text;
  return { finalUrl, title, description, reference: extractSpecimenReference(description) || extractSpecimenReference(title) };
}
