import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import crypto from "node:crypto";
import vm from "node:vm";
const require = createRequire(import.meta.url),
  C = require("../v9-utilities-core.js"),
  M = require("../tools/v9-media/media-core.js");
test("CSS curve solver uses x inversion and preserves endpoints/overshoot", () => {
  const sandbox = { GVTV9: { agent1Engine: true } };
  vm.runInNewContext(fs.readFileSync("v9-utilities-core.js", "utf8"), sandbox);
  assert.equal(sandbox.GVTV9.agent1Engine, true);
  assert.equal(typeof sandbox.GVTV9.bezierAt, "function");
  for (let x = 0; x <= 1; x += 0.1)
    assert.ok(Math.abs(C.bezierAt(x, 0, 0, 1, 1) - x) < 1e-10);
  assert.equal(C.bezierAt(0, 0.25, 0.1, 0.25, 1), 0);
  assert.equal(C.bezierAt(1, 0.25, 0.1, 0.25, 1), 1);
  assert.ok(Math.abs(C.bezierAt(0.5, 0.25, 0.1, 0.25, 1) - 0.8024) < 0.001);
  assert.ok(C.bezierAt(0.2, 0.68, -0.6, 0.32, 1.6) < 0);
  assert.throws(() => C.bezierAt(NaN, 0, 0, 1, 1));
  assert.throws(() => C.bezierAt(0.5, -1, 0, 1, 1));
});
test("root worker activation preserves scoped media and foreign caches", async () => {
  const source = fs.readFileSync("sw.js", "utf8");
  const current = source.match(/const CACHE="([^"]+)"/)[1];
  const keys = new Set([
    current,
    "govibetool-old",
    "gvt-v9-media-2",
    "other-app",
  ]);
  const handlers = {};
  vm.runInNewContext(source, {
    self: {
      addEventListener: (name, fn) => (handlers[name] = fn),
      clients: { claim: async () => {} },
    },
    caches: {
      keys: async () => [...keys],
      delete: async (key) => keys.delete(key),
    },
  });
  let pending;
  handlers.activate({ waitUntil: (promise) => (pending = promise) });
  await pending;
  assert.deepEqual([...keys], [current, "gvt-v9-media-2", "other-app"]);
});
test("range validation rejects invalid and excessive intervals", () => {
  assert.deepEqual(M.range(1, 2, 3), [1, 2]);
  for (const a of [
    [2, 1, 3],
    [-1, 2, 3],
    [0, 4, 3],
    [0, 61, 70],
    [NaN, 1, 2],
  ])
    assert.throws(() => M.range(...a));
});
test("silence removal stays aligned across stereo channels", () => {
  const rate = 10000,
    a = new Float32Array(rate * 2),
    b = new Float32Array(rate * 2);
  for (let i = 0; i < rate * 2; i++)
    if (i < 5000 || i > 15000) {
      a[i] = 0.2 * Math.sin(i * 0.3);
      b[i] = a[i] / 2;
    }
  const r = M.processAudio([a, b], rate, { level: false, pad: 0 });
  assert.ok(r.removed > 0.9 && r.removed < 1.1);
  assert.equal(r.channels[0].length, r.channels[1].length);
  for (let i = 0; i < r.channels[0].length; i++)
    assert.ok(Math.abs(r.channels[0][i] / 2 - r.channels[1][i]) < 1e-7);
});
test("leveling boosts quiet audio and respects ceiling", () => {
  const a = Float32Array.from(
    { length: 20000 },
    (_, i) => 0.05 * Math.sin(i * 0.2),
  );
  const r = M.processAudio([a], 10000);
  const peak = Math.max(...r.channels[0]);
  assert.ok(peak > 0.2 && peak <= 10 ** (-1 / 20) + 1e-6);
});
test("all-silent input and nonfinite PCM are reported", () => {
  assert.throws(
    () => M.processAudio([new Float32Array(10000)], 10000, { pad: 0 }),
    /No audible/,
  );
  assert.throws(
    () => M.processAudio([new Float32Array([NaN])], 10000),
    /Non-finite/,
  );
});
test("WAV header and interleaved stereo samples round-trip", () => {
  const bytes = M.wav(
      [new Float32Array([1, -1]), new Float32Array([0.5, -0.5])],
      48000,
    ),
    v = new DataView(bytes);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "RIFF");
  assert.equal(v.getUint16(22, true), 2);
  assert.equal(v.getUint32(24, true), 48000);
  assert.equal(v.getInt16(44, true), 32767);
  assert.equal(v.getInt16(46, true), 16384);
  assert.equal(v.getInt16(48, true), -32768);
  assert.equal(v.getUint32(40, true), 8);
});
test("vendored assets match committed SHA-256 manifest", () => {
  for (const pin of JSON.parse(
    fs.readFileSync(
      new URL("../tools/v9-media/vendor-assets.json", import.meta.url),
    ),
  )) {
    const data = fs.readFileSync(
      new URL("../tools/v9-media/" + pin.file, import.meta.url),
    );
    assert.equal(
      crypto.createHash("sha256").update(data).digest("hex"),
      pin.sha256,
      pin.file,
    );
  }
});
test("exactly nine categories remain and no new category definitions", () => {
  const text = fs.readFileSync(
    new URL("../v8-discovery.js", import.meta.url),
    "utf8",
  );
  assert.equal(
    (
      text.split("const V8_CATEGORIES=[")[1].split("];")[0].match(/\{id:/g) ||
      []
    ).length,
    9,
  );
});
