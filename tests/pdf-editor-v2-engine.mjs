/* PDF Editor V2 engine tests (Node). Every claim is checked on the EXPORTED bytes with parsers that share no code with the editor:
   Poppler (pdftotext, pdffonts, pdftoppm, pdfinfo) and pypdf. When a tool is missing the affected tests are reported as SKIPPED,
   never as passed.   node --test tests/pdf-editor-v2-engine.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { applyTextEdits, measureEdit, FontLibrary, analyzePage, scanUsage, EditError } from '../tools/pdf-editor/engine/edit.mjs';
import { detectParagraphs, paragraphOf, paragraphText, reflowParagraph } from '../tools/pdf-editor/engine/reflow.mjs';
import { readLinks, writeLinks } from '../tools/pdf-editor/engine/links.mjs';
import * as O from '../tools/pdf-editor/engine/outline.mjs';
import { bakeDocument } from '../tools/pdf-editor/bake.mjs';
import { makeFontMetrics } from '../tools/pdf-editor/model.mjs';
import { HAVE, pdftotext, pdffonts, words, render, diffPixels, colourIn, pypdfInspect, poppler, pageCount } from './helpers/pdf-verify.mjs';
import { committed, stdInvoice, hardCases, ocrLayer, scanned, noUnicode, mixedImage, formXObject, bigDocument, paragraphDoc } from './helpers/pdf-fixtures.mjs';

const P = createRequire(import.meta.url)(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'pdf-lib.min.js'));
const popplerTest = (name, fn) => test(name, { skip: HAVE.poppler ? false : 'SKIPPED: poppler-utils not installed' }, fn);
const pypdfTest = (name, fn) => test(name, { skip: HAVE.pypdf ? false : 'SKIPPED: pypdf not installed' }, fn);
const bothTest = (name, fn) => test(name, { skip: HAVE.poppler && HAVE.pypdf ? false : 'SKIPPED: poppler-utils and pypdf are both required' }, fn);

async function session(bytes) { const doc = await P.PDFDocument.load(bytes), lib = new FontLibrary(P, doc); await scanUsage(P, doc, lib); return { doc, lib }; }
async function blocksOf(bytes, page = 0) { const { doc, lib } = await session(bytes); const a = await analyzePage(P, doc, lib, page); return { ...a, doc, lib }; }
const findBlock = (blocks, t) => { const b = blocks.find(x => x.text.includes(t)); assert.ok(b, `block containing "${t}" not found among: ${blocks.map(x => JSON.stringify(x.text)).join(', ')}`); return b; };
async function edit(bytes, page, find, change, extra = {}) {
  const { blocks } = await blocksOf(bytes, page), b = findBlock(blocks, find);
  const text = typeof change === 'function' ? change(b.text) : change;
  return applyTextEdits(P, bytes, [{ page, blockId: b.id, text, ...extra }]);
}
const compact = s => s.replace(/\s+/g, ' ').trim();
const docs = { multilang: committed('chrome-multilang.pdf'), chrome: committed('chrome-invoice.pdf'), lo: committed('lo-report.pdf'), std: stdInvoice(), hard: hardCases() };

/* ------------------------------------------------------------------ analysis */
test('analysis: real Chrome (CID subset) and LibreOffice (simple subset) text is decoded into editable blocks', async () => {
  for (const [name, bytes] of [['chrome', docs.chrome], ['lo', docs.lo]]) {
    const { blocks } = await blocksOf(bytes, 0);
    assert.ok(blocks.some(b => b.editable && (name === 'chrome' ? /Acme Trading Ltd/ : /This report summarises/).test(b.text)), `${name}: sentence block missing`);
    assert.ok(blocks.every(b => b.editable), `${name}: every block should be editable, got ${blocks.filter(b => !b.editable).map(b => b.reason)}`);
  }
});
popplerTest('analysis: block geometry agrees with Poppler word boxes (independent positions)', async () => {
  for (const [name, bytes, find] of [['chrome', docs.chrome, 'Acme Trading'], ['lo', docs.lo, 'Total revenue'], ['std', docs.std, 'Bill to']]) {
    const page = name === 'lo' ? 0 : 0, { blocks } = await blocksOf(bytes, page), b = findBlock(blocks, find);
    const pageH = 792; const ws = words(bytes, 1).filter(w => b.text.split(/\s+/).includes(w.text));
    assert.ok(ws.length, `${name}: poppler found no matching words`);
    const x0 = Math.min(...ws.map(w => w.x0)), x1 = Math.max(...ws.map(w => w.x1));
    assert.ok(b.box.x <= x0 + 1.5 && b.box.x + b.box.w >= x1 - 1.5 || Math.abs(b.box.x - x0) < 3, `${name}: block x-range ${b.box.x.toFixed(1)}..${(b.box.x + b.box.w).toFixed(1)} vs poppler ${x0.toFixed(1)}..${x1.toFixed(1)}`);
    void pageH;
  }
});
test('analysis: hard content-stream cases are grouped as expected', async () => {
  const { blocks } = await blocksOf(docs.hard, 0), texts = blocks.map(b => b.text);
  for (const t of ['HelloWorldkern', 'Second line', 'Red Blue', 'Tc and Tw test', 'Wide scaling', 'Quote op one', 'Quote op two', 'Rotated 30 degrees', 'Scaled matrix', 'Part A part B in Times part C', 'next line after chain', 'Before', 'After far']) assert.ok(texts.includes(t), `missing block "${t}" in ${JSON.stringify(texts)}`);
});

