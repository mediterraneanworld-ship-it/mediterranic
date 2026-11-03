import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  paypalConfigSummary,
  paypalConfiguredEnvironment,
  testPaypalToken,
  type PaypalEnvironment,
} from "@/lib/paypal";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const noStore = { "Cache-Control": "private, no-store" };

/** Configuration only. Secrets never leave the server. */
export async function GET() {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401 });
  return Response.json(paypalConfigSummary(), { headers: noStore });
}

/**
 * Real PayPal diagnosis: asks PayPal for a client-credentials token in the
 * environment the shop would use, and — when the credentials are rejected
 * there — in the other one too. This distinguishes a sandbox/live mix-up from
 * a mistyped key without creating orders or moving money.
 */
export async function POST() {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const summary = paypalConfigSummary();

  if (!summary.configured) {
    return Response.json({
      ...summary,
      ok: false,
      probes: [],
      diagnosis:
        "PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET (or PAYPAL_SECRET) are not both set on THIS deployment. " +
        "Keys saved in Vercel only apply to the environments they were saved for — a development sandbox or a " +
        "Preview deployment does not inherit the Production variables.",
    }, { headers: noStore });
  }

  const pinned = paypalConfiguredEnvironment();
  const preferred: PaypalEnvironment = pinned ?? "sandbox";
  const other: PaypalEnvironment = preferred === "sandbox" ? "live" : "sandbox";

  const probes: { environment: PaypalEnvironment; ok: boolean; status?: number; paypalName?: string | null; message?: string }[] = [];
  const first = await testPaypalToken(preferred);
  probes.push({ environment: preferred, ...first });
  if (!first.ok) {
    const second = await testPaypalToken(other);
    probes.push({ environment: other, ...second });
  }

  const working = probes.find((probe) => probe.ok);
  const checkoutReady = pinned ? probes[0].ok : Boolean(working);

  let diagnosis: string;
  if (working && probes[0].ok && pinned) {
    diagnosis =
      `PayPal accepted the shop credentials in the pinned ${pinned} environment. Checkout can start payments; ` +
      `if a payment still fails, the cause is on the order or the buyer's side (the checkout error names it).`;
  } else if (working && probes[0].ok && !pinned) {
    diagnosis =
      `No PAYPAL_ENVIRONMENT is set. Checkout auto-detected the ${working.environment} environment — these are ` +
      `${working.environment} keys. Payments will work, but pin it with PAYPAL_ENVIRONMENT=${working.environment} ` +
      `in Vercel (Production) and redeploy so the setting is explicit.`;
  } else if (working && !probes[0].ok && pinned) {
    diagnosis =
      `The credentials are valid in ${other.toUpperCase()}, but the shop is pinned to ${pinned.toUpperCase()}, so ` +
      `checkout keeps failing with invalid_client. Either set PAYPAL_ENVIRONMENT=${other} in Vercel and redeploy, ` +
      `or replace the keys with ${pinned} ones from the same REST app (Sandbox and Live are separate tabs/apps on ` +
      `developer.paypal.com). Nothing was charged by this test.`;
  } else if (working && !probes[0].ok && !pinned) {
    diagnosis =
      `No PAYPAL_ENVIRONMENT is set, and these are ${other.toUpperCase()} keys: checkout auto-detects that ` +
      `environment, so payments will work. Pin it with PAYPAL_ENVIRONMENT=${other} in Vercel and redeploy to make ` +
      `it explicit.`;
  } else {
    diagnosis =
      `PayPal rejected the credentials in BOTH environments (invalid_client). Copy the Client ID and the Secret ` +
      `again from the SAME REST app on developer.paypal.com — Sandbox and Live have separate apps and separate ` +
      `secrets — check for stray spaces, save in Vercel (Production) and redeploy. This test created no order and ` +
      `no charge.`;
  }

  return Response.json(
    { ...paypalConfigSummary(), ok: checkoutReady, probes, diagnosis },
    { headers: noStore },
  );
}
