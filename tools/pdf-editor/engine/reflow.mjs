/* Paragraph reflow: finds wrapped paragraphs (several lines that share a left edge, font, size, colour and leading) and, for an
   edited paragraph, re-wraps the words onto the SAME lines. Every line stays an ordinary text block that the normal edit path
   rewrites, so characters keep their original font, size and colour and nothing is covered or flattened.
   Reflow is conservative: it never invents lines, never moves other content, and refuses (with a reason) when the new text needs
   more lines than the paragraph has. Anything that does not look like plain wrapped text is not offered as a paragraph. */
import { measureEdit, EditError } from './edit.mjs';

const MIN_FILL = 0.75;      // every line but the last must reach this share of the widest line
const LEAD_MIN = 1.0, LEAD_MAX = 2.2, LEAD_TOL = 0.08;
const styleKey = b => { const k = new Set(b.entries.filter(e => !e.virtual).map(e => `${e.font}|${e.size}|${e.fill}`)); return k.size === 1 ? [...k][0] : null; };
const textWidth = b => b.width * b.userScale;

export const REFLOW_REASONS = {
  overflow: 'The new text needs more lines than this paragraph has. Shorten it, or edit it line by line; reflow never adds lines because that would collide with the text below.',
  longword: 'A single word is wider than the paragraph, so it cannot be wrapped inside it.',
  stale: 'The paragraph changed since it was selected. Select it again.',
};

/* Group editable, single-style, horizontal lines into paragraphs. Returns [{id, blocks, width, justified}]. */
export function detectParagraphs(blocks) {
  const cand = blocks.filter(b => b.editable && !(b.following && b.following.length) && b.dir[0] > 0.999 && Math.abs(b.dir[1]) < 0.02 && b.startState.size > 0 && styleKey(b))
    .sort((a, b) => b.origin[1] - a.origin[1] || a.origin[0] - b.origin[0]);
  const chains = [];
  for (const b of cand) {
    let best = null, bestGap = Infinity;
    for (const ch of chains) {
      const last = ch[ch.length - 1], gap = last.origin[1] - b.origin[1];
      if (Math.abs(last.origin[0] - b.origin[0]) > 1 || Math.abs(last.em - b.em) > 0.01 * b.em || styleKey(last) !== styleKey(b)) continue;
      if (last.text0.tc !== b.text0.tc || last.text0.tz !== b.text0.tz || last.text0.ts !== b.text0.ts) continue;
      if (gap < LEAD_MIN * b.em || gap > LEAD_MAX * b.em) continue;
      if (ch.length >= 2) { const first = ch[0].origin[1] - ch[1].origin[1]; if (Math.abs(gap - first) > LEAD_TOL * first) continue; }
      if (gap < bestGap) { best = ch; bestGap = gap; }
    }
    if (best) best.push(b); else chains.push([b]);
  }
  const out = [];
  for (const ch of chains) {
    if (ch.length < 2) continue;
    const W = Math.max(...ch.map(textWidth));
    if (!ch.slice(0, -1).every(b => textWidth(b) >= MIN_FILL * W)) continue;          // short lines inside: a list or address, not a wrapped paragraph
    if (!ch.every(b => !Number.isFinite(b.room) || b.room >= W - 0.5)) continue;       // other text sits inside the paragraph's width
    const body = ch.slice(0, -1).map(textWidth), justified = ch.length >= 3 && Math.max(...body) - Math.min(...body) < 0.005 * W;
    out.push({ id: 'para:' + ch[0].id, blocks: ch, ids: ch.map(b => b.id), width: W, justified });
  }
  return out;
}

export const paragraphOf = (paras, blockId) => paras.find(p => p.ids.includes(blockId)) || null;

/* The paragraph's text, lines joined by spaces (a hyphen at a line end followed by a lowercase letter is joined without one). */
export function paragraphText(para, textOf = b => b.text) {
  let out = '';
  for (const b of para.blocks) { const t = textOf(b).trim(); if (!out) out = t; else out += (/[\p{L}]-$/u.test(out) && /^\p{Ll}/u.test(t) ? '' : ' ') + t; }
  return out;
}

/* Wrap `text` into at most para.blocks.length lines no wider than the paragraph. Returns {lines, edits, notes}. Throws EditError. */
export async function reflowParagraph(P, doc, lib, para, text) {
  const words = String(text).split(/\s+/).filter(Boolean), notes = new Set(), W = para.width + 0.01, head = para.blocks[0];
  const widthOfLine = async t => { const m = await measureEdit(P, doc, lib, head, { text: t, fmt: [], align: null }); m.notes.forEach(n => notes.add(n)); return m.widthUser; };
  const lines = []; let cur = '';
  for (const w of words) {
    const cand = cur ? cur + ' ' + w : w;
    if (await widthOfLine(cand) <= W) { cur = cand; continue; }
    if (!cur) throw new EditError(REFLOW_REASONS.longword, 'longword');
    lines.push(cur); cur = w; if (await widthOfLine(cur) > W) throw new EditError(REFLOW_REASONS.longword, 'longword');
  }
  if (cur) lines.push(cur);
  if (lines.length > para.blocks.length) throw new EditError(REFLOW_REASONS.overflow, 'overflow');
  const edits = [];
  para.blocks.forEach((b, i) => { const t = i < lines.length ? lines[i] : ''; if (t !== b.text.trim()) edits.push({ blockId: b.id, text: t }); });
  return { lines, edits, notes: [...notes], usedLines: lines.length, totalLines: para.blocks.length };
}
