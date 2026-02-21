#!/usr/bin/env node
const assert = require('assert');
const { render } = require('../../packages/js/src/pdl');

function r(template) { return render(template, {}).markdown; }

try {
  // 1) Full-line comment
  assert.strictEqual(r('  // hello\nx'), 'x');

  // 2) Inline comment with space
  assert.strictEqual(r('x // y'), 'x');

  // 3) Inline comment with tab
  assert.strictEqual(r('x\t// y'), 'x');

  // 4) No strip without whitespace
  assert.strictEqual(r('a//b'), 'a//b');

  // 5) URL not broken
  assert.strictEqual(r('http://x.y//z'), 'http://x.y//z');

  // 6) URL + comment stripped
  assert.strictEqual(r('abc://def // comment'), 'abc://def');

  // 7) Code fences preserved
  const fenced = '```\nx // should stay\n```';
  assert.strictEqual(r(fenced), '```\nx // should stay\n```');

  console.log('comments tests passed');
} catch (err) {
  console.error('comments tests failed');
  console.error(err.message);
  process.exit(1);
}
