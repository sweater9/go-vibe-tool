/* GoVibeTool V6 AI tools — AI Prompt Improver (workspace UI).
 * Analysis logic lives in prompt-improver-core.js and runs entirely on-device.
 * Loaded after v21-tools.js so its openTool override sits at the top of the chain.
 */
(function () {
  "use strict";
  var core = window.GVTPromptImprover;
  if (!core || typeof tools === "undefined" || typeof openTool !== "function") return;

  var NEW_TOOLS = [
    ["prompt-improver", "Productivity", "AI Prompt Improver", "Score a rough prompt, spot vague wording and get a clearer, structured rewrite."]
  ];
  tools.push.apply(tools, NEW_TOOLS);
  var ids = new Set(NEW_TOOLS.map(function (t) { return t[0]; }));
  var previousOpen = openTool;
  var STORAGE_KEY = "govibetool.prompt-improver";
  var last = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function loadDraft() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveDraft(d) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch (e) { /* storage unavailable */ }
  }
  function clearDraft() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* storage unavailable */ }
  }

  function shellHtml(t) {
    return '<div class="workspace-head"><div><span class="tag">' + esc(t[1]) + '</span><span class="tag new-tag">NEW</span><h2>' +
      esc(t[2]) + '</h2><p class="desc">' + esc(t[3]) + '</p></div><button class="btn alt no-print" type="button" onclick="closeTool()">Close</button></div>';
  }

  function bodyHtml() {
    var opts = '<option value="auto">Auto-detect</option>' + core.TASK_TYPES.map(function (t) {
      return '<option value="' + esc(t.id) + '">' + esc(t.label) + "</option>";
    }).join("");
    return '<div class="grid2 pi-layout">' +
      '<div class="pi-input">' +
      '<div class="field"><label for="piInput">Your rough prompt</label>' +
      '<textarea id="piInput" rows="12" maxlength="' + core.MAX_CHARS + '" placeholder="Paste or type the prompt you plan to send to an AI assistant…"></textarea></div>' +
      '<div class="field"><label for="piType">Task type</label><select id="piType">' + opts + "</select></div>" +
      '<div class="actions"><button class="btn alt" type="button" id="piExample">Try an example</button>' +
      '<button class="btn alt" type="button" id="piClear">Clear</button></div>' +
      '<p class="note">Everything runs in your browser. Nothing is sent anywhere, and your draft is saved only on this device. ' +
      "The score judges prompt structure, not facts or how a particular model will respond.</p>" +
      "</div>" +
      '<div class="pi-output" id="piResults" aria-live="polite"></div>' +
      "</div>";
  }

  var STATUS_ORDER = { fail: 0, warn: 1, pass: 2 };
  var STATUS_MARK = { pass: "✓", warn: "~", fail: "✗" };
  var STATUS_TEXT = { pass: "Done", warn: "Partly", fail: "Missing" };

  function renderResults() {
    var inputEl = document.getElementById("piInput");
    var typeEl = document.getElementById("piType");
    var out = document.getElementById("piResults");
    if (!inputEl || !typeEl || !out) return;

    var r = core.analyze(inputEl.value, { taskType: typeEl.value });
    last = r;
    if (r.empty) {
      out.innerHTML = '<div class="result pi-empty"><h3>Your results appear here</h3>' +
        "<p>Paste a prompt on the left to see its score, what is missing, and a clearer version you can copy.</p></div>";
      return;
    }

    var level = r.score >= 85 ? "strong" : r.score >= 70 ? "good" : r.score >= 40 ? "mid" : "low";
    var html = '<div class="pi-score" data-level="' + level + '">' +
      '<div class="pi-score-top"><div class="pi-score-num"><strong>' + r.score + "</strong><span>/100</span></div>" +
      '<div><p class="pi-label">' + esc(r.label) + '</p><p class="pi-meta">' + esc(r.taskLabel) + " · " + r.wordCount + (r.wordCount === 1 ? " word" : " words") + "</p></div></div>" +
      '<div class="pi-meter" role="meter" aria-label="Prompt score" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + r.score + '"><span style="width:' + r.score + '%"></span></div></div>';

    r.flags.forEach(function (f) {
      html += '<div class="pi-flag" data-type="' + esc(f.type) + '" role="note"><strong>' + esc(f.label) + "</strong><p>" + esc(f.detail) + "</p>";
      if (f.type === "sensitive") html += '<button class="btn alt" type="button" data-open-tool="pii-secret-redactor">Open PII &amp; Secret Redactor</button>';
      html += "</div>";
    });

    var sorted = r.checks.slice().sort(function (a, b) { return STATUS_ORDER[a.status] - STATUS_ORDER[b.status]; });
    html += '<h3>What to improve</h3><ul class="pi-checks">' + sorted.map(function (c) {
      return '<li class="pi-check" data-status="' + c.status + '"><span class="pi-mark" aria-hidden="true">' + STATUS_MARK[c.status] + "</span>" +
        "<div><strong>" + esc(c.label) + '</strong><span class="pi-sr"> — ' + STATUS_TEXT[c.status] + "</span><p>" + esc(c.tip) + "</p></div>" +
        '<span class="pi-pts">' + c.earned + "/" + c.weight + "</span></li>";
    }).join("") + "</ul>";

    if (r.vague.length) {
      html += '<h3>Vague wording</h3><p class="pi-chips">' + r.vague.map(function (w) { return '<span class="pi-chip">' + esc(w) + "</span>"; }).join("") +
        '</p><p class="note">Swap each for something measurable. “Good” could become “clear, specific and persuasive”.</p>';
    }

    html += "<h3>Improved prompt</h3>";
    if (r.alreadyStrong) {
      html += '<p class="note">Your prompt already covers the essentials, so there is nothing to add.</p>';
    } else {
      html += '<p class="note">Added for you: ' + esc(r.added.join(", ")) + ". Your own wording is kept as written.</p>" +
        '<pre id="piImproved" class="pi-pre" tabindex="0">' + esc(r.improved) + "</pre>" +
        '<div class="actions"><button class="btn" type="button" data-pi-copy>Copy improved prompt</button><span class="pi-copy-msg" id="piCopyMsg" role="status"></span></div>';
      if (r.placeholderCount) {
        html += '<p class="note">Replace the <code>[bracketed]</code> parts (' + r.placeholderCount + ") with your own details before sending.</p>";
      }
    }
    out.innerHTML = html;
  }

  function copyText(text, msgEl) {
    function done(ok) { if (msgEl) msgEl.textContent = ok ? "Copied to clipboard." : "Copy failed. Select the text and copy it manually."; }
    function fallback() {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        done(ok);
      } catch (e) { done(false); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
    } else fallback();
  }

  function bind(workspace) {
    var inputEl = document.getElementById("piInput");
    var typeEl = document.getElementById("piType");
    var results = document.getElementById("piResults");
    var timer = 0;
    var draft = loadDraft();
    if (typeof draft.text === "string") inputEl.value = draft.text.slice(0, core.MAX_CHARS);
    if (draft.type && Array.prototype.some.call(typeEl.options, function (o) { return o.value === draft.type; })) typeEl.value = draft.type;

    function persist() { saveDraft({ text: inputEl.value, type: typeEl.value }); }
    function update() { renderResults(); persist(); }

    inputEl.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(update, 150);
    });
    typeEl.addEventListener("change", update);
    document.getElementById("piExample").addEventListener("click", function () {
      inputEl.value = core.EXAMPLE_PROMPT;
      update();
      inputEl.focus();
    });
    document.getElementById("piClear").addEventListener("click", function () {
      inputEl.value = "";
      typeEl.value = "auto";
      clearDraft();
      renderResults();
      inputEl.focus();
    });
    results.addEventListener("click", function (e) {
      var copyBtn = e.target.closest("[data-pi-copy]");
      if (copyBtn && last && !last.empty) {
        copyText(last.improved, document.getElementById("piCopyMsg"));
        return;
      }
      var openBtn = e.target.closest("[data-open-tool]");
      if (openBtn) openTool(openBtn.getAttribute("data-open-tool"));
    });
    renderResults();
  }

  openTool = function (id) {
    if (!ids.has(id)) return previousOpen(id);
    rememberTool(id);
    var t = NEW_TOOLS.filter(function (x) { return x[0] === id; })[0];
    var w = document.getElementById("workspace");
    w.innerHTML = shellHtml(t) + bodyHtml();
    w.classList.add("active");
    bind(w);
    w.focus({ preventScroll: true });
    w.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Refresh the catalogue so counts, filters and shortcuts include the new tool.
  renderCatalog();
  renderDiscoveryShelf();
})();
