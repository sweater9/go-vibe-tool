'use strict';
const assert = require('assert');
const E = require('../engine.js');

const T = s => ({ m: 0, p: 9, s: 18, z: 27 }[s[1]] + (+s[0]) - 1);
function counts(str) {
  const c = E.newCounts();
  str.trim().split(/\s+/).forEach(g => { const su = g[g.length - 1]; for (const d of g.slice(0, -1)) c[T(d + su)]++; });
  return c;
}
let ok = 0;
function t(name, fn) { try { fn(); ok++; console.log('  ok  ' + name); } catch (e) { console.error('FAIL  ' + name + '\n      ' + e.stack); process.exitCode = 1; } }

function setup() {
  const m = new E.Match({ seed: 3, skill: 1, humanSeats: [0], rounds: 1 });
  m.startHand();
  return m;
}

t('human robs an added kong (搶槓)', () => {
  const m = setup();
  m.players[0].conc = counts('123m 456m 789m 123p 46p 99s');            // 16 tiles, waiting on 5p
  m.players[1].melds = [{ type: 'peng', t: T('5p'), tiles: [T('5p'), T('5p'), T('5p')], from: 2, called: T('5p') }];
  m.players[1].conc = counts('123s 456s 789s 11z 22z 5p');               // 14 incl. the 4th 5p
  m.turn = 1; m.stage = 'self'; m.afterClaim = false; m.drawn = T('5p');
  m.stats = { discards: 6, melds: 1 };
  const ev = m._applySelf(1, { kind: 'jiagang', tile: T('5p') });
  assert.strictEqual(ev.type, 'jiagang');
  const w = m.step();
  assert.strictEqual(w.type, 'await'); assert.strictEqual(w.kind, 'claim'); assert(w.robKong); assert(w.options.hu);
  m.act({ kind: 'hu' });
  const win = m.step();
  assert.strictEqual(win.type, 'win'); assert.strictEqual(win.seat, 0); assert.strictEqual(win.from, 1);
  assert(win.robKong);
  assert(win.items.some(i => i.zh === '搶槓'), JSON.stringify(win.items));
  assert.strictEqual(win.pay.reduce((a, b) => a + b, 0), 0);
  assert(win.pay[1] < 0 && win.pay[2] === 0 && win.pay[3] === 0, 'only the kong player pays');
});

t('nobody robs: the added kong stands and the kong player draws from the back', () => {
  const m = setup();
  m.players[0].conc = counts('123m 456m 789m 11p 33p 55p 7z');          // not ready on 5p
  m.players[1].melds = [{ type: 'peng', t: T('5p'), tiles: [T('5p'), T('5p'), T('5p')], from: 2, called: T('5p') }];
  m.players[1].conc = counts('123s 456s 789s 11z 22z 5p');
  m.turn = 1; m.stage = 'self'; m.afterClaim = false; m.drawn = T('5p');
  m.stats = { discards: 6, melds: 1 };
  m._applySelf(1, { kind: 'jiagang', tile: T('5p') });
  let ev = m.step();
  assert.strictEqual(ev.type, 'kongready');
  assert.strictEqual(m.players[1].melds[0].type, 'minggang');
  const wallBefore = m.wall.length;
  ev = m.step();
  assert.strictEqual(ev.type, 'draw'); assert(ev.fromBack);
  assert.strictEqual(m.wall.length, wallBefore - 1);
});

t('human self-draw win with all-concealed hand is 不求人 and everyone pays', () => {
  const m = setup();
  m.players[0].conc = counts('123m 456m 789m 123p 45p 99s'); m.players[0].melds = []; m.players[0].flowers = [];
  m.players[0].conc[T('6p')]++;
  m.turn = 0; m.stage = 'self'; m.afterClaim = false; m.drawn = T('6p'); m.lastLive = false;
  m.stats = { discards: 8, melds: 0 };
  const so = m.selfOptions(0); assert(so.hu);
  m.act({ kind: 'hu' });
  const win = m.step();
  assert.strictEqual(win.type, 'win'); assert(win.selfDraw);
  assert(win.items.some(i => i.zh === '不求人'));
  assert(win.items.some(i => i.zh === '莊家'));          // seat 0 is dealer on the first hand
  assert.deepStrictEqual(win.pay.slice(1), [-win.amount, -win.amount, -win.amount]);
});

