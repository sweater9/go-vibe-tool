/* Genuine in-place editing of existing PDF text.
   A PDF stores text as show operators (Tj, TJ, ', ") whose strings are glyph codes of a specific font. The string can be rewritten
   safely only when the font maps those codes to characters we can re-encode, i.e. a simple, NON-embedded font (the standard 14 and
   similar) with a Latin encoding. Subset-embedded fonts (almost every PDF made by Word, Chrome, LibreOffice, InDesign...) contain only
   the glyphs the author used and use arbitrary codes, so their text cannot be changed this way. `locateRun` reports which case a text
   run is in; `replaceRun` rewrites the page's content stream. Nothing here covers up or hides the original text. */

const CP1252_HIGH = [0x20AC, 0, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021, 0x02C6, 0x2030, 0x0160, 0x2039, 0x0152, 0, 0x017D, 0, 0, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014, 0x02DC, 0x2122, 0x0161, 0x203A, 0x0153, 0, 0x017E, 0x0178];
export const decodeWinAnsi = b => (b >= 0x80 && b <= 0x9F) ? (CP1252_HIGH[b - 0x80] || 0xFFFD) : b;
const ENC = new Map(); for (let b = 0x20; b < 256; b++) { const c = decodeWinAnsi(b); if (c !== 0xFFFD && c !== 0) ENC.set(c, b); }
export const encodeWinAnsi = text => { const out = []; for (const ch of Array.from(text)) { const b = ENC.get(ch.codePointAt(0)); if (b === undefined) throw new EditError(`"${ch}" cannot be written with this font. Use Latin letters, digits and common symbols such as € or é.`, 'unsupported-character'); out.push(b); } return out; };

export class EditError extends Error { constructor(message, code) { super(message); this.code = code; } }

const WS = new Set([0, 9, 10, 12, 13, 32]), DELIM = new Set([40, 41, 60, 62, 91, 93, 123, 125, 47, 37]);
/* Tokenise a content stream into {t:'str'|'hex'|'name'|'num'|'op'|'[' |']'|'<<'|'>>', v, s, e} with byte offsets. */
export function tokenize(bytes) {
  const toks = []; let i = 0; const n = bytes.length;
  while (i < n) {
    const c = bytes[i];
    if (WS.has(c)) { i++; continue; }
    if (c === 37) { while (i < n && bytes[i] !== 10 && bytes[i] !== 13) i++; continue; }
    const s = i;
    if (c === 40) { // literal string
      let depth = 1; const out = []; i++;
      while (i < n && depth) {
        const d = bytes[i++];
        if (d === 92) { const e = bytes[i++]; if (e >= 48 && e <= 55) { let v = e - 48, k = 0; while (k < 2 && bytes[i] >= 48 && bytes[i] <= 55) { v = v * 8 + bytes[i++] - 48; k++; } out.push(v & 255); } else if (e === 110) out.push(10); else if (e === 114) out.push(13); else if (e === 116) out.push(9); else if (e === 98) out.push(8); else if (e === 102) out.push(12); else if (e === 13) { if (bytes[i] === 10) i++; } else if (e === 10) { /* continuation */ } else out.push(e); }
        else if (d === 40) { depth++; out.push(d); } else if (d === 41) { depth--; if (depth) out.push(d); } else out.push(d);
      }
      toks.push({ t: 'str', v: out, s, e: i }); continue;
    }
    if (c === 60 && bytes[i + 1] === 60) { toks.push({ t: '<<', s, e: i + 2 }); i += 2; continue; }
    if (c === 62 && bytes[i + 1] === 62) { toks.push({ t: '>>', s, e: i + 2 }); i += 2; continue; }
    if (c === 60) { // hex string
      i++; let h = ''; while (i < n && bytes[i] !== 62) { const d = bytes[i++]; if (!WS.has(d)) h += String.fromCharCode(d); } i++;
      if (h.length % 2) h += '0'; const out = []; for (let k = 0; k < h.length; k += 2) out.push(parseInt(h.slice(k, k + 2), 16) || 0);
      toks.push({ t: 'str', v: out, s, e: i }); continue;
    }
    if (c === 91) { toks.push({ t: '[', s, e: ++i }); continue; }
    if (c === 93) { toks.push({ t: ']', s, e: ++i }); continue; }
    if (c === 47) { i++; while (i < n && !WS.has(bytes[i]) && !DELIM.has(bytes[i])) i++; toks.push({ t: 'name', v: String.fromCharCode(...bytes.subarray(s + 1, i)), s, e: i }); continue; }
    if (c === 123 || c === 125 || c === 41 || c === 62) { i++; continue; }
    while (i < n && !WS.has(bytes[i]) && !DELIM.has(bytes[i])) i++;
    const word = String.fromCharCode(...bytes.subarray(s, i));
    toks.push(/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word) ? { t: 'num', v: parseFloat(word), s, e: i } : { t: 'op', v: word, s, e: i });
    if (word === 'BI') { // inline image: skip to EI so binary data is not tokenised
      const idx = indexOfEI(bytes, i); if (idx > 0) { i = idx; }
    }
  }
  return toks;
}
function indexOfEI(bytes, from) { for (let i = from; i < bytes.length - 2; i++) if (bytes[i] === 69 && bytes[i + 1] === 73 && WS.has(bytes[i - 1]) && (i + 2 >= bytes.length || WS.has(bytes[i + 2]))) return i + 2; return -1; }

