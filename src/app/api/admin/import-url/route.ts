import { storeRemoteImages } from "@/lib/listing-import";
import { firstGalleryPhotos } from "@/lib/gallery-images";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { parseListingText } from "@/lib/parse-listing";
import { ebayErrorCode, ebayErrorMessage, getEbayItem, hasEbayCredentials } from "@/lib/ebay";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function isBlocked(html: string, status: number): boolean {
  if (status === 403 || status === 429) return true;
  if (html.length < 1500) return true;
  return /access denied|are you a robot|captcha|cf-browser-verification|enable javascript/i.test(html.slice(0, 4000));
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Direct fetch first, then a rendered-text reader when marketplaces block us. */
async function readListing(url: string): Promise<{ text: string; via: string; images: string[] }> {
  const images = new Set<string>();
  // The old SmugMug gallery is hosted on the custom mediterranic.com domain.
  const isSmugMug = /(?:^https?:\/\/(?:www\.)?mediterranic\.com\/|smugmug\.com\/)/i.test(url);

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const html = await res.text();
    if (!isBlocked(html, res.status)) {
      for (const m of html.matchAll(/https:\/\/i\.ebayimg\.com\/images\/g\/[A-Za-z0-9_-]+\/s-l\d+\.(?:jpg|jpeg|png|webp)/gi)) {
        images.add(m[0].replace(/\/s-l\d+\./i, "/s-l1600."));
      }
      // A SmugMug album has a real photo list, not just a single og:image.
      // The function keeps the first occurrence of each image id in gallery
      // order and chooses the first three — including the first page's photos.
      if (isSmugMug) {
        const gallery = firstGalleryPhotos(html);
        if (gallery.length > 0) {
          return { text: htmlToText(html), via: "direct", images: gallery };
        }
      }
      for (const m of html.matchAll(/<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/gi)) {
        images.add(m[1]);
      }
      return { text: htmlToText(html), via: "direct", images: Array.from(images).slice(0, 3) };
    }
  } catch {
    // fall through to the reader
  }

  // Reader fallback: returns the fully rendered page as clean text (works for Catawiki).
  const readerRes = await fetch(`https://r.jina.ai/${url}`, {
    headers: { "User-Agent": UA, Accept: "text/plain" },
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  });
  const readerText = await readerRes.text();
  if (!readerRes.ok || readerText.length < 500) {
    throw new Error("READER_FAILED");
  }

  if (isSmugMug) {
    const gallery = firstGalleryPhotos(readerText);
    if (gallery.length > 0) {
      return { text: readerText, via: "reader", images: gallery };
    }
  }

  for (const m of readerText.matchAll(
    /https:\/\/assets\.catawiki\.[a-z]+\/image\/cw_ldp_l\/plain\/assets\/catawiki\/assets\/[^\s)"'<>]+?\.(?:jpg|jpeg|png|webp)/gi,
  )) {
    images.add(m[0]);
  }
  for (const m of readerText.matchAll(/https:\/\/i\.ebayimg\.com\/images\/g\/[A-Za-z0-9_-]+\/s-l\d+\.(?:jpg|jpeg|png|webp)/gi)) {
    images.add(m[0].replace(/\/s-l\d+\./i, "/s-l1600."));
  }

  return { text: readerText, via: "reader", images: Array.from(images).slice(0, 8) };
}

