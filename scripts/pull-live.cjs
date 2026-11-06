/**
 * Production PUBLIC pages -> LOCAL PostgreSQL only. Never connects to Neon.
 *   node scripts/pull-live.cjs https://mediterranic.vercel.app
 *
 * Downloads the actual bytes of every referenced photograph, verifies SHA-256,
 * and allocates a separate local upload when needed. Existing upload IDs are
 * never overwritten. Missing/unreadable source data leaves local data intact.
 * Private drafts, orders, subscribers and admin-only settings are not public;
 * use the authenticated admin backup for a complete private copy.
 */
require("dotenv").config({ quiet: true });
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { eq, and } = require("drizzle-orm");
const { assertLocalDatabase, productFromHtml, homeFromHtml, shippingFromHtml, publicImagePath, replaceImageReferences } = require("./lib/live-public.cjs");

assertLocalDatabase(process.env.DATABASE_URL);
const source = new URL(process.argv[2] || "https://mediterranic.vercel.app");
if (source.protocol !== "https:" || source.hostname !== "mediterranic.vercel.app" || source.username || source.password) {
  throw new Error("Only the official HTTPS production storefront can be used as the public source.");
}
const BASE = source.origin;
const { register } = require("tsx/cjs/api");
const unregister = register();
const { db, pool } = require("../src/db/index.ts");
const { products, uploadedImages, siteSettings, reviews, productDeletions } = require("../src/db/schema.ts");
const { ensureSchema } = require("../src/lib/schema-migrate.ts");
const { mergeContent, DEFAULT_CONTENT } = require("../src/lib/site-content.ts");
const { DEFAULT_SITE_SETTINGS } = require("../src/lib/catalog.ts");

const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const report = { verified: 0, reused: 0, insertedImages: 0, products: 0, failures: [], pages: [] };
const imageCache = new Map();
const verifiedMappings = new Map();
let existingImages = [];
const failure = (scope, error) => { report.failures.push(`${scope}: ${error instanceof Error ? error.message : String(error)}`); };
const assign = (object, key, value) => { if (typeof value === "string" && value.trim()) object[key] = value.trim(); };
const mergeObserved = (target, values) => {
  for (const [key, value] of Object.entries(values || {})) {
    if (value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length)) continue;
    target[key] = value;
  }
};

async function fetchWithRetry(url, accept = "text/html") {
  let last;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": "mediterranic-public-mirror", Accept: accept }, signal: AbortSignal.timeout(25000), redirect: "error" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) { last = error; }
  }
  throw last;
}
async function htmlPage(route) {
  const response = await fetchWithRetry(BASE + route);
  const html = await response.text();
  if (!html.includes("</html>")) throw new Error(`${route}: incomplete HTML`);
  report.pages.push(route);
  return html;
}
function imageType(bytes, declared) {
  if (bytes.length < 12 || bytes.length > 25 * 1024 * 1024) return null;
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { mime: "image/png", ext: "png" };
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { mime: "image/jpeg", ext: "jpg" };
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (/^GIF8[79]a$/.test(bytes.toString("ascii", 0, 6))) return { mime: "image/gif", ext: "gif" };
  if (bytes.toString("ascii", 4, 8) === "ftyp" && /avif|avis/.test(bytes.toString("ascii", 8, 32))) return { mime: "image/avif", ext: "avif" };
  if (declared === "image/svg+xml" && /^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/.test(bytes.toString("utf8").slice(0, 300))) return { mime: "image/svg+xml", ext: "svg" };
  return null;
}

async function localiseImage(value) {
  const original = publicImagePath(value);
  if (!original) return value;
  const key = original.split("?")[0];
  if (imageCache.has(key)) return imageCache.get(key);
  const task = (async () => {
    const response = await fetchWithRetry(BASE + key, "image/*");
    const bytes = Buffer.from(await response.arrayBuffer());
    const type = imageType(bytes, (response.headers.get("content-type") || "").split(";")[0]);
    if (!type) throw new Error("response is not a supported photograph");
    const digest = sha256(bytes);
    const staticFile = path.resolve(process.cwd(), "public", "." + key);
    if (key.startsWith("/images/") && staticFile.startsWith(path.resolve(process.cwd(), "public/images") + path.sep) && fs.existsSync(staticFile) && sha256(fs.readFileSync(staticFile)) === digest) {
      report.reused++; report.verified++; verifiedMappings.set(key, key); return key;
    }
    const filename = `live:${source.hostname}:${key}:${digest}.${type.ext}`;
    const existing = existingImages.find((image) => image.filename === filename && sha256(Buffer.from(image.dataBase64, "base64")) === digest);
    let localId;
    if (existing) { localId = existing.id; report.reused++; }
    else {
      const [inserted] = await db.insert(uploadedImages).values({ filename, mimeType: type.mime, dataBase64: bytes.toString("base64") }).returning({ id: uploadedImages.id });
      localId = inserted.id;
      existingImages.push({ id: localId, filename, dataBase64: bytes.toString("base64") });
      report.insertedImages++;
    }
    const local = `/api/uploads/${localId}`;
    const stored = await db.select({ dataBase64: uploadedImages.dataBase64 }).from(uploadedImages).where(eq(uploadedImages.id, localId)).limit(1);
    if (!stored[0] || sha256(Buffer.from(stored[0].dataBase64, "base64")) !== digest) throw new Error("local byte verification failed");
    report.verified++;
    verifiedMappings.set(key, local);
    return local;
  })().catch((error) => { failure(key, error); return null; });
  imageCache.set(key, task);
  return task;
}

