/* Browser QA: Favourites / Recently used / Continue playing on the homepage and the Play directory.
   node tests/play-continue-browser.mjs [chromium|firefox|webkit]   env: PLAYWRIGHT_PACKAGE, SITE_ROOT=dist */
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const pw = await import(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const engine = process.argv[2] || 'chromium';
const repo = fileURLToPath(new URL('../', import.meta.url));
const root = process.env.SITE_ROOT ? path.resolve(process.env.SITE_ROOT) : repo;
const { createDistServer } = await import(new URL('file://' + path.join(repo, 'scripts/serve-dist.mjs')).href);
const dist = createDistServer(root, { port: 0 }); await dist.start(); const origin = dist.base.replace(/\/$/, '');
const browser = await pw[engine].launch(); let passed = 0; const failures = [];
async function check(name, fn) { try { await fn(); passed++; console.log('PASS', name); } catch (e) { failures.push(`${name}: ${e.message.split('\n')[0]}`); console.log('FAIL', name, '-', e.message.split('\n')[0]); } }
const today = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());
const s2048 = JSON.stringify({ v: [[2, 4, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], s: 64, w: false });
const word = JSON.stringify({ answer: 'crane', date: today, guesses: ['slate', 'pound'], status: 'playing' });
async function fresh(w, seed = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 500 ? 844 : 900 } }); const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } }, seed);
  return { ctx, page, errs };
}
for (const w of [1280, 390]) {
  await check(`${w}px: no progress, no Continue anywhere (directory hidden, homepage shelf has no Continue group)`, async () => {
    const { ctx, page, errs } = await fresh(w); await page.goto(origin + '/play/'); await page.waitForTimeout(300);
    assert.equal(await page.locator('#continue-playing').isVisible(), false); assert.equal(await page.getByText('Continue →').count(), 0);
    assert.equal(await page.locator('.v5-card').count(), 5, 'Play directory still lists its five games');
    await page.goto(origin + '/'); await page.waitForTimeout(500); assert.equal(await page.locator('[aria-label="Continue playing"]').count(), 0); assert.deepEqual(errs, []); await ctx.close();
  });
  await check(`${w}px: resumable 2048 and Daily Word appear; Logic Crypt / Mahjong stats do not; links go to the game`, async () => {
    const { ctx, page, errs } = await fresh(w, { it_play_2048_state: s2048, it_play_dailyword_daily: word, it_play_wordlogic_stats: '{"played":5}', 'gvt.twmj.stats': '{"hands":9}' });
    await page.goto(origin + '/play/'); await page.waitForSelector('#continue-playing:not([hidden])');
    const items = await page.locator('#continue-list a').evaluateAll(a => a.map(x => [x.textContent, x.getAttribute('href')]));
    assert.equal(items.length, 2, JSON.stringify(items)); assert.ok(items.some(i => /2048/.test(i[0]) && i[1] === '2048/')); assert.ok(items.some(i => /Daily Word/.test(i[0]) && i[1] === 'daily-word/'));
    assert.ok(!items.some(i => /Logic Crypt|Mahjong/.test(i[0])));
    const b = await page.locator('#continue-list a').first().boundingBox(); assert.ok(b.height >= 44, 'touch target');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal overflow');
    await page.locator('#continue-list a', { hasText: '2048' }).click(); await page.waitForURL(/\/play\/2048\/?$/); await page.waitForSelector('#score'); assert.equal((await page.textContent('#score')).trim(), '64', 'the game restores the saved board Continue promised'); assert.deepEqual(errs, []); await ctx.close();
  });
  await check(`${w}px: homepage shelf keeps saved favourites and recents, adds Continue playing, and Clear only empties recents`, async () => {
    const { ctx, page, errs } = await fresh(w, { 'it.discovery.favorites': JSON.stringify(['invoice-studio']), 'it.discovery.recent': JSON.stringify(['image-studio', 'invoice-studio']), it_play_2048_state: s2048 });
    await page.goto(origin + '/'); await page.waitForSelector('#discoveryShelf [aria-label="Continue playing"]');
    assert.ok(await page.locator('#discoveryShelf [aria-label="Favourites"] .pill').count() >= 1, 'favourite kept');
    assert.ok(await page.locator('#discoveryShelf [aria-label="Recently used"] .pill[data-open]').count() >= 1, 'recents kept');
    assert.equal(await page.locator('#discoveryShelf [aria-label="Continue playing"] a').getAttribute('href'), 'play/2048/');
    await page.locator('[data-clear-recent]').click(); await page.waitForTimeout(200);
    assert.equal(await page.locator('#discoveryShelf [aria-label="Recently used"]').count(), 0, 'recents cleared');
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('it.discovery.favorites'))), ['invoice-studio'], 'favourites untouched');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('it.discovery.recent')).length), 0);
    assert.equal(await page.locator('#discoveryShelf [aria-label="Continue playing"]').count(), 1, 'Continue unaffected by Clear');
    assert.deepEqual(errs, []); await ctx.close();
  });
}
await browser.close(); await dist.stop();
console.log(`\n${engine}: ${passed} passed, ${failures.length} failed`); if (failures.length) { console.log(failures.map(f => ' - ' + f).join('\n')); process.exit(1); }
