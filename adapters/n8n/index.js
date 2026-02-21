/* n8n: PDL Code Node (source version)
 *
 * This version delegates to the reusable JS library. For copy/paste into n8n,
 * bundle this file together with packages/js/src/pdl.js (or use a build script
 * to produce a single-file dist). Inside the repo, it lets us smoke-test the
 * adapter against the shared fixtures.
 */

const path = require('path');
const { render } = require(path.join(__dirname, '../../packages/js'));

// ================================================================
// Run (n8n Code node shape)
// ================================================================

const data = $('Config').first().json.Data;
const template = $('Config').first().json.Template;
const headerIndentation = $('Config').first().json.HeaderIndentation || '#';
const dropFirstHeader = $('Config').first().json.DropFirstHeader || false;

const variables = $('Config').first().json.Variables || {};

const result = render(template, data, {
  headerIndentation,
  dropFirstHeader,
  variables,
});

return [
  {
    json: {
      Markdown: result.markdown,
      Stats: result.stats,
    },
  },
];
