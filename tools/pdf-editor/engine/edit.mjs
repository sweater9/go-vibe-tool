/* Applies text edits to the content stream of a PDF page.
   Each edited block is regenerated as TJ runs: unchanged characters keep their original font codes, size, colour and
   kerning; new characters reuse the same font when it already contains the glyph and otherwise use a standard-14 font;
   formatting changes switch fonts/sizes/colours per character. The graphics/text state and the text-line matrix are
   restored afterwards so every later operator in the stream keeps working. Nothing is covered, flattened or rasterised. */
import { EditError } from '../textedit.mjs';
import { FontLibrary, stdPdfName } from './fonts.mjs';
import { analyzePage, scanUsage } from './textmodel.mjs';

export { EditError };
const fmtNum = n => { const v = Math.round(n * 1000) / 1000; return String(Object.is(v, -0) ? 0 : v); };
const hex = (code, bytes) => code.toString(16).toUpperCase().padStart(bytes * 2, '0');
export const colorToRaw = c => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ''); if (!m) return null; const v = parseInt(m[1], 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map(x => fmtNum(x / 255)).join(' ') + ' rg'; };
const cps = s => Array.from(s);
const DEFAULT_FILL = '0 g';

/* WinAnsi encoder for the standard fonts. */
import { decodeWinAnsi } from '../textedit.mjs';
const WIN = new Map(); for (let c = 0x20; c < 256; c++) { const u = decodeWinAnsi(c); if (u !== 0xFFFD && u !== 0) WIN.set(String.fromCodePoint(u), c); }

class PageFonts { // standard fonts added to a page without touching shared resource dictionaries
  constructor(P, doc, page) { this.P = P; this.doc = doc; this.page = page; this.added = new Map(); this.fontsDict = null; this.n = 0; }
  prepare() {
    if (this.fontsDict) return; const { P } = this, res = this.page.node.Resources();
    const newRes = res ? res.clone() : P.PDFDict.withContext(this.doc.context);
    const oldFonts = newRes.lookupMaybe(P.PDFName.of('Font'), P.PDFDict); const fonts = oldFonts ? oldFonts.clone() : P.PDFDict.withContext(this.doc.context);
    newRes.set(P.PDFName.of('Font'), fonts); this.page.node.set(P.PDFName.of('Resources'), newRes); this.fontsDict = fonts;
  }
  async resource(pdfName) {
    if (this.added.has(pdfName)) return this.added.get(pdfName);
    this.prepare(); const { P } = this; const font = await this.doc.embedFont(pdfName);
    let tag; do { tag = 'GVF' + (++this.n); } while (this.fontsDict.has(P.PDFName.of(tag)));
    this.fontsDict.set(P.PDFName.of(tag), font.ref); this.added.set(pdfName, tag); return tag;
  }
}

