/** Offline regressions: no network, payments, e-mails or database writes. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}) {
  const module = { exports: {} };
  const context = vm.createContext({ module, exports: module.exports, Request, Response, URL, console,
    require(name) { if (Object.hasOwn(imports, name)) return imports[name]; throw Error('Unexpected test import: ' + name); },
    fetch() { throw Error('Unexpected network'); }, process: { env: {} },
  });
  vm.runInContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return module.exports;
}
const links = load('src/lib/marketplace-links.ts');
const visibility = load('src/lib/product-visibility.ts', { '@/lib/public-copy': load('src/lib/public-copy.ts') });
const rules = load('src/lib/admin-product-rules.ts', { '@/lib/marketplace-links': links, '@/lib/product-visibility': visibility });
const base = { id: 1, slug: 'fixture', name: 'Fixture', species: 'Trilobite', published: false, archived: false, stock: 1, listingChannel: 'direct', priceCents: 1200, description: '', shortDescription: 'A real description', images: [{ src: '/images/hero.jpg', alt: 'Photo', label: 'Top' }], marketplaceActive: null, marketplaceHistory: [] };

function apiFixture(product = base, authorized = true) {
  let stored = { ...product }, writes = 0, deletions = 0;
  const paths = [];
  class MarketplaceError extends Error { constructor(message, status) { super(message); this.status = status; } }
  class ProductDeletionError extends Error { constructor(message, status) { super(message); this.status = status; } }
  const db = {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => stored ? [stored] : [] }) }) }),
    update: () => ({ set: (patch) => ({ where: () => ({ returning: async () => { writes++; stored = { ...stored, ...patch }; return [stored]; } }) }) }),
  };
  const route = load('src/app/api/admin/products/route.ts', {
    'drizzle-orm': { eq: (...args) => args }, 'next/cache': { revalidatePath: (path) => paths.push(path) },
    '@/db': { db }, '@/db/schema': { products: { id: 'id' } }, '@/lib/admin-auth': { isAdminAuthenticated: async () => authorized },
    '@/lib/product-collections': { isCollectionSlug: () => true }, '@/lib/schema-migrate': { ensureSchema: async () => {} },
    '@/lib/marketplace-links': links, '@/lib/marketplace-service': { MarketplaceError }, '@/lib/admin-product-rules': rules,
    '@/lib/product-deletion-service': { ProductDeletionError, permanentlyDeleteProduct: async (id, confirmation) => {
      if (confirmation !== stored.slug) throw new ProductDeletionError('Wrong confirmation', 400);
      const result = { id, slug: stored.slug }; stored = null; deletions++; return result;
    } },
  });
  return { route, row: () => stored, writes: () => writes, deletions: () => deletions, paths };
}
const request = (body, method = 'POST') => new Request('https://fixture.test/api/admin/products?id=1', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('Unavailable includes no channel, zero stock, archive and confirmed inactive marketplace; drafts stay separate from availability', () => {
  const rows = [
    { ...base, id: 1, stock: 0 }, { ...base, id: 2 }, { ...base, id: 3, listingChannel: null },
    { ...base, id: 4, archived: true }, { ...base, id: 5, listingChannel: 'ebay', marketplaceActive: false },
    { ...base, id: 6, listingChannel: 'ebay', published: true, marketplaceActive: null },
  ];
  assert.equal(rules.sortAdminProducts(rows).map(p => p.id).join(','), '2,6,1,3,4,5');
  assert.equal(rows.map(p => p.id).join(','), '1,2,3,4,5,6', 'input remains unchanged');
});

test('new draft with short description has the same publication eligibility as the full editor', async () => {
  const f = apiFixture();
  const res = await f.route.POST(request({ action: 'set-published', id: 1, published: true }));
  assert.equal(res.status, 200);
  assert.equal(f.row().published, true);
  assert.equal(f.row().description, base.shortDescription);
  assert.ok(f.paths.includes('/archive') && f.paths.includes('/admin'));
});

test('published specimens can unpublish and publish again without changing price or stock', async () => {
  const f = apiFixture({ ...base, published: true, description: 'Complete' });
  assert.equal((await f.route.POST(request({ action: 'set-published', id: 1, published: false }))).status, 200);
  assert.equal(f.row().published, false);
  assert.equal((await f.route.POST(request({ action: 'set-published', id: 1, published: true }))).status, 200);
  assert.equal(f.row().stock, 1); assert.equal(f.row().priceCents, 1200);
});

test('full editor and row publish use the same validator', async () => {
  for (const action of [{ action: 'set-published', id: 1, published: true }, { id: 1, published: true }]) {
    const f = apiFixture({ ...base, priceCents: 0, images: [] });
    const res = await f.route.POST(request(action));
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.deepEqual(data.missing, ['images', 'priceDollars']);
    assert.match(data.error, /Save & publish/);
    assert.equal(f.writes(), 0);
  }
});

test('unavailable and archive drafts can publish without exposing or inventing a price', async () => {
  for (const changes of [{ archived: true, stock: 0, listingChannel: null }, { archived: false, stock: 0, listingChannel: 'direct' }, { archived: false, stock: 1, listingChannel: null }]) {
    const f = apiFixture({ ...base, ...changes, priceCents: 0 });
    const res = await f.route.POST(request({ action: 'set-published', id: 1, published: true }));
    assert.equal(res.status, 200); assert.equal(f.row().priceCents, 0); assert.equal(f.row().stock, changes.stock); assert.equal(f.row().listingChannel, changes.listingChannel);
  }
});

test('available marketplace drafts need a valid current listing, not a guessed or wrong-platform link', async () => {
  for (const url of ['', 'https://www.catawiki.com/en/l/1234']) {
    const f = apiFixture({ ...base, listingChannel: 'ebay', externalListingUrl: url });
    const res = await f.route.POST(request({ action: 'set-published', id: 1, published: true }));
    assert.equal(res.status, 400); assert.ok((await res.json()).missing.includes('externalListingUrl')); assert.equal(f.writes(), 0);
  }
  const good = apiFixture({ ...base, listingChannel: 'ebay', ebayListingUrl: 'https://www.ebay.com/itm/123456789012' });
  assert.equal((await good.route.POST(request({ action: 'set-published', id: 1, published: true }))).status, 200);
});

test('Publish honours a valid saved link in listing history without changing the selected platform', async () => {
  const f = apiFixture({ ...base, listingChannel: 'catawiki', marketplaceHistory: [{ channel: 'catawiki', url: 'https://www.catawiki.com/en/l/12345678', linkedAt: '' }] });
  const res = await f.route.POST(request({ action: 'set-published', id: 1, published: true }));
  assert.equal(res.status, 200);
  assert.equal(f.row().listingChannel, 'catawiki');
  assert.equal(f.row().externalListingUrl, 'https://www.catawiki.com/en/l/12345678');
});

test('money fields support cents and a zero-price draft is not blocked by browser constraints', () => {
  const admin = fs.readFileSync('src/components/admin-dashboard.tsx', 'utf8');
  const price = admin.slice(admin.indexOf('>Price (EUR €) *</label>'), admin.indexOf('>Compare-At Price'));
  assert.match(price, /min="0"/); assert.match(price, /step="0\.01"/);
  assert.doesNotMatch(price, /\brequired\b/);
});

test('invalid published values cannot accidentally toggle visibility', async () => {
  for (const published of ['false', 1, null]) {
    const f = apiFixture();
    assert.equal((await f.route.POST(request({ action: 'set-published', id: 1, published }))).status, 400);
    assert.equal(f.writes(), 0);
  }
});

test('publication errors leave the record unchanged and unpublish never requires complete content', async () => {
  const f = apiFixture({ ...base, images: [], priceCents: 0, shortDescription: '' });
  assert.equal((await f.route.POST(request({ action: 'set-published', id: 1, published: true }))).status, 400);
  assert.equal(f.row().published, false);
  assert.equal((await f.route.POST(request({ action: 'set-published', id: 1, published: false }))).status, 200);
});

test('delete requires authentication, explicit confirmation and an exact specimen', async () => {
  const denied = apiFixture(base, false);
  assert.equal((await denied.route.DELETE(request({ confirmation: 'fixture' }, 'DELETE'))).status, 401);
  assert.equal(denied.deletions(), 0);
  for (const confirmation of ['', null, 'another-piece']) {
    const f = apiFixture();
    assert.equal((await f.route.DELETE(request({ confirmation }, 'DELETE'))).status, 400); assert.equal(f.deletions(), 0);
  }
  const allowed = apiFixture();
  assert.equal((await allowed.route.DELETE(request({ confirmation: 'fixture' }, 'DELETE'))).status, 200);
  assert.equal(allowed.deletions(), 1); assert.equal(allowed.row(), null); assert.ok(allowed.paths.includes('/archive'));
});

test('deletion history prevents reimport by saved listing or REF, never by species', () => {
  const rows = [{ slug: 'deleted', specimenReference: 'PAIS9600', listingKeys: ['ebay:123456789012'] }];
  assert.equal(rules.matchesDeletedSpecimen({ url: 'https://www.ebay.co.uk/itm/123456789012?x=1' }, rows), true);
  assert.equal(rules.matchesDeletedSpecimen({ reference: '9600' }, rows), true);
  assert.equal(rules.matchesDeletedSpecimen({ reference: '9601' }, rows), false);
  assert.equal(rules.matchesDeletedSpecimen({ slug: 'same-species-but-different-piece' }, rows), false);
});

test('historical order lines survive product deletion and are not doubled by restore', () => {
  const helper = load('src/lib/order-history.ts', { 'drizzle-orm': {}, '@/db': { db: {} }, '@/db/schema': {}, '@/lib/schema-migrate': {} });
  const line = { id: 22, orderId: 'order-a', productId: 11, productSlug: 'deleted', productName: 'Original name', quantity: 2, unitPriceCents: 12000 };
  assert.equal(JSON.stringify(helper.combineOrderLines([], [line, line])), JSON.stringify([line]));
  const restored = { ...line, id: 30, productId: 25 };
  assert.equal(JSON.stringify(helper.combineOrderLines([restored], [line])), JSON.stringify([restored]));
});

test('schema upgrade is additive and only confirmed actions remove catalogue rows', () => {
  const migration = fs.readFileSync('src/lib/schema-migrate.ts', 'utf8');
  const block = migration.slice(migration.indexOf('-- Explicit permanent'), migration.indexOf('-- Shipping by weight'));
  assert.match(block, /CREATE TABLE IF NOT EXISTS "product_deletions"/);
  assert.doesNotMatch(block, /DELETE\s+FROM|DROP\s|TRUNCATE|UPDATE\s/i);
  const service = fs.readFileSync('src/lib/product-deletion-service.ts', 'utf8');
  assert.ok(service.indexOf('tx.insert(productDeletions)') < service.indexOf('tx.delete(products)'));
  assert.doesNotMatch(service, /delete\(orders\)|set\(\{ stock/);
  assert.match(service, /PAYMENT_IN_PROGRESS/);
});

test('editor, deletion dialog and stable table preserve row identity and show actionable feedback', () => {
  const admin = fs.readFileSync('src/components/admin-dashboard.tsx', 'utf8');
  assert.match(admin, /tableProducts\.map/); assert.match(admin, /<Fragment key=\{p\.id\}>/);
  assert.match(admin, /setEditing\(\{ \.\.\.toEditable\(product\), published: true \}\)/);
  assert.match(admin, /rowNotices\[p\.id\]/); assert.match(admin, /Publish on save/); assert.match(admin, /Save & publish/);
  const dialog = fs.readFileSync('src/components/admin-delete-product-dialog.tsx', 'utf8');
  assert.match(dialog, /typed !== "DELETE"/); assert.match(dialog, /showModal\(\)/); assert.match(dialog, /Download a backup/);
});


test('bundled cover keeps the browser host instead of leaking a proxy bind address', async () => {
  const route = load('src/app/covers/[file]/route.ts', {
    '@/assets/connoisseur-cyphaspis-glass.jpg': { default: { src: '/_next/static/media/connoisseur.jpg' }, __esModule: true },
    '@/lib/connoisseur-cover-path': { CONNOISSEUR_COVER_PATH: '/covers/connoisseur-cyphaspis.jpg' },
  });
  const response = await route.GET(new Request('http://0.0.0.0:3000/covers/connoisseur-cyphaspis.jpg'), { params: Promise.resolve({ file: 'connoisseur-cyphaspis.jpg' }) });
  assert.equal(response.status, 307);
  assert.equal(response.headers.get('location'), '/_next/static/media/connoisseur.jpg');
  const missing = await route.GET(new Request('http://0.0.0.0:3000/covers/missing.jpg'), { params: Promise.resolve({ file: 'missing.jpg' }) });
  assert.equal(missing.status, 404);
});
