/* Browser QA for Vibe Arcade (play/vibe-arcade/).
   node tests/vibe-arcade-browser.mjs [chromium|firefox|webkit]
   env: SITE_ROOT=dist (test the built output), PLAYWRIGHT_PACKAGE, VA_ARTIFACTS (screenshots), VA_WIDTHS=320,375,... */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const pw = await import(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const engine = process.argv[2] || 'chromium';
const dir = process.env.VA_ARTIFACTS || `artifacts/vibe-arcade-${engine}`;
await fs.mkdir(dir, { recursive: true });
const root = process.env.SITE_ROOT ? path.resolve(process.env.SITE_ROOT) + '/' : fileURLToPath(new URL('../', import.meta.url));
/* Firefox has no touch emulation in Playwright (hasTouch is unsupported and mouse drags are ignored when it is on), so
   there the narrow-viewport runs use the mouse. Chromium uses real CDP touch events; WebKit uses its touch emulation. */
const realTouch = engine !== 'firefox';
const tapEl = loc => realTouch ? loc.tap() : loc.click();
const WIDTHS = (process.env.VA_WIDTHS || '320,375,390,400,460,1280').split(',').map(Number);

/* ---- the game's own pure generators, so the test can solve real puzzles ---- */
const gameSrc = fsSync.readFileSync(path.join(root, 'play/vibe-arcade/index.html'), 'utf8');
const pure = vm.createContext({ Math, Array, Object });
vm.runInContext(gameSrc.split('/*PURE-START*/')[1].split('/*PURE-END*/')[0], pure);
const DAILY_LEVEL = [16, 2, 5, 8, 11, 14, 18];
const dowOf = d => new Date(d + 'T12:00:00Z').getUTCDay();
const puzzle = (code, level) => pure[code + 'Make'](`arcade-${code}-L${level}`, level);
const dailyPuzzle = (code, day) => pure[code + 'Make'](`arcade-daily-${day}-${code}`, DAILY_LEVEL[dowOf(day)]);

/* ---- static server ---- */
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
  try {
    let f = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!f.startsWith(root.replace(/\/$/, ''))) { res.writeHead(403).end(); return; }
    if ((await fs.stat(f)).isDirectory()) f = path.join(f, 'index.html');
    let b = await fs.readFile(f);
    if (f.endsWith('.html')) b = Buffer.from(b.toString().replace(/<script async src="https:\/\/pagead2[^>]*><\/script>/g, ''));
    res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }).end(b);
  } catch { res.writeHead(404).end('nf'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const URL_ARCADE = origin + '/play/vibe-arcade/';
const browser = await pw[engine].launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });

let passed = 0; const failures = []; const matrix = [];
async function check(name, fn) {
  if (process.env.VA_ONLY && !new RegExp(process.env.VA_ONLY).test(name)) return;
  try { await fn(); passed++; console.log('PASS', name); }
  catch (e) { failures.push(`${name}: ${e.message.split('\n')[0]}`); console.log('FAIL', name, '-', e.message.slice(0, 400), (e.stack || '').split('\n').find(l => l.includes('vibe-arcade-browser')) || ''); }
}

/* Clock: real time, shifted so the page believes it is `day` (YYYY-MM-DD, local noon). The day is read from
   the __va_day key so a test can move to another day with the same storage. */
const clockScript = `(()=>{const R=Date;const t0=performance.now();let day=null;try{day=localStorage.getItem('__va_day')}catch(e){}
 if(!day)return;const base=new R(day+'T12:00:00').getTime();
 class D extends R{constructor(...a){a.length?super(...a):super(base+(performance.now()-t0))}static now(){return base+(performance.now()-t0)}}window.Date=D;})();`;

async function open({ w = 390, h = 844, touch = false, reduced = false, dark = false, init = [], day = null, hash = '', clipboard = true, noStorage = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch && realTouch, isMobile: touch && realTouch, reducedMotion: reduced ? 'reduce' : 'no-preference', colorScheme: dark ? 'dark' : 'light', timezoneId: 'Asia/Dubai', permissions: clipboard && engine === 'chromium' ? ['clipboard-read', 'clipboard-write'] : [] });
  const errs = [], external = [];
  if (day) await ctx.addInitScript(d => { try { if (!localStorage.getItem('__va_day')) localStorage.setItem('__va_day', d); } catch (e) {} }, day);
  await ctx.addInitScript(clockScript);
  if (noStorage) await ctx.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } }); });
  for (const s of init) await ctx.addInitScript(s);
  const page = await ctx.newPage(); page.setDefaultTimeout(10000);
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push('console: ' + m.text()); });
  page.on('request', r => { if (!r.url().startsWith(origin) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()); });
  await page.goto(URL_ARCADE + hash, { waitUntil: 'load' });
  return { ctx, page, errs, external };
}
const profile = p => p.evaluate(() => JSON.parse(localStorage.getItem('vibearcade:v1') || 'null'));
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const box = async p => (await p.locator('.board').boundingBox());
const center = (b, n, c) => ({ x: b.x + ((c % n) + .5) / n * b.width, y: b.y + (Math.floor(c / n) + .5) / n * b.height });

