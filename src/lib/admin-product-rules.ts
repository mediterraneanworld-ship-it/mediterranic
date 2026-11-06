import { isAvailable } from "@/lib/product-visibility";
import { marketplaceOf, referenceCore, listingKey, savedListing, type MarketplaceLink } from "@/lib/marketplace-links";

type Availability = Parameters<typeof isAvailable>[0];

/** Stable partition: keep the curator's existing order inside each group. Draft is visibility, not availability. */
export function sortAdminProducts<T extends Availability>(items: readonly T[]): T[] {
  return [...items.filter(isAvailable), ...items.filter((item) => !isAvailable(item))];
}

export type PublishableSpecimen = Availability & {
  name: string;
  priceCents: number;
  images: { src?: string }[];
  description?: string | null;
  shortDescription?: string | null;
  externalListingUrl?: string | null;
  ebayListingUrl?: string | null;
  catawikiListingUrl?: string | null;
  marketplaceHistory?: MarketplaceLink[] | null;
};
export type PublicationIssue = { field: "name" | "images" | "description" | "priceDollars" | "externalListingUrl" | "listingChannel"; message: string };

/** Exactly the same checks for the row Publish button and Save & publish. No guessed price, stock or channel. */
export function publicationIssues(product: PublishableSpecimen): PublicationIssue[] {
  const issues: PublicationIssue[] = [];
  if (!product.name?.trim()) issues.push({ field: "name", message: "a specimen title" });
  if (!Array.isArray(product.images) || !product.images.some((image) => typeof image?.src === "string" && image.src.trim())) {
    issues.push({ field: "images", message: "at least one photograph" });
  }
  if (!product.description?.trim() && !product.shortDescription?.trim()) issues.push({ field: "description", message: "a description or short description" });
  if (product.listingChannel && !["direct", "ebay", "catawiki"].includes(product.listingChannel)) {
    issues.push({ field: "listingChannel", message: "a valid sales channel" });
  }
  // Unavailable and archive pages intentionally have no public price.
  if (isAvailable(product)) {
    if (!Number.isInteger(product.priceCents) || product.priceCents <= 0) issues.push({ field: "priceDollars", message: "a positive price in EUR" });
    if (product.listingChannel === "ebay" || product.listingChannel === "catawiki") {
      const url = savedListing({ externalListingUrl: product.externalListingUrl, ebayListingUrl: product.ebayListingUrl, catawikiListingUrl: product.catawikiListingUrl, marketplaceHistory: product.marketplaceHistory }, product.listingChannel);
      if (!url || marketplaceOf(url) !== product.listingChannel) issues.push({ field: "externalListingUrl", message: `the current ${product.listingChannel === "ebay" ? "eBay" : "Catawiki"} listing link` });
    }
  }
  return issues;
}

export function publicationMessage(issues: readonly PublicationIssue[]): string {
  return `Before publishing, add ${issues.map((issue) => issue.message).join(", ")}. Complete the fields below, then Save & publish. Or keep it as a draft.`;
}

export type DeletedSpecimenIdentity = { slug: string; specimenReference: string | null; listingKeys: string[] };
/** Exact slug, saved listing or unique four-digit REF only. A species name is never enough. */
export function matchesDeletedSpecimen(candidate: { slug?: string; url?: string | null; reference?: string | null }, records: readonly DeletedSpecimenIdentity[]): boolean {
  const key = candidate.url ? listingKey(candidate.url) : null;
  const reference = candidate.reference ? referenceCore(candidate.reference) : null;
  return records.some((row) => Boolean(
    (candidate.slug && row.slug === candidate.slug) ||
    (key && row.listingKeys.includes(key)) ||
    (reference && row.specimenReference && reference === referenceCore(row.specimenReference)),
  ));
}

export const PAYMENT_IN_PROGRESS = ["pending_payment", "payment_pending", "payment_review", "pending_invoice"] as const;
