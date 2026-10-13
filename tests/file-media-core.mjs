/* Unit tests for the V8 file & media tools: Markdown/CSV/TSV table core, image metadata scanner, ZIP writer, helpers,
   plus static integration checks (registration, service worker, notices, no network code). Browser behaviour is in file-media-browser.mjs. */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import * as F from './helpers/file-media-fixtures.mjs';
const require = createRequire(import.meta.url);
const T = require('../tools/file-media/fm-table.js');
const I = require('../tools/file-media/fm-image.js');

let passed = 0, failed = 0;
function ok(name, fn) { try { fn(); passed++; console.log('PASS', name); } catch (e) { failed++; console.log('FAIL', name, '::', e.message.split('\n')[0]); } }

/* ---------------- CSV / TSV parsing ---------------- */
ok('CSV: quotes, escaped quotes, commas, tabs, CRLF and embedded newlines', () => {
  const r = T.parseDelimited('a,b,c\r\n"x, y","say ""hi""","line1\nline2"\r\n"tab\there",,"" \r\n', ',').rows;
  assert.deepEqual(r, [['a', 'b', 'c'], ['x, y', 'say "hi"', 'line1\nline2'], ['tab\there', '', ' ']]);
});
ok('CSV: BOM, no trailing newline, empty trailing field, lone CR rows', () => {
  assert.deepEqual(T.parseDelimited('﻿a,b\r1,2', ',').rows, [['a', 'b'], ['1', '2']]);
  assert.deepEqual(T.parseDelimited('a,b,', ',').rows, [['a', 'b', '']]);
  assert.deepEqual(T.parseDelimited('', ',').rows, []);
  assert.deepEqual(T.parseDelimited('"only"', ',').rows, [['only']]);
});
ok('CSV: unclosed quote is reported, not swallowed silently', () => {
  const r = T.parseDelimited('a,"b\nc', ','); assert.equal(r.rows[0][1], 'b\nc'); assert.equal(r.warnings.length, 1);
});
ok('TSV from Google Sheets / Excel: commas stay inside cells; quoted multi-line cells survive', () => {
  const t = 'Name\tNote\nAda\t"likes commas, and ""quotes"""\nBob\t"two\nlines"\n';
  assert.equal(T.detectDelimiter(t), '\t');
  assert.deepEqual(T.parseDelimited(t, '\t').rows, [['Name', 'Note'], ['Ada', 'likes commas, and "quotes"'], ['Bob', 'two\nlines']]);
});
ok('delimiter detection: comma, semicolon, pipe; ignores delimiters inside quotes', () => {
  assert.equal(T.detectDelimiter('a,b,c\n1,2,3'), ',');
  assert.equal(T.detectDelimiter('a;b;c\n1;2;3'), ';');
  assert.equal(T.detectDelimiter('a|b|c\n1|2|3'), '|');
  assert.equal(T.detectDelimiter('"a,b",c\n"1,2",3'), ',');
});

/* ---------------- Markdown tables ---------------- */
ok('Markdown: GFM alignment row, escaped pipes, <br>, optional outer pipes', () => {
  const p = T.parseMarkdownTable('| L | C | R | N |\n| :--- | :---: | ---: | --- |\n| a \\| b | x<br>y | 1 | |\nc | d | e | f');
  assert.equal(p.ok, true);
  assert.deepEqual(p.align, ['left', 'center', 'right', 'none']);
  assert.deepEqual(p.rows, [['L', 'C', 'R', 'N'], ['a | b', 'x\ny', '1', ''], ['c', 'd', 'e', 'f']]);
});
ok('Markdown: table surrounded by prose; only the first of several tables is used and that is reported', () => {
  const p = T.parseMarkdownTable('Intro text\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\nmore\n\n| x | y |\n|---|---|\n| 3 | 4 |');
  assert.deepEqual(p.rows, [['a', 'b'], ['1', '2']]); assert.ok(p.warnings.some(w => /2 tables/.test(w)));
});
ok('Markdown: rows with extra cells widen the table (no silent data loss); short rows are padded', () => {
  const p = T.parseMarkdownTable('| a | b |\n|---|---|\n| 1 | 2 | 3 |\n| 4 |');
  assert.deepEqual(p.rows, [['a', 'b', ''], ['1', '2', '3'], ['4', '', '']]);
  assert.ok(p.warnings.some(w => /widened/.test(w)) && p.warnings.some(w => /padded/.test(w)));
});
ok('Markdown: text without a table is a clear error, not an empty result', () => {
  const r = T.convert('just some text | with a pipe', { from: 'markdown', to: 'csv' }); assert.equal(r.ok, false); assert.match(r.error, /No Markdown table/);
});
ok('Markdown output: alignment markers, auto right-align for numeric columns, padding on/off', () => {
  const m = T.toMarkdown([['Item', 'Qty'], ['Apple', '3'], ['Pear', '10']], { align: 'auto' }).text.split('\n');
  assert.match(m[1], /^\| -+ \| -+: \|$/); assert.equal(m[0].length, m[2].length);
  const c = T.toMarkdown([['a', 'b'], ['1', '2']], { align: ['left', 'center'], pad: false }).text.split('\n');
  assert.equal(c[1], '| :-- | :-: |');
  assert.equal(T.toMarkdown([['a'], ['1']], { firstRowHeader: false, pad: false }).text.split('\n')[0], '| Column 1 |');
});
ok('Markdown output: pipes escaped, newlines become <br>, a warning explains it', () => {
  const r = T.toMarkdown([['h'], ['a|b\nc']], {});
  assert.match(r.text, /a\\\|b<br>c/); assert.ok(r.warnings.some(w => /<br>/.test(w)));
});

