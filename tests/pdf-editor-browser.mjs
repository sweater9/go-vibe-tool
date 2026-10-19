/* Browser QA for the PDF Studio editor (tools/pdf-studio/).
   node tests/pdf-editor-browser.mjs [chromium|firefox|webkit]
   env: SITE_ROOT=dist (test the built output), PLAYWRIGHT_PACKAGE, PDF_QA_ARTIFACTS (screenshots), PDF_QA_WIDTHS=1440,390
   Sample PDFs are generated with the repo's own pdf-lib bundle; exported files are re-read with pdf-lib (structure) and
   PDF.js (rendered text, positions, rotation), so the suite needs no system PDF tools. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const pw = await import(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const engine = process.argv[2] || 'chromium';
const dir = process.env.PDF_QA_ARTIFACTS || `artifacts/pdf-editor-${engine}`;
await fs.mkdir(dir, { recursive: true });
const root = process.env.SITE_ROOT ? path.resolve(process.env.SITE_ROOT) + '/' : fileURLToPath(new URL('../', import.meta.url));
const repo = fileURLToPath(new URL('../', import.meta.url));
const { PDFDocument, StandardFonts, rgb, degrees } = createRequire(import.meta.url)(path.join(repo, 'vendor/pdf-lib.min.js'));
/* Firefox cannot emulate touch in Playwright, so its phone-width runs use the mouse; other engines use real touch. */
const realTouch = engine !== 'firefox';
const WIDTHS = (process.env.PDF_QA_WIDTHS || '1440,390').split(',').map(Number);

async function samplePdf(label, sizes, { rotate = 0 } = {}) {
  const d = await PDFDocument.create(); const f = await d.embedFont(StandardFonts.HelveticaBold);
  sizes.forEach(([w, h], i) => { const p = d.addPage([w, h]); p.drawText(`${label} PAGE ${i + 1}`, { x: 40, y: h - 120, size: 36, font: f, color: rgb(.1, .2, .5) }); if (rotate) p.setRotation(degrees(rotate)); });
  return Buffer.from(await d.save());
}
const files = {
  A: await samplePdf('ALPHA', [[612, 792], [612, 792], [612, 792], [612, 792]]),
  B: await samplePdf('BRAVO', [[612, 792], [792, 612]]),
  ROT: await samplePdf('ROTSRC', [[612, 792]], { rotate: 90 }),
};
const garbage = Buffer.from('not a pdf');
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
  try {
    let f = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!f.startsWith(root.replace(/\/$/, ''))) { res.writeHead(403).end(); return; }
    if ((await fs.stat(f)).isDirectory()) f = path.join(f, 'index.html');
    res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }).end(await fs.readFile(f));
  } catch { res.writeHead(404).end('nf'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await pw[engine].launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });

let passed = 0; const failures = [];
async function check(name, fn) {
  try { await fn(); passed++; console.log('PASS', name); } catch (e) { failures.push(`${name}: ${e.message.split('\n')[0]}`); console.log('FAIL', name, '-', e.message.slice(0, 400)); }
}

