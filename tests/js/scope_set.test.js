#!/usr/bin/env node
const assert = require('assert');
const { render } = require('../../packages/js/src/pdl');

function run(tpl, data) { return render(tpl, data).markdown; }

// Shared data
const data = { x: 100, arr: [1] };

try {
  // 1) Flags-only default targets global
  let tpl = `
    [set:x=1 const=true humble=false]
    [loop:arr as=it]
      [set:x=2 scope=true]
      [set:x humble=true]
      in:[value:x]
    [loop-end]
    out:[value:x]
  `;
  // inside loop: local x remains 2 (humble false) => in:2
  // outside: global humble true so prefers data alias -> 100
  assert.strictEqual(run(tpl, data).replace(/\s+/g,' ').trim(), 'in:2 out:100');

  // 2) Flags-only with scope=true targets local
  tpl = `
    [set:x=1 const=true humble=false]
    [loop:arr as=it]
      [set:x=2 scope=true]
      [set:x humble=true scope=true]
      in:[value:x]
    [loop-end]
    out:[value:x]
  `;
  // inside: local humble true -> prefers data (100)
  // outside: global unchanged humble=false -> uses global 1
  assert.strictEqual(run(tpl, data).replace(/\s+/g,' ').trim(), 'in:100 out:1');

  // 3) Deletion default targets global only
  tpl = `
    [set:x=1]
    [loop:arr as=it]
      [set:x=2 scope=true]
      [set:x=null]
      in:[value:x]
    [loop-end]
    out:[value:x]
  `;
  // inside: local still 2
  // outside: global deleted -> falls back to data 100
  assert.strictEqual(run(tpl, data).replace(/\s+/g,' ').trim(), 'in:2 out:100');

  // 4) Deletion with scope=true targets local only
  tpl = `
    [set:x=1]
    [loop:arr as=it]
      [set:x=2 scope=true]
      [set:x=null scope=true]
      in:[value:x]
    [loop-end]
    out:[value:x]
  `;
  // inside: local deleted -> falls back to global 1 (humble=false)
  // outside: global still 1
  assert.strictEqual(run(tpl, data).replace(/\s+/g,' ').trim(), 'in:1 out:1');

  // 5) Assignment default is global even if local exists
  tpl = `
    [set:x=1 const=false]
    [loop:arr as=it]
      [set:x=2 scope=true]
      [set:x=3]
      in:[value:x]
    [loop-end]
    out:[value:x]
  `;
  // inside: local still 2
  // outside: global updated to 3
  assert.strictEqual(run(tpl, data).replace(/\s+/g,' ').trim(), 'in:2 out:3');

  console.log('scope_set tests passed');
} catch (err) {
  console.error('scope_set tests failed');
  console.error(err.message);
  process.exit(1);
}
