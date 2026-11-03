import { codeManifest } from "@/lib/version";

export const dynamic = "force-dynamic";

/** Read-only build identity: confirms the whole ZIP was deployed. */
export async function GET() {
  return Response.json(codeManifest(), { headers: { "Cache-Control": "no-store" } });
}
