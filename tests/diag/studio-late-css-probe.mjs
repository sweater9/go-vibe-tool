/* Diagnostic probe (test-only, never shipped): do Studio tab selections or Freelance Calculator
   clicks get lost when ?tool=<studio alias> opens a Studio on the home page?

   The home page does not link studios.css; studios.js injects it when the Studio mounts, so the Studio
   can be visible before its stylesheet is applied. This probe separates three suspects:
     1. layout shift under the pointer (stylesheet arrives late)       -> modes with a delayed studios.css
     2. application handlers missing/not bound when the Studio is shown  -> handler state at mount + synthetic click
     3. Playwright interaction / navigation timing                      -> real click vs synthetic click, navigations seen
   Usage: node tests/diag/studio-late-css-probe.mjs <engine> [iterations] */
import fs from 'node:fs/promises';
import { createDistServer } from '../../scripts/serve-dist.mjs';
const pw = await import(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const engine = process.argv[2] || 'firefox';
const iterations = Number(process.argv[3] || 10);
const out = process.env.STUDIO_PROBE_ARTIFACTS || `artifacts/studio-css-probe-${engine}`;
await fs.mkdir(out, { recursive: true });
const server = createDistServer(process.env.SITE_ROOT || 'dist'); await server.start();
const MODES = [
  { name: 'css-immediate/sw-allow', delay: 0, sw: 'allow' },
  { name: 'css-immediate/sw-block', delay: 0, sw: 'block' },
  { name: 'css-delay-150ms/sw-block', delay: 150, sw: 'block' },
  { name: 'css-delay-700ms/sw-block', delay: 700, sw: 'block' },
];
const WIDTHS = [375, 1280];

function instrument() {
  const log = window.__probe = { events: [], mount: null, cssLinkAt: null };
  const sheetLoaded = () => [...document.styleSheets].some(s => (s.href || '').endsWith('/studios.css'));
  const rect = id => { const e = document.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };
  const idOf = e => (e instanceof Element) ? (e.closest('button,a,input')?.id || e.id || e.tagName) : null;
  const snap = type => ({ type, t: Math.round(performance.now()), sheet: sheetLoaded(), scrollY: Math.round(scrollY), calc: rect('calcRate'), qr: rect('studio-tab-qr') });
  for (const type of ['pointerdown', 'pointerup', 'click']) {
    document.addEventListener(type, event => {
      if (log.events.length > 300) return;
      const hit = document.elementFromPoint?.(event.clientX, event.clientY);
      log.events.push({ ...snap(type), target: idOf(event.target), hit: idOf(hit), x: Math.round(event.clientX), y: Math.round(event.clientY), trusted: event.isTrusted });
    }, true);
  }
  new MutationObserver(() => {
    if (!log.mount && document.getElementById('studioRoot')) {
      const calc = document.getElementById('calcRate'), tab = document.getElementById('studio-tab-qr');
      log.mount = { ...snap('mount'), calcHandler: calc ? typeof calc.onclick : 'absent', tabHandler: tab ? typeof tab.onclick : 'absent', readyState: document.readyState };
    }
    if (!log.cssLinkAt && document.querySelector('link[href="studios.css"]')) log.cssLinkAt = Math.round(performance.now());
  }).observe(document, { subtree: true, childList: true });
}

async function iteration(browser, mode, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: mode.sw });
  if (mode.delay) await ctx.route('**/studios.css', async route => { await new Promise(r => setTimeout(r, mode.delay)); await route.continue(); });
  const page = await ctx.newPage(); page.setDefaultTimeout(15000);
  await page.addInitScript(instrument);
  let navigations = 0; page.on('framenavigated', f => { if (f === page.mainFrame()) navigations++; });
  const rec = { mode: mode.name, width, calcOk: null, tabOk: null, error: null };
  try {
    await page.goto(server.base + '?category=business-finance&tool=hourly-rate');
    await page.waitForSelector('#studio-freelance:not([hidden])');
    rec.sheetWhenVisible = await page.evaluate(() => [...document.styleSheets].some(s => (s.href || '').endsWith('/studios.css')));
    await page.click('#calcRate');
    rec.calcOk = await page.waitForFunction(() => /Quote:/.test(document.getElementById('rateResult')?.textContent || ''), null, { timeout: 3000 }).then(() => true, () => false);
    await page.click('[data-studio=qr]');
    rec.tabOk = await page.waitForFunction(() => document.querySelector('[data-studio=qr]')?.getAttribute('aria-selected') === 'true', null, { timeout: 3000 }).then(() => true, () => false);
  } catch (error) { rec.error = String(error.message).split('\n')[0].slice(0, 200); }
  try {
    const probe = await page.evaluate(() => window.__probe);
    rec.mount = probe?.mount ? { sheet: probe.mount.sheet, calcHandler: probe.mount.calcHandler, tabHandler: probe.mount.tabHandler, calc: probe.mount.calc, readyState: probe.mount.readyState } : null;
    rec.cssLinkAt = probe?.cssLinkAt ?? null;
    const downs = (probe?.events || []).filter(e => e.type === 'pointerdown');
    const clicks = (probe?.events || []).filter(e => e.type === 'click');
    rec.pointerdowns = downs.length; rec.clicks = clicks.length;
    // Did the control move, or the stylesheet arrive, between pointerdown and click, or was a different element hit?
    rec.shiftDuringClick = downs.some((d, i) => { const c = clicks[i]; return c && (JSON.stringify(c.calc) !== JSON.stringify(d.calc) || JSON.stringify(c.qr) !== JSON.stringify(d.qr) || c.sheet !== d.sheet); });
    rec.hitMismatch = (probe?.events || []).filter(e => e.type === 'pointerdown' && e.hit && e.target && e.hit !== e.target).length;
    rec.sheetFlippedAfterFirstPointer = downs.length > 0 && downs[0].sheet === false;
    if (rec.calcOk === false || rec.tabOk === false || rec.error) {
      rec.failureEvents = (probe?.events || []).slice(0, 12);
      rec.navigations = navigations;
      const after = await page.evaluate(() => {
        const calc = document.getElementById('calcRate'), tab = document.querySelector('[data-studio=qr]');
        const before = document.getElementById('rateResult')?.textContent || '';
        calc?.click();
        const afterCalc = document.getElementById('rateResult')?.textContent || '';
        tab?.click();
        return { calcHandler: calc ? typeof calc.onclick : 'absent', tabHandler: tab ? typeof tab.onclick : 'absent', syntheticCalc: /Quote:/.test(afterCalc) && afterCalc !== before, syntheticTab: tab?.getAttribute('aria-selected') === 'true', controller: !!navigator.serviceWorker?.controller };
      }).catch(error => ({ evalError: String(error.message).slice(0, 120) }));
      rec.after = after;
    }
  } catch (error) { rec.collectError = String(error.message).slice(0, 160); }
  await ctx.close();
  return rec;
}