/* Pointer drag. mode "touch" dispatches real touch events through CDP (Chromium only), otherwise the mouse. */
async function drag(page, pts, mode = 'mouse') {
  if (mode === 'touch' && engine === 'chromium') {
    const cdp = await page.context().newCDPSession(page); const tp = p => [{ x: p.x, y: p.y, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(pts[0]) });
    for (const p of pts.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(p) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach(); return;
  }
  await page.mouse.move(pts[0].x, pts[0].y); await page.mouse.down();
  for (const p of pts.slice(1)) await page.mouse.move(p.x, p.y, { steps: 2 });
  await page.mouse.up();
}
async function solveVibeline(page, puz, mode) { const b = await box(page); await drag(page, puz.sol.map(c => center(b, puz.n, c)), mode); }
async function solveCarve(page, puz, mode) {
  const b = await box(page);
  for (const r of puz.sol) await drag(page, [center(b, puz.n, r.r * puz.n + r.c), center(b, puz.n, (r.r + r.h - 1) * puz.n + r.c + r.w - 1)], mode);
}
async function solveTwofold(page, puz, tap) {
  /* Once a page has received CDP touch events, mixing in Playwright's own tap() leaves a stuck touch point (the
     next taps become multi-touch and are dropped). So Chromium touch runs use CDP taps throughout. */
  const cdp = tap && engine === 'chromium' ? await page.context().newCDPSession(page) : null;
  for (let i = 0; i < puz.N; i++) {
    if (puz.given[i]) continue; const cell = page.locator(`.tcell[data-i="${i}"]`);
    const need = puz.sol[i] === 0 ? 1 : 2;
    for (let k = 0; k < need; k++) {
      if (cdp) { const b = await cell.boundingBox(), pt = [{ x: b.x + b.width / 2, y: b.y + b.height / 2, id: 1 }]; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(30); }
      else tap && realTouch ? await cell.tap() : await cell.click();
    }
  }
  if (cdp) await cdp.detach();
}
const solve = (page, code, puz, mode, tap) => code === 'vl' ? solveVibeline(page, puz, mode) : code === 'ca' ? solveCarve(page, puz, mode) : solveTwofold(page, puz, tap);
const startLevel = async (page, code) => { await page.click(`[data-act="level"][data-g="${code}"]`); await page.waitForSelector('#host .board'); };
const startDaily = async (page, code) => { await page.click(`[data-act="daily"][data-g="${code}"]`); await page.waitForSelector('#host .board'); };
const won = page => page.locator('#result').isVisible();
const GAME = { vl: 'Vibeline', tw: 'Twofold', ca: 'Carve' };

/* =============== 1. viewport matrix: layout, no overflow, no external requests, solve each game with pointer/touch =============== */
for (const w of WIDTHS) {
  const touch = w <= 460;
  await check(`${w}px${touch ? ' touch' : ' desktop'}: hub + all three games render, fit, solve; no errors, no external requests`, async () => {
    const c = await open({ w, h: touch ? 800 : 900, touch });
    const { page } = c; const row = { w, hub: 'ok', games: {} };
    assert.equal(await overflow(page), 0, 'hub horizontal overflow');
    await page.screenshot({ path: `${dir}/hub-${w}.png`, fullPage: true });
    for (const code of ['vl', 'tw', 'ca']) {
      await startLevel(page, code);
      assert.equal(await overflow(page), 0, `${code} overflow`);
      const b = await box(page); assert.ok(b.width <= w - 16 + 1 && b.x >= 0 && b.x + b.width <= w + .5, `${code} board ${JSON.stringify(b)} not inside ${w}px viewport`);
      assert.ok(Math.abs(b.width - b.height) < 2, 'board is square');
      await page.screenshot({ path: `${dir}/${code}-${w}.png`, fullPage: true });
      await solve(page, code, puzzle(code, 1), touch && realTouch ? 'touch' : 'mouse', touch);
      if (!(await won(page))) await page.screenshot({ path: `${dir}/FAIL-${code}-${w}.png`, fullPage: true });
      assert.ok(await won(page), `${GAME[code]} level 1 not solved by ${touch ? 'touch' : 'pointer'} (progress ${await page.textContent('#progress')}, status "${await page.textContent('#status')}", bad ${await page.locator('.tcell.bad').count()})`);
      assert.equal(await overflow(page), 0, `${code} result overflow`);
      await page.screenshot({ path: `${dir}/${code}-${w}-solved.png`, fullPage: true });
      row.games[code] = 'solved ' + b.width.toFixed(0) + 'px board';
      if (touch) await page.waitForTimeout(1500); // let the result card's smooth scroll finish before the next touch sequence
      await page.click('#back');
    }
    const prof = await profile(page); assert.equal(prof.total, 3); assert.equal(prof.games.vl.level, 2);
    assert.deepEqual(c.errs, []); assert.deepEqual(c.external, [], 'external requests');
    matrix.push(row); await c.ctx.close();
  });
}

/* hardest boards at the narrowest widths: still fit and stay tappable */
await check('320px: largest boards fit and cells stay >= 24px; generation time for deep levels', async () => {
  const c = await open({ w: 320, h: 700, touch: true }); const { page } = c; const out = [];
  for (const [code, lv] of [['tw', 40], ['vl', 150], ['ca', 100], ['tw', 500], ['vl', 500], ['ca', 500]]) {
    const t0 = Date.now(); await page.goto(`${URL_ARCADE}#c.${code}.${lv}.60`); await page.reload(); await page.waitForSelector('#host .board');
    const ms = Date.now() - t0; const b = await box(page); const n = await page.evaluate(() => getComputedStyle(document.querySelector('.board')).getPropertyValue('--n'));
    assert.equal(await overflow(page), 0, `${code}${lv} overflow`); assert.ok(b.width <= 320, 'board width');
    if (code === 'tw') assert.ok(b.width / +n >= 23.5, `${code} L${lv} tap target ${(b.width / +n).toFixed(1)}px < 24`); // Twofold cells are tap targets; Vibeline/Carve are drag boards
    assert.ok(ms < 4000, `${code} L${lv} took ${ms} ms`); out.push(`${code}${lv}: n=${n.trim()} cell=${(b.width / +n).toFixed(1)}px load=${ms}ms`);
  }
  console.log('   ', out.join(' | ')); assert.deepEqual(c.errs, []); await c.ctx.close();
});

/* =============== 2. controls =============== */
await check('keyboard: arrow keys solve Vibeline; Tab/Space/Enter operate Twofold; buttons reachable by Tab', async () => {
  const c = await open({ w: 390 }); const { page } = c; const puz = puzzle('vl', 1);
  await startLevel(page, 'vl');
  for (let i = 0; i < puz.N; i++) {
    const a = i === 0 ? null : puz.sol[i] - puz.sol[i - 1];
    await page.keyboard.press(i === 0 ? 'ArrowRight' : a === 1 ? 'ArrowRight' : a === -1 ? 'ArrowLeft' : a === puz.n ? 'ArrowDown' : 'ArrowUp');
  }
  assert.ok(await won(page), 'keyboard did not solve Vibeline');
  await page.click('#back'); await startLevel(page, 'tw'); const tw = puzzle('tw', 1);
  const free = [...Array(tw.N).keys()].filter(i => !tw.given[i]);
  await page.locator(`.tcell[data-i="${free[0]}"]`).focus(); await page.keyboard.press('Space');
  assert.ok(await page.locator(`.tcell[data-i="${free[0]}"] svg`).count() === 1, 'Space did not place a symbol');
  await page.keyboard.press('Enter'); assert.ok(await page.locator(`.tcell[data-i="${free[0]}"] svg .ring`).count() === 1, 'Enter did not cycle to ring');
  await page.keyboard.press('Enter'); assert.equal(await page.locator(`.tcell[data-i="${free[0]}"] svg`).count(), 0, 'third press did not clear');
  for (const id of ['undo', 'reset', 'hint']) { await page.locator('#' + id).focus(); assert.equal(await page.evaluate(() => document.activeElement.id), id); }
  await page.locator(`.tcell[data-i="${free[0]}"]`).focus(); await page.keyboard.press('Space');
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); // focus moves on without the page scrolling sideways
  assert.equal(await overflow(page), 0); assert.deepEqual(c.errs, []); await c.ctx.close();
});

