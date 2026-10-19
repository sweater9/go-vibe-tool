/* Unit tests for the PDF Editor's DOM-free engine: viewport maths, object geometry, page operations, undo history, export (bake) and
   genuine existing-text editing. Runs in Node against the repo's vendored pdf-lib. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const repo = fileURLToPath(new URL('../', import.meta.url));
const PDFLib = createRequire(import.meta.url)(path.join(repo, 'vendor/pdf-lib.min.js'));
const { PDFDocument, StandardFonts, rgb, PDFName, PDFDict, PDFArray } = PDFLib;
const M = await import('../tools/pdf-editor/model.mjs');
const B = await import('../tools/pdf-editor/bake.mjs');
const T = await import('../tools/pdf-editor/textedit.mjs');
const fonts = await M.makeFontMetrics(PDFLib);
const close = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);

async function sample(label, n, size = [612, 792]) {
  const d = await PDFDocument.create(), f = await d.embedFont(StandardFonts.HelveticaBold);
  for (let i = 0; i < n; i++) { const p = d.addPage(size); p.drawText(`${label} PAGE ${i + 1}`, { x: 40, y: size[1] - 100, size: 24, font: f }); }
  return new Uint8Array(await d.save());
}
const pagesOf = (src, n, view = [0, 0, 612, 792]) => { const st = M.createState(); for (let i = 0; i < n; i++) st.pages.push({ id: M.uid(st), src, idx: i, rot: 0, baseRot: 0, view, blank: false }); return st; };
async function textOf(bytes, i) { // text via the page's own content, using the same decoder the editor uses
  const doc = await PDFDocument.load(bytes), page = doc.getPage(i); const ops = T.showOps(Buffer.concat((Array.isArray(page.node.Contents()?.asArray?.()) ? page.node.Contents().asArray().map(r => PDFLib.decodePDFRawStream(doc.context.lookup(r)).decode()) : [PDFLib.decodePDFRawStream(page.node.Contents()).decode()]).map(b => Buffer.from(b))));
  return ops.map(o => String.fromCodePoint(...o.bytes.map(T.decodeWinAnsi))).join('|');
}

test('viewport: user space <-> display round trips for every rotation and a non-zero origin', () => {
  for (const rot of [0, 90, 180, 270, -90, 450]) for (const view of [[0, 0, 612, 792], [10, 20, 310, 420]]) {
    const vp = M.makeViewport(view, rot, 1.5);
    for (const [x, y] of [[view[0], view[1]], [view[2], view[3]], [view[0] + 33, view[1] + 71]]) { const [dx, dy] = vp.toDisplay(x, y), [bx, by] = vp.toUser(dx, dy); close(bx, x, 1e-9); close(by, y, 1e-9); assert.ok(dx >= -1e-9 && dx <= vp.width + 1e-9 && dy >= -1e-9 && dy <= vp.height + 1e-9); }
  }
  const vp = M.makeViewport([0, 0, 100, 200], 90, 1); assert.deepEqual([vp.width, vp.height], [200, 100]);
  assert.deepEqual(M.makeViewport([0, 0, 100, 200], 0, 1).toDisplay(0, 200), [0, 0], 'user top-left is display top-left');
  assert.deepEqual(M.makeViewport([0, 0, 100, 200], 90, 1).toDisplay(0, 0), [0, 0], 'a 90 degree page shows the user origin at the top-left');
});

test('frames: frame <-> user are inverses and a rotated frame reads along the right axis', () => {
  for (const rot of [0, 33, 90, 180, 270]) {
    const f = { ox: 120, oy: 340, rot, cw: 100, ch: 40 };
    for (const [u, v] of [[0, 0], [100, 40], [37, 11]]) { const [x, y] = M.frameToUser(f, u, v), [u2, v2] = M.userToFrame(f, x, y); close(u2, u, 1e-9); close(v2, v, 1e-9); }
  }
  const [x, y] = M.frameToUser({ ox: 0, oy: 0, rot: 90, cw: 10, ch: 10 }, 10, 0); close(x, 0, 1e-9); close(y, 10, 1e-9); // reading direction points up the page
});

test('resize: the opposite handle stays fixed for rectangles and text; images keep their ratio', () => {
  const base = { type: 'rect', ox: 100, oy: 500, rot: 25, cw: 80, ch: 50 };
  for (let h = 0; h < 8; h++) {
    const o = { ...base }, pts = M.handlePoints(o, fonts), anchor = M.frameToUser(o, ...pts[(h + 4) % 8]), target = M.frameToUser(o, ...pts[h]);
    M.resizeFrame(o, h, [target[0] + 9, target[1] + 4], fonts); const a2 = M.frameToUser(o, ...M.handlePoints(o, fonts)[(h + 4) % 8]);
    close(a2[0], anchor[0], 1e-6); close(a2[1], anchor[1], 1e-6);
  }
  const t = { type: 'text', ox: 50, oy: 700, rot: 0, cw: 200, text: 'Hello world', size: 20, font: 'Helvetica' }, before = M.frameToUser(t, 0, M.frameHeight(t, fonts));
  M.resizeFrame(t, 3, [330, 690], fonts); close(t.cw, 280, 1e-6); assert.equal(t.size, 20, 'a side handle changes the wrap width, not the size');
  M.resizeFrame(t, 4, [t.ox + t.cw * 2, 600], fonts); assert.ok(t.size > 30, 'a corner handle scales the font');
  void before;
  const img = { type: 'image', ox: 0, oy: 100, rot: 0, cw: 100, ch: 50 }; M.resizeFrame(img, 4, [300, 20], fonts); close(img.cw / img.ch, 2, 1e-9);
});

test('rotate handle sets the angle about the centre and keeps the centre fixed', () => {
  const o = { type: 'rect', ox: 100, oy: 300, rot: 0, cw: 80, ch: 40 }, c0 = M.frameToUser(o, 40, 20);
  M.rotateFrame(o, [c0[0] - 50, c0[1] + 1e-9], fonts); // pointer to the left of the centre -> handle (above) swung to the left = +90
  close(o.rot, 0 + 0, 400); const c1 = M.frameToUser(o, 40, 20); close(c1[0], c0[0], 1e-6); close(c1[1], c0[1], 1e-6);
  M.rotateFrame(o, [c0[0] + 60, c0[1] + 60], fonts, { snap: false }); close(o.rot, 315, 1e-6);
});

test('hit testing and translation for every object type', () => {
  const objs = [
    { id: 1, type: 'rect', ox: 10, oy: 100, rot: 0, cw: 50, ch: 20 }, { id: 2, type: 'line', p1: [0, 0], p2: [100, 0], width: 2 },
    { id: 3, type: 'draw', points: [[0, 50], [50, 50]], width: 2 }, { id: 4, type: 'note', x: 200, y: 200, text: '' }, { id: 5, type: 'highlight', rects: [{ x: 300, y: 300, w: 40, h: 10 }] },
  ];
  assert.ok(M.hitTest(objs[0], [30, 90], fonts)); assert.ok(!M.hitTest(objs[0], [30, 140], fonts)); assert.ok(M.hitTest(objs[1], [50, 1], fonts)); assert.ok(!M.hitTest(objs[1], [50, 20], fonts));
  assert.ok(M.hitTest(objs[2], [25, 50.5], fonts)); assert.ok(M.hitTest(objs[3], [210, 210], fonts)); assert.ok(M.hitTest(objs[4], [310, 305], fonts));
  for (const o of objs) { const b0 = M.bounds(o, fonts); M.translate(o, 5, -3); const b1 = M.bounds(o, fonts); close(b1.x0 - b0.x0, 5, 1e-9); close(b1.y0 - b0.y0, -3, 1e-9); }
});

test('text layout wraps on spaces, breaks over-long words and keeps blank lines', () => {
  const o = { text: 'one two three four five six seven', font: 'Helvetica', size: 12, cw: 60 }, lay = M.layoutText(o, fonts);
  assert.ok(lay.lines.length > 2 && lay.lines.every(l => l.width <= 60.5)); assert.equal(lay.lines.map(l => l.text).join(' '), o.text);
  const big = M.layoutText({ text: 'Supercalifragilisticexpialidocious', font: 'Courier', size: 12, cw: 40 }, fonts); assert.ok(big.lines.length > 3 && big.lines.every(l => l.width <= 40.5));
  assert.equal(M.layoutText({ text: 'a\n\nb', font: 'Times', size: 10, cw: 100 }, fonts).lines.length, 3);
  assert.equal(M.fontKey({ font: 'Times', bold: true, italic: true }), 'TimesRomanBoldItalic'); assert.equal(M.fontKey({ font: 'Nope' }), 'Helvetica');
  assert.throws(() => fonts.check('Helvetica', 'مرحبا')); assert.ok(fonts.check('Helvetica', 'Café €5\nline two'));
});

test('history: undo, redo, redo cleared by a new change, bounded', () => {
  const st = M.createState(), h = new M.History(3); st.pages.push({ id: 1 });
  h.record(st); st.pages.push({ id: 2 }); h.record(st); st.pages.push({ id: 3 });
  const a = h.undo(st); assert.equal(a.pages.length, 2); assert.ok(h.canRedo); const b = h.redo(a); assert.equal(b.pages.length, 3);
  h.undo(st); h.record(st); assert.ok(!h.canRedo); for (let i = 0; i < 10; i++) h.record(st); assert.equal(h.past.length, 3);
});

test('page operations: rotate, delete (with its objects), move, blank page, never delete every page', () => {
  const st = pagesOf('a', 4); st.objects.push({ id: 90, page: st.pages[1].id, type: 'note', x: 1, y: 1, text: '' }, { id: 91, page: st.pages[2].id, type: 'note', x: 1, y: 1, text: '' });
  st.pages = M.rotatePages(st.pages, [st.pages[0].id, st.pages[1].id], -90); assert.deepEqual(st.pages.map(p => p.rot), [270, 270, 0, 0]);
  M.deletePages(st, [st.pages[1].id]); assert.equal(st.pages.length, 3); assert.deepEqual(st.objects.map(o => o.id), [91]);
  st.pages = M.movePage(st.pages, st.pages[2].id, 0); assert.deepEqual(st.pages.map(p => p.idx), [3, 0, 2]);
  const b = M.blankPage(st, 0, [300, 400]); assert.ok(b.blank && st.pages[1] === b && b.view[2] === 300);
  assert.throws(() => M.deletePages(st, st.pages.map(p => p.id)));
});

test('export: in-place mode keeps untouched pages, honours delete + reorder + rotation, and the file re-opens', async () => {
  const bytes = await sample('A', 4), st = pagesOf('a', 4); st.pages[0].rot = 90;
  st.pages = M.movePage(st.pages, st.pages[3].id, 0); const gone = st.pages.pop();
  assert.ok(B.canEditInPlace(st.pages)); void gone;
  const out = await B.bakeDocument(PDFLib, { sources: { a: bytes }, pages: st.pages, objects: [], fonts });
  const doc = await PDFDocument.load(out, { updateMetadata: false }); assert.equal(doc.getPageCount(), 3);
  assert.deepEqual([await textOf(out, 0), await textOf(out, 1), await textOf(out, 2)], ['A PAGE 4', 'A PAGE 1', 'A PAGE 2']); assert.equal(doc.getPage(1).getRotation().angle, 90);
  assert.match(doc.getProducer(), /GoVibeTool PDF Editor/);
});

test('export: several sources, blank pages and extraction use copy mode; extraction only includes the chosen pages', async () => {
  const a = await sample('A', 3), b = await sample('B', 2, [792, 612]), st = pagesOf('a', 3);
  const bp = [0, 1].map(i => ({ id: M.uid(st), src: 'b', idx: i, rot: 0, baseRot: 0, view: [0, 0, 792, 612], blank: false })); st.pages.splice(1, 0, ...bp); M.blankPage(st, 0, [300, 300]);
  assert.ok(!B.canEditInPlace(st.pages));
  const out = await B.bakeDocument(PDFLib, { sources: { a, b }, pages: st.pages, objects: [], fonts }), doc = await PDFDocument.load(out);
  assert.equal(doc.getPageCount(), 6); assert.deepEqual(doc.getPage(1).getSize(), { width: 300, height: 300 }); assert.deepEqual(doc.getPage(2).getSize(), { width: 792, height: 612 });
  const only = await B.bakeDocument(PDFLib, { sources: { a, b }, pages: st.pages, objects: [], fonts, only: [st.pages[0].id, st.pages[5].id] }); assert.equal((await PDFDocument.load(only)).getPageCount(), 2);
  await assert.rejects(() => B.bakeDocument(PDFLib, { sources: { a }, pages: pagesOf('a', 2).pages, objects: [], fonts, only: [] }), /at least one page/);
});

test('export: every object type is written as vector content or a real annotation', async () => {
  const bytes = await sample('A', 1), st = pagesOf('a', 1), pid = st.pages[0].id, png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
  const objs = [
    { id: 1, page: pid, type: 'text', ox: 50, oy: 700, rot: 0, cw: 200, text: 'Hello €\nsecond line', font: 'Times', bold: true, italic: true, size: 16, color: '#112233', align: 'center' },
    { id: 2, page: pid, type: 'rect', ox: 50, oy: 600, rot: 10, cw: 80, ch: 40, stroke: '#ff0000', fill: '#00ff00', width: 2, opacity: 0.5 },
    { id: 3, page: pid, type: 'ellipse', ox: 150, oy: 600, rot: 0, cw: 80, ch: 40, stroke: '#0000ff', fill: null, width: 3 },
    { id: 4, page: pid, type: 'arrow', p1: [50, 500], p2: [150, 520], stroke: '#000000', width: 2 }, { id: 5, page: pid, type: 'line', p1: [50, 480], p2: [150, 480], stroke: '#000000', width: 1 },
    { id: 6, page: pid, type: 'draw', points: [[50, 400], [60, 410], [70, 400]], stroke: '#ff00ff', width: 3 }, { id: 7, page: pid, type: 'highlight', rects: [{ x: 40, y: 690, w: 100, h: 20 }], color: '#ffe14d' },
    { id: 8, page: pid, type: 'underline', rects: [{ x: 40, y: 690, w: 100, h: 20 }], color: '#ff0000' }, { id: 9, page: pid, type: 'strike', rects: [{ x: 40, y: 690, w: 100, h: 20 }], color: '#ff0000' },
    { id: 10, page: pid, type: 'note', x: 500, y: 700, text: 'Check this' }, { id: 11, page: pid, type: 'image', ox: 300, oy: 600, rot: 0, cw: 30, ch: 30, asset: 'i1', opacity: 1 },
  ];
  const out = await B.bakeDocument(PDFLib, { sources: { a: bytes }, pages: st.pages, objects: objs, assets: { i1: { bytes: new Uint8Array(png), mime: 'image/png' } }, fonts }), doc = await PDFDocument.load(out), page = doc.getPage(0);
  const annots = page.node.Annots(); assert.ok(annots instanceof PDFArray && annots.size() === 1); const an = doc.context.lookup(annots.get(0), PDFDict);
  assert.equal(String(an.get(PDFName.of('Subtype'))), '/Text'); assert.equal(an.get(PDFName.of('Contents')).decodeText(), 'Check this'); assert.ok(an.get(PDFName.of('AP')), 'comment must carry an appearance stream');
  assert.equal(page.node.Resources().lookup(PDFName.of('XObject'), PDFDict).keys().length, 1, 'image embedded once');
  await assert.rejects(() => B.bakeDocument(PDFLib, { sources: { a: bytes }, pages: st.pages, objects: [{ ...objs[0], text: '😀' }], fonts }), /encode/i);
});

test('text edit: standard WinAnsi fonts are edited in the content stream; subset, composite and embedded fonts are refused', async () => {
  const src = await sample('A', 2), loc = await T.locateRun(PDFLib, src, 1, 'A PAGE 2'); assert.ok(loc.editable); assert.match(loc.font, /Helvetica/);
  const out = await T.replaceRun(PDFLib, src, 1, 'A PAGE 2', 'Édité €50 (ok) \\ back'); assert.equal(await textOf(out, 1), 'Édité €50 (ok) \\ back'); assert.equal(await textOf(out, 0), 'A PAGE 1');
  await assert.rejects(() => T.replaceRun(PDFLib, src, 1, 'A PAGE 2', 'مرحبا'), e => e.code === 'unsupported-character');
  await assert.rejects(() => T.replaceRun(PDFLib, src, 0, 'MISSING', 'x'), e => e.code === 'not-found');
  const d = await PDFDocument.create(), p = d.addPage([300, 200]), ctx = d.context, F = (n, extra = {}) => ctx.register(ctx.obj({ Type: 'Font', Subtype: 'Type1', BaseFont: n, Encoding: 'WinAnsiEncoding', ...extra }));
  p.node.setFontDictionary(PDFName.of('F1'), F('Helvetica')); p.node.setFontDictionary(PDFName.of('F2'), F('ABCDEF+Calibri')); p.node.setFontDictionary(PDFName.of('F3'), ctx.register(ctx.obj({ Type: 'Font', Subtype: 'Type0', BaseFont: 'Arial', Encoding: 'Identity-H' })));
  p.node.setFontDictionary(PDFName.of('F4'), F('Courier', { Encoding: ctx.obj({ Type: 'Encoding', Differences: [65, 'B'] }) }));
  p.node.set(PDFName.of('Contents'), ctx.register(ctx.flateStream('BT /F1 12 Tf 10 150 Td (Hello \\(w\\) \\351) Tj 0 -14 Td [(Ker) -120 (ned)] TJ ET BT /F2 12 Tf 10 100 Td (Subset) Tj ET BT /F3 12 Tf 10 80 Td <00480065> Tj ET BT /F4 12 Tf 10 60 Td (Custom) Tj ET BT /F1 12 Tf 10 40 Td (Same) Tj 0 -12 Td (Same) Tj ET q 1 0 0 1 0 0 cm BI /W 1 /H 1 /BPC 8 /CS /G ID EI Q')));
  const hb = new Uint8Array(await d.save());
  for (const [text, ok, reason] of [['Hello (w) é', true], ['Kerned', true], ['Subset', false, 'subset-font'], ['Custom', false, 'custom-encoding']]) { const l = await T.locateRun(PDFLib, hb, 0, text); assert.equal(l.editable, ok, text); if (!ok) assert.equal(l.reason, reason); }
  const o2 = await T.replaceRun(PDFLib, hb, 0, 'Same', 'Second', 1); assert.equal((await textOf(o2, 0)).split('|').filter(x => x === 'Same' || x === 'Second').join(','), 'Same,Second');
  const chain = await T.applyEdits(PDFLib, hb, [{ page: 0, from: 'Kerned', to: 'Changed' }, { page: 0, from: 'Changed', to: 'Final' }]); assert.ok((await textOf(chain, 0)).includes('Final'));
});

test('tokenizer: strings with escapes, hex strings, arrays, comments and inline images', () => {
  const ops = T.showOps(new TextEncoder().encode('BT /F1 9 Tf (a\\(b\\)c\\101\\n) Tj <4142 43> Tj [(x) 10 (y)] TJ % (not text) Tj\n(z) \' ET BI /W 2 ID (\\x00) Tj EI (after) Tj'));
  assert.deepEqual(ops.map(o => String.fromCodePoint(...o.bytes)), ['a(b)cA\n', 'ABC', 'xy', 'z', 'after']);
});
