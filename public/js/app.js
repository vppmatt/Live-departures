import { Row } from './flap.js';
import { getDepartures } from './departures.js';
import { normTerm, termLabel, terminalsIn, filterByTerminal } from './airports.js';
import { initPicker } from './picker.js';
import { initSettings } from './settings.js';
import * as prefs from './prefs.js';

const ROWS = 10;
const REFRESH_MS = 30000;
const COLUMNS = [
  { key: 'time', len: 5, cls: 'time' },
  { key: 'flight', len: 7, cls: 'flight' },
  { key: 'dest', len: 16, cls: 'dest' },
  { key: 'gate', len: 4, cls: 'gate' },
  { key: 'status', len: 11, cls: 'status' },
];

const $ = (id) => document.getElementById(id);
const state = {
  airports: prefs.getAirports(), sel: prefs.getSel(), apiKey: prefs.getKey(),
  all: [], flights: [], loaded: false, page: 0, pages: 1, tz: 'Europe/London',
  soundOn: false, audio: null, lastClick: 0,
  loading: false, nextAt: Date.now() + REFRESH_MS, summary: '', error: '', seq: 0,
};
if (!state.airports.some((a) => a.iata === state.sel.iata)) state.sel = { iata: state.airports[0].iata, terminal: null };
const current = () => state.airports.find((a) => a.iata === state.sel.iata) || state.airports[0];

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
const gateText = (f) => f.gate || (f.terminal ? 'T' + normTerm(f.terminal) : '');

function render() {
  state.pages = Math.max(1, Math.ceil(state.flights.length / ROWS));
  if (state.page >= state.pages) state.page = state.pages - 1;
  const slice = state.flights.slice(state.page * ROWS, state.page * ROWS + ROWS);
  rows.forEach((row, i) => {
    const f = slice[i];
    if (!f) { row.set({ dest: state.loaded && !state.flights.length && !i ? 'NO DEPARTURES' : '' }, i * 40); return; }
    row.set({ time: f.time, flight: flightText(f.flight), dest: f.dest, gate: gateText(f), status: statusText(f) }, i * 40, f.status);
  });
  renderPager();
  paintStatus();
}

/* ---------- pager (manual page selection) ---------- */
const MAX_NUMBERED = 7;
function renderPager() {
  const nav = $('pager');
  nav.hidden = state.pages <= 1;
  if (nav.hidden) return;
  const refocus = nav.contains(document.activeElement) ? document.activeElement.dataset.page : null;
  const mk = (label, page, { current = false, aria, disabled = false } = {}) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label; b.dataset.page = page; b.disabled = disabled;
    if (aria) b.setAttribute('aria-label', aria);
    if (current) b.setAttribute('aria-current', 'page');
    b.addEventListener('click', () => { state.page = page; render(); });
    return b;
  };
  const text = (t) => Object.assign(document.createElement('span'), { className: 'lbl', textContent: t });
  const kids = [];
  if (state.pages <= MAX_NUMBERED) {
    kids.push(text('Page'));
    for (let p = 0; p < state.pages; p++) kids.push(mk(String(p + 1), p, { current: p === state.page, aria: `Page ${p + 1}` }));
  } else {
    kids.push(mk('‹', state.page - 1, { aria: 'Previous page', disabled: state.page === 0 }),
      text(`Page ${state.page + 1} of ${state.pages}`),
      mk('›', state.page + 1, { aria: 'Next page', disabled: state.page === state.pages - 1 }));
  }
  nav.replaceChildren(...kids);
  if (refocus != null) nav.querySelector(`[data-page="${refocus}"]:not(:disabled)`)?.focus();
}

/* ---------- status line + countdown ---------- */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function paintStatus() {
  const el = $('updated');
  const secs = Math.max(0, Math.ceil((state.nextAt - Date.now()) / 1000));
  const next = state.loading ? 'updating…' : `next update in <span class="next">${secs}s</span>`;
  el.classList.toggle('err', !!state.error);
  el.title = state.error || `Updated ${state.updatedAt || ''}`;
  el.innerHTML = (state.error ? esc(state.error) : esc(state.summary)) + ' · ' + next;
}

