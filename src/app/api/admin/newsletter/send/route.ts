import { isAdminAuthenticated } from "@/lib/admin-auth";
import { sendNewsletter } from "@/lib/newsletter-send";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Manual send from the back-office ("Send now"). The 15-day cadence is a
 *  guard, not a wall: the first attempt inside the window is refused with
 *  the days remaining, and the admin can confirm with `force: true`. */
export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  let body: { subject?: unknown; pieceIds?: unknown; force?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 120) : undefined;
  const pieceIds = Array.isArray(body.pieceIds)
    ? body.pieceIds.filter((n): n is number => typeof n === "number" && Number.isInteger(n)).slice(0, 50)
    : undefined;
  const force = body.force === true;

  try {
    const result = await sendNewsletter({ source: "manual", subject, pieceIds, force });
    if (!result.ok) {
      const status = result.reason === "cadence" ? 409 : result.reason === "not-configured" ? 503 : 422;
      return Response.json(result, { status });
    }
    return Response.json(result);
  } catch (error) {
    console.error("newsletter send failed", error);
    return Response.json({ error: "The mailing could not be sent. Nothing was changed." }, { status: 500 });
  }
}
