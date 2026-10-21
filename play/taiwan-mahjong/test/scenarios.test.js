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
  assert(win.tai >= 16);
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

console.log('\n' + ok + ' scenario checks passed');