function frame() {
  const remaining = state.nextAt - Date.now();
  const frac = state.loading ? 1 : Math.min(1, Math.max(0, remaining / REFRESH_MS));
  $('bar').style.transform = `scaleX(${frac})`;
  document.querySelector('.countdown').classList.toggle('busy', state.loading);
  if (!state.loading && remaining <= 0 && !document.hidden) load();
}
setInterval(frame, 200);
setInterval(paintStatus, 1000);

/* ---------- selection ---------- */
function paintTitle() {
  const a = current(), t = state.sel.terminal;
  $('airportName').textContent = `${a.name} (${a.iata})` + (t ? ` · ${termLabel(t)}` : '');
  document.title = `${a.iata}${t ? ' T' + t : ''} departures`;
  if (a.tz) state.tz = a.tz;
}
function applyFilter() { state.flights = filterByTerminal(state.all, state.sel.terminal); }

function select(iata, terminal = null) {
  const sameAirport = iata === state.sel.iata;
  state.sel = { iata, terminal };
  prefs.setSel(state.sel);
  state.page = 0;
  paintTitle();
  if (sameAirport && state.loaded) { applyFilter(); updateSummary(); render(); return; }
  state.all = []; state.flights = []; state.loaded = false; state.error = '';
  render();
  refreshNow();
}

/* ---------- data ---------- */
function learnTerminals(data) {
  const entry = current();
  const seen = new Set([...(entry.terminals || []), ...terminalsIn(data.flights)]);
  if (seen.size !== (entry.terminals || []).length) {
    entry.terminals = [...seen].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    prefs.setAirports(state.airports);
  }
}
function updateSummary() {
  const n = state.flights.length;
  const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  state.summary = `${n} flight${n === 1 ? '' : 's'}`;
  state.updatedAt = t;
}

async function load() {
  if (state.loading) return;
  state.loading = true; paintStatus();
  const seq = ++state.seq, iata = state.sel.iata;
  try {
    const data = await getDepartures(iata, state.apiKey);
    if (seq !== state.seq || iata !== state.sel.iata) return; // selection changed meanwhile
    state.all = data.flights; state.loaded = true;
    state.source = data.source; state.fallback = data.fallback;
    learnTerminals(data);
    applyFilter();
    const live = data.source !== 'demo';
    const badge = $('badge');
    badge.hidden = false;
    badge.classList.toggle('live', live);
    badge.textContent = data.fallback ? 'demo (live failed)' : live ? 'live' : 'demo data';
    state.error = data.fallback ? `Live data failed: ${data.fallback}` : '';
    updateSummary();
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

const settings = initSettings({
  dlg: $('dlg'), openButton: $('settings'),
  getKey: () => state.apiKey, getAirports: () => state.airports,
  onSave({ key, airports }) {
    state.apiKey = key; prefs.setKey(key);
    state.airports = airports; prefs.setAirports(airports);
    if (!airports.some((a) => a.iata === state.sel.iata)) { select(airports[0].iata, null); return; }
    paintTitle();
    refreshNow();
  },
});

initPicker({
  root: $('titleWrap'), button: $('picker'), menu: $('menu'),
  getAirports: () => state.airports, getSel: () => state.sel,
  onSelect: select, onEdit: () => settings.open(),
});

/* keep the screen awake while the board is up (best effort) */
async function keepAwake() { try { await navigator.wakeLock?.request('screen'); } catch { /* unsupported or denied */ } }
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  keepAwake();
  if (Date.now() >= state.nextAt) refreshNow(); // came back after a pause: update straight away
});
keepAwake();

/* ---------- start ---------- */
paintTitle();
render();
refreshNow();
setInterval(tick, 1000); tick();
