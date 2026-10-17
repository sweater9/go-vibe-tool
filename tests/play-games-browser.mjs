/* Browser tests for 2048 Challenge, Daily Word Challenge and the Play hub (incl. Mahjong Solitaire).
   node tests/play-games-browser.mjs [chromium|firefox|webkit]   env: PLAY_BASE_URL (test a deployed site; skips offline checks), PLAYWRIGHT_PACKAGE, PLAY_ARTIFACTS */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateGuess, dailyAnswer, shareText } from '../play/daily-word/engine.mjs';
import { fromValues, move as engineMove, values as engineValues } from '../play/2048/engine.mjs';
import { ANSWERS } from '../play/daily-word/words.mjs';
const pw = await import(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const engine = process.argv[2] || 'chromium';
const live = !!process.env.PLAY_BASE_URL;
const dir = process.env.PLAY_ARTIFACTS || `artifacts/play-games-${engine}`;
await fs.mkdir(dir, { recursive: true });
const root = process.env.SITE_ROOT ? path.resolve(process.env.SITE_ROOT) + '/' : fileURLToPath(new URL('../', import.meta.url)); // SITE_ROOT=dist runs the suite against the built output
let server, base, serverPort = 0; const sockets = new Set();
if (live) base = process.env.PLAY_BASE_URL.replace(/\/?$/, '/');
else {
  server = http.createServer(async (req, res) => {
    try {
      let f = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!f.startsWith(root.replace(/\/$/, ''))) { res.writeHead(403).end(); return; }
      if ((await fs.stat(f)).isDirectory()) f = path.join(f, 'index.html');
      let b = await fs.readFile(f);
      if (f.endsWith('.html')) b = Buffer.from(b.toString().replace(/<script async src="https:\/\/pagead2[^>]*><\/script>/g, ''));
      const t = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
      res.writeHead(200, { 'Content-Type': t[path.extname(f)] || 'application/octet-stream' }).end(b);
    } catch { res.writeHead(404).end('nf'); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); server.on('connection', s => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  serverPort = server.address().port; base = `http://127.0.0.1:${serverPort}/`;
}
const stopServer = () => new Promise(r => { server.close(() => r()); for (const s of sockets) s.destroy(); });
const startServer = () => new Promise(r => server.listen(serverPort, '127.0.0.1', r));
const browser = await pw[engine].launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
let passed = 0; const failures = [];
async function check(name, fn) { try { await fn(); passed++; console.log('PASS', name); } catch (e) { failures.push(`${name}: ${e.message.split('\n')[0]} @${((e.stack || '').split('\n').find(l => l.includes('play-games-browser')) || '').trim().replace(/.*play-games-browser\.mjs/, 'line')}`); console.log('FAIL', name, '—', e.message.split('\n').slice(0, 3).join(' | ')); } }
const PLAY_GAME_HREFS = Object.freeze(['mahjong-solitaire/', 'word-logic/', '2048/', 'daily-word/', 'vibe-arcade/']);
const PLAY_GAME_COUNT = PLAY_GAME_HREFS.length;
const PLAY_OFFLINE_ASSETS = Object.freeze(['/play/index.html', '/play/2048/index.html', '/play/daily-word/words.js', '/play/daily-word/app.js', '/play/games.css', '/play/mahjong-solitaire/index.html', '/play/mahjong-solitaire/solitaire.css', '/play/mahjong-solitaire/solitaire.js', '/play/mahjong-solitaire/engine.js', '/play/vibe-arcade/index.html', '/play/vibe-arcade/site-chrome.css']);
const FIXED_DAY = '2026-10-12', ANSWER = dailyAnswer(FIXED_DAY, ANSWERS);
const fixDate = ms => `(()=>{const R=Date,F=${ms};class D extends R{constructor(...a){a.length?super(...a):super(F)}static now(){return F}}window.Date=D;})();`;
const noon = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0).getTime();
async function ctxFor({ w, h, touch = false, reduced = false, init = [] }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  for (const s of init) await ctx.addInitScript(s);
  await ctx.tracing.start({ screenshots: true, snapshots: true });
  const page = await ctx.newPage(); page.setDefaultTimeout(15000);
  const errs = []; page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/pagead|googlesyndication|favicon/.test(m.text())) errs.push('console: ' + m.text()); });
  return { ctx, page, errs };
}
async function closeCtx(c, failed) { await c.ctx.tracing.stop(failed ? { path: `${dir}/trace-${Date.now()}.zip` } : undefined); await c.ctx.close(); }
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const setLS = (p, k, v) => p.evaluate(([k, v]) => localStorage.setItem(k, v), [k, v]);
const getLS = (p, k) => p.evaluate(k => localStorage.getItem(k), k);
const board2048 = p => p.evaluate(() => window.game2048.state.grid.map(r => r.map(t => (t ? t.value : 0))));
const seed2048 = async (p, v, s = 0, w = false) => { await setLS(p, 'it_play_2048_state', JSON.stringify({ v, s, w })); await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForSelector('.g2048-tile'); };
const EMPTY = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
/** What the engine says the board must be after these moves (random source fixed to `r`). */
const expectBoard = (start, dirs, r) => { let s = fromValues(start); for (const d of dirs) { const m = engineMove(s, d, () => r); if (m.moved) s = m.state; } return engineValues(s.grid); };

try {
  for (const [label, w, h, touch] of [['desktop', 1280, 900, false], ['mobile', 390, 844, true]]) {
    // ---------------- Play hub ----------------
    await check(`${label}: Play hub lists all ${PLAY_GAME_COUNT} solo games and no four-player Mahjong`, async () => {
      const c = await ctxFor({ w, h, touch }); const p = c.page;
      await p.goto(base + 'play/', { waitUntil: 'networkidle' });
      assert.equal(await p.locator('.hero-stats strong').first().innerText(), String(PLAY_GAME_COUNT));
      assert.match(await p.locator('.hero-stats span').first().innerText(), new RegExp(`${PLAY_GAME_COUNT}\\s*Solo Games`, 'i'));
      const hrefs = await p.locator('.v5-card a.btn').evaluateAll(a => a.map(x => x.getAttribute('href')));
      assert.deepEqual(hrefs, PLAY_GAME_HREFS);
      assert.equal(await p.locator('.v5-card').count(), PLAY_GAME_COUNT); assert.equal(await p.locator('a[href="mahjong/"]').count(), 0, 'no multiplayer Mahjong link'); assert.ok((await overflow(p)) <= 0, 'overflow');
      const sol = p.locator('.v5-card', { has: p.locator('a[href="mahjong-solitaire/"]') }); assert.match(await sol.locator('h3').innerText(), /Mahjong Solitaire/i); assert.match(await sol.innerText(), /Offline Play/i);
      await sol.locator('a.btn').click(); await p.waitForURL(/\/play\/mahjong-solitaire\/$/); await p.waitForFunction(() => document.querySelectorAll('.sol-tile').length > 0);
      assert.deepEqual(c.errs, []); await p.screenshot({ path: `${dir}/hub-${label}.png`, fullPage: true }); await closeCtx(c);
    });
    // ---------------- 2048 ----------------
    await check(`${label}: 2048 layout, controls, no overflow`, async () => {
      const c = await ctxFor({ w, h, touch }); const p = c.page;
      await p.goto(base + 'play/2048/', { waitUntil: 'networkidle' });
      assert.equal(await p.locator('.g2048-cell').count(), 16); assert.equal(await p.locator('.g2048-tile').count(), 2);
      assert.equal(await p.locator('#score').innerText(), '0'); assert.equal(await p.locator('#btnUndo').isDisabled(), true);
      assert.ok((await overflow(p)) <= 0); const bb = await p.locator('#board').boundingBox(); assert.ok(Math.abs(bb.width - bb.height) < 2 && bb.width <= w, 'square responsive board');
      for (const sel of ['#btnNew', '#btnUndo', '[data-dir="up"]', '[data-dir="left"]', '[data-dir="down"]', '[data-dir="right"]']) { const b = await p.locator(sel).boundingBox(); assert.ok(b.width >= 44 && b.height >= 44, `${sel} touch target ${b.width}x${b.height}`); }
      assert.ok(await p.getAttribute('#board', 'aria-label').then(x => /arrow|swipe/i.test(x))); assert.ok((await p.locator('#boardText').innerText()).includes('Row 1'));
      await p.screenshot({ path: `${dir}/2048-${label}.png` }); assert.deepEqual(c.errs, []); await closeCtx(c);
    });
    await check(`${label}: 2048 keyboard, merging, scoring, undo, best score and persistence`, async () => {
      const c = await ctxFor({ w, h, touch, init: ['Math.random=()=>0.0;'] }); const p = c.page;
      await p.goto(base + 'play/2048/', { waitUntil: 'networkidle' });
      await seed2048(p, [[2, 2, 4, 4], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
      await p.keyboard.press('ArrowLeft');
      let b = await board2048(p); assert.deepEqual(b, expectBoard([[2, 2, 4, 4], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], ['left'], 0), 'UI matches the engine'); assert.deepEqual(b[0].slice(0, 2), [4, 8], 'each pair merges once'); assert.equal(b.flat().filter(Boolean).length, 3, 'one tile spawned');
      assert.equal(await p.locator('#score').innerText(), '12'); assert.equal(await p.locator('#best').innerText(), '12'); assert.equal(await p.locator('#btnUndo').isDisabled(), false);
      await p.waitForFunction(() => document.querySelectorAll('.g2048-tile').length === window.game2048.state.grid.flat().filter(Boolean).length, null, { timeout: 5000 });
      await p.keyboard.press('ArrowLeft'); // no change possible on row, but the spawned tile may move; ensure state valid
      await p.keyboard.press('u'); // undo shortcut
      await p.locator('#btnUndo').click().catch(() => {});
      // persistence
      await p.keyboard.press('ArrowDown'); const before = await board2048(p), score = await p.locator('#score').innerText();
      await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForSelector('.g2048-tile');
      assert.deepEqual(await board2048(p), before, 'game restored after reload'); assert.equal(await p.locator('#score').innerText(), score);
      assert.equal(await getLS(p, 'it_play_2048_best'), String(Math.max(12, Number(score))), 'best saved locally');
      // explicit undo behaviour
      await seed2048(p, [[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
      await p.keyboard.press('ArrowLeft'); assert.equal(await p.locator('#score').innerText(), '4');
      await p.locator('#btnUndo').click(); assert.deepEqual((await board2048(p))[0], [2, 2, 0, 0]); assert.equal(await p.locator('#score').innerText(), '0'); assert.equal(await p.locator('#btnUndo').isDisabled(), true);
      assert.ok(Number(await p.locator('#best').innerText()) >= 12, 'best score is not reduced by undo');
      assert.deepEqual(c.errs, []); await closeCtx(c);
    });
    await check(`${label}: 2048 swipe (touch/pointer) and on-screen arrow controls`, async () => {
      const c = await ctxFor({ w, h, touch, init: ['Math.random=()=>0.99;'] }); const p = c.page;
      await p.goto(base + 'play/2048/', { waitUntil: 'networkidle' });
      const start = [[2, 0, 0, 2], [0, 0, 0, 0], [0, 0, 4, 0], [0, 0, 0, 0]];
      await seed2048(p, start);
      const swipe = async (dx, dy) => { const bb = await p.locator('#board').boundingBox(); const x = bb.x + bb.width / 2, y = bb.y + bb.height / 2;
        const ev = (type, X, Y) => p.locator('#board').dispatchEvent(type, { clientX: X, clientY: Y, pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true });
        await ev('pointerdown', x, y); await ev('pointerup', x + dx, y + dy); };
      const dirs = [];
      for (const [dx, dy, dir] of [[80, 0, 'right'], [0, 90, 'down'], [-90, 0, 'left'], [0, -90, 'up']]) {
        await swipe(dx, dy); dirs.push(dir); assert.deepEqual(await board2048(p), expectBoard(start, dirs, 0.99), `swipe ${dir} matches the engine`);
      }
      const snap = await board2048(p); await swipe(5, 3); await swipe(0, 0); assert.deepEqual(await board2048(p), snap, 'tiny drags are ignored');
      await seed2048(p, [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [2, 2, 0, 0]]);
      await p.locator('[data-dir="right"]').click(); assert.deepEqual(await board2048(p), expectBoard([[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [2, 2, 0, 0]], ['right'], 0.99), 'on-screen right button');
      await p.locator('[data-dir="up"]').click(); assert.equal((await board2048(p))[0][3], 4, 'on-screen up button');
      assert.deepEqual(c.errs, []); await closeCtx(c);
    });
    await check(`${label}: 2048 win overlay, keep going, game over, new game`, async () => {
      const c = await ctxFor({ w, h, touch, init: ['Math.random=()=>0.0;'] }); const p = c.page;
      await p.goto(base + 'play/2048/', { waitUntil: 'networkidle' });
      await seed2048(p, [[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
      await p.keyboard.press('ArrowLeft'); await p.waitForSelector('#overlay:not([hidden])');
      assert.match(await p.locator('#overlayTitle').innerText(), /2048/); assert.equal(await p.locator('#btnKeep').isVisible(), true);
      const atWin = await board2048(p); await p.keyboard.press('ArrowRight'); assert.deepEqual(await board2048(p), atWin, 'moves are blocked while the overlay is open');
      await p.locator('#btnKeep').click(); assert.equal(await p.locator('#overlay').isHidden(), true);
      await p.keyboard.press('ArrowRight'); assert.equal((await board2048(p))[0][2], 2048, 'play continues after keep going (2048 slid right)');
      await seed2048(p, [[4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2], [4, 2, 4, 0]]);
      await p.keyboard.press('ArrowRight'); await p.waitForSelector('#overlay:not([hidden])');
      assert.match(await p.locator('#overlayTitle').innerText(), /Game over/); assert.equal(await p.locator('#btnKeep').isHidden(), true);
      const frozen = await board2048(p); await p.keyboard.press('ArrowLeft'); assert.deepEqual(await board2048(p), frozen, 'no moves after game over');
      await p.screenshot({ path: `${dir}/2048-gameover-${label}.png` });
      await p.locator('#btnAgain').click(); assert.equal(await p.locator('#overlay').isHidden(), true); assert.equal(await p.locator('#score').innerText(), '0'); assert.equal((await board2048(p)).flat().filter(Boolean).length, 2);
      assert.deepEqual(c.errs, []); await closeCtx(c);
    });
    await check(`${label}: 2048 respects reduced motion`, async () => {
      const c = await ctxFor({ w, h, touch, reduced: true }); const p = c.page;
      await p.goto(base + 'play/2048/', { waitUntil: 'networkidle' });
      assert.equal(await p.locator('.g2048-tile').first().evaluate(e => getComputedStyle(e).transitionDuration), '0s'); await closeCtx(c);
    });
    // ---------------- Daily Word ----------------
    const dateInit = [fixDate(noon(2026, 10, 12))];
    const typeWord = async (p, word) => { for (const ch of word) await p.keyboard.press(ch); };
    const rowClasses = (p, r) => p.locator(`.gw-row:nth-child(${r + 1}) .gw-tile`).evaluateAll(t => t.map(x => ['correct', 'present', 'absent'].find(k => x.classList.contains(k)) || 'none'));
    await check(`${label}: Daily Word layout, accessibility and no overflow`, async () => {
      const c = await ctxFor({ w, h, touch, init: dateInit }); const p = c.page;
      await p.goto(base + 'play/daily-word/', { waitUntil: 'networkidle' });
      assert.equal(await p.locator('.gw-tile').count(), 30); assert.equal(await p.getAttribute('#grid', 'role'), 'grid'); assert.equal(await p.locator('.gw-key').count(), 28);
      assert.ok((await overflow(p)) <= 0); assert.match(await p.locator('#subtitle').innerText(), /#285/);
      for (const sel of ['#btnStats', '#btnHelp', '#btnContrast', '#modeDaily', '#modePractice']) { const b = await p.locator(sel).boundingBox(); assert.ok(b.height >= 44 && b.width >= 44, `${sel} ${b.width}x${b.height}`); }
      const keys = await p.locator('.gw-key').evaluateAll(k => k.map(x => { const r = x.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
      assert.ok(keys.every(([kw, kh]) => kh >= 44 && kw >= 30), 'on-screen keys are at least 44px tall and 30px wide ' + JSON.stringify(keys.slice(0, 3)));
      assert.equal(await p.getAttribute('.gw-key[data-key="q"]', 'aria-label'), 'q');
      await p.screenshot({ path: `${dir}/word-${label}.png` }); assert.deepEqual(c.errs, []); await closeCtx(c);
    });
    await check(`${label}: Daily Word validation messages keep the attempt`, async () => {
      const c = await ctxFor({ w, h, touch, init: dateInit }); const p = c.page;
      await p.goto(base + 'play/daily-word/', { waitUntil: 'networkidle' });
      await typeWord(p, 'ab'); await p.keyboard.press('Enter'); assert.match(await p.locator('#toast').innerText(), /Not enough letters/);
      await p.keyboard.press('Backspace'); await p.keyboard.press('Backspace'); await typeWord(p, 'zzzzz'); await p.keyboard.press('Enter'); assert.match(await p.locator('#toast').innerText(), /Not in word list/);
      assert.equal((await p.locator('.gw-row:nth-child(1) .gw-tile').allInnerTexts()).join('').toLowerCase(), 'zzzzz', 'rejected word stays editable');
      assert.equal(await p.locator('.gw-row:nth-child(2) .gw-tile.filled').count(), 0, 'no attempt consumed');
      await typeWord(p, 'x'); assert.equal((await p.locator('.gw-row:nth-child(1) .gw-tile').allInnerTexts()).join('').length, 5, 'cannot type a sixth letter');
      for (let i = 0; i < 5; i++) await p.keyboard.press('Backspace'); assert.equal((await p.locator('.gw-row:nth-child(1) .gw-tile').allInnerTexts()).join(''), '');
      await p.keyboard.press('1'); await p.keyboard.press('Control+a'); assert.equal((await p.locator('.gw-row:nth-child(1) .gw-tile').allInnerTexts()).join(''), '', 'non-letters and shortcuts are ignored');
      assert.deepEqual(c.errs, []); await closeCtx(c);
    });
    await check(`${label}: Daily Word letter feedback matches the rules (repeated letters), keyboard colours, on-screen keys`, async () => {
      const c = await ctxFor({ w, h, touch, reduced: true, init: dateInit }); const p = c.page;
      await p.goto(base + 'play/daily-word/', { waitUntil: 'networkidle' });
      const guesses = ['geese', 'speed', 'llama'].filter(g => g !== ANSWER);
      for (const g of guesses) await typeWord(p, g), await p.keyboard.press('Enter'), await p.waitForTimeout(0);
      await p.waitForFunction(n => document.querySelectorAll('.gw-tile.correct,.gw-tile.present,.gw-tile.absent').length >= n * 5, guesses.length);
      for (const [i, g] of guesses.entries()) assert.deepEqual(await rowClasses(p, i), evaluateGuess(g, ANSWER), `row ${i + 1} (${g} vs ${ANSWER})`);
      const kb = await p.locator('.gw-key[data-key]').evaluateAll(k => Object.fromEntries(k.filter(x => x.dataset.key.length === 1).map(x => [x.dataset.key, ['correct', 'present', 'absent'].find(s => x.classList.contains(s)) || 'none'])));
      const rank = { none: 0, absent: 1, present: 2, correct: 3 }; const exp = {};
      for (const g of guesses) evaluateGuess(g, ANSWER).forEach((s, i) => { if (rank[s] > (rank[exp[g[i]]] || 0)) exp[g[i]] = s; });
      for (const [l, s] of Object.entries(exp)) assert.equal(kb[l], s, `key ${l}`);
      assert.ok((await p.getAttribute(`.gw-key[data-key="${Object.keys(exp)[0]}"]`, 'aria-label')).includes(','), 'key state exposed to AT');
      // on-screen keyboard typing / delete / enter
      await p.locator('.gw-key[data-key="q"]').click(); await p.locator('.gw-key[data-key="Backspace"]').click(); assert.equal((await p.locator(`.gw-row:nth-child(${guesses.length + 1}) .gw-tile`).allInnerTexts()).join(''), '');
      for (const ch of 'crane') await p.locator(`.gw-key[data-key="${ch}"]`).click(); await p.locator('.gw-key[data-key="Enter"]').click();
      await p.waitForFunction(n => document.querySelectorAll('.gw-tile.absent,.gw-tile.present,.gw-tile.correct').length >= n * 5, guesses.length + 1);
      assert.deepEqual(await rowClasses(p, guesses.length), evaluateGuess('crane', ANSWER), 'on-screen keyboard guess');
      assert.deepEqual(c.errs, []); await closeCtx(c);
    });
    await check(`${label}: Daily Word win, locked stats, persistence and share text`, async () => {
      const c = await ctxFor({ w, h, touch, reduced: true, init: [...dateInit, 'navigator.share=undefined;window.__copied=null;Object.defineProperty(navigator,"clipboard",{value:{writeText:async t=>{window.__copied=t}},configurable:true});'] }); const p = c.page;
      await p.goto(base + 'play/daily-word/', { waitUntil: 'networkidle' });
      const wrong = ['crane', 'slate'].find(g => g !== ANSWER);
      await typeWord(p, wrong); await p.keyboard.press('Enter'); await typeWord(p, ANSWER); await p.keyboard.press('Enter');
      await p.waitForSelector('#dlgStats[open]'); assert.match(await p.locator('#resultLine').innerText(), /Solved in 2 of 6/);
      assert.deepEqual(await rowClasses(p, 1), Array(5).fill('correct'));
      const stats = JSON.parse(await getLS(p, 'it_play_dailyword_stats')); assert.deepEqual([stats.played, stats.won, stats.current, stats.max, stats.dist[1]], [1, 1, 1, 1, 1]);
      const share = await p.locator('#shareBox').innerText(); assert.match(share, /^GoVibeTool Daily Word #285 2\/6\n/); assert.ok(!share.toLowerCase().includes(ANSWER) && !share.toLowerCase().includes(wrong));
      assert.equal(share.split('\n').length >= 5, true); assert.ok(/^[🟩🟨⬛]{5}$/u.test(share.split('\n')[2]));
      assert.equal(share, shareText({ date: FIXED_DAY, results: [evaluateGuess(wrong, ANSWER), Array(5).fill('correct')], won: true }));
      await p.locator('#btnShare').click(); await p.waitForFunction(() => window.__copied); assert.equal(await p.evaluate(() => window.__copied), share, 'copied text equals the displayed share');
      await p.screenshot({ path: `${dir}/word-win-${label}.png` });
      await p.keyboard.press('Escape'); assert.equal(await p.locator('#dlgStats').evaluate(d => d.open), false);
      await typeWord(p, 'crane'); assert.equal((await p.locator('.gw-row .gw-tile.filled:not(.correct):not(.present):not(.absent)').count()), 0, 'no more input after finishing');
      await p.reload({ waitUntil: 'networkidle' }); assert.deepEqual(await rowClasses(p, 1), Array(5).fill('correct'), 'finished game restored on reload');
      assert.deepEqual(JSON.parse(await getLS(p, 'it_play_dailyword_stats')).played, 1, 'reload does not double count');
      assert.deepEqual(c.errs, []); await closeCtx(c);
    });
    await check(`${label}: Daily Word loss reveals the word and ends the streak; next-day streak continues`, async () => {
      const seed = JSON.stringify({ played: 3, won: 3, current: 3, max: 3, dist: [0, 1, 2, 0, 0, 0], lastWonDate: '2026-10-11', lastPlayedDate: '2026-10-11' });
      const c = await ctxFor({ w, h, touch, reduced: true, init: [...dateInit, `localStorage.getItem("it_play_dailyword_stats")||localStorage.setItem("it_play_dailyword_stats",${JSON.stringify(seed)});`] }); const p = c.page;
      await p.goto(base + 'play/daily-word/', { waitUntil: 'networkidle' });
      const wrongs = ['crane', 'slate', 'house', 'mouse', 'light', 'pound', 'sound'].filter(g => g !== ANSWER).slice(0, 6);
      for (const g of wrongs) { await typeWord(p, g); await p.keyboard.press('Enter'); }
      await p.waitForSelector('#dlgStats[open]'); assert.match(await p.locator('#resultLine').innerText(), new RegExp(`The word was ${ANSWER.toUpperCase()}`));
      assert.match(await p.locator('#shareBox').innerText(), /X\/6/);
      const s = JSON.parse(await getLS(p, 'it_play_dailyword_stats')); assert.deepEqual([s.played, s.won, s.current, s.max], [4, 3, 0, 3]);
      await closeCtx(c);
      const c2 = await ctxFor({ w, h, touch, reduced: true, init: dateInit }); const p2 = c2.page;
      await p2.goto(base + 'play/daily-word/', { waitUntil: 'networkidle' });
      await setLS(p2, 'it_play_dailyword_stats', seed); await p2.reload({ waitUntil: 'networkidle' });
      await typeWord(p2, ANSWER); await p2.keyboard.press('Enter'); await p2.waitForSelector('#dlgStats[open]');
      const s2 = JSON.parse(await getLS(p2, 'it_play_dailyword_stats')); assert.deepEqual([s2.played, s2.won, s2.current, s2.max], [4, 4, 4, 4], 'consecutive-day win extends the streak');
      assert.equal(await p2.locator('#stCur').innerText(), '4'); await closeCtx(c2);
    });
    await check(`${label}: Daily Word puzzle changes with the date and practice mode is separate`, async () => {
      const c = await ctxFor({ w, h, touch, reduced: true, init: [fixDate(noon(2026, 10, 13)), 'Math.random=()=>0.0;'] }); const p = c.page;
      const answer13 = dailyAnswer('2026-10-13', ANSWERS); assert.notEqual(answer13, ANSWER);
      await p.goto(base + 'play/daily-word/', { waitUntil: 'networkidle' });
      assert.match(await p.locator('#subtitle').innerText(), /#286/);
      await typeWord(p, answer13); await p.keyboard.press('Enter'); await p.waitForSelector('#dlgStats[open]'); await p.keyboard.press('Escape');
      const before = JSON.parse(await getLS(p, 'it_play_dailyword_stats'));
      await p.locator('#modePractice').click(); assert.equal(await p.getAttribute('#modePractice', 'aria-pressed'), 'true'); assert.equal(await p.locator('#btnNewPractice').isVisible(), true);
      assert.equal(await p.locator('.gw-tile.filled').count(), 0, 'practice board starts empty');
      await typeWord(p, ANSWERS[0]); await p.keyboard.press('Enter'); await p.waitForSelector('#dlgStats[open]');
      assert.deepEqual(JSON.parse(await getLS(p, 'it_play_dailyword_stats')), before, 'practice does not change stats');
      assert.match(await p.locator('#shareBox').innerText(), /^GoVibeTool Word Practice 1\/6/); await p.keyboard.press('Escape');
      await p.locator('#btnNewPractice').click(); assert.equal(await p.locator('.gw-tile.filled').count(), 0, 'new practice word');
      await p.locator('#modeDaily').click(); assert.deepEqual(await rowClasses(p, 0), Array(5).fill('correct'), 'daily progress kept when switching modes');
      await p.reload({ waitUntil: 'networkidle' }); assert.equal(await p.getAttribute('#modeDaily', 'aria-pressed'), 'true');
      await p.locator('#btnContrast').click(); assert.equal(await p.evaluate(() => document.body.classList.contains('hc')), true); await p.reload({ waitUntil: 'networkidle' }); assert.equal(await p.evaluate(() => document.body.classList.contains('hc')), true, 'contrast preference persists');
      assert.deepEqual(c.errs, []); await closeCtx(c);
    });
    await check(`${label}: Daily Word help and stats dialogs are keyboard accessible`, async () => {
      const c = await ctxFor({ w, h, touch, init: dateInit }); const p = c.page;
      await p.goto(base + 'play/daily-word/', { waitUntil: 'networkidle' });
      await p.locator('#btnHelp').focus(); await p.keyboard.press('Enter'); assert.equal(await p.locator('#dlgHelp').evaluate(d => d.open), true);
      await p.keyboard.press('Escape'); assert.equal(await p.locator('#dlgHelp').evaluate(d => d.open), false);
      await p.locator('#btnStats').click(); assert.equal(await p.locator('#dlgStats').evaluate(d => d.open), true); await p.locator('#dlgStats [data-close]').click(); assert.equal(await p.locator('#dlgStats').evaluate(d => d.open), false);
      assert.equal(await p.locator('#stPlayed').innerText(), '0'); await closeCtx(c);
    });
  }
  // ---------------- offline + service worker (local server only) ----------------
  if (!live) await check('offline: games load and play from the service-worker cache', async () => {
    const c = await ctxFor({ w: 390, h: 844, touch: true, init: [fixDate(noon(2026, 10, 12))] }); const p = c.page;
    await p.goto(base + 'play/2048/', { waitUntil: 'networkidle' });
    await p.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise(r => { navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }); setTimeout(r, 8000); }); });
    await p.waitForFunction(async () => { const names = await caches.keys(); for (const n of names) { const c = await caches.open(n); const k = (await c.keys()).map(r => new URL(r.url).pathname); if (PLAY_OFFLINE_ASSETS.every(x => k.includes(x))) return true; } return false; }, null, { timeout: 30000 });
    await stopServer();
    try {
      await p.goto(base + 'play/2048/', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('.g2048-tile'); await p.keyboard.press('ArrowLeft'); assert.ok(await p.locator('#score').isVisible());
      await p.goto(base + 'play/daily-word/', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('.gw-tile');
      for (const ch of 'crane') await p.keyboard.press(ch); await p.keyboard.press('Enter'); await p.waitForFunction(() => document.querySelectorAll('.gw-tile.absent,.gw-tile.present,.gw-tile.correct').length >= 5);
      await p.goto(base + 'play/mahjong-solitaire/', { waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => document.querySelectorAll('.sol-tile').length > 0);
      const left = await p.locator('.sol-tile').count();
      const pair = await p.evaluate(() => { const by = new Map(); for (const t of document.querySelectorAll('.sol-tile')) { const a = t.getAttribute('aria-label') || ''; if (!/available/.test(a)) continue; const k = a.split(', layer')[0]; (by.get(k) || by.set(k, []).get(k)).push(t.dataset.id); } for (const ids of by.values()) if (ids.length >= 2) return ids.slice(0, 2); return null; });
      assert.ok(pair, 'a free matching Mahjong Solitaire pair is available offline');
      for (const id of pair) await p.locator(`.sol-tile[data-id="${id}"]`).click();
      await p.waitForFunction(n => document.querySelectorAll('.sol-tile').length === n, left - 2);
      await p.goto(base + 'play/vibe-arcade/', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('[data-act="level"][data-g="vl"]');
      await p.goto(base + 'play/', { waitUntil: 'domcontentloaded' }); assert.equal(await p.locator('.v5-card').count(), PLAY_GAME_COUNT);
      assert.deepEqual(await p.locator('.v5-card a.btn').evaluateAll(a => a.map(x => x.getAttribute('href'))), PLAY_GAME_HREFS);
    } finally { await startServer(); }
    await closeCtx(c);
  });
  // the games must make no network requests beyond their own origin
  await check('privacy: no third-party requests from any solo game', async () => {
    const c = await ctxFor({ w: 1280, h: 900, init: [fixDate(noon(2026, 10, 12))] }); const p = c.page; const external = [];
    const origin = new URL(base).origin; p.on('request', r => { const u = new URL(r.url()); if (u.origin !== origin && /^https?:/.test(r.url()) && !/pagead|googlesyndication/.test(r.url())) external.push(r.url()); });
    for (const g of ['play/2048/', 'play/daily-word/', 'play/mahjong-solitaire/', 'play/vibe-arcade/']) { await p.goto(base + g, { waitUntil: 'networkidle' }); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('a'); }
    assert.deepEqual(external, []); await closeCtx(c);
  });
} finally { await browser.close(); if (server) server.close(); }
console.log(`${engine}${live ? ' (live)' : ''}: ${passed} passed, ${failures.length} failed`);
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
