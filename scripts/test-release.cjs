/** Release-s regressions. All HTTP/database operations below are mocks. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');

function load(file, imports = {}, env = {}) {
  const module = { exports: {} };
  const context = vm.createContext({ module, exports: module.exports, process: { env }, Request, Response, Headers, URL, console,
    require(name) { if (Object.hasOwn(imports, name)) return imports[name]; throw new Error(`Unexpected import ${name}`); },
    fetch() { throw new Error('Unexpected external request in offline test'); },
  });
  vm.runInContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return module.exports;
}
const statuses = load('src/lib/review-moderation.ts');
const operators = { eq: (...x) => ['eq', ...x], and: (...x) => ['and', ...x], or: (...x) => ['or', ...x], isNull: (x) => ['isNull', x], desc: (x) => x, asc: (x) => x, count: () => 'count', avg: (x) => x, gte: (...x) => ['gte', ...x] };

test('legacy reviews remain public, new pending/rejected/unknown reviews do not', () => {
  for (const value of [null, undefined, 'approved']) assert.equal(statuses.isPublicReview(value), true);
  for (const value of ['pending', 'rejected', 'anything']) assert.equal(statuses.isPublicReview(value), false);
  assert.equal(statuses.reviewModerationStatus(null), 'approved');
  for (const value of ['pending', 'approved', 'rejected']) assert.equal(statuses.isReviewModerationStatus(value), true);
  for (const value of ['delete', 'publish', 1, null, {}]) assert.equal(statuses.isReviewModerationStatus(value), false);
});

test('review migration is additive, preserves old rows and defaults new rows to pending', () => {
  const source = fs.readFileSync('src/lib/schema-migrate.ts', 'utf8');
  const upgrade = source.slice(source.indexOf('const UPGRADE_SQL'));
  assert.match(upgrade, /ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "moderation_status" text;/);
  assert.match(upgrade, /ALTER TABLE "reviews" ALTER COLUMN "moderation_status" SET DEFAULT 'pending'/);
  assert.match(upgrade, /ADD COLUMN IF NOT EXISTS "moderated_at"/);
  assert.ok(!/UPDATE\s+"?reviews|DELETE\s+FROM\s+"?reviews|DROP\s+TABLE|TRUNCATE/i.test(upgrade));
  const initial = source.slice(0, source.indexOf('const UPGRADE_SQL'));
  assert.ok(!initial.includes('moderation_status'), 'new columns belong only in UPGRADE_SQL');
});

function submissionFixture(found = true) {
  let stored;
  const route = load('src/app/api/reviews/route.ts', {
    'drizzle-orm': operators,
    '@/db': { db: {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => found ? [{ id: 1 }] : [] }) }) }),
      insert: () => ({ values: (value) => { stored = value; return { returning: async () => [{ id: 12 }] }; } }),
    } },
    '@/db/schema': { products: { id: 'pid', slug: 'slug', published: 'published' }, reviews: { id: 'rid' } },
    '@/lib/seed': { ensureSeeded: async () => {} },
  });
  return { route, row: () => stored };
}
const validReview = { productSlug: 'fixture-piece', authorName: 'Visitor', authorCountry: 'Portugal', rating: 5, title: 'Interesting specimen', body: 'I am a visitor and appreciate the preparation of this specimen.', moderationStatus: 'approved', verifiedPurchase: true };
const reviewRequest = (body) => new Request('https://example.test/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('public submission cannot self-approve or claim a verified purchase', async () => {
  const { route, row } = submissionFixture();
  const response = await route.POST(reviewRequest(validReview));
  assert.equal(response.status, 201);
  assert.equal((await response.json()).status, 'pending');
  assert.equal(row().moderationStatus, 'pending');
  assert.equal(row().verifiedPurchase, false);
});

test('invalid submissions and missing public specimens do not create reviews', async () => {
  for (const body of [null, [], {}, { ...validReview, rating: 6 }, { ...validReview, body: 'Too short' }]) {
    const fixture = submissionFixture();
    assert.equal((await fixture.route.POST(reviewRequest(body))).status, 400);
    assert.equal(fixture.row(), undefined);
  }
  const missing = submissionFixture(false);
  assert.equal((await missing.route.POST(reviewRequest(validReview))).status, 404);
  assert.equal(missing.row(), undefined);
});

function moderationFixture(authed = true, exists = true) {
  let changed; let operations = 0; const refreshed = [];
  const route = load('src/app/api/admin/reviews/route.ts', {
    'drizzle-orm': operators,
    'next/cache': { revalidatePath: (...args) => refreshed.push(args) },
    '@/db': { db: { update() { operations++; return { set(value) { changed = value; return { where: () => ({ returning: async () => exists ? [{ id: 12, moderationStatus: value.moderationStatus }] : [] }) }; } }; } } },
    '@/db/schema': { products: {}, reviews: { id: 'rid' } },
    '@/lib/admin-auth': { isAdminAuthenticated: async () => authed },
    '@/lib/schema-migrate': { ensureSchema: async () => {} },
    '@/lib/home-reviews': load('src/lib/home-reviews.ts'), '@/lib/review-moderation': statuses,
  });
  return { route, changed: () => changed, operations: () => operations, refreshed };
}
const moderateRequest = (body) => new Request('https://example.test/api/admin/reviews', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('moderation list and decisions require admin authentication before any database use', async () => {
  const fixture = moderationFixture(false);
  assert.equal((await fixture.route.GET(new Request('https://example.test/api/admin/reviews'))).status, 401);
  assert.equal((await fixture.route.PATCH(moderateRequest({ id: 12, status: 'approved' }))).status, 401);
  assert.equal(fixture.operations(), 0);
});

test('admin can approve, reject or return a review to pending without deleting or changing its text', async () => {
  for (const status of ['approved', 'rejected', 'pending']) {
    const fixture = moderationFixture();
    const response = await fixture.route.PATCH(moderateRequest({ id: 12, status, body: 'Cannot replace the visitor text', verifiedPurchase: true }));
    assert.equal(response.status, 200);
    assert.equal(fixture.changed().moderationStatus, status);
    assert.ok(fixture.changed().moderatedAt);
    assert.equal(fixture.changed().body, undefined);
    assert.equal(fixture.changed().verifiedPurchase, undefined);
    assert.ok(fixture.refreshed.some((entry) => entry[0] === '/shop/[slug]'));
    assert.match(response.headers.get('cache-control'), /no-store/);
  }
});

test('invalid moderation actions are rejected and missing reviews return 404', async () => {
  for (const body of [null, { id: -1, status: 'approved' }, { id: 12, status: 'delete' }, { id: '12', status: 'approved' }]) {
    const fixture = moderationFixture();
    assert.equal((await fixture.route.PATCH(moderateRequest(body))).status, 400);
    assert.equal(fixture.operations(), 0);
  }
  const fixture = moderationFixture(true, false);
  assert.equal((await fixture.route.PATCH(moderateRequest({ id: 12, status: 'approved' }))).status, 404);
  assert.equal(fixture.refreshed.length, 0);
});

test('all five public review/statistic query paths apply the approval condition', async () => {
  const queries = [];
  const db = { select() {
    const entry = {}; queries.push(entry);
    const query = { from(table) { entry.table = table; return query; }, where(condition) { entry.where = condition; return query; },
      innerJoin() { return query; }, orderBy() { return query; }, groupBy() { return query; }, limit() { return query; },
      then(resolve) { return Promise.resolve([]).then(resolve); } };
    return query;
  } };
  const reviewTable = { productId: 'reviewProductId', moderationStatus: 'reviewModerationStatus', rating: 'reviewRating' };
  const catalog = load('src/lib/catalog.ts', {
    '@/lib/home-reviews': load('src/lib/home-reviews.ts'),
    'drizzle-orm': operators, '@/db': { db },
    '@/db/schema': { products: { id: 'productId', published: 'published' }, reviews: reviewTable },
    '@/lib/seed': { ensureSeeded: async () => {} }, '@/lib/seed-settings': { SEED_SETTINGS: {} },
    '@/lib/site-content': { mergeContent: () => ({}) },
    '@/lib/product-visibility': { publicProduct: (x) => x, publicProducts: (x) => x },
    '@/lib/public-copy': { safeContent: (x) => x },
  });
  await catalog.getAllProducts();
  await catalog.getProductReviews(1);
  await catalog.getRatingBreakdown(1);
  await catalog.getTopReviews();
  await catalog.getStoreStats();
  const reviewQueries = queries.filter((entry) => entry.table === reviewTable);
  assert.equal(reviewQueries.length, 5);
  for (const entry of reviewQueries) {
    const filter = JSON.stringify(entry.where);
    assert.match(filter, /"eq","reviewModerationStatus","approved"/);
    assert.match(filter, /"isNull","reviewModerationStatus"/);
  }
});

test('review form and heading invite owners and visitors without promising immediate publication', () => {
  const form = fs.readFileSync('src/components/review-form.tsx', 'utf8');
  assert.match(form, /Submit review/); assert.match(form, /after curator approval/);
  assert.ok(!form.includes('now published below'));
  const product = fs.readFileSync('src/app/shop/[slug]/page.tsx', 'utf8');
  assert.match(product, /What Owners and Visitors say/);
  assert.ok(!product.includes('Be the first'));
});

test('newsletter contains the requested wording in the shared text/HTML intro', () => {
  const newsletter = load('src/lib/newsletter-send.ts', {
    'node:crypto': { randomUUID: () => 'fixture' }, 'drizzle-orm': {}, '@/db': { db: {} }, '@/db/schema': {},
    '@/lib/schema-migrate': {}, '@/lib/mailer': load('src/lib/mailer.ts'), '@/lib/inventory-rules': {},
    '@/lib/format': load('src/lib/format.ts'), '@/lib/site-url': load('src/lib/site-url.ts'),
  });
  const output = newsletter.buildNewsletterEmail({ subject: 'Featured and New Pieces', pieces: [], unsubscribeUrl: 'https://example.test/unsubscribe' });
  const intro = 'Twice a month we share the pieces we are most excited about — featured specimens and the newest arrivals from the quarries and preparators.';
  assert.ok(output.text.includes(intro)); assert.ok(output.html.includes(intro));
});

test('SOS carries current release links and rules but never credential values', async () => {
  const version = load('src/lib/version.ts');
  const site = load('src/lib/site-url.ts');
  const release = load('src/lib/release-info.ts', { '@/lib/version': version });
  const context = load('src/lib/sos-context.ts', { '@/lib/version': version, '@/lib/site-url': site, '@/lib/release-info': release }, { CRON_SECRET: 'must-not-appear', DATABASE_URL: 'must-not-appear' });
  const text = context.buildSosContext();
  for (const value of [version.CODE_VERSION, release.RELEASE_ZIP_URL, '/sos', 'pull-live.cjs', 'Download backup', 'Neon', 'moderation', 'NEXT_PUBLIC_SITE_URL']) assert.ok(text.includes(value), value);
  assert.ok(!text.includes('must-not-appear'));
  const route = load('src/app/api/sos-context/route.ts', { '@/lib/sos-context': context, '@/lib/version': version });
  const response = await route.GET();
  assert.match(response.headers.get('content-type'), /text\/markdown/);
  assert.match(response.headers.get('x-robots-tag'), /noindex/);
  assert.equal(await response.text(), text);
});

test('glass composition uses an unchanged real photograph, not a regenerated specimen', () => {
  const metadata = JSON.parse(fs.readFileSync('public/images/connoisseur-glass-info.json', 'utf8'));
  const image = fs.readFileSync('public' + metadata.source);
  assert.equal(crypto.createHash('sha256').update(image).digest('hex'), metadata.sourceSha256);
  assert.equal(metadata.specimenRedrawn, false);
  assert.ok(fs.statSync('public/images/connoisseur-glass.png').size > 10000);
  const editor = fs.readFileSync('src/components/admin-content-editor.tsx', 'utf8');
  assert.match(editor, /Use glass display cover/);
});

test('mobile wordmark never wraps and the cart/menu controls cannot shrink it', () => {
  const header = fs.readFileSync('src/components/site-header.tsx', 'utf8');
  assert.match(header, /whitespace-nowrap font-display text-\[clamp\(0\.875rem,4\.4vw,1\.15rem\)\]/);
  assert.match(header, /flex shrink-0 items-center gap-2/);
});
