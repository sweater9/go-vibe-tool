import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evaluateGuess, dateKey, dayNumber, previousDay, dailyIndex, dailyAnswer, puzzleNumber, makeValidSet, isValidGuess, mergeKeyboard, emptyStats, recordResult, currentStreak, sanitizeStats, shareText, MAX_GUESSES } from '../play/daily-word/engine.mjs';
import { ANSWERS, EXTRA_GUESSES } from '../play/daily-word/words.mjs';
console.log('Running Daily Word Challenge tests...');
for (const f of ['engine', 'words']) assert.equal(fs.readFileSync(`play/daily-word/${f}.js`, 'utf8'), fs.readFileSync(`play/daily-word/${f}.mjs`, 'utf8'), `${f}: browser and node copies must match`);
// letter feedback incl. repeated letters
assert.deepEqual(evaluateGuess('crane', 'crane'), Array(5).fill('correct'));
assert.deepEqual(evaluateGuess('erase', 'speed'), ['present', 'absent', 'absent', 'present', 'present']);
assert.deepEqual(evaluateGuess('llama', 'label'), ['correct', 'present', 'present', 'absent', 'absent']);
assert.deepEqual(evaluateGuess('geese', 'elate'), ['absent', 'present', 'absent', 'absent', 'correct'], 'geese vs elate: the exact E is matched first');
assert.deepEqual(evaluateGuess('speed', 'abide'), ['absent', 'absent', 'present', 'absent', 'present'], 'speed vs abide: only the first of the two guessed Es can be present');
assert.deepEqual(evaluateGuess('eerie', 'tepee'), ['present', 'correct', 'absent', 'absent', 'correct'], 'eerie vs tepee: exact Es first, the spare E in tepee makes the first guessed E present');
assert.deepEqual(evaluateGuess('aaaaa', 'abcde'), ['correct', 'absent', 'absent', 'absent', 'absent'], 'extra copies of a letter are absent');
assert.deepEqual(evaluateGuess('CRANE', 'crane'), Array(5).fill('correct'), 'case-insensitive');
// word lists
const answers = new Set(ANSWERS);
assert.ok(ANSWERS.length >= 800, 'answers: ' + ANSWERS.length);
assert.equal(answers.size, ANSWERS.length, 'no duplicate answers');
assert.ok(ANSWERS.every(w => /^[a-z]{5}$/.test(w)), 'answers are 5 lowercase letters');
assert.ok(EXTRA_GUESSES.every(w => /^[a-z]{5}$/.test(w)), 'guesses are 5 lowercase letters');
const valid = makeValidSet(ANSWERS, EXTRA_GUESSES);
assert.ok(ANSWERS.every(w => valid.has(w)) && valid.size > 10000);
assert.ok(isValidGuess('crane', valid) || isValidGuess('slate', valid), 'common guesses accepted');
assert.ok(!isValidGuess('zzzzz', valid) && !isValidGuess('abc', valid) && !isValidGuess('abcdef', valid) && !isValidGuess('ab1de', valid));
for (const bad of ['whore', 'bitch', 'pussy', 'nigga', 'penis']) assert.ok(!valid.has(bad), 'blocked ' + bad);
// daily puzzle determinism and cycling
assert.equal(dailyAnswer('2026-10-12', ANSWERS), dailyAnswer('2026-10-12', ANSWERS));
assert.notEqual(dailyAnswer('2026-10-12', ANSWERS), dailyAnswer('2026-10-13', ANSWERS));
assert.equal(dailyIndex('2026-01-01', ANSWERS.length), 0);
assert.equal(puzzleNumber('2026-01-01'), 1);
assert.equal(dailyIndex('2026-01-02', 10), 1);
assert.equal(dailyIndex('2025-12-31', 10), 9, 'dates before the epoch still map into range');
assert.equal(dayNumber('2026-03-01') - dayNumber('2026-02-28'), 1);
assert.equal(previousDay('2026-03-01'), '2026-02-28'); assert.equal(previousDay('2026-01-01'), '2025-12-31'); assert.equal(previousDay('2028-03-01'), '2028-02-29');
assert.equal(dateKey(new Date(2026, 9, 5)), '2026-10-05');
const seen = new Set(); for (let i = 0; i < ANSWERS.length; i++) seen.add(dailyAnswer(`2027-${String(1 + (i % 12)).padStart(2, '0')}-01`, ANSWERS)); assert.ok(seen.size > 1);
// keyboard colouring keeps the best state
{ let k = {}; k = mergeKeyboard(k, 'crane', ['absent', 'present', 'absent', 'absent', 'correct']); assert.equal(k.r, 'present'); assert.equal(k.e, 'correct');
  k = mergeKeyboard(k, 'rarer', ['correct', 'absent', 'absent', 'absent', 'absent']); assert.equal(k.r, 'correct', 'upgrade present -> correct'); assert.equal(k.a, 'absent');
  k = mergeKeyboard(k, 'xerox', ['absent', 'absent', 'absent', 'absent', 'absent']); assert.equal(k.e, 'correct', 'never downgrade'); }
// stats and streaks
{ let s = emptyStats();
  s = recordResult(s, { won: true, attempts: 3, date: '2026-10-10' }); assert.deepEqual([s.played, s.won, s.current, s.max, s.dist[2]], [1, 1, 1, 1, 1]);
  s = recordResult(s, { won: true, attempts: 4, date: '2026-10-11' }); assert.deepEqual([s.current, s.max], [2, 2]);
  const dup = recordResult(s, { won: true, attempts: 1, date: '2026-10-11' }); assert.equal(dup, s, 'a date is only recorded once');
  assert.equal(currentStreak(s, '2026-10-11'), 2); assert.equal(currentStreak(s, '2026-10-12'), 2, 'yesterday keeps the streak alive'); assert.equal(currentStreak(s, '2026-10-13'), 0, 'a missed day breaks it');
  s = recordResult(s, { won: true, attempts: 2, date: '2026-10-14' }); assert.deepEqual([s.current, s.max], [1, 2], 'gap restarts the streak, max is kept');
  s = recordResult(s, { won: false, attempts: 6, date: '2026-10-15' }); assert.deepEqual([s.current, s.played, s.won], [0, 4, 3]);
  assert.equal(s.dist.reduce((a, b) => a + b, 0), s.won);
  assert.deepEqual(sanitizeStats(null), emptyStats()); assert.deepEqual(sanitizeStats({ played: -3, dist: [1] }).dist, [0, 0, 0, 0, 0, 0]); assert.equal(sanitizeStats({ played: 'x' }).played, 0); }
// share text never leaks the answer or letters
{ const text = shareText({ date: '2026-10-12', results: [['absent', 'present', 'absent', 'absent', 'correct'], Array(5).fill('correct')], won: true });
  assert.match(text, /^GoVibeTool Daily Word #285 2\/6\n\n⬛🟨⬛⬛🟩\n🟩🟩🟩🟩🟩\nhttps:\/\/govibetool\.com\/play\/daily-word\/$/, text);
  assert.ok(!/[a-z]{5}/i.test(text.split('\n').slice(2, 4).join('')));
  assert.match(shareText({ date: '2026-10-12', results: Array(6).fill(['absent', 'absent', 'absent', 'absent', 'absent']), won: false }), /X\/6/);
  assert.match(shareText({ date: '2026-10-12', results: [Array(5).fill('correct')], won: true, mode: 'practice' }), /^GoVibeTool Word Practice 1\/6/); assert.equal(MAX_GUESSES, 6); }
console.log('✓ Daily Word engine: scoring, lists, daily determinism, keyboard, stats, share');
