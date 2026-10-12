import { WORD_LENGTH, MAX_GUESSES, evaluateGuess, dateKey, makeValidSet, isValidGuess, normalise, mergeKeyboard, dailyAnswer, puzzleNumber, emptyStats, recordResult, currentStreak, sanitizeStats, shareText } from './engine.js';
import { ANSWERS, EXTRA_GUESSES } from './words.js';

const K = { daily: 'it_play_dailyword_daily', practice: 'it_play_dailyword_practice', stats: 'it_play_dailyword_stats', contrast: 'it_play_dailyword_contrast', mode: 'it_play_dailyword_mode' };
const $ = s => document.querySelector(s);
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable: play continues without saving */ } },
};
const readJSON = k => { try { return JSON.parse(store.get(k)); } catch { return null; } };
const VALID = makeValidSet(ANSWERS, EXTRA_GUESSES);

const els = { grid: $('#grid'), toast: $('#toast'), announce: $('#announce'), kbd: $('#kbd'), sub: $('#subtitle') };
let mode = 'daily', today = dateKey(), game, typing = '', locked = false, stats = sanitizeStats(readJSON(K.stats)), toastTimer;

const freshGame = (answer, date) => ({ answer, date, guesses: [], status: 'playing' });
function pickPractice(prev) {
  let w = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
  if (w === prev) w = ANSWERS[(ANSWERS.indexOf(w) + 1 + Math.floor(Math.random() * (ANSWERS.length - 1))) % ANSWERS.length];
  return w;
}
function loadGame(m) {
  const saved = readJSON(m === 'daily' ? K.daily : K.practice);
  const ok = saved && typeof saved.answer === 'string' && /^[a-z]{5}$/.test(saved.answer) && Array.isArray(saved.guesses) && saved.guesses.every(g => isValidGuess(g, VALID)) && saved.guesses.length <= MAX_GUESSES && ['playing', 'won', 'lost'].includes(saved.status);
  if (m === 'daily') {
    const answer = dailyAnswer(today, ANSWERS);
    if (ok && saved.date === today && saved.answer === answer) return saved;
    return freshGame(answer, today);
  }
  return ok ? saved : freshGame(pickPractice(), null);
}
const save = () => store.set(mode === 'daily' ? K.daily : K.practice, JSON.stringify(game));

// ---------- grid ----------
function buildGrid() {
  els.grid.textContent = '';
  for (let r = 0; r < MAX_GUESSES; r++) {
    const row = document.createElement('div'); row.className = 'gw-row'; row.setAttribute('role', 'row'); row.dataset.row = r;
    for (let c = 0; c < WORD_LENGTH; c++) {
      const t = document.createElement('div'); t.className = 'gw-tile'; t.setAttribute('role', 'gridcell'); t.dataset.col = c;
      t.setAttribute('aria-label', `Row ${r + 1}, column ${c + 1}, empty`); row.appendChild(t);
    }
    els.grid.appendChild(row);
  }
}
const rowEl = r => els.grid.children[r];
/** After a mode switch or dialog, focus returns to the grid (not a button) so Enter submits a guess instead of re-activating a button. */
const focusGrid = () => els.grid.focus({ preventScroll: true });
function paintRow(r, word, result, animate) {
  [...rowEl(r).children].forEach((t, i) => {
    t.textContent = word[i] || '';
    t.className = 'gw-tile' + (word[i] ? ' filled' : '') + (result ? ' ' + result[i] : '');
    if (result && animate && !reduceMotion()) { t.style.setProperty('--i', i); t.classList.add('flip'); }
    t.setAttribute('aria-label', `Row ${r + 1}, column ${i + 1}, ${word[i] ? word[i] + (result ? ', ' + result[i] : ', typed') : 'empty'}`);
  });
}
function keyboardState() {
  let map = {};
  for (const g of game.guesses) map = mergeKeyboard(map, g, evaluateGuess(g, game.answer));
  return map;
}
function paintKeyboard() {
  const map = keyboardState();
  els.kbd.querySelectorAll('.gw-key[data-key]').forEach(b => {
    const k = b.dataset.key; if (k.length !== 1) return;
    b.classList.remove('correct', 'present', 'absent'); if (map[k]) b.classList.add(map[k]);
    b.setAttribute('aria-label', map[k] ? `${k}, ${map[k]}` : k);
  });
}
function render() {
  buildGrid();
  game.guesses.forEach((g, r) => paintRow(r, g, evaluateGuess(g, game.answer), false));
  if (game.status === 'playing') paintRow(game.guesses.length, typing, null, false);
  paintKeyboard();
  els.sub.textContent = mode === 'daily' ? `Daily puzzle #${puzzleNumber(today)}. Guess the five-letter word in six tries.` : 'Practice mode: unlimited words, not counted in your streak.';
  $('#modeDaily').setAttribute('aria-pressed', mode === 'daily'); $('#modePractice').setAttribute('aria-pressed', mode === 'practice');
  $('#btnNewPractice').hidden = mode !== 'practice';
}