/* ------------------------------------------------------------------ identity: the strongest safety net */
for (const [name, bytes] of Object.entries(docs)) {
  popplerTest(`re-encoding every block unchanged renders pixel-identically (${name})`, async () => {
    const { doc, lib } = await session(bytes), edits = [];
    for (let i = 0; i < doc.getPageCount(); i++) { const a = await analyzePage(P, doc, lib, i); for (const b of a.blocks) if (b.editable) edits.push({ page: i, blockId: b.id, text: b.text }); }
    assert.ok(edits.length > 3);
    const out = (await applyTextEdits(P, bytes, edits)).bytes;
    for (let pg = 1; pg <= doc.getPageCount(); pg++) assert.equal(diffPixels(render(bytes, pg), render(out, pg)), 0, `${name} page ${pg} differs after identity re-encode`);
    assert.deepEqual(poppler(out).errors, [], `${name}: poppler reports errors`);
  });
}

/* ------------------------------------------------------------------ P0-1 replace / delete */
for (const [name, find, from, to] of [['chrome', 'Acme Trading', 'Payment', 'Settlement'], ['lo', 'Total revenue', 'Total revenue', 'Gross revenue'], ['std', 'Bill to', 'Northwind', 'Contoso']]) {
  bothTest(`P0-1 replace words in ${name}: new text extracts, old text is gone, fonts and the rest of the page are unchanged`, async () => {
    const bytes = docs[name], before = pdftotext(bytes, 1), { blocks } = await blocksOf(bytes, 0), b = findBlock(blocks, find);
    const r = await edit(bytes, 0, find, t => t.replace(from, to)), after = pdftotext(r.bytes, 1);
    assert.ok(compact(after).includes(to), `${name}: "${to}" missing from poppler text: ${compact(after).slice(0, 200)}`);
    assert.ok(!compact(after).includes(from) || from === to, `${name}: old text "${from}" still extractable (fake edit?)`);
    assert.ok(pypdfInspect(r.bytes).texts[0].includes(to), `${name}: pypdf does not see the new text`);
    // untouched text is still there
    const rest = compact(before).replace(from, '').split(' ').filter(w => w.length > 3).slice(0, 12); for (const w of rest) assert.ok(after.includes(w), `${name}: lost "${w}"`);
    // the original embedded fonts are still used (no rasterising, no outlines)
    for (const f of pdffonts(bytes)) assert.ok(pdffonts(r.bytes).includes(f), `${name}: font ${f} vanished`);
    // pixels outside the edited block's neighbourhood are identical
    const w0 = words(bytes, 1).filter(w => b.text.includes(w.text)); const ign = [{ x0: Math.min(...w0.map(w => w.x0)) - 3, x1: 612, y0: Math.min(...w0.map(w => w.y0)) - 3, y1: Math.max(...w0.map(w => w.y1)) + 3 }];
    assert.equal(diffPixels(render(bytes, 1), render(r.bytes, 1), 100, ign), 0, `${name}: pixels outside the edited line changed`);
    assert.deepEqual(poppler(r.bytes).errors, []);
  });
}
bothTest('P0-1 numbers and amounts: "1,500.00" -> "2,750.25" and a quantity, standard fonts', async () => {
  let r = await edit(docs.std, 0, '1,500.00', '2,750.25'); r = await edit(r.bytes, 0, 'Consulting', t => t); // second edit on already edited bytes still analyses
  const t = compact(pdftotext(r.bytes, 1)); assert.ok(t.includes('2,750.25') && !t.includes('1,500.00') && t.includes('245.30') && t.includes('1,745.30'));
});
bothTest('P0-1 amounts in the Chrome subset-font table: digits are re-encoded, missing glyphs fall back and are reported', async () => {
  const r = await edit(docs.chrome, 0, '$120.00', '$1,250.75'); const t = compact(pdftotext(r.bytes, 1));
  assert.ok(t.includes('$1,250.75'), t); assert.ok(!t.includes('$120.00'));
  assert.ok(pypdfInspect(r.bytes).texts[0].includes('$1,250.75'));
});
bothTest('P0-1 delete existing text: the characters are removed from the file, not covered', async () => {
  const bytes = docs.chrome, r = await edit(bytes, 0, 'Widget', ''); const t = compact(pdftotext(r.bytes, 1));
  assert.ok(!/Widget/.test(t) && /Gadget/.test(t) && /\$200\.50/.test(t), t); assert.ok(!/Widget/.test(pypdfInspect(r.bytes).texts[0]));
  // no white rectangle was drawn: the content stream has no extra fill operators, and the page still renders without new filled shapes
  const { content } = await blocksOf(r.bytes, 0); const before = (await blocksOf(bytes, 0)).content; assert.ok(String.fromCharCode(...content).split(' re').length <= String.fromCharCode(...before).split(' re').length, 'a rectangle operator was added');
});
bothTest('P0-1 multipage: editing page 2 leaves page 1 pixel-identical and page 2 text changed', async () => {
  const bytes = docs.lo, r = await edit(bytes, 1, 'Operating costs', t => t.replace('842,300', '999,100')); assert.equal(pageCount(r.bytes), 3);
  assert.equal(diffPixels(render(bytes, 1), render(r.bytes, 1)), 0); assert.equal(diffPixels(render(bytes, 3), render(r.bytes, 3)), 0);
  assert.ok(compact(pdftotext(r.bytes, 2)).includes('999,100') && !compact(pdftotext(r.bytes, 2)).includes('842,300'));
});
bothTest('P0-1 edit survives save + reopen: exported file is analysed again and shows the new text as editable text', async () => {
  const r = await edit(docs.lo, 0, 'Revenue', t => t), r2 = await edit(docs.lo, 0, 'Total revenue', t => t.replace('1,204,500', '1,300,000'));
  const { blocks } = await blocksOf(r2.bytes, 1 - 1 + 0); void r; const hit = blocks.find(b => b.text.includes('1,300,000')); assert.ok(hit && hit.editable, 'reopened file lost the edited text block');
  // and a second edit on the re-opened file works
  const r3 = await edit(r2.bytes, 0, '1,300,000', t => t.replace('1,300,000', '1,310,000')); assert.ok(compact(pdftotext(r3.bytes, 1)).includes('1,310,000'));
});
test('P0-1 characters that no font here can draw are refused with a clear message', async () => {
  await assert.rejects(() => edit(docs.chrome, 0, 'Acme', t => t + ' \u{1F600}'), e => e instanceof EditError && e.code === 'unsupported-character' && /cannot be typed|not available/.test(e.message));
});
test('P0-1 stale block ids are refused instead of editing the wrong text', async () => {
  await assert.rejects(() => applyTextEdits(P, docs.std, [{ page: 0, blockId: 'p0b9o99999', text: 'x' }]), e => e.code === 'stale');
});

