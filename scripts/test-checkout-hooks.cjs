const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('persisted cart checkout registers every hook before empty-cart and hydration returns', () => {
  const source = fs.readFileSync('src/components/checkout-form.tsx', 'utf8');
  const firstReturn = source.indexOf('if (!hydrated)');
  assert.ok(firstReturn > 0);
  const hooks = [...source.matchAll(/\buse[A-Z][A-Za-z]*\(/g)];
  assert.ok(hooks.length > 10);
  for (const hook of hooks) assert.ok(hook.index < firstReturn, `${hook[0]} must be unconditional`);
  assert.equal([...source.matchAll(/\buseEffect\(/g)].length, 2, 'PayPal return and invoice dialog effects remain present.');
  assert.match(source, /noteRef\.current\?\.focus\(\)/);
  assert.match(source, /window\.removeEventListener\("keydown", onKey\)/);
});
