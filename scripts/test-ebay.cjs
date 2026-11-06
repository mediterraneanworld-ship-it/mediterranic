/** Offline regression tests; no real eBay keys, network calls or database writes. */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const ts = require("typescript");

function load(relative, { env = {}, fetch = async () => { throw new Error("Unexpected network call"); }, imports = {} } = {}) {
  const filename = path.join(process.cwd(), relative);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  const context = vm.createContext({
    exports: module.exports, module,
    require: (name) => { if (name in imports) return imports[name]; throw new Error(`Unexpected import: ${name}`); },
    process: { env }, fetch, Buffer, URL, URLSearchParams, AbortSignal, Response,
    console, setTimeout, clearTimeout,
  });
  vm.runInContext(code, context, { filename });
  return module.exports;
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const fixtureEnv = { EBAY_CLIENT_ID: "fixture-only-client", EBAY_CLIENT_SECRET: "fixture-only-placeholder" };
const itemId = "920090937900";
const itemUrl = `https://www.ebay.com/itm/${itemId}`;

function apiWith(handler) {
  return load("src/lib/ebay.ts", { env: fixtureEnv, fetch: async (url, options) =>
    String(url).includes("/oauth2/token") ? json({ access_token: "fixture-token", expires_in: 7200 }) : handler(String(url), options) });
}

const searchFixture = (payload) => apiWith(async (url) => json(payload));

test("EUR price and gallery are read without inventing a price", () => {
  const api = load("src/lib/ebay.ts");
  const item = api.mapEbayItem({ title: "Trilobite", price: { value: "52.00", currency: "EUR" }, image: { imageUrl: "https://i.ebayimg.com/images/g/photo/s-l1600.jpg" } }, itemId);
  assert.equal(item.priceCents, 5200); assert.equal(item.imageUrls.length, 1); assert.equal(item.active, true);
});

test("auction uses currentBidPrice, not a Buy It Now price", () => {
  const api = load("src/lib/ebay.ts");
  const item = api.mapEbayItem({ buyingOptions: ["AUCTION"], currentBidPrice: { value: "12.50", currency: "EUR" }, price: { value: "900", currency: "EUR" } }, itemId);
  assert.equal(item.priceCents, 1250);
  assert.equal(item.auction, true);
});

test("USD is never relabelled as EUR; original converted EUR is usable", () => {
  const api = load("src/lib/ebay.ts");
  assert.equal(api.mapEbayItem({ price: { value: "100", currency: "USD" } }, itemId).priceCents, null);
  assert.equal(api.mapEbayItem({ price: { value: "100", currency: "USD", convertedFromCurrency: "EUR", convertedFromValue: "88.20" } }, itemId).priceCents, 8820);
});

test("IDs accept canonical, title and REST IDs but reject lookalike hosts", () => {
  const api = load("src/lib/ebay.ts");
  assert.equal(api.ebayItemIdFromUrl(itemUrl + "?tracking=abc"), itemId);
  assert.equal(api.ebayItemIdFromUrl(`https://www.ebay.co.uk/itm/a-trilobite/${itemId}`), itemId);
  assert.equal(api.ebayItemIdFromUrl(`v1|${itemId}|0`), itemId);
  assert.equal(api.ebayItemIdFromUrl(`https://ebay.com.attacker.test/itm/${itemId}`), null);
  assert.equal(api.ebaySellerFromUrl("https://www.ebay.com/str/mederranic"), "mederranic");
});

test("seller discovery has a category, includes auctions, and returns numeric IDs", async () => {
  let requestUrl;
  const api = apiWith(async (url) => {
    requestUrl = new URL(url);
    return json({ total: 1, itemSummaries: [{ itemId: `v1|${itemId}|0`, title: "Perrector trilobite", price: { value: "52", currency: "EUR" } }] });
  });
  const items = await api.listEbaySellerItems("mederranic");
  assert.equal(requestUrl.searchParams.get("category_ids"), "3213");
  assert.match(requestUrl.searchParams.get("filter"), /buyingOptions:\{FIXED_PRICE\|AUCTION\}/);
  assert.equal(items[0].legacyItemId, itemId); assert.equal(items[0].itemWebUrl, itemUrl);
});

test("eBay warnings are surfaced instead of being read as zero listings", async () => {
  const api = searchFixture({
    warnings: [{ errorId: 12003, domain: "API_BROWSE", message: "A seller 'mederranic' provided in the request filters is invalid." }],
    total: 0,
  });
  const result = await api.searchEbaySellerItems("mederranic", 200);
  assert.equal(result.items.length, 0);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0].code, "12003");
  await assert.rejects(api.listEbaySellerItems("mederranic"), /invalid|warning 12003/i);
});

