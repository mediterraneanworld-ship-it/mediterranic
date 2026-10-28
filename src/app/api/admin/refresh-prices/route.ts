import { isAdminAuthenticated } from "@/lib/admin-auth";
import { refreshMarketplacePrices } from "@/lib/refresh-prices";
import { getSiteSettings } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Manual refresh, triggered from the back-office. */
export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const settings = await getSiteSettings();
  const ebayStoreUrl =
    process.env.EBAY_STORE_URL || settings.ebayUrl || "https://www.ebay.com/str/mederranic";

  try {
    const report = await refreshMarketplacePrices(ebayStoreUrl);
    return Response.json(report);
  } catch (error) {
    console.error("Price refresh failed", error);
    return Response.json({ error: "Could not refresh prices." }, { status: 500 });
  }
}
