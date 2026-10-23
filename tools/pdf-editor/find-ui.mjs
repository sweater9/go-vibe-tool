import { indexPageText, searchDocument } from "./find-core.mjs";

/* Read-only Find UI. No PDF bytes or search terms leave this device. */
export function createFind({ getPages, getSource, goTo, getCurrent, getViewport, getDpr, redraw, reveal }) {
  const bar = document.createElement("div");
  bar.className = "pdf-find";
  bar.hidden = true;
  bar.setAttribute("role", "search");
  bar.setAttribute("aria-label", "Find text in PDF");
  bar.innerHTML = '<label for="pdfFindInput">Find</label><input id="pdfFindInput" type="search" placeholder="Search PDF" autocomplete="off" aria-label="Search PDF text"><button type="button" id="pdfFindPrev" aria-label="Previous match">↑</button><button type="button" id="pdfFindNext" aria-label="Next match">↓</button><output id="pdfFindCount" role="status" aria-live="polite">0 results</output><button type="button" id="pdfFindClose" aria-label="Close find">×</button>';
  document.body.append(bar);
  const input = bar.querySelector("input"), count = bar.querySelector("output");
  let results = [], active = -1, token = 0, timer = 0;
  const announce = message => { count.textContent = message; };
  function clear() { token++; clearTimeout(timer); const had = results.length > 0; results = []; active = -1; announce("0 results"); if (had) redraw(); }
  function close() { bar.hidden = true; clear(); }
  function open() { if (!getPages().length) return; bar.hidden = false; input.focus(); input.select(); if (input.value) schedule(); }
  async function run() {
    const current = ++token, query = input.value.trim();
    const had = results.length > 0; results = []; active = -1; if (had) redraw();
    if (!query) { announce("0 results"); return; }
    const pages = getPages();
    announce("Searching…");
    const indexes = [], ids = pages.map(p => p.id);
    try {
      for (let i = 0; i < pages.length; i++) {
        if (current !== token) return;
        const p = pages[i];
        if (p.blank) { indexes.push(indexPageText([])); continue; }
        const src = getSource(p);
        const page = await src.pdf.getPage(p.idx + 1);
        const content = await page.getTextContent();
        if (current !== token) return;
        indexes.push(indexPageText(content.items));
        if (i % 5 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (current !== token) return;
      results = searchDocument(indexes, query, 1000).map(hit => ({ ...hit, pageId: ids[hit.pageIndex] }));
      if (!results.length) { announce("No matches (scanned PDFs may need OCR)"); return; }
      active = 0;
      announce(`1 of ${results.length}${results.length === 1000 ? "+" : ""} matches`);
      await show(results[0]);
    } catch (error) {
      if (current === token) announce("Unable to search this PDF");
      console.warn("PDF Find:", error);
    }
  }
  function schedule() { clearTimeout(timer); token++; timer = setTimeout(run, 180); }
  const pageOf = hit => getPages().findIndex(p => p.id === hit.pageId);
  function box(run, hit) {
    const it = run.item, m = it.transform, vp = getViewport();
    if (!m || !vp) return null;
    const len = Math.max(1, String(it.str).length), a = Math.max(hit.start, run.start) - run.start, b = Math.min(hit.end, run.end) - run.start;
    const size = Math.hypot(m[0], m[1]) || it.height || 10, w = it.width || 0;
    const [x0,y0] = vp.toDisplay(m[4] + w * a / len, m[5]);
    const [x1,y1] = vp.toDisplay(m[4] + w * b / len, m[5] + size);
    return { x: Math.min(x0,x1), y: Math.min(y0,y1), w: Math.max(3,Math.abs(x1-x0)), h: Math.max(3,Math.abs(y1-y0)) };
  }
  async function show(hit) {
    const idx = pageOf(hit);
    if (idx < 0) { schedule(); return; }
    if (getCurrent() !== idx) await goTo(idx);
    redraw();
    const first = hit.runs[0] && box(hit.runs[0], hit);
    if (first && reveal) reveal(first.x, first.y);
  }
  async function navigate(delta) {
    if (!results.length) return;
    active = (active + delta + results.length) % results.length;
    announce(`${active + 1} of ${results.length}${results.length === 1000 ? "+" : ""} matches`);
    await show(results[active]);
  }
  input.addEventListener("input", schedule);
  bar.querySelector("#pdfFindPrev").addEventListener("click", () => navigate(-1));
  bar.querySelector("#pdfFindNext").addEventListener("click", () => navigate(1));
  bar.querySelector("#pdfFindClose").addEventListener("click", close);
  input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); navigate(e.shiftKey ? -1 : 1); } if (e.key === "Escape") { e.preventDefault(); close(); } });
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f" && getPages().length) { e.preventDefault(); open(); }
    else if (e.key === "Escape" && !bar.hidden && (document.activeElement === input || bar.contains(document.activeElement))) { e.preventDefault(); close(); }
  }, true);
  function draw(ctx) {
    if (bar.hidden || !results.length) return;
    const vp = getViewport(), dpr = getDpr(), page = getCurrent();
    if (!vp) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0; i < results.length; i++) {
      const hit = results[i];
      if (pageOf(hit) !== page) continue;
      ctx.fillStyle = i === active ? "rgba(255,126,0,.43)" : "rgba(255,222,0,.30)";
      for (const run of hit.runs) {
        const b = box(run, hit);
        if (b) ctx.fillRect(b.x * dpr, b.y * dpr, b.w * dpr, b.h * dpr);
      }
    }
    ctx.restore();
  }
  return { open, close, clear, draw, onDocumentChange: clear };
}
