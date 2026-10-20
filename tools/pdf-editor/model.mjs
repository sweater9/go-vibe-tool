/* PDF Editor document model. Pure and DOM-free so the same code runs in the browser and in Node tests.
   Coordinates: every object lives in PDF user space (origin bottom-left, y up, points) of its page, so edits do not depend
   on zoom. A "frame" object has an origin (ox,oy) = its top-left corner in the object's own orientation, a rotation `rot`
   (degrees, counter-clockwise) and a size (cw along the reading direction, ch across). Pages are never rewritten while
   editing: the model keeps a page list (source page + extra rotation) and a list of overlay objects, and `bakeDocument`
   builds the output PDF from them only when exporting. */

export const DEG = Math.PI / 180;
export const norm = a => ((a % 360) + 360) % 360;
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ---------- page viewport (user space <-> display pixels) ---------- */
/* `view` is the visible box [x0,y0,x1,y1] and `rotation` the clockwise display rotation, exactly as PDF.js defines them. */
export function makeViewport(view, rotation, scale) {
  const [x0, y0, x1, y1] = view, w = x1 - x0, h = y1 - y0, r = norm(rotation);
  const odd = r % 180 !== 0;
  const toDisplay = (x, y) => {
    const a = x - x0, b = y - y0; let dx, dy;
    if (r === 0) { dx = a; dy = h - b; } else if (r === 90) { dx = b; dy = a; } else if (r === 180) { dx = w - a; dy = b; } else { dx = h - b; dy = w - a; }
    return [dx * scale, dy * scale];
  };
  const toUser = (px, py) => {
    const dx = px / scale, dy = py / scale; let a, b;
    if (r === 0) { a = dx; b = h - dy; } else if (r === 90) { b = dx; a = dy; } else if (r === 180) { a = w - dx; b = dy; } else { b = h - dx; a = w - dy; }
    return [a + x0, b + y0];
  };
  return { view, rotation: r, scale, width: (odd ? h : w) * scale, height: (odd ? w : h) * scale, toDisplay, toUser };
}

/* ---------- frame geometry ---------- */
export function axes(deg) { const a = deg * DEG; return { U: [Math.cos(a), Math.sin(a)], D: [Math.sin(a), -Math.cos(a)] }; }
export function frameToUser(f, u, v) { const { U, D } = axes(f.rot); return [f.ox + u * U[0] + v * D[0], f.oy + u * U[1] + v * D[1]]; }
export function userToFrame(f, x, y) { const { U, D } = axes(f.rot), dx = x - f.ox, dy = y - f.oy; return [dx * U[0] + dy * U[1], dx * D[0] + dy * D[1]]; }
export const FRAME_TYPES = new Set(['text', 'image', 'rect', 'ellipse']);
export const isFrame = o => FRAME_TYPES.has(o.type);

/* ---------- fonts and text layout ---------- */
export const FAMILIES = ['Helvetica', 'Times', 'Courier'];
const FONT_NAMES = {
  Helvetica: ['Helvetica', 'HelveticaBold', 'HelveticaOblique', 'HelveticaBoldOblique'],
  Times: ['TimesRoman', 'TimesRomanBold', 'TimesRomanItalic', 'TimesRomanBoldItalic'],
  Courier: ['Courier', 'CourierBold', 'CourierOblique', 'CourierBoldOblique'],
};
export function fontKey(o) { const fam = FONT_NAMES[o.font] ? o.font : 'Helvetica'; return FONT_NAMES[fam][(o.bold ? 1 : 0) + (o.italic ? 2 : 0)]; }
export const LINE_HEIGHT = 1.25;

/* `fonts` = { width(key,text,size), ascent(key,size) }. Wraps on spaces, hard-breaks words wider than the box. */
export function layoutText(o, fonts) {
  const key = fontKey(o), size = o.size, maxW = Math.max(size, o.cw), lines = [];
  const push = text => lines.push({ text, width: fonts.width(key, text, size) });
  for (const para of String(o.text).split(/\r?\n/)) {
    let line = '';
    for (const word of para.split(' ')) {
      const trial = line ? line + ' ' + word : word;
      if (!line || fonts.width(key, trial, size) <= maxW) { line = trial; if (fonts.width(key, line, size) > maxW) { /* a single long word */ line = breakWord(line, key, size, maxW, fonts, push); } continue; }
      push(line); line = word;
      if (fonts.width(key, line, size) > maxW) line = breakWord(line, key, size, maxW, fonts, push);
    }
    push(line);
  }
  const lh = size * LINE_HEIGHT;
  return { lines, lineHeight: lh, ascent: fonts.ascent(key, size), height: lines.length * lh };
}
function breakWord(word, key, size, maxW, fonts, push) {
  let cur = '';
  for (const ch of Array.from(word)) { if (cur && fonts.width(key, cur + ch, size) > maxW) { push(cur); cur = ch; } else cur += ch; }
  return cur;
}
/* Frame height: derived from the text for text objects. */
export function frameHeight(o, fonts) { return o.type === 'text' ? Math.max(o.size * LINE_HEIGHT, layoutText(o, fonts).height) : o.ch; }

