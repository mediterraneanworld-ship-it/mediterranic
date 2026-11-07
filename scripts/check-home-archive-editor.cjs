/** LOCAL-only browser check. Restores gallery/content after a temporary cover choice. No emails or purchases. */
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const { assertLocalDatabase } = require('./lib/live-public.cjs');
assertLocalDatabase(process.env.DATABASE_URL);
const base = process.argv[2] || 'http://127.0.0.1:3000';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('This test may only use the local sandbox.');
require('tsx/cjs');
const { db, pool } = require('../src/db/index.ts');
const { products, siteSettings } = require('../src/db/schema.ts');
const { eq, like } = require('drizzle-orm');
const { chromium } = require('playwright');
let browser, originalProduct, originalSettings;
(async () => {
  [originalProduct] = await db.select().from(products).where(eq(products.slug, 'daguinaspis-ambroggii-brevipelta')).limit(1);
  [originalSettings] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
  assert.ok(originalProduct?.images.length > 1 && originalProduct.archived);
  assert.ok(originalSettings);
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().includes('/api/admin/products') && response.request().method() === 'POST') console.log('SAVE STATUS:', response.status()); });
  require('node:fs').mkdirSync('.checks', { recursive: true });
  const headers = process.env.ADMIN_PASSWORD ? { 'x-admin-key': process.env.ADMIN_PASSWORD } : {};
  const auth = await fetch(base + '/api/admin/auth', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ password: process.env.ADMIN_PASSWORD || 'mediterranic23' }) });
  assert.equal(auth.status, 200);
  const cookie = auth.headers.getSetCookie().find(value => value.startsWith('mediterranic_admin='));
  assert.ok(cookie);
  const [pair] = cookie.split(';');
  const separator = pair.indexOf('=');
  await page.context().addCookies([{ name: pair.slice(0, separator), value: pair.slice(separator + 1), url: base, httpOnly: true, sameSite: 'Lax' }]);
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  const grid = page.locator('div.grid').filter({ has: page.locator(`figure img[src="${originalProduct.images[0].src}"]`) }).first();
  const publicArchive = await db.select({ published: products.published }).from(products).where(eq(products.archived, true));
  assert.equal(await grid.locator(':scope > figure').count(), Math.min(4, publicArchive.filter(piece => piece.published).length));
  assert.equal(await grid.locator('a, button, [role=link], [onclick]').count(), 0);
  assert.ok((await page.getByRole('heading', { name: 'Pieces that found their collectors last days.', exact: true }).textContent()).includes('last days.'));
  const note = page.getByRole('link', { name: 'Visit the whole archive, where you can request similar specimens.', exact: true });
  await note.waitFor();
  assert.equal(await note.getAttribute('href'), '/archive');
  assert.ok(await grid.evaluate(element => Boolean(element.compareDocumentPosition(element.nextElementSibling) & Node.DOCUMENT_POSITION_FOLLOWING)));
  assert.equal((await grid.locator('xpath=following-sibling::p[1]').textContent()).trim(), 'Visit the whole archive, where you can request similar specimens.');
  const preview = grid.locator('figure').filter({ hasText: originalProduct.name });
  assert.equal(await preview.locator('img').getAttribute('src'), originalProduct.images[0].src);
  assert.equal(await preview.locator('a, button, [role=link], [onclick]').count(), 0);
  assert.equal(await preview.evaluate(element => getComputedStyle(element).cursor), 'auto');
  await preview.locator('img').click();
  assert.equal(page.url(), base + '/', 'home photograph does not navigate');
  await preview.locator('figcaption').click();
  assert.equal(page.url(), base + '/', 'home title does not navigate');
  // The separate archive page retains its original card links and specimen enquiry.
  await page.goto(base + '/archive', { waitUntil: 'networkidle' });
  const archiveCard = page.locator(`main a[href="/shop/${originalProduct.slug}"]`);
  await archiveCard.waitFor();
  assert.ok((await archiveCard.innerText()).includes('Request a similar specimen'));
  await archiveCard.click();
  await page.waitForURL(base + `/shop/${originalProduct.slug}`);
  const request = page.getByRole('link', { name: 'Request a similar specimen', exact: true });
  await request.waitFor();
  assert.ok((await request.getAttribute('href')).startsWith('mailto:'));
  assert.equal(await page.locator('main').getByText('Sold', { exact: true }).count(), 0);
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  for (const width of [320, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await note.scrollIntoViewIfNeeded();
    const noteBox = await note.boundingBox(), lastCardBox = await grid.locator(':scope > figure').last().boundingBox();
    assert.ok(noteBox.y >= lastCardBox.y + lastCardBox.height - 1, 'note stays below cards on mobile');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  console.log('PASS: home photos/titles are unlinked; /archive retains specimen links and enquiries.');

  await page.goto(base + '/admin', { waitUntil: 'networkidle' });
  const login = page.getByRole('button', { name: 'Enter Back-Office', exact: true });
  if (await login.count()) await login.click();
  await page.locator(`tr[data-specimen-id="${originalProduct.id}"]`).waitFor();
  const productRow = page.locator(`tr[data-specimen-id="${originalProduct.id}"]`);
  await productRow.getByRole('button', { name: 'Edit / Photos', exact: true }).click();
  const form = productRow.locator('xpath=following-sibling::tr[1]').locator('form');
  await form.waitFor();
  await form.getByRole('button', { name: 'Make cover', exact: true }).first().click();
  // This archived piece has no current sales channel; make the cover-only test explicit.
  await form.locator('select').filter({ has: page.locator('option', { hasText: 'Site Only (Direct Sale on Mediterranic)' }) }).selectOption('');
  const [saved] = await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/admin/products') && res.request().method() === 'POST'),
    form.getByRole('button', { name: 'Save & publish', exact: true }).click(),
  ]);
  assert.equal(saved.status(), 200);
  const stored = (await saved.json()).product;
  assert.equal(stored.images[0].src, originalProduct.images[1].src);
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  const changedPreview = page.locator('figure').filter({ hasText: originalProduct.name });
  assert.equal(await changedPreview.locator('img').getAttribute('src'), originalProduct.images[1].src);
  assert.equal(await changedPreview.locator('a, button').count(), 0);
  console.log('PASS: Make cover changes the first photo on the unlinked home card.');

  // Restore the original order before testing Tab 5; the original gallery is never left altered.
  await db.update(products).set({ images: originalProduct.images }).where(eq(products.id, originalProduct.id));
  await page.goto(base + '/admin', { waitUntil: 'networkidle' });
  // The local preview gate can reset after a hard navigation; its server cookie
  // still authorises the same browser. Enter it again before using Tab 5.
  const previewEntry = page.getByRole('button', { name: 'Enter Back-Office', exact: true });
  if (await previewEntry.count()) await previewEntry.click();
  await page.getByRole('button', { name: /5\. Page texts/ }).click();
  await page.getByRole('button', { name: 'Home sections (H0–H13)', exact: true }).click();
  const items = page.locator('ol > li').filter({ has: page.locator('button[aria-expanded]') });
  assert.equal(await items.count(), 14);
  for (let index = 0; index < 14; index++) assert.equal(await items.nth(index).locator('button[aria-expanded]').getAttribute('aria-expanded'), 'false');
  for (let index = 0; index < 14; index++) {
    const item = items.nth(index), toggle = item.locator('button[aria-expanded]'), label = await toggle.getAttribute('aria-label');
    const number = label.replace(/^(Expand|Collapse) /, '');
    const header = toggle.locator('xpath=ancestor::div[contains(@class,"cursor-pointer")][1]');
    const blank = header.locator(':scope > div').first();
    await header.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(200);
    await blank.click({ position: { x: (await blank.boundingBox()).width - 2, y: 10 } });
    await item.locator('button[aria-expanded="true"]').waitFor();
    await item.getByRole('button', { name: 'Save changes', exact: true }).waitFor();
    // An expanded H2 is tall: explicitly return to its header instead of
    // allowing a locator's automatic scroll to race with browser scrolling.
    await header.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(200);
    const box = await blank.boundingBox();
    assert.ok(box.width > 2, 'there is a clickable blank area outside the arrow');
    await blank.click({ position: { x: (await blank.boundingBox()).width - 2, y: 10 } });
    await item.locator('button[aria-expanded="false"]').waitFor();
    await item.locator('span.font-mono').filter({ hasText: new RegExp('^' + number + '$') }).click();
    await item.locator('button[aria-expanded="true"]').waitFor();
    await toggle.click();
    await item.locator('button[aria-expanded="false"]').waitFor();
  }
  console.log('PASS: all H0–H13 rows expand/collapse from blank space, number and arrow.');
  const h12 = items.filter({ has: page.locator('button[aria-label$=" H12"]') });
  await h12.locator('button[aria-expanded]').click();
  const field = h12.locator('label').filter({ hasText: 'Archive block · line below the pieces' }).locator('input');
  assert.equal(await field.inputValue(), 'Visit the whole archive, where you can request similar specimens.');
  await h12.locator('button[aria-expanded]').click();
  console.log('PASS: H12 exposes the new archive line for editing.');

  for (const width of [320, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    const sample = items.nth(6), sampleToggle = sample.locator('button[aria-expanded]');
    const sampleHeader = sampleToggle.locator('xpath=ancestor::div[contains(@class,"cursor-pointer")][1]');
    await sampleHeader.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(200);
    const space = sampleHeader.locator(':scope > div').first();
    await space.click({ position: { x: (await space.boundingBox()).width - 2, y: 10 } });
    await sample.locator('button[aria-expanded="true"]').waitFor();
    assert.equal(await sampleToggle.getAttribute('aria-expanded'), 'true');
    await sample.getByRole('button', { name: 'Save changes', exact: true }).waitFor();
    await sampleHeader.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(200);
    await sampleToggle.click();
    assert.equal(await sampleToggle.getAttribute('aria-expanded'), 'false');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'admin fits mobile viewport');
  }
  console.log('PASS: H-row editing and collapse work at 320/360/390/430px.');
  await page.setViewportSize({ width: 1440, height: 1000 });
  const orderBefore = await page.locator('button[aria-expanded]').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label').replace(/^(Expand|Collapse) /, '')));
  const h4 = items.filter({ has: page.locator('button[aria-label$=" H4"]') });
  await h4.locator('button[aria-expanded]').click();
  await h4.getByRole('button', { name: 'Move H4 up', exact: true }).click();
  assert.equal(await h4.locator('button[aria-expanded]').getAttribute('aria-expanded'), 'true', 'move does not collapse editor');
  assert.equal(await page.getByRole('button', { name: 'Save all pages', exact: true }).count(), 1, 'move stays unsaved');
  assert.equal(errors.length, 0, errors.join('\n'));
  const [settingsNow] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1));
  assert.deepEqual(settingsNow.content, originalSettings.content, 'Tab 5 interaction did not save content');
  await page.getByRole('button', { name: 'Reset order', exact: true }).click();
  const restoredOrder = await page.locator('button[aria-expanded]').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label').replace(/^(Expand|Collapse) /, '')));
  assert.deepEqual(restoredOrder, orderBefore);
  console.log('PASS: move controls stay independent; no content was saved and no React errors.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  if (originalProduct) await db.update(products).set({ images: originalProduct.images }).where(eq(products.id, originalProduct.id));
  if (originalSettings) await db.update(siteSettings).set({ content: originalSettings.content, updatedAt: originalSettings.updatedAt }).where(eq(siteSettings.id, 1));
  await db.delete(products).where(like(products.slug, 'sandbox-%'));
  await pool.end(); console.log('Original local gallery/settings restored; test-only catalogue rows removed.');
});
