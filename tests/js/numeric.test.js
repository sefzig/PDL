#!/usr/bin/env node
const assert = require('assert');
const { render } = require('../../packages/js/src/pdl');

function expr(tpl, data={}) {
  return render(tpl, data).markdown;
}

try {
  // numeric-like coercion used in comparisons
  assert.strictEqual(expr('[if:x=1000]true[if-else]false[if-end]', { x: '1e3' }), 'true');
  assert.strictEqual(expr('[if:x=1]true[if-else]false[if-end]', { x: '+1' }), 'true');
  assert.strictEqual(expr('[if:x=1]true[if-else]false[if-end]', { x: '1.' }), 'true');
  assert.strictEqual(expr('[if:x=0.5]true[if-else]false[if-end]', { x: '.5' }), 'true');
  assert.strictEqual(expr('[if:x>0]true[if-else]false[if-end]', { x: 'Infinity' }), 'false');
  assert.strictEqual(expr('[if:x=16]true[if-else]false[if-end]', { x: '0x10' }), 'false');

  // comparisons numeric with path values
  assert.strictEqual(expr('[if:x=1000]true[if-else]false[if-end]', { x: '1e3' }), 'true');
  assert.strictEqual(expr('[if:x=1]true[if-else]false[if-end]', { x: '001' }), 'true');
  assert.strictEqual(expr('[if:x>0.49]true[if-else]false[if-end]', { x: '.5' }), 'true');
  assert.strictEqual(expr('[if:x>2]true[if-else]false[if-end]', { x: '10' }), 'true');

  // selector numeric
  const data = { arr: [{ n: 1000 }] };
  assert.strictEqual(expr('[value:arr[n=1e3].n]', data), '1000');

  // parseScalarOrJson numeric literal (unquoted)
  assert.strictEqual(expr('[set:x=1e3][get:x]'), '1000');

  console.log('numeric tests passed');
} catch (err) {
  console.error('numeric tests failed');
  console.error(err.message);
  process.exit(1);
}
