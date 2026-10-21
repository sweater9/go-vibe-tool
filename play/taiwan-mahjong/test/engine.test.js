'use strict';
const assert = require('assert');
const E = require('../engine.js');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('FAIL  ' + name + '\n      ' + e.message); process.exitCode = 1; }
}

// parse "123m 456p 789s 11z" → counts   (m chars, p dots, s bamboo, z honors 1-7 = E S W N 中 發 白)
function H(str) {
  const c = E.newCounts();
  str.trim().split(/\s+/).forEach(g => {
    const suit = g[g.length - 1];
    const base = { m: 0, p: 9, s: 18, z: 27 }[suit];
    for (const d of g.slice(0, -1)) c[base + (+d) - 1]++;
  });
  return c;
}
function tile(s) { const suit = s[1]; return { m: 0, p: 9, s: 18, z: 27 }[suit] + (+s[0]) - 1; }

function score(handStr, win, o) {
  o = o || {};
  return E.scoreHand({
    conc: H(handStr), melds: o.melds || [], flowers: o.flowers || [], winTile: tile(win),
    selfDraw: !!o.self, seat: o.seat === undefined ? 1 : o.seat, dealer: o.dealer === undefined ? 0 : o.dealer,
    roundWind: o.round || 0, lian: o.lian || 0, flags: o.flags || {}
  });
}
const names = r => r.items.map(i => i.zh).sort().join(',');
const has = (r, zh) => r.items.some(i => i.zh === zh);

console.log('Win detection');
t('17 tiles: 5 sequences + pair', () => {
  assert(E.isComplete(H('123m 456m 789m 123p 456p 99s'), 0));
});
t('not complete when a tile is off', () => {
  assert(!E.isComplete(H('123m 456m 789m 123p 457p 99s'), 0));
});
t('with melds: needs fewer concealed tiles', () => {
  assert(E.isComplete(H('123m 456m 55p'), 3));
  assert(!E.isComplete(H('123m 456m 56p'), 3));
});
t('triplets and honours', () => {
  assert(E.isComplete(H('111m 222p 333s 444z 555z 66z'), 0));
});
t('honour pair split is not a set', () => {
  assert(!E.isComplete(H('111m 222p 333s 44z 55z 666z 77z'), 0));
});
t('all-triplet hand', () => {
  assert(E.isComplete(H('111m 222p 333s 444z 666z 77z'), 0)); // 15+2=17 → 5 triplets + pair? 111m,222p,333s,444z,666z = 5 sets + 77z
});
t('waits: two-sided', () => {
  const w = E.waitingTiles(H('123m 456m 789m 123p 45p 99s'), 0);
  assert.deepStrictEqual(w.sort((a, b) => a - b), [tile('3p'), tile('6p')]);
});
t('waits: single (kanchan)', () => {
  const w = E.waitingTiles(H('123m 456m 789m 123p 46p 99s'), 0);
  assert.deepStrictEqual(w, [tile('5p')]);
});
t('waits: tanki', () => {
  const w = E.waitingTiles(H('123m 456m 789m 123p 456p 9s'), 0);
  assert.deepStrictEqual(w, [tile('9s')]);
});

console.log('Shanten');
t('complete = -1', () => assert.strictEqual(E.shanten(H('123m 456m 789m 123p 456p 99s'), 0), -1));
t('ready = 0', () => assert.strictEqual(E.shanten(H('123m 456m 789m 123p 45p 99s'), 0), 0));
t('one away = 1', () => assert.strictEqual(E.shanten(H('123m 456m 789m 12p 45p 99s'), 0), 1));
t('with melds ready', () => assert.strictEqual(E.shanten(H('123m 45p 99s'), 3), 0));

