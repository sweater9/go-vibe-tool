/* Diagnostic probe: do Firefox "ServiceWorker intercepted the request and encountered an unexpected error" messages
   appear when the page is left idle (no navigation) vs. when the test navigates away shortly after load? */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const pw = await import('playwright');
const engine = process.argv[2] || 'firefox';
const N = Number(process.argv[3] || 15);
const root = path.resolve(process.env.SITE_ROOT || 'dist');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.png': 'image/png' };
const server = http.createServer(async (req, res) => { try { let f = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname)); if ((await fs.stat(f)).isDirectory()) f = path.join(f, 'index.html'); res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }).end(await fs.readFile(f)); } catch { res.writeHead(404).end(); } });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await pw[engine].launch({ headless: true });
const isSwErr = t => /ServiceWorker intercepted/.test(t);
const variants = {
  idle: async p => { await p.goto(base); await p.waitForTimeout(6000); },
  navigate_away_0ms: async p => { await p.goto(base, { waitUntil: 'commit' }); await p.goto(base + 'studios.html'); await p.waitForTimeout(1500); },
  navigate_away_300ms: async p => { await p.goto(base); await p.waitForTimeout(300); await p.goto(base + 'studios.html'); await p.waitForTimeout(1500); },
  navigate_away_after_sw_ready: async p => { await p.goto(base); await p.evaluate(async () => { await navigator.serviceWorker.ready; }); await p.goto(base + 'studios.html'); await p.waitForTimeout(1500); },
  reload_after_idle: async p => { await p.goto(base); await p.waitForTimeout(3000); await p.reload(); await p.waitForTimeout(1500); },
};
const out = {};
for (const [name, run] of Object.entries(variants)) {
  let bad = 0; const samples = [];
  for (let i = 0; i < N; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.route(/googlesyndication|pagead|gstatic\.com|doubleclick/, r => r.abort());
    const p = await ctx.newPage(); const errs = [];
    p.on('console', m => { if (m.type() === 'error' && isSwErr(m.text())) errs.push(m.text().replace(/\s+/g, ' ').slice(0, 140)); });
    await run(p); await ctx.close();
    if (errs.length) { bad++; if (samples.length < 2) samples.push(errs); }
  }
  out[name] = { runs: N, withSwError: bad, samples };
  console.log(name, JSON.stringify(out[name]));
}
await browser.close(); server.close();
