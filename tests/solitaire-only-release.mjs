/* Solitaire-only release gate: node tests/solitaire-only-release.mjs [chromium|firefox|webkit]
   Builds dist/ and proves that four-player Mahjong (frontend, multiplayer backend, endpoints) is unreachable from the
   built site while Mahjong Solitaire still works, and that the multiplayer SOURCE is preserved in the repository.
   env: PLAYWRIGHT_PACKAGE, BROWSER_EXECUTABLE. Static checks need no browser. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createDistServer } from '../scripts/serve-dist.mjs';
import { verifyDist } from '../scripts/verify-dist.mjs';
import { UNRELEASED_SITE_PATHS } from '../scripts/site-manifest.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(repo, 'dist');
const engine = process.argv[2] || 'chromium';
let passed = 0; const failures = [];
async function check(label, fn) {
  try { await fn(); passed++; console.log('PASS', label); }
  catch (e) {
    failures.push(`${label}: ${String(e.message).split('\n').slice(0, 4).join(' | ')}`); console.error('FAIL', label, '\n    ', String(e.message).split('\n').slice(0, 4).join('\n     '));
    if (process.env.GITHUB_ACTIONS) console.log(`::error title=solitaire-only-release ${engine}::${label}: ${String(e.message).split('\n').slice(0, 3).join(' | ').replace(/[\r%]/g, ' ').slice(0, 400)}`); // visible in the check annotations
  }
}
/* Node's fetch forbids the Upgrade header, so send the WebSocket handshake with a raw http request. */
const upgradeStatus = p => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port: serverPort, path: p, headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==' } }, res => { res.resume(); resolve(res.statusCode); });
  req.on('upgrade', (res, sock) => { sock.destroy(); resolve(101); }); req.on('error', reject); req.end();
});
let serverPort = 0;
const walk = (d, base = d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name), base) : [path.relative(base, path.join(d, e.name)).split(path.sep).join('/')]);
const TEXT = /\.(html|js|mjs|css|json|xml|txt|webmanifest|jsonc)$/i;
/* A reference to the four-player game: its route, its backend or its configuration, but NOT mahjong-solitaire. */
const FOUR_PLAYER_REF = /play\/mahjong(?!-solitaire)(?:\/|["'\s]|$)|(?:\.\.\/|["'(=])mahjong\/|href=["']mahjong\/|MAHJONG_API|MAHJONG_TRANSPORT|MahjongRoom|multiplayer\/(?:server|engine|cloudflare)|\/api\/(?:rooms|mahjong)/;

execFileSync(process.execPath, [path.join(repo, 'scripts/build-static.mjs')], { cwd: repo, stdio: 'pipe' });
const files = walk(dist);

/* ------------------------------ static: the built distribution ------------------------------ */
await check('the manifest declares play/mahjong unreleased, and the build output has no such path', () => {
  assert.ok(UNRELEASED_SITE_PATHS.includes('play/mahjong'));
  assert.deepEqual(files.filter(f => f === 'play/mahjong' || f.startsWith('play/mahjong/')), []);
  assert.deepEqual(files.filter(f => /(^|\/)multiplayer(\/|$)/.test(f)), []);
});
await check('no shipped file references four-player Mahjong (routes, links, config, backend)', () => {
  const hits = [];
  for (const f of files) if (TEXT.test(f) && !f.startsWith('tools/v9-media/vendor/') && FOUR_PLAYER_REF.test(fs.readFileSync(path.join(dist, f), 'utf8'))) hits.push(f);
  assert.deepEqual(hits, []);
});
await check('service worker: precache has Solitaire and no four-player asset; cache name was bumped; activation clears old caches', () => {
  const sw = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8');
  const precache = [...sw.matchAll(/"(\.\/[^"]*)"/g)].map(m => m[1]);
  assert.deepEqual(precache.filter(a => /^\.\/play\/mahjong\//.test(a)), []);
  for (const a of ['./play/mahjong-solitaire/index.html', './play/mahjong-solitaire/solitaire.js', './play/mahjong-solitaire/engine.js', './play/mahjong-solitaire/solitaire.css']) assert.ok(precache.includes(a), a);
  const name = sw.match(/const CACHE="([^"]+)"/)[1]; const n = Number(name.match(/v8-(\d+)$/)?.[1]); assert.ok(n >= 10, `cache ${name} must be newer than the govibetool-v8-9 that precached the four-player pages`);
  assert.match(sw, /caches\.keys\(\)[^;]*filter\(key=>key!==CACHE/); // every other cache (including govibetool-v8-9) is deleted on activate
});
await check('sitemap lists Mahjong Solitaire and not four-player Mahjong', () => {
  const locs = [...fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.ok(locs.includes('https://govibetool.com/play/mahjong-solitaire/')); assert.ok(!locs.includes('https://govibetool.com/play/mahjong/'));
});
await check('discovery catalog has no four-player entry', () => {
  const src = fs.readFileSync(path.join(repo, 'discovery.js'), 'utf8');
  assert.ok(!/id:"mahjong-multiplayer"|Mahjong with Friends|href:"play\/mahjong\//.test(src));
});
await check('the production Worker is static assets only: no script, Durable Object, binding, route or Mahjong variable', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(repo, 'wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, ''));
  assert.deepEqual(Object.keys(cfg).sort(), ['$schema', 'assets', 'compatibility_date', 'name']);
  assert.equal(cfg.assets.directory, './dist'); assert.equal(cfg.name, 'go-vibe-tool');
});
await check('the multiplayer SOURCE is preserved in the repository for a future release', () => {
  for (const f of ['play/mahjong/index.html', 'play/mahjong/mahjong.mjs', 'multiplayer/engine.mjs', 'multiplayer/server.mjs', 'multiplayer/cloudflare/worker.mjs', 'multiplayer/cloudflare/wrangler.jsonc', 'tests/mahjong-engine.mjs', 'tests/mahjong-browser.mjs']) assert.ok(fs.existsSync(path.join(repo, f)), f);
});
await check('guard: verify-dist rejects an output that contains play/mahjong or precaches it', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sol-guard-'));
  try {
    fs.cpSync(dist, tmp, { recursive: true });
    fs.mkdirSync(path.join(tmp, 'play/mahjong'), { recursive: true }); fs.writeFileSync(path.join(tmp, 'play/mahjong/index.html'), '<!doctype html>');
    const r = verifyDist(tmp, { root: repo }); assert.equal(r.ok, false); assert.ok(r.errors.some(e => /unreleased path is in the output/.test(e)), r.errors.join(' | '));
    fs.appendFileSync(path.join(tmp, 'sw.js'), '\n// "./play/mahjong/index.html"\n');
    const r2 = verifyDist(tmp, { root: repo }); assert.ok(r2.errors.some(e => /precaches an unreleased path/.test(e)), r2.errors.join(' | '));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  assert.equal(verifyDist(dist, { root: repo }).ok, true);
});

/* ------------------------------ served: direct URLs and endpoints ------------------------------ */
const server = createDistServer(dist); const port = await server.start(); serverPort = port; const base = `http://127.0.0.1:${port}`;
let browser;
try {
  await check('direct URLs and multiplayer endpoints all return the 404 page (GET, POST, WebSocket upgrade)', async () => {
    const paths = ['/play/mahjong', '/play/mahjong/', '/play/mahjong/index.html', '/play/mahjong/config.js', '/play/mahjong/mahjong.mjs', '/play/mahjong/mahjong.css',
      '/multiplayer/server.mjs', '/multiplayer/engine.mjs', '/multiplayer/cloudflare/worker.mjs', '/api/rooms', '/api/mahjong', '/api/mahjong/rooms', '/rooms', '/ws', '/mahjong/', '/mahjong'];
    for (const p of paths) {
      // The Cloudflare-style server first redirects /x/index.html to /x/ ; follow it: the final answer must be the 404 page.
      const g = await fetch(base + p); assert.equal(g.status, 404, 'GET ' + p);
      assert.match(await g.text(), /couldn.t find that page/i, p);
      assert.equal((await fetch(base + p, { method: 'POST', body: '{}' })).status, 404, 'POST ' + p);
      const ws = await upgradeStatus(p); assert.ok(ws === 404 || (ws === 307 && p.endsWith('/index.html')), `WS ${p} -> ${ws}`); // never 101 (upgraded) or 200
    }
    for (const p of ['/play/mahjong-solitaire/', '/play/', '/sw.js']) assert.equal((await fetch(base + p)).status, 200, p);
  });

  const pwm = await import(process.env.PLAYWRIGHT_PACKAGE || 'playwright'); const pw = pwm.chromium ? pwm : pwm.default;
  browser = await pw[engine].launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}), ...(engine === 'chromium' ? { args: ['--no-sandbox'] } : {}) });
  async function open(width = 1280) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width < 600, serviceWorkers: 'allow' });
    const page = await ctx.newPage(); page.setDefaultTimeout(20000);
    const errs = [], reqs = [], sockets = [];
    page.on('pageerror', e => errs.push(String(e.message))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('request', r => reqs.push(r.url()));
    await page.exposeFunction('__ws', u => sockets.push(String(u)));
    await page.addInitScript(() => { const W = window.WebSocket; window.WebSocket = function (u, p) { window.__ws(u); return new W(u, p); }; window.WebSocket.prototype = W.prototype; });
    return { ctx, page, errs, reqs, sockets };
  }
  const boardReady = page => page.waitForFunction(() => document.querySelectorAll('.sol-tile').length > 0);
  const freePair = page => page.evaluate(() => {
    const by = new Map();
    for (const t of [...document.querySelectorAll('.sol-tile')].filter(t => /available/.test(t.getAttribute('aria-label') || ''))) { const k = (t.getAttribute('aria-label') || '').split(', layer')[0]; (by.get(k) || by.set(k, []).get(k)).push(t.dataset.id); }
    for (const ids of by.values()) if (ids.length >= 2) return ids.slice(0, 2); return null;
  });

  for (const [label, width] of [['desktop', 1280], ['mobile', 375]]) {
    await check(`${label}: Mahjong Solitaire plays from dist (match a pair, undo) with no four-player request, no WebSocket, no error`, async () => {
      const c = await open(width); let stage = 'start';
      try {
        stage = 'goto'; await c.page.goto(base + '/play/mahjong-solitaire/', { waitUntil: 'load' });
        stage = 'board'; await boardReady(c.page);
        stage = 'settle'; await c.page.waitForTimeout(500); // let the first paint and the service-worker registration finish before interacting
        const before = await c.page.locator('.sol-tile').count(); assert.ok(before >= 100, `tiles ${before}`);
        stage = 'pair'; const pair = await freePair(c.page); assert.ok(pair, 'a free matching pair exists at the start');
        stage = 'click'; for (const id of pair) { await c.page.locator(`.sol-tile[data-id="${id}"]`).click(); }

        stage = 'removed'; await c.page.waitForFunction(n => document.querySelectorAll('.sol-tile').length === n, before - 2);
        stage = 'checks';
      } catch (e) { e.message = `[stage ${stage}; tiles now ${await c.page.locator('.sol-tile').count().catch(() => '?')}; selected ${await c.page.locator('.sol-tile.selected').count().catch(() => '?')}; errors ${JSON.stringify(c.errs).slice(0, 200)}] ${e.message}`; throw e; }
      assert.deepEqual(c.errs, []); assert.deepEqual(c.sockets, []);
      assert.deepEqual(c.reqs.filter(u => FOUR_PLAYER_REF.test(new URL(u).pathname) || /\/(?:api|ws|rooms)(\/|$)/.test(new URL(u).pathname)), []);
      assert.deepEqual(c.reqs.filter(u => new URL(u).origin !== base), []);
      await c.ctx.close();
    });
  }

  await check('navigation: no same-origin link on the home page, Play hub or game pages leads to four-player Mahjong', async () => {
    const c = await open(); const bad = [];
    for (const p of ['/', '/play/', '/play/2048/', '/play/daily-word/', '/play/word-logic/', '/play/mahjong-solitaire/', '/labs/', '/learn/', '/knowledge/']) {
      await c.page.goto(base + p, { waitUntil: 'domcontentloaded' });
      const links = await c.page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => new URL(a.href, location.href)).filter(u => u.origin === location.origin).map(u => u.pathname));
      for (const l of links) if (/^\/play\/mahjong(\/|$)/.test(l) || /^\/multiplayer\//.test(l)) bad.push(`${p} -> ${l}`);
    }
    assert.deepEqual(bad, []);
    await c.page.goto(base + '/play/', { waitUntil: 'networkidle' });
    assert.deepEqual(await c.page.locator('.v5-card a.btn').evaluateAll(a => a.map(x => x.getAttribute('href'))), ['mahjong-solitaire/', 'word-logic/', '2048/', 'daily-word/', 'vibe-arcade/']);
    assert.ok(!/friends|four-player|multiplayer|mahjong seats/i.test(await c.page.locator('main').innerText().catch(() => c.page.innerText('body'))));
    await c.ctx.close();
  });

  await check('discovery search: typing "mahjong" or "multiplayer" never offers four-player Mahjong', async () => {
    const c = await open(); await c.page.goto(base + '/', { waitUntil: 'networkidle' });
    for (const q of ['mahjong', 'mahjong with friends', 'multiplayer', 'four-player mahjong', 'friends room']) {
      await c.page.fill('#toolSearch', q); await c.page.waitForTimeout(150);
      const hrefs = await c.page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => new URL(a.href, location.href).pathname));
      assert.deepEqual(hrefs.filter(h => /^\/play\/mahjong(\/|$)/.test(h)), [], q);
      const shown = await c.page.evaluate(() => [...document.querySelectorAll('a')].map(a => a.innerText).join('\n')); // result links only, not the echoed query
      assert.ok(!/Mahjong with Friends|four-player/i.test(shown), q);
    }
    await c.ctx.close();
  });

  await check('discovery search: "mahjong" and "solitaire" find Mahjong Solitaire (and nothing four-player)', async () => {
    const c = await open(); await c.page.goto(base + '/', { waitUntil: 'networkidle' });
    for (const q of ['mahjong', 'solitaire', 'mahjong solitaire', 'tile matching']) {
      await c.page.fill('#toolSearch', q); await c.page.waitForTimeout(250);
      const links = await c.page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => ({ p: new URL(a.href, location.href).pathname, t: a.innerText })));
      assert.ok(links.some(l => l.p === '/play/mahjong-solitaire/' && /Mahjong Solitaire/i.test(l.t)), `"${q}" should offer Mahjong Solitaire; links: ${links.filter(l => /play/.test(l.p)).map(l => l.p)}`);
      assert.deepEqual(links.filter(l => /^\/play\/mahjong(\/|$)/.test(l.p)), [], q);
    }
    await c.ctx.close();
  });

  await check('service worker: precaches Solitaire only, and an install over a stale four-player cache deletes it and serves 404', async () => {
    const c = await open(); await c.page.goto(base + '/play/mahjong-solitaire/', { waitUntil: 'networkidle' }); await boardReady(c.page);
    const cacheName = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8').match(/const CACHE="([^"]+)"/)[1];
    await c.page.waitForFunction(async n => { const k = (await (await caches.open(n)).keys()).map(r => new URL(r.url).pathname); return k.includes('/play/mahjong-solitaire/index.html') && k.length > 50; }, cacheName, { timeout: 30000 });
    const cached = await c.page.evaluate(async n => (await (await caches.open(n)).keys()).map(r => new URL(r.url).pathname), cacheName);
    assert.deepEqual(cached.filter(p => /^\/play\/mahjong\//.test(p)), []);
    // Simulate an upgrading visitor: the previous release cached the four-player pages under govibetool-v8-9.
    await c.page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).unregister(); const old = await caches.open('govibetool-v8-9'); for (const p of ['/play/mahjong/index.html', '/play/mahjong/mahjong.mjs', '/play/mahjong/config.js']) await old.put(p, new Response('STALE four-player', { headers: { 'Content-Type': 'text/html' } })); });
    await c.page.reload({ waitUntil: 'networkidle' }); await boardReady(c.page);
    let keys = []; for (let i = 0; i < 100; i++) { keys = await c.page.evaluate(() => caches.keys()); if (!keys.includes('govibetool-v8-9') && keys.includes(cacheName)) break; await c.page.waitForTimeout(300); } // the new worker installs, then activates and clears old caches
    assert.ok(!keys.includes('govibetool-v8-9'), `the stale cache must be deleted by the new service worker; caches: ${keys}`); assert.ok(keys.includes(cacheName), `caches: ${keys}`);
    await c.page.reload({ waitUntil: 'networkidle' });
    const r = await c.page.goto(base + '/play/mahjong/', { waitUntil: 'domcontentloaded' }); assert.equal(r.status(), 404);
    assert.ok(!/STALE four-player/.test(await c.page.content()));
    await c.ctx.close();
  });
} finally { if (browser) await browser.close(); await server.stop().catch(() => {}); }

console.log(`solitaire-only-release (${engine}): ${passed} passed, ${failures.length} failed`);
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
