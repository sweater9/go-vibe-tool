/* Consolidated workspace UI; shared QR engines and legacy APIs are retained. */
(function () {
  "use strict";
  const c = window.GVTStudios;
  if (!c) return;
  const E = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (x) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[x],
    );
  const N = (id) => document.getElementById(id),
    F = (id, label, value = "", type = "text") =>
      `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="${type}" value="${E(value)}"></div>`,
    B = (id, text) =>
      `<button type="button" class="btn alt" id="${id}">${text}</button>`;
  let urlResult = "",
    urlSensitive = false,
    piiPreview = null;
  const originalRedact = window.runRedactor,
    originalGenerate = window.generateQR;
  function urlTemplate() {
    return (
      F(
        "urlInput",
        "URL to inspect",
        "https://example.com/page?utm_source=newsletter&ref=keep",
      ) +
      `<div class="actions">${B("urlAnalyze", "Inspect & clean")}${B("urlCopy", "Copy result")}</div><details><summary>Build a UTM campaign link</summary><div class="grid2">${F("utmSource", "UTM source", "newsletter")}${F("utmMedium", "UTM medium", "email")}${F("utmCampaign", "UTM campaign", "launch")}</div>${B("urlUtm", "Build UTM link")}</details><div id="urlResult" class="result" role="status" aria-live="polite">Enter a link to inspect.</div><p class="note">Known tracking keys are removed; other query data is retained. Redirects are never followed and a clean link is not a safety verdict.</p>`
    );
  }
  function freelanceTemplate() {
    const fields = [
      ["target", "Annual target income", 100000],
      ["overhead", "Annual overhead", 15000],
      ["hours", "Working hours per week", 40],
      ["weeks", "Working weeks per year", 46],
      ["utilization", "Billable utilization (%)", 65],
      ["tax", "User-estimated effective tax (%)", 0],
      ["margin", "Desired profit margin (%)", 15],
      ["quoteHours", "Quoted project hours", 20],
    ];
    return `<div class="grid2">${fields.map(([id, label, v]) => F(id, label, v, "number")).join("")}</div><p class="note">Use a consistent currency. Tax is your assumption; no jurisdiction-specific tax rate is supplied.</p>${B("calcRate", "Calculate & quote")}<div id="rateResult" class="result" role="status" aria-live="polite"></div><details open><summary>Effective hourly rate for a completed project (retained)</summary><div class="grid2">${F("hrRevenue", "Project revenue", 5000, "number")}${F("hrCosts", "Direct costs", 500, "number")}${F("hrBill", "Billable hours", 40, "number")}${F("hrUnpaid", "Unpaid/admin hours", 10, "number")}</div>${B("calcEffective", "Calculate effective rate")}<div id="effectiveResult" class="result" role="status" aria-live="polite"></div></details><a href="./?tool=percentage-change">Open independent Percentage Change calculator</a>`;
  }
  function privacyTemplate() {
    return `<div class="field"><label for="piiMode">Mode</label><select id="piiMode"><option value="redact">Auto-Redact (preview)</option><option value="audit">Audit Only (unchanged input)</option></select></div><fieldset class="categories"><legend>Patterns to include</legend>${[
      ["email", "Email addresses"],
      ["phone", "Phone-like numbers"],
      ["secrets", "Bearer/JWT/API keys and passwords"],
      ["ip", "IPv4 addresses"],
      ["connection", "Database connection strings"],
    ]
      .map(
        ([id, label]) =>
          `<label><input type="checkbox" data-pii="${id}" checked> ${label}</label>`,
      )
      .join(
        "",
      )}</fieldset>${redactorTemplate()}${B("piiApply", "Apply preview to input")}<p class="note">Audit classifies supported patterns without changing text. Auto-Redact makes a preview; Apply and Copy are explicit actions. Review for missed or overmatched data. Nothing is saved.</p>`;
  }
  window.runRedactor = function () {
    if (!N("piiMode")) return originalRedact();
    try {
      const audit = N("piiMode").value === "audit",
        r = c.redact(N("redactInput").value, {
          audit,
          mode: N("redactMode").value,
          categories: [...document.querySelectorAll("[data-pii]:checked")].map(
            (n) => n.dataset.pii,
          ),
        }),
        counts = {};
      for (const name of r.findings) counts[name] = (counts[name] || 0) + 1;
      N("redactSummary").textContent =
        (audit
          ? "Audit Only — original text unchanged. "
          : "Redacted preview. ") +
        (Object.entries(counts)
          .map(([k, v]) => k + ": " + v)
          .join(" · ") || "No supported patterns found.");
      const urls = N("redactInput").value.match(/https?:\/\/\S+/gi) || [];
      N("redactSummary").textContent += " · URLs: " + urls.length + " · URLs with query parameters: " + urls.filter(x => x.includes("?")).length;
      N("redactOutput").textContent = r.output;
      piiPreview = r.preview;
    } catch (e) {
      piiPreview = null;
      N("redactSummary").textContent = e.message;
      N("redactOutput").textContent = "";
    }
  };
  window.copyRedacted = async function () {
    if (!N("piiMode")) return;
    if (piiPreview === null) {
      N("redactSummary").textContent =
        "Run Auto-Redact to create a current preview before copying.";
      return;
    }
    try {
      await navigator.clipboard.writeText(piiPreview);
      N("redactSummary").textContent += " Copied.";
    } catch {
      N("redactSummary").textContent +=
        " Clipboard unavailable; select the preview manually.";
    }
  };
  window.generateQR = function () {
    if (N("qrValidation")) {
      const r = c.validatePayload(qrPayload(), N("qrType").value);
      N("qrValidation").textContent = r.message;
      if (!r.ok) return;
    }
    if (window.qrcode?.stringToBytesFuncs?.["UTF-8"])
      qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
    return originalGenerate();
  };
  function bind() {
    N("urlAnalyze").onclick = () => {
      try {
        const r = c.inspectUrl(N("urlInput").value);
        urlResult = r.clean;
        urlSensitive = r.sensitive;
        N("urlResult").textContent = [
          `Scheme: ${r.scheme}`,
          `Host: ${r.host}`,
          `Port: ${r.port || "default"}`,
          `Path: ${r.path}`,
          "Query parameters:\n" +
            (r.query.map(([k, v]) => k + " = " + v).join("\n") || "none"),
          "Removed trackers: " + (r.removed.join(", ") || "none"),
          "Clean URL: " + r.clean,
          "Fingerprint: " + r.fingerprint,
          "Signals: " +
            (r.signals.join("; ") ||
              "No basic warning signals (not a safety verdict)"),
        ].join("\n");
      } catch (e) {
        urlResult = "";
        N("urlResult").textContent = "Invalid URL: " + e.message;
      }
    };
    N("urlUtm").onclick = () => {
      try {
        urlResult = c.utmUrl(N("urlInput").value, {
          source: N("utmSource").value,
          medium: N("utmMedium").value,
          campaign: N("utmCampaign").value,
        });
        urlSensitive = c.inspectUrl(urlResult).sensitive;
        N("urlResult").textContent = "Campaign URL:\n" + urlResult;
      } catch (e) {
        urlResult = "";
        N("urlResult").textContent = e.message;
      }
    };
    N("urlInput").oninput = () => {
      urlResult = "";
      N("urlResult").textContent = "Input changed; inspect or build again.";
    };
    N("urlCopy").onclick = async () => {
      if (!urlResult) {
        N("urlResult").textContent = "Inspect or build a URL first.";
        return;
      }
      if (
        urlSensitive &&
        !confirm(
          "This URL contains credentials or secret-like parameters. Copy anyway?",
        )
      )
        return;
      try {
        await navigator.clipboard.writeText(urlResult);
        N("urlResult").textContent += "\nCopied.";
      } catch {
        N("urlResult").textContent +=
          "\nClipboard unavailable; select the displayed URL.";
      }
    };
    N("calcRate").onclick = () => {
      try {
        const r = c.freelance(
          Object.fromEntries(
            [
              "target",
              "overhead",
              "hours",
              "weeks",
              "utilization",
              "tax",
              "margin",
              "quoteHours",
            ].map((k) => [k, N(k).value]),
          ),
        );
        N("rateResult").textContent = [
          `Estimated billable hours/year: ${r.billable.toFixed(1)}`,
          `Revenue requirement before margin: ${r.revenue.toFixed(2)}`,
          `Break-even hourly rate: ${r.base.toFixed(2)}`,
          `Suggested hourly rate: ${r.rate.toFixed(2)}`,
          `Quote: ${r.quote.toFixed(2)}`,
          "Assumptions: tax applied to target income; margin applied to revenue.",
        ].join("\n");
      } catch (e) {
        N("rateResult").textContent = e.message;
      }
    };
    N("calcEffective").onclick = () => {
      try {
        const r = c.effective({
          revenue: N("hrRevenue").value,
          costs: N("hrCosts").value,
          billable: N("hrBill").value,
          unpaid: N("hrUnpaid").value,
        });
        N("effectiveResult").textContent =
          `Net income: ${r.net.toFixed(2)}\nEffective hourly rate: ${r.rate === null ? "Undefined from zero hours" : r.rate.toFixed(2)}\nBillable utilization: ${r.utilization === null ? "Undefined" : r.utilization.toFixed(1) + "%"}`;
      } catch (e) {
        N("effectiveResult").textContent = e.message;
      }
    };
    // Results describe the assumptions used, never a subsequently edited form.
    for (const id of ["target", "overhead", "hours", "weeks", "utilization", "tax", "margin", "quoteHours"])
      N(id).addEventListener("input", () => {
        N("rateResult").textContent = "Assumptions changed; calculate again.";
      });
    for (const id of ["hrRevenue", "hrCosts", "hrBill", "hrUnpaid"])
      N(id).addEventListener("input", () => {
        N("effectiveResult").textContent = "Project inputs changed; calculate again.";
      });
    const invalidate = () => {
      piiPreview = null;
      N("redactOutput").textContent = "";
      N("redactSummary").textContent =
        "Input or options changed; analyze again.";
    };
    N("redactInput").oninput = invalidate;
    N("piiMode").onchange = invalidate;
    N("redactMode").onchange = invalidate;
    document
      .querySelectorAll("[data-pii]")
      .forEach((n) => (n.onchange = invalidate));
    N("piiApply").onclick = () => {
      if (piiPreview === null) {
        N("redactSummary").textContent =
          "Create a current Auto-Redact preview first.";
        return;
      }
      N("redactInput").value = piiPreview;
      invalidate();
    };
    initQR();
    N("qrFields").addEventListener("input", () => {
      N("qrValidation").textContent = c.validatePayload(
        qrPayload(),
        N("qrType").value,
      ).message;
    });
  }
  function select(tab, id, { historyChange = true } = {}) {
    if (!c.titles[tab]) tab = "url";
    for (const name of Object.keys(c.titles)) {
      N("studio-" + name).hidden = name !== tab;
      const b = document.querySelector('[data-studio="' + name + '"]');
      b.setAttribute("aria-selected", String(name === tab));
      b.tabIndex = name === tab ? 0 : -1;
    }
    if (tab !== "qr") stopCamera();
    const h = N("studioTitle");
    h.textContent = c.titles[tab];
    if (historyChange) {
      const u = new URL(location.href);
      u.searchParams.set("studio", tab);
      u.searchParams.set("tool", id || c.canonical[tab]);
      history.replaceState(null, "", u);
    }
    N("workspace").classList.add("active");
  }
  function mount(id = "link-fingerprint", tab) {
    const w = N("workspace");
    if (!w) throw Error("The Studio workspace is not ready.");
    // Opening another alias or tab in this workspace must not replace its DOM
    // and discard user input, event handlers, or calculation results.
    if (w.querySelector("#studioRoot") && w.classList.contains("active")) {
      if (id === "metadata" && N("piiMode").value !== "audit") {
        N("piiMode").value = "audit";
        N("piiMode").dispatchEvent(new Event("change"));
      }
      select(tab || c.aliases[id] || "url", id);
      w.focus({ preventScroll: true });
      return w;
    }
    urlResult = "";
    piiPreview = null;
    if (!document.querySelector('link[href="studios.css"]')) {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = "studios.css";
      document.head.appendChild(l);
    }
    w.innerHTML = `<div id="studioRoot"><div class="workspace-head"><div><span class="tag">Consolidated Studio</span><h2 id="studioTitle"></h2></div>${document.querySelector(".studio-page") ? "" : '<button type="button" class="btn alt" onclick="closeTool()">Close</button>'}</div><div class="studio-switcher" role="tablist" aria-label="Choose a studio">${Object.entries(
      c.titles,
    )
      .map(
        ([key, title]) =>
          `<button class="btn alt" type="button" role="tab" id="studio-tab-${key}" aria-controls="studio-${key}" data-studio="${key}">${E(title)}</button>`,
      )
      .join("")}</div>${[
      ["url", urlTemplate()],
      ["freelance", freelanceTemplate()],
      [
        "qr",
        '<p id="qrValidation" class="note" role="status">Plain text and HTTP(S) links can be encoded. Wi-Fi, contact, image decoding and camera controls are retained.</p>' +
          qrTemplate(),
      ],
      ["privacy", privacyTemplate()],
    ]
      .map(
        ([key, body]) =>
          `<section id="studio-${key}" class="studio-panel" role="tabpanel" aria-labelledby="studio-tab-${key}" hidden>${body}</section>`,
      )
      .join("")}<div id="out" aria-live="polite"></div></div>`;
    // The shared QR engine retains its mode/canvas across mounts. A fresh
    // selector starts at URL; synchronize its engine before rendering fields.
    if (typeof qrType !== "undefined") qrType = N("qrType").value;
    if (typeof qrCanvas !== "undefined") qrCanvas = null;
    bind();
    if (id === "metadata") N("piiMode").value = "audit";
    document.querySelectorAll("[data-studio]").forEach((b) => {
      b.onclick = () => {
        const chosen = b.dataset.studio;
        rememberTool(c.canonical[chosen]);
        select(chosen);
      };
      b.onkeydown = (e) => {
        const keys = Object.keys(c.titles),
          i = keys.indexOf(b.dataset.studio);
        let target;
        if (e.key === "ArrowRight") target = (i + 1) % keys.length;
        if (e.key === "ArrowLeft") target = (i + keys.length - 1) % keys.length;
        if (e.key === "Home") target = 0;
        if (e.key === "End") target = keys.length - 1;
        if (target !== undefined) {
          e.preventDefault();
          const n = document.querySelector(
            '[data-studio="' + keys[target] + '"]',
          );
          n.click();
          n.focus();
        }
      };
    });
    select(tab || c.aliases[id] || "url", id);
    w.focus({ preventScroll: true });
    return w;
  }
  function dispose() {
    urlResult = "";
    urlSensitive = false;
    piiPreview = null;
    stopCamera();
    if (typeof qrCanvas !== "undefined") qrCanvas = null;
  }
  window.GVTStudioUI = { mount, dispose };
  function initializeStandalone() {
    if (!document.querySelector(".studio-page")) return;
    const q = new URLSearchParams(location.search),
      id = q.get("tool") || c.canonical[q.get("studio")] || "link-fingerprint";
    rememberTool(id);
    mount(id, q.get("studio"));
  }
  // Defer the first mount until legacy DOM-ready hooks have finished; the API
  // is available immediately so the routing wrapper can install synchronously.
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", initializeStandalone, { once: true });
  else initializeStandalone();
})();
