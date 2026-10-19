import * as pdfjs from "../v9-media/vendor/pdf/pdf.min.mjs";
import { createState, History, clone, uid, norm, clamp, makeViewport, axes, frameToUser, userToFrame, isFrame, frameHeight, layoutText, fontKey,
  makeFontMetrics, rotatePages, deletePages, movePage, blankPage, bounds, hitTest, translate, resizeFrame, rotateFrame, handlePoints, NOTE_SIZE, FAMILIES } from "./model.mjs";
import { bakeDocument } from "./bake.mjs";
import { createV2 } from "./v2ui.js";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("../v9-media/vendor/pdf/pdf.worker.min.mjs", import.meta.url).href;
const PDFLib = window.PDFLib;
const ASSET = p => new URL("../v9-media/vendor/pdf/" + p, import.meta.url).href;
/* disableFontFace draws glyph outlines instead of registering FontFace objects (WebKit reports those as style-src violations under this page's CSP);
   the bundled standard-font and CMap data cover non-embedded fonts. */
const PDFJS_OPTS = { isEvalSupported: false, disableFontFace: true, standardFontDataUrl: ASSET("standard_fonts/"), cMapUrl: ASSET("cmaps/"), cMapPacked: true };
const $ = id => document.getElementById(id);
const CSS_UNITS = 96 / 72, MAX_BYTES = 50 * 1024 * 1024, MAX_IMAGE = 20 * 1024 * 1024, MAX_PIXELS = 36e6;
const ZOOM_STEPS = [25, 50, 75, 100, 125, 150, 200, 300, 400];
const TOOLS = ["select", "text", "image", "rect", "ellipse", "line", "arrow", "draw", "highlight", "underline", "strike", "note", "edittext", "link"];
const KEYS = { v: "select", t: "text", i: "image", r: "rect", o: "ellipse", l: "line", a: "arrow", d: "draw", h: "highlight", u: "underline", k: "strike", n: "note", e: "edittext", g: "link" };
const HELP = {
  select: "Click an object to select it. Drag to move it, use the handles to resize or rotate. Drag empty space to scroll.",
  text: "Click or drag on the page to add a text box, then type in the panel.",
  image: "Choose an image to place on the current page.",
  rect: "Drag on the page to draw a rectangle.", ellipse: "Drag on the page to draw an oval.",
  line: "Drag on the page to draw a line.", arrow: "Drag on the page to draw an arrow.", draw: "Draw freehand with your finger, pen or mouse.",
  highlight: "Drag across text to highlight it.", underline: "Drag across text to underline it.", strike: "Drag across text to strike it through.",
  note: "Tap the page to place a comment note.",
  edittext: "Tap a line of text to change it in the PDF itself: replace words, numbers or amounts, delete text, or change its font, size, colour and alignment. Edits stay real, searchable text.",
  link: "Drag a rectangle (or tap a line of text) to make a link. Tap an existing link to edit or remove it.",
};
const TYPE_LABEL = { text: "Text", image: "Image", rect: "Rectangle", ellipse: "Oval", line: "Line", arrow: "Arrow", draw: "Drawing", highlight: "Highlight", underline: "Underline", strike: "Strike-through", note: "Note" };

/* ---------- application state ---------- */
let state = createState(); const hist = new History(); const sources = new Map(), assets = new Map();
let fonts = null, tool = "select", selId = null, cur = 0, scale = CSS_UNITS, fitMode = true, vp = null, dprEff = 1;
let pageToken = 0, thumbToken = 0, renderTask = null, busy = false, srcSeq = 0, version = 0, exportedVersion = 0, downloadUrl = null;
const selPages = new Set(), thumbCache = new Map(), textCache = new Map(), pointers = new Map();
let lastReport = null; let drag = null, propsClosed = false, rafPending = false, lastCoalesce = { key: "", t: 0 }, docName = "document.pdf";
const defaults = { text: { font: "Helvetica", size: 18, color: "#000000", bold: false, italic: false, align: "left" }, stroke: "#d92d20", width: 2, fill: null, mark: "#ffe14d", opacity: 1 };
const overlay = $("overlay"), pageCanvas = $("pageCanvas"), markLayer = $("markLayer"), stage = $("stage"), octx = overlay.getContext("2d"), mctx = markLayer.getContext("2d");

/* ---------- small helpers ---------- */
function say(msg, bad = false) { const s = $("status"); s.textContent = msg; s.classList.toggle("bad", bad); }
const fail = e => { console.warn(e); say(String(e && e.message || e), true); };
const guard = fn => async (...a) => { try { return await fn(...a); } catch (e) { fail(e); } };
const curPage = () => state.pages[cur];
const totalRot = p => norm((p.baseRot || 0) + p.rot);
const pageObjects = () => state.objects.filter(o => o.page === curPage()?.id);
const selObj = () => state.objects.find(o => o.id === selId && o.page === curPage()?.id) || null;
const touchUi = () => matchMedia("(pointer:coarse)").matches;
const srcOf = p => sources.get(p.src);
const stripName = n => n.replace(/\.pdf$/i, "");
const isTyping = t => t && (t.tagName === "TEXTAREA" || t.tagName === "SELECT" || (t.tagName === "INPUT" && !["checkbox", "button", "range", "color"].includes(t.type)) || t.isContentEditable);
const friendly = e => {
  const m = String(e && e.message || e);
  if (/password|encrypted/i.test(m)) return "This PDF is password-protected or encrypted. Remove the password in the app that created it, then open it again.";
  if (/No PDF header|Failed to parse|Invalid PDF|Missing PDF|not a PDF|Unexpected/i.test(m)) return "This file is not a readable PDF (it may be damaged or truncated).";
  if (/WinAnsi|cannot encode/i.test(m)) return "The text contains characters the standard PDF fonts cannot draw (for example emoji or Arabic). Use Latin letters, digits and common symbols such as € or é.";
  return m;
};

/* ---------- loading documents ---------- */
function findBytes(bytes, needle) { const n = needle.length; outer: for (let i = 0; i <= bytes.length - n; i++) { if (bytes[i] !== needle.charCodeAt(0)) continue; for (let k = 1; k < n; k++) if (bytes[i + k] !== needle.charCodeAt(k)) continue outer; return true; } return false; }
async function readPdf(file) {
  if (file.size > MAX_BYTES) throw new Error("This file is larger than 50 MB. Choose a smaller PDF.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!findBytes(bytes.subarray(0, Math.min(bytes.length, 2048)), "%PDF-")) throw new Error("not a PDF");
  let pdf;
  try { pdf = await pdfjs.getDocument({ data: bytes.slice(), ...PDFJS_OPTS }).promise; }
  catch (e) { throw new Error(e && e.name === "PasswordException" ? "This PDF is password-protected" : "Failed to parse PDF"); }
  let lib;
  try { lib = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false }); }
  catch (e) { pdf.destroy(); throw new Error(/encrypt/i.test(e.message) ? "This PDF is encrypted" : "Failed to parse PDF"); }
  const id = "s" + (++srcSeq), entries = [];
  for (let i = 1; i <= pdf.numPages; i++) { const p = await pdf.getPage(i); entries.push({ idx: i - 1, view: p.view.slice(), baseRot: p.rotate || 0 }); }
  return { src: { id, name: file.name, bytes, effBytes: bytes, pdf, sig: "" }, entries, lib };
}
const openPicker = input => { input.value = ""; input.click(); };
async function openDocument(file) {
  if (version !== exportedVersion && state.pages.length && !confirm("Open a different PDF? Your unsaved edits will be lost.")) return;
  const { src, entries, lib } = await readPdf(file);
  for (const s of sources.values()) s.pdf.destroy();
  sources.clear(); assets.clear(); thumbCache.clear(); textCache.clear(); selPages.clear(); hist.clear(); clearDownload();
  state = createState(); sources.set(src.id, src); docName = file.name;
  state.pages = entries.map(e => ({ id: uid(state), src: src.id, idx: e.idx, rot: 0, baseRot: e.baseRot, view: e.view, blank: false }));
  cur = 0; selId = null; version = 0; exportedVersion = 0; fitMode = true;
  fonts = fonts || await makeFontMetrics(PDFLib);
  document.body.classList.remove("no-doc");
  $("fileName").textContent = file.name; $("fileName").title = file.name; document.title = file.name + " · PDF Editor · GoVibeTool";
  const extras = await v2.onOpen(lib, src); await describeDocument(src, extras);
  setTool("select"); await afterChange({ reload: true });
  say(`Opened ${file.name} (${state.pages.length} page${state.pages.length === 1 ? "" : "s"}${extras.links ? `, ${extras.links} link${extras.links === 1 ? "" : "s"}` : ""}${extras.bookmarks ? `, ${extras.bookmarks} bookmark${extras.bookmarks === 1 ? "" : "s"}` : ""}). Nothing was uploaded.`);
}
async function describeDocument(src, extras = {}) {
  const notes = [];
  if (extras.unsupported) notes.push(`${extras.unsupported} bookmark${extras.unsupported === 1 ? " uses" : "s use"} an action type the editor cannot keep (it will be dropped when bookmarks are saved).`);
  if (findBytes(src.bytes, "/ByteRange")) notes.push("This PDF contains a digital signature. Any edit invalidates it.");
  try { const f = await src.pdf.getFieldObjects(); if (f && Object.keys(f).length) notes.push("This PDF has form fields. They are kept when you edit, rotate, delete or reorder its pages, but not when you extract pages or insert pages from another PDF."); } catch { /* optional */ }
  notes.push("Export keeps the original pages as they are (no re-rendering), and adds your edits on top.");
  $("docNotes").textContent = notes.join(" ");
}
async function insertDocument(file) {
  const { src, entries, lib } = await readPdf(file);
  sources.set(src.id, src); v2.onInsert(lib, src);
  hist.record(state);
  const at = cur + 1, add = entries.map(e => ({ id: uid(state), src: src.id, idx: e.idx, rot: 0, baseRot: e.baseRot, view: e.view, blank: false }));
  state.pages.splice(at, 0, ...add); cur = at; version++;
  await afterChange({ reload: true }); say(`Inserted ${add.length} page${add.length === 1 ? "" : "s"} from ${file.name}.`);
}
/* Rebuild each source's effective bytes when its recorded text edits changed (also after undo/redo). */
async function syncSources() {
  for (const s of sources.values()) {
    const edits = state.textEdits.filter(e => e.src === s.id), sig = JSON.stringify(edits.map(e => e.engine));
    if (sig === s.sig) continue;
    let res; try { res = await v2.syncSource(s, state); } catch (e) { throw new Error(friendly(e)); }
    const pdf = await pdfjs.getDocument({ data: res.bytes.slice(), ...PDFJS_OPTS }).promise;
    s.pdf.destroy(); s.pdf = pdf; s.effBytes = res.bytes; s.sig = sig; s.notes = res.notes; textCache.delete(`${s.id}`); itemsFor = "";
  }
}

