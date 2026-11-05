import cover from "@/assets/connoisseur-cyphaspis-glass.jpg";
import { CONNOISSEUR_COVER_PATH } from "@/lib/connoisseur-cover-path";

export const dynamic = "force-dynamic";

/**
 * Stable address of The Connoisseur cover. The image is bundled with the code
 * (src/assets), so it arrives with every deployment and never depends on public/.
 * The route redirects to the bundled copy, so a path saved in the back-office
 * keeps working after each future deployment.
 */
export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const expected = CONNOISSEUR_COVER_PATH.split("/").pop();
  if (file !== expected) return new Response("Not found", { status: 404 });
  return new Response(null, {
    status: 307,
    headers: {
      Location: new URL(cover.src, request.url).toString(),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
