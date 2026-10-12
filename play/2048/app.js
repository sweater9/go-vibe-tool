import { SIZE, newGame, move, canMove, pushHistory, undo, serialize, deserialize, values, maxTile, WIN_VALUE } from './engine.js';

const STATE_KEY = 'it_play_2048_state', BEST_KEY = 'it_play_2048_best';
const $ = s => document.querySelector(s);
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable: game still works */ } },
};

const els = { board: $('#board'), tiles: $('#tiles'), score: $('#score'), best: $('#best'), status: $('#status'), text: $('#boardText'), undo: $('#btnUndo'), overlay: $('#overlay'), oTitle: $('#overlayTitle'), oText: $('#overlayText'), keep: $('#btnKeep') };
let state, history = [], best = 0, keepPlaying = false, pending = null;
/** Finish a running slide animation immediately so fast input is never dropped. */
function flush() { if (pending) { clearTimeout(pending.t); const fn = pending.fn; pending = null; fn(); } }
const tileEls = new Map();

function buildCells() {
  const wrap = document.querySelector('.g2048-cells');
  for (let i = 0; i < SIZE * SIZE; i++) {
    const d = document.createElement('div'); d.className = 'g2048-cell';
    d.style.left = (i % SIZE) * 25 + '%'; d.style.top = Math.floor(i / SIZE) * 25 + '%'; wrap.appendChild(d);
  }
}
const tileClass = v => 't' + (v > 2048 ? 'big' : v);
function place(el, r, c) { el.style.setProperty('--r', r); el.style.setProperty('--c', c); }
function makeTile(t, r, c, cls) {
  const el = document.createElement('div');
  el.className = 'g2048-tile ' + tileClass(t.value) + (cls ? ' ' + cls : '');
  el.dataset.id = t.id; el.dataset.value = t.value;
  const b = document.createElement('b'); b.textContent = t.value; el.appendChild(b);
  place(el, r, c); els.tiles.appendChild(el); tileEls.set(t.id, el); return el;
}
/** Make the DOM match `state`. Existing tiles keep their element so CSS can animate them. */
function sync(st, animate = true) {
  const live = new Set();
  st.grid.forEach((row, r) => row.forEach((t, c) => {
    if (!t) return; live.add(t.id);
    const el = tileEls.get(t.id);
    if (el) place(el, r, c);
    else makeTile(t, r, c, animate ? (t.merged ? 'pop' : t.isNew ? 'new' : '') : '');
  }));
  for (const [id, el] of tileEls) if (!live.has(id)) { el.remove(); tileEls.delete(id); }
}
function resetTiles() { els.tiles.textContent = ''; tileEls.clear(); }

function describe(st) {
  const rows = values(st.grid).map((row, i) => `Row ${i + 1}: ${row.map(v => v || 'empty').join(', ')}.`);
  els.text.textContent = rows.join(' ');
}
const say = msg => { els.status.textContent = ''; setTimeout(() => { els.status.textContent = msg; }, 20); };

function persist() {
  store.set(STATE_KEY, serialize(state));
  if (state.score > best) { best = state.score; store.set(BEST_KEY, String(best)); }
}
function renderScores() {
  els.score.textContent = state.score; els.best.textContent = Math.max(best, state.score);
  els.undo.disabled = history.length === 0;
}
function showOverlay(kind) {
  if (!kind) { els.overlay.hidden = true; return; }
  els.overlay.hidden = false;
  els.keep.hidden = kind !== 'win';
  els.oTitle.textContent = kind === 'win' ? 'You made 2048!' : 'Game over';
  els.oText.textContent = kind === 'win' ? `Score ${state.score}. Keep going for a higher score?` : `No moves left. Final score ${state.score}.`;
  (kind === 'win' ? els.keep : $('#btnAgain')).focus();
}

function start(fresh) {
  pending = null; state = fresh || newGame(); history = []; keepPlaying = false;
  resetTiles(); sync(state, true); describe(state); showOverlay(null); renderScores(); persist();
  say('New game. Use arrow keys or swipe to move the tiles.');
}

function doMove(dir) {
  flush();
  if ((state.over && !keepPlaying) || !els.overlay.hidden) return;
  const res = move(state, dir);
  if (!res.moved) return;
  history = pushHistory(history, state);
  const wasWon = state.won;
  state = res.state;
  // Phase 1: slide existing tiles (merging pairs slide onto the target cell); Phase 2: swap in merged/new tiles.
  for (const m of res.moves) { const el = tileEls.get(m.id); if (el) place(el, m.to[0], m.to[1]); }
  const finish = () => sync(state);
  if (reduceMotion()) finish(); else { const fn = finish; pending = { fn, t: setTimeout(() => { pending = null; fn(); }, 115) }; }
  describe(state); persist(); renderScores();
  const parts = [`Moved ${dir}.`];
  if (res.merges) parts.push(`Merged ${res.merges} ${res.merges === 1 ? 'pair' : 'pairs'}, plus ${res.gained} points.`);
  parts.push(`Score ${state.score}.`);
  if (state.won && !wasWon && !keepPlaying) { parts.push('You made 2048!'); showOverlay('win'); }
  else if (state.over) { parts.push('Game over.'); showOverlay('over'); }
  say(parts.join(' '));
}

function doUndo() {
  flush();
  const u = undo(history); if (!u) return;
  state = u.state; history = u.history; keepPlaying = keepPlaying && state.won;
  resetTiles(); sync(state, false); describe(state); showOverlay(null); renderScores(); persist();
  say(`Undid the last move. Score ${state.score}.`);
}

// ---- input ----
const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down' };
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
  const dir = KEYS[e.key];
  if (dir) { e.preventDefault(); doMove(dir); return; }
  if ((e.key === 'z' || e.key === 'u') && !e.shiftKey) { doUndo(); }
});
let swipe = null;
els.board.addEventListener('pointerdown', e => { swipe = { x: e.clientX, y: e.clientY, id: e.pointerId }; try { els.board.setPointerCapture(e.pointerId); } catch { /* ignore */ } });
const endSwipe = e => {
  if (!swipe || swipe.id !== e.pointerId) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y; swipe = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  doMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
};
els.board.addEventListener('pointerup', endSwipe);
els.board.addEventListener('pointercancel', () => { swipe = null; });
document.querySelectorAll('[data-dir]').forEach(b => b.addEventListener('click', () => doMove(b.dataset.dir)));
$('#btnNew').addEventListener('click', () => start());
$('#btnAgain').addEventListener('click', () => start());
els.undo.addEventListener('click', doUndo);
els.keep.addEventListener('click', () => { keepPlaying = true; showOverlay(null); els.board.focus(); say('Keep going. No limit now.'); });

// ---- boot ----
buildCells();
best = parseInt(store.get(BEST_KEY), 10) || 0;
const saved = store.get(STATE_KEY) && deserialize(store.get(STATE_KEY));
if (saved && !saved.over) { state = saved; history = []; resetTiles(); sync(state, false); describe(state); renderScores(); keepPlaying = state.won; }
else start();
window.game2048 = { get state() { return state; }, move: doMove }; // handy for automated tests; no secrets involved

// Offline support: the shared service worker also precaches the games (registered here too for direct visits).
if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("../../sw.js").catch(() => {}));