/* Decide the font of every entry and encode its character. Throws EditError for characters that cannot be written. */
async function resolveEntries(lib, block, entries, fmts, notes, pf) {
  const sub = new Map(), styled = new Map(); // sub: typed characters missing from the embedded font; styled: characters the user switched to a standard font
  for (const e of entries) {
    const f = fmts.filter(x => e.pos < x.end && e.pos + e.ch.length > x.start).reduce((a, x) => ({ ...a, ...x.props }), {});
    e.f = f; if (e.virtual) continue;
    const info = e.fontInfo, curStd = !!e.useStd;
    const wantsStd = (f.family && f.family !== (curStd ? e.useStd.family : info.family)) || (f.bold != null && f.bold !== (curStd ? e.useStd.bold : info.bold)) || (f.italic != null && f.italic !== (curStd ? e.useStd.italic : info.italic));
    if (wantsStd || e.needsStd) {
      const base = curStd ? e.useStd : { family: info.family, bold: info.bold, italic: info.italic };
      e.useStd = { family: f.family || base.family, bold: f.bold != null ? f.bold : base.bold, italic: f.italic != null ? f.italic : base.italic };
    }
    if (f.size) e.size = f.size;
    if (f.color) e.fill = colorToRaw(f.color);
    if (e.useStd) {
      const code = WIN.get(e.ch); if (code === undefined) throw new EditError(`"${e.ch}" is not available in the standard ${e.useStd.family === 'mono' ? 'Courier' : e.useStd.family === 'serif' ? 'Times' : 'Helvetica'} font. Use letters, digits and common symbols such as € or é.`, 'unsupported-character');
      e.code = code; e.bytes = 1; e.pdfName = stdPdfName(e.useStd.family, e.useStd.bold, e.useStd.italic); e.res = await pf.resource(e.pdfName);
      e.wtab = await lib.stdWidths(e.pdfName); if (e.fresh || e.origCode !== code) { const m = e.fresh && !wantsStd && !e.needsStd ? sub : styled; m.set(e.pdfName, (m.get(e.pdfName) || 0) + 1); }
    } else if (e.fresh) {
      const code = info.encode(e.ch);
      if (code !== null) { e.code = code; e.bytes = info.bytes; e.res = e.font; }
      else { // glyph not in this font: substitute a standard font with the same look-alike family
        e.useStd = { family: info.family, bold: info.bold, italic: info.italic }; const code2 = WIN.get(e.ch);
        if (code2 === undefined) throw new EditError(`"${e.ch}" cannot be typed here: it is not in the embedded font "${(info.baseFont || '').replace(/^[A-Z]{6}\+/, '')}" and the substitute standard fonts only cover Latin letters, digits and common symbols.`, 'unsupported-character');
        e.code = code2; e.bytes = 1; e.pdfName = stdPdfName(e.useStd.family, e.useStd.bold, e.useStd.italic); e.res = await pf.resource(e.pdfName); e.wtab = await lib.stdWidths(e.pdfName);
        sub.set(e.pdfName, (sub.get(e.pdfName) || 0) + 1);
      }
    }
  }
  for (const [name, n] of sub) notes.push(`${n} character${n > 1 ? 's' : ''} you typed ${n > 1 ? 'are' : 'is'} not in the PDF's embedded font, so ${n > 1 ? 'they use' : 'it uses'} the standard font ${name}.`);
  for (const [name, n] of styled) notes.push(`${n} character${n > 1 ? 's' : ''} now use${n > 1 ? '' : 's'} the standard font ${name}: an embedded font file cannot be made bold, italic or changed to another family, so the closest standard PDF font is used.`);
}

function widthOf(e, block) {
  if (e.virtual) return e.w;
  const th = block.text0.tz / 100, wd = e.wtab ? (e.wtab.get(e.code) ?? 0) : e.fontInfo.width(e.code);
  return (wd / 1000 * e.size + block.text0.tc + ((e.bytes === 1 && e.code === 32) ? block.text0.tw : 0)) * th;
}

