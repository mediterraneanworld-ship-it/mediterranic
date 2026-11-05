/** Shipping by weight class and region, the back-office table and the cover address. Offline checks. */
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
const shipping = load("src/lib/shipping.ts");
const table = () => shipping.defaultShippingTable();

test("weight classes are inclusive and an unknown weight falls in the heaviest class", () => {
  const t = table();
  const classOf = (grams) => shipping.classForWeight(t, grams).id;
  assert.equal(classOf(0), 1);
  assert.equal(classOf(500), 1);
  assert.equal(classOf(501), 2);
  assert.equal(classOf(1000), 2);
  assert.equal(classOf(1001), 3);
  assert.equal(classOf(2000), 3);
  assert.equal(classOf(2001), 4);
  assert.equal(classOf(null), 4);
  assert.equal(classOf(-5), 4);
  assert.equal(classOf(Number.NaN), 4);
});

test("labels are derived from the limits and follow any change", () => {
  const labels = shipping.weightClassLabels(table().classes);
  assert.equal([1, 2, 3, 4].map((id) => labels[id]).join("|"), "0–500 g|501–1000 g|1001–2000 g|Over 2000 g");
  const moved = [
    { id: 1, position: 1, maxGrams: 300 },
    { id: 2, position: 2, maxGrams: 900 },
    { id: 3, position: 3, maxGrams: 2000 },
    { id: 4, position: 4, maxGrams: null },
  ];
  assert.equal(shipping.weightClassLabels(moved)[2], "301–900 g");
});

test("the starting table charges the current zone rate in every class", () => {
  for (const zone of shipping.ZONES) {
    const country = shipping.COUNTRIES.find((c) => c.zone === zone.id).code;
    for (const grams of [null, 100, 700, 1500, 5000]) {
      assert.equal(shipping.calculateShipping(country, false, table(), grams), zone.rateCents, `${zone.id} ${grams}`);
    }
  }
});

test("basket weight is the sum of the pieces; one piece without a weight makes the basket unknown", () => {
  const weights = { a: 300, b: 350, c: null };
  assert.equal(shipping.basketWeightGrams([{ slug: "a", quantity: 1 }, { slug: "b", quantity: 1 }], weights), 650);
  assert.equal(shipping.basketWeightGrams([{ slug: "a", quantity: 2 }], weights), 600);
  assert.equal(shipping.basketWeightGrams([{ slug: "a", quantity: 1 }, { slug: "c", quantity: 1 }], weights), null);
  assert.equal(shipping.basketWeightGrams([{ slug: "missing", quantity: 1 }], weights), null);
});

test("a quote takes the destination region and the basket class; free shipping always wins", () => {
  const t = {
    classes: [
      { id: 1, position: 1, maxGrams: 500 },
      { id: 2, position: 2, maxGrams: 1000 },
      { id: 3, position: 3, maxGrams: 2000 },
      { id: 4, position: 4, maxGrams: null },
    ],
    rates: {
      1: { europe: 6100, americas: 5000 },
      2: { europe: 5400, americas: 4800 },
      3: { europe: 8800, americas: 7600 },
      4: { europe: 12000, americas: 11000 },
    },
  };
  const pt = shipping.shippingQuote(t, "PT", 650, false);
  assert.equal(pt.cents, 5400);
  assert.equal(pt.classId, 2);
  assert.equal(pt.zoneLabel, "Europe");
  assert.equal(pt.classLabel, "501–1000 g");
  assert.equal(pt.methodId, "protected");
  assert.equal(shipping.shippingQuote(t, "PT", 300, false).cents, 6100);
  assert.equal(shipping.shippingQuote(t, "US", 2500, false).cents, 11000);
  assert.equal(shipping.shippingQuote(t, "PT", 2500, true).cents, 0);
  assert.equal(shipping.shippingQuote(t, "PT", 2500, true).methodId, "free");
  assert.equal(shipping.shippingQuote(t, "XX", 300, false), null);
});

test("the back-office payload is checked before anything is saved", () => {
  const row = (classId, maxGrams, cents = 5400) => ({
    classId,
    maxGrams,
    prices: { europe: cents, americas: cents, asia: cents, africa: cents, oceania: cents },
  });
  const good = [row(1, 500), row(2, 1000), row(3, 2000), row(4, null)];
  const ok = shipping.parseShippingRows({ rows: good });
  assert.equal(ok.ok, true);
  assert.equal(ok.rows.length, 4);
  assert.equal(ok.rows[3].maxGrams, null);
  const refused = (rows) => shipping.parseShippingRows({ rows }).ok === false;
  assert.ok(refused(good.slice(0, 3)), "three classes");
  assert.ok(refused([row(1, 1000), row(2, 500), row(3, 2000), row(4, null)]), "limits must increase");
  assert.ok(refused([row(1, 500), row(2, 1000), row(3, 2000), row(4, 5000)]), "heaviest class has no limit");
  assert.ok(refused([row(1, "500"), row(2, 1000), row(3, 2000), row(4, null)]), "limit typed as text");
  assert.ok(refused([row(1, 500, -1), row(2, 1000), row(3, 2000), row(4, null)]), "negative price");
  assert.ok(refused([row(1, 500, 60000), row(2, 1000), row(3, 2000), row(4, null)]), "price above 500 euros");
  assert.ok(
    refused([
      { classId: 1, maxGrams: 500, prices: { europe: null, americas: 1, asia: 1, africa: 1, oceania: 1 } },
      row(2, 1000),
      row(3, 2000),
      row(4, null),
    ]),
    "empty price",
  );
  assert.ok(refused([{ maxGrams: 500, prices: {} }, row(2, 1000), row(3, 2000), row(4, null)]), "missing class id");
});

