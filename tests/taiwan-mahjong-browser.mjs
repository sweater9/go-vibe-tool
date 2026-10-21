/* Taiwanese Mahjong browser QA: node tests/taiwan-mahjong-browser.mjs [chromium|firefox|webkit]
   env: SITE_ROOT (default "dist", run `npm run build` first), PLAYWRIGHT_PACKAGE, BROWSER_EXECUTABLE.
   Serves the built site with Cloudflare-style routing (including _redirects), blocks third-party http(s) and records
   any request that leaves the origin. "Offline" means the origin server is stopped, not an emulator switch. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDistServer } from '../scripts/serve-dist.mjs';
const pwm = await import(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const pw = pwm.chromium ? pwm : pwm.default;
const engine = process.argv[2] || 'chromium';
const repo = fileURLToPath(new URL('../', import.meta.url));
const root = path.resolve(repo, process.env.SITE_ROOT || 'dist');
const out = path.join(repo, 'artifacts', 'taiwan-mahjong-' + engine);
fs.mkdirSync(out, { recursive: true });
let server = createDistServer(root);
const port = await server.start();
const origin = `http://127.0.0.1:${port}`;
const URL_PATH = '/play/taiwan-mahjong/';
const browser = await pw[engine].launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}), ...(engine === 'chromium' ? { args: ['--no-sandbox'] } : {}) });
const checks = [];
async function check(label, fn) {
  const t0 = Date.now();
  try { await fn(); checks.push({ label, ok: true, ms: Date.now() - t0 }); console.log('PASS', label); }
  catch (e) { checks.push({ label, ok: false, ms: Date.now() - t0, error: String(e.message).slice(0, 1500) }); console.error('FAIL', label, '\n    ', String(e.message).split('\n').slice(0, 6).join('\n     ')); }
}
async function open(width, height = 800) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: width < 600 && engine !== 'firefox' }); // Playwright's Firefox cannot emulate touch
  const page = await ctx.newPage(); page.setDefaultTimeout(20000);
  const errs = [], external = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  page.on('request', (r) => { try { const u = new URL(r.url()); if (/^https?:$/.test(u.protocol) && u.origin !== origin) external.push(u.href); } catch { /* ignore */ } });
  await ctx.route((u) => /^https?:/.test(u.protocol) && u.origin !== origin, (r) => r.abort());
  return { ctx, page, errs, external };
}
const fits = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const cacheName = fs.readFileSync(path.join(root, 'sw.js'), 'utf8').match(/const CACHE="([^"]+)"/)[1];
const GAME_FILES = ['index.html', 'style.css', 'engine.js', 'game.js'];

/* One real-click action toward finishing the match. Returns 'final' when the match-over dialog is open. */
async function step(page) {
  if (await page.locator('#finalDlg[open]').count()) return 'final';
  if (await page.locator('#resultDlg[open]').count()) { await page.click('#btnNext'); return 'next'; }
  const kind = await page.evaluate(() => (window.__twmj.awaiting ? window.__twmj.awaiting.kind : null));
  if (kind === 'self') {
    const hu = page.locator('#actions .act.hu');
    if (await hu.count()) { await hu.first().click(); return 'hu'; }
    const tiles = page.locator('#hand .tile');
    const n = await tiles.count(); if (!n) return 'wait';
    const t = tiles.nth(n - 1);
    await t.click(); await t.click(); // select, then tap again to discard
    return 'discard';
  }
  if (kind === 'claim') {
    const hu = page.locator('#actions .act.hu');
    if (await hu.count()) { await hu.first().click(); return 'hu'; }
    const pass = page.locator('#actions .act.pass'); if (await pass.count()) { await pass.first().click(); return 'pass'; }
  }
  await page.waitForTimeout(30);
  return 'wait';
}

