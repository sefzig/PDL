#!/usr/bin/env node
const assert = require('assert');
const { render } = require('../../packages/js/src/pdl');

function runReplace(input, replaceSpec) {
  const tpl = `[value:txt replace="${replaceSpec}"]`;
  const { markdown } = render(tpl, { txt: input });
  return markdown;
}

try {
  assert.strictEqual(runReplace('foo foo FOO', 's/foo/bar/'), 'bar foo FOO');
  assert.strictEqual(runReplace('foo foo FOO', 's/foo/bar/g'), 'bar bar FOO');
  assert.strictEqual(runReplace('foo foo FOO', 's/foo/bar/i'), 'bar foo FOO');
  assert.strictEqual(runReplace('foo foo FOO', 's/foo/bar/gi'), 'bar bar bar');
  assert.strictEqual(runReplace('foo foo FOO', 's/(foo/bar/'), 'foo foo FOO'); // invalid regex returns original
  console.log('replace tests passed');
} catch (err) {
  console.error('replace tests failed');
  console.error(err.message);
  process.exit(1);
}
