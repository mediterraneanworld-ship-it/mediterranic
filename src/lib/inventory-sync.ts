import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { inventorySyncState, products } from "@/db/schema";
import { ensureSchema } from "@/lib/schema-migrate";
import type { SiteSettings } from "@/lib/catalog";
import { EbayApiError, ebayErrorMessage, ebaySellerFromUrl, getEbayItem, hasEbayCredentials, listEbaySellerItems, searchEbaySellerItems, type EbayItem } from "@/lib/ebay";
import { discoverCatawikiInventory, parseCatawikiIdentity, readFreshMarketplaceText } from "@/lib/catawiki-inventory";
import { canonicalListing, extractSpecimenReference, listingKey, matchListing, rememberListing, rememberedLinks, savedListing, specimenReferenceOf } from "@/lib/marketplace-links";
import { attachMarketplaceListing } from "@/lib/marketplace-service";
import { inventoryCounts, planInventoryReconciliation, type InventorySource, type InventorySyncReport, type RemoteListing } from "@/lib/inventory-rules";
import { storeRemoteImages } from "@/lib/listing-import";
import { parseListingText } from "@/lib/parse-listing";
import { listingIdentityTokens } from "@/lib/marketplace-identity";

const plain = (value: string) => value.replace(/<br\s*\/?>|<\/p>/gi, "\n").replace(/<[^>]*>/g, " ")
  .replace(/&#35;|&num;/g, "#").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code))).trim();
const unavailable = (message: string): InventorySource => ({ ok: false, complete: false, checkedAt: new Date().toISOString(), count: null, listings: [], error: message });
const knownTrilobite = (title: string) => !/seashell|triton|charonia|ammonit|nautil|mineral|marcasite|pyrite|agate|meteorit|tooth|amber|fish|coral|crinoid|orthoceras|goniatit|gastropod|echinoid/i.test(title)
  || /trilobit|bigotina|perrector|comura|cyphaspis|dicranurus|daguinaspis|drotops|reedops|walliserops/i.test(title);

function remoteEbay(item: EbayItem): RemoteListing {
  const description = plain(item.description ?? "");
  const aspects = Object.entries(item.aspects ?? {}).map(([key, values]) => `${key}: ${values.join(", ")}`).join("\n");
  return { channel: "ebay", url: item.itemWebUrl, title: item.title, description,
    reference: extractSpecimenReference(description) || extractSpecimenReference(aspects) || extractSpecimenReference(item.title),
    priceCents: item.priceCents, imageUrls: item.imageUrls, identityTokens: listingIdentityTokens(item.description ?? "", item.imageUrls) };
}

async function mapLimit<T>(items: T[], task: (item: T) => Promise<void>, concurrency = 3) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) await task(items[cursor++]);
  }));
}

