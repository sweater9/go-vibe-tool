/* Hyperlinks: read, edit, remove and create Link annotations. External links use URI actions (http, https, mailto, tel only);
   internal links use explicit destinations to a page. Records are plain objects so the editor can keep them in its undo history:
   {id, src, page, rect:[x0,y0,x1,y1], kind:'uri'|'page', uri, dest:{src,page,mode,params}, border, ref?, deleted?, changed?} */
import { pageIndexMap, resolveDest, makeDest } from './dest.mjs';

export const SAFE_URI = /^(https?:\/\/|mailto:|tel:)[^\s<>"]+$/i;
export function normalizeUri(raw) {
  let u = String(raw || '').trim(); if (!u) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u) ? 'mailto:' + u : 'https://' + u;
  return SAFE_URI.test(u) ? u : null;
}
const rectOf = (P, a) => { const r = a.lookup(P.PDFName.of('Rect')); if (!(r instanceof P.PDFArray) || r.size() < 4) return null; const v = [0, 1, 2, 3].map(i => r.lookup(i) instanceof P.PDFNumber ? r.lookup(i).asNumber() : NaN); if (v.some(Number.isNaN)) return null; return [Math.min(v[0], v[2]), Math.min(v[1], v[3]), Math.max(v[0], v[2]), Math.max(v[1], v[3])]; };
export const normRect = r => [Math.min(r[0], r[2]), Math.min(r[1], r[3]), Math.max(r[0], r[2]), Math.max(r[1], r[3])];

/* All Link annotations of the document. `src` tags the records with the editor's source id. */
export function readLinks(P, doc, src = 's1') {
  const map = pageIndexMap(P, doc), out = [];
  doc.getPages().forEach((page, pi) => {
    const annots = page.node.lookupMaybe(P.PDFName.of('Annots'), P.PDFArray); if (!annots) return;
    for (let i = 0; i < annots.size(); i++) {
      const raw = annots.get(i), a = annots.lookup(i); if (!(a instanceof P.PDFDict)) continue;
      const sub = a.lookup(P.PDFName.of('Subtype')); if (!(sub instanceof P.PDFName) || sub.decodeText() !== 'Link') continue;
      const rect = rectOf(P, a); if (!rect) continue;
      const rec = { id: `${src}:${pi}:${raw instanceof P.PDFRef ? raw.toString() : 'i' + i}`, src, page: pi, rect, kind: 'other', uri: null, dest: null, border: 0, ref: raw instanceof P.PDFRef ? raw.toString() : null };
      const act = a.lookup(P.PDFName.of('A')); const bd = a.lookup(P.PDFName.of('Border'));
      rec.border = bd instanceof P.PDFArray && bd.size() >= 3 && bd.lookup(2) instanceof P.PDFNumber && bd.lookup(2).asNumber() > 0 ? 1 : 0;
      if (act instanceof P.PDFDict) {
        const s = act.lookup(P.PDFName.of('S')), sName = s instanceof P.PDFName ? s.decodeText() : '';
        if (sName === 'URI') { const u = act.lookup(P.PDFName.of('URI')); const text = u && u.decodeText ? u.decodeText() : null; if (text) { rec.kind = 'uri'; rec.uri = text; } }
        else if (sName === 'GoTo') { const d = resolveDest(P, doc, act.lookup(P.PDFName.of('D')), map); if (d && d.page !== null) { rec.kind = 'page'; rec.dest = { src, ...d }; } }
        else rec.actionType = sName;
      } else if (a.has(P.PDFName.of('Dest'))) { const d = resolveDest(P, doc, a.lookup(P.PDFName.of('Dest')), map); if (d && d.page !== null) { rec.kind = 'page'; rec.dest = { src, ...d }; } }
      out.push(rec);
    }
  });
  return out;
}