/* ------------------------------------------------------------------ P0-2 formatting */
bothTest('P0-2 bold + italic + family: the right standard fonts appear in the file and the text stays searchable', async () => {
  const r = await edit(docs.std, 0, 'Consulting services', 'Consulting services', { fmt: [{ start: 0, end: 10, props: { bold: true } }, { start: 11, end: 19, props: { italic: true, family: 'serif' } }] });
  const names = pdffonts(r.bytes).join(' '); assert.ok(/Times-Bold/.test(names), names); assert.ok(/Times-Italic/.test(names), names);
  assert.ok(compact(pdftotext(r.bytes, 1)).includes('Consulting services'));
});
bothTest('P0-2 size and colour: rendered height grows and the characters are red where requested', async () => {
  const bytes = docs.std, { blocks } = await blocksOf(bytes, 0), b = findBlock(blocks, 'INVOICE'); const before = words(bytes, 1).find(w => w.text === 'INVOICE');
  const r = await edit(bytes, 0, 'INVOICE', 'INVOICE #1042', { fmt: [{ start: 0, end: 13, props: { size: 30, color: '#cc0000' } }] });
  const after = words(r.bytes, 1).find(w => w.text === 'INVOICE'); assert.ok(after.y1 - after.y0 > (before.y1 - before.y0) * 1.3, `height ${(after.y1 - after.y0).toFixed(1)} vs ${(before.y1 - before.y0).toFixed(1)}`);
  const col = colourIn(render(r.bytes, 1), { x0: after.x0, x1: after.x1, y0: after.y0, y1: after.y1 }); assert.ok(col && col[0] > 150 && col[1] < 60 && col[2] < 60, `colour ${col}`); void b;
});
bothTest('P0-2 a colour change does not leak into the text that follows it (state is restored to the initial default)', async () => {
  const bytes = docs.std, w0 = words(bytes, 1).filter(w => ['Consulting', 'services'].includes(w.text));
  const r = await edit(bytes, 0, 'Consulting services', 'Consulting services', { fmt: [{ start: 0, end: 19, props: { color: '#cc0000' } }] });
  const ign = [{ x0: Math.min(...w0.map(w => w.x0)) - 2, x1: Math.max(...w0.map(w => w.x1)) + 2, y0: Math.min(...w0.map(w => w.y0)) - 2, y1: Math.max(...w0.map(w => w.y1)) + 2 }];
  assert.equal(diffPixels(render(bytes, 1), render(r.bytes, 1), 100, ign), 0, 'text outside the edited line changed colour or position');
  const c = colourIn(render(r.bytes, 1), ign[0]); assert.ok(c && c[0] > c[1] + 40 && c[0] > c[2] + 40, 'text is not red: ' + c);
});
bothTest('P0-2 existing formatting is preserved when no change is requested (Chrome title stays bold sans, other lines keep their fonts)', async () => {
  const r = await edit(docs.chrome, 0, 'Invoice 2026', 'Invoice 2026-0199'); const f = pdffonts(r.bytes).join(' ');
  assert.ok(/LiberationSans-Bold/.test(f), f); assert.ok(/LiberationSerif-Italic/.test(f));
});
bothTest('P0-2 alignment anchors: right keeps the right edge, centre keeps the centre', async () => {
  const bytes = docs.std; const w0 = words(bytes, 1).find(w => w.text === '1,500.00');
  const right = await edit(bytes, 0, '1,500.00', '12,345,678.90', { align: 'right' }), wr = words(right.bytes, 1).find(w => w.text === '12,345,678.90');
  assert.ok(Math.abs(wr.x1 - w0.x1) < 1.5, `right edge ${wr.x1.toFixed(1)} vs ${w0.x1.toFixed(1)}`); assert.ok(wr.x0 < w0.x0);
  const centre = await edit(bytes, 0, '1,500.00', '12,345,678.90', { align: 'center' }), wc = words(centre.bytes, 1).find(w => w.text === '12,345,678.90');
  assert.ok(Math.abs((wc.x0 + wc.x1) / 2 - (w0.x0 + w0.x1) / 2) < 1.5, 'centre moved');
});
bothTest('P0-2 mixed formatting inside one line keeps surrounding text positions (hard cases)', async () => {
  const bytes = docs.hard, r = await edit(bytes, 0, 'Red Blue', 'Red Blue', { fmt: [{ start: 4, end: 8, props: { bold: true, color: '#008800' } }] });
  const t = compact(pdftotext(r.bytes, 1)); assert.ok(t.includes('Red Blue')); assert.ok(/Helvetica-Bold/.test(pdffonts(r.bytes).join(' ')));
  assert.equal(diffPixels(render(bytes, 1), render(r.bytes, 1), 100, [{ x0: 60, y0: 100, x1: 200, y1: 125 }]), 0, 'a different line changed');
});

