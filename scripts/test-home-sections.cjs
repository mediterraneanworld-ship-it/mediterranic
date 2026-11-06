/** Tests for the H0–H13 home sections model and reordering logic. Offline. */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, imports = {}) {
  const module = { exports: {} };
  const context = vm.createContext({
    module,
    exports: module.exports,
    require: (name) => {
      if (name in imports) return imports[name];
      throw Error("Unexpected import " + name + " in " + file);
    },
    process: { env: {} },
    console,
  });
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  vm.runInContext(js, context);
  return module.exports;
}

const hs = load("src/lib/home-sections.ts");
const content = load("src/lib/site-content.ts", {
  "@/lib/home-sections": hs,
});

test("home sections are exactly 14, H0 to H13", () => {
  assert.equal(hs.HOME_SECTIONS.length, 14);
  assert.equal(hs.HOME_SECTIONS[0].number, "H0");
  assert.equal(hs.HOME_SECTIONS[0].id, "h0");
  assert.equal(hs.HOME_SECTIONS[13].number, "H13");
  assert.equal(hs.HOME_SECTIONS[13].id, "h13");
});

test("H0, H1 and H13 are fixed frame; H2 to H12 are movable", () => {
  assert.equal(hs.HOME_SECTIONS[0].fixed, "top");
  assert.equal(hs.HOME_SECTIONS[1].fixed, "top");
  assert.equal(hs.HOME_SECTIONS[13].fixed, "bottom");
  assert.equal(hs.MOVABLE_HOME_SECTIONS.length, 11);
  for (const id of ["h2", "h3", "h4", "h5", "h6", "h7", "h8", "h9", "h10", "h11", "h12"]) {
    assert.ok(hs.MOVABLE_HOME_SECTIONS.includes(id), id);
  }
});

test("normalizeHomeOrder always preserves H0/H1 at the start and H13 at the end", () => {
  const custom = ["h6", "h2", "h12"];
  const out = hs.normalizeHomeOrder(custom);
  assert.equal(out[0], "h0");
  assert.equal(out[1], "h1");
  assert.equal(out[out.length - 1], "h13");
  // Custom movable items come first in their requested order
  assert.equal(out[2], "h6");
  assert.equal(out[3], "h2");
  assert.equal(out[4], "h12");
  // Missing movable items are appended, never dropped
  assert.equal(out.length, 14);
});

test("moveHomeSection moves a block before target", () => {
  const order = hs.DEFAULT_HOME_ORDER;
  const next = hs.moveHomeSection(order, "h6", "h2");
  const middle = next.slice(2, -1);
  assert.equal(middle[0], "h6");
  assert.equal(middle[1], "h2");
});

test("moveHomeSectionBy moves up and down within movable range", () => {
  const order = hs.DEFAULT_HOME_ORDER;
  const up = hs.moveHomeSectionBy(order, "h4", -1);
  const upMiddle = up.slice(2, -1);
  assert.equal(upMiddle[1], "h4"); // was at index 2 (h2, h3, h4) -> now index 1
  const down = hs.moveHomeSectionBy(order, "h4", 1);
  const downMiddle = down.slice(2, -1);
  assert.equal(downMiddle[3], "h4"); // moved one down
});

test("CONTENT_GROUPS declares fields for every home section H0 to H13", () => {
  const ids = content.CONTENT_GROUPS.map((g) => g.id);
  for (let i = 0; i <= 13; i += 1) {
    assert.ok(ids.includes(`h${i}`), `missing content group for h${i}`);
  }
});

test("default content carries default layout.home order", () => {
  const merged = content.mergeContent({});
  assert.deepEqual(merged.layout.home, hs.DEFAULT_HOME_ORDER);
});

test("H2 hero sequence from top to bottom: photograph, caption, buttons, title, description", () => {
  const page = fs.readFileSync("src/app/page.tsx", "utf8");
  const hero = page.slice(page.indexOf("// {/* Hero */}"), page.indexOf("h3: ("));
  const photo = hero.indexOf("animate-kenburns object-cover");
  const caption = hero.indexOf("{c.hero.caption}");
  const buttons = hero.indexOf("{c.hero.primaryCta}");
  const title = hero.indexOf("{c.hero.title}");
  const desc = hero.indexOf("{c.hero.description}");

  assert.ok(photo >= 0, "photograph is in hero");
  assert.ok(caption >= 0, "caption is in hero");
  assert.ok(buttons >= 0, "buttons are in hero");
  assert.ok(title >= 0, "title is in hero");
  assert.ok(desc >= 0, "description is in hero");

  assert.ok(photo < caption, "photograph is before caption");
  assert.ok(caption < buttons, "caption is before buttons");
  assert.ok(buttons < title, "buttons are before title");
  assert.ok(title < desc, "title is before description");
});