t('human cannot win after claiming (must discard first)', () => {
  const m = setup();
  m.players[0].conc = counts('123m 456m 789m 123p 456p 99s');           // complete 17 incl. but afterClaim
  m.players[0].conc[T('5p')]++; m.players[0].conc[T('5p')]--;
  m.turn = 0; m.stage = 'self'; m.afterClaim = true;
  assert.strictEqual(m.selfOptions(0).hu, false);
});

t('dealer wins on the opening draw: 天胡', () => {
  const m = setup();
  m.players[0].conc = counts('123m 456m 789m 123p 45p 99s'); m.players[0].conc[T('6p')]++;
  m.players[0].flowers = []; m.players[0].melds = [];
  m.turn = 0; m.stage = 'self'; m.afterClaim = false; m.drawn = T('6p');
  m.stats = { discards: 0, melds: 0 };
  m.act({ kind: 'hu' });
  const win = m.step();
  assert(win.items.some(i => i.zh === '天胡'), JSON.stringify(win.items));
  assert.strictEqual(win.items.find(i => i.zh === '天胡').tai, 24);
});

t('dealer rotation and 連莊 streak', () => {
  const m = setup();
  m.last = { type: 'win', seat: 0 }; m.stage = 'between';           // dealer wins
  m.nextHand(); assert.strictEqual(m.dealer, 0); assert.strictEqual(m.lian, 1);
  m.last = { type: 'win', seat: 2 }; m.stage = 'between';           // someone else wins
  m.nextHand(); assert.strictEqual(m.dealer, 1); assert.strictEqual(m.lian, 0); assert.strictEqual(m.rotations, 1);
  m.last = { type: 'drawgame' }; m.stage = 'between';               // draw: dealer stays
  m.nextHand(); assert.strictEqual(m.dealer, 1);
});

t('match ends after the chosen number of rounds', () => {
  const m = setup();
  for (let i = 0; i < 4; i++) { m.last = { type: 'win', seat: (m.dealer + 1) % 4 }; m.stage = 'between'; const ev = m.nextHand(); if (i < 3) assert.strictEqual(ev.type, 'deal'); else assert.strictEqual(ev.type, 'over'); }
  assert(m.over);
});

/* ---------- 人胡 / 地胡 ---------- */
function botMatch(opts) { const m = new E.Match(Object.assign({ seed: 5, skill: 1, humanSeats: [], rounds: 1 }, opts)); m.startHand(); return m; }
const READY = '123m 456m 789m 123p 46p 99s';   // waits on 5p
const JUNK = '1m 4m 7m 1p 4p 7p 1s 4s 7s 1z 2z 3z 4z 5z 6z 7z';
function stageDiscard(m, discarder, tile, nDiscards) {
  m.players.forEach(p => { p.melds = []; p.flowers = []; p.discards = []; p.conc = counts(JUNK); });
  m.stats = { discards: nDiscards, melds: 0 };
  for (let i = 0; i < nDiscards; i++) m.players[(m.dealer + i) % 4].discards.push(T('9p'));
  m.lastDiscard = { seat: discarder, tile: tile, lastLive: false };
  m.turn = discarder; m.stage = 'claim'; m._claimOpts = null; m._claimChoices = null; m._fwCheck = false;
}
t('人胡: a non-dealer who has not yet drawn wins on a first-round discard (8 tai)', () => {
  const m = botMatch(); m.dealer = 0;
  stageDiscard(m, 1, T('5p'), 2);             // dealer, then seat 1 discarded; seat 3 has not drawn yet
  m.players[3].conc = counts(READY);
  const win = m.step();
  assert.strictEqual(win.type, 'win'); assert.strictEqual(win.seat, 3); assert.strictEqual(win.from, 1);
  const it = win.items.find(i => i.zh === '人胡'); assert(it && it.tai === 8, JSON.stringify(win.items));
  assert(!win.items.some(i => i.zh === '地胡'));
  assert.strictEqual(win.pay.reduce((a, b) => a + b, 0), 0);
});
t('地胡 (not 人胡): non-dealer wins on the dealer\'s very first discard', () => {
  const m = botMatch(); m.dealer = 0;
  stageDiscard(m, 0, T('5p'), 1);
  m.players[2].conc = counts(READY);
  const win = m.step();
  assert.strictEqual(win.seat, 2);
  assert(win.items.some(i => i.zh === '地胡' && i.tai === 16));
  assert(!win.items.some(i => i.zh === '人胡'));
});
t('no 人胡 once the winner has already drawn', () => {
  const m = botMatch(); m.dealer = 0;
  stageDiscard(m, 0, T('5p'), 2);             // two discards happened, but seat 1 has drawn and discarded
  m.players[1].discards = [T('9p')]; m.players[0].discards = [T('9p')];
  m.players[1].conc = counts(READY);
  const win = m.step();
  assert.strictEqual(win.type, 'win');
  assert(!win.items.some(i => i.zh === '人胡'), JSON.stringify(win.items));
});