/* Show operations in stream order: {s,e (range to replace), font, text, bytes, kind} */
export function showOps(bytes, fontName0 = null) {
  const toks = tokenize(bytes), ops = []; let font = fontName0, args = [];
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.t === 'op') {
      if (t.v === 'Tf') { const nm = args.find(a => a.t === 'name'); if (nm) font = nm.v; }
      else if (t.v === 'Tj' || t.v === "'" || t.v === '"') { const st = [...args].reverse().find(a => a.t === 'str'); if (st) ops.push({ s: st.s, e: st.e, font, bytes: st.v, kind: t.v }); }
      else if (t.v === 'TJ') { const arr = args.find(a => a.t === '[arr'); if (arr) ops.push({ s: arr.s, e: arr.e, font, bytes: arr.bytes, kind: 'TJ' }); }
      args = []; continue;
    }
    if (t.t === '[') { // collect an array operand
      let depth = 1, j = k + 1, bytesAll = []; while (j < toks.length && depth) { if (toks[j].t === '[') depth++; else if (toks[j].t === ']') depth--; else if (toks[j].t === 'str') bytesAll = bytesAll.concat(toks[j].v); j++; }
      args.push({ t: '[arr', s: t.s, e: toks[j - 1].e, bytes: bytesAll }); k = j - 1; continue;
    }
    args.push(t);
  }
  return ops;
}

export async function pageContent(PDFLib, doc, page) {
  const { PDFArray, PDFName, decodePDFRawStream, PDFRawStream } = PDFLib;
  const c = page.node.Contents(); const streams = [];
  const pushStream = s => { if (s instanceof PDFRawStream) streams.push(decodePDFRawStream(s).decode()); else if (s && s.getContents) streams.push(s.getContents()); };
  if (c instanceof PDFArray) for (let i = 0; i < c.size(); i++) pushStream(doc.context.lookup(c.get(i))); else pushStream(c);
  const total = streams.reduce((n, s) => n + s.length + 1, 0), out = new Uint8Array(total); let p = 0;
  for (const s of streams) { out.set(s, p); p += s.length; out[p++] = 10; }
  void PDFName; return out;
}

