/* Read-only: is the live preview serving the expected commit?
   1. Render deployment metadata (only if RENDER_API_KEY + RENDER_SERVICE_ID are provided).
   2. Byte-for-byte comparison of live static files against the same files at the expected commit (checked out in cwd).
   Exit codes: 0 verified/unverified-but-reachable (see report), 3 NETWORK failure, 4 content MISMATCH, 5 metadata MISMATCH.
   Usage: node tests/live-deploy-verify.mjs <url> <expectedSha> [reportPath] */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const [url0, expected, reportPath = 'artifacts/live-qa/deploy-verify.json'] = process.argv.slice(2);
if (!url0 || !expected) { console.error('usage: live-deploy-verify.mjs <url> <expectedSha> [report]'); process.exit(2); }
const base = url0.replace(/\/?$/, '/');
const report = { url: base, expected, startedAt: new Date().toISOString(), metadata: { status: 'unavailable', detail: 'RENDER_API_KEY / RENDER_SERVICE_ID not provided' }, content: [], network: null };
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
export function classify(e) {
  const code = e?.cause?.code || e?.code || '';
  const msg = String(e?.cause?.message || e?.message || e);
  return `${code || 'ERROR'}: ${msg}`;
}
async function get(u, tries = 6) { // Render free instances cold-start; retry before declaring a network failure.
  let last;
  for (let i = 1; i <= tries; i++) {
    try { const r = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(45000), headers: { 'cache-control': 'no-cache' } }); return r; }
    catch (e) { last = e; console.log(`attempt ${i}/${tries} ${u}: ${classify(e)}`); await new Promise(r => setTimeout(r, 8000)); }
  }
  throw last;
}
async function finish(code) { await fs.mkdir(reportPath.replace(/\/[^/]*$/, ''), { recursive: true }); await fs.writeFile(reportPath, JSON.stringify(report, null, 1)); console.log(JSON.stringify(report, null, 1)); process.exit(code); }
try {
  const r = await get(base);
  report.reachable = { status: r.status, server: r.headers.get('server'), renderOrigin: r.headers.get('x-render-origin-server'), cfRay: r.headers.get('cf-ray') };
  if (r.status >= 500 || r.status === 403 || r.status === 401) { report.network = `HTTP ${r.status} from ${base}`; await finish(3); }
} catch (e) { report.network = classify(e); await finish(3); }
// 1. Render API metadata (read-only GET)
if (process.env.RENDER_API_KEY && process.env.RENDER_SERVICE_ID) {
  try {
    const r = await fetch(`https://api.render.com/v1/services/${process.env.RENDER_SERVICE_ID}/deploys?limit=5`, { headers: { Authorization: 'Bearer ' + process.env.RENDER_API_KEY, Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
    if (!r.ok) report.metadata = { status: 'error', detail: `Render API HTTP ${r.status}` };
    else {
      const deploys = (await r.json()).map(x => x.deploy || x);
      const live = deploys.find(d => d.status === 'live') || deploys[0];
      report.metadata = { status: live?.commit?.id === expected ? 'match' : 'MISMATCH', liveCommit: live?.commit?.id, deployStatus: live?.status, finishedAt: live?.finishedAt, recent: deploys.map(d => ({ commit: d.commit?.id?.slice(0, 10), status: d.status })) };
    }
  } catch (e) { report.metadata = { status: 'error', detail: classify(e) }; }
}
// 2. Content comparison against the expected commit
const files = ['index.html', 'v8-discovery.js', 'v8.css', 'v2-tools.js', 'tools.js', 'sw.js', 'assets/icon.svg'];
for (const f of files) {
  let want; try { want = execFileSync('git', ['show', `${expected}:${f}`], { maxBuffer: 1 << 26 }); } catch { report.content.push({ file: f, status: 'not-in-expected-commit' }); continue; }
  try {
    const r = await get(base + f); const got = Buffer.from(await r.arrayBuffer());
    report.content.push({ file: f, http: r.status, status: r.ok && sha(got) === sha(want) ? 'identical' : 'DIFFERENT', live: sha(got).slice(0, 12), expected: sha(want).slice(0, 12) });
  } catch (e) { report.network = classify(e); report.content.push({ file: f, status: 'network-error', detail: classify(e) }); }
}
const bad = report.content.filter(c => c.status === 'DIFFERENT');
if (report.network) await finish(3);
if (report.metadata.status === 'MISMATCH') await finish(5);
await finish(bad.length ? 4 : 0);
