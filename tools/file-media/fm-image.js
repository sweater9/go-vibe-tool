/* GoVibeTool V8 — image helpers shared by the Metadata Stripper and the WebP/AVIF compressor.
   Byte-level parts (metadata scanner, ZIP writer, formatting) are pure and unit-tested in Node.
   Browser parts (encoder detection, decode, encode) only run in a page. Nothing here uses the network. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GVTImage = api;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  var SCRIPT_URL = typeof document !== "undefined" && document.currentScript && document.currentScript.src || "";
  var limits = { maxPixels: 120e6 }; // refuse to decode anything larger than this; canvases beyond it fail on many devices (adjustable for tests)

  /* ---------- formatting ---------- */
  function formatBytes(n) {
    if (!isFinite(n)) return "—";
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(n < 10240 ? 2 : 1) + " KB";
    return (n / 1048576).toFixed(n < 10485760 ? 2 : 1) + " MB";
  }
  function percentSaved(original, output) {
    if (!original) return 0;
    return Math.round((1 - output / original) * 1000) / 10;
  }
  function savingsLabel(original, output) {
    var p = percentSaved(original, output);
    return p > 0 ? p.toFixed(1) + "% smaller" : p < 0 ? Math.abs(p).toFixed(1) + "% larger" : "same size";
  }
  var EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };
  function safeBaseName(name) {
    var base = String(name || "image").split(/[\\/]/).pop().replace(/\.[^.]*$/, "");
    base = base.replace(/[\u0000-\u001f<>:"|?*]/g, "").replace(/^\.+/, "").trim();
    return (base || "image").slice(0, 120);
  }
  function outputName(name, mime, suffix) { return safeBaseName(name) + (suffix || "") + "." + (EXT[mime] || "bin"); }
  function uniqueName(name, used) {
    if (!used[name]) { used[name] = 1; return name; }
    var dot = name.lastIndexOf("."), stem = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : "", k = used[name] + 1, cand;
    do { cand = stem + " (" + k + ")" + ext; k++; } while (used[cand]);
    used[name] = k - 1; used[cand] = 1; return cand;
  }

  /* ---------- metadata scanner (reports what is actually present in a file's container) ---------- */
  function ascii(b, o, n) { var s = ""; for (var i = 0; i < n && o + i < b.length; i++) s += String.fromCharCode(b[o + i]); return s; }
  function u16(b, o, le) { return le ? b[o] | b[o + 1] << 8 : b[o] << 8 | b[o + 1]; }
  function u32(b, o, le) { return le ? (b[o] | b[o + 1] << 8 | b[o + 2] << 16 | b[o + 3] << 24) >>> 0 : (b[o] << 24 | b[o + 1] << 16 | b[o + 2] << 8 | b[o + 3]) >>> 0; }

  var TIFF_NAMES = { 0x010e: "ImageDescription", 0x010f: "Make", 0x0110: "Model", 0x0112: "Orientation", 0x0131: "Software", 0x0132: "DateTime", 0x013b: "Artist", 0x8298: "Copyright", 0x8769: "ExifIFD", 0x8825: "GPS" };
  function parseExif(b, off, len) {
    // b[off..] is the TIFF header (after "Exif\0\0")
    var out = { tags: [], gps: false, orientation: null };
    try {
      if (len < 8) return out;
      var le = b[off] === 0x49 && b[off + 1] === 0x49;
      if (!le && !(b[off] === 0x4d && b[off + 1] === 0x4d)) return out;
      var ifd = u32(b, off + 4, le);
      function readIfd(at, depth) {
        if (!at || at + 2 > len || depth > 2) return;
        var n = u16(b, off + at, le);
        for (var i = 0; i < n && at + 2 + i * 12 + 12 <= len; i++) {
          var e = off + at + 2 + i * 12, tag = u16(b, e, le), type = u16(b, e + 2, le);
          if (tag === 0x8825) out.gps = true;
          if (tag === 0x0112 && type === 3) out.orientation = u16(b, e + 8, le);
          if (TIFF_NAMES[tag] && out.tags.indexOf(TIFF_NAMES[tag]) < 0 && tag !== 0x8769 && tag !== 0x8825) out.tags.push(TIFF_NAMES[tag]);
          if (tag === 0x8769) readIfd(u32(b, e + 8, le), depth + 1);
        }
      }
      readIfd(ifd, 0);
    } catch (e) { /* malformed EXIF: report what was seen */ }
    return out;
  }

  /* Description of an ICC profile (ICC v2 "desc" or v4 "mluc"), e.g. "sRGB". Returns "" if it cannot be read. */
  function iccDescription(b, off, len) {
    try {
      if (len < 132) return "";
      var n = u32(b, off + 128, false);
      for (var i = 0; i < n && i < 100; i++) {
        var e = off + 132 + i * 12;
        if (ascii(b, e, 4) !== "desc") continue;
        var to = off + u32(b, e + 4, false), type = ascii(b, to, 4);
        if (type === "desc") return ascii(b, to + 12, Math.min(u32(b, to + 8, false), 80)).replace(/\0.*$/, "").trim();
        if (type === "mluc") {
          var l = u32(b, to + 20, false), o = u32(b, to + 24, false), s = "";
          for (var k = 0; k < l / 2 && k < 80; k++) s += String.fromCharCode(u16(b, to + o + k * 2, false));
          return s.trim();
        }
      }
    } catch (e) { /* unreadable profile */ }
    return "";
  }
  var STANDARD_PROFILE = /^(srgb|display p3|adobe rgb|generic rgb|apple rgb|rec\.? ?709|rec\.? ?2020|dci-p3)/i;
  function iccFinding(desc, bytes) { return { kind: "ICC", detail: (desc ? "“" + desc + "”" : "embedded colour profile") + (bytes ? " (" + bytes + " bytes)" : ""), description: desc, standard: STANDARD_PROFILE.test(desc || "") }; }

  function scanJpeg(b) {
    var found = [], i = 2, animated = false, orientation = null, gps = false;
    while (i + 4 <= b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      var m = b[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      if (m === 0xd9 || m === 0xda) break;
      var len = u16(b, i + 2, false);
      if (len < 2) break;
      var d = i + 4, dl = len - 2;
      if (m === 0xe1) {
        var id = ascii(b, d, 6);
        if (id === "Exif\0\0") {
          var ex = parseExif(b, d + 6, dl - 6);
          if (ex.orientation) orientation = ex.orientation;
          if (ex.gps) gps = true;
          found.push({ kind: "EXIF", detail: ex.tags.concat(ex.gps ? ["GPS location"] : []).join(", ") || "camera/technical tags" });
        } else if (ascii(b, d, 28).indexOf("http://ns.adobe.com/xap/1.0/") === 0) found.push({ kind: "XMP", detail: "Adobe XMP packet" });
        else if (ascii(b, d, 29).indexOf("http://ns.adobe.com/xmp/extens") === 0) found.push({ kind: "XMP", detail: "extended XMP" });
      } else if (m === 0xed) {
        if (ascii(b, d, 13) === "Photoshop 3.0") found.push({ kind: "IPTC", detail: "Photoshop/IPTC resources (8BIM)" });
      } else if (m === 0xe2 && ascii(b, d, 11) === "ICC_PROFILE") found.push(iccFinding(iccDescription(b, d + 14, dl - 14), dl - 14));
      else if (m === 0xfe) found.push({ kind: "COMMENT", detail: "JPEG comment" });
      else if (m === 0xe0 && ascii(b, d, 4) === "JFXX") found.push({ kind: "THUMBNAIL", detail: "JFIF extension thumbnail" });
      else if (m === 0xe3 || m === 0xe4 || m === 0xe5 || m === 0xe6 || m === 0xe7 || m === 0xe8 || m === 0xe9 || m === 0xea || m === 0xeb || m === 0xec || m === 0xee || m === 0xef) {
        var tag = ascii(b, d, 8).replace(/[^\x20-\x7e]/g, "").trim();
        if (m === 0xee && tag.indexOf("Adobe") === 0) { /* Adobe colour transform marker: technical, not personal */ } else found.push({ kind: "APP" + (m - 0xe0), detail: tag || "application segment" });
      }
      i += 2 + len;
    }
    return { format: "jpeg", found: dedupe(found), animated: animated, orientation: orientation, gps: gps };
  }

  function scanPng(b) {
    var found = [], i = 8, animated = false;
    while (i + 12 <= b.length) {
      var len = u32(b, i, false), type = ascii(b, i + 4, 4), d = i + 8;
      if (type === "eXIf") { var ex = parseExif(b, d, len); found.push({ kind: "EXIF", detail: ex.tags.concat(ex.gps ? ["GPS location"] : []).join(", ") || "camera/technical tags" }); }
      else if (type === "tEXt" || type === "zTXt") found.push({ kind: "TEXT", detail: "text chunk “" + ascii(b, d, Math.min(len, 40)).split("\0")[0] + "”" });
      else if (type === "iTXt") { var kw = ascii(b, d, Math.min(len, 40)).split("\0")[0]; found.push({ kind: kw === "XML:com.adobe.xmp" ? "XMP" : "TEXT", detail: kw === "XML:com.adobe.xmp" ? "Adobe XMP packet" : "text chunk “" + kw + "”" }); }
      else if (type === "tIME") found.push({ kind: "TIME", detail: "last-modified time" });
      else if (type === "iCCP") found.push(iccFinding("", len));
      else if (type === "acTL") animated = true;
      if (type === "IEND" || len > b.length) break;
      i += 12 + len;
    }
    return { format: "png", found: dedupe(found), animated: animated, orientation: null, gps: found.some(function (f) { return /GPS/.test(f.detail); }) };
  }

  function scanWebp(b) {
    var found = [], animated = false, i = 12;
    while (i + 8 <= b.length) {
      var type = ascii(b, i, 4), len = u32(b, i + 4, true), d = i + 8;
      if (type === "VP8X") { var fl = b[d]; if (fl & 0x02) animated = true; }
      else if (type === "EXIF") { var ex = parseExif(b, d + (ascii(b, d, 6) === "Exif\0\0" ? 6 : 0), len); found.push({ kind: "EXIF", detail: ex.tags.concat(ex.gps ? ["GPS location"] : []).join(", ") || "camera/technical tags" }); }
      else if (type === "XMP ") found.push({ kind: "XMP", detail: "Adobe XMP packet" });
      else if (type === "ICCP") found.push(iccFinding(iccDescription(b, d, len), len));
      else if (type === "ANIM" || type === "ANMF") animated = true;
      i += 8 + len + (len & 1);
    }
    return { format: "webp", found: dedupe(found), animated: animated, orientation: null, gps: found.some(function (f) { return /GPS/.test(f.detail); }) };
  }

  function scanGif(b) {
    var found = [], frames = 0, i = 13;
    if (b[10] & 0x80) i += 3 * (1 << ((b[10] & 7) + 1));
    function skipSub(p) { while (p < b.length && b[p] !== 0) p += b[p] + 1; return p + 1; }
    while (i < b.length) {
      var t = b[i];
      if (t === 0x3b) break;
      if (t === 0x21) {
        var label = b[i + 1];
        if (label === 0xfe) found.push({ kind: "COMMENT", detail: "GIF comment" });
        if (label === 0xff && ascii(b, i + 3, 11).indexOf("XMP Data") === 0) found.push({ kind: "XMP", detail: "Adobe XMP packet" });
        i = skipSub(i + 2 + (label === 0xff ? 1 + b[i + 2] : 0));
        if (label === 0xff) i = i; // application extension: header block then sub-blocks
      } else if (t === 0x2c) {
        frames++;
        var packed = b[i + 9];
        i += 10; if (packed & 0x80) i += 3 * (1 << ((packed & 7) + 1));
        i++; i = skipSub(i);
      } else break;
    }
    return { format: "gif", found: dedupe(found), animated: frames > 1, orientation: null, gps: false };
  }

  function dedupe(list) {
    var seen = {}, out = [];
    list.forEach(function (f) { var k = f.kind + "|" + f.detail; if (!seen[k]) { seen[k] = 1; out.push(f); } });
    return out;
  }

  /* Raw signature search used on every output regardless of container: catches metadata hiding in unexpected places. */
  var NEEDLES = [["EXIF", "Exif\0\0"], ["XMP", "http://ns.adobe.com/xap/1.0/"], ["XMP", "<x:xmpmeta"], ["XMP", "XML:com.adobe.xmp"], ["IPTC", "Photoshop 3.0"], ["IPTC", "8BIM"], ["EXIF", "eXIf"]];
  function sniffSignatures(b) {
    var hits = [];
    NEEDLES.forEach(function (nd) {
      var n = nd[1], len = n.length, first = n.charCodeAt(0);
      outer: for (var i = 0; i + len <= b.length; i++) {
        if (b[i] !== first) continue;
        for (var j = 1; j < len; j++) if (b[i + j] !== n.charCodeAt(j)) continue outer;
        hits.push(nd[0] + " signature “" + n.replace(/\0/g, "") + "”"); break;
      }
    });
    return hits;
  }

  function sniffFormat(b) {
    if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
    if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 3) === "PNG") return "png";
    if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "webp";
    if (b.length >= 6 && ascii(b, 0, 3) === "GIF") return "gif";
    if (b.length >= 12 && ascii(b, 4, 4) === "ftyp") { var brand = ascii(b, 8, 4); return /^(avif|avis)$/.test(brand) ? "avif" : /^(heic|heix|hevc|mif1|msf1)$/.test(brand) ? "heic" : "isobmff"; }
    if (b.length >= 4 && ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a) || (b[0] === 0x4d && b[1] === 0x4d && b[3] === 0x2a))) return "tiff";
    if (b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d) return "bmp";
    var head = ascii(b, 0, 300).toLowerCase();
    if (head.indexOf("<svg") > -1 || (head.indexOf("<?xml") === 0 && head.indexOf("svg") > -1)) return "svg";
    return "unknown";
  }

  /* Personal-data findings: everything except a standard colour profile (browsers add an sRGB profile themselves; it identifies nobody). */
  function personalFindings(scan) { return scan.found.filter(function (f) { return f.kind !== "ICC" || !f.standard; }); }
  function iccOf(scan) { return scan.found.filter(function (f) { return f.kind === "ICC"; })[0] || null; }
  function scanMetadata(b) {
    var fmt = sniffFormat(b), r;
    if (fmt === "jpeg") r = scanJpeg(b);
    else if (fmt === "png") r = scanPng(b);
    else if (fmt === "webp") r = scanWebp(b);
    else if (fmt === "gif") r = scanGif(b);
    else r = { format: fmt, found: [], animated: false, orientation: null, gps: false, unscanned: true };
    r.signatures = sniffSignatures(b);
    return r;
  }

  /* ---------- ZIP writer (method 0 / stored: images are already compressed; no dependency needed) ---------- */
  var CRC_TABLE = null;
  function crc32(b) {
    if (!CRC_TABLE) { CRC_TABLE = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ c >>> 1 : c >>> 1; CRC_TABLE[n] = c >>> 0; } }
    var crc = 0xffffffff;
    for (var i = 0; i < b.length; i++) crc = CRC_TABLE[(crc ^ b[i]) & 0xff] ^ crc >>> 8;
    return (crc ^ 0xffffffff) >>> 0;
  }
  function utf8(s) { return typeof TextEncoder !== "undefined" ? new TextEncoder().encode(s) : Uint8Array.from(unescape(encodeURIComponent(s)), function (c) { return c.charCodeAt(0); }); }
  function buildZip(files, when) {
    var d = when instanceof Date ? when : new Date(), used = {}, parts = [], central = [], offset = 0;
    var dosTime = d.getHours() << 11 | d.getMinutes() << 5 | d.getSeconds() >> 1;
    var dosDate = Math.max(0, d.getFullYear() - 1980) << 9 | (d.getMonth() + 1) << 5 | d.getDate();
    if (files.length > 65535) throw new Error("Too many files for one ZIP (limit 65,535).");
    files.forEach(function (f) {
      var name = utf8(uniqueName(String(f.name).replace(/[\\/]/g, "_"), used)), data = f.data, crc = crc32(data);
      if (data.length > 0xffffffff - 1024 || offset > 0xffffffff - 1024) throw new Error("The ZIP would exceed 4 GB. Export in smaller batches.");
      var local = new Uint8Array(30 + name.length), lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true); lv.setUint16(8, 0, true);
      lv.setUint16(10, dosTime, true); lv.setUint16(12, dosDate, true); lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true); lv.setUint16(26, name.length, true); lv.setUint16(28, 0, true);
      local.set(name, 30);
      var cen = new Uint8Array(46 + name.length), cv = new DataView(cen.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true);
      cv.setUint16(12, dosTime, true); cv.setUint16(14, dosDate, true); cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, name.length, true);
      cv.setUint32(42, offset, true); cen.set(name, 46);
      parts.push(local, data); central.push(cen); offset += local.length + data.length;
    });
    var cenSize = central.reduce(function (s, c) { return s + c.length; }, 0), end = new Uint8Array(22), ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, cenSize, true); ev.setUint32(16, offset, true);
    var all = parts.concat(central, [end]), total = all.reduce(function (s, p) { return s + p.length; }, 0), out = new Uint8Array(total), pos = 0;
    all.forEach(function (p) { out.set(p, pos); pos += p.length; });
    return out;
  }

  /* ---------- browser: encoder detection, decode, encode ---------- */
  var encoderCache = null;
  function canvasEncodes(mime) {
    return new Promise(function (resolve) {
      try {
        var c = document.createElement("canvas"); c.width = c.height = 2;
        var ctx = c.getContext("2d"); ctx.fillStyle = "#c33"; ctx.fillRect(0, 0, 2, 2);
        var done = false, t = setTimeout(function () { if (!done) { done = true; resolve(false); } }, 4000);
        c.toBlob(function (blob) { if (done) return; done = true; clearTimeout(t); resolve(!!blob && blob.type === mime && blob.size > 0); }, mime, 0.8);
      } catch (e) { resolve(false); }
    });
  }
  /* Returns { "image/jpeg": bool, ..., "image/avif": bool, avifNative: bool, avifWasm: bool }.
     WebP/JPEG/PNG come from the browser's own canvas encoder. Most browsers cannot encode AVIF natively, so AVIF falls back to the
     bundled WebAssembly encoder when WebAssembly and module workers are available. */
  function detectEncoders() {
    if (encoderCache) return encoderCache;
    var mimes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    encoderCache = Promise.all(mimes.map(canvasEncodes)).then(function (r) {
      var o = {}; mimes.forEach(function (m, i) { o[m] = r[i]; });
      o.avifNative = o["image/avif"];
      o.avifWasm = !o.avifNative && typeof WebAssembly === "object" && typeof Worker === "function" && !!SCRIPT_URL;
      o["image/avif"] = o.avifNative || o.avifWasm;
      return o;
    });
    return encoderCache;
  }

  /* ---------- AVIF through the bundled WebAssembly encoder (module worker) ---------- */
  var avifWorker = null, avifJobs = {}, avifSeq = 0, avifReady = null;
  function startAvifWorker() {
    if (avifReady) return avifReady;
    avifReady = new Promise(function (resolve, reject) {
      var w;
      try { w = new Worker(new URL("fm-avif-worker.js", SCRIPT_URL).href, { type: "module" }); } catch (e) { avifReady = null; return reject(new Error("This browser cannot start the AVIF encoder (module workers unavailable).")); }
      var settled = false, timer = setTimeout(function () { if (!settled) { settled = true; try { w.terminate(); } catch (e) { /* gone */ } avifReady = null; reject(new Error("The AVIF encoder did not start (it may not be cached for offline use yet).")); } }, 30000);
      w.onmessage = function (e) {
        var m = e.data;
        if (m && m.ready) { if (!settled) { settled = true; clearTimeout(timer); avifWorker = w; resolve(w); } return; }
        var job = avifJobs[m.id]; if (!job) return; delete avifJobs[m.id];
        if (m.ok) job.resolve(m.buffer); else job.reject(new Error(m.error || "AVIF encoding failed."));
      };
      w.onerror = function (ev) {
        var err = new Error("The AVIF encoder failed to load" + (ev && ev.message ? ": " + ev.message : "."));
        if (!settled) { settled = true; clearTimeout(timer); avifReady = null; reject(err); }
        Object.keys(avifJobs).forEach(function (k) { avifJobs[k].reject(err); delete avifJobs[k]; });
      };
    });
    return avifReady;
  }
  function stopAvifWorker() {
    if (avifWorker) { try { avifWorker.terminate(); } catch (e) { /* gone */ } }
    avifWorker = null; avifReady = null;
    Object.keys(avifJobs).forEach(function (k) { avifJobs[k].reject(new Error("AVIF encoding was cancelled.")); delete avifJobs[k]; });
  }
  function encodeAvif(canvas, quality) {
    var ctx = canvas.getContext("2d"), img;
    try { img = ctx.getImageData(0, 0, canvas.width, canvas.height); } catch (e) { return Promise.reject(new Error("Could not read the pixels for AVIF encoding (image too large for memory?).")); }
    return startAvifWorker().then(function (w) {
      return new Promise(function (resolve, reject) {
        var id = ++avifSeq; avifJobs[id] = { resolve: resolve, reject: reject };
        var buf = img.data.buffer;
        w.postMessage({ id: id, buffer: buf, width: canvas.width, height: canvas.height, quality: Math.max(1, Math.min(100, Math.round((quality == null ? 0.8 : quality) * 100))), speed: 8 }, [buf]);
      });
    }).then(function (buf) { return new Blob([buf], { type: "image/avif" }); });
  }

  /* Decode a File/Blob into something drawable. EXIF orientation is applied by the browser's own decoder, so the pixels we
     draw are already upright; the exported file then carries no orientation tag at all. */
  function decodeImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) { URL.revokeObjectURL(url); return reject(new Error("The browser decoded this file but it has no pixel size.")); }
        if (w * h > limits.maxPixels) { URL.revokeObjectURL(url); return reject(new Error("This image is " + w + "×" + h + " (" + (w * h / 1e6).toFixed(1) + " megapixels), larger than the " + Math.round(limits.maxPixels / 1e6) + " MP this tool will decode safely. Resize it first, or split the batch.")); }
        resolve({ source: img, width: w, height: h, close: function () { img.src = ""; URL.revokeObjectURL(url); } });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("This browser cannot decode this file as an image.")); };
      img.decoding = "async";
      img.src = url;
    });
  }

  function toBlob(canvas, mime, quality) {
    return new Promise(function (resolve, reject) {
      try { canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error("The browser could not encode this image (it may be too large for memory).")); }, mime, quality); }
      catch (e) { reject(e); }
    });
  }

  /* Draw into a fresh canvas (optionally resized) and encode. `flatten` paints a white background for formats without alpha. */
  function renderEncode(decoded, mime, opts) {
    opts = opts || {};
    var w = decoded.width, h = decoded.height, scale = 1;
    if (opts.maxWidth && w > opts.maxWidth) scale = Math.min(scale, opts.maxWidth / w);
    if (opts.maxHeight && h > opts.maxHeight) scale = Math.min(scale, opts.maxHeight / h);
    var tw = Math.max(1, Math.round(w * scale)), th = Math.max(1, Math.round(h * scale));
    var canvas = document.createElement("canvas"); canvas.width = tw; canvas.height = th;
    var ctx = canvas.getContext("2d");
    if (!ctx) return Promise.reject(new Error("Could not allocate a drawing surface for this image."));
    if (opts.flatten) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, tw, th); }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(decoded.source, 0, 0, tw, th);
    var enc = mime === "image/avif" && opts.avifWasm ? encodeAvif(canvas, opts.quality) : toBlob(canvas, mime, opts.quality);
    return enc.then(function (blob) { canvas.width = canvas.height = 0; return { blob: blob, width: tw, height: th }; }, function (e) { canvas.width = canvas.height = 0; throw e; });
  }

  function readBytes(blob) {
    if (blob.arrayBuffer) return blob.arrayBuffer().then(function (b) { return new Uint8Array(b); });
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(new Uint8Array(r.result)); }; r.onerror = rej; r.readAsArrayBuffer(blob); });
  }

  return {
    limits: limits, formatBytes: formatBytes, percentSaved: percentSaved, savingsLabel: savingsLabel, outputName: outputName, safeBaseName: safeBaseName,
    uniqueName: uniqueName, scanMetadata: scanMetadata, personalFindings: personalFindings, iccOf: iccOf, iccDescription: iccDescription, sniffFormat: sniffFormat, sniffSignatures: sniffSignatures, crc32: crc32, buildZip: buildZip,
    detectEncoders: detectEncoders, stopAvifWorker: stopAvifWorker, decodeImage: decodeImage, renderEncode: renderEncode, readBytes: readBytes, EXT: EXT
  };
});
