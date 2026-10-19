/* Text model: turns the interpreter's show operators into editable "blocks" (a line of text the user can select).
   A block is a run of show operators inside ONE text object (BT..ET) that share a baseline, matrix and text state and sit
   next to each other. Every character keeps its own font, size, colour and the TJ adjustment that preceded it, so unchanged
   characters can be written back exactly as they were. */
import { interpret, mul, applyPt } from './content.mjs';
import { pageContent } from '../textedit.mjs';

const EPS = 1e-4;
const ALLOWED_BETWEEN = new Set(['Td', 'TD', 'Tm', 'T*', 'Tf', 'g', 'rg', 'k', 'sc', 'scn', 'cs']);
const same6 = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-3);
const REASONS = {
  type3: 'This text uses a Type 3 (drawn-glyph) font, which cannot be edited.',
  cmap: 'This text uses a composite font with a custom character map, which the editor cannot rewrite safely.',
  'no-unicode-map': 'This font has no Unicode mapping (no ToUnicode table), so the editor cannot tell which characters its codes mean.',
  encoding: 'This text uses an encoding the editor cannot rewrite safely.',
  'no-widths': 'This font has no width information, so a safe edit cannot be laid out.',
  'font-missing': 'The font of this text could not be found on the page.',
  unmapped: 'Some characters in this text have no Unicode meaning in their font, so the line cannot be edited safely.',
  invisible: 'This is an invisible text layer (for example from OCR), not visible page text.',
  'render-mode': 'This text is drawn with a stroke/clip rendering mode that cannot be edited.',
  operator: 'This line is built with an operator the editor cannot reproduce faithfully.',
};
export const blockReason = code => REASONS[code] || 'This text cannot be edited in place.';

/* Entries of one show operator. */
function entriesOfShow(show, bi) {
  const info = show.fontInfo, out = []; let pend = 0; const th = show.tz / 100;
  for (const it of show.items) {
    if (it.adj !== undefined) { pend += it.adj; continue; }
    const bpc = info ? info.bytes : 1;
    for (let k = 0; k + bpc <= it.codes.length; k += bpc) {
      const code = bpc === 2 ? (it.codes[k] << 8) | it.codes[k + 1] : it.codes[k];
      let ch = info && info.usable ? info.decode(code) : null; let unmapped = false; if (ch == null || ch === '') { ch = '�'; unmapped = true; }
      const w = ((info ? info.width(code) : 0) / 1000 * show.size + show.tc + ((bpc === 1 && code === 32) ? show.tw : 0)) * th;
      const prev = out[out.length - 1];
      // a TJ gap wide enough to be a word space becomes a virtual space character (no glyph is written for it)
      if (pend <= -180 && prev && prev.ch !== ' ' && ch !== ' ') { const gw = -pend / 1000 * show.size * th; out.push({ ch: ' ', virtual: true, adj: pend, w: gw, show: bi, code: null, size: show.size, font: show.font, fontInfo: info, fill: show.fill }); pend = 0; }
      out.push({ ch, code, bytes: bpc, adj: pend, w, unmapped, show: bi, size: show.size, font: show.font, fontInfo: info, fill: show.fill }); pend = 0;
    }
  }
  return out;
}