export async function makeFontMetrics(PDFLib) {
  const { PDFDocument, StandardFonts } = PDFLib, scratch = await PDFDocument.create(), cache = {};
  for (const names of Object.values(FONT_NAMES)) for (const n of names) cache[n] = await scratch.embedFont(StandardFonts[n]);
  return {
    width: (key, text, size) => cache[key].widthOfTextAtSize(text, size),
    ascent: (key, size) => cache[key].heightAtSize(size, { descender: false }),
    /* Throws when the text contains characters a standard PDF font cannot draw (WinAnsi only). */
    check: (key, text) => { cache[key].encodeText(String(text).replace(/[\r\n]+/g, '')); return true; },
  };
}

/* ---------- state, history ---------- */
export function createState() { return { pages: [], objects: [], edits: [], textEdits: [], links: [], outline: [], outlineDirty: false, seq: 1 }; }
export const clone = x => JSON.parse(JSON.stringify(x));
export const uid = state => state.seq++;

export class History {
  constructor(limit = 200) { this.limit = limit; this.past = []; this.future = []; }
  /* Call before every mutation with the state to return to. */
  record(state) { this.past.push(clone(state)); if (this.past.length > this.limit) this.past.shift(); this.future.length = 0; }
  undo(state) { if (!this.past.length) return null; this.future.push(clone(state)); return this.past.pop(); }
  redo(state) { if (!this.future.length) return null; this.past.push(clone(state)); return this.future.pop(); }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  clear() { this.past.length = 0; this.future.length = 0; }
}

/* ---------- page operations (return new arrays, never mutate sources) ---------- */
export function rotatePages(pages, ids, delta) { const s = new Set(ids); return pages.map(p => s.has(p.id) ? { ...p, rot: norm(p.rot + delta) } : p); }
export function deletePages(state, ids) {
  const s = new Set(ids);
  if (state.pages.every(p => s.has(p.id))) throw new Error('A PDF needs at least one page.');
  state.pages = state.pages.filter(p => !s.has(p.id)); state.objects = state.objects.filter(o => !s.has(o.page));
}
export function movePage(pages, id, to) {
  const from = pages.findIndex(p => p.id === id); if (from < 0) return pages;
  const out = pages.slice(), [p] = out.splice(from, 1); out.splice(clamp(to, 0, out.length), 0, p); return out;
}
export function blankPage(state, afterIndex, size = [612, 792]) {
  const id = uid(state); const p = { id, src: null, idx: 0, rot: 0, baseRot: 0, view: [0, 0, size[0], size[1]], blank: true };
  state.pages.splice(afterIndex + 1, 0, p); return p;
}

/* ---------- objects ---------- */
export function bounds(o, fonts) {
  const pts = [];
  if (isFrame(o)) { const h = frameHeight(o, fonts); for (const [u, v] of [[0, 0], [o.cw, 0], [o.cw, h], [0, h]]) pts.push(frameToUser(o, u, v)); }
  else if (o.type === 'line' || o.type === 'arrow') pts.push(o.p1, o.p2);
  else if (o.type === 'draw') pts.push(...o.points);
  else if (o.type === 'note') pts.push([o.x, o.y], [o.x + NOTE_SIZE, o.y + NOTE_SIZE]);
  else if (o.rects) for (const r of o.rects) pts.push([r.x, r.y], [r.x + r.w, r.y + r.h]);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}