export async function renderBlock(P, doc, lib, block, edit, pf, notes, opts = {}) {
  const E = block.entries; const th = block.text0.tz / 100;
  const nChars = cps(edit.text), n = nChars.length;
  // 1. diff on entry boundaries
  let p = 0, pos = 0;
  while (p < E.length) { const c = cps(E[p].ch); if (pos + c.length <= n && c.every((ch, k) => ch === nChars[pos + k])) { p++; pos += c.length; } else break; }
  let s = E.length, sp = n;
  while (s > p) { const c = cps(E[s - 1].ch); if (sp - c.length >= pos && c.every((ch, k) => ch === nChars[sp - c.length + k])) { s--; sp -= c.length; } else break; }
  const baseIdx = p > 0 ? p - 1 : (s < E.length ? s : 0), base = E[baseIdx];
  const entries = [];
  const clone = (e, extra = {}) => ({ ...e, pos: 0, ...extra });
  for (let k = 0; k < p; k++) entries.push(clone(E[k], { origCode: E[k].code }));
  for (let k = pos; k < sp; k++) entries.push({ ch: nChars[k], fresh: true, adj: 0, font: base.font, fontInfo: base.fontInfo, size: base.size, fill: base.fill, bytes: base.bytes, show: base.show, useStd: base.useStd, origCode: null });
  for (let k = s; k < E.length; k++) entries.push(clone(E[k], { origCode: E[k].code }));
  // position of every entry in the new text (UTF-16) for formatting ranges
  let u = 0; for (const e of entries) { e.pos = u; u += e.ch.length; }
  // formatting from an unchanged selection of a different run needs entries that were not typed: they simply carry their old font
  await resolveEntries(lib, block, entries, edit.fmt || [], notes, pf);
  for (const e of entries) e.w = widthOf(e, block);
  // 2. alignment anchor
  let newW = 0; for (const e of entries) newW += -e.adj / 1000 * e.size * th + e.w;
  let shift = 0; if (edit.align === 'right') shift = block.width - newW; else if (edit.align === 'center') shift = (block.width - newW) / 2;
  if (entries.length && Math.abs(shift) > 1e-6) { entries[0].adj += -shift / th / entries[0].size * 1000; }
  // 3. emit
  const out = []; if (block.prefix) out.push(block.prefix); let cur = { font: block.startState.font, size: block.startState.size, fill: block.startState.fill };
  const real = entries.filter(e => !e.virtual); void real;
  let i = 0, pend = 0;
  while (i < entries.length) {
    const run = []; const head = entries[i]; const key = e => `${e.res || e.font}|${e.size}|${e.fill}`; const rk = key(head);
    // virtual spaces are pure adjustments: fold them into the following real entry
    while (i < entries.length) { const e = entries[i]; if (e.virtual) { pend += e.adj; i++; continue; } if (run.length && key(e) !== rk) break; if (!run.length && key(e) !== rk) break; run.push(e); i++; }
    if (!run.length) continue;
    const res = run[0].res || run[0].font;
    if (res !== cur.font || run[0].size !== cur.size) { out.push(`/${res} ${fmtNum(run[0].size)} Tf`); cur.font = res; cur.size = run[0].size; }
    if (run[0].fill !== cur.fill) { out.push(run[0].fill || DEFAULT_FILL); cur.fill = run[0].fill; }
    const parts = []; let buf = '';
    const flush = () => { if (buf) { parts.push(`<${buf}>`); buf = ''; } };
    for (const e of run) { const a = e.adj + pend; pend = 0; if (Math.abs(a) > 1e-6) { flush(); parts.push(fmtNum(a)); } buf += hex(e.code, e.bytes); }
    flush(); out.push(`[${parts.join(' ')}] TJ`);
  }
  // 4. restore the state the rest of the stream expects
  const end = block.endState;
  if (cur.font !== end.font || cur.size !== end.size) out.push(`/${end.font} ${fmtNum(end.size)} Tf`);
  if (cur.fill !== end.fill) out.push(end.fill || DEFAULT_FILL); // '' = never set in this stream, i.e. the initial black
  const f = block.tlmFix;
  if (f.mode === 'relative') out.push(`${fmtNum(f.dx)} ${fmtNum(f.dy)} Td`);
  else if (f.mode === 'absolute') { const sp = opts.shiftParent || [0, 0]; out.push(`${f.tlmEnd.map((v, i) => fmtNum(i === 4 ? v + sp[0] : i === 5 ? v + sp[1] : v)).join(' ')} Tm`); }
  if (f.mode !== 'none' && Math.abs(f.tl - f.tlStart) > 1e-9) out.push(`${fmtNum(f.tl)} TL`);
  return { text: '\n' + out.join('\n') + '\n', width: newW + 0, shiftText: shift };
}

/* ---- moving the rest of the line (opt-in): shift the positioning operators of the blocks that follow an edited block ---- */
const inv2 = L => { const det = L[0] * L[3] - L[1] * L[2]; return [L[3] / det, -L[1] / det, -L[2] / det, L[0] / det]; };
const rowMul = (v, M) => [v[0] * M[0] + v[1] * M[2], v[0] * M[1] + v[1] * M[3]];
const POS = new Set(['Td', 'TD', 'Tm', 'T*', "'", '"']);
function planShifts(a, shiftBy, replaced) {
  const out = [], { ops, shows } = a.interp, blockOfShow = new Map(), firstShowAfter = new Map(); for (const b of a.blocks) b.shows.forEach(i => blockOfShow.set(i, b));
  shows.forEach((sh, i) => { if (sh.posIdx >= 0 && !firstShowAfter.has(sh.posIdx)) firstShowAfter.set(sh.posIdx, i); });
  const inRange = pos => replaced.some(([s0, e0]) => pos >= s0 && pos < e0); let inh = [0, 0];
  const refuse = () => new EditError('The text after this one on the line cannot be moved along with it, because it is positioned with an operator that has no coordinates. Turn off "Move the rest of the line" or shorten the new text.', 'reflow-unsupported');
  for (let i = 0; i < ops.length; i++) {
    const o = ops[i]; if (o.op === 'BT') { inh = [0, 0]; continue; } if (!POS.has(o.op) || inRange(o.s)) continue;
    const si = firstShowAfter.get(i); if (si === undefined) continue; const sh = shows[si], blk = blockOfShow.get(si), v = (blk && shiftBy.get(blk.id)) || [0, 0];
    const desired = rowMul(v, inv2(sh.ctm.slice(0, 4))), L = sh.tlm.slice(0, 4), dlt = [desired[0] - inh[0], desired[1] - inh[1]];
    if (o.op === 'Tm') { if (Math.hypot(...desired) > 1e-9) out.push({ s: o.args[4].s, e: o.args[4].e, text: fmtNum(o.args[4].v + desired[0]) }, { s: o.args[5].s, e: o.args[5].e, text: fmtNum(o.args[5].v + desired[1]) }); inh = desired; continue; }
    if (Math.hypot(...dlt) < 1e-9) continue;
    if (o.op !== 'Td' && o.op !== 'TD') throw refuse();
    const dt = rowMul(dlt, inv2(L)); if (o.op === 'TD' && Math.abs(dt[1]) > 1e-9) throw refuse();
    out.push({ s: o.args[0].s, e: o.args[0].e, text: fmtNum(o.args[0].v + dt[0]) }, { s: o.args[1].s, e: o.args[1].e, text: fmtNum(o.args[1].v + dt[1]) }); inh = desired;
  }
  return out;
}