/* ---------- rendering ---------- */
function computeScale() {
  const p = curPage(); if (!p) return;
  if (fitMode) {
    const [x0, y0, x1, y1] = p.view, r = totalRot(p), w = (r % 180 ? y1 - y0 : x1 - x0), avail = Math.max(200, stage.clientWidth - (touchUi() ? 16 : 40));
    scale = clamp(avail / w, 0.2, 4);
  }
  scale = clamp(scale, 0.2, 6);
}
async function renderPage() {
  const p = curPage(); if (!p) return;
  const token = ++pageToken; computeScale();
  vp = makeViewport(p.view, totalRot(p), scale);
  dprEff = Math.min(window.devicePixelRatio || 1, 2);
  while (vp.width * vp.height * dprEff * dprEff > MAX_PIXELS && dprEff > 0.5) dprEff -= 0.25;
  const W = Math.max(1, Math.round(vp.width * dprEff)), H = Math.max(1, Math.round(vp.height * dprEff));
  for (const c of [pageCanvas, markLayer, overlay]) { c.width = W; c.height = H; c.style.width = vp.width + "px"; c.style.height = vp.height + "px"; }
  $("zoomLabel").textContent = Math.round(scale / CSS_UNITS * 100) + "%";
  const g = pageCanvas.getContext("2d");
  if (renderTask) { try { renderTask.cancel(); } catch { /* already finished */ } }
  if (p.blank) { g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); }
  else {
    const page = await srcOf(p).pdf.getPage(p.idx + 1), pvp = page.getViewport({ scale: scale * dprEff, rotation: totalRot(p) });
    renderTask = page.render({ canvasContext: g, viewport: pvp });
    try { await renderTask.promise; } catch (e) { if (!(e && e.name === "RenderingCancelledException")) throw e; return; }
  }
  if (token !== pageToken) return;
  drawOverlay(); updatePageInfo(); primeItems().catch(() => {});
}
function updatePageInfo() {
  const n = state.pages.length;
  $("pageInfo").textContent = n ? `Page ${cur + 1} of ${n}` : "No document";
  $("prevPage").disabled = cur <= 0; $("nextPage").disabled = cur >= n - 1;
}
function scheduleOverlay() { if (rafPending) return; rafPending = true; requestAnimationFrame(() => { rafPending = false; drawOverlay(); }); }

function frameMatrix(o) {
  const [ox, oy] = vp.toDisplay(o.ox, o.oy), { U, D } = axes(o.rot), [ux, uy] = vp.toDisplay(o.ox + U[0], o.oy + U[1]), [dx, dy] = vp.toDisplay(o.ox + D[0], o.oy + D[1]);
  return [ux - ox, uy - oy, dx - ox, dy - oy, ox, oy];
}
const FAMILY_CSS = { Helvetica: 'Helvetica, Arial, "Liberation Sans", sans-serif', Times: '"Times New Roman", Times, "Liberation Serif", serif', Courier: '"Courier New", Courier, "Liberation Mono", monospace' };
function drawObject(g, o) {
  const k = dprEff; g.save(); g.globalAlpha = o.opacity == null ? 1 : o.opacity; g.lineCap = "round"; g.lineJoin = "round";
  const pt = (x, y) => { const [a, b] = vp.toDisplay(x, y); return [a * k, b * k]; };
  if (isFrame(o)) {
    const m = frameMatrix(o); g.setTransform(m[0] * k, m[1] * k, m[2] * k, m[3] * k, m[4] * k, m[5] * k);
    if (o.type === "text") {
      const lay = layoutText(o, fonts); g.fillStyle = o.color; g.textBaseline = "alphabetic";
      g.font = `${o.italic ? "italic " : ""}${o.bold ? "bold " : ""}${o.size}px ${FAMILY_CSS[o.font] || FAMILY_CSS.Helvetica}`;
      lay.lines.forEach((ln, i) => { const u = o.align === "center" ? (o.cw - ln.width) / 2 : o.align === "right" ? o.cw - ln.width : 0; g.fillText(ln.text, u, lay.ascent + i * lay.lineHeight); });
    } else if (o.type === "image") { const a = assets.get(o.asset); if (a) g.drawImage(a.bitmap, 0, 0, o.cw, o.ch); }
    else {
      g.lineWidth = o.stroke ? o.width : 0;
      g.beginPath(); if (o.type === "rect") g.rect(0, 0, o.cw, o.ch); else g.ellipse(o.cw / 2, o.ch / 2, o.cw / 2, o.ch / 2, 0, 0, Math.PI * 2);
      if (o.fill) { g.fillStyle = o.fill; g.fill(); } if (o.stroke) { g.strokeStyle = o.stroke; g.stroke(); }
    }
  } else if (o.type === "line" || o.type === "arrow") {
    g.strokeStyle = o.stroke; g.lineWidth = o.width * scale * k; const a = pt(...o.p1), b = pt(...o.p2); g.beginPath(); g.moveTo(...a); g.lineTo(...b);
    if (o.type === "arrow") { const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), len = Math.max(10, o.width * 4) * scale * k; for (const s of [-1, 1]) { g.moveTo(...b); g.lineTo(b[0] - len * Math.cos(ang + s * 0.45), b[1] - len * Math.sin(ang + s * 0.45)); } }
    g.stroke();
  } else if (o.type === "draw") {
    g.strokeStyle = o.stroke; g.lineWidth = o.width * scale * k; g.beginPath(); o.points.forEach((q, i) => { const [x, y] = pt(...q); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    if (o.points.length === 1) { const [x, y] = pt(...o.points[0]); g.lineTo(x + .01, y); } g.stroke();
  } else if (o.rects) {
    for (const r of o.rects) {
      const [x0, y0] = pt(r.x, r.y), [x1, y1] = pt(r.x + r.w, r.y + r.h), x = Math.min(x0, x1), y = Math.min(y0, y1), w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
      if (o.type === "highlight") { g.fillStyle = o.color; g.globalAlpha = o.opacity == null ? 0.4 : o.opacity; g.fillRect(x, y, w, h); }
      else { g.strokeStyle = o.color; g.lineWidth = Math.max(1, r.h * 0.07 * scale * k); g.beginPath(); const yy = o.type === "underline" ? y + h * 0.88 : y + h * 0.5; g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); }
    }
  } else if (o.type === "note") {
    const [x0, y0] = pt(o.x, o.y), [x1, y1] = pt(o.x + NOTE_SIZE, o.y + NOTE_SIZE), x = Math.min(x0, x1), y = Math.min(y0, y1), w = Math.abs(x1 - x0);
    g.fillStyle = "#ffeb4d"; g.strokeStyle = "#8c6b00"; g.lineWidth = Math.max(1, k); g.fillRect(x, y, w, w); g.strokeRect(x, y, w, w);
    g.beginPath(); for (const f of [.28, .5, .72]) { g.moveTo(x + w * .2, y + w * f); g.lineTo(x + w * (f === .72 ? .55 : .8), y + w * f); } g.stroke();
  }
  g.restore();
}
function selectionGeometry(o) {
  const k = dprEff;
  if (isFrame(o)) {
    const h = frameHeight(o, fonts), disp = ([u, v]) => vp.toDisplay(...frameToUser(o, u, v)), corners = [[0, 0], [o.cw, 0], [o.cw, h], [0, h]].map(disp);
    const handles = handlePoints(o, fonts).map(disp), top = disp([o.cw / 2, 0]), c = disp([o.cw / 2, h / 2]);
    const dx = top[0] - c[0], dy = top[1] - c[1], len = Math.hypot(dx, dy) || 1, off = 28;
    return { corners, handles, rot: [top[0] + dx / len * off, top[1] + dy / len * off], k };
  }
  const b = bounds(o, fonts), pts = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]].map(q => vp.toDisplay(...q));
  const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]), x0 = Math.min(...xs) - 3, x1 = Math.max(...xs) + 3, y0 = Math.min(...ys) - 3, y1 = Math.max(...ys) + 3;
  const ends = o.type === "line" || o.type === "arrow" ? [vp.toDisplay(...o.p1), vp.toDisplay(...o.p2)] : null;
  return { corners: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], handles: null, ends, k };
}
function handleSize() { return touchUi() ? 16 : 10; }
function drawOverlay() {
  if (!vp) return;
  const k = dprEff; octx.setTransform(1, 0, 0, 1, 0, 0); octx.clearRect(0, 0, overlay.width, overlay.height); mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.clearRect(0, 0, markLayer.width, markLayer.height);
  // Highlights go on their own layer that multiplies with the page, like the exported file does.
  for (const o of pageObjects()) drawObject(o.type === "highlight" ? mctx : octx, o);
  v2.drawOverlay(octx, k);
  const o = selObj(); overlay.dataset.selection = o ? "1" : "0"; overlay.dataset.marker = "0";
  if (o && !(drag && drag.kind === "create")) {
    const geo = selectionGeometry(o), g = octx; g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.strokeStyle = "#2057d6"; g.lineWidth = 1.5 * k; g.setLineDash([6 * k, 4 * k]); g.beginPath(); geo.corners.forEach(([x, y], i) => i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k)); g.closePath(); g.stroke(); g.setLineDash([]);
    const bw = Math.hypot(geo.corners[1][0] - geo.corners[0][0], geo.corners[1][1] - geo.corners[0][1]), bh = Math.hypot(geo.corners[2][0] - geo.corners[1][0], geo.corners[2][1] - geo.corners[1][1]);
    const hs = Math.min(handleSize(), Math.max(6, 0.45 * Math.min(bw, bh))) * k; g.fillStyle = "#fff"; g.lineWidth = 2 * k;
    if (geo.handles) { geo.handles.forEach(([x, y], i) => { if (o.type === "text" && (i === 1 || i === 5)) return; g.beginPath(); g.rect(x * k - hs / 2, y * k - hs / 2, hs, hs); g.fill(); g.stroke(); }); const [rx, ry] = geo.rot, [tx, ty] = [(geo.corners[0][0] + geo.corners[1][0]) / 2, (geo.corners[0][1] + geo.corners[1][1]) / 2]; g.beginPath(); g.moveTo(tx * k, ty * k); g.lineTo(rx * k, ry * k); g.stroke(); g.beginPath(); g.arc(rx * k, ry * k, hs * .6, 0, Math.PI * 2); g.fill(); g.stroke(); }
    if (geo.ends) for (const [x, y] of geo.ends) { g.beginPath(); g.arc(x * k, y * k, hs * .6, 0, Math.PI * 2); g.fill(); g.stroke(); }
    g.restore();
  }
  if (drag && drag.preview) drag.preview(octx, k);
}