/* ---------------- conversions both ways ---------------- */
ok('CSV -> Markdown -> CSV keeps quotes, commas and multi-line cells', () => {
  const csv = 'name,note\n"Smith, J","said ""hi"""\n"multi\nline",x';
  const md = T.convert(csv, { to: 'markdown' });
  assert.equal(md.detected, 'csv');
  const back = T.convert(md.text, { to: 'csv' });
  assert.equal(back.detected, 'markdown');
  assert.deepEqual(T.parseDelimited(back.text, ',').rows, T.parseDelimited(csv, ',').rows);
});
ok('Markdown -> TSV is paste-ready: tab separated, awkward cells quoted', () => {
  const r = T.convert('| a | b |\n|---|---|\n| x<br>y | "q" |', { to: 'tsv' });
  assert.equal(r.text, 'a\tb\n"x\ny"\t"""q"""');
  assert.deepEqual(T.parseDelimited(r.text, '\t').rows, [['a', 'b'], ['x\ny', '"q"']]);
});
ok('Excel/Sheets tab data -> Markdown with auto alignment', () => {
  const r = T.convert('Product\tPrice\nTea\t3.50\nCoffee\t4', { to: 'markdown', align: 'auto' });
  assert.match(r.text.split('\n')[1], /-: \|$/);
});
ok('property test: random tricky cells survive CSV and TSV round trips exactly', () => {
  let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const alphabet = ['a', 'B', ' ', ',', '\t', '"', "'", '\n', '\r\n', ';', '|', '=', 'é', '日', '😀', '\\', '<', '&'];
  for (let n = 0; n < 300; n++) {
    const rows = Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => Array.from({ length: 2 + Math.floor(rnd() * 3) }, () => Array.from({ length: Math.floor(rnd() * 6) }, () => alphabet[Math.floor(rnd() * alphabet.length)]).join('')));
    const width = rows[0].length; rows.forEach(r => { while (r.length < width) r.push(''); r.length = width; });
    // a row whose only cell is empty serialises to an empty line, which CSV cannot distinguish from "no row"
    if (width === 1) continue;
    for (const [d, key] of [[',', 'csv'], ['\t', 'tsv']]) {
      const text = T.toDelimited(rows, d, {}).text;
      assert.deepEqual(T.parseDelimited(text, d).rows, rows.map(r => r.map(c => c.replace(/\r\n/g, '\r\n'))), key + ' round trip failed for ' + JSON.stringify(rows));
    }
  }
});
ok('property test: Markdown round trip for cells without leading/trailing space or literal <br>', () => {
  let seed = 99; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const alphabet = ['a', 'B', 'x y', '|', '\n', 'é', '1', '*', '`', '"', ','];
  for (let n = 0; n < 200; n++) {
    const w = 2 + Math.floor(rnd() * 3), rows = Array.from({ length: 2 + Math.floor(rnd() * 3) }, () => Array.from({ length: w }, () => { const s = Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => alphabet[Math.floor(rnd() * alphabet.length)]).join('').replace(/^\s+|\s+$/g, ''); return s || 'z'; }));
    const md = T.toMarkdown(rows, {}).text, back = T.parseMarkdownTable(md);
    assert.equal(back.ok, true, md); assert.deepEqual(back.rows, rows, md);
  }
});
ok('known limitation is explicit: a literal "<br>" typed into a cell becomes a line break when converting Markdown -> CSV', () => {
  const md = T.toMarkdown([['h'], ['a<br>b']], {}).text; assert.equal(T.parseMarkdownTable(md).rows[1][0], 'a\nb');
  assert.equal(T.parseMarkdownTable(md, { brToNewline: false }).rows[1][0], 'a<br>b');
});
ok('spreadsheet formula injection: warned by default, neutralised on request, numbers untouched', () => {
  const rows = [['x'], ['=1+1'], ['-5'], ['@SUM(A1)'], ['+49 123']];
  const w = T.toDelimited(rows, ',', {}); assert.match(w.warnings[0], /3 cells/);
  const p = T.toDelimited(rows, ',', { protectFormulas: true }); assert.deepEqual(p.text.split('\n'), ['x', "'=1+1", '-5', "'@SUM(A1)", "'+49 123"]);
});
ok('limits: empty input and oversize input are reported', () => {
  assert.equal(T.convert('   ', {}).ok, false);
  assert.match(T.convert('a,b\n' + 'x'.repeat(T.MAX_CHARS + 1), {}).error, /larger than/);
});

