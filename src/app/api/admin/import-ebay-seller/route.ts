import { isAdminAuthenticated } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

type Lot = { id: string; url: string; title: string; price: string; kind: "trilobite" | "other" };

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
            "eBay did not return the store page. Open the store in your browser and paste the lot links one by one instead.",
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
      lots.push({ id, url: `https://www.ebay.com/itm/${id}`, title, price: price?.[1] ?? "", kind });
    }

    const trilobites = lots.filter((l) => l.kind === "trilobite");
    return Response.json({ lots: trilobites, excluded: lots.length - trilobites.length });
  } catch {
    return Response.json({ error: "Could not read the eBay store page." }, { status: 422 });
  }
}
