'use strict';
// Randomised "human" at seat 0: takes arbitrary legal actions (kongs, chi, peng, pass, discard)
// and also throws in invalid actions that the engine must reject without corrupting state.
const assert = require('assert');
const E = require('../engine.js');

function rng(seed) { return E.mulberry32(seed); }

function totalTiles(m) {
  let n = m.wall.length;
  m.players.forEach(p => {
    n += p.conc.reduce((a, b) => a + b, 0) + p.flowers.length + p.discards.length;
    p.melds.forEach(mm => { n += mm.tiles.length; });
  });
  // a tile currently being claimed has been popped from discards already; allow the in-flight tile
  return n;
}

let counts = { hu: 0, selfHu: 0, angang: 0, jiagang: 0, peng: 0, chi: 0, gang: 0, robKong: 0, draw: 0, invalid: 0, hands: 0, maxTai: 0 };

function playMatch(seed, skill, policy) {
  const r = rng(seed ^ 0x9e3779b9);
  const m = new E.Match({ seed, skill, humanSeats: [0], rounds: 1 });
  m.startHand();
  let steps = 0;
  while (!m.over) {
    if (++steps > 30000) throw new Error('stuck, seed ' + seed);
    const ev = m.step();
    if (ev.type === 'await') {
      if (ev.kind === 'self') {
        const o = ev.options, p = m.players[0];
        // sometimes send garbage first
        if (r() < 0.05) {
          m.act({ kind: 'discard', tile: 99 }); counts.invalid++;
          const again = m.step();
          assert.strictEqual(again.type, 'await', 'invalid discard must re-prompt');
        }
        let a;
        if (o.hu && (policy === 'greedy' || r() < 0.9)) { a = { kind: 'hu' }; counts.selfHu++; }
        else if (o.angang.length && r() < 0.6) { a = { kind: 'angang', tile: o.angang[0] }; counts.angang++; }
        else if (o.jiagang.length && r() < 0.6) { a = { kind: 'jiagang', tile: o.jiagang[0] }; counts.jiagang++; }
        else {
          const pool = []; p.conc.forEach((c, t) => { for (let i = 0; i < c; i++) pool.push(t); });
          a = { kind: 'discard', tile: pool[Math.floor(r() * pool.length)] };
        }
        m.act(a);
      } else {
        const o = ev.options;
        if (r() < 0.05) { m.act({ kind: 'chi', tiles: [0, 1] }); counts.invalid++; } // possibly invalid; engine treats invalid as re-prompt
        let a = { kind: 'pass' };
        if (o.hu) { a = { kind: 'hu' }; }
        else if (o.gang && r() < 0.5) { a = { kind: 'gang' }; counts.gang++; }
        else if (o.peng && r() < 0.6) { a = { kind: 'peng' }; counts.peng++; }
        else if (o.chi && r() < 0.6) { a = { kind: 'chi', tiles: o.chi[Math.floor(r() * o.chi.length)] }; counts.chi++; }
        if (ev.robKong && a.kind === 'hu') counts.robKong++;
        m.act(a);
      }
      continue;
    }
    // invariants after every engine event
    m.players.forEach(p => {
      const n = p.conc.reduce((x, y) => x + y, 0), exp = 16 - 3 * p.melds.length;
      if (n !== exp && n !== exp + 1) throw new Error(`hand size ${n} (exp ${exp}) after ${ev.type}, seed ${seed}`);
      p.conc.forEach(x => { if (x < 0 || x > 4) throw new Error('bad count'); });
    });
    if (ev.type === 'win') {
      counts.hu++; counts.hands++; counts.maxTai = Math.max(counts.maxTai, ev.tai);
      assert.strictEqual(ev.pay.reduce((a, b) => a + b, 0), 0, 'payments balance');
      assert(ev.items.length > 0);
      assert.strictEqual(ev.items.reduce((a, i) => a + i.tai, 0), ev.tai, 'items sum to tai');
      // the winning hand must really be complete
      assert(E.isComplete(ev.hand.conc, ev.hand.melds.length), 'winning hand complete');
      m.nextHand();
    } else if (ev.type === 'drawgame') { counts.draw++; counts.hands++; m.nextHand(); }
  }
  assert.strictEqual(m.players.reduce((a, p) => a + p.chips, 0), 4000, 'points conserved');
}

let n = 0;
for (let s = 1; s <= 160; s++) {
  playMatch(s * 7919, s % 3, s % 2 ? 'greedy' : 'random');
  n++;
}
console.log('fuzz matches:', n);
console.log(JSON.stringify(counts));
assert(counts.angang + counts.jiagang + counts.gang > 0, 'kongs were exercised');
assert(counts.chi > 0 && counts.peng > 0, 'chi and peng were exercised');
console.log('fuzz ok');
