import { isAdminAuthenticated } from "@/lib/admin-auth";
import { mailFromAddress, mailTransport, RESTRICTED_SENDER_HELP, usesRestrictedSender } from "@/lib/mailer";
import { orderNotificationRecipient } from "@/lib/order-email";
import { sendTestEmail } from "@/lib/order-notify";

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** GET reports the configuration; POST sends one test (optionally to any address). */
export async function GET() {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const transport = mailTransport();
  const restricted = usesRestrictedSender();
  return Response.json(
    {
      transport: transport ?? "none",
      recipient: orderNotificationRecipient(),
      from: mailFromAddress(),
      ready: Boolean(transport),
      customersReachable: Boolean(transport) && !restricted,
      warning: restricted ? RESTRICTED_SENDER_HELP : null,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { to?: unknown } | null;
  const requested = typeof body?.to === "string" ? body.to.trim().toLowerCase() : "";
  if (requested && !EMAIL.test(requested)) {
    return Response.json({ error: "Enter a valid e-mail address for the test." }, { status: 400 });
  }
  const result = await sendTestEmail(requested || undefined);
  const restricted = usesRestrictedSender();
  return Response.json(
    {
      ...result,
      recipient: result.to,
      from: mailFromAddress(),
      customersReachable: Boolean(mailTransport()) && !restricted,
      warning: restricted ? RESTRICTED_SENDER_HELP : null,
    },
    { status: result.status === "sent" ? 200 : 502, headers: { "Cache-Control": "private, no-store" } },
  );
}
