/* PDF Compare core: tokenising, diff correctness, bounded worst case, extraction helpers. node tests/pdf-compare-core.mjs */
import assert from 'node:assert/strict';
import { tokenize, keyOf, lcsMatches, myersPairs, buildChanges, compareTokens, joinHyphenation, LIMITS } from '../tools/pdf-compare/diff.mjs';
import { itemsToLines, assessText, pageRanges } from '../tools/pdf-compare/extract.mjs';

const doc = (...pages) => tokenize(pages.map(p => ({ lines: Array.isArray(p) ? p : [p] })));
const cmp = (a, b, o) => compareTokens(doc(...[].concat(a)), doc(...[].concat(b)), o);

/* ---- reference LCS ---- */
function lcsLen(a, b) { const dp = Array.from({ length: a.length + 1 }, () => new Int32Array(b.length + 1)); for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]); return dp[a.length][b.length]; }
let seed = 12345; const rnd = n => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed % n; };
const validPairs = (a, b, ps) => { let pi = -1, pj = -1; for (const [i, j] of ps) { assert.ok(i > pi && j > pj, 'pairs strictly increase'); assert.equal(a[i], b[j], 'paired words are equal'); pi = i; pj = j; } };

for (let t = 0; t < 400; t++) { // Myers alone is exactly optimal
  const A = rnd(4) + 2, a = Array.from({ length: rnd(40) }, () => rnd(A)), b = Array.from({ length: rnd(40) }, () => rnd(A));
  const r = myersPairs(a, 0, a.length, b, 0, b.length, 1000); validPairs(a, b, r); assert.equal(r.length, lcsLen(a, b), `myers optimal for ${a} / ${b}`);
}
for (let t = 0; t < 300; t++) { // full pipeline (anchors + Myers): always a valid common subsequence, and never badly sub-optimal
  const A = rnd(30) + 2, a = Array.from({ length: rnd(120) }, () => 'w' + rnd(A)), b = a.filter(() => rnd(10) > 1).concat(Array.from({ length: rnd(10) }, () => 'w' + rnd(A)));
  const { matches, approximate } = lcsMatches(a, b); validPairs(a, b, matches); assert.equal(approximate, false);
  assert.ok(matches.length >= lcsLen(a, b) * 0.8, 'close to optimal');
}

/* ---- change blocks ---- */
let r = cmp('The quick brown fox jumps over the lazy dog.', 'The quick brown fox jumps over the lazy dog.'); assert.equal(r.summary.total, 0);
r = cmp('The quick brown fox', 'The quick red fox'); assert.equal(r.summary.total, 1); assert.deepEqual([r.changes[0].type, r.changes[0].a, r.changes[0].b], ['changed', 'brown', 'red']);
r = cmp('Pay within 30 days', 'Pay within 30 days of the invoice date'); assert.equal(r.changes[0].type, 'added'); assert.equal(r.changes[0].b, 'of the invoice date');
r = cmp('Pay within 30 days.', 'Pay within 30 days of the invoice date.'); assert.equal(r.changes[0].type, 'changed', 'punctuation is part of a word unless "ignore punctuation" is on');
r = cmp('Pay within 30 days of the invoice date', 'Pay within 30 days'); assert.equal(r.changes[0].type, 'removed'); assert.equal(r.changes[0].a, 'of the invoice date');
r = cmp('one two three four five six seven eight nine ten', 'one TWO three four five six seven eight NINE ten'); assert.equal(r.summary.total, 2, 'far-apart edits stay separate');
r = cmp('a b c d e f g', 'a X c Y e f g'); assert.equal(r.summary.total, 1, 'edits within two words are merged into one block');
r = cmp('Section 1. Alpha. Section 2. Beta.', 'Section 1. Alpha. Section 2. Beta. Section 3. Gamma.'); assert.equal(r.summary.added, 1);
assert.equal(cmp('', '').summary.total, 0); assert.equal(cmp('', 'new text').changes[0].type, 'added'); assert.equal(cmp('old text', '').changes[0].type, 'removed');

/* ---- pages ---- */
r = cmp(['Page one text here', 'Page two original text'], ['Page one text here', 'Page two revised text']); assert.deepEqual(r.changes[0].pagesA, [2, 2]); assert.deepEqual(r.changes[0].pagesB, [2, 2]);
r = cmp(['p1 a b c', 'p2 d e f'], ['p1 a b c', 'NEW PAGE', 'p2 d e f']); assert.equal(r.summary.added, 1); assert.deepEqual(r.changes[0].pagesB, [2, 2], 'inserted page is reported on the revised document');

