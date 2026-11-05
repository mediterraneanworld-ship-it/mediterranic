/** Round aa: hero eyebrow and geological ages retired, compact link cards, 16px form fields on phones, phone list for shipping rates. Offline. */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");

const read = (file) => fs.readFileSync(file, "utf8");

test("the hero opens on the title: the eyebrow line is not rendered or editable", () => {
  const page = read("src/app/page.tsx");
  assert.ok(!/\{c\.hero\.eyebrow\}/.test(page), "no eyebrow in the hero markup");
  assert.ok(!/tracking-\[0\.42em\]/.test(page.slice(page.indexOf("Hero"), page.indexOf("Trust strip"))), "no eyebrow line in the hero");
  assert.ok(!/path: \["home", "hero", "eyebrow"\]/.test(read("src/lib/site-content.ts")), "not an editable field");
  assert.match(page, /<h1\s+className="animate-fade-up font-display/);
});

test("the link section uses compact rows: no full-colour block, six rows, same grid and order", () => {
  const page = read("src/app/page.tsx");
  const section = page.slice(page.indexOf('id="links"'), page.indexOf("{/* Closing CTA */}"));
  assert.match(section, /mt-12 grid gap-4 sm:grid-cols-2"/);
  assert.equal((section.match(/px-5 py-3\.5/g) || []).length, 6, "six compact rows");
  assert.ok(!/\bp-6\b/.test(section), "no tall padded cards");
  assert.ok(!/className="(ebay-quad|cw-grad|ig-grad|fb-grad|wa-grad) group/.test(section), "no full-colour card background");
  // Markers of each row's own markup (the section comment also mentions Instagram and WhatsApp).
  const order = [">eBay store<", 'alt="Catawiki"', ">Verified rating<", ">Instagram<", ">Facebook<", ">WhatsApp<"].map((t) => section.indexOf(t));
  assert.ok(order.every((index) => index > 0), "every row is present");
  assert.ok(order.every((index, i) => i === 0 || index > order[i - 1]), "rows keep their order");
});

test("the geological ages line is gone from the home page", () => {
  assert.ok(!/c\.collections\.ages/.test(read("src/app/page.tsx")));
});

test("form fields are 16px on phones so iPhone Safari does not zoom the page when they are tapped", () => {
  const css = read("src/app/globals.css");
  const rule = css.slice(css.indexOf("@media (max-width: 767px)"));
  assert.match(rule, /input:not\(\[type="checkbox"\]\)/);
  assert.match(rule, /select,\s*textarea/);
  assert.match(rule, /font-size: 16px !important;/);
});

test("shipping rates: phones get one card per region; the table is only from 640px up and never scrolls sideways on a phone", () => {
  const page = read("src/app/shipping/page.tsx");
  assert.match(page, /<ul className="mt-4 divide-y divide-ink\/10 rounded-sm border border-ink\/12 bg-white\/70 px-4 sm:hidden">/);
  assert.match(page, /<div className="mt-4 hidden overflow-x-auto rounded-sm border border-ink\/12 bg-white\/70 sm:block">/);
  assert.match(page, /<summary className="cursor-pointer">Countries<\/summary>/);
});

test("sync from production no longer expects the retired eyebrow", () => {
  const mirror = read("scripts/pull-live.cjs");
  assert.ok(!/hero_eyebrow=\$1/.test(mirror));
  assert.match(mirror, /if \(heroBlock\) \{/);
});

test("version 2026-11-05-aa lists this round's features", () => {
  const v = read("src/lib/version.ts");
  assert.match(v, /export const CODE_VERSION = "2026-11-05-aa";/);
  for (const feature of ["hero-eyebrow-retired", "collection-ages-retired", "links-compact-cards", "mobile-form-text-16px", "shipping-table-stacked-phone"]) {
    assert.ok(v.includes(`"${feature}"`), feature);
  }
});
