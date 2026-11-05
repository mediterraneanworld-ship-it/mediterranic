/** Home copy: the million-year lines leave the cards, the ages sit once under them, and the wording is editable in the admin. Offline. */
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

const read = (file) => fs.readFileSync(file, "utf8");

test("no era date is printed on a home card; the Connoisseur card keeps its museum label", () => {
  const { COLLECTIONS } = load("src/lib/collections.ts");
  for (const c of COLLECTIONS) {
    if (c.slug === "the-connoisseur") assert.equal(c.homeLabel, "Museum grade");
    else assert.equal(c.homeLabel, undefined, c.slug);
  }
  const page = read("src/app/page.tsx");
  const cards = page.slice(page.indexOf("{/* Collections */}"), page.indexOf("{/* Featured */}"));
  assert.ok(!/\{c\.eyebrow\}/.test(cards), "the card no longer renders the era eyebrow");
  assert.match(cards, /\{c\.homeLabel && </);
});

test("the ages appear once, under the four cards, from the editable home.collections.ages", () => {
  const content = load("src/lib/site-content.ts");
  const ages = content.mergeContent({}).home.collections.ages;
  assert.match(ages, /Devonian · c\. 390–410 million years/);
  assert.match(ages, /Ordovician · c\. 450–480 million years/);
  assert.match(ages, /Cambrian · c\. 485–541 million years/);
  const page = read("src/app/page.tsx");
  const cards = page.slice(page.indexOf("{/* Collections */}"), page.indexOf("{/* Featured */}"));
  assert.match(cards, /\{c\.collections\.ages && \(/);
  assert.ok(cards.indexOf("c.collections.ages") > cards.indexOf("c.collections.covers") || cards.indexOf("c.collections.ages") > cards.indexOf("collections.map"), "rendered after the cards");
  assert.match(
    read("src/lib/site-content.ts"),
    /path: \["home", "collections", "ages"\],\s*label: "Text below the four cards \(geological ages\)",\s*type: "textarea"/,
  );
});

test("the hero opens with a neutral line; a stored copy of the old line is corrected on display only", () => {
  const content = load("src/lib/site-content.ts");
  const hero = content.mergeContent({}).home.hero;
  assert.equal(hero.title, "Moroccan trilobites,");
  assert.equal(hero.titleItalic, "in your keeping.");
  const publicCopy = load("src/lib/public-copy.ts");
  const stored = {
    home: { hero: { title: "Five hundred million years,", titleItalic: "in your keeping." } },
    typed: "Five hundred million years, in your keeping. (written by the curator)",
  };
  const out = publicCopy.safeContent(stored);
  assert.equal(out.home.hero.title, "Moroccan trilobites,");
  assert.equal(out.home.hero.titleItalic, "in your keeping.");
  assert.equal(out.typed, stored.typed, "a sentence the curator types is kept");
  assert.equal(stored.home.hero.title, "Five hundred million years,", "the stored input is not mutated");
  assert.equal(publicCopy.safeContent({ key: "constructor" }).key, "constructor", "no prototype lookups");
});

test("legacy settings seeds no longer carry the old hero line", () => {
  assert.ok(!/million/.test(read("src/lib/seed-settings.ts")));
  assert.ok(!/Five hundred million years/.test(read("src/lib/catalog.ts")));
});

test("version 2026-11-05-y records the change", () => {
  const v = load("src/lib/version.ts", {
    "@/lib/site-url": { PUBLIC_SITE_URL: "https://mediterranic.vercel.app", PUBLIC_SITE_URL_SOURCE: "default" },
  });
  assert.equal(v.CODE_VERSION, "2026-11-05-y");
  for (const feature of ["home-million-years-lines-retired", "collections-ages-below-cards", "hero-title-neutral"]) {
    assert.ok(v.REQUIRED_FEATURES.includes(feature), feature);
  }
});