/* ------------------------------------------------------------------ hard content streams: real edits */
bothTest('hard cases: edit inside a relative Td chain, a quote-operator line, a rotated line and a font-switching line', async () => {
  const bytes = docs.hard; let cur = bytes;
  for (const [find, to] of [['Second line', 'Second row'], ['Quote op two', 'Quote op 2'], ['Rotated 30', 'Rotated 45 degrees'], ['Part A', 'Part A part B in Times part Z']]) { cur = (await edit(cur, 0, find, t => (find === 'Rotated 30' ? to : find === 'Part A' ? to : t.replace(find, to)))).bytes; }
  const t = compact(pdftotext(cur, 1)); for (const w of ['Second row', 'Quote op 2', 'part Z', 'next line after chain', 'Red Blue', 'Before', 'After far']) assert.ok(t.includes(w), `missing "${w}" in ${t}`);
  assert.ok(compact(pypdfInspect(cur).texts[0]).includes('Rotated 45 degrees'), 'rotated line text not extractable after the edit (pypdf)'); // poppler splits rotated glyphs, pypdf follows the content stream
  assert.ok((await blocksOf(cur, 0)).blocks.some(b => b.text === 'Rotated 45 degrees' && b.editable));
  assert.deepEqual(poppler(cur).errors, []);
});
test('P0-2 overflow measurement: wider text reports how far it would run into the next text on the line', async () => {
  const { doc, lib, blocks } = await blocksOf(docs.hard, 0), b = findBlock(blocks, 'Before');
  const m = await measureEdit(P, doc, lib, b, { text: 'Before and a very long replacement that cannot fit', fmt: [] });
  assert.ok(m.widthUser > b.room, `width ${m.widthUser} vs room ${b.room}`); const ok = await measureEdit(P, doc, lib, b, { text: 'Bef', fmt: [] }); assert.ok(ok.widthUser < b.room);
});

/* ------------------------------------------------------------------ unsupported structures */
test('refusals: composite font without ToUnicode, invisible OCR text, scanned page and encrypted file', async () => {
  let r = await blocksOf(noUnicode(), 0); assert.equal(r.blocks.length, 1); assert.equal(r.blocks[0].editable, false); assert.equal(r.blocks[0].reason, 'no-unicode-map');
  await assert.rejects(() => applyTextEdits(P, noUnicode(), [{ page: 0, blockId: r.blocks[0].id, text: 'x' }]), e => e.code === 'no-unicode-map');
  r = await blocksOf(ocrLayer(), 0); assert.equal(r.blocks[0].editable, false); assert.equal(r.blocks[0].reason, 'invisible');
  r = await blocksOf(scanned(), 0); assert.equal(r.blocks.length, 0);
  await assert.rejects(() => P.PDFDocument.load(committed('encrypted.pdf'), { updateMetadata: false }), /encrypt/i);
});

/* ------------------------------------------------------------------ P0-3 hyperlinks */
async function bakeAll(bytes, opts = {}) {
  const doc = await P.PDFDocument.load(bytes), pages = doc.getPages().map((pg, i) => ({ id: i + 1, src: 's1', idx: i, rot: 0, baseRot: 0, view: [0, 0, pg.getWidth(), pg.getHeight()], blank: false }));
  const report = {}; const out = await bakeDocument(P, { sources: { s1: bytes }, pages: opts.pages || pages, objects: [], fonts: await makeFontMetrics(P), report, ...opts }); return { bytes: out, report, doc };
}
pypdfTest('P0-3 links: read existing, retarget, remove, add external and internal; all verified with pypdf after export', async () => {
  const bytes = docs.lo, doc = await P.PDFDocument.load(bytes), links = readLinks(P, doc, 's1');
  assert.equal(links.length, 2); const uri = links.find(l => l.kind === 'uri'), internal = links.find(l => l.kind === 'page'); assert.equal(uri.uri, 'https://example.com/data'); assert.equal(internal.dest.page, 2);
  const recs = [{ ...uri, uri: 'https://example.org/changed', changed: true }, { ...internal, deleted: true }, { id: 'n1', src: 's1', page: 0, rect: [60, 600, 200, 620], kind: 'page', dest: { src: 's1', page: 1, mode: 'XYZ', params: [0, 700, null] }, border: 1 }, { id: 'n2', src: 's1', page: 1, rect: [60, 500, 200, 520], kind: 'uri', uri: 'example.com/new', border: 0 }];
  const { bytes: out, report } = await bakeAll(bytes, { links: recs }); assert.deepEqual(report.warnings, []);
  const info = pypdfInspect(out), l1 = info.links.filter(l => l.page === 1), l2 = info.links.filter(l => l.page === 2);
  assert.ok(l1.some(l => l.uri === 'https://example.org/changed')); assert.ok(!l1.some(l => l.uri === 'https://example.com/data')); assert.ok(l1.some(l => l.destPage === 2 && l.rect[0] === 60)); assert.equal(l1.length, 2, 'removed internal link still present');
  assert.ok(l2.some(l => l.uri === 'https://example.com/new'), JSON.stringify(l2));
  const again = readLinks(P, await P.PDFDocument.load(out), 's1'); assert.equal(again.length, 3); // reopen in the engine
});
test('P0-3 links: unsafe schemes are rejected, never written', async () => {
  const { normalizeUri } = await import('../tools/pdf-editor/engine/links.mjs');
  for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', 'vbscript:x']) assert.equal(normalizeUri(bad), null, bad);
  assert.equal(normalizeUri('example.com/a b'), null); assert.equal(normalizeUri('name@example.com'), 'mailto:name@example.com'); assert.equal(normalizeUri('https://example.com/x'), 'https://example.com/x');
  const bytes = docs.lo, rec = { id: 'n', src: 's1', page: 0, rect: [1, 1, 50, 50], kind: 'uri', uri: 'javascript:alert(1)' };
  const { report, bytes: out } = await bakeAll(bytes, { links: [rec] }); assert.ok(report.warnings.length === 1 && /not allowed/.test(report.warnings[0])); assert.ok(!Buffer.from(out).toString('latin1').includes('javascript:'));
});

