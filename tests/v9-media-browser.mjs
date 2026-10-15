import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  pw = await import(
    process.env.PLAYWRIGHT_PACKAGE || require.resolve("playwright")
  ),
  { chromium } = pw.default || pw,
  { PDFDocument } = require("../vendor/pdf-lib.min.js"),
  M = require("../tools/v9-media/media-core.js");
const G = await import("../tools/v9-media/vendor/gif.mjs");
const root = path.resolve(process.env.SITE_ROOT || ".");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".bcmap": "application/octet-stream",
  ".gz": "application/gzip",
};
const server = http.createServer(async (req, res) => {
  try {
    let f = path.resolve(
      root,
      "." + decodeURIComponent(new URL(req.url, "http://x").pathname),
    );
    if (f !== root && !f.startsWith(root + path.sep)) throw Error();
    if ((await fs.stat(f)).isDirectory()) f = path.join(f, "index.html");
    res.setHeader(
      "Content-Type",
      types[path.extname(f)] || "application/octet-stream",
    );
    res.end(await fs.readFile(f));
  } catch {
    res.statusCode = 404;
    res.end("missing");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  acceptDownloads: true,
});
const page = await context.newPage();
page.setDefaultTimeout(60000);
const errors = [],
  external = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (/^https?:/.test(r.url()) && !r.url().startsWith(base))
    external.push(r.url());
});
if (process.env.MEDIA_TRACE) {
  page.on("console", (m) => console.log("BROWSER", m.type(), m.text()));
  page.on("requestfailed", (r) =>
    console.log("REQUEST FAILED", r.url(), r.failure()),
  );
}
await context.route("**/*", (r) =>
  r.request().url().startsWith(base) ? r.continue() : r.abort(),
);
const open = async (id) => {
  await page.goto(`${base}/tools/v9-media/?tool=${id}`);
  await page.waitForSelector("#tool[data-ready]");
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "mobile width",
  );
};
const upload = async (name, type, buffer) =>
  page.setInputFiles("#file", {
    name,
    mimeType: type,
    buffer: Buffer.from(buffer),
  });
