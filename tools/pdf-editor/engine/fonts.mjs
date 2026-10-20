/* Font layer of the text-editing engine.
   For each font used on a page it answers: what character does a code mean (decode), which code draws a character
   (encode, restricted to glyphs the document is known to contain when the font is an embedded subset), how wide is a
   code, and which standard-14 family would be the closest substitute. Anything it cannot answer reliably is reported
   as `usable:false` with a reason; the editor refuses such text instead of guessing. */
import { decodeWinAnsi } from '../textedit.mjs';

/* ---------- CMap (ToUnicode) ---------- */
const hexToStr = h => { let s = ''; for (let i = 0; i + 3 < h.length + 1; i += 4) { const cu = parseInt(h.slice(i, i + 4), 16); if (!Number.isNaN(cu)) s += String.fromCharCode(cu); } return s; };
export function parseToUnicode(text) {
  const map = new Map();
  for (const sec of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) for (const m of sec[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) map.set(parseInt(m[1], 16), hexToStr(m[2].padEnd(4, '0')));
  for (const sec of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    const re = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(\[[^\]]*\]|<[0-9A-Fa-f]+>)/g; let m;
    while ((m = re.exec(sec[1]))) {
      const lo = parseInt(m[1], 16), hi = parseInt(m[2], 16); if (hi - lo > 0xFFFF) continue;
      if (m[3][0] === '[') { const dsts = [...m[3].matchAll(/<([0-9A-Fa-f]+)>/g)].map(x => hexToStr(x[1].padEnd(4, '0'))); for (let c = lo; c <= hi && c - lo < dsts.length; c++) map.set(c, dsts[c - lo]); }
      else { const base = hexToStr(m[3].slice(1, -1).padEnd(4, '0')); const last = base.charCodeAt(base.length - 1); for (let c = lo; c <= hi; c++) map.set(c, base.slice(0, -1) + String.fromCharCode(last + (c - lo))); }
    }
  }
  return map;
}

/* ---------- encodings ---------- */
const LATIN1_NAMES = 'space exclamdown cent sterling currency yen brokenbar section dieresis copyright ordfeminine guillemotleft logicalnot hyphen registered macron degree plusminus twosuperior threesuperior acute mu paragraph periodcentered cedilla onesuperior ordmasculine guillemotright onequarter onehalf threequarters questiondown Agrave Aacute Acircumflex Atilde Adieresis Aring AE Ccedilla Egrave Eacute Ecircumflex Edieresis Igrave Iacute Icircumflex Idieresis Eth Ntilde Ograve Oacute Ocircumflex Otilde Odieresis multiply Oslash Ugrave Uacute Ucircumflex Udieresis Yacute Thorn germandbls agrave aacute acircumflex atilde adieresis aring ae ccedilla egrave eacute ecircumflex edieresis igrave iacute icircumflex idieresis eth ntilde ograve oacute ocircumflex otilde odieresis divide oslash ugrave uacute ucircumflex udieresis yacute thorn ydieresis'.split(' ');
const ASCII_NAMES = 'space exclam quotedbl numbersign dollar percent ampersand quotesingle parenleft parenright asterisk plus comma hyphen period slash zero one two three four five six seven eight nine colon semicolon less equal greater question at'.split(' ');
const ASCII_NAMES2 = 'bracketleft backslash bracketright asciicircum underscore grave'.split(' '), ASCII_NAMES3 = 'braceleft bar braceright asciitilde'.split(' ');
const GLYPH = new Map(); // glyph name -> string
ASCII_NAMES.forEach((n, i) => GLYPH.set(n, String.fromCharCode(32 + i)));
for (let c = 65; c <= 90; c++) { GLYPH.set(String.fromCharCode(c), String.fromCharCode(c)); GLYPH.set(String.fromCharCode(c + 32), String.fromCharCode(c + 32)); }
ASCII_NAMES2.forEach((n, i) => GLYPH.set(n, String.fromCharCode(91 + i))); ASCII_NAMES3.forEach((n, i) => GLYPH.set(n, String.fromCharCode(123 + i)));
LATIN1_NAMES.forEach((n, i) => { if (!GLYPH.has(n)) GLYPH.set(n, String.fromCharCode(0xA0 + i)); });
Object.entries({ quoteright: '’', quoteleft: '‘', quotedblleft: '“', quotedblright: '”', quotesinglbase: '‚', quotedblbase: '„', endash: '–', emdash: '—', bullet: '•', ellipsis: '…', Euro: '€', trademark: '™', dagger: '†', daggerdbl: '‡', fi: 'fi', fl: 'fl', minus: '−', fraction: '⁄', perthousand: '‰', OE: 'Œ', oe: 'œ', Scaron: 'Š', scaron: 'š', Zcaron: 'Ž', zcaron: 'ž', Ydieresis: 'Ÿ', florin: 'ƒ', circumflex: 'ˆ', tilde: '˜', guilsinglleft: '‹', guilsinglright: '›', nbspace: ' ', sfthyphen: '­' }).forEach(([k, v]) => GLYPH.set(k, v));
export const glyphNameToChar = n => { if (GLYPH.has(n)) return GLYPH.get(n); const m = /^uni([0-9A-Fa-f]{4})$/.exec(n) || /^u([0-9A-Fa-f]{4,6})$/.exec(n); return m ? String.fromCodePoint(parseInt(m[1], 16)) : null; };
const standardEncDecode = c => c === 0x27 ? '’' : c === 0x60 ? '‘' : (c >= 0x20 && c <= 0x7E) ? String.fromCharCode(c) : null;
const winAnsiDecode = c => { if (c < 0x20) return null; const u = decodeWinAnsi(c); return u === 0xFFFD ? null : String.fromCodePoint(u); };

