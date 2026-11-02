import { recordRejectedRun, runLoggedRefresh, type PriceRunSource } from "@/lib/price-runs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Scheduled refresh.
 *
 * Two callers are supported:
 *  - the Vercel cron (vercel.json). Vercel sends `Authorization: Bearer <CRON_SECRET>`
 *    — but ONLY if the CRON_SECRET variable exists in the project. Without it the
 *    call arrives with no secret and is refused.
 *  - an external scheduler (cron-job.org), using ?secret=<CRON_SECRET>.
 *
 * Every call — accepted or refused — is written to the price-check log, which
 * the back-office shows under "Refresh marketplace prices".
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const fromVercel = /vercel-cron/i.test(request.headers.get("user-agent") ?? "");
  const source: PriceRunSource = fromVercel ? "vercel-cron" : "external";

  const secret = process.env.CRON_SECRET?.trim();
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    url.searchParams.get("secret")?.trim() ||
    "";

  if (!secret) {
    await recordRejectedRun(
      source,
      "CRON_SECRET is not set in Vercel → Settings → Environment Variables. The automatic check cannot run until it is.",
    );
    return Response.json({ error: "CRON_SECRET is not configured." }, { status: 401 });
  }
  if (provided !== secret) {
    await recordRejectedRun(
      source,
      provided ? "The secret sent does not match CRON_SECRET." : "Called without a secret.",
    );
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const report = await runLoggedRefresh(source);
    return Response.json(report);
  } catch (error) {
    console.error("Scheduled price refresh failed", error);
    return Response.json({ error: "Refresh failed." }, { status: 500 });
  }
}