export const NOTE_SIZE = 24;
function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 ? clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
/* Does user-space point p hit object o? `tol` is in points (callers pass ~6 screen px / scale). */
export function hitTest(o, p, fonts, tol = 3) {
  if (isFrame(o)) { const [u, v] = userToFrame(o, p[0], p[1]), h = frameHeight(o, fonts); return u >= -tol && u <= o.cw + tol && v >= -tol && v <= h + tol; }
  if (o.type === 'line' || o.type === 'arrow') return segDist(p, o.p1, o.p2) <= Math.max(tol, o.width / 2 + 1);
  if (o.type === 'draw') { for (let i = 1; i < o.points.length; i++) if (segDist(p, o.points[i - 1], o.points[i]) <= Math.max(tol, o.width / 2 + 1)) return true; return o.points.length === 1 && Math.hypot(p[0] - o.points[0][0], p[1] - o.points[0][1]) <= tol; }
  if (o.type === 'note') return p[0] >= o.x - tol && p[0] <= o.x + NOTE_SIZE + tol && p[1] >= o.y - tol && p[1] <= o.y + NOTE_SIZE + tol;
  if (o.rects) return o.rects.some(r => p[0] >= r.x - tol && p[0] <= r.x + r.w + tol && p[1] >= r.y - tol && p[1] <= r.y + r.h + tol);
  return false;
}
export function translate(o, dx, dy) {
  if (isFrame(o)) { o.ox += dx; o.oy += dy; }
  else if (o.type === 'line' || o.type === 'arrow') { o.p1 = [o.p1[0] + dx, o.p1[1] + dy]; o.p2 = [o.p2[0] + dx, o.p2[1] + dy]; }
  else if (o.type === 'draw') o.points = o.points.map(q => [q[0] + dx, q[1] + dy]);
  else if (o.type === 'note') { o.x += dx; o.y += dy; }
  else if (o.rects) o.rects = o.rects.map(r => ({ ...r, x: r.x + dx, y: r.y + dy }));
}
/* Resize a frame by dragging handle `h` (0 TL,1 T,2 TR,3 R,4 BR,5 B,6 BL,7 L) to user-space point p. The opposite edge or corner stays put.
   Text: side handles change the wrap width; corner handles scale the font size with the width; the height is derived from the text.
   Images keep their aspect ratio on corner handles unless `free`. */
export function handlePoints(o, fonts) {
  const w = o.cw, h = frameHeight(o, fonts);
  return [[0, 0], [w / 2, 0], [w, 0], [w, h / 2], [w, h], [w / 2, h], [0, h], [0, h / 2]];
}
export function resizeFrame(o, h, p, fonts, { free = false } = {}) {
  const old = handlePoints(o, fonts), A = old[(h + 4) % 8], AU = frameToUser(o, A[0], A[1]), [u, v] = userToFrame(o, p[0], p[1]);
  const left = h === 0 || h === 6 || h === 7, right = h === 2 || h === 3 || h === 4, top = h <= 2, bottom = h >= 4 && h <= 6;
  const minW = o.type === 'text' ? Math.max(6, o.size) : 4, minH = 4, hgt = old[4][1];
  let ncw = left ? A[0] - u : right ? u - A[0] : o.cw, nch = top ? A[1] - v : bottom ? v - A[1] : hgt;
  ncw = Math.max(minW, ncw); nch = Math.max(minH, nch);
  const corner = (left || right) && (top || bottom);
  if (o.type === 'text') {
    if (corner) o.size = clamp(o.size * (ncw / o.cw), 6, 400);
    o.cw = ncw; nch = frameHeight(o, fonts);
  } else {
    if (corner && !free && o.type === 'image') { const ratio = o.cw / o.ch; if (ncw / nch > ratio) ncw = nch * ratio; else nch = ncw / ratio; }
    o.cw = ncw; o.ch = nch;
  }
  const au = left ? o.cw : right ? 0 : o.cw / 2, av = top ? nch : bottom ? 0 : nch / 2;
  const [px, py] = frameToUser({ ...o, ox: 0, oy: 0 }, au, av);
  o.ox = AU[0] - px; o.oy = AU[1] - py;
}
/* Angle (degrees, counter-clockwise, user space) of the rotation handle drag around the frame centre. */
export function rotateFrame(o, p, fonts, { snap = true } = {}) {
  const h = frameHeight(o, fonts), c = frameToUser(o, o.cw / 2, h / 2);
  let a = Math.atan2(p[1] - c[1], p[0] - c[0]) / DEG - 90 + 0; // the handle sits above the frame (opposite of D)
  a = norm(a); if (snap) for (const t of [0, 90, 180, 270, 360]) if (Math.abs(a - t) < 3) a = t % 360;
  const [cx, cy] = [c[0], c[1]]; o.rot = a;
  const [px, py] = frameToUser({ ...o, ox: 0, oy: 0 }, o.cw / 2, h / 2); o.ox = cx - px; o.oy = cy - py;
}
