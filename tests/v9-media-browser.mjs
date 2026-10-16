import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { createDistServer } from "../scripts/serve-dist.mjs";
const require = createRequire(import.meta.url),
  pw = await import(
    process.env.PLAYWRIGHT_PACKAGE || require.resolve("playwright")
  ),
  engines = pw.default || pw,
  { PDFDocument } = require("../vendor/pdf-lib.min.js"),
  M = require("../tools/v9-media/media-core.js");
const G = await import("../tools/v9-media/vendor/gif.mjs");
const engine = process.argv[2] || "chromium";
if (!["chromium", "firefox", "webkit"].includes(engine))
  throw Error("Choose chromium, firefox, or webkit.");
const root = path.resolve(process.env.SITE_ROOT || ".");
const target = root === path.resolve(".") ? "source" : "dist";
const artifacts =
  process.env.MEDIA_ARTIFACTS || `artifacts/v9-media/${engine}/${target}`;
await fs.mkdir(artifacts, { recursive: true });
const revision = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const worktreeDirty = !!execFileSync("git", ["status", "--porcelain"], {
  encoding: "utf8",
}).trim();
const playwrightVersion = require(
  path.join(
    path.dirname(
      require.resolve(process.env.PLAYWRIGHT_PACKAGE || "playwright"),
    ),
    "package.json",
  ),
).version;
const cases = [],
  started = new Date().toISOString();
let browser;
async function report(outcome, error) {
  const evidence = {
    revision,
    worktreeDirty,
    engine,
    playwrightVersion,
    browserVersion: browser?.version() || null,
    target,
    started,
    completed: new Date().toISOString(),
    outcome,
    counts: Object.fromEntries(
      ["passed", "failed", "capability-limited", "filtered"].map((status) => [
        status,
        cases.filter((c) => c.status === status).length,
      ]),
    ),
    cases,
    ...(error ? { error: String(error.stack || error) } : {}),
  };
  await fs.writeFile(
    path.join(artifacts, "results.json"),
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(
    "RESULT",
    JSON.stringify({
      revision,
      engine,
      target,
      outcome,
      counts: evidence.counts,
    }),
  );
}
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
/* Source runs use a plain static server. Built-distribution runs use the same Cloudflare-style
   routing as production (extensionless URLs, folder redirects, 404 page) so redirects and
   caching of redirected responses are exercised, not just file reads. */
const sourceServer = (fixedPort = 0) => {
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
  const sockets = new Set();
  server.on("connection", (s) => (sockets.add(s), s.on("close", () => sockets.delete(s))));
  return {
    start: () =>
      new Promise((r) =>
        server.listen(fixedPort, "127.0.0.1", () => r(server.address().port)),
      ),
    stop: () =>
      new Promise((r) => {
        server.close(() => r());
        for (const s of sockets) s.destroy();
      }),
  };
};
const makeServer = (port = 0) => {
  if (target === "source") return sourceServer(port);
  const dist = createDistServer(root, { port });
  return { start: async () => (await dist.start(), dist.port), stop: dist.stop };
};
let server = makeServer();
const port = await server.start();
const base = `http://127.0.0.1:${port}`;
/* Genuine offline: the origin server is stopped, so a request that is not answered by the
   service worker or cache fails with a refused connection. Playwright's setOffline() is not
   used for Firefox/WebKit because it fails navigations before the service worker can answer
   (NS_ERROR_OFFLINE / WebKit internal error), which would test the emulator, not the app. */
let networkUp = true;
const network = {
  async down() {
    if (!networkUp) return;
    await server.stop();
    networkUp = false;
    const refused = await new Promise((resolve) =>
      http
        .get(base + "/index.html", (res) => {
          res.resume();
          resolve(false);
        })
        .on("error", (e) => resolve(e.code === "ECONNREFUSED")),
    );
    assert.ok(refused, "origin must refuse connections while offline");
    if (engine === "chromium") await context.setOffline(true);
  },
  async up() {
    if (networkUp) return;
    if (engine === "chromium") await context.setOffline(false);
    server = makeServer(port);
    await server.start();
    networkUp = true;
  },
};
try {
  browser = await engines[engine].launch({
    headless: true,
    ...(process.env.BROWSER_EXECUTABLE
      ? { executablePath: process.env.BROWSER_EXECUTABLE }
      : engine === "chromium" && existsSync("/usr/bin/chromium")
        ? { executablePath: "/usr/bin/chromium" }
        : {}),
    ...(engine === "chromium" ? { args: ["--no-sandbox"] } : {}),
  });
} catch (error) {
  await report("blocked", error);
  await server.stop();
  throw error;
}
console.log(`Testing ${engine} ${browser.version()} (${target}, ${revision})`);
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  acceptDownloads: true,
});
const page = await context.newPage();
page.setDefaultTimeout(60000);
const errors = [],
  external = [];
