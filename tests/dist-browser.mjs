/* Browser tests for the clean static output (dist/) served with Cloudflare-style routing.
   node tests/dist-browser.mjs [chromium|firefox|webkit]   env: PLAYWRIGHT_PACKAGE, DIST_BASE_URL (test a deployed preview)
   Rebuilds dist/ first so the test always checks the real build output. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createDistServer } from '../scripts/serve-dist.mjs';
import { verifyDist } from '../scripts/verify-dist.mjs';
const pw = await import(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const engine = process.argv[2] || 'chromium';
const repo = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(repo, 'dist');
execFileSync(process.execPath, [path.join(repo, 'scripts/build-static.mjs')], { stdio: 'pipe' });
// DIST_BASE_URL=https://... tests an already-deployed preview instead of the local server (offline-with-server-stopped is then skipped).
const liveUrl = process.env.DIST_BASE_URL ? process.env.DIST_BASE_URL.replace(/\/?$/, '/') : '';
const srv = createDistServer(dist); if (!liveUrl) await srv.start(); const base = liveUrl || srv.base;
const browser = await pw[engine].launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
let passed = 0; const failures = [];
async function check(name, fn) { try { await fn(); passed++; console.log('PASS', name); } catch (e) { const full = String(e.message).slice(0, 1500); failures.push(`${name}: ${e.message.split('\n')[0]}`); console.log('FAIL', name, '-', full); } }
async function open({ w = 1280, h = 900, touch = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch }); const page = await ctx.newPage(); page.setDefaultTimeout(15000);
  const errs = [], bad = [], external = []; const origin = new URL(base).origin;
  page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/pagead|googlesyndication|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  page.on('response', r => { const u = new URL(r.url()); if (u.origin === origin && r.status() >= 400 && r.request().resourceType() !== 'document') bad.push(`${r.status()} ${u.pathname}`); });
  // The site ships its real AdSense tag untouched. Tests never talk to ad networks. Third-party requests are RECORDED from the page's own
  // request events (fired by every engine; WebKit does not reliably expose all cross-origin requests to context routing), and
  // anything that is not an ad host fails the test. Routing is used only to keep ad and third-party traffic off the network.
  const AD_HOST = /(googlesyndication|doubleclick|googleadservices|adtrafficquality|adsbygoogle|(^|\.)google\.com$|^csi\.gstatic\.com$)/; // csi.gstatic.com is the AdSense timing beacon
  const isAd = u => AD_HOST.test(u.hostname) || /pagead/i.test(u.href);
  page.on('request', r => { let u; try { u = new URL(r.url()); } catch { return; } if (/^https?:$/.test(u.protocol) && u.origin !== origin && !isAd(u) && !external.includes(u.href)) external.push(u.href); });
  await ctx.route('**/*', route => { const u = new URL(route.request().url()); if (u.origin === origin) return route.continue(); return route.abort(); });
  return { ctx, page, errs, bad, external };
}
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const tools = fs.readdirSync(path.join(dist, 'tools')).filter(f => f.endsWith('.html')).map(f => '/tools/' + f.replace(/\.html$/, ''));
const knowledgePages = fs.readdirSync(path.join(dist, 'knowledge')).filter(f => f.endsWith('.html') && f !== 'index.html').slice(0, 3).map(f => '/knowledge/' + f.replace(/\.html$/, ''));
const PAGES = ['/', '/labs/', '/labs/workflow/', '/labs/api-playground/', '/labs/ai/', '/labs/cyber/', '/labs/science/', '/labs/finance/', '/play/', '/play/2048/', '/play/daily-word/', '/play/word-logic/', '/play/daily/', '/play/mahjong/', '/knowledge/', ...knowledgePages, '/learn/', ...tools, '/privacy', '/terms', '/contact'];

