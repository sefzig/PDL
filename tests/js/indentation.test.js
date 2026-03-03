#!/usr/bin/env node
const assert = require('assert');
const { render } = require('../../packages/js/src/pdl');

const lines = (s) => s.split('\n');

try {
  // 1) If block de-indents baseline +2
  let out = render('[if:ok]\n  The text.\n[if-end]', { ok: true }).markdown;
  assert.deepStrictEqual(lines(out), ['The text.']);

  // 2) Nested if keeps relative deeper indent
  out = render('[if:ok]\n  The text.\n  [if:ok]\n    Another text.\n  [if-end]\n[if-end]', { ok: true }).markdown;
  assert.deepStrictEqual(lines(out), ['The text.', 'Another text.']);

  // 3) Mixed indent inside block: extra spaces remain
  out = render('[if:ok]\n      Line A\n        Line B\n[if-end]', { ok: true }).markdown;
  assert.deepStrictEqual(lines(out), ['    Line A', '      Line B']);

  // 4) Tabs count as 2 spaces for directive indent
  out = render('\t[if:ok]\n\t  Text\n\t[if-end]', { ok: true }).markdown;
  assert.deepStrictEqual(lines(out), ['Text']);

  // 5) Blank lines are preserved
  out = render('[if:ok]\n  Line A\n  \n  Line B\n[if-end]', { ok: true }).markdown;
  assert.deepStrictEqual(lines(out), ['Line A', '', 'Line B']);

  // 6) Loop block de-indents similarly
  out = render('[loop:items as=x]\n    - [value:x]\n[loop-end]', { items: ['A'] }).markdown;
  assert.deepStrictEqual(lines(out), ['  - A']);

  console.log('indentation tests passed');
} catch (err) {
  console.error('indentation tests failed');
  console.error(err.message);
  process.exit(1);
}
