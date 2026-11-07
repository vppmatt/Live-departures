import { Row } from './flap.js';
import { getDepartures } from './departures.js';
import { AIRPORTS } from './airports.js';

const ROWS = 10;
const PAGE_MS = 14000;
const REFRESH_MS = 30000;
const KEY_STORE = 'rapidapiKey';
const COLUMNS = [
  { key: 'time', len: 5, cls: 'time' },
  { key: 'flight', len: 7, cls: 'flight' },
  { key: 'dest', len: 16, cls: 'dest' },
  { key: 'gate', len: 4, cls: 'gate' },
  { key: 'status', len: 11, cls: 'status' },
];

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d = '') { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} },
};
const state = {
  airport: 'LBA', flights: [], page: 0, tz: 'Europe/London', apiKey: store.get(KEY_STORE),
  soundOn: false, audio: null, lastClick: 0,
  loading: false, nextAt: Date.now() + REFRESH_MS, summary: '', error: '', seq: 0,
};

/* ---------- sound (optional) ---------- */
function click() {
  if (!state.soundOn || !state.audio) return;
  const now = performance.now();
  if (now - state.lastClick < 28) return;
  state.lastClick = now;
  const ctx = state.audio, len = Math.floor(ctx.sampleRate * 0.018);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = 'bandpass'; f.frequency.value = 1800 + Math.random() * 900; g.gain.value = 0.35;
  src.buffer = buf; src.connect(f); f.connect(g); g.connect(ctx.destination); src.start();
}

/* ---------- board ---------- */
const rowsEl = $('rows');
const rows = Array.from({ length: ROWS }, () => {
  const r = new Row(COLUMNS, click);
  rowsEl.appendChild(r.root);
  return r;
});

function statusText(f) {
  switch (f.status) {
    case 'delayed': return f.expected ? 'EXP ' + f.expected : 'DELAYED';
    case 'checkin': return 'CHECK-IN';
    case 'boarding': return 'BOARDING';
    case 'gateclosed': return 'GATE CLOSED';
    case 'departed': return 'DEPARTED';
    case 'cancelled': return 'CANCELLED';
    case 'diverted': return 'DIVERTED';
    default: return 'ON TIME';
  }
}
const flightText = (s) => (s.length > 7 ? s.replace(/\s+/g, '') : s);
const gateText = (f) => f.gate || (f.terminal && 'T' + f.terminal) || '';

function render() {
  const pages = Math.max(1, Math.ceil(state.flights.length / ROWS));
  if (state.page >= pages) state.page = 0;
  const slice = state.flights.slice(state.page * ROWS, state.page * ROWS + ROWS);
  rows.forEach((row, i) => {
    const f = slice[i];
    if (!f) { row.set({ dest: !state.flights.length && !i ? 'NO DEPARTURES' : '' }, i * 40); return; }
    row.set({ time: f.time, flight: flightText(f.flight), dest: f.dest, gate: gateText(f), status: statusText(f) }, i * 40, f.status);
  });
  state.pages = pages;
  paintStatus();
}

