/**
 * Generic transactional mail: one place for every provider, so tracking
 * e-mails and direct replies use exactly the same path as order notices.
 * Server-side only. Never throws for missing configuration.
 */

export type MailTransport = "resend" | "brevo" | null;

export function mailTransport(): MailTransport {
  if (process.env.RESEND_API_KEY?.trim()) return "resend";
  if (process.env.BREVO_API_KEY?.trim()) return "brevo";
  return null;
}

export function mailFromAddress(): string {
  return process.env.ORDER_EMAIL_FROM?.trim() || "Mediterranic <onboarding@resend.dev>";
}

export function curatorMailbox(): string {
  return (
    process.env.ORDER_NOTIFICATION_EMAIL?.trim() ||
    process.env.ORDER_EMAIL_TO?.trim() ||
    "mediterranean.world@gmail.com"
  );
}

export type SendResult =
  | { ok: true; detail: string }
  | { ok: false; detail: string; notConfigured?: boolean; restrictedSender?: boolean };

/**
 * Inline attachment for e-mail images. Resend supports `content_id`, which
 * lets the HTML reference the photo as `src="cid:piece-1"` — the only way to
 * guarantee the picture renders in Outlook (desktop and mobile) and in
 * clients that block remote images by default.
 */
export type MailAttachment = {
  filename: string;
  /** Base64 payload, no data: prefix. */
  content: string;
  contentType: string;
  contentId: string;
};

/**
 * Resend's shared test sender (…@resend.dev) only delivers to the e-mail of
 * the Resend account owner. Every other recipient (i.e. every customer) is
 * refused until a domain is verified and ORDER_EMAIL_FROM uses it.
 */
export function usesRestrictedSender(): boolean {
  return mailTransport() === "resend" && /@resend\.dev>?\s*$/i.test(mailFromAddress());
}

export const RESTRICTED_SENDER_HELP =
  "Customers cannot receive e-mails yet: the sender onboarding@resend.dev only delivers to the Resend account owner. " +
  "Verify your domain in Resend → Domains (add the DNS records it shows), then set ORDER_EMAIL_FROM to an address on " +
  "that domain, e.g. \"Mediterranic <orders@mediterranic.com>\", and redeploy.";

function isRestrictedRefusal(status: number, body: string): boolean {
  return (
    (status === 403 || status === 422 || status === 400) &&
    /only send testing emails|verify a domain|testing emails to your own|domain is not verified|not verified/i.test(body)
  );
}

export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  /** Extra headers, e.g. List-Unsubscribe on marketing mail. */
  headers?: Record<string, string>;
  /** Inline images referenced from the HTML via `cid:`. */
  attachments?: MailAttachment[];
}): Promise<SendResult> {
  const transport = mailTransport();
  if (!transport) {
    return {
      ok: false,
      notConfigured: true,
      detail: "No e-mail provider configured. Set RESEND_API_KEY (or BREVO_API_KEY) in the environment.",
    };
  }
  const from = mailFromAddress();
  try {
    if (transport === "resend") {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to: [input.to],
            subject: input.subject,
            text: input.text,
            html: input.html,
            ...(input.replyTo ? { reply_to: input.replyTo } : {}),
            ...(input.headers ? { headers: input.headers } : {}),
            ...(input.attachments?.length
              ? {
                  attachments: input.attachments.map((a) => ({
                    filename: a.filename,
                    content: a.content,
                    content_type: a.contentType,
                    content_id: a.contentId,
                  })),
                }
              : {}),
          }),
        signal: AbortSignal.timeout(15_000),
      });
      const body = await res.text();
      if (!res.ok) {
        if (isRestrictedRefusal(res.status, body)) {
          return { ok: false, restrictedSender: true, detail: RESTRICTED_SENDER_HELP };
        }
        return { ok: false, detail: `Resend ${res.status}: ${body.slice(0, 200)}` };
      }
      return { ok: true, detail: "Resend accepted the message." };
    }
    const match = from.match(/^(.*)<(.+)>$/);
    const sender = match
      ? { name: match[1].trim() || "Mediterranic", email: match[2].trim() }
      : { name: "Mediterranic", email: from };
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": process.env.BREVO_API_KEY!.trim(), "Content-Type": "application/json" },
      body: JSON.stringify({
        sender,
        to: [{ email: input.to }],
        subject: input.subject,
        textContent: input.text,
        htmlContent: input.html,
        ...(input.replyTo ? { replyTo: { email: input.replyTo } } : {}),
        ...(input.headers ? { headers: input.headers } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.text();
    if (!res.ok) return { ok: false, detail: `Brevo ${res.status}: ${body.slice(0, 200)}` };
    return { ok: true, detail: "Brevo accepted the message." };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message.slice(0, 200) : "Unknown transport error" };
  }
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Wraps a message body in the Mediterranic e-mail shell. */
export function mailShell(options: { heading: string; intro: string; bodyHtml: string; footer?: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#f6f1e7;font-family:Helvetica,Arial,sans-serif;color:#0c1b26">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <p style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#a9853f;margin:0 0 6px">Mediterranic</p>
    <h1 style="font-family:Georgia,serif;font-size:26px;margin:0 0 12px">${escapeHtml(options.heading)}</h1>
    <p style="margin:0 0 18px;color:#5b6b76;line-height:1.6">${escapeHtml(options.intro)}</p>
    <div style="background:#fff;border:1px solid #e3dccc;border-radius:4px;padding:18px;line-height:1.6">${options.bodyHtml}</div>
    ${options.footer ? `<p style="margin:18px 0 0;font-size:12px;color:#5b6b76;line-height:1.6">${options.footer}</p>` : ""}
    <p style="margin:22px 0 0;font-size:11px;color:#98a4ad">Mediterranic · Moroccan trilobites · mediterranean.world@gmail.com</p>
  </div></body></html>`;
}
