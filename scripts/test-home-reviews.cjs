/** Regression checks for this release: home page reviews chosen by the curator, the Cyphaspis cover and the newsletter photos. Offline. */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, { imports = {}, env = {} } = {}) {
  const module = { exports: {} };
  const context = vm.createContext({
    module,
    exports: module.exports,
    require: (name) => {
      if (name in imports) return imports[name];
      throw Error("Unexpected import " + name + " in " + file);
    },
    process: { env },
    Buffer,
    URL,
    URLSearchParams,
    AbortSignal,
    Response,
    console,
    setTimeout,
    clearTimeout,
  });
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  vm.runInContext(js, context);
  return module.exports;
}

test("home picks: at most six public reviews, never an unpublished one, removal always allowed", () => {
  const home = load("src/lib/home-reviews.ts");
  assert.equal(home.HOME_REVIEW_LIMIT, 6);
  assert.equal(home.HOME_REVIEW_AUTOMATIC, 3);

  const unpublished = home.decideHomePick({ requested: true, publicNow: false, alreadyPicked: false, pickedElsewhere: 0 });
  assert.equal(unpublished.ok, false);
  assert.match(unpublished.error, /Publish this review/);

  const full = home.decideHomePick({ requested: true, publicNow: true, alreadyPicked: false, pickedElsewhere: 6 });
  assert.equal(full.ok, false);
  assert.match(full.error, /up to 6 reviews/);

  const sixth = home.decideHomePick({ requested: true, publicNow: true, alreadyPicked: false, pickedElsewhere: 5 });
  assert.equal(sixth.ok, true);
  assert.equal(sixth.showOnHome, true);

  const alreadyIn = home.decideHomePick({ requested: true, publicNow: true, alreadyPicked: true, pickedElsewhere: 6 });
  assert.equal(alreadyIn.ok, true);
  assert.equal(alreadyIn.showOnHome, true);

  const removed = home.decideHomePick({ requested: false, publicNow: false, alreadyPicked: true, pickedElsewhere: 6 });
  assert.equal(removed.ok, true);
  assert.equal(removed.showOnHome, false);
});

test("a review keeps its home place only while it is approved", () => {
  const home = load("src/lib/home-reviews.ts");
  assert.equal(home.homePickSurvivesStatus("approved"), true);
  assert.equal(home.homePickSurvivesStatus("rejected"), false);
  assert.equal(home.homePickSurvivesStatus("pending"), false);
});

test("home page reads the curator's choice; the automatic rule is kept as the fallback", () => {
  const page = fs.readFileSync("src/app/page.tsx", "utf8");
  assert.match(page, /getHomeTestimonials\(\)/);
  assert.ok(!/getTopReviews\(3\)/.test(page));
  const catalog = fs.readFileSync("src/lib/catalog.ts", "utf8");
  assert.match(catalog, /export async function getHomeTestimonials/);
  assert.match(catalog, /eq\(reviews\.showOnHome, true\), publicReviews\(\)/);
  assert.match(catalog, /if \(picked\.length > 0\) return picked;\s*return getTopReviews\(HOME_REVIEW_AUTOMATIC\);/);
});

test("admin API: show or remove a public review on the home page; moderation never deletes", () => {
  const api = fs.readFileSync("src/app/api/admin/reviews/route.ts", "utf8");
  assert.match(api, /typeof body\.showOnHome === "boolean"/);
  assert.match(api, /decideHomePick\(\{/);
  assert.match(api, /homePickSurvivesStatus\(next\)/);
  assert.match(api, /home: \{ selected: Number\(picked\?\.value \?\? 0\), limit: HOME_REVIEW_LIMIT, automatic: HOME_REVIEW_AUTOMATIC \}/);
  assert.ok(!/export async function DELETE/.test(api), "no review is ever deleted");
});

test("admin moderation panel: Show on home page and Remove from home page, with the summary", () => {
  const panel = fs.readFileSync("src/components/admin-review-moderation.tsx", "utf8");
  assert.match(panel, /Show on home page/);
  assert.match(panel, /Remove from home page/);
  assert.match(panel, /setHomePick\(review, true\)/);
  assert.match(panel, /Home page reviews:/);
  assert.ok(!/<\/?replacement>/.test(panel), "no stray edit markers in the component");
});

test("schema: show_on_home is additive and defaults to off", () => {
  const schema = fs.readFileSync("src/db/schema.ts", "utf8");
  assert.match(schema, /showOnHome: boolean\("show_on_home"\)\.notNull\(\)\.default\(false\)/);
  const migrate = fs.readFileSync("src/lib/schema-migrate.ts", "utf8");
  assert.match(migrate, /ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "show_on_home" boolean DEFAULT false NOT NULL;/);
});

test("cover: The Connoisseur shows the Cyphaspis photograph with glass, shipped with public/", () => {
  const content = fs.readFileSync("src/lib/site-content.ts", "utf8");
  assert.match(content, /connoisseur: "\/covers\/connoisseur-cyphaspis\.jpg"/);
  const collections = fs.readFileSync("src/lib/collections.ts", "utf8");
  assert.match(collections, /cover: "\/covers\/connoisseur-cyphaspis\.jpg"/);
  const release = fs.readFileSync("src/lib/release-info.ts", "utf8");
  assert.match(release, /CONNOISSEUR_GLASS_IMAGE = "\/covers\/connoisseur-cyphaspis\.jpg"/);
  assert.ok(fs.statSync("src/assets/connoisseur-cyphaspis-glass.jpg").size > 20000, "the cover is bundled in src/assets");
});

test("newsletter photos travel inline (cid); a photo that cannot be shrunk never cancels the mailing", () => {
  const nl = fs.readFileSync("src/lib/newsletter-send.ts", "utf8");
  assert.match(nl, /src="cid:\$\{inlined\.contentId\}"/);
  assert.match(nl, /async function shrinkForEmail/);
  assert.match(nl, /await import\("sharp"\)/);
  assert.match(nl, /MAX_UNSHRUNK_BYTES/);
  assert.ok(!/^import sharp from/m.test(nl), "sharp loads only when a photo is shrunk");
  assert.match(nl, /quarries and preparators\./);
  const mail = fs.readFileSync("src/lib/mailer.ts", "utf8");
  assert.match(mail, /content_id: a\.contentId/);
});

test("version manifest and SOS handover name this release, the home picker and the new cover", () => {
  const v = load("src/lib/version.ts");
  assert.equal(v.CODE_VERSION, "2026-11-05-aa");
  for (const feature of ["home-reviews-picker", "connoisseur-cyphaspis-glass", "newsletter-inline-images", "review-moderation", "sos-handover-page"]) {
    assert.ok(v.REQUIRED_FEATURES.includes(feature), feature);
  }
  const ctx = fs.readFileSync("src/lib/sos-context.ts", "utf8");
  assert.match(ctx, /covers\/connoisseur-cyphaspis\.jpg/);
  assert.match(ctx, /Show on home page/);
});

test("deploy notes no longer point the external cron at the dead subdomain", () => {
  const guide = fs.readFileSync("GUIA-PUBLICACAO.md", "utf8");
  assert.ok(!/shop\.mediterranic\.com/.test(guide));
  assert.ok(!/NEXT_PUBLIC_SITE_URL/.test(guide));
});
