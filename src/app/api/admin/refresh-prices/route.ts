import { isAdminAuthenticated } from "@/lib/admin-auth";
import { logPriceRefreshRun, refreshMarketplacePrices } from "@/lib/refresh-prices";
import { getSiteSettings } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Manual refresh, triggered from the back-office ("Check prices now"). */
export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const settings = await getSiteSettings();
  const ebayStoreUrl =
    process.env.EBAY_STORE_URL || settings.ebayUrl || "https://www.ebay.com/str/mederranic";

  try {
    const report = await refreshMarketplacePrices(ebayStoreUrl);
    const unreadable = report.results.filter((r) => r.error).length;
    await logPriceRefreshRun({
      source: "manual",
      ok: true,
      checked: report.checked,
      changed: report.changed,
      ended: report.ended,
      summary: `Checked ${report.checked}, changed ${report.changed}, ended ${report.ended}${
        unreadable ? `, ${unreadable} could not be read` : ""
      }.`,
    });
    return Response.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    await logPriceRefreshRun({ source: "manual", ok: false, summary: `Failed: ${message}` });
    console.error("Price refresh failed", error);
    return Response.json({ error: "Could not refresh prices." }, { status: 500 });
  }
}
