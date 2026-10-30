import { asc } from "drizzle-orm";
import { db } from "@/db";
import { newsletterSubscribers, products, reviews, siteSettings } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * Downloads the whole shop — catalogue, reviews, storefront copy and the
 * newsletter list — as a single JSON file. Keep one of these before any
 * development work, so nothing done in the back-office can ever be lost.
 */
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [catalogue, allReviews, settingsRows, subs] = await Promise.all([
    db.select().from(products).orderBy(asc(products.id)),
    db.select().from(reviews).orderBy(asc(reviews.id)),
    db.select().from(siteSettings),
    db.select().from(newsletterSubscribers).orderBy(asc(newsletterSubscribers.id)),
  ]);

  const payload = {
    format: "mediterranic-backup",
    version: 2,
    exportedAt: new Date().toISOString(),
    counts: {
      products: catalogue.length,
      reviews: allReviews.length,
      subscribers: subs.length,
    },
    settings: settingsRows[0] ?? null,
    products: catalogue,
    reviews: allReviews,
    subscribers: subs,
  };

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="mediterranic-backup-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
