import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SIZE, newGame, slideLine, move, canMove, fromValues, values, maxTile, pushHistory, undo, serialize, deserialize, emptyCells } from '../play/2048/engine.mjs';
console.log('Running 2048 engine tests...');
const rngSeq = (...n) => { let i = 0; return () => n[i++ % n.length]; };
assert.equal(fs.readFileSync('play/2048/engine.js', 'utf8'), fs.readFileSync('play/2048/engine.mjs', 'utf8'), 'browser and node engine copies must match');
// slideLine merge rules
const L = a => slideLine(a).line.map(x => x || 0);
assert.deepEqual(L([2, 2, 2, 2].map(x => x)), [4, 4, 0, 0]);
assert.deepEqual(L([2, 2, 2, null]), [4, 2, 0, 0]);
assert.deepEqual(L([null, 2, 2, 2]), [4, 2, 0, 0]);
assert.deepEqual(L([4, 4, 8, null]), [8, 8, 0, 0], 'a merged tile must not merge again in the same move');
assert.deepEqual(L([2, null, 2, 4]), [4, 4, 0, 0]);
assert.deepEqual(L([2, 4, 2, 4]), [2, 4, 2, 4]);
assert.deepEqual(L([null, null, null, 8]), [8, 0, 0, 0]);
assert.equal(slideLine([2, 2, 4, 4]).gained, 12);
assert.equal(slideLine([2, 4, 8, 16]).gained, 0);
// new game
const g = newGame(rngSeq(0, 0.5, 0.5, 0.95));
assert.equal(g.grid.flat().filter(Boolean).length, 2); assert.equal(g.score, 0); assert.ok(!g.over && !g.won);
assert.ok(g.grid.flat().filter(Boolean).every(t => t.value === 2 || t.value === 4));
// directions (spawn disabled by rng that picks an occupied-free corner: verify via values minus the spawned tile)
const base = [[2, 2, 0, 0], [0, 0, 0, 0], [4, 0, 4, 0], [0, 0, 0, 2]];
const strip = (state, spawned) => { const v = values(state.grid); if (spawned) v[spawned.r][spawned.c] = 0; return v; };
for (const [dir, expect] of Object.entries({
  left: [[4, 0, 0, 0], [0, 0, 0, 0], [8, 0, 0, 0], [2, 0, 0, 0]],
  right: [[0, 0, 0, 4], [0, 0, 0, 0], [0, 0, 0, 8], [0, 0, 0, 2]],
  up: [[2, 2, 4, 2], [4, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
  down: [[0, 0, 0, 0], [0, 0, 0, 0], [2, 0, 0, 0], [4, 2, 4, 2]],
})) {
  const r = move(fromValues(base), dir, rngSeq(0.5, 0.5));
  assert.ok(r.moved, dir);
  assert.deepEqual(strip(r.state, r.spawned), expect, dir);
  assert.equal(r.state.grid.flat().filter(Boolean).length, expect.flat().filter(Boolean).length + 1, dir + ' spawns exactly one tile');
}
// score accumulates
{ const r = move(fromValues([[2, 2, 4, 4], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), 'left', rngSeq(0.5, 0.5)); assert.equal(r.gained, 12); assert.equal(r.state.score, 12); assert.equal(r.merges, 2); }
// no-op move: no spawn, no score, same state object
{ const s = fromValues([[2, 0, 0, 0], [4, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]); const r = move(s, 'left', rngSeq(0.5)); assert.ok(!r.moved && r.state === s && r.spawned === null && r.gained === 0); }
// win
{ const r = move(fromValues([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), 'left', rngSeq(0.5, 0.5)); assert.ok(r.state.won && maxTile(r.state.grid) === 2048 && !r.state.over); }
// game over / canMove
const full = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 8]];
assert.ok(!canMove(fromValues(full).grid) && fromValues(full).over);
assert.ok(canMove(fromValues([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 8, 8]]).grid), 'adjacent equal tiles keep the game alive');
{ // last move fills the board with no merges left => over
  const r = move(fromValues([[4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2], [4, 2, 4, 0]]), 'right', rngSeq(0.0, 0.0));
  assert.ok(r.moved, 'there is room to move'); assert.ok(r.state.over && emptyCells(r.state.grid).length === 0); }
// moves metadata supports animation (each source tile appears once, merges point at a new tile)
{ const r = move(fromValues([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), 'left', rngSeq(0.9, 0.9));
  assert.equal(r.moves.length, 2); assert.ok(r.moves.every(m => m.mergedInto && m.to[0] === 0 && m.to[1] === 0)); }
// undo
{ let s = fromValues([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]); let h = pushHistory([], s);
  const r = move(s, 'left', rngSeq(0.5, 0.5)); const u = undo(h); assert.deepEqual(values(u.state.grid), values(s.grid)); assert.equal(u.state.score, 0); assert.equal(u.history.length, 0); assert.equal(undo([]), null);
  assert.notDeepEqual(values(r.state.grid), values(u.state.grid));
  let hh = []; for (let i = 0; i < 80; i++) hh = pushHistory(hh, s, 50); assert.equal(hh.length, 50, 'history is bounded'); }
// save / restore with validation
{ const s = fromValues([[2, 4, 0, 0], [0, 8, 0, 0], [0, 0, 16, 0], [0, 0, 0, 2048]], 1234, true); const d = deserialize(serialize(s));
  assert.deepEqual(values(d.grid), values(s.grid)); assert.equal(d.score, 1234); assert.ok(d.won);
  for (const bad of ['', 'x', '{"v":[[3]],"s":0}', '{"v":[[2,2,2,2],[2,2,2,2],[2,2,2,2],[2,2,2,3]],"s":0}', '{"v":[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],"s":-5}']) assert.equal(deserialize(bad), null, bad); }
// random play never produces illegal boards and always terminates
{ let seed = 12345; const rng = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  let s = newGame(rng); let steps = 0;
  while (!s.over && steps++ < 5000) { const dir = ['left', 'up', 'right', 'down'][steps % 4]; const r = move(s, dir, rng); if (r.moved) s = r.state; else { let any = false; for (const d of ['left', 'right', 'up', 'down']) { const rr = move(s, d, rng); if (rr.moved) { s = rr.state; any = true; break; } } if (!any) { assert.ok(!canMove(s.grid)); break; } } 
    for (const row of s.grid) assert.equal(row.length, SIZE); assert.ok(values(s.grid).flat().every(x => x === 0 || (x & (x - 1)) === 0)); }
  assert.ok(s.over, 'a game of alternating moves eventually ends'); }
console.log('✓ 2048 engine: merges, directions, scoring, win, game over, undo, persistence');
