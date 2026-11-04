import { buildSosContext } from "@/lib/sos-context";
import { CODE_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

/** Public documentation only: no database reads and no credential values. */
export async function GET() {
  return new Response(buildSosContext(), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="MEDITERRANIC-SOS-${CODE_VERSION}.md"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
