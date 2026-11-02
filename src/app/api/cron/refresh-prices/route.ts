import { logPriceRefreshRun, refreshMarketplacePrices } from "@/lib/refresh-prices";
import { getSiteSettings } from "@/lib/catalog";
import { ensureSchema } from "@/lib/schema-migrate";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Scheduled refresh. Vercel calls this with `Authorization: Bearer <CRON_SECRET>`
 * (CRON_SECRET must exist in the project's environment variables). An external
 * scheduler (cron-job.org) may use `?secret=<CRON_SECRET>` instead.
 *
 * Every attempt — accepted or refused — is written to the run log so the
 * back-office can show exactly what happened this morning.
 */
export async function GET(request: Request) {
  await ensureSchema();

  const secret = process.env.CRON_SECRET?.trim();
  const headerSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const querySecret = new URL(request.url).searchParams.get("secret")?.trim();
  const provided = headerSecret || querySecret || "";
  const fromVercelCron = (request.headers.get("user-agent") ?? "").includes("vercel-cron");

  if (!secret) {
    await logPriceRefreshRun({
      source: "cron",
      ok: false,
      summary: "Refused: CRON_SECRET is not set in the environment variables, so the scheduled job cannot authenticate.",
    });
    return Response.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  if (provided !== secret) {
    await logPriceRefreshRun({
      source: "cron",
      ok: false,
      summary: fromVercelCron
        ? "Refused: Vercel called the job but its CRON_SECRET does not match the one the app has. Redeploy after changing the variable."
        : "Refused: wrong or missing secret.",
    });
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const settings = await getSiteSettings();
  const ebayStoreUrl =
    process.env.EBAY_STORE_URL || settings.ebayUrl || "https://www.ebay.com/str/mederranic";

  try {
    const report = await refreshMarketplacePrices(ebayStoreUrl);
    const unreadable = report.results.filter((r) => r.error).length;
    await logPriceRefreshRun({
      source: "cron",
      ok: true,
      checked: report.checked,
      changed: report.changed,
      ended: report.ended,
      summary: `Checked ${report.checked}, changed ${report.changed}, ended ${report.ended}${
        unreadable ? `, ${unreadable} could not be read` : ""
      }.`,
    });
    return Response.json({ ok: true, ranAt: new Date().toISOString(), ...report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    await logPriceRefreshRun({ source: "cron", ok: false, summary: `Failed: ${message}` });
    console.error("Scheduled price refresh failed", error);
    return Response.json({ error: "Refresh failed." }, { status: 500 });
  }
}
