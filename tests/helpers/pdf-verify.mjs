/* Independent verification of exported PDFs: Poppler (pdftotext/pdfinfo/pdffonts/pdftoppm) and pypdf. These tools share no code with
   the editor engine. Each helper reports whether its tool is installed so tests can print SKIPPED instead of a false PASS. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';

const which = cmd => spawnSync('sh', ['-c', `command -v ${cmd}`]).status === 0;
export const HAVE = { poppler: which('pdftotext') && which('pdftoppm') && which('pdffonts') && which('pdfinfo'), pypdf: spawnSync('python3', ['-I', '-c', 'import pypdf']).status === 0 };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfv-')); process.on('exit', () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* best effort */ } });
let n = 0; const write = bytes => { const f = path.join(tmp, `f${++n}.pdf`); fs.writeFileSync(f, bytes); return f; };
const run = (cmd, args, opts = {}) => { const r = spawnSync(cmd, args, { maxBuffer: 256 * 1024 * 1024, ...opts }); if (r.status !== 0) throw new Error(`${cmd} failed: ${String(r.stderr).slice(0, 300)}`); return r.stdout; };

export const pdftotext = (bytes, page, extra = []) => String(run('pdftotext', [...(page ? ['-f', String(page), '-l', String(page)] : []), ...extra, write(bytes), '-']));
export const pdfinfo = bytes => String(run('pdfinfo', [write(bytes)]));
/* Poppler prints "Syntax Error"/"Error" lines on stderr for damaged files; return them so a test can demand a clean parse. */
export function poppler(bytes) { const f = write(bytes), r = spawnSync('pdftotext', [f, '-'], { maxBuffer: 256 * 1024 * 1024 }); return { status: r.status, errors: String(r.stderr).split('\n').filter(l => /error/i.test(l)) }; }
export const pdffonts = bytes => String(run('pdffonts', [write(bytes)])).split('\n').slice(2).filter(Boolean).map(l => l.trim().split(/\s{2,}|\s+(?=(CID |Type |TrueType|Type1))/)[0]);
export const imageCount = bytes => String(run('pdfimages', ['-list', write(bytes)])).split('\n').slice(2).filter(l => l.trim()).length;
export const pageCount = bytes => Number(/Pages:\s+(\d+)/.exec(pdfinfo(bytes))[1]);
/* word boxes from pdftotext -bbox: [{text,x0,y0,x1,y1}] in PDF points, y downward from the top */
export function words(bytes, page) {
  const html = String(run('pdftotext', ['-bbox', '-f', String(page), '-l', String(page), write(bytes), '-']));
  return [...html.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)].map(m => ({ text: m[5].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'), x0: +m[1], y0: +m[2], x1: +m[3], y1: +m[4] }));
}
/* rendered page as {w,h,rgb:Uint8Array} */
export function render(bytes, page, dpi = 100) {
  const f = write(bytes), base = path.join(tmp, `r${++n}`);
  run('pdftoppm', ['-r', String(dpi), '-f', String(page), '-l', String(page), f, base]);
  const out = fs.readdirSync(tmp).find(x => x.startsWith(path.basename(base)) && x.endsWith('.ppm')); const b = fs.readFileSync(path.join(tmp, out)); fs.unlinkSync(path.join(tmp, out));
  const m = /^P6\s+(\d+)\s+(\d+)\s+255\s/.exec(b.subarray(0, 40).toString('latin1')); return { w: +m[1], h: +m[2], rgb: b.subarray(m[0].length) };
}
/* count of differing pixels between two renders, optionally ignoring a rectangle given in PDF points (top-left origin, like words()) */
export function diffPixels(a, b, dpi = 100, ignore = []) {
  if (a.w !== b.w || a.h !== b.h) return Infinity; const k = dpi / 72; let d = 0;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    if (ignore.some(r => x >= r.x0 * k - 2 && x <= r.x1 * k + 2 && y >= r.y0 * k - 2 && y <= r.y1 * k + 2)) continue;
    const i = (y * a.w + x) * 3; if (a.rgb[i] !== b.rgb[i] || a.rgb[i + 1] !== b.rgb[i + 1] || a.rgb[i + 2] !== b.rgb[i + 2]) d++;
  }
  return d;
}
/* dominant non-white colour inside a box (points) */
export function colourIn(img, box, dpi = 100) {
  const k = dpi / 72; let r = 0, g = 0, bl = 0, c = 0;
  for (let y = Math.floor(box.y0 * k); y < Math.ceil(box.y1 * k); y++) for (let x = Math.floor(box.x0 * k); x < Math.ceil(box.x1 * k); x++) { const i = (y * img.w + x) * 3; if (img.rgb[i] < 200 || img.rgb[i + 1] < 200 || img.rgb[i + 2] < 200) { r += img.rgb[i]; g += img.rgb[i + 1]; bl += img.rgb[i + 2]; c++; } }
  return c ? [r / c, g / c, bl / c, c] : null;
}

const PY = `
import sys, json
from pypdf import PdfReader
from pypdf.generic import IndirectObject
r = PdfReader(sys.argv[1])
out = {'pages': len(r.pages), 'encrypted': r.is_encrypted, 'texts': [], 'links': [], 'outline': []}
for i, p in enumerate(r.pages):
    out['texts'].append(p.extract_text() or '')
    for a in (p.get('/Annots') or []):
        a = a.get_object()
        if a.get('/Subtype') != '/Link': continue
        rec = {'page': i + 1, 'rect': [round(float(v), 1) for v in a['/Rect']]}
        act = a.get('/A'); 
        if act is not None: act = act.get_object()
        if act is not None and act.get('/S') == '/URI': rec['uri'] = str(act['/URI'])
        elif act is not None and act.get('/S') == '/GoTo': d = act['/D']; rec['destPage'] = r.get_destination_page_number(__import__('pypdf').generic.Destination('x', d[0], '/XYZ')) + 1 if not isinstance(d, (str, bytes)) else None
        elif '/Dest' in a:
            d = a['/Dest']
            if isinstance(d, list) or hasattr(d, '__len__') and not isinstance(d, (str, bytes)):
                ref = d[0]; rec['destPage'] = [pg.indirect_reference.idnum for pg in r.pages].index(ref.idnum) + 1
        out['links'].append(rec)
def walk(items, depth):
    for it in items:
        if isinstance(it, list): walk(it, depth + 1)
        else:
            try: pg = r.get_destination_page_number(it) + 1
            except Exception: pg = None
            out['outline'].append({'title': it.title, 'depth': depth, 'page': pg})
try: walk(r.outline, 0)
except Exception as e: out['outlineError'] = str(e)
print(json.dumps(out))
`;
export function pypdfInspect(bytes) { const f = write(bytes); return JSON.parse(String(run('python3', ['-I', '-c', PY, f]))); }
