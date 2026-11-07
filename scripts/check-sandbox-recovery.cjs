/** Responsive + moderation smoke test. LOCAL database and LOCAL HTTP only.
 * Never submits an order, payment, newsletter, email or inventory change.
 * Run against the managed preview: node scripts/check-sandbox-recovery.cjs
 */
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { assertLocalDatabase } = require('./lib/live-public.cjs');
assertLocalDatabase(process.env.DATABASE_URL);
const base = new URL(process.argv[2] || 'http://127.0.0.1:3000');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'Browser mutations require a loopback HTTP origin.');
const { register } = require('tsx/cjs/api');
const unregister = register();
const { db, pool } = require('../src/db/index.ts');
const { products, reviews, siteSettings } = require('../src/db/schema.ts');
const { getProductReviews } = require('../src/lib/catalog.ts');
const { eq, and, asc } = require('drizzle-orm');
const { chromium } = require('playwright');
const author = `Sandbox verification ${Date.now()}`;
const title = `Local moderation fixture ${Date.now()}`;
let reviewId;
let browser;
let product;
const report = { widths: [], pages: [], moderation: [], consoleErrors: [], blockedExternalRequests: [] };

async function snapshot() {
  return {
    products: await db.select().from(products).orderBy(asc(products.id)),
    settings: await db.select().from(siteSettings).orderBy(asc(siteSettings.id)),
    reviews: await db.select().from(reviews).orderBy(asc(reviews.id)),
  };
}
async function openAdmin(page) {
  await page.goto(base.href + 'admin', { waitUntil: 'networkidle' });
  const entry = page.getByRole('button', { name: 'Enter Back-Office', exact: true });
  if (await entry.count()) await entry.click();
  await page.getByRole('button', { name: '1. Specimens', exact: false }).first().waitFor();
}
async function publicContains(page, value) {
  const response = await page.request.get(base.href + 'shop/' + product.slug);
  assert.equal(response.status(), 200);
  return (await response.text()).includes(value);
}
async function decision(page, label, status) {
  const article = page.locator(`article[data-review-id="${reviewId}"]`);
  const [response] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/api/admin/reviews') && r.request().method() === 'PATCH'),
    article.getByRole('button', { name: `${label} review by ${author}`, exact: true }).click(),
  ]);
  assert.equal(response.status(), 200);
  await page.getByRole('button', { name: 'All', exact: false }).click();
  await page.locator(`article[data-review-id="${reviewId}"]`).waitFor();
  const [stored] = await db.select().from(reviews).where(eq(reviews.id, reviewId));
  assert.equal(stored.moderationStatus, status);
  const visible = (await getProductReviews(product.id)).some(r => r.id === reviewId);
  assert.equal(visible, status === 'approved');
  assert.equal(await publicContains(page, title), status === 'approved');
  report.moderation.push(`${status}: ${visible ? 'public' : 'hidden'}, record retained`);
  console.log('PASS moderation:', report.moderation.at(-1));
}

