#!/usr/bin/env node
/**
 * Fixture-based regression test runner for JS PDL.
 * Usage:
 *   node tests/js/test.js             # all fixtures
 *   node tests/js/test.js 01          # single fixture (matches prefix)
 *   node tests/js/test.js update      # rewrite all .result.md from current output
 *   node tests/js/test.js update 01   # rewrite single fixture expected
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { render } = require('../../packages/js/src/pdl');

const colors = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

const FIXTURE_DIR = path.join(__dirname, '../fixtures');

function listFixtures() {
  return fs
    .readdirSync(FIXTURE_DIR)
    .filter((f) => f.endsWith('.template.md'))
    .map((f) => f.replace(/\.template\.md$/, ''))
    .sort();
}

function loadFixture(base) {
  const tplPath = path.join(FIXTURE_DIR, `${base}.template.md`);
  const dataPath = path.join(FIXTURE_DIR, `${base}.data.json`);
  const outPath = path.join(FIXTURE_DIR, `${base}.result.md`);
  const varsPath = path.join(FIXTURE_DIR, `${base}.variables.md`);
  if (!fs.existsSync(tplPath)) throw new Error(`Missing template: ${tplPath}`);
  if (!fs.existsSync(dataPath)) throw new Error(`Missing data: ${dataPath}`);
  const template = fs.readFileSync(tplPath, 'utf8');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const expected = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : null;
  const variables = fs.existsSync(varsPath) ? JSON.parse(fs.readFileSync(varsPath, 'utf8')) : {};
  return { base, template, data, expected, outPath, variables };
}

function writeTemp(content, ext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdl-'));
  const file = path.join(dir, `file.${ext}`);
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

function diffStrings(expected, actual) {
  const aFile = writeTemp(expected, 'expected');
  const bFile = writeTemp(actual, 'actual');
  const res = spawnSync('diff', ['-u', aFile, bFile], { encoding: 'utf8' });
  const raw = res.stdout || '(diff command produced no output)';
  return raw.trim()
    .split('\n')
    .map((line) => {
      if (line.startsWith('---') || line.startsWith('+++')) return colors.dim(line);
      if (line.startsWith('@@')) return colors.dim(line);
      if (line.startsWith('+') || line.startsWith('-')) return colors.dim(line);
      return colors.dim(line);
    })
    .join('\n');
}

function runFixture(fixture, { update }) {
  const { base, template, data, variables, expected, outPath } = fixture;
  const result = render(template, data, { variables });
  const actual = result.markdown.endsWith('\n') ? result.markdown : result.markdown + '\n';

  if (update) {
    fs.writeFileSync(outPath, actual, 'utf8');
    console.log(`${colors.yellow('↻')} updated ${path.relative(process.cwd(), outPath)}`);
    return true;
  }

  if (expected == null) {
    console.error(`${colors.red('✗')} missing expected output: ${path.relative(process.cwd(), outPath)}`);
    return false;
  }

  // Normalize trailing newline for comparison
  const expNorm = expected.endsWith('\n') ? expected : expected + '\n';
  if (expNorm === actual) {
    console.log(`${colors.green('✓')} ${base}`);
    return true;
  }

  console.error(`${colors.red('✗')} ${base}`);
  console.error(diffStrings(expNorm, actual));
  return false;
}

function main() {
  const args = process.argv.slice(2);
  const wantsUpdate = args.includes('update');
  const key = args.find((a) => a !== 'update') || null;

  const all = listFixtures();
  const selected = key ? all.filter((b) => b.startsWith(key)) : all;
  if (!selected.length) {
    console.error(`No fixtures match "${key}". Available: ${all.join(', ')}`);
    process.exit(1);
  }

  let ok = true;
  let count = 0;
  let failed = 0;
  for (const base of selected) {
    const fixture = loadFixture(base);
    const res = runFixture(fixture, { update: wantsUpdate });
    count++;
    if (!res) failed++;
    ok = ok && res;
  }
  if (!wantsUpdate) {
    if (ok) console.log(`${colors.green('✔ pass')} (${count}/${count} passed)`);
    else console.error(`${colors.red('✖ fail')} (${failed}/${count} failed)`);
  }
  if (!ok && !wantsUpdate) process.exit(1);
}

if (require.main === module) {
  main();
}
