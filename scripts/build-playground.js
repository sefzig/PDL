#!/usr/bin/env node
/**
 * Build a browser-friendly fixtures manifest for the playground.
 *
 * Output: playground/fixtures.json
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.join(__dirname, '..');
const fixturesDir = path.join(repoRoot, 'tests/fixtures');
const outPath = path.join(repoRoot, 'playground/fixtures.json');

function listPrefixes() {
  const output = execSync('git ls-files tests/fixtures', {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((f) => f.endsWith('.template.md'))
    .map((f) => path.basename(f).replace(/\.template\.md$/, ''))
    .sort();
}

function requireFile(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing required fixture file: ${path.relative(repoRoot, file)}`);
  }
}

function loadText(file) {
  return fs.readFileSync(file, 'utf8');
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function build() {
  const entries = listPrefixes().map((base) => {
    const tpl = path.join(fixturesDir, `${base}.template.md`);
    const data = path.join(fixturesDir, `${base}.data.json`);
    const vars = path.join(fixturesDir, `${base}.variables.json`);
    const res = path.join(fixturesDir, `${base}.result.md`);

    [tpl, data, vars, res].forEach(requireFile);

    return {
      name: base,
      template: loadText(tpl),
      data: loadJson(data),
      variables: loadJson(vars),
      expected: loadText(res),
    };
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    by: 'scripts/build-playground.js',
    fixtureCount: entries.length,
    fixtures: entries,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Built ${path.relative(repoRoot, outPath)} (${entries.length} fixtures)`);
}

try {
  build();
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