await check('Vibeline: drag-back undo, Undo button, Reset, invalid moves rejected, hint progress', async () => {
  const c = await open({ w: 390, hash: '#c.vl.3.9' }); const { page } = c; const puz = puzzle('vl', 3); await page.waitForSelector('#host .board');
  const b = await box(page); const pts = puz.sol.slice(0, 6).map(x => center(b, puz.n, x));
  await drag(page, pts); assert.equal(await page.textContent('#progress'), `6/${puz.N}`);
  await drag(page, [pts[5], pts[4], pts[3]]); assert.equal(await page.textContent('#progress'), `4/${puz.N}`, 'drag back over the line should undo');
  await page.click('#undo'); assert.equal(await page.textContent('#progress'), `3/${puz.N}`);
  await page.click('#reset'); assert.equal(await page.textContent('#progress'), `0/${puz.N}`);
  await page.mouse.click(center(b, puz.n, puz.cellOf[1] === 0 ? puz.N - 1 : 0).x, center(b, puz.n, puz.cellOf[1] === 0 ? puz.N - 1 : 0).y);
  assert.match(await page.textContent('#status'), /Start on the 1/);
  await page.click('#hint'); assert.equal(await page.textContent('#hints'), '1'); assert.notEqual(await page.textContent('#progress'), `0/${puz.N}`);
  assert.deepEqual(c.errs, []); await c.ctx.close();
});

