import { buildOrder, insertOrder, markOrderStatus, OrderError, parseOrderInput } from "@/lib/order-service";
import { createPaypalOrder, isPaypalConfigured, paypalEnvironment, paypalErrorMessage, PaypalNotConfiguredError } from "@/lib/paypal";
import { PUBLIC_SITE_URL } from "@/lib/site-url";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function siteBase(request: Request): string {
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.trim();
  if (host) {
    const scheme = proto || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${scheme}://${host}`.replace(/\/$/, "");
  }
  return PUBLIC_SITE_URL;
}

/**
 * Creates our pending order (priced server-side from the database) and a
 * matching PayPal order, then returns the PayPal approval URL. The buyer is
 * sent there; PayPal returns them to /checkout?paypal=return&order=<id>.
 */
export async function POST(request: Request) {
  if (!isPaypalConfigured()) {
    return Response.json(
      {
        error:
          "PayPal is not configured yet. Set PAYPAL_CLIENT_ID, PAYPAL_SECRET (or PAYPAL_CLIENT_SECRET) and PAYPAL_ENV in the Vercel environment variables.",
        code: "PAYPAL_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  let input;
  try {
    input = parseOrderInput(body);
  } catch (error) {
    if (error instanceof OrderError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  try {
    const built = await buildOrder(input);
    const orderId = await insertOrder(input, built, {
      status: "pending_payment",
      paymentMethod: "paypal",
    });

    const base = siteBase(request);
    const description = `Mediterranic — ${built.lines.length} specimen(s)`;
    const paypalOrder = await createPaypalOrder({
      totalCents: built.totalCents,
      description,
      referenceId: orderId,
      returnUrl: `${base}/checkout?paypal=return&order=${orderId}`,
      cancelUrl: `${base}/checkout?paypal=cancel&order=${orderId}`,
    });

    await markOrderStatus(orderId, "pending_payment", paypalOrder.id);

    const approve = paypalOrder.links.find((l) => l.rel === "approve");
    if (!approve) {
      return Response.json({ error: "PayPal did not return an approval link." }, { status: 502 });
    }

    return Response.json({ orderId, paypalOrderId: paypalOrder.id, approveUrl: approve.href });
  } catch (error) {
    if (error instanceof PaypalNotConfiguredError) {
      return Response.json({ error: "PayPal is not configured.", code: "PAYPAL_NOT_CONFIGURED" }, { status: 503 });
    }
    if (error instanceof OrderError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("PayPal create-order failed", error);
    // Surface the real PayPal diagnostic (safe: no credentials are ever
    // included) so a wrong-environment setup is visible instead of a generic
    // "try again" that hides the cause.
    const detail = paypalErrorMessage(error);
    const env = paypalEnvironment();
    return Response.json(
      {
        error:
          `Could not start the PayPal payment. ${detail} ` +
          `(Shop is calling the ${env === "live" ? "live" : "sandbox"} PayPal API — ` +
          `if your keys are live/sandbox keys, set PAYPAL_ENV accordingly in the Vercel environment variables.)`,
        code: "PAYPAL_CREATE_FAILED",
      },
      { status: 502 },
    );
  }
}
