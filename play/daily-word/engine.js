/* GoVibeTool Play — Daily Word Challenge core engine. Pure functions, no DOM, no network. */
export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;
const EPOCH_DAY = Math.floor(Date.UTC(2026, 0, 1) / 86400000);

/** Two-pass scoring so repeated letters are counted correctly. Returns ['correct'|'present'|'absent', ...]. */
export function evaluateGuess(guess, answer) {
  const g = guess.toLowerCase(), a = answer.toLowerCase();
  const result = Array(g.length).fill('absent');
  const remaining = {};
  for (let i = 0; i < a.length; i++) {
    if (g[i] === a[i]) result[i] = 'correct';
    else remaining[a[i]] = (remaining[a[i]] || 0) + 1;
  }
  for (let i = 0; i < g.length; i++) {
    if (result[i] === 'correct') continue;
    if (remaining[g[i]] > 0) { result[i] = 'present'; remaining[g[i]]--; }
  }
  return result;
}

export function dateKey(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function dayNumber(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}
export function previousDay(key) {
  const t = new Date((dayNumber(key) - 1) * 86400000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}
/** Same date + same list always gives the same word. The list order is fixed (seeded shuffle at build time). */
export function dailyIndex(key, count) { return (((dayNumber(key) - EPOCH_DAY) % count) + count) % count; }
export function dailyAnswer(key, answers) { return answers[dailyIndex(key, answers.length)]; }
export function puzzleNumber(key) { return dayNumber(key) - EPOCH_DAY + 1; }

export function makeValidSet(answers, extra) { return new Set([...answers, ...extra]); }
export function normalise(word) { return String(word || '').trim().toLowerCase(); }
export function isValidGuess(word, validSet) { return /^[a-z]{5}$/.test(word) && validSet.has(word); }

const RANK = { absent: 1, present: 2, correct: 3 };
/** Keyboard colouring: a letter keeps the best state it has ever had. */
export function mergeKeyboard(map, guess, result) {
  const next = { ...map };
  for (let i = 0; i < guess.length; i++) {
    const l = guess[i];
    if (!next[l] || RANK[result[i]] > RANK[next[l]]) next[l] = result[i];
  }
  return next;
}

export const emptyStats = () => ({ played: 0, won: 0, current: 0, max: 0, dist: [0, 0, 0, 0, 0, 0], lastWonDate: null, lastPlayedDate: null });

/** Records a finished DAILY game. Pure: returns new stats. Ignores a second record for the same date. */
export function recordResult(stats, { won, attempts, date }) {
  if (stats.lastPlayedDate === date) return stats;
  const s = { ...stats, dist: stats.dist.slice(), played: stats.played + 1, lastPlayedDate: date };
  if (won) {
    s.won += 1;
    s.dist[Math.min(attempts, MAX_GUESSES) - 1] += 1;
    s.current = stats.lastWonDate === previousDay(date) ? stats.current + 1 : 1;
    s.max = Math.max(s.max, s.current);
    s.lastWonDate = date;
  } else {
    s.current = 0;
  }
  return s;
}
/** Streak shown to the player: broken if they did not win yesterday or today. */
export function currentStreak(stats, today) {
  if (!stats.lastWonDate) return 0;
  return stats.lastWonDate === today || stats.lastWonDate === previousDay(today) ? stats.current : 0;
}
export function sanitizeStats(raw) {
  const base = emptyStats();
  if (!raw || typeof raw !== 'object') return base;
  const n = v => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  return {
    played: n(raw.played), won: n(raw.won), current: n(raw.current), max: n(raw.max),
    dist: Array.isArray(raw.dist) && raw.dist.length === 6 ? raw.dist.map(n) : base.dist,
    lastWonDate: typeof raw.lastWonDate === 'string' ? raw.lastWonDate : null,
    lastPlayedDate: typeof raw.lastPlayedDate === 'string' ? raw.lastPlayedDate : null,
  };
}

const EMOJI = { correct: '🟩', present: '🟨', absent: '⬛' };
/** Privacy-safe share text: pattern only, never the letters or the answer. */
export function shareText({ date, results, won, mode = 'daily' }) {
  const score = won ? `${results.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
  const title = mode === 'daily' ? `GoVibeTool Daily Word #${puzzleNumber(date)} ${score}` : `GoVibeTool Word Practice ${score}`;
  return `${title}\n\n${results.map(r => r.map(x => EMOJI[x]).join('')).join('\n')}\nhttps://govibetool.com/play/daily-word/`;
}