/* ---------- thumbnails ---------- */
const srcSig = id => (sources.get(id) || {}).sig || "";
const thumbKey = p => p.blank ? `blank:${p.view.join(",")}` : `${p.src}:${p.idx}:${totalRot(p)}:${srcSig(p.src)}`;
async function renderThumbs() {
  const token = ++thumbToken, list = $("thumbs"), W = 120, dpr = Math.min(window.devicePixelRatio || 1, 2);
  list.replaceChildren();
  state.pages.forEach((p, i) => {
    const r = totalRot(p), [x0, y0, x1, y1] = p.view, pw = r % 180 ? y1 - y0 : x1 - x0, ph = r % 180 ? x1 - x0 : y1 - y0;
    const li = document.createElement("li"); li.className = "thumb" + (i === cur ? " current" : ""); li.dataset.id = p.id; li.draggable = true;
    const main = document.createElement("button"); main.type = "button"; main.className = "thumb-main"; main.setAttribute("aria-label", `Go to page ${i + 1}`); main.setAttribute("aria-current", i === cur ? "page" : "false");
    const c = document.createElement("canvas"); c.width = Math.round(W * dpr); c.height = Math.round(W * dpr * ph / pw);
    const num = document.createElement("span"); num.className = "num"; num.textContent = String(i + 1);
    main.append(c, num); main.addEventListener("click", () => goTo(i));
    const chk = document.createElement("label"); chk.className = "chk"; const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = selPages.has(p.id); cb.setAttribute("aria-label", `Select page ${i + 1}`);
    cb.addEventListener("change", () => { cb.checked ? selPages.add(p.id) : selPages.delete(p.id); updatePageButtons(); }); chk.append(cb);
    const moves = document.createElement("div"); moves.className = "moves";
    for (const [dir, icon, label] of [[-1, "up", "earlier"], [1, "down", "later"]]) {
      const b = document.createElement("button"); b.type = "button"; b.className = "icon"; b.setAttribute("aria-label", `Move page ${i + 1} ${label}`); b.title = `Move ${label}`; b.disabled = (dir < 0 && i === 0) || (dir > 0 && i === state.pages.length - 1);
      b.innerHTML = `<svg class="ic"><use href="#i-${icon}"/></svg>`; b.addEventListener("click", guard(async () => { await commit(() => { state.pages = movePage(state.pages, p.id, i + dir); cur = i + dir; }, { pages: true }); say(`Moved page to position ${i + dir + 1}.`); })); moves.append(b);
    }
    const n = state.objects.filter(o => o.page === p.id).length; if (n) { const bd = document.createElement("span"); bd.className = "badge"; bd.textContent = String(n); bd.title = `${n} edit${n > 1 ? "s" : ""} on this page`; li.append(bd); }
    li.append(main, chk, moves); list.append(li);
    li.addEventListener("dragstart", e => { li.classList.add("dragging"); e.dataTransfer.setData("text/plain", String(p.id)); e.dataTransfer.effectAllowed = "move"; });
    li.addEventListener("dragend", () => { li.classList.remove("dragging"); list.querySelectorAll(".drop-before").forEach(x => x.classList.remove("drop-before")); });
    li.addEventListener("dragover", e => { e.preventDefault(); list.querySelectorAll(".drop-before").forEach(x => x.classList.remove("drop-before")); li.classList.add("drop-before"); });
    li.addEventListener("drop", guard(async e => { e.preventDefault(); const id = Number(e.dataTransfer.getData("text/plain")); if (!id || id === p.id) return; const to = state.pages.findIndex(x => x.id === p.id); const from = state.pages.findIndex(x => x.id === id); await commit(() => { state.pages = movePage(state.pages, id, from < to ? to : to); cur = state.pages.findIndex(x => x.id === id); }, { pages: true }); say(`Moved page to position ${cur + 1}.`); }));
  });
  updatePageButtons();
  const items = [...list.children];
  for (let i = 0; i < state.pages.length; i++) {
    if (token !== thumbToken) return;
    const p = state.pages[i], c = items[i] && items[i].querySelector("canvas"); if (!c) continue;
    const key = thumbKey(p); let src = thumbCache.get(key);
    if (!src) {
      src = document.createElement("canvas"); src.width = c.width; src.height = c.height; const g = src.getContext("2d");
      if (p.blank) { g.fillStyle = "#fff"; g.fillRect(0, 0, src.width, src.height); }
      else { const page = await srcOf(p).pdf.getPage(p.idx + 1), base = page.getViewport({ scale: 1, rotation: totalRot(p) }); await page.render({ canvasContext: g, viewport: page.getViewport({ scale: src.width / base.width, rotation: totalRot(p) }) }).promise; }
      thumbCache.set(key, src);
    }
    c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
  }
}
function markCurrentThumb() { [...$("thumbs").children].forEach((li, i) => { li.classList.toggle("current", i === cur); li.querySelector(".thumb-main").setAttribute("aria-current", i === cur ? "page" : "false"); }); const el = $("thumbs").children[cur]; if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" }); }
function updatePageButtons() {
  const has = state.pages.length > 0, targets = pageTargets();
  $("pgRotL").disabled = $("pgRotR").disabled = !has; $("pgExtract").disabled = !has; $("pgDel").disabled = !has || targets.length >= state.pages.length;
  $("pgBlank").disabled = $("pgInsert").disabled = !has;
}
const pageTargets = () => selPages.size ? state.pages.filter(p => selPages.has(p.id)).map(p => p.id) : (curPage() ? [curPage().id] : []);

/* ---------- history / commit ---------- */
async function afterChange({ reload = false, pages = false } = {}) {
  if (reload) await syncSources();
  if (cur >= state.pages.length) cur = state.pages.length - 1; if (cur < 0) cur = 0;
  if (reload || pages) { await renderThumbs(); await renderPage(); } else { drawOverlay(); refreshThumbBadges(); }
  updateButtons(); syncProps(); renderObjList(); markCurrentThumb(); if (pages) await v2.pageChanged(); v2.refresh();
}
function refreshThumbBadges() { [...$("thumbs").children].forEach((li, i) => { const p = state.pages[i]; if (!p) return; const n = state.objects.filter(o => o.page === p.id).length; let b = li.querySelector(".badge"); if (n) { if (!b) { b = document.createElement("span"); b.className = "badge"; li.prepend(b); } b.textContent = String(n); b.title = `${n} edit${n > 1 ? "s" : ""} on this page`; } else if (b) b.remove(); }); }
async function commit(mutate, flags = {}) { hist.record(state); version++; clearDownload(); mutate(); await afterChange(flags); }
/* Coalesce rapid property edits (typing, sliders) into one undo step. */
async function commitCoalesced(key, mutate, flags = {}) {
  const now = Date.now(), same = lastCoalesce.key === key && now - lastCoalesce.t < 900; lastCoalesce = { key, t: now };
  if (!same) { hist.record(state); version++; } clearDownload(); mutate(); await afterChange(flags);
}
async function restore(snap) {
  const seq = Math.max(state.seq, snap.seq); state.pages = snap.pages; state.objects = snap.objects; state.edits = snap.edits || []; state.textEdits = snap.textEdits || []; state.links = snap.links || []; state.outline = snap.outline || []; state.outlineDirty = !!snap.outlineDirty; state.seq = seq; version++; clearDownload();
  if (!selObj()) selId = null; selPages.clear(); await afterChange({ reload: true }); v2.refresh();
}
const undo = guard(async () => { if (busy) return; const s = hist.undo(state); if (s) { await restore(s); say("Undone."); } });
const redo = guard(async () => { if (busy) return; const s = hist.redo(state); if (s) { await restore(s); say("Redone."); } });
function updateButtons() {
  const has = state.pages.length > 0;
  $("undo").disabled = !hist.canUndo; $("redo").disabled = !hist.canRedo; $("download").disabled = !has;
  for (const id of ["zoomIn", "zoomOut", "zoomFit", "pagesToggle"]) $(id).disabled = !has;
  updatePageButtons(); updatePageInfo();
}

/* ---------- navigation and zoom ---------- */
const goTo = guard(async i => { if (i < 0 || i >= state.pages.length) return; cur = i; selId = null; markCurrentThumb(); await renderPage(); syncProps(); renderObjList(); await v2.pageChanged(); stage.scrollTop = 0; document.body.classList.remove("pages-open"); $("pagesToggle").setAttribute("aria-expanded", "false"); });
function setZoom(pct) { fitMode = false; scale = CSS_UNITS * pct / 100; renderPage(); }
function stepZoom(dir) { const pct = scale / CSS_UNITS * 100, next = dir > 0 ? ZOOM_STEPS.find(z => z > pct + 1) : [...ZOOM_STEPS].reverse().find(z => z < pct - 1); if (next) setZoom(next); }
let resizeTimer = 0; addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (fitMode && vp) renderPage(); }, 150); });

