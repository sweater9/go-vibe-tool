import { indexPageText, searchDocument } from "./find-core.mjs";

/* Read-only Find UI. No PDF bytes or search terms leave this device. */
export function createFind({ getPages, getSource, goTo, getCurrent, getViewport, getDpr, redraw }) {
  const bar = document.createElement("div");
  bar.className = "pdf-find";
  bar.hidden = true;
  bar.setAttribute("role", "search");
  bar.setAttribute("aria-label", "Find text in PDF");
  bar.innerHTML = '<label for="pdfFindInput">Find</label><input id="pdfFindInput" type="search" placeholder="Search PDF" autocomplete="off" aria-label="Search PDF text"><button type="button" id="pdfFindPrev" aria-label="Previous match">↑</button><button type="button" id="pdfFindNext" aria-label="Next match">↓</button><output id="pdfFindCount" role="status" aria-live="polite">0 results</output><button type="button" id="pdfFindClose" aria-label="Close find">×</button>';
  document.body.append(bar);
  const input = bar.querySelector("input"), count = bar.querySelector("output");
  let results = [], active = -1, token = 0, timer = 0, pageIndexes = [];
  const announce = message => { count.textContent = message; };
  function clear() { token++; clearTimeout(timer); results = []; active = -1; pageIndexes = []; announce("0 results"); redraw(); }
  function close() { bar.hidden = true; clear(); }
  function open() { if (!getPages().length) return; bar.hidden = false; input.focus(); input.select(); if (input.value) schedule(); }
  async function run() {
    const current = ++token, query = input.value.trim();
    results = []; active = -1; redraw();
    if (!query) { announce("0 results"); return; }
    const pages = getPages();
    announce("Searching…");
    const indexes = [];
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
      pageIndexes = indexes;
      results = searchDocument(indexes, query, 1000);
      if (!results.length) { announce("No matches (scanned PDFs may need OCR)"); return; }
      active = 0;
      announce(`1 of ${results.length}${results.length === 1000 ? "+" : ""} matches`);
      await goTo(results[0].pageIndex);
      redraw();
    } catch (error) {
      if (current === token) announce("Unable to search this PDF");
      console.warn("PDF Find:", error);
    }
  }
  function schedule() { clearTimeout(timer); token++; timer = setTimeout(run, 180); }
  async function navigate(delta) {
    if (!results.length) return;
    active = (active + delta + results.length) % results.length;
    const match = results[active];
    announce(`${active + 1} of ${results.length} matches`);
    if (getCurrent() !== match.pageIndex) await goTo(match.pageIndex);
    redraw();
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
      if (hit.pageIndex !== page) continue;
      ctx.fillStyle = i === active ? "rgba(255,126,0,.43)" : "rgba(255,222,0,.30)";
      for (const run of hit.runs) {
        const it = run.item, m = it.transform;
        if (!m) continue;
        const size = Math.hypot(m[0], m[1]) || it.height || 10;
        const [x0,y0] = vp.toDisplay(m[4],m[5]);
        const [x1,y1] = vp.toDisplay(m[4] + it.width,m[5] + size);
        const x = Math.min(x0,x1) * dpr, y = Math.min(y0,y1) * dpr;
        ctx.fillRect(x, y, Math.max(3,Math.abs(x1-x0)*dpr),Math.max(3,Math.abs(y1-y0)*dpr));
      }
    }
    ctx.restore();
  }
  return { open, close, clear, draw, onDocumentChange: clear };
}