await check('Twofold: tap cycles dot/ring/empty, fixed squares locked, error highlight, Undo/Reset/Hint', async () => {
  const c = await open({ w: 375, touch: true }); const { page } = c; const puz = puzzle('tw', 1); await startLevel(page, 'tw');
  const given = [...Array(puz.N).keys()].find(i => puz.given[i]), free = [...Array(puz.N).keys()].filter(i => !puz.given[i]);
  if (given !== undefined) { await tapEl(page.locator(`.tcell[data-i="${given}"]`)); assert.match(await page.textContent('#status'), /fixed/); }
  const f = page.locator(`.tcell[data-i="${free[0]}"]`);
  await tapEl(f); assert.equal(await f.locator('.dot').count(), 1); await tapEl(f); assert.equal(await f.locator('.ring').count(), 1); await tapEl(f); assert.equal(await f.locator('svg').count(), 0);
  await tapEl(f); await page.click('#undo'); assert.equal(await f.locator('svg').count(), 0, 'undo');
  await tapEl(f); await page.click('#reset'); assert.equal(await f.locator('svg').count(), 0, 'reset');
  await page.click('#undo'); assert.equal(await f.locator('svg').count(), 1, 'reset is undoable');
  const before = await page.locator('.tcell svg').count(); await page.click('#hint'); assert.equal(await page.textContent('#hints'), '1');
  assert.ok(await page.locator('.tcell svg').count() >= before, 'hint fills a square');
  assert.deepEqual(c.errs, []); await c.ctx.close();
});

await check('Carve: drag draws, tap removes, overlap replaces, Undo/Reset/Hint, wrong rectangle flagged', async () => {
  const c = await open({ w: 390 }); const { page } = c; const puz = puzzle('ca', 1); await startLevel(page, 'ca');
  const b = await box(page), r0 = puz.sol[0];
  await drag(page, [center(b, puz.n, r0.r * puz.n + r0.c), center(b, puz.n, (r0.r + r0.h - 1) * puz.n + r0.c + r0.w - 1)]);
  assert.equal(await page.locator('.rect.ok').count(), 1);
  await page.mouse.click(center(b, puz.n, r0.r * puz.n + r0.c).x, center(b, puz.n, r0.r * puz.n + r0.c).y); assert.equal(await page.locator('.rect').count(), 0, 'tap removes');
  await page.click('#undo'); assert.equal(await page.locator('.rect').count(), 1, 'undo restores');
  await page.click('#reset'); assert.equal(await page.locator('.rect').count(), 0);
  await drag(page, [center(b, puz.n, 0), center(b, puz.n, puz.N - 1)]); assert.equal(await page.locator('.rect.bad').count(), 1, 'whole-board rectangle is wrong');
  await page.click('#reset'); await page.click('#hint'); assert.equal(await page.textContent('#hints'), '1'); assert.equal(await page.locator('.rect.ok').count(), 1);
  assert.deepEqual(c.errs, []); await c.ctx.close();
});

