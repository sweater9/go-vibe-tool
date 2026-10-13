/* GoVibeTool V8 — file & media tools (workspace UI).
   Registers four tools in the existing catalogue and mounts them in the shared #workspace panel:
     svg-sanitizer, image-metadata-stripper, image-batch-compressor, table-converter.
   Cores live beside this file (fm-svg.js, fm-image.js, fm-table.js) and are loaded on first use.
   Everything runs in the browser; no file or text is uploaded. Loaded after v6-tools.js so the openTool chain stays intact. */
(function () {
  "use strict";
  if (typeof tools === "undefined" || typeof openTool !== "function") return;

  var SCRIPT_URL = document.currentScript && document.currentScript.src || "";
  var BASE = SCRIPT_URL ? new URL("./", SCRIPT_URL).href : "tools/file-media/";

  var NEW_TOOLS = [
    ["svg-sanitizer", "Developer", "SVG Sanitizer & Optimizer", "Remove scripts, event handlers and unsafe references from an SVG, then shrink it with SVGO. Runs locally, with a safe preview."],
    ["image-metadata-stripper", "Privacy & Safety", "Image Metadata & EXIF Stripper", "Strip EXIF location, camera, IPTC and XMP data by re-encoding photos to JPEG or PNG on your device, and see what was found."],
    ["image-batch-compressor", "Images & Design", "WebP / AVIF Batch Image Compressor", "Compress many images to WebP, AVIF or JPEG with quality and resize controls, see the savings per file and export a ZIP."],
    ["table-converter", "PDF & Tables", "Markdown Table ↔ CSV / Sheets Converter", "Convert Markdown tables, CSV and tab-delimited clipboard data in both directions, ready to paste into Google Sheets or Excel."]
  ];
  tools.push.apply(tools, NEW_TOOLS);
  var ids = {};
  NEW_TOOLS.forEach(function (t) { ids[t[0]] = t; });
  var previousOpen = openTool;

  /* ---------- small helpers ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(s, r) { return (r || document).querySelector(s); }
  function h(tag, props) {
    var e = document.createElement(tag), kids = Array.prototype.slice.call(arguments, 2);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === "class") e.className = v; else if (k === "text") e.textContent = v; else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? "" : v);
    });
    (function add(list) {
      list.forEach(function (c) {
        if (c == null || c === false) return;
        if (Array.isArray(c)) return add(c);
        e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      });
    })(kids);
    return e;
  }
  var loaded = {};
  function loadScript(name) {
    if (!loaded[name]) loaded[name] = new Promise(function (res, rej) {
      var s = document.createElement("script"); s.src = BASE + name; s.onload = res; s.onerror = function () { delete loaded[name]; rej(new Error("Could not load " + name)); };
      document.head.appendChild(s);
    });
    return loaded[name];
  }
  function loadCss() {
    if (document.getElementById("fmCss")) return;
    var l = document.createElement("link"); l.id = "fmCss"; l.rel = "stylesheet"; l.href = BASE + "file-media.css"; document.head.appendChild(l);
  }
  var urls = [];
  function blobUrl(blob) { var u = URL.createObjectURL(blob); urls.push(u); return u; }
  function revokeAll() { urls.splice(0).forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) { /* already gone */ } }); }
  function download(blob, name) {
    var a = h("a", { href: blobUrl(blob), download: name, style: "display:none" });
    document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 0);
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext !== false) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    var ta = h("textarea", { "aria-hidden": "true", style: "position:fixed;left:-9999px;top:0" }); ta.value = text;
    document.body.appendChild(ta); ta.select(); var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove(); return ok;
  }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
  function tick() { return new Promise(function (r) { setTimeout(r, 0); }); }

  function dropzone(o) {
    var input = h("input", { type: "file", accept: o.accept || "", multiple: o.multiple ? true : null, tabindex: "-1", "aria-hidden": "true" });
    var box = h("div", { class: "fm-drop", role: "button", tabindex: "0", "aria-label": o.aria }, h("strong", { text: o.title }), h("small", { text: o.hint }), input);
    function pick() { input.click(); }
    box.addEventListener("click", function (e) { if (e.target !== input) pick(); });
    box.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
    input.addEventListener("change", function () { if (input.files && input.files.length) o.onFiles(Array.prototype.slice.call(input.files)); input.value = ""; });
    ["dragenter", "dragover"].forEach(function (n) { box.addEventListener(n, function (e) { e.preventDefault(); box.classList.add("over"); }); });
    ["dragleave", "dragend"].forEach(function (n) { box.addEventListener(n, function () { box.classList.remove("over"); }); });
    box.addEventListener("drop", function (e) {
      e.preventDefault(); box.classList.remove("over");
      var dt = e.dataTransfer; if (!dt) return;
      if (dt.files && dt.files.length) o.onFiles(Array.prototype.slice.call(dt.files));
      else if (o.onText) { var t = dt.getData("text/plain"); if (t) o.onText(t); }
    });
    return box;
  }
  function status(root) { return $(".fm-status", root); }
  function say(root, msg) { var s = status(root); if (s) s.textContent = msg; }
  function errorBox(msg) { return h("div", { class: "fm-error", role: "alert" }, msg); }

  /* =====================================================================================
     D. SVG Sanitizer & Optimizer
     ===================================================================================== */
  var SVG_EVIL = '<?xml version="1.0"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="120" height="120" viewBox="0 0 120 120" onload="alert(\'xss\')">\n  <!-- editor comment -->\n  <metadata><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/></metadata>\n  <script>alert(document.cookie)</script>\n  <defs><linearGradient id="g"><stop offset="0" stop-color="#6252f3"/><stop offset="1" stop-color="#e35ca9"/></linearGradient></defs>\n  <rect id="bg" x="10" y="10" width="100" height="100" rx="18" fill="url(#g)" onclick="alert(1)"/>\n  <circle id="bg" cx="60" cy="60" r="24" fill="#fff" style="fill:#fff;background:url(https://tracker.example/pixel.gif)"/>\n  <a xlink:href="javascript:alert(2)"><text x="30" y="68" font-size="16" fill="#101225">Hi</text></a>\n  <foreignObject width="50" height="50"><div xmlns="http://www.w3.org/1999/xhtml"><img src="x" onerror="alert(3)"/></div></foreignObject>\n  <animate attributeName="href" values="javascript:alert(4)"/>\n  <image href="https://tracker.example/pixel.png" width="1" height="1"/>\n</svg>';
  var SVG_CLEAN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">\n  <title>Sparkle</title>\n  <!-- exported from an editor -->\n  <defs><linearGradient id="grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#6252f3"/><stop offset="100%" stop-color="#8d5cf6"/></linearGradient></defs>\n  <rect x="2.000" y="2.000" width="60.000" height="60.000" rx="14.000" fill="url(#grad)"/>\n  <path d="M32.000 12.000 L36.000 28.000 L52.000 32.000 L36.000 36.000 L32.000 52.000 L28.000 36.000 L12.000 32.000 L28.000 28.000 Z" fill="#ffffff"/>\n</svg>';

  function mountSvg(root) {
    var S = window.GVTSvg, lastRun = 0, last = null;
    var input = h("textarea", { id: "svgInput", rows: "12", spellcheck: "false", "aria-describedby": "svgHelp", placeholder: "Paste SVG code here, or drop an .svg file above…" });
    var out = h("textarea", { id: "svgOutput", class: "fm-out", rows: "12", readonly: true, spellcheck: "false", "aria-label": "Sanitised and optimised SVG code" });
    var report = h("div", { id: "svgReport", "aria-live": "polite" });
    var previews = h("div", { class: "fm-previews", id: "svgPreviews", hidden: true });
    var sizes = h("div", { id: "svgSizes" });
    var drop = dropzone({
      title: "Drop an SVG file here, or press to choose one", hint: "You can also paste SVG code or an SVG file. Nothing is uploaded.", aria: "Choose an SVG file to sanitise", accept: ".svg,image/svg+xml,text/xml",
      onFiles: function (files) { readFile(files[0]); }, onText: function (t) { input.value = t; run(); }
    });
    function opt(id, label, checked) { var c = h("input", { type: "checkbox", id: id, checked: checked ? true : null }); c.addEventListener("change", run); return h("label", { for: id }, c, label); }
    var precision = h("select", { id: "svgPrecision" }, [1, 2, 3, 4, 5, 6].map(function (n) { return h("option", { value: String(n), selected: n === 3 ? true : null, text: n + (n === 1 ? " decimal place" : " decimal places") }); }));
    precision.addEventListener("change", run);
    var opts = h("div", { class: "fm-opts", role: "group", "aria-label": "Options" },
      opt("svgOptimize", "Optimise with SVGO", true), opt("svgKeepStyles", "Keep <style> and style attributes (sanitised)", true), opt("svgMinifyIds", "Shorten ids (references updated)", true),
      opt("svgPrefix", "Prefix ids (avoids clashes when inlined in a page)", false), opt("svgRemoveTitle", "Remove <title> and <desc> (hurts accessibility)", false),
      opt("svgExternalImages", "Allow https:// images (can leak visitors’ IPs)", false),
      h("div", { class: "fm-field" }, h("label", { for: "svgPrecision", text: "Number precision" }), precision));
    var copyBtn = h("button", { class: "btn", type: "button", id: "svgCopy", onclick: function () { if (!out.value) return; copyText(out.value).then(function (ok) { say(root, ok ? "Copied the SVG code." : "Copy failed. Select the code and copy it manually."); }); } }, "Copy SVG");
    var dlBtn = h("button", { class: "btn alt", type: "button", id: "svgDownload", onclick: function () { if (!out.value) return; download(new Blob([out.value], { type: "image/svg+xml" }), (last && last.name || "image") + ".min.svg"); } }, "Download .svg");
    root.appendChild(h("div", { class: "fm-grid" },
      h("div", { class: "fm-col" }, drop, h("div", { class: "field", style: "margin-top:12px" }, h("label", { for: "svgInput", text: "SVG code" }), input), opts,
        h("div", { class: "fm-bar" },
          h("button", { class: "btn", type: "button", id: "svgRun", onclick: run }, "Sanitise & optimise"),
          h("button", { class: "btn alt", type: "button", id: "svgExample", onclick: function () { input.value = SVG_EVIL; last = { name: "example" }; run(); } }, "Try an unsafe example"),
          h("button", { class: "btn alt", type: "button", id: "svgExample2", onclick: function () { input.value = SVG_CLEAN; last = { name: "example" }; run(); } }, "Try a clean example"),
          h("button", { class: "btn alt", type: "button", onclick: function () { input.value = ""; run(); input.focus(); } }, "Clear")),
        h("p", { class: "note", id: "svgHelp" }, "The SVG is parsed as strict XML and rebuilt from an allowlist of SVG elements and attributes. Scripts, event handlers, foreignObject, external references and unsafe CSS are never copied. Previews are drawn as images, which browsers sandbox: scripts and network requests cannot run inside them.")),
      h("div", { class: "fm-col" }, h("div", { class: "field" }, h("label", { for: "svgOutput", text: "Result" }), out), h("div", { class: "fm-bar" }, copyBtn, dlBtn), h("div", { class: "fm-status", role: "status", "aria-live": "polite" }), report, sizes, previews)));

    function readFile(file) {
      if (!file) return;
      if (file.size > S.MAX_BYTES) { render({ ok: false, error: "“" + file.name + "” is " + Math.round(file.size / 1048576) + " MB, over the " + (S.MAX_BYTES / 1048576) + " MB limit for in-browser sanitising." }); return; }
      file.text().then(function (t) { input.value = t; last = { name: file.name.replace(/\.svg$/i, "") }; run(); }, function () { render({ ok: false, error: "Could not read that file." }); });
    }
    function gz(text) {
      if (typeof CompressionStream === "undefined") return Promise.resolve(null);
      try {
        var cs = new CompressionStream("gzip"), w = cs.writable.getWriter(); w.write(new TextEncoder().encode(text)); w.close();
        return new Response(cs.readable).arrayBuffer().then(function (b) { return b.byteLength; });
      } catch (e) { return Promise.resolve(null); }
    }
    function run() {
      var id = ++lastRun, text = input.value;
      if (!text.trim()) { clearOut(); say(root, ""); return; }
      say(root, "Working…");
      S.process(text, {
        optimize: $("#svgOptimize", root).checked, keepStyles: $("#svgKeepStyles", root).checked, minifyIds: $("#svgMinifyIds", root).checked,
        prefixIds: $("#svgPrefix", root).checked, removeTitle: $("#svgRemoveTitle", root).checked, allowExternalImages: $("#svgExternalImages", root).checked,
        precision: parseInt(precision.value, 10)
      }).then(function (res) { if (id === lastRun) render(res, text); }, function (e) { if (id === lastRun) render({ ok: false, error: "Unexpected error: " + (e && e.message || e) }); });
    }
    function clearOut() { out.value = ""; report.textContent = ""; sizes.textContent = ""; previews.hidden = true; previews.textContent = ""; }
    function render(res, rawText) {
      clearOut();
      if (!res.ok) { report.appendChild(errorBox(res.error)); say(root, "Could not process this SVG."); return; }
      out.value = res.optimized;
      var group = {};
      res.removed.forEach(function (r) { var k = r.type + "|" + r.name + "|" + r.why; group[k] = group[k] || { r: r, n: 0 }; group[k].n++; });
      var items = Object.keys(group).map(function (k) { return group[k]; });
      var danger = items.filter(function (g) { return /script|event handler|dangerous|foreignObject|executable|external|animation|unsafe/i.test(g.r.why + g.r.name); });
      if (items.length) {
        report.appendChild(h("div", { class: danger.length ? "fm-warn" : "fm-ok" },
          h("strong", { text: danger.length ? "Removed " + items.length + " unsafe or unsupported item" + (items.length === 1 ? "" : "s") + ":" : "Removed editor data and comments (" + items.length + " item" + (items.length === 1 ? "" : "s") + "):" }),
          h("ul", { class: "fm-list" }, items.slice(0, 40).map(function (g) { return h("li", { text: (g.r.type === "element" ? "<" + g.r.name + ">" : g.r.name) + (g.n > 1 ? " ×" + g.n : "") + " — " + g.r.why }); }))));
      } else report.appendChild(h("div", { class: "fm-ok" }, "Nothing unsafe was found in this SVG."));
      res.warnings.forEach(function (w) { report.appendChild(h("div", { class: "fm-warn" }, w)); });
      report.appendChild(h("p", { class: "note", id: "svgVerified" }, res.verified ? "Safety check passed: the exported code was re-parsed and checked by a separate verifier (no scripts, event handlers, foreign content or external references)." : ""));
      var rows = [["Original", res.originalBytes], ["Sanitised", res.sanitizedBytes], ["Optimised" + (res.optimizerRan ? " (SVGO " + res.optimizerVersion + ")" : " (not optimised)"), res.optimizedBytes]];
      var tbl = h("table", { class: "fm-sizes" }, h("caption", { class: "sr-only", text: "Size comparison" }),
        h("thead", {}, h("tr", {}, h("th", { scope: "col", text: "Version" }), h("th", { scope: "col", class: "num", text: "Size" }), h("th", { scope: "col", class: "num", text: "vs original" }), h("th", { scope: "col", class: "num", text: "gzip (est.)" }))),
        h("tbody", {}, rows.map(function (r, i) {
          var pct = res.originalBytes ? Math.round((1 - r[1] / res.originalBytes) * 1000) / 10 : 0;
          return h("tr", {}, h("th", { scope: "row", text: r[0] }), h("td", { class: "num", text: r[1].toLocaleString("en-US") + " B" }),
            h("td", { class: "num", text: i === 0 ? "—" : (pct >= 0 ? pct + "% smaller" : Math.abs(pct) + "% larger") }), h("td", { class: "num", "data-gz": String(i), text: "…" }));
        })));
      sizes.appendChild(tbl);
      [res.original, res.sanitized, res.optimized].forEach(function (t, i) { gz(t).then(function (n) { var c = $('[data-gz="' + i + '"]', sizes); if (c) c.textContent = n == null ? "n/a" : n.toLocaleString("en-US") + " B"; }); });
      revokeAll();
      previews.hidden = false;
      previews.appendChild(h("figure", {}, h("figcaption", { text: "Original (inert image)" }), h("img", { src: blobUrl(new Blob([res.original], { type: "image/svg+xml" })), alt: "Preview of the original SVG, rendered as an inert image" })));
      previews.appendChild(h("figure", {}, h("figcaption", { text: "Sanitised & optimised" }), h("img", { src: blobUrl(new Blob([res.optimized], { type: "image/svg+xml" })), alt: "Preview of the sanitised and optimised SVG" })));
      say(root, "Done. " + res.optimizedBytes.toLocaleString("en-US") + " bytes (" + (res.originalBytes ? Math.round((1 - res.optimizedBytes / res.originalBytes) * 100) : 0) + "% smaller than the original).");
    }
    // paste support anywhere in the tool: SVG files or SVG text
    root.addEventListener("paste", function (e) {
      if (e.target === input) return;
      var cd = e.clipboardData; if (!cd) return;
      if (cd.files && cd.files.length) { e.preventDefault(); readFile(cd.files[0]); return; }
      var t = cd.getData("text/plain"); if (t) { e.preventDefault(); input.value = t; last = { name: "pasted" }; run(); }
    });
    input.addEventListener("input", debounce(function () { if (!last) last = { name: "pasted" }; run(); }, 350));
  }

  /* =====================================================================================
     G. Image Metadata & EXIF Stripper
     ===================================================================================== */
  function mountStripper(root) {
    var I = window.GVTImage, items = [], seq = 0, busy = false;
    var list = h("div", { id: "stripList" });
    var fmt = h("select", { id: "stripFormat" }, h("option", { value: "image/jpeg", text: "JPEG (smaller, photos)" }), h("option", { value: "image/png", text: "PNG (lossless, keeps transparency)" }));
    var quality = h("input", { type: "range", id: "stripQuality", min: "50", max: "100", value: "92", "aria-describedby": "stripQv" });
    var qv = h("output", { id: "stripQv", for: "stripQuality", text: "92" });
    var zipBtn = h("button", { class: "btn", type: "button", id: "stripZip", hidden: true, onclick: zipAll }, "Download all as ZIP");
    var clearBtn = h("button", { class: "btn alt", type: "button", id: "stripClear", hidden: true, onclick: clearAll }, "Clear all");
    var again = debounce(reprocess, 250);
    fmt.addEventListener("change", function () { quality.disabled = fmt.value === "image/png"; again(); });
    quality.addEventListener("input", function () { qv.textContent = quality.value; again(); });
    var drop = dropzone({ title: "Drop photos here, or press to choose", hint: "JPEG, PNG, WebP, GIF, AVIF, BMP — whatever this browser can open. Files stay on your device.", aria: "Choose images to strip metadata from", accept: "image/*", multiple: true, onFiles: addFiles });
    root.appendChild(h("div", {},
      drop,
      h("div", { class: "fm-opts", role: "group", "aria-label": "Output options" },
        h("div", { class: "fm-field" }, h("label", { for: "stripFormat", text: "Export as" }), fmt),
        h("div", { class: "fm-field" }, h("label", { for: "stripQuality" }, "JPEG quality: ", qv), quality)),
      h("div", { class: "fm-bar" }, zipBtn, clearBtn),
      h("div", { class: "fm-status", role: "status", "aria-live": "polite" }),
      list,
      h("details", { open: true }, h("summary", { text: "What this does and does not remove" }),
        h("ul", { class: "fm-list" },
          h("li", { text: "Each image is decoded by your browser and redrawn onto a blank canvas, then saved as a brand-new JPEG or PNG. Only pixels are carried over, so EXIF (camera, date, GPS location), IPTC, XMP, comments and text chunks are not written to the new file." }),
          h("li", { text: "After exporting, the tool reads the new file’s structure again and lists any metadata segments it can find. “None found” means none of the known metadata containers are present; it is evidence for that file, not a guarantee for every format or every future browser." }),
          h("li", { text: "Orientation is applied to the pixels, so photos stay upright without an orientation tag. The original colour profile is dropped and some browsers add their own standard sRGB profile to the new file (shown in the result); colours of wide-gamut photos can shift slightly." }),
          h("li", { text: "Anything visible in the picture (faces, street signs, screens, watermarks) is untouched. JPEG export re-compresses the image, so it is not bit-identical; use PNG for a lossless copy." }),
          h("li", { text: "Animated images keep only their first frame. SVG files are text, not photos: use the SVG Sanitizer & Optimizer. HEIC/HEIF and TIFF open only in browsers that can decode them." }))),
      h("p", { class: "note", text: "Nothing is uploaded. Files are read, converted and downloaded entirely in this browser tab." })));

    function addFiles(files) {
      files.forEach(function (f) { items.push({ id: ++seq, file: f, state: "queued" }); });
      renderAll(); pump();
    }
    function pump() {
      if (busy) return;
      var next = items.filter(function (i) { return i.state === "queued"; })[0];
      if (!next) { say(root, items.length ? "Done. " + items.filter(function (i) { return i.state === "done"; }).length + " of " + items.length + " processed." : ""); return; }
      busy = true; next.state = "working"; renderItem(next); say(root, "Processing " + next.file.name + "…");
      processItem(next).then(function () { next.state = next.error ? "error" : "done"; }, function (e) { next.state = "error"; next.error = e && e.message || String(e); })
        .then(function () { busy = false; renderItem(next); renderBar(); return tick(); }).then(pump);
    }
    function processItem(it) {
      var file = it.file, mime = fmt.value;
      return I.readBytes(file).then(function (bytes) {
        it.before = I.scanMetadata(bytes); it.beforeBytes = bytes.length; it.error = null; it.notes = [];
        if (it.before.format === "svg") throw new Error("SVG files are text, not photos. Use the SVG Sanitizer & Optimizer tool for SVG.");
        if (it.before.animated) it.notes.push("Animated image: only the first frame is exported.");
        if (it.before.format === "unknown" && !/^image\//.test(file.type)) throw new Error("This does not look like an image file.");
        return I.decodeImage(file);
      }).then(function (dec) {
        it.width = dec.width; it.height = dec.height;
        var alpha = /png|gif|webp|avif/.test(it.before.format);
        if (mime === "image/jpeg" && alpha) it.notes.push("Transparent areas were filled with white because JPEG has no transparency. Choose PNG to keep it.");
        return I.renderEncode(dec, mime, { quality: parseInt(quality.value, 10) / 100, flatten: mime === "image/jpeg" }).then(function (r) { dec.close(); return r; }, function (e) { dec.close(); throw e; });
      }).then(function (r) {
        if (r.blob.type !== mime) throw new Error("This browser could not export " + (mime === "image/png" ? "PNG" : "JPEG") + " (it produced " + (r.blob.type || "an unknown format") + ").");
        it.out = r.blob; it.outWidth = r.width; it.outHeight = r.height;
        return I.readBytes(r.blob);
      }).then(function (ob) {
        it.after = I.scanMetadata(ob); it.afterBytes = ob.length; it.outName = I.outputName(file.name, mime, "-clean");
        it.beforeUrl = blobUrl(file); it.afterUrl = blobUrl(it.out);
      });
    }
    function reprocess() { items.forEach(function (i) { if (i.state === "done" || i.state === "error") { i.state = "queued"; } }); renderAll(); pump(); }
    function badge(text, cls) { return h("span", { class: "fm-badge " + (cls || ""), text: text }); }
    function renderItem(it) {
      var old = $('[data-item="' + it.id + '"]', list), card = h("article", { class: "fm-item", "data-item": String(it.id), "data-state": it.state, "aria-label": it.file.name });
      card.appendChild(h("h3", { text: it.file.name }));
      if (it.state === "queued" || it.state === "working") card.appendChild(h("p", { class: "fm-meta", text: it.state === "queued" ? "Waiting…" : "Processing…" }));
      else if (it.state === "error") {
        card.appendChild(errorBox(it.error));
        card.appendChild(h("button", { class: "btn alt", type: "button", onclick: function () { remove(it); } }, "Remove"));
      } else {
        var b = it.before, a = it.after;
        card.setAttribute("data-meta-before", b.found.map(function (f) { return f.kind; }).join(",") || "none");
        var leftover = I.personalFindings(a), icc = I.iccOf(a);
        card.setAttribute("data-meta-after", leftover.map(function (f) { return f.kind; }).concat(a.signatures.length ? ["signature"] : []).join(",") || "none");
        if (icc) card.setAttribute("data-icc-after", icc.description || "unnamed");
        card.setAttribute("data-out-bytes", String(it.afterBytes));
        card.appendChild(h("p", { class: "fm-meta" }, I.formatBytes(it.beforeBytes) + " → " + I.formatBytes(it.afterBytes) + " · " + it.width + "×" + it.height + (it.outWidth !== it.width ? " → " + it.outWidth + "×" + it.outHeight : "") + " · " + b.format.toUpperCase() + " → " + (it.out.type === "image/png" ? "PNG" : "JPEG")));
        var found = h("div", { "aria-label": "Metadata found in the original" }, h("strong", { text: "Found in original: " }));
        if (b.unscanned) found.appendChild(badge("metadata scan not available for " + b.format.toUpperCase(), "warn"));
        else if (!b.found.length) found.appendChild(badge("no EXIF / IPTC / XMP found", "good"));
        b.found.forEach(function (f) { found.appendChild(badge(f.kind + (f.detail ? ": " + f.detail : ""), /GPS|IPTC|XMP/.test(f.kind + f.detail) ? "bad" : "warn")); });
        if (b.orientation && b.orientation !== 1) found.appendChild(badge("rotation tag " + b.orientation + " applied to the pixels", ""));
        card.appendChild(found);
        var clean = !leftover.length && !a.signatures.length;
        card.appendChild(h("div", { class: clean ? "fm-ok" : "fm-warn", role: "status" },
          clean ? "Checked the exported file: no EXIF, IPTC, XMP, comment or text segments found." + (icc ? " Your browser added its own standard colour profile (" + (icc.description ? "“" + icc.description + "”, " : "") + icc.detail.replace(/^.*\(/, "").replace(/\)$/, "") + "), which holds no personal data." : "") :
            "The exported file still contains: " + leftover.map(function (f) { return f.kind; }).concat(a.signatures).join(", ") + ". Try PNG, or check the file with another tool."));
        it.notes.forEach(function (n) { card.appendChild(h("div", { class: "fm-warn" }, n)); });
        card.appendChild(h("div", { class: "fm-previews" },
          h("figure", {}, h("figcaption", { text: "Before" }), h("img", { src: it.beforeUrl, alt: "Original image " + it.file.name, loading: "lazy", decoding: "async" })),
          h("figure", {}, h("figcaption", { text: "After (metadata-free)" }), h("img", { src: it.afterUrl, alt: "Cleaned image " + it.outName, loading: "lazy", decoding: "async" }))));
        card.appendChild(h("div", { class: "fm-bar" },
          h("button", { class: "btn", type: "button", "data-dl": String(it.id), onclick: function () { download(it.out, it.outName); } }, "Download " + it.outName),
          h("button", { class: "btn alt", type: "button", onclick: function () { remove(it); } }, "Remove")));
      }
      if (old) old.replaceWith(card); else list.appendChild(card);
    }
    function renderAll() { list.textContent = ""; items.forEach(renderItem); renderBar(); }
    function renderBar() { var done = items.filter(function (i) { return i.state === "done"; }).length; zipBtn.hidden = done < 2; clearBtn.hidden = !items.length; }
    function remove(it) { items = items.filter(function (i) { return i !== it; }); var n = $('[data-item="' + it.id + '"]', list); if (n) n.remove(); renderBar(); say(root, "Removed " + it.file.name + "."); }
    function clearAll() { items = []; list.textContent = ""; revokeAll(); renderBar(); say(root, "Cleared."); }
    function zipAll() {
      var done = items.filter(function (i) { return i.state === "done"; });
      Promise.all(done.map(function (i) { return I.readBytes(i.out).then(function (d) { return { name: i.outName, data: d }; }); })).then(function (files) {
        download(new Blob([I.buildZip(files)], { type: "application/zip" }), "metadata-free-images.zip"); say(root, "ZIP ready with " + files.length + " files.");
      }).catch(function (e) { list.insertBefore(errorBox("Could not build the ZIP: " + (e && e.message || e) + " Download the images one at a time instead."), list.firstChild); });
    }
  }

  /* =====================================================================================
     H. WebP / AVIF Batch Image Compressor
     ===================================================================================== */
  function mountCompressor(root) {
    var I = window.GVTImage, items = [], seq = 0, running = false, cancelled = false, caps = null;
    var list = h("div", { id: "cmpList" }), summary = h("div", { id: "cmpSummary", "aria-live": "polite" }), progress = h("div", { class: "fm-progress", hidden: true }, h("span", {}));
    var capsBox = h("p", { class: "fm-cap", id: "cmpCaps", role: "status" }, "Checking which formats this browser can encode…");
    var fmt = h("select", { id: "cmpFormat" });
    var quality = h("input", { type: "range", id: "cmpQuality", min: "1", max: "100", value: "80", "aria-describedby": "cmpQv" });
    var qv = h("output", { id: "cmpQv", for: "cmpQuality", text: "80" });
    quality.addEventListener("input", function () { qv.textContent = quality.value; });
    var resize = h("input", { type: "checkbox", id: "cmpResize" }), mw = h("input", { type: "number", id: "cmpMaxW", min: "1", max: "20000", placeholder: "e.g. 1600", disabled: true, "aria-label": "Maximum width in pixels" }), mh = h("input", { type: "number", id: "cmpMaxH", min: "1", max: "20000", placeholder: "e.g. 1200", disabled: true, "aria-label": "Maximum height in pixels" });
    resize.addEventListener("change", function () { mw.disabled = mh.disabled = !resize.checked; if (resize.checked) mw.focus(); });
    var skip = h("input", { type: "checkbox", id: "cmpSkip", checked: true });
    var go = h("button", { class: "btn", type: "button", id: "cmpGo", onclick: start }, "Compress");
    var stop = h("button", { class: "btn alt", type: "button", id: "cmpStop", hidden: true, onclick: function () { cancelled = true; say(root, "Stopping after the current image…"); } }, "Stop");
    var zipBtn = h("button", { class: "btn", type: "button", id: "cmpZip", hidden: true, onclick: zipAll }, "Download all as ZIP");
    var clearBtn = h("button", { class: "btn alt", type: "button", id: "cmpClear", hidden: true, onclick: function () { if (running) return; items = []; list.textContent = ""; summary.textContent = ""; revokeAll(); sync(); say(root, "Cleared."); } }, "Clear all");
    var drop = dropzone({ title: "Drop images here, or press to choose", hint: "Add as many as you like. Files are processed one at a time on this device.", aria: "Choose images to compress", accept: "image/*", multiple: true, onFiles: addFiles });
    root.appendChild(h("div", {}, drop, capsBox,
      h("div", { class: "fm-opts", role: "group", "aria-label": "Compression options" },
        h("div", { class: "fm-field" }, h("label", { for: "cmpFormat", text: "Output format" }), fmt),
        h("div", { class: "fm-field" }, h("label", { for: "cmpQuality" }, "Quality: ", qv, "%"), quality),
        h("label", { for: "cmpResize" }, resize, "Limit dimensions"),
        h("div", { class: "fm-field" }, h("label", { for: "cmpMaxW", text: "Max width (px)" }), mw),
        h("div", { class: "fm-field" }, h("label", { for: "cmpMaxH", text: "Max height (px)" }), mh),
        h("label", { for: "cmpSkip" }, skip, "Keep the original if the result is larger")),
      h("div", { class: "fm-bar" }, go, stop, zipBtn, clearBtn),
      progress, h("div", { class: "fm-status", role: "status", "aria-live": "polite" }), summary, list,
      h("p", { class: "note", text: "Quality applies to WebP, AVIF and JPEG; PNG is always lossless. Images are never enlarged. Metadata (EXIF, location, XMP) is not carried into the compressed files. Everything runs in this browser tab, so there is no server upload limit; very large images are limited only by your device’s memory." })));

    I.detectEncoders().then(function (c) {
      caps = c;
      var names = [["image/avif", "AVIF"], ["image/webp", "WebP"], ["image/jpeg", "JPEG"], ["image/png", "PNG"]];
      capsBox.textContent = "This browser can encode: " + names.filter(function (n) { return c[n[0]]; }).map(function (n) { return n[1]; }).join(", ") +
        (c.avifNative ? " (AVIF natively)." : c.avifWasm ? ". AVIF uses a built-in encoder in a background worker: slower, and downloaded once (about 3.5 MB) then cached for offline use." : ". AVIF encoding is not available here" + (c["image/webp"] ? ", so AVIF requests fall back to WebP." : ", and WebP is not available either, so JPEG is used."));
      capsBox.setAttribute("data-caps", names.filter(function (n) { return c[n[0]]; }).map(function (n) { return n[1]; }).join(","));
      [["best", "Best available (AVIF → WebP → JPEG)"], ["image/webp", "WebP"], ["image/avif", "AVIF"], ["image/jpeg", "JPEG"], ["image/png", "PNG (lossless)"]].forEach(function (o) {
        var supported = o[0] === "best" || c[o[0]];
        fmt.appendChild(h("option", { value: o[0], text: o[1] + (supported ? (o[0] === "image/avif" && c.avifWasm && !c.avifNative ? " (built-in encoder, slower)" : "") : " — not supported here, will fall back") }));
      });
      fmt.value = "best";
    });

    function chain(choice) {
      return choice === "best" || choice === "image/avif" ? ["image/avif", "image/webp", "image/jpeg"] : choice === "image/webp" ? ["image/webp", "image/jpeg"] : [choice];
    }
    function pick(choice) {
      var order = chain(choice), got = order.filter(function (m) { return caps[m] || m === "image/png"; })[0] || "image/jpeg", note = "";
      var asked = choice === "best" ? null : choice;
      if (asked && got !== asked) note = (asked === "image/avif" ? "AVIF" : "WebP") + " is not supported by this browser, so " + (got === "image/webp" ? "WebP" : "JPEG") + " was used instead.";
      return { mime: got, note: note };
    }
    function addFiles(files) {
      files.forEach(function (f) { items.push({ id: ++seq, file: f, state: "queued" }); });
      renderAll(); sync(); say(root, files.length + " file" + (files.length === 1 ? "" : "s") + " added. Press Compress to start.");
    }
    function sync() {
      var done = items.filter(function (i) { return i.state === "done"; }).length;
      zipBtn.hidden = done < 2; clearBtn.hidden = !items.length; go.disabled = running || !items.length; stop.hidden = !running;
    }
    function start() {
      if (running || !caps) return;
      items.forEach(function (i) { if (i.state !== "working") i.state = "queued"; });
      running = true; cancelled = false; progress.hidden = false; sync(); renderAll();
      var todo = items.filter(function (i) { return i.state === "queued"; }), n = 0;
      (function next() {
        var it = todo.shift();
        if (!document.body.contains(root)) cancelled = true; // the tool was closed or replaced
        if (!it || cancelled) { running = false; progress.hidden = true; sync(); finish(cancelled); return; }
        it.state = "working"; renderItem(it); say(root, "Compressing " + it.file.name + " (" + (++n) + " of " + (n + todo.length) + ")…");
        progress.firstChild.style.width = Math.round((n - 1) / (n + todo.length) * 100) + "%";
        one(it).then(function () { it.state = "done"; }, function (e) { it.state = "error"; it.error = e && e.message || String(e); }).then(function () { renderItem(it); sync(); return tick(); }).then(next);
      })();
    }
    function one(it) {
      var file = it.file, choice = fmt.value, sel = pick(choice), q = parseInt(quality.value, 10) / 100;
      it.notes = sel.note ? [sel.note] : [];
      return I.readBytes(file).then(function (bytes) {
        var fm = I.sniffFormat(bytes);
        if (fm === "svg") throw new Error("SVG is already a vector format. Use the SVG Sanitizer & Optimizer instead.");
        it.sourceFormat = fm; it.originalBytes = bytes.length;
        if (I.scanMetadata(bytes).animated) it.notes.push("Animated image: only the first frame is compressed.");
        if (file.size > 150 * 1048576) it.notes.push("Very large file (" + I.formatBytes(file.size) + "): this can be slow or fail on low-memory devices.");
        return I.decodeImage(file);
      }).then(function (dec) {
        it.width = dec.width; it.height = dec.height;
        function attempt(mime) {
          var flatten = mime === "image/jpeg" && /png|gif|webp|avif/.test(it.sourceFormat);
          var o = { quality: q, flatten: flatten, avifWasm: !!(caps && caps.avifWasm) };
          if (resize.checked) { var w = parseInt(mw.value, 10), hh = parseInt(mh.value, 10); if (w > 0) o.maxWidth = w; if (hh > 0) o.maxHeight = hh; }
          return I.renderEncode(dec, mime, o).then(function (r) { if (flatten) it.notes.push("Transparent areas were filled with white because JPEG has no transparency."); return r; });
        }
        return attempt(sel.mime).catch(function (err) {
          if (sel.mime !== "image/avif") throw err;
          sel.mime = caps["image/webp"] ? "image/webp" : "image/jpeg";
          it.notes.push("AVIF encoding failed (" + (err && err.message || err) + "), so " + (sel.mime === "image/webp" ? "WebP" : "JPEG") + " was used instead.");
          return attempt(sel.mime);
        }).then(function (r) { dec.close(); return r; }, function (e) { dec.close(); throw e; });
      }).then(function (r) {
        if (r.blob.type !== sel.mime) throw new Error("The browser did not produce " + sel.mime.replace("image/", "").toUpperCase() + " (it returned " + (r.blob.type || "unknown") + ").");
        it.outWidth = r.width; it.outHeight = r.height;
        if (skip.checked && r.blob.size >= file.size) { it.kept = true; it.out = file; it.outMime = file.type || "image/" + it.sourceFormat; it.outName = file.name; it.notes.push("The compressed version was not smaller, so the original file is kept unchanged (it still contains its metadata)."); }
        else { it.kept = false; it.out = r.blob; it.outMime = sel.mime; it.outName = I.outputName(file.name, sel.mime, ""); }
        it.outBytes = it.out.size;
      });
    }
    function renderItem(it) {
      var old = $('[data-item="' + it.id + '"]', list), card = h("article", { class: "fm-item", "data-item": String(it.id), "data-state": it.state, "aria-label": it.file.name });
      card.appendChild(h("h3", { text: it.file.name }));
      if (it.state === "queued") card.appendChild(h("p", { class: "fm-meta", text: "Ready — " + I.formatBytes(it.file.size) }));
      else if (it.state === "working") card.appendChild(h("p", { class: "fm-meta", text: "Compressing…" }));
      else if (it.state === "error") card.appendChild(errorBox(it.error));
      else {
        var pct = I.percentSaved(it.originalBytes, it.outBytes);
        card.setAttribute("data-original-bytes", String(it.originalBytes)); card.setAttribute("data-output-bytes", String(it.outBytes)); card.setAttribute("data-output-type", it.outMime); card.setAttribute("data-kept", it.kept ? "1" : "0");
        card.appendChild(h("p", { class: "fm-meta" }, I.formatBytes(it.originalBytes) + " → " + I.formatBytes(it.outBytes) + " · " + (it.kept ? "original kept" : it.outMime.replace("image/", "").toUpperCase()) + " · " + it.outWidth + "×" + it.outHeight));
        card.appendChild(h("span", { class: "fm-badge " + (pct > 0 ? "good" : pct < 0 ? "bad" : "warn"), text: I.savingsLabel(it.originalBytes, it.outBytes) }));
        it.notes.forEach(function (nn) { card.appendChild(h("div", { class: "fm-warn" }, nn)); });
        card.appendChild(h("div", { class: "fm-bar" }, h("button", { class: "btn alt", type: "button", "data-dl": String(it.id), onclick: function () { download(it.out, it.outName); } }, "Download " + it.outName)));
      }
      if (old) old.replaceWith(card); else list.appendChild(card);
    }
    function renderAll() { list.textContent = ""; items.forEach(renderItem); }
    function finish(wasCancelled) {
      I.stopAvifWorker();
      var done = items.filter(function (i) { return i.state === "done"; }), failed = items.filter(function (i) { return i.state === "error"; });
      var o = done.reduce(function (s, i) { return s + i.originalBytes; }, 0), p = done.reduce(function (s, i) { return s + i.outBytes; }, 0);
      summary.textContent = "";
      if (done.length) summary.appendChild(h("div", { class: "fm-ok", id: "cmpTotal" }, (wasCancelled ? "Stopped. " : "") + done.length + " file" + (done.length === 1 ? "" : "s") + ": " + I.formatBytes(o) + " → " + I.formatBytes(p) + " (" + I.savingsLabel(o, p) + (failed.length ? "; " + failed.length + " failed" : "") + ")."));
      else if (failed.length) summary.appendChild(errorBox("No file could be compressed. See the messages below."));
      say(root, wasCancelled ? "Stopped." : "Finished.");
    }
    function zipAll() {
      var done = items.filter(function (i) { return i.state === "done"; });
      Promise.all(done.map(function (i) { return I.readBytes(i.out).then(function (d) { return { name: i.outName, data: d }; }); })).then(function (files) {
        download(new Blob([I.buildZip(files)], { type: "application/zip" }), "compressed-images.zip"); say(root, "ZIP ready with " + files.length + " files.");
      }).catch(function (e) { summary.insertBefore(errorBox("Could not build one ZIP (" + (e && e.message || e) + "). Download the files individually or compress fewer at a time."), summary.firstChild); });
    }
  }

  /* =====================================================================================
     I. Markdown Table <-> CSV / Google Sheets Converter
     ===================================================================================== */
  var TBL_CSV = 'Product,Notes,Price\n"Widget, large","Says ""hello""",12.50\n"Gadget","Two lines:\nsecond line",8\nGizmo,,0.99\n';
  var TBL_MD = '| Item | Qty | Price |\n| :--- | :---: | ---: |\n| Apples | 3 | 1.20 |\n| Pears \\| ripe | 10 | 0.80 |\n| Plums<br>(sweet) | 2 | 2.00 |\n';
  function mountTable(root) {
    var T = window.GVTTable, lastResult = null;
    var input = h("textarea", { id: "tblInput", rows: "12", spellcheck: "false", placeholder: "Paste a Markdown table, CSV, or cells copied from Google Sheets / Excel…" });
    var out = h("textarea", { id: "tblOutput", class: "fm-out", rows: "12", readonly: true, spellcheck: "false", "aria-label": "Converted table" });
    var preview = h("div", { id: "tblPreview" }), warn = h("div", { id: "tblWarn", "aria-live": "polite" });
    function sel(id, label, options, value) { var s = h("select", { id: id }, options.map(function (o) { return h("option", { value: o[0], text: o[1], selected: o[0] === value ? true : null }); })); s.addEventListener("change", run); return h("div", { class: "fm-field" }, h("label", { for: id, text: label }), s); }
    function chk(id, label, checked) { var c = h("input", { type: "checkbox", id: id, checked: checked ? true : null }); c.addEventListener("change", run); return h("label", { for: id }, c, label); }
    var from = sel("tblFrom", "Input format", [["auto", "Auto-detect"], ["markdown", "Markdown table"], ["csv", "CSV (comma)"], ["tsv", "Tab-delimited (Sheets / Excel)"], ["semicolon", "CSV (semicolon)"], ["pipe", "Pipe-delimited"]], "auto");
    var to = sel("tblTo", "Convert to", [["markdown", "Markdown table"], ["csv", "CSV (comma)"], ["tsv", "Tab-delimited (paste into Sheets / Excel)"], ["semicolon", "CSV (semicolon)"]], "markdown");
    var align = sel("tblAlign", "Markdown alignment", [["none", "None"], ["keep", "Keep from Markdown input"], ["auto", "Numbers right-aligned"], ["left", "All left"], ["center", "All centre"], ["right", "All right"]], "keep");
    var opts = h("div", { class: "fm-opts", role: "group", "aria-label": "Conversion options" }, from, to, align,
      chk("tblHeader", "First row is the header", true), chk("tblPad", "Align columns in Markdown output", true), chk("tblProtect", "Protect against spreadsheet formulas (adds ’ before = + - @)", false), chk("tblBom", "Add UTF-8 BOM to downloads (helps Excel with accents)", false));
    function setText(t) { input.value = t; run(); }
    function paste() {
      if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(setText, function () { say(root, "The browser blocked clipboard access. Press Ctrl+V (⌘V) inside the box instead."); input.focus(); });
      else { say(root, "Press Ctrl+V (⌘V) inside the box to paste."); input.focus(); }
    }
    var tsvCopy = h("button", { class: "btn", type: "button", id: "tblCopySheets", onclick: function () { if (!lastResult || !lastResult.ok) return; var t = T.toDelimited(lastResult.rows, "\t", { protectFormulas: $("#tblProtect", root).checked }).text; copyText(t).then(function (ok) { say(root, ok ? "Copied for Google Sheets / Excel. Click a cell and paste." : "Copy failed. Choose “Tab-delimited” and copy the result manually."); }); } }, "Copy for Sheets / Excel");
    root.appendChild(h("div", {},
      h("div", { class: "fm-grid" },
        h("div", { class: "fm-col" }, h("div", { class: "field" }, h("label", { for: "tblInput", text: "Input" }), input),
          h("div", { class: "fm-bar" },
            h("button", { class: "btn alt", type: "button", id: "tblPaste", onclick: paste }, "Paste from clipboard"),
            h("button", { class: "btn alt", type: "button", id: "tblExCsv", onclick: function () { from.querySelector("select").value = "auto"; to.querySelector("select").value = "markdown"; setText(TBL_CSV); } }, "Example: CSV"),
            h("button", { class: "btn alt", type: "button", id: "tblExMd", onclick: function () { from.querySelector("select").value = "auto"; to.querySelector("select").value = "csv"; setText(TBL_MD); } }, "Example: Markdown"),
            h("button", { class: "btn alt", type: "button", id: "tblSwap", onclick: function () { if (!lastResult || !lastResult.ok) return; var f = from.querySelector("select"), t = to.querySelector("select"), tv = t.value; input.value = out.value; f.value = tv; t.value = tv === "markdown" ? "csv" : "markdown"; run(); } }, "Use result as input"),
            h("button", { class: "btn alt", type: "button", onclick: function () { input.value = ""; run(); input.focus(); } }, "Clear"))),
        h("div", { class: "fm-col" }, h("div", { class: "field" }, h("label", { for: "tblOutput", text: "Result" }), out),
          h("div", { class: "fm-bar" }, h("button", { class: "btn", type: "button", id: "tblCopy", onclick: function () { if (out.value) copyText(out.value).then(function (ok) { say(root, ok ? "Copied." : "Copy failed. Select the text and copy it manually."); }); } }, "Copy result"), tsvCopy,
            h("button", { class: "btn alt", type: "button", id: "tblDownload", onclick: dl }, "Download")))),
      opts, h("div", { class: "fm-status", role: "status", "aria-live": "polite" }), warn, preview,
      h("details", {}, h("summary", { text: "Markdown table limitations and how data is handled" }),
        h("ul", { class: "fm-list" },
          h("li", { text: "A Markdown table cell is a single line. Line breaks inside a cell are written as <br> (GitHub and GitLab render them as line breaks) and turned back into real line breaks when you convert Markdown to CSV." }),
          h("li", { text: "A literal | inside a cell is written as \\| . Leading and trailing spaces in cells are not preserved by Markdown." }),
          h("li", { text: "Alignment (:---, :---:, ---:) exists only in Markdown. It is read from Markdown input and can be re-applied to Markdown output, but CSV has no alignment." }),
          h("li", { text: "Markdown has no types: numbers, dates and leading zeros stay as text. Spreadsheets may reinterpret them on paste (for example 00123 becoming 123); format the destination columns as text first if that matters." }),
          h("li", { text: "CSV fields containing commas, quotes or line breaks are wrapped in quotes with quotes doubled (RFC 4180). Tab-delimited output is what Google Sheets and Excel expect from the clipboard." }),
          h("li", { text: "Cells beginning with = + - or @ can run as formulas in spreadsheets. Tick “Protect against spreadsheet formulas” for untrusted data." }),
          h("li", { text: "Rows with more cells than the header widen the table so no data is lost. Short rows are padded. If several tables are pasted, the first is converted." }),
          h("li", { text: "Limit: about 5 MB of text per conversion. Everything happens in this tab; nothing is uploaded." })))));

    function value(id) { return $("#" + id, root).value; }
    function run() {
      var text = input.value;
      warn.textContent = ""; preview.textContent = ""; out.value = ""; lastResult = null;
      if (!text.trim()) { say(root, ""); return; }
      var r = T.convert(text, { from: value("tblFrom"), to: value("tblTo"), align: value("tblAlign"), firstRowHeader: $("#tblHeader", root).checked, pad: $("#tblPad", root).checked, protectFormulas: $("#tblProtect", root).checked });
      lastResult = r;
      if (!r.ok) { warn.appendChild(errorBox(r.error)); say(root, "Could not convert."); return; }
      out.value = r.text;
      r.warnings.forEach(function (w) { warn.appendChild(h("div", { class: "fm-warn" }, w)); });
      var show = r.rows.slice(0, 100), header = $("#tblHeader", root).checked, aligns = [];
      if (value("tblTo") === "markdown" || r.detected === "markdown") { var p = r.detected === "markdown" ? T.parseMarkdownTable(text) : null; aligns = p && p.align || []; }
      if (value("tblAlign") !== "keep" && value("tblAlign") !== "none" && ["left", "center", "right"].indexOf(value("tblAlign")) > -1) aligns = r.rows[0].map(function () { return value("tblAlign"); });
      var width = r.colCount;
      var tbl = h("table", {}, h("caption", { class: "sr-only", text: "Preview of the converted table" }));
      if (header) tbl.appendChild(h("thead", {}, h("tr", {}, show[0].concat(Array(Math.max(0, width - show[0].length)).fill("")).map(function (c, i) { return h("th", { scope: "col", style: aligns[i] && aligns[i] !== "none" ? "text-align:" + aligns[i] : null, text: c }); }))));
      tbl.appendChild(h("tbody", {}, show.slice(header ? 1 : 0).map(function (row) { return h("tr", {}, row.concat(Array(Math.max(0, width - row.length)).fill("")).map(function (c, i) { return h("td", { style: aligns[i] && aligns[i] !== "none" ? "text-align:" + aligns[i] : null, text: c }); })); })));
      preview.appendChild(h("p", { class: "note", id: "tblSummary" }, r.rowCount + " row" + (r.rowCount === 1 ? "" : "s") + " × " + r.colCount + " column" + (r.colCount === 1 ? "" : "s") + " · input read as " + ({ markdown: "Markdown table", csv: "CSV", tsv: "tab-delimited", semicolon: "semicolon CSV", pipe: "pipe-delimited" }[r.detected] || r.detected) + (r.rowCount > 100 ? " · preview shows the first 100 rows" : "")));
      preview.appendChild(h("div", { class: "fm-table-wrap", tabindex: "0", role: "region", "aria-label": "Table preview" }, tbl));
      say(root, "Converted " + r.rowCount + " rows.");
    }
    function dl() {
      if (!lastResult || !lastResult.ok) return;
      var t = value("tblTo"), ext = t === "markdown" ? "md" : t === "tsv" ? "tsv" : "csv", mime = t === "markdown" ? "text/markdown" : t === "tsv" ? "text/tab-separated-values" : "text/csv";
      download(new Blob([($("#tblBom", root).checked && t !== "markdown" ? "﻿" : "") + out.value + "\n"], { type: mime + ";charset=utf-8" }), "table." + ext);
    }
    input.addEventListener("input", debounce(run, 200));
  }

  /* ---------- open / mount ---------- */
  var MOUNT = {
    "svg-sanitizer": { scripts: ["fm-svg.js"], mount: mountSvg },
    "image-metadata-stripper": { scripts: ["fm-image.js"], mount: mountStripper },
    "image-batch-compressor": { scripts: ["fm-image.js"], mount: mountCompressor },
    "table-converter": { scripts: ["fm-table.js"], mount: mountTable }
  };
  function shellHtml(t) {
    return '<div class="workspace-head"><div><span class="tag">' + esc(t[1]) + '</span><span class="tag new-tag">NEW</span><h2>' + esc(t[2]) + '</h2><p class="desc">' + esc(t[3]) +
      '</p></div><button class="btn alt no-print" type="button" onclick="closeTool()">Close</button></div>';
  }
  openTool = function (id) {
    if (!ids[id]) return previousOpen(id);
    if (typeof rememberTool === "function") rememberTool(id);
    var t = ids[id], w = document.getElementById("workspace"), spec = MOUNT[id];
    revokeAll();
    w.innerHTML = shellHtml(t) + '<div class="fm-tool" id="fmRoot" data-tool="' + esc(id) + '"><p class="fm-status" role="status">Loading…</p></div>';
    w.classList.add("active");
    var root = document.getElementById("fmRoot");
    loadCss();
    Promise.all(spec.scripts.map(loadScript)).then(function () {
      if (document.getElementById("fmRoot") !== root) return; // user opened something else meanwhile
      root.textContent = "";
      root.appendChild(h("div", { class: "fm-status", role: "status", "aria-live": "polite" }));
      spec.mount(root);
      root.setAttribute("data-ready", "1");
    }).catch(function (e) {
      root.textContent = "";
      root.appendChild(errorBox("This tool could not load (" + (e && e.message || e) + "). Check your connection once, then reload; after that it works offline."));
    });
    w.focus({ preventScroll: true });
    w.scrollIntoView({ behavior: window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };

  if (typeof renderCatalog === "function") renderCatalog();
  if (typeof renderDiscoveryShelf === "function") renderDiscoveryShelf();
})();
