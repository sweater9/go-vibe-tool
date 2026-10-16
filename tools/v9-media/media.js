const $ = (s) => document.querySelector(s);
const titles = {
  "cubic-bezier": "Cubic-Bezier Easing Curve",
  "screenshot-beautifier": "Screenshot Beautifier & 3D Mockup",
  "pdf-signer": "PDF Signer & Document Flattener",
  "offline-ocr": "Offline Image-to-Text OCR",
  "silence-stripper": "Silence Stripper & Audio Leveler",
  "video-gif-trimmer": "Watermark-Free Video/GIF Trimmer",
};
const id = new URL(location.href).searchParams.get("tool") || "cubic-bezier";
const root = $("#tool"),
  status = $("#status"),
  downloads = $("#downloads");
const urls = new Set();
let controller,
  cleanups = [],
  busy = false;
const say = (text) => {
  status.textContent = text;
};
function url(blob) {
  const u = URL.createObjectURL(blob);
  urls.add(u);
  return u;
}
function release() {
  for (const u of urls) URL.revokeObjectURL(u);
  urls.clear();
}
function output(blob, name) {
  const a = document.createElement("a");
  a.href = url(blob);
  a.download = name;
  a.textContent = `Download ${name} (${Math.ceil(blob.size / 1024)} KB)`;
  downloads.append(a);
}
function field(name, label, type = "number", value = "", extra = "") {
  return `<label for="${name}">${label}<input id="${name}" type="${type}" value="${value}" ${extra}></label>`;
}
function number(name, min, max) {
  const value = $("#" + name).value.trim(),
    n = Number(value);
  if (!value || !Number.isFinite(n) || n < min || n > max)
    throw Error(`${name}: choose a value from ${min} to ${max}.`);
  return n;
}
function selectFile(selector, maxMB = 25) {
  const f = $(selector).files[0];
  if (!f) throw Error("Choose a file first.");
  if (f.size > maxMB * 1024 * 1024)
    throw Error(`File exceeds the ${maxMB} MB limit.`);
  return f;
}
function canvas(w, h) {
  if (w * h > 16000000 || w < 1 || h < 1)
    throw Error("Image exceeds the 16 megapixel limit.");
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function blob(c, type = "image/png") {
  return new Promise((resolve, reject) =>
    c.toBlob(
      (b) => (b ? resolve(b) : reject(Error("Image export failed."))),
      type,
    ),
  );
}
async function image(f) {
  const b = await createImageBitmap(f);
  if (b.width * b.height > 16000000) {
    b.close();
    throw Error("Image exceeds 16 megapixels.");
  }
  return b;
}
function check() {
  if (controller?.signal.aborted)
    throw new DOMException("Cancelled", "AbortError");
}
async function task(fn) {
  if (busy) return;
  busy = true;
  release();
  downloads.replaceChildren();
  controller = new AbortController();
  $("#cancel").hidden = false;
  root
    .querySelectorAll("button,input,select,textarea")
    .forEach((e) => (e.disabled = true));
  say("Processing locally…");
  try {
    await fn();
  } catch (e) {
    say(
      e.name === "AbortError"
        ? "Cancelled."
        : `Could not complete: ${e.message}`,
    );
  } finally {
    busy = false;
    $("#cancel").hidden = true;
    root
      .querySelectorAll("button,input,select,textarea")
      .forEach((e) => (e.disabled = false));
  }
}
$("#cancel").onclick = () => {
  controller?.abort();
};
window.addEventListener("pagehide", () => {
  controller?.abort();
  for (const fn of [...cleanups].reverse()) {
    try {
      fn();
    } catch {
      /* Continue releasing independent resources. */
    }
  }
  release();
});
for (const [key, title] of Object.entries(titles)) {
  const a = document.createElement("a");
  a.href = "?tool=" + key;
  a.textContent = title;
  if (key === id) a.setAttribute("aria-current", "page");
  $("#nav").append(a);
}
$("#title").textContent = titles[id] || "Unknown tool";
document.title = $("#title").textContent + " · GoVibeTool";
const scriptCache = new Map();
function script(path) {
  if (!scriptCache.has(path))
    scriptCache.set(
      path,
      new Promise((res, rej) => {
        const e = document.createElement("script");
        e.src = path;
        e.onload = res;
        e.onerror = () => {
          scriptCache.delete(path);
          e.remove();
          rej(
            Error(
              "Local dependency unavailable. Prepare offline assets while online.",
            ),
          );
        };
        document.head.append(e);
      }),
    );
  return scriptCache.get(path);
}
const pause = () => new Promise((r) => setTimeout(r, 0));
function abortable(promise) {
  const signal = controller.signal;
  check();
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException("Cancelled", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}
/* Cheap, element-free duration for RIFF/WAVE so the limit check never depends on media-element events. */
async function wavDuration(file) {
  const head = new DataView(await file.slice(0, 4096).arrayBuffer());
  const tag = (o) =>
    o + 4 <= head.byteLength
      ? String.fromCharCode(...new Uint8Array(head.buffer, o, 4))
      : "";
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") return NaN;
  let byteRate = 0;
  for (let o = 12; o + 8 <= head.byteLength; ) {
    const size = head.getUint32(o + 4, true);
    if (tag(o) === "fmt " && o + 20 <= head.byteLength)
      byteRate = head.getUint32(o + 16, true);
    if (tag(o) === "data" && byteRate)
      return Math.min(size, file.size - o - 8) / byteRate;
    o += 8 + size + (size & 1);
  }
  return NaN;
}
/* Best-effort metadata probe. The element is attached because some engines (WebKit) never
   load media for detached elements. Resolves NaN, never hangs, when the engine will not say. */
async function audioDuration(file) {
  const wav = await wavDuration(file);
  if (Number.isFinite(wav)) return wav;
  const probe = document.createElement("audio"),
    u = URL.createObjectURL(file);
  let timer;
  probe.hidden = true;
  probe.muted = true;
  document.body.append(probe);
  try {
    return await abortable(
      new Promise((resolve) => {
        probe.onloadedmetadata = () => resolve(probe.duration);
        probe.onerror = () => resolve(NaN);
        timer = setTimeout(() => resolve(NaN), 4000);
        probe.preload = "metadata";
        probe.src = u;
        probe.load();
      }),
    );
  } finally {
    clearTimeout(timer);
    probe.pause();
    probe.removeAttribute("src");
    probe.load();
    probe.remove();
    URL.revokeObjectURL(u);
  }
}

function curve() {
  root.innerHTML =
    '<p>Numeric controls support keyboard and touch. CSS permits Y overshoot; X must stay within 0–1.</p><div class="row">' +
    field("x1", "Control 1 X", "number", ".25", 'min="0" max="1" step=".01"') +
    field("y1", "Control 1 Y", "number", ".1", 'step=".01"') +
    field("x2", "Control 2 X", "number", ".25", 'min="0" max="1" step=".01"') +
    field("y2", "Control 2 Y", "number", "1", 'step=".01"') +
    '</div><label for="preset">Preset<select id="preset"><option value=".25,.1,.25,1">Ease</option><option value="0,0,1,1">Linear</option><option value=".42,0,1,1">Ease in</option><option value="0,0,.58,1">Ease out</option><option value=".68,-.6,.32,1.6">Overshoot</option></select></label><svg viewBox="-30 -90 360 480" role="img" aria-label="Timing curve: horizontal progress, vertical output"><line x1="0" y1="300" x2="300" y2="0"/><path id="curve"/><circle id="c1" r="6"/><circle id="c2" r="6"/></svg><label for="css">CSS timing function<textarea id="css" readonly></textarea></label>' +
    field(
      "progress",
      "Sample progress",
      "range",
      ".5",
      'min="0" max="1" step=".01"',
    ) +
    '<p id="sample"></p><button id="animate">Preview animation</button><div id="motion" aria-label="Animation preview"></div><button id="copy">Copy CSS</button>';
  let animation;
  cleanups.push(() => animation?.cancel());
  function values() {
    return ["x1", "y1", "x2", "y2"].map((k) =>
      number(k, k[0] === "x" ? 0 : -10, k[0] === "x" ? 1 : 10),
    );
  }
  function draw() {
    try {
      const a = values();
      $("#css").value = GVTV9.bezier(...a);
      $("#curve").setAttribute(
        "d",
        `M0 300 C${a[0] * 300} ${300 - a[1] * 300} ${a[2] * 300} ${300 - a[3] * 300} 300 0`,
      );
      for (let i = 0; i < 2; i++) {
        const c = $("#c" + (i + 1));
        c.setAttribute("cx", a[i * 2] * 300);
        c.setAttribute("cy", 300 - a[i * 2 + 1] * 300);
      }
      $("#sample").textContent =
        "Output at " +
        $("#progress").value +
        ": " +
        GVTV9.bezierAt(Number($("#progress").value), ...a).toFixed(4);
      say("Valid CSS curve.");
    } catch (e) {
      say(e.message);
    }
  }
  root.querySelectorAll("input").forEach((e) => (e.oninput = draw));
  $("#preset").onchange = () => {
    $("#preset")
      .value.split(",")
      .forEach((v, i) => ($("#" + ["x1", "y1", "x2", "y2"][i]).value = v));
    draw();
  };
  $("#animate").onclick = () => {
    try {
      animation?.cancel();
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        say(
          "Animation skipped because reduced motion is enabled. Use the progress slider.",
        );
        return;
      }
      animation = $("#motion").animate(
        [
          { transform: "translateX(0)" },
          { transform: `translateX(${Math.max(0, root.clientWidth - 40)}px)` },
        ],
        { duration: 1500, easing: GVTV9.bezier(...values()), fill: "forwards" },
      );
    } catch (e) {
      say(e.message);
    }
  };
  $("#copy").onclick = async () => {
    try {
      await navigator.clipboard.writeText($("#css").value);
      say("CSS copied.");
    } catch {
      $("#css").select();
      say("Select and copy the CSS manually.");
    }
  };
  draw();
}

function screenshot() {
  root.innerHTML =
    "<p>PNG/JPEG/WebP input. Export contains the screenshot pixels plus your selected frame, background, shadow and perspective. The 3D mockup is a perspective projection, not a device model.</p>" +
    field(
      "file",
      "Screenshot",
      "file",
      "",
      'accept="image/png,image/jpeg,image/webp"',
    ) +
    '<div class="row">' +
    field("background", "Background", "color", "#2b5179") +
    field("padding", "Padding (px)", "number", "60", 'min="0" max="200"') +
    field("radius", "Corner radius (px)", "number", "18", 'min="0" max="100"') +
    field("yaw", "3D turn (degrees)", "range", "0", 'min="-40" max="40"') +
    field("tilt", "3D tilt (degrees)", "range", "0", 'min="-25" max="25"') +
    '</div><label for="frame">Frame<select id="frame"><option value="browser">Browser window</option><option value="plain">Plain screenshot</option></select></label><button id="render">Render PNG</button><div id="preview"></div>';
  $("#render").onclick = () =>
    task(async () => {
      const im = await image(selectFile("#file"));
      try {
        const pad = number("padding", 0, 200),
          scale = Math.min(1, 1600 / im.width, 1600 / im.height),
          w = Math.round(im.width * scale),
          h = Math.round(im.height * scale),
          bar = $("#frame").value === "browser" ? 36 : 0;
        const source = canvas(w, h + bar),
          sx = source.getContext("2d");
        sx.fillStyle = "#edf1f5";
        sx.beginPath();
        sx.roundRect(0, 0, w, h + bar, number("radius", 0, 100));
        sx.clip();
        sx.fillRect(0, 0, w, h + bar);
        sx.drawImage(im, 0, bar, w, h);
        if (bar) {
          ["#e86464", "#e1bb55", "#68b178"].forEach((color, i) => {
            sx.fillStyle = color;
            sx.beginPath();
            sx.arc(16 + i * 20, 18, 5, 0, Math.PI * 2);
            sx.fill();
          });
        }
        const out = canvas(w + pad * 2 + 180, h + bar + pad * 2 + 180),
          ctx = out.getContext("2d");
        ctx.fillStyle = $("#background").value;
        ctx.fillRect(0, 0, out.width, out.height);
        const yaw = (number("yaw", -40, 40) * Math.PI) / 180,
          tilt = (number("tilt", -25, 25) * Math.PI) / 180,
          W = source.width,
          H = source.height;
        function project(x, y) {
          x -= W / 2;
          y -= H / 2;
          const xx = x * Math.cos(yaw),
            z = -x * Math.sin(yaw) + y * Math.sin(tilt),
            yy = y * Math.cos(tilt),
            p = 2400 / (2400 + z);
          return [out.width / 2 + xx * p, out.height / 2 + yy * p];
        }
        const corners = [
          [0, 0],
          [W, 0],
          [W, H],
          [0, H],
        ].map(([x, y]) => project(x, y));
        ctx.save();
        ctx.shadowColor = "#0009";
        ctx.shadowBlur = 25;
        ctx.shadowOffsetY = 15;
        ctx.beginPath();
        corners.forEach(([x, y], i) =>
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y),
        );
        ctx.closePath();
        ctx.fillStyle = "#172536";
        ctx.fill();
        ctx.restore();
        // Tessellated affine triangles approximate a perspective plane in the exported pixels.
        function triangle(src, dst) {
          ctx.save();
          ctx.beginPath();
          dst.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.closePath();
          ctx.clip();
          const [a, b, c] = src,
            [A, B, C] = dst;
          const det =
            (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
          const m =
              ((B[0] - A[0]) * (c[1] - a[1]) - (C[0] - A[0]) * (b[1] - a[1])) /
              det,
            n =
              ((B[1] - A[1]) * (c[1] - a[1]) - (C[1] - A[1]) * (b[1] - a[1])) /
              det,
            p =
              ((C[0] - A[0]) * (b[0] - a[0]) - (B[0] - A[0]) * (c[0] - a[0])) /
              det,
            q =
              ((C[1] - A[1]) * (b[0] - a[0]) - (B[1] - A[1]) * (c[0] - a[0])) /
              det;
          ctx.transform(
            m,
            n,
            p,
            q,
            A[0] - m * a[0] - p * a[1],
            A[1] - n * a[0] - q * a[1],
          );
          ctx.drawImage(source, 0, 0);
          ctx.restore();
        }
        for (let y = 0; y < 16; y++)
          for (let x = 0; x < 16; x++) {
            const a = [(x * W) / 16, (y * H) / 16],
              b = [((x + 1) * W) / 16, (y * H) / 16],
              c = [((x + 1) * W) / 16, ((y + 1) * H) / 16],
              d = [(x * W) / 16, ((y + 1) * H) / 16];
            for (const t of [
              [a, b, c],
              [a, c, d],
            ])
              triangle(
                t,
                t.map(([u, v]) => project(u, v)),
              );
          }
        check();
        $("#preview").replaceChildren(out);
        output(await blob(out), "screenshot-mockup.png");
        say(
          `Exported ${out.width} × ${out.height} PNG. Large inputs are scaled to fit 1600 px.`,
        );
      } finally {
        im.close();
      }
    });
}

async function pdfEngine() {
  const pdf = await import("./vendor/pdf/pdf.min.mjs");
  pdf.GlobalWorkerOptions.workerSrc = new URL(
    "./vendor/pdf/pdf.worker.min.mjs",
    import.meta.url,
  ).href;
  await script("../../vendor/pdf-lib.min.js");
  return pdf;
}
function pdfTool() {
  root.innerHTML =
    '<p class="warning">A visible signature is an image of handwriting or typed text. It is NOT a cryptographic digital signature, identity verification, or proof of consent. Editing invalidates existing digital signatures. Work on a copy.</p><p>Export raster-flattens every page at 1.5×: visible annotations and forms become pixels; selectable text, links, forms, layers and accessibility structure are lost. This is not certified redaction. Encrypted PDFs are unsupported. Limit: 20 MB, 20 pages, 40 million rendered pixels in total.</p>' +
    field("file", "PDF document", "file", "", 'accept="application/pdf"') +
    '<button id="loadPdf">Load PDF preview</button><div class="row">' +
    field("page", "Page to sign", "number", "1", 'min="1" max="20"') +
    field("sigX", "Left (% of page)", "number", "10", 'min="0" max="95"') +
    field("sigY", "Top (% of page)", "number", "75", 'min="0" max="95"') +
    field(
      "sigWidth",
      "Signature width (% of page)",
      "number",
      "30",
      'min="5" max="80"',
    ) +
    '</div><p>Draw using a pointer, or type a name with the keyboard. Placement percentages refer to the displayed page, including rotation.</p><canvas id="signature" width="600" height="160" aria-label="Draw a visible signature. Keyboard alternative: type a name below."></canvas>' +
    field(
      "sigName",
      "Typed signature (alternative to drawing)",
      "text",
      "",
      'maxlength="100"',
    ) +
    '<button id="typeSignature">Use typed name</button><button id="clearSignature">Clear signature</button><label for="addSig">Add the visible signature<input type="checkbox" id="addSig" checked></label><button id="previewPdf">Update placement preview</button><button id="exportPdf">Export flattened PDF</button><div id="preview"></div>';
  const sig = $("#signature"),
    ctx = sig.getContext("2d");
  ctx.strokeStyle = "#15253b";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  let drawn = false,
    drawing = false,
    doc,
    loading;
  const dispose = () => {
    loading?.destroy();
    doc?.destroy();
    doc = null;
  };
  cleanups.push(dispose);
  const point = (e) => {
    const r = sig.getBoundingClientRect();
    return [
      ((e.clientX - r.left) * sig.width) / r.width,
      ((e.clientY - r.top) * sig.height) / r.height,
    ];
  };
  sig.onpointerdown = (e) => {
    drawing = true;
    sig.setPointerCapture(e.pointerId);
    ctx.beginPath();
    ctx.moveTo(...point(e));
  };
  sig.onpointermove = (e) => {
    if (drawing) {
      ctx.lineTo(...point(e));
      ctx.stroke();
      drawn = true;
    }
  };
  sig.onpointerup = sig.onpointercancel = () => (drawing = false);
  $("#clearSignature").onclick = () => {
    ctx.clearRect(0, 0, sig.width, sig.height);
    drawn = false;
  };
  $("#typeSignature").onclick = () => {
    ctx.clearRect(0, 0, sig.width, sig.height);
    ctx.font = "italic 48px serif";
    ctx.fillStyle = "#15253b";
    const text = $("#sigName").value.trim();
    ctx.fillText(text, 12, 100, 576);
    drawn = !!text;
  };
  $("#file").onchange = () => {
    dispose();
    $("#preview").replaceChildren();
    say("Load the newly selected PDF.");
  };
  async function render(pageNumber) {
    if (!doc) throw Error("Load a PDF first.");
    const page = await doc.getPage(pageNumber),
      vp = page.getViewport({ scale: 1.5 }),
      c = canvas(Math.ceil(vp.width), Math.ceil(vp.height));
    const render = page.render({
      canvasContext: c.getContext("2d"),
      viewport: vp,
      annotationMode: 3,
    });
    const abort = () => render.cancel();
    controller.signal.addEventListener("abort", abort, { once: true });
    try {
      await render.promise;
      check();
    } finally {
      controller.signal.removeEventListener("abort", abort);
    }
    return { c, vp };
  }
  function stamp(c) {
    if (!$("#addSig").checked) return;
    if (!drawn)
      throw Error(
        "Draw or type a signature, or untick “Add the visible signature”.",
      );
    const x = (number("sigX", 0, 95) / 100) * c.width,
      y = (number("sigY", 0, 95) / 100) * c.height,
      w = (number("sigWidth", 5, 80) / 100) * c.width,
      h = (w * sig.height) / sig.width;
    if (x + w > c.width || y + h > c.height)
      throw Error(
        "Signature extends outside the page. Reduce its size or adjust placement.",
      );
    c.getContext("2d").drawImage(sig, x, y, w, h);
  }
  async function preview() {
    const n = number("page", 1, doc?.numPages || 20);
    if (!Number.isInteger(n)) throw Error("Page must be an integer.");
    const { c } = await render(n);
    if (drawn && $("#addSig").checked) stamp(c);
    $("#preview").replaceChildren(c);
    say(`Page ${n} of ${doc.numPages}. Check placement before exporting.`);
  }
  $("#loadPdf").onclick = () =>
    task(async () => {
      dispose();
      const pdf = await pdfEngine();
      loading = pdf.getDocument({
        data: new Uint8Array(await selectFile("#file", 20).arrayBuffer()),
        isEvalSupported: false,
        cMapUrl: new URL("./vendor/pdf/cmaps/", location.href).href,
        cMapPacked: true,
        standardFontDataUrl: new URL(
          "./vendor/pdf/standard_fonts/",
          location.href,
        ).href,
      });
      loading.onPassword = () => {
        loading.destroy();
        say("Encrypted/password-protected PDFs are unsupported.");
      };
      doc = await loading.promise;
      check();
      if (doc.numPages > 20) {
        dispose();
        throw Error("PDF exceeds 20 pages.");
      }
      $("#page").max = doc.numPages;
      $("#page").value = 1;
      await preview();
    });
  $("#previewPdf").onclick = () => task(preview);
  $("#exportPdf").onclick = () =>
    task(async () => {
      if (!doc) throw Error("Load a PDF first.");
      const selected = number("page", 1, doc.numPages);
      if (!Number.isInteger(selected)) throw Error("Page must be an integer.");
      const out = await PDFLib.PDFDocument.create();
      let pixels = 0;
      for (let i = 1; i <= doc.numPages; i++) {
        check();
        say(`Flattening page ${i}/${doc.numPages}…`);
        const { c, vp } = await render(i);
        pixels += c.width * c.height;
        if (pixels > 40000000)
          throw Error("Document exceeds the 40 million rendered pixel limit.");
        if (i === selected) stamp(c);
        const png = await out.embedPng(await (await blob(c)).arrayBuffer());
        out.addPage([vp.width / 1.5, vp.height / 1.5]).drawImage(png, {
          x: 0,
          y: 0,
          width: vp.width / 1.5,
          height: vp.height / 1.5,
        });
        c.width = c.height = 1;
        await pause();
      }
      check();
      output(
        new Blob([await out.save()], { type: "application/pdf" }),
        "flattened-visible-signature.pdf",
      );
      say(
        `Exported ${doc.numPages} image-only pages. No cryptographic signature was created.`,
      );
    });
}

function ocr() {
  root.innerHTML =
    "<p>English printed text recognition runs in a local WebAssembly worker. No upload. Handwriting, rotated text and complex layouts may be inaccurate; review the editable result. Limit: 12 MB, 16 megapixels. Other languages are not bundled.</p>" +
    field(
      "file",
      "Image to recognize",
      "file",
      "",
      'accept="image/png,image/jpeg,image/webp"',
    ) +
    '<button id="recognize">Recognize text</button><label for="text">Recognized text (editable)<textarea id="text" rows="10"></textarea></label><button id="saveText">Download edited text</button><p id="confidence"></p>';
  $("#saveText").onclick = () => {
    output(
      new Blob([$("#text").value], { type: "text/plain;charset=utf-8" }),
      "recognized-text.txt",
    );
  };
  $("#recognize").onclick = () =>
    task(async () => {
      await script("./vendor/ocr/tesseract.min.js");
      const im = await image(selectFile("#file", 12));
      let worker;
      const terminate = () => worker?.terminate();
      try {
        const c = canvas(im.width, im.height);
        c.getContext("2d").drawImage(im, 0, 0);
        cleanups.push(terminate);
        worker = await Tesseract.createWorker("eng", 1, {
          workerPath: new URL("./vendor/ocr/worker.min.js", import.meta.url)
            .href,
          corePath: new URL(
            "./vendor/ocr/tesseract-core-lstm.wasm.js",
            import.meta.url,
          ).href,
          langPath: new URL("./vendor/ocr/", location.href).href,
          workerBlobURL: false,
          cacheMethod: "none",
          gzip: true,
          logger: (m) => {
            if (!controller.signal.aborted)
              say(`${m.status} ${Math.round((m.progress || 0) * 100)}%`);
          },
        });
        check();
        controller.signal.addEventListener("abort", terminate, { once: true });
        const { data } = await abortable(worker.recognize(c));
        check();
        $("#text").value = data.text;
        $("#confidence").textContent =
          `Engine confidence: ${data.confidence}% (not an accuracy guarantee).`;
        output(
          new Blob([data.text], { type: "text/plain;charset=utf-8" }),
          "recognized-text.txt",
        );
        say("Recognition complete. Review the result before using it.");
      } finally {
        cleanups = cleanups.filter((fn) => fn !== terminate);
        controller.signal.removeEventListener("abort", terminate);
        im.close();
        await worker?.terminate();
      }
    });
}

function audioTool() {
  root.innerHTML =
    "<p>Decode browser-supported audio, remove sustained quiet blocks across all channels, then apply linked peak leveling with a −1 dB ceiling and short boundary fades. Export is 16-bit PCM WAV; this is not broadcast LUFS normalization. Keep the original and listen to the result: quiet speech can be removed. Limits: 30 MB, 180 seconds, 2 channels.</p>" +
    field("file", "Audio file", "file", "", 'accept="audio/*"') +
    '<div class="row">' +
    field(
      "threshold",
      "Silence threshold (dBFS)",
      "number",
      "-40",
      'min="-90" max="0"',
    ) +
    field(
      "minSilence",
      "Minimum silence (seconds)",
      "number",
      ".3",
      'min=".02" max="10" step=".05"',
    ) +
    field(
      "padding",
      "Padding at each cut (seconds)",
      "number",
      ".04",
      'min="0" max="1" step=".01"',
    ) +
    '</div><label for="level">Apply audio leveling<input id="level" type="checkbox" checked></label><button id="process">Strip silence & export WAV</button><div id="audioPreview"></div>';
  $("#process").onclick = () =>
    task(async () => {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw Error("Web Audio is unavailable in this browser.");
      const ac = new AC();
      const close = () => {
        if (ac.state !== "closed") ac.close();
      };
      cleanups.push(close);
      try {
        const file = selectFile("#file", 30),
          duration = await audioDuration(file);
        if (Number.isFinite(duration)) {
          if (duration > 180)
            throw Error("Use audio of at most 180 seconds.");
        } else if (file.size > 12 * 1024 * 1024)
          throw Error(
            "This browser cannot report the duration of this audio file, so files over 12 MB are refused. Use a WAV file or a smaller file.",
          );
        const buffer = await abortable(
          Promise.race([
            ac.decodeAudioData(await file.arrayBuffer()),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("timeout")), 30000),
            ),
          ]).catch((e) => {
            if (e?.name === "AbortError") throw e;
            throw Error(
              "This browser could not decode this audio file (unsupported format, damaged file, or decoding stalled). Try a WAV file, or MP3/AAC/Ogg if your browser supports them.",
            );
          }),
        );
        check();
        if (buffer.duration > 180 || buffer.numberOfChannels > 2)
          throw Error("Use audio of at most 180 seconds and two channels.");
        const result = V9Media.processAudio(
          Array.from({ length: buffer.numberOfChannels }, (_, i) =>
            buffer.getChannelData(i),
          ),
          buffer.sampleRate,
          {
            threshold: number("threshold", -90, 0),
            minSilence: number("minSilence", 0.02, 10),
            pad: number("padding", 0, 1),
            level: $("#level").checked,
          },
        );
        check();
        const b = new Blob([V9Media.wav(result.channels, buffer.sampleRate)], {
          type: "audio/wav",
        });
        output(b, "leveled-trimmed.wav");
        const player = document.createElement("audio");
        player.controls = true;
        player.src = url(b);
        $("#audioPreview").replaceChildren(player);
        say(
          `Removed ${result.removed.toFixed(2)} s; result ${result.duration.toFixed(2)} s, ${result.segments} retained segment(s).`,
        );
      } finally {
        close();
        cleanups = cleanups.filter((fn) => fn !== close);
      }
    });
}

