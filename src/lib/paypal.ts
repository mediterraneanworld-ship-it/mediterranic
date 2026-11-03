/**
 * PayPal integration through the official Orders v2 API (server-side only).
 *
 * Configure in the Vercel project (Settings → Environment Variables):
 *   PAYPAL_CLIENT_ID      — Client ID from developer.paypal.com (REST app)
 *   PAYPAL_CLIENT_SECRET  — Client Secret (never expose to the browser);
 *                           PAYPAL_SECRET is accepted as an alias
 *   PAYPAL_ENVIRONMENT    — "sandbox" or "live" (alias PAYPAL_ENV). When
 *                           unset, the environment is detected from the
 *                           credentials themselves (see resolveEnvironment)
 *   PAYPAL_MERCHANT_EMAIL — optional, shown for reference; the receiving
 *                           account is the one the keys belong to
 *                           (mediterranean.world@gmail.com)
 *
 * If checkout answers "Could not start the PayPal payment", run
 * Admin → "Diagnose PayPal API" — it pinpoints the failing step.
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

export type PaypalEnvironment = "sandbox" | "live";

/** Environment explicitly pinned by the merchant (PAYPAL_ENVIRONMENT / PAYPAL_ENV), or null. */
export function paypalConfiguredEnvironment(): PaypalEnvironment | null {
  const raw = (process.env.PAYPAL_ENVIRONMENT ?? process.env.PAYPAL_ENV ?? "").trim().toLowerCase();
  if (raw === "live" || raw === "production" || raw === "prod") return "live";
  if (raw === "sandbox" || raw === "test") return "sandbox";
  return null;
}

/**
 * Effective environment: the pinned one when set; otherwise the environment
 * the credentials provably belong to (PayPal itself rejects them in the other
 * one, so detection can never move real money by accident). "sandbox" until
 * either is known.
 */
export function paypalEnvironment(): PaypalEnvironment {
  return paypalConfiguredEnvironment() ?? resolvedEnvironmentOf() ?? "sandbox";
}