async function session(w) {
  const mobile = w <= 460, touch = mobile && realTouch;
  const ctx = await browser.newContext({ viewport: { width: w, height: mobile ? 844 : 900 }, hasTouch: touch, isMobile: touch, acceptDownloads: true });
  const page = await ctx.newPage(); page.setDefaultTimeout(20000);
  const errs = [], external = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push('console: ' + m.text()); });
  page.on('request', r => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith('blob:') && !u.startsWith('data:')) external.push(u); });
  const tap = l => touch ? l.tap() : l.click();
  const status = () => page.textContent('#status');
  /* The editor sets aria-busy on <body> for the whole of every edit, so "idle" is reliable even when two actions report the same message. */
  const idle = () => page.waitForFunction(() => !document.body.hasAttribute('aria-busy'));
  const opened = () => page.waitForFunction(() => /(Opened|Could not)/.test(document.getElementById('status').textContent));
  const open = async (buf, name = 'sample.pdf') => { await page.goto(`${origin}/tools/pdf-studio/`); await page.setInputFiles('#file', { name, mimeType: 'application/pdf', buffer: buf }); await opened(); await idle(); await page.waitForTimeout(150); };
  const act = async (sel) => { await tap(page.locator(sel)); await idle(); };
  const add = async (text, size) => { await page.fill('#text', text); if (size) await page.fill('#noteSize', String(size)); await act('#addText'); };
  /* Scroll so the target point is inside the viewport first: synthetic input at off-screen coordinates is dropped. */
  const tapPage = async (fx, fy) => {
    let b = await page.locator('#canvas').boundingBox(); await page.evaluate(dy => window.scrollBy(0, dy), b.y + fy * b.height - 400);
    b = await page.locator('#canvas').boundingBox(); const x = b.x + fx * b.width, y = b.y + fy * b.height;
    if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
  };
  /* Export through the visible link, check it is a blob download link, and return the exact bytes the user would save. */
  const exportBytes = async () => {
    await tap(page.locator('#save')); await page.waitForSelector('#download a');
    const info = await page.evaluate(() => { const a = document.querySelector('#download a'); return { href: a.href.startsWith('blob:'), name: a.getAttribute('download') }; });
    assert.ok(info.href && info.name === 'govibe-edited.pdf', 'export link is not a named blob download: ' + JSON.stringify(info));
    if (engine === 'chromium') { const [d] = await Promise.all([page.waitForEvent('download'), page.locator('#download a').click()]); assert.equal(d.suggestedFilename(), 'govibe-edited.pdf'); }
    return Buffer.from(await page.evaluate(async () => { const r = await fetch(document.querySelector('#download a').href); return Array.from(new Uint8Array(await r.arrayBuffer())); }));
  };
  return { ctx, page, errs, external, mobile, touch, tap, status, idle, open, act, add, tapPage, exportBytes };
}
/* Re-read an exported PDF with PDF.js: per page, the text items with their baseline position (user space) and direction. */
async function inspect(page, bytes) {
  return page.evaluate(async b => {
    const pdfjs = await import('/tools/v9-media/vendor/pdf/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = '/tools/v9-media/vendor/pdf/pdf.worker.min.mjs';
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(b), isEvalSupported: false }).promise, out = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const p = await pdf.getPage(i), tc = await p.getTextContent(), v = p.getViewport({ scale: 1 });
      out.push({ w: v.width, h: v.height, rotate: p.rotate, items: tc.items.filter(t => t.str.trim()).map(t => ({ t: t.str, x: t.transform[4], y: t.transform[5], a: t.transform[0], b: t.transform[1] })) });
    }
    return out;
  }, Array.from(bytes));
}
const find = (pg, re) => pg.items.find(i => re.test(i.t));
const near = (a, b, tol) => Math.abs(a - b) <= tol;

