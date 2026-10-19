/* Browser QA for PDF Editor V2: editing existing text, formatting, hyperlinks and bookmarks, driven through the real interface.
   node tests/pdf-editor-v2-browser.mjs [chromium|firefox|webkit]
   env: SITE_ROOT=dist, PLAYWRIGHT_PACKAGE, PDF_QA_ARTIFACTS, PDF_QA_WIDTHS=1440,390, PDF_V2_REQUIRE_TOOLS=1 (fail instead of skip when Poppler/pypdf are missing)
   Every exported file is verified outside the editor: Poppler and pypdf (when installed) and PDF.js inside the page. A check that cannot run is
   reported as SKIPPED, never as passed. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { HAVE, pdftotext, pdffonts, pypdfInspect, poppler, words, render, colourIn, imageCount } from './helpers/pdf-verify.mjs';
import { committed, noUnicode, scanned, stdInvoice, mixedImage, formXObject, bigDocument, tinyPng } from './helpers/pdf-fixtures.mjs';
const pw = await import(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const engine = process.argv[2] || 'chromium';
const dir = process.env.PDF_QA_ARTIFACTS || `artifacts/pdf-editor-v2-${engine}`;
await fs.mkdir(dir, { recursive: true });
const repo = fileURLToPath(new URL('../', import.meta.url));
const root = process.env.SITE_ROOT ? path.resolve(process.env.SITE_ROOT) + '/' : repo;
const P = createRequire(import.meta.url)(path.join(repo, 'vendor/pdf-lib.min.js'));
const { createDistServer } = await import(new URL('file://' + path.join(repo, 'scripts/serve-dist.mjs')).href);
const REQUIRE = process.env.PDF_V2_REQUIRE_TOOLS === '1';
const WIDTHS = (process.env.PDF_QA_WIDTHS || '1440,390').split(',').map(Number);
const realTouch = engine !== 'firefox';

const dist = createDistServer(root, { port: 0 }); await dist.start(); const origin = dist.base.replace(/\/$/, '');
const browser = await pw[engine].launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
let passed = 0, skipped = 0; const failures = [];
async function check(name, fn) {
  if (process.env.PDF_QA_ONLY && !new RegExp(process.env.PDF_QA_ONLY).test(name)) return;
  try { await fn(); passed++; console.log('PASS', name); }
  catch (e) { if (e && e.skip) { skipped++; console.log('SKIPPED', name, '-', e.message); } else { failures.push(`${name}: ${String(e.message).split('\n')[0]}`); console.log('FAIL', name, '-', String(e.stack || e.message).slice(0, 700)); } }
}
const needTools = (what = 'poppler') => { const ok = what === 'poppler' ? HAVE.poppler : what === 'pypdf' ? HAVE.pypdf : HAVE.poppler && HAVE.pypdf; if (!ok) { if (REQUIRE) throw new Error(`required tool missing: ${what}`); const e = new Error(`${what} is not installed`); e.skip = true; throw e; } };
const compact = s => s.replace(/\s+/g, ' ').trim(), nospace = s => s.replace(/\s+/g, '');
const fx = { mixed: Buffer.from(await mixedImage(P)), form: Buffer.from(formXObject()), big: Buffer.from(bigDocument(120)), chrome: Buffer.from(committed('chrome-invoice.pdf')), lo: Buffer.from(committed('lo-report.pdf')), std: Buffer.from(stdInvoice()), enc: Buffer.from(committed('encrypted.pdf')), nounicode: Buffer.from(noUnicode()), scan: Buffer.from(scanned()) };

async function session(w) {
  const mobile = w <= 460, touch = mobile && realTouch;
  const ctx = await browser.newContext({ viewport: { width: w, height: mobile ? 844 : 900 }, hasTouch: touch, isMobile: touch, acceptDownloads: true });
  const page = await ctx.newPage(); page.setDefaultTimeout(20000);
  const errs = [], external = [];
  page.on('dialog', d => d.accept());
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  const wk = m => engine === 'webkit' && (/^web-inspector:/.test(m.location().url) || /^Refused to apply a stylesheet/.test(m.text()));
  page.on('console', m => { if (!wk(m) && ['error', 'warning'].includes(m.type()) && !/favicon|willReadFrequently/.test(m.text())) errs.push(`console ${m.type()}: ${m.text()} @ ${m.location().url}:${m.location().lineNumber}`); });
  page.on('request', r => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith('blob:') && !u.startsWith('data:')) external.push(u); });
  const S = { ctx, page, errs, external, mobile, touch, w };
  S.status = () => page.textContent('#status');
  S.settle = async () => { await page.waitForFunction(() => !document.body.hasAttribute('aria-busy')); await page.waitForTimeout(200); };
  S.open = async (buf, name = 'doc.pdf') => { await page.goto(`${origin}/tools/pdf-editor/`); await page.setInputFiles('#fileInput', { name, mimeType: 'application/pdf', buffer: buf }); await page.waitForFunction(() => /(Opened|not a readable|password|encrypted|50 MB)/i.test(document.getElementById('status').textContent) || !document.getElementById('welcomeError').hidden); await S.settle(); };
  S.reopen = async (buf, name = 'doc.pdf') => { await page.setInputFiles('#fileInput', { name, mimeType: 'application/pdf', buffer: buf }); await page.waitForFunction(n => new RegExp('Opened ' + n.replace('.', '\\.')).test(document.getElementById('status').textContent), name); await S.settle(); };
  S.tool = async t => { await page.locator(`.tool[data-tool="${t}"]`).click(); await page.waitForTimeout(150); };
  S.showPages = async () => { if (S.mobile && await page.evaluate(() => !document.body.classList.contains('pages-open'))) { await page.locator('#pagesToggle').click(); await page.waitForTimeout(250); } };
  S.blocks = () => page.evaluate(() => window.pdfEditorDebug.v2.blocks());
  S.pickBlock = async text => { await page.waitForFunction(() => (window.pdfEditorDebug.v2.blocks() || []).length > 0); const loc = page.locator('#blockList button', { hasText: text }).first(); await loc.click(); await page.waitForFunction(() => !!window.pdfEditorDebug.v2.draft()); await page.waitForTimeout(150); };
  S.setText = async t => { await page.fill('#runText', t); await page.waitForTimeout(250); };
  S.select = async (start, end) => page.evaluate(([s, e]) => { const t = document.getElementById('runText'); t.focus(); t.setSelectionRange(s, e); t.dispatchEvent(new Event('select')); }, [start, end]);
  S.apply = async () => { await page.waitForFunction(() => !document.getElementById('runApply').disabled); await page.locator('#runApply').click(); await page.waitForFunction(() => document.getElementById('runApply').disabled); await S.settle(); };
  S.goPage = async n => { await S.showPages(); await page.locator('#tabPages').click(); await page.locator('#thumbs .thumb-main').nth(n - 1).click(); await S.settle(); };
  S.exportBytes = async () => {
    await page.locator('#download').click(); await page.waitForSelector('#downloadLink:not([hidden])'); await S.settle();
    const info = await page.evaluate(() => { const a = document.getElementById('downloadLink'); return { blob: a.href.startsWith('blob:'), name: a.getAttribute('download') }; }); assert.ok(info.blob && /\.pdf$/.test(info.name));
    return Buffer.from(await page.evaluate(async () => Array.from(new Uint8Array(await (await fetch(document.getElementById('downloadLink').href)).arrayBuffer()))));
  };
  S.clickAt = async (ux, uy) => { // click a PDF user-space point on the overlay
    const c = await page.evaluate(([x, y]) => { const d = window.pdfEditorDebug, o = document.getElementById('overlay'), s = document.getElementById('stage'), sr = s.getBoundingClientRect(), [dx, dy] = d.toDisplay(x, y); let r = o.getBoundingClientRect(); const cx = r.left + dx, cy = r.top + dy; if (cx < sr.left + 20 || cx > sr.right - 20 || cy < sr.top + 20 || cy > sr.bottom - 20) { s.scrollLeft += cx - (sr.left + sr.width / 2); s.scrollTop += cy - (sr.top + sr.height / 2); r = o.getBoundingClientRect(); } return { x: r.left + dx, y: r.top + dy }; }, [ux, uy]);
    if (touch) await page.touchscreen.tap(c.x, c.y); else await page.mouse.click(c.x, c.y); await page.waitForTimeout(250);
  };
  S.dragRect = async (x0, y0, x1, y1) => {
    const pts = await page.evaluate(pp => { const d = window.pdfEditorDebug, o = document.getElementById('overlay'), s = document.getElementById('stage'), sr = s.getBoundingClientRect(), disp = pp.map(([x, y]) => d.toDisplay(x, y)); const mx = (disp[0][0] + disp[1][0]) / 2, my = (disp[0][1] + disp[1][1]) / 2; let r = o.getBoundingClientRect(); s.scrollLeft += r.left + mx - (sr.left + sr.width / 2); s.scrollTop += r.top + my - (sr.top + sr.height / 2); r = o.getBoundingClientRect(); return disp.map(q => ({ x: r.left + q[0], y: r.top + q[1] })); }, [[x0, y0], [x1, y1]]);
    await page.mouse.move(pts[0].x, pts[0].y); await page.mouse.down(); await page.mouse.move((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2, { steps: 4 }); await page.mouse.move(pts[1].x, pts[1].y, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(250);
  };
  return S;
}
/* In-page PDF.js: independent text + annotations + outline of exported bytes. */
async function pdfjsInfo(page, bytes) {
  return page.evaluate(async b => {
    const pdfjs = await import('/tools/v9-media/vendor/pdf/pdf.min.mjs'); pdfjs.GlobalWorkerOptions.workerSrc = '/tools/v9-media/vendor/pdf/pdf.worker.min.mjs';
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(b), isEvalSupported: false, disableFontFace: true, standardFontDataUrl: '/tools/v9-media/vendor/pdf/standard_fonts/' }).promise, out = { pages: pdf.numPages, texts: [], links: [], outline: [] };
    for (let i = 1; i <= pdf.numPages; i++) { const p = await pdf.getPage(i), tc = await p.getTextContent(); out.texts.push(tc.items.map(t => t.str).join(' ').replace(/\s+/g, ' ')); for (const a of await p.getAnnotations()) if (a.subtype === 'Link') out.links.push({ page: i, url: a.url || null, dest: a.dest || null, rect: a.rect }); }
    const o = await pdf.getOutline(); const walk = (items, d) => { for (const it of items || []) { out.outline.push({ title: it.title, depth: d, hasDest: !!it.dest }); walk(it.items, d + 1); } }; walk(o, 0); pdf.destroy(); return out;
  }, Array.from(bytes));
}

