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
  if (process.env.CHECK_FILTER && !new RegExp(process.env.CHECK_FILTER).test(label)) return; // local debugging aid
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
    await check(`${name}: plain 1-9 digits show on suit tiles by default, can be switched off in the Menu, persist, and never change the layout`, async () => {
      await page.reload(); await page.click('#btnStart'); await page.waitForSelector('#game:not([hidden])');
      await page.waitForFunction(() => document.querySelectorAll('#hand .tile').length >= 16);
      await page.waitForTimeout(1500); // let the start-of-match scroll settle
      const stats = () => page.evaluate(() => {
        const g0 = document.querySelector('#game').getBoundingClientRect(), R = (x) => { const q = x.getBoundingClientRect(); return [q.left - g0.left, q.top - g0.top, q.width, q.height].map((v) => Math.round(v * 10) / 10).join(','); };
        const dgs = [...document.querySelectorAll('#hand .tile .dg')], vis = dgs.filter((e) => e.getBoundingClientRect().width > 0);
        const digits = vis.map((e) => e.textContent.trim());
        return { root: document.querySelector('.twmj').classList.contains('shownum'), suit: dgs.length, visible: vis.length, ok: digits.every((d) => /^[1-9]$/.test(d)), minFont: vis.length ? Math.min(...vis.map((e) => parseFloat(getComputedStyle(e).fontSize))) : 0, layout: [...document.querySelectorAll('#game, #stage, #hand, .tile')].map(R).join('|'), saved: JSON.parse(localStorage.getItem('gvt.twmj.settings') || '{}').numbers };
      });
      const on = await stats();
      assert.equal(on.root, true, 'digits are on by default');
      assert.ok(on.suit > 0 && on.visible === on.suit && on.ok, 'every suit tile in the hand shows a 1-9 digit: ' + JSON.stringify(on));
      assert.ok(on.minFont >= 9, 'hand digits are legible: ' + on.minFont + 'px');
      await page.click('#btnMenu'); await page.waitForSelector('#menuDlg[open]');
      assert.equal(await page.locator('#optNum2').isChecked(), true);
      await page.locator('#optNum2').uncheck(); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      const off = await stats();
      assert.equal(off.root, false); assert.equal(off.visible, 0, 'no digits when switched off'); assert.equal(off.saved, false);
      assert.equal(off.layout, on.layout, 'tile and table layout must not change with digits on or off');
      await page.reload(); assert.equal(await page.locator('#optNum').isChecked(), false, 'setting persists across reload');
      assert.equal(await page.evaluate(() => document.querySelector('.twmj').classList.contains('shownum')), false);
      await page.locator('#optNum').check(); // restore the default for later checks
      assert.equal(await page.evaluate(() => document.querySelector('.twmj').classList.contains('shownum')), true);
      assert.ok(await fits(page)); assert.deepEqual(A.errs, []);
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

  for (const [w, h] of [[844, 390], [667, 375], [932, 430], [640, 360]]) {
    await check(`landscape phone ${w}x${h}: whole table and hand fit one screen, tiles are tappable, dialogs reachable, no overflow`, async () => {
      const L = await open(w, h);
      const { page } = L;
      await page.goto(origin + URL_PATH);
      await page.click('#btnStart'); await page.waitForSelector('#game:not([hidden])');
      await page.waitForFunction(() => window.__twmj.awaiting && window.__twmj.awaiting.kind === 'self', null, { timeout: 30000 });
      await page.evaluate(() => document.querySelector('.hud').scrollIntoView({ block: 'start', behavior: 'instant' }));
      await page.waitForFunction(() => Math.abs(document.querySelector('.hud').getBoundingClientRect().top) < 3); // the site css smooth-scrolls
      const m = await page.evaluate(() => {
        const r = (s) => document.querySelector(s).getBoundingClientRect();
        const tiles = [...document.querySelectorAll('#hand .tile')];
        let tappable = 0;
        tiles.forEach((t) => { const b = t.getBoundingClientRect(); const e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); if (e && t.contains(e) && b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth) tappable++; });
        return { n: tiles.length, tappable, minW: Math.min(...tiles.map((t) => t.getBoundingClientRect().width)), rows: new Set(tiles.map((t) => Math.round(t.getBoundingClientRect().top))).size, stageB: r('#stage').bottom, youB: r('#you').bottom, hudT: r('.hud').top, vh: innerHeight, ovX: document.documentElement.scrollWidth - document.documentElement.clientWidth, headerPos: getComputedStyle(document.querySelector('body > header')).position };
      });
      assert.ok(m.n >= 16, 'hand rendered');
      assert.equal(m.tappable, m.n, 'every hand tile is visible and not covered: ' + JSON.stringify(m));
      assert.ok(m.minW >= 31.5, 'hand tiles at least 32px wide: ' + m.minW);
      assert.ok(m.rows <= 2, 'hand wraps to at most two rows: ' + m.rows);
      assert.ok(m.stageB <= m.vh && m.youB <= m.vh && m.hudT >= -1, 'table and hand inside one screen: ' + JSON.stringify(m));
      assert.ok(m.ovX <= 1, 'horizontal overflow ' + m.ovX);
      assert.notEqual(m.headerPos, 'sticky', 'site header must not eat the short screen');
      for (const [btn, dlg] of [['#btnTai', '#taiDlg'], ['#btnHelp', '#helpDlg'], ['#btnMenu', '#menuDlg']]) {
        await page.evaluate((b) => document.querySelector(b).scrollIntoView({ block: 'center', behavior: 'instant' }), btn);
        await page.waitForTimeout(150);
        await page.click(btn); await page.waitForSelector(dlg + '[open]');
        const d = await page.evaluate((id) => { const x = document.querySelector(id), r = x.getBoundingClientRect(), c = x.querySelector('button[value=close], #btnQuit').getBoundingClientRect(); return { fits: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, close: c.top >= 0 && c.bottom <= innerHeight }; }, dlg);
        assert.ok(d.fits && d.close, dlg + ' reachable: ' + JSON.stringify(d));
        await page.keyboard.press('Escape');
        await page.evaluate((id) => { const x = document.querySelector(id); if (x.open) x.close(); }, dlg);
      }
      assert.deepEqual(L.errs, []); assert.deepEqual(L.external, []);
      await L.ctx.close();
    });
  }

  await check('multiple winners on one discard: on by default, switch-off is remembered, menu toggle applies in a running match', async () => {
    const M = await open(1280, 900);
    const { page } = M;
    await page.goto(origin + URL_PATH);
    assert.equal(await page.locator('#optMulti').isChecked(), true, 'default on for a first-time visitor');
    await page.click('#btnStart'); await page.waitForSelector('#game:not([hidden])');
    assert.equal(await page.evaluate(() => window.__twmj.match.cfg.multiWin), true, 'match starts with the rule on');
    await page.click('#btnMenu'); await page.waitForSelector('#menuDlg[open]');
    assert.equal(await page.locator('#optMulti2').isChecked(), true);
    await page.locator('#optMulti2').uncheck();
    assert.equal(await page.evaluate(() => window.__twmj.match.cfg.multiWin), false, 'menu toggle applies to the running match');
    await page.click('#menuDlg button[value="close"]');
    await page.reload();
    assert.equal(await page.locator('#optMulti').isChecked(), false, 'the stored choice (off) is kept');
    await page.click('#btnStart'); await page.waitForSelector('#game:not([hidden])');
    assert.equal(await page.evaluate(() => window.__twmj.match.cfg.multiWin), false, 'a new match honours the stored choice');
    assert.deepEqual(M.errs, []);
    await M.ctx.close();
  });

  /* Laptops and desktops: the whole game (HUD, opponents, table, status, 17-tile hand) fits one viewport. The page scrolls the
     table into view when the match starts, and it keeps fitting through real turns (claims, flowers, kongs). */
  for (const [width, height] of [[1366, 680], [1280, 650], [1440, 760], [1536, 730], [1920, 950], [1280, 900]]) {
    await check(`laptop ${width}x${height}: the whole game fits the screen at start and through real turns`, async () => {
      const L = await open(width, height);
      const { page } = L;
      await page.goto(origin + URL_PATH);
      await page.click('.seg[data-setting="speed"] button[data-v="0.45"]');
      await page.click('#btnStart');
      await page.waitForSelector('#game:not([hidden])');
      const box = () => page.evaluate(() => {
        const g = document.querySelector('#game').getBoundingClientRect(), h = document.querySelector('body > header').getBoundingClientRect();
        const hand = [...document.querySelectorAll('#hand .tile')].map((t) => t.getBoundingClientRect());
        return { top: g.top, bottom: g.bottom, hdr: h.bottom, vh: innerHeight, left: g.left, right: g.right, vw: innerWidth, handW: hand.length ? Math.min(...hand.map((r) => r.width)) : 0, handBottom: hand.length ? Math.max(...hand.map((r) => r.bottom)) : 0, hOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      await page.waitForFunction(() => { const g = document.querySelector('#game').getBoundingClientRect(); return g.top >= document.querySelector('body > header').getBoundingClientRect().bottom - 1 && g.bottom <= innerHeight + 1; }, null, { timeout: 8000 })
        .catch(async () => { throw new Error('game block not fully on screen after start: ' + JSON.stringify(await box())); });
            for (let i = 0; i < 40; i++) {
        const b = await box();
        // The block's height must fit the space below the sticky header whatever the scroll position (Playwright's own clicks
        // may scroll the page), so a player can always have the whole game on screen.
        assert.ok(b.bottom - b.top <= b.vh - b.hdr + 1, `game block ${Math.round(b.bottom - b.top)}px high does not fit ${Math.round(b.vh - b.hdr)}px at step ${i}`);
        assert.ok(b.left >= -1 && b.right <= b.vw + 1, 'game wider than viewport');
        assert.ok(b.hOverflow <= 0, 'horizontal page overflow ' + b.hOverflow);
        if (b.handW) assert.ok(b.handW >= 34, 'hand tile too small: ' + b.handW);
        if ((await step(page)) === 'final') break;
      }
      assert.deepEqual(L.errs, []); assert.deepEqual(L.external, []);
      await L.ctx.close();
    });
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
