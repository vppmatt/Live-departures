// Live provider: AeroDataBox via RapidAPI (https://rapidapi.com/aedbx-aedbx/api/aerodatabox).
// Works for any airport by IATA code.
import { AIRPORTS } from './airports.js';
import { localIso, hhmm } from './tz.js';

const HOST = 'aerodatabox.p.rapidapi.com';
const airportCache = new Map();

async function api(path, key) {
  const request = fetch(`https://${HOST}${path}`, {
    headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': HOST, Accept: 'application/json' },
  });
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('request timed out')), 12000));
  const res = await Promise.race([request, timeout]);
  if (res.status === 401 || res.status === 403) throw new Error('API key rejected (check it in Settings)');
  if (res.status === 429) throw new Error('API quota exceeded');
  if (!res.ok) throw new Error(`AeroDataBox error ${res.status}`);
  return res.json();
}

async function airportInfo(code, key) {
  if (airportCache.has(code)) return airportCache.get(code);
  const known = AIRPORTS[code];
  let info;
  if (known) {
    info = { iata: code, name: known.name, tz: known.tz };
  } else {
    const a = await api(`/airports/iata/${code}`, key);
    info = { iata: code, name: a.shortName || a.name || code, tz: a.timeZone || 'UTC' };
  }
  airportCache.set(code, info);
  return info;
}

function mapStatus(raw, sched, revised, now) {
  const s = String(raw || '').toLowerCase();
  if (s.startsWith('cancel')) return 'cancelled';
  if (s === 'departed' || s === 'enroute' || s === 'approaching' || s === 'arrived') return 'departed';
  if (s === 'gateclosed') return 'gateclosed';
  if (s === 'boarding') return 'boarding';
  if (s === 'checkin') return 'checkin';
  if (s === 'delayed') return 'delayed';
  if (s === 'diverted') return 'diverted';
  if (revised && sched && revised - sched >= 5 * 60000) return 'delayed';
  return 'scheduled';
}

// utc looks like "2026-11-07 14:35Z"; V8 parses it once the space becomes a "T".
const utc = (t) => (t && t.utc ? Date.parse(String(t.utc).replace(' ', 'T')) : NaN);

export async function liveDepartures(code, key, now = Date.now()) {
  const info = await airportInfo(code, key);
  const from = localIso(info.tz, now - 30 * 60000);
  const to = localIso(info.tz, now + (11 * 60 + 30) * 60000);
  const qs = 'direction=Departure&withLeg=false&withCancelled=true&withCodeshared=false&withCargo=false&withPrivate=false';
  const data = await api(`/flights/airports/iata/${code}/${from}/${to}?${qs}`, key);

  const flights = [];
  for (const f of data.departures || []) {
    // The API has used both `departure` and `movement` for this airport's side.
    const here = f.departure || f.movement || {};
    const there = (f.arrival && f.arrival.airport) || (f.movement && f.movement.airport) || {};
    const sched = utc(here.scheduledTime);
    const revised = utc(here.revisedTime || here.predictedTime || here.runwayTime);
    if (isNaN(sched)) continue;
    const status = mapStatus(f.status, sched, revised, now);
    const eff = isNaN(revised) ? sched : revised;
    if (status === 'departed' && eff < now - 15 * 60000) continue;
    flights.push({
      time: hhmm(info.tz, sched),
      expected: !isNaN(revised) && Math.abs(revised - sched) >= 5 * 60000 ? hhmm(info.tz, revised) : null,
      flight: String(f.number || '').toUpperCase(),
      dest: String(there.municipalityName || there.shortName || there.name || there.iata || '?').toUpperCase(),
      destIata: there.iata || '',
      gate: here.gate || '', terminal: here.terminal || '',
      status, sortKey: eff,
    });
  }
  flights.sort((a, b) => a.sortKey - b.sortKey);
  return { airport: info, source: 'aerodatabox', flights };
}