try {
  await check('redirect: old Solitaire URL answers HTTP 301 to the Taiwanese Mahjong page', async () => {
    for (const p of ['/play/mahjong-solitaire/', '/play/mahjong-solitaire', '/play/mahjong-solitaire/index.html']) {
      const r = await fetch(origin + p, { redirect: 'manual' });
      assert.equal(r.status, 301, p + ' status');
      assert.equal(r.headers.get('location'), URL_PATH, p + ' location');
    }
    const r = await fetch(origin + URL_PATH); assert.equal(r.status, 200);
  });

  for (const [name, width, height] of [['desktop', 1280, 900], ['mobile', 390, 844]]) {
    const A = await open(width, height);
    const { page } = A;
    await page.goto(origin + URL_PATH);
    await check(`${name}: page loads inside the site chrome, no page errors, no horizontal page scroll`, async () => {
      assert.match(await page.title(), /Taiwanese Mahjong/);
      assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'), 'https://govibetool.com' + URL_PATH);
      assert.ok(await page.locator('header nav .navlinks a[aria-current=page]').count(), 'site header Play link');
      assert.ok(await page.locator('footer a[href$="privacy.html"]').count(), 'site footer');
      assert.equal(await page.locator('h1').count(), 1, 'exactly one h1');
      assert.ok(await fits(page), 'document wider than viewport');
      assert.deepEqual(A.errs, []);
    });
    await check(`${name}: game styles do not leak into or out of the site (scoped under .twmj)`, async () => {
      const r = await page.evaluate(() => {
        const q = (s) => getComputedStyle(document.querySelector(s));
        return { band: q('.twmj').backgroundColor, start: q('#btnStart').backgroundImage, siteBtn: !!document.querySelector('.twmj .btn'), wrapW: document.querySelector('main.wrap').getBoundingClientRect().width, navH: document.querySelector('header nav').getBoundingClientRect().height };
      });
      assert.notEqual(r.band, 'rgba(0, 0, 0, 0)', 'game band must be styled');
      assert.match(r.start, /gradient/, 'start button styled by game css');
      assert.equal(r.siteBtn, false, 'no unscoped .btn class inside the game');
      assert.ok(r.navH > 40 && r.navH < 120, 'site nav height intact: ' + r.navH);
    });
    await check(`${name}: ${name === 'desktop' ? 'a full 1-round match plays through to the final standings' : 'two hands play through'} with real clicks; points are conserved`, async () => {
      await page.click('.seg[data-setting="speed"] button[data-v="0.45"]');
      await page.click('#btnStart');
      await page.waitForSelector('#game:not([hidden])');
      assert.ok(await fits(page), 'table wider than viewport');
      const t0 = Date.now(); let state = '', hands = 0;
      while (state !== 'final' && !(name === 'mobile' && hands >= 2)) { state = await step(page); if (state === 'next') hands++; if (Date.now() - t0 > 420000) throw new Error('did not finish in 420 s'); }
      const chips = await page.evaluate(() => window.__twmj.match.players.map((p) => p.chips));
      assert.equal(chips.reduce((a, b) => a + b, 0), 4000, 'points must be conserved: ' + chips);
      if (state === 'final') assert.equal(await page.locator('#finList li').count(), 4);
      assert.ok(await fits(page));
      assert.deepEqual(A.errs, []);
    });
    await check(`${name}: record persists across reload and the Tai table dialog opens`, async () => {
      await page.reload();
      assert.ok(await page.locator('#statsCard:not([hidden])').count(), 'saved record visible after reload');
      await page.click('#btnStart'); await page.waitForSelector('#game:not([hidden])');
      await page.click('#btnTai'); await page.waitForSelector('#taiDlg[open]');
      assert.ok(await page.locator('#taiBody').innerText().then((t) => t.length > 50));
      await page.keyboard.press('Escape');
    });
    await check(`${name}: privacy, no third-party request and no errors`, async () => { assert.deepEqual(A.external, []); assert.deepEqual(A.errs, []); });
    await page.screenshot({ path: path.join(out, name + '.png') });
    await A.ctx.close();
  }

  await check('service-worker: direct visit installs the site worker, drops older caches and precaches the four game files', async () => {
    const S = await open(375);
    const { page } = S;
    await page.goto(origin + URL_PATH);
    await page.evaluate(async () => { const c = await caches.open('govibetool-v8-7'); await c.put(location.origin + '/legacy-test.txt', new Response('old')); const s = await caches.open('govibetool-v8-10'); await s.put(location.origin + '/play/mahjong-solitaire/solitaire.js', new Response('stale')); });
    await Promise.race([page.evaluate(async () => { await navigator.serviceWorker.ready; }), new Promise((_, r) => setTimeout(() => r(new Error('service worker never became ready')), 30000))]);
    await page.waitForFunction(async (n) => (await (await caches.open(n)).keys()).length > 300, cacheName, { timeout: 90000 });
    await page.waitForFunction(async (n) => { const k = await caches.keys(); return k.includes(n) && !k.includes('govibetool-v8-7') && !k.includes('govibetool-v8-10'); }, cacheName, { timeout: 30000 });
    const cached = await page.evaluate(async (n) => (await (await caches.open(n)).keys()).map((r) => new URL(r.url).pathname), cacheName);
    for (const f of GAME_FILES) assert.ok(cached.includes(URL_PATH + f) || (f === 'index.html' && cached.includes(URL_PATH)), 'not precached: ' + f);
    assert.ok(!cached.some((p) => p.includes('mahjong-solitaire')), 'stale Solitaire assets still cached');
    assert.deepEqual(S.errs, []);
    await S.ctx.close();
  });

  await check('offline: with the origin server stopped, the installed game reloads from the service worker and deals a hand', async () => {
    const O = await open(390, 844);
    const { page } = O;
    await page.goto(origin + URL_PATH);
    await Promise.race([page.evaluate(async () => { await navigator.serviceWorker.ready; }), new Promise((_, r) => setTimeout(() => r(new Error('service worker never became ready')), 30000))]);
    await page.waitForFunction(async (n) => (await (await caches.open(n)).keys()).length > 300, cacheName, { timeout: 90000 });
    await page.reload();
    assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'page must be controlled by the worker before going offline');
    await server.stop();
    try {
      await page.goto(origin + URL_PATH);
      await page.click('#btnStart'); await page.waitForSelector('#game:not([hidden])');
      await page.waitForFunction(() => document.querySelectorAll('#hand .tile').length >= 16);
      assert.ok(await fits(page));
      assert.deepEqual(O.errs, []);
    } finally {
      server = createDistServer(root, { port });
      await server.start();
    }
    await O.ctx.close();
  });
} finally {
  const failed = checks.filter((c) => !c.ok);
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ engine, browser: browser.version(), passed: checks.length - failed.length, failed: failed.length, checks }, null, 2));
  console.log(`RESULT ${JSON.stringify({ engine, browser: browser.version(), passed: checks.length - failed.length, failed: failed.length })}`);
  await browser.close(); await server.stop();
  if (failed.length) process.exitCode = 1;
}
