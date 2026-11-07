'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { demoDepartures } = require('../src/demo');
const { localMidnight, hhmm } = require('../src/tz');

test('localMidnight handles DST (London, clocks back 2026-10-25)', () => {
  const noon = Date.UTC(2026, 9, 25, 12);
  assert.strictEqual(hhmm('Europe/London', localMidnight('Europe/London', noon)), '00:00');
  assert.strictEqual(localMidnight('Europe/London', noon), Date.UTC(2026, 9, 25, 0) - 3600e3);
});

test('demo departures are sane and deterministic', () => {
  const now = Date.UTC(2026, 10, 7, 9, 0);
  const a = demoDepartures('LBA', now), b = demoDepartures('LBA', now);
  assert.deepStrictEqual(a, b);
  assert.ok(a.flights.length > 5);
  for (const f of a.flights) {
    assert.match(f.time, /^\d\d:\d\d$/);
    assert.ok(f.sortKey >= now - 15 * 60000 && f.sortKey <= now + 12 * 3600e3);
    assert.notStrictEqual(f.destIata, 'LBA');
  }
  assert.deepStrictEqual(a.flights.map((f) => f.sortKey), a.flights.map((f) => f.sortKey).sort((x, y) => x - y));
});
