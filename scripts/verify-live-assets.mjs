#!/usr/bin/env node
/* Proves a deployed site serves exactly the built dist/ bytes.
   node scripts/verify-live-assets.mjs <base-url> [dist-dir]   Fetches every dist file (clean-URL aware) and compares SHA-256. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const base = (process.argv[2] || '').replace(/\/?$/, '/'); const dist = path.resolve(process.argv[3] || 'dist');
if (!/^https?:\/\//.test(base)) { console.error('usage: verify-live-assets.mjs <base-url> [dist]'); process.exit(2); }
const list = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? list(path.join(d, e.name)) : [path.relative(dist, path.join(d, e.name)).split(path.sep).join('/')]);
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const urlFor = f => f === 'index.html' ? '' : f.endsWith('/index.html') ? f.slice(0, -'index.html'.length) : f.endsWith('.html') ? f.slice(0, -'.html'.length) : f;
const files = list(dist).filter(f => f !== '.assetsignore'); const bad = []; let ok = 0;
async function check(f) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { const res = await fetch(base + urlFor(f), { redirect: 'follow', headers: { 'Cache-Control': 'no-cache' } }); if (res.status !== 200) { if (attempt === 3) bad.push(`${f}: HTTP ${res.status}`); continue; } const live = sha(Buffer.from(await res.arrayBuffer())), want = sha(fs.readFileSync(path.join(dist, f))); if (live !== want) { if (attempt === 3) bad.push(`${f}: bytes differ (live ${live.slice(0, 12)} vs dist ${want.slice(0, 12)})`); continue; } ok++; return; } catch (e) { if (attempt === 3) bad.push(`${f}: ${e.message}`); }
    await new Promise(r => setTimeout(r, 1500 * attempt));
  }
}
const queue = files.slice(); await Promise.all(Array.from({ length: 8 }, async () => { while (queue.length) await check(queue.shift()); }));
console.log(`${ok}/${files.length} files served byte-identical from ${base}`);
for (const p of ['multiplayer/server.mjs', 'package.json', 'CNAME', 'tests/dist-browser.mjs']) { const r = await fetch(base + p, { redirect: 'manual' }); if (r.status === 200) bad.push(`${p} must not be served (HTTP 200)`); }
if (bad.length) { console.error(bad.slice(0, 20).join('\n')); process.exit(1); } console.log('Live assets verified.');
