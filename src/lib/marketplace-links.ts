/** Pure helpers shared by the admin and server. Never import database drivers here. */
export type Marketplace = "ebay" | "catawiki";
export type MarketplaceLink = { channel: Marketplace; url: string; linkedAt: string; identityTokens?: string[] };
export type LinkedSpecimen = {
  id?: number | null;
  name?: string;
  slug?: string;
  species?: string;
  description?: string;
  specimenReference?: string | null;
  listingChannel?: string | null;
  externalListingUrl?: string | null;
  ebayListingUrl?: string | null;
  catawikiListingUrl?: string | null;
  marketplaceHistory?: MarketplaceLink[] | null;
};

export function marketplaceOf(input: string | null | undefined): Marketplace | null {
  if (!input) return null;
  try {
    const url = new URL(input);
    if (!/^https?:$/.test(url.protocol)) return null;
    if (/(^|\.)catawiki\.(com|nl|de|fr|es|it|pt)$/i.test(url.hostname)) return "catawiki";
    if (/(^|\.)ebay\.(com|co\.uk|de|es|fr|it|nl|be|at|ch|ie|ca|com\.au|com\.hk|com\.my|com\.sg|ph|pl)$/i.test(url.hostname)) return "ebay";
  } catch {}
  return null;
}

export function listingKey(input: string | null | undefined): string | null {
  const channel = marketplaceOf(input);
  if (!channel || !input) return null;
  const path = new URL(input).pathname;
  const id = channel === "ebay"
    ? path.match(/\/itm\/(?:[^/]+\/)?(\d{9,15})(?:\/|$)/)?.[1]
    : path.match(/\/l\/(\d+)/)?.[1];
  return id ? `${channel}:${id}` : null;
}

export function canonicalListing(input: string, expected?: Marketplace): string | null {
  const key = listingKey(input);
  if (!key || (expected && !key.startsWith(`${expected}:`))) return null;
  const [channel, id] = key.split(":");
  return channel === "ebay" ? `https://www.ebay.com/itm/${id}` : `https://www.catawiki.com/en/l/${id}`;
}

/** Preserve every remembered listing; deduplicate tracking URLs and regional domains by item ID. */
export function rememberedLinks(specimen: LinkedSpecimen): MarketplaceLink[] {
  const links: MarketplaceLink[] = [];
  const add = (raw: string | null | undefined, linkedAt = "", identityTokens: string[] = []) => {
    const channel = marketplaceOf(raw);
    const url = raw && channel ? canonicalListing(raw, channel) : null;
    if (!channel || !url) return;
    const tokens = identityTokens.filter((token) => /^[a-f0-9]{64}$/i.test(token)).slice(0, 16);
    const same = links.find((entry) => listingKey(entry.url) === listingKey(url));
    if (same) { if (tokens.length) same.identityTokens = Array.from(new Set([...(same.identityTokens ?? []), ...tokens])); return; }
    links.push({ channel, url, linkedAt, ...(tokens.length ? { identityTokens: tokens } : {}) });
  };
  for (const entry of specimen.marketplaceHistory ?? []) {
    if (entry && typeof entry.url === "string") add(entry.url, typeof entry.linkedAt === "string" ? entry.linkedAt : "", Array.isArray(entry.identityTokens) ? entry.identityTokens : []);
  }
  add(specimen.ebayListingUrl);
  add(specimen.catawikiListingUrl);
  add(specimen.externalListingUrl);
  return links;
}

export function savedListing(specimen: LinkedSpecimen, channel: Marketplace): string | null {
  const dedicated = channel === "ebay" ? specimen.ebayListingUrl : specimen.catawikiListingUrl;
  if (dedicated && marketplaceOf(dedicated) === channel) return canonicalListing(dedicated, channel);
  if (marketplaceOf(specimen.externalListingUrl) === channel) return canonicalListing(specimen.externalListingUrl!, channel);
  return rememberedLinks(specimen).filter((entry) => entry.channel === channel).at(-1)?.url ?? null;
}

/** Only the selected channel is eligible for scheduled price checks. */
export function activeListing(specimen: LinkedSpecimen): { channel: Marketplace; url: string } | null {
  const channel = specimen.listingChannel;
  if (channel !== "ebay" && channel !== "catawiki") return null;
  const url = savedListing(specimen, channel);
  return url ? { channel, url } : null;
}

/** These are metadata changes only — never photos, descriptions, stock or prices. */
export function rememberListing(specimen: LinkedSpecimen, channel: Marketplace, rawUrl: string, now = new Date().toISOString(), identityTokens: string[] = []) {
  const url = canonicalListing(rawUrl, channel);
  if (!url) throw new Error(`Enter a valid ${channel === "ebay" ? "eBay item" : "Catawiki lot"} link.`);
  const history = rememberedLinks(specimen);
  const same = history.find((entry) => listingKey(entry.url) === listingKey(url));
  const tokens = identityTokens.filter((token) => /^[a-f0-9]{64}$/i.test(token)).slice(0, 16);
  if (!same) history.push({ channel, url, linkedAt: now, ...(tokens.length ? { identityTokens: tokens } : {}) });
  else if (tokens.length) same.identityTokens = Array.from(new Set([...(same.identityTokens ?? []), ...tokens]));
  return {
    ebayListingUrl: channel === "ebay" ? url : savedListing(specimen, "ebay"),
    catawikiListingUrl: channel === "catawiki" ? url : savedListing(specimen, "catawiki"),
    marketplaceHistory: history,
  };
}

