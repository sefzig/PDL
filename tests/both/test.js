#!/usr/bin/env node
/**
 * Cross-language fixture runner: JS + PY.
 * Shows one line per fixture (green check only when both pass; otherwise per-lang status).
 * Usage:
 *   node tests/both/test.js         # all fixtures
 *   node tests/both/test.js 01      # fixtures starting with 01
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { render: renderJs } = require('../../packages/js/src/pdl');

const colors = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
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
  const varsPath = path.join(FIXTURE_DIR, `${base}.variables.json`);

  const template = fs.readFileSync(tplPath, 'utf8');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const expected = fs.readFileSync(outPath, 'utf8');
  const variables = fs.existsSync(varsPath) ? JSON.parse(fs.readFileSync(varsPath, 'utf8')) : {};
  return { base, template, data, expected, variables };
}

function normalizeNewline(s) {
  const trimmed = s.replace(/[\r\n]+$/, '');
  return `${trimmed}\n`;
}

function renderPy(base) {
  const script = [
    "import json, sys, pathlib",
    "repo = pathlib.Path('.').resolve()",
    "sys.path.insert(0, str(repo / 'packages' / 'py'))",
    "fix = repo / 'tests' / 'fixtures'",
    "base = sys.argv[1]",
    "from pdl import render",
    "with (fix / f\"{base}.template.md\").open('r', encoding='utf-8') as f: tpl = f.read()",
    "with (fix / f\"{base}.data.json\").open('r', encoding='utf-8') as f: data = json.load(f)",
    "vars_path = fix / f\"{base}.variables.json\"",
    "vars = json.load(vars_path.open('r', encoding='utf-8')) if vars_path.exists() else {}",
    "out = render(tpl, data, {'variables': vars})",
    "print(out['markdown'])",
  ].join("\n");
  const res = spawnSync('python3', ['-c', script, base], {
    cwd: path.join(__dirname, '..', '..'),
    encoding: 'utf8',
  });
  if (res.status !== 0) {
    return { ok: false, error: res.stderr || res.stdout || `python exit ${res.status}` };
  }
  return { ok: true, markdown: res.stdout }; // stdout already has trailing newline
}

function runFixture(fixture) {
  const { base, template, data, expected, variables } = fixture;

  const expNorm = normalizeNewline(expected);

  const jsOut = renderJs(template, data, { variables }).markdown;
  const jsNorm = normalizeNewline(jsOut);
  const jsOk = jsNorm === expNorm;

  const pyRes = renderPy(base);
  const pyNorm = pyRes.ok ? normalizeNewline(pyRes.markdown || '') : '';
  const pyOk = pyRes.ok && pyNorm === expNorm;

  let line;
  if (jsOk && pyOk) {
    line = `${colors.green('✓')} ${base}`;
  } else {
    const jsTag = jsOk ? colors.green('js:✓') : colors.red('js:✗');
    const pyTag = pyOk ? colors.green('py:✓') : colors.red('py:✗');
    const detail = !pyOk && pyRes.error ? ` ${colors.dim(pyRes.error.trim())}` : '';
    line = `${colors.red('✗')} ${base} [${jsTag} ${pyTag}]${detail}`;
  }
  console.log(line);

  return { jsOk, pyOk, pyError: pyRes.ok ? null : pyRes.error };
}

function main() {
  const key = process.argv[2] || null;
  const all = listFixtures();
  const selected = key ? all.filter((b) => b.startsWith(key)) : all;
  if (!selected.length) {
    console.error(colors.red(`No fixtures match "${key}"`));
    process.exit(1);
  }

  let jsPass = 0;
  let pyPass = 0;
  for (const base of selected) {
    const fixture = loadFixture(base);
    const res = runFixture(fixture);
    if (res.jsOk) jsPass++;
    if (res.pyOk) pyPass++;
  }

  const total = selected.length;
  const jsSummary = jsPass === total ? colors.green('✔ pass') : colors.red('✖ fail');
  const pySummary = pyPass === total ? colors.green('✔ pass') : colors.red('✖ fail');
  console.log(`${jsSummary} (js ${jsPass}/${total})`);
  console.log(`${pySummary} (py ${pyPass}/${total})`);
  if (jsPass !== total || pyPass !== total) process.exit(1);
}

if (require.main === module) main();