const all = []; let browser;
try {
  browser = await pw[engine].launch({ headless: true });
  for (const mode of MODES) for (const width of WIDTHS) for (let i = 0; i < iterations; i++) all.push(await iteration(browser, mode, width));
} finally { if (browser) await browser.close(); await server.stop(); }

const summary = {};
for (const r of all) {
  const key = `${r.mode} @${r.width}`;
  const s = summary[key] ||= { runs: 0, calcLost: 0, tabLost: 0, errors: 0, syntheticRecovers: 0, handlersMissing: 0, sheetPendingWhenVisible: 0, shiftDuringClick: 0, hitMismatch: 0, navigations: 0 };
  s.runs++;
  if (r.calcOk === false) s.calcLost++;
  if (r.tabOk === false) s.tabLost++;
  if (r.error) s.errors++;
  if (r.after && (r.after.syntheticCalc || r.after.syntheticTab)) s.syntheticRecovers++;
  if (r.mount && (r.mount.calcHandler !== 'function' || r.mount.tabHandler !== 'function')) s.handlersMissing++;
  if (r.sheetWhenVisible === false) s.sheetPendingWhenVisible++;
  if (r.shiftDuringClick) s.shiftDuringClick++;
  if (r.hitMismatch) s.hitMismatch++;
  if ((r.navigations || 0) > 1) s.navigations++;
}
const failures = all.filter(r => r.calcOk === false || r.tabOk === false || r.error).slice(0, 6);
await fs.writeFile(`${out}/probe.json`, JSON.stringify({ engine, iterations, summary, failures, all }, null, 1));
await fs.writeFile(`${out}/summary.json`, JSON.stringify({ engine, iterations, summary, failures }));
console.log(`probe ${engine}: ${all.length} iterations`);
for (const [key, s] of Object.entries(summary)) console.log(key.padEnd(34), JSON.stringify(s));
if (failures.length) console.log('first failures:', JSON.stringify(failures.slice(0, 2)));
// Diagnostic: always exit 0 so the evidence is reported; tests/v8-studios-late-stylesheet-browser.mjs is the gate.