/* ---------- standard-14 knowledge ---------- */
const STD = { // normalised BaseFont -> [family, bold, italic, pdfName]
  'helvetica': ['sans', false, false, 'Helvetica'], 'helvetica-bold': ['sans', true, false, 'Helvetica-Bold'], 'helvetica-oblique': ['sans', false, true, 'Helvetica-Oblique'], 'helvetica-boldoblique': ['sans', true, true, 'Helvetica-BoldOblique'],
  'times-roman': ['serif', false, false, 'Times-Roman'], 'times-bold': ['serif', true, false, 'Times-Bold'], 'times-italic': ['serif', false, true, 'Times-Italic'], 'times-bolditalic': ['serif', true, true, 'Times-BoldItalic'],
  'courier': ['mono', false, false, 'Courier'], 'courier-bold': ['mono', true, false, 'Courier-Bold'], 'courier-oblique': ['mono', false, true, 'Courier-Oblique'], 'courier-boldoblique': ['mono', true, true, 'Courier-BoldOblique'],
};
const ALIAS = [[/^arial(mt)?(,|-)?bolditalic$|^arial-boldital(mt)?$/i, 'helvetica-boldoblique'], [/^arial(mt)?(,|-)?bold$|^arial-boldmt$/i, 'helvetica-bold'], [/^arial(mt)?(,|-)?italic$|^arial-italicmt$/i, 'helvetica-oblique'], [/^arial(mt)?$/i, 'helvetica'],
  [/^timesnewroman(ps)?(mt)?(,|-)?bolditalic$/i, 'times-bolditalic'], [/^timesnewroman(ps)?(mt)?(,|-)?bold$/i, 'times-bold'], [/^timesnewroman(ps)?(mt)?(,|-)?italic$/i, 'times-italic'], [/^timesnewroman(ps)?(mt)?$/i, 'times-roman'],
  [/^couriernew(ps)?(mt)?(,|-)?bolditalic$/i, 'courier-boldoblique'], [/^couriernew(ps)?(mt)?(,|-)?bold$/i, 'courier-bold'], [/^couriernew(ps)?(mt)?(,|-)?italic$/i, 'courier-oblique'], [/^couriernew(ps)?(mt)?$/i, 'courier']];
export function stdFontOf(baseFont) { const k = String(baseFont || '').replace(/^[A-Z]{6}\+/, '').toLowerCase(); if (STD[k]) return STD[k]; for (const [re, to] of ALIAS) if (re.test(baseFont.replace(/^[A-Z]{6}\+/, ''))) return STD[to]; return null; }
export const stdPdfName = (family, bold, italic) => { const f = { sans: ['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique'], serif: ['Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic'], mono: ['Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique'] }[family]; return f[(bold ? 1 : 0) + (italic ? 2 : 0)]; };
export function classify(baseFont, flags = 0) {
  const n = String(baseFont || '').replace(/^[A-Z]{6}\+/, '');
  const bold = /bold|black|heavy|demi|semibold/i.test(n) || !!(flags & (1 << 18)), italic = /italic|oblique|ital\b/i.test(n) || !!(flags & 64);
  let family = 'sans';
  if (/mono|courier|consolas|typewriter|lucidaconsole|menlo|cousine/i.test(n) || (flags & 1)) family = 'mono';
  else if (/serif(?!.*sans)|times|georgia|garamond|palatino|bookman|cambria|minion|tinos|roman|century/i.test(n) && !/sans/i.test(n)) family = 'serif';
  else if (flags & 2) family = 'serif';
  return { family, bold, italic };
}