for (const w of WIDTHS) {
  const tag = `${w}px`;
  const S = await session(w);
  const { page } = S;

  await check(`${tag}: open, preview painted, thumbnails, no overflow, controls >= 44px`, async () => {
    await S.open(files.A, 'a.pdf');
    assert.match(await S.status(), /Opened a\.pdf/);
    const r = await page.evaluate(() => { const c = document.getElementById('canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let ink = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 80 && d[i + 1] < 120) ink++; return { ink, thumbs: document.querySelectorAll('#pages button').length, info: document.getElementById('pageInfo').textContent.trim(), over: document.documentElement.scrollWidth - document.documentElement.clientWidth, small: [...document.querySelectorAll('button,.upload')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 43).map(e => e.id || e.textContent.trim()) }; });
    assert.ok(r.ink > 200, 'preview is blank'); assert.equal(r.thumbs, 4); assert.equal(r.info, '1 / 4'); assert.equal(r.over, 0, 'horizontal overflow'); assert.deepEqual(r.small, []);
    await page.screenshot({ path: `${dir}/open-${w}.png`, fullPage: true });
  });

  await check(`${tag}: next/previous/thumbnail navigation`, async () => {
    await S.tap(page.locator('#next')); await page.waitForFunction(() => document.getElementById('pageInfo').textContent.trim() === '2 / 4');
    await S.tap(page.locator('#pages button').nth(3)); await page.waitForFunction(() => document.getElementById('pageInfo').textContent.trim() === '4 / 4');
    await S.tap(page.locator('#prev')); await page.waitForFunction(() => document.getElementById('pageInfo').textContent.trim() === '3 / 4');
    assert.equal(await page.locator('#pages button[aria-current="page"]').count(), 1);
  });

  await check(`${tag}: text lands at top-left by default, successive notes do not overlap, tapped position is honoured`, async () => {
    await S.open(files.A);
    await S.add('FIRSTNOTE'); await S.add('SECONDNOTE');
    await S.tapPage(.5, .5); assert.equal(await page.locator('#overlay .marker').count(), 1, 'no position marker'); await S.add('TAPPED');
    const pg = (await inspect(page, await S.exportBytes()))[0];
    const a = find(pg, /FIRSTNOTE/), b = find(pg, /SECONDNOTE/), t = find(pg, /TAPPED/);
    assert.ok(a && b && t, 'notes missing: ' + JSON.stringify(pg.items.map(i => i.t)));
    assert.ok(near(a.x, 36, 3), 'first note not at left margin ' + a.x); assert.ok(pg.h - a.y < 80, 'first note not near top ' + a.y);
    assert.ok(a.y - b.y >= 14, `second note overlaps first (${a.y} vs ${b.y})`);
    assert.ok(near(t.x, pg.w / 2, 8) && near(t.y, pg.h / 2, 8), `tapped note at ${t.x},${t.y}, expected ~${pg.w / 2},${pg.h / 2}`);
    await page.screenshot({ path: `${dir}/notes-${w}.png`, fullPage: true });
  });

  await check(`${tag}: select, edit, resize, move and delete a note`, async () => {
    await S.tap(page.locator('#notes button', { hasText: 'TAPPED' })); assert.equal(await page.locator('#overlay .noteBox').count(), 1, 'no selection box');
    await page.fill('#text', 'EDITED'); await page.fill('#noteSize', '30'); await S.act('#updateNote');
    let pg = (await inspect(page, await S.exportBytes()))[0];
    assert.ok(!find(pg, /TAPPED/) && find(pg, /EDITED/), 'edit not applied'); assert.ok(near(find(pg, /EDITED/).a, 30, 1), 'size not applied');
    await S.tapPage(.25, .8); await S.act('#moveNote');
    pg = (await inspect(page, await S.exportBytes()))[0]; const m = find(pg, /EDITED/);
    assert.ok(near(m.x, .25 * pg.w, 8) && near(m.y, .2 * pg.h, 8), `moved to ${m.x},${m.y}`);
    await S.act('#deleteNote'); pg = (await inspect(page, await S.exportBytes()))[0];
    assert.ok(!find(pg, /EDITED/), 'note not deleted');
  });

  await check(`${tag}: undo restores edits and page deletion; empty/unsupported text rejected`, async () => {
    await S.act('#undo'); let pg = (await inspect(page, await S.exportBytes()))[0]; assert.ok(find(pg, /EDITED/), 'undo did not restore the note');
    await S.open(files.A); await S.add('KEEPME');
    await S.act('#next'); await S.act('#remove'); assert.equal(await page.locator('#pages button').count(), 3);
    await S.act('#undo'); assert.equal(await page.locator('#pages button').count(), 4); assert.match(await page.locator('#pages button').first().textContent(), /1 note/);
    const before = await page.locator('#notes button').count();
    await page.fill('#text', ''); await S.tap(page.locator('#addText')); await page.waitForFunction(() => /Enter text first/.test(document.getElementById('status').textContent));
    await page.fill('#text', 'مرحبا 😀'); await S.tap(page.locator('#addText')); await page.waitForFunction(() => /cannot draw/.test(document.getElementById('status').textContent));
    assert.equal(await page.locator('#notes button').count(), before, 'rejected text was added anyway');
  });

  await check(`${tag}: rotate, reorder and delete pages; notes follow their page`, async () => {
    await S.open(files.A);
    await S.tap(page.locator('#next')); await page.waitForFunction(() => document.getElementById('pageInfo').textContent.trim() === '2 / 4');
    await S.add('NOTEP2'); await S.act('#rotate'); await S.act('#moveUp');
    let pgs = await inspect(page, await S.exportBytes());
    assert.equal(pgs.length, 4); assert.ok(find(pgs[0], /NOTEP2/) && /ALPHA PAGE 2/.test(pgs[0].items.map(i => i.t).join(' ')), 'note did not follow its page');
    assert.equal(pgs[0].rotate, 90, 'rotation not exported'); assert.ok(pgs.slice(1).every(p => p.rotate === 0));
    await S.act('#remove'); pgs = await inspect(page, await S.exportBytes());
    assert.equal(pgs.length, 3); assert.ok(!pgs.some(p => find(p, /NOTEP2/)), 'note survived deletion of its page'); assert.ok(/ALPHA PAGE 1/.test(pgs[0].items.map(i => i.t).join(' ')));
  });

  await check(`${tag}: notes stay upright on a rotated page and on a source-rotated page`, async () => {
    await S.open(files.A); await S.act('#rotate'); await S.add('UPRIGHT');
    let pg = (await inspect(page, await S.exportBytes()))[0], t = find(pg, /UPRIGHT/);
    assert.equal(pg.rotate, 90); assert.ok(t, 'missing');
    await S.open(files.ROT, 'rot.pdf'); await S.add('UPRIGHT2'); pg = (await inspect(page, await S.exportBytes()))[0]; t = find(pg, /UPRIGHT2/);
    assert.equal(pg.rotate, 90); assert.ok(t, 'missing on source-rotated page');
    /* Drawn rotated by the page rotation, so in user space the baseline points along +y (a=0,b=1) for a 90-degree page. */
    assert.ok(near(t.a, 0, .01) && near(t.b, 14, .5), `text not turned with the page: a=${t.a} b=${t.b}`);
  });

  await check(`${tag}: merge keeps notes, adds pages; selected page downloads with its note; export re-opens`, async () => {
    await S.open(files.A); await S.add('KEEPNOTE');
    await page.setInputFiles('#mergeFile', { name: 'b.pdf', mimeType: 'application/pdf', buffer: files.B }); await page.waitForFunction(() => /Merged 2/.test(document.getElementById('status').textContent)); await S.idle();
    const bytes = await S.exportBytes(), pgs = await inspect(page, bytes);
    assert.equal(pgs.length, 6); assert.ok(find(pgs[0], /KEEPNOTE/)); assert.ok(/BRAVO PAGE 1/.test(pgs[4].items.map(i => i.t).join(' '))); assert.ok(near(pgs[5].w, 792, 1), 'landscape page lost');
    await S.tap(page.locator('#split')); await page.waitForSelector('#download a');
    const one = Buffer.from(await page.evaluate(async () => { const r = await fetch(document.querySelector('#download a').href); return Array.from(new Uint8Array(await r.arrayBuffer())); }));
    const single = await inspect(page, one); assert.equal(single.length, 1); assert.ok(find(single[0], /KEEPNOTE/), 'selected-page download lost its note');
    await page.setInputFiles('#file', { name: 'edited.pdf', mimeType: 'application/pdf', buffer: bytes }); await page.waitForFunction(() => /Opened edited\.pdf/.test(document.getElementById('status').textContent));
    assert.equal(await page.locator('#pages button').count(), 6);
    const doc = await PDFDocument.load(bytes); assert.equal(doc.getPageCount(), 6);
  });

  await check(`${tag}: a double tap on Delete removes only one page`, async () => {
    await S.open(files.A); await page.locator('#remove').dblclick(); await page.waitForTimeout(1000);
    assert.equal(await page.locator('#pages button').count(), 3);
  });

  await check(`${tag}: unreadable and damaged files give clear errors and keep Export disabled`, async () => {
    await S.open(garbage, 'bad.pdf'); assert.match(await S.status(), /not a readable PDF/); assert.ok(await page.locator('#save').isDisabled());
    await S.open(files.A.subarray(0, Math.floor(files.A.length * .6)), 'cut.pdf'); assert.match(await S.status(), /not a readable PDF/);
  });

  await check(`${tag}: no console errors and only same-origin requests`, async () => { assert.deepEqual(S.errs, []); assert.deepEqual(S.external, []); });
  await S.ctx.close();
}

await browser.close(); server.close();
console.log(`\n${engine}: ${passed} passed, ${failures.length} failed`);
if (failures.length) { failures.forEach(f => console.log(' -', f)); process.exit(1); }