async function discoverEbay(settings: SiteSettings, specimens: typeof products.$inferSelect[], signal: AbortSignal): Promise<InventorySource> {
  if (!hasEbayCredentials()) return unavailable("eBay API credentials are missing on this deployment. The stored channel distribution is not a verified live inventory.");
  let seller = process.env.EBAY_SELLER_USERNAME?.trim() || ebaySellerFromUrl(process.env.EBAY_STORE_URL || settings.ebayUrl);
  if (!seller) return unavailable("Set a valid eBay seller/store URL in the admin.");
  let confirmedSeller = Boolean(process.env.EBAY_SELLER_USERNAME?.trim() || /\/usr\//.test(settings.ebayUrl));
  let referenceItem: EbayItem | null = null;
  if (!process.env.EBAY_SELLER_USERNAME && /\/str\//.test(settings.ebayUrl)) {
    const reference = specimens.map((p) => savedListing(p, "ebay")).find(Boolean);
    if (reference) {
      try { const item = await getEbayItem(reference, signal); referenceItem = item; if (item?.sellerUsername) { seller = item.sellerUsername; confirmedSeller = true; } }
      catch (error) { if (!(error instanceof EbayApiError) || error.status !== 404) throw error; }
    }
  }
  // A store alias is only a display name. When it cannot be confirmed as the
  // real seller account, eBay returns HTTP 200 with an empty list and a warning
  // — which must never be recorded as "no active listings".
  const primary = await searchEbaySellerItems(seller, 200, signal);
  if (primary.warnings.length) {
    return unavailable(
      `eBay did not accept the seller name "${seller}": ${primary.warnings.map((w) => w.message).join(" ")} ` +
      `(warning ${primary.warnings[0].code}). A store URL (ebay.com/str/…) is not necessarily the seller account name. ` +
      `Set EBAY_SELLER_USERNAME to the real eBay seller ID (your eBay account name), or paste one live listing URL so the shop can learn it. ` +
      `Nothing was recorded as zero inventory.`,
    );
  }
  if (!primary.items.length) {
    if (referenceItem?.active) {
      return { ok: true, complete: false, checkedAt: new Date().toISOString(), count: null, listings: [remoteEbay(referenceItem)],
        error: "Seller search returned no offers, but a known listing is still active. This is an incomplete search, not zero inventory. Check the seller username and marketplace once." };
    }
    if (!confirmedSeller) return unavailable(`The store alias "${seller}" could not be confirmed as the seller username. Set EBAY_SELLER_USERNAME once (the actual seller account); this empty search was not recorded as zero inventory.`);
    // The seller is confirmed but the category probe found nothing. A listing
    // filed outside "Rocks, Fossils & Minerals" must not be read as "no stock".
    const keyword = await searchEbaySellerItems(seller, 50, signal, { query: "trilobite" });
    if (keyword.warnings.length) {
      return unavailable(
        `eBay returned no listings for seller "${seller}": ${keyword.warnings.map((w) => w.message).join(" ")} (warning ${keyword.warnings[0].code}).`,
      );
    }
    if (keyword.items.length) {
      const found = keyword.items.filter((item) => knownTrilobite(item.title)).map(remoteEbay);
      return { ok: true, complete: false, checkedAt: new Date().toISOString(), count: found.length, listings: found,
        error: "The seller has active listings outside the expected category. Check the category/marketplace setting once; these were found by keyword." };
    }
    return { ok: true, complete: true, checkedAt: new Date().toISOString(), count: 0, listings: [],
      error: "eBay reported no active listings for this seller. If you have just relisted, eBay can take several minutes to index a new listing." };
  }
  const listings = primary.items.filter((item) => knownTrilobite(item.title)).map(remoteEbay);
  // Read details for unknown/relisted items: catalogue IDs often live in the
  // description rather than the short seller-card title.
  const endedDuringRead = new Set<string>();
  await mapLimit(listings, async (listing) => {
    const auction = primary.items.find((item) => item.itemWebUrl === listing.url)?.auction;
    if (signal.aborted || (listing.reference && !auction)) return;
    try {
      const item = await getEbayItem(listing.url, signal);
      if (item?.active) Object.assign(listing, remoteEbay(item));
      else endedDuringRead.add(listing.url);
    } catch { if (auction) listing.priceCents = null; }
  });
  const activeListings = listings.filter((listing) => !endedDuringRead.has(listing.url));
  return { ok: true, complete: primary.items.length < 200, checkedAt: new Date().toISOString(),
    count: primary.items.length < 200 ? activeListings.length : null,
    listings: activeListings,
    ...(primary.items.length >= 200 ? { error: "The listing limit was reached; the inventory may be partial." } : {}) };
}

type Identity = ReturnType<typeof parseCatawikiIdentity>;
type Sources = Record<"ebay" | "catawiki", InventorySource>;

async function importNewListing(listing: RemoteListing, signal: AbortSignal) {
  const matchTitle = listing.reference ? `${listing.title}\nSpecimen ID: ${listing.reference}` : listing.title;
  const parsed = parseListingText(`${listing.title}\n${listing.description}`, listing.url,
    listing.priceCents === null ? "" : (listing.priceCents / 100).toFixed(2), listing.title);
  const photos = await storeRemoteImages(listing.imageUrls.slice(0, 3), listing.title,
    listing.channel === "ebay" ? "https://www.ebay.com/" : "https://www.catawiki.com/", signal);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${listingKey(listing.url)!}))`);
    if (listing.reference) await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"specimen:" + listing.reference}))`);
    const all = await tx.select().from(products);
    const match = matchListing({ url: listing.url, title: matchTitle, description: listing.description }, all);
    if (match.productId) return { created: false, draft: false };
    if (match.kind === "candidate" && (!listing.reference || match.candidates.some((candidate) => {
      const reference = specimenReferenceOf(all.find((p) => p.id === candidate.id)!);
      return !reference || reference === listing.reference;
    }))) return { created: false, draft: false };
    const slugBase = (parsed.species || listing.title).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "specimen";
    const slug = `${slugBase}-${(listing.reference || listingKey(listing.url)!.split(":")[1]).toLowerCase()}`;
    const canPublish = listing.priceCents !== null && listing.priceCents > 0 && photos.length > 0 && Boolean(listing.description);
    const metadata = rememberListing({}, listing.channel, listing.url, new Date().toISOString(), listing.identityTokens);
    const [created] = await tx.insert(products).values({
      slug, name: parsed.name || listing.title, species: parsed.species || "Moroccan trilobite", category: "specimen",
      collection: parsed.collection, collections: parsed.collections, period: parsed.period || null,
      locality: parsed.locality || "Morocco", formation: parsed.formation || null,
      lengthMm: Number(parsed.lengthMm) > 0 ? Math.round(Number(parsed.lengthMm)) : null,
      preparation: parsed.preparation || "See the listing description", priceCents: listing.priceCents ?? 0,
      stock: 1, featured: false, published: canPublish, archived: false, listingChannel: listing.channel,
      marketplaceActive: true, marketplaceCheckedAt: new Date(),
      externalListingUrl: listing.url, ...metadata, specimenReference: listing.reference,
      shortDescription: parsed.shortDescription || listing.title, description: listing.description || parsed.description,
      provenance: parsed.provenance, images: photos, hasCertificate: parsed.hasCertificate,
    }).returning({ id: products.id });
    return { created: true, draft: !canPublish, productId: created.id };
  });
}

