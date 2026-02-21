#!/usr/bin/env node
const assert = require('assert');
const { render } = require('../../packages/js/src/pdl');

const tmpl = (t, data) => render(t, data);

try {
  // 1) Primary resolves, fallback ignored
  let res = tmpl('[value:user.nickname fallback=user.name]', { user: { nickname: 'Al', name: 'Alice' } });
  assert.strictEqual(res.markdown, 'Al');

  // 2) Primary missing, fallback resolves
  res = tmpl('[value:user.nickname fallback=user.name]', { user: { name: 'Alice' } });
  assert.strictEqual(res.markdown, 'Alice');

  // 3) Neither resolves -> failure applies
  res = tmpl('[value:user.nickname fallback=user.name failure="(missing)"]', { user: {} });
  assert.strictEqual(res.markdown, '(missing)');

  // 4) default= triggers parse error and leaves literal
  res = tmpl('[value:user.nickname default=user.name]', { user: { name: 'Alice' } });
  assert.ok(res.rawStats.errors_parse >= 1);
  assert.strictEqual(res.markdown, '[value:user.nickname default=user.name]');

  console.log('fallback tests passed');
} catch (err) {
  console.error('fallback tests failed');
  console.error(err.message);
  process.exit(1);
}
