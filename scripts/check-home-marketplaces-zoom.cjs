/** Read-only browser check for H6 zoom and the hidden H9 section.
 * LOCAL HTTP origin only. No orders, emails, settings writes or production requests.
 * Run against the managed preview: node scripts/check-home-marketplaces-zoom.cjs
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const base = new URL(process.argv[2] || 'http://127.0.0.1:3000');
assert.ok(base.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'This check only runs against a local HTTP sandbox.');
const origin = base.origin;
let browser;
const errors = [];

async function imageScale(image) {
  return image.evaluate(element => {
    const style = getComputedStyle(element);
    if (style.scale !== 'none') return Number.parseFloat(style.scale);
    return style.transform === 'none' ? 1 : new DOMMatrixReadOnly(style.transform).a;
  });
}

(async () => {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    const method = route.request().method();
    // The local preview gate only sets a cookie; block all data-changing calls.
    const localLogin = url.pathname === '/api/admin/auth' && method === 'POST';
    if (method !== 'GET' && method !== 'HEAD' && !localLogin) return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/', { waitUntil: 'networkidle' });
  assert.equal(await page.getByText('Verified storefronts', { exact: true }).count(), 0);
  assert.equal(await page.getByRole('heading', { name: 'One standard across all marketplaces', exact: true }).count(), 0);
  assert.ok(await page.locator('a[href="/shop?channel=direct"]').count() > 0, 'Site Only link remains.');
  assert.ok(await page.locator('a[href="/shop?channel=ebay"]').count() > 0, 'eBay channel link remains.');
  assert.ok(await page.locator('a[href="/shop?channel=catawiki"]').count() > 0, 'Catawiki channel link remains.');
  const note = page.getByRole('link', { name: 'Visit the whole archive, where you can request similar specimens.', exact: true });
  assert.equal(await note.getAttribute('href'), '/archive', 'The previous archive-note change is preserved.');

  const cards = page.locator('a[data-collection]');
  assert.equal(await cards.count(), 4, 'All four collection cards remain.');
  const slugs = await cards.evaluateAll(links => links.map(link => link.dataset.collection));
  assert.deepEqual(slugs, ['devonian-crown', 'ordovician-mariners', 'cambrian-dawn', 'the-connoisseur']);
  for (let i = 0; i < 4; i++) {
    const card = cards.nth(i);
    const image = card.locator('img');
    assert.ok(await card.getAttribute('href'), 'Collection destination is preserved.');
    await card.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(60);
    assert.ok(Math.abs((await imageScale(image)) - 1) < 0.01, 'Image starts at its normal size.');
    await card.hover();
    await page.waitForTimeout(100);
    const zoom = await imageScale(image);
    assert.ok(Math.abs(zoom - 1.2) < 0.01, `${slugs[i]} zooms to 120% on desktop; got ${zoom}`);
    const neighbour = cards.nth((i + 1) % 4).locator('img');
    assert.ok(Math.abs((await imageScale(neighbour)) - 1) < 0.01, 'Only the hovered card zooms.');
    console.log(`PASS desktop hover: ${slugs[i]} → ${zoom.toFixed(2)}×`);
  }
  await page.mouse.move(0, 0);
  await cards.first().focus();
  await page.keyboard.press('Tab');
  await page.waitForTimeout(100);
  assert.ok(Math.abs((await imageScale(cards.nth(1).locator('img'))) - 1.2) < 0.01, 'Keyboard focus gets the same desktop zoom.');
  fs.mkdirSync('.checks', { recursive: true });
  await cards.first().locator('xpath=ancestor::section[1]').screenshot({ path: '.checks/home-collections-desktop.png' });
  console.log('PASS desktop keyboard focus: collection image zooms to 120%.');

  for (const width of [320, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(origin + '/', { waitUntil: 'networkidle' });
    const mobileCards = page.locator('a[data-collection]');
    assert.equal(await mobileCards.count(), 4);
    await mobileCards.first().hover();
    await page.waitForTimeout(100);
    assert.ok(Math.abs((await imageScale(mobileCards.first().locator('img'))) - 1) < 0.01, `${width}px has no desktop-only zoom`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1), `${width}px does not overflow horizontally`);
    console.log(`PASS mobile ${width}px: four cards, no desktop-only zoom or overflow.`);
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/admin', { waitUntil: 'networkidle' });
  const entry = page.getByRole('button', { name: 'Enter Back-Office', exact: true });
  if (await entry.count()) await entry.click();
  await page.getByRole('button', { name: '5. Page texts & photos', exact: false }).click();
  await page.getByText('Hidden from homepage · settings preserved', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Expand H9', exact: true }).click();
  assert.ok(await page.getByText('Hidden from the homepage as a duplicate.', { exact: false }).count() > 0);
  assert.equal(errors.length, 0, JSON.stringify(errors));
  console.log('PASS admin H9: hidden status is clear; saved settings can still be inspected without saving.');
  console.log('PASS no React errors, production requests or data-changing admin requests.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); });
