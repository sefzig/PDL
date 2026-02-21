#!/usr/bin/env node
const assert = require('assert');
const { render } = require('../../packages/js/src/pdl');

const normalizeLines = (s) => s.split('\n');

try {
  // 1) Inline trims
  let out = render('Inline: [loop:items as=x join=", "]  [value:x]  [loop-end]', { items: ['A','B'] }).markdown;
  assert.strictEqual(out, 'Inline: A, B');

  // 2) Block preserves indentation
  out = render('[loop:items as=x]\n  - [value:x]\n[loop-end]', { items: ['A','B'] }).markdown;
  assert.deepStrictEqual(normalizeLines(out), ['  - A', '  - B']);

  // 3) Block join inserts once, preserves formatting
  out = render('[loop:items as=x join="|"]\n### Item\n- [value:x]\n[loop-end]', { items: ['A','B'] }).markdown;
  const lines = normalizeLines(out);
  assert.ok(out.includes('|'), 'join separator missing');
  const joinCount = (out.match(/\|/g) || []).length;
  assert.strictEqual(joinCount, 1);
  assert.ok(out.includes('### Item'), 'missing header');
  assert.ok(out.includes('- A'), 'missing first item');
  assert.ok(out.includes('- B'), 'missing second item');

  // 4) Empty inline
  out = render('Inline: [loop:items as=x join=", " empty="(none)"] [value:x] [loop-end]', { items: [] }).markdown;
  assert.strictEqual(out, 'Inline: (none)');

  // 5) Empty block
  out = render('[loop:items as=x empty="(none)"]\n- [value:x]\n[loop-end]', { items: [] }).markdown;
  assert.deepStrictEqual(normalizeLines(out), ['(none)']);

  console.log('loop modes tests passed');
} catch (err) {
  console.error('loop modes tests failed');
  console.error(err.message);
  process.exit(1);
}