export function buildBlocks(interp, pageIndex = 0) {
  const { shows, ops } = interp, blocks = [];
  const mergeable = (p, n) => {
    if (!p.inText || !n.inText || p.bt !== n.bt || p.unsupported || n.unsupported || n.kind === "'") return false;
    if (!(p.fontInfo && p.fontInfo.usable && n.fontInfo && n.fontInfo.usable)) return false;
    for (let i = p.opIndex + 1; i < n.opIndex; i++) if (!ALLOWED_BETWEEN.has(ops[i].op)) return false;
    if (p.tc !== n.tc || p.tw !== n.tw || p.tz !== n.tz || p.ts !== n.ts || p.tr !== n.tr || !same6(p.ctm, n.ctm)) return false;
    if (n.chained) return true;
    if (!same6(p.tm0.slice(0, 4).concat([0, 0]), n.tm0.slice(0, 4).concat([0, 0]))) return false;
    const det = p.tm0[0] * p.tm0[3] - p.tm0[1] * p.tm0[2]; if (Math.abs(det) < EPS) return false;
    const de = n.tm0[4] - p.tmEnd[4], df = n.tm0[5] - p.tmEnd[5];
    const dxt = (de * p.tm0[3] - df * p.tm0[2]) / det, dyt = (-de * p.tm0[1] + df * p.tm0[0]) / det; // coordinates in p's text space
    const em = Math.abs(p.size) || 1;
    return Math.abs(dyt) <= 0.05 * em && dxt >= -0.35 * em && dxt <= 1.2 * em;
  };
  let i = 0;
  while (i < shows.length) {
    let j = i; while (j + 1 < shows.length && mergeable(shows[j], shows[j + 1])) j++;
    blocks.push(makeBlock(interp, i, j, blocks.length, pageIndex)); i = j + 1;
  }
  return blocks;
}

function makeBlock(interp, i, j, n, pageIndex) {
  const { shows, ops } = interp, first = shows[i], last = shows[j], ids = []; const entries = []; let reason = null;
  for (let k = i; k <= j; k++) {
    const s = shows[k]; ids.push(k);
    if (!s.fontInfo || !s.fontInfo.usable) reason = reason || (s.fontInfo ? s.fontInfo.reason : 'font-missing');
    if (s.tr === 3) reason = reason || 'invisible'; else if (s.tr !== 0) reason = reason || 'render-mode';
    if (s.unsupported) reason = reason || 'operator';
    if (!(s.size > 0)) reason = reason || 'operator';
    const es = entriesOfShow(s, k);
    if (k > i) { // gap between two positioned fragments of the block
      const p = shows[k - 1]; const th = p.tz / 100;
      if (!s.chained) {
        const det = p.tm0[0] * p.tm0[3] - p.tm0[1] * p.tm0[2];
        const de = s.tm0[4] - p.tmEnd[4], df = s.tm0[5] - p.tmEnd[5]; const dxt = (de * p.tm0[3] - df * p.tm0[2]) / det; // text-space gap (already includes Th)
        if (es.length) {
          const prevLast = entries[entries.length - 1];
          if (dxt >= 0.2 * Math.abs(p.size) && prevLast && prevLast.ch !== ' ' && es[0].ch !== ' ') es.unshift({ ch: ' ', virtual: true, adj: -dxt / th / s.size * 1000, w: dxt, show: k, code: null, size: s.size, font: s.font, fontInfo: s.fontInfo, fill: s.fill });
          else es[0].adj += -dxt / th / s.size * 1000;
        }
      }
    }
    entries.push(...es);
  }
  if (entries.some(e => e.unmapped)) reason = reason || 'unmapped';
  // geometry in text space of the first fragment
  let x = 0; for (const e of entries) { x += -e.adj / 1000 * e.size * (first.tz / 100); e.x = x; x += e.w; }
  const width = x, th = first.tz / 100; void th;
  const info = first.fontInfo, asc = ((info && info.ascent) || 750) / 1000 * first.size, desc = ((info && info.descent) || -250) / 1000 * first.size;
  const M = mul(first.tm0, first.ctm), c = [applyPt(M, 0, desc), applyPt(M, width, desc), applyPt(M, width, asc), applyPt(M, 0, asc)];
  const xs = c.map(p => p[0]), ys = c.map(p => p[1]);
  // internal positioning between first and last show
  let mode = 'none', dx = 0, dy = 0, tl = first.tl;
  for (let k = first.opIndex + 1; k < last.opIndex; k++) {
    const o = ops[k]; if (o.op === 'Tm') mode = 'absolute';
    else if (o.op === 'Td' || o.op === 'TD') { if (mode !== 'absolute') mode = 'relative'; dx += o.args[0].v; dy += o.args[1].v; if (o.op === 'TD') tl = -o.args[1].v; }
    else if (o.op === 'T*') { if (mode !== 'absolute') mode = 'relative'; dy += -tl; }
  }
  const text = entries.map(e => e.ch).join('');
  return {
    id: `p${pageIndex}b${last.bt}o${first.opIndex}`, pageIndex, bt: first.bt, shows: ids, range: [first.s, last.e], entries, text, width,
    quad: c, box: { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) },
    editable: !reason && entries.length > 0, reason, startState: { font: first.font, size: first.size, fill: first.fill }, endState: { font: last.font, size: last.size, fill: last.fill },
    prefix: first.kind === "'" ? 'T*' : '', tlmFix: { mode, dx, dy, tlmEnd: last.tlm, tl: tl, tlStart: first.tl }, text0: { tc: first.tc, tw: first.tw, tz: first.tz, ts: first.ts }, tm0: first.tm0, ctm: first.ctm,
  };
}