console.log('Scoring');
t('pinghu two-sided, ron, concealed', () => {
  // wait 3p/6p, win on 3p by discard; fully concealed
  const r = score('123m 456m 789m 123p 456p 99s', '6p');
  assert(has(r, '平胡') && has(r, '門清') && !has(r, '獨聽'), names(r));
  assert.strictEqual(r.tai, 3); // 門清1 + 平胡2
});
t('edge wait (12 waiting 3) is single wait, not pinghu', () => {
  const r = score('123m 456m 789m 123p 456p 99s', '3p');
  assert(!has(r, '平胡') && has(r, '獨聽'), names(r));
});
t('edge wait is not pinghu', () => {
  const r = score('123m 456m 789m 123p 456p 99s', '3m'); // 12m waiting 3m is edge; but could also re-read? hand has 123m complete
  // win tile 3m could be placed in 123m (edge wait 12 → 3) or nothing else → no pinghu
  assert(!has(r, '平胡'), names(r));
});
t('self-draw concealed = 不求人', () => {
  const r = score('123m 456m 789m 123p 456p 99s', '5p', { self: true });
  assert(has(r, '不求人') && !has(r, '自摸') && !has(r, '門清'), names(r));
});
t('exposed meld self-draw = 自摸', () => {
  const r = score('456m 789m 123p 456p 99s', '5p', { self: true, melds: [{ type: 'chi', t: tile('1m'), tiles: [0, 1, 2] }] });
  assert(has(r, '自摸') && !has(r, '不求人'), names(r));
});
t('dealer + streak', () => {
  const r = score('123m 456m 789m 123p 456p 99s', '5p', { self: true, seat: 0, dealer: 0, lian: 2 });
  assert(has(r, '莊家') && r.items.some(i => i.zh === '連2拉2' && i.tai === 4), names(r));
});
t('seat wind & round wind triplets', () => {
  // seat 1 with dealer 0 → seat wind South; round East
  const r = score('111z 222z 123m 456m 789m 99p', '9p', {});
  assert(has(r, '圈風') && has(r, '門風'), names(r));
});
t('dragon triplets 1 each', () => {
  const r = score('555z 666z 123m 456m 789m 99p', '9p', {});
  assert.strictEqual(r.items.filter(i => i.zh === '中' || i.zh === '發').length, 2, names(r));
});
t('small three dragons', () => {
  const r = score('555z 666z 77z 123m 456m 789m', '7z', {}); // 14+... need 5 sets: 555z 666z + 3 seqs + pair 77z = 17
  assert(r && has(r, '小三元'), r && names(r));
});
t('big three dragons', () => {
  const r = score('555z 666z 777z 123m 456m 99p', '9p', {});
  assert(has(r, '大三元') && !has(r, '中'), names(r));
});
t('all triplets 碰碰胡', () => {
  const r = score('111m 222p 333s 444z 666z 77z', '7z', { self: true });
  assert(has(r, '碰碰胡'), names(r));
});
t('full flush 清一色', () => {
  const r = score('123m 456m 789m 234m 567m 99m', '7m');
  assert(has(r, '清一色'), r && names(r));
});
t('half flush 混一色', () => {
  const r = score('123m 456m 789m 234m 111z 99m', '9m');
  assert(r && has(r, '混一色'), r && names(r));
});
t('honours only 字一色 is 8 tai', () => {
  const r = score('111z 222z 333z 444z 555z 66z', '6z');
  assert(has(r, '字一色'), names(r));
  assert.strictEqual(r.items.find(i => i.zh === '字一色').tai, 8);
});
t('平胡 requires a win off a discard (not self-drawn)', () => {
  const ron = score('123m 456m 789m 123p 456p 99s', '6p', {});
  const tsumo = score('123m 456m 789m 123p 456p 99s', '6p', { self: true });
  assert(has(ron, '平胡'), names(ron));
  assert(!has(tsumo, '平胡'), names(tsumo));
});
t('人胡 scores 8 tai, 天胡 24, 地胡 16', () => {
  const base = score('123m 456m 789m 123p 456p 99s', '6p', {});
  const ren = score('123m 456m 789m 123p 456p 99s', '6p', { flags: { renhu: true } });
  const di = score('123m 456m 789m 123p 456p 99s', '6p', { flags: { dihu: true } });
  const tian = score('123m 456m 789m 123p 456p 99s', '6p', { self: true, seat: 0, dealer: 0, flags: { tianhu: true } });
  assert.strictEqual(ren.tai - base.tai, 8, names(ren));
  assert.strictEqual(di.tai - base.tai, 16, names(di));
  assert.strictEqual(tian.items.find(i => i.zh === '天胡').tai, 24);
});
t('concealed triplets count', () => {
  const r = score('111m 222p 333s 456m 789p 99s', '9s', { self: true });
  assert(has(r, '三暗刻'), names(r));
});
t('ron on triplet makes it exposed (not 暗刻)', () => {
  const r = score('111m 222p 333s 456m 789p 99s', '1m', {}); // win tile completes 111m by ron → only 2 concealed
  assert(has(r, '兩暗刻') && !has(r, '三暗刻'), names(r));
});
t('matching flowers', () => {
  // seat 1 (south) flowers number 2: 夏 (35) and 蘭 (39)
  const r = score('123m 456m 789m 123p 456p 99s', '5p', { self: true, flowers: [35, 39, 34] });
  const f = r.items.find(i => i.zh === '花牌');
  assert(f && f.tai === 2, names(r));
});
t('completing a flower set earns no extra bonus (花槓 removed to match the reference table)', () => {
  const r = score('123m 456m 789m 123p 456p 99s', '5p', { self: true, flowers: [34, 35, 36, 37] });
  assert(!has(r, '花槓'), names(r));
  assert.strictEqual(r.items.filter(i => i.zh === '花牌').reduce((a, i) => a + i.tai, 0), 1, 'only the seat-matching flower scores'); // seat 1: 夏 only
});
t('all eight flowers', () => {
  const r = score('123m 456m 789m 123p 456p 99s', '5p', { self: true, flowers: [34, 35, 36, 37, 38, 39, 40, 41] });
  assert(has(r, '八仙過海') && !has(r, '花牌'), names(r));
});
t('single wait 獨聽', () => {
  const r = score('123m 456m 789m 123p 456p 9s 9s', '9s', {}); // tanki on 9s
  assert(has(r, '獨聽'), names(r));
});
t('chicken hand scores 0', () => {
  // chi meld, ron on a shanpon triplet, no flowers, no honours: nothing scores
  const r = score('555m 789m 123p 456p 99s', '5m', { melds: [{ type: 'chi', t: 0, tiles: [0, 1, 2] }] });
  assert.strictEqual(r.tai, 0, names(r));
});
t('last tile flags', () => {
  const r = score('123m 456m 789m 123p 456p 99s', '5p', { self: true, flags: { lastTile: true, kongDraw: true } });
  assert(has(r, '海底撈月') && has(r, '槓上開花'), names(r));
});
t('picks the best decomposition', () => {
  // 111222333m can be 3 triplets or 3 sequences; scorer should find the higher one
  const r = score('111m 222m 333m 456p 789p 99s', '9s', { self: true });
  assert(r.tai >= 3, names(r));
});