/** Keep the gallery photos in the same database as the rest of the shop. */
async function storeImages(urls: string[], label: string) {
  return storeRemoteImages(urls.slice(0, 3), label);
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { url?: string; title?: string };
  try {
    body = (await request.json()) as { url?: string };
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const rawUrl = (body.url ?? "").trim();
  if (!/^https?:\/\//i.test(rawUrl)) {
    return Response.json({ error: "Paste a full listing link starting with https://" }, { status: 400 });
  }

  const lower = rawUrl.toLowerCase();
  const listingChannel = lower.includes("catawiki") ? "catawiki" : lower.includes("ebay") ? "ebay" : "direct";

  if (listingChannel === "ebay" && hasEbayCredentials()) {
    try {
      const item = await getEbayItem(rawUrl);
      if (!item?.title || !item.active) {
        return Response.json({
          error: "eBay did not return an active listing. No specimen was created or archived.",
          code: "EBAY_LISTING_UNAVAILABLE", via: "ebay-api",
        }, { status: 422 });
      }
      const aspectText = Object.entries(item.aspects ?? {})
        .map(([key, values]) => `${key}: ${values.join(", ")}`)
        .join("\n");
      const description = htmlToText(item.description ?? "");
      const sourceText = [item.title, description, aspectText].filter(Boolean).join("\n");
      const priceDollars = item.priceCents === null ? "" : (item.priceCents / 100).toFixed(2);
      const parsed = parseListingText(sourceText, rawUrl, priceDollars, item.title);
      const photos = item.imageUrls.length ? await storeImages(item.imageUrls, item.title) : [];
      const missing = Array.from(new Set([
        ...parsed.missing.filter((field) => field !== "price" && field !== "photos"),
        ...(item.priceCents === null ? ["price in EUR"] : []),
        ...(photos.length ? [] : ["photos"]),
      ]));
      return Response.json({
        via: "ebay-api",
        found: Array.from(new Set([...parsed.found, ...(photos.length ? ["photos"] : [])])),
        missing,
        warning: item.priceCents === null
          ? `eBay returned ${item.currency || "an unknown currency"}, not an EUR amount. Set the euro price before publishing; no automatic currency conversion is guessed.`
          : undefined,
        imported: {
          ...parsed,
          name: item.title,
          listingChannel: "ebay",
          externalListingUrl: item.itemWebUrl || rawUrl,
          priceDollars,
          priceCents: item.priceCents ?? 0,
          sourceCurrency: item.currency,
          description: description || parsed.description,
          images: photos,
          photosStored: photos.length,
          published: item.priceCents !== null && photos.length > 0 && Boolean(description || parsed.description),
          photoWarning: photos.length ? undefined : "eBay photos could not be downloaded. Add a photo before publishing.",
          videoUrl: "",
        },
      });
    } catch (error) {
      return Response.json({ error: ebayErrorMessage(error), code: ebayErrorCode(error), via: "ebay-api" }, { status: 502 });
    }
  }

  try {
    const { text, via, images } = await readListing(rawUrl);
    const parsed = parseListingText(text, rawUrl, "", (body.title ?? "").trim());
    const photos = images.length > 0 ? await storeImages(images, parsed.name) : [];

    return Response.json({
      via,
      found: parsed.found,
      missing: parsed.missing,
      imported: {
        ...parsed,
        listingChannel,
        externalListingUrl: rawUrl,
        // Prefer photographs we actually downloaded into our own storage.
        images: photos.length > 0 ? photos : parsed.images,
        photosStored: photos.length,
        photoSource: /(?:mediterranic\.com|smugmug\.com)/i.test(rawUrl) ? "smugmug" : undefined,
        photoWarning:
          photos.length < 3 && /(?:mediterranic\.com|smugmug\.com)/i.test(rawUrl)
            ? `SmugMug import needs the first 3 gallery photos: only ${photos.length} were saved. Re-run the import or add the missing photos manually before publishing.`
            : undefined,
        videoUrl: "",
      },
    });
  } catch (error) {
    if (listingChannel === "ebay") {
      return Response.json(
        {
          error:
            "eBay is refusing automated reading from the server (HTTP 403). Two ways forward: add EBAY_CLIENT_ID / EBAY_CLIENT_SECRET in Vercel to import through the official API, or press “Add manually” and fill in the title and price — usually 30 seconds.",
          code: "EBAY_BLOCKED",
        },
        { status: 422 },
      );
    }
    if (error instanceof Error && error.message === "READER_FAILED") {
      return Response.json(
        {
          error:
            "Catawiki is blocking automated reading of this lot right now. Fastest fix: copy the lot text and paste it in the box below — everything is filled automatically.",
        },
        { status: 422 },
      );
    }
    return Response.json({ error: "Could not read that link. Please try again or paste the text." }, { status: 422 });
  }
}
