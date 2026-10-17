/* Mahjong Solitaire browser QA: node tests/mahjong-solitaire-browser.mjs [chromium|firefox|webkit]
   env: SITE_ROOT (default "dist", run `npm run build` first), PLAYWRIGHT_PACKAGE, BROWSER_EXECUTABLE.
   Serves the built site with Cloudflare-style routing, blocks third-party http(s) (never blob:/data:) and records any
   request that leaves the origin. "Offline" means the origin server is stopped, not an emulator switch. */
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
const out = path.join(repo, 'artifacts', 'mahjong-solitaire-' + engine);
fs.mkdirSync(out, { recursive: true });
let server = createDistServer(root);
const port = await server.start();
const origin = `http://127.0.0.1:${port}`;
const URL_PATH = '/play/mahjong-solitaire/';
const browser = await pw[engine].launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}), ...(engine === 'chromium' ? { args: ['--no-sandbox'] } : {}) });
const checks = [];
async function check(label, fn) {
  const t0 = Date.now();
  try { await fn(); checks.push({ label, ok: true, ms: Date.now() - t0 }); console.log('PASS', label); }
  catch (e) { checks.push({ label, ok: false, ms: Date.now() - t0, error: String(e.message).slice(0, 1500) }); console.error('FAIL', label, '\n    ', String(e.message).split('\n').slice(0, 6).join('\n     ')); }
}
async function open(width, height = 800) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: width < 600 });
  const page = await ctx.newPage(); page.setDefaultTimeout(20000);
  const errs = [], external = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('request', (r) => { try { const u = new URL(r.url()); if (/^https?:$/.test(u.protocol) && u.origin !== origin) external.push(u.href); } catch { /* ignore */ } });
  await ctx.route((u) => /^https?:/.test(u.protocol) && u.origin !== origin, (r) => r.abort());
  return { ctx, page, errs, external };
}
const fits = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const remaining = async (page) => Number((await page.locator('#stat-remaining').innerText()).replace(/\D+/g, ''));
const boardReady = (page) => page.waitForFunction(() => document.querySelectorAll('.sol-tile').length > 0);
/* Two free tiles that match by label (same face), found through the accessible names the page itself exposes. */
async function freePair(page) {
  return page.evaluate(() => {
    const free = [...document.querySelectorAll('.sol-tile')].filter((t) => /available/.test(t.getAttribute('aria-label') || ''));
    const by = new Map();
    for (const t of free) { const k = (t.getAttribute('aria-label') || '').split(', layer')[0]; (by.get(k) || by.set(k, []).get(k)).push(t.dataset.id); }
    for (const ids of by.values()) if (ids.length >= 2) return ids.slice(0, 2);
    return null;
  });
}
/* Direct visit to play/mahjong-solitaire/ registers ../../sw.js, precaches all assets,
   upgrades legacy caches (e.g. govibetool-v8-7), and enables immediate offline play. */
const cacheName = fs.readFileSync(path.join(root, 'sw.js'), 'utf8').match(/const CACHE="([^"]+)"/)[1];

