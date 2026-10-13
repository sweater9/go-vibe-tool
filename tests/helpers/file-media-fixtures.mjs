/* Test fixtures for the V8 file & media tools: build image files that really carry EXIF / IPTC / XMP / text metadata. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { crc32 } = require('../../tools/file-media/fm-image.js');

const enc = s => new TextEncoder().encode(s);
export const concat = (...parts) => { const n = parts.reduce((s, p) => s + p.length, 0), o = new Uint8Array(n); let k = 0; for (const p of parts) { o.set(p, k); k += p.length; } return o; };
const be16 = n => Uint8Array.of(n >> 8 & 255, n & 255);
const be32 = n => Uint8Array.of(n >>> 24, n >> 16 & 255, n >> 8 & 255, n & 255);

/* TIFF block for EXIF. IFD0: Make, Model, Software, Orientation, GPS pointer; GPS IFD: latitude/longitude refs + rationals. */
export function exifTiff({ orientation = 1, gps = true, make = 'FixtureCam', model = 'Privacy-1', software = 'GVT-test', littleEndian = false } = {}) {
  const le = littleEndian;
  const w16 = n => le ? Uint8Array.of(n & 255, n >> 8 & 255) : be16(n);
  const w32 = n => le ? Uint8Array.of(n & 255, n >> 8 & 255, n >> 16 & 255, n >>> 24) : be32(n);
  const ascii = s => concat(enc(s), Uint8Array.of(0));
  const strings = [ascii(make), ascii(model), ascii(software)];
  const entries = 4 + (gps ? 1 : 0), ifd0Size = 2 + entries * 12 + 4;
  let dataOff = 8 + ifd0Size;
  const strOffs = strings.map(s => { const o = dataOff; dataOff += s.length + (s.length & 1); return o; });
  const gpsOff = dataOff;
  const entry = (tag, type, count, valueBytes) => concat(w16(tag), w16(type), w32(count), valueBytes);
  const inl = (b) => concat(b, new Uint8Array(4 - b.length));
  const ifd0 = [
    entry(0x010f, 2, strings[0].length, w32(strOffs[0])),
    entry(0x0110, 2, strings[1].length, w32(strOffs[1])),
    entry(0x0112, 3, 1, inl(w16(orientation))),
    entry(0x0131, 2, strings[2].length, w32(strOffs[2]))
  ];
  if (gps) ifd0.push(entry(0x8825, 4, 1, w32(gpsOff)));
  const body = concat(enc(le ? 'II' : 'MM'), w16(42), w32(8), w16(entries), ...ifd0, w32(0),
    ...strings.map(s => s.length & 1 ? concat(s, Uint8Array.of(0)) : s));
  let gpsIfd = new Uint8Array(0);
  if (gps) {
    const n = 4, size = 2 + n * 12 + 4, base = gpsOff + size;
    const rat = (a, b) => concat(w32(a), w32(b));
    const lat = concat(rat(48, 1), rat(51, 1), rat(2940, 100)), lon = concat(rat(2, 1), rat(17, 1), rat(4000, 100));
    gpsIfd = concat(w16(n),
      entry(0x0001, 2, 2, concat(enc('N'), Uint8Array.of(0, 0, 0))), entry(0x0002, 5, 3, w32(base)),
      entry(0x0003, 2, 2, concat(enc('E'), Uint8Array.of(0, 0, 0))), entry(0x0004, 5, 3, w32(base + lat.length)), w32(0), lat, lon);
  }
  return concat(body, gpsIfd);
}
const seg = (marker, payload) => concat(Uint8Array.of(0xff, marker), be16(payload.length + 2), payload);
export const exifSegment = o => seg(0xe1, concat(enc('Exif\0\0'), exifTiff(o)));
export const xmpSegment = () => seg(0xe1, concat(enc('http://ns.adobe.com/xap/1.0/\0'), enc('<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>Jane Fixture</dc:creator></rdf:Description></rdf:RDF></x:xmpmeta>')));
export const iptcSegment = () => { const rec = concat(Uint8Array.of(0x1c, 2, 80), be16(12), enc('Jane Fixture')); return seg(0xed, concat(enc('Photoshop 3.0\0'), enc('8BIM'), be16(0x0404), Uint8Array.of(0, 0), be32(rec.length), rec, rec.length & 1 ? Uint8Array.of(0) : new Uint8Array(0))); };
export const iccSegment = () => seg(0xe2, concat(enc('ICC_PROFILE\0'), Uint8Array.of(1, 1), enc('fake-profile-bytes-for-testing')));
export const commentSegment = () => seg(0xfe, enc('shot at secret location'));

/* Insert segments right after SOI. */
export function injectJpeg(jpeg, segments) {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('not a JPEG');
  return concat(jpeg.subarray(0, 2), ...segments, jpeg.subarray(2));
}
/* A "JPEG" that is only structurally valid (enough for the scanner tests). */
export const fakeJpeg = (segments) => concat(Uint8Array.of(0xff, 0xd8), ...segments, Uint8Array.of(0xff, 0xda, 0, 2, 0, 0, 0xff, 0xd9));

const pngChunk = (type, data) => { const t = enc(type), body = concat(t, data); return concat(be32(data.length), body, be32(crc32(body))); };
export const pngText = (k, v) => pngChunk('tEXt', concat(enc(k), Uint8Array.of(0), enc(v)));
export const pngXmp = () => pngChunk('iTXt', concat(enc('XML:com.adobe.xmp'), Uint8Array.of(0, 0, 0, 0, 0), enc('<x:xmpmeta xmlns:x="adobe:ns:meta/"/>')));
export const pngExif = o => pngChunk('eXIf', exifTiff(o));
export const pngTime = () => pngChunk('tIME', Uint8Array.of(0x07, 0xea, 10, 13, 9, 30, 0));
/* Insert chunks after IHDR (signature 8 + IHDR chunk 25 bytes). */
export function injectPng(png, chunks) { return concat(png.subarray(0, 33), ...chunks, png.subarray(33)); }

export const fakeWebp = (chunks) => { const body = concat(enc('WEBP'), ...chunks.map(([t, d]) => concat(enc(t), Uint8Array.of(d.length & 255, d.length >> 8 & 255, 0, 0), d, d.length & 1 ? Uint8Array.of(0) : new Uint8Array(0)))); return concat(enc('RIFF'), Uint8Array.of(body.length & 255, body.length >> 8 & 255, body.length >> 16 & 255, 0), body); };
export const b64 = bytes => Buffer.from(bytes).toString('base64');
export const fromB64 = s => new Uint8Array(Buffer.from(s, 'base64'));