/* =============== 3. XP, hints, badges =============== */
await check('XP: first clear awards formula XP, replay awards none; hints reduce XP; level advances; badge toast', async () => {
  const c = await open({ w: 390 }); const { page } = c; await startLevel(page, 'vl');
  await solve(page, 'vl', puzzle('vl', 1)); assert.ok(await won(page));
  assert.match(await page.textContent('#resultSub'), /\+32 XP · no hints/); assert.equal((await profile(page)).xp, 32);
  assert.match(await page.textContent('#toasts'), /Badge earned: First thread/); assert.ok((await profile(page)).badges.first);
  await page.click('#prevL').catch(() => {}); // level 1 has no previous
  await page.click('#again'); await page.waitForSelector('#host .board'); assert.equal(await page.textContent('#lvlLabel'), 'Level 2');
  await page.click('#prevL'); await solve(page, 'vl', puzzle('vl', 1)); assert.match(await page.textContent('#resultSub'), /Replay, no XP/); assert.equal((await profile(page)).xp, 32);
  await page.click('#back'); await page.click('[data-act="level"][data-g="vl"]'); await page.waitForSelector('#host .board'); // Continue -> level 2
  await page.click('#hint'); await page.click('#hint'); assert.equal(await page.textContent('#hints'), '2');
  while (!(await won(page))) await page.click('#hint');
  const hints = +(await page.textContent('#hints')); const gained = (await profile(page)).xp - 32;
  assert.equal(gained, Math.max(5, 20 + 4 - 3 * hints), `XP with ${hints} hints`); assert.equal((await profile(page)).cleanRun, 0);
  assert.deepEqual(c.errs, []); await c.ctx.close();
});

await check('badges + ranks: Ten down, All-rounder, Tracer rank toast', async () => {
  const seed = JSON.stringify({ xp: 90, total: 9, cleanRun: 4, streak: { count: 0, last: '', freezes: 0 }, games: { vl: { level: 10, cleared: 9, best: {} }, tw: { level: 2, cleared: 1, best: {} }, ca: { level: 1, cleared: 0, best: {} } }, daily: {}, badges: {}, flags: {} });
  const c = await open({ w: 390, init: [`try{if(!localStorage.getItem('vibearcade:v1'))localStorage.setItem('vibearcade:v1',${JSON.stringify(seed)})}catch(e){}`] }); const { page } = c;
  await startLevel(page, 'ca'); await solve(page, 'ca', puzzle('ca', 1)); assert.ok(await won(page));
  const t = await page.textContent('#toasts'); assert.match(t, /New rank: Tracer/); assert.match(t, /Ten down/); assert.match(t, /All-rounder/); assert.match(t, /Clean sweep/);
  const p = await profile(page); assert.equal(p.total, 10); assert.ok(p.badges.ten && p.badges.round && p.badges.clean);
  await page.click('#back'); assert.match(await page.textContent('#hub'), /Tracer/); assert.match(await page.textContent('#hub'), /Badges · 4\/9/);
  await c.ctx.close();
});

/* =============== 4. daily challenge + streak =============== */
await check('daily: deterministic puzzle by weekday, XP bonus, streak 1 -> 2, replay gives no XP and no double count', async () => {
  const d1 = '2026-10-12', d2 = '2026-10-13'; const c = await open({ w: 390, day: d1 }); const { page } = c;
  assert.match(await page.textContent('#hub'), /Today’s challenge/); await startDaily(page, 'vl');
  assert.equal(await page.textContent('#modeLabel'), 'Daily'); await solve(page, 'vl', dailyPuzzle('vl', d1)); assert.ok(await won(page), 'daily vl not solved');
  const lv = DAILY_LEVEL[dowOf(d1)]; assert.match(await page.textContent('#resultSub'), new RegExp(`\\+${Math.max(5, 20 + Math.min(80, 2 * lv) + 10 + 25)} XP.*streak 1 day`));
  let p = await profile(page); assert.equal(p.streak.count, 1); assert.equal(p.streak.last, d1); assert.ok(p.daily[d1].vl);
  await page.click('#again'); assert.match(await page.textContent('#hub'), /today done/); assert.match(await page.textContent('#hub'), /Done \d+:\d\d/);
  await startDaily(page, 'tw'); await solve(page, 'tw', dailyPuzzle('tw', d1)); assert.ok(await won(page)); p = await profile(page); assert.equal(p.streak.count, 1, 'second daily same day must not add to streak');
  await page.evaluate(d => localStorage.setItem('__va_day', d), d2); await page.reload(); assert.match(await page.textContent('#hub'), /play today to keep it/);
  await startDaily(page, 'ca'); await solve(page, 'ca', dailyPuzzle('ca', d2)); assert.ok(await won(page)); p = await profile(page); assert.equal(p.streak.count, 2); assert.ok(p.badges.first);
  assert.deepEqual(c.errs, []); await c.ctx.close();
});

