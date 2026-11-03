/** Server-side owner notification for newly placed orders. */

const DEFAULT_OWNER_EMAIL = "mediterranean.world@gmail.com";
const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type OrderNotificationInput = {
  order: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    country: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    postalCode: string;
    shippingMethod: string;
    subtotalCents: number;
    shippingCents: number;
    totalCents: number;
    status: string;
    paymentMethod: string;
    paypalOrderId?: string | null;
  };
  items: {
    productName: string;
    productSlug: string;
    unitPriceCents: number;
    quantity: number;
  }[];
  siteUrl?: string;
};

export type OrderNotificationResult =
  | { sent: true; providerId: string | null; recipient: string }
  | { sent: false; reason: "not_configured" | "provider_rejected" | "network_error"; status?: number; detail?: string };

const price = (cents: number) => `€${(cents / 100).toFixed(2)}`;
const reference = (id: string) => `MED-${id.slice(0, 8).toUpperCase()}`;
const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

/**
 * Sends an order notice to the shop owner through Resend. It never throws into
 * checkout: order placement is authoritative, while delivery failures are
 * reported to server logs with no secrets or buyer data. Retries of the same
 * order use Resend's idempotency key and cannot send a duplicate within 24h.
 */
export async function sendNewOrderNotification(input: OrderNotificationInput): Promise<OrderNotificationResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const to = process.env.ORDER_NOTIFICATION_EMAIL?.trim() || DEFAULT_OWNER_EMAIL;
  if (!apiKey || !from) {
    return {
      sent: false,
      reason: "not_configured",
      detail: !apiKey ? "RESEND_API_KEY is missing." : "RESEND_FROM_EMAIL is missing.",
    };
  }

  const { order, items } = input;
  const orderRef = reference(order.id);
  const payment = order.paymentMethod === "paypal"
    ? "PayPal — awaiting buyer approval"
    : "Invoice / alternative payment method";
  const siteUrl = (input.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://mediterranic.vercel.app").replace(/\/$/, "");
  const address = [order.addressLine1, order.addressLine2, `${order.postalCode} ${order.city}`, order.country]
    .filter(Boolean)
    .join(", ");
  const itemRows = items.map((item) =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #e7e1d6">${escapeHtml(item.quantity)} × ${escapeHtml(item.productName)} <span style="color:#64717a">(${escapeHtml(item.productSlug)})</span></td><td style="padding:8px 12px;border-bottom:1px solid #e7e1d6;text-align:right">${price(item.unitPriceCents * item.quantity)}</td></tr>`,
  ).join("");

  const html = `<!doctype html><html><body style="margin:0;background:#f5f1e8;font-family:Arial,sans-serif;color:#172c38"><main style="max-width:680px;margin:24px auto;padding:28px;background:#fff;border:1px solid #e7e1d6"><p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#aa8537">New Mediterranic order</p><h1 style="font-size:26px;margin:8px 0">${escapeHtml(orderRef)}</h1><p style="margin:0 0 20px">${escapeHtml(payment)} · <strong>${escapeHtml(order.status)}</strong></p><h2 style="font-size:17px">Customer</h2><p>${escapeHtml(order.firstName)} ${escapeHtml(order.lastName)}<br><a href="mailto:${escapeHtml(order.email)}">${escapeHtml(order.email)}</a>${order.phone ? `<br>${escapeHtml(order.phone)}` : ""}</p><h2 style="font-size:17px">Delivery address</h2><p>${escapeHtml(address)}</p><h2 style="font-size:17px">Items</h2><table style="width:100%;border-collapse:collapse">${itemRows}</table><table style="width:100%;margin-top:12px"><tr><td>Subtotal</td><td style="text-align:right">${price(order.subtotalCents)}</td></tr><tr><td>Shipping (${escapeHtml(order.shippingMethod)})</td><td style="text-align:right">${price(order.shippingCents)}</td></tr><tr><td style="padding-top:10px;font-size:18px"><strong>Total</strong></td><td style="padding-top:10px;text-align:right;font-size:18px"><strong>${price(order.totalCents)}</strong></td></tr></table>${order.paypalOrderId ? `<p style="margin-top:18px;color:#64717a">PayPal order: ${escapeHtml(order.paypalOrderId)}</p>` : ""}<p style="margin-top:24px"><a href="${escapeHtml(siteUrl)}/admin" style="display:inline-block;padding:12px 18px;background:#172c38;color:#fff;text-decoration:none;border-radius:24px">Open Mediterranic admin</a></p></main></body></html>`;
  const text = [
    `New Mediterranic order ${orderRef}`,
    `Status: ${order.status}`,
    `Payment: ${payment}`,
    `Customer: ${order.firstName} ${order.lastName}`,
    `Email: ${order.email}`,
    ...(order.phone ? [`Phone: ${order.phone}`] : []),
    `Delivery: ${address}`,
    "Items:",
    ...items.map((item) => `- ${item.quantity} x ${item.productName} (${item.productSlug}) — ${price(item.unitPriceCents * item.quantity)}`),
    `Subtotal: ${price(order.subtotalCents)}`,
    `Shipping (${order.shippingMethod}): ${price(order.shippingCents)}`,
    `Total: ${price(order.totalCents)}`,
    ...(order.paypalOrderId ? [`PayPal order: ${order.paypalOrderId}`] : []),
    `Admin: ${siteUrl}/admin`,
  ].join("\n");

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `mediterranic-order-${order.id}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `New order ${orderRef} — ${price(order.totalCents)}`,
        html,
        text,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const body = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string };
    if (!response.ok) {
      return {
        sent: false,
        reason: "provider_rejected",
        status: response.status,
        detail: body.message || body.name || "Resend rejected the notification.",
      };
    }
    return { sent: true, providerId: body.id ?? null, recipient: to };
  } catch {
    return { sent: false, reason: "network_error", detail: "Could not reach the email provider." };
  }
}

/** Sends a clearly labelled test message without creating or touching an order. */
export async function sendOrderNotificationTest(idempotencyKey: string): Promise<OrderNotificationResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const to = process.env.ORDER_NOTIFICATION_EMAIL?.trim() || DEFAULT_OWNER_EMAIL;
  if (!apiKey || !from) {
    return {
      sent: false,
      reason: "not_configured",
      detail: !apiKey ? "RESEND_API_KEY is missing." : "RESEND_FROM_EMAIL is missing.",
    };
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://mediterranic.vercel.app").replace(/\/$/, "");
  const text = [
    "TEST EMAIL — Mediterranic order notifications",
    "This is a test message. No order has been created and no stock or payment was changed.",
    `Recipient: ${to}`,
    `Admin: ${siteUrl}/admin`,
  ].join("\n");
  const html = `<main style="max-width:600px;margin:24px auto;padding:28px;background:#fff;border:1px solid #e7e1d6;font-family:Arial,sans-serif;color:#172c38"><p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#aa8537">Mediterranic · test</p><h1 style="font-size:24px">Order notification is connected</h1><p>This is a test message. <strong>No order has been created</strong> and no stock or payment was changed.</p><p>Future new invoice and PayPal orders will send an alert to ${escapeHtml(to)}.</p><p><a href="${escapeHtml(siteUrl)}/admin">Open Mediterranic admin</a></p></main>`;

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `mediterranic-order-email-test-${idempotencyKey}`,
      },
      body: JSON.stringify({ from, to: [to], subject: "TEST — Mediterranic order notifications", html, text }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const body = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string };
    if (!response.ok) {
      return { sent: false, reason: "provider_rejected", status: response.status, detail: body.message || body.name || "Resend rejected the test email." };
    }
    return { sent: true, providerId: body.id ?? null, recipient: to };
  } catch {
    return { sent: false, reason: "network_error", detail: "Could not reach the email provider." };
  }
}
