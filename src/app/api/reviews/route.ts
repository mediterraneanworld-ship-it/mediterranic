import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { products, reviews } from "@/db/schema";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  const parsed: unknown = await request.json().catch(() => null);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const body = parsed as Record<string, unknown>;
  const productSlug = clean(body.productSlug, 120);
  const authorName = clean(body.authorName, 60);
  const authorCountry = clean(body.authorCountry, 60);
  const title = clean(body.title, 120);
  const text = clean(body.body, 2000);
  const rating = Number(body.rating);

  if (!productSlug) return Response.json({ error: "Missing specimen." }, { status: 400 });
  if (authorName.length < 2) return Response.json({ error: "Please enter your name." }, { status: 400 });
  if (authorCountry.length < 2) return Response.json({ error: "Please enter your country." }, { status: 400 });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return Response.json({ error: "Rating must be between 1 and 5 stars." }, { status: 400 });
  if (title.length < 3) return Response.json({ error: "Please add a headline." }, { status: 400 });
  if (text.length < 20) return Response.json({ error: "Reviews need at least 20 characters." }, { status: 400 });

  await ensureSeeded();
  const [product] = await db.select({ id: products.id }).from(products)
    .where(and(eq(products.slug, productSlug), eq(products.published, true))).limit(1);
  if (!product) return Response.json({ error: "Specimen not found." }, { status: 404 });

  const [review] = await db.insert(reviews).values({
    productId: product.id, authorName, authorCountry, rating, title, body: text,
    // Never accept publication status or verified-purchase claims from a visitor.
    moderationStatus: "pending",
    verifiedPurchase: false,
  }).returning({ id: reviews.id });

  return Response.json({ id: review.id, status: "pending", message: "Your review is awaiting curator approval." }, { status: 201 });
}
