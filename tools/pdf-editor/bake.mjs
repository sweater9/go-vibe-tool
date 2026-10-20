/* Builds the output PDF from the editor model with pdf-lib. DOM-free; pdf-lib is passed in so Node tests can use the vendored build.
   Page content is never rasterised: original pages are kept (loaded in place when possible, otherwise copied) and overlay objects
   are drawn as vector text, images and shapes on top. */
import { norm, frameToUser, layoutText, fontKey, NOTE_SIZE } from './model.mjs';
import { writeLinks, stripLinks } from './engine/links.mjs';
import { writeOutline } from './engine/outline.mjs';

const hex = c => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ''); const n = m ? parseInt(m[1], 16) : 0; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

export function distinctSources(pages) { return [...new Set(pages.filter(p => !p.blank).map(p => p.src))]; }

/* In-place mode keeps everything outside the pages (form fields, outlines, metadata): one source, no blank pages, no repeated page. */
export function canEditInPlace(pages) {
  const srcs = distinctSources(pages);
  if (srcs.length !== 1 || pages.some(p => p.blank)) return false;
  return new Set(pages.map(p => p.idx)).size === pages.length;
}

/* opts: { sources:{id:Uint8Array}, pages, objects, assets:{id:{bytes,mime}}, fonts, only?:[pageId...], title? } */
export async function bakeDocument(PDFLib, opts) {
  const { PDFDocument, StandardFonts, degrees, rgb, BlendMode, LineCapStyle, PDFHexString } = PDFLib;
  const { sources, objects, assets = {}, fonts } = opts;
  const keep = opts.only ? new Set(opts.only) : null;
  const pages = opts.pages.filter(p => !keep || keep.has(p.id));
  if (!pages.length) throw new Error('Choose at least one page.');
  const loaded = {}, load = async id => loaded[id] || (loaded[id] = await PDFDocument.load(sources[id], { ignoreEncryption: false, updateMetadata: false }));
  let out; const outPages = []; let inPlace = false, identity = false;
  if (canEditInPlace(pages)) {
    inPlace = true;
    const srcId = pages[0].src; out = await load(srcId); loaded[srcId] = null; // the loaded document is mutated, never reuse it
    // pdf-lib's page cache is not refreshed by removePage, so take the page objects first, remove everything,
    // then re-insert only the wanted pages in the wanted order (the page objects themselves are untouched).
    const all = out.getPages(); identity = all.length === pages.length && pages.every((p, i) => p.idx === i);
    for (let i = all.length - 1; i >= 0; i--) out.removePage(i);
    pages.forEach((p, i) => { const pg = all[p.idx]; out.insertPage(i, pg); outPages.push({ entry: p, page: pg }); });
  } else {
    out = await PDFDocument.create();
    const first = pages.find(p => !p.blank);
    if (first) { const src = await load(first.src); for (const [set, get] of [['setTitle', 'getTitle'], ['setAuthor', 'getAuthor'], ['setSubject', 'getSubject'], ['setKeywords', 'getKeywords']]) { try { const v = src[get](); if (v) out[set](...(set === 'setKeywords' ? [v.split(/\s+/)] : [v])); } catch { /* optional metadata */ } } }
    for (const p of pages) {
      if (p.blank) { const [x0, y0, x1, y1] = p.view; outPages.push({ entry: p, page: out.addPage([x1 - x0, y1 - y0]) }); continue; }
      const srcDoc = await load(p.src); if (!srcDoc.__linksStripped) { stripLinks(PDFLib, srcDoc); srcDoc.__linksStripped = true; } // copyPages would drag the pages that internal links point to into the output
      const [copied] = await out.copyPages(srcDoc, [p.idx]); outPages.push({ entry: p, page: out.addPage(copied) });
    }
  }
  out.setProducer('GoVibeTool PDF Editor'); out.setModificationDate(new Date());
  const fontCache = {}, imageCache = {};
  const getFont = async key => fontCache[key] || (fontCache[key] = await out.embedFont(StandardFonts[key]));
  const getImage = async id => {
    if (imageCache[id]) return imageCache[id];
    const a = assets[id]; if (!a) throw new Error('An inserted image is missing.');
    return (imageCache[id] = a.mime === 'image/jpeg' ? await out.embedJpg(a.bytes) : await out.embedPng(a.bytes));
  };
  for (const { entry, page } of outPages) {
    const base = entry.baseRot || 0;
    page.setRotation(degrees(norm(base + entry.rot)));
    for (const o of objects) if (o.page === entry.id) await drawObject(o, page);
  }
  async function drawObject(o, page) {
    const color = rgb(...hex(o.color || o.stroke || '#000000')), opacity = o.opacity == null ? 1 : o.opacity;
    if (o.type === 'text') {
      const f = await getFont(fontKey(o)), lay = layoutText(o, fonts);
      lay.lines.forEach((ln, i) => {
        if (!ln.text) return;
        const u = o.align === 'center' ? (o.cw - ln.width) / 2 : o.align === 'right' ? o.cw - ln.width : 0;
        const [x, y] = frameToUser(o, u, lay.ascent + i * lay.lineHeight);
        page.drawText(ln.text, { x, y, size: o.size, font: f, color, opacity, rotate: degrees(o.rot) });
      });
    } else if (o.type === 'image') {
      const img = await getImage(o.asset), [x, y] = frameToUser(o, 0, o.ch);
      page.drawImage(img, { x, y, width: o.cw, height: o.ch, rotate: degrees(o.rot), opacity });
    } else if (o.type === 'rect') {
      const [x, y] = frameToUser(o, 0, o.ch);
      page.drawRectangle({ x, y, width: o.cw, height: o.ch, rotate: degrees(o.rot), borderColor: o.stroke ? rgb(...hex(o.stroke)) : undefined, borderWidth: o.stroke ? o.width : 0, color: o.fill ? rgb(...hex(o.fill)) : undefined, opacity: o.fill ? opacity : undefined, borderOpacity: opacity });
    } else if (o.type === 'ellipse') {
      const [x, y] = frameToUser(o, o.cw / 2, o.ch / 2);
      page.drawEllipse({ x, y, xScale: o.cw / 2, yScale: o.ch / 2, rotate: degrees(o.rot), borderColor: o.stroke ? rgb(...hex(o.stroke)) : undefined, borderWidth: o.stroke ? o.width : 0, color: o.fill ? rgb(...hex(o.fill)) : undefined, opacity: o.fill ? opacity : undefined, borderOpacity: opacity });
    } else if (o.type === 'line' || o.type === 'arrow') {
      const line = (a, b) => page.drawLine({ start: { x: a[0], y: a[1] }, end: { x: b[0], y: b[1] }, thickness: o.width, color: rgb(...hex(o.stroke)), opacity, lineCap: LineCapStyle.Round });
      line(o.p1, o.p2);
      if (o.type === 'arrow') {
        const ang = Math.atan2(o.p2[1] - o.p1[1], o.p2[0] - o.p1[0]), len = Math.max(10, o.width * 4);
        for (const s of [-1, 1]) line(o.p2, [o.p2[0] - len * Math.cos(ang + s * 0.45), o.p2[1] - len * Math.sin(ang + s * 0.45)]);
      }
    } else if (o.type === 'draw') {
      for (let i = 1; i < o.points.length; i++) page.drawLine({ start: { x: o.points[i - 1][0], y: o.points[i - 1][1] }, end: { x: o.points[i][0], y: o.points[i][1] }, thickness: o.width, color: rgb(...hex(o.stroke)), opacity, lineCap: LineCapStyle.Round });
      if (o.points.length === 1) page.drawCircle({ x: o.points[0][0], y: o.points[0][1], size: o.width / 2, color: rgb(...hex(o.stroke)), opacity });
    } else if (o.type === 'highlight') {
      for (const r of o.rects) page.drawRectangle({ x: r.x, y: r.y, width: r.w, height: r.h, color: rgb(...hex(o.color)), opacity: o.opacity == null ? 0.4 : o.opacity, blendMode: BlendMode.Multiply });
    } else if (o.type === 'underline' || o.type === 'strike') {
      for (const r of o.rects) { const y = o.type === 'underline' ? r.y + r.h * 0.08 : r.y + r.h * 0.38; page.drawLine({ start: { x: r.x, y }, end: { x: r.x + r.w, y }, thickness: Math.max(0.8, r.h * 0.07), color: rgb(...hex(o.color)), opacity }); }
    } else if (o.type === 'note') {
      const ctx = out.context, ap = ctx.stream('1 0.92 0.3 rg 0 0 24 24 re f 0.55 0.42 0 RG 1 w 0.5 0.5 23 23 re S 5 17 m 19 17 l S 5 12 m 19 12 l S 5 7 m 13 7 l S', { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, NOTE_SIZE, NOTE_SIZE], Resources: {} });
      const annot = ctx.obj({ Type: 'Annot', Subtype: 'Text', Rect: [o.x, o.y, o.x + NOTE_SIZE, o.y + NOTE_SIZE], Contents: PDFHexString.fromText(o.text || ''), T: PDFHexString.fromText('GoVibeTool'), Name: 'Comment', F: 28, C: [1, 0.92, 0.3], AP: { N: ctx.register(ap) } });
      page.node.addAnnot(ctx.register(annot));
    }
  }
  /* ---- links and bookmarks (V2) ---- */
  const bySrc = new Map(); for (const { entry, page } of outPages) { if (entry.blank) continue; const k = `${entry.src}:${entry.idx}`; if (!bySrc.has(k)) bySrc.set(k, []); bySrc.get(k).push(page); }
  const pagesOf = (src, idx) => bySrc.get(`${src}:${idx}`) || [], pageFor = (src, idx) => pagesOf(src, idx)[0] || null;
  const report = { warnings: [], links: 0, bookmarks: 0 };
  if (opts.links) {
    const recs = opts.links.map(r => ({ ...r })); if (!identity) for (const r of recs) if (r.kind === 'page') r.changed = true;
    const r = writeLinks(PDFLib, out, recs, pagesOf, pageFor, inPlace ? 'in-place' : 'copy'); report.links = r.kept; report.warnings.push(...r.warnings);
  }
  if (opts.outline && (opts.outlineDirty || !identity || !inPlace)) { const r = writeOutline(PDFLib, out, opts.outline, pageFor); report.bookmarks = r.written; report.outlineRebuilt = true; report.warnings.push(...r.warnings); }
  const bytes = await out.save();
  if (opts.report) Object.assign(opts.report, report);
  return bytes;
}
