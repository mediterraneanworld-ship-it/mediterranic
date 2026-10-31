import { isAdminAuthenticated } from "@/lib/admin-auth";
import { ebaySellerFromUrl, hasEbayCredentials, listEbaySellerItems } from "@/lib/ebay";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

type Lot = {
  id: string;
  url: string;
  title: string;
  price: string;
  /** The eBay price in cents, when the store page showed one. */
  priceCents: number | null;
  kind: "trilobite" | "other";
};

/** "EUR 45,00" / "€1.234,56" / "$52.00" -> cents. Handles both decimal styles. */
function priceToCents(raw: string): number | null {
  // Keep digits and both decimal separators only — no regex escapes needed.
  const cleaned = raw.replace(/[^0-9.,]/g, "");
  if (!cleaned) return null;
  const comma = cleaned.lastIndexOf(",");
  const dot = cleaned.lastIndexOf(".");
  // "1.234,56" (European) vs "1,234.56" (Anglo) vs "45".
  const normalised =
    comma > dot
      ? cleaned.split(".").join("").replace(",", ".")
      : cleaned.split(",").join("");
  const value = Number(normalised);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
}

// This shop sells trilobites only. Shells, minerals and other natural-history
// material are deliberately excluded from syncing.
const NON_TRILOBITE =
  /seashell|triton|charonia|ammonit|nautil|mineral|marcasite|pyrite|agate|meteorit|tooth|amber|fish|coral|crinoid|brachiopod|orthoceras|goniatit|belemnit|bivalve|gastropod|echinoid|sphere/i;

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { url?: string };
  try {
    body = (await request.json()) as { url?: string };
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const rawUrl = (body.url ?? "").trim();
  if (!/^https?:\/\/(www\.)?ebay\.com\//i.test(rawUrl)) {
    return Response.json({ error: "Paste your eBay store link (ebay.com/str/...)." }, { status: 400 });
  }

  // Official API first: reliable from any server, and it includes the price.
  const seller = ebaySellerFromUrl(rawUrl);
  if (seller && hasEbayCredentials()) {
    try {
      const items = await listEbaySellerItems(seller, 100);
      const trilobites = items
        .filter((item) => item.title)
        .map((item) => ({
          id: item.legacyItemId,
          url: item.itemWebUrl,
          title: item.title,
          price: item.priceCents ? (item.priceCents / 100).toFixed(2) : "",
          priceCents: item.priceCents,
        }))
        .filter((item) => !(NON_TRILOBITE.test(item.title) && !/trilobit/i.test(item.title)));

      return Response.json({
        via: "ebay-api",
        lots: trilobites,
        excluded: items.length - trilobites.length,
        apiConfigured: true,
      });
    } catch (error) {
      console.error("eBay seller search failed", error);
      // fall through to the page scrape
    }
  }

  try {
    const res = await fetch(rawUrl, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
      cache: "no-store",
      signal: AbortSignal.timeout(40_000),
    });
    const html = await res.text();
    if (!res.ok || html.length < 5_000) {
      return Response.json(
        {
          error:
            "eBay refused to serve the store page to the server (HTTP 403) — this is eBay blocking datacenter addresses, not your shop. Add EBAY_CLIENT_ID and EBAY_CLIENT_SECRET in Vercel (free, from developer.ebay.com) and this button reads your store through the official API. Until then, paste the item link and use “Add manually”.",
          code: "EBAY_BLOCKED",
          apiConfigured: hasEbayCredentials(),
        },
        { status: 422 },
      );
    }

    // Each card begins with its item link, followed by the aria-label title and price.
    const positions: [string, number][] = [];
    for (const m of html.matchAll(/\/itm\/(\d{9,13})/g)) {
      if (!positions.some(([id]) => id === m[1])) positions.push([m[1], m.index ?? 0]);
    }
    positions.sort((a, b) => a[1] - b[1]);

    const lots: Lot[] = [];
    const seen = new Set<string>();
    for (const [index, [id, pos]] of positions.entries()) {
      if (seen.has(id)) continue;
      seen.add(id);
      const end = index + 1 < positions.length ? positions[index + 1][1] : html.length;
      const chunk = html.slice(pos, end);
      const label = chunk.match(/aria-label="([^"]{10,200})"/);
      const price = chunk.match(/displayPrice[^>]*>\s*([^<]{2,30}?)\s*</);
      const title = (label?.[1] ?? "")
        .replace(/&#34;/g, '"')
        .replace(/&amp;/g, "&")
        .trim();
      if (!title) continue;
      const kind: "trilobite" | "other" =
        NON_TRILOBITE.test(title) && !/trilobit/i.test(title) ? "other" : "trilobite";
      const priceText = price?.[1] ?? "";
      lots.push({ id, url: `https://www.ebay.com/itm/${id}`, title, price: priceText, priceCents: priceToCents(priceText), kind });
    }

    const trilobites = lots.filter((l) => l.kind === "trilobite");
    return Response.json({
      lots: trilobites,
      excluded: lots.length - trilobites.length,
      apiConfigured: hasEbayCredentials(),
    });
  } catch {
    return Response.json({ error: "Could not read the eBay store page." }, { status: 422 });
  }
}
