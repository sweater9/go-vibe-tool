/* GoVibeTool V8 — AVIF encoder worker (module worker).
   Runs the vendored libavif/libaom WebAssembly build (vendor/avif, via @jsquash/avif 2.1.1, Apache-2.0) off the main thread
   so large images do not freeze the page. Receives RGBA pixels, returns AVIF bytes. No network access except loading its own wasm file. */
import init from "../../vendor/avif/avif_enc.js";

const DEFAULTS = { quality: 50, qualityAlpha: -1, denoiseLevel: 0, tileColsLog2: 0, tileRowsLog2: 0, speed: 8, subsample: 1, chromaDeltaQ: false, sharpness: 0, tune: 0, enableSharpYUV: false, bitDepth: 8, lossless: false };
let mod = null;

self.onmessage = async (e) => {
  const { id, width, height, quality, speed } = e.data;
  try {
    if (!mod) mod = await init({ noInitialRun: true });
    const out = mod.encode(new Uint8Array(e.data.buffer), width, height, { ...DEFAULTS, quality, speed: speed || DEFAULTS.speed });
    if (!out || !out.length) throw new Error("The AVIF encoder returned no data.");
    const copy = new Uint8Array(out.length);
    copy.set(out);
    self.postMessage({ id, ok: true, buffer: copy.buffer }, [copy.buffer]);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
self.postMessage({ ready: true });
