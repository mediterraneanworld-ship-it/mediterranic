import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { publicationIssues, publicationMessage } from "@/lib/admin-product-rules";
import { permanentlyDeleteProduct, ProductDeletionError } from "@/lib/product-deletion-service";
import { db } from "@/db";
import { products, type ProductImage } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { isCollectionSlug } from "@/lib/product-collections";
import { ensureSchema } from "@/lib/schema-migrate";
import { canonicalListing, extractSpecimenReference, marketplaceOf, matchListing, normalizeReference, rememberListing, rememberedLinks, savedListing } from "@/lib/marketplace-links";
import { MarketplaceError, switchSpecimenChannel } from "@/lib/marketplace-service";

export const dynamic = "force-dynamic";
const str = (value: unknown) => typeof value === "string" ? value.trim() : "";
const slugify = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
function money(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const amount = Number(String(value).replace(",", "."));
  if (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000) throw new MarketplaceError("Enter a valid euro amount.", 400);
  return Math.round(amount * 100);
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "Invalid request." }, { status: 400 });
  try {
    await ensureSchema();
    if (body.published !== undefined && typeof body.published !== "boolean") throw new MarketplaceError("Choose Publish or Unpublish explicitly.", 400);
    const id = body.id === null || body.id === undefined ? null : Number(body.id);
    if (id !== null && (!Number.isInteger(id) || id <= 0)) throw new MarketplaceError("Invalid specimen ID.", 400);
    const [existing] = id ? await db.select().from(products).where(eq(products.id, id)).limit(1) : [];
    if (id && !existing) throw new MarketplaceError("Specimen not found.", 404);
    if (body.action) {
      if (!id || !existing) throw new MarketplaceError("Invalid specimen ID.", 400);
      if (body.action === "set-channel") {
        const target = str(body.listingChannel);
        if (target !== "direct" && target !== "ebay" && target !== "catawiki") throw new MarketplaceError("Invalid sales channel.", 400);
        const stock = body.stock === undefined ? undefined : Number(body.stock);
        if (stock !== undefined && (!Number.isInteger(stock) || stock < 0)) throw new MarketplaceError("Invalid stock.", 400);
        return Response.json({ product: await switchSpecimenChannel(id, target, stock) });
      }
      if (body.action === "set-stock") {
        const stock = Number(body.stock ?? 0);
        if (!Number.isInteger(stock) || stock < 0) throw new MarketplaceError("Invalid stock.", 400);
        const [updated] = await db.update(products).set({
          stock,
          archived: stock === 0,
          listingChannel: stock === 0 ? null : existing.listingChannel ?? "direct",
          ebayListingUrl: savedListing(existing, "ebay"), catawikiListingUrl: savedListing(existing, "catawiki"),
          marketplaceHistory: rememberedLinks(existing),
        }).where(eq(products.id, id)).returning();
        return Response.json({ product: updated });
      }
      if (body.action === "set-video") {
        const [updated] = await db.update(products).set({ videoUrl: str(body.videoUrl) || null }).where(eq(products.id, id)).returning();
        return Response.json({ product: updated });
      }
      if (body.action === "set-published") {
        if (typeof body.published !== "boolean") throw new MarketplaceError("Choose Publish or Unpublish explicitly.", 400);
        const issues = body.published ? publicationIssues(existing) : [];
        if (issues.length) return Response.json({ error: publicationMessage(issues), issues, missing: issues.map((issue) => issue.field) }, { status: 400 });
        const [updated] = await db.update(products).set({
          published: body.published,
          ...(body.published && (existing.listingChannel === "ebay" || existing.listingChannel === "catawiki") ? { externalListingUrl: savedListing(existing, existing.listingChannel) } : {}),
          ...(body.published && !existing.description.trim() && existing.shortDescription.trim() ? { description: existing.shortDescription.trim() } : {}),
        }).where(eq(products.id, id)).returning();
        refreshProductPaths(existing.slug);
        return Response.json({ product: updated });
      }
      throw new MarketplaceError("Unknown action.", 400);
    }

    const name = str(body.name ?? existing?.name);
    if (!name) throw new MarketplaceError("Enter a specimen title.", 400);
    const species = str(body.species ?? existing?.species) || "Moroccan trilobite";
    const archived = body.archived === undefined ? existing?.archived ?? false : Boolean(body.archived);
    const published = body.published === undefined ? existing?.published ?? true : Boolean(body.published);
    const stock = archived ? 0 : Number(body.stock ?? existing?.stock ?? 1);
    if (!Number.isInteger(stock) || stock < 0) throw new MarketplaceError("Invalid stock.", 400);
    const priceCents = body.priceDollars === undefined ? existing?.priceCents ?? 0 : money(body.priceDollars) ?? 0;
    const siteOnlyPriceCents = body.siteOnlyPriceDollars === undefined ? existing?.siteOnlyPriceCents ?? null : money(body.siteOnlyPriceDollars);
    const compareAtCents = body.compareAtDollars === undefined ? existing?.compareAtCents ?? null : money(body.compareAtDollars);
    // An explicit null/empty value clears the channel; omission preserves it.
    const proposedChannel = body.listingChannel === undefined
      ? existing ? existing.listingChannel ?? "" : "direct"
      : body.listingChannel === null ? "" : str(body.listingChannel);
    // An empty channel is valid: it means the piece is offered nowhere.
    if (proposedChannel && !["direct", "ebay", "catawiki"].includes(proposedChannel)) {
      throw new MarketplaceError("Invalid sales channel.", 400);
    }
    let linked = { ...existing, name, species, externalListingUrl: existing?.externalListingUrl ?? null };
    // Keep old and new links. The client is not allowed to replace the saved history array.
    for (const [channel, field] of [["ebay", "ebayListingUrl"], ["catawiki", "catawikiListingUrl"]] as const) {
      const url = str(body[field]);
      if (url) linked = { ...linked, ...rememberListing(linked, channel, url) };
    }
    const submittedUrl = body.externalListingUrl === undefined ? existing?.externalListingUrl ?? null : str(body.externalListingUrl) || null;
    const urlChannel = marketplaceOf(submittedUrl);
    if (urlChannel && submittedUrl) linked = { ...linked, ...rememberListing(linked, urlChannel, submittedUrl) };
    const externalListingUrl = proposedChannel === "ebay" || proposedChannel === "catawiki"
      ? savedListing(linked, proposedChannel)
      : submittedUrl;
    const typedReference = body.specimenReference === undefined ? null : str(body.specimenReference);
    const reference = normalizeReference(
      typedReference
        ?? existing?.specimenReference
        ?? extractSpecimenReference(submittedUrl ?? "")
        ?? extractSpecimenReference(name)
        ?? extractSpecimenReference(str(body.description)),
    );
    const shortDescription = str(body.shortDescription ?? existing?.shortDescription);
    const description = str(body.description ?? existing?.description);
    const rawImages = Array.isArray(body.images) ? body.images as ProductImage[] : existing?.images ?? [];
    const images = rawImages.filter((image) => image && str(image.src)).map((image, index) => ({
      ...image,
      src: str(image.src), alt: str(image.alt) || `${name} — view ${index + 1}`,
      label: str(image.label) || (index === 0 ? "Full specimen" : `View ${index + 1}`),
    }));
    const issues = published ? publicationIssues({
      name, archived, stock, priceCents, images, description, shortDescription,
      listingChannel: archived ? null : proposedChannel || null,
      marketplaceActive: existing && proposedChannel === existing.listingChannel ? existing.marketplaceActive : null,
      externalListingUrl, ebayListingUrl: savedListing(linked, "ebay"), catawikiListingUrl: savedListing(linked, "catawiki"),
    }) : [];
    if (issues.length) return Response.json({ error: publicationMessage(issues), issues, missing: issues.map((issue) => issue.field) }, { status: 400 });
    const all = !existing ? await db.select().from(products) : [];
    if (!existing) {
      const known = matchListing({ url: externalListingUrl ?? "", title: reference ? `Specimen ID: ${reference}` : name }, all);
      if (known.productId) return Response.json({ error: "This is an existing specimen. Link the listing to that record instead of importing a duplicate.", existingProductId: known.productId }, { status: 409 });
    }
    const collections = (Array.isArray(body.collections) ? body.collections.map(String) : existing?.collections ?? []).filter(isCollectionSlug);
    const collection = collections[0] || str(body.collection ?? existing?.collection) || "devonian-crown";
    const desiredSlug = existing?.slug && body.slug === undefined ? existing.slug : slugify(str(body.slug) || `${species}-${name}`) || `specimen-${Date.now()}`;
    const finalSlug = !existing && all.some((row) => row.slug === desiredSlug) ? `${desiredSlug}-${Date.now()}` : desiredSlug;
    // Dimensions are free text ("Specimen: 8.7 x 9.0 cm"); only the length is bounded.
    const lengthMm =
      body.lengthMm === undefined
        ? existing?.lengthMm ?? null
        : body.lengthMm === ""
          ? null
          : String(body.lengthMm).trim().slice(0, 160) || null;
    const weightGrams = body.weightGrams === undefined ? existing?.weightGrams ?? null : body.weightGrams === "" ? null : Number(body.weightGrams);
    if (weightGrams !== null && (!Number.isFinite(weightGrams) || weightGrams < 0 || weightGrams > 1_000_000)) {
      throw new MarketplaceError("Enter a valid weight in grams.", 400);
    }
    const values = {
      slug: finalSlug, name, species, category: str(body.category ?? existing?.category) || "specimen",
      collection, collections: collections.length ? collections : [collection],
      period: str(body.period ?? existing?.period) || null,
      locality: str(body.locality ?? existing?.locality) || "Morocco",
      formation: str(body.formation ?? existing?.formation) || null,
      lengthMm,
      weightGrams: weightGrams === null ? null : Math.round(weightGrams),
      preparation: str(body.preparation ?? existing?.preparation) || "Hand-prepared, documented",
      priceCents, compareAtCents, siteOnlyPriceCents, stock, published, archived,
      featured: body.featured === undefined ? existing?.featured ?? false : Boolean(body.featured),
      hasCertificate: body.hasCertificate === undefined ? existing?.hasCertificate ?? false : Boolean(body.hasCertificate),
      listingChannel: archived ? null : proposedChannel || null,
      externalListingUrl, ebayListingUrl: savedListing(linked, "ebay"), catawikiListingUrl: savedListing(linked, "catawiki"),
      ...(!existing || proposedChannel !== existing.listingChannel || externalListingUrl !== existing.externalListingUrl ? { marketplaceActive: null, marketplaceCheckedAt: null } : {}),
      marketplaceHistory: rememberedLinks(linked), specimenReference: reference,
      videoUrl: str(body.videoUrl ?? existing?.videoUrl) || null,
      shortDescription: shortDescription || description.slice(0, 180) || name,
      description: description || shortDescription || name,
      provenance: str(body.provenance ?? existing?.provenance) || "Documented Moroccan specimen.",
      images,
    };
    const [product] = existing
      ? await db.update(products).set(values).where(eq(products.id, existing.id)).returning()
      : await db.insert(products).values(values).returning();
    refreshProductPaths(product.slug);
    return Response.json({ product }, { status: existing ? 200 : 201 });
  } catch (error) {
    if (error instanceof MarketplaceError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof Error && /Enter a valid .* link/.test(error.message)) return Response.json({ error: error.message }, { status: 400 });
    console.error("Failed to save specimen", error);
    return Response.json({ error: "Could not save specimen. Existing data was not reset." }, { status: 500 });
  }
}

function refreshProductPaths(slug: string) {
  for (const route of ["/", "/admin", "/shop", "/archive", "/featured", `/shop/${slug}`, "/sitemap.xml"]) revalidatePath(route);
}

export async function DELETE(request: Request) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "Invalid ID." }, { status: 400 });
  const body = await request.json().catch(() => null) as { confirmation?: unknown } | null;
  if (!body || typeof body.confirmation !== "string" || !body.confirmation.trim()) {
    return Response.json({ error: "Permanent deletion requires an explicit confirmation." }, { status: 400 });
  }
  try {
    const deleted = await permanentlyDeleteProduct(id, body.confirmation.trim());
    refreshProductPaths(deleted.slug);
    return Response.json({ ok: true, deleted, message: "Permanently deleted from the catalogue and archive. Order receipts and review moderation history were retained." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ProductDeletionError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Permanent deletion rolled back", error);
    return Response.json({ error: "Could not delete this specimen. The transaction was rolled back; no partial deletion was kept." }, { status: 500 });
  }
}
