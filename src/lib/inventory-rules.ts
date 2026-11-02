/** Shared inventory rules. Pure: safe to import into browser components. */
import { isAvailable } from "@/lib/product-visibility";
import { matchListing, listingKey, specimenReferenceOf, type LinkedSpecimen, type Marketplace } from "@/lib/marketplace-links";

export type CountableSpecimen = { published?: boolean; archived: boolean; stock: number; listingChannel: string | null; marketplaceActive?: boolean | null };
export function offeredSpecimen(specimen: CountableSpecimen): boolean {
  return specimen.published !== false && isAvailable(specimen)
    && (specimen.listingChannel === "direct" || specimen.listingChannel === "ebay" || specimen.listingChannel === "catawiki");
}
export function inventoryCounts<T extends CountableSpecimen>(specimens: T[]) {
  const offered = specimens.filter(offeredSpecimen);
  const count = (channel: string) => offered.filter((p) => p.listingChannel === channel).length;
  return { all: offered.length, direct: count("direct"), ebay: count("ebay"), catawiki: count("catawiki") };
}

export type RemoteListing = {
  channel: Marketplace; url: string; title: string; description: string;
  reference: string | null; priceCents: number | null; imageUrls: string[]; identityTokens?: string[];
};
export type InventorySource = {
  ok: boolean; complete: boolean; checkedAt: string; count: number | null;
  listings: RemoteListing[]; error?: string;
};
export type SyncSpecimen = LinkedSpecimen & CountableSpecimen & { id: number };
export type SyncIssue = { url: string; title: string; channel: Marketplace; message: string; candidateIds: number[] };
export type InventoryPlan = {
  links: { productId: number; listing: RemoteListing }[];
  imports: RemoteListing[];
  holds: { productId: number; message: string }[];
  issues: SyncIssue[];
};

/**
 * Positive evidence may move a known piece. Absence is never interpreted as a
 * sale. A name/species-only match is never merged automatically.
 */
export function planInventoryReconciliation(specimens: SyncSpecimen[], sources: Record<Marketplace, InventorySource>): InventoryPlan {
  const plan: InventoryPlan = { links: [], imports: [], holds: [], issues: [] };
  const grouped = new Map<number, RemoteListing[]>();
  const uncertain = new Set<number>();
  for (const source of Object.values(sources)) {
    if (!source.ok) continue;
    for (const listing of source.listings) {
      const title = listing.reference ? `${listing.title}\nSpecimen ID: ${listing.reference}` : listing.title;
      const match = matchListing({ ...listing, title }, specimens);
      if (!match.productId) {
        const distinctKnownReference = Boolean(listing.reference && match.candidates.every((candidate) => {
          const ref = specimenReferenceOf(specimens.find((p) => p.id === candidate.id)!);
          return ref && ref !== listing.reference;
        }));
        if (listing.reference && (match.kind === "new" || distinctKnownReference)) {
          const sameReference = Object.values(sources).flatMap((feed) => feed.ok ? feed.listings : []).filter((entry) => entry.reference === listing.reference);
          if (new Set(sameReference.map((entry) => listingKey(entry.url))).size > 1) {
            plan.issues.push({ url: listing.url, title: listing.title, channel: listing.channel, candidateIds: [], message: "The same new reference appears in multiple active offers. Choose its active platform before automatic import." });
          } else plan.imports.push(listing);
          continue;
        }
        const ids = match.candidates.map((p) => p.id);
        ids.forEach((id) => uncertain.add(id));
        plan.issues.push({ url: listing.url, title: listing.title, channel: listing.channel, candidateIds: ids,
          message: ids.length ? "Identify this specimen once: only a name/species match was found. A saved link or catalogue reference will identify future relistings." : "No stable specimen reference was found. Identify this listing once before importing automatically." });
        continue;
      }
      const specimen = specimens.find((p) => p.id === match.productId)!;
      if (specimen.archived || specimen.stock <= 0) {
        plan.issues.push({ url: listing.url, title: listing.title, channel: listing.channel, candidateIds: [specimen.id], message: "An unavailable/archive specimen appears in a live inventory. Restore it explicitly if appropriate; it was not resurrected automatically." });
        continue;
      }
      const entries = grouped.get(specimen.id) ?? [];
      if (!entries.some((entry) => listingKey(entry.url) === listingKey(listing.url))) entries.push(listing);
      grouped.set(specimen.id, entries);
    }
  }
  for (const [productId, listings] of grouped) {
    const specimen = specimens.find((p) => p.id === productId)!;
    const platforms = new Set(listings.map((listing) => listing.channel));
    if (platforms.size > 1 || listings.length > 1) {
      for (const listing of listings) plan.issues.push({ url: listing.url, title: listing.title, channel: listing.channel, candidateIds: [productId], message: "Multiple active listings refer to this specimen. End the competing offer; no platform was guessed." });
      if (specimen.listingChannel === "direct") plan.holds.push({ productId, message: "Direct sale paused: competing active external listings." });
      continue;
    }
    const listing = listings[0];
    const other: Marketplace = listing.channel === "ebay" ? "catawiki" : "ebay";
    if (specimen.listingChannel === other && (!sources[other].ok || !sources[other].complete || uncertain.has(productId))) {
      plan.issues.push({ url: listing.url, title: listing.title, channel: listing.channel, candidateIds: [productId], message: "The other active marketplace could not be ruled out. Existing channel kept until that inventory is readable." });
      continue;
    }
    plan.links.push({ productId, listing });
  }
  // Do not offer an uncertain external specimen for direct checkout. Keep all
  // stock, text and photos; linking a confirmed offer later lifts this hold.
  for (const id of uncertain) {
    const specimen = specimens.find((p) => p.id === id);
    if (specimen?.listingChannel === "direct" && !specimen.archived && specimen.stock > 0 && !plan.links.some((entry) => entry.productId === id)) {
      plan.holds.push({ productId: id, message: "Direct sale paused pending a one-time listing identity check." });
    }
  }
  return plan;
}

export type InventorySyncReport = {
  status: "complete" | "partial" | "running" | "failed";
  startedAt: string; finishedAt: string | null;
  sources: Record<Marketplace, { ok: boolean; complete: boolean; count: number | null; error?: string }>;
  linked: number; created: number; drafts: number; held: number; referencesLearned: number;
  issues: SyncIssue[];
  counts: ReturnType<typeof inventoryCounts>;
  heldProductIds?: number[];
  message?: string;
};