async function main() {
  await ensureSchema();
  existingImages = await db.select({ id: uploadedImages.id, filename: uploadedImages.filename, dataBase64: uploadedImages.dataBase64 }).from(uploadedImages);
  console.log(`→ ${BASE} → LOCAL sandbox only`);
  const sitemapResponse = await fetchWithRetry(BASE + "/sitemap.xml", "application/xml");
  const sitemap = await sitemapResponse.text();
  const slugs = new Set([...sitemap.matchAll(/\/shop\/([a-z0-9-]+)<\/loc>/g)].map((match) => match[1]));
  if (!slugs.size) throw new Error("Public sitemap has no specimens; refusing to treat this as an empty store.");
  let archiveVerified = false;
  const archived = new Set();
  try {
    const archive = await htmlPage("/archive");
    archiveVerified = true;
    for (const match of archive.matchAll(/href="\/shop\/([a-z0-9-]+)"/g)) { archived.add(match[1]); slugs.add(match[1]); }
  } catch (error) { failure("archive", error); }
  for (const route of ["/shop", "/featured"]) {
    try {
      const html = await htmlPage(route);
      for (const match of html.matchAll(/href="\/shop\/([a-z0-9-]+)"/g)) slugs.add(match[1]);
    } catch (error) { failure(route, error); }
  }

  const deletions = await db.select({ slug: productDeletions.slug }).from(productDeletions);
  const removedSlugs = new Set(deletions.map((record) => record.slug));
  for (const slug of slugs) {
    if (removedSlugs.has(slug)) { console.log(`  – ${slug}: explicitly deleted locally; not re-imported`); continue; }
    try {
      const html = await htmlPage(`/shop/${slug}`);
      const live = productFromHtml(html, slug);
      const [existing] = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
      const patch = {};
      assign(patch, "name", live.name);
      assign(patch, "description", live.description);
      assign(patch, "provenance", live.provenance);
      const specKeys = { Species: "species", Period: "period", Locality: "locality", Formation: "formation", Dimensions: "lengthMm", Length: "lengthMm", Preparation: "preparation" };
      for (const [label, key] of Object.entries(specKeys)) if (!(key === "lengthMm" && patch.lengthMm)) assign(patch, key, live.specs[label]);
      if (live.reference && /^(?:[A-Z]{2,6})?\d{4}$/.test(live.reference) && !/^(?:18|19|20)\d{2}$/.test(live.reference)) patch.specimenReference = live.reference;
      if (live.images) {
        const local = await Promise.all(live.images.map((image) => {
          const src = publicImagePath(image.src);
          return src ? localiseImage(src) : Promise.resolve(imageSafeExternal(image.src));
        }));
        if (local.every(Boolean)) patch.images = live.images.map((image, index) => ({ ...image, src: local[index] }));
        else failure(`${slug}:gallery`, "one or more photographs unverified; existing gallery kept");
      } else failure(`${slug}:gallery`, "public gallery not readable; existing gallery kept");
      const core = live.purchase;
      const validCore = core && core.slug === slug && Number.isInteger(core.priceCents) && core.priceCents >= 0 && Number.isInteger(core.stock) && core.stock >= 0 && [null, "direct", "ebay", "catawiki"].includes(core.listingChannel);
      if (validCore && !archived.has(slug)) {
        patch.priceCents = core.priceCents; patch.stock = core.stock; patch.listingChannel = core.listingChannel;
        if (typeof core.externalListingUrl === "string") patch.externalListingUrl = core.externalListingUrl || null;
      } else if (!validCore && !archived.has(slug)) failure(`${slug}:commerce`, "public price/channel unverified; local commerce data kept");
      if (archiveVerified) {
        patch.archived = archived.has(slug);
        if (patch.archived) { patch.stock = 0; patch.listingChannel = null; }
      }
      if (html.includes("certificate of authenticity and geological data card included")) patch.hasCertificate = true;
      if (existing) await db.update(products).set(patch).where(eq(products.id, existing.id));
      else await db.insert(products).values({
        slug, name: live.name || slug, species: live.specs.Species || "", category: "specimen", collection: "", collections: [],
        period: live.specs.Period || null, locality: live.specs.Locality || "", formation: live.specs.Formation || null,
        lengthMm: live.specs.Dimensions || live.specs.Length || null, preparation: live.specs.Preparation || "",
        priceCents: validCore ? core.priceCents : 0, stock: archived.has(slug) ? 0 : validCore ? core.stock : 0,
        listingChannel: archived.has(slug) ? null : validCore ? core.listingChannel : null,
        externalListingUrl: validCore && typeof core.externalListingUrl === "string" ? core.externalListingUrl : null,
        archived: archiveVerified ? archived.has(slug) : false, published: true, featured: false,
        shortDescription: (live.description || live.name || slug).slice(0, 180), description: live.description || "", provenance: live.provenance || "",
        images: patch.images || [], specimenReference: patch.specimenReference || null,
      });
      report.products++;
      for (const review of live.reviews) await mirrorReview(review, false);
      console.log(`  ✓ ${slug}: ${patch.images?.length ?? existing?.images.length ?? 0} photographs; commerce ${validCore || archived.has(slug) ? "verified" : "preserved/unverified"}`);
    } catch (error) { failure(slug, error); }
  }

  let settingsRow = (await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1))[0];
  if (!settingsRow) {
    await db.insert(siteSettings).values(DEFAULT_SITE_SETTINGS).onConflictDoNothing();
    settingsRow = (await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1))[0];
  }
  const content = mergeContent(settingsRow?.content || {});
  const settingsPatch = {};
  try {
    const html = await htmlPage("/");
    const live = homeFromHtml(html);
    const covers = {};
    for (const [key, src] of Object.entries(live.covers)) if (src) covers[key] = await localiseImage(src);
    const h = live.home;
    assign(content.home.hero, "title", h.heroTitle); assign(content.home.hero, "titleItalic", h.heroTitleItalic);
    assign(content.home.hero, "description", h.heroDescription); assign(content.home.hero, "caption", h.heroCaption);
    assign(content.home.hero, "primaryCta", h.heroPrimary); assign(content.home.hero, "secondaryCta", h.heroSecondary);
    if (covers.hero) content.home.hero.image = covers.hero;
    if (h.statLabels) for (const [index, key] of ["years", "feedbacks", "specimens", "eras"].entries()) assign(content.home.hero.stats, key, h.statLabels[index]);
    if (h.trust) content.home.trust.items = h.trust;
    if (h.channels) Object.assign(content.home.channels, h.channels);
    if (h.collections) for (const key of ["eyebrow", "title", "subtitle"]) assign(content.home.collections, key, h.collections[key]);
    const coverKeys = ["devonianCrown", "ordovicianMariners", "cambrianDawn", "connoisseur"];
    const collectionBySlug = { "devonian-crown": 0, "ordovician-mariners": 1, "cambrian-dawn": 2, "the-connoisseur": 3 };
    for (const card of h.collectionCards || []) {
      let index = card.index;
      try { const slug = new URL(card.href, BASE).searchParams.get("collection"); if (slug in collectionBySlug) index = collectionBySlug[slug]; } catch {}
      const key = coverKeys[index];
      if (!key) continue;
      if (card.src) { const local = await localiseImage(card.src); if (local) content.home.collections.covers[key] = local; }
      const target = content.home.collections.cards[key];
      assign(target, "title", key === "cambrianDawn" && card.title === "Souss Lagerstätte" ? DEFAULT_CONTENT.home.collections.cards.cambrianDawn.title : card.title);
      assign(target, "description", card.description);
      target.label = card.label;
      assign(target, "href", card.href);
    }
    if (h.featured) Object.assign(content.home.featured, h.featured);
    if (h.provenance) {
      mergeObserved(content.home.provenance, h.provenance);
      if (covers.provenance) content.home.provenance.image = covers.provenance;
    }
    if (h.testimonials) mergeObserved(content.home.testimonials, h.testimonials);
    if (h.links) {
      for (const key of ["eyebrow", "title", "description", "footnote"]) assign(content.home.links, key, h.links[key]);
      for (const [key, card] of Object.entries(h.links.cards || {})) if (content.home.links.cards[key]) mergeObserved(content.home.links.cards[key], card);
    }
    if (h.closing) mergeObserved(content.home.closing, h.closing);
    mergeObserved(content.header, live.header);
    if (live.header.nav) mergeObserved(content.header, live.header.nav);
    delete content.header.nav;
    mergeObserved(content.footer, live.footer);
    Object.assign(settingsPatch, live.settings);
    if (covers.logo) content.header.logoImage = covers.logo;
    if (covers.favicon) content.site.favicon = covers.favicon;
    if (settingsPatch.whatsappPhone) settingsPatch.whatsappPhone = "+" + settingsPatch.whatsappPhone;
    for (const box of content.home.marketplaces.boxes) {
      const key = box.id === "whatsapp" ? "whatsappPhone" : box.id + "Url";
      const value = settingsPatch[key] || settingsRow?.[key];
      if (value) box.url = box.id === "whatsapp" ? `https://wa.me/${String(value).replace(/\D/g, "")}` : value;
    }
    for (const review of live.reviews) await mirrorReview(review, true);
    const linkedHomeImages = Object.values(covers).filter(Boolean).length + (h.collectionCards || []).filter((card) => card.src).length;
    console.log(`  ✓ home: ${linkedHomeImages} hero/collection/logo photographs linked to saved content`);
  } catch (error) { failure("home", error); }

  try {
    const live = shippingFromHtml(await htmlPage("/shipping"));
    Object.assign(content.shipping, { eyebrow: live.eyebrow || content.shipping.eyebrow, intro: live.intro || content.shipping.intro });
    Object.assign(content.shipping, live.sections);
    if (typeof live.freeShipping === "boolean") content.commerce.freeShipping = live.freeShipping;
  } catch (error) { failure("shipping", error); }

  // Repair only references for which the original production bytes were verified.
  const repairedContent = replaceImageReferences(content, verifiedMappings);
  const mirrored = {
    heroEyebrow: repairedContent.home.hero.eyebrow, heroTitle: repairedContent.home.hero.title,
    heroTitleItalic: repairedContent.home.hero.titleItalic, heroDescription: repairedContent.home.hero.description,
    heroImage: repairedContent.home.hero.image, provenanceEyebrow: repairedContent.home.provenance.eyebrow,
    provenanceTitle: repairedContent.home.provenance.title, provenanceTitleItalic: repairedContent.home.provenance.titleItalic,
    provenanceBody: repairedContent.home.provenance.body, provenanceImage: repairedContent.home.provenance.image,
  };
  await db.update(siteSettings).set({ ...settingsPatch, ...mirrored, content: repairedContent, updatedAt: new Date() }).where(eq(siteSettings.id, 1));
  for (const row of await db.select({ id: products.id, images: products.images }).from(products)) {
    const images = replaceImageReferences(row.images, verifiedMappings);
    if (JSON.stringify(images) !== JSON.stringify(row.images)) await db.update(products).set({ images }).where(eq(products.id, row.id));
  }
  console.log(`\nMedia: ${report.verified} byte-verified references, ${report.insertedImages} new local uploads, ${report.reused} unchanged/reused.`);
  console.log(`Public mirror: ${report.products} specimens, ${report.pages.length} pages. Existing upload IDs were not overwritten.`);
  if (report.failures.length) {
    console.warn(`NOT VERIFIED (${report.failures.length}); existing local data was preserved:`);
    for (const item of report.failures) console.warn(`  ! ${item}`);
    process.exitCode = 2;
  }
  console.log("Private/admin-only fields are not exposed by public pages. Use Download backup for a complete private copy.");
}
function imageSafeExternal(src) { return typeof src === "string" && /^https:\/\//.test(src) ? src : null; }
async function mirrorReview(review, onHome) {
  if (!review.productSlug || !review.rating) return;
  const [product] = await db.select({ id: products.id }).from(products).where(eq(products.slug, review.productSlug)).limit(1);
  if (!product) return;
  const [existing] = await db.select().from(reviews).where(and(eq(reviews.productId, product.id), eq(reviews.authorName, review.authorName), eq(reviews.title, review.title), eq(reviews.body, review.body))).limit(1);
  if (existing) {
    // Never reverse a curator's rejection or pending decision during a mirror.
    if (onHome && (existing.moderationStatus === "approved" || existing.moderationStatus === null)) await db.update(reviews).set({ showOnHome: true }).where(eq(reviews.id, existing.id));
    return;
  }
  await db.insert(reviews).values({ productId: product.id, authorName: review.authorName, authorCountry: review.authorCountry || "", rating: review.rating, title: review.title, body: review.body, moderationStatus: "approved", moderatedAt: new Date(), showOnHome: onHome, verifiedPurchase: false });
}

main().catch((error) => { console.error("Mirror stopped:", error.message); process.exitCode = 1; }).finally(async () => { unregister(); await pool.end(); });
