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

import { describeDelay, detailRows, fmtMins } from '../public/js/flightinfo.js';

test('fmtMins', () => {
  assert.strictEqual(fmtMins(25), '25 min');
  assert.strictEqual(fmtMins(60), '1 h');
  assert.strictEqual(fmtMins(135), '2 h 15 min');
  assert.strictEqual(fmtMins(-10), '10 min');
});

test('describeDelay covers delayed, cancelled, early and normal', () => {
  const base = { flight: 'LS 1', time: '15:20', dest: 'PALMA', destIata: 'PMI', status: 'scheduled', delayMins: 0, expected: null };
  assert.strictEqual(describeDelay(base), null);
  assert.match(describeDelay({ ...base, status: 'delayed', expected: '15:45', delayMins: 25 }).text, /Delayed by 25 min.*15:45.*scheduled 15:20/);
  assert.match(describeDelay({ ...base, status: 'delayed' }).text, /not been published/);
  assert.match(describeDelay({ ...base, status: 'cancelled' }).text, /cancelled/);
  assert.match(describeDelay({ ...base, expected: '15:10', delayMins: -10 }).text, /10 min earlier/);
});

test('detailRows only lists fields that exist', () => {
  const sparse = detailRows({ flight: 'LS 1', time: '15:20', dest: 'PALMA', destIata: 'PMI', terminal: '', gate: '', status: 'scheduled' });
  assert.deepStrictEqual(sparse.map((r) => r[0]), ['Scheduled', 'Destination']);
  const full = Object.fromEntries(detailRows({ flight: 'LS 1', time: '15:20', date: '2026-11-07', dest: 'PALMA', destIata: 'PMI', destName: 'Palma de Mallorca Son Sant Joan', airline: 'Jet2', aircraft: 'Airbus A321', terminal: 'T2', gate: '9', checkIn: '14-19', expected: '15:45', country: 'ES' }));
  assert.strictEqual(full.Airline, 'Jet2'); assert.strictEqual(full.Terminal, 'Terminal 2'); assert.strictEqual(full.Expected, '15:45');
  assert.match(full.Scheduled, /^15:20 · /); assert.match(full.Destination, /PALMA \(PMI\) – Palma de Mallorca/);
});

test('live mapping carries airline, aircraft, check-in and delay minutes', async () => {
  const now = Date.UTC(2026, 10, 7, 9, 0);
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ departures: [
    { number: 'LS 123', status: 'Delayed', airline: { name: 'Jet2' }, aircraft: { model: 'Airbus A321' },
      departure: { scheduledTime: { utc: '2026-11-07 09:30Z' }, revisedTime: { utc: '2026-11-07 09:55Z' }, checkInDesk: '14-19', terminal: '2' },
      arrival: { airport: { iata: 'PMI', municipalityName: 'Palma', name: 'Palma de Mallorca', countryCode: 'ES' } } },
  ] }) });
  const [f] = (await liveDepartures('LBA', 'k', now)).flights;
  assert.deepStrictEqual([f.airline, f.aircraft, f.checkIn, f.delayMins, f.destName, f.country, f.date, f.terminal],
    ['Jet2', 'Airbus A321', '14-19', 25, 'Palma de Mallorca', 'ES', '2026-11-07', '2']);
});