test("database: two additive tables, seeded only while empty, changed in one transaction", () => {
  const schema = read("src/db/schema.ts");
  assert.match(schema, /export const shippingWeightClasses = pgTable\("shipping_weight_classes"/);
  assert.match(schema, /export const shippingRates = pgTable\(\s*"shipping_rates"/);
  assert.match(schema, /primaryKey\(\{ columns: \[table\.classId, table\.region\] \}\)/);
  const migrate = read("src/lib/schema-migrate.ts");
  assert.match(migrate, /CREATE TABLE IF NOT EXISTS "shipping_weight_classes"/);
  assert.match(migrate, /CREATE TABLE IF NOT EXISTS "shipping_rates"/);
  const block = migrate.slice(migrate.indexOf("-- Shipping by weight class"));
  // ON DELETE CASCADE is an integrity rule on the new rate rows; only executed deletions or drops are refused here.
  assert.ok(block.length > 100 && !/DROP (TABLE|COLUMN)|TRUNCATE|DELETE FROM/.test(block), "the shipping block is additive only");
  const tables = read("src/lib/shipping-table.ts");
  assert.match(tables, /if \(Number\(value\) > 0\) return;/);
  assert.match(tables, /pg_advisory_xact_lock/);
  assert.match(tables, /onConflictDoUpdate/);
  assert.match(tables, /db\.transaction/);
});

test("admin: tab 7 mounts the panel; the API is authenticated, never cached and has no delete", () => {
  const admin = read("src/components/admin-dashboard.tsx");
  assert.match(admin, /"reviews" \| "shipping"/);
  assert.match(admin, /setTab\("shipping"\)/);
  assert.match(admin, /7\. Shipping/);
  assert.match(admin, /tab === "shipping" && <AdminShippingPanel \/>/);
  const route = read("src/app/api/admin/shipping/route.ts");
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function PUT/);
  assert.match(route, /isAdminAuthenticated\(\)/);
  assert.match(route, /parseShippingRows\(/);
  assert.match(route, /private, no-store/);
  assert.ok(!/export async function DELETE/.test(route));
  const panel = read("src/components/admin-shipping-panel.tsx");
  assert.match(panel, /"use client"/);
  assert.match(panel, /Save shipping rates/);
});

test("checkout and the order service price the same basket with the same table", () => {
  const page = read("src/app/checkout/page.tsx");
  assert.match(page, /getShippingTable\(\)/);
  assert.match(page, /getWeightsBySlug\(\)/);
  assert.match(page, /shippingTable=\{shippingTable\}/);
  const form = read("src/components/checkout-form.tsx");
  assert.match(form, /shippingQuote\(shippingTable, country, grams, freeShipping\)/);
  assert.ok(!/calculateShipping\(/.test(form), "the form no longer uses the flat zone rate");
  const service = read("src/lib/order-service.ts");
  assert.match(service, /shippingQuote\(await getShippingTable\(\), input\.country, grams, commerce\.freeShipping\)/);
  assert.match(service, /basketWeightGrams\(/);
  assert.ok(!/calculateShipping\(/.test(service));
});

test("the public Shipping page shows the weight-by-region table from the database", () => {
  const page = read("src/app/shipping/page.tsx");
  assert.match(page, /getShippingTable\(\)/);
  assert.match(page, /classLabels\[cls\.id\]/);
  assert.match(page, /shippingTable\.rates\[cls\.id\]/);
});

test("cover: one bundled 3:4 image, one stable address, every reference agrees", async () => {
  const sharp = require("sharp");
  const meta = await sharp("src/assets/connoisseur-cyphaspis-glass.jpg").metadata();
  assert.ok(Math.abs(meta.width / meta.height - 0.75) < 0.005, "3:4 card format");
  assert.equal(load("src/lib/connoisseur-cover-path.ts").CONNOISSEUR_COVER_PATH, "/covers/connoisseur-cyphaspis.jpg");
  assert.match(read("src/lib/site-content.ts"), /connoisseur: "\/covers\/connoisseur-cyphaspis\.jpg"/);
  assert.match(read("src/lib/collections.ts"), /cover: "\/covers\/connoisseur-cyphaspis\.jpg"/);
  assert.match(read("src/lib/release-info.ts"), /CONNOISSEUR_GLASS_IMAGE = "\/covers\/connoisseur-cyphaspis\.jpg"/);
  const route = read("src/app/covers/[file]/route.ts");
  assert.match(route, /import cover from "@\/assets\/connoisseur-cyphaspis-glass\.jpg"/);
  assert.match(route, /status: 307/);
  assert.match(route, /return new Response\("Not found", \{ status: 404 \}\)/);
  assert.ok(!fs.existsSync("public/images/connoisseur-cyphaspis-glass.jpg"), "no second copy in public/");
});

test("version 2026-11-04-x lists the shipping table and the bundled cover", () => {
  const v = load("src/lib/version.ts");
  assert.equal(v.CODE_VERSION, "2026-11-04-x");
  for (const feature of ["shipping-weight-table", "covers-route-bundled-cover", "shipping-table-admin-tab"]) {
    assert.ok(v.REQUIRED_FEATURES.includes(feature), feature);
  }
});