const v2 = createV2({ PDFLib, $, say, fail, guard, friendly, commit, getState: () => state, getCur: () => cur, getVp: () => vp, getScale: () => scale, getDpr: () => dprEff, curPage, srcOf, setTool: t => setTool(t), getTool: () => tool, goTo: i => goTo(i), scheduleOverlay });

/* ---------- tools ---------- */
function setTool(t) {
  tool = t;
  for (const b of document.querySelectorAll(".tool")) b.setAttribute("aria-pressed", String(b.dataset.tool === t));
  overlay.className = "tool-" + t; $("toolHelp").textContent = HELP[t] || "";
  if (t !== "select" && t !== "edittext") selId = null;
  propsClosed = false; syncProps(); renderObjList(); drawOverlay(); v2.toolChanged().catch(fail);
}
for (const b of document.querySelectorAll(".tool")) b.addEventListener("click", () => { if (b.dataset.tool === "image") { setTool("image"); openPicker($("imageInput")); return; } setTool(b.dataset.tool); });

/* ---------- pointer interaction ---------- */
function eventPoint(e) { const r = overlay.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
const userPt = d => vp.toUser(d[0], d[1]);
const tolPts = () => (touchUi() ? 12 : 6) / scale;
function hitHandle(o, d) {
  const geo = selectionGeometry(o), r = handleSize() * 0.9 + (touchUi() ? 6 : 2);
  if (geo.handles) {
    const [rx, ry] = geo.rot; if (Math.hypot(d[0] - rx, d[1] - ry) <= r) return { kind: "rotate" };
    // On a small object the handle zones would swallow its body, so shrink them; the object can be zoomed to resize it precisely.
    const w = Math.hypot(geo.corners[1][0] - geo.corners[0][0], geo.corners[1][1] - geo.corners[0][1]), h = Math.hypot(geo.corners[2][0] - geo.corners[1][0], geo.corners[2][1] - geo.corners[1][1]), rh = clamp(0.4 * Math.min(w, h), 5, r);
    for (let i = 0; i < 8; i++) { if (o.type === "text" && (i === 1 || i === 5)) continue; const [x, y] = geo.handles[i]; if (Math.abs(d[0] - x) <= rh && Math.abs(d[1] - y) <= rh) return { kind: "resize", h: i }; }
  }
  if (geo.ends) for (let i = 0; i < 2; i++) if (Math.hypot(d[0] - geo.ends[i][0], d[1] - geo.ends[i][1]) <= r) return { kind: "endpoint", which: i };
  return null;
}
function cursorFor(o, d) {
  if (!o) return "";
  const hit = hitHandle(o, d); if (hit) { if (hit.kind === "rotate") return "cur-rotate"; if (hit.kind === "endpoint") return "cur-move"; return ["cur-nwse", "cur-ns", "cur-nesw", "cur-ew"][hit.h % 4]; }
  return hitTest(o, userPt(d), fonts, tolPts()) ? "cur-move" : "";
}
const CURS = ["cur-move", "cur-grab", "cur-nwse", "cur-nesw", "cur-ns", "cur-ew", "cur-rotate"];
function setCursor(c) { for (const x of CURS) overlay.classList.toggle(x, x === c); }
function topObjectAt(u) { const list = pageObjects(); for (let i = list.length - 1; i >= 0; i--) if (hitTest(list[i], u, fonts, tolPts())) return list[i]; return null; }
const newObj = (type, extra) => ({ id: uid(state), page: curPage().id, type, ...extra });
function frameRect(d0, d1) { // display rect -> frame (upright for the current page rotation)
  const x0 = Math.min(d0[0], d1[0]), y0 = Math.min(d0[1], d1[1]), w = Math.abs(d1[0] - d0[0]), h = Math.abs(d1[1] - d0[1]), [ox, oy] = vp.toUser(x0, y0);
  return { ox, oy, rot: totalRot(curPage()), cw: w / scale, ch: h / scale };
}
function styleOf() { return { stroke: defaults.stroke, width: defaults.width, opacity: defaults.opacity }; }

overlay.addEventListener("pointerdown", e => {
  if (!vp || busy) return;
  if (e.pointerType === "mouse" && e.button !== 0) return;
  overlay.setPointerCapture(e.pointerId); pointers.set(e.pointerId, [e.clientX, e.clientY]);
  if (pointers.size === 2) { startPinch(); return; }
  if (pointers.size > 2) return;
  const d = eventPoint(e), u = userPt(d), o = selObj();
  if (tool === "select") {
    if (o) { const h = hitHandle(o, d); if (h) { drag = { kind: h.kind, h: h.h, which: h.which, orig: clone(o), id: o.id, recorded: false, pid: e.pointerId }; return; } }
    const hit = topObjectAt(u);
    if (hit) { selId = hit.id; drag = { kind: "move", start: u, orig: clone(hit), id: hit.id, recorded: false, pid: e.pointerId }; syncProps(); renderObjList(); drawOverlay(); if (e.detail === 2 && hit.type === "text") $("propText").focus(); return; }
    selId = null; syncProps(); renderObjList(); drawOverlay(); drag = { kind: "pan", sx: e.clientX, sy: e.clientY, left: stage.scrollLeft, top: stage.scrollTop, pid: e.pointerId }; return;
  }
  if (tool === "edittext") { drag = null; v2.pick(u).catch(fail); return; }
  if (tool === "note") { drag = null; createNote(u).catch(fail); return; }
  if (tool === "draw") { drag = { kind: "create", type: "draw", pts: [u], pid: e.pointerId, preview: (g, k) => { g.save(); g.strokeStyle = defaults.stroke; g.lineWidth = defaults.width * scale * k; g.lineCap = g.lineJoin = "round"; g.globalAlpha = defaults.opacity; g.beginPath(); drag.pts.forEach((q, i) => { const [x, y] = vp.toDisplay(...q); i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k); }); g.stroke(); g.restore(); } }; return; }
  const dragRect = (g, k, fillStyle) => { const a = drag.d0, b = drag.d1 || drag.d0; g.save(); g.strokeStyle = "#2057d6"; g.fillStyle = fillStyle || "rgba(32,87,214,.12)"; g.setLineDash([6 * k, 4 * k]); g.lineWidth = 1.5 * k; const x = Math.min(a[0], b[0]) * k, y = Math.min(a[1], b[1]) * k, w = Math.abs(b[0] - a[0]) * k, h = Math.abs(b[1] - a[1]) * k; g.fillRect(x, y, w, h); g.strokeRect(x, y, w, h); g.restore(); };
  if (tool === "link") { drag = { kind: "create", type: "link", d0: d, d1: d, pid: e.pointerId, preview: (g, k) => dragRect(g, k, "rgba(32,87,214,.18)") }; return; }
  if (tool === "line" || tool === "arrow") { drag = { kind: "create", type: tool, d0: d, d1: d, pid: e.pointerId, preview: (g, k) => { g.save(); g.strokeStyle = defaults.stroke; g.lineWidth = defaults.width * scale * k; g.lineCap = "round"; g.beginPath(); g.moveTo(drag.d0[0] * k, drag.d0[1] * k); g.lineTo(drag.d1[0] * k, drag.d1[1] * k); g.stroke(); g.restore(); } }; return; }
  drag = { kind: "create", type: tool, d0: d, d1: d, pid: e.pointerId, preview: (g, k) => dragRect(g, k, tool === "highlight" ? "rgba(255,225,77,.35)" : null) };
});
overlay.addEventListener("pointermove", e => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [e.clientX, e.clientY]);
  if (pinch) { updatePinch(); return; }
  if (!vp) return;
  const d = eventPoint(e);
  if (!drag) { if (tool === "select" && e.pointerType === "mouse") setCursor(cursorFor(selObj(), d) || (topObjectAt(userPt(d)) ? "cur-move" : "")); return; }
  if (e.pointerId !== drag.pid) return;
  const u = userPt(d);
  if (drag.kind === "pan") { stage.scrollLeft = drag.left - (e.clientX - drag.sx); stage.scrollTop = drag.top - (e.clientY - drag.sy); return; }
  if (drag.kind === "create") { if (drag.type === "draw") drag.pts.push(u); else drag.d1 = d; scheduleOverlay(); return; }
  const o = state.objects.find(x => x.id === drag.id); if (!o) return;
  if (!drag.recorded) { if (Math.hypot(...(drag.kind === "move" ? [d[0] - vp.toDisplay(...drag.start)[0], d[1] - vp.toDisplay(...drag.start)[1]] : [4, 0])) < 3) return; hist.record(state); version++; clearDownload(); drag.recorded = true; }
  const next = clone(drag.orig);
  if (drag.kind === "move") translate(next, u[0] - drag.start[0], u[1] - drag.start[1]);
  else if (drag.kind === "resize") resizeFrame(next, drag.h, u, fonts, { free: e.shiftKey });
  else if (drag.kind === "rotate") rotateFrame(next, u, fonts, { snap: !e.altKey });
  else if (drag.kind === "endpoint") next[drag.which ? "p2" : "p1"] = u;
  Object.keys(o).forEach(k => delete o[k]); Object.assign(o, next); scheduleOverlay();
});
const endPointer = guard(async e => {
  pointers.delete(e.pointerId);
  if (pinch) { if (pointers.size < 2) endPinch(); return; }
  if (!drag || e.pointerId !== drag.pid) return;
  const dr = drag; drag = null;
  if (dr.kind === "pan") return;
  if (dr.kind === "create") { if (e.type === "pointercancel") { drawOverlay(); return; } await finishCreate(dr, eventPoint(e)); return; }
  if (dr.recorded) { await afterChange({}); say(dr.kind === "move" ? "Moved." : dr.kind === "resize" ? "Resized." : dr.kind === "rotate" ? "Rotated." : "Updated."); } else drawOverlay();
});
overlay.addEventListener("pointerup", endPointer); overlay.addEventListener("pointercancel", endPointer);
overlay.addEventListener("lostpointercapture", e => pointers.delete(e.pointerId));

