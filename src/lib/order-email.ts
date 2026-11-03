/**
 * Order notification e-mail: pure rendering, no database or network imports,
 * so it can be unit-tested and reused by any transport.
 *
 * The shop never depends on the e-mail to record an order: a failed or
 * unconfigured mailer must leave the order exactly as it is.
 */

export type OrderEmailLine = {
  name: string;
  quantity: number;
  unitPriceCents: number;
};

export type OrderEmailInput = {
  orderId: string;
  reference: string;
  event: "placed" | "paid";
  paymentMethod: string;
  status: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  country: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postalCode: string;
  shippingMethod: string;
  /** Buyer's message to the curator, when one was left at checkout. */
  customerNote?: string | null;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  lines: OrderEmailLine[];
  createdAt: Date | string;
  shopUrl: string;
};

const money = (cents: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(cents / 100);

const esc = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function orderReference(orderId: string): string {
  return `MED-${orderId.slice(0, 8).toUpperCase()}`;
}

const EVENT_LABEL: Record<OrderEmailInput["event"], string> = {
  placed: "New order placed (pay by invoice)",
  paid: "New order PAID with PayPal",
};

export function buildOrderEmail(input: OrderEmailInput): { subject: string; text: string; html: string } {
  const label = EVENT_LABEL[input.event];
  const ref = input.reference || orderReference(input.orderId);
  const subject = `[Mediterranic] ${label} · ${ref} · ${money(input.totalCents)}`;
  const created = new Date(input.createdAt).toLocaleString("en-GB", { timeZone: "Europe/Lisbon" });
  const address = [input.addressLine1, input.addressLine2].filter(Boolean).join(", ");

  const text = [
    `${label}`,
    `Reference: ${ref}`,
    `Placed: ${created} (Lisbon time)`,
    `Status: ${input.status}`,
    `Payment: ${input.paymentMethod}`,
    "",
    "CUSTOMER",
    `${input.firstName} ${input.lastName}`,
    input.email,
    input.phone ? `Phone: ${input.phone}` : "",
    "",
    "DELIVERY",
    address,
    `${input.postalCode} ${input.city}, ${input.country}`,
    `Shipping option: ${input.shippingMethod}`,
    input.customerNote ? "" : "",
    input.customerNote ? "BUYER MESSAGE" : "",
    input.customerNote ? input.customerNote : "",
    "",
    "ITEMS",
    ...input.lines.map((line) => `${line.quantity}x ${line.name} — ${money(line.unitPriceCents)} each`),
    "",
    `Subtotal: ${money(input.subtotalCents)}`,
    `Shipping: ${money(input.shippingCents)}`,
    `Total: ${money(input.totalCents)}`,
    "",
    `Open the back-office: ${input.shopUrl}/admin`,
    `Order page: ${input.shopUrl}/orders/${input.orderId}`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  const rows = input.lines
    .map(
      (line) =>
        `<tr><td style="padding:6px 0">${line.quantity}× ${esc(line.name)}</td><td style="padding:6px 0;text-align:right">${money(line.unitPriceCents)}</td></tr>`,
    )
    .join("");

  const html = `<!doctype html><html><body style="margin:0;background:#f6f1e7;font-family:Helvetica,Arial,sans-serif;color:#0c1b26">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <p style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#a9853f;margin:0 0 6px">Mediterranic · Back-office</p>
    <h1 style="font-size:24px;margin:0 0 4px">${esc(label)}</h1>
    <p style="margin:0 0 20px;color:#5b6b76">${esc(ref)} · ${esc(created)} (Lisbon) · ${esc(input.status)}</p>
    <div style="background:#fff;border:1px solid #e3dccc;border-radius:4px;padding:18px;margin-bottom:16px">
      <p style="margin:0 0 6px;font-weight:bold">${esc(input.firstName)} ${esc(input.lastName)}</p>
      <p style="margin:0;color:#5b6b76">${esc(input.email)}${input.phone ? ` · ${esc(input.phone)}` : ""}</p>
      <p style="margin:10px 0 0;color:#5b6b76">${esc(address)}<br>${esc(input.postalCode)} ${esc(input.city)}, ${esc(input.country)}</p>
      <p style="margin:10px 0 0;color:#5b6b76">Shipping option: ${esc(input.shippingMethod)} · Payment: ${esc(input.paymentMethod)}</p>
      ${input.customerNote
        ? `<div style="margin:14px 0 0;padding:12px;background:#fbf6ea;border-left:3px solid #c9a24a"><p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:#a9853f">Buyer message</p><p style="margin:0;white-space:pre-wrap">${esc(input.customerNote)}</p></div>`
        : ""}
    </div>
    <div style="background:#fff;border:1px solid #e3dccc;border-radius:4px;padding:18px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        ${rows}
        <tr><td style="padding:10px 0 0;border-top:1px solid #eee">Subtotal</td><td style="padding:10px 0 0;border-top:1px solid #eee;text-align:right">${money(input.subtotalCents)}</td></tr>
        <tr><td style="padding:4px 0">Shipping</td><td style="padding:4px 0;text-align:right">${money(input.shippingCents)}</td></tr>
        <tr><td style="padding:8px 0;font-weight:bold;font-size:16px">Total</td><td style="padding:8px 0;font-weight:bold;font-size:16px;text-align:right">${money(input.totalCents)}</td></tr>
      </table>
    </div>
    <p style="margin:18px 0 0;font-size:13px"><a href="${esc(input.shopUrl)}/admin" style="color:#0b4f6c">Open the curator admin</a></p>
  </div>
</body></html>`;

  return { subject, text, html };
}

export type MailTransport = "resend" | "brevo" | null;

/** Which provider the environment is configured for. Null = no e-mail yet. */
export function mailTransport(): MailTransport {
  if (process.env.RESEND_API_KEY?.trim()) return "resend";
  if (process.env.BREVO_API_KEY?.trim()) return "brevo";
  return null;
}

export function orderNotificationRecipient(): string {
  return (
    process.env.ORDER_NOTIFICATION_EMAIL?.trim() ||
    process.env.ORDER_EMAIL_TO?.trim() ||
    "mediterranean.world@gmail.com"
  );
}

export function orderEmailFrom(): string {
  return process.env.ORDER_EMAIL_FROM?.trim() || "Mediterranic <onboarding@resend.dev>";
}
