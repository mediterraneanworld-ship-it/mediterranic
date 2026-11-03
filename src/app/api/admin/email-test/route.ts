import { isAdminAuthenticated } from "@/lib/admin-auth";
import { mailTransport, orderEmailFrom, orderNotificationRecipient } from "@/lib/order-email";
import { sendTestEmail } from "@/lib/order-notify";

export const dynamic = "force-dynamic";

/** GET reports the configuration; POST actually sends one test message. */
export async function GET() {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const transport = mailTransport();
  return Response.json(
    {
      transport: transport ?? "none",
      recipient: orderNotificationRecipient(),
      from: orderEmailFrom(),
      ready: Boolean(transport),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST() {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const result = await sendTestEmail();
  return Response.json(
    { ...result, recipient: orderNotificationRecipient(), from: orderEmailFrom() },
    { status: result.status === "sent" ? 200 : 502, headers: { "Cache-Control": "private, no-store" } },
  );
}
