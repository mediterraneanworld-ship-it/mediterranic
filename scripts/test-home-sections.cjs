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
