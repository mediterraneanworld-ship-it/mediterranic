import { isAdminAuthenticated } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

type Lot = { id: string; url: string; slug: string; title: string; kind: "trilobite" | "other" };

// This shop sells trilobites only: minerals, shells, ammonites and other
// natural-history material are deliberately excluded from syncing.
const NON_TRILOBITE = /ammonit|nautil|shell|mineral|meteorit|tooth|amber|fish|coral|crustacean|echinoid|bivalve|gastropod|orthoceras|goniatit|belemnit|stromatolit|crinoid|brachiopod/i;

/** Extracts lot links from a Catawiki seller page, rendered HTML or plain text. */
function extractLots(payload: string): Lot[] {
  const found = new Map<string, Lot>();
  const matches = payload.matchAll(/\/en\/l\/(\d{6,12})(?:-([a-z0-9-]{0,160}))?/gi);

  for (const match of matches) {
    const id = match[1];
    if (found.has(id)) continue;
    const slug = (match[2] ?? "").replace(/-+$/, "");
    const title = slug
      ? slug
          .split("-")
          .filter(Boolean)
          .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
          .join(" ")
          .replace(/\bFossilised Animal\b/gi, "")
          .trim()
      : `Lot ${id}`;
    const haystack = `${slug} ${title}`;
    const kind: "trilobite" | "other" =
      NON_TRILOBITE.test(haystack) && !/trilobit/i.test(haystack) ? "other" : "trilobite";
    found.set(id, { id, slug, title, kind, url: `https://www.catawiki.com/en/l/${id}` });
  }

  return Array.from(found.values());
}

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
  if (!/^https?:\/\/(www\.)?catawiki\.com\//i.test(rawUrl)) {
    return Response.json(
      { error: "Paste your Catawiki seller page link (it looks like catawiki.com/en/u/...)." },
      { status: 400 },
    );
  }

  // 1) Try the rendered HTML, which contains the lot cards.
  try {
    const res = await fetch(`https://r.jina.ai/${rawUrl}`, {
      headers: { "User-Agent": UA, "X-Respond-With": "html" },
      cache: "no-store",
      signal: AbortSignal.timeout(50_000),
    });
    const html = await res.text();
    if (res.ok) {
      const all = extractLots(html);
      const lots = all.filter((lot) => lot.kind === "trilobite");
      if (lots.length > 0) {
        return Response.json({ lots, excluded: all.length - lots.length, source: "seller-html" });
      }
    }
  } catch {
    // fall through to text mode
  }

  // 2) Fallback: plain text rendering.
  try {
    const res = await fetch(`https://r.jina.ai/${rawUrl}`, {
      headers: { "User-Agent": UA },
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });
    const text = await res.text();
    const all = extractLots(text);
    const lots = all.filter((lot) => lot.kind === "trilobite");
    if (lots.length > 0) {
      return Response.json({ lots, excluded: all.length - lots.length, source: "seller-text" });
    }
  } catch {
    // handled below
  }

  return Response.json(
    {
      error:
        "Catawiki did not return the lots this time (it sometimes blocks automated reading). Open the seller page, copy each lot link, and paste them below one at a time — everything else is automatic.",
    },
    { status: 422 },
  );
}