/* ---------- 八仙過海 / 七搶一 ---------- */
t('七搶一: seven flowers and another player draws the eighth: the holder wins at once, that player pays alone', () => {
  const m = botMatch(); m.dealer = 0; m.lian = 0;
  m.players.forEach(p => { p.flowers = []; });
  m.players[1].flowers = [34, 35, 36, 37, 38, 39, 40]; m.players[2].flowers = [41];
  m._fwCheck = true; m.stage = 'draw'; m.turn = 2;
  const win = m.step();
  assert.strictEqual(win.type, 'win'); assert.strictEqual(win.seat, 1); assert.strictEqual(win.flowerWin, 'seven');
  assert.strictEqual(win.from, 2); assert.strictEqual(win.tai, 8); assert.strictEqual(win.tile, null);
  assert(win.pay[2] < 0 && win.pay[0] === 0 && win.pay[3] === 0 && win.pay.reduce((a, b) => a + b, 0) === 0);
  assert(win.items.some(i => i.zh === '七搶一' && i.tai === 8));
});
t('八仙過海: all eight flowers win at once and all three pay (dealer adds 莊家)', () => {
  const m = botMatch(); m.dealer = 3; m.lian = 0;
  m.players.forEach(p => { p.flowers = []; });
  m.players[3].flowers = [34, 35, 36, 37, 38, 39, 40, 41];
  m._fwCheck = true; m.stage = 'self'; m.turn = 3;
  const win = m.step();
  assert.strictEqual(win.seat, 3); assert.strictEqual(win.flowerWin, 'all'); assert(win.selfDraw);
  assert.strictEqual(win.tai, 9);             // 八仙過海 8 + 莊家 1
  assert.deepStrictEqual([win.pay[0], win.pay[1], win.pay[2]], [-win.amount, -win.amount, -win.amount]);
  assert.strictEqual(win.pay.reduce((a, b) => a + b, 0), 0);
});
t('seven flowers with the eighth still in the wall do not end the hand', () => {
  const m = botMatch(); m.dealer = 0;
  m.players.forEach(p => { p.flowers = []; });
  m.players[1].flowers = [34, 35, 36, 37, 38, 39, 40];
  m._fwCheck = true; m.stage = 'draw'; m.turn = 0;
  const ev = m.step();
  assert.notStrictEqual(ev.type, 'win');
});
t('flower wins feed dealer rotation like any win', () => {
  const m = botMatch(); m.dealer = 0;
  m.players.forEach(p => { p.flowers = []; });
  m.players[2].flowers = [34, 35, 36, 37, 38, 39, 40, 41]; m._fwCheck = true; m.stage = 'draw'; m.turn = 2;
  assert.strictEqual(m.step().type, 'win');
  m.nextHand(); assert.strictEqual(m.dealer, 1);
});