/* ---------- status line + countdown ---------- */
function paintStatus() {
  const el = $('updated');
  const secs = Math.max(0, Math.ceil((state.nextAt - Date.now()) / 1000));
  const page = state.pages > 1 ? ` · page ${state.page + 1}/${state.pages}` : '';
  const next = state.loading ? 'updating…' : `next update in <span class="next">${secs}s</span>`;
  el.classList.toggle('err', !!state.error);
  el.innerHTML = (state.error ? esc(state.error) + ' · ' : esc(state.summary) + page + ' · ') + next;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function frame() {
  const remaining = state.nextAt - Date.now();
  const frac = state.loading ? 1 : Math.min(1, Math.max(0, remaining / REFRESH_MS));
  $('bar').style.transform = `scaleX(${frac})`;
  document.querySelector('.countdown').classList.toggle('busy', state.loading);
  if (!state.loading && remaining <= 0 && !document.hidden) load();
}
setInterval(frame, 200);
setInterval(paintStatus, 1000);

/* ---------- data ---------- */
async function load() {
  if (state.loading) return;
  state.loading = true; paintStatus();
  const seq = ++state.seq, airport = state.airport;
  try {
    const data = await getDepartures(airport, state.apiKey);
    if (seq !== state.seq || airport !== state.airport) return; // airport changed meanwhile
    state.flights = data.flights;
    state.tz = data.airport.tz || state.tz;
    $('airportName').textContent = `${data.airport.name} (${data.airport.iata}) departures`;
    document.title = `${data.airport.iata} departures`;
    const live = data.source !== 'demo';
    const badge = $('badge');
    badge.hidden = false;
    badge.classList.toggle('live', live);
    badge.textContent = data.fallback ? 'demo (live failed)' : live ? 'live' : 'demo data';
    state.error = data.fallback ? `Live data failed: ${data.fallback}` : '';
    const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    state.summary = `${state.flights.length} flight${state.flights.length === 1 ? "" : "s"} · updated ${t}` + (!live && !data.fallback ? ' · add API key in Settings for live data' : '');
  } catch (err) {
    state.error = `Update failed: ${err.message}`;
  } finally {
    if (seq === state.seq) { state.loading = false; state.nextAt = Date.now() + REFRESH_MS; }
  }
  render();
}

function refreshNow() { state.loading = false; load(); }

/* ---------- clock ---------- */
function tick() {
  let t;
  try { t = new Date().toLocaleTimeString('en-GB', { timeZone: state.tz, hour12: false }); }
  catch { t = new Date().toLocaleTimeString('en-GB'); }
  $('clock').textContent = t;
}

/* ---------- controls ---------- */
function setAirport(code, { push = true } = {}) {
  code = code.toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return;
  state.airport = code; state.page = 0;
  $('airport').value = code;
  store.set('airport', code);
  if (push) try { history.replaceState(null, '', '?airport=' + code); } catch {}
  refreshNow();
}

$('airport').addEventListener('input', (e) => { if (e.target.value.length === 3) setAirport(e.target.value); });
$('airport').addEventListener('focus', (e) => e.target.select());
$('refresh').addEventListener('click', refreshNow);
$('sound').addEventListener('click', (e) => {
  state.soundOn = !state.soundOn;
  if (state.soundOn && !state.audio) state.audio = new (window.AudioContext || window.webkitAudioContext)();
  if (state.audio?.state === 'suspended') state.audio.resume();
  e.target.setAttribute('aria-pressed', state.soundOn);
  e.target.textContent = 'Sound: ' + (state.soundOn ? 'on' : 'off');
});
$('full').addEventListener('click', () => {
  document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
});
if (window.Capacitor?.isNativePlatform?.()) $('full').hidden = true;

/* settings dialog */
const dlg = $('dlg');
$('settings').addEventListener('click', () => {
  $('keyInput').value = state.apiKey; $('showKey').checked = false; $('keyInput').type = 'password';
  dlg.showModal();
});
$('showKey').addEventListener('change', (e) => { $('keyInput').type = e.target.checked ? 'text' : 'password'; });
function applyKey(key) { state.apiKey = key.trim(); store.set(KEY_STORE, state.apiKey); dlg.close(); refreshNow(); }
$('saveKey').addEventListener('click', (e) => { e.preventDefault(); applyKey($('keyInput').value); });
$('clearKey').addEventListener('click', () => applyKey(''));

/* keep the screen awake while the board is up (best effort) */
let wake = null;
async function keepAwake() { try { wake = await navigator.wakeLock?.request('screen'); } catch {} }
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  keepAwake();
  if (Date.now() >= state.nextAt) refreshNow(); // came back after a pause: update straight away
});
keepAwake();

/* ---------- start ---------- */
for (const [iata, a] of Object.entries(AIRPORTS)) {
  $('airportList').appendChild(Object.assign(document.createElement('option'), { value: iata, label: a.name }));
}
let initial = 'LBA';
try { initial = new URLSearchParams(location.search).get('airport') || store.get('airport') || 'LBA'; } catch {}
setAirport(initial, { push: false });
setInterval(tick, 1000); tick();
setInterval(() => { if (state.flights.length > ROWS) { state.page++; render(); } }, PAGE_MS);
