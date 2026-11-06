import { and, count, desc, eq, isNull, ne, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { products, reviews } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { HOME_REVIEW_AUTOMATIC, HOME_REVIEW_LIMIT, decideHomePick, homePickSurvivesStatus } from "@/lib/home-reviews";
import { isPublicReview, isReviewModerationStatus, reviewModerationStatus } from "@/lib/review-moderation";
import { ensureSchema } from "@/lib/schema-migrate";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

/** Public = approved, or a legacy comment published before moderation existed (NULL). */
const publicNow = () => or(eq(reviews.moderationStatus, "approved"), isNull(reviews.moderationStatus));

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401, headers });
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "pending";
  const page = Number(url.searchParams.get("page") || 1);
  if ((status !== "all" && !isReviewModerationStatus(status)) || !Number.isInteger(page) || page < 1 || page > 100000) {
    return Response.json({ error: "Invalid review filter." }, { status: 400, headers });
  }
  await ensureSchema();
  const condition = status === "all" ? undefined : status === "approved"
    ? publicNow()
    : eq(reviews.moderationStatus, status);
  const pageSize = 20;
  const [rows, [total], groups, [picked]] = await Promise.all([
    db.select({
      id: reviews.id, authorName: reviews.authorName, authorCountry: reviews.authorCountry,
      rating: reviews.rating, title: reviews.title, body: reviews.body,
      moderationStatus: reviews.moderationStatus, moderatedAt: reviews.moderatedAt,
      createdAt: reviews.createdAt, verifiedPurchase: reviews.verifiedPurchase,
      showOnHome: reviews.showOnHome,
      productName: products.name, productSlug: products.slug,
    }).from(reviews).innerJoin(products, eq(reviews.productId, products.id)).where(condition)
      .orderBy(desc(reviews.createdAt), desc(reviews.id)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ value: count() }).from(reviews).where(condition),
    db.select({ status: reviews.moderationStatus, value: count() }).from(reviews).groupBy(reviews.moderationStatus),
    db.select({ value: count() }).from(reviews).where(and(publicNow(), eq(reviews.showOnHome, true))),
  ]);
  const counts = { pending: 0, approved: 0, rejected: 0, all: 0 };
  for (const group of groups) {
    const value = Number(group.value);
    counts[reviewModerationStatus(group.status)] += value;
    counts.all += value;
  }
  return Response.json({
    reviews: rows.map((row) => ({
      ...row,
      moderationStatus: reviewModerationStatus(row.moderationStatus),
      showOnHome: row.showOnHome && isPublicReview(row.moderationStatus),
    })),
    counts, total: Number(total?.value ?? 0), page, pageSize,
    home: { selected: Number(picked?.value ?? 0), limit: HOME_REVIEW_LIMIT, automatic: HOME_REVIEW_AUTOMATIC },
  }, { headers });
}

/**
 * Two kinds of change, one per request:
 *  - { id, status }: moderation. Leaving "approved" also takes the review off the home page.
 *  - { id, showOnHome }: the curator's home page choice (public reviews only, up to the limit).
 * No review is ever deleted.
 */
export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401, headers });
  const body = await request.json().catch(() => null) as {
    authorName?: unknown;
    authorCountry?: unknown;
    rating?: unknown;
    title?: unknown;
    body?: unknown;
    productId?: unknown;
    showOnHome?: unknown;
    verifiedPurchase?: unknown;
  } | null;

  if (!body || typeof body.authorName !== "string" || !body.authorName.trim() ||
      typeof body.title !== "string" || !body.title.trim() ||
      typeof body.body !== "string" || !body.body.trim()) {
    return Response.json({ error: "Author name, title and review text are required." }, { status: 400, headers });
  }

  await ensureSchema();

  let pId = Number(body.productId);
  if (!Number.isInteger(pId) || pId <= 0) {
    const [first] = await db.select({ id: products.id }).from(products).where(eq(products.published, true)).limit(1);
    if (!first) return Response.json({ error: "Catalogue is empty. Seed or create a piece first." }, { status: 400, headers });
    pId = first.id;
  }

  const rating = Math.max(1, Math.min(5, Math.round(Number(body.rating) || 5)));
  const authorCountry = typeof body.authorCountry === "string" && body.authorCountry.trim() ? body.authorCountry.trim() : "Worldwide";
  const showOnHome = Boolean(body.showOnHome);
  const verifiedPurchase = Boolean(body.verifiedPurchase ?? true);

  const [created] = await db
    .insert(reviews)
    .values({
      authorName: body.authorName.trim(),
      authorCountry,
      rating,
      title: body.title.trim(),
      body: body.body.trim(),
      productId: pId,
      moderationStatus: "approved",
      moderatedAt: new Date(),
      showOnHome,
      verifiedPurchase,
    })
    .returning();

  return Response.json({ ok: true, review: created }, { status: 201, headers });
}

export async function PATCH(request: Request) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401, headers });
  const body = await request.json().catch(() => null) as { id?: unknown; status?: unknown; showOnHome?: unknown } | null;
  if (!body || typeof body.id !== "number" || !Number.isInteger(body.id) || body.id < 1) {
    return Response.json({ error: "Choose a valid review and moderation action." }, { status: 400, headers });
  }
  const id = body.id;
  await ensureSchema();

  if (typeof body.showOnHome === "boolean") {
    const requested = body.showOnHome;
    const [current] = await db
      .select({ id: reviews.id, moderationStatus: reviews.moderationStatus, showOnHome: reviews.showOnHome })
      .from(reviews)
      .where(eq(reviews.id, id))
      .limit(1);
    if (!current) return Response.json({ error: "Review not found." }, { status: 404, headers });
    const [elsewhere] = await db
      .select({ value: count() })
      .from(reviews)
      .where(and(publicNow(), eq(reviews.showOnHome, true), ne(reviews.id, id)));
    const decision = decideHomePick({
      requested,
      publicNow: isPublicReview(current.moderationStatus),
      alreadyPicked: current.showOnHome,
      pickedElsewhere: Number(elsewhere?.value ?? 0),
    });
    if (!decision.ok) return Response.json({ error: decision.error }, { status: 409, headers });
    const [updated] = await db
      .update(reviews)
      .set({ showOnHome: decision.showOnHome })
      .where(eq(reviews.id, id))
      .returning({ id: reviews.id, showOnHome: reviews.showOnHome });
    revalidateSite();
    return Response.json({ ok: true, review: updated }, { headers });
  }

  if (!isReviewModerationStatus(body.status)) {
    return Response.json({ error: "Choose a valid review and moderation action." }, { status: 400, headers });
  }
  const next = body.status;
  const [updated] = await db
    .update(reviews)
    .set({
      moderationStatus: next,
      moderatedAt: new Date(),
      ...(homePickSurvivesStatus(next) ? {} : { showOnHome: false }),
    })
    .where(eq(reviews.id, id))
    .returning({ id: reviews.id, moderationStatus: reviews.moderationStatus });
  if (!updated) return Response.json({ error: "Review not found." }, { status: 404, headers });
  revalidateSite();
  return Response.json({ ok: true, review: updated }, { headers });
}

function revalidateSite() {
  // No review is deleted, and no visitor is marked as a verified purchaser.
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/archive");
  revalidatePath("/featured");
  revalidatePath("/shop/[slug]", "page");
}