/* ---------------- image helpers ---------------- */
ok('formatBytes / percentSaved / savingsLabel / names', () => {
  assert.equal(I.formatBytes(512), '512 B'); assert.equal(I.formatBytes(1536), '1.50 KB'); assert.equal(I.formatBytes(5 * 1048576), '5.00 MB');
  assert.equal(I.percentSaved(1000, 250), 75); assert.equal(I.savingsLabel(1000, 1100), '10.0% larger'); assert.equal(I.savingsLabel(0, 0), 'same size');
  assert.equal(I.outputName('../../My Photo.HEIC', 'image/webp', '-x'), 'My Photo-x.webp'); assert.equal(I.outputName('', 'image/avif'), 'image.avif');
  const used = {}; assert.deepEqual(['a.jpg', 'a.jpg', 'a.jpg'].map(n => I.uniqueName(n, used)), ['a.jpg', 'a (2).jpg', 'a (3).jpg']);
});

/* ---------------- metadata scanner ---------------- */
const kinds = r => r.found.map(f => f.kind);
ok('scanner: JPEG EXIF (big endian) with GPS, orientation and camera tags', () => {
  const r = I.scanMetadata(F.fakeJpeg([F.exifSegment({ orientation: 6, gps: true })]));
  assert.equal(r.format, 'jpeg'); assert.deepEqual(kinds(r), ['EXIF']); assert.equal(r.gps, true); assert.equal(r.orientation, 6);
  assert.match(r.found[0].detail, /Make/); assert.match(r.found[0].detail, /GPS location/);
});
ok('scanner: JPEG EXIF (little endian), no GPS', () => {
  const r = I.scanMetadata(F.fakeJpeg([F.exifSegment({ littleEndian: true, gps: false, orientation: 3 })]));
  assert.equal(r.gps, false); assert.equal(r.orientation, 3); assert.doesNotMatch(r.found[0].detail, /GPS/);
});
ok('scanner: XMP, IPTC, ICC and comment segments are each detected', () => {
  const r = I.scanMetadata(F.fakeJpeg([F.xmpSegment(), F.iptcSegment(), F.iccSegment(), F.commentSegment()]));
  assert.deepEqual(kinds(r).sort(), ['COMMENT', 'ICC', 'IPTC', 'XMP']);
  assert.deepEqual(I.personalFindings(r).map(f => f.kind).sort(), ['COMMENT', 'ICC', 'IPTC', 'XMP'], 'an unnamed/unknown profile is treated as possibly personal');
});
ok('scanner: a standard sRGB profile (what browsers add themselves) is recognised and not counted as personal data', () => {
  // minimal ICC v2 profile with a "desc" tag saying "sRGB"
  const desc = new TextEncoder().encode('sRGB\0'), body = new Uint8Array(200); const dv = new DataView(body.buffer);
  dv.setUint32(128, 1); body.set(new TextEncoder().encode('desc'), 132); dv.setUint32(136, 144); dv.setUint32(140, 12 + 4 + desc.length);
  body.set(new TextEncoder().encode('desc'), 144); dv.setUint32(152, desc.length); body.set(desc, 156);
  const seg = Uint8Array.from([0xff, 0xe2, (body.length + 16) >> 8, (body.length + 16) & 255, ...new TextEncoder().encode('ICC_PROFILE\0'), 1, 1, ...body]);
  const r = I.scanMetadata(F.fakeJpeg([seg])); assert.equal(r.found[0].description, 'sRGB'); assert.equal(r.found[0].standard, true); assert.deepEqual(I.personalFindings(r), []);
  assert.equal(I.iccDescription(body, 0, body.length), 'sRGB');
});
ok('scanner: a clean JPEG reports nothing and no signatures', () => {
  const r = I.scanMetadata(F.fakeJpeg([])); assert.deepEqual(r.found, []); assert.deepEqual(r.signatures, []);
});
ok('scanner: truncated / malformed EXIF does not throw', () => {
  const bad = F.fakeJpeg([Uint8Array.of(0xff, 0xe1, 0x00, 0x0c, 0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 42)]);
  assert.doesNotThrow(() => I.scanMetadata(bad)); assert.deepEqual(I.scanMetadata(bad).found.map(f => f.kind), ['EXIF']);
  assert.doesNotThrow(() => I.scanMetadata(Uint8Array.of(0xff, 0xd8, 0xff))); assert.doesNotThrow(() => I.scanMetadata(new Uint8Array(0)));
});
ok('scanner: PNG tEXt, iTXt XMP, eXIf, tIME and animation (acTL)', () => {
  const base = F.injectPng(F.fromB64('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), [F.pngText('Author', 'Jane'), F.pngXmp(), F.pngExif({ gps: true }), F.pngTime()]);
  const r = I.scanMetadata(base); assert.equal(r.format, 'png'); assert.deepEqual(kinds(r).sort(), ['EXIF', 'TEXT', 'TIME', 'XMP']); assert.equal(r.gps, true);
  assert.deepEqual(I.scanMetadata(F.fromB64('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==')).found, []);
});
ok('scanner: WebP RIFF EXIF/XMP/ICC chunks and animation flag; GIF comment and frames', () => {
  const w = I.scanMetadata(F.fakeWebp([['VP8X', new Uint8Array(10)], ['EXIF', F.exifTiff({})], ['XMP ', new TextEncoder().encode('<x/>')], ['ICCP', Uint8Array.of(1, 2)]]));
  assert.equal(w.format, 'webp'); assert.deepEqual(kinds(w).sort(), ['EXIF', 'ICC', 'XMP']);
  const vp8x = new Uint8Array(10); vp8x[0] = 0x02; assert.equal(I.scanMetadata(F.fakeWebp([['VP8X', vp8x]])).animated, true);
  const gif = Uint8Array.from([...new TextEncoder().encode('GIF89a'), 1, 0, 1, 0, 0, 0, 0, 0x21, 0xfe, 3, 0x61, 0x62, 0x63, 0, 0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x44, 1, 0, 0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x44, 1, 0, 0x3b]);
  const g = I.scanMetadata(gif); assert.equal(g.format, 'gif'); assert.deepEqual(kinds(g), ['COMMENT']); assert.equal(g.animated, true);
});
ok('scanner: raw signature search backs up the structural scan; format sniffing', () => {
  assert.ok(I.sniffSignatures(new TextEncoder().encode('xxExif\0\0yy')).length === 1);
  assert.deepEqual(I.sniffSignatures(new TextEncoder().encode('plain pixels only')), []);
  assert.equal(I.sniffFormat(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')), 'svg');
  assert.equal(I.sniffFormat(Uint8Array.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66])), 'avif');
  assert.equal(I.sniffFormat(Uint8Array.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63])), 'heic');
});

