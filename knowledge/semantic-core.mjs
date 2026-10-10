// Local semantic retrieval. Pure: no network, no model download, no server.
// Input is the compact semantic-index.json produced at build time (pruned word vectors + per-page unit vectors).
// The embedding model itself never ships; only ~20k pruned word vectors and the page vectors do.

const TOKEN = /[a-z0-9]+/g;

function b64ToInt8(b64) {
  const bin = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  const out = new Int8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = (bin.charCodeAt(i) << 24) >> 24;
  return out;
}
function b64ToUint8(b64) {
  const bin = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export function loadSemantic(raw) {
  const words = raw.words.split(" ");
  const wordIndex = new Map();
  words.forEach((w, i) => wordIndex.set(w, i));
  const dim = raw.dim;
  const wv = b64ToInt8(raw.wvecs);
  const wvF = new Float32Array(wv.length);
  for (let i = 0; i < wv.length; i += 1) wvF[i] = wv[i] / raw.vscale;
  const uv = b64ToInt8(raw.uvecs);
  const uvF = new Float32Array(uv.length);
  for (let i = 0; i < uv.length; i += 1) uvF[i] = uv[i] / raw.uscale;
  const unitCount = raw.unitPage.length;
  // renormalise dequantised unit vectors so cosine = dot
  for (let u = 0; u < unitCount; u += 1) {
    let n = 0;
    for (let d = 0; d < dim; d += 1) n += uvF[u * dim + d] ** 2;
    n = Math.sqrt(n) || 1;
    for (let d = 0; d < dim; d += 1) uvF[u * dim + d] /= n;
  }
  return {
    dim, wordIndex, wvF, uvF, unitCount,
    weights: Array.from(b64ToUint8(raw.weights), (x) => x / 255),
    pc: Float32Array.from(raw.pc),
    pageIds: raw.pageIds, unitPage: raw.unitPage, unitKind: raw.unitKind,
    words,
    inCorpus: raw.inCorpus ? b64ToUint8(raw.inCorpus) : null
  };
}

function lookup(sem, token) {
  let i = sem.wordIndex.get(token);
  if (i !== undefined) return i;
  // light inflection fallback for words not in the pruned table
  const tries = [];
  if (token.endsWith("ies")) tries.push(token.slice(0, -3) + "y");
  if (token.endsWith("es")) tries.push(token.slice(0, -2));
  if (token.endsWith("s")) tries.push(token.slice(0, -1));
  if (token.endsWith("ing")) tries.push(token.slice(0, -3), token.slice(0, -3) + "e");
  if (token.endsWith("ed")) tries.push(token.slice(0, -2), token.slice(0, -1));
  for (const t of tries) { i = sem.wordIndex.get(t); if (i !== undefined) return i; }
  return undefined;
}

// Returns {vec, known, total} where vec is unit-length (or null when nothing is known).
export function embedQuery(sem, text) {
  const tokens = String(text || "").toLowerCase().match(TOKEN) || [];
  const acc = new Float32Array(sem.dim);
  let wsum = 0, known = 0;
  for (const token of tokens) {
    const i = lookup(sem, token);
    if (i === undefined) continue;
    known += 1;
    const w = sem.weights[i];
    for (let d = 0; d < sem.dim; d += 1) acc[d] += w * sem.wvF[i * sem.dim + d];
    wsum += w;
  }
  if (!wsum) return { vec: null, known: 0, total: tokens.length };
  let proj = 0;
  for (let d = 0; d < sem.dim; d += 1) { acc[d] /= wsum; proj += acc[d] * sem.pc[d]; }
  let n = 0;
  for (let d = 0; d < sem.dim; d += 1) { acc[d] -= proj * sem.pc[d]; n += acc[d] ** 2; }
  n = Math.sqrt(n);
  if (!n) return { vec: null, known, total: tokens.length };
  for (let d = 0; d < sem.dim; d += 1) acc[d] /= n;
  return { vec: acc, known, total: tokens.length };
}

// Page similarity: best of identity / summary units and a slightly discounted best body section.
export function semanticScores(sem, text, opts = {}) {
  const { vec, known, total } = embedQuery(sem, text);
  const out = new Map();
  if (!vec) return { scores: out, known, total };
  const wSec = opts.secWeight ?? 0.85;
  const best = new Map();
  for (let u = 0; u < sem.unitCount; u += 1) {
    let dot = 0;
    const base = u * sem.dim;
    for (let d = 0; d < sem.dim; d += 1) dot += vec[d] * sem.uvF[base + d];
    const kind = sem.unitKind[u];
    const s = kind === 2 ? dot * wSec : dot;
    const p = sem.unitPage[u];
    if (!best.has(p) || s > best.get(p)) best.set(p, s);
  }
  for (const [p, s] of best) out.set(sem.pageIds[p], s);
  return { scores: out, known, total };
}

export function rankSemantic(sem, text, opts = {}) {
  const { scores, known, total } = semanticScores(sem, text, opts);
  const rows = [...scores].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score);
  return { rows, known, total };
}

// Share of the query's informative words (SIF-weighted) that the Knowledge corpus actually uses. Low values mean
// the query is about something the guides do not discuss; semantic similarity must not create confidence there.
export function corpusCoverage(sem, text) {
  const tokens = String(text || "").toLowerCase().match(TOKEN) || [];
  let num = 0, den = 0;
  for (const token of tokens) {
    const i = lookup(sem, token);
    const w = i === undefined ? 0.8 : sem.weights[i];
    den += w;
    if (i !== undefined && sem.inCorpus && (sem.inCorpus[i >> 3] >> (7 - (i & 7))) & 1) num += w;
  }
  return den ? num / den : 0;
}
