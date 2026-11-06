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
      if (name === "@/lib/home-sections" || name === "./home-sections") return load("src/lib/home-sections.ts");
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

test("the geological ages line is retired: empty by default, never rendered, not editable", () => {
  const content = load("src/lib/site-content.ts");
  assert.equal(content.mergeContent({}).home.collections.ages, "");
  const page = read("src/app/page.tsx");
  assert.ok(!/c\.collections\.ages/.test(page), "the ages line is not rendered anywhere");
  assert.ok(!/path: \["home", "collections", "ages"\]/.test(read("src/lib/site-content.ts")), "not an editable field");
});

test("the hero opens with the curator's line, shown exactly as saved", () => {
  const content = load("src/lib/site-content.ts");
  const hero = content.mergeContent({}).home.hero;
  assert.equal(hero.title, "Five hundred million years,");
  assert.equal(hero.titleItalic, "in your keeping.");
  const publicCopy = load("src/lib/public-copy.ts");
  const stored = {
    home: { hero: { title: "Five hundred million years,", titleItalic: "in your keeping." } },
    typed: "Five hundred million years, in your keeping. (written by the curator)",
  };
  const out = publicCopy.safeContent(stored);
  assert.equal(out.home.hero.title, "Five hundred million years,");
  assert.equal(out.home.hero.titleItalic, "in your keeping.");
  assert.equal(out.typed, stored.typed, "a sentence the curator types is kept");
  assert.equal(stored.home.hero.title, "Five hundred million years,", "the stored input is not mutated");
  assert.equal(publicCopy.safeContent({ home: { hero: { title: "Ancient seafloors," } } }).home.hero.title, "Ancient seafloors,", "typed text is shown as written");
  assert.equal(publicCopy.safeContent({ key: "constructor" }).key, "constructor", "no prototype lookups");
});

test("legacy settings seeds no longer carry the old hero line", () => {
  assert.ok(!/million/.test(read("src/lib/seed-settings.ts")));
  assert.ok(!/Five hundred million years/.test(read("src/lib/catalog.ts")));
});

test("version 2026-11-05-am records the change", () => {
  const v = load("src/lib/version.ts", {
    "@/lib/site-url": { PUBLIC_SITE_URL: "https://mediterranic.vercel.app", PUBLIC_SITE_URL_SOURCE: "default" },
  });
  assert.equal(v.CODE_VERSION, "2026-11-05-am");
  for (const feature of ["home-million-years-lines-retired", "collections-ages-below-cards", "hero-line-as-saved"]) {
    assert.ok(v.REQUIRED_FEATURES.includes(feature), feature);
  }
});
