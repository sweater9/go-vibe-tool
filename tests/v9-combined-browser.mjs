/* Both lanes, real root/scoped workers, and cold navigation after origin shutdown. */
import assert from 'node:assert/strict';
import { createDistServer } from '../scripts/serve-dist.mjs';
const pw = await import(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const engine = process.argv[2] || 'chromium';
const server = createDistServer(process.env.SITE_ROOT || '.');
await server.start();
let online = true, browser;
const media = ['cubic-bezier', 'screenshot-beautifier', 'pdf-signer', 'offline-ocr', 'silence-stripper', 'video-gif-trimmer'];
const lane1 = ['sql-formatter', 'file-sha256', 'epoch-matrix', 'og-simulator'];
try {
  browser = await pw[engine].launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const errors = [];
  await ctx.route('**/*', route => /^https?:/.test(route.request().url()) && !route.request().url().startsWith(server.base) ? route.abort() : route.continue());
  const page = await ctx.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(30000);
  // Prepare scoped media cache BEFORE activating the root worker.
  await page.goto(server.base + 'tools/v9-media/');
  await page.locator('summary').click();
  await page.click('#offline');
  await page.waitForFunction(() => document.querySelector('#offlineStatus').textContent.startsWith('Offline assets cached.'), null, { timeout: 120000 });
  await page.goto(server.base);
  await page.evaluate(async () => { await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.endsWith('/sw.js'));
  assert.ok(await page.evaluate(async () => (await caches.keys()).some(key => key.startsWith('gvt-v9-media-'))), 'root activation preserves scoped media cache');
  for (const offline of [false, true]) {
    if (offline) { await server.stop(); online = false; await page.reload(); }
    assert.equal(await page.locator('#categoryGrid .cat-tile').count(), 9);
    const registry = await page.evaluate(() => tools.map(t => t[0]));
    for (const id of [...lane1, ...media]) assert.equal(registry.filter(value => value === id).length, 1, id + ' registered once');
    assert.equal(await page.evaluate(() => typeof GVTV9.parseEpoch), 'function');
    assert.equal(await page.evaluate(() => typeof GVTV9.bezierAt), 'function');
    for (const id of [...media, ...lane1, 'cubic-bezier', 'epoch-matrix']) {
      await page.evaluate(id => openTool(id), id);
      if (media.includes(id)) await page.frameLocator('#v9MediaFrame').locator('#tool[data-ready]').waitFor();
      else await page.locator('#workspace .v9a').waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), id + ' fits mobile');
      await page.evaluate(() => closeTool());
      assert.equal(await page.locator('#v9MediaFrame').count(), 0);
    }
    console.log(`PASS ${offline ? 'offline' : 'online'}: both engines, all ten tools, nine categories, wrapper cleanup, mobile width`);
  }
  assert.deepEqual(errors, [], 'no page/frame exceptions');
  console.log('PASS root/scoped service-worker coexistence and origin-offline catalogue');
} finally {
  await browser?.close();
  if (online) await server.stop();
}