/**
 * A collection reference is a unique 4-digit code, optionally carried by a fixed
 * four-letter prefix (e.g. PAIS9676). The digits alone identify the piece, so
 * they are the matching key across platforms and listings.
 */
export const COLLECTION_REFERENCE_PATTERN = /\b([A-Z]{2,6})?(\d{4})\b/;

/** The display form: "PAIS9676" when a prefix is present, otherwise "9676". */
export function normalizeReference(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim().toUpperCase();
  const prefixed = trimmed.match(/^([A-Z]{2,6})(\d{4})$/);
  if (prefixed) return `${prefixed[1]}${prefixed[2]}`;
  const bare = trimmed.match(/^(\d{4})$/);
  if (bare) return bare[1];
  return trimmed.length <= 12 ? trimmed : null;
}

/** The 4-digit core used for matching, regardless of prefix or separator. */
export function referenceCore(input: string | null | undefined): string | null {
  const reference = normalizeReference(input);
  if (!reference) return null;
  return reference.match(/(\d{4})\s*$/)?.[1] ?? null;
}

/** Finds a collection reference anywhere in a title, description or URL. */
export function extractSpecimenReference(text: string): string | null {
  if (!text) return null;
  // Explicit labels first.
  const labelled = text.match(
    /(?:specimen\s*(?:id|number|no\.?|ref(?:erence)?)|catalog(?:ue)?\s*(?:id|number|no\.?)|\bSKU\b|\bREF\b)\s*[:#-]?\s*([A-Z]{2,6}\d{4}|\d{4})\b/i,
  );
  if (labelled) return normalizeReference(labelled[1]);
  // A fixed prefix immediately followed by the code, e.g. PAIS9676.
  const prefixed = text.match(/\b([A-Z]{4})(\d{4})\b/);
  if (prefixed) return normalizeReference(`${prefixed[1]}${prefixed[2]}`);
  // A catalogue number in a URL path or a hash, e.g. /9676-… or #9676.
  const inUrl = text.match(/\/(\d{4})-[a-z]/i) ?? text.match(/#\s*(\d{4})\b/);
  if (inUrl) return normalizeReference(inUrl[1]);
  // A leading code, the way listings are titled. A plausible year is not a code.
  const leading = text.match(/^\s*(?:UNAVAILABLE\s+)?(\d{4})\s+[a-z]/i)?.[1];
  if (leading && !(Number(leading) >= 1800 && Number(leading) <= 2100)) return normalizeReference(leading);
  return null;
}

export function specimenReferenceOf(specimen: LinkedSpecimen): string | null {
  return normalizeReference(specimen.specimenReference)
    || extractSpecimenReference(specimen.externalListingUrl ?? "")
    || extractSpecimenReference(specimen.name ?? "")
    || extractSpecimenReference(specimen.description ?? "");
}

export type ListingMatch = {
  kind: "exact" | "reference" | "identity" | "candidate" | "new";
  productId?: number;
  candidates: { id: number; name: string; channel: string | null }[];
};

export function matchListing(listing: { url: string; title: string; reference?: string | null; description?: string; identityTokens?: string[] }, specimens: LinkedSpecimen[]): ListingMatch {
  const key = listingKey(listing.url);
  const exact = key ? specimens.filter((p) => rememberedLinks(p).some((entry) => listingKey(entry.url) === key)) : [];
  const toChoices = (rows: LinkedSpecimen[]) => rows.filter((p) => p.id).map((p) => ({ id: p.id!, name: p.name || p.slug || String(p.id), channel: p.listingChannel ?? null }));
  if (exact.length === 1) return { kind: "exact", productId: exact[0].id ?? undefined, candidates: toChoices(exact) };
  if (exact.length > 1) return { kind: "candidate", candidates: toChoices(exact) };
  const reference = normalizeReference(listing.reference) || extractSpecimenReference(listing.description ?? "") || extractSpecimenReference(listing.title);
  const core = referenceCore(reference);
  const byReference = core ? specimens.filter((p) => referenceCore(specimenReferenceOf(p)) === core) : [];
  if (byReference.length === 1) return { kind: "reference", productId: byReference[0].id ?? undefined, candidates: toChoices(byReference) };
  if (byReference.length > 1) return { kind: "candidate", candidates: toChoices(byReference) };
  if (listing.identityTokens?.length) {
    const signatures = new Set(listing.identityTokens);
    const matches = specimens.filter((p) => rememberedLinks(p).some((entry) => entry.identityTokens?.some((token) => signatures.has(token))));
    if (matches.length === 1) return { kind: "identity", productId: matches[0].id ?? undefined, candidates: toChoices(matches) };
    if (matches.length > 1) return { kind: "candidate", candidates: toChoices(matches) };
  }
  // Species/name similarity is a suggestion only: two fossils of the same species are NOT the same piece.
  const normalized = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const title = normalized(listing.title);
  const candidates = specimens.filter((p) => {
    const species = normalized(p.species ?? "").trim();
    const name = normalized(p.name ?? "").trim();
    const genus = species.split(/\s+/)[0];
    return (species.length >= 5 && title.includes(species)) || (name.length >= 6 && title.includes(name))
      || (genus.length >= 5 && new RegExp(`\\b${genus.replace(/[^a-z]/g, "")}\\b`).test(title));
  });
  return { kind: candidates.length ? "candidate" : "new", candidates: toChoices(candidates) };
}
