import { db } from "@/db";
import { uploadedImages } from "@/db/schema";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export type StoredImage = { src: string; alt: string; label: string };

/**
 * Downloads marketplace photographs into our own database and returns our own
 * URLs. eBay's image CDN (i.ebayimg.com) is not blocked, so photos can always
 * be captured even when the listing page itself refuses to load.
 */
export async function storeRemoteImages(
  urls: string[],
  label: string,
  referer = "https://www.ebay.com/",
  signal?: AbortSignal,
): Promise<StoredImage[]> {
  const stored: StoredImage[] = [];
  const unique = Array.from(new Set(urls.filter(Boolean))).slice(0, 6);

  for (const remote of unique) {
    try {
      const res = await fetch(remote, {
        headers: { "User-Agent": UA, Referer: referer },
        cache: "no-store",
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
      });
      if (!res.ok) continue;
      const type = res.headers.get("content-type") ?? "";
      if (!type.startsWith("image/")) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.byteLength < 3_000 || buffer.byteLength > 8_000_000) continue;

      const [row] = await db
        .insert(uploadedImages)
        .values({
          filename: remote.split("/").pop()?.split("?")[0] ?? "specimen.jpg",
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
      // one bad image never blocks the rest
    }
  }
  return stored;
}

/** Pulls every usable image URL out of pasted listing HTML or plain text. */
export function imageUrlsFromText(text: string): string[] {
  const found = new Set<string>();

  for (const m of text.matchAll(/https:\/\/i\.ebayimg\.com\/images\/g\/[A-Za-z0-9_-]+\/s-l\d+\.(?:jpg|jpeg|png|webp)/gi)) {
    found.add(m[0].replace(/\/s-l\d+\./i, "/s-l1600."));
  }
  for (const m of text.matchAll(/https:\/\/[^\s"'<>)]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>)]*)?/gi)) {
    found.add(m[0]);
  }
  return Array.from(found);
}

/**
 * Reads a price in any marketplace format ("EUR 45,00", "US $52.00", "€1.234,56")
 * and returns euro cents. Used when the listing page gives text but the parser
 * does not recognise the currency.
 */
export function priceCentsFromText(text: string): number | null {
  const patterns = [
    /(?:EUR|€)\s*([0-9][0-9.,\s]*)/i,
    /(?:US\s*\$|\$|USD)\s*([0-9][0-9.,\s]*)/i,
    /(?:current bid|buy now|price|preis)\s*[:=-]?\s*(?:EUR|€|US\s*\$|\$)?\s*([0-9][0-9.,]*)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m?.[1]) continue;
    const cleaned = m[1].replace(/[^0-9.,]/g, "");
    if (!cleaned) continue;
    const comma = cleaned.lastIndexOf(",");
    const dot = cleaned.lastIndexOf(".");
    const normalised =
      comma > dot ? cleaned.split(".").join("").replace(",", ".") : cleaned.split(",").join("");
    const value = Number(normalised);
    if (Number.isFinite(value) && value >= 1 && value <= 500_000) return Math.round(value * 100);
  }
  return null;
}
