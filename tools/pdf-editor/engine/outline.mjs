/* Bookmarks (the document outline): read the tree, and write an edited tree back with fresh First/Last/Next/Prev/Parent/Count
   links and explicit destinations. Items are plain objects so the editor can keep them in its undo history:
   {id, title, open, dest:{src,page,mode,params}|null, uri|null, color:[r,g,b]|null, flags:0|1|2|3, children:[]} */
import { pageIndexMap, resolveDest, makeDest } from './dest.mjs';
import { pdfLiteral } from './links.mjs';

const MAX_NODES = 5000, MAX_DEPTH = 40;
let seq = 0; export const newOutlineId = () => 'bm' + (++seq);

export function readOutline(P, doc, src = 's1') {
  const { PDFName } = P, map = pageIndexMap(P, doc), root = doc.catalog.lookupMaybe(PDFName.of('Outlines'), P.PDFDict);
  const seen = new Set(); let count = 0, unsupported = 0;
  const readChain = (firstRef, depth) => {
    const items = []; let ref = firstRef;
    while (ref && count < MAX_NODES) {
      const key = ref instanceof P.PDFRef ? ref.toString() : null; if (key) { if (seen.has(key)) break; seen.add(key); }
      const d = doc.context.lookup(ref); if (!(d instanceof P.PDFDict)) break; count++;
      const t = d.lookup(PDFName.of('Title')); const item = { id: newOutlineId(), title: t && t.decodeText ? t.decodeText() : '', open: true, dest: null, uri: null, color: null, flags: 0, children: [] };
      const cnt = d.lookup(PDFName.of('Count')); if (cnt instanceof P.PDFNumber && cnt.asNumber() < 0) item.open = false;
      const dest = d.get(PDFName.of('Dest')), act = d.lookup(PDFName.of('A'));
      if (dest) { const r = resolveDest(P, doc, d.lookup(PDFName.of('Dest')), map); if (r && r.page !== null) item.dest = { src, ...r }; }
      else if (act instanceof P.PDFDict) {
        const s = act.lookup(PDFName.of('S')), sn = s instanceof P.PDFName ? s.decodeText() : '';
        if (sn === 'GoTo') { const r = resolveDest(P, doc, act.lookup(PDFName.of('D')), map); if (r && r.page !== null) item.dest = { src, ...r }; }
        else if (sn === 'URI') { const u = act.lookup(PDFName.of('URI')); if (u && u.decodeText) item.uri = u.decodeText(); }
        else unsupported++;
      }
      const c = d.lookup(PDFName.of('C')); if (c instanceof P.PDFArray && c.size() === 3) item.color = [0, 1, 2].map(i => c.lookup(i) instanceof P.PDFNumber ? c.lookup(i).asNumber() : 0);
      const f = d.lookup(PDFName.of('F')); if (f instanceof P.PDFNumber) item.flags = f.asNumber() & 3;
      const first = d.get(PDFName.of('First')); if (first && depth < MAX_DEPTH) item.children = readChain(first, depth + 1);
      items.push(item); ref = d.get(PDFName.of('Next'));
    }
    return items;
  };
  const tree = root && root.get(PDFName.of('First')) ? readChain(root.get(PDFName.of('First')), 0) : [];
  return { tree, unsupported };
}

export const flatten = (tree, depth = 0, out = []) => { for (const n of tree) { out.push({ node: n, depth }); flatten(n.children, depth + 1, out); } return out; };
export const countItems = tree => flatten(tree).length;
export function findNode(tree, id, parent = null) { for (let i = 0; i < tree.length; i++) { if (tree[i].id === id) return { node: tree[i], list: tree, index: i, parent }; const r = findNode(tree[i].children, id, tree[i]); if (r) return r; } return null; }

