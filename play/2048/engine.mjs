/* GoVibeTool Play — 2048 Challenge core engine. Pure functions, no DOM; the RNG is injected so tests are deterministic. */
export const SIZE = 4;
export const WIN_VALUE = 2048;
export const DIRECTIONS = ['left', 'right', 'up', 'down'];

const emptyGrid = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

export function newGame(rng = Math.random) {
  let state = { grid: emptyGrid(), score: 0, won: false, over: false, nextId: 1 };
  state = spawnTile(state, rng).state;
  state = spawnTile(state, rng).state;
  return state;
}

export function emptyCells(grid) {
  const out = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!grid[r][c]) out.push([r, c]);
  return out;
}

/** Adds one tile (2 with 90%, 4 with 10%) on a random empty cell. Returns {state, tile|null}. */
export function spawnTile(state, rng = Math.random) {
  const cells = emptyCells(state.grid);
  if (!cells.length) return { state, tile: null };
  const [r, c] = cells[Math.min(cells.length - 1, Math.floor(rng() * cells.length))];
  const tile = { id: state.nextId, value: rng() < 0.9 ? 2 : 4, isNew: true };
  const grid = state.grid.map(row => row.slice());
  grid[r][c] = tile;
  return { state: { ...state, grid, nextId: state.nextId + 1 }, tile: { ...tile, r, c } };
}

/** Coordinates of line `i` read from the edge tiles move towards, for each direction. */
function lineCoords(dir, i) {
  const k = [...Array(SIZE).keys()];
  if (dir === 'left') return k.map(c => [i, c]);
  if (dir === 'right') return k.map(c => [i, SIZE - 1 - c]);
  if (dir === 'up') return k.map(r => [r, i]);
  return k.map(r => [SIZE - 1 - r, i]);
}

/**
 * Slides/merges one line of tiles (already ordered from the leading edge). Each tile merges at most once per move.
 * Returns the new line (values or null), gained score, and per-tile movements.
 */
export function slideLine(values) {
  const tiles = values.map((v, idx) => (v ? { v, from: idx } : null)).filter(Boolean);
  const out = [];
  const moves = [];
  let gained = 0;
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i], next = tiles[i + 1];
    if (next && next.v === t.v) {
      const to = out.length;
      out.push(t.v * 2); gained += t.v * 2;
      moves.push({ from: t.from, to, merged: true }, { from: next.from, to, merged: true });
      i++;
    } else {
      moves.push({ from: t.from, to: out.length, merged: false });
      out.push(t.v);
    }
  }
  while (out.length < SIZE) out.push(null);
  return { line: out, gained, moves };
}

/**
 * Applies a move. Returns { state, moved, gained, merges, moves, spawned }.
 * `moves` lets the UI animate: [{id, from:[r,c], to:[r,c], mergedInto?: newTileId}], `spawned` is the new random tile.
 */
export function move(state, dir, rng = Math.random) {
  if (!DIRECTIONS.includes(dir)) throw new Error('bad direction ' + dir);
  const grid = emptyGrid();
  const moves = [];
  let gained = 0, merges = 0, moved = false, nextId = state.nextId, won = state.won;
  for (let i = 0; i < SIZE; i++) {
    const coords = lineCoords(dir, i);
    const lineTiles = coords.map(([r, c]) => state.grid[r][c]);
    const { line, gained: g, moves: lm } = slideLine(lineTiles.map(t => (t ? t.value : null)));
    gained += g;
    const mergedIds = new Map();
    line.forEach((value, idx) => {
      if (!value) return;
      const [r, c] = coords[idx];
      const sources = lm.filter(m => m.to === idx);
      if (sources.length === 2) {
        const tile = { id: nextId++, value, merged: true };
        grid[r][c] = tile; merges++; mergedIds.set(idx, tile.id);
        if (value >= WIN_VALUE) won = true;
      } else {
        grid[r][c] = { ...lineTiles[sources[0].from], isNew: false, merged: false };
      }
    });
    for (const m of lm) {
      const [fr, fc] = coords[m.from], [tr, tc] = coords[m.to];
      if (fr !== tr || fc !== tc || m.merged) moved = true;
      moves.push({ id: lineTiles[m.from].id, from: [fr, fc], to: [tr, tc], mergedInto: m.merged ? mergedIds.get(m.to) : undefined });
    }
  }
  if (!moved) return { state, moved: false, gained: 0, merges: 0, moves: [], spawned: null };
  let next = { grid, score: state.score + gained, won, over: false, nextId };
  const sp = spawnTile(next, rng);
  next = sp.state;
  next = { ...next, over: !canMove(next.grid) };
  return { state: next, moved: true, gained, merges, moves, spawned: sp.tile };
}

export function canMove(grid) {
  if (emptyCells(grid).length) return true;
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const v = grid[r][c].value;
    if ((c + 1 < SIZE && grid[r][c + 1].value === v) || (r + 1 < SIZE && grid[r + 1][c].value === v)) return true;
  }
  return false;
}

export const values = grid => grid.map(row => row.map(t => (t ? t.value : 0)));
export const maxTile = grid => Math.max(0, ...grid.flat().map(t => (t ? t.value : 0)));

/** Builds a state from plain numbers (0 = empty) — used for tests and for restoring a saved game. */
export function fromValues(v, score = 0, won = false) {
  let id = 1;
  const grid = v.map(row => row.map(x => (x ? { id: id++, value: x } : null)));
  return { grid, score, won, over: !canMove(grid), nextId: id };
}

/** Undo history: a bounded stack of {grid, score, won, nextId} snapshots. */
export function pushHistory(history, state, limit = 50) {
  const snap = { grid: state.grid.map(r => r.map(t => (t ? { ...t } : null))), score: state.score, won: state.won, nextId: state.nextId };
  return [...history, snap].slice(-limit);
}
export function undo(history) {
  if (!history.length) return null;
  const snap = history[history.length - 1];
  return { state: { grid: snap.grid, score: snap.score, won: snap.won, over: false, nextId: snap.nextId }, history: history.slice(0, -1) };
}

export function serialize(state) { return JSON.stringify({ v: values(state.grid), s: state.score, w: state.won }); }
export function deserialize(text) {
  try {
    const d = JSON.parse(text);
    const ok = Array.isArray(d.v) && d.v.length === SIZE && d.v.every(r => Array.isArray(r) && r.length === SIZE && r.every(x => x === 0 || (Number.isInteger(x) && x >= 2 && (x & (x - 1)) === 0)));
    if (!ok || !Number.isFinite(d.s) || d.s < 0) return null;
    return fromValues(d.v, d.s, !!d.w);
  } catch { return null; }
}