/* ---- options ---- */
const o = (a, b, opts) => compareTokens(tokenize([{ lines: [a] }], opts), tokenize([{ lines: [b] }], opts), opts).summary.total;
assert.equal(o('Hello World', 'hello world', {}), 1); assert.equal(o('Hello World', 'hello world', { ignoreCase: true }), 0);
assert.equal(o('end, of line.', 'end of line', {}), 1); assert.equal(o('end, of line.', 'end of line', { ignorePunctuation: true }), 0);
assert.equal(o('office', 'oﬃce', {}), 0, 'ligatures fold'); assert.equal(o('it’s “fine” – ok', "it's \"fine\" - ok", {}), 0, 'smart quotes and dashes fold');
assert.equal(o('a  b\t c', 'a b c', {}), 0, 'whitespace differences are not differences');

/* ---- tokenising ---- */
const t = tokenize([{ lines: ['台灣麻將 Mahjong 2026', 'second line'] }]);
assert.deepEqual(t.words, ['台', '灣', '麻', '將', 'Mahjong', '2026', 'second', 'line']); assert.deepEqual(t.sp, [false, false, false, false, true, true, false, true]); assert.deepEqual(t.nl.map(Number), [1, 0, 0, 0, 0, 0, 1, 0]);
assert.deepEqual(joinHyphenation(['an inter-', 'national deal', 'well-', 'Known']), ['an international', 'deal', 'well-', 'Known'], 'only lower-case continuations are joined');
assert.equal(keyOf('Straße', { ignoreCase: true }), 'straße');
assert.equal(cmp('台灣麻將 規則', '台灣麻雀 規則').summary.total, 1); assert.equal(cmp('台灣麻將 規則', '台灣麻雀 規則').changes[0].a, '將');

/* ---- bounded worst case + speed ---- */
const big = n => Array.from({ length: n }, (_, i) => 'w' + i);
let t0 = Date.now(); const x = big(60000), y = x.slice(); for (let i = 100; i < y.length; i += 1500) y[i] = 'EDIT' + i; y.splice(30000, 0, 'inserted', 'words');
const rr = lcsMatches(x, y); validPairs(x, y, rr.matches); assert.equal(rr.approximate, false); assert.equal(buildChanges(rr.matches, x.length, y.length).length, 41, '40 edits + 1 insertion');
assert.ok(Date.now() - t0 < 1500, `60k words with 41 edits took ${Date.now() - t0}ms`);
t0 = Date.now(); const rep = Array.from({ length: 6000 }, (_, i) => 'a' + (i % 3)), rep2 = Array.from({ length: 6000 }, () => 'a' + rnd(3)); // few unique words, very different
const bad = lcsMatches(rep, rep2, { maxEdits: 300 }); validPairs(rep, rep2, bad.matches); assert.equal(bad.approximate, true, 'gives up cleanly instead of hanging'); assert.ok(Date.now() - t0 < 4000, `worst case took ${Date.now() - t0}ms`);
const bc = buildChanges(bad.matches, rep.length, rep2.length); assert.ok(bc.length >= 1, 'a given-up stretch is still reported as a change');
t0 = Date.now(); const words = Array.from({ length: LIMITS.maxTokens }, (_, i) => 'word' + (i % 5000)); const dA = tokenize([{ lines: [words.join(' ')] }]); const dB = tokenize([{ lines: [words.slice(0, 200000).concat('X', words.slice(200000)).join(' ')] }]);
const big2 = compareTokens(dA, dB); assert.equal(big2.summary.total, 1); assert.ok(Date.now() - t0 < 8000, `400k-word compare took ${Date.now() - t0}ms`);

/* ---- extraction ---- */
const it = (str, x, y, w = str.length * 5, h = 10, eol = false) => ({ str, transform: [h, 0, 0, h, x, y], width: w, height: h, hasEOL: eol });
assert.deepEqual(itemsToLines([it('Hello', 10, 700), it('world', 40, 700), it('Next', 10, 686), it('line', 35, 686)]), ['Hello world', 'Next line'], 'gap becomes a space, new baseline a new line');
assert.deepEqual(itemsToLines([it('Hel', 10, 700, 15), it('lo', 25, 700, 10)]), ['Hello'], 'adjacent pieces stay one word');
assert.deepEqual(itemsToLines([it('A', 10, 700, 5, 10, true), it('B', 10, 700, 5)]), ['A', 'B'], 'hasEOL ends a line');
assert.deepEqual(itemsToLines([]), []); assert.deepEqual(itemsToLines([{ str: 'x' }]), [], 'items without geometry are ignored safely');
assert.deepEqual(assessText(['text here ok', '', '  ', 'more text']), { pages: 4, emptyPages: [2, 3], garbledPages: [], mostlyScanned: true, noText: false });
assert.equal(assessText(['', '']).noText, true); assert.deepEqual(assessText(['���� abc']).garbledPages, [1]); assert.equal(assessText(['normal text', 'more normal text', '']).mostlyScanned, false);
assert.equal(pageRanges([1, 2, 3, 5, 8, 9]), '1–3, 5, 8–9');
console.log('pdf-compare-core: all checks passed');