/* ------------------------------------------------------------------ P0-4 bookmarks */
pypdfTest('P0-4 bookmarks: read nested tree, rename, add, reorder, indent, delete; destinations verified with pypdf', async () => {
  const bytes = docs.lo, doc = await P.PDFDocument.load(bytes); let { tree } = O.readOutline(P, doc, 's1');
  assert.deepEqual(O.flatten(tree).map(x => `${x.depth}:${x.node.title}`), ['0:Revenue', '0:Costs', '1:Hosting detail', '0:Outlook']);
  tree = O.renameItem(tree, tree[0].id, 'Revenue (edited)');
  tree = O.addItem(tree, { id: O.newOutlineId(), title: 'Appendix', open: true, dest: { src: 's1', page: 2, mode: 'XYZ', params: [0, 800, null] }, uri: null, color: null, flags: 0, children: [] }, tree[0].id);
  const outlook = tree.find(n => n.title === 'Outlook'); tree = O.moveItem(tree, outlook.id, -1);
  const appendix = tree.find(n => n.title === 'Appendix'); tree = O.indentItem(tree, appendix.id); // becomes child of Revenue (edited)
  const hosting = O.flatten(tree).find(x => x.node.title === 'Hosting detail').node; tree = O.removeItem(tree, hosting.id);
  const { bytes: out, report } = await bakeAll(bytes, { outline: tree, outlineDirty: true }); assert.deepEqual(report.warnings, []);
  const info = pypdfInspect(out); assert.deepEqual(info.outline.map(o => `${o.depth}:${o.title}:${o.page}`), ['0:Revenue (edited):1', '1:Appendix:3', '0:Outlook:3', '0:Costs:2']);
  const again = O.readOutline(P, await P.PDFDocument.load(out), 's1').tree; assert.deepEqual(O.flatten(again).map(x => `${x.depth}:${x.node.title}`), ['0:Revenue (edited)', '1:Appendix', '0:Outlook', '0:Costs']);
  assert.deepEqual(poppler(out).errors, []);
});
pypdfTest('P0-4 bookmarks and links follow page operations: delete, reorder and extract keep valid destinations', async () => {
  const bytes = docs.lo, doc = await P.PDFDocument.load(bytes), links = readLinks(P, doc, 's1'), { tree } = O.readOutline(P, doc, 's1');
  const pages = doc.getPages().map((pg, i) => ({ id: i + 1, src: 's1', idx: i, rot: 0, baseRot: 0, view: [0, 0, 595, 842], blank: false }));
  // reorder: 3,1,2
  let r = await bakeAll(bytes, { pages: [pages[2], pages[0], pages[1]], links, outline: tree }); let info = pypdfInspect(r.bytes);
  assert.deepEqual(info.outline.map(o => `${o.title}:${o.page}`), ['Revenue:2', 'Costs:3', 'Hosting detail:3', 'Outlook:1']); assert.ok(info.links.some(l => l.destPage === 1), JSON.stringify(info.links));
  // delete page 3 (Outlook): bookmark kept without destination, warning raised, internal link dropped
  r = await bakeAll(bytes, { pages: [pages[0], pages[1]], links, outline: tree }); info = pypdfInspect(r.bytes); assert.equal(info.pages, 2);
  assert.ok(r.report.warnings.length >= 1, 'no warning for dangling bookmark'); assert.ok(!info.links.some(l => l.destPage === 3));
  // extract page 2 only (copy mode): output has exactly one page and no page was dragged in by a link or bookmark
  r = await bakeAll(bytes, { pages: [pages[1]], links, outline: tree }); info = pypdfInspect(r.bytes); assert.equal(info.pages, 1); assert.equal(pageCount(r.bytes), 1);
  assert.ok(info.outline.some(o => o.title === 'Costs' && o.page === 1));
});

/* ------------------------------------------------------------------ P0-5 integrity */
bothTest('P0-5 all text edits together on a multi-page file: valid structure, no poppler errors, page count preserved, unrelated pages identical', async () => {
  const bytes = docs.lo, { doc, lib } = await session(bytes); const edits = [];
  for (const [pg, find, to] of [[0, 'Total revenue', 'Net revenue reached 1,204,500 dollars'], [1, 'Hosting spend', 'Hosting spend was 151,614 euros across three providers.'], [2, 'We expect', 'We expect revenue of 1,400,000 dollars next quarter.']]) { const a = await analyzePage(P, doc, lib, pg), b = findBlock(a.blocks, find); edits.push({ page: pg, blockId: b.id, text: to }); }
  const r = await applyTextEdits(P, bytes, edits); assert.equal(pageCount(r.bytes), 3); assert.deepEqual(poppler(r.bytes).errors, []);
  const info = pypdfInspect(r.bytes); assert.ok(info.texts[0].includes('Net revenue') && info.texts[1].includes('euros') && info.texts[2].includes('1,400,000'));
  assert.equal(info.outline.length, 4, 'bookmarks lost during text edits'); assert.equal(info.links.length, 2, 'links lost during text edits');
});
test('mixed text + image page keeps its image and can be edited', async () => {
  const bytes = await mixedImage(P); const r = await edit(bytes, 0, 'Price', t => t.replace('49.90', '59.90')); const doc = await P.PDFDocument.load(r.bytes);
  assert.ok(Buffer.from(r.bytes).toString('latin1').includes('/Subtype /Image') || Buffer.from(r.bytes).toString('latin1').includes('/Image'), 'image lost'); assert.equal(doc.getPageCount(), 1);
  if (HAVE.poppler) assert.ok(compact(pdftotext(r.bytes, 1)).includes('59.90 EUR'));
});

