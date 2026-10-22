/* Continue playing: only genuinely resumable saves are reported. Pure logic (no browser). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { detect } = createRequire(import.meta.url)('../play/continue.js');
const store = (o = {}) => ({ getItem: k => (k in o ? o[k] : null) });
const ids = o => detect(store(o), '2026-10-22').map(i => i.id);
const board = rows => JSON.stringify({ v: rows, s: 120, w: false });
const open4 = board([[2, 4, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
const dead4 = board([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]]);
const word = (o = {}) => JSON.stringify({ answer: 'crane', date: '2026-10-22', guesses: ['slate'], status: 'playing', ...o });

assert.deepEqual(ids({}), [], 'no saves, nothing to continue');
assert.deepEqual(detect({ getItem() { throw new Error('storage blocked'); } }, 'x'), [], 'blocked storage never throws');

/* 2048 */
assert.deepEqual(ids({ it_play_2048_state: open4 }), ['2048']);
assert.deepEqual(ids({ it_play_2048_state: dead4 }), [], 'a finished (no moves left) game is not resumable');
assert.deepEqual(ids({ it_play_2048_state: JSON.stringify({ v: [[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], s: 0, w: false }) }), [], 'untouched board (score 0) is not progress');
assert.deepEqual(ids({ it_play_2048_state: '{not json' }), [], 'corrupt save ignored');
assert.deepEqual(ids({ it_play_2048_state: board([[3, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]) }), [], 'invalid tile values ignored');
assert.match(detect(store({ it_play_2048_state: open4 }), 'x')[0].detail, /Score 120/);

/* Daily Word */
assert.deepEqual(ids({ it_play_dailyword_daily: word() }), ['daily-word']);
assert.match(detect(store({ it_play_dailyword_daily: word() }), '2026-10-22')[0].detail, /Today/);
assert.deepEqual(ids({ it_play_dailyword_daily: word({ date: '2026-10-21' }) }), [], "yesterday's puzzle is not resumable");
assert.deepEqual(ids({ it_play_dailyword_daily: word({ status: 'won' }) }), [], 'finished puzzle');
assert.deepEqual(ids({ it_play_dailyword_daily: word({ status: 'lost', guesses: ['a'.repeat(5), 'b'.repeat(5), 'c'.repeat(5), 'd'.repeat(5), 'e'.repeat(5), 'f'.repeat(5)] }) }), []);
assert.deepEqual(ids({ it_play_dailyword_daily: word({ guesses: [] }) }), [], 'no guesses yet is not progress');
assert.deepEqual(ids({ it_play_dailyword_daily: word({ guesses: ['bad'] }) }), [], 'malformed guesses ignored');
assert.match(detect(store({ it_play_dailyword_practice: word({ date: null }) }), 'x')[0].detail, /Practice/);

/* Vibe Arcade */
const prof = games => JSON.stringify({ games });
assert.deepEqual(ids({ 'vibearcade:v1': prof({ vl: { level: 1 }, tw: { level: 1 }, ca: { level: 1 } }) }), [], 'level 1 everywhere is a fresh start');
assert.deepEqual(ids({ 'vibearcade:v1': prof({ vl: { level: 4 } }) }), ['vibe-arcade']);
assert.match(detect(store({ 'vibearcade:v1': prof({ vl: { level: 4 } }), 'vibe-crown-level-v1': '3' }), 'x')[0].detail, /Vibeline level 4 · Crown Grid level 3/);
assert.deepEqual(ids({ 'vibe-loop-level-v1': '2' }), ['vibe-arcade']);
assert.deepEqual(ids({ 'vibe-loop-level-v1': '1' }), []);
assert.match(detect(store({ 'vibearcade:v1': prof({ vl: { level: 2 }, tw: { level: 3 }, ca: { level: 4 } }) }), 'x')[0].detail, /\+1 more/);

/* Games that only store stats/settings must never appear */
assert.deepEqual(ids({ it_play_wordlogic_stats: '{"played":9}', 'gvt.twmj.stats': '{"hands":4}', 'gvt.twmj.settings': '{}' }), [], 'Logic Crypt and Taiwanese Mahjong have no mid-game save');

/* Static markup: the directory starts hidden, and no card hard-codes a Continue button */
const dir = fs.readFileSync(new URL('../play/index.html', import.meta.url), 'utf8');
assert.match(dir, /<section[^>]*id="continue-playing"[^>]*\shidden/, 'Continue section is hidden until progress is found');
assert.ok(dir.includes('src="continue.js"'));
assert.ok(!/class="btn[^"]*"[^>]*>\s*Continue/i.test(dir), 'no hard-coded Continue button on any game card');
const home = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.ok(home.indexOf('play/continue.js') > 0 && home.indexOf('play/continue.js') < home.indexOf('v8-discovery.js'), 'homepage loads continue.js before the shelf');
assert.ok(fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8').includes('./play/continue.js'), 'service worker precaches continue.js');
console.log('play-continue: all checks passed');
