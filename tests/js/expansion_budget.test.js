#!/usr/bin/env node
const assert = require('assert');
const { render, PDL } = require('../../packages/js/src/pdl');

const origMax = PDL.MAX_EXPANSIONS;

function runWithMax(max, fn) {
  PDL.MAX_EXPANSIONS = max;
  try {
    fn();
  } finally {
    PDL.MAX_EXPANSIONS = origMax;
  }
}

try {
  // 1) [get:] consumes exactly one expansion
  runWithMax(10, () => {
    const res = render('[get:x]', {}, { variables: { x: 'ok' } });
    assert.strictEqual(res.markdown, 'ok');
    assert.strictEqual(res.rawStats.expansions, 1);
  });

  // 2) Budget exceed leaves remainder literal and increments errors_parse
  runWithMax(1, () => {
    const res = render('[value:a]\nnext [value:b]', { a: 'A', b: 'B' });
    assert.strictEqual(res.markdown, 'A\nnext [value:b]');
    assert.ok(res.rawStats.errors_parse >= 1);
  });

  // 3) Loop stops deterministically at budget boundary
  runWithMax(3, () => {
    const data = ['a', 'b', 'c', 'd'];
    const res = render('L [loop:data join=\", \"]X[loop-end]', data);
    // budget exceeded during 4th iteration; keep rendered iterations, stop further expansion
    assert.strictEqual(res.markdown, 'L X, X, X');
    assert.ok(res.rawStats.errors_parse >= 1);
    assert.strictEqual(res.rawStats.expansions, 4); // attempted 4 iterations; 4th exceeds limit
  });

  // 4) Expansion accounting equals directive/iteration counts
  runWithMax(20, () => {
    const tpl = '[value:a] [get:b] [loop:items as=x join=\", \"][value:x][loop-end] [loop-index]';
    const res = render(tpl, { a: 'A', items: [1, 2] }, { variables: { b: 'B' } });
    // counts: value a (1) + get b (1) + iterations (2) + value per iter (2) + loop-index (1) = 7
    assert.strictEqual(res.rawStats.expansions, 7);
  });

  console.log('expansion budget tests passed');
} catch (err) {
  console.error('expansion budget tests failed');
  console.error(err.stack || err);
  process.exit(1);
}