let pinch = null;
function startPinch() { const [a, b] = [...pointers.values()]; pinch = { dist: Math.hypot(a[0] - b[0], a[1] - b[1]), scale0: scale }; drag = null; }
function updatePinch() { const [a, b] = [...pointers.values()]; if (!b) return; const k = Math.hypot(a[0] - b[0], a[1] - b[1]) / (pinch.dist || 1); fitMode = false; scale = clamp(pinch.scale0 * k, 0.2, 6); $("zoomLabel").textContent = Math.round(scale / CSS_UNITS * 100) + "%"; clearTimeout(pinch.t); pinch.t = setTimeout(() => renderPage(), 120); }
function endPinch() { if (pinch) { clearTimeout(pinch.t); renderPage(); } pinch = null; }

async function finishCreate(dr, dEnd) {
  const pid = curPage().id; let o = null; const d0 = dr.d0, d1 = dEnd || dr.d1;
  const moved = dr.type === "draw" ? dr.pts.length > 1 : Math.hypot(d1[0] - d0[0], d1[1] - d0[1]) > 6;
  if (dr.type === "link") { drawOverlay(); await v2.finishLink(d0, d1, moved); return; }
  if (dr.type === "draw") { o = newObj("draw", { points: simplify(dr.pts), ...styleOf() }); if (!moved) o.points = [dr.pts[0]]; }
  else if (dr.type === "line" || dr.type === "arrow") { if (!moved) { drawOverlay(); return; } o = newObj(dr.type, { p1: vp.toUser(...d0), p2: vp.toUser(...d1), ...styleOf() }); }
  else if (dr.type === "rect" || dr.type === "ellipse") { if (!moved) { drawOverlay(); return; } o = newObj(dr.type, { ...frameRect(d0, d1), stroke: defaults.stroke, fill: defaults.fill, width: defaults.width, opacity: defaults.opacity }); }
  else if (dr.type === "text") {
    const [bx, by] = d0, w = moved ? Math.abs(d1[0] - d0[0]) / scale : Math.min(240, Math.max(80, (vp.width - bx) / scale - 8));
    const x0 = moved ? Math.min(d0[0], d1[0]) : bx, y0 = moved ? Math.min(d0[1], d1[1]) : by;
    const f = frameRect([x0, y0], [x0 + w * scale, y0 + 10]);
    o = newObj("text", { ox: f.ox, oy: f.oy, rot: f.rot, cw: Math.max(40, w), text: "Text", ...defaults.text, opacity: defaults.opacity });
  } else { // highlight / underline / strike
    await primeItems(); const rects = markRects(d0, d1, dr.type); if (!rects.length) { drawOverlay(); return; }
    o = newObj(dr.type, { rects, color: defaults.mark, opacity: dr.type === "highlight" ? 0.4 : 1 });
  }
  void pid;
  const keepTool = dr.type === "highlight" || dr.type === "underline" || dr.type === "strike";
  // Switch tool inside the synchronous part of the commit so a quick tap on another tool cannot be overridden afterwards.
  await commit(() => { state.objects.push(o); selId = o.id; if (!keepTool) setTool("select"); }, {});
  say(`${TYPE_LABEL[o.type]} added. Undo is available.`);
  if (o.type === "text") { const t = $("propText"); t.focus(); t.select(); }
}
function simplify(pts) { if (pts.length < 3) return pts; const out = [pts[0]]; let last = pts[0]; const min = 0.6 / scale * 2; for (let i = 1; i < pts.length - 1; i++) if (Math.hypot(pts[i][0] - last[0], pts[i][1] - last[1]) >= min) { out.push(pts[i]); last = pts[i]; } out.push(pts[pts.length - 1]); return out; }
async function createNote(u) {
  const o = newObj("note", { x: u[0] - NOTE_SIZE / 2, y: u[1] - NOTE_SIZE / 2, text: "" });
  await commit(() => { state.objects.push(o); selId = o.id; setTool("select"); }, {}); $("propNoteText").focus(); say("Note added. Type its text in the panel.");
}