function trimmer() {
  root.innerHTML =
    "<p>No watermark is added; existing watermarks remain. GIF input → GIF preserves selected frame delays (10 ms resolution) and composites disposal/transparency. Video → WebM records the selected interval in real time, with audio where captureStream is supported. Video → GIF is silent, 10 fps, up to 10 s and 480 px. Re-encoding is not frame-exact; review the output. No MP4 export is promised. Limits: 30 MB, GIF 300 frames / 40 million decoded pixels, video interval 60 s.</p>" +
    field(
      "file",
      "Video or animated GIF",
      "file",
      "",
      'accept="video/*,image/gif"',
    ) +
    '<button id="loadMedia">Load media</button><div class="row">' +
    field("start", "Start (seconds)", "number", "0", 'min="0" step=".01"') +
    field("end", "End (seconds)", "number", "1", 'min="0" step=".01"') +
    '</div><label for="format">Export format<select id="format"><option value="webm">Video WebM (video input only)</option><option value="gif">Animated GIF (silent)</option></select></label><button id="trim">Trim & export</button><div id="mediaPreview"></div>';
  let video, frames, gif, duration, sourceURL;
  const reset = () => {
    video?.pause();
    if (video) {
      video.removeAttribute("src");
      video.load();
    }
    video = null;
    frames = null;
    gif = null;
    if (sourceURL) {
      URL.revokeObjectURL(sourceURL);
      urls.delete(sourceURL);
    }
    sourceURL = null;
  };
  cleanups.push(reset);
  $("#file").onchange = () => {
    reset();
    $("#mediaPreview").replaceChildren();
    say("Load the selected media.");
  };
  const UNDECODABLE =
    "This browser cannot decode this video (its codec or container is unsupported here, or the file is damaged). Try a WebM (VP8/VP9) or MP4 (H.264) file, use another browser, or trim an animated GIF, which needs no video decoder.";
  function event(target, name, failure = "Browser cannot decode this media.") {
    return new Promise((res, rej) => {
      const done = () => {
        clearTimeout(timer);
        target.removeEventListener(name, ok);
        target.removeEventListener("error", err);
        controller.signal.removeEventListener("abort", abort);
      };
      const ok = () => {
          done();
          res();
        },
        err = () => {
          done();
          rej(Error(failure));
        },
        abort = () => {
          done();
          rej(new DOMException("Cancelled", "AbortError"));
        };
      const timer = setTimeout(() => {
        done();
        rej(Error("Media operation timed out."));
      }, 30000);
      target.addEventListener(name, ok, { once: true });
      target.addEventListener("error", err, { once: true });
      controller.signal.addEventListener("abort", abort, { once: true });
    });
  }
  async function seek(t) {
    check();
    if (Math.abs(video.currentTime - t) < 0.001 && video.readyState >= 2)
      return;
    const pending = event(video, "seeked");
    video.currentTime = t;
    await pending;
  }
  $("#loadMedia").onclick = () =>
    task(async () => {
      reset();
      $("#mediaPreview").replaceChildren();
      try {
        const file = selectFile("#file", 30),
          header = new Uint8Array(await file.slice(0, 6).arrayBuffer());
        if (String.fromCharCode(...header).startsWith("GIF8")) {
          const G = await import("./vendor/gif.mjs");
          gif = G.parseGIF(await file.arrayBuffer());
          const list = gif.frames.filter((f) => f.image);
          if (
            !list.length ||
            list.length > 300 ||
            list.reduce(
              (n, f) =>
                n + f.image.descriptor.width * f.image.descriptor.height,
              0,
            ) > 40000000 ||
            gif.lsd.width * gif.lsd.height > 4000000
          )
            throw Error("GIF exceeds frame or pixel limits.");
          frames = G.decompressFrames(gif, true);
          frames.forEach((frame, i) => {
            frame.delay = Math.max(10, (list[i].gce?.delay ?? 10) * 10);
          });
          duration = frames.reduce(
            (s, f) => s + Math.max(10, f.delay || 100) / 1000,
            0,
          );
          $("#format").value = "gif";
          const im = document.createElement("img");
          im.alt = "Source animated GIF";
          sourceURL = URL.createObjectURL(file);
          im.src = sourceURL;
          $("#mediaPreview").replaceChildren(im);
        } else {
          video = document.createElement("video");
          video.controls = true;
          video.playsInline = true;
          video.preload = "auto";
          sourceURL = URL.createObjectURL(file);
          const pending = event(video, "loadedmetadata", UNDECODABLE);
          video.src = sourceURL;
          $("#mediaPreview").replaceChildren(video);
          await pending;
          duration = video.duration;
          if (!Number.isFinite(duration) || duration <= 0)
            throw Error("This video has no finite duration.");
          if (video.videoWidth * video.videoHeight > 8294400)
            throw Error("Video exceeds the 8 megapixel limit.");
        }
        check();
        $("#end").value = Math.min(duration, 10).toFixed(2);
        say(
          `Loaded ${duration.toFixed(2)} seconds. Choose an interval and format.`,
        );
      } catch (error) {
        reset();
        $("#mediaPreview").replaceChildren();
        throw error;
      }
    });
  function encodeFrame(G, encoder, c, delay) {
    const rgba = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    const palette = G.quantize(rgba, 256, {
      format: "rgba4444",
      oneBitAlpha: true,
    });
    const index = G.applyPalette(rgba, palette, "rgba4444");
    let transparentIndex = palette.findIndex((p) => p[3] === 0);
    encoder.writeFrame(index, c.width, c.height, {
      palette,
      delay,
      repeat: 0,
      transparent: transparentIndex >= 0,
      transparentIndex: Math.max(0, transparentIndex),
      dispose: 2,
    });
  }
  $("#trim").onclick = () =>
    task(async () => {
      if (!video && !frames) throw Error("Load media first.");
      const start = number("start", 0, duration),
        end = number("end", 0, duration);
      V9Media.range(
        start,
        end,
        duration,
        $("#format").value === "gif" && !frames ? 10 : 60,
      );
      if ($("#format").value === "gif") {
        const G = await import("./vendor/gif.mjs"),
          encoder = G.GIFEncoder();
        if (frames) {
          const c = canvas(gif.lsd.width, gif.lsd.height),
            ctx = c.getContext("2d");
          const background = gif.gct?.[gif.lsd.backgroundColorIndex];
          function clearFrame(f) {
            ctx.clearRect(f.dims.left, f.dims.top, f.dims.width, f.dims.height);
            if (f.transparentIndex === undefined && background) {
              ctx.fillStyle = `rgb(${background.join(",")})`;
              ctx.fillRect(
                f.dims.left,
                f.dims.top,
                f.dims.width,
                f.dims.height,
              );
            }
          }
          if (frames[0].transparentIndex === undefined && background) {
            ctx.fillStyle = `rgb(${background.join(",")})`;
            ctx.fillRect(0, 0, c.width, c.height);
          }
          let time = 0,
            previous,
            restore;
          for (const frame of frames) {
            check();
            if (previous?.disposalType === 2) {
              clearFrame(previous);
            } else if (previous?.disposalType === 3 && restore) {
              ctx.putImageData(restore, 0, 0);
            }
            restore =
              frame.disposalType === 3
                ? ctx.getImageData(0, 0, c.width, c.height)
                : null;
            const patch = canvas(frame.dims.width, frame.dims.height);
            patch
              .getContext("2d")
              .putImageData(
                new ImageData(frame.patch, frame.dims.width, frame.dims.height),
                0,
                0,
              );
            ctx.drawImage(patch, frame.dims.left, frame.dims.top);
            const next = time + Math.max(10, frame.delay || 100) / 1000,
              overlap = Math.min(end, next) - Math.max(start, time);
            if (overlap > 0)
              encodeFrame(
                G,
                encoder,
                c,
                Math.max(10, Math.round((overlap * 1000) / 10) * 10),
              );
            previous = frame;
            time = next;
            if (time >= end) break;
            await pause();
          }
        } else {
          const scale = Math.min(
              1,
              480 / video.videoWidth,
              480 / video.videoHeight,
            ),
            c = canvas(
              Math.max(1, Math.round(video.videoWidth * scale)),
              Math.max(1, Math.round(video.videoHeight * scale)),
            );
          video.pause();
          for (let t = start; t < end - 0.001; t += 0.1) {
            check();
            await seek(t);
            c.getContext("2d").drawImage(video, 0, 0, c.width, c.height);
            encodeFrame(
              G,
              encoder,
              c,
              Math.round(Math.min(0.1, end - t) * 1000),
            );
            say(
              `Encoding GIF ${(t - start).toFixed(1)} / ${(end - start).toFixed(1)} s`,
            );
            await pause();
          }
        }
        encoder.finish();
        check();
        output(
          new Blob([encoder.bytes()], { type: "image/gif" }),
          "trimmed.gif",
        );
        say("GIF exported. Review animation and timing.");
      } else {
        if (!video) throw Error("Choose GIF export for GIF input.");
        if (typeof MediaRecorder === "undefined" || !video.captureStream)
          throw Error(
            "WebM video export requires MediaRecorder and video.captureStream (try Chromium or Firefox). GIF export is available instead.",
          );
        const mime = [
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm",
        ].find((t) => MediaRecorder.isTypeSupported(t));
        if (!mime)
          throw Error("This browser has no WebM recording codec. Choose GIF.");
        video.pause();
        await seek(start);
        const recordingVideo = video,
          stream = recordingVideo.captureStream(),
          chunks = [],
          recorder = new MediaRecorder(stream, { mimeType: mime });
        const stop = () => {
          if (recorder.state !== "inactive") recorder.stop();
          recordingVideo.pause();
          stream.getTracks().forEach((t) => t.stop());
        };
        cleanups.push(stop);
        let timer, watch, stopped;
        try {
          stopped = new Promise((resolve, reject) => {
            recorder.ondataavailable = (e) => {
              if (e.data.size) chunks.push(e.data);
            };
            recorder.onstop = resolve;
            recorder.onerror = () => reject(Error("Video recording failed."));
          });
          const abort = () => stop();
          controller.signal.addEventListener("abort", abort, { once: true });
          recorder.start(100);
          recordingVideo.muted = true;
          await recordingVideo.play();
          watch = setInterval(() => {
            if (recordingVideo.currentTime >= end || recordingVideo.ended)
              stop();
          }, 15);
          timer = setTimeout(stop, (end - start + 10) * 1000);
          await stopped;
          controller.signal.removeEventListener("abort", abort);
          check();
          if (video.currentTime < end - 0.2)
            throw Error(
              "Recording ended before the requested interval. Keep this tab active.",
            );
          const b = new Blob(chunks, { type: mime });
          if (!b.size) throw Error("Browser produced an empty recording.");
          output(b, "trimmed.webm");
          say(
            `WebM exported (~${(video.currentTime - start).toFixed(2)} s). Playback audio depends on browser capture support; review before use.`,
          );
        } finally {
          clearInterval(watch);
          clearTimeout(timer);
          stop();
          recordingVideo.muted = false;
          cleanups = cleanups.filter((fn) => fn !== stop);
        }
      }
    });
}