page.on("pageerror", (e) => errors.push(e.message));
context.on("request", (r) => {
  if (/^https?:/.test(r.url()) && !r.url().startsWith(base))
    external.push(r.url());
});
if (process.env.MEDIA_TRACE) {
  page.on("console", (m) => console.log("BROWSER", m.type(), m.text()));
  page.on("requestfailed", (r) =>
    console.log("REQUEST FAILED", r.url(), r.failure()),
  );
}
/* Only third-party http(s) requests are intercepted and blocked. Same-origin traffic is not routed
   so Playwright cannot stand between the page and its service worker. blob:/data: URLs must never
   be aborted: WebKit surfaces blob: media loads as intercepted requests, and aborting them made
   every <video>/<audio> element report "cannot decode" (MEDIA_ERR_SRC_NOT_SUPPORTED) even though the
   engine decodes the same files without interception (see tests/v9-media-probe.mjs). */
const thirdParty = (url) => /^https?:/.test(url.protocol) && !url.href.startsWith(base);
await context.route(thirdParty, (r) => r.abort());
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
/* Fixtures are chosen by what this engine can actually decode (metadata, dimensions and a seek),
   not by canPlayType(), which can answer "maybe"/"probably" for media the engine then rejects. */
const videoFixtures = [
  ["video-tone.webm", "video/webm"],
  ["video-tone-vp9.webm", "video/webm"],
  ["video-tone.mp4", "video/mp4"],
  ["video-tone.ogv", "video/ogg"],
];
let decodable;
async function pickVideoFixture() {
  if (decodable !== undefined) return decodable;
  const probe = [];
  for (const [file, type] of videoFixtures) {
    const bytes = await fs.readFile(
      new URL(`./fixtures/v9-media/${file}`, import.meta.url),
    );
    const outcome = await page.evaluate(
      async ([b64, type]) => {
        const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const el = document.createElement("video");
        el.muted = true;
        el.preload = "auto";
        const url = URL.createObjectURL(new Blob([data], { type }));
        const wait = (ok) =>
          new Promise((resolve) => {
            const t = setTimeout(() => resolve("timeout"), 10000);
            el.addEventListener(ok, () => (clearTimeout(t), resolve("ok")), {
              once: true,
            });
            el.addEventListener(
              "error",
              () => (clearTimeout(t), resolve("error " + el.error?.code)),
              { once: true },
            );
          });
        try {
          const loaded = wait("loadedmetadata");
          el.src = url;
          const r = await loaded;
          if (r !== "ok") return r;
          if (!(el.videoWidth > 0 && el.duration > 1)) return "no video track";
          const seeked = wait("seeked");
          el.currentTime = 0.5;
          return await seeked;
        } finally {
          URL.revokeObjectURL(url);
        }
      },
      [bytes.toString("base64"), type],
    );
    probe.push(`${file}: ${outcome}`);
    if (outcome === "ok") return (decodable = { file, type, bytes, probe });
  }
  return (decodable = { file: null, probe });
}
const NO_DECODER = (probe) =>
  `This engine decodes none of the bundled video fixtures (${probe.join("; ")}). ` +
  "Verified instead: the app reports it cannot decode the video, offers the GIF alternative and exports nothing.";
