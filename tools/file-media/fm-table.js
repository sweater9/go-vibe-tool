/* GoVibeTool V8 — Markdown table <-> CSV / TSV core. Pure functions, no DOM, no network.
   Loaded in the browser (window.GVTTable) and by Node tests (module.exports). */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GVTTable = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MAX_CHARS = 5000000;

  /* ---------- RFC 4180-style parser: quotes, "" escapes, delimiters / CR / LF inside quotes ---------- */
  function parseDelimited(text, delim) {
    text = String(text == null ? "" : text);
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    var rows = [], row = [], field = "", i = 0, n = text.length, inQ = false, wasQuoted = false, warnings = [];
    function endField() { row.push(field); field = ""; wasQuoted = false; }
    function endRow() { endField(); rows.push(row); row = []; }
    while (i < n) {
      var c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"' && field === "" && !wasQuoted) { inQ = true; wasQuoted = true; i++; continue; }
      if (c === delim) { endField(); i++; continue; }
      if (c === "\r") { endRow(); i += text[i + 1] === "\n" ? 2 : 1; continue; }
      if (c === "\n") { endRow(); i++; continue; }
      field += c; i++;
    }
    if (inQ) warnings.push("A quoted field was never closed; the rest of the text was treated as part of that field.");
    if (field !== "" || row.length || wasQuoted) endRow();
    return { rows: rows, warnings: warnings };
  }

  /* Pick the delimiter that yields the most consistent multi-column table in the first lines (outside quotes). */
  function detectDelimiter(text) {
    var cands = ["\t", ",", ";", "|"], best = ",", bestScore = -1;
    var sample = String(text).slice(0, 20000);
    cands.forEach(function (d) {
      var r = parseDelimited(sample, d).rows.slice(0, 12);
      if (!r.length) return;
      var widths = r.map(function (x) { return x.length; }), w0 = widths[0];
      if (w0 < 2) return;
      var consistent = widths.filter(function (w) { return w === w0; }).length;
      var score = consistent * 100 + w0 - (d === "|" ? 50 : 0) + (d === "\t" ? 5 : 0);
      if (score > bestScore) { bestScore = score; best = d; }
    });
    return best;
  }

  /* ---------- GitHub-flavoured Markdown tables ---------- */
  function splitMdRow(line) {
    var s = line.trim();
    if (s[0] === "|") s = s.slice(1);
    var cells = [], cur = "", i = 0;
    while (i < s.length) {
      var c = s[i];
      if (c === "\\" && s[i + 1] === "|") { cur += "|"; i += 2; continue; }
      if (c === "|") { cells.push(cur.trim()); cur = ""; i++; continue; }
      cur += c; i++;
    }
    var tail = cur.trim();
    // a trailing pipe leaves an empty tail that is not a cell; a row without trailing pipe keeps its last cell
    if (!(tail === "" && /\|\s*$/.test(line) && !/\\\|\s*$/.test(line))) cells.push(tail);
    return cells;
  }
  var DELIM_CELL = /^\s*:?-+:?\s*$/;
  function isDelimiterRow(line) {
    if (line.indexOf("-") < 0 || line.indexOf("|") < 0) return false;
    var cells = splitMdRow(line);
    return cells.length > 0 && cells.every(function (c) { return DELIM_CELL.test(c); });
  }
  function alignOf(cell) {
    var c = cell.trim(), l = c[0] === ":", r = c[c.length - 1] === ":";
    return l && r ? "center" : r ? "right" : l ? "left" : "none";
  }
  function brToNewline(s) { return s.replace(/<br\s*\/?>/gi, "\n"); }

  function parseMarkdownTable(text, opts) {
    opts = opts || {};
    var lines = String(text).replace(/^﻿/, "").split(/\r\n|\r|\n/), warnings = [], start = -1, tables = 0;
    for (var i = 0; i < lines.length - 1; i++) {
      if (lines[i].indexOf("|") > -1 && isDelimiterRow(lines[i + 1])) {
        var hw = splitMdRow(lines[i]).length, dw = splitMdRow(lines[i + 1]).length;
        if (hw === dw) { if (start < 0) start = i; tables++; while (i + 1 < lines.length && lines[i + 1].trim() !== "") i++; }
      }
    }
    if (start < 0) return { ok: false, rows: [], align: [], warnings: ["No Markdown table found. A table needs a header row and a separator row such as | --- | --- |."] };
    if (tables > 1) warnings.push("Found " + tables + " tables; converted the first one.");
    var header = splitMdRow(lines[start]), headerWidth = header.length, align = splitMdRow(lines[start + 1]).map(alignOf), rows = [header], j = start + 2, widest = header.length, padded = false;
    for (; j < lines.length && lines[j].trim() !== ""; j++) {
      if (lines[j].indexOf("|") < 0 && !/^\s*>/.test(lines[j])) { /* GFM ends the table at the first line that is not a row */ break; }
      var cells = splitMdRow(lines[j]);
      if (cells.length > widest) widest = cells.length;
      rows.push(cells);
    }
    var cut = opts.keepExtra === false;
    rows = rows.map(function (r) {
      if (cut && r.length > headerWidth) { warnings.push("A row had more cells than the header; extra cells were dropped."); r = r.slice(0, headerWidth); }
      while (r.length < (cut ? headerWidth : widest)) { r.push(""); padded = true; }
      return r;
    });
    if (!cut && widest > headerWidth) { warnings.push("Some rows had more cells than the header; the table was widened so no data is lost."); while (align.length < widest) align.push("none"); }
    if (padded) warnings.push("Short rows were padded with empty cells.");
    var hasBr = false;
    rows = rows.map(function (r) { return r.map(function (c) { if (/<br\s*\/?>/i.test(c)) hasBr = true; return opts.brToNewline === false ? c : brToNewline(c); }); });
    if (hasBr && opts.brToNewline !== false) warnings.push("<br> line breaks inside cells were converted to real line breaks.");
    return { ok: true, rows: rows, align: align.slice(0, rows[0].length), warnings: warnings };
  }

  function mdEscape(cell) {
    return String(cell).replace(/\r\n|\r|\n/g, "<br>").replace(/\|/g, "\\|");
  }
  var NUMERIC = /^[-+]?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?%?$|^[-+]?\.\d+$/;
  function toMarkdown(rows, opts) {
    opts = opts || {};
    var width = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    if (!rows.length || !width) return { text: "", warnings: ["There is no data to convert."] };
    var warnings = [], data = rows.map(function (r) { var c = r.slice(); while (c.length < width) c.push(""); return c; });
    var header;
    if (opts.firstRowHeader === false) {
      header = []; for (var k = 0; k < width; k++) header.push("Column " + (k + 1));
    } else header = data.shift();
    var align = [];
    for (var a = 0; a < width; a++) {
      var mode = opts.align || "none";
      if (Array.isArray(mode)) align.push(mode[a] || "none");
      else if (mode === "auto") {
        var col = data.map(function (r) { return r[a]; }).filter(function (x) { return String(x).trim() !== ""; });
        align.push(col.length && col.every(function (x) { return NUMERIC.test(String(x).trim()); }) ? "right" : "none");
      } else align.push(mode);
    }
    var hasNl = data.concat([header]).some(function (r) { return r.some(function (c) { return /[\r\n]/.test(c); }); });
    if (hasNl) warnings.push("Markdown table cells cannot contain real line breaks, so they were written as <br>. Most renderers (GitHub, GitLab) show them as line breaks; plain-text viewers show the tag.");
    var lead = data.concat([header]).some(function (r) { return r.some(function (c) { return c !== String(c).trim(); }); });
    if (lead) warnings.push("Leading and trailing spaces inside cells are not preserved by Markdown tables.");
    var cells = [header].concat(data).map(function (r) { return r.map(mdEscape); });
    var pad = opts.pad !== false, widths = [];
    for (var c = 0; c < width; c++) {
      var w = 3;
      if (pad) cells.forEach(function (r) { w = Math.max(w, r[c].length); });
      widths.push(w);
    }
    function fmt(r) { return "| " + r.map(function (x, i) { return pad ? x + " ".repeat(Math.max(0, widths[i] - x.length)) : x; }).join(" | ") + " |"; }
    var sep = "| " + align.map(function (al, i) {
      var w = pad ? widths[i] : 3, d = "-".repeat(Math.max(3, w));
      if (al === "left") d = ":" + d.slice(1);
      else if (al === "right") d = d.slice(1) + ":";
      else if (al === "center") d = ":" + d.slice(2) + ":";
      return d;
    }).join(" | ") + " |";
    var out = [fmt(cells[0]), sep].concat(cells.slice(1).map(fmt));
    return { text: out.join("\n"), warnings: warnings };
  }

  /* ---------- CSV / TSV writer ---------- */
  var FORMULA = /^[=+\-@\t\r]/;
  function toDelimited(rows, delim, opts) {
    opts = opts || {};
    var eol = opts.eol || "\n", warnings = [], formulas = 0;
    var text = rows.map(function (r) {
      return r.map(function (cell) {
        var v = String(cell == null ? "" : cell);
        if (FORMULA.test(v) && !(NUMERIC.test(v.trim()))) {
          formulas++;
          if (opts.protectFormulas) v = "'" + v;
        }
        var need = opts.quoteAll || v.indexOf(delim) > -1 || /["\r\n]/.test(v) || v !== v.trim() && v.trim() !== "" || (v === "" && opts.quoteEmpty);
        return need ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(delim);
    }).join(eol);
    if (formulas && !opts.protectFormulas) warnings.push(formulas + " cell" + (formulas === 1 ? "" : "s") + " start with = + - or @. Spreadsheets may run these as formulas when opened; tick “Protect against spreadsheet formulas” if the data is untrusted.");
    if (formulas && opts.protectFormulas) warnings.push(formulas + " cell" + (formulas === 1 ? "" : "s") + " got a leading apostrophe so spreadsheets treat them as text.");
    return { text: text, warnings: warnings };
  }

  var DELIMS = { csv: ",", tsv: "\t", semicolon: ";", pipe: "|" };

  /* One entry point for the UI: detect/choose the input format, convert to the requested output. */
  function convert(input, opts) {
    opts = opts || {};
    var text = String(input == null ? "" : input), warnings = [];
    if (!text.trim()) return { ok: false, error: "Paste a table first.", warnings: warnings };
    if (text.length > MAX_CHARS) return { ok: false, error: "Input is larger than " + (MAX_CHARS / 1e6) + " MB. Split it into smaller parts.", warnings: warnings };
    var from = opts.from || "auto", detected = from, rows, align = null;
    if (from === "auto") detected = looksLikeMarkdown(text) ? "markdown" : "delimited";
    if (detected === "markdown") {
      var p = parseMarkdownTable(text, opts);
      if (!p.ok) return { ok: false, error: p.warnings[0], warnings: [] };
      rows = p.rows; align = p.align; warnings = warnings.concat(p.warnings); detected = "markdown";
    } else {
      var d = detected === "delimited" || detected === "auto" ? detectDelimiter(text) : DELIMS[detected] || ",";
      var q = parseDelimited(text, d);
      rows = q.rows; warnings = warnings.concat(q.warnings);
      detected = d === "\t" ? "tsv" : d === ";" ? "semicolon" : d === "|" ? "pipe" : "csv";
      if (rows.length && rows[0].length < 2 && from === "auto") warnings.push("Only one column was found. If your data uses another separator, pick it under “Input format”.");
    }
    var to = opts.to || "markdown", out;
    if (to === "markdown") {
      var al = opts.align === "keep" ? (align && align.length ? align : "none") : opts.align || "none";
      out = toMarkdown(rows, { align: al, firstRowHeader: opts.firstRowHeader, pad: opts.pad });
    } else {
      out = toDelimited(rows, DELIMS[to] || ",", { protectFormulas: opts.protectFormulas, eol: opts.eol, quoteAll: opts.quoteAll });
    }
    var width = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    return { ok: true, text: out.text, rows: rows, rowCount: rows.length, colCount: width, detected: detected, warnings: warnings.concat(out.warnings) };
  }
  function looksLikeMarkdown(text) {
    var lines = String(text).split(/\r\n|\r|\n/);
    for (var i = 0; i < lines.length - 1; i++) if (lines[i].indexOf("|") > -1 && isDelimiterRow(lines[i + 1])) return true;
    return false;
  }

  return {
    MAX_CHARS: MAX_CHARS, parseDelimited: parseDelimited, detectDelimiter: detectDelimiter, parseMarkdownTable: parseMarkdownTable,
    toMarkdown: toMarkdown, toDelimited: toDelimited, convert: convert, looksLikeMarkdown: looksLikeMarkdown, splitMdRow: splitMdRow
  };
});