/* ---------- text snapping for highlight/underline/strike and existing-text editing ---------- */
async function textItems(p) {
  if (p.blank) return [];
  const s = srcOf(p), key = `${p.src}:${p.idx}:${s.sig}`; if (textCache.has(key)) return textCache.get(key);
  const page = await s.pdf.getPage(p.idx + 1), tc = await page.getTextContent(), seen = new Map(), items = [];
  for (const it of tc.items) {
    if (!it.str || !it.str.trim()) { if (it.str) { /* keep spacing-only runs out of the hit list */ } continue; }
    const [a, b, , , e, f] = it.transform, size = Math.hypot(a, b) || it.height || 10, ux = a / size, uy = b / size, w = it.width;
    const pts = [[0, -size * .22], [w, -size * .22], [w, size * .8], [0, size * .8]].map(([x, y]) => [e + x * ux - y * uy, f + x * uy + y * ux]);
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]), occ = seen.get(it.str) || 0; seen.set(it.str, occ + 1);
    items.push({ str: it.str, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), size, occ, base: [e, f], font: (tc.styles[it.fontName] || {}).fontFamily || "" });
  }
  textCache.set(key, items); return items;
}
function markRects(d0, d1, kind) {
  const [ax, ay] = vp.toUser(...d0), [bx, by] = vp.toUser(...d1), x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by);
  const items = cachedItems(), hit = items.filter(t => t.x1 >= x0 && t.x0 <= x1 && Math.min(t.y1, y1) - Math.max(t.y0, y0) > (t.y1 - t.y0) * 0.35);
  if (!hit.length) return kind === "highlight" ? [{ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }] : [{ x: x0, y: y0, w: x1 - x0, h: Math.max(8, y1 - y0) }];
  const sameLine = hit.every(t => Math.abs(t.base[1] - hit[0].base[1]) < 3);
  const rects = hit.map(t => ({ x: sameLine ? Math.max(t.x0, x0) : t.x0, y: t.y0, w: (sameLine ? Math.min(t.x1, x1) : t.x1) - (sameLine ? Math.max(t.x0, x0) : t.x0), h: t.y1 - t.y0 })).filter(r => r.w > 0.5);
  rects.sort((a, b) => b.y - a.y || a.x - b.x); const merged = [];
  for (const r of rects) { const l = merged[merged.length - 1]; if (l && Math.abs(l.y - r.y) < 1.5 && Math.abs(l.h - r.h) < 2 && r.x - (l.x + l.w) < 3) l.w = r.x + r.w - l.x; else merged.push({ ...r }); }
  return merged;
}
let itemsNow = [], itemsFor = "";
function cachedItems() { return itemsNow; }
async function primeItems() { const p = curPage(); if (!p) { itemsNow = []; return; } const key = p.id + ":" + srcSig(p.src); if (key === itemsFor) return; itemsFor = key; itemsNow = await textItems(p).catch(() => []); }

/* ---------- properties panel ---------- */
const SECTIONS = ["secEditText", "secLink", "secText", "secStroke", "secMark", "secNote", "secGeom", "secOpacity", "secActions"];
/* Never overwrite a field the user is typing in: its value is already current, and rewriting it would move the caret or clamp half-typed numbers. */
const setVal = (el, v) => { if (document.activeElement === el) return; v = String(v); if (el.value !== v) el.value = v; };
function show(id, on) { $(id).hidden = !on; }
function syncProps() {
  const o = selObj(); let sections = new Set(); const ty = o ? o.type : tool === "select" ? "" : tool;
  if (tool === "edittext") sections.add("secEditText");
  else if (tool === "link") sections.add("secLink");
  else if (ty === "text") { sections.add("secText"); sections.add("secOpacity"); }
  else if (ty === "rect" || ty === "ellipse") { sections.add("secStroke"); sections.add("secOpacity"); }
  else if (ty === "line" || ty === "arrow" || ty === "draw") { sections.add("secStroke"); sections.add("secOpacity"); }
  else if (ty === "highlight" || ty === "underline" || ty === "strike") { sections.add("secMark"); if (ty === "highlight") sections.add("secOpacity"); }
  else if (ty === "note") sections.add("secNote");
  else if (ty === "image") sections.add("secOpacity");
  if (o) sections.add("secActions");
  if (o && isFrame(o)) sections.add("secGeom");
  for (const id of SECTIONS) show(id, sections.has(id));
  show("secPlace", !o && ["text", "rect", "ellipse", "line", "arrow", "note"].includes(tool));
  show("fillRow", !o ? (tool === "rect" || tool === "ellipse") : (o.type === "rect" || o.type === "ellipse"));
  $("propsTitle").textContent = o ? TYPE_LABEL[o.type] : tool === "select" ? "Properties" : (tool === "edittext" ? "Edit existing text" : tool === "link" ? "Hyperlinks" : "New " + (TYPE_LABEL[tool] || "object").toLowerCase());
  if (o && o.type === "text") { setVal($("propText"), o.text); $("propFont").value = o.font; setVal($("propSize"), Math.round(o.size * 10) / 10); $("propColor").value = o.color; $("propAlign").value = o.align || "left"; $("propBold").setAttribute("aria-pressed", String(!!o.bold)); $("propItalic").setAttribute("aria-pressed", String(!!o.italic)); }
  else if (!o && tool === "text") { const d = defaults.text; setVal($("propText"), ""); $("propFont").value = d.font; setVal($("propSize"), d.size); $("propColor").value = d.color; $("propAlign").value = d.align; $("propBold").setAttribute("aria-pressed", String(d.bold)); $("propItalic").setAttribute("aria-pressed", String(d.italic)); }
  const st = o || { stroke: defaults.stroke, width: defaults.width, fill: defaults.fill, color: defaults.mark, opacity: defaults.opacity };
  if (st.stroke || !o) $("propStroke").value = st.stroke || defaults.stroke; setVal($("propWidth"), st.width == null ? defaults.width : st.width);
  $("propNoFill").checked = !st.fill; if (st.fill) $("propFill").value = st.fill;
  if (o && o.color && ["highlight", "underline", "strike"].includes(o.type)) $("propMarkColor").value = o.color; else if (!o) $("propMarkColor").value = defaults.mark;
  if (o && o.type === "note") setVal($("propNoteText"), o.text);
  if (o && isFrame(o) && vp) { const [gx, gy] = vp.toDisplay(o.ox, o.oy); setVal($("geoX"), (gx / scale).toFixed(1)); setVal($("geoY"), (gy / scale).toFixed(1)); setVal($("geoW"), o.cw.toFixed(1)); setVal($("geoH"), frameHeight(o, fonts).toFixed(1)); $("geoH").disabled = o.type === "text"; setVal($("geoRot"), (Math.round(norm(o.rot - totalRot(curPage())) * 10) / 10).toString()); }
  const op = Math.round((o ? (o.opacity == null ? 1 : o.opacity) : defaults.opacity) * 100); $("propOpacity").value = op; $("opacityVal").textContent = op + "%";
  const phone = matchMedia("(max-width:900px)").matches, placeable = ["text", "rect", "ellipse", "line", "arrow", "note"].includes(tool), wantSheet = !propsClosed && (o || tool === "edittext" || tool === "link" || (!phone && tool !== "select" && tool !== "image") || (phone && placeable));
  document.body.classList.toggle("props-open", !!wantSheet); document.body.classList.toggle("props-compact", !!(wantSheet && phone && !o && placeable));
  $("textWarn").hidden = true;
}
function renderObjList() {
  const ul = $("objList"); ul.replaceChildren(); const list = pageObjects();
  if (!list.length) { const li = document.createElement("li"); li.className = "hint"; li.textContent = "Nothing added to this page yet."; ul.append(li); return; }
  list.forEach((o, i) => {
    const li = document.createElement("li"), b = document.createElement("button"); b.type = "button"; b.setAttribute("aria-pressed", String(o.id === selId));
    const extra = o.type === "text" ? `: ${o.text.slice(0, 30)}` : o.type === "note" ? `: ${(o.text || "empty").slice(0, 30)}` : o.meta === "cover" ? " (cover, overlay)" : "";
    b.textContent = `${i + 1}. ${TYPE_LABEL[o.type]}${extra}`; b.addEventListener("click", () => { setTool("select"); selId = o.id; syncProps(); renderObjList(); drawOverlay(); say(`Selected ${TYPE_LABEL[o.type].toLowerCase()}.`); });
    li.append(b); ul.append(li);
  });
}
/* Edit a property of the selected object, or the defaults for the next object when nothing is selected. */
function setProp(key, patch, defaultsPatch) {
  const o = selObj();
  if (o) return commitCoalesced("prop:" + key + ":" + o.id, () => { Object.assign(o, patch); }, {});
  if (defaultsPatch) Object.assign(defaults, defaultsPatch);
}
function validateText(text, o) {
  const f = { ...(o || defaults.text) }; try { fonts.check(fontKey(f), text); return null; } catch (e) { return friendly(e); }
}
$("propText").addEventListener("input", guard(async () => {
  const o = selObj(); if (!o || o.type !== "text") return; const t = $("propText").value, bad = validateText(t, o);
  $("textWarn").hidden = !bad; if (bad) { $("textWarn").textContent = bad + " The last valid text is kept."; return; }
  await commitCoalesced("text:" + o.id, () => { o.text = t; }, {}); refreshListLabel();
}));
$("propText").addEventListener("blur", () => { const o = selObj(); if (o && o.type === "text") { $("propText").value = o.text; $("textWarn").hidden = true; } });
$("propFont").addEventListener("change", guard(async () => { const v = $("propFont").value, o = selObj(); if (o) { const bad = validateText(o.text, { ...o, font: v }); if (bad) { $("propFont").value = o.font; throw new Error(bad); } } await setProp("font", { font: v }, { text: { ...defaults.text, font: v } }); }));
$("propSize").addEventListener("input", guard(async () => { const v = clamp(Number($("propSize").value) || 18, 6, 400); const o = selObj(); await setProp("size", { size: v }, { text: { ...defaults.text, size: v } }); void o; }));
$("propColor").addEventListener("input", guard(async () => { const v = $("propColor").value; await setProp("color", { color: v }, { text: { ...defaults.text, color: v } }); }));
$("propAlign").addEventListener("change", guard(async () => { const v = $("propAlign").value; await setProp("align", { align: v }, { text: { ...defaults.text, align: v } }); }));
for (const [id, key] of [["propBold", "bold"], ["propItalic", "italic"]]) $(id).addEventListener("click", guard(async () => {
  const on = $(id).getAttribute("aria-pressed") !== "true"; $(id).setAttribute("aria-pressed", String(on)); await setProp(key, { [key]: on }, { text: { ...defaults.text, [key]: on } });
}));
$("propStroke").addEventListener("input", guard(async () => { const v = $("propStroke").value; await setProp("stroke", { stroke: v }, { stroke: v }); }));
$("propWidth").addEventListener("input", guard(async () => { const v = clamp(Number($("propWidth").value) || 1, 0.5, 40); await setProp("width", { width: v }, { width: v }); }));
const fillChange = guard(async () => { const none = $("propNoFill").checked, v = none ? null : $("propFill").value; await setProp("fill", { fill: v }, { fill: v }); });
$("propFill").addEventListener("input", () => { $("propNoFill").checked = false; fillChange(); }); $("propNoFill").addEventListener("change", fillChange);
$("propMarkColor").addEventListener("input", guard(async () => { const v = $("propMarkColor").value; await setProp("mark", { color: v }, { mark: v }); }));
$("propOpacity").addEventListener("input", guard(async () => { const v = Number($("propOpacity").value) / 100; $("opacityVal").textContent = Math.round(v * 100) + "%"; await setProp("opacity", { opacity: v }, { opacity: v }); }));
$("propNoteText").addEventListener("input", guard(async () => { const o = selObj(); if (!o || o.type !== "note") return; await commitCoalesced("note:" + o.id, () => { o.text = $("propNoteText").value; }, {}); refreshListLabel(); }));
function refreshListLabel() { renderObjList(); }
$("objDel").addEventListener("click", guard(async () => { const o = selObj(); if (!o) return; await commit(() => { state.objects = state.objects.filter(x => x.id !== o.id); selId = null; }, {}); say("Deleted. Undo is available."); }));
$("objDup").addEventListener("click", guard(async () => { const o = selObj(); if (!o) return; const c = clone(o); c.id = uid(state); translate(c, 12 / scale * 2, -12 / scale * 2); await commit(() => { state.objects.push(c); selId = c.id; }, {}); say("Duplicated."); }));
const zOrder = dir => guard(async () => { const o = selObj(); if (!o) return; const i = state.objects.indexOf(o), j = i + dir; if (j < 0 || j >= state.objects.length) return; await commit(() => { state.objects.splice(i, 1); state.objects.splice(j, 0, o); }, {}); say(dir > 0 ? "Brought forward." : "Sent backward."); });
$("objFwd").addEventListener("click", zOrder(1)); $("objBack").addEventListener("click", zOrder(-1));
$("propsClose").addEventListener("click", () => { propsClosed = true; document.body.classList.remove("props-open"); });

