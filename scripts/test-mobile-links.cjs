/** Round ab: home spacing, coloured compact link rows whose labels never wrap, footer gap, retired lines, phone form sizes and version. Offline. */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");

const read = (file) => fs.readFileSync(file, "utf8");

test("the hero opens close under the header: no forced minimum height, small top padding", () => {
  const page = read("src/app/page.tsx");
  const hero = page.slice(page.indexOf("{/* Hero */}"), page.indexOf("{/* Trust strip */}"));
  assert.ok(!/min-h-\[620px\]|min-h-\[calc\(100svh/.test(hero), "no forced minimum height");
  assert.match(hero, /\bpt-6\b/);
  assert.match(hero, /lg:pt-8\b/);
  assert.ok(!/\{c\.hero\.eyebrow\}/.test(page), "eyebrow line retired");
  assert.match(page, /<h1\s+className="animate-fade-up font-display/);
});

test("sections start closer to the previous one: channels, collections and links", () => {
  const page = read("src/app/page.tsx");
  assert.match(page, /<section className="border-b border-ink\/10 bg-parchment pb-16 pt-8 md:pt-10">/);
  assert.match(page, /<section className="mx-auto max-w-7xl px-5 pb-16 pt-10 md:pb-28 md:pt-20 lg:px-8">/);
  assert.match(page, /<section id="links" className="border-t border-ink\/10 bg-bone\/50 pb-24 pt-14 md:pt-16">/);
});

test("the space above the footer is about half of before: closing section bottom plus footer margin", () => {
  const page = read("src/app/page.tsx");
  assert.match(page, /<section className="mx-auto max-w-7xl px-5 pb-8 pt-16 text-center md:pb-14 md:pt-28 lg:px-8">/);
  assert.match(read("src/components/site-footer.tsx"), /<footer className="mt-16 bg-midnight text-parchment\/80">/);
});

test("link rows keep the brand colours and patterns in compact boxes (about 70px)", () => {
  const page = read("src/app/page.tsx");
  const section = page.slice(page.indexOf('id="links"'), page.indexOf("{/* Closing CTA */}"));
  assert.match(section, /mt-12 grid gap-4 sm:grid-cols-2"/);
  assert.equal((section.match(/px-5 py-3\.5/g) || []).length, 6, "six compact rows");
  assert.ok(!/\bp-6\b/.test(section), "no tall padded cards");
  for (const brand of ["ebay-quad", "cw-grad", "ig-grad", "fb-grad", "wa-grad"]) {
    assert.match(section, new RegExp(`className="${brand} group`), brand);
  }
  assert.match(section, /border-brass\/50 bg-brass\/10/, "rating card keeps its brass tint");
  assert.match(section, /<Image src="\/images\/catawiki-logo-white\.svg"[^>]*className="mt-1 h-5 w-auto/);
});

test("labels and titles never wrap; descriptions only show from 1024px so boxes never grow", () => {
  const page = read("src/app/page.tsx");
  const section = page.slice(page.indexOf('id="links"'), page.indexOf("{/* Closing CTA */}"));
  assert.equal((section.match(/whitespace-nowrap text-\[10px\]/g) || []).length, 6, "six labels: Auctions and WhatsApp included");
  assert.equal((section.match(/whitespace-nowrap font-display text-xl/g) || []).length, 5, "five titles");
  assert.equal((section.match(/hidden whitespace-nowrap text-xs text-(white\/85|ink\/60) lg:block/g) || []).length, 6, "six descriptions, hidden below lg");
  assert.ok(section.includes('>Auctions</p>') && section.includes('>WhatsApp</p>'), "the two reported words are present");
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

test("shipping rates: phones get one card per region; the table only shows from 640px up", () => {
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

test("version 2026-11-05-af lists this round's features", () => {
  const v = read("src/lib/version.ts");
  assert.match(v, /export const CODE_VERSION = "2026-11-05-af";/);
  for (const feature of ["hero-moved-up", "home-sections-tightened", "link-cards-coloured-compact", "labels-one-line", "footer-gap-halved"]) {
    assert.ok(v.includes(`"${feature}"`), feature);
  }
});