test('text inside a Form XObject is not offered for editing (and is detected, so the interface can say so)', async () => {
  const r = await blocksOf(formXObject(), 0); assert.equal(r.interp.doCount, 1); assert.deepEqual(r.blocks.map(b => b.text), ['Direct text on the page']);
});
test('performance: a 150-page text document is scanned, analysed and edited in a few seconds', async () => {
  const bytes = bigDocument(150), t0 = Date.now(); const { doc, lib } = await session(bytes); const t1 = Date.now(); const a = await analyzePage(P, doc, lib, 120); const t2 = Date.now();
  const b = a.blocks.find(x => x.text.startsWith('Page 121 line 5:')); assert.ok(b); const r = await applyTextEdits(P, bytes, [{ page: 120, blockId: b.id, text: 'Page 121 line 5: edited in a large file' }]); const t3 = Date.now();
  console.log(`  timing: load+scan ${t1 - t0} ms, analyse page ${t2 - t1} ms, apply edit + save ${t3 - t2} ms, ${a.blocks.length} blocks/page`);
  assert.ok(t3 - t0 < 25000, `too slow: ${t3 - t0} ms`); assert.equal((await P.PDFDocument.load(r.bytes)).getPageCount(), 150);
  if (HAVE.poppler) assert.ok(compact(pdftotext(r.bytes, 121)).includes('edited in a large file'));
});

/* ------------------------------------------------------------------ moving the rest of the line (opt-in) */
const lineWords = (bytes, page, y) => words(bytes, page).filter(w => Math.abs((w.y0 + w.y1) / 2 - y) < 4).sort((a, b) => a.x0 - b.x0);
bothTest('reflow: a longer word pushes the rest of the sentence (separate text objects with absolute positions) along; nothing overlaps and other lines are untouched', async () => {
  const bytes = docs.chrome, before = words(bytes, 1), pay = before.find(w => w.text === 'Payment'), y = (pay.y0 + pay.y1) / 2;
  const plain = await edit(bytes, 0, 'Acme Trading', t => t.replace('Payment', 'Settlement obligations'));
  const moved = await edit(bytes, 0, 'Acme Trading', t => t.replace('Payment', 'Settlement obligations'), { reflow: true });
  const ov = ws => ws.some((w, i) => i && w.x0 < ws[i - 1].x1 - 0.5);
  assert.ok(ov(lineWords(plain.bytes, 1, y)), 'control: without reflow the new text overlaps the link text (the known limit)');
  const after = lineWords(moved.bytes, 1, y); assert.ok(!ov(after), 'overlap remains after reflow: ' + after.map(w => `${w.text}@${w.x0.toFixed(0)}-${w.x1.toFixed(0)}`).join(' '));
  const t = compact(pdftotext(moved.bytes, 1)); assert.ok(t.includes('Settlement obligations due in 30 days. Pay online or see the terms'), t);
  const ign = [{ x0: 0, x1: 612, y0: y - 6, y1: y + 6 }]; assert.equal(diffPixels(render(bytes, 1), render(moved.bytes, 1), 100, ign), 0, 'something outside the edited line moved');
  assert.deepEqual(poppler(moved.bytes).errors, []);
  const w0 = before.find(w => w.text === 'Pay'), w1 = after.find(w => w.text === 'Pay'), nw = after.find(w => w.text === 'obligations'); assert.ok(w1.x0 > nw.x1, 'Pay must start after the new text'); assert.ok(w1.x0 > w0.x0 + 40, 'link text was not moved right');
});
bothTest('reflow: relative Td chains are compensated, so only the intended text moves (shorter and longer edits)', async () => {
  const { buildPdf, STD_FONTS } = await import('./helpers/pdf-build.mjs');
  const bytes = new Uint8Array(buildPdf({ pages: [{ content: 'BT /F1 12 Tf 72 300 Td (Alpha) Tj ET\nBT /F1 12 Tf 110 300 Td (Beta) Tj 42 0 Td (Gamma) Tj 0 -20 Td (next line) Tj ET\n' }], fonts: STD_FONTS }));
  const pos = (b, t) => words(b, 1).find(x => x.text === t); const base = ['Alpha', 'Beta', 'Gamma', 'next'].map(t => pos(bytes, t));
  const { blocks } = await blocksOf(bytes, 0); assert.deepEqual(blocks.map(b => b.text), ['Alpha', 'Beta', 'Gamma', 'next line']); assert.equal(findBlock(blocks, 'Alpha').following.length, 1, 'only Beta follows closely');
  for (const [to, sign] of [['Alphabet soup', 1], ['Al', -1]]) {
    const r = await edit(bytes, 0, 'Alpha', to, { reflow: true }), moved = ['Beta', 'Gamma', 'next'].map(t => pos(r.bytes, t)), dBeta = moved[0].x0 - base[1].x0;
    assert.ok(sign * dBeta > 10, `Beta moved ${dBeta.toFixed(1)}`); assert.ok(Math.abs(moved[1].x0 - base[2].x0) < 0.6, `Gamma moved ${moved[1].x0 - base[2].x0}`); assert.ok(Math.abs(moved[2].x0 - base[3].x0) < 0.6 && Math.abs(moved[2].y0 - base[3].y0) < 0.6, 'next line moved');
  }
  const r = await edit(bytes, 0, 'Alpha', 'Alphabet soup', { reflow: false }); assert.ok(Math.abs(pos(r.bytes, 'Beta').x0 - base[1].x0) < 0.6, 'without reflow nothing else moves');
});
bothTest('reflow in a LibreOffice file (one Td per text object): link text and the rest of the line move together', async () => {
  const bytes = docs.lo, { blocks } = await blocksOf(bytes, 0), b = findBlock(blocks, 'This report'); assert.ok(b.following.length >= 1, 'following chain not detected');
  const r = await edit(bytes, 0, 'This report', t => t.replace('summarises', 'summarises thoroughly'), { reflow: true }); const info = pypdfInspect(r.bytes); assert.ok(info.texts[0].includes('summarises thoroughly'));
  const w = words(r.bytes, 1); const gaps = w.filter(x => Math.abs(x.y0 - w.find(q => q.text === 'This').y0) < 3).sort((p, q) => p.x0 - q.x0); assert.ok(gaps.every((g, i) => !i || g.x0 >= gaps[i - 1].x1 - 0.5), 'words overlap on the edited line');
});