// ---------- messages ----------
function toast(msg, ms = 1800) { clearTimeout(toastTimer); els.toast.textContent = msg; if (ms) toastTimer = setTimeout(() => { els.toast.textContent = ''; }, ms); }
const announce = msg => { els.announce.textContent = ''; setTimeout(() => { els.announce.textContent = msg; }, 20); };
function shake(r) { const el = rowEl(r); if (reduceMotion()) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

// ---------- input ----------
function addLetter(l) {
  if (game.status !== 'playing' || locked || typing.length >= WORD_LENGTH) return;
  typing += l; paintRow(game.guesses.length, typing, null, false);
}
function backspace() {
  if (game.status !== 'playing' || locked || !typing) return;
  typing = typing.slice(0, -1); paintRow(game.guesses.length, typing, null, false);
}
function submit() {
  if (game.status !== 'playing' || locked) return;
  const r = game.guesses.length, word = normalise(typing);
  if (word.length < WORD_LENGTH) { shake(r); toast('Not enough letters'); announce('Not enough letters'); return; }
  if (!isValidGuess(word, VALID)) { shake(r); toast('Not in word list'); announce(`${word} is not in the word list`); return; }
  const result = evaluateGuess(word, game.answer);
  game.guesses.push(word); typing = '';
  const won = word === game.answer;
  game.status = won ? 'won' : game.guesses.length >= MAX_GUESSES ? 'lost' : 'playing';
  save();
  if (game.status !== 'playing') recordDaily();
  paintRow(r, word, result, true);
  locked = !reduceMotion();
  const describe = `Guess ${r + 1}: ` + [...word].map((l, i) => `${l} ${result[i]}`).join(', ') + '.';
  const done = () => {
    locked = false; paintKeyboard();
    if (game.status === 'playing') { announce(describe); return; }
    finishGame(describe);
  };
  if (locked) setTimeout(done, 5 * 220 + 300); else done();
}
/** Stats are written the moment the game ends (not after the reveal animation) so a reload can never lose a result. */
function recordDaily() {
  if (mode !== 'daily' || game.status === 'playing') return;
  stats = recordResult(stats, { won: game.status === 'won', attempts: game.guesses.length, date: today }); store.set(K.stats, JSON.stringify(stats));
}
function finishGame(describe) {
  const won = game.status === 'won';
  const msg = won ? ['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!'][game.guesses.length - 1] : `The word was ${game.answer.toUpperCase()}`;
  toast(msg, 0); announce(`${describe} ${won ? 'You solved it in ' + game.guesses.length + (game.guesses.length === 1 ? ' guess.' : ' guesses.') : 'Out of guesses. The word was ' + game.answer + '.'}`);
  setTimeout(() => openStats(true), reduceMotion() ? 0 : 500);
}
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (document.querySelector('dialog[open]')) return;
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (e.key === 'Enter') { if (e.target && e.target.tagName === 'BUTTON' && !e.target.classList.contains('gw-key')) return; e.preventDefault(); submit(); }
  else if (e.key === 'Backspace') { e.preventDefault(); backspace(); }
  else if (/^[a-zA-Z]$/.test(e.key)) { e.preventDefault(); addLetter(e.key.toLowerCase()); }
});
els.kbd.addEventListener('click', e => {
  const b = e.target.closest('[data-key]'); if (!b) return;
  const k = b.dataset.key; if (k === 'Enter') submit(); else if (k === 'Backspace') backspace(); else addLetter(k);
});

