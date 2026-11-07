// Tiny static file server for developing the app in a desktop browser.
// The app itself is entirely client-side (see public/js) and ships to Android via Capacitor.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const PORT = +process.env.PORT || 3000;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json',
};

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const rel = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const file = path.join(PUBLIC, path.normalize(rel));
  const send = (code, body, type = 'text/plain') => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); };
  if (!file.startsWith(PUBLIC + path.sep)) return send(403, 'Forbidden');
  fs.readFile(file, (err, buf) => err ? send(404, 'Not found') : send(200, buf, TYPES[path.extname(file)] || 'application/octet-stream'));
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
