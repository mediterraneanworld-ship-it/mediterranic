import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getRecentPriceRuns, runLoggedRefresh } from "@/lib/price-runs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Manual refresh, triggered from the back-office ("Check prices now"). */
export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const report = await runLoggedRefresh("manual");
    return Response.json(report);
  } catch (error) {
    console.error("Price refresh failed", error);
    return Response.json({ error: "Could not refresh prices." }, { status: 500 });
  }
}

/** History of automatic and manual checks, plus whether the cron is configured. */
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const runs = await getRecentPriceRuns(15);
  return Response.json({
    // Only a yes/no — the secret itself never leaves the server.
    cronSecretConfigured: Boolean(process.env.CRON_SECRET?.trim()),
    runs,
  });
}