await check('streak: gap with no freeze resets to 1; freeze earned at 5 and spent to bridge a missed day', async () => {
  const mk = (count, last, freezes) => JSON.stringify({ xp: 0, total: 0, cleanRun: 0, streak: { count, last, freezes }, games: { vl: { level: 1, cleared: 0, best: {} }, tw: { level: 1, cleared: 0, best: {} }, ca: { level: 1, cleared: 0, best: {} } }, daily: {}, badges: {}, flags: {} });
  const run = async (seed, day) => { const c = await open({ w: 390, day, init: [`try{localStorage.getItem('vibearcade:v1')||localStorage.setItem('vibearcade:v1',${JSON.stringify(seed)})}catch(e){}`] }); const { page } = c;
    const hubBefore = await page.textContent('#hub'); await startDaily(page, 'ca'); await solve(page, 'ca', dailyPuzzle('ca', day)); assert.ok(await won(page)); const p = await profile(page); await c.ctx.close(); return { p, hubBefore }; };
  let r = await run(mk(6, '2026-10-10', 0), '2026-10-13'); assert.equal(r.p.streak.count, 1, 'two missed days, no freeze'); assert.match(r.hubBefore, /0 day streak/);
  r = await run(mk(4, '2026-10-12', 0), '2026-10-13'); assert.equal(r.p.streak.count, 5); assert.equal(r.p.streak.freezes, 1, 'freeze earned at 5');
  r = await run(mk(5, '2026-10-11', 1), '2026-10-13'); assert.equal(r.p.streak.count, 6, 'one missed day bridged'); assert.equal(r.p.streak.freezes, 0); assert.match(r.hubBefore, /5 day streak/);
});

/* =============== 5. sharing / challenge links =============== */
await check('sharing: result links, copy challenge link (clipboard and fallback), friend challenge banner and result', async () => {
  const c = await open({ w: 390 }); const { page } = c; await startLevel(page, 'vl'); await solve(page, 'vl', puzzle('vl', 1)); assert.ok(await won(page));
  const hrefs = await page.evaluate(() => ['sx', 'swa', 'stg', 'sli', 'sfb'].map(i => document.getElementById(i).href));
  const link = `${URL_ARCADE}#c.vl.1.`; for (const h of hrefs) assert.ok(decodeURIComponent(h).includes(link), h);
  assert.ok(hrefs[0].startsWith('https://twitter.com/intent/tweet') && hrefs[1].startsWith('https://wa.me/') && hrefs[2].startsWith('https://t.me/share') && hrefs[3].includes('linkedin.com') && hrefs[4].includes('facebook.com'));
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#result a[target]')].map(a => a.rel)), Array(5).fill('noopener noreferrer'));
  if (engine === 'chromium') { await page.click('#challengeBtn'); await page.waitForFunction(() => document.getElementById('challengeBtn').textContent === 'Copied');  const clip = await page.evaluate(() => navigator.clipboard.readText()); assert.ok(clip.includes('#c.vl.1.') && /I cleared Vibeline level 1/.test(clip), clip); }
  const m = /#c\.vl\.1\.(\d+)/.exec(hrefs[1] && decodeURIComponent(hrefs[1])); assert.ok(m);
  await c.ctx.close();
  const f = await open({ w: 390, clipboard: false, init: ['Object.defineProperty(navigator,"clipboard",{value:undefined,configurable:true})'] }); await startLevel(f.page, 'vl'); await solve(f.page, 'vl', puzzle('vl', 1));
  await f.page.click('#challengeBtn'); await f.page.waitForFunction(() => /Copied|Select and copy/.test(document.getElementById('challengeBtn').textContent)); assert.deepEqual(f.errs, []); await f.ctx.close();
  const h = await open({ w: 390, hash: '#c.tw.2.1' }); await h.page.waitForSelector('#host .board');
  assert.match(await h.page.textContent('#challenge'), /A friend cleared this level in 0:01/); assert.equal(await h.page.textContent('#lvlLabel'), 'Level 2');
  await solve(h.page, 'tw', puzzle('tw', 2)); assert.ok(await won(h.page)); assert.match(await h.page.textContent('#resultSub'), /friend’s time of 0:01 still stands|beat your friend/); assert.deepEqual(h.errs, []); await h.ctx.close();
});

await check('challenge hash hardening: junk/script/huge values never break the hub or run code', async () => {
  for (const hash of ['#c.vl.1.<img src=x onerror=alert(1)>', '#c.xx.1.1', '#c.vl.-1.5', '#c.vl.1', '#c.tw.99999999999999999999.9', '#c.ca.3.' + '9'.repeat(400), '#c.vl.0.5']) {
    const c = await open({ w: 390, hash }); const { page } = c; await page.waitForTimeout(400);
    const banner = (await page.locator('#challenge').isVisible()) ? await page.textContent('#challenge') : '';
    assert.ok(!/NaN|Infinity|undefined/.test(banner), `${hash} -> banner "${banner}"`); assert.deepEqual(c.errs, [], hash); assert.equal(await page.locator('#challenge img').count(), 0); await c.ctx.close();
  }
});

