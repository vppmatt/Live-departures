'use strict';
const ROWS = 10;
const PAGE_MS = 14000;
const POLL_MS = 60000;
const COLUMNS = [
  { key: 'time', len: 5, cls: 'time' },
  { key: 'flight', len: 7, cls: 'flight' },
  { key: 'dest', len: 16, cls: 'dest' },
  { key: 'gate', len: 4, cls: 'gate' },
  { key: 'status', len: 11, cls: 'status' },
];

const $ = (id) => document.getElementById(id);
const state = { airport: 'LBA', flights: [], page: 0, tz: 'Europe/London', soundOn: false, audio: null, lastClick: 0 };

/* ---------- sound (optional) ---------- */
function click() {
  if (!state.soundOn || !state.audio) return;
  const now = performance.now();
  if (now - state.lastClick < 28) return; // avoid a wall of clipping noise
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
  const r = new SplitFlap.Row(COLUMNS, click);
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
const gateText = (f) => f.gate || f.terminal && 'T' + f.terminal || '';

function render() {
  const pages = Math.max(1, Math.ceil(state.flights.length / ROWS));
  if (state.page >= pages) state.page = 0;
  const slice = state.flights.slice(state.page * ROWS, state.page * ROWS + ROWS);
  rows.forEach((row, i) => {
    const f = slice[i];
    if (!f) {
      row.set({ dest: state.flights.length || i ? '' : 'NO DEPARTURES' }, i * 40);
      return;
    }
    row.set({
      time: f.time, flight: flightText(f.flight), dest: f.dest,
      gate: gateText(f), status: statusText(f),
    }, i * 40, f.status);
  });
  $('updated').textContent = state.error ? state.error : state.updatedText + (pages > 1 ? ` · page ${state.page + 1}/${pages}` : '');
}

/* ---------- data ---------- */
async function load() {
  try {
    const res = await fetch('/api/departures?airport=' + state.airport, { cache: 'no-store' });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.status);
    const data = await res.json();
    state.flights = data.flights;
    state.tz = data.airport.tz || state.tz;
    state.error = '';
    $('airportName').textContent = `${data.airport.name} (${data.airport.iata}) departures`;
    document.title = `${data.airport.iata} departures`;
    const badge = $('badge');
    badge.hidden = false;
    badge.classList.toggle('live', data.source !== 'demo' && !data.fallback);
    badge.textContent = data.fallback ? 'demo (live failed)' : data.source === 'demo' ? 'demo data' : data.stale ? 'live · stale' : 'live';
    state.updatedText = `${state.flights.length} flights · updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch (err) {
    state.error = `Connection problem (${err.message}) – retrying`;
  }
  render();
}

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
  try { localStorage.setItem('airport', code); } catch {}
  if (push) history.replaceState(null, '', '?airport=' + code);
  load();
}

$('airport').addEventListener('input', (e) => { if (e.target.value.length === 3) setAirport(e.target.value); });
$('airport').addEventListener('focus', (e) => e.target.select());
$('sound').addEventListener('click', (e) => {
  state.soundOn = !state.soundOn;
  if (state.soundOn && !state.audio) state.audio = new (window.AudioContext || window.webkitAudioContext)();
  if (state.audio && state.audio.state === 'suspended') state.audio.resume();
  e.target.setAttribute('aria-pressed', state.soundOn);
  e.target.textContent = 'Sound: ' + (state.soundOn ? 'on' : 'off');
});
$('full').addEventListener('click', () => {
  document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
});

fetch('/api/airports').then((r) => r.json()).then((d) => {
  $('airportList').replaceChildren(...d.airports.map((a) => Object.assign(document.createElement('option'), { value: a.iata, label: a.name })));
}).catch(() => {});

let initial = 'LBA';
try { initial = new URLSearchParams(location.search).get('airport') || localStorage.getItem('airport') || 'LBA'; } catch {}
setAirport(initial, { push: false });
setInterval(tick, 1000); tick();
setInterval(load, POLL_MS);
setInterval(() => { if (state.flights.length > ROWS) { state.page++; render(); } }, PAGE_MS);