function fillAction(P, doc, a, rec, pageFor, warnings) {
  const { PDFName } = P; a.delete(PDFName.of('A')); a.delete(PDFName.of('Dest'));
  if (rec.kind === 'uri') { const u = normalizeUri(rec.uri); if (!u) { warnings.push(`Link address "${rec.uri}" is not allowed (use http, https, mailto or tel).`); return false; } a.set(PDFName.of('A'), doc.context.obj({ Type: 'Action', S: 'URI', URI: P.PDFString.of(u) })); return true; }
  if (rec.kind === 'page') {
    const pg = pageFor(rec.dest.src, rec.dest.page); if (!pg) { warnings.push('A link points to a page that is not in the exported document and was removed.'); return false; }
    a.set(PDFName.of('Dest'), makeDest(P, doc, pg, rec.dest)); return true;
  }
  return false;
}
const border = (P, doc, rec) => doc.context.obj([0, 0, rec.border ? 1 : 0]);

/* Writes link records onto output pages.
   pagesOf(src, idx) -> output page objects for that source page (empty when removed); pageFor(src, idx) -> first output page.
   mode 'in-place': touch only changed/deleted/new records; 'copy': original annotations are not in the output, recreate all kept records. */
export function writeLinks(P, doc, records, pagesOf, pageFor, mode) {
  const warnings = [], { PDFName } = P; let kept = 0;
  const removeAnnot = (page, refTag) => {
    const annots = page.node.lookupMaybe(PDFName.of('Annots'), P.PDFArray); if (!annots) return;
    for (let i = annots.size() - 1; i >= 0; i--) { const r = annots.get(i); if (r instanceof P.PDFRef && r.toString() === refTag) annots.remove(i); }
  };
  for (const rec of records) {
    const targets = pagesOf(rec.src, rec.page);
    if (rec.deleted || !targets.length) { if (mode === 'in-place' && rec.ref) for (const pg of targets) removeAnnot(pg, rec.ref); continue; }
    if (mode === 'in-place' && rec.ref && !rec.changed) { kept++; continue; }
    for (const pg of targets) {
      let a;
      if (mode === 'in-place' && rec.ref) { a = doc.context.lookup(P.PDFRef.of(...rec.ref.split(' ').slice(0, 2).map(Number)), P.PDFDict); if (!(a instanceof P.PDFDict)) continue; }
      else a = P.PDFDict.withContext(doc.context);
      if (!(mode === 'in-place' && rec.ref)) { a.set(PDFName.of('Type'), PDFName.of('Annot')); a.set(PDFName.of('Subtype'), PDFName.of('Link')); a.set(PDFName.of('F'), P.PDFNumber.of(4)); }
      a.set(PDFName.of('Rect'), doc.context.obj(normRect(rec.rect))); a.set(PDFName.of('Border'), border(P, doc, rec));
      if (rec.border) a.set(PDFName.of('C'), doc.context.obj([0, 0, 0.9]));
      if (rec.kind === 'other' && mode === 'in-place') { kept++; continue; }
      if (!fillAction(P, doc, a, rec, pageFor, warnings)) { if (mode === 'in-place' && rec.ref) removeAnnot(pg, rec.ref); continue; }
      if (!(mode === 'in-place' && rec.ref)) pg.node.addAnnot(doc.context.register(a));
      kept++;
    }
  }
  return { warnings, kept };
}

/* Remove every Link annotation from a source document that is only used for copying pages (copyPages would otherwise drag
   the destination pages of internal links into the output). */
export function stripLinks(P, doc) {
  for (const page of doc.getPages()) {
    const annots = page.node.lookupMaybe(P.PDFName.of('Annots'), P.PDFArray); if (!annots) continue;
    for (let i = annots.size() - 1; i >= 0; i--) { const a = annots.lookup(i); if (a instanceof P.PDFDict) { const s = a.lookup(P.PDFName.of('Subtype')); if (s instanceof P.PDFName && s.decodeText() === 'Link') annots.remove(i); } }
  }
}
