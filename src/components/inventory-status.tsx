import { getInventorySyncReport } from "@/lib/inventory-sync";
import { hasEbayCredentials } from "@/lib/ebay";

/** Public freshness, not a claim that unverified remote counts are zero. No writes. */
export async function InventoryStatus() {
  const report = await getInventorySyncReport();
  const development = !process.env.VERCEL && !hasEbayCredentials();
  const stale = !report?.finishedAt || Date.now() - new Date(report.finishedAt).getTime() > 26 * 60 * 60 * 1000;
  const complete = !development && !stale && report?.status === "complete";
  return (
    <p className={`mt-4 rounded-sm border px-3 py-2 text-xs leading-relaxed ${complete ? "border-sea/15 bg-sea/5 text-sea" : "border-brass/35 bg-brass/10 text-ink/65"}`}>
      {development
        ? "Development preview: these are local catalogue counts, not a verified live eBay inventory. Production credentials are configured separately."
        : report?.status === "running"
          ? "Inventory synchronization is in progress. Availability still reflects the last stored catalogue."
          : !report?.finishedAt
          ? "Availability reflects the stored catalogue. The first live inventory synchronization has not yet been verified."
          : `${complete ? "Inventory synchronized" : "Inventory partly verified — some listings may need confirmation"}: ${new Date(report.finishedAt).toLocaleString("en-GB", { timeZone: "Europe/Lisbon" })} (Lisbon).`}
    </p>
  );
}