async function loadVideoFixture(expected = /^Loaded/) {
  const fixture = await pickVideoFixture();
  if (!fixture.file) {
    const [file, type] = videoFixtures[0];
    await upload(
      file,
      type,
      await fs.readFile(new URL(`./fixtures/v9-media/${file}`, import.meta.url)),
    );
    await page.click("#loadMedia");
    await page.waitForFunction(() =>
      /^(Loaded|Could not complete:)/.test(
        document.querySelector("#status").textContent,
      ),
    );
    const status = await page.locator("#status").textContent();
    assert.match(status, /^Could not complete:.*cannot decode/);
    assert.match(status, /GIF/, "message must offer a supported alternative");
    assert.equal(await page.locator("#downloads a").count(), 0);
    return null;
  }
  await upload(fixture.file, fixture.type, fixture.bytes);
  await page.click("#loadMedia");
  await page.waitForFunction(() =>
    /^(Loaded|Could not complete:)/.test(
      document.querySelector("#status").textContent,
    ),
  );
  assert.match(
    await page.locator("#status").textContent(),
    expected,
    `Fixture ${fixture.file} decoding failed although the engine decoded it directly`,
  );
  return fixture;
}
const check = async (name, fn) => {
  if (process.env.MEDIA_CHECK && !name.includes(process.env.MEDIA_CHECK)) {
    cases.push({ name, status: "filtered", reason: "MEDIA_CHECK selection" });
    return;
  }
  const time = Date.now();
  try {
    const detail = await fn();
    const status = detail?.limitation ? "capability-limited" : "passed";
    cases.push({ name, status, elapsedMs: Date.now() - time, ...detail });
    console.log(
      status === "passed" ? "PASS" : "CAPABILITY LIMIT",
      name,
      detail || "",
    );
  } catch (error) {
    const ui = await page
      .locator("#status")
      .textContent({ timeout: 1000 })
      .catch(() => "unavailable");
    const offline = await page
      .locator("#offlineStatus")
      .textContent({ timeout: 1000 })
      .catch(() => "unavailable");
    cases.push({
      name,
      status: "failed",
      elapsedMs: Date.now() - time,
      error: String(error.stack || error),
      ui,
      offline,
    });
    console.error("FAIL", name, error);
    if (process.env.GITHUB_ACTIONS) {
      const escape = (s) =>
        String(s)
          .replaceAll("%", "%25")
          .replaceAll("\r", "%0D")
          .replaceAll("\n", "%0A");
      console.error(
        `::error::${escape(`${engine}/${target}: ${name}\n${error.stack || error}\nUI: ${ui}\nOffline: ${offline}`)}`,
      );
    }
    await page
      .screenshot({
        path: path.join(artifacts, `failure-${cases.length}.png`),
        fullPage: true,
      })
      .catch(() => {});
  }
};
let suiteError;
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
      await page.fill("#x1", "");
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
  await check(
    "rejected oversized video cannot be exported and releases its preview",
    async () => {
      await open("video-gif-trimmer");
      // Exercise the real decoder, then simulate metadata beyond the resource cap.
      await page.evaluate(() => {
        Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", {
          configurable: true,
          get: () => 10000,
        });
        Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", {
          configurable: true,
          get: () => 10000,
        });
      });
      await loadVideoFixture(/8 megapixel/);
      await page.waitForFunction(() =>
        document.querySelector("#status").textContent.includes("8 megapixel"),
      );
      assert.equal(await page.locator("#mediaPreview video").count(), 0);
      await page.selectOption("#format", "gif");
      await page.click("#trim");
      assert.match(
        await page.locator("#status").textContent(),
        /Load media first/,
      );
      assert.equal(await page.locator("#downloads a").count(), 0);
    },
  );
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
    "video WebM export captures audible audio or explains unavailable capture support",
    async () => {
      await open("video-gif-trimmer");
      const fixture = await loadVideoFixture();
      if (!fixture)
        return { limitation: NO_DECODER((await pickVideoFixture()).probe) };
      const supported = await page.evaluate(
        () =>
          typeof MediaRecorder !== "undefined" &&
          typeof document.querySelector("video").captureStream === "function" &&
          [
            "video/webm;codecs=vp9,opus",
            "video/webm;codecs=vp8,opus",
            "video/webm",
          ].some((type) => MediaRecorder.isTypeSupported(type)),
      );
      await page.fill("#start", ".2");
      await page.fill("#end", "1.2");
      await page.click("#trim");
      if (!supported) {
        await page.waitForFunction(() =>
          document
            .querySelector("#status")
            .textContent.startsWith("Could not complete:"),
        );
        assert.match(
          await page.locator("#status").textContent(),
          /captureStream|WebM recording codec/,
        );
        assert.match(await page.locator("#status").textContent(), /GIF/);
        assert.equal(await page.locator("#downloads a").count(), 0);
        return {
          limitation:
            "Browser lacks captureStream or a WebM recording codec; explicit error and GIF alternative verified. WebM export did not execute.",
        };
      }
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
      await page.evaluate(() => {
        const video = document.querySelector("video");
        const capture = video.captureStream.bind(video);
        video.captureStream = () => {
          const stream = capture();
          window.testCapturedTracks = stream.getTracks();
          return stream;
        };
      });
      await page.fill("#end", "2");
      await page.click("#trim");
      await page.waitForFunction(() => window.testCapturedTracks?.length > 0);
      await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
      await page.waitForFunction(
        () => document.querySelector("#status").textContent === "Cancelled.",
      );
      assert.equal(
        await page.evaluate(() =>
          window.testCapturedTracks.every(
            (track) => track.readyState === "ended",
          ),
        ),
        true,
      );
      assert.equal(await page.locator("#downloads a").count(), 0);
    },
  );
  await check(
    "video-to-GIF exports five real frames with 500 ms duration",
    async () => {
      await open("video-gif-trimmer");
      const fixture = await loadVideoFixture();
      if (!fixture)
        return { limitation: NO_DECODER((await pickVideoFixture()).probe) };
      await page.selectOption("#format", "gif");
      await page.fill("#start", ".2");
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
  const WORKER_PATH = "/tools/v9-media/offline-worker.js";
  const workerState = () =>
    page.evaluate(async () => {
      const controller = navigator.serviceWorker?.controller;
      const names = await caches.keys();
      const cache = names.find((n) => n.startsWith("gvt-v9-media-"));
      return {
        controller: controller ? new URL(controller.scriptURL).pathname : null,
        cache,
        entries: cache ? (await (await caches.open(cache)).keys()).length : 0,
      };
    });
  const manifestFiles = JSON.parse(
    await fs.readFile(
      path.join(root, "tools/v9-media/vendor-assets.json"),
      "utf8",
    ),
  ).length;
  await check(
    "offline asset preparation verifies pins and OCR works after offline reload",
    async () => {
      await open("offline-ocr");
      await page.locator("summary").click();
      await page.click("#offline");
      await page.waitForFunction(
        () =>
          /^Offline assets cached\./.test(
            document.querySelector("#offlineStatus").textContent,
          ),
        null,
        { timeout: 120000 },
      );
      // An active worker must repair a missing cache entry, not falsely report ready.
      await page.evaluate(async () => {
        const key = (await caches.keys()).find((key) =>
          key.startsWith("gvt-v9-media-"),
        );
        await (
          await caches.open(key)
        ).delete(new URL("media.js", location.href));
        document.querySelector("#offlineStatus").textContent = "Rechecking";
      });
      await page.click("#offline");
      await page.waitForFunction(
        () =>
          document
            .querySelector("#offlineStatus")
            .textContent.startsWith("Offline assets cached"),
        null,
        { timeout: 120000 },
      );
      // The page must really be controlled by the intended worker, with every pinned asset cached.
      const before = await workerState();
      assert.equal(before.controller, WORKER_PATH, JSON.stringify(before));
      assert.ok(before.entries > manifestFiles, JSON.stringify(before));
      assert.doesNotMatch(
        await page.locator("#offlineStatus").textContent(),
        /not yet controlled/,
      );
      await network.down();
      await page.reload();
      await page.waitForSelector("#recognize");
      // Served by the worker while the origin refuses connections.
      assert.equal((await workerState()).controller, WORKER_PATH);
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
      await network.down(); // idempotent: stays offline if the previous check left it so
      for (const id of [
        "cubic-bezier",
        "screenshot-beautifier",
        "silence-stripper",
        "video-gif-trimmer",
      ])
        await open(id);
      await open("pdf-signer");
      assert.equal((await workerState()).controller, WORKER_PATH);
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
  await network.up();
  assert.deepEqual(external, [], "no external requests from tools");
  assert.deepEqual(errors, [], "no browser errors");
  await check(
    "homepage retains nine categories and routes all six isolated modules",
    async () => {
      const ctx = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        serviceWorkers: "block",
      });
      await ctx.route(thirdParty, (r) => r.abort());
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
} catch (e) {
  suiteError = e;
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
} finally {
  const failed = suiteError || cases.some((c) => c.status === "failed");
  await report(
    failed ? "failed" : process.env.MEDIA_CHECK ? "partial" : "passed",
    suiteError,
  );
  if (failed) process.exitCode = 1;
  await browser.close();
  await server.stop();
}
