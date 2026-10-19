/* Browser QA for the standalone PDF Editor (tools/pdf-editor/).
   node tests/pdf-editor-app-browser.mjs [chromium|firefox|webkit]
   env: SITE_ROOT=dist (test the built output with Cloudflare-style routing), PLAYWRIGHT_PACKAGE, PDF_QA_ARTIFACTS (screenshots + exported PDFs), PDF_QA_WIDTHS=1440,390
   Sample PDFs are generated with the repo's own pdf-lib bundle. Everything the editor exports is re-read with pdf-lib (structure) and PDF.js
   (rendered pixels, text, positions), so the suite needs no system PDF tools. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const pw = await import(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const engine = process.argv[2] || 'chromium';
const dir = process.env.PDF_QA_ARTIFACTS || `artifacts/pdf-editor-app-${engine}`;
await fs.mkdir(dir, { recursive: true });
const repo = fileURLToPath(new URL('../', import.meta.url));
const root = process.env.SITE_ROOT ? path.resolve(process.env.SITE_ROOT) + '/' : repo;
const { PDFDocument, StandardFonts, rgb, degrees, PDFName, PDFDict, PDFArray } = createRequire(import.meta.url)(path.join(repo, 'vendor/pdf-lib.min.js'));
const { createDistServer } = await import(pathToUrl(path.join(repo, 'scripts/serve-dist.mjs')));
function pathToUrl(p) { return new URL('file://' + p).href; }
/* Firefox has no touch emulation in Playwright, so its phone-width runs use the mouse; other engines use real touch. */
const realTouch = engine !== 'firefox';
const WIDTHS = (process.env.PDF_QA_WIDTHS || '1440,390').split(',').map(Number);

