import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { priceCheckRuns, priceRefreshRuns } from "@/db/schema";
import { ensureSchema } from "@/lib/schema-migrate";
import { refreshMarketplacePrices } from "@/lib/refresh-prices";
import { getSiteSettings, getSiteContent } from "@/lib/catalog";
import { synchronizeInventory } from "@/lib/inventory-sync";

export type PriceRunSource = "vercel-cron" | "external" | "manual";
export type PriceRun = typeof priceCheckRuns.$inferSelect;

/** Records a call that was refused, so a misconfigured cron becomes visible. */
export async function recordRejectedRun(source: PriceRunSource, detail: string): Promise<void> {
  try {
    await ensureSchema();
    await db.insert(priceCheckRuns).values({ source, status: "unauthorized", detail, finishedAt: new Date() });
  } catch (error) {
    console.error("Could not record rejected price run", error);
  }
}

/**
 * Runs the marketplace refresh and writes one log row around it. Used by the
 * cron route and by the "Check prices now" button, so both appear in the
 * back-office history in exactly the same way.
 */
export async function runLoggedRefresh(source: PriceRunSource) {
  await ensureSchema();
  const [run] = await db
    .insert(priceCheckRuns)
    .values({ source, status: "running" })
    .returning({ id: priceCheckRuns.id });

  try {
    const deadline = Date.now() + 100_000;
    const [settings, content] = await Promise.all([getSiteSettings(), getSiteContent()]);
    const inventory = content.commerce.autoSyncInventory || source === "manual"
      ? await synchronizeInventory(settings, { deadline: deadline - 12_000 }) : null;
    const ebayStoreUrl =
      process.env.EBAY_STORE_URL || settings.ebayUrl || "https://www.ebay.com/str/mederranic";
    if (inventory?.report.status === "running") {
      await db.update(priceCheckRuns).set({ status: "busy", detail: "Another inventory synchronization is already running.", finishedAt: new Date() }).where(eq(priceCheckRuns.id, run.id));
      return { results: [], checked: 0, changed: 0, ended: 0, inventory: inventory.report };
    }
    const report = await refreshMarketplacePrices(ebayStoreUrl, { deadline, hints: inventory?.hints });

    const failures = report.results.filter((row) => Boolean(row.error));
    const errors = Array.from(new Set(failures.map((row) => row.error!)));
    const incompleteInventory = inventory !== null && inventory.report.status !== "complete";
    const inventorySummary = inventory
      ? `Inventory ${inventory.report.status}: ${inventory.report.linked} relinked, ${inventory.report.created} imported, ${inventory.report.drafts} drafts, ${inventory.report.issues.length} identity/conflict warning(s). `
      : "Automatic inventory reconciliation is disabled. ";
    await db
      .update(priceCheckRuns)
      .set({
        status: failures.length === 0 && !incompleteInventory ? "ok" : report.checked > 0 && failures.length === report.checked ? "error" : "partial",
        checked: report.checked,
        changed: report.changed,
        ended: report.ended,
        detail: (inventorySummary + (failures.length ? `${failures.length} listing(s) not updated. ${errors.join(" ")}` : "Prices checked.")).slice(0, 2000),
        finishedAt: new Date(),
      })
      .where(eq(priceCheckRuns.id, run.id));

    return { ...report, inventory: inventory?.report ?? null };
  } catch (error) {
    await db
      .update(priceCheckRuns)
      .set({
        status: "error",
        detail: error instanceof Error ? error.message.slice(0, 300) : "Unknown error",
        finishedAt: new Date(),
      })
      .where(eq(priceCheckRuns.id, run.id));
    throw error;
  }
}

export async function getRecentPriceRuns(limit = 15): Promise<PriceRun[]> {
  await ensureSchema();
  const [current, legacy] = await Promise.all([
    db.select().from(priceCheckRuns).orderBy(desc(priceCheckRuns.createdAt)).limit(limit),
    db.select().from(priceRefreshRuns).orderBy(desc(priceRefreshRuns.ranAt)).limit(limit),
  ]);
  const oldRuns: PriceRun[] = legacy.map((run) => ({
    id: -run.id, source: run.source === "manual" ? "manual" : "vercel-cron",
    status: run.ok ? "ok" : "error", detail: run.summary,
    checked: run.checked, changed: run.changed, ended: run.ended,
    createdAt: run.ranAt, finishedAt: run.ranAt,
  }));
  return [...current, ...oldRuns].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
}