/* ---------- font objects ---------- */
const nm = (P, v) => (v instanceof P.PDFName) ? v.decodeText() : null;
const numOf = (P, v) => (v instanceof P.PDFNumber) ? v.asNumber() : null;

async function streamText(P, doc, obj) {
  const s = doc.context.lookup(obj); if (!s) return null;
  try { const bytes = s instanceof P.PDFRawStream ? P.decodePDFRawStream(s).decode() : s.getContents(); return new TextDecoder('latin1').decode(bytes); } catch { return null; }
}

export class FontLibrary {
  constructor(P, doc) { this.P = P; this.doc = doc; this.cache = new Map(); this.used = new Map(); this._scratch = null; this._stdWidths = new Map(); }
  async stdWidths(pdfName) { // width(code) from pdf-lib's AFM metrics, 1000ths
    if (this._stdWidths.has(pdfName)) return this._stdWidths.get(pdfName);
    if (!this._scratch) this._scratch = await this.P.PDFDocument.create();
    const f = await this._scratch.embedFont(pdfName); const tbl = new Map();
    for (let c = 0x20; c < 256; c++) { const u = decodeWinAnsi(c); if (u === 0xFFFD || u === 0) continue; try { tbl.set(c, f.widthOfTextAtSize(String.fromCodePoint(u), 1000)); } catch { /* not in metrics */ } }
    this._stdWidths.set(pdfName, tbl); return tbl;
  }
  /* Returns Map(resourceName -> FontInfo) for one page. */
  async pageFonts(page) {
    const { P, doc } = this; const out = new Map();
    const res = page.node.Resources(); const fonts = res && res.lookupMaybe(P.PDFName.of('Font'), P.PDFDict);
    if (!fonts) return out;
    for (const key of fonts.keys()) {
      const name = key.decodeText(), raw = fonts.get(key);
      const tag = raw instanceof P.PDFRef ? raw.toString() : `direct:${name}:${page.ref?.toString?.() || ''}`;
      if (!this.cache.has(tag)) this.cache.set(tag, await this.load(doc.context.lookup(raw), tag));
      out.set(name, this.cache.get(tag));
    }
    return out;
  }
  markUsed(info, codes) { if (!info || !info.key) return; let s = this.used.get(info.key); if (!s) this.used.set(info.key, s = new Set()); for (const c of codes) s.add(c); }