/* =============== 6. persistence, migration, privacy =============== */
await check('persistence: progress and best times survive reload; layout state restored on hub', async () => {
  const c = await open({ w: 390 }); const { page } = c; await startLevel(page, 'tw'); await solve(page, 'tw', puzzle('tw', 1)); assert.ok(await won(page));
  await page.reload(); const p = await profile(page); assert.equal(p.games.tw.level, 2); assert.ok(p.games.tw.best['1']); assert.equal(p.xp, 32);
  assert.match(await page.textContent('#hub'), /32 XP/); assert.match(await page.textContent('#hub'), /Level 2/); assert.match(await page.textContent('#hub'), /1 cleared/); await c.ctx.close();
});

await check('migration: legacy vibeline:v1 imported once into vibearcade:v1, original untouched, no retroactive XP, existing arcade data never overwritten', async () => {
  const legacy = JSON.stringify({ level: 14, best: { 1: { t: 9000, h: 0 }, 7: { t: 41000, h: 2 }, bad: { t: 1 }, 3: { t: -5 }, 4: 'x' } });
  const c = await open({ w: 390, init: [`try{if(!sessionStorage.getItem('__seeded')){localStorage.setItem('vibeline:v1',${JSON.stringify(legacy)});sessionStorage.setItem('__seeded','1')}}catch(e){}`] }); const { page } = c;
  assert.match(await page.textContent('#hub'), /Level 14/); assert.match(await page.textContent('#hub'), /13 cleared/); assert.match(await page.textContent('#hub'), /0 XP/);
  assert.equal(await page.evaluate(() => localStorage.getItem('vibeline:v1')), legacy, 'legacy key untouched'); assert.equal(await profile(page), null, 'nothing is written until the player plays');
  await startLevel(page, 'vl'); assert.equal(await page.textContent('#lvlLabel'), 'Level 14', 'unlocked level carried over');
  for (let i = 0; i < 13; i++) await page.click('#prevL'); assert.equal(await page.textContent('#lvlLabel'), 'Level 1');
  await solve(page, 'vl', puzzle('vl', 1)); assert.ok(await won(page)); assert.match(await page.textContent('#resultSub'), /Replay, no XP/, 'a migrated, already-cleared level gives no XP');
  const p = await profile(page);
  assert.equal(p.xp, 0); assert.equal(p.total, 0); assert.equal(p.games.vl.level, 14); assert.equal(p.games.vl.cleared, 13);
  assert.ok(p.games.vl.best['1'].t <= 9000, 'imported best time kept or improved'); assert.deepEqual(p.games.vl.best['7'], { t: 41000, h: 2 });
  for (const k of ['bad', '3', '4']) assert.equal(p.games.vl.best[k], undefined, 'invalid legacy entry ' + k + ' dropped');
  assert.equal(await page.evaluate(() => localStorage.getItem('vibeline:v1')), legacy, 'legacy key still untouched after saving');
  await page.evaluate(() => localStorage.setItem('vibeline:v1', JSON.stringify({ level: 99, best: {} }))); await page.reload();
  assert.match(await page.textContent('#hub'), /Level 14/, 'existing vibearcade:v1 must win over the legacy key'); assert.deepEqual(c.errs, []); await c.ctx.close();
});

await check('migration: corrupt / hostile legacy data is ignored safely', async () => {
  for (const bad of ['not json', '{"level":"x"}', '{"level":-3}', '{"level":1e999}', '{"level":99999999999999999999}', '[]', 'null', '{"level":5,"best":[1,2]}', '{"level":5,"best":{"__proto__":{"t":1},"constructor":{"t":1}}}']) {
    const c = await open({ w: 390, init: [`try{localStorage.setItem('vibeline:v1',${JSON.stringify(bad)})}catch(e){}`] });
    const txt = await c.page.textContent('#hub'); assert.ok(!/NaN|undefined|Infinity/.test(txt), bad + ' -> ' + txt.slice(0, 80)); assert.deepEqual(c.errs, [], bad);
    assert.equal(await c.page.evaluate(() => ({}).t), undefined, 'prototype not polluted'); await c.ctx.close();
  }
});