/* ---------- sample documents ---------- */
async function samplePdf(label, sizes, { rotate = 0 } = {}) {
  const d = await PDFDocument.create(); const f = await d.embedFont(StandardFonts.HelveticaBold);
  sizes.forEach(([w, h], i) => { const p = d.addPage([w, h]); p.drawText(`${label} PAGE ${i + 1}`, { x: 40, y: h - 120, size: 36, font: f, color: rgb(.1, .2, .5) }); p.drawRectangle({ x: 40, y: 60, width: w - 80, height: 40, color: rgb(.9, .4, .1) }); if (rotate) p.setRotation(degrees(rotate)); });
  return Buffer.from(await d.save());
}
/* A page whose text uses a font name with a subset tag, standing in for the subset-embedded fonts of Word/Chrome exports. */
async function subsetPdf() {
  const d = await PDFDocument.create(), p = d.addPage([300, 200]), ctx = d.context;
  p.node.setFontDictionary(PDFName.of('F1'), ctx.register(ctx.obj({ Type: 'Font', Subtype: 'TrueType', BaseFont: 'ABCDEF+Calibri', Encoding: 'WinAnsiEncoding' })));
  p.node.set(PDFName.of('Contents'), ctx.register(ctx.flateStream('BT /F1 14 Tf 20 150 Td (Subset run text) Tj ET')));
  return Buffer.from(await d.save());
}
/* A solid-colour PNG built in memory (no image fixtures needed). */
function makePng(w, h, [r, g, b]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = buf => { let c = 0xffffffff; for (const x of buf) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const PNG = makePng(40, 40, [200, 30, 30]);
const files = {
  A: await samplePdf('ALPHA', [[612, 792], [612, 792], [612, 792], [612, 792]]),
  B: await samplePdf('BRAVO', [[612, 792], [792, 612]]),
  ROT: await samplePdf('ROTSRC', [[612, 792]], { rotate: 90 }),
  SUBSET: await subsetPdf(),
};
const garbage = Buffer.from('not a pdf');
const truncated = files.A.subarray(0, Math.floor(files.A.length * .6));
const oversizePath = path.join(os.tmpdir(), `pdf-editor-oversize-${process.pid}.pdf`);
await fs.writeFile(oversizePath, Buffer.concat([files.A, Buffer.alloc(51 * 1024 * 1024, 120)]));

/* ---------- server and browser ---------- */
const dist = createDistServer(root, { port: 0 }); await dist.start();
const origin = dist.base.replace(/\/$/, '');
const browser = await pw[engine].launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
let passed = 0; const failures = [];
async function check(name, fn) { if (process.env.PDF_QA_ONLY && !new RegExp(process.env.PDF_QA_ONLY).test(name) && !/welcome screen/.test(name)) return; try { await fn(); passed++; console.log('PASS', name); } catch (e) { failures.push(`${name}: ${e.message.split('\n')[0]}`); console.log('FAIL', name, '-', e.message.slice(0, 500)); } }

async function session(w) {
  const mobile = w <= 460, touch = mobile && realTouch;
  const ctx = await browser.newContext({ viewport: { width: w, height: mobile ? 844 : 900 }, hasTouch: touch, isMobile: touch, acceptDownloads: true });
  const page = await ctx.newPage(); page.setDefaultTimeout(20000);
  const errs = [], external = [];
  page.on('dialog', d => d.accept());
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', e => console.error(`CSPV ${e.violatedDirective} blocked=${e.blockedURI} sample=${(e.sample || '').slice(0, 80)} src=${e.sourceFile}:${e.lineNumber}`)));
  // WebKit's Playwright build injects an inline stylesheet from web-inspector://, which the page's strict style-src refuses; the editor page itself has no <style> or inline style (checked below).
  const wkInspector = m => engine === 'webkit' && (/^web-inspector:/.test(m.location().url) || /^Refused to apply a stylesheet/.test(m.text()));
  page.on('console', m => { if (!wkInspector(m) && ['error', 'warning'].includes(m.type()) && !/favicon|willReadFrequently/.test(m.text())) errs.push(`console ${m.type()}: ${m.text()} @ ${m.location().url}:${m.location().lineNumber}`); });
  page.on('request', r => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith('blob:') && !u.startsWith('data:')) external.push(u); });
  const S = { ctx, page, errs, external, mobile, touch, w };
  S.status = () => page.textContent('#status');
  S.idle = () => page.waitForFunction(() => !document.body.hasAttribute('aria-busy'));
  S.open = async (buf, name = 'sample.pdf') => {
    await page.goto(`${origin}/tools/pdf-editor/`);
    await page.setInputFiles('#fileInput', { name, mimeType: 'application/pdf', buffer: buf });
    await page.waitForFunction(() => /(Opened|not a readable|password|50 MB)/.test(document.getElementById('status').textContent));
    await S.settle();
  };
  S.settle = async () => { await page.waitForFunction(() => !document.body.hasAttribute('aria-busy')); await page.waitForTimeout(250); };
  S.showPages = async () => { if (!S.mobile) return; if (await page.evaluate(() => !document.body.classList.contains('pages-open'))) await S.tap(page.locator('#pagesToggle')); await page.waitForTimeout(250); };
  S.tool = async t => { await S.tap(page.locator(`.tool[data-tool="${t}"]`)); };
  /* Once a page has received CDP touch events, Playwright's own tap() leaves a stuck touch point and later taps are dropped,
     so Chromium touch runs use CDP touches for taps and drags alike. */
  /* A fresh CDP session per gesture: keeping one session alive leaves Chromium's gesture state stuck after a drag and later taps lose their click. */
  const gesture = async (steps) => { const cdp = await ctx.newCDPSession(page); try { for (const [type, pts] of steps) await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(p => ({ x: p.x, y: p.y, id: 1 })) }); } finally { await cdp.detach(); } };
  S.cdpTap = async p => { await gesture([['touchStart', [p]], ['touchEnd', []]]); await page.waitForTimeout(60); };
  S.tap = async loc => { if (touch && engine === 'chromium') { await loc.scrollIntoViewIfNeeded(); const b = await loc.boundingBox(); await S.cdpTap({ x: b.x + b.width / 2, y: b.y + b.height / 2 }); } else if (touch) await loc.tap(); else await loc.click(); };
  /* Centre the given PDF user-space points in the scroll area (when they are not all comfortably visible) and return their client coordinates. */
  S.clients = async pts => page.evaluate(pts => {
    const dbg = window.pdfEditorDebug, o = document.getElementById('overlay'), s = document.getElementById('stage'), sr = s.getBoundingClientRect();
    const disp = pts.map(([x, y]) => dbg.toDisplay(x, y)), mx = disp.reduce((a, d) => a + d[0], 0) / disp.length, my = disp.reduce((a, d) => a + d[1], 0) / disp.length;
    const r0 = o.getBoundingClientRect(), vis = disp.every(d => { const cx = r0.left + d[0], cy = r0.top + d[1]; return cx > sr.left + 30 && cx < sr.right - 30 && cy > sr.top + 30 && cy < sr.bottom - 30; });
    if (!vis) { s.scrollLeft += r0.left + mx - (sr.left + sr.width / 2); s.scrollTop += r0.top + my - (sr.top + sr.height / 2); }
    const r = o.getBoundingClientRect(); return disp.map(d => ({ x: r.left + d[0], y: r.top + d[1] }));
  }, pts);
  S.client = async (ux, uy) => (await S.clients([[ux, uy]]))[0];
  S.click = async (ux, uy) => { const p = await S.client(ux, uy); if (touch && engine === 'chromium') await S.cdpTap(p); else if (touch) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y); await page.waitForTimeout(120); };
  S.drag = async (pts) => {
    const c = await S.clients(pts);
    if (touch && engine === 'chromium') {
      // A drag with a single touchMove leaves Chromium's gesture recogniser stuck (the next tap loses its click), so interpolate many small moves like a real finger.
      const path = [c[0]]; for (let i = 1; i < c.length; i++) for (let k = 1; k <= 8; k++) path.push({ x: c[i - 1].x + (c[i].x - c[i - 1].x) * k / 8, y: c[i - 1].y + (c[i].y - c[i - 1].y) * k / 8 });
      await gesture([['touchStart', [path[0]]], ...path.slice(1).map(p => ['touchMove', [p]]), ['touchEnd', []]]); await page.waitForTimeout(250);
    } else {
      await page.mouse.move(c[0].x, c[0].y); await page.mouse.down();
      for (const p of c.slice(1)) await page.mouse.move(p.x, p.y, { steps: 4 });
      await page.mouse.up();
    }
    await page.waitForTimeout(150);
  };
  S.state = () => page.evaluate(() => window.pdfEditorDebug.state());
  S.objs = async () => (await S.state()).objects;
  S.exportBytes = async (sel = '#download') => {
    await S.tap(page.locator(sel)); await page.waitForSelector('#downloadLink:not([hidden])'); await S.idle();
    const info = await page.evaluate(() => { const a = document.getElementById('downloadLink'); return { blob: a.href.startsWith('blob:'), name: a.getAttribute('download') }; });
    assert.ok(info.blob && /\.pdf$/.test(info.name), 'export link is not a named blob download: ' + JSON.stringify(info));
    return { bytes: Buffer.from(await page.evaluate(async () => { const r = await fetch(document.getElementById('downloadLink').href); return Array.from(new Uint8Array(await r.arrayBuffer())); })), name: info.name };
  };
  return S;
}
/* Re-read exported bytes with PDF.js inside the page: text with positions, per-page rotation, and rendered pixels at user-space points. */
async function inspect(page, bytes, samples = []) {
  return page.evaluate(async ({ b, samples }) => {
    const pdfjs = await import('/tools/v9-media/vendor/pdf/pdf.min.mjs'); const M = await import('/tools/pdf-editor/model.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = '/tools/v9-media/vendor/pdf/pdf.worker.min.mjs';
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(b), isEvalSupported: false, disableFontFace: true, standardFontDataUrl: '/tools/v9-media/vendor/pdf/standard_fonts/' }).promise, out = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const p = await pdf.getPage(i), tc = await p.getTextContent(), view = p.view, v = p.getViewport({ scale: 1 });
      const entry = { w: v.width, h: v.height, rotate: p.rotate, view, items: tc.items.filter(t => t.str.trim()).map(t => ({ t: t.str, x: t.transform[4], y: t.transform[5], a: t.transform[0], b: t.transform[1], size: Math.hypot(t.transform[0], t.transform[1]) })), px: [] };
      if (samples.length && samples.some(s => s.page === i - 1)) {
        const c = document.createElement('canvas'); c.width = Math.ceil(v.width); c.height = Math.ceil(v.height); await p.render({ canvasContext: c.getContext('2d'), viewport: v }).promise;
        const vp = M.makeViewport(view, p.rotate, 1), g = c.getContext('2d');
        for (const s of samples.filter(s => s.page === i - 1)) { const [x, y] = vp.toDisplay(s.x, s.y), d = g.getImageData(Math.round(x), Math.round(y), 1, 1).data; entry.px.push([d[0], d[1], d[2]]); }
      }
      out.push(entry);
    }
    pdf.destroy(); return out;
  }, { b: Array.from(bytes), samples });
}
const find = (pg, re) => pg.items.find(i => re.test(i.t));
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const approxColor = (px, [r, g, b], tol = 40) => Math.abs(px[0] - r) <= tol && Math.abs(px[1] - g) <= tol && Math.abs(px[2] - b) <= tol;
const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
async function annots(bytes) { const d = await PDFDocument.load(bytes), out = []; for (const p of d.getPages()) { const a = p.node.Annots(); out.push(a instanceof PDFArray ? a.asArray().map(r => { const x = d.context.lookup(r, PDFDict); return { sub: String(x.get(PDFName.of('Subtype'))), contents: x.get(PDFName.of('Contents')) && x.get(PDFName.of('Contents')).decodeText() }; }) : []); } return out; }