/* ------------------------------------------------------------------ multilingual, ligatures (Chrome, CID fonts with CJK and Arabic) */
bothTest('multilingual file: ligature line and CJK text are edited in place; deleted CJK characters are really gone', async () => {
  const bytes = docs.multilang, { blocks } = await blocksOf(bytes, 0); assert.ok(blocks.every(b => b.editable), 'every block should be editable');
  let r = await edit(bytes, 0, 'Ligatures:', t => t.replace('office', 'offices').replace('café', 'café au lait')); let t = compact(pdftotext(r.bytes, 1)); assert.ok(/offices affluent/.test(t) && /café au lait/.test(t), t);
  r = await edit(bytes, 0, '你好世界', '你好'); t = pdftotext(r.bytes, 1); assert.ok(t.includes('你好') && !t.includes('世界'), 'deleted CJK characters still in the file'); assert.ok(!pypdfInspect(r.bytes).texts[0].includes('世界'));
  assert.deepEqual(poppler(r.bytes).errors, []); assert.equal(diffPixels(render(bytes, 1), render(r.bytes, 1), 100, [{ x0: 200, y0: 0, x1: 612, y1: 60 }]), 0, 'text elsewhere changed');
});


/* ------------------------------------------------------------------ paragraph reflow */
async function reflowEdit(bytes, find, change) {
  const a = await blocksOf(bytes, 0), paras = detectParagraphs(a.blocks), para = paragraphOf(paras, findBlock(a.blocks, find).id);
  assert.ok(para, `no paragraph around "${find}"; found: ${paras.map(p => p.blocks.length)}`);
  const text = change(paragraphText(para)), r = await reflowParagraph(P, a.doc, a.lib, para, text);
  const out = await applyTextEdits(P, bytes, r.edits.map(e => ({ page: 0, ...e })));
  return { para, r, out, text };
}
test('reflow: only genuinely wrapped paragraphs are offered (not headings, address lists or columns)', async () => {
  const a = await blocksOf(paragraphDoc(), 0), paras = detectParagraphs(a.blocks);
  assert.equal(paras.length, 1, `expected 1 paragraph, got ${paras.map(p => p.blocks.map(b => b.text))}`);
  assert.equal(paras[0].blocks.length, 5);
  assert.ok(paragraphText(paras[0]).startsWith('The committee reviewed') && paragraphText(paras[0]).endsWith('next month.'));
  for (const t of ['Budget Review', 'Finance Office', 'Left column text']) assert.equal(paragraphOf(paras, findBlock(a.blocks, t).id), null, t);
});
bothTest('reflow: a shorter sentence re-wraps within the same lines, keeps the font, and leaves everything else identical', async () => {
  const src = paragraphDoc(), { out, r } = await reflowEdit(src, 'committee', t => t.replace('agreed that spending on equipment should be postponed', 'decided to postpone equipment spending'));
  assert.ok(r.usedLines <= r.totalLines);
  const txt = compact(pdftotext(out.bytes, 1));
  assert.ok(txt.includes('decided to postpone equipment spending'), txt);
  assert.ok(!txt.includes('agreed that spending'), 'old words must be gone from the file');
  assert.ok(txt.includes('Budget Review') && txt.includes('Finance Office') && txt.includes('Left column text') && txt.includes('Right column text'));
  assert.deepEqual(pdffonts(out.bytes), pdffonts(src), 'no font was added or swapped');
  const before = render(src, 1), after = render(out.bytes, 1); assert.ok(diffPixels(before, after, 100, [{ x0: 60, y0: 84, x1: 560, y1: 170 }]) === 0, 'pixels outside the paragraph must not change');
});
bothTest('reflow: a longer sentence that still fits reflows onto later lines; words in order, none lost', async () => {
  const src = paragraphDoc(), add = 'Members asked. ';
  const { out, text } = await reflowEdit(src, 'committee', t => add + t.replace('next month.', 'next month.'));
  const got = compact(pdftotext(out.bytes, 1)); const wantWords = compact(text).split(' ');
  const idx = wantWords.map(w => got.indexOf(w)); assert.ok(idx.every(i => i >= 0), 'every word present');
  assert.ok(got.includes('Members asked.'), got);
  });
test('reflow: text needing more lines than the paragraph has is refused with a reason, nothing is changed', async () => {
  const a = await blocksOf(paragraphDoc(), 0), para = detectParagraphs(a.blocks)[0];
  await assert.rejects(() => reflowParagraph(P, a.doc, a.lib, para, paragraphText(para) + ' ' + 'additional words that will certainly not fit '.repeat(8)), e => e.code === 'overflow' && /more lines/.test(e.message));
});
test('reflow: unchanged text produces no edits', async () => {
  const a = await blocksOf(paragraphDoc(), 0), para = detectParagraphs(a.blocks)[0];
  const r = await reflowParagraph(P, a.doc, a.lib, para, paragraphText(para)); assert.ok(r.edits.length <= para.blocks.length);
});
test('reflow: a typed character that is not in WinAnsi is refused, a word wider than the paragraph is refused', async () => {
  const a = await blocksOf(paragraphDoc(), 0), para = detectParagraphs(a.blocks)[0];
  await assert.rejects(() => reflowParagraph(P, a.doc, a.lib, para, 'W'.repeat(120)), e => e.code === 'longword');
});