/* edits: [{page, blockId, text, fmt:[{start,end,props:{family,bold,italic,size,color}}], align, reflow}] applied to the ORIGINAL bytes. */
export async function applyTextEdits(P, bytes, edits) {
  const doc = await P.PDFDocument.load(bytes, { updateMetadata: false }), lib = new FontLibrary(P, doc); await scanUsage(P, doc, lib);
  const notes = [], byPage = new Map(); for (const e of edits) { if (!byPage.has(e.page)) byPage.set(e.page, []); byPage.get(e.page).push(e); }
  for (const [pageIdx, list] of byPage) {
    const a = await analyzePage(P, doc, lib, pageIdx), pf = new PageFonts(P, doc, a.page), jobs = [];
    for (const e of list) {
      const block = a.blocks.find(b => b.id === e.blockId); if (!block) throw new EditError('The text on this page changed since it was selected. Select it again.', 'stale');
      if (!block.editable) throw new EditError(block.reason, block.reason);
      jobs.push({ block, e });
    }
    // pass 1: widths (for moving the rest of the line)
    const shiftBy = new Map(), stub = { resource: async () => 'GVFx' };
    for (const j of jobs) {
      if (!j.e.reflow || !j.block.following || !j.block.following.length) continue;
      const r = await renderBlock(P, doc, lib, j.block, j.e, stub, []); const d = (r.shiftText + r.width - j.block.width) * j.block.userScale; if (Math.abs(d) < 1e-6) continue;
      for (const id of j.block.following) { const cur = shiftBy.get(id) || [0, 0]; shiftBy.set(id, [cur[0] + j.block.dir[0] * d, cur[1] + j.block.dir[1] * d]); }
    }
    const repl = [];
    for (const { block, e } of jobs) {
      const v = shiftBy.get(block.id), sp = v ? rowMul(v, inv2(block.ctm.slice(0, 4))) : [0, 0];
      const { text } = await renderBlock(P, doc, lib, block, e, pf, notes, { shiftParent: sp }); repl.push({ s: block.range[0], e: block.range[1], text });
    }
    if (shiftBy.size) repl.push(...planShifts(a, shiftBy, jobs.map(j => j.block.range)));
    repl.sort((x, y) => y.s - x.s); let content = a.content;
    for (const r of repl) { const enc = new TextEncoder().encode(r.text), next = new Uint8Array(r.s + enc.length + (content.length - r.e)); next.set(content.subarray(0, r.s), 0); next.set(enc, r.s); next.set(content.subarray(r.e), r.s + enc.length); content = next; }
    a.page.node.set(P.PDFName.of('Contents'), doc.context.register(doc.context.flateStream(content)));
  }
  return { bytes: await doc.save(), notes };
}

/* Dry run: the width the edited block would have (text-space units) and any substitution notes, without touching the document. */
export async function measureEdit(P, doc, lib, block, edit) {
  const notes = [], stub = { resource: async () => 'GVFx' }; const r = await renderBlock(P, doc, lib, block, edit, stub, notes);
  const s = Math.hypot(block.tm0[0], block.tm0[1]) * Math.hypot(block.ctm[0], block.ctm[1]);
  return { width: r.width, widthUser: r.width * s, origUser: block.width * s, notes };
}

export { FontLibrary, analyzePage, scanUsage };