$("placeBtn").addEventListener("click", guard(async () => {
  if (!vp || !curPage()) return; const cx = vp.width / 2, cy = vp.height / 2, k = scale;
  if (tool === "note") { await createNote(userPt([cx, cy])); return; }
  const dr = tool === "text" ? { type: "text", d0: [cx - 100 * k, cy - 20 * k], d1: [cx - 100 * k, cy - 20 * k] } : (tool === "line" || tool === "arrow") ? { type: tool, d0: [cx - 80 * k, cy + 20 * k], d1: [cx + 80 * k, cy - 20 * k] } : { type: tool, d0: [cx - 70 * k, cy - 40 * k], d1: [cx + 70 * k, cy + 40 * k] };
  await finishCreate(dr, dr.d1);
}));
const applyGeom = guard(async () => {
  const o = selObj(); if (!o || !isFrame(o)) return; const n = id => Number($(id).value), x = n("geoX"), y = n("geoY"), w = n("geoW"), h = n("geoH"), r = n("geoRot");
  if (![x, y, w, h, r].every(Number.isFinite)) return;
  await commitCoalesced("geom:" + o.id, () => { const [ux, uy] = vp.toUser(x * scale, y * scale); o.ox = ux; o.oy = uy; o.cw = Math.max(o.type === "text" ? o.size : 4, w); if (o.type !== "text") o.ch = Math.max(4, h); o.rot = norm(r + totalRot(curPage())); }, {});
});
for (const id of ["geoX", "geoY", "geoW", "geoH", "geoRot"]) $(id).addEventListener("input", applyGeom);

/* ---------- page operations ---------- */
const rotateSel = delta => guard(async () => { const ids = pageTargets(); if (!ids.length) return; await commit(() => { state.pages = rotatePages(state.pages, ids, delta); }, { pages: true }); say(`Rotated ${ids.length} page${ids.length > 1 ? "s" : ""} ${delta > 0 ? "right" : "left"}.`); });
$("pgRotR").addEventListener("click", rotateSel(90)); $("pgRotL").addEventListener("click", rotateSel(-90));
$("pgDel").addEventListener("click", guard(async () => { const ids = pageTargets(); if (!ids.length) return; if (ids.length >= state.pages.length) throw new Error("A PDF needs at least one page."); await commit(() => { deletePages(state, ids); selPages.clear(); selId = null; }, { pages: true }); say(`Deleted ${ids.length} page${ids.length > 1 ? "s" : ""}. Undo is available.`); }));
$("pgBlank").addEventListener("click", guard(async () => { const p = curPage(), r = totalRot(p), [x0, y0, x1, y1] = p.view, size = [x1 - x0, y1 - y0]; void r; await commit(() => { blankPage(state, cur, size); cur += 1; }, { pages: true }); say("Blank page added."); }));
$("pgInsert").addEventListener("click", () => openPicker($("insertInput")));
$("pgExtract").addEventListener("click", guard(async () => { const ids = pageTargets(); if (!ids.length) return; await runExport({ only: ids, name: `${stripName(docName)}-extracted-${ids.length}-page${ids.length > 1 ? "s" : ""}.pdf`, label: `Extracted ${ids.length} page${ids.length > 1 ? "s" : ""}` }); }));
$("pagesToggle").addEventListener("click", () => { const on = !document.body.classList.contains("pages-open"); document.body.classList.toggle("pages-open", on); $("pagesToggle").setAttribute("aria-expanded", String(on)); $("pagesToggle").setAttribute("aria-label", on ? "Hide pages" : "Show pages"); });
$("prevPage").addEventListener("click", () => goTo(cur - 1)); $("nextPage").addEventListener("click", () => goTo(cur + 1));