function paypalApiBaseFor(environment: PaypalEnvironment): string {
  return environment === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

export function paypalApiBase(): string {
  return paypalApiBaseFor(paypalEnvironment());
}

type CachedToken = { token: string; expiresAt: number; clientId: string; environment: PaypalEnvironment };
const globalForPaypal = globalThis as typeof globalThis & {
  __paypalToken?: CachedToken;
  __paypalEnv?: { clientId: string; environment: PaypalEnvironment };
};

function resolvedEnvironmentOf(): PaypalEnvironment | null {
  const cached = globalForPaypal.__paypalEnv;
  return cached && cached.clientId === readPaypalClientId() ? cached.environment : null;
}

export class PaypalNotConfiguredError extends Error {
  constructor() {
    super("PAYPAL_NOT_CONFIGURED");
  }
}

/**
 * A PayPal failure with everything the back-office diagnosis may show: our
 * stable code, the HTTP status and PayPal's own error name/issue. Messages
 * never contain credentials.
 */
export class PaypalApiError extends Error {
  readonly code: "PAYPAL_AUTH_FAILED" | "PAYPAL_ORDER_REJECTED" | "PAYPAL_UNAVAILABLE";
  constructor(
    message: string,
    code: PaypalApiError["code"],
    readonly status = 0,
    readonly paypalName: string | null = null,
  ) {
    super(message);
    this.name = "PaypalApiError";
    this.code = code;
  }
}

/** Buyer-safe sentence per failure class; the precise cause stays in `detail`/admin. */
export function paypalErrorMessage(error: unknown): string {
  if (error instanceof PaypalNotConfiguredError) {
    return "Online payment is not enabled yet — please use the button below to place the order by invoice.";
  }
  if (error instanceof PaypalApiError) {
    if (error.code === "PAYPAL_AUTH_FAILED") {
      return "PayPal is unavailable in this shop right now. No charge was made — please place the order by invoice below, or contact us.";
    }
    if (error.code === "PAYPAL_ORDER_REJECTED") {
      return "PayPal declined to start this payment. No charge was made — please try again, or place the order by invoice below.";
    }
    return "Could not reach PayPal just now. No charge was made — please try again, or place the order by invoice below.";
  }
  return "Could not start the PayPal payment. Please try again.";
}

/** Requests (and caches) a client-credentials token in ONE explicit environment. */
async function fetchToken(environment: PaypalEnvironment): Promise<string> {
  const clientId = readPaypalClientId();
  const cached = globalForPaypal.__paypalToken;
  if (cached && cached.clientId === clientId && cached.environment === environment && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const basic = Buffer.from(`${clientId}:${readPaypalSecret()}`).toString("base64");

  let res: Response;
  try {
    res = await fetch(`${paypalApiBaseFor(environment)}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new PaypalApiError(`Could not reach the PayPal ${environment} API to request a token.`, "PAYPAL_UNAVAILABLE");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let paypalName: string | null = null;
    try {
      paypalName = (JSON.parse(text) as { error?: string }).error ?? null;
    } catch {
      /* non-JSON error body: keep the name null */
    }
    if (res.status === 401 || paypalName === "invalid_client") {
      throw new PaypalApiError(
        `PayPal rejected the shop credentials in the ${environment} environment (${paypalName ?? "invalid_client"}, HTTP ${res.status}).`,
        "PAYPAL_AUTH_FAILED",
        res.status,
        paypalName ?? "invalid_client",
      );
    }
    throw new PaypalApiError(
      `PayPal token request failed in the ${environment} environment (HTTP ${res.status}).`,
      "PAYPAL_UNAVAILABLE",
      res.status,
      paypalName,
    );
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new PaypalApiError(`PayPal returned no access token in the ${environment} environment.`, "PAYPAL_UNAVAILABLE", res.status);
  }
  globalForPaypal.__paypalToken = {
    token: data.access_token,
    clientId,
    environment,
    expiresAt: Date.now() + Math.max(60, data.expires_in ?? 32_400) * 1_000,
  };
  return data.access_token;
}

/**
 * Resolves the environment the stored credentials belong to. A pinned
 * PAYPAL_ENVIRONMENT is used strictly. Without one, sandbox is tried first
 * and — only when PayPal itself rejects the credentials there as invalid —
 * live is tried. Credentials can never mint tokens in the wrong environment,
 * so this cannot take a real payment by accident; it only removes the classic
 * "live keys against the sandbox default" failure.
 */
async function resolveEnvironment(): Promise<PaypalEnvironment> {
  const explicit = paypalConfiguredEnvironment();
  if (explicit) return explicit;
  const cached = resolvedEnvironmentOf();
  if (cached) return cached;
  const clientId = readPaypalClientId();
  try {
    await fetchToken("sandbox");
    globalForPaypal.__paypalEnv = { clientId, environment: "sandbox" };
    return "sandbox";
  } catch (error) {
    if (!(error instanceof PaypalApiError) || error.code !== "PAYPAL_AUTH_FAILED") throw error;
  }
  try {
    await fetchToken("live");
  } catch (error) {
    if (error instanceof PaypalApiError && error.code === "PAYPAL_AUTH_FAILED") {
      throw new PaypalApiError(
        "PayPal rejected the shop credentials in both the sandbox and live environments (invalid_client). The Client ID and Secret most likely do not come from the same REST app.",
        "PAYPAL_AUTH_FAILED",
        error.status,
        error.paypalName,
      );
    }
    throw error;
  }
  globalForPaypal.__paypalEnv = { clientId, environment: "live" };
  return "live";
}

async function getAccessToken(): Promise<string> {
  if (!isPaypalConfigured()) throw new PaypalNotConfiguredError();
  return fetchToken(await resolveEnvironment());
}

async function paypalRequest<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  requestId?: string,
): Promise<T> {
  const token = await getAccessToken();
  const environment = paypalEnvironment();
  let res: Response;
  try {
    res = await fetch(`${paypalApiBaseFor(environment)}${path}`, {
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
  } catch {
    throw new PaypalApiError(`Could not reach the PayPal ${environment} API.`, "PAYPAL_UNAVAILABLE");
  }

  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const body = data as {
      name?: string;
      message?: string;
      details?: { issue?: string; description?: string }[];
      debug_id?: string;
    };
    const issue = body.details?.[0]?.issue;
    const description = body.details?.[0]?.description ?? body.message;
    const paypalName = [body.name, issue].filter(Boolean).join(" / ") || null;
    throw new PaypalApiError(
      `PayPal rejected the request${paypalName ? ` (${paypalName})` : ""} (HTTP ${res.status})${description ? `: ${description}` : ""}${body.debug_id ? ` [debug_id ${body.debug_id}]` : ""}`,
      res.status === 401 || res.status === 403 ? "PAYPAL_AUTH_FAILED" : "PAYPAL_ORDER_REJECTED",
      res.status,
      paypalName,
    );
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

/* ------------------------------------------------------------------ */
/* Back-office diagnosis (no secrets ever leave the server)            */
/* ------------------------------------------------------------------ */

function clientIdSource(): string | null {
  if (process.env.PAYPAL_CLIENT_ID?.trim()) return "PAYPAL_CLIENT_ID";
  if (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim()) return "NEXT_PUBLIC_PAYPAL_CLIENT_ID";
  return null;
}

function secretSource(): string | null {
  if (process.env.PAYPAL_CLIENT_SECRET?.trim()) return "PAYPAL_CLIENT_SECRET";
  if (process.env.PAYPAL_SECRET?.trim()) return "PAYPAL_SECRET";
  return null;
}

export type PaypalConfigSummary = {
  configured: boolean;
  explicitEnvironment: PaypalEnvironment | null;
  resolvedEnvironment: PaypalEnvironment | null;
  clientIdTail: string | null;
  clientIdSource: string | null;
  secretSource: string | null;
};

export function paypalConfigSummary(): PaypalConfigSummary {
  const clientId = readPaypalClientId();
  return {
    configured: isPaypalConfigured(),
    explicitEnvironment: paypalConfiguredEnvironment(),
    resolvedEnvironment: resolvedEnvironmentOf(),
    clientIdTail: clientId ? clientId.slice(-4) : null,
    clientIdSource: clientIdSource(),
    secretSource: secretSource(),
  };
}

/**
 * Diagnosis probe: asks PayPal for a client-credentials token in ONE explicit
 * environment and reports the verdict. Creates no order and moves no money.
 */
export async function testPaypalToken(
  environment: PaypalEnvironment,
): Promise<{ ok: boolean; status?: number; paypalName?: string | null; message?: string }> {
  if (!isPaypalConfigured()) {
    return { ok: false, message: "PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set on this deployment." };
  }
  try {
    await fetchToken(environment);
    return { ok: true };
  } catch (error) {
    if (error instanceof PaypalApiError) {
      return { ok: false, status: error.status || undefined, paypalName: error.paypalName, message: error.message };
    }
    return { ok: false, message: "Could not reach PayPal." };
  }
}
