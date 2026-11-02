import { desc } from "drizzle-orm";
import { db } from "@/db";
import { priceRefreshRuns } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { hasEbayCredentials } from "@/lib/ebay";
import { ensureSchema } from "@/lib/schema-migrate";

export const dynamic = "force-dynamic";

/**
 * What the back-office needs to answer "did the morning job run?":
 * the last runs, and whether the two things it depends on are in place.
 * Secrets are never returned — only whether they exist.
 */
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  await ensureSchema();

  const runs = await db.select().from(priceRefreshRuns).orderBy(desc(priceRefreshRuns.ranAt)).limit(10);

  return Response.json({
    cronSecretConfigured: Boolean(process.env.CRON_SECRET?.trim()),
    ebayApiConfigured: hasEbayCredentials(),
    schedule: "06:00 UTC daily (vercel.json) — 07:00 Lisbon in winter, 08:00 in summer",
    runs,
  });
}