function fontInfo(PDFLib, doc, page, name) {
  const { PDFName, PDFDict } = PDFLib;
  const res = page.node.Resources(); const fonts = res && res.lookupMaybe(PDFName.of('Font'), PDFDict);
  const f = fonts && fonts.lookupMaybe(PDFName.of(name), PDFDict); if (!f) return { editable: false, reason: 'font-missing' };
  const sub = f.get(PDFName.of('Subtype')), base = String(f.get(PDFName.of('BaseFont')) || '').replace(/^\//, '');
  const subtype = String(sub || '').replace(/^\//, '');
  if (!/^(Type1|TrueType|MMType1)$/.test(subtype)) return { editable: false, reason: 'composite-font', base };
  if (/^[A-Z]{6}\+/.test(base)) return { editable: false, reason: 'subset-font', base };
  const fd = f.lookupMaybe(PDFName.of('FontDescriptor'), PDFDict);
  if (fd && (fd.has(PDFName.of('FontFile')) || fd.has(PDFName.of('FontFile2')) || fd.has(PDFName.of('FontFile3')))) return { editable: false, reason: 'embedded-font', base };
  const enc = f.get(PDFName.of('Encoding')); const encName = enc instanceof PDFName ? String(enc).replace(/^\//, '') : '';
  if (enc && !/^(WinAnsiEncoding|MacRomanEncoding)$/.test(encName)) return { editable: false, reason: 'custom-encoding', base };
  if (encName === 'MacRomanEncoding') return { editable: false, reason: 'unsupported-encoding', base };
  return { editable: true, base, asciiOnly: !enc };
}

const REASONS = {
  'subset-font': 'This text uses a subset-embedded font. It contains only the glyphs the original author used, so the text cannot be changed in place.',
  'embedded-font': 'This text uses an embedded font program. Its glyph codes cannot be safely rewritten.',
  'composite-font': 'This text uses a composite (CID) font, as most Word, Chrome and LibreOffice exports do. Its glyph codes cannot be rewritten.',
  'custom-encoding': 'This text uses a custom font encoding that cannot be safely rewritten.',
  'unsupported-encoding': 'This text uses an encoding the editor cannot safely rewrite.',
  'font-missing': 'The font of this text could not be found on the page.',
  'not-found': 'The editor could not find this exact text in the page content (it may be split into pieces or drawn as outlines).',
};
export const reasonText = code => REASONS[code] || 'This text cannot be edited in place.';

/* Find the occurrence-th show operation whose decoded text equals `text` on page `pageIdx`. */
export async function locateRun(PDFLib, bytes, pageIdx, text, occurrence = 0) {
  const doc = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false }), page = doc.getPage(pageIdx), content = await pageContent(PDFLib, doc, page);
  const ops = showOps(content), hits = [];
  for (const op of ops) {
    const info = op.font ? fontInfo(PDFLib, doc, page, op.font) : { editable: false, reason: 'font-missing' };
    const decoded = String.fromCodePoint(...op.bytes.map(decodeWinAnsi));
    if (decoded === text) hits.push({ op, info });
  }
  const hit = hits[occurrence] || hits[0];
  if (!hit) return { editable: false, reason: 'not-found' };
  if (!hit.info.editable) return { editable: false, reason: hit.info.reason, font: hit.info.base };
  return { editable: true, font: hit.info.base, asciiOnly: hit.info.asciiOnly, count: hits.length, doc, page, content, op: hit.op };
}

/* Rewrites the run and returns the new PDF bytes. Throws EditError when the run is not editable or the new text is unsupported. */
export async function replaceRun(PDFLib, bytes, pageIdx, text, replacement, occurrence = 0) {
  const loc = await locateRun(PDFLib, bytes, pageIdx, text, occurrence);
  if (!loc.editable) throw new EditError(reasonText(loc.reason), loc.reason);
  const codes = encodeWinAnsi(replacement);
  if (loc.asciiOnly && codes.some(b => b > 126)) throw new EditError('This font only supports plain ASCII characters.', 'unsupported-character');
  const hex = '<' + codes.map(b => b.toString(16).padStart(2, '0')).join('') + '>', token = new TextEncoder().encode(loc.op.kind === 'TJ' ? '[' + hex + ']' : hex); // TJ needs an array operand
  const next = new Uint8Array(loc.op.s + token.length + (loc.content.length - loc.op.e));
  next.set(loc.content.subarray(0, loc.op.s), 0); next.set(token, loc.op.s); next.set(loc.content.subarray(loc.op.e), loc.op.s + token.length);
  const { PDFName } = PDFLib, ref = loc.doc.context.register(loc.doc.context.flateStream(next));
  loc.page.node.set(PDFName.of('Contents'), ref);
  return await loc.doc.save();
}

/* Applies a recorded list of edits ({page,text,occurrence,to}) to the original bytes, in order. */
export async function applyEdits(PDFLib, bytes, edits) {
  let cur = bytes;
  for (const e of edits) cur = await replaceRun(PDFLib, cur, e.page, e.from, e.to, e.occurrence || 0);
  return cur;
}
