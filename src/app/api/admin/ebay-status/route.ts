import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getSiteSettings } from "@/lib/catalog";
import {
  ebayErrorCode,
  ebayErrorMessage,
  ebayMarketplace,
  ebaySellerFromUrl,
  getEbayItem,
  hasEbayCredentials,
  searchEbaySellerItems,
} from "@/lib/ebay";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
const noStore = { "Cache-Control": "private, no-store" };

/** Configuration only. Secrets never leave the server. */
export async function GET() {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const settings = await getSiteSettings();
  const storeUrl = process.env.EBAY_STORE_URL || settings.ebayUrl || "";
  return Response.json({
    configured: hasEbayCredentials(),
    marketplace: ebayMarketplace(),
    storeUrl,
    sellerFromStoreUrl: ebaySellerFromUrl(storeUrl),
    sellerUsernameOverride: process.env.EBAY_SELLER_USERNAME?.trim() || null,
  }, { headers: noStore });
}

/**
 * Runs real eBay API probes and reports exactly what happened: whether the
 * credentials work, which seller name was used, how many listings came back and
 * any eBay warning. This writes nothing to the shop.
 */
export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { url?: unknown };
  const settings = await getSiteSettings();
  const url = typeof body.url === "string" && body.url.trim() ? body.url.trim() : undefined;

  const result: Record<string, unknown> = {
    configured: hasEbayCredentials(),
    marketplace: ebayMarketplace(),
    storeUrl: process.env.EBAY_STORE_URL || settings.ebayUrl || "",
    sellerUsernameOverride: process.env.EBAY_SELLER_USERNAME?.trim() || null,
  };

  if (!result.configured) {
    return Response.json({
      ...result,
      ok: false,
      error:
        "EBAY_CLIENT_ID / EBAY_CLIENT_SECRET are not set on THIS deployment. Keys saved for the Production environment are not available in the development sandbox or in a Preview deployment unless also set for those environments.",
    }, { status: 503, headers: noStore });
  }

  // Probe 1 — a single listing proves the credentials and reveals the seller.
  if (url) {
    try {
      const item = await getEbayItem(url);
      result.singleItem = item
        ? {
            title: item.title,
            seller: item.sellerUsername,
            active: item.active,
            priceCents: item.priceCents,
            currency: item.currency,
            auction: item.auction,
          }
        : null;
      if (item?.sellerUsername) result.sellerFromListing = item.sellerUsername;
    } catch (error) {
      result.singleItemError = ebayErrorMessage(error);
      result.singleItemErrorCode = ebayErrorCode(error);
    }
  }

  // Probe 2 — the seller search actually used by synchronization.
  const seller =
    (result.sellerUsernameOverride as string | null) ||
    (result.sellerFromListing as string | undefined) ||
    ebaySellerFromUrl(result.storeUrl as string);

  try {
    const search = await searchEbaySellerItems(seller ?? "", 200);
    result.sellerUsed = search.sellerUsed;
    result.ebayTotal = search.total;
    result.activeListings = search.items.length;
    result.warnings = search.warnings;
    result.sampleTitles = search.items.slice(0, 5).map((item) => item.title);
    result.ok = search.items.length > 0 || search.warnings.length === 0;
    if (search.warnings.length) {
      result.diagnosis =
        `eBay accepted the request but returned no listings for seller "${search.sellerUsed}". ` +
        `Warning ${search.warnings[0].code}: ${search.warnings[0].message}. ` +
        `A store name from ebay.com/str/… is not necessarily the seller account name. ` +
        `Set EBAY_SELLER_USERNAME to the real eBay seller ID and redeploy.`;
    } else if (!search.items.length) {
      result.diagnosis =
        `eBay reported zero active listings for seller "${search.sellerUsed}". If a listing was created moments ago, eBay can take several minutes to index it.`;
    } else {
      result.diagnosis = `eBay returned ${search.items.length} active listing(s) for seller "${search.sellerUsed}".`;
    }
  } catch (error) {
    result.ok = false;
    result.error = ebayErrorMessage(error);
    result.errorCode = ebayErrorCode(error);
    result.diagnosis = result.error;
  }

  return Response.json(result, { headers: noStore });
}
