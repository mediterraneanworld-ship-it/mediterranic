/**
 * eBay integration through the official Browse API.
 *
 * Why: eBay blocks datacenter IPs (Vercel, sandboxes, CI) with HTTP 403, so
 * scraping the store page worked only for a while. With app credentials the
 * API answers reliably from any server.
 *
 * Configure in the Vercel project (Settings → Environment Variables):
 *   EBAY_CLIENT_ID      = App ID  (Client ID)
 *   EBAY_CLIENT_SECRET  = Cert ID (Client Secret)
 *   EBAY_MARKETPLACE_ID = optional, default EBAY_US
 *
 * Keys come free from https://developer.ebay.com → Application Keys (Production).
 * Without them the shop still works; imports fall back to reading the public
 * page and, when eBay blocks it, to manual entry.
 */

export type EbayItem = {
  legacyItemId: string;
  title: string;
  priceCents: number | null;
  currency: string;
  imageUrls: string[];
  itemWebUrl: string;
  condition?: string;
  description?: string;
  aspects?: Record<string, string[]>;
};

export function hasEbayCredentials(): boolean {
  return Boolean(process.env.EBAY_CLIENT_ID?.trim() && process.env.EBAY_CLIENT_SECRET?.trim());
}

const API = "https://api.ebay.com";
const MARKETPLACE = process.env.EBAY_MARKETPLACE_ID?.trim() || "EBAY_US";
const SCOPE = "https://api.ebay.com/oauth/api_scope";

type CachedToken = { token: string; expiresAt: number };
const globalForEbay = globalThis as typeof globalThis & { __ebayToken?: CachedToken };

export class EbayNotConfiguredError extends Error {
  constructor() {
    super("EBAY_NOT_CONFIGURED");
  }
}

/** Application token (client_credentials), cached in memory until it expires. */
async function getAppToken(): Promise<string> {
  if (!hasEbayCredentials()) throw new EbayNotConfiguredError();

  const cached = globalForEbay.__ebayToken;
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const basic = Buffer.from(
    `${process.env.EBAY_CLIENT_ID!.trim()}:${process.env.EBAY_CLIENT_SECRET!.trim()}`,
  ).toString("base64");

  const res = await fetch(`${API}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=client_credentials&scope=${encodeURIComponent(SCOPE)}`,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`eBay token failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  globalForEbay.__ebayToken = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(60, data.expires_in ?? 7_200) * 1_000,
  };
  return data.access_token;
}

function toCents(price?: { value?: string; currency?: string }): number | null {
  if (!price?.value) return null;
  const value = Number(price.value);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
}

/** Extracts the numeric item id from any eBay item URL (or a bare id). */
export function ebayItemIdFromUrl(url: string): string | null {
  const bare = url.trim().match(/^\d{9,15}$/);
  if (bare) return bare[0];
  const fromUrl = url.match(/\/itm\/(?:[^/]*\/)?(\d{9,15})/);
  return fromUrl ? fromUrl[1] : null;
}

type BrowseItem = {
  legacyItemId?: string;
  itemId?: string;
  title?: string;
  price?: { value?: string; currency?: string };
  image?: { imageUrl?: string };
  additionalImages?: { imageUrl?: string }[];
  itemWebUrl?: string;
  shortDescription?: string;
  description?: string;
  condition?: string;
  localizedAspects?: { name?: string; value?: string }[];
};

function mapItem(raw: BrowseItem, fallbackId: string): EbayItem {
  const aspects: Record<string, string[]> = {};
  for (const aspect of raw.localizedAspects ?? []) {
    if (!aspect?.name || !aspect?.value) continue;
    aspects[aspect.name] = [aspect.value];
  }
  const images = [raw.image?.imageUrl, ...(raw.additionalImages ?? []).map((i) => i.imageUrl)]
    .filter((src): src is string => Boolean(src))
    .map((src) => src.replace(/\/s-l\d+\.(jpg|jpeg|png|webp)$/i, "/s-l1600.$1"));

  return {
    legacyItemId: raw.legacyItemId ?? fallbackId,
    title: (raw.title ?? "").trim(),
    priceCents: toCents(raw.price),
    currency: raw.price?.currency ?? "EUR",
    imageUrls: Array.from(new Set(images)).slice(0, 8),
    itemWebUrl: raw.itemWebUrl ?? `https://www.ebay.com/itm/${fallbackId}`,
    condition: raw.condition,
    description: (raw.shortDescription ?? raw.description ?? "").trim(),
    aspects,
  };
}

/** One listing, by item id or by any eBay item URL. */
export async function getEbayItem(input: string): Promise<EbayItem | null> {
  const legacyId = ebayItemIdFromUrl(input);
  if (!legacyId) return null;
  const token = await getAppToken();

  const res = await fetch(
    `${API}/buy/browse/v1/item/get_item_by_legacy_id?legacy_item_id=${encodeURIComponent(legacyId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": MARKETPLACE,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    },
  );

  if (!res.ok) return null;
  return mapItem((await res.json()) as BrowseItem, legacyId);
}

/** The seller's active listings, newest first (Browse API, no user login needed). */
export async function listEbaySellerItems(username: string, limit = 50): Promise<EbayItem[]> {
  const clean = username.replace(/^@/, "").trim();
  if (!clean) return [];
  const token = await getAppToken();

  const url =
    `${API}/buy/browse/v1/item_summary/search` +
    `?filter=${encodeURIComponent(`sellers:{${clean}}`)}` +
    `&limit=${Math.min(200, Math.max(1, limit))}&sort=newlyListed`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": MARKETPLACE,
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`eBay search failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as { itemSummaries?: BrowseItem[] };
  return (data.itemSummaries ?? []).map((raw) => mapItem(raw, raw.legacyItemId ?? raw.itemId ?? ""));
}

/** Pulls a seller name out of ebay.com/str/<name> or ebay.com/usr/<name>. */
export function ebaySellerFromUrl(url: string): string | null {
  const match = url.match(/ebay\.[a-z.]+\/(?:str|usr)\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]) : null;
}
