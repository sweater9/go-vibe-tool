/* Browser QA for offline readiness indicators. node tests/offline-status-browser.mjs [chromium|firefox|webkit]
   env: PLAYWRIGHT_PACKAGE, SITE_ROOT=dist (default). Verifies the label against real Cache Storage, not against the service-worker registration. */
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const pw = await import(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const engine = process.argv[2] || 'chromium';
const repo = fileURLToPath(new URL('../', import.meta.url));
const root = path.resolve(process.env.SITE_ROOT || path.join(repo, 'dist'));
const { createDistServer } = await import(new URL('file://' + path.join(repo, 'scripts/serve-dist.mjs')).href);
const dist = createDistServer(root, { port: 0 }); await dist.start(); const origin = dist.base.replace(/\/$/, '');
const browser = await pw[engine].launch(); let passed = 0; const failures = [];
async function check(name, fn) { try { await fn(); passed++; console.log('PASS', name); } catch (e) { failures.push(`${name}: ${e.message.split('\n')[0]}`); console.log('FAIL', name, '-', e.message.split('\n')[0]); } }
const label = page => page.evaluate(() => { const e = document.querySelector('.gvt-offline'); return e && e.getAttribute('data-state'); });
const waitState = (page, want, timeout = 30000) => page.waitForFunction(w => { const e = document.querySelector('.gvt-offline'); return e && e.getAttribute('data-state') === w; }, want, { timeout });
const settled = async (page, ms = 6000) => { await page.waitForFunction(() => { const e = document.querySelector('.gvt-offline'); return e && e.getAttribute('data-state') && e.getAttribute('data-state') !== 'checking'; }, null, { timeout: ms }); return label(page); };
async function ctxPage() { const ctx = await browser.newContext(); const page = await ctx.newPage(); page.setDefaultTimeout(30000); const errs = []; page.on('pageerror', e => errs.push(e.message)); return { ctx, page, errs }; }
async function installWorker(page) {
  await page.goto(origin + '/'); await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(async () => { const c = await caches.open('govibetool-v8-12'); return (await c.keys()).some(r => r.url.endsWith('/play/2048/app.js')); }, null, { timeout: 60000 });
}

await check('first visit without a worker is never Ready (Online required)', async () => {
  const { ctx, page } = await ctxPage(); await page.goto(origin + '/play/2048/');
  assert.equal(await settled(page, 15000), 'online'); assert.match(await page.textContent('.gvt-offline'), /Online required/); await ctx.close();
});
await check('shows "Checking offline availability" before the first answer', async () => {
  const { ctx, page } = await ctxPage(); await page.route('**/offline-status.css', r => r.continue());
  await page.goto(origin + '/play/2048/', { waitUntil: 'commit' });
  await page.waitForFunction(() => document.querySelector('.gvt-offline'), null, { timeout: 15000 });
  const seen = await page.evaluate(() => new Promise(res => { const e = document.querySelector('.gvt-offline'); const t = () => { const s = e.getAttribute('data-state'); if (s) res(s); else setTimeout(t, 5); }; t(); }));
  assert.ok(['checking', 'online'].includes(seen), seen); await ctx.close();
});
await check('games: Ready only once assets are really cached; works offline; eviction downgrades it', async () => {
  const { ctx, page, errs } = await ctxPage(); await installWorker(page);
  for (const p of ['/play/2048/', '/play/daily-word/', '/play/word-logic/', '/play/taiwan-mahjong/', '/play/vibe-arcade/']) {
    await page.goto(origin + p); await waitState(page, 'ready'); assert.match(await page.textContent('.gvt-offline'), /Ready offline/, p);
  }
  await page.goto(origin + '/play/2048/'); await waitState(page, 'ready');
  await ctx.setOffline(true); await page.reload(); await waitState(page, 'ready'); assert.match(await page.textContent('h1'), /2048/);
  await ctx.setOffline(false);
  await page.evaluate(async () => { const c = await caches.open('govibetool-v8-12'); await c.delete('/play/2048/engine.js', { ignoreSearch: true }); for (const r of await c.keys()) if (r.url.endsWith('/play/2048/engine.js')) await c.delete(r); });
  await page.evaluate(() => window.GVTOffline.check());
  await page.waitForFunction(() => document.querySelector('.gvt-offline').getAttribute('data-state') !== 'ready', null, { timeout: 15000 });
  assert.equal(await label(page), 'online', 'evicted asset must not read Ready');
  assert.deepEqual(errs.filter(e => !/Failed to fetch|Load failed|NetworkError/.test(e)), []); await ctx.close();
});
await check('PDF Editor and PDF Compare: Download required until the PDF engine files are saved, then Ready; Ready survives offline', async () => {
  const { ctx, page } = await ctxPage(); await installWorker(page);
  for (const p of ['/tools/pdf-editor/', '/tools/pdf-compare/']) {
    await page.goto(origin + p); await page.waitForTimeout(500);
    // let the page's own runtime caching settle, then judge
    await page.waitForFunction(() => document.querySelector('.gvt-offline').getAttribute('data-state') !== 'checking', null, { timeout: 20000 });
    await page.evaluate(() => window.GVTOffline.refresh());
    assert.equal(await settled(page, 20000), 'download', p + ' must not claim Ready with the PDF engine files uncached');
    assert.match(await page.textContent('.gvt-offline'), /Download required/);
  }
  // Simulate the user's existing "Prepare offline" action: save every vendor/pdf file from the media manifest.
  await page.evaluate(async () => { const base = new URL('/tools/v9-media/', location.origin); const man = await (await fetch(new URL('vendor-assets.json', base))).json(); const c = await caches.open('gvt-v9-media-1'); for (const f of man.filter(f => f.file.startsWith('vendor/pdf/'))) { const u = new URL(f.file, base).href; await c.put(u, await fetch(u)); } });
  for (const p of ['/tools/pdf-editor/', '/tools/pdf-compare/']) { await page.goto(origin + p); await waitState(page, 'ready', 20000); assert.match(await page.textContent('.gvt-offline'), /Ready offline/); }
  await ctx.setOffline(true); await page.reload(); await waitState(page, 'ready'); assert.match(await page.textContent('h1'), /PDF Compare/);
  await ctx.close();
});
await check('indicator does not displace the existing heading layout', async () => {
  const { ctx, page } = await ctxPage(); await installWorker(page); await page.goto(origin + '/tools/pdf-editor/'); await settled(page, 20000);
  const box = await page.evaluate(() => { const r = document.querySelector('.topbar').getBoundingClientRect(); return { h: r.height, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
  assert.ok(box.sw <= box.cw, 'no horizontal overflow'); await ctx.close();
});
await check('PDF Editor on a phone: the indicator is visible beside the welcome heading and the top bar does not overflow', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await ctx.newPage(); page.setDefaultTimeout(30000); await installWorker(page);
  await page.goto(origin + '/tools/pdf-editor/'); await page.waitForFunction(() => document.querySelector('.welcome .gvt-offline')?.getAttribute('data-state') && document.querySelector('.welcome .gvt-offline').getAttribute('data-state') !== 'checking', null, { timeout: 20000 });
  const r = await page.evaluate(() => ({ w: getComputedStyle(document.querySelector('.welcome .gvt-offline')).display, t: getComputedStyle(document.querySelector('.topbar .gvt-offline')).display, over: document.documentElement.scrollWidth - document.documentElement.clientWidth, bar: document.querySelector('.topbar').scrollWidth - document.querySelector('.topbar').clientWidth }));
  assert.notEqual(r.w, 'none'); assert.equal(r.t, 'none'); assert.ok(r.over <= 0, 'page overflow'); await ctx.close();
});
await browser.close(); await dist.stop?.();
console.log(`\n${engine}: ${passed} passed, ${failures.length} failed`); if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
process.exit(0);
