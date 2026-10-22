/* PDF Compare — text tokenising and word-level diff. Pure ES module: no DOM, no network, runs in the browser and in Node.

   Pipeline: pages of text lines -> tokens (words; CJK characters one by one) -> comparison keys -> longest-common-subsequence
   matches (common prefix/suffix trimmed, unique-word anchors, Myers O(ND) between anchors with a hard cap) -> change blocks.
   The cap keeps the worst case bounded: a stretch that is too different to align within MAX_EDITS is reported as one
   replaced block and flagged `approximate`, never as a hang. */

export const LIMITS = Object.freeze({ maxPages: 300, maxBytes: 50 * 1024 * 1024, maxTokens: 400000, maxEdits: 1500, mergeGap: 2 });

const SMALL = 3000;
const CJK = '\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}';
const TOKEN = new RegExp(`[${CJK}]|[^\\s${CJK}]+`, 'gu');

/** Join words that a printer broke across two lines with a hyphen ("inter-" + "national"), only when the next line continues in lower case. */
export function joinHyphenation(lines) {
  const out = lines.slice();
  for (let i = 0; i < out.length - 1; i++) {
    if (/\p{L}-$/u.test(out[i]) && /^\p{Ll}/u.test(out[i + 1])) {
      const m = out[i + 1].match(/^\S+/u)[0];
      out[i] = out[i].slice(0, -1) + m; out[i + 1] = out[i + 1].slice(m.length).trimStart();
    }
  }
  return out;
}

/** Comparison key: ligatures/width forms folded (NFKC), quotes and dashes unified, optional case and punctuation folding. */
export function keyOf(word, { ignoreCase = false, ignorePunctuation = false } = {}) {
  let k = word.normalize('NFKC').replace(/[‘’‛′]/g, "'").replace(/[“”‟″]/g, '"').replace(/[‐-―−]/g, '-');
  if (ignoreCase) k = k.toLocaleLowerCase();
  if (ignorePunctuation) { const s = k.replace(/[\p{P}\p{S}]+/gu, ''); if (s) k = s; }
  return k;
}

/** pages: [{ lines: string[] }]. Returns parallel arrays: words (display), keys (comparison), page (1-based), sp (space before), nl (starts a line). */
export function tokenize(pages, opts = {}) {
  const words = [], keys = [], page = [], sp = [], nl = [];
  pages.forEach((p, pi) => {
    for (const line of joinHyphenation(p.lines.map(l => l.normalize('NFKC').replace(/[­​-‍﻿]/g, '')))) {
      let first = true, prevEnd = 0, m; TOKEN.lastIndex = 0;
      while ((m = TOKEN.exec(line))) {
        words.push(m[0]); keys.push(keyOf(m[0], opts)); page.push(pi + 1);
        sp.push(!first && m.index > prevEnd); nl.push(first); first = false; prevEnd = m.index + m[0].length;
      }
    }
  });
  return { words, keys, page, sp, nl };
}

/* ---------- LCS matches ---------- */
export function myersPairs(a, aLo, aHi, b, bLo, bHi, maxD) {
  const N = aHi - aLo, M = bHi - bLo; if (!N || !M) return [];
  const max = Math.min(N + M, maxD), off = max + 1, v = new Int32Array(2 * max + 3), trace = [];
  for (let d = 0; d <= max; d++) {
    trace.push(v.slice(off - d - 1, off + d + 2)); // state after step d-1, index k+d+1
    for (let k = -d; k <= d; k += 2) {
      let x = (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) ? v[off + k + 1] : v[off + k - 1] + 1, y = x - k;
      while (x < N && y < M && a[aLo + x] === b[bLo + y]) { x++; y++; }
      v[off + k] = x;
      if (x >= N && y >= M) {
        const pairs = []; let cx = N, cy = M;
        for (let dd = d; dd > 0; dd--) {
          const t = trace[dd], at = kk => t[kk + dd + 1], kk = cx - cy;
          const pk = (kk === -dd || (kk !== dd && at(kk - 1) < at(kk + 1))) ? kk + 1 : kk - 1, px = at(pk), py = px - pk;
          while (cx > px && cy > py) { pairs.push([aLo + cx - 1, bLo + cy - 1]); cx--; cy--; }
          cx = px; cy = py;
        }
        while (cx > 0 && cy > 0) { pairs.push([aLo + cx - 1, bLo + cy - 1]); cx--; cy--; }
        return pairs.reverse();
      }
    }
  }
  return null; // more than maxD edits: not aligned precisely
}

/** Longest increasing subsequence of positions (patience sorting). `seq` holds j values ordered by i; returns indexes into seq. */
function lis(seq) {
  const tails = [], prev = new Array(seq.length).fill(-1), tailIdx = [];
  for (let i = 0; i < seq.length; i++) {
    let lo = 0, hi = tails.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (tails[mid] < seq[i]) lo = mid + 1; else hi = mid; }
    tails[lo] = seq[i]; tailIdx[lo] = i; prev[i] = lo ? tailIdx[lo - 1] : -1;
  }
  const out = []; for (let i = tailIdx[tails.length - 1]; i >= 0; i = prev[i]) out.push(i); return out.reverse();
}

