#!/usr/bin/env node
const assert = require('assert');
const { render } = require('../../packages/js/src/pdl');

function out(tpl, data) {
  return render(tpl, data).markdown;
}

try {
  // 1) Resolved non-empty -> success applies
  assert.strictEqual(out('[value:x success="OK" empty="(none)" failure="(missing)"]', { x: 'hello' }), 'OK');

  // 2) Resolved empty string -> empty applies, success does NOT
  assert.strictEqual(out('[value:x success="OK" empty="(none)" failure="(missing)"]', { x: '' }), '(none)');

  // 3) Unresolved after default -> failure applies
  assert.strictEqual(out('[value:x default=y failure="(missing)"]', { y2: 'nope' }), '(missing)');

  // 4) Unresolved with no failure -> literal preserved
  assert.strictEqual(out('[value:x]', {}), '[value:x]');

  // 5) 0, false must NOT trigger empty
  assert.strictEqual(out('[value:x empty="(none)"]', { x: 0 }), '0');
  assert.strictEqual(out('[value:x empty="(none)"]', { x: false }), 'false');

  // 6) success DOES fire when value comes from fallback
  assert.strictEqual(
    out('[value:x fallback=y success="OK"]', { y: 'fallback' }),
    'OK'
  );

  console.log('value state tests passed');
} catch (err) {
  console.error('value state tests failed');
  console.error(err.message);
  process.exit(1);
}