  async load(fd, key) {
    const { P } = this; const bad = (reason, extra = {}) => ({ key, usable: false, reason, bytes: 1, width: () => 0, decode: () => null, encode: () => null, ...extra });
    if (!(fd instanceof P.PDFDict)) return bad('font-missing');
    const subtype = nm(P, fd.get(P.PDFName.of('Subtype'))), baseFont = nm(P, fd.lookup(P.PDFName.of('BaseFont'))) || '';
    if (subtype === 'Type3') return bad('type3', { baseFont });
    let desc = fd, cidW = null, dw = 1000, composite = false;
    if (subtype === 'Type0') {
      composite = true; const enc = fd.lookup(P.PDFName.of('Encoding'));
      if (nm(P, enc) !== 'Identity-H') return bad('cmap', { baseFont });
      const arr = fd.lookup(P.PDFName.of('DescendantFonts')); const d0 = arr instanceof P.PDFArray ? arr.lookup(0) : null;
      if (!(d0 instanceof P.PDFDict)) return bad('font-missing', { baseFont });
      desc = d0; const dwv = numOf(P, d0.lookup(P.PDFName.of('DW'))); if (dwv !== null) dw = dwv;
      const w = d0.lookup(P.PDFName.of('W'));
      if (w instanceof P.PDFArray) { cidW = new Map(); const items = w.asArray().map(x => this.doc.context.lookup(x)); for (let i = 0; i < items.length;) { const c0 = numOf(P, items[i]); const nx = items[i + 1]; if (nx instanceof P.PDFArray) { nx.asArray().forEach((x, j) => cidW.set(c0 + j, numOf(P, this.doc.context.lookup(x)))); i += 2; } else { const c1 = numOf(P, nx), wv = numOf(P, items[i + 2]); if (c1 - c0 < 70000) for (let c = c0; c <= c1; c++) cidW.set(c, wv); i += 3; } } }
    }
    const descriptor = desc.lookupMaybe(P.PDFName.of('FontDescriptor'), P.PDFDict);
    const flags = descriptor ? (numOf(P, descriptor.lookup(P.PDFName.of('Flags'))) || 0) : 0;
    const embedded = !!(descriptor && (descriptor.has(P.PDFName.of('FontFile')) || descriptor.has(P.PDFName.of('FontFile2')) || descriptor.has(P.PDFName.of('FontFile3'))));
    const cls = classify(baseFont, flags);
    const tu = fd.get(P.PDFName.of('ToUnicode')); const uni = tu ? parseToUnicode(await streamText(P, this.doc, tu) || '') : null;
    const info = { key, baseFont, subtype, embedded, bytes: composite ? 2 : 1, family: cls.family, bold: cls.bold, italic: cls.italic, std: !embedded && !composite ? stdFontOf(baseFont) : null, hasToUnicode: !!(uni && uni.size), ascent: descriptor ? numOf(P, descriptor.lookup(P.PDFName.of('Ascent'))) : null, descent: descriptor ? numOf(P, descriptor.lookup(P.PDFName.of('Descent'))) : null, usable: true, reason: null };
    if (info.std) { info.family = info.std[0]; info.bold = info.std[1]; info.italic = info.std[2]; }
    /* ---- decode ---- */
    if (composite) {
      if (!uni || !uni.size) return { ...info, usable: false, reason: 'no-unicode-map', width: () => 0, decode: () => null, encode: () => null };
      info.decode = c => uni.get(c) ?? null;
      info.width = c => cidW && cidW.has(c) ? cidW.get(c) : dw;
    } else {
      const enc = fd.lookup(P.PDFName.of('Encoding')); let base = null; const diffs = new Map();
      if (enc instanceof P.PDFName) base = enc.decodeText();
      else if (enc instanceof P.PDFDict) {
        const be = enc.lookup(P.PDFName.of('BaseEncoding')); base = be instanceof P.PDFName ? be.decodeText() : null;
        const df = enc.lookup(P.PDFName.of('Differences'));
        if (df instanceof P.PDFArray) { let code = 0; for (const it of df.asArray().map(x => this.doc.context.lookup(x))) { if (it instanceof P.PDFNumber) code = it.asNumber(); else if (it instanceof P.PDFName) diffs.set(code++, glyphNameToChar(it.decodeText())); } }
      }
      if (base === 'MacRomanEncoding' && !uni) return { ...info, usable: false, reason: 'encoding', width: () => 0, decode: () => null, encode: () => null };
      const baseDecode = base === 'WinAnsiEncoding' ? winAnsiDecode : (base === 'StandardEncoding' || info.std) ? standardEncDecode : winAnsiDecode;
      info.decode = c => { if (uni && uni.has(c)) return uni.get(c); if (diffs.has(c)) return diffs.get(c); return baseDecode(c); };
      const symbolicStd = /^(Symbol|ZapfDingbats)$/i.test(String(baseFont || '').replace(/^[A-Z]{6}\+/, ''));
      if (!uni && !diffs.size && !base && ((flags & 4) || symbolicStd)) return { ...info, usable: false, reason: 'no-unicode-map', width: () => 0, decode: () => null, encode: () => null };
      const first = numOf(P, fd.lookup(P.PDFName.of('FirstChar'))) ?? 0, wArr = fd.lookup(P.PDFName.of('Widths')), mw = descriptor ? (numOf(P, descriptor.lookup(P.PDFName.of('MissingWidth'))) || 0) : 0;
      const widths = wArr instanceof P.PDFArray ? wArr.asArray().map(x => numOf(P, this.doc.context.lookup(x))) : null;
      let stdTbl = null; if (!widths && info.std) stdTbl = await this.stdWidths(info.std[3]);
      info.width = c => widths ? (widths[c - first] ?? mw) : stdTbl ? (stdTbl.get(c) ?? 0) : mw;
      if (!widths && !stdTbl) return { ...info, usable: false, reason: 'no-widths', width: () => 0, decode: () => null, encode: () => null };
    }
    /* ---- encode (reverse map) ---- */
    const self = this; let rev = null;
    info.encode = ch => {
      if (!rev || rev.stamp !== (self.used.get(key)?.size ?? -1)) { // rebuild when more usage is recorded
        rev = new Map(); rev.stamp = self.used.get(key)?.size ?? -1;
        if (!info.embedded && !composite) { for (let c = 0x20; c < 256; c++) { const u = info.decode(c); if (u && !rev.has(u)) rev.set(u, c); } }
        else for (const c of self.used.get(key) || []) { const u = info.decode(c); if (u && u.length && !rev.has(u)) rev.set(u, c); }
      }
      return rev.get(ch) ?? null;
    };
    return info;
  }
}
