/**
 * Code version + feature manifest.
 *
 * The back-office shows this stamp so a half-copied ZIP is obvious at a
 * glance: if the admin says an older version, or /api/version reports a
 * feature as false, the deployment is not carrying the whole codebase.
 */
export const CODE_VERSION = "2026-11-05-am";

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
  "back-to-top",
  "whatsapp-below-instagram-desktop",
  "live-social-settings-mirror",
  "admin-edit-keeps-scroll",
  "compact-product-gallery",
  "mobile-overflow-fixes",
  "free-text-dimensions",
  "no-first-review-prompt",
  "editor-field-templates",
  "newsletter-featured-send",
  "newsletter-bulk-send",
  "newsletter-15day-cadence",
  "newsletter-unsubscribe",
  "newsletter-send-log",
  "twice-a-month-copy",
  "duplicate-specimen",
  "canonical-vercel-url",
  "cron-read-only-configuration",
  "newsletter-auto-setting-preserved",
  "newsletter-quarries-preparators-copy",
  "sos-handover-page",
  "review-moderation",
  "owners-and-visitors-reviews",
  "mobile-wordmark-nowrap",
  "connoisseur-original-photo-glass",
  "home-reviews-picker",
  "connoisseur-cyphaspis-glass",
  "newsletter-inline-images",
  "shipping-weight-table",
  "covers-route-bundled-cover",
  "shipping-table-admin-tab",
  "home-million-years-lines-retired",
  "collections-ages-below-cards",
  "hero-line-as-saved",
  "hero-eyebrow-retired",
  "collection-ages-retired",
  "links-compact-cards",
  "mobile-form-text-16px",
  "shipping-table-stacked-phone",
  "hero-moved-up",
  "home-sections-tightened",
  "link-cards-coloured-compact",
  "labels-one-line",
  "footer-gap-halved",
  "home-sections-reorderable-h0-h13",
  "home-sections-full-inline-editor",
  "hero-photo-buttons-title-desc-order",
  "admin-save-button-per-h-card",
  "curator-reviews-writer",
  "home-reviews-rotator-mobile-pairs",
  "marketplaces-box-builder-drag-reorder",
  "live-uploads-and-reviews-mirrored",
  "admin-tab5-sections-collapsed-default",
  "cambrian-explosion-collection-title",
  "collections-cards-text-below-image",
  "public-media-byte-verified-mirror",
  "footer-wordmark-fits-desktop",
  "upload-etag-revalidation",
  "admin-permanent-specimen-delete",
  "admin-unavailable-last",
  "draft-publication-consistent",
  "receipt-moderation-history-retained",
  "deleted-specimen-no-auto-reimport",
  "cover-preview-relative-redirect",
  "home-archive-specimens-not-linked",
  "admin-section-row-click-to-edit",
  "home-archive-individual-links-restored",
  "home-archive-last-days-title",
  "home-archive-similar-specimens-note",
  "home-archive-photo-title-only",
  "archive-page-specimen-links-preserved",
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
