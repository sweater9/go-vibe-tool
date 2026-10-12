#!/usr/bin/env node
/* Local static server for dist/ that mimics Cloudflare Workers static assets routing:
   html_handling "auto-trailing-slash" (x.html -> /x, folder/index.html -> /folder/) and not_found_handling "404-page".
   Used by `npm run preview` and by tests/dist-browser.mjs. Serves nothing outside dist/. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };

export function createDistServer(dist, { port = 0 } = {}) {
  const root = path.resolve(dist); const sockets = new Set(); let server;
  const isFile = p => { try { return fs.statSync(p).isFile(); } catch { return false; } };
  const send = (res, status, file, extra = {}) => { const ext = path.extname(file); res.writeHead(status, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache', ...extra }); res.end(fs.readFileSync(file)); };
  const handler = (req, res) => {
    const u = new URL(req.url, 'http://x'); let p; try { p = decodeURIComponent(u.pathname); } catch { res.writeHead(400).end(); return; }
    const file = path.resolve(root, '.' + p); if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const redirect = to => { res.writeHead(307, { Location: to + u.search }); res.end(); };
    if (p.endsWith('/index.html')) return redirect(p.slice(0, -'index.html'.length));
    if (p.endsWith('.html') && isFile(file)) return redirect(p.slice(0, -'.html'.length));
    if (p.endsWith('/')) { const idx = path.join(file, 'index.html'); if (isFile(idx)) return send(res, 200, idx); if (isFile(file.slice(0, -1) + '.html')) return redirect(p.slice(0, -1)); }
    else if (isFile(file)) return send(res, 200, file);
    else if (isFile(file + '.html')) return send(res, 200, file + '.html');
    else if (isFile(path.join(file, 'index.html'))) return redirect(p + '/');
    const nf = path.join(root, '404.html'); if (isFile(nf)) return send(res, 404, nf); res.writeHead(404).end('Not found');
  };
  const start = () => new Promise(r => { server = http.createServer(handler); server.on('connection', s => { sockets.add(s); s.on('close', () => sockets.delete(s)); }); server.listen(port, '127.0.0.1', () => { port = server.address().port; r(port); }); });
  const stop = () => new Promise(r => { server.close(() => r()); for (const s of sockets) s.destroy(); });
  return { start, stop, get port() { return port; }, get base() { return `http://127.0.0.1:${port}/`; } };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', process.argv[2] || 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) { console.error('dist/ not found. Run: npm run build'); process.exit(1); }
  const s = createDistServer(dist, { port: Number(process.env.PORT) || 8080 }); await s.start(); console.log(`Serving ${dist} at ${s.base} (Cloudflare-style routing). Mahjong backend is not started.`);
}
