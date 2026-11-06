import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getAllProducts } from "@/lib/catalog";
import { matchListing, savedListing } from "@/lib/marketplace-links";
import {
  EbayApiError,
  ebayErrorCode,
  ebayErrorMessage,
  getEbayItem,
  ebayMarketplace,
  ebaySellerFromUrl,
  hasEbayCredentials,
  listEbaySellerItems,
} from "@/lib/ebay";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36";
const NON_TRILOBITE = /seashell|triton|charonia|ammonit|nautil|mineral|marcasite|pyrite|agate|meteorit|tooth|amber|fish|coral|crinoid|brachiopod|orthoceras|goniatit|belemnit|bivalve|gastropod|echinoid|sphere/i;
const isTrilobite = (title: string) => Boolean(title) && (!NON_TRILOBITE.test(title) || /trilobit/i.test(title));

/** Discovery only. No products are saved/updated by this endpoint. */
export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => null) as { url?: unknown } | null;
  const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
  const parsedSeller = ebaySellerFromUrl(rawUrl);
  if (!parsedSeller) {
    return Response.json({ error: "Paste an eBay store or seller URL (ebay.com/str/... or ebay.com/usr/...)." }, { status: 400 });
  }
  let seller = process.env.EBAY_SELLER_USERNAME?.trim() || parsedSeller;

  if (hasEbayCredentials()) {
    try {
      const specimens = await getAllProducts({ includeDrafts: true });
      // A /str/ store alias need not be the seller account username.
      // Resolve it from one known listing when possible, unless explicitly configured.
      if (!process.env.EBAY_SELLER_USERNAME?.trim() && new URL(rawUrl).pathname.startsWith("/str/")) {
        const reference = specimens.map((piece) => savedListing(piece, "ebay")).find(Boolean);
        if (reference) {
          try {
            const item = await getEbayItem(reference);
            if (item?.sellerUsername) seller = item.sellerUsername;
          } catch (error) {
            if (!(error instanceof EbayApiError) || error.status !== 404) throw error;
          }
        }
      }
      const items = await listEbaySellerItems(seller, 200);
      const selected = items.filter((item) => isTrilobite(item.title));
      return Response.json({
        via: "ebay-api",
        apiConfigured: true,
        seller,
        marketplace: ebayMarketplace(),
        excluded: items.length - selected.length,
        message: selected.length
          ? "Listings read through the official eBay API. Import the new ones using the list below."
          : "The API returned no matching active listings. A store name may differ from the seller username: try the seller's /usr/ URL. New listings can take time to appear.",
        lots: selected.map((item) => ({
          id: item.legacyItemId,
          url: item.itemWebUrl,
          title: item.title,
          price: item.priceCents === null ? "" : (item.priceCents / 100).toFixed(2),
          priceCents: item.priceCents,
          currency: item.currency,
          sourcePrice: item.sourcePrice,
          match: matchListing({ url: item.itemWebUrl, title: item.title }, specimens),
        })),
      });
    } catch (error) {
      // Do not hide an API permission/credential error behind a misleading HTML 403.
      return Response.json({
        error: ebayErrorMessage(error), code: ebayErrorCode(error), apiConfigured: true, via: "ebay-api",
      }, { status: 502 });
    }
  }

  // Optional legacy path for deployments without API keys. Missing cards never imply a sale.
  try {
    const response = await fetch(rawUrl, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
      cache: "no-store", signal: AbortSignal.timeout(20_000),
    });
    const html = await response.text();
    if (!response.ok || html.length < 5000 || /captcha|pardon our interruption|access denied|security measure/i.test(html.slice(0, 20000))) {
      return Response.json({
        code: "EBAY_KEYS_MISSING", apiConfigured: false,
        error: `eBay keys are not configured in this deployment and the page reader returned HTTP ${response.status}. Add EBAY_CLIENT_ID and EBAY_CLIENT_SECRET, then redeploy. Keys in Vercel are not available in the development sandbox.`,
      }, { status: 422 });
    }
    const positions = new Map<string, number>();
    for (const match of html.matchAll(/\/itm\/(?:[^/"\s]+\/)?(\d{9,15})/g)) {
      if (!positions.has(match[1])) positions.set(match[1], match.index ?? 0);
    }
    const entries = [...positions];
    const lots = entries.flatMap(([id, position], index) => {
      const chunk = html.slice(position, entries[index + 1]?.[1] ?? position + 7000);
      const title = (chunk.match(/aria-label="([^"]{10,220})"/)?.[1] ?? "").replace(/&amp;/g, "&").replace(/&#34;/g, '"');
      if (!isTrilobite(title)) return [];
      // Currency in scraped markup is not sufficiently reliable to auto-price in EUR.
      return [{ id, url: `https://www.ebay.com/itm/${id}`, title, price: "", priceCents: null }];
    });
    const specimens = await getAllProducts({ includeDrafts: true });
    return Response.json({ via: "page-reader", apiConfigured: false,
      lots: lots.map((lot) => ({ ...lot, match: matchListing(lot, specimens) })),
      excluded: entries.length - lots.length });
  } catch {
    return Response.json({ error: "Could not read eBay. Configure the API keys and redeploy, or paste the listing text.", code: "EBAY_CONNECTION_ERROR", apiConfigured: false }, { status: 422 });
  }
}
