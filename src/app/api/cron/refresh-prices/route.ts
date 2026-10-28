import { refreshMarketplacePrices } from "@/lib/refresh-prices";
import { getSiteSettings } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Scheduled refresh. Called by the hosting platform's cron (see vercel.json).
 * Protected by CRON_SECRET so it cannot be triggered by strangers.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    new URL(request.url).searchParams.get("secret");

  if (!secret || provided !== secret) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const settings = await getSiteSettings();
  const ebayStoreUrl =
    process.env.EBAY_STORE_URL || settings.ebayUrl || "https://www.ebay.com/str/mederranic";

  try {
    const report = await refreshMarketplacePrices(ebayStoreUrl);
    return Response.json(report);
  } catch (error) {
    console.error("Scheduled price refresh failed", error);
    return Response.json({ error: "Refresh failed." }, { status: 500 });
  }
}
