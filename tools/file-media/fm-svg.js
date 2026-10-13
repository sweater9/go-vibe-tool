/* GoVibeTool V8 — SVG sanitizer & optimizer core.
   Security model: the input is parsed as strict XML (DOMParser, image/svg+xml) and a NEW document is built from an
   allowlist of SVG elements and attributes. Nothing is "removed from the original"; anything not on the allowlist is simply
   never copied. URL-bearing values, <style> CSS and animation targets get their own structural checks. The result is
   optionally optimised with SVGO (vendored, run locally), then sanitised again and checked by an independent verifier.
   Regular expressions are used only as small helpers inside those structural checks, never as the sanitiser itself.
   Browser only (needs DOMParser/XMLSerializer). No network access. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GVTSvg = api;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  var SCRIPT_URL = typeof document !== "undefined" && document.currentScript && document.currentScript.src || "";
  var SVG_NS = "http://www.w3.org/2000/svg", XLINK_NS = "http://www.w3.org/1999/xlink", XML_NS = "http://www.w3.org/XML/1998/namespace", XMLNS_NS = "http://www.w3.org/2000/xmlns/";
  var MAX_BYTES = 5 * 1024 * 1024, MAX_NODES = 50000, MAX_DEPTH = 200;

  function set(s) { var o = {}; s.split(" ").forEach(function (k) { o[k] = 1; }); return o; }

  var ELEMENTS = set("svg g defs symbol use title desc path rect circle ellipse line polyline polygon text tspan textPath linearGradient radialGradient stop pattern clipPath mask marker filter image a switch view style " +
    "animate animateTransform animateMotion set mpath " +
    "feBlend feColorMatrix feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting feDisplacementMap feDistantLight feDropShadow feFlood feFuncA feFuncB feFuncG feFuncR feGaussianBlur feImage feMerge feMergeNode feMorphology feOffset fePointLight feSpecularLighting feSpotLight feTile feTurbulence");
  /* Elements whose children are never copied or even reported as content. */
  var NEVER = set("script foreignObject iframe object embed audio video canvas applet handler listener");
  var TEXTY = set("text tspan textPath title desc style");

  var ATTRS = set(
    "id class lang role tabindex version baseProfile viewBox preserveAspectRatio x y x1 y1 x2 y2 cx cy r rx ry fx fy fr width height d points transform pathLength " +
    "refX refY markerWidth markerHeight markerUnits orient dx dy rotate textLength lengthAdjust startOffset method spacing side " +
    "fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset opacity color " +
    "display visibility overflow clip clip-path clip-rule mask mask-type filter marker marker-start marker-mid marker-end font-family font-size font-size-adjust font-style font-weight font-variant font-stretch " +
    "letter-spacing word-spacing text-anchor text-decoration text-rendering dominant-baseline alignment-baseline baseline-shift writing-mode direction unicode-bidi shape-rendering image-rendering " +
    "color-interpolation color-interpolation-filters color-rendering stop-color stop-opacity flood-color flood-opacity lighting-color mix-blend-mode isolation paint-order vector-effect " +
    "transform-origin transform-box pointer-events gradientUnits gradientTransform spreadMethod offset patternUnits patternContentUnits patternTransform clipPathUnits maskUnits maskContentUnits " +
    "filterUnits primitiveUnits in in2 result mode type values k1 k2 k3 k4 operator stdDeviation edgeMode kernelMatrix order divisor bias targetX targetY kernelUnitLength preserveAlpha " +
    "surfaceScale diffuseConstant specularConstant specularExponent azimuth elevation z pointsAtX pointsAtY pointsAtZ limitingConeAngle baseFrequency numOctaves seed stitchTiles " +
    "xChannelSelector yChannelSelector scale radius tableValues slope intercept amplitude exponent " +
    "attributeName attributeType begin dur end min max restart repeatCount repeatDur calcMode keyTimes keySplines from to by additive accumulate keyPoints path " +
    "requiredFeatures requiredExtensions systemLanguage zoomAndPan media");
  /* attributes that may carry url(...) references */
  var URL_ATTRS = set("fill stroke filter clip-path mask marker marker-start marker-mid marker-end cursor lighting-color flood-color stop-color color");
  var HREF_ELEMENTS = set("use mpath textPath linearGradient radialGradient pattern filter feImage image a");

  /* ---------- tiny value helpers ---------- */
  function clean(s) { return String(s).replace(new RegExp("[" + String.fromCharCode(0) + "-" + String.fromCharCode(32) + String.fromCharCode(127) + "-" + String.fromCharCode(159) + String.fromCharCode(160, 5760, 6158) + String.fromCharCode(8192) + "-" + String.fromCharCode(8207) + String.fromCharCode(8232, 8233, 8239, 8287, 12288, 65279) + "]", "g"), ""); }
  function isFragment(v) { return /^#[^\s#"'()<>\\]+$/.test(v.trim()); }
  var DATA_IMG = /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+\/=\s]*$/i;
  /* Every url(...) in a CSS/attribute value, parsed by scanning (handles quotes and nesting), not by one big pattern. */
  function cssUrls(value) {
    var out = [], v = String(value), low = v.toLowerCase(), i = 0;
    while ((i = low.indexOf("url", i)) > -1) {
      var j = i + 3; while (j < v.length && /\s/.test(v[j])) j++;
      if (v[j] !== "(") { i += 3; continue; }
      j++; while (j < v.length && /\s/.test(v[j])) j++;
      var q = v[j] === '"' || v[j] === "'" ? v[j] : "", start = q ? j + 1 : j, end;
      if (q) { end = v.indexOf(q, start); if (end < 0) { out.push(null); break; } }
      else { end = v.indexOf(")", start); if (end < 0) { out.push(null); break; } }
      out.push(v.slice(start, end).trim());
      i = end + 1;
    }
    return out;
  }
  function urlOk(u, allowExternal) {
    if (u === null) return false;
    if (isFragment(u)) return true;
    if (DATA_IMG.test(u.replace(/[\u0000-\u001f]/g, ""))) return true;
    return !!allowExternal && /^https:\/\//i.test(clean(u));
  }
  function valueHasBadUrl(v, allowExternal) {
    if (!/url|image-set|src\s*\(|element\s*\(|paint\s*\(|cross-fade|expression|javascript|vbscript|behavior|binding/i.test(v)) return false;
    var low = v.toLowerCase();
    if (/image-set|-webkit-image|cross-fade|element\s*\(|paint\s*\(|\bsrc\s*\(|expression\s*\(|javascript:|vbscript:|-moz-binding|behavior\s*:/.test(low)) return true;
    return cssUrls(v).some(function (u) { return !urlOk(u, allowExternal); });
  }

  /* ---------- CSS (for <style> elements and style="" attributes) ---------- */
  function stripCssComments(css) {
    var out = "", i = 0;
    while (i < css.length) {
      if (css[i] === "/" && css[i + 1] === "*") { var e = css.indexOf("*/", i + 2); if (e < 0) break; i = e + 2; continue; }
      if (css[i] === '"' || css[i] === "'") { var q = css[i], j = i + 1; while (j < css.length && css[j] !== q) { if (css[j] === "\\") j++; j++; } out += css.slice(i, j + 1); i = j + 1; continue; }
      out += css[i++];
    }
    return out;
  }
  /* split on `sep` at depth 0 outside strings/parens */
  function splitTop(s, sep) {
    var parts = [], depth = 0, cur = "", q = "";
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (q) { cur += c; if (c === "\\") { cur += s[++i] || ""; } else if (c === q) q = ""; continue; }
      if (c === '"' || c === "'") { q = c; cur += c; continue; }
      if (c === "(" || c === "[") depth++;
      if (c === ")" || c === "]") depth = Math.max(0, depth - 1);
      if (c === sep && depth === 0) { parts.push(cur); cur = ""; continue; }
      cur += c;
    }
    if (cur.trim()) parts.push(cur);
    return parts;
  }
  function cleanDeclarations(body, removed, allowExternal) {
    var out = [];
    splitTop(body, ";").forEach(function (decl) {
      var k = decl.indexOf(":");
      if (k < 1) { if (decl.trim()) removed.push({ type: "css", name: decl.trim().slice(0, 40), why: "not a valid declaration" }); return; }
      var prop = decl.slice(0, k).trim().toLowerCase(), val = decl.slice(k + 1).trim();
      if (!/^(--)?[a-z-][a-z0-9-]*$/.test(prop) || prop === "behavior" || prop === "-moz-binding" || prop === "-ms-behavior") { removed.push({ type: "css", name: prop.slice(0, 40), why: "unsafe or unknown property" }); return; }
      if (/[\\<]/.test(val) || /@import/i.test(val)) { removed.push({ type: "css", name: prop, why: "escape sequence or markup in value" }); return; }
      if (valueHasBadUrl(val, allowExternal)) { removed.push({ type: "css", name: prop, why: "external or script URL in CSS" }); return; }
      out.push(prop + ":" + val);
    });
    return out.join(";");
  }
  function cleanCss(css, removed, allowExternal, depth) {
    depth = depth || 0;
    css = stripCssComments(String(css));
    var out = [], i = 0;
    while (i < css.length) {
      while (i < css.length && /\s/.test(css[i])) i++;
      if (i >= css.length) break;
      // read prelude up to { or ; (at-rule without block)
      var j = i, q = "", par = 0;
      for (; j < css.length; j++) {
        var c = css[j];
        if (q) { if (c === "\\") j++; else if (c === q) q = ""; continue; }
        if (c === '"' || c === "'") { q = c; continue; }
        if (c === "(") par++; if (c === ")") par = Math.max(0, par - 1);
        if (par === 0 && (c === "{" || c === ";")) break;
      }
      var prelude = css.slice(i, j).trim();
      if (css[j] !== "{") { if (prelude) removed.push({ type: "css", name: prelude.slice(0, 40), why: "at-rule without a safe block" }); i = j + 1; continue; }
      // find the matching close brace
      var d = 1, k = j + 1; q = "";
      for (; k < css.length && d > 0; k++) {
        var ch = css[k];
        if (q) { if (ch === "\\") k++; else if (ch === q) q = ""; continue; }
        if (ch === '"' || ch === "'") { q = ch; continue; }
        if (ch === "{") d++; else if (ch === "}") d--;
      }
      var body = css.slice(j + 1, d === 0 ? k - 1 : k);
      i = k;
      if (prelude[0] === "@") {
        var nm = prelude.slice(1).split(/[\s({]/)[0].toLowerCase();
        if ((nm === "media" || nm === "supports") && depth < 3 && !/[\\<]/.test(prelude)) { var inner = cleanCss(body, removed, allowExternal, depth + 1); if (inner) out.push(prelude + "{" + inner + "}"); }
        else if (/^(-webkit-)?keyframes$/.test(nm) && depth < 3 && !/[\\<]/.test(prelude)) { var kf = cleanCss(body, removed, allowExternal, depth + 1); if (kf) out.push(prelude + "{" + kf + "}"); }
        else removed.push({ type: "css", name: "@" + nm, why: "at-rule not allowed in SVG (can load external resources)" });
        continue;
      }
      if (/[\\<>{}]|@|\/\*/.test(prelude.replace(/>/g, "")) || !/^[\w\s.,#:>+~*()\[\]="'^$|%\-]+$/.test(prelude.replace(/>/g, ""))) { removed.push({ type: "css", name: prelude.slice(0, 40), why: "unsafe selector" }); continue; }
      var decls = cleanDeclarations(body, removed, allowExternal);
      if (decls) out.push(prelude + "{" + decls + "}");
    }
    return out.join("\n");
  }

  /* ---------- the sanitiser ---------- */
  function getDom(opts) {
    var w = (opts && opts.dom) || root;
    if (!w || typeof w.DOMParser === "undefined" || typeof w.XMLSerializer === "undefined") throw new Error("This tool needs a browser (DOMParser).");
    return w;
  }
  function describeParseError(doc) {
    var pe = doc.getElementsByTagName("parsererror")[0];
    if (!pe) return null;
    var txt = (pe.textContent || "").replace(/\s+/g, " ").trim();
    var m = /line\s*(?:number\s*)?(\d+)/i.exec(txt);
    return "This is not well-formed SVG/XML" + (m ? " (near line " + m[1] + ")" : "") + ": " + txt.replace(/^.*?error[^:]*:\s*/i, "").slice(0, 160);
  }

  function sanitize(text, opts) {
    opts = opts || {};
    var removed = [], warnings = [];
    text = String(text == null ? "" : text);
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    if (!text.trim()) return { ok: false, error: "Paste or drop an SVG first.", removed: removed, warnings: warnings };
    if (text.length > MAX_BYTES) return { ok: false, error: "This SVG is larger than " + (MAX_BYTES / 1048576) + " MB. Optimise it with a desktop tool first.", removed: removed, warnings: warnings };
    // Entity declarations enable entity-expansion attacks; SVG files do not need them. (Extra gate, not the security boundary.)
    if (/<!ENTITY/i.test(text)) return { ok: false, error: "This file declares XML entities (<!ENTITY …>), which are used for entity-expansion attacks and are not supported. Remove the DOCTYPE entity block and try again.", removed: removed, warnings: warnings };
    var w = getDom(opts), srcDoc;
    try { srcDoc = new w.DOMParser().parseFromString(text, "image/svg+xml"); } catch (e) { return { ok: false, error: "The browser could not parse this file as XML.", removed: removed, warnings: warnings }; }
    var perr = describeParseError(srcDoc);
    if (perr) return { ok: false, error: perr, removed: removed, warnings: warnings };
    var srcRoot = srcDoc.documentElement;
    if (!srcRoot || srcRoot.localName !== "svg" || srcRoot.namespaceURI !== SVG_NS) return { ok: false, error: "The root element is not an <svg> in the SVG namespace (xmlns=\"http://www.w3.org/2000/svg\").", removed: removed, warnings: warnings };

    var outDoc = srcDoc.implementation.createDocument(SVG_NS, "svg", null), nodes = 0, allowExternal = !!opts.allowExternalLinks, keepStyle = opts.keepStyles !== false, tooDeep = false, tooMany = false;
    var allowImagesExternal = !!opts.allowExternalImages;
    function note(type, name, why) { if (removed.length < 500) removed.push({ type: type, name: name, why: why }); }

    function copyAttrs(src, dst, ln) {
      var animLike = ln === "animate" || ln === "set" || ln === "animateTransform" || ln === "animateMotion";
      for (var a = 0; a < src.attributes.length; a++) {
        var at = src.attributes[a], ns = at.namespaceURI, name = at.localName, val = at.value, full = at.name;
        if (ns === XMLNS_NS) { if (!(val === SVG_NS || val === XLINK_NS)) note("namespace", full, "editor/extension namespace"); continue; }
        if (/^on/i.test(name) && ns !== XLINK_NS) { note("attribute", full, "event handler"); continue; }
        // href / xlink:href
        if (name === "href" && (ns === null || ns === XLINK_NS)) {
          if (!HREF_ELEMENTS[ln]) { note("attribute", full, "href not allowed on <" + ln + ">"); continue; }
          var hv = val.trim(), hc = clean(val);
          var ok = false;
          if (isFragment(hv)) ok = true;
          else if ((ln === "image" || ln === "feImage") && DATA_IMG.test(hv.replace(/[\u0000-\u001f]/g, ""))) ok = true;
          else if ((ln === "image" || ln === "feImage") && allowImagesExternal && /^https:\/\//i.test(hc)) ok = true;
          else if (ln === "a" && /^(https?:\/\/|mailto:|tel:)/i.test(hc)) ok = true;
          if (!ok) { note("attribute", full, /^(javascript|vbscript|data):/i.test(hc) ? "dangerous URL scheme (" + hc.split(":")[0].toLowerCase() + ":)" : "external or non-local reference"); continue; }
          if (ns === XLINK_NS) dst.setAttributeNS(XLINK_NS, "xlink:href", hv); else dst.setAttribute("href", hv);
          continue;
        }
        if (ns === XLINK_NS) { note("attribute", full, "xlink attribute not allowed"); continue; }
        if (ns === XML_NS) { if (name === "space" || name === "lang") dst.setAttributeNS(XML_NS, "xml:" + name, val); else note("attribute", full, "xml attribute not allowed"); continue; }
        if (ns !== null && ns !== undefined && ns !== "") { note("attribute", full, "namespaced extension attribute"); continue; }
        if (name === "style") {
          if (!keepStyle) { note("attribute", "style", "style attributes removed by option"); continue; }
          var sub = []; var cleaned = cleanDeclarations(val, sub, allowImagesExternal); sub.forEach(function (s) { note("css", s.name, s.why); });
          if (cleaned) dst.setAttribute("style", cleaned);
          continue;
        }
        if (/^(aria-[\w-]+|data-[\w.-]+)$/.test(name)) { dst.setAttribute(name, val); continue; }
        if (!ATTRS[name]) { note("attribute", full, "not an allowed SVG attribute"); continue; }
        if (animLike && name === "attributeName" && (/(^|:)href$/i.test(val.trim()) || /(^|:)on/i.test(val.trim()) || /(^|:)(style|class)$/i.test(val.trim()))) { return "DROP_ELEMENT"; }
        if (URL_ATTRS[name] || /url\s*\(/i.test(val)) {
          if (valueHasBadUrl(val, allowImagesExternal)) { note("attribute", full, "external or script URL"); continue; }
        }
        if (name === "id" && !/^[^\s"'<>&()\\#]+$/.test(val)) { note("attribute", "id", "id with spaces or special characters removed"); continue; }
        dst.setAttribute(name, val);
      }
      return null;
    }

    function walk(src, dstParent, depth) {
      if (depth > MAX_DEPTH) { tooDeep = true; return; }
      for (var c = src.firstChild; c; c = c.nextSibling) {
        if (++nodes > MAX_NODES) { tooMany = true; return; }
        if (c.nodeType === 1) {
          var ln = c.localName;
          if (c.namespaceURI !== SVG_NS) { note("element", c.nodeName, c.namespaceURI ? "non-SVG namespace (editor data or embedded markup)" : "no namespace"); continue; }
          if (NEVER[ln]) { note("element", ln, ln === "script" ? "script" : "can embed executable or external content"); continue; }
          if (!ELEMENTS[ln]) { note("element", ln, "not an allowed SVG element"); continue; }
          if (ln === "style" && !keepStyle) { note("element", "style", "style elements removed by option"); continue; }
          var el = outDoc.createElementNS(SVG_NS, ln);
          if (copyAttrs(c, el, ln) === "DROP_ELEMENT") { note("element", ln, "animation that targets href/event/style attributes"); continue; }
          if ((ln === "image" || ln === "use" || ln === "mpath") && !el.hasAttribute("href") && !el.hasAttributeNS(XLINK_NS, "href")) { note("element", ln, "no safe reference left, so the element had nothing to show"); continue; }
          if (ln === "style") {
            var sub2 = [], cleanedCss = cleanCss(c.textContent || "", sub2, allowImagesExternal);
            sub2.forEach(function (s) { note("css", s.name, s.why); });
            if (!cleanedCss) continue;
            el.appendChild(outDoc.createTextNode(cleanedCss));
          } else walk(c, el, depth + 1);
          dstParent.appendChild(el);
        } else if (c.nodeType === 3 || c.nodeType === 4) {
          if (TEXTY[src.localName]) dstParent.appendChild(outDoc.createTextNode(c.nodeValue));
        } else if (c.nodeType === 8) { /* comment */ if (!removed.some(function (r) { return r.type === "comment"; })) note("comment", "comments", "comments removed"); }
        else if (c.nodeType === 7) note("processing-instruction", c.target, "processing instruction");
      }
    }

    // anything outside the root element (processing instructions such as xml-stylesheet, comments) is never copied; say so
    for (var top = srcDoc.firstChild; top; top = top.nextSibling) {
      if (top.nodeType === 7 && top.target !== "xml") note("processing-instruction", top.target, "processing instruction (can load external stylesheets)");
      else if (top.nodeType === 8) note("comment", "comments", "comments removed");
    }
    var outRoot = outDoc.documentElement;
    copyAttrs(srcRoot, outRoot, "svg");
    walk(srcRoot, outRoot, 0);
    if (tooDeep) return { ok: false, error: "The SVG is nested more than " + MAX_DEPTH + " levels deep, which is not supported.", removed: removed, warnings: warnings };
    if (tooMany) return { ok: false, error: "The SVG has more than " + MAX_NODES.toLocaleString("en-US") + " nodes, which is too large to process safely in the browser.", removed: removed, warnings: warnings };

    // duplicate ids: browsers resolve references to the FIRST element with an id, so renaming later ones cannot break any reference
    var seen = {}, dupes = 0;
    (function dedupeIds(node) {
      if (node.nodeType !== 1) return;
      var id = node.getAttribute("id");
      if (id) {
        if (seen[id]) { var n = 2, cand; do { cand = id + "-" + n++; } while (seen[cand]); node.setAttribute("id", cand); seen[cand] = 1; dupes++; }
        else seen[id] = 1;
      }
      for (var ch = node.firstChild; ch; ch = ch.nextSibling) dedupeIds(ch);
    })(outRoot);
    if (dupes) warnings.push(dupes + " duplicate id" + (dupes === 1 ? "" : "s") + " renamed. References already pointed to the first element with that id (the browser's behaviour), so nothing was re-pointed.");
    // dangling references
    var missing = {};
    (function refs(node) {
      if (node.nodeType !== 1) return;
      for (var a = 0; a < node.attributes.length; a++) {
        var at = node.attributes[a], vals = [];
        if (at.localName === "href") vals.push(at.value.trim()); else if (/url\s*\(/i.test(at.value)) cssUrls(at.value).forEach(function (u) { if (u) vals.push(u); });
        vals.forEach(function (v) { if (v[0] === "#" && !seen[v.slice(1)]) missing[v] = 1; });
      }
      for (var ch = node.firstChild; ch; ch = ch.nextSibling) refs(ch);
    })(outRoot);
    var miss = Object.keys(missing);
    if (miss.length) warnings.push("References to ids that do not exist: " + miss.slice(0, 5).join(", ") + (miss.length > 5 ? "…" : "") + ". They are kept as-is.");

    var out = new w.XMLSerializer().serializeToString(outRoot);
    return { ok: true, svg: out, removed: removed, warnings: warnings, duplicateIds: dupes };
  }

  /* ---------- independent post-condition check (does not share code paths with the sanitiser's allowlist logic) ---------- */
  function verifyClean(svgText, opts) {
    var w = getDom(opts), problems = [];
    var doc = new w.DOMParser().parseFromString(svgText, "image/svg+xml");
    if (doc.getElementsByTagName("parsererror").length) return ["output is not well-formed XML"];
    var all = doc.getElementsByTagName("*");
    for (var i = 0; i < all.length; i++) {
      var e = all[i], ln = e.localName.toLowerCase();
      if (e.namespaceURI !== SVG_NS) problems.push("non-SVG element <" + e.nodeName + ">");
      if (/^(script|foreignobject|iframe|object|embed|audio|video|canvas|handler|listener)$/.test(ln)) problems.push("<" + ln + "> present");
      if (/^(animate|set|animatetransform|animatemotion)$/.test(ln) && /(^|:)(href|style|class)$|(^|:)on/i.test((e.getAttribute("attributeName") || "").trim())) problems.push("animation targets " + e.getAttribute("attributeName"));
      for (var a = 0; a < e.attributes.length; a++) {
        var at = e.attributes[a], nm = at.name.toLowerCase(), v = clean(at.value).toLowerCase();
        if (/^on/.test(nm)) problems.push("event handler " + at.name);
        if (/(^|[^a-z])(javascript|vbscript):/.test(v)) problems.push("script URL in " + at.name);
        if (/(^|:)href$/.test(nm) && !(v[0] === "#" || /^data:image\/(png|jpe?g|gif|webp);base64,/.test(v) || (ln === "a" && /^(https?:|mailto:|tel:)/.test(v)) || (/^https:\/\//.test(v) && ln === "image" && opts && opts.allowExternalImages))) problems.push("non-local " + at.name);
        if (/url\s*\(/i.test(at.value) && cssUrls(at.value).some(function (u) { return !(u && (isFragment(u) || DATA_IMG.test(u) || (opts && opts.allowExternalImages && /^https:\/\//i.test(u)))); })) problems.push("external url() in " + at.name);
      }
      if (ln === "style") {
        var css = e.textContent || "";
        if (/@import|expression\s*\(|javascript:|-moz-binding|behavior\s*:|<|\\/i.test(css)) problems.push("unsafe CSS in <style>");
        if (cssUrls(css).some(function (u) { return !(u && (isFragment(u) || DATA_IMG.test(u) || (opts && opts.allowExternalImages && /^https:\/\//i.test(u)))); })) problems.push("external url() in <style>");
      }
    }
    return problems;
  }

  /* ---------- optimisation (SVGO, vendored) ---------- */
  var svgoPromise = null;
  function loadSvgo(opts) {
    if (opts && opts.svgo) return Promise.resolve(opts.svgo);
    if (!svgoPromise) {
      var base = (opts && opts.svgoUrl) || (SCRIPT_URL ? new URL("../../vendor/svgo.browser.js", SCRIPT_URL).href : "vendor/svgo.browser.js");
      svgoPromise = import(base).catch(function (e) { svgoPromise = null; throw e; });
    }
    return svgoPromise;
  }
  function svgoConfig(o) {
    o = o || {};
    var plugins = [{ name: "preset-default", params: { overrides: { removeUnknownsAndDefaults: { keepRoleAttr: true, keepAriaAttrs: true, keepDataAttrs: true }, cleanupIds: o.minifyIds === false ? false : { minify: true, preserve: [] } } } }];
    if (o.removeTitle) plugins.push("removeTitle", "removeDesc");
    if (o.prefixIds) plugins.push({ name: "prefixIds", params: { prefix: o.prefixIds === true ? "svg" : String(o.prefixIds).replace(/[^\w-]/g, "") || "svg" } });
    plugins.push("removeXlink"); // SVG 2 href replaces xlink:href; our sanitiser accepts both
    if (o.removeDimensions) plugins.push("removeDimensions");
    return { multipass: o.multipass !== false, floatPrecision: o.precision == null ? 3 : o.precision, plugins: plugins };
  }

  function byteLength(s) { return typeof TextEncoder !== "undefined" ? new TextEncoder().encode(s).length : unescape(encodeURIComponent(s)).length; }

  /* Full pipeline: sanitise -> (optimise -> sanitise again) -> independent verification. */
  function processSvg(text, opts) {
    opts = opts || {};
    var first = sanitize(text, opts);
    if (!first.ok) return Promise.resolve(first);
    var res = { ok: true, original: String(text), sanitized: first.svg, removed: first.removed.slice(), warnings: first.warnings.slice(), duplicateIds: first.duplicateIds, optimized: first.svg, optimizerRan: false };
    function finish(candidate) {
      var again = sanitize(candidate, opts);
      if (!again.ok) return { ok: false, error: "Internal safety check failed after optimisation: " + again.error, removed: res.removed, warnings: res.warnings };
      var problems = verifyClean(again.svg, opts);
      if (problems.length) return { ok: false, error: "The result was refused by the safety verifier (" + problems.slice(0, 3).join("; ") + "). Nothing was exported.", removed: res.removed, warnings: res.warnings };
      res.optimized = again.svg; res.verified = true;
      res.originalBytes = byteLength(res.original); res.sanitizedBytes = byteLength(res.sanitized); res.optimizedBytes = byteLength(res.optimized);
      return res;
    }
    if (opts.optimize === false) return Promise.resolve(finish(first.svg));
    return loadSvgo(opts).then(function (svgo) {
      var r;
      try { r = svgo.optimize(first.svg, svgoConfig(opts)); }
      catch (e) { res.warnings.push("The optimiser could not process this SVG (" + (e && e.message || e) + "); showing the sanitised SVG without optimisation."); return finish(first.svg); }
      res.optimizerRan = true; res.optimizerVersion = svgo.VERSION || "";
      return finish(r.data);
    }, function (e) {
      res.warnings.push("The optimiser could not be loaded (" + (e && e.message || e) + "); showing the sanitised SVG without optimisation.");
      return finish(first.svg);
    });
  }

  return { sanitize: sanitize, verifyClean: verifyClean, process: processSvg, svgoConfig: svgoConfig, cleanCss: cleanCss, cssUrls: cssUrls, byteLength: byteLength, SVG_NS: SVG_NS, MAX_BYTES: MAX_BYTES };
});
