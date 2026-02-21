#!/usr/bin/env node
const assert = require('assert');
const { render } = require('../../packages/js/src/pdl');

function r(template, data = {}, opts = {}) {
  const res = render(template, data, opts);
  return { out: res.markdown, stats: res.rawStats };
}

try {
  // 1) Primary resolved non-empty with success
  let res = r('[get:x success=OK]', {}, { variables: { x: 'hi' } });
  assert.strictEqual(res.out, 'OK');

  // 2) Resolved empty string uses empty, not success
  res = r('[get:x empty="(none)" success=OK]', {}, { variables: { x: '' } });
  assert.strictEqual(res.out, '(none)');

  // 3) Fallback resolves
  res = r('[get:x fallback=y]', { y: 'Y' });
  assert.strictEqual(res.out, 'Y');

  // 4) Unresolved with failure
  res = r('[get:x failure="(missing)"]', {});
  assert.strictEqual(res.out, '(missing)');

  // 5) Unresolved with no failure keeps literal
  res = r('before [get:x] after', {});
  assert.strictEqual(res.out, 'before [get:x] after');

  // 6) default= triggers parse error, no fallback
  res = r('[get:x default=y]', { y: 'Y' });
  assert.strictEqual(res.out, '[get:x default=y]');
  assert.ok(res.stats.errors_parse >= 1);

  // 7) set then get
  res = r('[set:x=1]\n[get:x]');
  assert.strictEqual(res.out.trim(), '1');

  // 8) set to null then get with failure
  res = r('[set:x=null]\n[get:x failure="missing"]');
  assert.strictEqual(res.out.trim(), 'missing');

  // 9) time conversion with unit
  res = r('[get:x time="%M %S" unit=s]', {}, { variables: { x: '90' } });
  assert.strictEqual(res.out, '1 minute 30 seconds');

  // 10) success DOES fire when value comes from fallback
  res = r('[get:x fallback=y success=OK]', { y: 'Y' });
  assert.strictEqual(res.out, 'OK');

  console.log('get parity tests passed');
} catch (err) {
  console.error('get parity tests failed');
  console.error(err.message);
  process.exit(1);
}
