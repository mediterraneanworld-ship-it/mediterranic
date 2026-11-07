const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const { assertLocalDatabase, balancedJson, decodeFlight, productFromHtml, homeFromHtml, shippingFromHtml, replaceImageReferences, collectionFromHtml } = require("./lib/live-public.cjs");

test("mirror refuses every non-loopback database before loading the application", () => {
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) assert.doesNotThrow(() => assertLocalDatabase(`postgresql://u:p@${host}:5432/app_db`));
  for (const url of ["postgresql://u:p@ep-live.neon.tech/db", "postgresql://u:p@10.0.0.8/db", "postgresql://u:p@db.example.com/db", undefined]) assert.throws(() => assertLocalDatabase(url));
  const source = fs.readFileSync("scripts/pull-live.cjs", "utf8");
  assert.ok(source.indexOf("assertLocalDatabase(process.env.DATABASE_URL)") < source.indexOf('require("tsx/cjs/api")'));
  assert.match(source, /require\("\.\.\/src\/db\/index\.ts"\)/);
  assert.doesNotMatch(source, /new Client\(|ON CONFLICT \(id\) DO UPDATE|setval\(/);
});

test("flight decoding preserves escaped quotes and balanced JSON", () => {
  const chunk = JSON.stringify({ images: [{ src: "/api/uploads/1", alt: 'A "quoted" title' }] });
  const html = `<script>self.__next_f.push(${JSON.stringify([1, chunk])})</script>`;
  const blob = decodeFlight(html);
  assert.equal(JSON.parse(balancedJson(blob, blob.indexOf("{"))).images[0].alt, 'A "quoted" title');
});

test("product extraction keeps gallery, commerce and dimensions together", () => {
  const props = { slug: "test-piece", name: "Test piece", priceCents: 1200, stock: 1, listingChannel: "direct", externalListingUrl: null };
  const flight = JSON.stringify(props) + JSON.stringify({ images: [{ src: "/api/uploads/9", alt: "Specimen", label: "Top" }] });
  const html = `<h1>Test piece</h1><dl><dt>Dimensions</dt><dd>Specimen: 4.0 x 5.0 cm</dd></dl><script>self.__next_f.push(${JSON.stringify([1, flight])})</script>`;
  const result = productFromHtml(html, "test-piece");
  assert.equal(result.images[0].src, "/api/uploads/9");
  assert.equal(result.purchase.priceCents, 1200);
  assert.equal(result.specs.Dimensions, "Specimen: 4.0 x 5.0 cm");
});

test("home covers are read from the actual cards, not guessed from upload numbers", () => {
  const html = `<header><div class="bg-ink"><span>Trust</span></div><a href="/"><img src="/api/uploads/14"><span class="whitespace-nowrap">Mediterranic</span><span class="whitespace-nowrap">Moroccan Trilobites</span></a></header><main><section><img alt="A hand-prepared trilobite" src="/api/uploads/20"><p>Caption</p><h1>Title <em>italic</em></h1><p>Description</p></section><section><h2>Collections</h2><a href="/shop?collection=devonian-crown"><img src="/api/uploads/26"><h3>Devonian</h3><p>Text</p></a><a href="https://example.com/souss"><img src="/api/uploads/17"><h3>Souss Lagerstätte</h3><p>Cambrian text</p></a></section></main>`;
  const result = homeFromHtml(html);
  assert.equal(result.covers.logo, "/api/uploads/14");
  assert.equal(result.home.collectionCards[0].src, "/api/uploads/26");
  assert.equal(result.home.collectionCards[1].src, "/api/uploads/17");
  assert.equal(result.home.heroTitle, "Title");
  assert.equal(result.home.heroTitleItalic, "italic");
});

test("image remapping is recursive and never changes prices, REFs or text", () => {
  const input = { images: [{ src: "/api/uploads/1", alt: "REF PAIS9600" }], content: { home: { collections: { covers: { connoisseur: "/api/uploads/24" } } } }, priceCents: 135000, specimenReference: "PAIS9600" };
  const output = replaceImageReferences(input, new Map([["/api/uploads/1", "/api/uploads/101"], ["/api/uploads/24", "/api/uploads/102"]]));
  assert.equal(output.images[0].src, "/api/uploads/101");
  assert.equal(output.content.home.collections.covers.connoisseur, "/api/uploads/102");
  assert.equal(output.priceCents, 135000);
  assert.equal(output.specimenReference, "PAIS9600");
  assert.equal(input.images[0].src, "/api/uploads/1");
});

test("shipping paragraphs and free-shipping state are public, not inferred from an error", () => {
  const result = shippingFromHtml('<main><header><p>Client care</p><h1>Shipping</h1><p>Intro</p></header><section id="dispatch"><h2>Dispatch</h2><ul><li>One</li><li>Two</li></ul></section><strong>Free shipping on every order</strong></main>');
  assert.deepEqual(result.sections.dispatch.items, ["One", "Two"]);
  assert.equal(result.freeShipping, true);
  assert.equal(shippingFromHtml("<main></main>").freeShipping, undefined);
});

test("footer wordmark stays on one line and upload IDs revalidate by content hash", () => {
  const footer = fs.readFileSync("src/components/site-footer.tsx", "utf8");
  assert.match(footer, /whitespace-nowrap font-display text-\[clamp\(1\.125rem,2vw,1\.75rem\)\]/);
  const route = fs.readFileSync("src/app/api/uploads/[id]/route.ts", "utf8");
  assert.match(route, /max-age=0, must-revalidate/);
  assert.match(route, /if-none-match/);
  assert.match(route, /status: 304/);
  assert.doesNotMatch(route, /Cache-Control[^\n]*immutable/);
});


test('public mirror reads the archive invitation without confusing it with closing copy', () => {
  const html = '<main><section><h2>Begin <em class="text-terracotta">collecting</em></h2><p>Closing description.</p><div><div><div><h3>Pieces that found their collectors last days.</h3></div></div><div><figure><img src="/images/hero.jpg" alt="Example"><figcaption>Example</figcaption></figure></div><p>Visit the whole archive, where you can request similar specimens.</p></div></section></main>';
  const result = homeFromHtml(html);
  assert.equal(result.home.closing.archiveTitle, 'Pieces that found their collectors last days.');
  assert.equal(result.home.closing.archiveNote, 'Visit the whole archive, where you can request similar specimens.');
});

test('collection mirror requires the exact complete public filter and deduplicates specimen links', () => {
  const flight = JSON.stringify({ initialCollection: 'devonian-crown', initialChannel: 'all' });
  const html = `<html><header><a href="/shop/outside-main">Outside</a></header><main><a href="/shop/cyphaspis-walteri">One</a><a href="/shop/cyphaspis-walteri">Duplicate</a><a href="/shop?collection=the-connoisseur">Filter</a></main><script>self.__next_f.push(${JSON.stringify([1, flight])})</script></html>`;
  assert.deepEqual(collectionFromHtml(html, 'devonian-crown'), { verified: true, slugs: ['cyphaspis-walteri'] });
  assert.equal(collectionFromHtml(html, 'the-connoisseur').verified, false);
  assert.equal(collectionFromHtml(html.replace('</html>', ''), 'devonian-crown').verified, false);
  assert.equal(collectionFromHtml('<html><main>Forbidden</main></html>', 'devonian-crown').verified, false);
  assert.equal(collectionFromHtml(html, 'unknown-collection').verified, false);
});

test('a verified empty collection is readable but never clears local memberships', () => {
  const flight = JSON.stringify({ initialCollection: 'the-connoisseur', products: [] });
  const html = `<html><main><p>No pieces match</p></main><script>self.__next_f.push(${JSON.stringify([1, flight])})</script></html>`;
  assert.deepEqual(collectionFromHtml(html, 'the-connoisseur'), { verified: true, slugs: [] });
  const source = fs.readFileSync('scripts/pull-live.cjs', 'utf8');
  assert.match(source, /if \(!observed\.verified\) throw new Error/);
  assert.match(source, /\.set\(\{ collections: next \}\)/);
  assert.match(source, /removedSlugs\.has\(slug\)/);
});