const mount = {
  "cubic-bezier": curve,
  "screenshot-beautifier": screenshot,
  "pdf-signer": pdfTool,
  "offline-ocr": ocr,
  "silence-stripper": audioTool,
  "video-gif-trimmer": trimmer,
};
if (mount[id]) {
  mount[id]();
  root.dataset.ready = "true";
} else say("Choose a tool from the navigation.");
$("#offline").onclick = async () => {
  const label = $("#offlineStatus");
  try {
    if (!("serviceWorker" in navigator))
      throw Error(
        "Offline use needs a service worker, which this browser or context does not provide (HTTPS or localhost is required).",
      );
    label.textContent = "Preparing offline assets…";
    const registration = await navigator.serviceWorker.register(
      "./offline-worker.js",
      { scope: "./" },
    );
    const worker =
      registration.installing || registration.waiting || registration.active;
    if (!worker) throw Error("No service worker was created. Retry while online.");
    if (worker.state !== "activated")
      await new Promise((resolve, reject) => {
        const settle = () => {
          if (worker.state === "activated") resolve();
          if (worker.state === "redundant")
            reject(Error("Asset caching failed. Retry while online."));
        };
        worker.addEventListener("statechange", settle);
        settle();
      });
    // An active registration can outlive its evicted cache. Check/repair it first.
    await new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => {
        channel.port1.close();
        reject(Error("Offline verification timed out. Retry while online."));
      }, 120000);
      channel.port1.onmessage = ({ data }) => {
        clearTimeout(timer);
        channel.port1.close();
        data.ok ? resolve() : reject(Error(data.error));
      };
      worker.postMessage("VERIFY_OFFLINE", [channel.port2]);
    });
    /* Activation alone does not control this page. Offline reload only works once this page is
       controlled by the worker, so confirm that instead of claiming readiness early. */
    if (!navigator.serviceWorker.controller)
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 5000);
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
      });
    label.textContent = navigator.serviceWorker.controller
      ? "Offline assets cached. This tool directory can now reload offline; browser eviction can remove the cache."
      : "Offline assets cached, but this page is not yet controlled by the offline worker. Reload this page once while online, then it can reload offline.";
  } catch (e) {
    label.textContent = e.message;
  }
};
