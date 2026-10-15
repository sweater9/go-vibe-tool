/* Pure browser/Node audio algorithms. No storage or network. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object") module.exports = api;
  else root.V9Media = api;
})(globalThis, function () {
  "use strict";
  function range(start, end, duration, max = 60) {
    if (
      ![start, end, duration].every(Number.isFinite) ||
      start < 0 ||
      end <= start ||
      end > duration + 0.001 ||
      end - start > max
    )
      throw Error(
        `Choose a valid range of at most ${max} seconds within the source.`,
      );
    return [start, end];
  }
  function processAudio(
    channels,
    rate,
    {
      threshold = -40,
      minSilence = 0.25,
      pad = 0.04,
      target = -1,
      level = true,
    } = {},
  ) {
    if (
      !channels.length ||
      !Number.isInteger(rate) ||
      rate < 8000 ||
      !channels[0].length ||
      channels.some((c) => c.length !== channels[0].length)
    )
      throw Error("Invalid PCM audio.");
    if (
      ![threshold, minSilence, pad, target].every(Number.isFinite) ||
      threshold > 0 ||
      threshold < -90 ||
      minSilence < 0.02 ||
      pad < 0 ||
      target > 0 ||
      target < -30
    )
      throw Error("Invalid audio settings.");
    const length = channels[0].length,
      win = Math.max(1, Math.round(rate * 0.02)),
      quiet = [];
    for (let s = 0; s < length; s += win) {
      let sum = 0,
        n = 0;
      for (const c of channels)
        for (let i = s; i < Math.min(s + win, length); i++) {
          if (!Number.isFinite(c[i])) throw Error("Non-finite audio sample.");
          sum += c[i] * c[i];
          n++;
        }
      quiet.push(Math.sqrt(sum / n) < 10 ** (threshold / 20));
    }
    const remove = [];
    for (let i = 0; i < quiet.length; ) {
      if (!quiet[i]) {
        i++;
        continue;
      }
      let j = i + 1;
      while (j < quiet.length && quiet[j]) j++;
      if (((j - i) * win) / rate >= minSilence) {
        const a = Math.min(length, i * win + Math.round(pad * rate)),
          b = Math.min(length, j * win - Math.round(pad * rate));
        if (b > a) remove.push([a, b]);
      }
      i = j;
    }
    const keep = [];
    let pos = 0;
    for (const [a, b] of remove) {
      if (a > pos) keep.push([pos, a]);
      pos = b;
    }
    if (pos < length) keep.push([pos, length]);
    const count = keep.reduce((s, [a, b]) => s + b - a, 0);
    if (!count)
      throw Error(
        "No audible audio remains. Lower the silence threshold or keep padding.",
      );
    const out = channels.map(() => new Float32Array(count));
    let offset = 0;
    for (const [a, b] of keep) {
      for (let c = 0; c < out.length; c++)
        out[c].set(channels[c].subarray(a, b), offset);
      offset += b - a;
    }
    // Linked stereo, slowly varying peak envelope prevents channel imbalance and clipping.
    const ceiling = 10 ** (target / 20);
    let gain = 1;
    const attack = Math.exp(-1 / (rate * 0.005)),
      release = Math.exp(-1 / (rate * 0.15));
    for (let s = 0; s < count; s += win) {
      let peak = 0;
      for (const c of out)
        for (let i = s; i < Math.min(count, s + win); i++)
          peak = Math.max(peak, Math.abs(c[i]));
      const desired = level ? Math.min(8, ceiling / Math.max(peak, 0.0001)) : 1;
      for (let i = s; i < Math.min(count, s + win); i++) {
        const k = desired < gain ? attack : release;
        gain = desired + (gain - desired) * k;
        for (const c of out)
          c[i] = Math.max(-ceiling, Math.min(ceiling, c[i] * gain));
      }
    }
    // Short fades at joins reduce boundary clicks; removed intervals always match across channels.
    offset = 0;
    for (const [a, b] of keep) {
      const n = b - a,
        fade = Math.min(Math.round(rate * 0.003), Math.floor(n / 2));
      for (const c of out)
        for (let i = 0; i < fade; i++) {
          c[offset + i] *= i / fade;
          c[offset + n - 1 - i] *= i / fade;
        }
      offset += n;
    }
    return {
      channels: out,
      removed: (length - count) / rate,
      duration: count / rate,
      segments: keep.length,
    };
  }
  function wav(channels, rate) {
    const n = channels[0].length,
      bytes = new ArrayBuffer(44 + n * channels.length * 2),
      v = new DataView(bytes);
    const text = (s, o) => {
      for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
    };
    text("RIFF", 0);
    v.setUint32(4, bytes.byteLength - 8, true);
    text("WAVEfmt ", 8);
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, channels.length, true);
    v.setUint32(24, rate, true);
    v.setUint32(28, rate * channels.length * 2, true);
    v.setUint16(32, channels.length * 2, true);
    v.setUint16(34, 16, true);
    text("data", 36);
    v.setUint32(40, bytes.byteLength - 44, true);
    let o = 44;
    for (let i = 0; i < n; i++)
      for (const c of channels) {
        v.setInt16(
          o,
          Math.round(
            Math.max(-1, Math.min(1, c[i])) * (c[i] < 0 ? 32768 : 32767),
          ),
          true,
        );
        o += 2;
      }
    return bytes;
  }
  return { range, processAudio, wav };
});