test("a valid seller search returns items, total and no phantom warnings", async () => {
  const api = searchFixture({
    total: 2,
    itemSummaries: [
      { itemId: `v1|${itemId}|0`, title: "Trilobite A", price: { value: "52.00", currency: "EUR" } },
      { itemId: "v1|920090937901|0", title: "Trilobite B", price: { value: "31.00", currency: "EUR" } },
    ],
  });
  const result = await api.searchEbaySellerItems("real-seller-id", 200);
  assert.equal(result.items.length, 2);
  assert.equal(result.sellerUsed, "real-seller-id");
  assert.equal(result.total, 2);
  assert.equal(result.warnings.length, 0);
});

test("a store alias is rejected as a seller username, not silently searched", async () => {
  const api = searchFixture({ total: 0 });
  await assert.rejects(api.searchEbaySellerItems("mederranic store name!"), /not a valid eBay seller username/i);
});

test("403 API permission failure is not silently converted to an empty result", async () => {
  const api = apiWith(async () => json({ message: "upstream detail not exposed" }, 403));
  await assert.rejects(api.getEbayItem(itemUrl), (error) => error.code === "EBAY_HTTP_403" && /Production Browse API/.test(error.message));
});

test("credentials stay on the server and are never echoed by errors", async () => {
  const api = load("src/lib/ebay.ts", { env: fixtureEnv, fetch: async () => json({ raw: fixtureEnv.EBAY_CLIENT_SECRET }, 401) });
  await assert.rejects(api.getEbayItem(itemUrl), (error) => error.code === "EBAY_CREDENTIALS_REJECTED" && !error.message.includes(fixtureEnv.EBAY_CLIENT_SECRET));
});

function refreshFixture(row, ebayItem, ebayError, catawikiText) {
  const updates = [];
  const fields = new Proxy({}, { get: (_, name) => String(name) });
  const fakeDb = {
    select: () => ({ from: () => ({ where: async () => [row] }) }),
    update: () => ({ set: (values) => ({ where: () => ({ returning: async () => { updates.push(values); return [{id:row.id}]; } }) }) }),
  };
  const library = load("src/lib/refresh-prices.ts", {
    fetch: async () => new Response(catawikiText ?? "", { status: 200 }),
    imports: {
      "drizzle-orm": { and: (...x) => x, eq: (...x) => x, gt: (...x) => x, isNotNull: (x) => x, inArray: (...x) => x, sql: (...x) => x },
      "@/db": { db: fakeDb }, "@/db/schema": { products: fields },
      "@/lib/marketplace-links": load("src/lib/marketplace-links.ts"),
      "@/lib/ebay": {
        hasEbayCredentials: () => true,
        ebayItemIdFromUrl: () => itemId,
        getEbayItem: async () => { if (ebayError) throw ebayError; return ebayItem; },
        ebayErrorMessage: (error) => error.message,
      },
    },
  });
  return { run: () => library.refreshMarketplacePrices("https://www.ebay.com/str/mederranic"), updates };
}
const row = { id: 1, slug: "fixture-trilobite", name: "Fixture trilobite", stock: 1, archived: false, listingChannel: "ebay", priceCents: 5200, externalListingUrl: itemUrl, siteOnlyPriceCents: 85000 };