await check('storage denied: game still fully playable, no errors', async () => {
  const c = await open({ w: 390, noStorage: true }); const { page } = c; await startLevel(page, 'ca'); await solve(page, 'ca', puzzle('ca', 1)); assert.ok(await won(page)); assert.deepEqual(c.errs, []); await c.ctx.close();
});

await check('leaderboards disabled: no window.claude use, no network, note shown', async () => {
  const calls = []; const c = await open({ w: 390, init: ['window.claude={use(n){window.__claudeUse=(window.__claudeUse||[]).concat(n);return Promise.resolve({})}}'] }); const { page } = c;
  await startLevel(page, 'vl'); assert.match(await page.textContent('#lbNote'), /disabled/); await solve(page, 'vl', puzzle('vl', 1));
  assert.equal(await page.evaluate(() => window.__claudeUse), undefined, 'must never touch window.claude'); assert.deepEqual(c.external, []); assert.equal(await page.locator('#lbList li').count(), 0); void calls; await c.ctx.close();
});

/* =============== 7. themes / motion =============== */
await check('dark mode + reduced motion render without overflow; contrast tokens applied', async () => {
  const c = await open({ w: 375, dark: true, reduced: true }); const { page } = c; const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.notEqual(bg, 'rgb(232, 237, 243)', 'dark theme not applied'); await page.screenshot({ path: `${dir}/hub-dark-375.png`, fullPage: true });
  await startLevel(page, 'vl'); await solve(page, 'vl', puzzle('vl', 1)); assert.ok(await won(page)); await page.screenshot({ path: `${dir}/vl-dark-solved-375.png`, fullPage: true });
  assert.equal(await overflow(page), 0); assert.deepEqual(c.errs, []); await c.ctx.close();
});

/* =============== 8. Play directory, discovery search, Mahjong =============== */
await check('Play directory lists Vibe Arcade; Mahjong Solitaire card present; no four-player Mahjong', async () => {
  const c = await open({ w: 390 }); const { page } = c; await page.goto(origin + '/play/', { waitUntil: 'networkidle' });
  const hrefs = await page.locator('.v5-card a.btn').evaluateAll(a => a.map(x => x.getAttribute('href')));
  assert.deepEqual(hrefs, ['mahjong-solitaire/', 'word-logic/', '2048/', 'daily-word/', 'vibe-arcade/']);
  assert.ok(!/four-player|multiplayer|friends/i.test(await page.innerText('main'))); assert.equal(await overflow(page), 0);
  await page.click('a[href="vibe-arcade/"]'); await page.waitForURL(/\/play\/vibe-arcade\/$/); await page.waitForSelector('#hub h1'); assert.equal(await page.textContent('#hub h1'), 'Vibe Arcade'); assert.deepEqual(c.errs, []); await c.ctx.close();
});

await check('discovery search finds Vibe Arcade for its game names; mahjong queries unchanged and never reach four-player', async () => {
  const c = await open({ w: 1280, h: 900 }); const { page } = c; await page.goto(origin + '/', { waitUntil: 'networkidle' });
  for (const q of ['vibe arcade', 'vibeline', 'twofold', 'carve', 'logic puzzle']) {
    await page.fill('#toolSearch', q); await page.waitForTimeout(250);
    const links = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => new URL(a.href, location.href).pathname));
    assert.ok(links.includes('/play/vibe-arcade/'), `"${q}" should offer /play/vibe-arcade/; got ${links.filter(l => /play/.test(l))}`);
  }
  for (const q of ['mahjong', 'solitaire', 'mahjong solitaire', 'multiplayer', 'four-player mahjong']) {
    await page.fill('#toolSearch', q); await page.waitForTimeout(200);
    const links = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => new URL(a.href, location.href).pathname));
    assert.deepEqual(links.filter(l => /^\/play\/mahjong(\/|$)/.test(l)), [], q);
    if (/solitaire/.test(q) || q === 'mahjong') assert.ok(links.includes('/play/mahjong-solitaire/'), q);
  }
  assert.deepEqual(c.errs, []); await c.ctx.close();
});

await check('service worker precaches the arcade page and stylesheet', async () => {
  const sw = await (await fetch(origin + '/sw.js')).text(); assert.ok(sw.includes('"./play/vibe-arcade/index.html"') && sw.includes('"./play/vibe-arcade/site-chrome.css"'));
  assert.ok(fsSync.existsSync(path.join(root, 'play/vibe-arcade/site-chrome.css')));
});

await browser.close(); server.close();
console.log('\nBROWSER MATRIX (' + engine + ')'); for (const r of matrix) console.log(' ', r.w + 'px', JSON.stringify(r.games));
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log(failures.map(f => ' - ' + f).join('\n')); process.exit(1); }