/* Analyse one page: load fonts, scan the document-wide glyph usage once, then interpret and group. */
export async function analyzePage(P, doc, lib, pageIndex) {
  const page = doc.getPage(pageIndex), fonts = await lib.pageFonts(page);
  const content = await pageContent(P, doc, page);
  const interp = interpret(content, name => fonts.get(name) || null);
  const blocks = buildBlocks(interp, pageIndex); addRoom(blocks);
  return { page, content, interp, blocks, fonts };
}

/* Record every code each font draws anywhere in the document: an embedded subset can only encode characters seen here. */
export async function scanUsage(P, doc, lib, onProgress = null) {
  const n = doc.getPageCount(); const pages = [];
  for (let i = 0; i < n; i++) {
    if (i % 15 === 14) { if (onProgress) onProgress(i + 1, n); await new Promise(r => setTimeout(r, 0)); } // let the interface breathe on long documents
    const page = doc.getPage(i), fonts = await lib.pageFonts(page);
    let content; try { content = await pageContent(P, doc, page); } catch { continue; }
    const interp = interpret(content, name => fonts.get(name) || null);
    for (const s of interp.shows) if (s.fontInfo) for (const it of s.items) if (it.codes) { const bpc = s.fontInfo.bytes, cs = []; for (let k = 0; k + bpc <= it.codes.length; k += bpc) cs.push(bpc === 2 ? (it.codes[k] << 8) | it.codes[k + 1] : it.codes[k]); lib.markUsed(s.fontInfo, cs); }
    pages.push(interp.shows.length);
  }
  return pages;
}

/* For each block: how far (user-space points) the text may grow before it reaches the next text on the same baseline (`room`),
   and the chain of blocks that follow it closely on that baseline (`following`: ids), which an edit can optionally move along. */
function addRoom(blocks) {
  for (const b of blocks) { const M = mul(b.tm0, b.ctm), sc = Math.hypot(M[0], M[1]) || 1; b.userScale = sc; b.origin = [M[4], M[5]]; b.dir = [M[0] / sc, M[1] / sc]; b.em = Math.abs(b.startState.size) * sc || 1; }
  for (const b of blocks) {
    const em = b.em; let room = Infinity; const cands = [];
    for (const c of blocks) {
      if (c === b) continue; const vx = c.origin[0] - b.origin[0], vy = c.origin[1] - b.origin[1];
      const along = vx * b.dir[0] + vy * b.dir[1], across = -vx * b.dir[1] + vy * b.dir[0];
      if (Math.abs(across) < 0.5 * em * 0.75 && along > b.width * b.userScale * 0.5) { room = Math.min(room, along); cands.push({ c, along }); }
    }
    b.room = room; cands.sort((x, y) => x.along - y.along);
    let end = b.width * b.userScale; const chain = [];
    for (const { c, along } of cands) { const gap = along - end; if (gap <= 1.2 * c.em && gap >= -0.35 * em) { chain.push(c.id); end = along + c.width * c.userScale; } else if (gap > 0) break; }
    b.following = chain;
  }
}