/** Inventory reconciliation, not just a price check. Tests may inject fixture feeds; HTTP never accepts them. */
export async function synchronizeInventory(settings: SiteSettings, options: {
  deadline?: number; sources?: Sources; identities?: Map<number, Identity>;
  /** Internal test scoping only; never accepted by an HTTP route. */
  specimenIds?: number[];
} = {}): Promise<{ report: InventorySyncReport; hints: Map<string, { cents: number | null; status: "live" }> }> {
  await ensureSchema();
  const allowedIds = options.specimenIds ? new Set(options.specimenIds) : null;
  const scope = <T extends { id: number }>(rows: T[]) => allowedIds ? rows.filter((row) => allowedIds.has(row.id)) : rows;
  const startedAt = new Date().toISOString();
  const deadline = options.deadline ?? Date.now() + 90_000;
  const signal = AbortSignal.timeout(Math.max(1000, deadline - Date.now()));
  await db.insert(inventorySyncState).values({ id: 1 }).onConflictDoNothing();
  const [leased] = await db.update(inventorySyncState).set({ leaseExpiresAt: new Date(Date.now() + 115_000), updatedAt: new Date() })
    .where(and(eq(inventorySyncState.id, 1), or(isNull(inventorySyncState.leaseExpiresAt), lte(inventorySyncState.leaseExpiresAt, new Date())))).returning({ id: inventorySyncState.id, report: inventorySyncState.report });
  const hints = new Map<string, { cents: number | null; status: "live" }>();
  if (!leased) {
    const [state] = await db.select().from(inventorySyncState).where(eq(inventorySyncState.id, 1));
    return { report: state?.report ? { ...state.report, status: "running", message: "Another synchronization is running." } : {
      status: "running", startedAt, finishedAt: null, sources: { ebay: { ok: false, complete: false, count: null }, catawiki: { ok: false, complete: false, count: null } },
      linked: 0, created: 0, drafts: 0, held: 0, referencesLearned: 0, issues: [], counts: inventoryCounts([]), message: "Another synchronization is running.",
    }, hints };
  }
  const report: InventorySyncReport = { status: "running", startedAt, finishedAt: null,
    sources: { ebay: { ok: false, complete: false, count: null }, catawiki: { ok: false, complete: false, count: null } },
    linked: 0, created: 0, drafts: 0, held: 0, referencesLearned: 0, issues: [], counts: inventoryCounts([]) };
  try {
    const original = scope(await db.select().from(products));
    const identities = options.identities ?? new Map<number, Identity>();
    const loadIdentities = async () => {
      if (options.identities) return;
      await mapLimit(original.filter((p) => !p.specimenReference && !specimenReferenceOf(p))
        .sort((a, b) => Number(a.archived || a.stock <= 0) - Number(b.archived || b.stock <= 0)), async (p) => {
        const url = savedListing(p, "catawiki");
        if (!url || signal.aborted) return;
        try { identities.set(p.id, parseCatawikiIdentity(await readFreshMarketplaceText(url, signal), url)); } catch {}
      });
    };
    const catchSource = async (task: () => Promise<InventorySource>, name: string) => {
      try { return await task(); } catch (error) { return unavailable(name === "eBay" ? ebayErrorMessage(error) : error instanceof Error ? error.message : `${name} inventory could not be read.`); }
    };
    const [ebay, catawiki] = await Promise.all([
      options.sources ? Promise.resolve(options.sources.ebay) : catchSource(() => discoverEbay(settings, original, signal), "eBay"),
      options.sources ? Promise.resolve(options.sources.catawiki) : catchSource(() => discoverCatawikiInventory(settings.catawikiUrl, signal), "Catawiki"),
      loadIdentities(),
    ]);
    const sources: Sources = { ebay, catawiki };
    for (const [channel, source] of Object.entries(sources)) {
      report.sources[channel as "ebay" | "catawiki"] = { ok: source.ok, complete: source.complete, count: source.count, ...(source.error ? { error: source.error } : {}) };
      for (const listing of source.listings) hints.set(listing.url, { cents: listing.priceCents, status: "live" });
    }
    // Bootstrap stable catalogue IDs from the previously saved Catawiki page;
    // no descriptions or photos are replaced by this metadata learning.
    for (const p of original) {
      const identity = identities.get(p.id);
      if (!p.specimenReference && identity?.reference) {
        const changed = await db.update(products).set({ specimenReference: identity.reference }).where(and(eq(products.id, p.id), isNull(products.specimenReference))).returning({ id: products.id });
        report.referencesLearned += changed.length;
      }
    }
    const current = scope(await db.select().from(products));
    report.heldProductIds = (leased.report?.heldProductIds ?? []).filter((id) => current.some((p) => p.id === id && p.listingChannel === null && p.stock > 0 && !p.archived && p.published));
    const known = current.map((p) => {
      const identity = identities.get(p.id);
      const redirected = identity?.finalUrl && catawiki.listings.some((item) => listingKey(item.url) === listingKey(identity.finalUrl));
      return redirected ? { ...p, ...rememberListing(p, "catawiki", identity!.finalUrl!) } : p;
    });
    // Enrich each current Catawiki card with its stable specimen reference.
    await mapLimit(catawiki.listings, async (listing) => {
      if (listing.reference || signal.aborted || matchListing(listing, known).kind === "exact") return;
      try {
        const identity = parseCatawikiIdentity(await readFreshMarketplaceText(listing.url, signal), listing.url);
        listing.reference = identity.reference; listing.description = identity.description;
      } catch {}
    });
    const plan = planInventoryReconciliation(known, sources);
    report.issues.push(...plan.issues);
    for (const entry of plan.links) {
      if (signal.aborted) break;
      const before = original.find((p) => p.id === entry.productId)!;
      const now = current.find((p) => p.id === entry.productId)!;
      const same = now.listingChannel === entry.listing.channel && listingKey(savedListing(now, entry.listing.channel)) === listingKey(entry.listing.url);
      if (same) {
        if (entry.listing.identityTokens?.length) {
          const metadata = rememberListing(now, entry.listing.channel, entry.listing.url, new Date().toISOString(), entry.listing.identityTokens);
          await db.update(products).set({ marketplaceHistory: metadata.marketplaceHistory }).where(and(eq(products.id, now.id), eq(products.listingChannel, entry.listing.channel), sql`${products.externalListingUrl} IS NOT DISTINCT FROM ${now.externalListingUrl}`, sql`${products.marketplaceHistory} = ${JSON.stringify(now.marketplaceHistory)}::jsonb`));
        }
        continue;
      }
      try {
        await attachMarketplaceListing({ productId: entry.productId, channel: entry.listing.channel, url: entry.listing.url, priceCents: entry.listing.priceCents, identityTokens: entry.listing.identityTokens,
          expected: { listingChannel: before.listingChannel, priceCents: before.priceCents, externalListingUrl: before.externalListingUrl } });
        report.linked++;
      } catch (error) { report.issues.push({ url: entry.listing.url, title: entry.listing.title, channel: entry.listing.channel, candidateIds: [entry.productId], message: error instanceof Error ? error.message : "The link could not be reconciled." }); }
    }
    for (const hold of plan.holds) {
      const before = original.find((p) => p.id === hold.productId)!;
      const result = await db.update(products).set({ listingChannel: null })
        .where(and(eq(products.id, before.id), eq(products.listingChannel, "direct"), eq(products.stock, before.stock), eq(products.priceCents, before.priceCents), eq(products.archived, false))).returning({ id: products.id });
      report.held += result.length;
      if (result.length && !report.heldProductIds!.includes(before.id)) report.heldProductIds!.push(before.id);
    }
    // Once an ambiguous identity is resolved, release only holds that THIS
    // synchronizer created. Never guess that a manually unavailable piece is for sale.
    if (Object.values(sources).every((feed) => feed.ok && feed.complete)) {
      const pendingIds = new Set(plan.issues.flatMap((issue) => issue.candidateIds));
      const remaining: number[] = [];
      for (const id of report.heldProductIds ?? []) {
        if (pendingIds.has(id)) { remaining.push(id); continue; }
        const [p] = await db.select().from(products).where(eq(products.id, id)).limit(1);
        if (p && p.listingChannel === null && p.stock > 0 && !p.archived && p.published) {
          await db.update(products).set({ listingChannel: "direct" }).where(and(eq(products.id, id), isNull(products.listingChannel), eq(products.stock, p.stock), eq(products.priceCents, p.priceCents), eq(products.archived, false), eq(products.published, true)));
        }
      }
      report.heldProductIds = remaining;
    }
    // Verify offer presence independently from a saved platform/channel. A
    // complete feed can prove "not active", but never "sold". No stock, price,
    // archive flag or photos are changed by this negative observation.
    for (const product of scope(await db.select().from(products))) {
      const channel = product.listingChannel;
      if ((channel !== "ebay" && channel !== "catawiki") || product.archived || product.stock <= 0) continue;
      const feed = sources[channel];
      if (!feed.ok || !feed.complete) continue;
      const active = feed.listings.some((item) => listingKey(item.url) === listingKey(savedListing(product, channel)));
      await db.update(products).set({ marketplaceActive: active, marketplaceCheckedAt: new Date() })
        .where(and(eq(products.id, product.id), eq(products.listingChannel, channel), eq(products.priceCents, product.priceCents),
          sql`${products.externalListingUrl} IS NOT DISTINCT FROM ${product.externalListingUrl}`));
    }

    for (const listing of plan.imports) {
      if (signal.aborted) { report.issues.push({ url: listing.url, title: listing.title, channel: listing.channel, candidateIds: [], message: "Automatic import deferred by the run time limit; it will be retried." }); continue; }
      try {
        const imported = await importNewListing(listing, signal);
        if (imported.created) { if (imported.productId) allowedIds?.add(imported.productId); if (imported.draft) report.drafts++; else report.created++; }
      } catch (error) { report.issues.push({ url: listing.url, title: listing.title, channel: listing.channel, candidateIds: [], message: error instanceof Error ? error.message : "Automatic import could not finish." }); }
    }
    report.counts = inventoryCounts(scope(await db.select().from(products)));
    report.status = Object.values(sources).every((source) => source.ok && source.complete && !source.error) && !report.issues.length && !report.drafts && !signal.aborted ? "complete" : "partial";
    report.finishedAt = new Date().toISOString();
    await db.update(inventorySyncState).set({ report, leaseExpiresAt: null, updatedAt: new Date() }).where(eq(inventorySyncState.id, 1));
    return { report, hints };
  } catch (error) {
    report.status = "failed"; report.finishedAt = new Date().toISOString();
    report.message = error instanceof Error ? error.message : "Inventory synchronization failed.";
    await db.update(inventorySyncState).set({ report, leaseExpiresAt: null, updatedAt: new Date() }).where(eq(inventorySyncState.id, 1));
    return { report, hints };
  }
}

export async function getInventorySyncReport(): Promise<InventorySyncReport | null> {
  await ensureSchema();
  const [state] = await db.select().from(inventorySyncState).where(eq(inventorySyncState.id, 1)).limit(1);
  const running = Boolean(state?.leaseExpiresAt && state.leaseExpiresAt > new Date());
  if (!state?.report) {
    if (!running) return null;
    return { status: "running", startedAt: state!.updatedAt.toISOString(), finishedAt: null,
      sources: { ebay: { ok: false, complete: false, count: null }, catawiki: { ok: false, complete: false, count: null } },
      linked: 0, created: 0, drafts: 0, held: 0, referencesLearned: 0, issues: [],
      counts: inventoryCounts(await db.select().from(products)) };
  }
  const current = await db.select().from(products);
  const issues = state.report.issues.filter((issue) => {
    if (!/identify|identity|reference was found/i.test(issue.message)) return true;
    return !current.some((p) => p.listingChannel === issue.channel && listingKey(savedListing(p, issue.channel)) === listingKey(issue.url));
  });
  return { ...state.report, issues, counts: inventoryCounts(current), ...(running ? { status: "running" as const } : {}) };
}