try {
  for (const [name, width] of [['desktop', 1280], ['mobile', 375]]) {
    const A = await open(width);
    const { page } = A;
    await page.goto(origin + URL_PATH);
    await boardReady(page);
    await check(`${name}: page loads, board renders, no page errors, no horizontal page scroll`, async () => {
      assert.ok(await remaining(page) > 0);
      assert.equal(await page.locator('.sol-tile').count(), await remaining(page));
      assert.ok(await fits(page), 'document wider than viewport');
      assert.deepEqual(A.errs, []);
    });
    await check(`${name}: every layout renders a complete board that fits the viewport`, async () => {
      const values = await page.locator('#layout-select option').evaluateAll((o) => o.map((x) => x.value));
      assert.ok(values.length >= 5, 'five layouts expected, got ' + values.length);
      for (const v of values) {
        await page.selectOption('#layout-select', v);
        await boardReady(page);
        assert.equal(await page.locator('.sol-tile').count(), await remaining(page), v);
        assert.ok(await fits(page), v + ' overflows the page');
        const box = await page.locator('#board-container').boundingBox();
        assert.ok(box && box.width <= width + 1, v + ' board container wider than viewport');
      }
    });
    await check(`${name}: controls are reachable (hint, undo, shuffle, pause, restart)`, async () => {
      for (const id of ['btn-hint', 'btn-undo', 'btn-shuffle', 'btn-pause', 'btn-restart']) {
        const b = await page.locator('#' + id).boundingBox();
        assert.ok(b && b.x >= -1 && b.x + b.width <= width + 1 && b.height >= 24, id + ' not fully reachable');
      }
    });
    await check(`${name}: matching a free pair removes two tiles, undo restores them, state survives a reload`, async () => {
      await page.selectOption('#layout-select', await page.locator('#layout-select option').first().getAttribute('value'));
      await boardReady(page);
      const before = await remaining(page);
      const pair = await freePair(page);
      assert.ok(pair, 'no free matching pair found at game start');
      const first = page.locator(`.sol-tile[data-id="${pair[0]}"]`);
      await first.click();
      assert.equal(await page.locator(`.sol-tile[data-id="${pair[0]}"]`).getAttribute('aria-pressed'), 'true', 'first tile must be selected by pointer');
      const second = page.locator(`.sol-tile[data-id="${pair[1]}"]`);
      await second.click();
      const after = await remaining(page);
      assert.equal(after, before - 2, `pointer match did not remove pair ${pair.join(', ')}; remaining=${after}, expected=${before - 2}; selected=${await page.locator('.sol-tile[aria-pressed="true"]').count()}`);
      assert.equal(await remaining(page), before - 2);
      await page.reload(); await boardReady(page);
      assert.equal(await remaining(page), before - 2, 'progress should persist across reload');
      await page.click('#btn-undo');
      await page.waitForFunction((n) => document.querySelectorAll('.sol-tile').length === n, before);
      assert.equal(await remaining(page), before);
    });
    await check(`${name}: privacy, no third-party request and no errors`, async () => { assert.deepEqual(A.external, []); assert.deepEqual(A.errs, []); });
    await A.ctx.close();
  }

  await check('service-worker: direct visit to Solitaire installs worker, upgrades legacy cache, and precaches assets', async () => {
    const S = await open(375);
    const { page } = S;
    // Direct first-time visit without visiting home page first
    await page.goto(origin + URL_PATH);
    await boardReady(page);

    // Simulate an existing V8 installation cache to verify upgrade cleanup
    await page.evaluate(async () => {
      const oldCache = await caches.open('govibetool-v8-7');
      await oldCache.put(location.origin + '/legacy-test.txt', new Response('old-v8-7'));
    });

    // Verify service worker becomes ready and precaches all assets directly from Solitaire page
    await Promise.race([
      page.evaluate(async () => { await navigator.serviceWorker.ready; }),
      new Promise((_, r) => setTimeout(() => r(new Error('direct-visit service worker never became ready')), 30000))
    ]);
    await page.waitForFunction(async (n) => (await (await caches.open(n)).keys()).length > 300, cacheName, { timeout: 90000 });

    // Verify cache upgrade: old cache dropped upon activation, new cache active
    await page.waitForFunction(async (n) => {
      const keys = await caches.keys();
      return keys.includes(n) && !keys.includes('govibetool-v8-7');
    }, cacheName, { timeout: 30000 });

    const hasCurrent = await page.evaluate(async (n) => await caches.has(n), cacheName);
    assert.ok(hasCurrent, `current cache ${cacheName} should exist`);
    const hasLegacy = await page.evaluate(async () => await caches.has('govibetool-v8-7'));
    assert.equal(hasLegacy, false, 'legacy cache govibetool-v8-7 should be dropped on upgrade');

    // Verify Solitaire assets are in the active cache
    const cached = await page.evaluate(async (n) => (await (await caches.open(n)).keys()).map((r) => new URL(r.url).pathname), cacheName);
    for (const f of ['index.html', 'solitaire.css', 'solitaire.js', 'engine.js']) {
      assert.ok(cached.includes(URL_PATH + f) || (f === 'index.html' && cached.includes(URL_PATH)), 'not precached: ' + f);
    }
    assert.deepEqual(S.errs, []);
    await S.ctx.close();
  });

  await check('offline: with the origin server stopped, direct-visit installed game reloads from the service worker and is playable', async () => {
    const O = await open(375);
    const { page } = O;
    // Direct visit: player navigates straight to Solitaire
    await page.goto(origin + URL_PATH);
    await boardReady(page);
    await Promise.race([
      page.evaluate(async () => { await navigator.serviceWorker.ready; }),
      new Promise((_, r) => setTimeout(() => r(new Error('service worker never became ready')), 30000))
    ]);
    await page.waitForFunction(async (n) => (await (await caches.open(n)).keys()).length > 300, cacheName, { timeout: 90000 });
    await page.reload();
    await boardReady(page);
    assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'page must be controlled by the worker before going offline');

    await server.stop();
    try {
      await page.goto(origin + URL_PATH);
      await boardReady(page);
      const before = await remaining(page);
      const pair = await freePair(page);
      assert.ok(pair, 'no free pair offline');
      for (const id of pair) await page.locator(`.sol-tile[data-id="${id}"]`).click();
      await page.waitForFunction((n) => document.querySelectorAll('.sol-tile').length === n, before - 2);
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
