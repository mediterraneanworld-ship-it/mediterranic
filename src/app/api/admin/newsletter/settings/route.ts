import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  getNewsletterCadence,
  getNewsletterSends,
  getNewsletterSettings,
  updateNewsletterSettings,
} from "@/lib/newsletter-send";

export const dynamic = "force-dynamic";

/** Mailing behaviour: automatic sending on/off and the manual piece override. */
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const [settings, cadence, sends] = await Promise.all([
    getNewsletterSettings(),
    getNewsletterCadence(),
    getNewsletterSends(20),
  ]);
  return Response.json({ settings, cadence, sends });
}

export async function PUT(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  let body: { autoEnabled?: unknown; pieceIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const patch: { autoEnabled?: boolean; pieceIds?: number[] } = {};
  if (typeof body.autoEnabled === "boolean") patch.autoEnabled = body.autoEnabled;
  if (Array.isArray(body.pieceIds)) {
    patch.pieceIds = body.pieceIds
      .filter((n): n is number => typeof n === "number" && Number.isInteger(n))
      .slice(0, 50);
  }
  const settings = await updateNewsletterSettings(patch);
  return Response.json({ ok: true, settings });
}
