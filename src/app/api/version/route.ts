import { PUBLIC_SITE_URL } from "@/lib/site-url";
import { codeManifest } from "@/lib/version";

export const dynamic = "force-dynamic";

/**
 * Read-only build identity: confirms the whole ZIP was deployed. It also reports the
 * canonical shop address and whether CRON_SECRET is set (a boolean only, never the value).
 */
export async function GET() {
  return Response.json(
    {
      ...codeManifest(),
      siteUrl: PUBLIC_SITE_URL,
      cron: { secretConfigured: Boolean(process.env.CRON_SECRET?.trim()) },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
