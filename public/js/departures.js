// Chooses live or demo data. Live needs a RapidAPI key; without one we show demo data.
import { demoDepartures } from './demo.js';
import { liveDepartures } from './aerodatabox.js';

export async function getDepartures(code, key) {
  if (!key) return { ...demoDepartures(code), generatedAt: Date.now() };
  try {
    return { ...(await liveDepartures(code, key)), generatedAt: Date.now() };
  } catch (err) {
    // Surface the reason, but keep the board populated.
    return { ...demoDepartures(code), fallback: err.message, generatedAt: Date.now() };
  }
}