// ---------- dialogs, stats, share ----------
function openDialog(d) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
document.querySelectorAll('dialog [data-close]').forEach(b => b.addEventListener('click', () => { const d = b.closest('dialog'); d.close ? d.close() : d.removeAttribute('open'); }));
document.querySelectorAll('dialog').forEach(d => { d.addEventListener('click', e => { if (e.target === d && d.close) d.close(); }); d.addEventListener('close', focusGrid); });
function resultsRows() { return game.guesses.map(g => evaluateGuess(g, game.answer)); }
function openStats(showResult) {
  const s = stats, pct = s.played ? Math.round(100 * s.won / s.played) : 0;
  $('#stPlayed').textContent = s.played; $('#stWin').textContent = pct; $('#stCur').textContent = currentStreak(s, today); $('#stMax').textContent = s.max;
  const max = Math.max(1, ...s.dist), last = game.status === 'won' && mode === 'daily' ? game.guesses.length : 0;
  $('#stDist').innerHTML = s.dist.map((n, i) => `<div class="${last === i + 1 ? 'win' : ''}"><i style="font-style:normal">${i + 1}</i><span style="width:${Math.max(8, Math.round(100 * n / max))}%">${n}</span></div>`).join('');
  const finished = game.status !== 'playing';
  $('#statsResult').hidden = !(showResult && finished);
  $('#btnShare').hidden = !finished;
  if (finished) {
    $('#resultLine').textContent = game.status === 'won' ? `Solved in ${game.guesses.length} of ${MAX_GUESSES}` : `The word was ${game.answer.toUpperCase()}`;
    $('#shareBox').textContent = shareText({ date: today, results: resultsRows(), won: game.status === 'won', mode });
  }
  const next = new Date(); next.setHours(24, 0, 0, 0);
  const ms = next - new Date(), h = Math.floor(ms / 36e5), m = Math.floor(ms % 36e5 / 6e4);
  $('#nextWord').textContent = mode === 'daily' ? `Next daily puzzle in ${h}h ${m}m (local midnight).` : 'Practice results are not counted in these statistics.';
  openDialog($('#dlgStats'));
}
$('#btnStats').addEventListener('click', () => openStats(false));
$('#btnHelp').addEventListener('click', () => openDialog($('#dlgHelp')));
$('#btnShare').addEventListener('click', async () => {
  const text = shareText({ date: today, results: resultsRows(), won: game.status === 'won', mode });
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
    await navigator.clipboard.writeText(text); toast('Copied results to clipboard');
  } catch {
    const box = $('#shareBox'); const range = document.createRange(); range.selectNodeContents(box);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range); toast('Press Ctrl/⌘+C to copy the selected result');
  }
});

// ---------- modes & settings ----------
function setMode(m) {
  mode = m; store.set(K.mode, m); typing = ''; locked = false; today = dateKey();
  game = loadGame(m); if (m === 'practice') save();
  render(); toast('', 0); focusGrid();
  if (game.status !== 'playing') toast(game.status === 'won' ? 'Already solved — open Stats to share.' : `The word was ${game.answer.toUpperCase()}`, 0);
}
$('#modeDaily').addEventListener('click', () => setMode('daily'));
$('#modePractice').addEventListener('click', () => setMode('practice'));
$('#btnNewPractice').addEventListener('click', () => { typing = ''; locked = false; game = freshGame(pickPractice(game.answer), null); save(); render(); toast('', 0); focusGrid(); announce('New practice word. Six guesses.'); });
const contrastBtn = $('#btnContrast');
function applyContrast(on) { document.body.classList.toggle('hc', on); contrastBtn.setAttribute('aria-pressed', on); }
contrastBtn.addEventListener('click', () => { const on = contrastBtn.getAttribute('aria-pressed') !== 'true'; applyContrast(on); store.set(K.contrast, on ? '1' : '0'); });
applyContrast(store.get(K.contrast) === '1');

// ---------- boot ----------
mode = store.get(K.mode) === 'practice' ? 'practice' : 'daily';
game = loadGame(mode); if (mode === 'practice') save();
render();
if (mode === 'daily') { save(); recordDaily(); }
if (game.status !== 'playing') toast(game.status === 'won' ? 'Solved — open Stats to share your result.' : `The word was ${game.answer.toUpperCase()}`, 0);

// Offline support: the shared service worker also precaches the games (registered here too for direct visits).
if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("../../sw.js").catch(() => {}));
