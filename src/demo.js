'use strict';
// Generates a believable, deterministic-per-day departures schedule so the
// board works with no API key. Statuses evolve in real time.
const { AIRPORTS } = require('./airports');
const { localMidnight, hhmm } = require('./tz');

const LBA_DESTS = [
  ['AMS', 'AMSTERDAM', 'KL'], ['DUB', 'DUBLIN', 'EI'], ['DUB', 'DUBLIN', 'FR'],
  ['PMI', 'PALMA', 'LS'], ['ALC', 'ALICANTE', 'LS'], ['AGP', 'MALAGA', 'LS'],
  ['FAO', 'FARO', 'LS'], ['TFS', 'TENERIFE SOUTH', 'LS'], ['DLM', 'DALAMAN', 'LS'],
  ['AYT', 'ANTALYA', 'BY'], ['CDG', 'PARIS CDG', 'AF'], ['BFS', 'BELFAST INTL', 'LS'],
  ['PRG', 'PRAGUE', 'LS'], ['KRK', 'KRAKOW', 'FR'], ['WAW', 'WARSAW', 'FR'],
  ['GVA', 'GENEVA', 'LS'], ['IBZ', 'IBIZA', 'LS'], ['LPA', 'GRAN CANARIA', 'BY'],
  ['ACE', 'LANZAROTE', 'LS'], ['HER', 'HERAKLION', 'BY'], ['BCN', 'BARCELONA', 'LS'],
  ['FNC', 'MADEIRA', 'LS'], ['REU', 'REUS', 'FR'], ['SZG', 'SALZBURG', 'LS'],
];
const GENERIC_DESTS = [
  ['AMS', 'AMSTERDAM', 'KL'], ['DUB', 'DUBLIN', 'EI'], ['CDG', 'PARIS CDG', 'AF'],
  ['FRA', 'FRANKFURT', 'LH'], ['MAD', 'MADRID', 'IB'], ['BCN', 'BARCELONA', 'VY'],
  ['FCO', 'ROME', 'AZ'], ['ZRH', 'ZURICH', 'LX'], ['CPH', 'COPENHAGEN', 'SK'],
  ['LIS', 'LISBON', 'TP'], ['IST', 'ISTANBUL', 'TK'], ['DXB', 'DUBAI', 'EK'],
  ['JFK', 'NEW YORK JFK', 'BA'], ['LHR', 'LONDON HEATHROW', 'BA'], ['VIE', 'VIENNA', 'OS'],
  ['ARN', 'STOCKHOLM', 'SK'], ['ATH', 'ATHENS', 'A3'], ['BRU', 'BRUSSELS', 'SN'],
];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scheduleForDay(code, tz, dayStart, dayKey) {
  const rand = rng(hash(code + dayKey));
  const pool = (code === 'LBA' ? LBA_DESTS : GENERIC_DESTS).filter((d) => d[0] !== code);
  const count = code === 'LBA' ? 34 : 60;
  const out = [];
  for (let i = 0; i < count; i++) {
    const mins = 6 * 60 + Math.floor(rand() * ((16 * 60) / 5)) * 5; // 06:00-21:55
    const [iata, name, airline] = pool[Math.floor(rand() * pool.length)];
    const r = rand();
    out.push({
      sched: dayStart + mins * 60000,
      flight: airline + ' ' + (100 + Math.floor(rand() * 8900)),
      dest: name, destIata: iata,
      delay: r < 0.68 ? 0 : r < 0.9 ? 5 + Math.floor(rand() * 5) * 5 : 30 + Math.floor(rand() * 10) * 10,
      cancelled: rand() < 0.025,
      gate: String(1 + Math.floor(rand() * 20)),
    });
  }
  return out;
}

function demoDepartures(code, now = Date.now()) {
  const info = AIRPORTS[code] || { name: code + ' Airport', tz: 'Europe/London' };
  const flights = [];
  for (const off of [-1, 0, 1]) {
    const dayStart = localMidnight(info.tz, now, off);
    const dayKey = new Date(dayStart + 12 * 3600e3).toISOString().slice(0, 10);
    for (const f of scheduleForDay(code, info.tz, dayStart, dayKey)) {
      const eff = f.sched + f.delay * 60000;
      const untilDep = (eff - now) / 60000; // minutes until (expected) departure
      if (untilDep < -15 || untilDep > 12 * 60) continue;
      let status;
      if (f.cancelled) status = 'cancelled';
      else if (untilDep < 0) status = 'departed';
      else if (untilDep <= 10) status = 'gateclosed';
      else if (untilDep <= 30) status = 'boarding';
      else if (untilDep <= 120) status = f.delay >= 5 ? 'delayed' : 'checkin';
      else status = f.delay >= 5 ? 'delayed' : 'scheduled';
      flights.push({
        time: hhmm(info.tz, f.sched),
        expected: f.delay >= 5 ? hhmm(info.tz, eff) : null,
        flight: f.flight, dest: f.dest, destIata: f.destIata,
        gate: !f.cancelled && untilDep <= 60 ? f.gate : '',
        terminal: '', status, sortKey: eff,
      });
    }
  }
  flights.sort((a, b) => a.sortKey - b.sortKey);
  return { airport: { iata: code, name: info.name, tz: info.tz }, source: 'demo', flights };
}

module.exports = { demoDepartures };
