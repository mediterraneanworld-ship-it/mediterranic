import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getAllProducts, getSiteContent, getSiteSettings } from "@/lib/catalog";
import { ebayMarketplace, hasEbayCredentials } from "@/lib/ebay";
import { getInventorySyncReport } from "@/lib/inventory-sync";
import { describeCatawikiMarketplace, describeEbayMarketplace, inventoryCounts } from "@/lib/inventory-rules";
import { runLoggedRefresh } from "@/lib/price-runs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const [report, content, settings, specimens] = await Promise.all([
    getInventorySyncReport(),
    getSiteContent(),
    getSiteSettings(),
    getAllProducts({ includeDrafts: true }),
  ]);
  return Response.json({
    report,
    counts: inventoryCounts(specimens),
    marketplaces: {
      ebay: describeEbayMarketplace(ebayMarketplace()).label,
      catawiki: describeCatawikiMarketplace(settings.catawikiUrl).label,
    },
    automaticEnabled: content.commerce.autoSyncInventory,
    automaticOnOpen: Boolean(process.env.VERCEL && hasEbayCredentials() && content.commerce.autoSyncInventory),
    ebayConfigured: hasEbayCredentials(),
    cronConfigured: Boolean(process.env.CRON_SECRET?.trim()),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST() {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401 });
  try { return Response.json(await runLoggedRefresh("manual"), { headers: { "Cache-Control": "private, no-store" } }); }
  catch { return Response.json({ error: "Synchronization could not finish. Check the inventory status and run log; unreadable items were not guessed." }, { status: 502 }); }
}
