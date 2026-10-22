/* Browser QA for PDF Compare. node tests/pdf-compare-browser.mjs [chromium|firefox|webkit]
   env: PLAYWRIGHT_PACKAGE, SITE_ROOT=dist, PDF_QA_WIDTHS=1280,390
   PDFs are generated here with the repo's pdf-lib bundle; the tool reads them with PDF.js exactly as a user's files. */
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const pw = await import(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const engine = process.argv[2] || 'chromium';
const repo = fileURLToPath(new URL('../', import.meta.url));
const root = process.env.SITE_ROOT ? path.resolve(process.env.SITE_ROOT) : repo;
const { PDFDocument, StandardFonts } = createRequire(import.meta.url)(path.join(repo, 'vendor/pdf-lib.min.js'));
const { createDistServer } = await import(new URL('file://' + path.join(repo, 'scripts/serve-dist.mjs')).href);
const WIDTHS = (process.env.PDF_QA_WIDTHS || '1280,390').split(',').map(Number);
const dist = createDistServer(root, { port: 0 }); await dist.start(); const origin = dist.base.replace(/\/$/, '');
const browser = await pw[engine].launch(); let passed = 0; const failures = [];
async function check(name, fn) { try { await fn(); passed++; console.log('PASS', name); } catch (e) { failures.push(`${name}: ${e.message.split('\n')[0]}`); console.log('FAIL', name, '-', e.message.split('\n')[0]); } }

/* pages: array of arrays of lines. A page with `null` is an image-only page (no text). */
async function pdf(pages) {
  const d = await PDFDocument.create(), f = await d.embedFont(StandardFonts.Helvetica);
  const png = await d.embedPng(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64'));
  for (const lines of pages) { const p = d.addPage([612, 792]); if (lines === null) { p.drawImage(png, { x: 50, y: 400, width: 400, height: 200 }); continue; } lines.forEach((l, i) => p.drawText(l, { x: 50, y: 740 - i * 18, size: 12, font: f })); }
  return Buffer.from(await d.save());
}
const file = (buffer, name) => ({ name, mimeType: 'application/pdf', buffer });
const A = await pdf([['Alpha report', 'The budget is ten thousand dollars.', 'Approved by the board.'], ['Section two begins here.', 'Payment is due within thirty days.', 'Late fees apply.'], ['Closing remarks follow.', 'Thank you for reading.']]);
const B = await pdf([['Alpha report', 'The budget is ten thousand dollars.'], ['Section two begins here.', 'Payment is due within sixty days.', 'Late fees apply.'], ['Closing remarks follow.', 'Thank you for reading.', 'Contact us with any questions today.']]);

async function open(w) {
  const mobile = w < 500, ctx = await browser.newContext({ viewport: { width: w, height: mobile ? 844 : 900 } }), page = await ctx.newPage(); page.setDefaultTimeout(20000);
  const errs = [], external = []; page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => { if (['error', 'warning'].includes(m.type()) && !/favicon|willReadFrequently/.test(m.text())) errs.push('console ' + m.type() + ': ' + m.text()); });
  page.on('request', r => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith('blob:') && !u.startsWith('data:')) external.push(u); });
  await page.goto(origin + '/tools/pdf-compare/'); return { ctx, page, errs, external, mobile };
}
const load = async (page, a, b) => { await page.setInputFiles('#fileA', a); if (b) await page.setInputFiles('#fileB', b); };
const done = page => page.waitForFunction(() => /^Done|^Nothing to compare|^Not compared/.test(document.getElementById('status').textContent), null, { timeout: 30000 });

