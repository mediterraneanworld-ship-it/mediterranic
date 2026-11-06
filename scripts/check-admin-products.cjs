/** LOCAL integration checks only. No payment gateway, e-mail or production writes. */
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { assertLocalDatabase } = require('./lib/live-public.cjs');
assertLocalDatabase(process.env.DATABASE_URL);
const base = process.argv[2] || 'http://127.0.0.1:3000';
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname)) throw Error('Integration checks only run against the local sandbox.');
require('tsx/cjs');
const { db, pool } = require('../src/db/index.ts');
const { products, productDeletions, reviews, orders, orderItems, newsletterSettings } = require('../src/db/schema.ts');
const { ensureSchema } = require('../src/lib/schema-migrate.ts');
const { getStoredOrderItems } = require('../src/lib/order-history.ts');
const { eq, inArray } = require('drizzle-orm');
const prefix = `sandbox-aj-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
const ids = [], slugs = [], orderIds = [];
let originalNewsletter;
async function api(path, method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(process.env.ADMIN_PASSWORD ? { 'x-admin-key': process.env.ADMIN_PASSWORD } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, data: await response.json().catch(() => null) };
}
async function create(label, fields = {}) {
  const slug = `${prefix}-${label}`; slugs.push(slug);
  const res = await api('/api/admin/products', 'POST', { slug, name: `[SANDBOX TEST] ${label} ${prefix}`, species: 'Test fixture', stock: 1, published: false, listingChannel: 'direct', priceDollars: '12.00', shortDescription: 'SANDBOX TEST. Temporary publication fixture, not a customer review.', description: '', images: [{ src: '/images/hero.jpg', alt: 'Sandbox fixture', label: 'Fixture' }], ...fields });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  ids.push(res.data.product.id); return res.data.product;
}
async function publish(product, value = true) { return api('/api/admin/products', 'POST', { id: product.id, action: 'set-published', published: value }); }
async function row(id) { return (await db.select().from(products).where(eq(products.id, id)).limit(1))[0]; }
async function remove(product, confirmation = product.slug) { return api(`/api/admin/products?id=${product.id}`, 'DELETE', { confirmation }); }
async function makeOrder(product, status) {
  const id = crypto.randomUUID(); orderIds.push(id);
  await db.insert(orders).values({ id, email: 'fixture@example.invalid', firstName: 'SANDBOX', lastName: 'TEST', country: 'PT', addressLine1: 'Test fixture, not an address', city: 'Test', postalCode: '0000-000', shippingMethod: 'free', subtotalCents: 1200, shippingCents: 0, totalCents: 1200, status, paymentMethod: 'direct' });
  await db.insert(orderItems).values({ orderId: id, productId: product.id, productName: product.name, productSlug: product.slug, unitPriceCents: 1200, quantity: 1 });
  return id;
}
(async () => {
  await ensureSchema();
  originalNewsletter = (await db.select().from(newsletterSettings).where(eq(newsletterSettings.id, 1)).limit(1))[0];
  const draft = await create('short-description');
  assert.equal((await publish(draft)).status, 200);
  assert.equal((await row(draft.id)).description, draft.shortDescription);
  assert.equal((await fetch(`${base}/shop/${draft.slug}`)).status, 200);
  assert.equal((await publish(draft, false)).status, 200);
  assert.equal((await fetch(`${base}/shop/${draft.slug}`)).status, 404);
  assert.equal((await publish(draft)).status, 200);
  console.log('PASS: new draft -> Publish -> Unpublish -> Publish, short description accepted.');

  const incomplete = await create('missing-price', { priceDollars: '0' });
  const blocked = await publish(incomplete);
  assert.equal(blocked.status, 400); assert.ok(blocked.data.missing.includes('priceDollars')); assert.equal((await row(incomplete.id)).published, false);
  assert.equal((await api('/api/admin/products', 'POST', { id: incomplete.id, priceDollars: '24.00', published: true })).status, 200);
  console.log('PASS: incomplete draft gets a precise error; fixing it in the editor publishes.');

  const unavailable = await create('unavailable', { stock: 0, listingChannel: null, priceDollars: '0' });
  assert.equal((await publish(unavailable)).status, 200);
  assert.equal((await row(unavailable.id)).listingChannel, null);
  assert.equal((await row(unavailable.id)).priceCents, 0);
  console.log('PASS: Unavailable can publish with no price and never receives invented stock/channel.');

  const marketplace = await create('marketplace', { listingChannel: 'ebay' });
  assert.equal((await publish(marketplace)).status, 400);
  assert.equal((await api('/api/admin/products', 'POST', { id: marketplace.id, ebayListingUrl: 'https://www.ebay.com/itm/123456789012', published: true })).status, 200);
  console.log('PASS: marketplace draft requires its listing link; no external request was made.');

  const archived = await create('archive', { archived: true, stock: 0, priceDollars: '0' });
  assert.equal((await publish(archived)).status, 200);
  const paidId = await makeOrder(archived, 'confirmed');
  const [testReview] = await db.insert(reviews).values({ productId: archived.id, authorName: 'SANDBOX TEST', authorCountry: '', rating: 5, title: '[SANDBOX TEST] Pending review', body: 'Temporary moderation preservation fixture, never a genuine testimonial.', moderationStatus: 'pending', showOnHome: false, verifiedPurchase: false }).returning();
  if (originalNewsletter) await db.update(newsletterSettings).set({ pieceIds: [...originalNewsletter.pieceIds, archived.id] }).where(eq(newsletterSettings.id, 1));
  assert.equal((await remove(archived, 'wrong-specimen')).status, 400);
  assert.ok(await row(archived.id));
  assert.equal((await remove(archived)).status, 200);
  assert.equal(await row(archived.id), undefined);
  assert.equal((await fetch(`${base}/shop/${archived.slug}`)).status, 404);
  const history = (await db.select().from(productDeletions).where(eq(productDeletions.slug, archived.slug)))[0];
  assert.equal(history.reviewsSnapshot[0].id, testReview.id);
  assert.equal(history.reviewsSnapshot[0].moderationStatus, 'pending');
  const receipt = await getStoredOrderItems(paidId);
  assert.equal(receipt.length, 1); assert.equal(receipt[0].productName, archived.name); assert.equal(receipt[0].unitPriceCents, 1200);
  const [paid] = await db.select().from(orders).where(eq(orders.id, paidId));
  assert.equal(paid.totalCents, 1200); assert.equal(paid.status, 'confirmed');
  if (originalNewsletter) {
    const [current] = await db.select().from(newsletterSettings).where(eq(newsletterSettings.id, 1));
    assert.deepEqual(current.pieceIds, originalNewsletter.pieceIds); assert.equal(current.autoEnabled, originalNewsletter.autoEnabled);
  }
  const backup = await api('/api/admin/backup');
  assert.equal(backup.status, 200);
  const snapshot = backup.data.productDeletions.find((item) => item.slug === archived.slug);
  assert.ok(snapshot); assert.ok(!backup.data.products.some((item) => item.slug === archived.slug));
  assert.equal((await api('/api/admin/restore', 'POST', { format: 'mediterranic-backup', products: [], productDeletions: [snapshot] })).status, 200);
  assert.equal((await db.select().from(productDeletions).where(eq(productDeletions.slug, archived.slug))).length, 1);
  assert.equal(await row(archived.id), undefined);
  assert.equal((await getStoredOrderItems(paidId)).length, 1);
  console.log('PASS: true archive deletion; receipt, pending moderation and backup/restore history preserved.');

  const pending = await create('pending-payment'); const pendingId = await makeOrder(pending, 'pending_payment');
  assert.equal((await remove(pending)).status, 409); assert.ok(await row(pending.id));
  await db.update(orders).set({ status: 'cancelled' }).where(eq(orders.id, pendingId));
  assert.equal((await remove(pending)).status, 200);
  console.log('PASS: payment in progress is protected; deletion works after cancellation.');

  for (const product of [draft, incomplete, unavailable, marketplace]) assert.equal((await remove(product)).status, 200);
  const { getAllProducts } = require('../src/lib/catalog.ts');
  const adminCatalogue = await getAllProducts({ includeDrafts: true });
  assert.ok(!adminCatalogue.some(product => product.id === archived.id));
  assert.equal((await db.select().from(products).where(eq(products.id, archived.id))).length, 0);
  console.log('PASS: deleted entries are gone from the admin catalogue.');
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  // IDs/slugs are only those generated above, never an existing owner specimen.
  if (orderIds.length) await db.delete(orders).where(inArray(orders.id, orderIds));
  if (ids.length) await db.delete(products).where(inArray(products.id, ids));
  if (slugs.length) await db.delete(productDeletions).where(inArray(productDeletions.slug, slugs));
  if (originalNewsletter) await db.update(newsletterSettings).set({ pieceIds: originalNewsletter.pieceIds, autoEnabled: originalNewsletter.autoEnabled, updatedAt: originalNewsletter.updatedAt }).where(eq(newsletterSettings.id, 1));
  console.log('Local fixtures removed. No real purchases or e-mails were sent.');
  await pool.end();
});
