import { isAdminAuthenticated } from "@/lib/admin-auth";
import { discoverCatawikiInventory } from "@/lib/catawiki-inventory";
import { getAllProducts } from "@/lib/catalog";
import { listingKey, matchListing } from "@/lib/marketplace-links";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Discovery and automatic synchronization read the exact same active seller section. */
export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => null) as { url?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  try {
    const inventory = await discoverCatawikiInventory(url);
    if (!inventory.ok) return Response.json({ error: inventory.error || "Catawiki active inventory could not be verified. No shop data was changed." }, { status: 422 });
    const specimens = await getAllProducts({ includeDrafts: true });
    return Response.json({
      source: "verified-seller-active-section", complete: inventory.complete,
      message: inventory.error,
      lots: inventory.listings.map((listing) => ({
        id: listingKey(listing.url)!.split(":")[1], url: listing.url, title: listing.title,
        priceCents: listing.priceCents, match: matchListing(listing, specimens),
      })),
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not verify the seller inventory. Existing data was kept." }, { status: 422 });
  }
}
