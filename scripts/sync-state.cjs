/**
 * Single safe command for the back-office workflow.
 *
 *   node scripts/sync-state.cjs https://<preview-url>
 *
 * 1. Captures the live settings and catalogue into src/lib/seed-settings.ts
 *    and src/lib/seed-data.ts (the source of truth).
 * 2. Applies the captured settings to the local database, which is what seeds
 *    the preview runtime on every deployment.
 *
 * Run this after any edit made in /admin and before rebuilding.
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const BASE = process.argv[2];
if (!BASE) {
  console.error("usage: node scripts/sync-state.cjs https://<preview-url>");
  process.exit(1);
}

(async () => {
  // ---------- 1. capture live -> code ----------
  const settingsRes = await fetch(`${BASE}/api/admin/settings`);
  if (!settingsRes.ok) throw new Error(`settings: HTTP ${settingsRes.status}`);
  const { settings } = await settingsRes.json();

  fs.writeFileSync(
    path.join(process.cwd(), "src/lib/seed-settings.ts"),
    `import type { SiteSettings } from "@/lib/catalog";

/**
 * The storefront copy, marketplace links and trust signals, as last saved in
 * the back-office. This file is the source of truth: the live database is
 * re-seeded from it on every deployment, so anything saved in the admin must
 * be captured here before a rebuild or it will be lost.
 */
export const SEED_SETTINGS: Omit<SiteSettings, "updatedAt"> = {
  id: 1,
  heroEyebrow: ${JSON.stringify(settings.heroEyebrow)},
  heroTitle: ${JSON.stringify(settings.heroTitle)},
  heroTitleItalic: ${JSON.stringify(settings.heroTitleItalic)},
  heroDescription: ${JSON.stringify(settings.heroDescription)},
  provenanceEyebrow: ${JSON.stringify(settings.provenanceEyebrow)},
  provenanceTitle: ${JSON.stringify(settings.provenanceTitle)},
  provenanceTitleItalic: ${JSON.stringify(settings.provenanceTitleItalic)},
  provenanceBody: ${JSON.stringify(settings.provenanceBody)},
  yearsExperience: ${settings.yearsExperience},
  feedbacksLabel: ${JSON.stringify(settings.feedbacksLabel)},
  ebayUrl: ${JSON.stringify(settings.ebayUrl)},
  catawikiUrl: ${JSON.stringify(settings.catawikiUrl)},
  instagramUrl: ${JSON.stringify(settings.instagramUrl)},
  facebookUrl: ${JSON.stringify(settings.facebookUrl)},
  contactEmail: ${JSON.stringify(settings.contactEmail)},
  trustamiUrl: ${JSON.stringify(settings.trustamiUrl)},
  trustamiRating: ${JSON.stringify(settings.trustamiRating)},
  trustamiRatings: ${JSON.stringify(settings.trustamiRatings)},
  whatsappPhone: ${JSON.stringify(settings.whatsappPhone)},
  heroImage: ${JSON.stringify(settings.heroImage)},
  provenanceImage: ${JSON.stringify(settings.provenanceImage)},
};
`,
  );
  console.log("1/2  settings captured -> src/lib/seed-settings.ts");

  const productsRes = await fetch(`${BASE}/api/admin/products-export`);
  if (!productsRes.ok) throw new Error(`products: HTTP ${productsRes.status}`);
  const { products } = await productsRes.json();

  const q = (v) => (v === null || v === undefined ? "null" : JSON.stringify(v));
  const items = products
    .map(
      (p) => `  {
    slug: ${q(p.slug)},
    name: ${q(p.name)},
    species: ${q(p.species)},
    category: ${q(p.category)},
    collection: ${q(p.collection)},
    collections: ${JSON.stringify(p.collections)},
    period: ${q(p.period)},
    locality: ${q(p.locality)},
    formation: ${q(p.formation)},
    lengthMm: ${p.lengthMm ?? "null"},
    preparation: ${q(p.preparation)},
    priceCents: ${p.priceCents},
    compareAtCents: ${p.compareAtCents ?? "null"},
    stock: ${p.stock},
    featured: ${p.featured},
    published: ${p.published},
    hasCertificate: ${p.hasCertificate},
    listingChannel: ${q(p.listingChannel)},
    externalListingUrl: ${q(p.externalListingUrl)},
    videoUrl: ${q(p.videoUrl)},
    shortDescription: ${q(p.shortDescription)},
    description: ${q(p.description)},
    provenance: ${q(p.provenance)},
    images: ${JSON.stringify(p.images)},
  },`,
    )
    .join("\n");

  const head = fs
    .readFileSync(path.join(process.cwd(), "src/lib/seed-data.ts"), "utf8")
    .split("export const SEED_PRODUCTS")[0];
  fs.writeFileSync(
    path.join(process.cwd(), "src/lib/seed-data.ts"),
    head +
      "export const SEED_PRODUCTS: NewProduct[] = [\n" +
      items +
      "\n];\n\n/** Reviews are only ever genuine client submissions stored in the database. */\nexport const SEED_REVIEWS: SeedReview[] = [];\n",
  );
  console.log(`     catalogue captured -> src/lib/seed-data.ts (${products.length} pieces)`);

  // ---------- 2. apply captured settings -> local database ----------
  const c = new Client({ connectionString: "postgresql://postgres:postgres@127.0.0.1:5432/app_db" });
  await c.connect();
  await c.query(
    `UPDATE site_settings SET
      hero_eyebrow=$1, hero_title=$2, hero_title_italic=$3, hero_description=$4,
      provenance_eyebrow=$5, provenance_title=$6, provenance_title_italic=$7, provenance_body=$8,
      years_experience=$9, feedbacks_label=$10, ebay_url=$11, catawiki_url=$12,
      instagram_url=$13, facebook_url=$14, contact_email=$15, trustami_url=$16,
      trustami_rating=$17, trustami_ratings=$18, whatsapp_phone=$19,
      hero_image=$20, provenance_image=$21, updated_at=now()
     WHERE id=1`,
    [
      settings.heroEyebrow, settings.heroTitle, settings.heroTitleItalic, settings.heroDescription,
      settings.provenanceEyebrow, settings.provenanceTitle, settings.provenanceTitleItalic,
      settings.provenanceBody, settings.yearsExperience, settings.feedbacksLabel, settings.ebayUrl,
      settings.catawikiUrl, settings.instagramUrl, settings.facebookUrl, settings.contactEmail,
      settings.trustamiUrl, settings.trustamiRating, settings.trustamiRatings,
      settings.whatsappPhone, settings.heroImage, settings.provenanceImage,
    ],
  );
  await c.end();
  console.log("2/2  settings applied to the local database");
  console.log("\nSafe to rebuild now.");
})().catch((error) => {
  console.error("sync failed:", error.message);
  process.exit(1);
});
