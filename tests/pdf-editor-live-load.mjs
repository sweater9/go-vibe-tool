/* Production-equivalent journey for the PDF Editor: the built site served with Cloudflare-style routing (clean URLs, trailing-slash redirects,
   404 page) and the real service worker, starting from the homepage like a visitor would.
   node tests/pdf-editor-live-load.mjs [chromium|firefox|webkit]     (needs `npm run build` first; SITE_ROOT=dist is the default) */
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const pw = await import(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const engine = process.argv[2] || 'chromium';
const repo = fileURLToPath(new URL('../', import.meta.url));
const { createDistServer } = await import(pathToFileURL(path.join(repo, 'scripts/serve-dist.mjs')).href);
const { PDFDocument, StandardFonts } = createRequire(import.meta.url)(path.join(repo, 'vendor/pdf-lib.min.js'));
const dist = createDistServer(path.resolve(process.env.SITE_ROOT || path.join(repo, 'dist'))); await dist.start();
const base = dist.base, browser = await pw[engine].launch({ headless: true });
const d = await PDFDocument.create(), f = await d.embedFont(StandardFonts.Helvetica); d.addPage([300, 300]).drawText('LIVE LOAD', { x: 20, y: 200, size: 20, font: f });
const sample = Buffer.from(await d.save());
let passed = 0; const failures = [];
async function check(name, fn) { try { await fn(); passed++; console.log('PASS', name); } catch (e) { failures.push(`${name}: ${e.message.split('\n')[0]}`); console.log('FAIL', name, '-', e.message.slice(0, 500)); } }

for (const [label, vp] of [['desktop 1440', { width: 1440, height: 900 }], ['phone 390', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: vp }), page = await ctx.newPage(), log = [];
  await page.route(/googlesyndication|doubleclick/, r => r.abort());
  page.on('pageerror', e => log.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) log.push('console: ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) log.push(`http ${r.status()}: ${r.url().replace(base, '/')}`); });
  page.on('requestfailed', r => { if (!/googlesyndication|doubleclick|favicon/.test(r.url())) log.push('requestfailed: ' + r.url().replace(base, '/')); });
  await check(`${label}: homepage renders all nine categories with no script errors, service worker installs`, async () => {
    await page.goto(base); await page.waitForSelector('a.cat-tile'); assert.equal(await page.locator('a.cat-tile').count(), 9);
    await page.evaluate(() => navigator.serviceWorker.ready); assert.deepEqual(log, []);
  });
  await check(`${label}: PDF & Tables shows "PDF Editor" beside "Private PDF Tools"; its tile opens the standalone editor`, async () => {
    await page.click('a.cat-tile[data-cat="files-pdf"]'); await page.waitForSelector('#categoryTools .toolcard');
    const ids = await page.$$eval('#categoryTools .toolcard', e => e.map(x => x.dataset.tool));
    assert.ok(ids.includes('pdf-editor') && ids.includes('pdf-studio'), ids.join(',')); assert.equal(ids.indexOf('pdf-editor'), ids.indexOf('pdf-studio') + 1, 'PDF Editor must sit next to Private PDF Tools');
    assert.ok(ids.includes('pdf-signer') && ids.includes('table-converter'), 'existing tiles must remain');
    await Promise.all([page.waitForURL(/\/tools\/pdf-editor\/$/), page.click('#categoryTools .toolcard[data-tool="pdf-editor"] .btn, #categoryTools .toolcard[data-tool="pdf-editor"] a')]);
    await page.waitForSelector('#welcomeTitle'); assert.match(await page.title(), /PDF Editor/);
  });
  await check(`${label}: open, edit and export from the production-style server; reload and offline reload still show the editor`, async () => {
    await page.setInputFiles('#fileInput', { name: 'live.pdf', mimeType: 'application/pdf', buffer: sample });
    await page.waitForFunction(() => /Opened live\.pdf/.test(document.getElementById('status').textContent));
    await page.fill('#propText', 'x').catch(() => {}); // no object yet: harmless
    await page.click('.tool[data-tool="text"]'); const box = await page.locator('#overlay').boundingBox(); await page.mouse.click(box.x + 60, box.y + 60);
    await page.waitForFunction(() => window.pdfEditorDebug.state().objects.length === 1);
    await page.click('#download'); await page.waitForSelector('#downloadLink:not([hidden])');
    await page.reload(); await page.waitForSelector('#welcomeTitle');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await dist.stop(); // offline = origin stopped (context.setOffline bypasses the worker in Firefox/WebKit and leaks into later cases)
    try { await page.reload(); await page.waitForSelector('#welcomeTitle'); } finally { await dist.start(); }
  });
  await check(`${label}: the old PDF Studio address forwards to the editor`, async () => {
    await page.goto(base + 'tools/pdf-studio/'); await page.waitForURL(/\/tools\/pdf-editor\/$/);
  });
  await check(`${label}: no console errors, failed requests or HTTP errors anywhere in the journey`, async () => assert.deepEqual(log, []));
  await check(`${label}: unknown addresses still get the 404 page`, async () => { assert.equal((await page.goto(base + 'tools/nope/')).status(), 404); });
  await ctx.close();
}
await browser.close(); await dist.stop();
console.log(`\n${engine}: ${passed} passed, ${failures.length} failed`);
if (failures.length) { failures.forEach(x => console.log(' -', x)); process.exit(1); }
