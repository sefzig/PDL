#!/usr/bin/env node
/**
 * Smoke runner for the JS PDL lib.
 * Iterates shared fixtures (JSON + MD) and calls the JS render function.
 * Currently the JS render is a placeholder; this runner will surface that.
 */

const fs = require('fs');
const path = require('path');

const { render } = require('../../packages/js/src/pdl');

const fixturesDir = path.join(__dirname, '../fixtures');

function loadFixtures(filterKey) {
  const all = fs
    .readdirSync(fixturesDir)
    .filter((f) => f.endsWith('.json'))
    .map((jsonFile) => {
      const base = path.basename(jsonFile, '.json');
      const jsonPath = path.join(fixturesDir, jsonFile);
      const mdPath = path.join(fixturesDir, `${base}.md`);
      if (!fs.existsSync(mdPath)) {
        throw new Error(`Missing template for fixture ${base}: ${mdPath}`);
      }
      return {
        name: base,
        data: JSON.parse(fs.readFileSync(jsonPath, 'utf8')),
        template: fs.readFileSync(mdPath, 'utf8'),
      };
    });

  if (!filterKey) return all;

  const filtered = all.filter(({ name }) => name === filterKey || name.startsWith(`${filterKey}_`));
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
      const result = render(fixture.template, fixture.data, {});
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
