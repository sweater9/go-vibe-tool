#!/usr/bin/env node
/* Verify deployed Cloudflare static assets against the exact built dist/ bytes.
 * Report both physical .html URLs and Cloudflare clean URLs on failure.
 * Never omit files or accept a different payload merely because a route returns 200.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const base = (process.argv[2] || '').replace(/\/?$/, '/');
const dist = path.resolve(process.argv[3] || 'dist');
if (!/^https?:\/\//.test(base)) {
  console.error('usage: verify-live-assets.mjs <base-url> [dist]');
  process.exit(2);
}
const list = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? list(path.join(d, e.name)) : [path.relative(dist, path.join(d, e.name)).split(path.sep).join('/')]);
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const cleanUrl = f => f === 'index.html' ? '' :
  f.endsWith('/index.html') ? f.slice(0, -'index.html'.length) :
  f.endsWith('.html') ? f.slice(0, -'.html'.length) : f;
const files = list(dist).filter(f => f !== '.assetsignore');
const failures = [];
let ok = 0;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function probe(url, expected) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(20000)
    });
    if (res.status !== 200) return { status: res.status, location: res.url };
    const bytes = Buffer.from(await res.arrayBuffer());
    const got = sha(bytes);
    return { status: 200, match: got === expected, hash: got.slice(0, 12), location: res.url };
  } catch (err) {
    return { error: err.message };
  }
}
const describe = r => r.error || (r.status !== 200 ? `HTTP ${r.status}` :
  r.match ? 'byte-identical' : `bytes differ (SHA256 ${r.hash})`);

async function check(file) {
  const expected = sha(fs.readFileSync(path.join(dist, file)));
  const canonical = base + cleanUrl(file);
  const exact = base + file;
  let last;
  // Cloudflare edge propagation can lag behind Wrangler's successful upload.
  // Retry the entire file, but do not turn missing assets into a passing result.
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt) await wait([0, 2000, 4000, 8000, 12000][attempt]);
    last = await probe(canonical, expected);
    if (last.status === 200 && last.match) { ok++; return; }
  }
  const exactResult = exact === canonical ? last : await probe(exact, expected);
  failures.push({
    file, canonical: describe(last), exact: describe(exactResult),
    canonicalUrl: canonical, exactUrl: exact
  });
}

const queue = [...files];
await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length) await check(queue.shift());
}));
console.log(`${ok}/${files.length} files served byte-identical from ${base}`);
for (const f of failures) {
  console.error(`${f.file}: canonical ${f.canonical}; exact ${f.exact}`);
  console.error(`  canonical URL: ${f.canonicalUrl}`);
  if (f.exactUrl !== f.canonicalUrl) console.error(`  exact URL: ${f.exactUrl}`);
}
for (const p of ['multiplayer/server.mjs', 'package.json', 'CNAME', 'tests/dist-browser.mjs']) {
  const r = await fetch(base + p, { redirect: 'manual' });
  if (r.status === 200) failures.push({ file: p, security: true });
}
if (failures.length) {
  console.error(`Live verification FAILED: ${failures.length} files missing/mismatched or forbidden files exposed.`);
  process.exit(1);
}
console.log('Live assets verified.');