test("cron/manual refresh uses authenticated eBay price", async () => {
  const fixture = refreshFixture(row, { active: true, priceCents: 6100, currency: "EUR" });
  const report = await fixture.run();
  assert.equal(report.changed, 1); assert.equal(report.results[0].currentCents, 6100);
  assert.equal(fixture.updates.find((update) => update.priceCents === 6100).priceCents, 6100);
  assert.equal(fixture.updates.some((update) => update.archived === true), false);
});

test("eBay 403, unavailable item or foreign price never changes existing products", async () => {
  for (const args of [[null, new Error("API permission denied")], [{ active: false }], [{ active: true, priceCents: null, currency: "USD" }]]) {
    const fixture = refreshFixture(row, args[0], args[1]);
    const report = await fixture.run();
    assert.equal(report.changed, 0); assert.equal(fixture.updates.length, 0); assert.ok(report.results[0].error);
  }
});

test("Reserve price not met while bidding is open is still live", async () => {
  const fixture = refreshFixture({ ...row, listingChannel: "catawiki", externalListingUrl: "https://www.catawiki.com/en/l/12345" }, null, null,
    "Place bid\nReserve price not met\nCurrent bid\n€ 75\n2 days left");
  const report = await fixture.run();
  assert.equal(report.results[0].status, "live"); assert.equal(report.ended, 0);
  assert.equal(fixture.updates.some((update) => update.archived), false);
});

test("closed unsold auction returns only at the curator's Site Only price", async () => {
  const fixture = refreshFixture({ ...row, listingChannel: "catawiki", externalListingUrl: "https://www.catawiki.com/en/l/12345" }, null, null,
    "Bidding closed\nNot sold\nReserve price not met");
  const report = await fixture.run();
  assert.equal(report.results[0].status, "unsold");
  assert.ok(fixture.updates.some((update) => update.listingChannel === "direct" && update.priceCents === 85000));
  const missing = refreshFixture({ ...row, siteOnlyPriceCents: null, listingChannel: "catawiki", externalListingUrl: "https://www.catawiki.com/en/l/12345" }, null, null, "Bidding closed\nNot sold");
  const unread = await missing.run(); assert.equal(unread.changed, 0); assert.equal(missing.updates.length, 0);
});

const links = load('src/lib/marketplace-links.ts');

test('collection reference: prefix, bare code, URL and labelled forms share one core', () => {
  assert.equal(links.normalizeReference('PAIS9676'), 'PAIS9676');
  assert.equal(links.normalizeReference('9676'), '9676');
  assert.equal(links.referenceCore('PAIS9676'), '9676');
  assert.equal(links.referenceCore('9676'), '9676');
  assert.equal(links.extractSpecimenReference('Bigotina n.sp. C PAIS9676 complete'), 'PAIS9676');
  assert.equal(links.extractSpecimenReference('REF: PAIS9676 — complete adult'), 'PAIS9676');
  assert.equal(links.extractSpecimenReference('SKU 9676 trilobite'), '9676');
  assert.equal(links.extractSpecimenReference('/FOSSILS-FOR-SALE/9676-Bigotina'), '9676');
  assert.equal(links.extractSpecimenReference('9676 Bigotina trilobite'), '9676');
  assert.equal(links.extractSpecimenReference('Trilobite from 2024, 46 mm'), null);
  assert.equal(links.extractSpecimenReference(''), null);
});

test('a relisting with a prefixed reference matches a specimen stored without the prefix', () => {
  const specimen = { id: 1, name: 'Bigotina', species: 'Bigotina', specimenReference: '9676', listingChannel: 'direct' };
  const match = links.matchListing({ url: 'https://www.ebay.com/itm/999999900001', title: 'PAIS9676 Bigotina n.sp. C' }, [specimen]);
  assert.equal(match.kind, 'reference');
  assert.equal(match.productId, 1);
  const other = links.matchListing({ url: 'https://www.ebay.com/itm/999999900002', title: 'PAIS9677 Bigotina' }, [specimen]);
  assert.equal(other.productId, undefined);
});
