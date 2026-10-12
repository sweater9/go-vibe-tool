/* Read-only browser QA of the live V8 preview.
   Usage: node tests/live-review-qa.mjs <chromium|firefox|webkit>   env: REVIEW_URL, QA_OUT, PLAYWRIGHT_PACKAGE
   Exit codes: 0 all passed, 1 functional failure(s), 3 NETWORK failure (site unreachable) — never mixed. */
import fs from 'node:fs/promises';
const pw = await import(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const engine = process.argv[2] || 'chromium';
if (!process.env.REVIEW_URL) { console.error('REVIEW_URL required'); process.exit(2); }
const url = process.env.REVIEW_URL.replace(/\/?$/, '/'), out = process.env.QA_OUT || 'artifacts/live-qa';
await fs.mkdir(out, { recursive: true });
const NET = /net::ERR_|NS_ERROR_(NET|CONNECTION|UNKNOWN_HOST)|ERR_NAME_NOT_RESOLVED|Timeout .* exceeded.*(goto|navigat)|Could not connect|ECONN|ENOTFOUND|SSL|CERT/i;
const browser = await pw[engine].launch({ headless: true });
const results = []; let networkError = null, shot = 0;
const PRIV = ['Your Data.', 'Your Browser.', 'Your Control.', 'Our tools also work without an internet connection, and no account is required.'];
async function run(label, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.tracing.start({ screenshots: true, snapshots: true });
  const page = await ctx.newPage(), errs = []; page.setDefaultTimeout(20000);
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/pagead|googlesyndication|favicon/.test(m.text() + (m.location().url || ''))) errs.push('console: ' + m.text()); });
  let failed = 0;
  async function check(name, fn) {
    const n = `${label}: ${name}`;
    try { await fn(); results.push({ name: n, ok: true }); console.log('PASS', n); }
    catch (e) {
      const isNet = NET.test(e.message); failed++;
      if (isNet && !networkError) networkError = e.message.split('\n')[0];
      results.push({ name: n, ok: false, kind: isNet ? 'network' : 'functional', detail: e.message.split('\n').slice(0, 3).join(' | ') });
      console.log(`FAIL [${isNet ? 'NETWORK' : 'FUNCTIONAL'}]`, n, '—', e.message.split('\n')[0]);
      await page.screenshot({ path: `${out}/${engine}-${label}-FAIL-${++shot}.png` }).catch(() => {});
    }
  }
  const eq = (a, b, m) => { if (a !== b) throw new Error(`${m}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
  const ok = (c, m) => { if (!c) throw new Error(m); };
  const top = s => page.evaluate(q => { const e = document.querySelector(q); return e ? Math.round(e.getBoundingClientRect().top + scrollY) : null }, s);
  // Navigation-heavy checks use a fresh context each: repeated full-page navigations inside one WebKit page have crashed/hung it in CI
  // (same pattern as tests/v8-browser.mjs), which is a harness limitation, not a site defect. Assertions are unchanged.
  async function isolated(fn) { const c = await browser.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage(); p.setDefaultTimeout(20000);
    try { await fn(p); } catch (e) { await p.screenshot({ path: `${out}/${engine}-${label}-FAIL-iso-${++shot}.png` }).catch(() => {}); throw e; } finally { await c.close(); } }
  await check('homepage loads', async () => { const r = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }); ok(r && r.ok(), 'HTTP ' + (r && r.status())); await page.waitForSelector('.cat-tile'); });
  if (networkError) { await ctx.tracing.stop({ path: `${out}/${engine}-${label}-trace.zip` }); await ctx.close(); return; }
  const body = await page.locator('body').innerText();
  await check('nine category tiles', async () => eq(await page.locator('.cat-tile').count(), 9, 'tile count'));
  await check('intro before tiles; search below tiles', async () => { const [a, b, c] = [await top('.hero'), await top('#categoryGrid'), await top('#toolSearch')]; ok(a !== null && b !== null && c !== null && a < b && b < c, `hero ${a} tiles ${b} search ${c}`); });
  await check('tiles compact (44–140px tall) and links', async () => {
    const t = await page.evaluate(() => [...document.querySelectorAll('.cat-tile')].map(e => { const r = e.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width), href: e.getAttribute('href') } }));
    ok(t.every(x => x.h >= 44 && x.h <= 140 && x.w >= 44), 'tile sizes ' + JSON.stringify(t.map(x => [x.w, x.h])));
    ok(t.every(x => /^\?category=/.test(x.href || '')), 'tile hrefs ' + t.map(x => x.href)); });
  await check('no "Start with these"', async () => ok(!/start with these/i.test(body), 'found'));
  await check('no catalogue on homepage', async () => eq(await page.locator('#toolCatalog .toolcard').count(), 0, 'cards'));
  await check('"50+" wording, no exact public total', async () => ok(/50\+\s[^.\n]{0,40}tools/i.test(body) && !/\b5[1-9] (active )?tools\b/i.test(body), 'wording'));
  await check('full approved privacy wording', async () => ok(PRIV.every(s => body.replace(/\s+/g, ' ').includes(s)), 'missing privacy text'));
  await check('no horizontal overflow', async () => ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0, 'overflow'));
  await page.screenshot({ path: `${out}/${engine}-${label}-home.png` });
  await page.screenshot({ path: `${out}/${engine}-${label}-home-full.png`, fullPage: true });
  await check('PDF & Tables label (no "Files & PDF")', async () => { ok(/PDF & Tables/.test(await page.locator('.cat-tile[data-cat="files-pdf"]').innerText()), 'label'); ok(!/Files & PDF/.test(body), 'old label present'); });
  await check('PDF & Tables opens the two correct tools at ?category=files-pdf', async () => {
    await page.locator('.cat-tile[data-cat="files-pdf"]').click(); await page.waitForSelector('#categoryTools .toolcard');
    const ids = await page.locator('#categoryTools .toolcard').evaluateAll(e => e.map(x => x.dataset.tool)).then(a => a.sort());
    eq(ids.join(','), 'pdf-studio,table-formatter', 'tools'); ok(/\?category=files-pdf$/.test(page.url()), page.url());
    await page.screenshot({ path: `${out}/${engine}-${label}-pdf-tables.png` }); });
  await check('Back returns to homepage; Forward returns to category', async () => {
    await page.goBack(); await page.waitForSelector('.cat-tile'); ok(!/category=/.test(page.url()), 'url ' + page.url()); eq(await page.locator('.cat-tile').count(), 9, 'tiles after back');
    await page.goForward(); await page.waitForSelector('#categoryTools .toolcard'); ok(/category=files-pdf/.test(page.url()), 'url ' + page.url()); });
  await check('tool opens from category view', async () => {
    await page.locator('#categoryTools .toolcard .tool-open, #categoryTools .toolcard .btn').first().click(); await page.waitForSelector('#workspace.active');
    await page.screenshot({ path: `${out}/${engine}-${label}-tool-open.png` }); });
  await check('direct category URL works', async () => isolated(async p => {
    await p.goto(url + '?category=files-pdf', { waitUntil: 'networkidle' }); eq(await p.locator('#categoryTools .toolcard').count(), 2, 'direct cards'); }));
  await check('unknown category falls back to homepage', async () => isolated(async p => {
    await p.goto(url + '?category=does-not-exist', { waitUntil: 'networkidle' }); await p.waitForSelector('.cat-tile'); eq(await p.locator('#categoryTools .toolcard').count(), 0, 'no category cards'); }));
  const catIds = await page.evaluate(() => [...document.querySelectorAll('.cat-tile')].map(x => x.dataset.cat)).catch(() => []);
  await check('every category link (from the tile hrefs) loads a non-empty view', async () => {
    ok(catIds.length === 9, 'ids ' + catIds.length);
    for (const id of catIds) await isolated(async p => { await p.goto(`${url}?category=${id}`, { waitUntil: 'domcontentloaded' }); await p.waitForSelector('#categoryTools .toolcard'); ok((await p.locator('#categoryTools .toolcard').count()) > 0, 'empty ' + id); }); });
  await check('search finds Image Studio for "compress an image"', async () => isolated(async p => {
    await p.goto(url, { waitUntil: 'networkidle' }); await p.fill('#toolSearch', 'compress an image'); await p.waitForSelector('#toolCatalog .toolcard');
    ok((await p.locator('#toolCatalog .toolcard strong').allTextContents()).some(x => /image studio/i.test(x)), 'no Image Studio'); await p.screenshot({ path: `${out}/${engine}-${label}-search.png` }); }));
  await check('no console or page errors', async () => ok(errs.length === 0, errs.join(' ; ').slice(0, 400)));
  await ctx.tracing.stop(failed ? { path: `${out}/${engine}-${label}-trace.zip` } : undefined); await ctx.close();
}
try { for (const [l, w, h] of [['desktop', 1440, 900], ['mobile', 390, 844]]) await run(l, w, h); } finally { await browser.close(); }
const functional = results.filter(r => !r.ok && r.kind === 'functional'), network = results.filter(r => !r.ok && r.kind === 'network');
const summary = { engine, url, passed: results.filter(r => r.ok).length, total: results.length, functionalFailures: functional.length, networkFailures: network.length, networkError, results };
await fs.writeFile(`${out}/${engine}-report.json`, JSON.stringify(summary, null, 1));
console.log(`\n${engine}: ${summary.passed}/${summary.total} passed; functional failures ${functional.length}; network failures ${network.length}`);
process.exit(network.length || networkError ? 3 : functional.length ? 1 : 0);
