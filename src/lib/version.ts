/**
 * Code version + feature manifest.
 *
 * The back-office shows this stamp so a half-copied ZIP is obvious at a
 * glance: if the admin says an older version, or /api/version reports a
 * feature as false, the deployment is not carrying the whole codebase.
 */
export const CODE_VERSION = "2026-11-03-k";

export const REQUIRED_FEATURES = [
  "order-notifications",
  "email-test",
  "editable-hero-stats",
  "orders-admin-actions",
  "same-shelf-era-order",
  "catawiki-wordmark",
  "ebay-quad-102deg",
  "public-inventory-banner-removed",
  "buyer-note",
  "tracking-email",
  "message-buyer",
  "invoice-note-dialog",
  "customer-delivery-check",
] as const;

export function codeManifest() {
  return {
    version: CODE_VERSION,
    node: process.version,
    features: Object.fromEntries(REQUIRED_FEATURES.map((feature) => [feature, true])),
    email: {
      transport: process.env.RESEND_API_KEY?.trim()
        ? "resend"
        : process.env.BREVO_API_KEY?.trim()
          ? "brevo"
          : "none",
      from: process.env.ORDER_EMAIL_FROM?.trim() || "Mediterranic <onboarding@resend.dev>",
      recipient:
        process.env.ORDER_NOTIFICATION_EMAIL?.trim() ||
        process.env.ORDER_EMAIL_TO?.trim() ||
        "mediterranean.world@gmail.com",
      /** False while the sender is Resend's shared test address: only the
       *  account owner receives mail; customers do not. */
      customersReachable:
        Boolean(process.env.RESEND_API_KEY?.trim() || process.env.BREVO_API_KEY?.trim()) &&
        !(
          Boolean(process.env.RESEND_API_KEY?.trim()) &&
          /@resend\.dev>?\s*$/i.test(process.env.ORDER_EMAIL_FROM?.trim() || "Mediterranic <onboarding@resend.dev>")
        ),
    },
  };
}
