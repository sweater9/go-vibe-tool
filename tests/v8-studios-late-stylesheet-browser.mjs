/* Deterministic regression: a Studio opened from the home page (?tool=<studio alias>) must not be shown before
   studios.css is applied. studios.css is delayed 700 ms (service worker blocked so the route always applies).
   Before the fix index.html did not link the stylesheet and studios.js injected it after the Studio was visible,
   leaving a request in flight that Firefox reports as a ServiceWorker intercept error when the page is left. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createDistServer } from '../scripts/serve-dist.mjs';
const pw = await import(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const engine = process.argv[2] || 'chromium';
const server = createDistServer(process.env.SITE_ROOT || 'dist'); await server.start();
const out = process.env.STUDIO_QA_ARTIFACTS || `artifacts/studios-late-stylesheet-${engine}`;
await fs.mkdir(out, { recursive: true });
const results = []; let browser;
async function check(label, run) { try { await run(); results.push({ label, ok: true }); console.log('PASS', label); } catch (error) { results.push({ label, ok: false, error: error.message }); console.error('FAIL', label, '::', String(error.message).split('\n')[0].slice(0, 300)); } }
try {
  browser = await pw[engine].launch({ headless: true });
  for (const width of [375, 1280]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
    await ctx.route('**/studios.css', async route => { await new Promise(resolve => setTimeout(resolve, 700)); await route.continue(); });
    const page = await ctx.newPage(); page.setDefaultTimeout(15000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(server.base + '?category=business-finance&tool=hourly-rate');
    await page.waitForSelector('#studio-freelance:not([hidden])');
    await check(`${width} studios.css is applied before the Studio is visible, linked exactly once`, async () => {
      const state = await page.evaluate(() => ({ links: document.querySelectorAll('link[href="studios.css"]').length, applied: [...document.styleSheets].some(sheet => (sheet.href || '').endsWith('/studios.css')) }));
      assert.deepEqual(state, { links: 1, applied: true });
    });
    await check(`${width} tab selection and Freelance calculator work immediately after the Studio appears`, async () => {
      await page.click('#calcRate');
      assert.match(await page.locator('#rateResult').innerText(), /Quote: 2262\./);
      await page.click('[data-studio=qr]');
      assert.equal(await page.locator('[data-studio=qr]').getAttribute('aria-selected'), 'true');
    });
    await check(`${width} no uncaught page errors`, async () => assert.deepEqual(errors, []));
    await ctx.close();
  }
} finally { if (browser) await browser.close(); await server.stop(); await fs.writeFile(`${out}/results.json`, JSON.stringify({ engine, results }, null, 2)); }
const failed = results.filter(result => !result.ok);
console.log(`\n${engine}: ${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