console.log('Full-match simulation (bots only)');

function sim(seed, skill, log, multiWin) {
  const m = new E.Match({ seed, skill, humanSeats: [], rounds: 1, multiWin });
  let hands = 0, wins = 0, draws = 0, selfdraws = 0, maxTai = 0, steps = 0;
  let ev = m.startHand();
  const t0 = Date.now();
  while (!m.over) {
    ev = m.step(); steps++;
    if (steps > 20000) throw new Error('runaway game seed ' + seed);
    if (ev.type === 'await') throw new Error('bot match awaited human');
    // invariant: concealed tile counts are consistent for every player at every step
    m.players.forEach(p => {
      const n = p.conc.reduce((a, b) => a + b, 0);
      const exp = 16 - 3 * p.melds.length;
      if (n !== exp && n !== exp + 1) throw new Error('bad hand size ' + n + ' exp ' + exp + ' seed ' + seed + ' ev ' + ev.type);
      p.conc.forEach(x => { if (x < 0 || x > 4) throw new Error('bad count'); });
    });
    // invariant: all 144 tiles accounted for
    if (ev.type === 'discard' || ev.type === 'draw') {
      let cnt = m.wall.length;
      m.players.forEach(p => {
        cnt += p.conc.reduce((a, b) => a + b, 0) + p.flowers.length + p.discards.length;
        p.melds.forEach(mm => cnt += mm.tiles.length);
      });
      if (cnt !== 144) throw new Error('tile count ' + cnt + ' seed ' + seed);
    }
    if (ev.type === 'win') {
      hands++; wins++; if (ev.selfDraw) selfdraws++; maxTai = Math.max(maxTai, ev.tai);
      const sum = ev.pay.reduce((a, b) => a + b, 0);
      if (sum !== 0) throw new Error('payments do not balance');
      if (!ev.flowerWin) ev.winners.forEach(w => { if (!E.isComplete(w.hand.conc, w.hand.melds.length)) throw new Error('winner hand incomplete'); });
      if (!m.cfg.multiWin && ev.winners.length !== 1) throw new Error('several winners with multiWin off');
      m.nextHand();
    } else if (ev.type === 'drawgame') { hands++; draws++; m.nextHand(); }
  }
  const chips = m.players.reduce((a, p) => a + p.chips, 0);
  if (chips !== 4000) throw new Error('chips not conserved: ' + chips);
  return { hands, wins, draws, selfdraws, maxTai, steps, ms: Date.now() - t0 };
}

