// Everything the user chooses, stored on this device only.
import { AIRPORTS } from './airports.js';

function get(k, d = '') { try { return localStorage.getItem(k) ?? d; } catch { return d; } }
function set(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* storage unavailable */ } }

export const getKey = () => get('rapidapiKey');
export const setKey = (k) => set('rapidapiKey', k);

const seed = (code) => ({ iata: code, name: AIRPORTS[code].name, tz: AIRPORTS[code].tz });

/** Preferred airports: [{iata, name, tz, terminals?}], always at least one. */
export function getAirports() {
  try {
    const a = JSON.parse(get('airports', '[]'));
    if (Array.isArray(a) && a.length && a.every((x) => x && /^[A-Z]{3}$/.test(x.iata) && x.name)) return a;
  } catch { /* fall through */ }
  const old = get('airport'); // earlier versions stored a single code
  return [seed(AIRPORTS[old] ? old : 'LBA')];
}
export const setAirports = (list) => set('airports', JSON.stringify(list));

/** Current selection: {iata, terminal|null}. */
export function getSel() {
  try { const s = JSON.parse(get('sel', 'null')); if (s && /^[A-Z]{3}$/.test(s.iata)) return { iata: s.iata, terminal: s.terminal || null }; } catch { /* fall through */ }
  return { iata: getAirports()[0].iata, terminal: null };
}
export const setSel = (sel) => set('sel', JSON.stringify(sel));
