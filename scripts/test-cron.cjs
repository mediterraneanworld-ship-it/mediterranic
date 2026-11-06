/** Offline checks: fake secrets, mocked delivery, no database or network access. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, { imports = {}, env = {} } = {}) {
  const module = { exports: {} };
  const context = vm.createContext({
    module, exports: module.exports, process: { env }, console,
    Request, Response, Headers, URL,
    require(name) {
      if (Object.hasOwn(imports, name)) return imports[name];
      throw new Error(`Unexpected dependency in read-only test: ${name}`);
    },
    fetch() { throw new Error('A configuration check must not contact a mailer or database.'); },
  });
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInContext(compiled, context);
  return module.exports;
}

const fakeSecret = 'fixture-only-cron-value-not-a-real-secret';
const configuration = (env = {}) => load('src/lib/cron-configuration.ts', { env });

test('existing CRON_SECRET is recognised without returning its value', () => {
  const status = configuration({ VERCEL: '1', VERCEL_ENV: 'production', CRON_SECRET: fakeSecret }).getCronConfiguration();
  assert.equal(status.cronSecretConfigured, true);
  assert.equal(status.environment, 'production');
  assert.equal(status.vercelProductionDeployment, true);
  assert.equal(status.configurationOnly, true);
  assert.equal(JSON.stringify(status).includes(fakeSecret), false);
});

test('Preview can have the same secret without being a production schedule', () => {
  const status = configuration({ VERCEL: '1', VERCEL_ENV: 'preview', CRON_SECRET: fakeSecret }).getCronConfiguration();
  assert.equal(status.cronSecretConfigured, true);
  assert.equal(status.environment, 'preview');
  assert.equal(status.vercelProductionDeployment, false);
});

test('sandbox and missing or blank secrets are reported honestly', () => {
  for (const env of [{}, { CRON_SECRET: '   ' }]) {
    const status = configuration(env).getCronConfiguration();
    assert.equal(status.cronSecretConfigured, false);
    assert.equal(status.environment, 'sandbox');
    assert.equal(status.vercelProductionDeployment, false);
  }
  assert.equal(configuration({ VERCEL: '1' }).getCronConfiguration().environment, 'unknown');
});

test('displayed UTC schedules match the shipped vercel.json', () => {
  const expected = JSON.parse(fs.readFileSync('vercel.json', 'utf8')).crons;
  const jobs = configuration().getCronConfiguration().jobs;
  assert.equal(jobs.length, expected.length);
  for (const job of jobs) {
    assert.equal(expected.find((entry) => entry.path === job.path)?.schedule, job.schedule);
  }
});

test('configuration API requires admin authentication and disables caching', async () => {
  let checked = false;
  const route = load('src/app/api/admin/cron-configuration/route.ts', {
    imports: {
      '@/lib/admin-auth': { isAdminAuthenticated: async () => false },
      '@/lib/cron-configuration': { getCronConfiguration() { checked = true; return {}; } },
    },
  });
  const response = await route.GET();
  assert.equal(response.status, 401);
  assert.equal(checked, false);
  assert.match(response.headers.get('cache-control'), /no-store/);
});

test('authenticated configuration API can only inspect environment, never send', async () => {
  const route = load('src/app/api/admin/cron-configuration/route.ts', {
    imports: {
      '@/lib/admin-auth': { isAdminAuthenticated: async () => true },
      '@/lib/cron-configuration': configuration({ CRON_SECRET: fakeSecret, VERCEL: '1', VERCEL_ENV: 'production' }),
    },
  });
  const response = await route.GET();
  const text = await response.text();
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(text).cronSecretConfigured, true);
  assert.equal(text.includes(fakeSecret), false);
  assert.match(response.headers.get('cache-control'), /private, no-store/);
});

function cronFixture({ secret = fakeSecret, autoEnabled = false, due = true } = {}) {
  const calls = { settings: 0, cadence: 0, sends: 0 };
  const route = load('src/app/api/cron/newsletter/route.ts', {
    env: secret ? { CRON_SECRET: secret } : {},
    imports: {
      '@/lib/newsletter-send': {
        async getNewsletterSettings() { calls.settings++; return { autoEnabled, pieceIds: [] }; },
        async getNewsletterCadence() { calls.cadence++; return { due, daysSince: due ? 16 : 3 }; },
        async sendNewsletter(input) {
          assert.equal(input.source, 'cron');
          calls.sends++;
          return { ok: true, sent: 1, failed: 0, recipients: 1, pieces: 1, status: 'sent' };
        },
      },
    },
  });
  return { route, calls };
}

const cronRequest = (token = fakeSecret) => new Request('https://example.test/api/cron/newsletter', {
  headers: token ? { Authorization: `Bearer ${token}` } : {},
});

test('missing or wrong cron credentials never read settings or send mail', async () => {
  for (const [stored, provided] of [[fakeSecret, 'wrong'], [fakeSecret, ''], ['', fakeSecret]]) {
    const { route, calls } = cronFixture({ secret: stored, autoEnabled: true });
    assert.equal((await route.GET(cronRequest(provided))).status, 401);
    assert.deepEqual(calls, { settings: 0, cadence: 0, sends: 0 });
  }
});

test('correct secret alone does not enable the production newsletter', async () => {
  const { route, calls } = cronFixture({ autoEnabled: false });
  const response = await route.GET(cronRequest());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).skipped, true);
  assert.deepEqual(calls, { settings: 1, cadence: 0, sends: 0 });
});

test('automatic sending also respects the existing 15-day guard', async () => {
  const { route, calls } = cronFixture({ autoEnabled: true, due: false });
  assert.equal((await (await route.GET(cronRequest())).json()).skipped, true);
  assert.equal(calls.sends, 0);
});

test('only an authorised, enabled and due cron calls the mocked sender', async () => {
  const { route, calls } = cronFixture({ autoEnabled: true, due: true });
  assert.equal((await (await route.GET(cronRequest())).json()).ok, true);
  assert.deepEqual(calls, { settings: 1, cadence: 1, sends: 1 });
});

test('newsletter uses the corrected Vercel domain for links and local images', () => {
  const site = load('src/lib/site-url.ts', { env: { NEXT_PUBLIC_SITE_URL: 'https://shop.mediterranic.com' } });
  const nl = load('src/lib/newsletter-send.ts', {
    imports: {
      'node:crypto': { randomUUID: () => 'fixture' },
      'drizzle-orm': {}, '@/db': { db: {} }, '@/db/schema': {},
      '@/lib/schema-migrate': {},
      '@/lib/mailer': load('src/lib/mailer.ts'),
      '@/lib/inventory-rules': {},
      '@/lib/format': load('src/lib/format.ts'),
      '@/lib/site-url': site,
    },
  });
  const output = nl.buildNewsletterEmail({
    subject: 'Featured and New Pieces',
    unsubscribeUrl: `${site.PUBLIC_SITE_URL}/unsubscribe?token=fixture`,
    pieces: [{ id: 1, slug: 'fixture-specimen', name: 'Fixture', specimenReference: 'PAIS9601',
      lengthMm: '8 cm', priceCents: 10000, listingChannel: 'direct',
      images: [{ src: '/images/hero.jpg', alt: 'Specimen photograph', label: 'Specimen' }] }],
  });
  assert.match(output.html, /src="https:\/\/mediterranic\.vercel\.app\/images\/hero\.jpg"/);
  assert.match(output.html, /href="https:\/\/mediterranic\.vercel\.app\/shop\/fixture-specimen"/);
  assert.ok(!output.html.includes('shop.mediterranic.com'));
  assert.ok(!/src="\//.test(output.html));
});

test('production newsletter identity, manual selection and history are preserved', () => {
  const schema = fs.readFileSync('src/db/schema.ts', 'utf8');
  for (const field of ['unsubscribe_token', 'unsubscribed_at', 'newsletter_settings', 'auto_enabled', 'piece_ids', 'piece_slugs']) {
    assert.ok(schema.includes(field), field);
  }
  const source = fs.readFileSync('src/lib/newsletter-send.ts', 'utf8');
  assert.match(source, /if \(row\) return \{ autoEnabled: row\.autoEnabled/);
  assert.match(source, /return \{ autoEnabled: false, pieceIds: \[\] \}/);
  assert.match(source, /eq\(newsletterSubscribers\.confirmed, true\)/);
  const panel = fs.readFileSync('src/components/admin-newsletter-cron-status.tsx', 'utf8');
  assert.ok(!panel.includes('/api/cron/newsletter'));
  assert.ok(!panel.includes('method: "POST"'));
  assert.match(panel, /\/api\/admin\/cron-configuration/);
});
