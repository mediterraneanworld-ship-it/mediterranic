/** Playwright smoke checks against LOCAL fixtures only; never production. */
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { assertLocalDatabase } = require('./lib/live-public.cjs');
assertLocalDatabase(process.env.DATABASE_URL);
const base = process.argv[2] || 'http://127.0.0.1:3000';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Browser checks are local only.');
require('tsx/cjs');
const { db, pool } = require('../src/db/index.ts');
const { products, productDeletions } = require('../src/db/schema.ts');
const { eq, inArray } = require('drizzle-orm');
const { chromium } = require('playwright');
const prefix = `sandbox-browser-aj-${Date.now()}`;
const ids = [], slugs = [];
let browser;
async function create(label, price) {
  const slug = `${prefix}-${label}`;
  const response = await fetch(base + '/api/admin/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, name: `[SANDBOX TEST] ${label}`, species: 'Fixture', published: false, stock: 1, listingChannel: 'direct', priceDollars: String(price), description: '', shortDescription: 'SANDBOX TEST: disposable browser fixture.', images: [{ src: '/images/hero.jpg', alt: 'Fixture', label: 'Fixture' }] }) });
  const data = await response.json(); assert.equal(response.status, 201, JSON.stringify(data)); ids.push(data.product.id); slugs.push(data.product.slug); return data.product;
}
(async () => {
  const good = await create('Ready draft', 12);
  const missing = await create('Missing price', 0);
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/admin', { waitUntil: 'networkidle' });
  const entry = page.getByRole('button', { name: 'Enter Back-Office', exact: true });
  if (await entry.count()) await entry.click();
  await page.locator('tr[data-specimen-id]').first().waitFor();
  const rows = await page.locator('tr[data-specimen-id]').evaluateAll(els => els.map(el => el.dataset.availability));
  const firstUnavailable = rows.indexOf('unavailable');
  assert.ok(firstUnavailable >= 0);
  assert.ok(rows.slice(firstUnavailable).every(value => value === 'unavailable'));
  console.log('PASS browser: all Unavailable rows are last.');

  const row = page.locator(`tr[data-specimen-id="${good.id}"]`);
  for (const label of ['Publish', 'Unpublish', 'Publish']) {
    const [response] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/api/admin/products') && res.request().method() === 'POST'),
      row.getByRole('button', { name: label, exact: true }).click(),
    ]);
    assert.equal(response.status(), 200);
    await row.getByRole('button', { name: label === 'Publish' ? 'Unpublish' : 'Publish', exact: true }).waitFor();
  }
  console.log('PASS browser: new draft Publish/Unpublish/Publish buttons work.');

  const incompleteRow = page.locator(`tr[data-specimen-id="${missing.id}"]`);
  const [rejected] = await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/admin/products') && res.request().method() === 'POST'),
    incompleteRow.getByRole('button', { name: 'Publish', exact: true }).click(),
  ]);
  assert.equal(rejected.status(), 400);
  const editor = incompleteRow.locator('xpath=following-sibling::tr[1]').locator('form');
  await editor.waitFor();
  assert.ok((await editor.getByRole('alert').textContent()).includes('price in EUR'));
  const price = editor.locator('label').filter({ hasText: /^Price \(EUR €\) \*$/ }).locator('xpath=..').locator('input');
  await price.fill('35.25');
  const [saved] = await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/admin/products') && res.request().method() === 'POST'),
    editor.getByRole('button', { name: 'Save & publish', exact: true }).click(),
  ]);
  assert.equal(saved.status(), 200);
  await incompleteRow.getByRole('button', { name: 'Unpublish', exact: true }).waitFor();
  const [savedPiece] = await db.select().from(products).where(eq(products.id, missing.id));
  assert.equal(savedPiece.priceCents, 3525);
  console.log('PASS browser: inline publication error, correction with cents and Save & publish.');

  fs.mkdirSync('.checks', { recursive: true });
  for (const width of [320, 360, 390, 430, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await row.getByRole('button', { name: /Delete .* permanently/ }).click();
    const dialog = page.getByRole('dialog'); await dialog.waitFor();
    const box = await dialog.boundingBox(); assert.ok(box.x >= -1 && box.x + box.width <= width + 1, `dialog fits ${width}px`);
    const confirm = dialog.getByRole('button', { name: 'Delete permanently', exact: true });
    assert.equal(await confirm.isDisabled(), true);
    await dialog.getByLabel(/Type DELETE/).fill('DELETE');
    assert.equal(await confirm.isEnabled(), true);
    if (width === 390) await dialog.screenshot({ path: '.checks/delete-dialog-390.png' });
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.ok((await db.select().from(products).where(eq(products.id, good.id))).length === 1);
    console.log(`PASS browser: ${width}px confirmation and cancel.`);
  }
  await row.getByRole('button', { name: /Delete .* permanently/ }).click();
  const dialog = page.getByRole('dialog'); await dialog.getByLabel(/Type DELETE/).fill('DELETE');
  const [deleted] = await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/admin/products') && res.request().method() === 'DELETE'),
    dialog.getByRole('button', { name: 'Delete permanently', exact: true }).click(),
  ]);
  assert.equal(deleted.status(), 200);
  await row.waitFor({ state: 'detached' });
  assert.equal((await db.select().from(products).where(eq(products.id, good.id))).length, 0);
  assert.equal(errors.length, 0, JSON.stringify(errors));
  console.log('PASS browser: confirmed permanent deletion removes the row; no React errors.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  if (ids.length) await db.delete(products).where(inArray(products.id, ids));
  if (slugs.length) await db.delete(productDeletions).where(inArray(productDeletions.slug, slugs));
  await pool.end(); console.log('All browser fixtures removed.');
});
