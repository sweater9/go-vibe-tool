/* Diagnostic: reports what the engine really supports for the V9 media tools. Not a pass/fail test. */
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pw = await import(process.env.PLAYWRIGHT_PACKAGE || require.resolve("playwright"));
const engines = pw.default || pw;
const engine = process.argv[2] || "chromium";
const root = path.resolve(process.env.SITE_ROOT || ".");
const server = http.createServer(async (req, res) => {
  try {
    const f = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
    res.setHeader("Content-Type", f.endsWith(".html") ? "text/html" : "application/octet-stream");
    res.end(await fs.readFile(f));
  } catch { res.statusCode = 404; res.end(); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await engines[engine].launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
  ...(engine === "chromium" ? { args: ["--no-sandbox"] } : {}),
});
async function probe(label, contextOptions, route) {
const context = await browser.newContext(contextOptions);
if (route) await context.route((url) => !url.href.startsWith(base), (r) => r.abort());
if (route === "all") await context.route("**/*", (r) => r.continue());
const page = await context.newPage();
await page.goto(base + "/tools/v9-media/index.html");
const fixtures = {};
for (const name of ["video-tone.webm", "video-tone-vp9.webm", "video-tone.mp4", "video-tone.ogv"])
  fixtures[name] = (await fs.readFile(new URL(`./fixtures/v9-media/${name}`, import.meta.url))).toString("base64");
const result = await page.evaluate(async (fixtures) => {
  const out = { canPlayType: {}, fixtures: {}, api: {} };
  const v = document.createElement("video");
  for (const t of ['video/webm;codecs="vp8,opus"', 'video/webm;codecs="vp9,opus"', "video/webm", 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"', "video/mp4", 'video/ogg;codecs="theora,vorbis"', "audio/wav", "audio/mpeg"])
    out.canPlayType[t] = v.canPlayType(t);
  out.api = {
    MediaRecorder: typeof MediaRecorder, captureStream: typeof v.captureStream,
    AudioContext: typeof AudioContext, webkitAudioContext: typeof webkitAudioContext,
    serviceWorker: "serviceWorker" in navigator, secure: isSecureContext,
    recorderTypes: typeof MediaRecorder === "undefined" ? [] : ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].filter((t) => MediaRecorder.isTypeSupported(t)),
  };
  for (const [name, b64] of Object.entries(fixtures)) {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const type = name.endsWith(".mp4") ? "video/mp4" : name.endsWith(".ogv") ? "video/ogg" : "video/webm";
    for (const mode of ["typed", "untyped"]) {
      const el = document.createElement("video");
      el.preload = "auto"; el.muted = mode === "untyped";
      const url = URL.createObjectURL(new Blob([bytes], mode === "typed" ? { type } : {}));
      const r = await new Promise((resolve) => {
        const t = setTimeout(() => resolve({ outcome: "timeout", readyState: el.readyState }), 8000);
        el.onloadedmetadata = () => { clearTimeout(t); resolve({ outcome: "loadedmetadata", duration: el.duration, w: el.videoWidth, readyState: el.readyState }); };
        el.onerror = () => { clearTimeout(t); resolve({ outcome: "error", code: el.error?.code, message: el.error?.message }); };
        el.src = url;
      });
      if (r.outcome === "loadedmetadata") {
        r.seek = await new Promise((resolve) => {
          const t = setTimeout(() => resolve("timeout"), 8000);
          el.onseeked = () => { clearTimeout(t); resolve("seeked@" + el.currentTime.toFixed(2)); };
          el.currentTime = 0.5;
        });
        const c = document.createElement("canvas"); c.width = 160; c.height = 100;
        try { c.getContext("2d").drawImage(el, 0, 0); r.sample = Array.from(c.getContext("2d").getImageData(80, 50, 1, 1).data); } catch (e) { r.draw = String(e); }
      }
      out.fixtures[`${name}/${mode}`] = r;
      URL.revokeObjectURL(url);
    }
  }
  // Audio: duration probe (detached vs attached) and decodeAudioData
  const sr = 16000, n = sr, pcm = new DataView(new ArrayBuffer(44 + n * 2));
  const w = (o, s) => [...s].forEach((c, i) => pcm.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); pcm.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); pcm.setUint32(16, 16, true); pcm.setUint16(20, 1, true); pcm.setUint16(22, 1, true);
  pcm.setUint32(24, sr, true); pcm.setUint32(28, sr * 2, true); pcm.setUint16(32, 2, true); pcm.setUint16(34, 16, true); w(36, "data"); pcm.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) pcm.setInt16(44 + i * 2, Math.sin(i * 0.2) * 8000, true);
  const wav = new Blob([pcm.buffer], { type: "audio/wav" });
  out.audio = {};
  for (const attached of [false, true]) {
    const a = document.createElement("audio"); a.preload = "metadata";
    if (attached) document.body.append(a);
    const u = URL.createObjectURL(wav);
    out.audio[attached ? "attachedMetadata" : "detachedMetadata"] = await new Promise((resolve) => {
      const t = setTimeout(() => resolve("timeout"), 8000);
      a.onloadedmetadata = () => { clearTimeout(t); resolve("loadedmetadata " + a.duration); };
      a.onerror = () => { clearTimeout(t); resolve("error " + a.error?.code); };
      a.src = u;
    });
    if (attached) a.remove();
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC();
  out.audio.contextState = ac.state;
  out.audio.decode = await Promise.race([
    ac.decodeAudioData(await wav.arrayBuffer()).then((b) => "ok " + b.duration.toFixed(2)).catch((e) => "error " + e),
    new Promise((r) => setTimeout(() => r("timeout"), 8000)),
  ]);
  await ac.close().catch(() => {});
  return out;
}, fixtures);
console.log("PROBE", label, engine, browser.version(), JSON.stringify(compact(result)));
await context.close();
}
function compact(r) {
  return {
    decodes: Object.fromEntries(Object.entries(r.fixtures).filter(([k]) => k.endsWith("/typed")).map(([k, v]) => [k.replace("/typed", ""), v.outcome + (v.code ? " code " + v.code : "") + (v.seek ? " " + v.seek : "")])),
    api: r.api, audio: r.audio, canPlayType: r.canPlayType,
  };
}
await probe("plain", {}, false);
await probe("mobile-viewport+downloads", { viewport: { width: 390, height: 844 }, acceptDownloads: true }, false);
await probe("with-external-route", { viewport: { width: 390, height: 844 }, acceptDownloads: true }, "external");
await probe("with-catch-all-route", { viewport: { width: 390, height: 844 }, acceptDownloads: true }, "all");
await browser.close();
server.close();
