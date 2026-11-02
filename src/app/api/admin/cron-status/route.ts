import { isAdminAuthenticated } from "@/lib/admin-auth";
import { hasEbayCredentials } from "@/lib/ebay";
import { getRecentPriceRuns } from "@/lib/price-runs";

export const dynamic = "force-dynamic";

/** Backwards-compatible panel, combining the deployed and newer log tables. */
export async function GET() {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const runs = await getRecentPriceRuns(20);
  return Response.json({
    cronSecretConfigured: Boolean(process.env.CRON_SECRET?.trim()),
    ebayApiConfigured: hasEbayCredentials(),
    schedule: "06:00 UTC daily — Lisbon 06:00 in winter, 07:00 in summer; Hobby execution may be delayed within the scheduled hour",
    runs: runs.map((run) => ({
      id: run.id, source: run.source === "manual" ? "manual" : "cron", status: run.status,
      ok: run.status === "ok", checked: run.checked, changed: run.changed, ended: run.ended,
      summary: run.detail || `${run.checked} checked, ${run.changed} changed, ${run.ended} ended (${run.status}).`,
      ranAt: run.createdAt,
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
