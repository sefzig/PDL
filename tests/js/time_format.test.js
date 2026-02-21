#!/usr/bin/env node
const assert = require('assert');
const { render, PDL } = require('../../packages/js/src/pdl');

function r(tpl, data = {}) {
  return render(tpl, data);
}

try {
  // Date: ISO with Z respected (Berlin offset +1 in winter)
  let res = r('[value:x date=\"%H\"]', { x: '1970-01-01T00:00:00Z' });
  assert.strictEqual(res.markdown, '01');

  // Date: ISO without TZ interpreted in DATE_TZ (treated as UTC then rendered in Berlin)
  res = r('[value:x date=\"%H:%M\"]', { x: '2024-01-01T10:05:00' });
  assert.strictEqual(res.markdown, '11:05'); // +1

  // Date-only string
  res = r('[value:x date=\"%Y-%m-%d\"]', { x: '2024-02-03' });
  assert.strictEqual(res.markdown, '2024-02-03');

  // Epoch seconds
  res = r('[value:x date=\"%H\"]', { x: 0 });
  assert.strictEqual(res.markdown, '01');

  // Epoch milliseconds (>=1e12 -> ms)
  res = r('[value:x date=\"%Y\"]', { x: 1000000000000 });
  assert.strictEqual(res.markdown, '2001');

  // Invalid date
  res = r('[value:x date=\"%Y\"]', { x: 'not-a-date' });
  assert.strictEqual(res.markdown, PDL.INVALID_DATE_DEFAULT);
  assert.ok(res.rawStats.errors_parse >= 1);

  // Duration pure tokens with auto words and trimming
  res = r('[value:x time=\"%H %M %S\"]', { x: 3605000 });
  assert.strictEqual(res.markdown, '1 hour 0 minutes 5 seconds');

  // Duration with literal text (no auto words)
  res = r('[value:x time=\"%H hours %M minutes\"]', { x: 3661000 });
  assert.strictEqual(res.markdown, '01 hours 01 minutes');

  // Duration unit conversion
  res = r('[value:x time=\"%M %S\" unit=s]', { x: 90 });
  assert.strictEqual(res.markdown, '1 minute 30 seconds');

  // Duration zero -> still renders
  res = r('[value:x time=\"%H %M %S\"]', { x: 0 });
  assert.strictEqual(res.markdown, '0 milliseconds');

  // Invalid duration
  res = r('[value:x time=\"%H\"]', { x: 'abc' });
  assert.strictEqual(res.markdown, PDL.INVALID_TIME_DEFAULT);
  assert.ok(res.rawStats.errors_parse >= 1);

  // date + time together -> error
  res = r('[value:x date=\"%Y\" time=\"%H\"]', { x: 0 });
  assert.strictEqual(res.markdown, PDL.INVALID_TIME_DEFAULT);
  assert.ok(res.rawStats.errors_parse >= 1);

  console.log('time format tests passed');
} catch (err) {
  console.error('time format tests failed');
  console.error(err.stack || err);
  process.exit(1);
}