/* ---------------- ZIP writer ---------------- */
function readZip(b) { // independent minimal reader: central directory -> entries, verifies CRC32 and stored sizes
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength); let e = b.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  assert.ok(e >= 0, 'end of central directory'); const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = [];
  for (let i = 0; i < n; i++) {
    assert.equal(dv.getUint32(p, true), 0x02014b50); const crc = dv.getUint32(p + 16, true), size = dv.getUint32(p + 24, true), nl = dv.getUint16(p + 28, true), off = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nl)); assert.equal(dv.getUint32(off, true), 0x04034b50);
    const lnl = dv.getUint16(off + 26, true), data = b.subarray(off + 30 + lnl, off + 30 + lnl + size); assert.equal(I.crc32(data), crc, 'crc ' + name); out.push({ name, data }); p += 46 + nl;
  }
  return out;
}
ok('ZIP: round trips names (UTF-8, duplicates) and bytes; CRC-32 matches the standard check value', () => {
  assert.equal(I.crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const big = Uint8Array.from({ length: 70000 }, (_, i) => i * 7 & 255);
  const z = I.buildZip([{ name: 'a.jpg', data: Uint8Array.of(1, 2, 3) }, { name: 'a.jpg', data: big }, { name: 'ünï/cødé 日本.webp', data: new Uint8Array(0) }], new Date(2026, 9, 13, 12, 0, 0));
  const files = readZip(z); assert.deepEqual(files.map(f => f.name), ['a.jpg', 'a (2).jpg', 'ünï_cødé 日本.webp']);
  assert.deepEqual([...files[0].data], [1, 2, 3]); assert.deepEqual(files[1].data, big); assert.equal(files[2].data.length, 0);
});
ok('ZIP: accepted by an independent implementation (python zipfile) when available', () => {
  let py = null; try { py = execFileSync('python3', ['--version'], { stdio: 'pipe' }).toString(); } catch { /* not installed */ }
  if (!py) { console.log('  (python3 not available; skipped the cross-check)'); return; }
  const dir = mkdtempSync(join(tmpdir(), 'zip-')), f = join(dir, 'x.zip');
  writeFileSync(f, I.buildZip([{ name: 'one.bin', data: Uint8Array.from({ length: 5000 }, (_, i) => i & 255) }, { name: 'two.txt', data: new TextEncoder().encode('hello') }]));
  const out = execFileSync('python3', ['-c', 'import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(",".join(z.namelist()), z.read("two.txt").decode())', f]).toString().trim();
  assert.equal(out, 'one.bin,two.txt hello');
});

/* ---------------- static integration ---------------- */
const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
ok('registered: index.html loads the tools after v6-tools.js; sw.js precaches the files and the cache name was bumped', () => {
  const html = read('index.html'); assert.ok(html.indexOf('v6-tools.js') < html.indexOf('tools/file-media/file-media-tools.js') && html.indexOf('tools/file-media/file-media-tools.js') < html.indexOf('discovery.js'));
  const sw = read('sw.js'); for (const f of ['file-media-tools.js', 'file-media.css', 'fm-svg.js', 'fm-image.js', 'fm-table.js']) assert.ok(sw.includes('./tools/file-media/' + f), f);
  assert.ok(sw.includes('./vendor/svgo.browser.js')); assert.match(sw, /const CACHE="govibetool-v8-\d+"/);
  for (const f of ['tools/file-media/file-media-tools.js', 'tools/file-media/fm-svg.js', 'tools/file-media/fm-image.js', 'tools/file-media/fm-table.js', 'tools/file-media/fm-avif-worker.js', 'vendor/svgo.browser.js', 'vendor/avif/avif_enc.js', 'vendor/avif/avif_enc.wasm']) assert.ok(existsSync(new URL('../' + f, import.meta.url)), f + ' exists');
});
ok('registry: four tools, unique ids, each in one of the existing catalogue categories', () => {
  const src = read('tools/file-media/file-media-tools.js'); const ids = [...src.matchAll(/\["((?:svg-sanitizer|image-metadata-stripper|image-batch-compressor|table-converter))", "([^"]+)"/g)];
  assert.deepEqual(ids.map(m => m[1]), ['svg-sanitizer', 'image-metadata-stripper', 'image-batch-compressor', 'table-converter']);
  const v8 = read('v8-discovery.js'); for (const m of ids) assert.ok(v8.includes('"' + m[2] + '"') || v8.includes("'" + m[2] + "'"), m[2] + ' is mapped by a V8 category');
  assert.equal([...v8.matchAll(/\{id:"[a-z-]+",label:/g)].length, 9, 'v8-discovery.js still defines exactly nine categories');
});
ok('third-party notices mention SVGO and the AVIF encoder; licences are shipped', () => {
  const n = read('THIRD_PARTY_NOTICES.md'); assert.match(n, /SVGO/); assert.match(n, /libavif/i); assert.match(n, /jSquash/i);
  assert.ok(existsSync(new URL('../vendor/svgo.LICENSE.txt', import.meta.url)) && existsSync(new URL('../vendor/avif/LICENSE-jsquash-Apache-2.0.txt', import.meta.url)));
});
ok('privacy: the tool code makes no network calls and has no remote URLs', () => {
  for (const f of ['file-media-tools.js', 'fm-svg.js', 'fm-image.js', 'fm-table.js', 'fm-avif-worker.js']) {
    const s = read('tools/file-media/' + f); assert.doesNotMatch(s, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/, f);
    const urls = (s.match(/https?:\/\/[^\s"'`)]+/g) || []).filter(u => !/w3\.org|adobe\.com|example\.|ns\.adobe|purl\.org|inkscape\.org|apache\.org|tracker\.example|tel:|localhost/.test(u));
    assert.deepEqual(urls, [], f + ' contains remote URLs: ' + urls.join(', '));
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
