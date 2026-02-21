#!/usr/bin/env node
const assert = require('assert');
const { render } = require('../../packages/js/src/pdl');

function r(tpl) { return render(tpl, {}).markdown; }

try {
  // 1) Punctuation tightening
  assert.strictEqual(r('[condense]\nHello ,  world  ( test ) .\n[condense-end]'), 'Hello, world (test).');

  // 2) Newline collapse
  assert.strictEqual(r('[condense]\nA\r\nB\rC\nD\n[condense-end]'), 'A B C D');

  // 3) Space collapse + trim
  assert.strictEqual(r('[condense]\n  A   B  \n[condense-end]'), 'A B');

  // 4) Additional punctuation tightened (! ? ; " ')
  assert.strictEqual(r('[condense]\nHi !  Why ?  She said \" yes \" ; \'ok\' .\n[condense-end]'), 'Hi! Why? She said \" yes \"; \'ok\'.');

  // 5) Unmatched markers behavior (stray start token removed)
  assert.strictEqual(r('x [condense] y'), 'x  y');

  console.log('condense tests passed');
} catch (err) {
  console.error('condense tests failed');
  console.error(err.message);
  process.exit(1);
}