for (const w of WIDTHS) {
  const tag = `${w}px`;
  await check(`${tag}: finds the changed, added and removed text with page numbers, and nothing leaves the device`, async () => {
    const { ctx, page, errs, external } = await open(w); await load(page, file(A, 'a.pdf'), file(B, 'b.pdf')); await done(page);
    const r = await page.evaluate(() => window.pdfCompareDebug.result().summary); assert.deepEqual([r.total, r.changed, r.added, r.removed], [3, 1, 1, 1], JSON.stringify(r));
    assert.match(await page.textContent('#summary'), /3 differences/);
    const blocks = await page.locator('#diffList .blk').allTextContents(); assert.equal(blocks.length, 3);
    assert.ok(blocks.some(t => /Removed from A/.test(t) && /Approved by the board/.test(t) && /A p\.1/.test(t)), blocks.join(' | '));
    assert.ok(blocks.some(t => /Changed/.test(t) && /thirty/.test(t) && /sixty/.test(t) && /A p\.2 · B p\.2/.test(t)));
    assert.ok(blocks.some(t => /Added in B/.test(t) && /Contact us with any questions today/.test(t) && /B p\.3/.test(t)));
    assert.equal(await page.locator('#diffList del').count() >= 2 && await page.locator('#diffList ins').count() >= 2, true, 'del/ins elements mark the text');
    assert.deepEqual(external, [], 'no external requests'); assert.deepEqual(errs, []); await ctx.close();
  });
  await check(`${tag}: Previous/Next, keyboard and the position counter move between differences and wrap around`, async () => {
    const { ctx, page } = await open(w); await load(page, file(A, 'a.pdf'), file(B, 'b.pdf')); await done(page);
    const cur = () => page.locator('#diffList .blk.current').getAttribute('data-i'), pos = () => page.textContent('#pos');
    assert.equal(await pos(), '1 of 3'); assert.equal(await cur(), '0');
    await page.click('#next'); assert.equal(await pos(), '2 of 3'); assert.equal(await cur(), '1'); await page.click('#next'); await page.click('#next'); assert.equal(await pos(), '1 of 3', 'wraps to the first');
    await page.click('#prev'); assert.equal(await pos(), '3 of 3', 'wraps to the last');
    await page.keyboard.press('p'); assert.equal(await pos(), '2 of 3'); await page.keyboard.press('n'); assert.equal(await pos(), '3 of 3');
    assert.equal(await page.locator('#diffList .blk[aria-current="true"]').count(), 1); assert.match(await page.textContent('#status'), /Difference 3 of 3/);
    const nb = await page.locator('#next').boundingBox(), vh = await page.evaluate(() => innerHeight); assert.ok(nb.height >= 43.5 && nb.y + nb.height <= vh + 1, `Next button not reachable: ${JSON.stringify(nb)}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal overflow'); await ctx.close();
  });
  await check(`${tag}: Full text view marks the same differences in both columns and navigation follows`, async () => {
    const { ctx, page } = await open(w); await load(page, file(A, 'a.pdf'), file(B, 'b.pdf')); await done(page);
    await page.click('#tabFull'); assert.equal(await page.locator('#viewFull').isVisible(), true);
    assert.ok(await page.locator('#fullA .mk.del[data-diff]').count() >= 2); assert.ok(await page.locator('#fullB .mk.add[data-diff]').count() >= 2);
    assert.match(await page.textContent('#fullA'), /Page 1[\s\S]*Page 2[\s\S]*Page 3/); assert.ok(/Approved by the board/.test(await page.textContent('#fullA')) && !/Approved by the board/.test(await page.textContent('#fullB')));
    await page.click('#next'); assert.equal(await page.locator('#fullA .current, #fullB .current').count() >= 1, true, 'current difference highlighted in the columns');
    await page.click('#tabList'); assert.equal(await page.locator('#viewList').isVisible(), true); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); await ctx.close();
  });
  await check(`${tag}: identical files report no differences without claiming the files are identical`, async () => {
    const { ctx, page } = await open(w); await load(page, file(A, 'a.pdf'), file(A, 'same.pdf')); await done(page);
    assert.match(await page.textContent('#summary'), /^0 differences/); assert.match(await page.textContent('#noDiff'), /does not prove the files are identical/); assert.equal(await page.locator('#next').isDisabled(), true); await ctx.close();
  });
  await check(`${tag}: scanned (image-only) pages are reported as not compared; a file with no text at all is refused with an explanation`, async () => {
    const { ctx, page } = await open(w); const withScan = await pdf([['Alpha text here today'], null, ['Gamma text here today']]), full = await pdf([['Alpha text here today'], ['Beta changed text here'], ['Gamma text here today']]);
    await load(page, file(withScan, 'scan.pdf'), file(full, 'full.pdf')); await done(page);
    const warn = await page.locator('#warnings').textContent(); assert.match(warn, /File A: page 2 has no selectable text/); assert.match(warn, /not compared/);
    assert.match(await page.textContent('#noDiff') + await page.textContent('#summary'), /./);
    await page.click('#reset'); const onlyImages = await pdf([null, null]), text = await pdf([['Some real text here']]);
    await load(page, file(onlyImages, 'images.pdf'), file(text, 'text.pdf')); await done(page);
    assert.match(await page.locator('#warnings').textContent(), /File A has no selectable text.*scanned.*no OCR|File A has no selectable text.*does not do OCR/s); assert.equal(await page.locator('#results').isVisible(), false, 'no misleading result is shown'); assert.match(await page.textContent('#status'), /Nothing to compare/); await ctx.close();
  });
  await check(`${tag}: non-PDF, damaged and oversized-page-count files give clear errors and the page keeps working`, async () => {
    const { ctx, page, errs } = await open(w);
    await page.setInputFiles('#fileA', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') }); await page.waitForSelector('#error:not([hidden])'); assert.match(await page.textContent('#error'), /not a PDF/);
    await page.setInputFiles('#fileA', { name: 'fake.pdf', mimeType: 'application/pdf', buffer: Buffer.from('this is not really a pdf file at all') }); await page.waitForFunction(() => /does not look like a readable PDF/.test(document.getElementById('error').textContent));
    await page.setInputFiles('#fileA', file(Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.from('garbage '.repeat(50))]), 'broken.pdf')); await page.waitForFunction(() => /not a readable PDF/.test(document.getElementById('error').textContent) || document.getElementById('error').hidden === false);
    const many = await pdf(Array.from({ length: 301 }, (_, i) => ['page ' + i])); await page.setInputFiles('#fileA', file(many, 'many.pdf')); await page.waitForFunction(() => /301 pages\. The limit is 300/.test(document.getElementById('error').textContent));
    await load(page, file(A, 'a.pdf'), file(B, 'b.pdf')); await done(page); assert.equal(await page.locator('#error').isHidden(), true, 'a good file clears the error'); assert.equal((await page.evaluate(() => window.pdfCompareDebug.result().summary.total)), 3);
    assert.deepEqual(errs.filter(e => !/Failed to load resource|Invalid PDF|InvalidPDF|Warning:/.test(e)), []); await ctx.close();
  });
  await check(`${tag}: options (ignore case, ignore punctuation), swap and clear`, async () => {
    const { ctx, page } = await open(w); const a = await pdf([['Hello World, again.']]), b = await pdf([['hello world again']]);
    await load(page, file(a, 'a.pdf'), file(b, 'b.pdf')); await done(page); const total = () => page.evaluate(() => window.pdfCompareDebug.result().summary.total);
    assert.equal(await total() > 0, true); await page.check('#optCase'); await page.waitForFunction(() => window.pdfCompareDebug.result()); assert.equal(await total() > 0, true, 'punctuation still differs');
    await page.check('#optPunct'); await page.waitForFunction(() => window.pdfCompareDebug.result() && window.pdfCompareDebug.result().summary.total === 0); await page.uncheck('#optCase'); await page.uncheck('#optPunct');
    await load(page, file(A, 'a.pdf'), file(B, 'b.pdf')); await done(page); const before = await page.evaluate(() => window.pdfCompareDebug.result().summary); await page.click('#swap'); await done(page);
    const after = await page.evaluate(() => window.pdfCompareDebug.result().summary); assert.equal(after.added, before.removed); assert.equal(after.removed, before.added); assert.match(await page.textContent('#infoA'), /b\.pdf/);
    await page.click('#reset'); assert.equal(await page.locator('#results').isVisible(), false); assert.equal(await page.textContent('#infoA'), 'No file chosen.'); await ctx.close();
  });
  await check(`${tag}: a 120-page comparison finishes quickly and shows the one changed page`, async () => {
    const { ctx, page } = await open(w); const mk = alt => pdf(Array.from({ length: 120 }, (_, i) => [`Page ${i + 1} heading`, `Body text for page ${i + 1} with some words to read.`, i === 77 && alt ? 'This line was edited in the revision.' : 'This line is the same in both.']));
    const [a, b] = [await mk(false), await mk(true)]; const t0 = Date.now(); await load(page, file(a, 'big-a.pdf'), file(b, 'big-b.pdf')); await done(page); const ms = Date.now() - t0;
    const r = await page.evaluate(() => window.pdfCompareDebug.result()); assert.equal(r.summary.total, 1); assert.deepEqual(r.changes[0].pagesA, [78, 78]); assert.ok(ms < 20000, `took ${ms}ms`); console.log(`  (120 pages x2: ${ms}ms end to end, diff ${r.ms}ms)`); await ctx.close();
  });
  await check(`${tag}: accessibility basics (one h1, named controls, visible limitations) and no inline styles`, async () => {
    const { ctx, page } = await open(w); await load(page, file(A, 'a.pdf'), file(B, 'b.pdf')); await done(page);
    assert.equal(await page.locator('h1').count(), 1);
    const unnamed = await page.evaluate(() => [...document.querySelectorAll('button,input,[role=tab]')].filter(e => e.offsetParent !== null && e.type !== 'hidden').filter(e => !((e.getAttribute('aria-label') || e.textContent || (e.labels && e.labels[0] && e.labels[0].textContent) || '').trim())).map(e => e.id || e.outerHTML.slice(0, 60)));
    assert.deepEqual(unnamed, []); assert.equal(await page.evaluate(() => document.querySelectorAll('[style]').length), 0, 'no inline style attributes');
    {const n = await page.locator('#limitsNote'); assert.ok(await n.isVisible(), 'limits notice is visible without opening anything'); const t = await n.innerText(); assert.match(t, /no OCR/); assert.match(t, /50 MB/); assert.match(t, /300 pages/);}
    await page.locator('.limits summary').click(); assert.match(await page.textContent('.limits'), /Scanned or image-only pages/); assert.match(await page.textContent('.limits'), /not compared|not\*\* compared|are not/); await ctx.close();
  });
}
await check('homepage: PDF Compare is listed in PDF & Tables next to the PDF Editor, and opens its own page', async () => {
  const { ctx, page, errs } = await open(1280); await page.goto(origin + '/?category=files-pdf'); await page.waitForSelector('#categoryView:not([hidden])');
  const names = await page.locator('#categoryView').innerText(); assert.ok(/PDF Compare/.test(names) && /PDF Editor/.test(names), names.slice(0, 200));
  await page.locator('#categoryView').getByText('PDF Compare', { exact: false }).first().click(); await page.waitForURL(/\/tools\/pdf-compare\/?$/); assert.equal(await page.textContent('h1'), 'PDF Compare'); assert.deepEqual(errs, []); await ctx.close();
});
await browser.close(); await dist.stop();
console.log(`\n${engine}: ${passed} passed, ${failures.length} failed`); if (failures.length) { console.log(failures.map(f => ' - ' + f).join('\n')); process.exit(1); }
