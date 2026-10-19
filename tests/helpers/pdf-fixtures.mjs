/* Test documents. Real-producer files (Chrome/Skia, LibreOffice, encrypted) are committed under tests/fixtures/pdf-v2;
   everything else is built here so the exact content stream under test is visible in the test. */
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { buildPdf, STD_FONTS } from './pdf-build.mjs';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'pdf-v2');
export const committed = name => new Uint8Array(fs.readFileSync(path.join(dir, name)));

/* Standard-font invoice (what pdf-lib, reportlab and many generators emit): non-embedded Helvetica/Times, WinAnsi. */
export function stdInvoice() {
  const page1 = `BT /F1 20 Tf 72 720 Td (INVOICE #1042) Tj ET
BT /F2 12 Tf 72 690 Td (Bill to: Northwind Traders, 25 Dock Road) Tj 0 -16 Td (Payment terms: 30 days from the invoice date.) Tj ET
BT /F1 11 Tf 72 640 Td (Description) Tj 250 0 Td (Qty) Tj 60 0 Td (Amount) Tj ET
BT /F2 11 Tf 72 620 Td (Consulting services) Tj 250 0 Td (10) Tj 60 0 Td (1,500.00) Tj ET
BT /F2 11 Tf 72 604 Td (Travel expenses) Tj 250 0 Td (1) Tj 60 0 Td (245.30) Tj ET
BT /F1 11 Tf 72 580 Td (Total due) Tj 310 0 Td (1,745.30) Tj ET
0.5 w 72 632 m 540 632 l S
`;
  const page2 = `BT /F1 16 Tf 72 720 Td (Notes) Tj ET
BT /F2 12 Tf 72 696 Td (Thank you for your business. Late fees apply after 45 days.) Tj ET
BT /F3 10 Tf 72 676 Td (Ref: INV-1042-NW / PO 77831) Tj ET
`;
  return new Uint8Array(buildPdf({ pages: [{ content: page1 }, { content: page2 }], fonts: STD_FONTS }));
}

/* Hard content-stream cases, each on its own text object; text-state parameters are reset between them. */
export function hardCases() {
  const c = `BT /F1 12 Tf 72 720 Td [(Hello) -80 (World) 120 (kern)] TJ 0 -20 Td (Second line) Tj 0 -20 Td 1 0 0 rg (Red) Tj 0 0 1 rg ( Blue) Tj 0 g ET
BT /F2 14 Tf 2 Tc 5 Tw 72 640 Td (Tc and Tw test) Tj 0 Tc 0 Tw ET
BT /F1 12 Tf 150 Tz 72 610 Td (Wide scaling) Tj 100 Tz ET
BT /F1 12 Tf 14 TL 72 580 Td (Quote op one) ' (Quote op two) ' ET
BT /F1 12 Tf 0.866 0.5 -0.5 0.866 300 400 Tm (Rotated 30 degrees) Tj ET
BT /F3 1 Tf 12 0 0 12 72 500 Tm (Scaled matrix) Tj ET
BT /F1 12 Tf 72 540 Td (Part A ) Tj /F2 12 Tf (part B in Times) Tj /F1 12 Tf ( part C) Tj 0 -20 Td (next line after chain) Tj ET
BT /F1 12 Tf 72 100 Td (Before) Tj 100 0 Td (After far) Tj ET
`;
  return new Uint8Array(buildPdf({ pages: [{ content: c }], fonts: STD_FONTS }));
}

/* Invisible OCR layer (Tr 3), as found on scanned documents that were run through OCR. */
export function ocrLayer() {
  return new Uint8Array(buildPdf({ pages: [{ content: 'BT 3 Tr /F1 12 Tf 110 600 Td (Hidden OCR words) Tj ET\n' }], fonts: { F1: STD_FONTS.F1 } }));
}

/* Page that is only an image: no text objects at all (a scan). */
export function scanned() {
  const raw = Buffer.alloc(64 * 48 * 3, 200); const z = zlib.deflateSync(raw);
  const img = `<< /Type /XObject /Subtype /Image /Width 64 /Height 48 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${z.length} >>\nstream\n${z.toString('latin1')}\nendstream`;
  return new Uint8Array(buildPdf({ pages: [{ content: 'q 400 0 0 300 100 300 cm /Im0 Do Q\n', resources: '/XObject << /Im0 5 0 R >>' }], fonts: {}, extraObjects: [img] }));
}

/* Composite font without a ToUnicode table: the codes cannot be mapped back to characters. */
export function noUnicode() {
  const fonts = { F1: '<< /Type /Font /Subtype /Type0 /BaseFont /ABCDEF+Mystery /Encoding /Identity-H /DescendantFonts [<< /Type /Font /Subtype /CIDFontType2 /BaseFont /ABCDEF+Mystery /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /DW 600 >>] >>' };
  return new Uint8Array(buildPdf({ pages: [{ content: 'BT /F1 12 Tf 72 700 Td <000100020003> Tj ET\n' }], fonts }));
}

/* Document with text, an embedded image and a table-like layout (mixed content). */
export async function mixedImage(P) {
  const doc = await P.PDFDocument.create(), helv = await doc.embedFont(P.StandardFonts.Helvetica), page = doc.addPage([612, 792]);
  const png = await doc.embedPng(tinyPng());
  page.drawText('Product sheet', { x: 72, y: 720, size: 22, font: helv });
  page.drawImage(png, { x: 72, y: 560, width: 120, height: 120 });
  page.drawText('Price: 49.90 EUR per unit', { x: 210, y: 640, size: 12, font: helv });
  page.drawText('Stock: 120 units available', { x: 210, y: 620, size: 12, font: helv });
  return new Uint8Array(await doc.save());
}
export function tinyPng() {
  const w = 16, h = 16, raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = 40 + x * 10; raw[o + 1] = 120; raw[o + 2] = 200 - y * 8; } }
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = b => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
