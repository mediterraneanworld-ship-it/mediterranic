import { isAdminAuthenticated } from "@/lib/admin-auth";
import { parseListingText } from "@/lib/parse-listing";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { text?: string; url?: string; price?: string; title?: string };
  try {
    body = (await request.json()) as { text?: string; url?: string; price?: string };
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (text.length < 15) {
    return Response.json(
      { error: "Paste the listing text (title, description and details) so we can read it." },
      { status: 400 },
    );
  }

  const url = (body.url ?? "").trim();
  const channel = url.toLowerCase().includes("catawiki")
    ? "catawiki"
    : url.toLowerCase().includes("ebay")
      ? "ebay"
      : "direct";

  const parsed = parseListingText(text, url, (body.price ?? "").trim(), (body.title ?? "").trim());

  return Response.json({
    parsed: {
      name: parsed.name,
      species: parsed.species,
      period: parsed.period,
      lengthMm: parsed.lengthMm,
      locality: parsed.locality,
      formation: parsed.formation,
      preparation: parsed.preparation,
      priceDollars: parsed.priceDollars,
      shortDescription: parsed.shortDescription,
      description: parsed.description,
      provenance: parsed.provenance,
      listingChannel: channel,
      externalListingUrl: url,
      images: parsed.images,
    },
    found: parsed.found,
    missing: parsed.missing,
  });
}