/* Structural edits (pure, on a cloned tree). Return the new tree. */
export function cloneTree(t) { return JSON.parse(JSON.stringify(t)); }
export function addItem(tree, item, afterId = null) { const t = cloneTree(tree); if (afterId) { const f = findNode(t, afterId); if (f) { f.list.splice(f.index + 1, 0, item); return t; } } t.push(item); return t; }
export function removeItem(tree, id) { const t = cloneTree(tree), f = findNode(t, id); if (f) f.list.splice(f.index, 1); return t; }
export function renameItem(tree, id, title) { const t = cloneTree(tree), f = findNode(t, id); if (f) f.node.title = title; return t; }
export function moveItem(tree, id, dir) { const t = cloneTree(tree), f = findNode(t, id); if (!f) return t; const j = f.index + dir; if (j < 0 || j >= f.list.length) return t; [f.list[f.index], f.list[j]] = [f.list[j], f.list[f.index]]; return t; }
/* indent: becomes the last child of its previous sibling; outdent: becomes the next sibling of its parent */
export function indentItem(tree, id) { const t = cloneTree(tree), f = findNode(t, id); if (!f || f.index === 0) return t; const prev = f.list[f.index - 1]; f.list.splice(f.index, 1); prev.children.push(f.node); prev.open = true; return t; }
export function outdentItem(tree, id) { const t = cloneTree(tree), f = findNode(t, id); if (!f || !f.parent) return t; const g = findNode(t, f.parent.id); f.list.splice(f.index, 1); g.list.splice(g.index + 1, 0, f.node); return t; }

/* Writes the tree. pageFor(src, idx) -> output page object or null. Returns {warnings, written}. */
export function writeOutline(P, doc, tree, pageFor) {
  const { PDFName } = P, ctx = doc.context, warnings = []; let written = 0;
  // drop the old tree
  const oldRootRef = doc.catalog.get(PDFName.of('Outlines'));
  const drop = start => {
    const seen = new Set(), stack = [start];
    while (stack.length && seen.size < MAX_NODES * 2) {
      const ref = stack.pop(); if (!(ref instanceof P.PDFRef)) continue; const key = ref.toString(); if (seen.has(key)) continue; seen.add(key);
      const d = ctx.lookup(ref); if (!(d instanceof P.PDFDict)) continue;
      const f = d.get(PDFName.of('First')), n = d.get(PDFName.of('Next')); if (n) stack.push(n); if (f) stack.push(f);
      ctx.delete(ref);
    }
  };
  if (oldRootRef instanceof P.PDFRef) { const od = ctx.lookup(oldRootRef); if (od instanceof P.PDFDict) { const f = od.get(PDFName.of('First')); if (f) drop(f); } }
  if (!tree.length) { doc.catalog.delete(PDFName.of('Outlines')); return { warnings, written: 0 }; }
  const rootRef = ctx.nextRef(), root = P.PDFDict.withContext(ctx); root.set(PDFName.of('Type'), PDFName.of('Outlines'));
  const visibleCount = n => n.children.reduce((s, c) => s + 1 + (c.open ? visibleCount(c) : 0), 0);
  const build = (items, parentRef) => {
    const refs = items.map(() => ctx.nextRef()), dicts = items.map(() => P.PDFDict.withContext(ctx));
    items.forEach((n, i) => {
      const d = dicts[i]; written++;
      d.set(PDFName.of('Title'), P.PDFHexString.fromText(n.title || 'Untitled')); d.set(PDFName.of('Parent'), parentRef);
      if (i > 0) d.set(PDFName.of('Prev'), refs[i - 1]); if (i < items.length - 1) d.set(PDFName.of('Next'), refs[i + 1]);
      if (n.dest) { const pg = pageFor(n.dest.src, n.dest.page); if (pg) d.set(PDFName.of('Dest'), makeDest(P, doc, pg, n.dest)); else warnings.push(`Bookmark "${n.title}" pointed to a page that is not in the exported document; it was kept without a destination.`); }
      else if (n.uri && /^(https?:\/\/|mailto:|tel:)[^\s<>"]+$/i.test(n.uri)) d.set(PDFName.of('A'), ctx.obj({ S: 'URI', URI: P.PDFString.of(pdfLiteral(n.uri)) }));
      if (n.color) d.set(PDFName.of('C'), ctx.obj(n.color)); if (n.flags) d.set(PDFName.of('F'), P.PDFNumber.of(n.flags));
      if (n.children.length) { const kids = build(n.children, refs[i]); d.set(PDFName.of('First'), kids.first); d.set(PDFName.of('Last'), kids.last); const vis = visibleCount(n); d.set(PDFName.of('Count'), P.PDFNumber.of(n.open ? vis : -vis)); }
      ctx.assign(refs[i], d);
    });
    return { first: refs[0], last: refs[refs.length - 1] };
  };
  const top = build(tree, rootRef); root.set(PDFName.of('First'), top.first); root.set(PDFName.of('Last'), top.last); root.set(PDFName.of('Count'), P.PDFNumber.of(visibleCount({ children: tree })));
  ctx.assign(rootRef, root); doc.catalog.set(PDFName.of('Outlines'), rootRef);
  return { warnings, written };
}
