import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { newsletterSubscribers, products, reviews, siteSettings } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type BackupProduct = typeof products.$inferInsert & { id?: number };

/**
 * Restores a backup produced by /api/admin/backup.
 *
 * Products are matched on `slug`: existing pieces are updated, new ones are
 * inserted, and anything not in the backup is left untouched. Nothing is
 * deleted, so a restore can never destroy work by accident.
 */
export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: {
    format?: string;
    products?: BackupProduct[];
    settings?: Record<string, unknown> | null;
    /** Present in backups from version 2 onwards; older files simply omit it. */
    subscribers?: { email?: string; source?: string }[];
  };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "That file is not valid JSON." }, { status: 400 });
  }

  if (payload.format !== "mediterranic-backup" || !Array.isArray(payload.products)) {
    return Response.json(
      { error: "That is not a Mediterranic backup file." },
      { status: 400 },
    );
  }

  // JSON has no date type: timestamps arrive as strings and must be revived.
  const DATE_FIELDS = ["createdAt", "lastPriceCheck", "updatedAt"] as const;
  const reviveDates = <T extends Record<string, unknown>>(row: T): T => {
    const out: Record<string, unknown> = { ...row };
    for (const field of DATE_FIELDS) {
      const value = out[field];
      if (typeof value === "string") {
        const parsed = new Date(value);
        out[field] = Number.isNaN(parsed.getTime()) ? null : parsed;
      }
    }
    return out as T;
  };

  let updated = 0;
  let inserted = 0;

  for (const raw of payload.products) {
    const { id: _ignored, ...rest } = raw;
    const piece = reviveDates(rest as Record<string, unknown>) as typeof rest;
    if (!piece.slug) continue;

    const existing = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, piece.slug))
      .limit(1);

    if (existing.length > 0) {
      await db.update(products).set(piece).where(eq(products.id, existing[0].id));
      updated += 1;
    } else {
      await db.insert(products).values(piece);
      inserted += 1;
    }
  }

  // Keep the id sequence ahead of any inserted rows.
  await db.execute(
    sql`SELECT setval(pg_get_serial_sequence('products','id'), COALESCE((SELECT MAX(id) FROM products), 1))`,
  );

  let settingsRestored = false;
  if (payload.settings && typeof payload.settings === "object") {
    const { id: _id, updatedAt: _updatedAt, ...settingsRest } = payload.settings as Record<
      string,
      unknown
    >;
    await db
      .update(siteSettings)
      .set({
        ...(settingsRest as Partial<typeof siteSettings.$inferInsert>),
        updatedAt: new Date(),
      })
      .where(eq(siteSettings.id, 1));
    settingsRestored = true;
  }

  // Newsletter list: append-only. An address already in the database is left
  // exactly as it is, and nobody is ever removed by a restore.
  let subscribersAdded = 0;
  if (Array.isArray(payload.subscribers)) {
    for (const sub of payload.subscribers) {
      const email = typeof sub?.email === "string" ? sub.email.trim().toLowerCase() : "";
      if (!email) continue;
      const [row] = await db
        .insert(newsletterSubscribers)
        .values({ email, source: typeof sub.source === "string" && sub.source ? sub.source : "backup" })
        .onConflictDoNothing({ target: newsletterSubscribers.email })
        .returning({ id: newsletterSubscribers.id });
      if (row) subscribersAdded += 1;
    }
  }

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(products);

  return Response.json({
    ok: true,
    updated,
    inserted,
    settingsRestored,
    totalProducts: total,
    reviewsUntouched: true,
    subscribersAdded,
  });
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(products);
  const [{ reviewTotal }] = await db
    .select({ reviewTotal: sql<number>`count(*)::int` })
    .from(reviews);
  return Response.json({ products: total, reviews: reviewTotal });
}
