import { db } from "@/db";
import { uploadedImages } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { parseListingText } from "@/lib/parse-listing";

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
      for (const m of html.matchAll(/<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/gi)) {
        images.add(m[1]);
      }
      return { text: htmlToText(html), via: "direct", images: Array.from(images) };
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

/** Stores marketplace photos in our own database so they never break. */
async function storeImages(urls: string[], label: string) {
  const stored: { src: string; alt: string; label: string }[] = [];
  for (const remote of urls.slice(0, 6)) {
    try {
      const res = await fetch(remote, {
        headers: { "User-Agent": UA, Referer: "https://www.catawiki.com/" },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) continue;
      const type = res.headers.get("content-type") ?? "";
      if (!type.startsWith("image/")) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.byteLength < 3_000 || buffer.byteLength > 8_000_000) continue;

      const [row] = await db
        .insert(uploadedImages)
        .values({
          filename: remote.split("/").pop() ?? "specimen.jpg",
          mimeType: type.split(";")[0],
          dataBase64: buffer.toString("base64"),
        })
        .returning({ id: uploadedImages.id });

      stored.push({
        src: `/api/uploads/${row.id}`,
        alt: `${label} — photograph ${stored.length + 1}`,
        label: stored.length === 0 ? "Full specimen" : `View ${stored.length + 1}`,
      });
    } catch {
      // skip an image that fails; the rest still import
    }
  }
  return stored;
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
        videoUrl: "",
      },
    });
  } catch (error) {
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