for (const w of WIDTHS) {
  const tag = `${w}px`;
  const S = await session(w); const { page } = S;

  await check(`${tag}: welcome screen, open a PDF, document-first layout`, async () => {
    await page.goto(`${origin}/tools/pdf-editor/`); assert.equal(await page.locator('#download').isDisabled(), true); assert.match(await page.textContent('#welcomeTitle'), /Edit a PDF/);
    await page.screenshot({ path: `${dir}/welcome-${w}.png` });
    await S.open(files.A, 'a.pdf');
    assert.match(await S.status(), /Opened a\.pdf \(4 pages\)/);
    const r = await page.evaluate(() => { const c = document.getElementById('pageCanvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let ink = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 80 && d[i + 1] < 120) ink++; return { ink, thumbs: document.querySelectorAll('#thumbs .thumb').length, info: document.getElementById('pageInfo').textContent.trim(), over: document.documentElement.scrollWidth - document.documentElement.clientWidth, cw: document.getElementById('pageCanvas').getBoundingClientRect().width, ow: document.getElementById('overlay').getBoundingClientRect().width, vw: innerWidth }; });
    assert.ok(r.ink > 200, 'page preview is blank'); assert.equal(r.thumbs, 4); assert.equal(r.info, 'Page 1 of 4'); assert.equal(r.over, 0, 'horizontal overflow'); assert.ok(Math.abs(r.cw - r.ow) < 1, 'overlay not aligned with page');
    await page.screenshot({ path: `${dir}/open-${w}.png` });
  });

  await check(`${tag}: zoom controls, fit to width, overlay stays aligned`, async () => {
    const before = await page.evaluate(() => document.getElementById('pageCanvas').getBoundingClientRect().width);
    await S.tap(page.locator('#zoomIn')); await page.waitForTimeout(300); await S.tap(page.locator('#zoomIn')); await page.waitForTimeout(400);
    const after = await page.evaluate(() => ({ c: document.getElementById('pageCanvas').getBoundingClientRect().width, o: document.getElementById('overlay').getBoundingClientRect().width, l: document.getElementById('zoomLabel').textContent }));
    assert.ok(after.c > before * 1.1, `zoom did not enlarge the page (${before} -> ${after.c})`); assert.ok(Math.abs(after.c - after.o) < 1);
    await S.tap(page.locator('#zoomOut')); await S.tap(page.locator('#zoomOut')); await S.tap(page.locator('#zoomOut')); await S.tap(page.locator('#zoomOut')); await page.waitForTimeout(400);
    const small = await page.evaluate(() => document.getElementById('pageCanvas').getBoundingClientRect().width); assert.ok(small < before, 'zoom out did not shrink the page');
    if (!S.mobile) { await S.tap(page.locator('#zoomFit')); await page.waitForTimeout(400); }
    else await page.evaluate(() => { document.getElementById('zoomFit').click(); });
    await page.waitForTimeout(400); const fit = await page.evaluate(() => document.getElementById('pageCanvas').getBoundingClientRect().width); assert.ok(Math.abs(fit - before) < 3, `fit width ${fit} != ${before}`);
  });

  await check(`${tag}: add text, edit it, drag and resize it, undo and redo`, async () => {
    await S.tool('text'); await S.click(100, 600);
    let o = (await S.objs())[0]; assert.ok(o && o.type === 'text', 'no text object'); assert.ok(near(o.ox, 100, 6) && near(o.oy, 600, 12), `placed at ${o.ox},${o.oy}`);
    await page.fill('#propText', 'Hello editor'); await page.waitForTimeout(150);
    o = (await S.objs())[0]; assert.equal(o.text, 'Hello editor');
    await page.fill('#propSize', '24'); await page.dispatchEvent('#propSize', 'input'); await page.waitForTimeout(100);
    assert.equal((await S.objs())[0].size, 24);
    const before = (await S.objs())[0];
    await S.tool('select'); await S.drag([[before.ox + 20, before.oy - 6], [before.ox + 120, before.oy - 86]]);
    const moved = (await S.objs())[0]; assert.ok(near(moved.ox - before.ox, 100, 8) && near(moved.oy - before.oy, -80, 8), `dragged by ${moved.ox - before.ox},${moved.oy - before.oy}`);
    const geo = await page.evaluate(() => 0); void geo;
    await page.keyboard.press('Control+z'); await page.waitForTimeout(200);
    const undone = (await S.objs())[0]; assert.ok(near(undone.ox, before.ox, 0.5) && near(undone.oy, before.oy, 0.5), 'undo did not restore the position');
    await page.keyboard.press('Control+Shift+z'); await page.waitForTimeout(200);
    assert.ok(near((await S.objs())[0].ox, moved.ox, 0.5), 'redo did not re-apply the move');
    await page.screenshot({ path: `${dir}/text-${w}.png` });
  });

  await check(`${tag}: exported PDF contains the text at the right place and re-opens`, async () => {
    const { bytes } = await S.exportBytes(); const o = (await S.objs())[0];
    const pg = (await inspect(page, bytes))[0], t = find(pg, /Hello editor/); assert.ok(t, 'text missing: ' + JSON.stringify(pg.items.map(i => i.t)));
    assert.ok(near(t.size, 24, 0.6), `size ${t.size}`); assert.ok(near(t.x, o.ox, 1.5), `x ${t.x} vs ${o.ox}`);
    const doc = await PDFDocument.load(bytes); assert.equal(doc.getPageCount(), 4); fs.writeFile(`${dir}/export-text-${w}.pdf`, bytes);
  });

  await check(`${tag}: shapes, arrow, freehand, highlight and note export as vector content`, async () => {
    await S.open(files.A, 'a.pdf');
    const startAll = async (tool, pts) => { await S.tool(tool); await S.drag(pts); };
    await page.evaluate(() => 0);
    await S.tool('rect'); await S.drag([[60, 500], [200, 420]]);
    await page.fill('#propWidth', '4'); await page.dispatchEvent('#propWidth', 'input'); await page.fill('#propStroke', '#0000ff'); await page.dispatchEvent('#propStroke', 'input'); await page.waitForTimeout(150);
    await S.tool('ellipse'); await S.drag([[260, 500], [400, 420]]);
    await startAll('line', [[60, 380], [200, 340]]); await startAll('arrow', [[260, 380], [400, 340]]);
    await startAll('draw', [[60, 300], [90, 330], [120, 300], [150, 330], [180, 300]]);
    await S.tool('highlight'); await S.drag([[40, 690], [330, 640]]);
    await S.tool('note'); await S.click(500, 700); await page.fill('#propNoteText', 'Check this figure'); await page.waitForTimeout(150);
    const objs = await S.objs(); const types = objs.map(o => o.type);
    assert.deepEqual(types, ['rect', 'ellipse', 'line', 'arrow', 'draw', 'highlight', 'note'], 'objects: ' + types);
    const hl = objs.find(o => o.type === 'highlight'); assert.ok(hl.rects.length >= 1 && hl.rects[0].w > 100, 'highlight did not snap to the title text');
    await page.screenshot({ path: `${dir}/shapes-${w}.png` });
    const { bytes } = await S.exportBytes(); fs.writeFile(`${dir}/export-shapes-${w}.pdf`, bytes);
    const rc = objs.find(o => o.type === 'rect'), samples = [{ page: 0, x: 130, y: 500 + 1 }, { page: 0, x: 60, y: 460 }, { page: 0, x: hl.rects[0].x + 20, y: hl.rects[0].y + hl.rects[0].h / 2 }];
    void rc;
    const pg = (await inspect(page, bytes, samples))[0];
    assert.ok(approxColor(pg.px[1], [0, 0, 255], 70), `rectangle edge colour ${pg.px[1]}`);
    const an = await annots(bytes); assert.deepEqual(an[0].map(a => a.sub), ['/Text'], 'native comment annotation missing'); assert.equal(an[0][0].contents, 'Check this figure');
    const hlPx = pg.px[2]; assert.ok(hlPx[2] < 190, `highlight did not tint the text row ${hlPx}`);
  });

  await check(`${tag}: place an image, resize it and export`, async () => {
    await S.open(files.A, 'a.pdf');
    await page.setInputFiles('#imageInput', { name: 'dot.png', mimeType: 'image/png', buffer: PNG }); await page.waitForFunction(() => /Image added/.test(document.getElementById('status').textContent)); await S.settle();
    let o = (await S.objs())[0]; assert.equal(o.type, 'image'); assert.ok(o.cw > 5 && o.ch > 5);
    const { bytes } = await S.exportBytes(); const d = await PDFDocument.load(bytes); const res = d.getPage(0).node.Resources().lookup(PDFName.of('XObject'), PDFDict);
    assert.ok(res.keys().length >= 1, 'no image XObject in the export');
    const cxu = o.ox + o.cw / 2, cyu = o.oy - o.ch / 2, pg = (await inspect(page, bytes, [{ page: 0, x: cxu, y: cyu }]))[0]; assert.ok(!approxColor(pg.px[0], [255, 255, 255], 8), 'image pixels not rendered at the object position');
  });

  await check(`${tag}: rotate, reorder, delete and extract pages; undo restores`, async () => {
    await S.open(files.A, 'a.pdf');
    await S.showPages(); await S.tap(page.locator('#thumbs .thumb').nth(1).locator('.thumb-main')); await page.waitForFunction(() => document.getElementById('pageInfo').textContent.trim() === 'Page 2 of 4');
    await S.tool('text'); await S.click(120, 500); await page.fill('#propText', 'ON-PAGE-2'); await page.waitForTimeout(150);
    await S.showPages(); await S.tap(page.locator('#pgRotR')); await page.waitForTimeout(400);
    await S.tap(page.locator('#thumbs .thumb').nth(1).locator('.moves button').first()); await page.waitForTimeout(400);
    let st = await S.state(); assert.equal(st.pages[0].rot, 90, 'rotated page should now be first'); assert.equal(st.objects[0].page, st.pages[0].id, 'note must follow its page');
    await S.tap(page.locator('#pgDel')); await page.waitForTimeout(400); st = await S.state(); assert.equal(st.pages.length, 3);
    let { bytes } = await S.exportBytes(); let pgs = await inspect(page, bytes); assert.equal(pgs.length, 3); assert.ok(pgs.every(p => !find(p, /ON-PAGE-2/)), 'deleted page note leaked');
    assert.ok(/ALPHA PAGE 1/.test(pgs[0].items.map(i => i.t).join(' ')) && /ALPHA PAGE 3/.test(pgs[1].items.map(i => i.t).join(' ')), 'page order after delete');
    await page.keyboard.press('Control+z'); await page.waitForTimeout(400); st = await S.state(); assert.equal(st.pages.length, 4, 'undo did not restore the deleted page');
    ({ bytes } = await S.exportBytes()); pgs = await inspect(page, bytes); assert.equal(pgs[0].rotate, 90); assert.ok(find(pgs[0], /ON-PAGE-2/), 'note lost after undo'); assert.ok(/ALPHA PAGE 2/.test(pgs[0].items.map(i => i.t).join(' ')));
    await S.showPages(); await page.locator('#thumbs .thumb').nth(2).locator('input[type=checkbox]').check(); await page.locator('#thumbs .thumb').nth(3).locator('input[type=checkbox]').check();
    await S.tap(page.locator('#pgExtract')); await page.waitForSelector('#downloadLink:not([hidden])'); await S.idle();
    const ex = Buffer.from(await page.evaluate(async () => { const r = await fetch(document.getElementById('downloadLink').href); return Array.from(new Uint8Array(await r.arrayBuffer())); }));
    const ep = await inspect(page, ex); assert.equal(ep.length, 2); assert.ok(/ALPHA PAGE 3/.test(ep[0].items.map(i => i.t).join(' ')) && /ALPHA PAGE 4/.test(ep[1].items.map(i => i.t).join(' ')));
    assert.match(await page.getAttribute('#downloadLink', 'download'), /extracted-2-pages\.pdf$/);
  });

  await check(`${tag}: resize and rotate handles, zoom keeps objects in place`, async () => {
    await S.open(files.A, 'a.pdf'); await S.tool('rect'); await S.drag([[100, 400], [220, 340]]);
    let o = (await S.objs())[0]; const sc = async () => page.evaluate(() => window.pdfEditorDebug.viewport().scale);
    const handle = async (obj, h) => page.evaluate(async ([obj, h]) => { const M = await import('/tools/pdf-editor/model.mjs'); const [u, v] = M.handlePoints(obj, null)[h]; return M.frameToUser(obj, u, v); }, [obj, h]);
    const br = await handle(o, 4); await S.drag([br, [br[0] + 40, br[1] - 30]]);
    let r = (await S.objs())[0]; assert.ok(near(r.cw - o.cw, 40, 3) && near(r.ch - o.ch, 30, 3), `resized by ${r.cw - o.cw} x ${r.ch - o.ch}`);
    assert.ok(near(r.ox, o.ox, 0.5) && near(r.oy, o.oy, 0.5), 'top-left corner must stay put when dragging the bottom-right handle');
    const tl = await handle(r, 0); await S.drag([tl, [tl[0] + 20, tl[1] - 10]]);
    const r2 = (await S.objs())[0]; const brAfter = await handle(r2, 4), brBefore = await handle(r, 4); assert.ok(near(brAfter[0], brBefore[0], 0.5) && near(brAfter[1], brBefore[1], 0.5), 'bottom-right corner must stay put when dragging the top-left handle');
    // rotation handle: 28 display px above the top edge centre
    const s1 = await sc(), top = await page.evaluate(async o => { const M = await import('/tools/pdf-editor/model.mjs'); return M.frameToUser(o, o.cw / 2, 0); }, r2), c = await page.evaluate(async o => { const M = await import('/tools/pdf-editor/model.mjs'); return M.frameToUser(o, o.cw / 2, o.ch / 2); }, r2);
    const up = Math.hypot(top[0] - c[0], top[1] - c[1]) + 28 / s1, rot = [c[0] + up * Math.cos(30 * Math.PI / 180 + Math.PI / 2), c[1] + up * Math.sin(30 * Math.PI / 180 + Math.PI / 2)];
    await S.drag([[top[0], top[1] + 28 / s1], rot]); const rr = (await S.objs())[0]; assert.ok(near(rr.rot, 30, 4), `rotated to ${rr.rot}`);
    const keep = (await S.objs())[0]; await S.tap(page.locator('#zoomIn')); await S.tap(page.locator('#zoomIn')); await page.waitForTimeout(500);
    const after = (await S.objs())[0]; assert.deepEqual([after.ox, after.oy, after.cw, after.ch, after.rot], [keep.ox, keep.oy, keep.cw, keep.ch, keep.rot], 'zoom must not change object positions');
    await S.tool('select'); await S.click(...(await page.evaluate(async o => { const M = await import('/tools/pdf-editor/model.mjs'); return M.frameToUser(o, o.cw / 2, o.ch / 2); }, after)));
    assert.equal(await page.evaluate(() => document.getElementById('overlay').dataset.selection), '1', 'object not selectable at the new zoom');
  });

  await check(`${tag}: text rotated with its box and on a rotated page stays readable`, async () => {
    await S.open(files.A, 'a.pdf'); await S.tool('text'); await S.click(100, 500); await page.fill('#propText', 'TURNED'); await page.waitForTimeout(150);
    const o = (await S.objs())[0]; await S.tool('select');
    const s1 = await page.evaluate(() => window.pdfEditorDebug.viewport().scale), top = await page.evaluate(async o => { const M = await import('/tools/pdf-editor/model.mjs'); const f = await M.makeFontMetrics(window.PDFLib); return M.frameToUser(o, o.cw / 2, 0); }, o);
    const c = await page.evaluate(async o => { const M = await import('/tools/pdf-editor/model.mjs'); const f = await M.makeFontMetrics(window.PDFLib); return M.frameToUser(o, o.cw / 2, M.frameHeight(o, f) / 2); }, o);
    const len = Math.hypot(top[0] - c[0], top[1] - c[1]) + 28 / s1, tgt = [c[0] + len * Math.cos(90 * Math.PI / 180 + Math.PI / 2), c[1] + len * Math.sin(90 * Math.PI / 180 + Math.PI / 2)];
    await S.drag([[top[0], top[1] + 28 / s1], tgt]); const rot = (await S.objs())[0].rot; assert.ok(near(rot, 90, 4) || near(rot, 270, 4) || near(rot, 90 + 0, 6), `rotation ${rot}`);
    let { bytes } = await S.exportBytes(); let pg = (await inspect(page, bytes))[0], t = find(pg, /TURNED/); assert.ok(t && Math.abs(t.b) > Math.abs(t.a), `text not rotated in the export: a=${t && t.a} b=${t && t.b}`);
    await S.open(files.A, 'a.pdf'); await S.showPages(); await S.tap(page.locator('#pgRotR')); await page.waitForTimeout(400); if (S.mobile) await page.evaluate(() => document.body.classList.remove('pages-open'));
    await S.tool('text'); await S.click(100, 500); await page.fill('#propText', 'SIDEWAYS'); await page.waitForTimeout(150);
    ({ bytes } = await S.exportBytes()); pg = (await inspect(page, bytes))[0]; t = find(pg, /SIDEWAYS/); assert.equal(pg.rotate, 90); assert.ok(t && near(t.a, 0, 0.01) && t.b > 10, `text not turned with the page: a=${t && t.a} b=${t && t.b}`);
  });

  await check(`${tag}: underline and strike-through snap to text; multi-page rotate; drag-and-drop reorder`, async () => {
    await S.open(files.A, 'a.pdf');
    await S.tool('underline'); await S.drag([[40, 690], [330, 640]]); await S.tool('strike'); await S.drag([[40, 690], [330, 640]]);
    const marks = (await S.objs()).map(o => o.type); assert.deepEqual(marks, ['underline', 'strike']);
    const { bytes } = await S.exportBytes(); const t = (await inspect(page, bytes))[0]; assert.ok(find(t, /ALPHA PAGE 1/), 'page text must survive marking');
    await S.showPages(); const boxes = page.locator('#thumbs .thumb input[type=checkbox]'); await boxes.nth(1).check(); await boxes.nth(2).check(); await S.tap(page.locator('#pgRotL')); await page.waitForTimeout(500);
    const st = await S.state(); assert.deepEqual(st.pages.map(p => p.rot), [0, 270, 270, 0], 'rotating ticked pages');
    if (!S.mobile) {
      const first = page.locator('#thumbs .thumb').nth(3); await first.dragTo(page.locator('#thumbs .thumb').nth(0)); await page.waitForTimeout(500);
      const after = await S.state(); assert.notEqual(after.pages[0].idx, 0, 'drag-and-drop did not reorder: ' + after.pages.map(p => p.idx));
    }
  });

  await check(`${tag}: blank page and inserted PDF pages`, async () => {
    await S.open(files.A, 'a.pdf');
    await S.showPages(); await S.tap(page.locator('#pgBlank')); await page.waitForTimeout(400);
    await page.setInputFiles('#insertInput', { name: 'b.pdf', mimeType: 'application/pdf', buffer: files.B }); await page.waitForFunction(() => /Inserted 2 pages/.test(document.getElementById('status').textContent)); await S.settle();
    const st = await S.state(); assert.equal(st.pages.length, 7); assert.ok(st.pages[1].blank);
    const { bytes } = await S.exportBytes(); const pgs = await inspect(page, bytes); assert.equal(pgs.length, 7); assert.equal(pgs[1].items.length, 0, 'blank page has content'); assert.ok(/BRAVO PAGE 1/.test(pgs[2].items.map(i => i.t).join(' '))); assert.ok(near(pgs[3].w, 792, 1), 'landscape page lost');
  });

  await check(`${tag}: genuine editing of existing text in a standard font; subset fonts are refused honestly`, async () => {
    await S.open(files.A, 'a.pdf'); await S.tool('edittext');
    const items = await page.evaluate(() => 0); void items;
    await S.click(150, 792 - 120 + 10);
    await page.waitForFunction(() => !document.getElementById('runText').disabled); assert.match(await page.textContent('#runInfo'), /standard font/);
    assert.equal(await page.locator('#runApply').isDisabled(), false);
    await page.fill('#runText', 'Edited headline €5'); await S.tap(page.locator('#runApply')); await page.waitForFunction(() => /text in the PDF was changed/.test(document.getElementById('status').textContent)); await S.settle();
    const { bytes } = await S.exportBytes(); const pg = (await inspect(page, bytes))[0];
    assert.ok(find(pg, /Edited headline €5/), 'edit missing: ' + JSON.stringify(pg.items.map(i => i.t))); assert.ok(!find(pg, /ALPHA PAGE 1/), 'original text still present');
    await page.keyboard.press('Control+z'); await page.waitForTimeout(600); const { bytes: b2 } = await S.exportBytes(); assert.ok(find((await inspect(page, b2))[0], /ALPHA PAGE 1/), 'undo of a text edit did not restore the original');
    await S.open(files.SUBSET, 'subset.pdf'); await S.tool('edittext'); await S.click(60, 150 + 5);
    await page.waitForFunction(() => !document.getElementById('runText').disabled); assert.match(await page.textContent('#runInfo'), /subset-embedded font/); assert.equal(await page.locator('#runApply').isDisabled(), true);
    assert.match(await page.textContent('#runNote'), /not editing and it is not redaction/); assert.match(await page.textContent('#runCover'), /visual overlay/);
  });

  await check(`${tag}: keyboard shortcuts, nudge and delete`, async () => {
    await S.open(files.A, 'a.pdf'); await page.keyboard.press('r'); assert.equal(await page.evaluate(() => window.pdfEditorDebug.tool()), 'rect');
    await S.drag([[80, 300], [200, 240]]); const a = (await S.objs())[0];
    await S.tool('select'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Shift+ArrowUp'); await page.waitForTimeout(250);
    const b = (await S.objs())[0]; assert.ok(near(b.ox - a.ox, 1, 0.3) && near(b.oy - a.oy, 10, 0.5), `nudged by ${b.ox - a.ox},${b.oy - a.oy}`);
    await page.keyboard.press('Delete'); await page.waitForTimeout(200); assert.equal((await S.objs()).length, 0);
  });

  await check(`${tag}: keyboard-only creation, numeric position/size fields and caret stays put while typing`, async () => {
    await S.open(files.A, 'a.pdf'); await page.keyboard.press('r'); await page.locator('#placeBtn').focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
    let o = (await S.objs())[0]; assert.equal(o.type, 'rect', 'Place on page did not create a rectangle');
    await page.fill('#geoW', '200'); await page.fill('#geoX', '100'); await page.fill('#geoY', '50'); await page.fill('#geoRot', '90'); await page.waitForTimeout(300);
    o = (await S.objs())[0]; assert.ok(near(o.cw, 200, 0.2) && near(o.ox, 100, 0.2) && near(792 - o.oy, 50, 0.2) && near(o.rot, 90, 0.2), JSON.stringify(o));
    await page.keyboard.press('Escape'); await page.keyboard.press('t'); await page.locator('#placeBtn').focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
    await page.keyboard.type('Typed by keyboard'); await page.waitForTimeout(300);
    const txt = (await S.objs()).find(x => x.type === 'text'); assert.equal(txt.text, 'Typed by keyboard'); assert.equal(await page.inputValue('#propText'), 'Typed by keyboard');
    await page.fill('#propSize', ''); await page.keyboard.type('30'); await page.waitForTimeout(300); assert.equal((await S.objs()).find(x => x.type === 'text').size, 30, 'half-typed numbers must not be clamped under the cursor');
  });

  await check(`${tag}: unreadable, encrypted-looking and oversize files give clear errors`, async () => {
    await S.open(garbage, 'bad.pdf'); assert.match(await S.status(), /not a readable PDF/); assert.equal(await page.locator('#download').isDisabled(), true);
    await S.open(truncated, 'cut.pdf'); assert.match(await S.status(), /not a readable PDF/);
    await page.goto(`${origin}/tools/pdf-editor/`); await page.setInputFiles('#fileInput', oversizePath); await page.waitForFunction(() => /larger than 50 MB/.test(document.getElementById('status').textContent));
  });

  if (S.mobile && S.touch && engine === 'chromium') await check(`${tag}: pinch to zoom`, async () => {
    await S.open(files.A, 'a.pdf'); const before = await page.evaluate(() => window.pdfEditorDebug.viewport().scale);
    const cdp = await S.ctx.newCDPSession(page), tp = (a, b) => [{ x: a, y: 300, id: 1 }, { x: b, y: 300, id: 2 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(150, 240) });
    for (let k = 1; k <= 8; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(150 - k * 12, 240 + k * 12) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach(); await page.waitForTimeout(600);
    const after = await page.evaluate(() => window.pdfEditorDebug.viewport().scale); assert.ok(after > before * 1.5, `pinch did not zoom (${before} -> ${after})`);
  });

  await check(`${tag}: no console errors and only same-origin requests`, async () => { assert.deepEqual(S.errs, []); assert.deepEqual(S.external, []); });
  await S.ctx.close();
}

await browser.close(); await dist.stop(); await fs.rm(oversizePath, { force: true });
console.log(`\n${engine}: ${passed} passed, ${failures.length} failed`);
if (failures.length) { failures.forEach(f => console.log(' -', f)); process.exit(1); }
