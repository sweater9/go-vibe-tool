/* Destination helpers shared by links and bookmarks: resolve explicit and named destinations to {page, mode, params}
   and build destination arrays again. Page identity is the page-object reference, mapped to a zero-based page index. */

export const DEST_MODES = new Set(['XYZ', 'Fit', 'FitH', 'FitV', 'FitR', 'FitB', 'FitBH', 'FitBV']);

export function pageIndexMap(P, doc) { const m = new Map(); doc.getPages().forEach((pg, i) => m.set(pg.ref.toString(), i)); return m; }

const numOrNull = (P, v) => (v instanceof P.PDFNumber) ? v.asNumber() : null;
const str = (P, v) => (v instanceof P.PDFString || v instanceof P.PDFHexString) ? v.decodeText() : (v instanceof P.PDFName ? v.decodeText() : null);

/* Name-tree and legacy /Dests lookup. */
function lookupNamed(P, doc, name) {
  const cat = doc.catalog;
  const legacy = cat.lookupMaybe(P.PDFName.of('Dests'), P.PDFDict);
  if (legacy) { const v = legacy.lookup(P.PDFName.of(name)); if (v) return v; }
  const names = cat.lookupMaybe(P.PDFName.of('Names'), P.PDFDict), tree = names && names.lookupMaybe(P.PDFName.of('Dests'), P.PDFDict);
  const walk = (node, depth) => {
    if (!(node instanceof P.PDFDict) || depth > 24) return null;
    const arr = node.lookupMaybe(P.PDFName.of('Names'), P.PDFArray);
    if (arr) for (let i = 0; i + 1 < arr.size(); i += 2) { if (str(P, arr.lookup(i)) === name) return arr.lookup(i + 1); }
    const kids = node.lookupMaybe(P.PDFName.of('Kids'), P.PDFArray);
    if (kids) for (let i = 0; i < kids.size(); i++) { const r = walk(kids.lookup(i), depth + 1); if (r) return r; }
    return null;
  };
  return tree ? walk(tree, 0) : null;
}

/* dest: PDFArray | PDFName | PDFString | PDFDict(with /D). Returns {page:index|null, mode, params:[..]} or null. */
export function resolveDest(P, doc, dest, pageMap) {
  let d = dest, hops = 0;
  while (d && hops++ < 4) {
    if (d instanceof P.PDFName || d instanceof P.PDFString || d instanceof P.PDFHexString) { d = lookupNamed(P, doc, str(P, d)); continue; }
    if (d instanceof P.PDFDict) { d = d.lookup(P.PDFName.of('D')); continue; }
    break;
  }
  if (!(d instanceof P.PDFArray) || d.size() < 2) return null;
  const first = d.get(0), page = first instanceof P.PDFRef ? (pageMap.get(first.toString()) ?? null) : (first instanceof P.PDFNumber ? first.asNumber() : null); // numbers are used by remote destinations only
  const mode = str(P, d.lookup(1)) || 'XYZ';
  const params = []; for (let i = 2; i < d.size(); i++) params.push(numOrNull(P, d.lookup(i)));
  return { page, mode: DEST_MODES.has(mode) ? mode : 'XYZ', params };
}

/* Builds a destination array for an output page object. */
export function makeDest(P, doc, pageObj, dest) {
  const mode = DEST_MODES.has(dest.mode) ? dest.mode : 'XYZ'; const arr = [pageObj.ref, P.PDFName.of(mode)];
  const params = dest.params && dest.params.length ? dest.params : (mode === 'XYZ' ? [null, null, null] : []);
  for (const v of params) arr.push(v === null || v === undefined || Number.isNaN(v) ? P.PDFNull : P.PDFNumber.of(v));
  return doc.context.obj(arr);
}
export const topOfPage = view => ({ mode: 'XYZ', params: [view ? view[0] : 0, view ? view[3] : 0, null] });
