import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { curatorMailbox, escapeHtml, mailShell, sendMail, type SendResult } from "@/lib/mailer";
import { orderReference } from "@/lib/order-email";

function siteBase(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    "https://mediterranic.vercel.app"
  ).replace(/\/$/, "");
}

export type OrderContext = {
  id: string;
  reference: string;
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postalCode: string;
  totalCents: number;
  status: string;
  customerNote: string | null;
  trackingUrl: string | null;
  items: { productName: string; quantity: number }[];
};

export async function loadOrderContext(orderId: string): Promise<OrderContext | null> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  return {
    id: order.id,
    reference: orderReference(order.id),
    firstName: order.firstName,
    lastName: order.lastName,
    email: order.email,
    country: order.country,
    addressLine1: order.addressLine1,
    addressLine2: order.addressLine2,
    city: order.city,
    postalCode: order.postalCode,
    totalCents: order.totalCents,
    status: order.status,
    customerNote: order.customerNote,
    trackingUrl: order.trackingUrl,
    items: items.map((i) => ({ productName: i.productName, quantity: i.quantity })),
  };
}

/** Accepts a full carrier URL, or a bare tracking code turned into a URL. */
export function normalizeTracking(value: string): { url: string; code: string } | null {
  const raw = value.trim();
  if (!raw) return null;
  const asUrl = /^https?:\/\//i.test(raw) ? raw : /^www\./i.test(raw) ? `https://${raw}` : null;
  if (asUrl) {
    try {
      const parsed = new URL(asUrl);
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(parsed.hostname)) return null;
      const fromQuery =
        parsed.searchParams.get("id") ||
        parsed.searchParams.get("code") ||
        parsed.searchParams.get("tracking") ||
        parsed.searchParams.get("trackingId") ||
        parsed.searchParams.get("tracknumbers") ||
        "";
      const fromPath = parsed.pathname.split("/").filter(Boolean).pop() ?? "";
      const code = (fromQuery || fromPath || parsed.toString()).slice(0, 80);
      return { url: parsed.toString(), code };
    } catch {
      return null;
    }
  }
  // Bare code: letters/digits/dashes only.
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._/-]{3,60}$/.test(raw)) return null;
  return { url: raw, code: raw };
}

const money = (cents: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(cents / 100);

/** Sends the tracking details to the buyer and a copy to the curator. */
export async function sendTrackingEmails(order: OrderContext, tracking: { url: string; code: string }): Promise<{
  buyer: SendResult;
  curator: SendResult;
}> {
  const isLink = /^https?:\/\//i.test(tracking.url);
  const bodyHtml = `
    <p style="margin:0 0 8px"><strong>Order ${escapeHtml(order.reference)}</strong></p>
    <p style="margin:0 0 8px">${order.items.map((i) => `${i.quantity}× ${escapeHtml(i.productName)}`).join("<br>")}</p>
    <p style="margin:0 0 4px">Tracking ${isLink ? "link" : "reference"}:</p>
    <p style="margin:0 0 10px;font-family:monospace;font-size:15px;word-break:break-all">${escapeHtml(tracking.code)}</p>
    ${isLink ? `<p style="margin:0"><a href="${escapeHtml(tracking.url)}" style="color:#0b4f6c">Follow your parcel →</a></p>` : ""}
    <p style="margin:12px 0 0;color:#5b6b76">Dispatch address: ${escapeHtml(order.addressLine1)}${order.addressLine2 ? `, ${escapeHtml(order.addressLine2)}` : ""}, ${escapeHtml(order.postalCode)} ${escapeHtml(order.city)}, ${escapeHtml(order.country)}</p>`;

  const buyer = await sendMail({
    to: order.email,
    subject: `Your Mediterranic order ${order.reference} has been dispatched`,
    text: [
      `Hello ${order.firstName},`,
      "",
      `Your order ${order.reference} has been dispatched.`,
      "",
      ...order.items.map((i) => `${i.quantity}x ${i.productName}`),
      "",
      `Tracking ${isLink ? "link" : "reference"}: ${tracking.url}`,
      "",
      "Any question: just reply to this e-mail.",
      "",
      "Mediterranic",
    ].join("\n"),
    html: mailShell({
      heading: "Your specimens are on their way",
      intro: `Hello ${order.firstName}, your order ${order.reference} has been dispatched.`,
      bodyHtml,
      footer: "Packed by hand. Reply to this message if anything needs attention.",
    }),
    replyTo: curatorMailbox(),
  });

  const curator = await sendMail({
    to: curatorMailbox(),
    subject: `[Mediterranic] Tracking set · ${order.reference} · ${order.firstName} ${order.lastName}`,
    text: [
      `Tracking recorded for ${order.reference}.`,
      `${order.firstName} ${order.lastName} <${order.email}>`,
      `Tracking: ${tracking.url}`,
      `Buyer e-mail: ${buyer.ok ? "sent" : `NOT sent — ${buyer.detail}`}`,
    ].join("\n"),
    html: mailShell({
      heading: "Tracking recorded",
      intro: `${order.reference} · ${order.firstName} ${order.lastName} <${order.email}>`,
      bodyHtml: `${bodyHtml}<p style="margin:12px 0 0;color:${buyer.ok ? "#0b6b52" : "#a33"}">Buyer e-mail: ${buyer.ok ? "sent" : `not sent — ${escapeHtml(buyer.detail)}`}</p>`,
    }),
    replyTo: order.email,
  });

  return { buyer, curator };
}

/** A curator reply to the buyer, with the order quoted, sent from the shop. */
export async function sendBuyerMessage(order: OrderContext, message: string): Promise<SendResult> {
  const body = escapeHtml(message).replace(/\n/g, "<br>");
  return sendMail({
    to: order.email,
    subject: `Mediterranic · order ${order.reference}`,
    text: [
      `Hello ${order.firstName},`,
      "",
      message,
      "",
      "—",
      `Order ${order.reference} · ${money(order.totalCents)} · ${order.items.map((i) => `${i.quantity}x ${i.productName}`).join(", ")}`,
      `See the order: ${siteBase()}/orders/${order.id}`,
      "",
      "Mediterranic · mediterranean.world@gmail.com",
    ].join("\n"),
    html: mailShell({
      heading: "A message about your order",
      intro: `Hello ${order.firstName}, this is about order ${order.reference}.`,
      bodyHtml: `<p style="margin:0 0 12px;white-space:pre-wrap">${body}</p>
        <p style="margin:12px 0 0;border-top:1px solid #eee;padding-top:10px;color:#5b6b76;font-size:13px">
          ${escapeHtml(order.items.map((i) => `${i.quantity}× ${i.productName}`).join(" · "))} · ${money(order.totalCents)}<br>
          <a href="${siteBase()}/orders/${order.id}" style="color:#0b4f6c">Open the order</a>
        </p>`,
      footer: "Reply directly to this e-mail and it reaches the curator.",
    }),
    replyTo: curatorMailbox(),
  });
}