const download = async (selector) => {
  const promise = page.waitForEvent("download");
  await page.locator(selector).click();
  return fs.readFile(await (await promise).path());
};
let passed = 0;
const check = async (name, fn) => {
  if (process.env.MEDIA_CHECK && !name.includes(process.env.MEDIA_CHECK))
    return;
  await fn();
  passed++;
  console.log("PASS", name);
};
try {
  await check(
    "bezier numeric controls, sample solver, invalid controls, keyboard alternative",
    async () => {
      await open("cubic-bezier");
      assert.match(await page.locator("#css").inputValue(), /cubic-bezier/);
      assert.match(await page.locator("#sample").textContent(), /0.8024/);
      await page.fill("#x1", "-1");
      await page.locator("#x1").dispatchEvent("input");
      assert.match(await page.locator("#status").textContent(), /choose/);
      await page.selectOption("#preset", "0,0,1,1");
      assert.match(await page.locator("#sample").textContent(), /0.5000/);
    },
  );
  const png = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 900;
    c.height = 200;
    const x = c.getContext("2d");
    x.fillStyle = "white";
    x.fillRect(0, 0, 900, 200);
    x.fillStyle = "black";
    x.font = "bold 60px sans-serif";
    x.fillText("LOCAL PRIVATE TEST 123", 20, 120);
    return Array.from(
      new Uint8Array(
        await (await new Promise((r) => c.toBlob(r))).arrayBuffer(),
      ),
    );
  });
  await check("screenshot perspective exports real PNG pixels", async () => {
    await open("screenshot-beautifier");
    await upload("shot.png", "image/png", png);
    await page.fill("#yaw", "25");
    await page.click("#render");
    await page.waitForSelector("#downloads a");
    const bytes = await download("#downloads a");
    assert.equal(bytes.subarray(1, 4).toString(), "PNG");
    assert.equal(await page.locator("#preview canvas").count(), 1);
    assert.ok(bytes.length > 5000);
  });
  const pdf = await PDFDocument.create(),
    p = pdf.addPage([400, 500]);
  p.drawText("PRIVATE DOCUMENT", { x: 30, y: 400, size: 20 });
  const form = pdf.getForm();
  form
    .createTextField("name")
    .addToPage(p, { x: 30, y: 300, width: 200, height: 30 });
  form.getTextField("name").setText("Filled form");
  pdf.addPage([500, 400]).setRotation({ type: "degrees", angle: 90 });
  const pdfBytes = await pdf.save();
  await check(
    "PDF typed visible signature, multipage rotated raster flatten, no forms",
    async () => {
      await open("pdf-signer");
      await upload("test.pdf", "application/pdf", pdfBytes);
      await page.click("#loadPdf");
      await page.waitForSelector("#preview canvas");
      await page.fill("#sigName", "Local Signer");
      await page.click("#typeSignature");
      await page.click("#previewPdf");
      await page.waitForFunction(() =>
        document.querySelector("#status").textContent.startsWith("Page"),
      );
      await page.click("#exportPdf");
      await page.waitForSelector("#downloads a");
      const out = await PDFDocument.load(await download("#downloads a"));
      assert.equal(out.getPageCount(), 2);
      assert.equal(out.getForm().getFields().length, 0);
      assert.deepEqual(
        out.getPages().map((p) => [p.getWidth(), p.getHeight()]),
        [
          [400, 500],
          [400, 500],
        ],
      );
      assert.ok(
        out
          .getPage(0)
          .node.Resources()
          .lookup(require("../vendor/pdf-lib.min.js").PDFName.of("XObject"))
          .keys().length > 0,
      );
    },
  );
  await check(
    "audio removes silence, exports decodable nonempty stereo WAV",
    async () => {
      await open("silence-stripper");
      const rate = 16000,
        a = Float32Array.from({ length: rate * 2 }, (_, i) =>
          i < rate * 0.5 || i > rate * 1.5 ? 0.15 * Math.sin(i * 0.2) : 0,
        );
      await upload(
        "audio.wav",
        "audio/wav",
        new Uint8Array(M.wav([a, a], rate)),
      );
      await page.click("#process");
      await page.waitForSelector("#downloads a");
      const b = await download("#downloads a");
      assert.equal(b.subarray(0, 4).toString(), "RIFF");
      const header = new DataView(b.buffer, b.byteOffset, b.byteLength);
      const seconds = header.getUint32(40, true) / header.getUint32(28, true);
      assert.ok(seconds > 1 && seconds < 1.2, `output seconds: ${seconds}`);
      assert.match(await page.locator("#status").textContent(), /Removed 0\.9/);
    },
  );
  const encoder = G.GIFEncoder();
  for (const color of [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
  ])
    encoder.writeFrame(new Uint8Array(64 * 48).fill(0), 64, 48, {
      palette: [color, [0, 0, 0]],
      delay: 500,
      repeat: 0,
    });
  encoder.finish();
  const gifBytes = encoder.bytes();
  await check("GIF trims real frames, colors and delays", async () => {
    await open("video-gif-trimmer");
    await upload("animated.gif", "image/gif", gifBytes);
    await page.click("#loadMedia");
    await page.waitForFunction(() =>
      document.querySelector("#status").textContent.startsWith("Loaded"),
    );
    await page.fill("#start", ".5");
    await page.fill("#end", "1.5");
    await page.click("#trim");
    await page.waitForSelector("#downloads a");
    const frames = G.decompressFrames(
      G.parseGIF(await download("#downloads a")),
      true,
    );
    assert.equal(frames.length, 2);
    assert.equal(
      frames.reduce((s, f) => s + f.delay, 0),
      1000,
    );
    assert.deepEqual(Array.from(frames[0].patch.subarray(0, 3)), [0, 255, 0]);
  });
  await check(
    "browser video re-encodes bounded WebM with real frames",
    async () => {
      const bytes = await page.evaluate(async () => {
        const c = document.createElement("canvas");
        c.width = 160;
        c.height = 100;
        const ac = new AudioContext();
        await ac.resume();
        const destination = ac.createMediaStreamDestination(),
          osc = ac.createOscillator();
        osc.frequency.value = 440;
        osc.connect(destination);
        osc.start();
        const x = c.getContext("2d"),
          stream = c.captureStream(15);
        stream.addTrack(destination.stream.getAudioTracks()[0]);
        const rec = new MediaRecorder(stream, { mimeType: "video/webm" }),
          chunks = [];
        rec.ondataavailable = (e) => chunks.push(e.data);
        const done = new Promise((r) => (rec.onstop = r));
        rec.start();
        let count = 0;
        const timer = setInterval(() => {
          x.fillStyle = count++ % 2 ? "red" : "blue";
          x.fillRect(0, 0, 160, 100);
        }, 60);
        await new Promise((r) => setTimeout(r, 2200));
        rec.stop();
        await done;
        clearInterval(timer);
        stream.getTracks().forEach((t) => t.stop());
        osc.stop();
        await ac.close();
        return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
      });
      await open("video-gif-trimmer");
      await upload("video.webm", "video/webm", bytes);
      await page.click("#loadMedia");
      await page.waitForFunction(() =>
        document.querySelector("#status").textContent.startsWith("Loaded"),
      );
      await page.fill("#start", ".2");
      await page.fill("#end", "1.2");
      await page.click("#trim");
      await page.waitForSelector("#downloads a");
      const b = await download("#downloads a");
      assert.ok(b.length > 500);
      assert.equal(b.subarray(0, 4).toString("hex"), "1a45dfa3");
      const measured = await page.evaluate(async (bytes) => {
        const ac = new AudioContext();
        try {
          const decoded = await ac.decodeAudioData(
            new Uint8Array(bytes).buffer,
          );
          let peak = 0;
          for (const n of decoded.getChannelData(0))
            peak = Math.max(peak, Math.abs(n));
          return { duration: decoded.duration, peak };
        } finally {
          await ac.close();
        }
      }, Array.from(b));
      assert.ok(
        measured.duration > 0.8 && measured.duration < 1.4,
        JSON.stringify(measured),
      );
      assert.ok(measured.peak > 0.1, "captured audio is audible");
      await page.selectOption("#format", "gif");
      await page.fill("#end", ".7");
      await page.click("#trim");
      await page.waitForSelector("#downloads a");
      const frames = G.decompressFrames(
        G.parseGIF(await download("#downloads a")),
        true,
      );
      assert.equal(frames.length, 5);
      assert.equal(
        frames.reduce((s, f) => s + f.delay, 0),
        500,
      );
    },
  );
  await check(
    "offline asset preparation verifies pins and OCR works after offline reload",
    async () => {
      await open("offline-ocr");
      await page.locator("summary").click();
      await page.click("#offline");
      await page.waitForFunction(
        () =>
          document
            .querySelector("#offlineStatus")
            .textContent.startsWith("Offline assets cached"),
        { timeout: 120000 },
      );
      await context.setOffline(true);
      await page.reload();
      await page.waitForSelector("#recognize");
      await upload("text.png", "image/png", png);
      await page.click("#recognize");
      await page.click("#cancel");
      await page.waitForFunction(
        () => document.querySelector("#status").textContent === "Cancelled.",
      );
      assert.equal(await page.locator("#recognize").isEnabled(), true);
      assert.equal(await page.locator("#downloads a").count(), 0);
      await page.click("#recognize");
      await page.waitForSelector("#downloads a", { timeout: 120000 });
      assert.match(
        await page.locator("#text").inputValue(),
        /LOCAL PRIVATE TEST 123/,
      );
    },
  );
  await check(
    "offline reloads all tools and processes a PDF without network",
    async () => {
      for (const id of [
        "cubic-bezier",
        "screenshot-beautifier",
        "silence-stripper",
        "video-gif-trimmer",
      ])
        await open(id);
      await open("pdf-signer");
      await upload("offline.pdf", "application/pdf", pdfBytes);
      await page.click("#loadPdf");
      await page.waitForSelector("#preview canvas");
      await page.uncheck("#addSig");
      await page.click("#exportPdf");
      await page.waitForSelector("#downloads a");
      assert.equal(
        (await PDFDocument.load(await download("#downloads a"))).getPageCount(),
        2,
      );
    },
  );
  assert.deepEqual(external, [], "no external requests from tools");
  assert.deepEqual(errors, [], "no browser errors");
  await check(
    "homepage retains nine categories and routes all six isolated modules",
    async () => {
      const ctx = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        serviceWorkers: "block",
      });
      await ctx.route("**/*", (r) =>
        r.request().url().startsWith(base) ? r.continue() : r.abort(),
      );
      const home = await ctx.newPage();
      try {
        await home.goto(base + "/");
        assert.equal(await home.locator("#categoryGrid .cat-tile").count(), 9);
        for (const id of [
          "cubic-bezier",
          "screenshot-beautifier",
          "pdf-signer",
          "offline-ocr",
          "silence-stripper",
          "video-gif-trimmer",
        ]) {
          await home.evaluate((id) => openTool(id), id);
          const frame = home.frameLocator("#v9MediaFrame");
          await frame.locator("#tool[data-ready]").waitFor();
          assert.equal(await frame.locator("h1").count(), 1);
        }
        await home.evaluate(() => closeTool());
        assert.equal(await home.locator("#v9MediaFrame").count(), 0);
      } finally {
        await ctx.close();
      }
    },
  );
  console.log(
    `${passed} browser checks passed; no external tool requests; mobile 390px; offline OCR/PDF verified.`,
  );
} catch (e) {
  console.error(
    "UI state:",
    await page
      .locator("#status")
      .textContent()
      .catch(() => ""),
    await page
      .locator("#offlineStatus")
      .textContent()
      .catch(() => ""),
    "Errors:",
    errors,
  );
  throw e;
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
