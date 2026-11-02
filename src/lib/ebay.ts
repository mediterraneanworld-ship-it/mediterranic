/** Server-side eBay Browse integration. Never expose credentials or tokens. */

export type EbayItem = {
  legacyItemId: string;
  title: string;
  /** EUR cents only. Null when no EUR amount is available; never relabel USD as EUR. */
  priceCents: number | null;
  /** Currency of the amount returned by eBay, before any convertedFromValue handling. */
  currency: string;
  sourcePrice: string | null;
  imageUrls: string[];
  itemWebUrl: string;
  condition?: string;
  description?: string;
  aspects?: Record<string, string[]>;
  sellerUsername: string | null;
  itemEndDate: string | null;
  /** An unavailable/missing item is NOT proof that it was purchased. */
  active: boolean;
  auction?: boolean;
};

export function hasEbayCredentials(): boolean {
  return Boolean(process.env.EBAY_CLIENT_ID?.trim() && process.env.EBAY_CLIENT_SECRET?.trim());
}

export function ebayMarketplace(): string {
  return process.env.EBAY_MARKETPLACE_ID?.trim() || "EBAY_US";
}

export class EbayNotConfiguredError extends Error {
  readonly code = "EBAY_NOT_CONFIGURED";
  constructor() {
    super("Add EBAY_CLIENT_ID and EBAY_CLIENT_SECRET to this deployment, then redeploy. Vercel variables are not automatically shared with the development sandbox.");
    this.name = "EbayNotConfiguredError";
  }
}

export class EbayApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "EbayApiError";
  }
}

/** Safe messages only: upstream response bodies and authorization headers never reach the UI. */
export function ebayErrorMessage(error: unknown): string {
  if (error instanceof EbayApiError || error instanceof EbayNotConfiguredError) return error.message;
  return "Could not contact eBay. Please try again; existing shop data has not been changed.";
}

export function ebayErrorCode(error: unknown): string {
  return error instanceof EbayApiError || error instanceof EbayNotConfiguredError ? error.code : "EBAY_CONNECTION_ERROR";
}

const API = "https://api.ebay.com";
const SCOPE = "https://api.ebay.com/oauth/api_scope";
const globalForEbay = globalThis as typeof globalThis & {
  __mediterranicEbayToken?: { token: string; expiresAt: number; clientId: string };
};

async function getAppToken(signal?: AbortSignal): Promise<string> {
  if (!hasEbayCredentials()) throw new EbayNotConfiguredError();
  const clientId = process.env.EBAY_CLIENT_ID!.trim();
  const cached = globalForEbay.__mediterranicEbayToken;
  if (cached?.clientId === clientId && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const basic = Buffer.from(`${clientId}:${process.env.EBAY_CLIENT_SECRET!.trim()}`).toString("base64");
  const response = await fetch(`${API}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: SCOPE }).toString(),
    cache: "no-store",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    if (response.status === 400 || response.status === 401) {
      throw new EbayApiError(
        "eBay rejected the credentials. Check that App ID and Cert ID belong to the same Production keyset, that the keyset is enabled, then redeploy.",
        "EBAY_CREDENTIALS_REJECTED",
        response.status,
      );
    }
    throw new EbayApiError("eBay could not issue an application token. Try again later.", "EBAY_TOKEN_ERROR", response.status);
  }
  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new EbayApiError("eBay returned no application token.", "EBAY_TOKEN_ERROR", 502);
  globalForEbay.__mediterranicEbayToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
    clientId,
  };
  return data.access_token;
}

async function browse<T>(path: string, signal?: AbortSignal): Promise<T> {
  const { data } = await browseDetailed<T>(path, signal);
  return data;
}

export type EbayWarning = { code: string; message: string };

/** eBay answers HTTP 200 with an `errors`/`warnings` array instead of a status. */
async function browseDetailed<T>(path: string, signal?: AbortSignal): Promise<{ data: T; warnings: EbayWarning[] }> {
  const token = await getAppToken(signal);
  const response = await fetch(`${API}/buy/browse/v1/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": ebayMarketplace(),
      Accept: "application/json",
    },
    cache: "no-store",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    if (response.status === 401) globalForEbay.__mediterranicEbayToken = undefined;
    const message = response.status === 403
      ? "eBay refused Production Browse API access (403). Enabled keys do not guarantee API permission; check your eBay developer account and any access/compliance requirements."
      : response.status === 401
        ? "eBay rejected the application token (401). Check your Production keyset and redeploy."
        : response.status === 404
          ? "eBay could not find this listing. It may be ended or unavailable in the chosen marketplace; this does not prove a sale."
          : response.status === 429
            ? "eBay's API rate limit was reached. Please try again later."
            : `eBay returned HTTP ${response.status}. No shop data was changed.`;
    throw new EbayApiError(message, `EBAY_HTTP_${response.status}`, response.status);
  }
  const payload = (await response.json()) as T & {
    errors?: { errorId?: number | string; message?: string; domain?: string }[];
    warnings?: { errorId?: number | string; message?: string; domain?: string }[];
  };
  const mapList = (list?: { errorId?: number | string; message?: string }[]) =>
    (list ?? [])
      .filter((entry) => entry?.message)
      .map((entry) => ({ code: String(entry.errorId ?? ""), message: String(entry.message) }));
  const errors = mapList(payload.errors);
  // An empty result with an eBay warning is a real failure, not "no listings".
  if (errors.length) throw new EbayApiError(errors[0].message, `EBAY_API_ERROR_${errors[0].code || "UNKNOWN"}`, 502);
  const warnings = mapList(payload.warnings);
  const { errors: _e, warnings: _w, ...data } = payload;
  return { data: data as T, warnings };
}

