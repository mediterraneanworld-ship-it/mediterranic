import { randomUUID } from "node:crypto";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getOrderNotificationConfiguration, sendOrderNotificationTest } from "@/lib/order-notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  return Response.json(getOrderNotificationConfiguration(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await sendOrderNotificationTest(randomUUID());
  if (!result.sent) {
    const error = result.reason === "not_configured"
      ? `${result.detail} Add RESEND_API_KEY and RESEND_FROM_EMAIL to this Vercel environment, then redeploy.`
      : result.reason === "provider_rejected"
        ? `Resend rejected the test email${result.status ? ` (HTTP ${result.status})` : ""}: ${result.detail ?? "Check the sender domain and API key."}`
        : "Could not reach Resend. No order was created; try again in a moment.";
    return Response.json({ error }, { status: result.reason === "not_configured" ? 503 : 502 });
  }

  return Response.json({ ok: true, recipient: result.recipient, providerId: result.providerId });
}
