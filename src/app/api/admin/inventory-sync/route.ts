import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getSiteContent } from "@/lib/catalog";
import { hasEbayCredentials } from "@/lib/ebay";
import { getInventorySyncReport } from "@/lib/inventory-sync";
import { inventoryCounts } from "@/lib/inventory-rules";
import { getAllProducts } from "@/lib/catalog";
import { runLoggedRefresh } from "@/lib/price-runs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const [report, content, specimens] = await Promise.all([getInventorySyncReport(), getSiteContent(), getAllProducts({ includeDrafts: true })]);
  return Response.json({ report, counts: inventoryCounts(specimens),
    automaticEnabled: content.commerce.autoSyncInventory,
    automaticOnOpen: Boolean(process.env.VERCEL && hasEbayCredentials() && content.commerce.autoSyncInventory),
    ebayConfigured: hasEbayCredentials(), cronConfigured: Boolean(process.env.CRON_SECRET?.trim()),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST() {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401 });
  try { return Response.json(await runLoggedRefresh("manual"), { headers: { "Cache-Control": "private, no-store" } }); }
  catch { return Response.json({ error: "Synchronization could not finish. Check the inventory status and run log; unreadable items were not guessed." }, { status: 502 }); }
}
