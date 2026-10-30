import { and, asc, avg, count, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { newsletterSubscribers, orderItems, orders, products, reviews, siteSettings } from "@/db/schema";
import { ensureSeeded } from "@/lib/seed";
import { SEED_SETTINGS } from "@/lib/seed-settings";

export type Product = typeof products.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type SiteSettings = typeof siteSettings.$inferSelect;
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type ProductWithStats = Product & { rating: number; reviewCount: number };

export const DEFAULT_SITE_SETTINGS: Omit<SiteSettings, "updatedAt"> = SEED_SETTINGS;

export const UNUSED_DEFAULTS: Omit<SiteSettings, "updatedAt"> = {
  id: 1,
  heroEyebrow: "Moroccan Trilobites · 23 Years of Curatorship",
  heroTitle: "Five hundred million years,",
  heroTitleItalic: "in your keeping.",
  heroDescription:
    "Museum-grade trilobites from the Tafilalt, Anti-Atlas and Fezouata Shale. Direct from nearly 23 years of specialist work, backed by thousands of verified feedbacks on eBay and Catawiki and battle-tested insured worldwide shipping.",
  provenanceEyebrow: "Nearly 23 Years in the Field",
  provenanceTitle: "Known by collectors.",
  provenanceTitleItalic: "Proven across thousands of shipments.",
  provenanceBody:
    "For nearly 23 years we have worked directly with licensed quarry families across Morocco's Tafilalt and Anti-Atlas basins. Known to collectors worldwide through thousands of verified transactions on eBay and Catawiki, we pack and ship every specimen with museum-level protection to North America, Europe and Japan.",
  yearsExperience: 23,
  feedbacksLabel: "5,000+",
  ebayUrl: "https://www.ebay.com/str/mederranic",
  trustamiUrl: "https://www.trustami.com/review/mediterranic-ecwid-com-rating",
  trustamiRating: "4.98/5",
  trustamiRatings: "200",
  whatsappPhone: "+351961300710",
  catawikiUrl: "https://www.catawiki.com/en/u/3881635-mediterranic",
  instagramUrl: "https://www.instagram.com/mediterranic.store/",
  facebookUrl: "https://www.facebook.com/Fossils.from.Morocco/",
  contactEmail: "mediterranean.world@gmail.com",
  provenanceImage: "/images/seafloor-plate.jpg",
  heroImage: "/images/hero.jpg",
};

async function statsByProduct() {
  const rows = await db
    .select({
      productId: reviews.productId,
      rating: avg(reviews.rating),
      reviewCount: count(),
    })
    .from(reviews)
    .groupBy(reviews.productId);

  return new Map(
    rows.map((r) => [
      r.productId,
      { rating: Number(r.rating ?? 0), reviewCount: Number(r.reviewCount) },
    ]),
  );
}

function attachStats(
  list: Product[],
  stats: Awaited<ReturnType<typeof statsByProduct>>,
): ProductWithStats[] {
  return list.map((p) => ({
    ...p,
    rating: stats.get(p.id)?.rating ?? 0,
    reviewCount: stats.get(p.id)?.reviewCount ?? 0,
  }));
}

export async function getAllProducts({ includeDrafts = false } = {}): Promise<ProductWithStats[]> {
  await ensureSeeded();
  const [list, stats] = await Promise.all([
    (includeDrafts
      ? db.select().from(products)
      : db.select().from(products).where(eq(products.published, true))
    ).orderBy(asc(products.id)),
    statsByProduct(),
  ]);
  return attachStats(list, stats);
}

export async function getProductBySlug(
  slug: string,
  { includeDrafts = false } = {},
): Promise<ProductWithStats | null> {
  await ensureSeeded();
  const [product] = await db
    .select()
    .from(products)
    .where(includeDrafts ? eq(products.slug, slug) : and(eq(products.slug, slug), eq(products.published, true)))
    .limit(1);
  if (!product) return null;
  const stats = await statsByProduct();
  return attachStats([product], stats)[0];
}

export async function getProductReviews(productId: number): Promise<Review[]> {
  return db
    .select()
    .from(reviews)
    .where(eq(reviews.productId, productId))
    .orderBy(desc(reviews.createdAt));
}

export async function getRatingBreakdown(productId: number): Promise<Record<1 | 2 | 3 | 4 | 5, number>> {
  const rows = await db
    .select({ rating: reviews.rating, total: count() })
    .from(reviews)
    .where(eq(reviews.productId, productId))
    .groupBy(reviews.rating);

  const breakdown: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of rows) {
    const star = Math.min(5, Math.max(1, row.rating)) as 1 | 2 | 3 | 4 | 5;
    breakdown[star] += Number(row.total);
  }
  return breakdown;
}

export async function getTopReviews(limit = 6) {
  await ensureSeeded();
  return db
    .select({
      id: reviews.id,
      authorName: reviews.authorName,
      authorCountry: reviews.authorCountry,
      rating: reviews.rating,
      title: reviews.title,
      body: reviews.body,
      productName: products.name,
      productSlug: products.slug,
    })
    .from(reviews)
    .innerJoin(products, eq(reviews.productId, products.id))
    .where(gte(reviews.rating, 5))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}

export async function getStoreStats() {
  await ensureSeeded();
  const [[productRow], [reviewRow]] = await Promise.all([
    db.select({ value: count() }).from(products),
    db.select({ value: count(), average: avg(reviews.rating) }).from(reviews),
  ]);
  return {
    productCount: Number(productRow?.value ?? 0),
    reviewCount: Number(reviewRow?.value ?? 0),
    averageRating: Number(reviewRow?.average ?? 0),
  };
}

export async function getOrderWithItems(id: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  return { order, items };
}

export async function getSiteSettings(): Promise<SiteSettings> {
  await ensureSeeded();
  const [existing] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(siteSettings)
    .values(DEFAULT_SITE_SETTINGS)
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [fallback] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
  return fallback ?? { ...DEFAULT_SITE_SETTINGS, updatedAt: new Date() };
}

export async function getAllOrdersWithItems() {
  const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(50);
  const allItems = await db.select().from(orderItems);
  return allOrders.map((order) => ({
    order,
    items: allItems.filter((i) => i.orderId === order.id),
  }));
}

/** Every newsletter sign-up, newest first. Read-only: nothing here is ever pruned. */
export async function getNewsletterSubscribers(limit = 1000): Promise<NewsletterSubscriber[]> {
  await ensureSeeded();
  return db
    .select()
    .from(newsletterSubscribers)
    .orderBy(desc(newsletterSubscribers.createdAt))
    .limit(limit);
}

/**
 * Records a sign-up. Emails are unique, so a repeated address is simply ignored
 * and reported back as "already subscribed" instead of creating a duplicate.
 */
export async function addNewsletterSubscriber(
  email: string,
  source = "footer",
): Promise<{ added: boolean }> {
  await ensureSeeded();
  const [inserted] = await db
    .insert(newsletterSubscribers)
    .values({ email, source })
    .onConflictDoNothing({ target: newsletterSubscribers.email })
    .returning({ id: newsletterSubscribers.id });
  return { added: Boolean(inserted) };
}