(async () => {
  const before = await snapshot();
  [product] = await db.select().from(products).where(eq(products.published, true)).limit(1);
  assert.ok(product, 'Mirror a public specimen before running this check.');
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  // No production requests, tracking beacons, payments or email can leave this test.
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== base.origin) {
      report.blockedExternalRequests.push(url.origin);
      return route.abort();
    }
    if (/^\/api\/(?:paypal\/|orders$|newsletter$|cron\/|admin\/(?:newsletter\/|email-test$|refresh-prices$|inventory-sync$|restore$))/.test(url.pathname)) {
      return route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"Blocked by local smoke test"}' });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.consoleErrors.push(error.message));
  fs.mkdirSync('.checks', { recursive: true });
  for (const width of [320, 360, 390, 430, 1440]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    for (const path of ['/', '/shop', '/archive', '/shipping', '/featured', '/sos', '/admin']) {
      if (path === '/admin') await openAdmin(page);
      else await page.goto(base.href + path.slice(1), { waitUntil: 'networkidle' });
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
      assert.ok(dimensions.document <= width + 1 && dimensions.body <= width + 1, `${path} overflows at ${width}: ${JSON.stringify(dimensions)}`);
      const name = path === '/' ? 'home' : path.slice(1);
      const fullPage = path === '/' && [390, 1440].includes(width);
      if (fullPage) {
        // whileInView is intentionally lazy: visit each section before a full-page capture.
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let top = 0; top < height; top += 550) {
          await page.evaluate(y => scrollTo(0, y), top);
          await page.waitForTimeout(140);
        }
        await page.waitForTimeout(1200);
        await page.evaluate(() => scrollTo(0, 0));
      }
      await page.screenshot({ path: `.checks/${name}-${width}.png`, fullPage });
      report.pages.push({ path, width, overflow: false });
      console.log(`PASS viewport ${width}px: ${path}`);
    }
    if (width !== 1440) report.widths.push(width);
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base.href, { waitUntil: 'networkidle' });
  const { getSiteContent } = require('../src/lib/catalog.ts');
  const content = await getSiteContent();
  const closing = page.locator('section').filter({ has: page.getByRole('heading', { name: content.home.closing.archiveTitle, exact: true }) });
  assert.equal(await closing.count(), 1, 'The saved H12 archive heading is present.');
  assert.ok(await closing.locator('figure').count() > 0, 'Archived specimens appear in H12.');
  assert.equal(await closing.locator('figure a').count(), 0, 'H12 specimen cards must not link to individual pages.');
  await page.goto(base.href + 'archive', { waitUntil: 'networkidle' });
  assert.ok(await page.locator('main a[href^="/shop/"]').count() > 0, 'Archive specimens retain their individual links.');

  const [direct] = await db.select().from(products).where(and(eq(products.published, true), eq(products.listingChannel, 'direct'), eq(products.archived, false))).limit(1);
  assert.ok(direct && direct.stock > 0, 'A Site Only specimen is available for a cart-only check.');
  await page.goto(base.href + 'shop/' + direct.slug, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^Add to cart/ }).click();
  await page.getByRole('button', { name: 'Added to your cart', exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base.href + 'checkout', { waitUntil: 'networkidle' });
  assert.ok(await page.getByText(direct.name, { exact: false }).count() > 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: '.checks/checkout-390.png' });
  await page.getByRole('button', { name: /PLACE ORDER BY INVOICE/ }).click();
  assert.equal(await page.getByRole('dialog').count(), 0, 'Incomplete delivery details do not open invoice confirmation.');
  await page.getByLabel('Email for your certificate').fill('sandbox@example.invalid');
  await page.getByLabel('First name', { exact: true }).fill('Sandbox');
  await page.getByLabel('Last name', { exact: true }).fill('Verification');
  await page.getByLabel('Street address', { exact: true }).fill('Local fixture, not an address');
  await page.getByLabel('City', { exact: true }).fill('Local test');
  await page.getByLabel('Postal code', { exact: true }).fill('0000-000');
  await page.getByRole('button', { name: /PLACE ORDER BY INVOICE/ }).click();
  const invoice = page.getByRole('dialog');
  await invoice.waitFor();
  await invoice.getByLabel('Your message (optional)').fill('Sandbox verification only. This message must never be submitted.');
  await invoice.getByRole('button', { name: 'Back', exact: true }).click();
  await invoice.waitFor({ state: 'detached' });
  report.pages.push({ path: '/checkout', width: 390, overflow: false });
  report.cart = { added: true, invoiceDialogCancelled: true, orderSubmitted: false };
  console.log('PASS cart/checkout at 390px: item retained, invoice note dialog opens and cancels; no order submitted.');
  await page.setViewportSize({ width: 1440, height: 1000 });

  await openAdmin(page);
  await page.getByRole('button', { name: '5. Page texts & photos', exact: false }).click();
  const expanders = page.locator('button[aria-expanded]');
  assert.ok(await expanders.count() >= 14);
  for (const element of await expanders.all()) assert.equal(await element.getAttribute('aria-expanded'), 'false', 'H sections start collapsed.');
  const heroToggle = page.getByRole('button', { name: 'Expand H2', exact: true });
  await heroToggle.click();
  const expandedHero = page.getByRole('button', { name: 'Collapse H2', exact: true });
  assert.equal(await expandedHero.getAttribute('aria-expanded'), 'true');
  assert.ok(await page.getByRole('button', { name: 'Save changes', exact: true }).count() > 0);
  await expandedHero.click();
  assert.equal(await page.getByRole('button', { name: 'Expand H2', exact: true }).getAttribute('aria-expanded'), 'false');
  console.log('PASS admin: H sections collapsed, row expands, individual Save changes present; nothing saved.');

  const submitted = await page.request.post(base.href + 'api/reviews', { data: {
    productSlug: product.slug, authorName: author, authorCountry: 'Portugal', rating: 4,
    title, body: 'Disposable local verification fixture. This is not a customer review and is removed after testing.',
  } });
  assert.equal(submitted.status(), 201);
  const submission = await submitted.json();
  reviewId = submission.id;
  assert.equal(submission.status, 'pending');
  assert.equal((await getProductReviews(product.id)).some(r => r.id === reviewId), false);
  assert.equal(await publicContains(page, title), false);
  report.moderation.push('submission: pending and hidden');
  await page.getByRole('button', { name: '6. Reviews', exact: false }).click();
  await page.locator(`article[data-review-id="${reviewId}"]`).waitFor();
  await decision(page, 'Approve', 'approved');
  await decision(page, 'Reject', 'rejected');
  assert.deepEqual(report.consoleErrors, [], 'No browser React/runtime errors.');

  const after = await snapshot();
  assert.deepEqual(after.products, before.products, 'Inventory was not changed.');
  assert.deepEqual(after.settings, before.settings, 'Saved content was not changed.');
  assert.deepEqual(after.reviews.filter(r => r.id !== reviewId), before.reviews, 'Existing reviews and moderation were not changed.');
  console.log('PASS preservation: products, settings and existing reviews unchanged.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  if (reviewId) await db.delete(reviews).where(and(eq(reviews.id, reviewId), eq(reviews.authorName, author))).catch(error => { console.error('Fixture cleanup failed:', error.message); process.exitCode = 1; });
  fs.mkdirSync('.checks', { recursive: true });
  fs.writeFileSync('.checks/recovery-report.json', JSON.stringify(report, null, '\n'));
  unregister();
  await pool.end();
  console.log('Only the exact disposable review fixture was removed. No purchase or email was made.');
});
