import { isAdminAuthenticated } from "@/lib/admin-auth";
import { parseListingText } from "@/lib/parse-listing";
import { imageUrlsFromText, priceCentsFromText, storeRemoteImages } from "@/lib/listing-import";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Import a listing the curator can see in their own browser.
 *
 * Why this exists: eBay (and sometimes Catawiki) answer HTTP 403 to servers —
 * including datacenter IPs, proxies and readers — while working normally in the
 * curator's browser. Copying the page (Ctrl+A, Ctrl+C) or pasting "View source"
 * gives us everything we need: title, price, description and the photo URLs,
 * which live on a CDN that is never blocked.
 */
export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { text?: string; imageUrls?: string[]; url?: string; title?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  const pastedImages = Array.isArray(body.imageUrls) ? body.imageUrls.filter(Boolean) : [];
  if (text.length < 20 && pastedImages.length === 0) {
    return Response.json(
      { error: "Paste the listing text (or at least one photo address) first." },
      { status: 400 },
    );
  }

  const sourceUrl = (body.url ?? "").trim();
  const lower = sourceUrl.toLowerCase();
  const channel = lower.includes("catawiki") ? "catawiki" : lower.includes("ebay") ? "ebay" : "direct";

  const parsed = parseListingText(text, sourceUrl, "", (body.title ?? "").trim());
  const priceCents = priceCentsFromText(text) ?? (Number(parsed.priceDollars) > 0 ? Math.round(Number(parsed.priceDollars) * 100) : null);

  // Photos: whatever the curator pasted, plus any URL found inside the pasted HTML.
  const remoteImages = [...pastedImages, ...imageUrlsFromText(text)];
  const photos = await storeRemoteImages(
    remoteImages,
    parsed.name || body.title || "Specimen",
    lower.includes("catawiki") ? "https://www.catawiki.com/" : "https://www.ebay.com/",
  );

  return Response.json({
    via: "pasted",
    found: [...parsed.found, ...(photos.length ? ["photos"] : [])],
    // The generic parser reports "price" as missing when it only sees a dollar
    // amount; trust what we actually extracted instead.
    missing: Array.from(
      new Set([
        ...parsed.missing.filter((item) => !(priceCents && item === "price")),
        ...(priceCents ? [] : ["price"]),
        ...(photos.length ? [] : ["photos"]),
      ]),
    ),
    imported: {
      ...parsed,
      listingChannel: channel === "direct" ? "ebay" : channel,
      externalListingUrl: sourceUrl,
      priceCents: priceCents ?? 0,
      ...(priceCents ? { priceDollars: (priceCents / 100).toFixed(2) } : {}),
      images: photos.length ? photos : parsed.images,
      photosStored: photos.length,
      videoUrl: "",
    },
  });
}
