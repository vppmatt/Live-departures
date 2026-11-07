'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { AIRPORTS } = require('./src/airports');
const { demoDepartures } = require('./src/demo');
const { liveDepartures } = require('./src/aerodatabox');

// Minimal .env loader (no dependency).
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
} catch { /* no .env */ }

const PORT = +process.env.PORT || 3000;
const KEY = process.env.RAPIDAPI_KEY || '';
const CACHE_MS = 60 * 1000; // protect API quota; the board polls more often than this
const PUBLIC = path.join(__dirname, 'public');
const cache = new Map();

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

async function getDepartures(code) {
  const hit = cache.get(code);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  let data;
  if (KEY) {
    try {
      data = await liveDepartures(code, KEY);
    } catch (err) {
      console.error('[live] failed, serving stale/demo:', err.message);
      if (hit) return { ...hit.data, stale: true };
      data = { ...demoDepartures(code), fallback: err.message };
    }
  } else {
    data = demoDepartures(code);
  }
  data.generatedAt = new Date().toISOString();
  cache.set(code, { at: Date.now(), data });
  return data;
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/departures') {
    const code = (url.searchParams.get('airport') || 'LBA').toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) return send(res, 400, { error: 'airport must be a 3-letter IATA code' });
    try { return send(res, 200, await getDepartures(code)); }
    catch (err) { console.error(err); return send(res, 502, { error: 'upstream failure' }); }
  }
  if (url.pathname === '/api/airports') {
    return send(res, 200, { live: !!KEY, airports: Object.entries(AIRPORTS).map(([iata, a]) => ({ iata, name: a.name })) });
  }
  let rel = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const file = path.join(PUBLIC, path.normalize(rel));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, 'Forbidden', 'text/plain');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Not found', 'text/plain');
    send(res, 200, buf, TYPES[path.extname(file)] || 'application/octet-stream');
  });
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`Departures board on http://localhost:${PORT}  (${KEY ? 'LIVE data' : 'DEMO data - set RAPIDAPI_KEY for live'})`));
}
module.exports = { server, getDepartures };