export function ebayItemIdFromUrl(input: string): string | null {
  const bare = input.trim().match(/^\d{9,15}$/);
  if (bare) return bare[0];
  const restId = input.match(/^v1\|(\d{9,15})\|/);
  if (restId) return restId[1];
  try {
    const url = new URL(input);
    if (!/(^|\.)ebay\.(?:com|co\.uk|de|es|fr|it|nl|be|at|ch|ie|ca|com\.au|com\.hk|com\.my|com\.sg|ph|pl)$/i.test(url.hostname)) return null;
    return url.pathname.match(/\/itm\/(?:[^/]+\/)?(\d{9,15})(?:\/|$)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function ebaySellerFromUrl(input: string): string | null {
  try {
    const url = new URL(input);
    if (!/(^|\.)ebay\.(?:com|co\.uk|de|es|fr|it|nl|be|at|ch|ie|ca|com\.au|com\.hk|com\.my|com\.sg|ph|pl)$/i.test(url.hostname)) return null;
    const fromQuery = url.searchParams.get("_ssn");
    const fromPath = url.pathname.match(/\/(?:str|usr)\/([^/?#]+)/i)?.[1];
    const seller = fromQuery || (fromPath ? decodeURIComponent(fromPath) : "");
    return /^[a-z0-9_.-]{1,80}$/i.test(seller) ? seller : null;
  } catch {
    return null;
  }
}

type Amount = { value?: string; currency?: string; convertedFromValue?: string; convertedFromCurrency?: string };
export type EbayBrowseItem = {
  legacyItemId?: string;
  itemId?: string;
  title?: string;
  price?: Amount;
  currentBidPrice?: Amount;
  minimumPriceToBid?: Amount;
  buyingOptions?: string[];
  image?: { imageUrl?: string };
  additionalImages?: { imageUrl?: string }[];
  thumbnailImages?: { imageUrl?: string }[];
  itemWebUrl?: string;
  shortDescription?: string;
  description?: string;
  condition?: string;
  localizedAspects?: { name?: string; value?: string }[];
  seller?: { username?: string };
  itemEndDate?: string;
  estimatedAvailabilities?: { estimatedAvailabilityStatus?: string }[];
};

function cents(value: string | undefined): number | null {
  const amount = value === undefined ? NaN : Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : null;
}

/** Exported to let fixture tests verify price/currency and availability rules. */
export function mapEbayItem(raw: EbayBrowseItem, fallbackId: string, now = Date.now()): EbayItem {
  const amount = raw.buyingOptions?.includes("AUCTION")
    ? raw.currentBidPrice ?? raw.minimumPriceToBid ?? raw.price
    : raw.price ?? raw.currentBidPrice;
  const currency = amount?.currency?.toUpperCase() ?? "";
  const euroCents = currency === "EUR"
    ? cents(amount?.value)
    : amount?.convertedFromCurrency?.toUpperCase() === "EUR"
      ? cents(amount.convertedFromValue)
      : null;
  const id = raw.legacyItemId || ebayItemIdFromUrl(raw.itemId ?? "") || fallbackId;
  const end = raw.itemEndDate ? Date.parse(raw.itemEndDate) : NaN;
  const unavailable = raw.estimatedAvailabilities?.some((entry) => entry.estimatedAvailabilityStatus === "OUT_OF_STOCK");
  const aspects: Record<string, string[]> = {};
  for (const entry of raw.localizedAspects ?? []) {
    if (entry.name && entry.value) (aspects[entry.name] ??= []).push(entry.value);
  }
  const images = [raw.image?.imageUrl, ...(raw.additionalImages ?? []).map((image) => image.imageUrl)]
    .filter((image): image is string => Boolean(image));
  return {
    legacyItemId: id,
    title: raw.title?.trim() ?? "",
    priceCents: euroCents,
    currency,
    sourcePrice: amount?.value ?? null,
    imageUrls: Array.from(new Set(images)).slice(0, 8),
    itemWebUrl: /^\d{9,15}$/.test(id) ? `https://www.ebay.com/itm/${id}` : raw.itemWebUrl ?? "",
    condition: raw.condition,
    description: raw.description?.trim() || raw.shortDescription?.trim() || "",
    aspects,
    sellerUsername: raw.seller?.username ?? null,
    itemEndDate: raw.itemEndDate ?? null,
    active: !unavailable && (!Number.isFinite(end) || end > now),
    auction: raw.buyingOptions?.includes("AUCTION") ?? false,
  };
}

export async function getEbayItem(input: string, signal?: AbortSignal): Promise<EbayItem | null> {
  const id = ebayItemIdFromUrl(input);
  if (!id) return null;
  const raw = await browse<EbayBrowseItem>(`item/get_item_by_legacy_id?legacy_item_id=${encodeURIComponent(id)}`, signal);
  return mapEbayItem(raw, id);
}

/** Search requires a category/keyword; buyingOptions explicitly includes auctions. */
export type EbaySellerSearch = {
  items: EbayItem[];
  /** The seller string actually sent to eBay. */
  sellerUsed: string;
  /** eBay `warnings`, e.g. code 12003 "seller username is invalid". */
  warnings: EbayWarning[];
  /** eBay's own total for the query, when present. */
  total: number | null;
};

export async function searchEbaySellerItems(
  username: string,
  limit = 100,
  signal?: AbortSignal,
  overrides: { categoryIds?: string; query?: string } = {},
): Promise<EbaySellerSearch> {
  const seller = username.trim().replace(/^@/, "");
  if (!/^[a-z0-9_.-]{1,80}$/i.test(seller)) {
    throw new EbayApiError(
      `"${username}" is not a valid eBay seller username. A store name (ebay.com/str/…) is not necessarily the seller account name — set EBAY_SELLER_USERNAME to the real seller ID.`,
      "EBAY_INVALID_SELLER",
      400,
    );
  }
  const wanted = Math.min(200, Math.max(1, Math.trunc(limit)));
  const pageSize = Math.min(200, wanted);
  const rows: EbayItem[] = [];
  const seen = new Set<string>();
  const warnings: EbayWarning[] = [];
  let total: number | null = null;
  let offset = 0;
  while (rows.length < wanted && offset < 1000) {
    const query = new URLSearchParams({
      // A search term is mandatory; a category alone satisfies it.
      ...(overrides.query ? { q: overrides.query } : { category_ids: overrides.categoryIds ?? "3213" }),
      filter: `sellers:{${seller}},buyingOptions:{FIXED_PRICE|AUCTION}`,
      limit: String(pageSize),
      offset: String(offset),
      sort: "newlyListed",
    });
    const { data: page, warnings: pageWarnings } = await browseDetailed<{
      itemSummaries?: EbayBrowseItem[];
      total?: number;
    }>(`item_summary/search?${query}`, signal);
    for (const warning of pageWarnings) if (!warnings.some((w) => w.code === warning.code)) warnings.push(warning);
    if (typeof page.total === "number") total = page.total;
    const items = page.itemSummaries ?? [];
    for (const raw of items) {
      const item = mapEbayItem(raw, raw.legacyItemId || ebayItemIdFromUrl(raw.itemId ?? "") || "");
      if (!item.active || !item.legacyItemId || seen.has(item.legacyItemId)) continue;
      seen.add(item.legacyItemId);
      rows.push(item);
    }
    offset += items.length;
    if (!items.length || items.length < pageSize || (total !== null && offset >= total)) break;
  }
  return { items: rows.slice(0, wanted), sellerUsed: seller, warnings, total };
}

/** Backwards-compatible helper: the plain list, with warnings surfaced as errors. */
export async function listEbaySellerItems(username: string, limit = 100, signal?: AbortSignal): Promise<EbayItem[]> {
  const result = await searchEbaySellerItems(username, limit, signal);
  if (!result.items.length && result.warnings.length) {
    throw new EbayApiError(
      `eBay accepted the request but returned no listings: ${result.warnings.map((w) => w.message).join(" ")} (warning ${result.warnings[0].code}). This is not zero inventory — it usually means the seller name is wrong.`,
      `EBAY_WARNING_${result.warnings[0].code || "UNKNOWN"}`,
      502,
    );
  }
  return result.items;
}