/** Matched index pairs [i, j] (increasing in both) between key arrays a and b, plus whether any stretch had to be given up on. */
export function lcsMatches(a, b, { maxEdits = LIMITS.maxEdits } = {}) {
  const matches = []; let approximate = false;
  function solve(aLo, aHi, bLo, bHi, depth) {
    while (aLo < aHi && bLo < bHi && a[aLo] === b[bLo]) { matches.push([aLo++, bLo++]); }
    const tail = []; while (aLo < aHi && bLo < bHi && a[aHi - 1] === b[bHi - 1]) { aHi--; bHi--; tail.push([aHi, bHi]); }
    if (aLo < aHi && bLo < bHi) {
      /* Small stretches are aligned exactly (Myers gives a minimal diff). Large ones are first split at words that occur once on each side. */
      let done = false, tried = false;
      if ((aHi - aLo) + (bHi - bLo) <= SMALL) { tried = true; const r = myersPairs(a, aLo, aHi, b, bLo, bHi, maxEdits); if (r) { for (const p of r) matches.push(p); done = true; } }
      if (!done && depth < 40) {
        const countA = new Map(), posB = new Map();
        for (let i = aLo; i < aHi; i++) countA.set(a[i], (countA.get(a[i]) || 0) + 1);
        for (let j = bLo; j < bHi; j++) { const e = posB.get(b[j]); posB.set(b[j], e === undefined ? j : -1); }
        const cand = []; for (let i = aLo; i < aHi; i++) { if (countA.get(a[i]) !== 1) continue; const j = posB.get(a[i]); if (j !== undefined && j >= 0) cand.push([i, j]); }
        if (cand.length) {
          const keep = lis(cand.map(c => c[1])); let pa = aLo, pb = bLo;
          for (const idx of keep) { const [i, j] = cand[idx]; solve(pa, i, pb, j, depth + 1); matches.push([i, j]); pa = i + 1; pb = j + 1; }
          solve(pa, aHi, pb, bHi, depth + 1); done = true;
        }
      }
      if (!done) { const r = tried ? null : myersPairs(a, aLo, aHi, b, bLo, bHi, maxEdits); if (r === null) approximate = true; else for (const p of r) matches.push(p); }
    }
    for (let t = tail.length - 1; t >= 0; t--) matches.push(tail[t]);
  }
  solve(0, a.length, 0, b.length, 0);
  return { matches, approximate };
}

/** Change blocks from matches. Changes separated by at most `mergeGap` equal words are merged so one edited sentence is one block. */
export function buildChanges(matches, nA, nB, { mergeGap = LIMITS.mergeGap } = {}) {
  const raw = []; let ia = 0, ib = 0;
  for (const [i, j] of matches) { if (i > ia || j > ib) raw.push({ aStart: ia, aEnd: i, bStart: ib, bEnd: j }); ia = i + 1; ib = j + 1; }
  if (ia < nA || ib < nB) raw.push({ aStart: ia, aEnd: nA, bStart: ib, bEnd: nB });
  const merged = [];
  for (const c of raw) { const last = merged[merged.length - 1]; if (last && c.aStart - last.aEnd <= mergeGap) { last.aEnd = c.aEnd; last.bEnd = c.bEnd; } else merged.push({ ...c }); }
  return merged.map((c, n) => ({ ...c, id: n, type: c.aEnd === c.aStart ? 'added' : c.bEnd === c.bStart ? 'removed' : 'changed' }));
}

/** Readable text for a token range (spaces kept where the source had them, line breaks become spaces). */
export function textOf(tok, from, to) {
  let s = ''; for (let i = from; i < to; i++) s += (i > from && (tok.sp[i] || tok.nl[i]) ? ' ' : '') + tok.words[i]; return s;
}
function pagesOf(tok, from, to) { const n = tok.words.length; if (!n) return [0, 0]; if (to > from) return [tok.page[from], tok.page[to - 1]]; const p = tok.page[Math.min(from, n - 1)]; return [p, p]; }

/** Full comparison of two tokenised documents. */
export function compareTokens(ta, tb, opts = {}) {
  const { matches, approximate } = lcsMatches(ta.keys, tb.keys, opts), changes = buildChanges(matches, ta.words.length, tb.words.length, opts);
  const ctx = 8;
  for (const c of changes) {
    c.a = textOf(ta, c.aStart, c.aEnd); c.b = textOf(tb, c.bStart, c.bEnd);
    c.before = textOf(ta, Math.max(0, c.aStart - ctx), c.aStart); c.after = textOf(ta, c.aEnd, Math.min(ta.words.length, c.aEnd + ctx));
    c.pagesA = pagesOf(ta, c.aStart, c.aEnd); c.pagesB = pagesOf(tb, c.bStart, c.bEnd);
  }
  const count = t => changes.filter(c => c.type === t).length;
  return { changes, approximate, summary: { total: changes.length, added: count('added'), removed: count('removed'), changed: count('changed'), wordsA: ta.words.length, wordsB: tb.words.length } };
}