try {
  await check('static verification: size limits, forbidden paths, references, service-worker precache, sitemap', async () => { const r = verifyDist(dist, { root: repo }); assert.deepEqual(r.errors, []); assert.ok(r.largest.bytes < 25 * 1024 * 1024); assert.ok(r.files < 20000); });
  await check('output contains no node_modules, tests, docs, screenshots, Mahjong server or markdown', async () => {
    const all = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : all.push(path.relative(dist, p)); } })(dist);
    for (const f of all) { assert.ok(!/(^|\/)(node_modules|tests|docs|qa|multiplayer|artifacts|\.git)(\/|$)/.test(f), f); assert.ok(!/\.(md|py)$/.test(f), f); assert.ok(!/\.(png|jpe?g|webp)$/.test(f) || f.startsWith('assets/'), 'unexpected image ' + f); }
    assert.ok(!fs.existsSync(path.join(dist, 'CNAME')) && !fs.existsSync(path.join(dist, 'package.json')));
  });
  await check('routing: clean URLs, trailing slashes and the 404 page behave like Cloudflare assets', async () => {
    const get = async (p, o = {}) => fetch(base.slice(0, -1) + p, { redirect: 'manual', ...o });
    assert.equal((await get('/')).status, 200); assert.equal((await get('/play')).status, 307); assert.equal((await get('/play')).headers.get('location'), '/play/'); assert.equal((await get('/privacy.html')).status, 307); assert.equal((await get('/privacy')).status, 200);
    const nf = await get('/definitely-missing'); assert.equal(nf.status, 404); assert.match(await nf.text(), /couldn.t find that page/i);
    for (const f of ['/robots.txt', '/ads.txt', '/sitemap.xml', '/manifest.webmanifest', '/sw.js']) assert.equal((await get(f)).status, 200, f);
    assert.match(await (await get('/ads.txt')).text(), /pub-6129942955275199/); assert.equal((await get('/multiplayer/server.mjs')).status, 404); assert.equal((await get('/tests/labs-browser.mjs')).status, 404);
  });
  for (const [label, w, h, touch] of [['desktop', 1280, 900, false], ['mobile', 390, 844, true]]) {
    await check(`${label}: homepage, six Labs, Play games, Mahjong frontend, Knowledge, Learn, every tool page load cleanly`, async () => {
      const c = await open({ w, h, touch }); const problems = [];
      for (const p of PAGES) {
        c.errs.length = 0; c.bad.length = 0; const resp = await c.page.goto(base.slice(0, -1) + p, { waitUntil: 'networkidle' });
        if (!resp || resp.status() !== 200) problems.push(`${p}: status ${resp && resp.status()}`);
        const o = await overflow(c.page); if (o > 0) problems.push(`${p}: horizontal overflow ${o}px`);
        if (c.errs.length) problems.push(`${p}: ${c.errs[0]}`); if (c.bad.length) problems.push(`${p}: failed request ${c.bad[0]}`);
        if (!(await c.page.locator('h1').count())) problems.push(`${p}: no h1`);
      }
      assert.deepEqual(problems, []); assert.deepEqual(c.external, []); await c.ctx.close();
    });
  }
  await check('test harness: ad hosts are aborted silently, any other third-party host is reported', async () => {
    const c = await open(); await c.page.goto(base, { waitUntil: 'networkidle' });
    // Subresource loads always pass through request routing in every engine (a cross-origin fetch() may be stopped by the browser first).
    const load = urls => c.page.evaluate(urls => Promise.allSettled(urls.map(u => new Promise((res, rej) => { const i = new Image(); i.onload = res; i.onerror = rej; i.src = u; }))), urls);
    await load(['https://tpc.googlesyndication.com/pixel.gif', 'https://googleads.g.doubleclick.net/pixel.gif', 'https://www.google.com/pixel.gif']);
    await new Promise(r => setTimeout(r, 1500)); assert.deepEqual(c.external, [], 'ad hosts must not be reported');
    await load(['https://example.org/tracker.gif']);
    for (let i = 0; i < 50 && !c.external.length; i++) await new Promise(r => setTimeout(r, 100)); // the route handler runs in this process, so poll instead of assuming ordering
    assert.deepEqual(c.external, ['https://example.org/tracker.gif']); await c.ctx.close();
  });
  await check('Mahjong frontend loads without a backend: no API configured, no network calls to any service', async () => {
    const c = await open(); await c.page.goto(base + 'play/mahjong/', { waitUntil: 'networkidle' });
    // On a production hostname config.js must leave the API empty (localhost/127.0.0.1 is dev mode and points at a local server).
    const cfg = fs.readFileSync(path.join(dist, 'play/mahjong/config.js'), 'utf8');
    for (const host of ['go-vibe-tool.workers.dev', 'govibetool.com', 'preview.example.com']) { const win = {}; new Function('window', 'location', cfg)(win, { hostname: host }); assert.equal(win.MAHJONG_API, '', host); }
    const dev = {}; new Function('window', 'location', cfg)(dev, { hostname: 'localhost' }); assert.equal(dev.MAHJONG_API, 'http://localhost:8787');
    assert.ok(await c.page.locator('#instructions').count()); assert.deepEqual(c.errs, []); assert.deepEqual(c.external, []); await c.ctx.close();
  });
  await check('labs from dist: a lab responds to input (hub links, tabs, slider readout)', async () => {
    const c = await open(); await c.page.goto(base + 'labs/', { waitUntil: 'networkidle' });
    assert.deepEqual(await c.page.locator('.v5-card a.btn').evaluateAll(a => a.map(x => new URL(x.href).pathname)), ['/labs/workflow/', '/labs/api-playground/', '/labs/ai/', '/labs/cyber/', '/labs/science/', '/labs/finance/']);
    await c.page.goto(base + 'labs/science/#projectile', { waitUntil: 'networkidle' }); await c.page.waitForSelector('.lk-tab[aria-selected="true"]');
    const before = await c.page.locator('#panel-projectile .lk-stat strong').first().innerText(); await c.page.locator('#pj-v').evaluate(e => { e.value = 55; e.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.notEqual(await c.page.locator('#panel-projectile .lk-stat strong').first().innerText(), before); assert.deepEqual(c.errs, []); await c.ctx.close();
  });
  await check('service worker from dist precaches every listed asset and stays under the site scope', async () => {
    const c = await open({ w: 390, h: 844, touch: true }); await c.page.goto(base + 'labs/cyber/', { waitUntil: 'networkidle' });
    await c.page.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise(r => { navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }); setTimeout(r, 8000); }); });
    const listed = [...fs.readFileSync(path.join(dist, 'sw.js'), 'utf8').matchAll(/"(\.\/[^"]*)"/g)].map(m => m[1].slice(2)).filter(Boolean).map(p => '/' + p);
    await c.page.waitForFunction(async need => { for (const n of await caches.keys()) { const k = new Set((await (await caches.open(n)).keys()).map(r => new URL(r.url).pathname)); if (need.every(x => k.has(x))) return true; } return false; }, listed, { timeout: 30000 });
    assert.ok(listed.length >= 50); assert.equal(await c.page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).scope), base); await c.ctx.close();
  });
  if (!liveUrl) await check('offline from dist: installed site loads homepage, Labs, Play games and Mahjong frontend with the server stopped', async () => {
    const c = await open({ w: 390, h: 844, touch: true }); await c.page.goto(base + 'labs/cyber/', { waitUntil: 'networkidle' });
    await c.page.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise(r => { navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }); setTimeout(r, 8000); }); });
    const need = ['/index.html', '/labs/index.html', '/labs/ai/index.html', '/labs/workflow/workflow-engine.js', '/play/2048/index.html', '/play/mahjong/index.html', '/play/mahjong/mahjong.mjs'];
    await c.page.waitForFunction(async n => { for (const k of await caches.keys()) { const s = new Set((await (await caches.open(k)).keys()).map(r => new URL(r.url).pathname)); if (n.every(x => s.has(x))) return true; } return false; }, need, { timeout: 30000 });
    await srv.stop();
    try {
      await c.page.goto(base, { waitUntil: 'domcontentloaded' }); assert.ok(await c.page.locator('h1').count());
      await c.page.goto(base + 'labs/', { waitUntil: 'domcontentloaded' }); assert.equal(await c.page.locator('.v5-card').count(), 6);
      for (const [p, panel] of [['labs/ai/', '#panel-classifier'], ['labs/cyber/', '#panel-hashing'], ['labs/science/', '#panel-projectile'], ['labs/finance/', '#panel-compounding']]) { await c.page.goto(base + p, { waitUntil: 'domcontentloaded' }); await c.page.waitForSelector(panel); await c.page.locator(`${panel} .lk-btn`).first().click(); }
      await c.page.goto(base + 'labs/workflow/', { waitUntil: 'domcontentloaded' }); await c.page.selectOption('#sampleSelect', 'loopCounter'); await c.page.click('#btnRunAllSim'); assert.match(await c.page.locator('#simContextContainer').innerText(), /"total": 10/);
      await c.page.goto(base + 'play/2048/', { waitUntil: 'domcontentloaded' }); await c.page.waitForSelector('.g2048-tile'); await c.page.keyboard.press('ArrowLeft');
      await c.page.goto(base + 'play/mahjong/', { waitUntil: 'domcontentloaded' }); assert.ok(await c.page.locator('#instructions').count());
    } finally { await srv.start(); }
    await c.ctx.close();
  });
} finally { await browser.close(); await srv.stop().catch(() => {}); }
console.log(`${engine} (dist${liveUrl ? ', live ' + liveUrl : ''}): ${passed} passed, ${failures.length} failed`);
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
