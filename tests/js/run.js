#!/usr/bin/env node
/**
 * Smoke runner for the JS PDL lib.
 * Iterates shared fixtures (template + data) and calls the JS render function.
 */

const fs = require('fs');
const path = require('path');

const { render } = require('../../packages/js/src/pdl');

const fixturesDir = path.join(__dirname, '../fixtures');

function loadFixtures(filterKey) {
  const allTemplates = fs
    .readdirSync(fixturesDir)
    .filter((f) => f.endsWith('.template.md'))
    .map((tplFile) => tplFile.replace(/\.template\.md$/, ''))
    .sort();

  const all = allTemplates.map((base) => {
    const tplPath = path.join(fixturesDir, `${base}.template.md`);
    const dataPath = path.join(fixturesDir, `${base}.data.json`);
    const varsPath = path.join(fixturesDir, `${base}.variables.json`);
    if (!fs.existsSync(dataPath)) {
      throw new Error(`Missing data for fixture ${base}: ${dataPath}`);
    }
    const template = fs.readFileSync(tplPath, 'utf8');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const variables = fs.existsSync(varsPath)
      ? JSON.parse(fs.readFileSync(varsPath, 'utf8'))
      : {};
    return { name: base, template, data, variables };
  });

  if (!filterKey) return all;

  const filtered = all.filter(({ name }) => name === filterKey || name.startsWith(`${filterKey}_`) || name.startsWith(filterKey));
  if (!filtered.length) {
    throw new Error(`No fixture matching key "${filterKey}". Available: ${all.map((f) => f.name).join(', ')}`);
  }
  return filtered;
}

function main() {
  const filterKey = process.argv[2]; // e.g., "00" or "01_minimal"
  const fixtures = loadFixtures(filterKey);
  for (const fixture of fixtures) {
    process.stdout.write(`\n=== ${fixture.name} ===\n`);
    try {
      const result = render(fixture.template, fixture.data, { variables: fixture.variables });
      const markdown =
        result && typeof result === 'object' && 'markdown' in result
          ? result.markdown
          : result;
      process.stdout.write(String(markdown ?? '<no output>') + '\n\n');
    } catch (err) {
      process.stdout.write(`Error: ${err.message}\n\n`);
    }
  }
}

if (require.main === module) {
  main();
}