test("each H box in Tab 5 admin editor has its own Save changes button", () => {
  const editor = fs.readFileSync("src/components/admin-content-editor.tsx", "utf8");
  assert.match(editor, /Save changes to <strong>\{meta\.number\}/);
  assert.match(editor, /Save changes/);
  assert.match(editor, /onClick=\{handleSave\}/);
});

test("H9 marketplace boxes support custom cards with logos, drag & reorder, and preserve eBay quad colors and Catawiki logo", () => {
  const merged = content.mergeContent({});
  const boxes = merged.home.marketplaces.boxes;
  assert.ok(Array.isArray(boxes) && boxes.length >= 2, "marketplaces has default boxes");
  const ebayBox = boxes.find((b) => b.id === "ebay");
  const catawikiBox = boxes.find((b) => b.id === "catawiki");
  assert.ok(ebayBox, "eBay box exists");
  assert.equal(ebayBox.bgColor, "ebay-quad", "eBay quad colors preserved");
  assert.ok(catawikiBox, "Catawiki box exists");
  assert.equal(catawikiBox.logo, "/images/catawiki-logo-white.svg", "Catawiki white logo preserved");
  assert.equal(catawikiBox.bgColor, "cw-grad", "Catawiki blue gradient preserved");

  const editor = fs.readFileSync("src/components/admin-content-editor.tsx", "utf8");
  assert.match(editor, /Marketplace Boxes &amp; Links/);
  assert.match(editor, /Add marketplace box/);
  assert.match(editor, /moveMarketplaceBox/);
  assert.match(editor, /ebay-quad/);
});

test("H10 reviews rotator supports 2 side by side on mobile and 3 on desktop with random rotation", () => {
  const page = fs.readFileSync("src/app/page.tsx", "utf8");
  assert.match(page, /<HomeReviewsRotator/);
  const rotator = fs.readFileSync("src/components/home-reviews-rotator.tsx", "utf8");
  assert.match(rotator, /grid-cols-2.*lg:grid-cols-3/);
  assert.match(rotator, /Math\.random\(\)\s*-\s*0\.5/);
});

test("Admin Tab 6 reviews API and UI allow curator to write real reviews", () => {
  const api = fs.readFileSync("src/app/api/admin/reviews/route.ts", "utf8");
  assert.match(api, /export async function POST/);
  assert.match(api, /moderationStatus:\s*"approved"/);
  const panel = fs.readFileSync("src/components/admin-review-moderation.tsx", "utf8");
  assert.match(panel, /Write real review/);
  assert.match(panel, /Show on home page/);
});

test("Admin Tab 5 H sections are collapsed by default", () => {
  const editor = fs.readFileSync("src/components/admin-content-editor.tsx", "utf8");
  assert.match(editor, /const \[openSections, setOpenSections\] = useState<Record<string, boolean>>\(\{\}\);/);
});

test("H6 collection card Cambrian reads 'The Cambrian Explosion' in collections and content", () => {
  const { COLLECTIONS } = load("src/lib/collections.ts");
  const cambrian = COLLECTIONS.find((c) => c.slug === "cambrian-dawn");
  assert.equal(cambrian?.title, "The Cambrian Explosion");

  const merged = content.mergeContent({});
  assert.equal(merged.home.collections.cards.cambrianDawn.title, "The Cambrian Explosion");
});

test("H6 home collection cards place letters below the box images", () => {
  const page = fs.readFileSync("src/app/page.tsx", "utf8");
  const h6Section = page.slice(page.indexOf("// {/* Collections */}"), page.indexOf("// {/* Featured */}"));
  // Image box precedes text box in DOM order
  const imgBoxIdx = h6Section.indexOf("relative aspect-[4/3]");
  const textBoxIdx = h6Section.indexOf("{c.title}");
  assert.ok(imgBoxIdx >= 0, "image box exists");
  assert.ok(textBoxIdx >= 0, "text block exists");
  assert.ok(imgBoxIdx < textBoxIdx, "image is placed above the text block");
});
