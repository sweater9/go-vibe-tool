/* PDF Compare — everything runs in this page. Files are read with PDF.js from this site's own assets; nothing is uploaded,
   stored or logged (the page's CSP only allows same-origin and blob: requests). */
import * as pdfjs from "../v9-media/vendor/pdf/pdf.min.mjs";
import { tokenize, compareTokens, LIMITS } from "./diff.mjs";
import { itemsToLines, assessText, pageRanges } from "./extract.mjs";

const ASSET = p => new URL("../v9-media/vendor/pdf/" + p, import.meta.url).href;
pdfjs.GlobalWorkerOptions.workerSrc = ASSET("pdf.worker.min.mjs");
const PDFJS_OPTS = { isEvalSupported: false, disableFontFace: true, standardFontDataUrl: ASSET("standard_fonts/"), cMapUrl: ASSET("cmaps/"), cMapPacked: true };
const $ = id => document.getElementById(id);
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const tick = () => new Promise(r => setTimeout(r, 0));
const mb = n => (n / 1048576 >= 0.1 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
const plural = (n, w) => `${n.toLocaleString()} ${w}${n === 1 ? "" : "s"}`;

const docs = { A: null, B: null };        // { name, size, pages: [{lines}], health }
const loading = { A: 0, B: 0 };           // load tokens so a newer choice wins over a slower older read
let result = null, cur = -1, rendered = 0, view = "list", fullBuilt = false, tokA = null, tokB = null;
const PAGE_STEP = 200;

function setStatus(msg) { $("status").textContent = msg; }
function showError(msg) { const e = $("error"); e.hidden = !msg; e.textContent = msg || ""; }

/* ---------- reading a PDF ---------- */
async function readPdf(file, slot, token) {
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") throw new Error(`“${file.name}” is not a PDF file.`);
  if (file.size > LIMITS.maxBytes) throw new Error(`“${file.name}” is ${mb(file.size)}. The limit is ${mb(LIMITS.maxBytes)} per file.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(1024, bytes.length))).includes("%PDF-")) throw new Error(`“${file.name}” does not look like a readable PDF.`);
  let pdf;
  try { pdf = await pdfjs.getDocument({ data: bytes, ...PDFJS_OPTS }).promise; }
  catch (e) {
    if (e && e.name === "PasswordException") throw new Error(`“${file.name}” is password-protected. Remove the password first, then compare it.`);
    throw new Error(`“${file.name}” is not a readable PDF (it may be damaged).`);
  }
  try {
    if (pdf.numPages > LIMITS.maxPages) throw new Error(`“${file.name}” has ${pdf.numPages} pages. The limit is ${LIMITS.maxPages} pages per file. Extract the part you need with the PDF Editor first.`);
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      if (token !== loading[slot]) return null;
      const page = await pdf.getPage(i);
      try { pages.push({ lines: itemsToLines((await page.getTextContent()).items) }); } finally { page.cleanup(); }
      if (i % 4 === 0) { setStatus(`Reading ${slot}: page ${i} of ${pdf.numPages}…`); await tick(); }
    }
    return { name: file.name, size: file.size, pages, health: assessText(pages.map(p => p.lines.join(" "))) };
  } finally { pdf.destroy(); }
}

async function choose(slot, file) {
  if (!file) return;
  showError(null); const token = ++loading[slot]; docs[slot] = null; clearResult();
  $("info" + slot).textContent = `Reading ${file.name}…`; setStatus(`Reading ${slot}…`); syncButtons();
  try {
    const d = await readPdf(file, slot, token); if (!d || token !== loading[slot]) return;
    docs[slot] = d;
    $("info" + slot).replaceChildren(Object.assign(document.createElement("strong"), { textContent: d.name }), document.createTextNode(` · ${mb(d.size)} · ${plural(d.pages.length, "page")}`));
  } catch (e) {
    if (token !== loading[slot]) return;
    $("info" + slot).textContent = "No file chosen."; showError(e.message || String(e)); setStatus("Choose two PDFs to begin.");
  }
  syncButtons(); if (token === loading[slot]) run();
}

/* ---------- comparing ---------- */
function opts() { return { ignoreCase: $("optCase").checked, ignorePunctuation: $("optPunct").checked }; }

function warningsFor() {
  const w = [];
  for (const s of ["A", "B"]) {
    const h = docs[s].health;
    if (h.noText) w.push({ level: "warn", text: `File ${s} has no selectable text. It looks like a scanned document or only images. This tool compares text and does not do OCR, so there is nothing to compare.` });
    else {
      if (h.emptyPages.length) w.push({ level: "warn", text: `File ${s}: ${h.emptyPages.length === 1 ? "page" : "pages"} ${pageRanges(h.emptyPages)} ${h.emptyPages.length === 1 ? "has" : "have"} no selectable text (likely scanned images) and ${h.emptyPages.length === 1 ? "was" : "were"} not compared.` });
      if (h.garbledPages.length) w.push({ level: "warn", text: `File ${s}: text on ${h.garbledPages.length === 1 ? "page" : "pages"} ${pageRanges(h.garbledPages)} could not be decoded reliably (custom font encoding). Results for ${h.garbledPages.length === 1 ? "that page" : "those pages"} may be wrong.` });
    }
  }
  if (docs.A.pages.length !== docs.B.pages.length) w.push({ level: "info", text: `A has ${plural(docs.A.pages.length, "page")} and B has ${plural(docs.B.pages.length, "page")}.` });
  return w;
}

async function run() {
  if (!docs.A || !docs.B) { setStatus(docs.A || docs.B ? "Choose the other PDF to compare." : "Choose two PDFs to begin."); return; }
  showError(null); clearResult(); setStatus("Comparing…"); await tick();
  const warns = warningsFor(), blocked = docs.A.health.noText || docs.B.health.noText;
  renderWarnings(warns);
  if (blocked) { setStatus("Nothing to compare: a file has no selectable text."); return; }
  const o = opts(); tokA = tokenize(docs.A.pages, o); tokB = tokenize(docs.B.pages, o);
  if (tokA.words.length > LIMITS.maxTokens || tokB.words.length > LIMITS.maxTokens) { showError(`These files hold more than ${LIMITS.maxTokens.toLocaleString()} words each, which is more than this tool compares in the browser. Compare smaller parts.`); setStatus("Not compared."); return; }
  await tick(); const t0 = performance.now();
  result = compareTokens(tokA, tokB, o); result.ms = Math.round(performance.now() - t0); result.warnings = warns;
  if (result.approximate) { warns.push({ level: "warn", text: "Some stretches were too different to line up word by word. They are shown as one removed-and-added block each." }); renderWarnings(warns); }
  renderResult(); setStatus(result.summary.total ? `Done: ${plural(result.summary.total, "difference")}.` : "Done: no differences in the readable text.");
}

/* ---------- rendering ---------- */
function renderWarnings(list) {
  const ul = $("warnings"); ul.replaceChildren(); ul.hidden = !list.length;
  for (const w of list) { const li = document.createElement("li"); if (w.level === "info") li.className = "info"; li.textContent = w.text; ul.append(li); }
}
function clearResult() { result = null; cur = -1; rendered = 0; fullBuilt = false; tokA = tokB = null; $("results").hidden = true; document.body.classList.add("no-result"); $("diffList").replaceChildren(); $("fullA").replaceChildren(); $("fullB").replaceChildren(); $("noDiff").hidden = true; $("moreBtn").hidden = true; $("warnings").replaceChildren(); $("warnings").hidden = true; syncNav(); }

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
const SHOW = 700;
function textSpan(tag, text, side) {
  const wrap = el(tag, null); let shown = text, more = null;
  if (text.length > SHOW) {
    shown = text.slice(0, SHOW).trimEnd() + "…"; more = el("button", "more", `Show all (${text.length.toLocaleString()} characters)`); more.type = "button";
    more.addEventListener("click", e => { e.stopPropagation(); const open = more.dataset.open !== "1"; more.dataset.open = open ? "1" : "0"; wrap.firstChild.textContent = open ? text : shown; more.textContent = open ? "Show less" : `Show all (${text.length.toLocaleString()} characters)`; });
  }
  wrap.append(document.createTextNode(shown));
  const out = el("span"); out.append(el("span", "sidelabel", side), wrap); if (more) out.append(more); return out;
}
function pagesLabel(c) {
  const f = (r, s) => r[0] ? `${s} p.${r[0] === r[1] ? r[0] : r[0] + "–" + r[1]}` : ""; return [f(c.pagesA, "A"), f(c.pagesB, "B")].filter(Boolean).join(" · ");
}
function renderBlock(c) {
  const li = el("li", `blk t-${c.type}`); li.dataset.i = c.id; li.tabIndex = -1;
  const head = el("div", "blk-head"); head.append(el("span", "tag", c.type === "added" ? "Added in B" : c.type === "removed" ? "Removed from A" : "Changed"), el("span", "pg", pagesLabel(c))); li.append(head);
  const body = el("p", "blk-body"); if (c.before) body.append(el("span", "ctx", "… " + c.before + " "));
  if (c.type !== "added") { body.append(textSpan("del", c.a, "A")); body.append(" "); }
  if (c.type !== "removed") { body.append(textSpan("ins", c.b, "B")); }
  if (c.after) body.append(el("span", "ctx", " " + c.after + " …")); li.append(body);
  li.addEventListener("click", () => go(c.id, { scroll: false })); return li;
}
function renderMore(upTo) {
  const list = $("diffList"), ch = result.changes, end = Math.min(ch.length, Math.max(upTo + 1, rendered + PAGE_STEP));
  const frag = document.createDocumentFragment(); for (let i = rendered; i < end; i++) frag.append(renderBlock(ch[i])); list.append(frag); rendered = end;
  $("moreBtn").hidden = rendered >= ch.length; $("moreBtn").textContent = `Show more differences (${(ch.length - rendered).toLocaleString()} left)`;
}
function renderResult() {
  const s = result.summary; $("results").hidden = false; document.body.classList.remove("no-result");
  const parts = [`${plural(s.total, "difference")}`]; if (s.total) parts.push(`${s.changed} changed, ${s.added} added, ${s.removed} removed`);
  $("summary").replaceChildren(el("b", null, parts[0]), document.createTextNode((parts[1] ? " · " + parts[1] : "") + ` · A: ${plural(s.wordsA, "word")}, B: ${plural(s.wordsB, "word")}`));
  const emptyPages = docs.A.health.emptyPages.length + docs.B.health.emptyPages.length;
  const nd = $("noDiff"); nd.hidden = s.total > 0;
  if (!s.total) nd.textContent = emptyPages ? "No differences were found in the text that could be read. Some pages have no selectable text and were not compared (see above). Images, layout and formatting are never compared." : "No differences were found in the readable text. Images, layout, formatting and fonts are not compared, so this does not prove the files are identical.";
  $("diffList").replaceChildren(); rendered = 0; if (s.total) renderMore(0);
  fullBuilt = false; if (view === "full") buildFull();
  cur = -1; syncNav(); if (s.total) go(0, { scroll: false, silent: true });
}

/* Full text: one column per file, changed words marked in place. Built from large runs, not per word. */
function buildColumn(tok, changes, side) {
  const n = tok.words.length, mark = new Int32Array(n).fill(-1), gaps = new Map();
  for (const c of changes) { const a = side === "A" ? c.aStart : c.bStart, b = side === "A" ? c.aEnd : c.bEnd; if (a === b) gaps.set(a, c.id); else for (let i = a; i < b; i++) mark[i] = c.id; }
  const root = document.createDocumentFragment(); let page = 0, i = 0;
  const gap = id => { const g = el("span", "gap", side === "A" ? "＋" : "−"); g.dataset.diff = id; g.title = side === "A" ? "B adds text here" : "A had text here"; g.setAttribute("aria-label", g.title); return g; };
  while (i <= n) {
    if (gaps.has(i)) root.append(gap(gaps.get(i)));
    if (i === n) break;
    if (tok.page[i] !== page) { page = tok.page[i]; root.append(el("span", "pghead", `Page ${page}`)); }
    const id = mark[i]; let j = i, s = "";
    while (j < n && mark[j] === id && tok.page[j] === page && (j === i || !gaps.has(j))) { s += (j > i && (tok.sp[j] || tok.nl[j]) ? (tok.nl[j] ? "\n" : " ") : "") + tok.words[j]; j++; }
    const lead = i > 0 && tok.page[i - 1] === page && (tok.sp[i] || tok.nl[i]) ? (tok.nl[i] ? "\n" : " ") : "";
    if (lead) root.append(document.createTextNode(lead));
    if (id < 0) root.append(document.createTextNode(s)); else { const m = el("span", "mk " + (side === "A" ? "del" : "add"), s); m.dataset.diff = id; root.append(m); }
    i = j;
  }
  return root;
}
function buildFull() { if (fullBuilt || !result) return; $("fullA").replaceChildren(buildColumn(tokA, result.changes, "A")); $("fullB").replaceChildren(buildColumn(tokB, result.changes, "B")); fullBuilt = true; }

/* ---------- navigation ---------- */
function syncNav() {
  const n = result ? result.changes.length : 0;
  $("prev").disabled = $("next").disabled = n === 0; $("pos").textContent = n ? `${cur + 1} of ${n.toLocaleString()}` : "0 of 0";
}
function go(i, { scroll = true, silent = false } = {}) {
  if (!result || !result.changes.length) return;
  const n = result.changes.length; cur = ((i % n) + n) % n; if (cur >= rendered) renderMore(cur);
  document.querySelectorAll(".blk.current,.mk.current,.gap.current").forEach(e => { e.classList.remove("current"); e.removeAttribute("aria-current"); });
  const blk = $("diffList").querySelector(`.blk[data-i="${cur}"]`); if (blk) { blk.classList.add("current"); blk.setAttribute("aria-current", "true"); }
  if (view === "full") { buildFull(); document.querySelectorAll(`[data-diff="${cur}"]`).forEach(e => e.classList.add("current")); }
  syncNav();
  if (scroll) {
    const behavior = reduceMotion() ? "auto" : "smooth";
    if (view === "list" && blk) blk.scrollIntoView({ block: "center", behavior });
    if (view === "full") for (const id of ["fullA", "fullB"]) { const t = $(id).querySelector(`[data-diff="${cur}"]`); if (t) { const box = $(id); box.scrollTo({ top: t.offsetTop - box.clientHeight / 3, behavior }); } }
  }
  if (!silent) { const c = result.changes[cur]; setStatus(`Difference ${cur + 1} of ${n}: ${c.type === "added" ? "added in B" : c.type === "removed" ? "removed from A" : "changed"}, ${pagesLabel(c)}.`); }
}
function setView(v) {
  view = v; for (const [t, p, on] of [["tabList", "viewList", v === "list"], ["tabFull", "viewFull", v === "full"]]) { $(t).setAttribute("aria-selected", String(on)); $(p).hidden = !on; }
  if (v === "full") buildFull(); if (result && cur >= 0) go(cur, { silent: true });
}

/* ---------- controls ---------- */
function syncButtons() { $("swap").disabled = !(docs.A || docs.B); $("reset").disabled = !(docs.A || docs.B || loading.A || loading.B); }
function reset() { loading.A++; loading.B++; docs.A = docs.B = null; clearResult(); showError(null); for (const s of ["A", "B"]) { $("info" + s).textContent = "No file chosen."; $("file" + s).value = ""; } setStatus("Choose two PDFs to begin."); syncButtons(); }
function swap() {
  [docs.A, docs.B] = [docs.B, docs.A]; [loading.A, loading.B] = [loading.B, loading.A];
  for (const s of ["A", "B"]) { const d = docs[s]; $("info" + s).replaceChildren(...(d ? [Object.assign(document.createElement("strong"), { textContent: d.name }), document.createTextNode(` · ${mb(d.size)} · ${plural(d.pages.length, "page")}`)] : [document.createTextNode("No file chosen.")])); }
  showError(null); run();
}
for (const s of ["A", "B"]) {
  $("choose" + s).addEventListener("click", () => $("file" + s).click());
  $("file" + s).addEventListener("change", e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; choose(s, f); });
  const z = $("drop" + s);
  z.addEventListener("dragover", e => { if ([...(e.dataTransfer?.types || [])].includes("Files")) { e.preventDefault(); z.classList.add("over"); } });
  z.addEventListener("dragleave", () => z.classList.remove("over"));
  z.addEventListener("drop", e => { e.preventDefault(); z.classList.remove("over"); const f = e.dataTransfer?.files?.[0]; if (f) choose(s, f); });
}
for (const t of ["dragover", "drop"]) addEventListener(t, e => { if ([...(e.dataTransfer?.types || [])].includes("Files")) e.preventDefault(); }); // a miss never navigates away from the page
$("optCase").addEventListener("change", run); $("optPunct").addEventListener("change", run);
$("swap").addEventListener("click", swap); $("reset").addEventListener("click", reset);
$("prev").addEventListener("click", () => go(cur - 1)); $("next").addEventListener("click", () => go(cur + 1));
$("moreBtn").addEventListener("click", () => renderMore(rendered));
$("tabList").addEventListener("click", () => setView("list")); $("tabFull").addEventListener("click", () => setView("full"));
for (const [t, other] of [["tabList", "tabFull"], ["tabFull", "tabList"]]) $(t).addEventListener("keydown", e => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); $(other).focus(); $(other).click(); } });
addEventListener("keydown", e => {
  if (!result || e.ctrlKey || e.metaKey || e.altKey) return; const t = e.target;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  if (e.key === "n" || e.key === "j") { e.preventDefault(); go(cur + 1); } else if (e.key === "p" || e.key === "k") { e.preventDefault(); go(cur - 1); }
});
window.pdfCompareDebug = { result: () => result, docs: () => docs, view: () => view };