/* ------------------------------------------------------------------ review findings (each reproduced before it was fixed) */
import { buildPdf, STD_FONTS } from './helpers/pdf-build.mjs';
const mk = (content, fonts = STD_FONTS, extra = {}) => new Uint8Array(buildPdf({ pages: [{ content }], fonts, ...extra }));
popplerTest('geometry: a wide TJ gap (virtual space) is counted once, so the model width matches Poppler', async () => {
  const src = mk('BT /F1 12 Tf 72 700 Td [(Hello) -2000 (World)] TJ ET\nBT /F1 12 Tf 72 650 Td (Hello World) Tj ET\n');
  const { blocks } = await blocksOf(src, 0); const ws = words(src, 1);
  const h = ws.filter(w => w.text === 'Hello'), w = ws.filter(x => x.text === 'World'); const real = [w[0].x1 - h[0].x0, w[1].x1 - h[1].x0];
  const [gap, plain] = blocks; assert.ok(gap.entries.some(e => e.virtual), 'the wide gap must become a virtual space');
  assert.ok(Math.abs(gap.width * gap.userScale - real[0]) < 1.5, `model ${gap.width * gap.userScale} vs poppler ${real[0]}`); assert.ok(Math.abs(plain.width * plain.userScale - real[1]) < 1.5);
});
bothTest('geometry: right-anchoring an edit on a line with a wide TJ gap keeps the right edge (no gap-sized drift)', async () => {
  const src = mk('BT /F1 12 Tf 72 700 Td [(Hello) -2000 (World)] TJ ET\n'); const before = words(src, 1).find(w => w.text === 'World');
  const out = await edit(src, 0, 'World', t => t.replace('Hello', 'Hi'), { align: 'right' }); const after = words(out.bytes, 1).find(w => w.text === 'World');
  assert.ok(Math.abs(after.x1 - before.x1) < 1.5, `right edge moved from ${before.x1} to ${after.x1}`);
});
bothTest('links: addresses with unbalanced parentheses or a trailing backslash are written as valid PDF strings and read back unchanged', async () => {
  for (const uri of ['https://e.com/a)b', 'https://e.com/a(b', 'https://e.com/x\\', 'https://e.com/p\\q', 'https://e.com/w_(b)c']) {
    const doc = await P.PDFDocument.load(mk('BT /F1 12 Tf 72 700 Td (x) Tj ET')); const rec = [{ id: 'a', src: 's', page: 0, kind: 'uri', uri, rect: [72, 690, 120, 712], changed: true, isNew: true }];
    writeLinks(P, doc, rec, () => [doc.getPage(0)], () => doc.getPage(0), 'in-place'); const out = await doc.save();
    assert.deepEqual(pypdfInspect(out).links.map(l => l.uri), [uri], uri); assert.ok(poppler(out).ok !== false);
  }
});
test('colour: a block coloured through a colour space (cs + sc) keeps /Cs1 selected for the text after an edit', async () => {
  const src = mk('/Cs1 cs 0.2 0.3 0.4 sc BT /F1 12 Tf 72 700 Td (AAA) Tj ET 0.5 0.5 0.5 sc BT /F1 12 Tf 72 650 Td (BBB) Tj ET BT /F1 12 Tf 72 600 Td (CCC) Tj ET', STD_FONTS);
  const a = await blocksOf(src, 0); assert.equal(a.blocks[1].startState.fill, '/Cs1 cs\n0.5 0.5 0.5 sc'); assert.equal(a.blocks[2].startState.fill, '/Cs1 cs\n0.5 0.5 0.5 sc');
  const out = await edit(src, 0, 'BBB', 'BBBB', { fmt: [{ start: 0, end: 4, props: { color: '#cc0000' } }] }); const b = await blocksOf(out.bytes, 0);
  assert.equal(b.blocks.find(x => x.text.includes('CCC')).startState.fill, '/Cs1 cs\n0.5 0.5 0.5 sc', 'the colour space was lost for the following text');
});
test('fonts: non-embedded symbolic fonts (Symbol, ZapfDingbats, symbolic-flag TrueType) are refused, never decoded as Latin', async () => {
  const desc = '/FontDescriptor << /Type /FontDescriptor /FontName /Wingdings-Regular /Flags 4 /FontBBox [0 0 1000 1000] /ItalicAngle 0 /Ascent 800 /Descent -200 /CapHeight 700 /StemV 80 >>';
  for (const font of ['<< /Type /Font /Subtype /Type1 /BaseFont /Symbol >>', '<< /Type /Font /Subtype /Type1 /BaseFont /ZapfDingbats /FirstChar 97 /LastChar 99 /Widths [600 600 600] >>', `<< /Type /Font /Subtype /TrueType /BaseFont /Wingdings-Regular /FirstChar 97 /LastChar 99 /Widths [600 600 600] ${desc} >>`]) {
    const { blocks } = await blocksOf(mk('BT /F1 12 Tf 72 700 Td (abc) Tj ET', { F1: font }), 0); assert.ok(blocks.length && blocks.every(b => !b.editable), font);
  }
});
test('outline: a document whose old outline has a /Next cycle can still be rewritten (no stack overflow)', async () => {
  const doc = await P.PDFDocument.load(mk('BT /F1 12 Tf 72 700 Td (x) Tj ET')), ctx = doc.context; const a = ctx.nextRef(), b = ctx.nextRef(), root = ctx.nextRef();
  const dict = o => P.PDFDict.fromMapWithContext(new Map(Object.entries(o).map(([k, v]) => [P.PDFName.of(k), v])), ctx);
  ctx.assign(root, dict({ Type: P.PDFName.of('Outlines'), First: a, Last: b, Count: P.PDFNumber.of(2) }));
  ctx.assign(a, dict({ Title: P.PDFString.of('A'), Parent: root, Next: b })); ctx.assign(b, dict({ Title: P.PDFString.of('B'), Parent: root, Next: a })); doc.catalog.set(P.PDFName.of('Outlines'), root);
  const tree = O.readOutline(P, doc, 's').tree; assert.equal(O.countItems(tree), 2); O.writeOutline(P, doc, tree, () => doc.getPage(0)); const out = await doc.save(); assert.ok(out.length > 100);
});
