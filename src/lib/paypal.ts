/**
 * PayPal integration through the official Orders v2 API (server-side only).
 *
 * Configure in the Vercel project (Settings → Environment Variables):
 *   PAYPAL_CLIENT_ID      — Client ID from developer.paypal.com (REST app)
 *   PAYPAL_CLIENT_SECRET  — Client Secret (never expose to the browser)
 *   PAYPAL_ENVIRONMENT    — "sandbox" (default) or "live"
 *   PAYPAL_MERCHANT_EMAIL — optional, shown for reference; the receiving
 *                           account is the one the keys belong to
 *                           (mediterranean.world@gmail.com)
 *
 * The receiving account is the PayPal account that owns the Client ID/Secret.
 * Use the keys from the Business account mediterranean.world@gmail.com:
 * developer.paypal.com → My Apps & Credentials → create a REST app there.
 */

function readPaypalClientId(): string {
  return (
    process.env.PAYPAL_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim() ||
    ""
  );
}

function readPaypalSecret(): string {
  return (
    process.env.PAYPAL_CLIENT_SECRET?.trim() ||
    process.env.PAYPAL_SECRET?.trim() ||
    ""
  );
}

export function isPaypalConfigured(): boolean {
  return Boolean(readPaypalClientId() && readPaypalSecret());
}

export function paypalEnvironment(): "sandbox" | "live" {
  const raw = (process.env.PAYPAL_ENVIRONMENT ?? process.env.PAYPAL_ENV ?? "").trim().toLowerCase();
  return raw === "live" || raw === "production" || raw === "prod" ? "live" : "sandbox";
}

function paypalApiBase(): string {
  return paypalEnvironment() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

type CachedToken = { token: string; expiresAt: number; clientId: string; environment: string };
const globalForPaypal = globalThis as typeof globalThis & { __paypalToken?: CachedToken };

export class PaypalNotConfiguredError extends Error {
  constructor() {
    super("PAYPAL_NOT_CONFIGURED");
  }
}

type PaypalErrorBody = { name?: string; message?: string; details?: { description?: string }[] };

/**
 * PayPal error bodies never contain our credentials — only its own
 * diagnostics (status, error name like "invalid_client", description).
 * Surfacing them is safe and is the only way to tell a wrong-environment
 * configuration (sandbox API + live keys) from a real outage.
 */
export function describePaypalError(status: number, text: string): string {
  let body: PaypalErrorBody = {};
  try {
    body = JSON.parse(text) as PaypalErrorBody;
  } catch {
    body = {};
  }
  const name = body.name ? ` (${body.name})` : "";
  const detail = String(body.details?.[0]?.description ?? body.message ?? text ?? "").replace(/\s+/g, " ").trim();
  return `PayPal ${status}${name}: ${detail.slice(0, 220) || "no detail returned"}`;
}

/** Display-safe message for a PayPal failure; network faults stay generic. */
export function paypalErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    const message = error.message.slice(0, 300);
    // A message already described by describePaypalError, or a token failure.
    if (/^PayPal \d+/.test(message) || /token failed/i.test(message)) return message;
    return "Could not reach PayPal. Please try again.";
  }
  return "Could not reach PayPal. Please try again.";
}

async function getAccessToken(): Promise<string> {
  if (!isPaypalConfigured()) throw new PaypalNotConfiguredError();

  const cached = globalForPaypal.__paypalToken;
  if (cached && cached.clientId === readPaypalClientId() && cached.environment === paypalEnvironment() && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const basic = Buffer.from(
    `${readPaypalClientId()}:${readPaypalSecret()}`,
  ).toString("base64");

  const res = await fetch(`${paypalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(describePaypalError(res.status, detail) + " (token request)");
  }

  const data = (await res.json()) as { access_token: string; expires_in?: number };
  globalForPaypal.__paypalToken = {
    token: data.access_token,
    clientId: readPaypalClientId(), environment: paypalEnvironment(),
    expiresAt: Date.now() + Math.max(60, data.expires_in ?? 32_400) * 1_000,
  };
  return data.access_token;
}

async function paypalRequest<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  requestId?: string,
): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${paypalApiBase()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });

  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(describePaypalError(res.status, text));
  }
  return data as T;
}

export type PaypalOrderLink = { rel: string; href: string };

export type PaypalCreatedOrder = {
  id: string;
  status: string;
  links: PaypalOrderLink[];
};

/**
 * Creates a PayPal order for `totalCents` EUR. `returnUrl` / `cancelUrl` must
 * be absolute URLs on our own site; PayPal appends `?token=<orderId>`.
 */
export async function createPaypalOrder(input: {
  totalCents: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  referenceId: string;
}): Promise<PaypalCreatedOrder> {
  const value = (input.totalCents / 100).toFixed(2);
  return paypalRequest<PaypalCreatedOrder>("POST", "/v2/checkout/orders", {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: input.referenceId,
        description: input.description.slice(0, 127),
        invoice_id: input.referenceId.slice(0, 127),
        amount: { currency_code: "EUR", value },
        items: undefined,
      },
    ],
    application_context: {
      brand_name: "Mediterranic",
      landing_page: "NO_PREFERENCE",
      user_action: "PAY_NOW",
      return_url: input.returnUrl,
      cancel_url: input.cancelUrl,
    },
  }, `create-${input.referenceId}`);
}

export type PaypalCapture = {
  id: string;
  status: string;
  purchase_units?: {
    reference_id?: string;
    amount?: { value: string; currency_code: string };
    payments?: {
      captures?: { id: string; status: string; amount?: { value: string; currency_code: string } }[];
    };
  }[];
};

export function capturePaypalOrder(orderId: string): Promise<PaypalCapture> {
  return paypalRequest<PaypalCapture>("POST", `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {}, `capture-${orderId}`);
}

export function getPaypalOrder(orderId: string): Promise<PaypalCapture> {
  return paypalRequest<PaypalCapture>("GET", `/v2/checkout/orders/${encodeURIComponent(orderId)}`);
}