/* ---------- images ---------- */
async function addImage(file) {
  if (file.size > MAX_IMAGE) throw new Error("Choose an image smaller than 20 MB.");
  let bytes = new Uint8Array(await file.arrayBuffer()), mime = file.type, bitmap;
  try { bitmap = await createImageBitmap(new Blob([bytes], { type: mime })); } catch { throw new Error("That image could not be read."); }
  if (mime !== "image/png" && mime !== "image/jpeg") {
    const c = document.createElement("canvas"); c.width = bitmap.width; c.height = bitmap.height; c.getContext("2d").drawImage(bitmap, 0, 0);
    const blob = await new Promise(r => c.toBlob(r, "image/png")); bytes = new Uint8Array(await blob.arrayBuffer()); mime = "image/png";
  }
  const id = "img" + (assets.size + 1) + "_" + Date.now(); assets.set(id, { bytes, mime, w: bitmap.width, h: bitmap.height, bitmap });
  const p = curPage(), [x0, y0, x1, y1] = p.view, pageW = (totalRot(p) % 180 ? y1 - y0 : x1 - x0), w = Math.min(bitmap.width * 0.75, pageW * 0.5), h = w * bitmap.height / bitmap.width;
  const vr = stage.getBoundingClientRect(), sr = overlay.getBoundingClientRect(), cx = clamp(vr.left + vr.width / 2 - sr.left, 0, vp.width), cy = clamp(vr.top + vr.height / 2 - sr.top, 0, vp.height);
  const f = frameRect([cx - w * scale / 2, cy - h * scale / 2], [cx + w * scale / 2, cy + h * scale / 2]);
  const o = newObj("image", { ...f, asset: id, opacity: 1 });
  await commit(() => { state.objects.push(o); selId = o.id; setTool("select"); }, {}); say("Image added. Drag to move; use the handles to resize or rotate.");
}

/* ---------- export ---------- */
function clearDownload() { if (downloadUrl) { URL.revokeObjectURL(downloadUrl); downloadUrl = null; } const a = $("downloadLink"); a.hidden = true; a.removeAttribute("href"); }
async function buildPdf(only) {
  fonts = fonts || await makeFontMetrics(PDFLib);
  const srcBytes = {}; for (const s of sources.values()) srcBytes[s.id] = s.effBytes;
  const report = {}, extras = v2.exportExtras();
  const bytes = await bakeDocument(PDFLib, { sources: srcBytes, pages: state.pages, objects: state.objects, assets: Object.fromEntries([...assets].map(([k, v]) => [k, { bytes: v.bytes, mime: v.mime }])), fonts, only, links: extras.links, outline: extras.outline, outlineDirty: extras.outlineDirty, report });
  // Verify the result re-opens, before offering it.
  const kept = only ? state.pages.filter(p => only.includes(p.id)) : state.pages, expected = kept.length;
  const chk = await PDFLib.PDFDocument.load(bytes); if (chk.getPageCount() !== expected) throw new Error("The exported PDF did not pass the page-count check. Nothing was downloaded.");
  const problems = await v2.verifyExport(bytes, { pagesList: kept.filter(p => !p.blank), report, rebuiltOutline: !!report.outlineRebuilt });
  if (problems.length) throw new Error("The exported PDF did not pass the content check (" + problems.join("; ") + "). Nothing was downloaded.");
  const doc = await pdfjs.getDocument({ data: bytes.slice(), ...PDFJS_OPTS }).promise; try { await (await doc.getPage(1)).getTextContent(); } finally { doc.destroy(); }
  lastReport = report; return bytes;
}
async function runExport({ only = null, name = null, label = "PDF ready" } = {}) {
  if (busy) return; busy = true; document.body.setAttribute("aria-busy", "true"); say("Building your PDF…");
  try {
    const bytes = await buildPdf(only); clearDownload();
    const blob = new Blob([bytes], { type: "application/pdf" }); downloadUrl = URL.createObjectURL(blob);
    const fname = name || `${stripName(docName)}-edited.pdf`, a = $("downloadLink"); a.href = downloadUrl; a.download = fname; a.textContent = `Download ${fname} (${Math.ceil(blob.size / 1024)} KB)`; a.hidden = false;
    const tmp = document.createElement("a"); tmp.href = downloadUrl; tmp.download = fname; document.body.append(tmp); tmp.click(); tmp.remove();
    if (!only) exportedVersion = version;
    const w = lastReport && lastReport.warnings && lastReport.warnings.length ? " Notes: " + [...new Set(lastReport.warnings)].join(" ") : "";
    say(`${label}: ${fname}. If your browser did not start the download, use the green link.${w}`);
  } catch (e) { fail(new Error("Export failed: " + friendly(e))); }
  finally { busy = false; document.body.removeAttribute("aria-busy"); }
}
$("download").addEventListener("click", () => runExport());
$("downloadLink").addEventListener("click", () => { exportedVersion = version; });

/* ---------- open / drop / keyboard ---------- */
$("openBtn").addEventListener("click", () => openPicker($("fileInput"))); $("welcomeOpen").addEventListener("click", () => openPicker($("fileInput"))); $("openBtn2").addEventListener("click", () => openPicker($("fileInput")));
const welcomeError = msg => { const w = $("welcomeError"); w.hidden = !msg; w.textContent = msg || ""; };
const handleOpen = async file => { welcomeError(""); try { await openDocument(file); } catch (e) { const m = friendly(e); if (state.pages.length) fail(new Error(m)); else { welcomeError(m); say(m, true); } } };
$("fileInput").addEventListener("change", e => { const f = e.target.files[0]; if (f) handleOpen(f); });
$("insertInput").addEventListener("change", guard(async e => { const f = e.target.files[0]; if (f) { try { await insertDocument(f); } catch (err) { throw new Error(friendly(err)); } } }));
$("imageInput").addEventListener("change", guard(async e => { const f = e.target.files[0]; if (f) await addImage(f); }));
for (const t of [document.body]) {
  t.addEventListener("dragover", e => { if ([...(e.dataTransfer?.types || [])].includes("Files")) { e.preventDefault(); $("dropZone").classList.add("over"); } });
  t.addEventListener("dragleave", e => { if (e.target === t || e.target === document.documentElement) $("dropZone").classList.remove("over"); });
  t.addEventListener("drop", e => { const files = [...(e.dataTransfer?.files || [])]; if (!files.length) return; e.preventDefault(); $("dropZone").classList.remove("over"); const f = files[0]; if (f.type.startsWith("image/") && state.pages.length) addImage(f).catch(fail); else handleOpen(f); });
}
addEventListener("keydown", guard(async e => {
  const ctrl = e.ctrlKey || e.metaKey, t = e.target;
  if (ctrl && !isTyping(t)) { const k = e.key.toLowerCase(); if (k === "z") { e.preventDefault(); e.shiftKey ? await redo() : await undo(); return; } if (k === "y") { e.preventDefault(); await redo(); return; } if (k === "d" && selObj()) { e.preventDefault(); $("objDup").click(); return; } return; }
  if (isTyping(t) || e.altKey || !state.pages.length) { if (e.key === "Escape" && isTyping(t)) t.blur(); return; }
  const o = selObj();
  if (e.key === "Escape") { if (o) { selId = null; syncProps(); renderObjList(); drawOverlay(); } else setTool("select"); return; }
  if ((e.key === "Delete" || e.key === "Backspace") && o) { e.preventDefault(); $("objDel").click(); return; }
  if (e.key.startsWith("Arrow") && o) {
    e.preventDefault(); const step = e.shiftKey ? 10 : 1, dd = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    const a = vp.toUser(0, 0), b = vp.toUser(dd[0] * scale, dd[1] * scale); await commitCoalesced("nudge:" + o.id, () => translate(o, b[0] - a[0], b[1] - a[1]), {}); return;
  }
  if (e.key === "PageDown") { e.preventDefault(); goTo(cur + 1); return; } if (e.key === "PageUp") { e.preventDefault(); goTo(cur - 1); return; }
  if (e.key === "+" || e.key === "=") { stepZoom(1); return; } if (e.key === "-") { stepZoom(-1); return; } if (e.key === "0") { fitMode = true; renderPage(); return; }
  if (e.key === "]" && o) { $("objFwd").click(); return; } if (e.key === "[" && o) { $("objBack").click(); return; }
  const tl = KEYS[e.key.toLowerCase()]; if (tl && !ctrl) { if (tl === "image") $("rail").querySelector('[data-tool="image"]').click(); else setTool(tl); }
}));
$("undo").addEventListener("click", undo); $("redo").addEventListener("click", redo);
$("zoomIn").addEventListener("click", () => stepZoom(1)); $("zoomOut").addEventListener("click", () => stepZoom(-1)); $("zoomFit").addEventListener("click", () => { fitMode = true; renderPage(); });
stage.addEventListener("wheel", e => { if (e.ctrlKey && state.pages.length) { e.preventDefault(); stepZoom(e.deltaY < 0 ? 1 : -1); } }, { passive: false });
addEventListener("beforeunload", e => { if (state.pages.length && version !== exportedVersion) { e.preventDefault(); e.returnValue = ""; } });
addEventListener("pagehide", clearDownload);

window.pdfEditorDebug = { v2: v2.debug, state: () => clone(state), viewport: () => vp && { scale: vp.scale, width: vp.width, height: vp.height, rotation: vp.rotation }, toDisplay: (x, y) => vp.toDisplay(x, y), tool: () => tool, families: FAMILIES };
updateButtons();
