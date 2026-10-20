/* PDF Editor V2 interface: editing existing text, hyperlinks and bookmarks.
   The engine (./engine) does the PDF work; this module owns the panels, the overlay drawing for these tools and the
   bookkeeping in the editor's undo-able state (state.textEdits, state.links, state.outline). It only ever talks to the
   editor through the `ctx` object, so editor.js keeps its own state private. */
import { FontLibrary, analyzePage, scanUsage, applyTextEdits, measureEdit } from "./engine/edit.mjs";
import { blockReason } from "./engine/textmodel.mjs";
import { detectParagraphs, paragraphOf, paragraphText, reflowParagraph } from "./engine/reflow.mjs";
import { readLinks, normalizeUri, normRect } from "./engine/links.mjs";
import * as O from "./engine/outline.mjs";
import { topOfPage } from "./engine/dest.mjs";

const rawToHex = raw => {
  const hx = v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0");
  let m = /([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+rg/.exec(raw || ""); if (m) return "#" + hx(+m[1]) + hx(+m[2]) + hx(+m[3]);
  m = /([\d.]+)\s+g\b/.exec(raw || ""); if (m) return "#" + hx(+m[1]) + hx(+m[1]) + hx(+m[1]);
  m = /([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+k\b/.exec(raw || ""); if (m) { const k = 1 - +m[4]; return "#" + hx((1 - +m[1]) * k) + hx((1 - +m[2]) * k) + hx((1 - +m[3]) * k); }
  return "#000000";
};
const inQuad = (q, x, y) => { let s = 0; for (let i = 0; i < 4; i++) { const [ax, ay] = q[i], [bx, by] = q[(i + 1) % 4], c = (bx - ax) * (y - ay) - (by - ay) * (x - ax); if (c !== 0) { if (s && Math.sign(c) !== s) return false; s = Math.sign(c); } } return true; };
const snippet = (t, n = 44) => (t.length > n ? t.slice(0, n - 1) + "…" : t) || "(blank)";
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function createV2(ctx) {
  const { PDFLib, $, say, fail, guard, friendly, commit, getState, getCur, getVp, getScale, getDpr, curPage, srcOf, setTool, getTool, goTo, scheduleOverlay } = ctx;
  const engines = new Map(); let blocksFor = null, draft = null, loadToken = 0, measureTimer = 0, measureSeq = 0;
  let linkSel = null, bmSel = null, bmEditing = false, pdraft = null, paraTimer = 0, paraSeq = 0;

  /* ================================================================ engine */
  async function engineFor(src) {
    let e = engines.get(src.id);
    if (!e) { e = { analyses: new Map() }; e.ready = (async () => { e.doc = await PDFLib.PDFDocument.load(src.bytes, { updateMetadata: false }); e.lib = new FontLibrary(PDFLib, e.doc); await scanUsage(PDFLib, e.doc, e.lib, (i, n) => say(`Reading the fonts in this PDF… page ${i} of ${n}`)); })(); engines.set(src.id, e); e.ready.catch(() => engines.delete(src.id)); }
    await e.ready; return e;
  }
  async function analysisOf(src, idx) { const e = await engineFor(src); let a = e.analyses.get(idx); if (!a) { a = await analyzePage(PDFLib, e.doc, e.lib, idx); e.analyses.set(idx, a); } return { a, e }; }
  const editKey = (src, page, blockId) => `${src}|${page}|${blockId}`;
  const editFor = (src, page, blockId) => getState().textEdits.find(x => x.src === src && x.page === page && x.blockId === blockId) || null;

  function charToEntry(block) { const m = []; block.entries.forEach((e, i) => { for (let k = 0; k < e.ch.length; k++) m.push(i); }); return m; }
  function origIndexOf(d, i) { // index in the ORIGINAL text that a character of the draft text corresponds to
    const a = d.block.text, b = d.text; let p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++; let s = 0; while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
    if (i < p) return i; if (i >= b.length - s) return a.length - (b.length - i); return Math.max(0, Math.min(p - 1, a.length - 1));
  }
  function styleAt(d, i) {
    const m = d.map || (d.map = charToEntry(d.block)); const oi = Math.max(0, Math.min(origIndexOf(d, Math.max(0, i)), m.length - 1)), e = d.block.entries[m[oi]] || d.block.entries[0], f = d.props[i] || {};
    const info = e.fontInfo || {};
    return { family: f.family || info.family || "sans", bold: f.bold != null ? f.bold : !!info.bold, italic: f.italic != null ? f.italic : !!info.italic, size: f.size != null ? f.size : Math.round(e.size * d.block.userScale * 10) / 10, color: f.color || rawToHex(e.fill) };
  }
  const rangesOf = (props, scale) => {
    const out = []; let i = 0;
    while (i < props.length) { if (!props[i]) { i++; continue; } let j = i + 1; while (j < props.length && same(props[j], props[i])) j++; const p = { ...props[i] }; if (p.size) p.size = p.size / scale; out.push({ start: i, end: j, props: p }); i = j; }
    return out;
  };
  const toEngine = d => ({ page: d.page, blockId: d.blockId, text: d.text, align: d.align || null, reflow: !!d.reflow, fmt: rangesOf(d.props, d.block.userScale || 1) });
  const isPlain = d => d.text === d.block.text && !d.props.some(Boolean) && !d.align;

  /* ================================================================ page blocks (existing text) */
  async function loadBlocks() {
    const p = curPage(); const token = ++loadToken;
    if (!p || p.blank) { blocksFor = null; renderBlockList(); return; }
    const src = srcOf(p); const first = !engines.has(src.id); if (first) say("Reading the fonts in this PDF…");
    let res; try { res = await analysisOf(src, p.idx); } catch (e) { blocksFor = null; renderBlockList(); fail(new Error("This page could not be analysed for text editing: " + friendly(e))); return; }
    if (token !== loadToken) return;
    blocksFor = { src, page: p.idx, pid: p.id, blocks: res.a.blocks, paras: detectParagraphs(res.a.blocks), doCount: res.a.interp.doCount, a: res.a, hidden: 0 }; renderBlockList(); scheduleOverlay();
    if (res.a.interp.doCount > 0) { // text drawn inside Form XObjects is not part of the page content stream the engine edits: count it so the limit is visible
      try {
        const page = await src.pdf.getPage(p.idx + 1), tc = await page.getTextContent(), words = t => t.split(/\s+/).map(w => w.replace(/[^\p{L}\p{N}]/gu, "")).filter(w => w.length > 1);
        const have = new Map(); for (const b of res.a.blocks) for (const w of words(b.text)) have.set(w, (have.get(w) || 0) + 1);
        let missing = 0; for (const it of tc.items) for (const w of words(it.str)) { const n = have.get(w) || 0; if (n > 0) have.set(w, n - 1); else missing++; }
        if (token === loadToken && blocksFor && blocksFor.pid === p.id) { blocksFor.hidden = missing; renderBlockList(); }
      } catch { /* the note is optional */ }
    }
    if (first) say("Ready. Select a line of text on the page, or choose one from the list.");
  }
  function renderBlockList() {
    const ul = $("blockList"); ul.replaceChildren(); const b = blocksFor && blocksFor.pid === curPage()?.id ? blocksFor : null;
    if (!b) { const li = document.createElement("li"); li.className = "hint"; li.textContent = curPage() && curPage().blank ? "Blank pages have no existing text." : "Loading text…"; ul.append(li); return; }
    if (!b.blocks.length) { const li = document.createElement("li"); li.className = "hint"; li.textContent = "No selectable text on this page. It may be a scanned image; V2 does not include OCR."; ul.append(li); return; }
    if (b.hidden > 2) { const li = document.createElement("li"); li.className = "hint"; li.textContent = `About ${b.hidden} words on this page are drawn inside embedded form objects (XObjects) and cannot be edited here.`; ul.append(li); }
    const locked = new Map(); for (const bl of b.blocks) if (!bl.editable) locked.set(bl.reason, (locked.get(bl.reason) || 0) + 1);
    if (locked.size) { const li = document.createElement("li"); li.className = "hint warn-list"; li.dataset.summary = "locked"; const total = [...locked.values()].reduce((a, c) => a + c, 0); li.textContent = `${total} of ${b.blocks.length} text lines on this page cannot be edited: ` + [...locked].map(([r, n]) => `${n} × ${blockReason(r).replace(/\.$/, "")}`).join("; ") + ". They are marked 🔒 and left exactly as they are."; ul.append(li); }
    b.blocks.slice(0, 300).forEach(bl => {
      const li = document.createElement("li"), btn = document.createElement("button"); btn.type = "button"; btn.dataset.block = bl.id;
      const ed = editFor(b.src.id, b.page, bl.id); btn.setAttribute("aria-pressed", String(!!draft && draft.blockId === bl.id));
      btn.textContent = (ed ? "✎ " : bl.editable ? "" : "🔒 ") + snippet(ed ? ed.text : bl.text); btn.title = bl.editable ? "Edit this text" : blockReason(bl.reason);
      btn.addEventListener("click", () => selectBlock(bl).catch(fail)); li.append(btn); ul.append(li);
    });
  }
  async function selectBlock(bl, at = null) {
    if (pdraft && pdraft.dirty && !pdraft.para.ids.includes(bl.id)) { try { await applyPara(); } catch (e) { fail(e); return; } }
    if (draft && draft.dirty && draft.blockId !== bl.id) { try { await applyDraft(true); } catch (e) { fail(e); return; } }
    pdraft = null; const b = blocksFor, ed = editFor(b.src.id, b.page, bl.id);
    draft = { src: b.src.id, page: b.page, blockId: bl.id, block: bl, text: ed ? ed.text : bl.text, props: ed ? ed.props.slice() : Array.from({ length: bl.text.length }, () => null), align: ed ? ed.align : null, reflow: ed ? !!ed.reflow : undefined, dirty: false, hasEdit: !!ed };
    renderDraft(); renderBlockList(); scheduleOverlay(); if (blocksFor.paras) { const pa = paragraphOf(blocksFor.paras, bl.id); if (pa && groupEdits(b.src.id, b.page, pa.ids).some(x => x.group === pa.id)) { await enterPara(); return; } } const t = $("runText");
    if (bl.editable && getTool() === "edittext") { t.focus(); const w = at ? wordAt(bl, at) : null; if (w) t.setSelectionRange(w[0], w[1]); else t.select(); syncFormatControls(); }
  }
  /* the word under a click: [start, end) in the block text */
  function wordAt(bl, u) {
    const along = ((u[0] - bl.origin[0]) * bl.dir[0] + (u[1] - bl.origin[1]) * bl.dir[1]) / (bl.userScale || 1); let idx = -1, pos = 0;
    for (const e of bl.entries) { if (along >= e.x && along < e.x + e.w) { idx = pos; break; } pos += e.ch.length; }
    if (idx < 0) return null; const t = bl.text; if (/\s/.test(t[idx])) return null; let a = idx, b = idx + 1; while (a > 0 && !/\s/.test(t[a - 1])) a--; while (b < t.length && !/\s/.test(t[b])) b++; return [a, b];
  }
  function renderDraft() {
    if (pdraft) { renderPara(); return; }
    const d = draft, t = $("runText"), fmt = $("runFmt"); const para = d && d.block.editable && blocksFor ? paragraphOf(blocksFor.paras || [], d.blockId) : null; $("runParaRow").hidden = !para; $("runParaHint").hidden = !para; $("runPara").checked = false;
    if (!d) { $("runParaRow").hidden = true; $("runParaHint").hidden = true; t.value = ""; t.disabled = true; fmt.disabled = true; $("runApply").disabled = true; $("runRevert").disabled = true; $("runInfo").textContent = "Select a line of text on the page, or choose one from the list below."; $("runNote").textContent = ""; showWarn(""); return; }
    const ok = d.block.editable; t.disabled = !ok; fmt.disabled = !ok; if (document.activeElement !== t) t.value = d.text;
    $("runApply").disabled = !ok || !d.dirty; $("runRevert").disabled = !(d.hasEdit || d.dirty);
    $("runInfo").textContent = ok ? "This changes the text in the PDF itself. It stays real, searchable text; nothing is covered or flattened." : blockReason(d.block.reason);
    syncFormatControls(); measureSoon();
  }
  function syncFormatControls() {
    const d = draft; if (!d || !d.block.editable) return; const t = $("runText"); let i = Math.min(d.text.length - 1, Math.max(0, t.selectionStart || 0)); if (i < 0) i = 0;
    const s = styleAt(d, i); $("runFont").value = d.props[i] && d.props[i].family ? d.props[i].family : ""; if (document.activeElement !== $("runSize")) $("runSize").value = String(s.size);
    $("runBold").setAttribute("aria-pressed", String(s.bold)); $("runItalic").setAttribute("aria-pressed", String(s.italic)); $("runColor").value = s.color;
    for (const a of ["left", "center", "right"]) $("runAnchor" + a[0].toUpperCase()).setAttribute("aria-pressed", String(d.align === a));
    const can = !!(d.block.following && d.block.following.length); $("runReflowRow").hidden = !can; $("runReflowHint").hidden = !can; $("runReflow").checked = !!d.reflow;
  }
  function showWarn(msg, bad = false) { const w = $("runWarn"); w.hidden = !msg; w.textContent = msg || ""; w.classList.toggle("bad", bad); }
  function selectionRange() { const t = $("runText"); let s = t.selectionStart ?? 0, e = t.selectionEnd ?? 0; if (s === e) { s = 0; e = draft.text.length; } return [s, e]; }
  function patchFormat(patch) {
    if (pdraft || !draft || !draft.block.editable) return; const [s, e] = selectionRange();
    for (let i = s; i < e; i++) draft.props[i] = { ...(draft.props[i] || {}), ...patch };
    draft.dirty = !isPlain(draft) || draft.hasEdit; renderDraft(); scheduleOverlay();
  }
  function retext(newText) {
    const old = draft.text; let p = 0; while (p < old.length && p < newText.length && old[p] === newText[p]) p++; let s = 0; while (s < old.length - p && s < newText.length - p && old[old.length - 1 - s] === newText[newText.length - 1 - s]) s++;
    const inherit = draft.props[p - 1] || null, mid = Array.from({ length: newText.length - p - s }, () => inherit ? { ...inherit } : null);
    draft.props = [...draft.props.slice(0, p), ...mid, ...draft.props.slice(old.length - s)]; draft.text = newText; draft.map = null;
  }
  function measureSoon() { clearTimeout(measureTimer); measureTimer = setTimeout(() => measureDraft().catch(() => {}), 120); }
  async function measureDraft() {
    const d = draft; if (!d || !d.block.editable) return; const seq = ++measureSeq; const src = engines.get(d.src);
    try {
      const m = await measureEdit(PDFLib, src.doc, src.lib, d.block, toEngine(d)); if (seq !== measureSeq) return; d.measure = m; $("runApply").disabled = !d.dirty;
      const extra = m.widthUser - m.origUser, room = d.block.room, notes = m.notes.join(" "), canMove = !!(d.block.following && d.block.following.length);
      const shift = d.align === "right" ? -extra : d.align === "center" ? -extra / 2 : 0, endDelta = shift + extra; $("runNote").textContent = notes;
      if (canMove && d.reflow === undefined && Number.isFinite(room) && m.widthUser + shift > room) { d.reflow = true; $("runReflow").checked = true; }
      const msgs = [];
      if (!d.reflow && Number.isFinite(room) && m.widthUser + shift > room) msgs.push(`The new text is ${Math.round(extra)} pt wider than the original and reaches ${Math.round(m.widthUser + shift - room)} pt into the next text on this line.${canMove ? " Tick “Move the rest of the line along” to make room, or" : ""} Shorten it, or anchor it to the right or centre.`);
      else if (d.reflow && canMove && Math.abs(endDelta) > 0.5) msgs.push(`The rest of this line will move ${endDelta > 0 ? "right" : "left"} by ${Math.round(Math.abs(endDelta))} pt. Underlines, boxes and link areas are not moved.`);
      const box = blocksFor && blocksFor.a.page.getMediaBox(), o = d.block.origin, dir = d.block.dir;
      if (box && Math.abs(dir[1]) < 0.01) { const x0 = o[0] + dir[0] * shift, x1 = x0 + dir[0] * m.widthUser, last = d.reflow && canMove ? lastFollowerEnd(d, endDelta) : x1; if (Math.min(x0, x1, last) < box.x - 1 || Math.max(x0, x1, last) > box.x + box.width + 1) msgs.push("Part of the new text would run off the edge of the page."); }
      showWarn(msgs.join(" "));
    } catch (e) { if (seq !== measureSeq) return; d.measure = null; showWarn(friendly(e), true); $("runApply").disabled = true; }
  }
  function lastFollowerEnd(d, delta) {
    const all = blocksFor.blocks; let end = -Infinity; for (const id of d.block.following) { const c = all.find(b => b.id === id); if (c) end = Math.max(end, c.origin[0] + c.dir[0] * (c.width * c.userScale + delta)); } return end;
  }
  async function applyDraft(auto = false) {
    const d = draft; if (!d || !d.dirty) return; const src = engines.get(d.src);
    await measureEdit(PDFLib, src.doc, src.lib, d.block, toEngine(d)).then(m => { d.measure = m; }).catch(e => { throw new Error(friendly(e)); });
    const plain = isPlain(d), st = getState();
    await commit(() => { st.textEdits = st.textEdits.filter(x => !(x.src === d.src && x.page === d.page && x.blockId === d.blockId)); if (!plain) st.textEdits.push({ id: Date.now() + Math.random(), src: d.src, page: d.page, blockId: d.blockId, text: d.text, props: d.props.slice(), align: d.align, engine: toEngine(d), reflow: !!d.reflow, widthUser: d.measure.widthUser, notes: d.measure.notes }); }, { reload: true });
    d.dirty = false; d.hasEdit = !plain; renderDraft(); renderBlockList(); const n = d.measure.notes.length ? " " + d.measure.notes.join(" ") : "";
    say(plain ? "That line is back to its original text." : `The text in the PDF was changed.${n}`, false);
  }
  async function revertDraft() {
    const d = draft; if (!d) return; const st = getState();
    if (d.hasEdit) await commit(() => { st.textEdits = st.textEdits.filter(x => !(x.src === d.src && x.page === d.page && x.blockId === d.blockId)); }, { reload: true });
    draft = null; await selectBlock(d.block); say("This line was restored to its original text.");
  }


  /* ---- paragraph mode: the whole wrapped paragraph is one text; words are re-wrapped onto its existing lines ---- */
  const groupEdits = (src, page, ids) => getState().textEdits.filter(x => x.src === src && x.page === page && ids.includes(x.blockId));
  async function enterPara() {
    const d = draft; if (!d || !blocksFor) return; const para = paragraphOf(blocksFor.paras || [], d.blockId); const box = $("runPara");
    if (!para) { box.checked = false; return; }
    const ex = groupEdits(d.src, d.page, para.ids), grouped = ex.filter(x => x.group === para.id);
    if (ex.length !== grouped.length) { box.checked = false; say("Some lines of this paragraph were edited one by one. Restore them first to edit the paragraph as a whole.", true); return; }
    if (d.dirty) { box.checked = false; say("Apply or restore your change to this line first, then edit the whole paragraph.", true); return; }
    pdraft = { src: d.src, page: d.page, para, orig: paragraphText(para), text: grouped.length ? grouped[0].paraText : paragraphText(para), dirty: false, hasEdit: grouped.length > 0 };
    renderDraft(); measureParaSoon(); scheduleOverlay();
  }
  function exitPara() { pdraft = null; const bl = draft && draft.block; draft = null; if (bl) selectBlock(bl).catch(fail); }
  function renderPara() {
    const p = pdraft, t = $("runText"); t.disabled = false; if (document.activeElement !== t) t.value = p.text; $("runFmt").disabled = true; $("runReflowRow").hidden = true; $("runReflowHint").hidden = true;
    $("runParaRow").hidden = false; $("runParaHint").hidden = false; $("runPara").checked = true;
    $("runApply").disabled = !p.dirty || !!p.error; $("runRevert").disabled = !(p.hasEdit || p.dirty);
    $("runInfo").textContent = `Editing a paragraph of ${p.para.blocks.length} lines. Formatting stays as in the PDF; to change fonts or colours, edit line by line.`;
    $("runNote").textContent = p.result ? p.result.notes.join(" ") : "";
  }
  function measureParaSoon() { clearTimeout(paraTimer); paraTimer = setTimeout(() => measurePara().catch(() => {}), 150); }
  async function measurePara() {
    const p = pdraft; if (!p) return; const seq = ++paraSeq, src = engines.get(p.src);
    try {
      const r = await reflowParagraph(PDFLib, src.doc, src.lib, p.para, p.text); if (seq !== paraSeq || pdraft !== p) return; p.result = r; p.error = null;
      const msgs = [`Uses ${r.usedLines} of ${r.totalLines} lines.`]; if (p.para.justified && p.text !== p.orig) msgs.push("This paragraph is justified in the PDF; the re-wrapped lines are left-aligned with a ragged right edge.");
      showWarn(p.dirty ? msgs.join(" ") : ""); renderPara();
    } catch (e) { if (seq !== paraSeq || pdraft !== p) return; p.result = null; p.error = friendly(e); showWarn(p.error, true); renderPara(); }
  }
  async function applyPara() {
    const p = pdraft; if (!p || !p.dirty) return; const src = engines.get(p.src);
    const r = await reflowParagraph(PDFLib, src.doc, src.lib, p.para, p.text).catch(e => { throw new Error(friendly(e)); }); const st = getState();
    await commit(() => {
      st.textEdits = st.textEdits.filter(x => !(x.src === p.src && x.page === p.page && p.para.ids.includes(x.blockId)));
      for (const e of r.edits) st.textEdits.push({ id: Date.now() + Math.random(), src: p.src, page: p.page, blockId: e.blockId, text: e.text, props: Array.from({ length: e.text.length }, () => null), align: null, engine: { page: p.page, blockId: e.blockId, text: e.text, align: null, reflow: false, fmt: [] }, reflow: false, widthUser: 0, notes: r.notes, group: p.para.id, paraText: p.text });
    }, { reload: true });
    p.dirty = false; p.hasEdit = r.edits.length > 0; renderDraft(); renderBlockList(); scheduleOverlay();
    say(r.edits.length ? `The paragraph was re-wrapped onto ${r.usedLines} of its ${r.totalLines} lines.${r.notes.length ? " " + r.notes.join(" ") : ""}` : "That paragraph is back to its original text.");
  }
  async function revertPara() {
    const p = pdraft; if (!p) return; const st = getState();
    if (p.hasEdit) await commit(() => { st.textEdits = st.textEdits.filter(x => !(x.src === p.src && x.page === p.page && p.para.ids.includes(x.blockId))); }, { reload: true });
    pdraft = null; const bl = draft && draft.block; draft = null; if (bl) await selectBlock(bl); say("This paragraph was restored to its original text.");
  }

  /* ---- overlay and picking ---- */
  function drawOverlay(g, k) {
    const vp = getVp(); if (!vp) return; const tool = getTool();
    if (tool === "edittext" && blocksFor && blocksFor.pid === curPage()?.id) {
      for (const bl of blocksFor.blocks) {
        const sel = (draft && draft.blockId === bl.id) || (pdraft && pdraft.para.ids.includes(bl.id)), ed = editFor(blocksFor.src.id, blocksFor.page, bl.id); g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
        let q = bl.quad; if (ed && ed.widthUser && bl.userScale) { const L = ed.widthUser, o = bl.quad[0], ux = bl.dir[0], uy = bl.dir[1]; const w0 = Math.hypot(bl.quad[1][0] - o[0], bl.quad[1][1] - o[1]), dx = ux * (L - w0), dy = uy * (L - w0); q = [bl.quad[0], [bl.quad[1][0] + dx, bl.quad[1][1] + dy], [bl.quad[2][0] + dx, bl.quad[2][1] + dy], bl.quad[3]]; }
        g.beginPath(); q.forEach(([x, y], i) => { const [a, b] = vp.toDisplay(x, y); i ? g.lineTo(a * k, b * k) : g.moveTo(a * k, b * k); }); g.closePath();
        if (!bl.editable) { g.setLineDash([3 * k, 3 * k]); g.strokeStyle = "rgba(120,130,145,.8)"; g.lineWidth = 1 * k; g.stroke(); }
        else { g.fillStyle = sel ? "rgba(32,87,214,.16)" : ed ? "rgba(6,118,71,.12)" : "rgba(32,87,214,.05)"; g.fill(); g.strokeStyle = sel ? "#2057d6" : ed ? "#067647" : "rgba(32,87,214,.45)"; g.lineWidth = (sel ? 2 : 1) * k; g.stroke(); }
        g.restore();
      }
    }
    if (tool === "link") {
      for (const l of linksOnPage()) { const [x0, y0, x1, y1] = l.rect, a = vp.toDisplay(x0, y0), b = vp.toDisplay(x1, y1), sel = linkSel && linkSel.rec.id === l.id; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = sel ? "rgba(32,87,214,.22)" : "rgba(32,87,214,.10)"; g.strokeStyle = "#2057d6"; g.lineWidth = (sel ? 2.5 : 1.2) * k; g.setLineDash(sel ? [] : [5 * k, 3 * k]); const x = Math.min(a[0], b[0]) * k, y = Math.min(a[1], b[1]) * k, w = Math.abs(b[0] - a[0]) * k, h = Math.abs(b[1] - a[1]) * k; g.fillRect(x, y, w, h); g.strokeRect(x, y, w, h); g.restore(); }
      if (linkSel && linkSel.isNew) { const [x0, y0, x1, y1] = linkSel.rec.rect, a = vp.toDisplay(x0, y0), b = vp.toDisplay(x1, y1); g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.strokeStyle = "#ff9f1c"; g.lineWidth = 2.5 * k; g.strokeRect(Math.min(a[0], b[0]) * k, Math.min(a[1], b[1]) * k, Math.abs(b[0] - a[0]) * k, Math.abs(b[1] - a[1]) * k); g.restore(); }
    }
  }
  const polyHit = (bl, u, pad) => inQuad(bl.quad, u[0], u[1]) || (u[0] >= bl.box.x - pad && u[0] <= bl.box.x + bl.box.w + pad && u[1] >= bl.box.y - pad && u[1] <= bl.box.y + bl.box.h + pad && Math.abs(bl.dir[1]) < 0.01 && Math.abs(bl.dir[0] - 1) < 0.01);
  async function blockAt(u) {
    const p = curPage(); if (!p || p.blank) return null; if (!blocksFor || blocksFor.pid !== p.id) await loadBlocks(); if (!blocksFor) return null;
    const hits = blocksFor.blocks.filter(b => polyHit(b, u, 2)); hits.sort((a, b) => a.box.w * a.box.h - b.box.w * b.box.h); return hits[0] || null;
  }
  async function pick(u) {
    const bl = await blockAt(u);
    if (!bl) { say("No text found there. Tap directly on existing text, or choose a line from the list."); return; }
    await selectBlock(bl, u); if (!bl.editable) say(blockReason(bl.reason), true);
  }

  /* ================================================================ links */
  const linksOnPage = () => { const p = curPage(); return p && !p.blank ? getState().links.filter(l => l.src === p.src && l.page === p.idx && !l.deleted) : []; };
  const docPageOf = (src, idx) => getState().pages.findIndex(p => p.src === src && p.idx === idx) + 1;
  const linkLabel = l => l.kind === "uri" ? l.uri : l.kind === "page" ? (docPageOf(l.dest.src, l.dest.page) ? `Page ${docPageOf(l.dest.src, l.dest.page)}` : "Page that was removed") : `Other action (${l.actionType || "unknown"})`;
  function renderLinks() {
    const ul = $("linkList"); ul.replaceChildren(); const list = linksOnPage();
    if (!list.length) { const li = document.createElement("li"); li.className = "hint"; li.textContent = "No links on this page. Drag a rectangle on the page, or tap a line of text, to create one."; ul.append(li); }
    list.forEach((l, i) => { const li = document.createElement("li"), b = document.createElement("button"); b.type = "button"; b.dataset.link = l.id; b.setAttribute("aria-pressed", String(!!linkSel && linkSel.rec.id === l.id)); b.textContent = `${i + 1}. ${snippet(linkLabel(l), 36)}`; b.addEventListener("click", () => selectLink(l)); li.append(b); ul.append(li); });
    const form = $("linkForm"); form.hidden = !linkSel;
    if (!linkSel) { $("linkInfo").textContent = "Drag a rectangle on the page to make a link area, or tap a line of text to link all of it. Tap an existing link to edit it."; return; }
    const r = linkSel.rec; const readonly = r.kind === "other" || r.readonly;
    $("linkInfo").textContent = linkSel.isNew ? "New link. Choose where it goes, then press Save link." : readonly ? `This link uses an action the editor cannot edit (${r.actionType || "unknown"}). You can remove it.` : "Editing an existing link.";
    for (const el of form.querySelectorAll("input[name=linkKind]")) { el.checked = el.value === r.kind; el.disabled = readonly; }
    $("linkUriRow").hidden = r.kind !== "uri" || readonly; $("linkPageRow").hidden = r.kind !== "page" || readonly; if (document.activeElement !== $("linkUri")) $("linkUri").value = r.uri || "";
    const dp = r.kind === "page" && r.dest ? docPageOf(r.dest.src, r.dest.page) : 0; if (document.activeElement !== $("linkPage")) $("linkPage").value = String(dp || Math.min(getCur() + 1, getState().pages.length)); $("linkPage").max = String(getState().pages.length);
    $("linkBorder").checked = !!r.border; $("linkBorder").disabled = readonly; $("linkApply").disabled = readonly; $("linkRemove").disabled = linkSel.isNew;
  }
  function selectLink(l) { linkSel = { rec: JSON.parse(JSON.stringify(l)), isNew: false }; renderLinks(); scheduleOverlay(); }
  async function finishLink(d0, d1, moved) {
    const vp = getVp(), p = curPage(); if (!p || p.blank) { say("Links can only be added to pages from the PDF."); return; }
    const u0 = vp.toUser(...d0), u1 = vp.toUser(...d1);
    if (!moved) { // tap: existing link first, then the text line under the finger
      const hit = linksOnPage().slice().reverse().find(l => u0[0] >= l.rect[0] && u0[0] <= l.rect[2] && u0[1] >= l.rect[1] && u0[1] <= l.rect[3]); if (hit) { selectLink(hit); say("Editing this link."); return; }
      const bl = await blockAt(u0); if (!bl) { linkSel = null; renderLinks(); scheduleOverlay(); say("Nothing there. Drag a rectangle to make a link area."); return; }
      newLink([bl.box.x, bl.box.y, bl.box.x + bl.box.w, bl.box.y + bl.box.h], bl.text.trim()); return;
    }
    let rect = normRect([u0[0], u0[1], u1[0], u1[1]]);
    const bl = await blockAt([(rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2]); // snap height (and clamp width) to the text line it covers
    if (bl && Math.abs(bl.dir[0] - 1) < 0.01) rect = [Math.max(rect[0], bl.box.x), bl.box.y, Math.min(rect[2], bl.box.x + bl.box.w), bl.box.y + bl.box.h];
    if (rect[2] - rect[0] < 3 || rect[3] - rect[1] < 3) { say("That area is too small for a link."); return; }
    newLink(rect, "");
  }
  function newLink(rect, label) {
    const p = curPage(); linkSel = { rec: { id: "n" + Date.now() + Math.random().toString(36).slice(2, 6), src: p.src, page: p.idx, rect, kind: "uri", uri: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(label) ? label : "", dest: null, border: 0, isNew: true }, isNew: true }; renderLinks(); scheduleOverlay(); $("linkUri").focus();
    say("Link area created. Enter the address (or choose a page), then press Save link.");
  }
  function readLinkForm() {
    const r = { ...linkSel.rec }; r.kind = [...document.querySelectorAll("input[name=linkKind]")].find(x => x.checked)?.value || r.kind; r.border = $("linkBorder").checked ? 1 : 0;
    if (r.kind === "uri") { const u = normalizeUri($("linkUri").value); if (!u) throw new Error("Enter a web address (https://…), an email address, or a tel: number. Other kinds of address are not allowed."); r.uri = u; r.dest = null; }
    else { const n = Math.round(Number($("linkPage").value)), st = getState(), pg = st.pages[n - 1]; if (!pg || pg.blank) throw new Error(n >= 1 && n <= st.pages.length ? "That page is a blank page, which cannot be a link target." : `Choose a page between 1 and ${st.pages.length}.`); r.uri = null; r.dest = { src: pg.src, page: pg.idx, mode: "XYZ", params: topOfPage(pg.view).params }; }
    return r;
  }
  async function saveLink() {
    if (!linkSel) return; const r = readLinkForm(), st = getState(); delete r.isNew;
    await commit(() => { const i = st.links.findIndex(l => l.id === r.id); if (linkSel.isNew || i < 0) st.links.push(r); else st.links[i] = { ...r, changed: true }; }, {});
    const saved = st.links.find(l => l.id === r.id); linkSel = { rec: JSON.parse(JSON.stringify(saved)), isNew: false }; renderLinks(); scheduleOverlay(); say("Link saved. It is written into the PDF when you download.");
  }
  async function removeLink() {
    if (!linkSel || linkSel.isNew) return; const id = linkSel.rec.id, st = getState();
    await commit(() => { const l = st.links.find(x => x.id === id); if (!l) return; if (l.ref) l.deleted = true; else st.links = st.links.filter(x => x.id !== id); }, {}); linkSel = null; renderLinks(); scheduleOverlay(); say("Link removed.");
  }

  /* ================================================================ bookmarks */
  const outline = () => getState().outline;
  const pageNumOf = n => n.dest ? docPageOf(n.dest.src, n.dest.page) : 0;
  function bmApply(fn, msg) { return commit(() => { const st = getState(); st.outline = fn(st.outline); st.outlineDirty = true; }, {}).then(() => { renderBookmarks(); if (msg) say(msg); }); }
  function renderBookmarks() {
    const ul = $("bmList"); ul.replaceChildren(); const flat = O.flatten(outline());
    $("bmEmpty").hidden = flat.length > 0;
    flat.forEach(({ node, depth }) => {
      const li = document.createElement("li"); li.className = "bm-row"; li.dataset.depth = String(Math.min(depth, 6)); li.dataset.id = node.id;
      const sel = bmSel === node.id; li.classList.toggle("sel", sel);
      const go = document.createElement("button"); go.type = "button"; go.className = "bm-go"; go.setAttribute("aria-pressed", String(sel));
      const pn = pageNumOf(node), label = document.createElement("span"); label.className = "bm-title"; label.textContent = node.title || "Untitled"; const pg = document.createElement("span"); pg.className = "bm-page"; pg.textContent = node.dest ? (pn ? `p. ${pn}` : "page removed") : node.uri ? "link" : "no page";
      go.setAttribute("aria-label", `${node.title || "Untitled"}, ${node.dest ? (pn ? "page " + pn : "page removed") : "no page"}${depth ? ", sub-bookmark level " + (depth + 1) : ""}`); go.append(label, pg); go.addEventListener("click", () => { bmSel = node.id; bmEditing = false; const keepOpen = document.body.classList.contains("pages-open"); renderBookmarks(); if (pn) Promise.resolve(goTo(pn - 1)).then(() => { if (keepOpen) { document.body.classList.add("pages-open"); $("pagesToggle").setAttribute("aria-expanded", "true"); } renderBookmarks(); }); }); li.append(go);
      if (sel) li.append(bmActions(node));
      ul.append(li);
    });
  }
  function bmActions(node) {
    const box = document.createElement("div"); box.className = "bm-actions";
    if (bmEditing) {
      const inp = document.createElement("input"); inp.type = "text"; inp.id = "bmRename"; inp.maxLength = 200; inp.value = node.title; inp.setAttribute("aria-label", "Bookmark title");
      const ok = btn("Save", () => { const v = inp.value.trim(); if (!v) { say("A bookmark needs a title.", true); return; } bmEditing = false; bmApply(t => O.renameItem(t, node.id, v), "Bookmark renamed."); }, "primary");
      inp.addEventListener("keydown", e => { if (e.key === "Enter") ok.click(); if (e.key === "Escape") { bmEditing = false; renderBookmarks(); } }); box.append(inp, ok, btn("Cancel", () => { bmEditing = false; renderBookmarks(); })); setTimeout(() => { inp.focus(); inp.select(); }, 0); return box;
    }
    box.append(
      btn("Rename", () => { bmEditing = true; renderBookmarks(); }), btn("Up", () => bmApply(t => O.moveItem(t, node.id, -1), "Moved up."), "", "Move bookmark up"), btn("Down", () => bmApply(t => O.moveItem(t, node.id, 1), "Moved down."), "", "Move bookmark down"),
      btn("Indent", () => bmApply(t => O.indentItem(t, node.id), "Indented under the bookmark above."), "", "Make a sub-bookmark of the one above"), btn("Outdent", () => bmApply(t => O.outdentItem(t, node.id), "Moved out one level."), "", "Move out one level"),
      btn("Use this page", () => { const p = curPage(); if (!p || p.blank) { say("Choose a page from the PDF.", true); return; } bmApply(t => { const c = O.cloneTree(t), f = O.findNode(c, node.id); f.node.dest = { src: p.src, page: p.idx, mode: "XYZ", params: topOfPage(p.view).params }; f.node.uri = null; return c; }, "Bookmark now points to this page."); }, "", "Point this bookmark at the page you are viewing"),
      btn("Delete", () => { bmSel = null; bmApply(t => O.removeItem(t, node.id), "Bookmark deleted."); }, "danger", "Delete bookmark (its sub-bookmarks go with it)"));
    return box;
  }
  function btn(text, on, cls = "", title = "") { const b = document.createElement("button"); b.type = "button"; b.className = "btn small " + cls; b.textContent = text; if (title) { b.title = title; b.setAttribute("aria-label", title); } b.addEventListener("click", () => Promise.resolve(on()).catch(fail)); return b; }
  async function addBookmark() {
    const p = curPage(); if (!p || p.blank) { say("Go to a page from the PDF first.", true); return; }
    const title = $("bmNewTitle").value.trim() || `Page ${getCur() + 1}`, node = { id: O.newOutlineId(), title, open: true, dest: { src: p.src, page: p.idx, mode: "XYZ", params: topOfPage(p.view).params }, uri: null, color: null, flags: 0, children: [] };
    const after = bmSel && O.findNode(outline(), bmSel) ? bmSel : null; bmSel = node.id; $("bmNewTitle").value = "";
    await bmApply(t => O.addItem(t, node, after), `Bookmark "${title}" added for page ${getCur() + 1}.`);
  }

  /* ================================================================ document hooks */
  function loadDocumentExtras(doc, src, st, first) {
    for (const l of readLinks(PDFLib, doc, src.id)) { l.readonly = !l.ref; st.links.push(l); }
    if (first) { const r = O.readOutline(PDFLib, doc, src.id); st.outline = r.tree; st.outlineDirty = false; return r.unsupported; }
    return 0;
  }
  async function syncSource(s, st) { // rebuild a source's effective bytes from its text edits (called by the editor)
    const edits = st.textEdits.filter(e => e.src === s.id); if (!edits.length) return { bytes: s.bytes, notes: [] };
    return applyTextEdits(PDFLib, s.bytes, edits.map(e => e.engine));
  }
  function exportExtras() { const st = getState(); return { links: st.links, outline: st.outline, outlineDirty: st.outlineDirty }; }

  /* After building the file: reopen it and prove the edits are in it. Returns a list of problems (empty = verified). */
  async function verifyExport(bytes, { pagesList, report, rebuiltOutline }) {
    const problems = [], st = getState(), out = await PDFLib.PDFDocument.load(bytes);
    const links = readLinks(PDFLib, out, "x"); if (report.links !== undefined && links.length !== report.links) problems.push(`link count ${links.length} does not match the expected ${report.links}`);
    if (rebuiltOutline) { const t = O.readOutline(PDFLib, out, "x").tree; if (O.countItems(t) !== report.bookmarks) problems.push(`bookmark count ${O.countItems(t)} does not match the expected ${report.bookmarks}`); }
    const lib = new FontLibrary(PDFLib, out); let scanned = false;
    for (const e of st.textEdits) {
      const i = pagesList.findIndex(p => !p.blank && p.src === e.src && p.idx === e.page); if (i < 0) continue; if (!scanned) { await scanUsage(PDFLib, out, lib); scanned = true; }
      const a = await analyzePage(PDFLib, out, lib, i); const all = a.blocks.map(b => b.text).join("\n"); if (e.text.trim() && !all.includes(e.text.trim())) problems.push(`the edited text "${snippet(e.text, 30)}" was not found in the exported page ${i + 1}`);
    }
    return problems;
  }

  /* ================================================================ wiring */
  const bind = () => {
    $("runText").addEventListener("input", () => { if (pdraft) { pdraft.text = $("runText").value; pdraft.dirty = pdraft.text !== pdraft.orig || pdraft.hasEdit; renderPara(); measureParaSoon(); return; } if (!draft) return; retext($("runText").value); draft.dirty = true; renderDraftLight(); });
    $("runText").addEventListener("keyup", syncFormatControls); $("runText").addEventListener("click", syncFormatControls); $("runText").addEventListener("select", syncFormatControls);
    $("runText").addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); (pdraft ? applyPara() : applyDraft()).catch(fail); } });
    $("runFont").addEventListener("change", () => patchFormat({ family: $("runFont").value || undefined }));
    $("runSize").addEventListener("input", () => { const v = Number($("runSize").value); if (Number.isFinite(v) && v >= 2 && v <= 400) patchFormat({ size: v }); });
    $("runBold").addEventListener("click", () => patchFormat({ bold: $("runBold").getAttribute("aria-pressed") !== "true" })); $("runItalic").addEventListener("click", () => patchFormat({ italic: $("runItalic").getAttribute("aria-pressed") !== "true" }));
    $("runColor").addEventListener("input", () => patchFormat({ color: $("runColor").value }));
    for (const a of ["left", "center", "right"]) $("runAnchor" + a[0].toUpperCase()).addEventListener("click", () => { if (!draft) return; draft.align = draft.align === a ? null : a; draft.dirty = true; renderDraft(); });
    $("runReflow").addEventListener("change", () => { if (!draft) return; draft.reflow = $("runReflow").checked; draft.dirty = !isPlain(draft) || draft.hasEdit; renderDraft(); });
    $("runApply").addEventListener("click", guard(() => pdraft ? applyPara() : applyDraft())); $("runRevert").addEventListener("click", guard(() => pdraft ? revertPara() : revertDraft()));
    $("runPara").addEventListener("change", guard(async () => { if ($("runPara").checked) await enterPara(); else exitPara(); }));
    for (const el of document.querySelectorAll("input[name=linkKind]")) el.addEventListener("change", () => { if (linkSel) { linkSel.rec.kind = el.value; renderLinks(); } });
    $("linkApply").addEventListener("click", guard(saveLink)); $("linkRemove").addEventListener("click", guard(removeLink)); $("linkUri").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); saveLink().catch(fail); } });
    $("bmAdd").addEventListener("click", guard(addBookmark)); $("bmNewTitle").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); addBookmark().catch(fail); } });
    for (const [tab, pane] of [["tabPages", "paneThumbs"], ["tabBookmarks", "paneBookmarks"]]) $(tab).addEventListener("click", () => showTab(tab, pane));
  };
  function renderDraftLight() { const d = draft; $("runApply").disabled = !d.block.editable; $("runRevert").disabled = false; syncFormatControls(); measureSoon(); scheduleOverlay(); }
  function showTab(tab, pane) { for (const [t, p] of [["tabPages", "paneThumbs"], ["tabBookmarks", "paneBookmarks"]]) { $(t).setAttribute("aria-selected", String(t === tab)); $(p).hidden = p !== pane; } if (pane === "paneBookmarks") renderBookmarks(); }
  bind();

  return {
    async onOpen(doc, src) { const st = getState(); const unsupported = loadDocumentExtras(doc, src, st, true); engines.clear(); draft = null; pdraft = null; linkSel = null; bmSel = null; blocksFor = null; renderBookmarks(); renderLinks(); renderDraft(); return { links: st.links.length, bookmarks: O.countItems(st.outline), unsupported }; },
    reset() { engines.clear(); draft = null; pdraft = null; linkSel = null; bmSel = null; blocksFor = null; getState().links = []; getState().outline = []; renderBookmarks(); renderLinks(); renderDraft(); renderBlockList(); },
    onInsert(doc, src) { loadDocumentExtras(doc, src, getState(), false); },
    syncSource, exportExtras, verifyExport, drawOverlay, pick, finishLink,
    async pageChanged() { draft = null; pdraft = null; linkSel = null; renderDraft(); renderLinks(); if (getTool() === "edittext") await loadBlocks(); else { blocksFor = null; } },
    async toolChanged() { const t = getTool(); if (t === "edittext") { renderDraft(); await loadBlocks(); } if (t === "link") renderLinks(); },
    refresh() { renderBookmarks(); renderLinks(); if (draft && !draft.dirty && blocksFor) { const bl = draft.block; draft = null; selectBlock(bl).catch(() => {}); } else renderBlockList(); },
    afterReload() { engines.forEach(e => e.analyses && e.analyses.clear && void 0); },
    editedCount: () => getState().textEdits.length,
    debug: { blocks: () => blocksFor && blocksFor.blocks.map(b => ({ id: b.id, text: b.text, editable: b.editable, reason: b.reason, box: b.box })), draft: () => draft && { text: draft.text, dirty: draft.dirty }, links: () => getState().links, edits: () => getState().textEdits.length, outline: () => getState().outline },
  };
}
