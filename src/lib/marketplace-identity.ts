import { createHash } from "node:crypto";

/**
 * A relisting may get a new item number but retain its own photos and copy.
 * Require BOTH the stable listing text and an original image asset ID. A
 * generic species title alone never identifies a physical fossil.
 */
export function listingIdentityTokens(description: string, imageUrls: string[]): string[] {
  const text = description.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/(?:€|EUR|USD|US\s*\$|\$)\s*[0-9.,]+/gi, " ")
    .normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
  if (text.length < 60) return [];
  const keys = imageUrls.map((url) => {
    try {
      const parsed = new URL(url);
      if (/(^|\.)ebayimg\.com$/i.test(parsed.hostname)) return parsed.pathname.match(/\/images\/g\/([^/]+)\//)?.[1] ?? null;
      return null;
    } catch { return null; }
  }).filter((value): value is string => Boolean(value));
  return Array.from(new Set(keys)).slice(0, 8).map((key) => createHash("sha256").update(`ebay-photo-and-copy:${key}\n${text}`).digest("hex"));
}
