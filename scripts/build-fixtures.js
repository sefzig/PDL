#!/usr/bin/env node
/**
 * Build a browser-friendly fixtures manifest for the playground.
 *
 * Output: playground/fixtures.json
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const fixturesDir = path.join(repoRoot, 'tests/fixtures');
const outPath = path.join(repoRoot, 'playground/fixtures.json');

function listPrefixes() {
  return fs
    .readdirSync(fixturesDir)
    .filter((f) => f.endsWith('.template.md'))
    .map((f) => f.replace(/\.template\.md$/, ''))
    .sort();
}

function loadText(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

function loadJson(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

function build() {
  const entries = listPrefixes().map((base) => {
    const tpl = path.join(fixturesDir, `${base}.template.md`);
    const data = path.join(fixturesDir, `${base}.data.json`);
    const vars = path.join(fixturesDir, `${base}.variables.md`);
    const res = path.join(fixturesDir, `${base}.result.md`);

    return {
      name: base,
      template: loadText(tpl),
      data: loadJson(data) || {},
      variables: loadJson(vars) || {},
      expected: loadText(res),
    };
  });

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ fixtures: entries }, null, 2), 'utf8');
  console.log(`Built ${path.relative(repoRoot, outPath)} (${entries.length} fixtures)`);
}

build();