for (const w of WIDTHS) {
  const tag = `${w}px`, S = await session(w), { page } = S;

  await check(`${tag}: open a real Chrome-made PDF; links are detected; Edit text lists real text blocks`, async () => {
    await S.open(fx.chrome, 'invoice.pdf'); assert.match(await S.status(), /Opened invoice\.pdf \(2 pages, 2 links\)/);
    await S.tool('edittext'); await page.waitForFunction(() => (window.pdfEditorDebug.v2.blocks() || []).length > 5);
    const b = await S.blocks(); assert.ok(b.some(x => /Acme Trading Ltd/.test(x.text) && x.editable), JSON.stringify(b.map(x => x.text)));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, 'horizontal overflow'); await page.screenshot({ path: `${dir}/edit-text-${w}.png` });
  });

  await check(`${tag}: replace words in an embedded subset font; the exported file contains the new text, not the old, in the original fonts`, async () => {
    await S.pickBlock('Acme Trading'); await S.setText('Acme Trading Ltd, 12 High Street. Settlement due in 30 days. ');
    assert.match(await page.textContent('#runInfo'), /changes the text in the PDF itself/); await S.apply(); assert.match(await S.status(), /text in the PDF was changed/);
    const bytes = await S.exportBytes(); await fs.writeFile(`${dir}/replace-${w}.pdf`, bytes);
    const info = await pdfjsInfo(page, bytes); assert.ok(/Settlement due in 30 days/.test(info.texts[0]) && !/Payment due/.test(info.texts[0]), info.texts[0]);
    needTools('both'); const t = compact(pdftotext(bytes, 1)); assert.ok(t.includes('Settlement due') && !t.includes('Payment due'), t);
    assert.ok(pypdfInspect(bytes).texts[0].includes('Settlement due')); for (const f of pdffonts(fx.chrome)) assert.ok(pdffonts(bytes).includes(f), `${f} lost`);
    assert.deepEqual(poppler(bytes).errors, []);
  });

  await check(`${tag}: numbers and amounts, delete text, undo and redo`, async () => {
    await S.open(fx.chrome, 'invoice.pdf'); await S.tool('edittext');
    await S.pickBlock('$120.00'); await S.setText('$1,250.75'); await S.apply();
    await S.pickBlock('Gadget'); await S.setText(''); await S.apply();
    let st = await page.evaluate(() => window.pdfEditorDebug.state()); assert.equal(st.textEdits.length, 2);
    await page.locator('#undo').click(); await S.settle(); st = await page.evaluate(() => window.pdfEditorDebug.state()); assert.equal(st.textEdits.length, 1);
    await page.locator('#redo').click(); await S.settle(); st = await page.evaluate(() => window.pdfEditorDebug.state()); assert.equal(st.textEdits.length, 2);
    const bytes = await S.exportBytes(); const info = await pdfjsInfo(page, bytes); const nt = nospace(info.texts[0]); assert.ok(nt.includes('$1,250.75') && !nt.includes('$120.00') && !/Gadget/.test(nt), info.texts[0]);
    needTools('both'); assert.ok(compact(pdftotext(bytes, 1)).includes('$1,250.75')); assert.ok(!/Gadget/.test(pypdfInspect(bytes).texts[0]), 'deleted text is still in the file');
  });

  await check(`${tag}: format existing text: bold + colour on a selection, font family, size and right-anchor; verified in the exported file`, async () => {
    await S.open(fx.std, 'std.pdf'); await S.tool('edittext'); await S.pickBlock('Consulting services');
    await S.select(0, 10); await page.locator('#runBold').click(); await page.locator('#runColor').evaluate(el => { el.value = '#cc0000'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await S.select(11, 19); await page.selectOption('#runFont', 'serif'); await page.locator('#runItalic').click();
    await S.apply(); await S.pickBlock('INVOICE'); await S.setText('INVOICE #1042'); await page.fill('#runSize', '30'); await page.waitForTimeout(300); await page.locator('#runAnchorR').click(); await S.apply();
    const bytes = await S.exportBytes(); await fs.writeFile(`${dir}/format-${w}.pdf`, bytes); needTools('poppler');
    const f = pdffonts(bytes).join(' '); assert.ok(/Times-Bold/.test(f) && /Times-Italic/.test(f), f);
    const ww = words(bytes, 1).find(x => x.text === 'Consulting'); const col = colourIn(render(bytes, 1), { x0: ww.x0, x1: ww.x1, y0: ww.y0, y1: ww.y1 }); assert.ok(col && col[0] > 140 && col[1] < 70 && col[2] < 70, `colour ${col}`);
    const inv = words(bytes, 1).find(x => x.text === 'INVOICE'); assert.ok(inv.y1 - inv.y0 > 24, 'size not applied');
    assert.ok(compact(pdftotext(bytes, 1)).includes('Consulting services'));
  });

  await check(`${tag}: clicking the page selects the text under the pointer`, async () => {
    await S.open(fx.std, 'std.pdf'); await S.tool('edittext'); await page.waitForFunction(() => (window.pdfEditorDebug.v2.blocks() || []).length > 3);
    const b = (await S.blocks()).find(x => /Bill to/.test(x.text)); await S.clickAt(b.box.x + b.box.w / 2, b.box.y + b.box.h / 2);
    await page.waitForFunction(() => /Bill to/.test((window.pdfEditorDebug.v2.draft() || {}).text || '')); assert.equal(await page.inputValue('#runText'), b.text);
  });

  await check(`${tag}: text that cannot be edited is explained; scanned and password-protected files are handled gracefully`, async () => {
    await S.open(fx.nounicode, 'nounicode.pdf'); await S.tool('edittext'); await page.waitForFunction(() => (window.pdfEditorDebug.v2.blocks() || []).length === 1);
    await page.locator('#blockList button').first().click(); await page.waitForTimeout(200); assert.match(await page.textContent('#runInfo'), /no Unicode mapping/); assert.equal(await page.locator('#runText').isDisabled(), true); assert.equal(await page.locator('#runApply').isDisabled(), true);
    await S.open(fx.scan, 'scan.pdf'); await S.tool('edittext'); await page.waitForFunction(() => document.getElementById('blockList').textContent.includes('No selectable text')); assert.match(await page.textContent('#blockList'), /OCR/);
    await page.goto(`${origin}/tools/pdf-editor/`); await page.setInputFiles('#fileInput', { name: 'enc.pdf', mimeType: 'application/pdf', buffer: fx.enc }); await page.waitForFunction(() => !document.getElementById('welcomeError').hidden); assert.match(await page.textContent('#welcomeError'), /password-protected or encrypted/);
  });

  await check(`${tag}: characters the fonts cannot draw are refused with a clear message and nothing is changed`, async () => {
    await S.open(fx.std, 'std.pdf'); await S.tool('edittext'); await S.pickBlock('Total due'); await S.setText('Total due \u{1F600}');
    await page.waitForFunction(() => !document.getElementById('runWarn').hidden); assert.match(await page.textContent('#runWarn'), /cannot be typed|not available/); assert.equal(await page.locator('#runApply').isDisabled(), true);
    assert.equal((await page.evaluate(() => window.pdfEditorDebug.state())).textEdits.length, 0);
  });

  await check(`${tag}: hyperlinks: edit, remove, add a web link and an internal page link; verified with pypdf and PDF.js`, async () => {
    await S.open(fx.lo, 'report.pdf'); assert.match(await S.status(), /2 links/, await S.status()); await S.tool('link');
    await page.waitForFunction(() => document.querySelectorAll('#linkList button').length === 2);
    await page.locator('#linkList button', { hasText: 'example.com/data' }).click(); await page.fill('#linkUri', 'https://example.org/changed'); await page.locator('#linkApply').click(); await S.settle();
    await page.locator('#linkList button', { hasText: 'Page 3' }).first().click(); await page.locator('#linkRemove').click(); await S.settle();
    // new web link by dragging over text on page 1 (mouse also on phones: the drag is the same gesture on the canvas)
    await S.dragRect(100, 560, 220, 580); await page.waitForFunction(() => !document.getElementById('linkForm').hidden); await page.fill('#linkUri', 'example.com/new-page'); await page.locator('#linkApply').click(); await S.settle();
    // new internal link on page 1 to page 3
    await S.dragRect(100, 500, 220, 520); await page.waitForFunction(() => !document.getElementById('linkForm').hidden); await page.locator('input[name=linkKind][value=page]').check(); await page.fill('#linkPage', '3'); await page.locator('#linkApply').click(); await S.settle();
    const bytes = await S.exportBytes(); await fs.writeFile(`${dir}/links-${w}.pdf`, bytes);
    const j = await pdfjsInfo(page, bytes); assert.ok(j.links.some(l => l.url === 'https://example.org/changed')); assert.ok(j.links.some(l => l.url === 'https://example.com/new-page')); assert.ok(!j.links.some(l => l.url === 'https://example.com/data'));
    needTools('pypdf'); const info = pypdfInspect(bytes); assert.ok(info.links.some(l => l.uri === 'https://example.org/changed')); assert.ok(info.links.some(l => l.destPage === 3), JSON.stringify(info.links)); assert.ok(!info.links.some(l => l.destPage === 3 && l.page === 1 && l.rect[0] > 150 && l.rect[0] < 170), 'removed internal link survived');
  });

  await check(`${tag}: unsafe link addresses are rejected in the interface`, async () => {
    await S.open(fx.lo, 'report.pdf'); await S.tool('link'); await S.dragRect(100, 560, 220, 580); await page.waitForFunction(() => !document.getElementById('linkForm').hidden);
    await page.fill('#linkUri', 'javascript:alert(1)'); await page.locator('#linkApply').click(); await page.waitForFunction(() => /not allowed|Enter a web address/.test(document.getElementById('status').textContent));
    assert.equal((await page.evaluate(() => window.pdfEditorDebug.state())).links.filter(l => l.isNew).length, 0);
    S.errs.splice(0, S.errs.length, ...S.errs.filter(e => !/Enter a web address/.test(e) && !/^console warning: Error @ \S+\/editor\.js:41$/.test(e))); // the expected, user-facing refusal is logged by the editor's error handler
  });

  await check(`${tag}: bookmarks: read, rename, add, reorder, nest, delete; destinations verified in the exported file`, async () => {
    await S.open(fx.lo, 'report.pdf'); assert.match(await S.status(), /4 bookmarks/); await S.showPages(); await page.locator('#tabBookmarks').click();
    await page.waitForFunction(() => document.querySelectorAll('#bmList .bm-row').length === 4);
    const rows = () => page.evaluate(() => [...document.querySelectorAll('#bmList .bm-row')].map(r => r.querySelector('.bm-title').textContent + '@' + (Number(r.dataset.depth) + 1)));
    assert.deepEqual(await rows(), ['Revenue@1', 'Costs@1', 'Hosting detail@2', 'Outlook@1']);
    await page.locator('#bmList .bm-row', { hasText: 'Revenue' }).locator('.bm-go').click(); await page.locator('#bmList .bm-actions button', { hasText: 'Rename' }).click(); await page.fill('#bmRename', 'Revenue summary'); await page.locator('#bmList .bm-actions button', { hasText: 'Save' }).click(); await S.settle();
    await S.showPages(); await page.locator('#tabBookmarks').click();
    await page.locator('#bmList .bm-row', { hasText: 'Outlook' }).locator('.bm-go').click(); await page.locator('#bmList .bm-actions button[aria-label="Move bookmark up"]').click(); await S.settle();
    await S.goPage(2); await S.showPages(); await page.locator('#tabBookmarks').click(); await page.locator('#bmList .bm-row', { hasText: 'Costs' }).locator('.bm-go').click(); await S.showPages(); await page.locator('#tabBookmarks').click(); await page.fill('#bmNewTitle', 'Cost appendix'); await page.locator('#bmAdd').click(); await S.settle();
    await S.showPages(); await page.locator('#tabBookmarks').click(); await page.locator('#bmList .bm-row', { hasText: 'Cost appendix' }).locator('.bm-go').click(); await page.locator('#bmList .bm-actions button[aria-label="Make a sub-bookmark of the one above"]').click(); await S.settle();
    await S.showPages(); await page.locator('#tabBookmarks').click(); await page.locator('#bmList .bm-row', { hasText: 'Hosting detail' }).locator('.bm-go').click(); await page.locator('#bmList .bm-actions button[aria-label^="Delete bookmark"]').click(); await S.settle();
    await S.showPages(); await page.locator('#tabBookmarks').click();
    const now = await rows(); assert.deepEqual(now.map(r => r.split('@')[0]), ['Revenue summary', 'Outlook', 'Costs', 'Cost appendix'], JSON.stringify(now));
    const bytes = await S.exportBytes(); await fs.writeFile(`${dir}/bookmarks-${w}.pdf`, bytes);
    const j = await pdfjsInfo(page, bytes); assert.deepEqual(j.outline.map(o => `${o.depth}:${o.title}:${o.hasDest}`), ['0:Revenue summary:true', '0:Outlook:true', '0:Costs:true', '1:Cost appendix:true']);
    needTools('pypdf'); const info = pypdfInspect(bytes); assert.deepEqual(info.outline.map(o => `${o.depth}:${o.title}:${o.page}`), ['0:Revenue summary:1', '0:Outlook:3', '0:Costs:2', '1:Cost appendix:2']);
    assert.deepEqual(poppler(bytes).errors, []);
  });

  await check(`${tag}: undo and redo cover bookmarks and links`, async () => {
    await S.open(fx.lo, 'report.pdf'); await S.showPages(); await page.locator('#tabBookmarks').click();
    await page.locator('#bmList .bm-row', { hasText: 'Costs' }).locator('.bm-go').click(); await page.locator('#bmList .bm-actions button', { hasText: 'Delete' }).click(); await S.settle();
    let n = await page.evaluate(() => window.pdfEditorDebug.v2.outline().length); assert.equal(n, 2); await page.locator('#undo').click(); await S.settle(); n = await page.evaluate(() => window.pdfEditorDebug.v2.outline().length); assert.equal(n, 3);
    await page.locator('#redo').click(); await S.settle(); n = await page.evaluate(() => window.pdfEditorDebug.v2.outline().length); assert.equal(n, 2); await page.locator('#undo').click(); await S.settle();
    await S.goPage(1); await S.tool('link'); await page.locator('#linkList button', { hasText: 'example.com/data' }).click(); await page.locator('#linkRemove').click(); await S.settle(); assert.equal(await page.locator('#linkList button').count(), 1);
    await page.locator('#undo').click(); await S.settle(); assert.equal(await page.locator('#linkList button').count(), 2);
  });

  await check(`${tag}: page operations keep bookmarks and links valid (reorder, delete, extract)`, async () => {
    await S.open(fx.lo, 'report.pdf'); await S.goPage(3); await S.showPages(); await page.locator('#thumbs li').nth(2).locator('button[aria-label^="Move page 3 earlier"]').click(); await S.settle();
    let bytes = await S.exportBytes(); needTools('pypdf'); let info = pypdfInspect(bytes); assert.deepEqual(info.outline.map(o => `${o.title}:${o.page}`), ['Revenue:1', 'Costs:3', 'Hosting detail:3', 'Outlook:2']);
    await S.open(fx.lo, 'report.pdf'); await S.goPage(3); await S.showPages(); await page.locator('#thumbs li').nth(2).locator('input[type=checkbox]').check(); await page.locator('#pgDel').click(); await S.settle();
    bytes = await S.exportBytes(); info = pypdfInspect(bytes); assert.equal(info.pages, 2); assert.equal(info.outline.find(o => o.title === 'Outlook').page, null); assert.match(await S.status(), /Notes:.*page that is not in the exported document/);
    assert.ok(!info.links.some(l => l.destPage === 3));
    await S.open(fx.lo, 'report.pdf'); await S.showPages(); await page.locator('#thumbs li').nth(1).locator('input[type=checkbox]').check(); await page.locator('#pgExtract').click(); await page.waitForSelector('#downloadLink:not([hidden])'); await S.settle();
    bytes = Buffer.from(await page.evaluate(async () => Array.from(new Uint8Array(await (await fetch(document.getElementById('downloadLink').href)).arrayBuffer())))); info = pypdfInspect(bytes); assert.equal(info.pages, 1, 'a link or bookmark dragged extra pages into the extract');
  });

  await check(`${tag}: round trip: an exported file reopens in the editor with the edit visible as editable text`, async () => {
    await S.open(fx.lo, 'report.pdf'); await S.tool('edittext'); await S.pickBlock('Total revenue'); await S.setText((await page.inputValue('#runText')).replace('1,204,500', '1,300,000')); await S.apply();
    const bytes = await S.exportBytes(); await S.reopen(bytes, 'again.pdf'); await S.tool('edittext'); await page.waitForFunction(() => (window.pdfEditorDebug.v2.blocks() || []).length > 3);
    const b = await S.blocks(); assert.ok(b.some(x => /1,300,000/.test(x.text) && x.editable)); const st = await page.evaluate(() => window.pdfEditorDebug.state()); assert.equal(st.pages.length, 3); assert.equal(st.links.length, 2); assert.equal(st.outline.length, 3, 'top-level bookmarks'); assert.equal(st.textEdits.length, 0);
  });

  await check(`${tag}: P1 content together with edits: new text and an inserted, resized image survive export next to an existing-text edit`, async () => {
    await S.open(fx.mixed, 'mixed.pdf'); await S.tool('edittext'); await S.pickBlock('Price'); await S.setText('Price: 59.90 EUR per unit'); await S.apply();
    await S.tool('text'); await S.clickAt(300, 400); await page.waitForFunction(() => (window.pdfEditorDebug.state().objects || []).some(o => o.type === 'text')); await page.locator('#propText').waitFor({ state: 'visible' }); await page.fill('#propText', 'New label added'); await page.waitForTimeout(200);
    await page.setInputFiles('#imageInput', { name: 'pic.png', mimeType: 'image/png', buffer: Buffer.from(tinyPng()) }); await page.waitForFunction(() => (window.pdfEditorDebug.state().objects || []).some(o => o.type === 'image')); await S.settle();
    await page.fill('#geoW', '150'); await page.waitForTimeout(300);
    const st = await page.evaluate(() => window.pdfEditorDebug.state()); const img = st.objects.find(o => o.type === 'image'); assert.ok(Math.abs(img.cw - 150) < 1, 'image not resized: ' + img.cw);
    const bytes = await S.exportBytes(); await fs.writeFile(`${dir}/p1-${w}.pdf`, bytes); const j = await pdfjsInfo(page, bytes); assert.ok(/59\.90 EUR/.test(j.texts[0]) && /New label added/.test(j.texts[0]) && /Stock: 120 units/.test(j.texts[0]), j.texts[0]);
    needTools('poppler'); assert.equal(imageCount(bytes), 2, 'original and inserted image expected'); assert.ok(compact(pdftotext(bytes, 1)).includes('Price: 59.90 EUR per unit'));
  });

  await check(`${tag}: text inside embedded form objects is reported as not editable; only the directly drawn line is offered`, async () => {
    await S.open(fx.form, 'form.pdf'); await S.tool('edittext'); await page.waitForFunction(() => (window.pdfEditorDebug.v2.blocks() || []).length === 1);
    await page.waitForFunction(() => /embedded form objects/.test(document.getElementById('blockList').textContent)); assert.equal((await S.blocks())[0].text, 'Direct text on the page');
  });

  await check(`${tag}: a 120-page document is ready for text editing quickly and an edit on a late page exports correctly`, async () => {
    await S.open(fx.big, 'big.pdf'); const t0 = Date.now(); await S.tool('edittext'); await page.waitForFunction(() => (window.pdfEditorDebug.v2.blocks() || []).length > 3, null, { timeout: 30000 }); const ready = Date.now() - t0; assert.ok(ready < 15000, `engine took ${ready} ms`);
    await S.goPage(90); await page.waitForFunction(() => (window.pdfEditorDebug.v2.blocks() || []).some(b => /^Page 90 /.test(b.text))); await S.pickBlock('Page 90 line 3:'); await S.setText('Page 90 line 3: changed on a late page'); await S.apply();
    const bytes = await S.exportBytes(); const j = await pdfjsInfo(page, bytes); assert.equal(j.pages, 120); assert.ok(/changed on a late page/.test(j.texts[89]) && !/line 3: the quick/.test(j.texts[89]));
  });

  await check(`${tag}: no console errors, no external requests, no inline styles`, async () => {
    assert.deepEqual(S.errs, []); assert.deepEqual(S.external, []);
    for (const f of ['tools/pdf-editor/index.html', 'tools/pdf-editor/editor.js', 'tools/pdf-editor/v2ui.js']) assert.doesNotMatch(await fs.readFile(path.join(repo, f), 'utf8'), /<style\b|\sstyle\s*=/i, `inline CSS in ${f}`);
  });
  await S.ctx.close();
}
await browser.close(); await dist.stop();
console.log(`\n${engine}: ${passed} passed, ${failures.length} failed, ${skipped} skipped`);
if (failures.length) { failures.forEach(x => console.log(' -', x)); process.exit(1); }
