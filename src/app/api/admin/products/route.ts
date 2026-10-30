import { eq } from "drizzle-orm";
import { db } from "@/db";
import { products, type ProductImage } from "@/db/schema";
import { isCollectionSlug } from "@/lib/product-collections";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request data." }, { status: 400 });
  }

  // Quick stock toggle (mark sold / restock)
  if (body.action === "set-stock") {
    const id = Number(body.id);
    const stock = Math.max(0, Number(body.stock ?? 0));
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: "Invalid ID." }, { status: 400 });
    }
    const [updated] = await db
      .update(products)
      .set({ stock })
      .where(eq(products.id, id))
      .returning();
    return Response.json({ product: updated });
  }

  // Quick set / clear the specimen film
  if (body.action === "set-video") {
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: "Invalid ID." }, { status: 400 });
    }
    const [updated] = await db
      .update(products)
      .set({ videoUrl: String(body.videoUrl ?? "").trim() || null })
      .where(eq(products.id, id))
      .returning();
    return Response.json({ product: updated });
  }

  // Quick publish / unpublish
  if (body.action === "set-published") {
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: "Invalid ID." }, { status: 400 });
    }
    const [updated] = await db
      .update(products)
      .set({ published: Boolean(body.published) })
      .where(eq(products.id, id))
      .returning();
    return Response.json({ product: updated });
  }

  // Quick channel switch (direct | catawiki | ebay)
  if (body.action === "set-channel") {
    const id = Number(body.id);
    const channel = String(body.listingChannel ?? "direct");
    const validChannel = ["direct", "catawiki", "ebay"].includes(channel) ? channel : "direct";
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: "Invalid ID." }, { status: 400 });
    }
    const [updated] = await db
      .update(products)
      .set({
        listingChannel: validChannel,
        ...(body.stock !== undefined ? { stock: Math.max(0, Number(body.stock)) } : {}),
      })
      .where(eq(products.id, id))
      .returning();
    return Response.json({ product: updated });
  }

  const id = body.id ? Number(body.id) : null;
  const name = String(body.name ?? "").trim();
  const species = String(body.species ?? "").trim();
  const category = String(body.category ?? "specimen").trim();
  const rawCollections = Array.isArray(body.collections)
    ? body.collections.map((c) => String(c))
    : [];
  const validCollections = rawCollections.filter(isCollectionSlug);
  const collection =
    validCollections[0] ?? String(body.collection ?? "devonian-crown").trim() ?? "devonian-crown";
  const collections = validCollections.length > 0 ? validCollections : [collection];
  const period = String(body.period ?? "").trim() || null;
  const locality = String(body.locality ?? "").trim();
  const formation = String(body.formation ?? "").trim() || null;
  const lengthMm = body.lengthMm ? Number(body.lengthMm) : null;
  const preparation = String(body.preparation ?? "").trim();
  const priceCents = Math.round(Number(body.priceDollars ?? 0) * 100);
  const compareAtCents =
    body.compareAtDollars && Number(body.compareAtDollars) > 0
      ? Math.round(Number(body.compareAtDollars) * 100)
      : null;
  const stock = Math.max(0, Number(body.stock ?? 1));
  const published = body.published === undefined ? true : Boolean(body.published);
  const hasCertificate = Boolean(body.hasCertificate);
  const archived = Boolean(body.archived);
  const siteOnlyPriceCents =
    body.siteOnlyPriceDollars && Number(body.siteOnlyPriceDollars) > 0
      ? Math.round(Number(body.siteOnlyPriceDollars) * 100)
      : null;
  const featured = Boolean(body.featured);
  const rawChannel = String(body.listingChannel ?? "direct").trim();
  const listingChannel = ["direct", "catawiki", "ebay"].includes(rawChannel) ? rawChannel : "direct";
  const externalListingUrl = String(body.externalListingUrl ?? "").trim() || null;
  const videoUrl = String(body.videoUrl ?? "").trim() || null;
  const shortDescription = String(body.shortDescription ?? "").trim();
  const description = String(body.description ?? "").trim();
  const provenance = String(body.provenance ?? "").trim();

  const rawImages = Array.isArray(body.images) ? (body.images as ProductImage[]) : [];
  const images: ProductImage[] =
    rawImages.length > 0
      ? rawImages.map((img, idx) => ({
          src: String(img.src || "/images/products/drotops-armatus.jpg").trim(),
          alt: String(img.alt || `${name} - view ${idx + 1}`).trim(),
          label: String(img.label || (idx === 0 ? "Full specimen" : `Angle ${idx + 1}`)).trim(),
          ...(img.zoom ? { zoom: img.zoom } : {}),
        }))
      : [
          {
            src: "/images/products/drotops-armatus.jpg",
            alt: `${name}, full specimen`,
            label: "Full specimen",
          },
        ];

  if (!name) {
    return Response.json({ error: "Please enter at least a title for the specimen." }, { status: 400 });
  }
  if (priceCents <= 0 && published) {
    return Response.json(
      { error: "Please enter a price in euro so the piece can be published." },
      { status: 400 },
    );
  }

  // Imported listings are often partial: fill sensible defaults instead of blocking.
  const finalSpecies = species || "Moroccan trilobite";
  const finalLocality = locality || "Morocco";
  const finalPreparation = preparation || "Hand-prepared, documented";

  const desiredSlug = slugify(String(body.slug ?? "").trim() || `${species}-${name}`) || `specimen-${Date.now()}`;

  try {
    if (id && id > 0) {
      const [updated] = await db
        .update(products)
        .set({
          slug: desiredSlug,
          name,
          species: finalSpecies,
          category,
          collection,
          collections,
          period,
          locality: finalLocality,
          formation,
          lengthMm,
          preparation: finalPreparation,
          priceCents,
          compareAtCents,
          stock,
          featured,
          published,
          hasCertificate,
          archived,
          siteOnlyPriceCents,
          listingChannel,
          externalListingUrl,
          videoUrl,
          shortDescription: shortDescription || name,
          description: description || shortDescription || name,
          provenance:
            provenance ||
            "Authentic Moroccan specimen, accompanied by signed certificate of authenticity and geological data card.",
          images,
        })
        .where(eq(products.id, id))
        .returning();

      return Response.json({ product: updated });
    } else {
      const existing = await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.slug, desiredSlug))
        .limit(1);
      const finalSlug = existing.length > 0 ? `${desiredSlug}-${Date.now().toString().slice(-4)}` : desiredSlug;

      const [created] = await db
        .insert(products)
        .values({
          slug: finalSlug,
          name,
          species: finalSpecies,
          category,
          collection,
          collections,
          period,
          locality: finalLocality,
          formation,
          lengthMm,
          preparation: finalPreparation,
          priceCents,
          compareAtCents,
          stock,
          featured,
          published,
          hasCertificate,
          archived,
          siteOnlyPriceCents,
          listingChannel,
          externalListingUrl,
          videoUrl,
          shortDescription: shortDescription || name,
          description: description || shortDescription || name,
          provenance:
            provenance ||
            "Authentic Moroccan specimen, accompanied by signed certificate of authenticity and geological data card.",
          images,
        })
        .returning();

      return Response.json({ product: created }, { status: 201 });
    }
  } catch (error) {
    console.error("Failed to save product", error);
    return Response.json({ error: "Could not save specimen." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Invalid ID." }, { status: 400 });
  }

  await db.delete(products).where(eq(products.id, id));
  return Response.json({ ok: true });
}
