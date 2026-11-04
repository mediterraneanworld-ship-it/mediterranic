import { and, count, desc, eq, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { products, reviews } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { ensureSchema } from "@/lib/schema-migrate";
import { isReviewModerationStatus, reviewModerationStatus } from "@/lib/review-moderation";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

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
    ? or(eq(reviews.moderationStatus, "approved"), isNull(reviews.moderationStatus))
    : eq(reviews.moderationStatus, status);
  const pageSize = 20;
  const [rows, [total], groups] = await Promise.all([
    db.select({
      id: reviews.id, authorName: reviews.authorName, authorCountry: reviews.authorCountry,
      rating: reviews.rating, title: reviews.title, body: reviews.body,
      moderationStatus: reviews.moderationStatus, moderatedAt: reviews.moderatedAt,
      createdAt: reviews.createdAt, verifiedPurchase: reviews.verifiedPurchase,
      productName: products.name, productSlug: products.slug,
    }).from(reviews).innerJoin(products, eq(reviews.productId, products.id)).where(condition)
      .orderBy(desc(reviews.createdAt), desc(reviews.id)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ value: count() }).from(reviews).where(condition),
    db.select({ status: reviews.moderationStatus, value: count() }).from(reviews).groupBy(reviews.moderationStatus),
  ]);
  const counts = { pending: 0, approved: 0, rejected: 0, all: 0 };
  for (const group of groups) {
    const value = Number(group.value);
    counts[reviewModerationStatus(group.status)] += value;
    counts.all += value;
  }
  return Response.json({
    reviews: rows.map((row) => ({ ...row, moderationStatus: reviewModerationStatus(row.moderationStatus) })),
    counts, total: Number(total?.value ?? 0), page, pageSize,
  }, { headers });
}

export async function PATCH(request: Request) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401, headers });
  const body = await request.json().catch(() => null) as { id?: unknown; status?: unknown } | null;
  if (!body || typeof body.id !== "number" || !Number.isInteger(body.id) || body.id < 1 || !isReviewModerationStatus(body.status)) {
    return Response.json({ error: "Choose a valid review and moderation action." }, { status: 400, headers });
  }
  await ensureSchema();
  const [updated] = await db.update(reviews).set({ moderationStatus: body.status, moderatedAt: new Date() })
    .where(and(eq(reviews.id, body.id))).returning({ id: reviews.id, moderationStatus: reviews.moderationStatus });
  if (!updated) return Response.json({ error: "Review not found." }, { status: 404, headers });
  // No review is deleted, and no visitor is marked as a verified purchaser.
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/archive");
  revalidatePath("/featured");
  revalidatePath("/shop/[slug]", "page");
  return Response.json({ ok: true, review: updated }, { headers });
}
