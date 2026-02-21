#!/usr/bin/env node
const assert = require('assert');
const { render, PDL } = require('../../packages/js/src/pdl');

const origMax = PDL.MAX_EXPANSIONS;
PDL.MAX_EXPANSIONS = 5;

try {
  // 1) Block loop iterations limited
  const dataArr = Array.from({ length: 100 }, (_, i) => i);
  let res = render('[loop:data]\nHello\n[loop-end]', dataArr);
  const lines = res.markdown.split('\n').filter(Boolean);
  assert.strictEqual(lines.length, 5);
  assert.ok(res.rawStats.errors_parse >= 1);

  // 2) Inline loop iterations limited
  res = render('X [loop:data join=", "]Hi[loop-end] Y', dataArr);
  assert.strictEqual(res.markdown, 'X Hi, Hi, Hi, Hi, Hi Y');
  assert.ok(res.rawStats.errors_parse >= 1);

  console.log('limits tests passed');
} catch (err) {
  console.error('limits tests failed');
  console.error(err.message);
  process.exit(1);
} finally {
  PDL.MAX_EXPANSIONS = origMax;
}
