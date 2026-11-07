// Chooses live or demo data. Live needs a RapidAPI key; without one we show demo data.
import { demoDepartures } from './demo.js';
import { liveDepartures, lookupAirport } from './aerodatabox.js';
import { AIRPORTS } from './airports.js';

export async function getDepartures(code, key) {
  if (!key) return { ...demoDepartures(code), generatedAt: Date.now() };
  try {
    return { ...(await liveDepartures(code, key)), generatedAt: Date.now() };
  } catch (err) {
    // Surface the reason, but keep the board populated.
    return { ...demoDepartures(code), fallback: err.message, generatedAt: Date.now() };
  }
}

/** Resolve an IATA code to {iata, name, tz}: built-in list first, then the live API. */
export async function findAirport(code, key) {
  const known = AIRPORTS[code];
  if (known) return { iata: code, name: known.name, tz: known.tz };
  if (!key) throw new Error('Enter your API key above to look up airports that are not in the quick-add list');
  const a = await lookupAirport(code, key);
  return { iata: code, name: a.name, tz: a.tz };
}
