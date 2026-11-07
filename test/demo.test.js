import test from 'node:test';
import assert from 'node:assert';
import { demoDepartures } from '../public/js/demo.js';
import { localMidnight, hhmm } from '../public/js/tz.js';
import { liveDepartures } from '../public/js/aerodatabox.js';

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
});

test('AeroDataBox mapping, with a mocked response', async () => {
  const now = Date.UTC(2026, 10, 7, 9, 0);
  const sent = [];
  globalThis.fetch = async (url, opts) => {
    sent.push({ url, key: opts.headers['X-RapidAPI-Key'] });
    return { ok: true, status: 200, json: async () => ({ departures: [
      { number: 'LS 123', status: 'Expected', departure: { scheduledTime: { utc: '2026-11-07 09:30Z' }, revisedTime: { utc: '2026-11-07 09:55Z' }, gate: '4' }, arrival: { airport: { iata: 'PMI', municipalityName: 'Palma' } } },
      { number: 'FR 9', status: 'Canceled', departure: { scheduledTime: { utc: '2026-11-07 10:00Z' } }, arrival: { airport: { iata: 'DUB', name: 'Dublin' } } },
      { number: 'OLD 1', status: 'Departed', departure: { scheduledTime: { utc: '2026-11-07 08:00Z' } }, arrival: { airport: { iata: 'AMS', name: 'Amsterdam' } } },
    ] }) };
  };
  const r = await liveDepartures('LBA', 'secret', now);
  assert.strictEqual(sent[0].key, 'secret');
  assert.deepStrictEqual(r.flights.map((f) => [f.time, f.dest, f.status, f.expected, f.gate]),
    [['09:30', 'PALMA', 'delayed', '09:55', '4'], ['10:00', 'DUBLIN', 'cancelled', null, '']]);
});

import { normTerm, termLabel, terminalsFor, terminalsIn, filterByTerminal } from '../public/js/airports.js';
import { findAirport } from '../public/js/departures.js';

test('terminal helpers normalise and filter', () => {
  assert.strictEqual(normTerm('Terminal 2'), '2');
  assert.strictEqual(normTerm('T3'), '3');
  assert.strictEqual(normTerm('North'), 'N');
  assert.strictEqual(normTerm(undefined), '');
  assert.strictEqual(termLabel('S'), 'South Terminal');
  assert.deepStrictEqual(terminalsFor({ iata: 'MAN' }), ['1', '2', '3']);
  assert.deepStrictEqual(terminalsFor({ iata: 'LBA' }), []);
  assert.deepStrictEqual(terminalsFor({ iata: 'XYZ', terminals: ['10', '2', 'T2'] }), ['2', '10']);
  const fl = [{ terminal: '2' }, { terminal: 'T3' }, { terminal: '' }, { terminal: '2' }];
  assert.strictEqual(filterByTerminal(fl, '2').length, 2);
  assert.strictEqual(filterByTerminal(fl, null).length, 4);
  assert.deepStrictEqual(terminalsIn(fl).sort(), ['2', '3']);
});

test('demo flights carry terminals for multi-terminal airports only', () => {
  const now = Date.UTC(2026, 10, 7, 9, 0);
  const man = demoDepartures('MAN', now).flights;
  assert.deepStrictEqual(terminalsIn(man).sort(), ['1', '2', '3']);
  assert.deepStrictEqual(terminalsIn(demoDepartures('LBA', now).flights), []);
});

test('findAirport: built-in, needs key otherwise, maps 404', async () => {
  assert.strictEqual((await findAirport('MAN', '')).name, 'Manchester');
  await assert.rejects(findAirport('QQQ', ''), /API key/);
  globalThis.fetch = async () => ({ ok: false, status: 404 });
  await assert.rejects(findAirport('QQQ', 'k'), /No airport found for QQQ/);
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ shortName: 'Quux', timeZone: 'Asia/Tokyo' }) });
  assert.deepStrictEqual(await findAirport('QUX', 'k'), { iata: 'QUX', name: 'Quux', tz: 'Asia/Tokyo' });
});
