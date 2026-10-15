/* Diagnostic ablation (test-only, never shipped).
   Hypothesis: v2.css sets html{scroll-behavior:smooth}; a Playwright fill()/click() that focuses or scrolls an
   element starts an animated scroll, and the following click is dispatched at coordinates that are still moving.
   This replays the interaction sequences and assertions of the two failing integration checks
   ("URL & Link Studio" and "Freelance calculator", desktop, studios.html) in three modes:
     smooth-as-shipped | reducedMotion (v8.css disables smooth scrolling) | css-scroll-auto (smooth scrolling disabled by CSS only)
   Usage: node tests/diag/studio-scroll-ablation.mjs <engine> [contexts] [cycles-per-context] */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createDistServer } from '../../scripts/serve-dist.mjs';
const pw = await import(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const engine = process.argv[2] || 'firefox';
const contexts = Number(process.argv[3] || 15), cycles = Number(process.argv[4] || 4);
const out = process.env.STUDIO_ABLATION_ARTIFACTS || `artifacts/studio-scroll-ablation-${engine}`;
await fs.mkdir(out, { recursive: true });
const server = createDistServer(process.env.SITE_ROOT || 'dist'); await server.start();
const base = server.base;

async function urlStudio(page) {
  await page.fill('#urlInput', 'https://example.com/a/b?utm_source=x&fbclid=1&keep=2');
  await page.click('#urlAnalyze');
  const t = await page.locator('#urlResult').innerText();
  assert.match(t, /Host: example\.com/); assert.match(t, /Removed trackers: utm_source, fbclid/); assert.match(t, /Clean URL: https:\/\/example\.com\/a\/b\?keep=2/); assert.match(t, /not a safety verdict/);
  await page.locator('#studio-url details summary').click(); await page.fill('#utmSource', 'news'); await page.fill('#utmMedium', 'email'); await page.fill('#utmCampaign', 'launch'); await page.click('#urlUtm');
  assert.match(await page.locator('#urlResult').innerText(), /utm_source=news.*utm_medium=email.*utm_campaign=launch/s);
  await page.fill('#urlInput', 'javascript:alert(1)'); await page.click('#urlAnalyze');
  assert.match(await page.locator('#urlResult').innerText(), /Invalid URL/);
  await page.fill('#urlInput', 'http://user:pw@xn--e1afmkfd.example/'); await page.click('#urlAnalyze');
  const w = await page.locator('#urlResult').innerText(); assert.match(w, /Credentials embedded/); assert.match(w, /Punycode/); assert.match(w, /Unencrypted HTTP/);
}
async function freelance(page) {
  await page.click('[data-studio="freelance"]');
  await page.fill('#target', '100000'); await page.fill('#overhead', '15000'); await page.fill('#hours', '40'); await page.fill('#weeks', '46'); await page.fill('#utilization', '65'); await page.fill('#tax', '0'); await page.fill('#margin', '15'); await page.fill('#quoteHours', '20');
  await page.click('#calcRate');
  const t = await page.locator('#rateResult').innerText();
  assert.match(t, /Estimated billable hours\/year: 1196\.0/); assert.match(t, /Break-even hourly rate: 96\.15/); assert.match(t, /Suggested hourly rate: 113\.12/); assert.match(t, /Quote: 2262\./);
  await page.fill('#utilization', '0'); await page.click('#calcRate');
  assert.match(await page.locator('#rateResult').innerText(), /between|positive|valid/i);
  await page.click('#calcEffective');
  assert.match(await page.locator('#effectiveResult').innerText(), /90\.00/);
}
const MODES = [
  { name: 'smooth-as-shipped', ctx: {}, css: false },
  { name: 'reducedMotion', ctx: { reducedMotion: 'reduce' }, css: false },
  { name: 'css-scroll-auto', ctx: {}, css: true },
];
const rows = []; let browser;
try {
  browser = await pw[engine].launch({ headless: true });
  for (const mode of MODES) {
    const stat = { mode: mode.name, cycles: 0, urlFail: 0, freelanceFail: 0, examples: [] };
    for (let c = 0; c < contexts; c++) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...mode.ctx });
      const page = await ctx.newPage(); page.setDefaultTimeout(15000);
      for (let k = 0; k < cycles; k++) {
        try {
          await page.goto(base + 'studios.html'); await page.waitForSelector('#studio-url');
          if (mode.css) await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
        } catch (error) { stat.examples.push('setup: ' + String(error.message).split('\n')[0].slice(0, 120)); continue; }
        stat.cycles++;
        try { await urlStudio(page); } catch (error) { stat.urlFail++; if (stat.examples.length < 4) stat.examples.push('url: ' + String(error.message).split('\n')[0].slice(0, 140)); }
        try { await freelance(page); } catch (error) { stat.freelanceFail++; if (stat.examples.length < 4) stat.examples.push('freelance: ' + String(error.message).split('\n')[0].slice(0, 140)); }
      }
      await ctx.close();
    }
    rows.push(stat);
  }
} finally { if (browser) await browser.close(); await server.stop(); }
await fs.writeFile(`${out}/ablation.json`, JSON.stringify({ engine, contexts, cycles, rows }, null, 1));
console.log(`scroll ablation ${engine}: ${contexts} contexts x ${cycles} cycles per mode`);
for (const r of rows) console.log(r.mode.padEnd(20), `cycles=${r.cycles} urlFail=${r.urlFail} freelanceFail=${r.freelanceFail}`, r.examples.length ? JSON.stringify(r.examples) : '');
// Diagnostic: always exit 0 so the counts are reported.
