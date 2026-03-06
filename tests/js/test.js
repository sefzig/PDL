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
const fmtMs = (ms) => colors.dim(` ${ms}ms`);

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
  const varsPath = path.join(FIXTURE_DIR, `${base}.variables.json`);
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

function runFixture(fixture, { update, diff, diffOnly = false }) {
  const { base, template, data, variables, expected, outPath } = fixture;
  const start = process.hrtime.bigint();
  const result = render(template, data, { variables });
  const elapsedMs = Math.max(0, Math.round(Number(process.hrtime.bigint() - start) / 1e6));
  const actual = result.markdown.endsWith('\n') ? result.markdown : result.markdown + '\n';

  if (update) {
    fs.writeFileSync(outPath, actual, 'utf8');
    console.log(`${colors.yellow('↻')} updated ${path.relative(process.cwd(), outPath)}${fmtMs(elapsedMs)}`);
    return { ok: true, ms: elapsedMs };
  }

  if (expected == null) {
    console.error(`${colors.red('✗')} missing expected output: ${path.relative(process.cwd(), outPath)}${fmtMs(elapsedMs)}`);
    return { ok: false, ms: elapsedMs };
  }

  // Normalize trailing newline for comparison
  const expNorm = expected.endsWith('\n') ? expected : expected + '\n';
  if (expNorm === actual) {
    console.log(`${colors.green('✓')} ${base}${fmtMs(elapsedMs)}`);
    return { ok: true, ms: elapsedMs };
  }

  if (!diffOnly) console.error(`${colors.red('✗')} ${base}${fmtMs(elapsedMs)}`);
  if (diff) {
    console.error(diffStrings(expNorm, actual));
  }
  return { ok: false, ms: elapsedMs };
}

function main() {
  const args = process.argv.slice(2);
  const wantsUpdate = args.includes('update');
  const wantsDiff = args.includes('diff');
  const diffOnly = args.includes('diff-only');
  const noSummary = args.includes('no-summary');
  const key = args.find((a) => a !== 'update' && a !== 'diff' && a !== 'diff-only' && a !== 'no-summary') || null;

  const all = listFixtures();
  const selected = key ? all.filter((b) => b.startsWith(key)) : all;
  if (!selected.length) {
    console.error(`No fixtures match "${key}". Available: ${all.join(', ')}`);
    process.exit(1);
  }

  let ok = true;
  let count = 0;
  let failed = 0;
  let totalMs = 0;
  let passMs = 0;
  let failMs = 0;
  let passCount = 0;
  for (const base of selected) {
    const fixture = loadFixture(base);
    const res = runFixture(fixture, { update: wantsUpdate, diff: wantsDiff, diffOnly });
    count++;
    totalMs += res.ms;
    if (!res.ok) {
      failed++;
      failMs += res.ms;
    } else {
      passCount++;
      passMs += res.ms;
    }
    ok = ok && res.ok;
  }
  if (!wantsUpdate && !noSummary) {
    if (failed === 0) {
      console.log(`${colors.green(`✔ pass: ${count}/${count}`)}${fmtMs(totalMs)}`);
    } else {
      console.log(`${colors.green(`✓ pass: ${passCount}/${count}`)}${fmtMs(passMs)}`);
      console.log(`${colors.red(`✖ fail: ${failed}/${count}`)}${fmtMs(failMs)}`);
    }
  }
  if (!ok && !wantsUpdate) process.exit(1);
}

if (require.main === module) {
  main();
}
