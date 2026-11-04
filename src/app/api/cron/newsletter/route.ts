import {
  getNewsletterCadence,
  getNewsletterSettings,
  sendNewsletter,
} from "@/lib/newsletter-send";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Daily check for the twice-a-month mailing.
 *
 * Sends only when BOTH hold:
 *  - automatic sending is switched on in the back-office (off by default —
 *    the mailing starts manual and the curator flips the switch when ready);
 *  - at least 15 days passed since the last delivered mailing.
 *
 * Protected by CRON_SECRET like the price refresh (Vercel cron sends the
 * Bearer header; an external scheduler can use ?secret=).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = process.env.CRON_SECRET?.trim();
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    url.searchParams.get("secret")?.trim() ||
    "";

  if (!secret || provided !== secret) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const settings = await getNewsletterSettings();
  if (!settings.autoEnabled) {
    return Response.json({ skipped: true, reason: "Automatic sending is off in the back-office." });
  }

  const cadence = await getNewsletterCadence();
  if (!cadence.due) {
    return Response.json({
      skipped: true,
      reason: `Last mailing ${cadence.daysSince} day(s) ago; the cadence is 15 days.`,
    });
  }

  try {
    const result = await sendNewsletter({ source: "cron" });
    return Response.json(result);
  } catch (error) {
    console.error("Scheduled newsletter failed", error);
    return Response.json({ error: "Newsletter send failed." }, { status: 500 });
  }
}