[0, 1, 2].forEach(skill => {
  t('bot match runs clean, skill ' + skill, () => {
    let H = 0, W = 0, D = 0, S = 0, M = 0, ms = 0;
    const N = skill === 1 ? 24 : 10;
    for (let s = 1; s <= N; s++) {
      const r = sim(1000 * skill + s, skill);
      H += r.hands; W += r.wins; D += r.draws; S += r.selfdraws; M = Math.max(M, r.maxTai); ms += r.ms;
    }
    console.log('       skill ' + skill + ': ' + H + ' hands, ' + W + ' wins (' + S + ' self-draw), ' + D + ' draws, max tai ' + M + ', ' + Math.round(ms / H) + ' ms/hand');
    assert(H > 0);
  });
});

t('multiple winners are on by default and can be switched off', () => {
  assert.strictEqual(new E.Match({ seed: 1 }).cfg.multiWin, true);
  assert.strictEqual(new E.Match({ seed: 1, multiWin: undefined }).cfg.multiWin, true);
  assert.strictEqual(new E.Match({ seed: 1, multiWin: true }).cfg.multiWin, true);
  assert.strictEqual(new E.Match({ seed: 1, multiWin: false }).cfg.multiWin, false);
});

t('bot matches with the default (multiple winners on) and with it switched off both balance and conserve points', () => {
  let multiDefault = 0;
  for (const mode of ['default', 'off']) {
    for (let s = 1; s <= 20; s++) {
      const opts = { seed: 900 + s, skill: 1, humanSeats: [], rounds: 1 };
      if (mode === 'off') opts.multiWin = false;
      const m = new E.Match(opts);
      assert.strictEqual(m.cfg.multiWin, mode === 'default');
      let ev = m.startHand(), steps = 0;
      while (!m.over) {
        ev = m.step();
        if (++steps > 20000) throw new Error('runaway');
        if (ev.type === 'win') {
          assert.strictEqual(ev.pay.reduce((a, b) => a + b, 0), 0);
          if (mode === 'off') assert.strictEqual(ev.winners.length, 1);
          else if (ev.winners.length > 1) multiDefault++;
          m.nextHand();
        } else if (ev.type === 'drawgame') m.nextHand();
      }
      assert.strictEqual(m.players.reduce((a, p) => a + p.chips, 0), 4000);
    }
  }
  console.log('       multi-winner hands seen with the default: ' + multiDefault);
});

t('bot matches with the multiple-winners rule explicitly on stay balanced and conserve points', () => {
  let multi = 0;
  for (let s = 1; s <= 30; s++) {
    const m = new E.Match({ seed: 500 + s, skill: 1, humanSeats: [], rounds: 1, multiWin: true });
    let ev = m.startHand(), steps = 0;
    while (!m.over) {
      ev = m.step();
      if (++steps > 20000) throw new Error('runaway');
      if (ev.type === 'win') {
        assert.strictEqual(ev.pay.reduce((a, b) => a + b, 0), 0);
        if (ev.winners.length > 1) multi++;
        const sum = ev.winners.reduce((a, w) => a + w.pay.reduce((x, y) => x + y, 0), 0);
        assert.strictEqual(sum, 0);
        m.nextHand();
      } else if (ev.type === 'drawgame') m.nextHand();
    }
    assert.strictEqual(m.players.reduce((a, p) => a + p.chips, 0), 4000);
  }
  console.log('       multi-winner hands seen: ' + multi);
});

console.log('\n' + passed + ' checks passed' + (process.exitCode ? ' — with failures' : ''));
