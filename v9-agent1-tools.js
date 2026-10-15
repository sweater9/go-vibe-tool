/* V9 utilities, lane 1: SQL Beautifier & Minifier, Large File SHA-256 Checksum, Universal Epoch & Time Matrix,
   Social Card & OG Simulator. Registers four rows in the existing catalogue (tools.js `tools`) and wraps openTool/closeTool the
   same way the V8 developer tools do, so search, favourites, recents and ?tool=<id> deep links keep working.
   Privacy: every input stays in memory in this tab. Nothing is sent anywhere, stored in localStorage or put in the URL
   (except the non-sensitive epoch timestamp/zone choices when the user shares an epoch link). */
(function () {
  "use strict";
  const G = window.GVTV9;
  if (!G || !G.sqlFormat || !G.Sha256 || !G.epoch || !G.socialLayout) return;
  if (typeof tools === "undefined" || typeof openTool !== "function") return;

  const newTools = [
    ["sql-formatter", "Developer", "SQL Beautifier & Minifier", "Beautify, pretty print or minify SQL locally. Strings, comments and placeholders are kept intact; queries are never validated or run."],
    ["file-sha256", "Privacy & Safety", "Large File SHA-256 Checksum", "Compute a sha256 checksum of multi-gigabyte files in your browser, in small chunks, and verify a download against a published hash. Files are never uploaded."],
    ["epoch-matrix", "Developer", "Universal Epoch & Time Matrix", "Convert Unix epoch seconds, milliseconds, microseconds and nanoseconds across time zones, with log timestamp formats and bulk conversion."],
    ["og-simulator", "Links & Web", "Social Card & OG Simulator", "Preview approximate Open Graph link cards for X (Twitter), LinkedIn and Slack from the title, description and image you enter. Nothing is fetched."],
  ];
  const ids = new Set(newTools.map((t) => t[0]));
  tools.push(...newTools);
  const previousOpen = openTool,
    previousClose = closeTool;
  let dispose = () => {};

  /* ---------- helpers ---------- */
  const E = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const $ = (id) => document.getElementById(id);
  const field = (id, label, inner) => `<div class="field"><label for="${id}">${label}</label>${inner}</div>`;
  const input = (id, label, value = "", extra = "") => field(id, label, `<input id="${id}" type="text" value="${E(value)}" autocomplete="off" spellcheck="false" ${extra}>`);
  const area = (id, label, value = "", rows = 8, extra = "") => field(id, label, `<textarea id="${id}" rows="${rows}" spellcheck="false" ${extra}>${E(value)}</textarea>`);
  const select = (id, label, opts, sel) => field(id, label, `<select id="${id}">${opts.map(([v, t]) => `<option value="${E(v)}"${v === sel ? " selected" : ""}>${E(t)}</option>`).join("")}</select>`);
  const btn = (id, label, cls = "alt") => `<button type="button" class="btn ${cls}" id="${id}">${label}</button>`;
  const debounce = (fn, ms) => { let t = 0; const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; d.cancel = () => clearTimeout(t); return d; };
  const humanBytes = (n) => { const u = ["B", "KiB", "MiB", "GiB", "TiB"]; let i = 0, v = n; while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; } return (i ? v.toFixed(v >= 100 ? 0 : 1) : v) + " " + u[i]; };
  async function copyText(text, say) {
    try { await navigator.clipboard.writeText(text); say("Copied."); }
    catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
      ta.remove();
      say(ok ? "Copied." : "Clipboard unavailable. Select the text and copy it manually.");
    }
  }
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type: type || "text/plain;charset=utf-8" })), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const statusLine = () => `<p id="v9-status" class="v9a-status" role="status" aria-live="polite"></p>`;
  const say = (msg) => { const s = $("v9-status"); if (s) s.textContent = msg; };
  const guard = (cleanups) => () => cleanups.forEach((f) => { try { f(); } catch (e) { /* already gone */ } });

  /* ======================================================================
     1. SQL Beautifier & Minifier
     ====================================================================== */
  const SQL_EXAMPLE = "-- active customers, last 30 days\nselect c.id,c.name,count(o.id) as orders,sum(o.total) total, case when sum(o.total)>1000 then 'vip' else 'standard' end tier\nfrom customers c left join orders o on o.customer_id=c.id and o.created_at>=now()-interval '30 days'\nwhere c.active=true and (c.country in ('AE','GB') or c.note like '%;--%') and c.id<>:skip /* keep: placeholder */\ngroup by c.id,c.name having count(o.id)>0 order by total desc limit 20;";
  function sqlUI() {
    return `<p class="note">Re-lays out text only: string literals, quoted identifiers, comments and placeholders (<code>?</code> <code>$1</code> <code>:name</code> <code>@name</code> <code>%s</code>) are copied through unchanged. This tool does <strong>not</strong> validate, optimise or run SQL, and has no knowledge of your schema. Nothing leaves this tab.</p>
    <div class="v9a-grid">
      ${select("v9-sql-mode", "Mode", [["format", "Beautify"], ["minify", "Minify"]], "format")}
      ${select("v9-sql-dialect", "Dialect (quoting and comments)", Object.keys(G.SQL_DIALECTS).map((k) => [k, G.SQL_DIALECTS[k].label]), "standard")}
      ${select("v9-sql-indent", "Indent", [["2", "2 spaces"], ["4", "4 spaces"], ["tab", "Tab"]], "2")}
      ${select("v9-sql-case", "Keyword case", [["upper", "UPPERCASE"], ["lower", "lowercase"], ["preserve", "Keep as typed"]], "upper")}
      ${select("v9-sql-comma", "Commas", [["trailing", "End of line"], ["leading", "Start of line"]], "trailing")}
      ${select("v9-sql-width", "Wrap long lists at", [["60", "60 columns"], ["80", "80 columns"], ["100", "100 columns"], ["120", "120 columns"]], "80")}
    </div>
    <label class="v9a-check"><input type="checkbox" id="v9-sql-keepc"> Keep comments when minifying (hint comments <code>/*+ … */</code> are always kept)</label>
    ${area("v9-sql-in", "SQL input", "", 10, 'placeholder="Paste SQL from logs, an ORM or a query console"')}
    <div class="actions">${btn("v9-sql-run", "Run", "")}${btn("v9-sql-example", "Load example")}${btn("v9-sql-swap", "Use output as input")}${btn("v9-sql-clear", "Clear")}</div>
    ${area("v9-sql-out", "Result", "", 10, "readonly")}
    <div class="actions">${btn("v9-sql-copy", "Copy result")}${btn("v9-sql-dl", "Download .sql")}</div>
    <ul id="v9-sql-warn" class="v9a-warn" aria-live="polite"></ul>${statusLine()}
    <p class="note">Dialect only affects how quotes and comments are read (for example MySQL <code>#</code> comments, PostgreSQL <code>$$</code> strings, SQL Server <code>[brackets]</code>). Only common reserved words are re-cased; identifiers are never changed.</p>`;
  }
  function bindSql() {
    const AUTO_LIMIT = 100000;
    const run = () => {
      const src = $("v9-sql-in").value, out = $("v9-sql-out"), warn = $("v9-sql-warn");
      warn.replaceChildren();
      if (!src.trim()) { out.value = ""; say(""); return; }
      const dialect = $("v9-sql-dialect").value;
      try {
        const r = $("v9-sql-mode").value === "minify"
          ? G.sqlMinify(src, { dialect, keepComments: $("v9-sql-keepc").checked })
          : G.sqlFormat(src, { dialect, indent: $("v9-sql-indent").value, keywordCase: $("v9-sql-case").value, commaStyle: $("v9-sql-comma").value, maxLine: $("v9-sql-width").value });
        out.value = r.output;
        r.warnings.forEach((w) => { const li = document.createElement("li"); li.textContent = w + " — output keeps the remaining text unchanged."; warn.appendChild(li); });
        say($("v9-sql-mode").value === "minify" ? "Minified: " + src.length + " → " + r.output.length + " characters." : "Formatted " + (r.statements || 0) + " statement" + (r.statements === 1 ? "" : "s") + ".");
      } catch (e) { out.value = ""; say(e.message); }
    };
    const live = debounce(() => { if ($("v9-sql-in").value.length <= AUTO_LIMIT) run(); else say("Large input: press Run."); }, 150);
    const root = $("workspace");
    $("v9-sql-in").addEventListener("input", live);
    ["v9-sql-mode", "v9-sql-dialect", "v9-sql-indent", "v9-sql-case", "v9-sql-comma", "v9-sql-width", "v9-sql-keepc"].forEach((id) => $(id).addEventListener("change", () => { if ($("v9-sql-in").value.length <= AUTO_LIMIT) run(); }));
    $("v9-sql-run").onclick = run;
    $("v9-sql-example").onclick = () => { $("v9-sql-in").value = SQL_EXAMPLE; run(); };
    $("v9-sql-swap").onclick = () => { if ($("v9-sql-out").value) { $("v9-sql-in").value = $("v9-sql-out").value; run(); } };
    $("v9-sql-clear").onclick = () => { $("v9-sql-in").value = ""; $("v9-sql-out").value = ""; $("v9-sql-warn").replaceChildren(); say("Cleared."); };
    $("v9-sql-copy").onclick = () => { const v = $("v9-sql-out").value; if (!v) return say("Nothing to copy yet."); copyText(v, say); };
    $("v9-sql-dl").onclick = () => { const v = $("v9-sql-out").value; if (!v) return say("Nothing to download yet."); download("query.sql", v); say("Downloaded."); };
    void root;
    return guard([() => live.cancel()]);
  }

  /* ======================================================================
     2. Large File SHA-256 Checksum
     ====================================================================== */
  function shaUI() {
    return `<p class="note">Select or drop one or more files. Each file is read in small slices and hashed incrementally by an audited SHA-256 implementation bundled with this site, so memory use stays near one slice even for multi-gigabyte files. File contents are never uploaded, stored or sent anywhere.</p>
    <div id="v9-sha-drop" class="v9a-drop">
      <label for="v9-sha-file"><strong>Choose files</strong> or drop them here</label>
      <input id="v9-sha-file" type="file" multiple>
    </div>
    <div class="v9a-grid">
      ${select("v9-sha-chunk", "Read slice size", [["1048576", "1 MiB"], ["4194304", "4 MiB (default)"], ["16777216", "16 MiB"], ["67108864", "64 MiB"]], "4194304")}
    </div>
    ${area("v9-sha-expected", "Expected SHA-256 (optional): a bare hash, “sha256:…”, or sha256sum lines", "", 3, 'placeholder="e3b0c442… or a pasted SHA256SUMS file"')}
    <div class="actions">${btn("v9-sha-cancel", "Cancel hashing")}${btn("v9-sha-copy", "Copy as sha256sum list")}${btn("v9-sha-clear", "Clear results")}</div>
    <ul id="v9-sha-list" class="v9a-files" aria-label="Files"></ul>${statusLine()}
    <p class="note">A match proves the file equals the file the expected hash was computed from. It does not prove the publisher is trustworthy: get the hash from a source you trust, ideally a different channel from the download.</p>`;
  }
  function bindSha() {
    const items = []; /* {file, li, bar, meta, hashEl, verdict, state, hex, ms} */
    let controller = null, running = false;
    const list = $("v9-sha-list"), fileInput = $("v9-sha-file"), drop = $("v9-sha-drop");
    const render = (it) => {
      const li = document.createElement("li"); li.className = "v9a-file";
      const name = document.createElement("strong"); name.textContent = it.file.name || "(unnamed)";
      const size = document.createElement("span"); size.className = "v9a-muted"; size.textContent = " · " + humanBytes(it.file.size);
      const bar = document.createElement("progress"); bar.max = 100; bar.value = 0; bar.setAttribute("aria-label", "Progress for " + (it.file.name || "file"));
      const meta = document.createElement("div"); meta.className = "v9a-muted"; meta.textContent = "Queued";
      const hashEl = document.createElement("code"); hashEl.className = "v9a-hash";
      const verdict = document.createElement("div"); verdict.className = "v9a-verdict";
      const copy = document.createElement("button"); copy.type = "button"; copy.className = "btn alt small"; copy.textContent = "Copy hash"; copy.hidden = true;
      copy.onclick = () => copyText(it.hex, say);
      li.append(name, size, bar, meta, hashEl, verdict, copy);
      list.appendChild(li);
      Object.assign(it, { li, bar, meta, hashEl, verdict, copy });
    };
    const judge = (it) => {
      if (it.state !== "done") return;
      const exp = $("v9-sha-expected").value.trim();
      if (!exp) { it.verdict.textContent = ""; it.verdict.className = "v9a-verdict"; return; }
      const r = G.compareChecksum(it.hex, exp, it.file.name);
      it.verdict.textContent = r.message;
      it.verdict.className = "v9a-verdict v9a-" + (r.state === "match" ? "ok" : "bad");
    };
    async function pump() {
      if (running) return;
      running = true; controller = new AbortController();
      const chunk = parseInt($("v9-sha-chunk").value, 10) || G.SHA256_DEFAULT_CHUNK;
      say("Hashing started. Files stay on this device.");
      for (const it of items) {
        if (it.state !== "queued") continue;
        if (controller.signal.aborted) { it.state = "cancelled"; it.meta.textContent = "Cancelled"; continue; }
        it.state = "hashing";
        try {
          const r = await G.hashBlob(it.file, {
            chunkSize: chunk, signal: controller.signal,
            onProgress: (p) => {
              it.bar.value = p.total ? (p.loaded / p.total) * 100 : 100;
              const rate = p.ms > 250 ? " · " + humanBytes(p.loaded / (p.ms / 1000)) + "/s" : "";
              it.meta.textContent = "Hashing " + humanBytes(p.loaded) + " of " + humanBytes(p.total) + rate;
            },
          });
          it.state = "done"; it.hex = r.hex; it.ms = r.ms; it.bar.value = 100;
          it.meta.textContent = "Done in " + (r.ms / 1000).toFixed(r.ms < 10000 ? 2 : 1) + " s";
          it.hashEl.textContent = r.hex; it.copy.hidden = false;
          judge(it);
        } catch (e) {
          if (e && e.name === "AbortError") { it.state = "cancelled"; it.meta.textContent = "Cancelled"; }
          else { it.state = "error"; it.meta.textContent = "Could not read this file: " + (e && e.message ? e.message : "unknown error") + ". It may have been moved, changed or be a folder."; }
        }
      }
      running = false; controller = null;
      const done = items.filter((i) => i.state === "done").length;
      say(done ? "Finished: " + done + " file" + (done === 1 ? "" : "s") + " hashed." : "No files were hashed.");
    }
    const add = (files) => {
      for (const f of Array.from(files || [])) { const it = { file: f, state: "queued" }; items.push(it); render(it); }
      pump();
    };
    fileInput.addEventListener("change", () => { add(fileInput.files); fileInput.value = ""; });
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    const onOver = (e) => { stop(e); drop.classList.add("over"); };
    const onLeave = (e) => { stop(e); drop.classList.remove("over"); };
    const onDrop = (e) => { stop(e); drop.classList.remove("over"); add(e.dataTransfer && e.dataTransfer.files); };
    drop.addEventListener("dragover", onOver); drop.addEventListener("dragleave", onLeave); drop.addEventListener("drop", onDrop);
    $("v9-sha-expected").addEventListener("input", () => items.forEach(judge));
    $("v9-sha-cancel").onclick = () => { if (controller) { controller.abort(); say("Cancelling…"); } else say("Nothing is being hashed."); };
    $("v9-sha-clear").onclick = () => { if (controller) controller.abort(); items.length = 0; list.replaceChildren(); say("Results cleared."); };
    $("v9-sha-copy").onclick = () => {
      const done = items.filter((i) => i.state === "done");
      if (!done.length) return say("Hash a file first.");
      copyText(G.formatSha256Sum(done.map((i) => ({ hex: i.hex, name: i.file.name }))), say);
    };
    return guard([() => controller && controller.abort(), () => { drop.removeEventListener("dragover", onOver); drop.removeEventListener("dragleave", onLeave); drop.removeEventListener("drop", onDrop); }]);
  }

  /* ======================================================================
     3. Universal Epoch & Time Matrix
     ====================================================================== */
  const DEFAULT_ZONES = ["UTC", "America/New_York", "Europe/London", "Asia/Dubai", "Asia/Kolkata", "Asia/Tokyo"];
  function epochUI() {
    const zones = G.zoneList();
    return `<p class="note">Epoch values are parsed as exact integers (no floating point), so microsecond and nanosecond timestamps keep every digit. Dates without an offset are read in the zone you choose. Offsets change with daylight-saving rules, so the same zone can differ by date.</p>
    <div class="v9a-tabs" role="group" aria-label="Mode">
      <button type="button" class="btn small" id="v9-ep-tab-one" aria-pressed="true">Single timestamp</button>
      <button type="button" class="btn alt small" id="v9-ep-tab-batch" aria-pressed="false">Bulk log lines</button>
    </div>
    <div id="v9-ep-one">
      ${input("v9-ep-in", "Epoch number or date/time (ISO 8601, RFC 2822, HTTP date, Apache CLF)", "", 'placeholder="1700000000123456789 or 2024-03-31T01:30:00+01:00"')}
      <div class="v9a-grid">
        ${select("v9-ep-unit", "Epoch unit", [["auto", "Auto-detect (guess by size)"], ["s", "Seconds"], ["ms", "Milliseconds"], ["us", "Microseconds"], ["ns", "Nanoseconds"]], "auto")}
        ${select("v9-ep-read", "Read dates without offset in", zones.map((z) => [z, z]), G.localZone())}
      </div>
      <div class="actions">${btn("v9-ep-now", "Use current time", "")}${btn("v9-ep-link", "Copy share link")}${btn("v9-ep-copyiso", "Copy ISO 8601")}${btn("v9-ep-copytable", "Copy table (TSV)")}</div>
      ${input("v9-ep-cmp", "Compare with another timestamp (optional)", "", 'placeholder="difference is shown below"')}
    </div>
    <div id="v9-ep-batch" hidden>
      ${area("v9-ep-lines", "Log lines: the first timestamp in each line is converted", "", 8, 'placeholder="paste log lines here (max 500 lines)"')}
      <div class="actions">${btn("v9-ep-bcopy", "Copy results (TSV)")}</div>
    </div>
    <fieldset class="v9a-zones"><legend>Time zones in the matrix</legend>
      <ul id="v9-ep-chips" class="v9a-chips"></ul>
      <div class="v9a-addzone"><label for="v9-ep-add">Add a zone</label><input id="v9-ep-add" list="v9-zonelist" type="text" autocomplete="off" spellcheck="false" placeholder="e.g. Australia/Sydney">
        <datalist id="v9-zonelist">${zones.map((z) => `<option value="${E(z)}"></option>`).join("")}</datalist>${btn("v9-ep-addbtn", "Add zone")}</div>
    </fieldset>
    <div id="v9-ep-out" class="v9a-out" aria-live="polite"></div>${statusLine()}`;
  }
  function bindEpoch() {
    const zoneSet = [];
    const params = new URLSearchParams(location.search);
    const wantZones = (params.get("tz") || "").split(",").map((s) => s.trim()).filter(Boolean);
    const local = G.localZone();
    for (const z of (wantZones.length ? wantZones : DEFAULT_ZONES.concat([local]))) { if (zoneSet.indexOf(z) < 0) { try { G.describe(0n, [z]); zoneSet.push(z); } catch (e) { /* ignore bad deep-link zone */ } } }
    if (!zoneSet.length) zoneSet.push("UTC");
    let mode = "one", lastRows = [], lastIso = "", lastBatch = [];
    const unitParam = params.get("unit");
    if (["auto", "s", "ms", "us", "ns"].indexOf(unitParam) >= 0) $("v9-ep-unit").value = unitParam;
    if (params.get("ts")) $("v9-ep-in").value = params.get("ts");
    const readZone = () => $("v9-ep-read").value;
    const chips = () => {
      const ul = $("v9-ep-chips"); ul.replaceChildren();
      zoneSet.forEach((z) => {
        const li = document.createElement("li");
        const t = document.createElement("span"); t.textContent = z;
        const b = document.createElement("button"); b.type = "button"; b.className = "v9a-x"; b.textContent = "×"; b.setAttribute("aria-label", "Remove " + z);
        b.onclick = () => { if (zoneSet.length === 1) return say("Keep at least one time zone."); zoneSet.splice(zoneSet.indexOf(z), 1); chips(); update(); };
        li.append(t, b); ul.appendChild(li);
      });
    };
    const cell = (v, h) => `<${h ? "th scope=\"col\"" : "td"}>${E(v)}</${h ? "th" : "td"}>`;
    const copyBtn = (v) => `<button type="button" class="btn alt small" data-copy="${E(v)}" aria-label="Copy ${E(v)}">Copy</button>`;
    function updateUrl(raw) {
      try {
        const u = new URL(location.href);
        ["ts", "unit", "tz"].forEach((k) => u.searchParams.delete(k));
        if (raw && mode === "one") { u.searchParams.set("ts", raw); u.searchParams.set("unit", $("v9-ep-unit").value); u.searchParams.set("tz", zoneSet.join(",")); }
        history.replaceState(history.state, "", u.pathname + u.search + u.hash);
      } catch (e) { /* history unavailable */ }
    }
    function renderOne() {
      const out = $("v9-ep-out"), raw = $("v9-ep-in").value.trim();
      lastRows = []; lastIso = "";
      if (!raw) { out.replaceChildren(); updateUrl(""); say(""); return; }
      let r, p;
      try {
        p = G.parseInstant(raw, { zone: readZone(), unit: $("v9-ep-unit").value });
        r = G.describe(p.ns, zoneSet, { kind: p.kind, note: p.note });
      } catch (e) { out.innerHTML = `<p class="v9a-bad" role="alert">${E(e.message)}</p>`; say(e.message); return; }
      lastIso = r.isoPrecise;
      lastRows = r.zones;
      let cmp = "";
      const c2 = $("v9-ep-cmp").value.trim();
      if (c2) {
        try { const q = G.parseInstant(c2, { zone: readZone(), unit: $("v9-ep-unit").value }); const d = G.diff(p.ns, q.ns); cmp = `<p class="v9a-cmp"><strong>Difference:</strong> second is <strong>${E(d.text.replace(/^-/, ""))}</strong> ${d.direction === "same" ? "(identical instant)" : d.direction === "later" ? "later" : "earlier"} — ${E(d.seconds)} s (${E(d.milliseconds)} ms)</p>`; }
        catch (e) { cmp = `<p class="v9a-bad">Second timestamp: ${E(e.message)}</p>`; }
      }
      const head = `<p class="v9a-lead"><strong>${E(r.isoPrecise)}</strong> <span class="v9a-muted">UTC · read as ${E(p.kind)}</span></p>` +
        (p.note ? `<p class="v9a-warnline">${E(p.note)}</p>` : "") + cmp;
      const rows = r.zones.map((z) => `<tr><th scope="row">${E(z.zone)}</th>${cell(z.date ? z.date + " " + z.time : z.value)}${cell(z.offset ? "UTC" + z.offset : "n/a")}${cell(z.abbr)}${cell(z.dst == null ? "" : z.dst ? "DST" : "standard")}${cell(z.dayDelta ? (z.dayDelta > 0 ? "+" : "") + z.dayDelta + " d" : "same day")}</tr>`).join("");
      const matrix = `<div class="v9a-scroll"><table class="v9a-table"><caption>Same instant in each zone (first zone is the day reference)</caption><thead><tr>${cell("Zone", 1)}${cell("Local date and time", 1)}${cell("Offset", 1)}${cell("Name", 1)}${cell("DST", 1)}${cell("Day", 1)}</tr></thead><tbody>${rows}</tbody></table></div>`;
      const fmts = Object.keys(r.formats).map((k) => `<tr><th scope="row">${E(k)}</th><td><code>${E(r.formats[k])}</code></td><td>${copyBtn(r.formats[k])}</td></tr>`).join("");
      const formats = `<div class="v9a-scroll"><table class="v9a-table"><caption>Common formats</caption><thead><tr>${cell("Format", 1)}${cell("Value", 1)}<th scope="col"><span class="v9a-sr">Copy</span></th></tr></thead><tbody>${fmts}</tbody></table></div>`;
      out.innerHTML = head + matrix + formats;
      updateUrl(raw);
      say("Converted: " + r.isoPrecise);
    }
    function renderBatch() {
      const out = $("v9-ep-out"); lastBatch = [];
      const lines = $("v9-ep-lines").value.split(/\r?\n/);
      if (!$("v9-ep-lines").value.trim()) { out.replaceChildren(); say(""); return; }
      const over = lines.length > 500;
      const body = []; let prevNs = null; const z0 = zoneSet[0];
      lines.slice(0, 500).forEach((line, i) => {
        if (!line.trim()) return;
        const found = G.findInLine(line);
        if (!found) { body.push(`<tr><th scope="row">${i + 1}</th><td colspan="4" class="v9a-muted">No timestamp found</td></tr>`); lastBatch.push([i + 1, "", "", "", ""]); return; }
        try {
          const p = G.parseInstant(found, { zone: readZone(), unit: $("v9-ep-unit").value });
          const d = G.describe(p.ns, [z0]);
          const delta = prevNs == null ? "" : G.diff(prevNs, p.ns).text; prevNs = p.ns;
          const local = d.zones[0].date ? d.zones[0].date + " " + d.zones[0].time + " " + d.zones[0].offset : d.zones[0].value;
          body.push(`<tr><th scope="row">${i + 1}</th><td><code>${E(found)}</code></td><td>${E(d.isoPrecise)}</td><td>${E(local)}</td><td>${E(delta)}</td></tr>`);
          lastBatch.push([i + 1, found, d.isoPrecise, local, delta]);
        } catch (e) { body.push(`<tr><th scope="row">${i + 1}</th><td><code>${E(found)}</code></td><td colspan="3" class="v9a-bad">${E(e.message)}</td></tr>`); lastBatch.push([i + 1, found, "", e.message, ""]); }
      });
      out.innerHTML = (over ? `<p class="v9a-warnline">Only the first 500 lines are converted.</p>` : "") +
        `<div class="v9a-scroll"><table class="v9a-table"><caption>First timestamp in each line, shown in UTC and ${E(z0)}</caption><thead><tr>${cell("Line", 1)}${cell("Found", 1)}${cell("UTC (ISO 8601)", 1)}${cell(z0, 1)}${cell("Since previous", 1)}</tr></thead><tbody>${body.join("")}</tbody></table></div>`;
      say("Converted " + lastBatch.length + " line" + (lastBatch.length === 1 ? "" : "s") + ".");
    }
    const update = () => (mode === "one" ? renderOne() : renderBatch());
    const live = debounce(update, 120);
    const setMode = (m) => {
      mode = m;
      $("v9-ep-one").hidden = m !== "one"; $("v9-ep-batch").hidden = m !== "batch";
      $("v9-ep-tab-one").setAttribute("aria-pressed", m === "one"); $("v9-ep-tab-batch").setAttribute("aria-pressed", m === "batch");
      $("v9-ep-tab-one").className = "btn small" + (m === "one" ? "" : " alt"); $("v9-ep-tab-batch").className = "btn small" + (m === "batch" ? "" : " alt");
      update();
    };
    $("v9-ep-tab-one").onclick = () => setMode("one"); $("v9-ep-tab-batch").onclick = () => setMode("batch");
    ["v9-ep-in", "v9-ep-cmp", "v9-ep-lines"].forEach((id) => $(id).addEventListener("input", live));
    ["v9-ep-unit", "v9-ep-read"].forEach((id) => $(id).addEventListener("change", update));
    const addZone = () => {
      const el = $("v9-ep-add"), z = el.value.trim();
      if (!z) return;
      try { G.describe(0n, [z]); } catch (e) { return say("Unknown time zone “" + z + "”. Pick one from the suggestions."); }
      if (zoneSet.indexOf(z) >= 0) return say(z + " is already listed.");
      if (zoneSet.length >= 24) return say("At most 24 zones.");
      zoneSet.push(z); el.value = ""; chips(); update(); say("Added " + z + ".");
    };
    $("v9-ep-addbtn").onclick = addZone;
    $("v9-ep-add").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addZone(); } });
    $("v9-ep-now").onclick = () => { $("v9-ep-in").value = String(Date.now()); $("v9-ep-unit").value = "ms"; update(); };
    $("v9-ep-copyiso").onclick = () => (lastIso ? copyText(lastIso, say) : say("Convert a timestamp first."));
    $("v9-ep-copytable").onclick = () => {
      if (!lastRows.length) return say("Convert a timestamp first.");
      copyText(lastRows.map((z) => [z.zone, z.rfc3339 || z.value, z.abbr, z.dst ? "DST" : "standard"].join("\t")).join("\n"), say);
    };
    $("v9-ep-bcopy").onclick = () => {
      if (!lastBatch.length) return say("Paste log lines first.");
      const safe = (v) => (/^[=+\-@]/.test(String(v)) ? "'" + v : String(v)).replace(/[\t\r\n]+/g, " ");
      copyText(["line\tfound\tutc\tlocal\tsince_previous"].concat(lastBatch.map((r) => r.map(safe).join("\t"))).join("\n"), say);
    };
    $("v9-ep-link").onclick = () => {
      const raw = $("v9-ep-in").value.trim();
      if (!raw) return say("Enter a timestamp first.");
      const u = new URL(location.href); u.search = ""; u.hash = "";
      u.searchParams.set("tool", "epoch-matrix"); u.searchParams.set("ts", raw); u.searchParams.set("unit", $("v9-ep-unit").value); u.searchParams.set("tz", zoneSet.join(","));
      copyText(u.href, say);
    };
    const onCopy = (e) => { const b = e.target.closest && e.target.closest("[data-copy]"); if (b) copyText(b.getAttribute("data-copy"), say); };
    $("v9-ep-out").addEventListener("click", onCopy);
    chips(); update();
    return guard([() => live.cancel(), () => updateUrl("")]);
  }

  /* ======================================================================
     4. Social Card & OG Simulator
     ====================================================================== */
  const OG_SAMPLE = { title: "Ship faster with GoVibeTool: private browser utilities", description: "Format SQL, verify checksums, convert timestamps and more. Everything runs in your browser, with no uploads and no account.", url: "https://example.com/tools", siteName: "GoVibeTool", image: "", imageAlt: "", twitterCard: "", twitterSite: "", twitterCreator: "", type: "website" };
  function ogUI() {
    return `<p class="note"><strong>Simulation, not a live fetch.</strong> Previews are built only from the values you type or paste, using rough character limits and layouts. Real platforms crop, truncate and restyle cards differently and may cache old versions, so treat these as approximations. No page or image is requested unless you opt in below.</p>
    <div class="v9a-og">
      <div class="v9a-og-form">
        ${input("v9-og-title", "Title (og:title)", "")}
        ${area("v9-og-desc", "Description (og:description)", "", 3)}
        ${input("v9-og-url", "Page URL (og:url)", "", 'placeholder="https://example.com/page"')}
        ${input("v9-og-site", "Site name (og:site_name)", "")}
        ${input("v9-og-image", "Image URL for the tags (og:image, absolute https)", "", 'placeholder="https://example.com/card.png"')}
        <label class="v9a-check"><input type="checkbox" id="v9-og-loadurl"> Show this URL as the preview image <span class="v9a-muted">(the preview then requests it from its host and that host sees your IP)</span></label>
        ${field("v9-og-file", "Or preview a local image file (stays on this device)", '<input id="v9-og-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif">')}
        ${input("v9-og-alt", "Image alt text (og:image:alt)", "")}
        <div class="v9a-grid">
          ${select("v9-og-card", "twitter:card", [["", "Automatic"], ["summary_large_image", "summary_large_image"], ["summary", "summary"]], "")}
          ${input("v9-og-tsite", "twitter:site", "", 'placeholder="@handle"')}
          ${select("v9-og-theme", "Preview theme", [["light", "Light"], ["dark", "Dark"]], "light")}
        </div>
        <details class="v9a-details"><summary>Import from pasted HTML &lt;head&gt;</summary>
          ${area("v9-og-html", "Paste meta tags (parsed as text only: nothing runs or loads)", "", 5)}
          <div class="actions">${btn("v9-og-import", "Import tags")}</div>
        </details>
        <div class="actions">${btn("v9-og-sample", "Load sample")}${btn("v9-og-reset", "Reset")}</div>
      </div>
      <div class="v9a-og-view">
        <div id="v9-og-previews"></div>
        <h3 class="v9a-h">Checks</h3><ul id="v9-og-lint" class="v9a-lint"></ul>
        ${area("v9-og-tags", "Meta tags to copy", "", 8, "readonly")}
        <div class="actions">${btn("v9-og-copy", "Copy tags")}</div>
      </div>
    </div>${statusLine()}`;
  }
  function bindOg() {
    const cleanups = [];
    let localUrl = "", localName = "";
    const f = () => ({
      title: $("v9-og-title").value.trim(), description: $("v9-og-desc").value.trim(), url: $("v9-og-url").value.trim(), siteName: $("v9-og-site").value.trim(),
      image: $("v9-og-image").value.trim(), imageAlt: $("v9-og-alt").value.trim(), twitterCard: $("v9-og-card").value, twitterSite: $("v9-og-tsite").value.trim(), twitterCreator: "", type: "website",
    });
    const setFields = (o) => {
      $("v9-og-title").value = o.title || ""; $("v9-og-desc").value = o.description || ""; $("v9-og-url").value = o.url || ""; $("v9-og-site").value = o.siteName || "";
      $("v9-og-image").value = o.image || ""; $("v9-og-alt").value = o.imageAlt || ""; $("v9-og-card").value = G.TWITTER_CARDS.indexOf(o.twitterCard) >= 0 && o.twitterCard !== "app" && o.twitterCard !== "player" ? o.twitterCard : ""; $("v9-og-tsite").value = o.twitterSite || "";
    };
    const imageSrc = (model) => {
      if (localUrl) return localUrl;
      if ($("v9-og-loadurl").checked) { const c = G.classifyImageUrl(model.image); if (c.kind === "https" || c.kind === "http" || c.kind === "data") return c.url; }
      return "";
    };
    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    const makeImg = (src, model, cls) => {
      const wrap = el("div", "v9a-card-img " + (cls || ""));
      if (src) {
        const img = document.createElement("img");
        img.alt = model.imageAlt || "Preview image"; img.decoding = "async"; img.referrerPolicy = "no-referrer"; img.src = src;
        img.addEventListener("error", () => { wrap.replaceChildren(el("span", "v9a-ph", "Image could not be loaded (blocked, not an image, or unreachable).")); });
        wrap.appendChild(img);
      } else wrap.appendChild(el("span", "v9a-ph", model.image ? "Image URL entered but not loaded (preview loading is off)" : "No image"));
      return wrap;
    };
    const previewCard = (platform, model, src) => {
      const L = G.socialLayout(platform, model), box = el("figure", "v9a-prev"), cap = el("figcaption", "v9a-cap");
      cap.append(el("strong", "", L.label), el("span", "v9a-badge", "approximation"));
      const card = el("div", "v9a-card v9a-card-" + platform + (L.small ? " small" : ""));
      if (platform === "x") {
        card.append(makeImg(src, model, L.small ? "sq" : "r2"));
        const t = el("div", "v9a-card-t"); t.append(el("div", "v9a-dom", L.domain), el("div", "v9a-title", L.title), el("div", "v9a-desc", L.description)); card.append(t);
      } else if (platform === "linkedin") {
        card.append(makeImg(src, model, "r191"));
        const t = el("div", "v9a-card-t"); t.append(el("div", "v9a-title", L.title), el("div", "v9a-dom", L.domain)); card.append(t);
      } else {
        card.append(el("span", "v9a-bar"));
        const t = el("div", "v9a-card-t"); t.append(el("div", "v9a-site", L.siteName), el("div", "v9a-title link", L.title), el("div", "v9a-desc", L.description), makeImg(src, model, "r191 slackimg")); card.append(t);
      }
      const dl = el("button", "btn alt small", "Download PNG"); dl.type = "button"; dl.dataset.export = platform;
      const notes = [];
      if (L.titleTruncated) notes.push("title is cut here");
      if (L.descriptionTruncated) notes.push("description is cut here");
      box.append(cap, card, el("p", "v9a-muted", PLATFORM_NOTE(platform) + (notes.length ? " Note: " + notes.join(", ") + "." : "")), dl);
      return box;
    };
    const PLATFORM_NOTE = (p) => G.PLATFORMS[p].note;
    function render() {
      const model = f(), src = imageSrc(model);
      const host = $("v9-og-previews"); host.replaceChildren();
      const theme = $("v9-og-theme").value;
      host.className = "v9a-previews " + (theme === "dark" ? "dark" : "");
      ["x", "linkedin", "slack"].forEach((p) => host.appendChild(previewCard(p, model, src)));
      const lint = $("v9-og-lint"); lint.replaceChildren();
      const issues = G.socialLint(model);
      if (!issues.length) lint.appendChild(el("li", "ok", "No problems found with the entered values."));
      issues.forEach((i) => lint.appendChild(el("li", i.level, (i.level === "error" ? "Error: " : i.level === "warn" ? "Warning: " : "Tip: ") + i.message)));
      $("v9-og-tags").value = G.buildMetaTags(model);
    }
    const live = debounce(render, 80);
    ["v9-og-title", "v9-og-desc", "v9-og-url", "v9-og-site", "v9-og-image", "v9-og-alt", "v9-og-tsite"].forEach((id) => $(id).addEventListener("input", live));
    ["v9-og-card", "v9-og-theme", "v9-og-loadurl"].forEach((id) => $(id).addEventListener("change", render));
    $("v9-og-file").addEventListener("change", (e) => {
      if (localUrl) URL.revokeObjectURL(localUrl);
      const file = e.target.files && e.target.files[0];
      localUrl = file ? URL.createObjectURL(file) : ""; localName = file ? file.name : "";
      render(); say(file ? "Using local image " + localName + " for the preview. It is not uploaded." : "Local image removed.");
    });
    cleanups.push(() => { if (localUrl) URL.revokeObjectURL(localUrl); localUrl = ""; });
    $("v9-og-import").onclick = () => {
      try {
        const r = G.parseMetaHtml($("v9-og-html").value);
        if (!r.found && !r.fields.title) return say("No meta tags or title found in the pasted HTML.");
        setFields(r.fields); render(); say("Imported " + r.found + " meta tag" + (r.found === 1 ? "" : "s") + ". Relative image paths must be made absolute.");
      } catch (e) { say(e.message); }
    };
    $("v9-og-sample").onclick = () => { setFields(OG_SAMPLE); render(); say("Sample loaded."); };
    $("v9-og-reset").onclick = () => { setFields({}); $("v9-og-file").value = ""; if (localUrl) URL.revokeObjectURL(localUrl); localUrl = ""; $("v9-og-loadurl").checked = false; render(); say("Reset."); };
    $("v9-og-copy").onclick = () => { const v = $("v9-og-tags").value; if (!v) return say("Enter a title first."); copyText(v, say); };

    /* ----- PNG export (Canvas) ----- */
    const loadImage = (src, cors) => new Promise((resolve, reject) => {
      const img = new Image(); if (cors) img.crossOrigin = "anonymous"; img.referrerPolicy = "no-referrer";
      const timer = setTimeout(() => reject(Error("timeout")), 10000);
      img.onload = () => { clearTimeout(timer); resolve(img); }; img.onerror = () => { clearTimeout(timer); reject(Error("load")); };
      img.src = src;
    });
    function cover(ctx, img, x, y, w, h) {
      const r = Math.max(w / img.naturalWidth, h / img.naturalHeight), sw = w / r, sh = h / r;
      ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
    }
    async function exportPng(platform) {
      const model = f(), L = G.socialLayout(platform, model), dark = $("v9-og-theme").value === "dark";
      const c = { bg: dark ? "#15202b" : "#ffffff", ink: dark ? "#f7f9f9" : "#0f1419", mute: dark ? "#8b98a5" : "#536471", line: dark ? "#38444d" : "#cfd9de", ph: dark ? "#273340" : "#e6ecf0", link: dark ? "#6cb6f2" : "#1264a3" };
      let img = null;
      const src = imageSrc(model);
      if (src) {
        try { img = await loadImage(src, !localUrl && !/^data:/.test(src)); }
        catch (e) { return say("Export unavailable: the image host does not allow its use in a canvas (CORS) or the image failed to load. Use “preview a local image file” instead, or export without the image by clearing the preview option."); }
      }
      const W = platform === "slack" ? 1000 : 1200, pad = 36, FONT = '-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';
      const scratch = document.createElement("canvas").getContext("2d");
      const wrap = (text, px, weight, width, lines) => { scratch.font = weight + " " + px + "px " + FONT; return G.wrapLines((t) => scratch.measureText(t).width, text, width, lines); };
      let H, draw;
      if (platform === "x" && L.small) {
        H = 420; draw = (g) => { g.fillStyle = c.ph; g.fillRect(0, 0, 420, H); if (img) cover(g, img, 0, 0, 420, H); text(g, 420 + pad, pad); };
        var text = (g, x, y) => { let cy = y + 30; g.fillStyle = c.mute; g.font = "400 28px " + FONT; g.fillText(L.domain, x, cy); cy += 56; g.fillStyle = c.ink; g.font = "700 40px " + FONT; wrap(L.title, 40, 700, W - x - pad, 2).forEach((l) => { g.fillText(l, x, cy); cy += 50; }); g.fillStyle = c.mute; g.font = "400 30px " + FONT; wrap(L.description, 30, 400, W - x - pad, 3).forEach((l) => { g.fillText(l, x, cy); cy += 40; }); };
      } else if (platform === "x") {
        H = 600 + 250; draw = (g) => { g.fillStyle = c.ph; g.fillRect(0, 0, W, 600); if (img) cover(g, img, 0, 0, W, 600); let cy = 600 + pad + 28; g.fillStyle = c.mute; g.font = "400 28px " + FONT; g.fillText(L.domain, pad, cy); cy += 52; g.fillStyle = c.ink; g.font = "700 40px " + FONT; wrap(L.title, 40, 700, W - 2 * pad, 1).forEach((l) => { g.fillText(l, pad, cy); cy += 50; }); g.fillStyle = c.mute; g.font = "400 30px " + FONT; wrap(L.description, 30, 400, W - 2 * pad, 2).forEach((l) => { g.fillText(l, pad, cy); cy += 40; }); };
      } else if (platform === "linkedin") {
        H = 628 + 190; draw = (g) => { g.fillStyle = c.ph; g.fillRect(0, 0, W, 628); if (img) cover(g, img, 0, 0, W, 628); let cy = 628 + pad + 36; g.fillStyle = c.ink; g.font = "600 40px " + FONT; wrap(L.title, 40, 600, W - 2 * pad, 2).forEach((l) => { g.fillText(l, pad, cy); cy += 50; }); g.fillStyle = c.mute; g.font = "400 28px " + FONT; g.fillText(L.domain, pad, cy + 6); };
      } else {
        const imgW = W - pad - 24 - 40, imgH = Math.round(imgW / 1.91);
        H = 70 + 60 + 130 + (img ? imgH + 30 : 0) + 60; draw = (g) => { g.fillStyle = c.line; g.fillRect(pad, pad, 8, H - 2 * pad); let cy = pad + 30, x = pad + 36; g.fillStyle = c.ink; g.font = "700 28px " + FONT; g.fillText(L.siteName, x, cy); cy += 52; g.fillStyle = c.link; g.font = "700 36px " + FONT; wrap(L.title, 36, 700, W - x - pad, 2).forEach((l) => { g.fillText(l, x, cy); cy += 46; }); g.fillStyle = c.ink; g.font = "400 30px " + FONT; wrap(L.description, 30, 400, W - x - pad, 3).forEach((l) => { g.fillText(l, x, cy); cy += 40; }); if (img) cover(g, img, x, cy + 6, imgW, imgH); };
      }
      if (platform === "slack" && !img) H = 330;
      if (platform === "slack") H = Math.max(H, 330);
      const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
      const g = cv.getContext("2d"); g.fillStyle = c.bg; g.fillRect(0, 0, W, H); draw(g);
      g.strokeStyle = c.line; g.lineWidth = 2; if (platform !== "slack") g.strokeRect(1, 1, W - 2, H - 2);
      cv.toBlob((blob) => {
        if (!blob) return say("Export failed in this browser.");
        const url = URL.createObjectURL(blob), a = document.createElement("a");
        a.href = url; a.download = "social-card-" + platform + ".png"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
        say("Downloaded " + L.label + " preview as PNG (approximation).");
      }, "image/png");
    }
    const onClick = (e) => { const b = e.target.closest && e.target.closest("[data-export]"); if (b) exportPng(b.dataset.export).catch((err) => say("Export failed: " + err.message)); };
    $("v9-og-previews").addEventListener("click", onClick);
    render();
    cleanups.push(() => live.cancel());
    return guard(cleanups);
  }

  /* ---------- wiring ---------- */
  const UI = { "sql-formatter": [sqlUI, bindSql], "file-sha256": [shaUI, bindSha], "epoch-matrix": [epochUI, bindEpoch], "og-simulator": [ogUI, bindOg] };
  openTool = function (id) {
    dispose(); dispose = () => {};
    const w = document.getElementById("workspace");
    if (!ids.has(id)) { if (w) delete w.dataset.v9Tool; return previousOpen(id); }
    previousClose();
    if (typeof rememberTool === "function") rememberTool(id);
    const t = newTools.find((x) => x[0] === id);
    w.dataset.v9Tool = id;
    w.innerHTML = shell(t, `<div class="v9a">${UI[id][0]()}</div>`);
    w.classList.add("active");
    dispose = UI[id][1]();
    w.focus({ preventScroll: true });
    w.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };
  closeTool = function () {
    dispose(); dispose = () => {};
    const w = document.getElementById("workspace");
    if (w && ids.has(w.dataset.v9Tool)) { w.replaceChildren(); delete w.dataset.v9Tool; }
    return previousClose();
  };
  if (typeof renderCatalog === "function") renderCatalog();
  if (typeof renderDiscoveryShelf === "function") renderDiscoveryShelf();
})();
