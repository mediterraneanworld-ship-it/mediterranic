import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listingIdentityTokens } from "@/lib/marketplace-identity";
import { canonicalListing } from "@/lib/marketplace-links";
import { attachMarketplaceListing, MarketplaceError } from "@/lib/marketplace-service";
import { ebayErrorCode, ebayErrorMessage, getEbayItem } from "@/lib/ebay";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Explicit admin action only. Never called automatically by a price check. */
export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => null) as { productId?: unknown; channel?: unknown; url?: unknown; restoreStock?: unknown } | null;
  const productId = Number(body?.productId);
  const channel = body?.channel;
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!Number.isInteger(productId) || productId <= 0 || (channel !== "ebay" && channel !== "catawiki") || !canonicalListing(url, channel)) {
    return Response.json({ error: "Choose an existing specimen and a valid listing URL." }, { status: 400 });
  }
  try {
    let euroPrice: number | null = null;
    let identityTokens: string[] = [];
    if (channel === "ebay") {
      const item = await getEbayItem(url);
      if (!item?.active) return Response.json({ error: "eBay did not confirm an active listing. Nothing was changed." }, { status: 409 });
      euroPrice = item.priceCents;
      identityTokens = listingIdentityTokens(item.description ?? "", item.imageUrls);
    }
    const product = await attachMarketplaceListing({ productId, channel, url, priceCents: euroPrice, identityTokens, restoreStock: body?.restoreStock === true });
    return Response.json({
      ok: true, product,
      message: `Linked to the existing specimen. Photos, descriptions and the Site Only price were kept. ${channel === "ebay" && euroPrice === null ? "No EUR price was returned; the existing euro price was kept." : ""} No listing on eBay or Catawiki was ended or created by this action.`,
    });
  } catch (error) {
    if (error instanceof MarketplaceError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: ebayErrorMessage(error), code: ebayErrorCode(error) }, { status: 502 });
  }
}