/* ---------- several winners on one discard ---------- */
function twoReady(multiWin) {
  const m = botMatch({ multiWin });
  m.players.forEach(p => { p.melds = []; p.flowers = []; p.discards = []; p.conc = counts(JUNK); });
  m.dealer = 0; m.lian = 0; m.stats = { discards: 6, melds: 1 };
  m.players[2].conc = counts(READY); m.players[3].conc = counts(READY);
  m.lastDiscard = { seat: 1, tile: T('5p'), lastLive: false };
  m.turn = 1; m.stage = 'claim'; m._claimOpts = null; m._claimChoices = null; m._fwCheck = false;
  return m;
}
t('multiple winners are the default: both win with no option given', () => {
  const m = twoReady(undefined); assert.strictEqual(m.cfg.multiWin, true); const win = m.step();
  assert.deepStrictEqual(win.winners.map(w => w.seat), [2, 3]);
  assert.strictEqual(win.pay.reduce((a, b) => a + b, 0), 0); assert.strictEqual(m.players.reduce((a, p) => a + p.chips, 0), 4000);
});
t('switched off: one winner, the nearest player in turn order wins, the discarder pays once', () => {
  const m = twoReady(false); const win = m.step();
  assert.strictEqual(win.winners.length, 1); assert.strictEqual(win.seat, 2);
  assert.strictEqual(win.pay.reduce((a, b) => a + b, 0), 0); assert.strictEqual(win.pay[3], 0);
  assert.strictEqual(m.players.reduce((a, p) => a + p.chips, 0), 4000);
});
t('multiple winners on: both win, the discarder pays each, points conserved', () => {
  const m = twoReady(true); const win = m.step();
  assert.deepStrictEqual(win.winners.map(w => w.seat), [2, 3]);
  const paid = win.winners.reduce((a, w) => a + w.amount, 0);
  assert.strictEqual(win.pay[1], -paid);
  assert.strictEqual(win.pay[2], win.winners[0].amount); assert.strictEqual(win.pay[3], win.winners[1].amount);
  assert.strictEqual(win.pay.reduce((a, b) => a + b, 0), 0);
  assert.strictEqual(m.players.reduce((a, p) => a + p.chips, 0), 4000);
  assert(win.winners.every(w => w.hand && w.items.length));
});
t('multiple winners: the dealer stays if the dealer is one of them, otherwise the deal passes', () => {
  const m = twoReady(true); m.dealer = 3;           // seat 3 is dealer and a winner
  const win = m.step(); assert(win.winners.some(w => w.seat === 3));
  m.nextHand(); assert.strictEqual(m.dealer, 3); assert.strictEqual(m.lian, 1);
  const m2 = twoReady(true); m2.step(); m2.nextHand(); assert.strictEqual(m2.dealer, 1);
});
t('robbing a kong with several robbers: all win and the kong player pays each', () => {
  const m = botMatch({ multiWin: true });
  m.players.forEach(p => { p.melds = []; p.flowers = []; p.discards = []; p.conc = counts(JUNK); });
  m.players[0].melds = [{ type: 'peng', t: T('5p'), tiles: [T('5p'), T('5p'), T('5p')], from: 1, called: T('5p') }];
  m.players[0].conc = counts('1m 4m 7m 1p 4p 7p 1s 4s 7s 1z 2z 3z 4z 5p');  // 14 incl. the 4th 5p, pung already shown
  m.players[1].conc = counts(READY); m.players[2].conc = counts(READY);
  m.stats = { discards: 6, melds: 1 };
  m.turn = 0; m.stage = 'self'; m.afterClaim = false; m.drawn = T('5p');
  m._applySelf(0, { kind: 'jiagang', tile: T('5p') });
  const win = m.step();
  assert.strictEqual(win.type, 'win'); assert(win.robKong);
  assert.deepStrictEqual(win.winners.map(w => w.seat), [1, 2]);
  assert(win.winners.every(w => w.items.some(i => i.zh === '搶槓')));
  assert.strictEqual(win.pay[0], -(win.winners[0].amount + win.winners[1].amount));
  assert.strictEqual(win.pay.reduce((a, b) => a + b, 0), 0);
});

console.log('\n' + ok + ' scenario checks passed');
