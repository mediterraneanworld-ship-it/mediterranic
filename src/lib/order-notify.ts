import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orderNotifications, orders } from "@/db/schema";
import { ensureSchema } from "@/lib/schema-migrate";
import { sendMail as sendSharedMail, usesRestrictedSender, RESTRICTED_SENDER_HELP } from "@/lib/mailer";
import {
  buildOrderEmail,
  mailTransport,
  orderEmailFrom,
  orderNotificationRecipient,
  orderReference,
  type OrderEmailInput,
  type OrderEmailLine,
} from "@/lib/order-email";
import { PUBLIC_SITE_URL } from "@/lib/site-url";

export type OrderEvent = "placed" | "paid";
export type NotifyResult = { status: "sent" | "failed" | "not_configured" | "skipped"; detail: string };

function shopUrl(): string {
  return PUBLIC_SITE_URL;
}

/** Reads one order + its lines and renders the curator e-mail. */
async function compose(orderId: string, event: OrderEvent): Promise<{ input: OrderEmailInput } | null> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const lines: OrderEmailLine[] = items.map((item) => ({
    name: item.productName,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
  }));
  return {
    input: {
      orderId: order.id,
      reference: orderReference(order.id),
      event,
      paymentMethod: order.paymentMethod === "paypal" ? "PayPal" : "Invoice (e-mail)",
      status: order.status,
      firstName: order.firstName,
      lastName: order.lastName,
      email: order.email,
      phone: order.phone,
      country: order.country,
      addressLine1: order.addressLine1,
      addressLine2: order.addressLine2,
      city: order.city,
      postalCode: order.postalCode,
      shippingMethod: order.shippingMethod,
      customerNote: order.customerNote,
      subtotalCents: order.subtotalCents,
      shippingCents: order.shippingCents,
      totalCents: order.totalCents,
      lines,
      createdAt: order.createdAt,
      shopUrl: shopUrl(),
    },
  };
}

async function sendMail(to: string, subject: string, text: string, html: string): Promise<string> {
  const result = await sendSharedMail({ to, subject, text, html });
  if (result.ok) return result.detail;
  if ("notConfigured" in result && result.notConfigured) throw new Error("NO_TRANSPORT");
  throw new Error(result.detail);
}

/**
 * One-click check used by the back-office. `to` may be any address: testing a
 * customer-style address proves whether buyers can actually receive mail.
 */
export async function sendTestEmail(to = orderNotificationRecipient()): Promise<{
  status: "sent" | "failed" | "not_configured" | "restricted";
  detail: string;
  transport: string;
  to: string;
}> {
  const transport = mailTransport();
  if (!transport) {
    return {
      status: "not_configured",
      transport: "none",
      to,
      detail: "No provider configured. Set RESEND_API_KEY (or BREVO_API_KEY) in the environment and redeploy.",
    };
  }
  const subject = "[Mediterranic] Test e-mail";
  const text = [
    "This is a test from the Mediterranic back-office.",
    "",
    `Provider: ${transport}`,
    `Recipient: ${to}`,
    `Site: ${shopUrl()}`,
    "",
    "If this reached the inbox, order, tracking and reply e-mails will reach this address too.",
  ].join("\n");
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;color:#0c1b26"><h2 style="font-family:Georgia,serif">Test e-mail</h2><p>This is a test from the Mediterranic back-office.</p><p>Provider: <strong>${transport}</strong><br>Recipient: <strong>${to}</strong><br>Site: ${shopUrl()}</p><p style="color:#5b6b76">If this reached the inbox, order, tracking and reply e-mails will reach this address too.</p></div>`;
  const result = await sendSharedMail({ to, subject, text, html });
  if (result.ok) return { status: "sent", transport, to, detail: result.detail };
  if ("restrictedSender" in result && result.restrictedSender) return { status: "restricted", transport, to, detail: result.detail };
  return { status: "failed", transport, to, detail: result.detail };
}

/** True when customers cannot receive mail with the current sender. */
export function customerDeliveryBlocked(): { blocked: boolean; reason: string | null } {
  return usesRestrictedSender() ? { blocked: true, reason: RESTRICTED_SENDER_HELP } : { blocked: false, reason: null };
}

/**
 * Notifies the curator about an order. NEVER throws and NEVER changes the
 * order: a mail failure is recorded in `order_notifications` so the
 * back-office shows it and can retry. The (order, event) pair is unique, so a
 * retry after a page reload does not duplicate the e-mail.
 */
export async function notifyOrder(orderId: string, event: OrderEvent, options: { force?: boolean } = {}): Promise<NotifyResult> {
  const recipient = orderNotificationRecipient();
  try {
    await ensureSchema();
    const composed = await compose(orderId, event);
    if (!composed) return { status: "skipped", detail: "Order not found." };

    if (!options.force) {
      const [existing] = await db
        .select()
        .from(orderNotifications)
        .where(and(eq(orderNotifications.orderId, orderId), eq(orderNotifications.event, event)))
        .limit(1);
      if (existing) return { status: "skipped", detail: `Already recorded (${existing.status}).` };
    }

    const mail = buildOrderEmail(composed.input);
    let status: NotifyResult["status"] = "sent";
    let detail = "";

    try {
      detail = await sendMail(recipient, mail.subject, mail.text, mail.html);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown transport error";
      if (message === "NO_TRANSPORT") {
        status = "not_configured";
        detail =
          "No e-mail provider configured. Set RESEND_API_KEY (or BREVO_API_KEY) and ORDER_NOTIFICATION_EMAIL in the environment.";
      } else {
        status = "failed";
        detail = message.slice(0, 300);
      }
      console.warn(`Order ${composed.input.reference} notification (${event}) not sent: ${detail}`);
    }

    await db
      .insert(orderNotifications)
      .values({
        orderId,
        event,
        recipient,
        status,
        detail,
        sentAt: status === "sent" ? new Date() : null,
      })
      .onConflictDoUpdate({
        target: [orderNotifications.orderId, orderNotifications.event],
        set: { status, detail, recipient, ...(status === "sent" ? { sentAt: new Date() } : {}) },
      });

    return { status, detail };
  } catch (error) {
    // The order itself must never be affected by a notification problem.
    console.error("Order notification could not be processed", error);
    return { status: "failed", detail: error instanceof Error ? error.message.slice(0, 200) : "Notification error." };
  }
}
