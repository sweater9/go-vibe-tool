/* GoVibeTool Labs — AI & ML engine. Small, deterministic, educational models (no network, no external data). */
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

/* ---- datasets: points in [0,1]^2 with labels 0/1 ---- */
export const DATASETS = ['blobs', 'moons', 'rings', 'xor'];
export function makeDataset(kind, n = 120, noise = 0.08, seed = 1) {
  const r = rng(seed), pts = [];
  for (let i = 0; i < n; i++) {
    const label = i % 2; let x, y;
    if (kind === 'blobs') { const c = label ? [0.7, 0.7] : [0.3, 0.3]; x = c[0] + gauss(r) * (noise + 0.07); y = c[1] + gauss(r) * (noise + 0.07); }
    else if (kind === 'moons') { const t = r() * Math.PI; if (label) { x = 0.5 + 0.28 * Math.cos(t) + 0.14; y = 0.5 + 0.28 * Math.sin(t) - 0.1; y = 1 - y; x = 1 - x + 0.0; } else { x = 0.5 + 0.28 * Math.cos(t) - 0.14; y = 0.5 + 0.28 * Math.sin(t) - 0.1; } x += gauss(r) * noise; y += gauss(r) * noise; y += label ? 0 : 0.05; }
    else if (kind === 'rings') { const t = r() * 2 * Math.PI, rad = (label ? 0.34 : 0.13) + gauss(r) * noise * 0.6; x = 0.5 + rad * Math.cos(t); y = 0.5 + rad * Math.sin(t); }
    else { const qx = r() < 0.5 ? 0.25 : 0.75, qy = label ? (qx < 0.5 ? 0.75 : 0.25) : (qx < 0.5 ? 0.25 : 0.75); x = qx + gauss(r) * (noise + 0.04); y = qy + gauss(r) * (noise + 0.04); }
    pts.push({ x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)), label });
  }
  return pts;
}

/* ---- k-nearest neighbours ---- */
export function knnPredict(points, x, y, k = 3) {
  const d = points.map(p => ({ p, d: (p.x - x) ** 2 + (p.y - y) ** 2 })).sort((a, b) => a.d - b.d).slice(0, Math.max(1, Math.min(k, points.length)));
  const votes = [0, 0]; for (const n of d) votes[n.p.label]++;
  return { label: votes[1] > votes[0] ? 1 : 0, confidence: Math.max(...votes) / d.length, neighbours: d.map(n => n.p) };
}
export function accuracy(points, predict) { if (!points.length) return 0; let ok = 0; for (const p of points) if (predict(p.x, p.y) === p.label) ok++; return ok / points.length; }
export function splitData(points, testFraction = 0.3, seed = 3) { const r = rng(seed), a = points.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } const n = Math.round(a.length * testFraction); return { test: a.slice(0, n), train: a.slice(n) }; }

/* ---- tiny MLP: 2 inputs -> hidden (tanh) -> 1 output (sigmoid), trained with full-batch gradient descent ---- */
const sig = z => 1 / (1 + Math.exp(-z));
export function newMLP(hidden = 6, seed = 1) {
  const r = rng(seed); return { hidden, w1: Array.from({ length: hidden }, () => [(r() - 0.5) * 2, (r() - 0.5) * 2]), b1: Array(hidden).fill(0), w2: Array.from({ length: hidden }, () => (r() - 0.5) * 2), b2: 0, epochs: 0 };
}
export function mlpForward(m, x, y) { const h = m.w1.map((w, i) => Math.tanh(w[0] * (x - 0.5) * 4 + w[1] * (y - 0.5) * 4 + m.b1[i])); let z = m.b2; for (let i = 0; i < h.length; i++) z += m.w2[i] * h[i]; return { h, p: sig(z) }; }
export function mlpLoss(m, pts) { let s = 0; for (const q of pts) { const p = Math.min(1 - 1e-9, Math.max(1e-9, mlpForward(m, q.x, q.y).p)); s += -(q.label * Math.log(p) + (1 - q.label) * Math.log(1 - p)); } return pts.length ? s / pts.length : 0; }
export function mlpTrain(m, pts, { epochs = 1, lr = 0.5 } = {}) {
  const n = pts.length; if (!n) return m;
  for (let e = 0; e < epochs; e++) {
    const g1 = m.w1.map(() => [0, 0]), gb1 = Array(m.hidden).fill(0), g2 = Array(m.hidden).fill(0); let gb2 = 0;
    for (const q of pts) {
      const { h, p } = mlpForward(m, q.x, q.y), dz = p - q.label; gb2 += dz;
      for (let i = 0; i < m.hidden; i++) { g2[i] += dz * h[i]; const dh = dz * m.w2[i] * (1 - h[i] * h[i]); gb1[i] += dh; g1[i][0] += dh * (q.x - 0.5) * 4; g1[i][1] += dh * (q.y - 0.5) * 4; }
    }
    for (let i = 0; i < m.hidden; i++) { m.w2[i] -= lr * g2[i] / n; m.b1[i] -= lr * gb1[i] / n; m.w1[i][0] -= lr * g1[i][0] / n; m.w1[i][1] -= lr * g1[i][1] / n; }
    m.b2 -= lr * gb2 / n; m.epochs++;
  }
  return m;
}
export const mlpPredict = (m, x, y) => mlpForward(m, x, y).p >= 0.5 ? 1 : 0;

/* ---- Naive Bayes text classifier (spam vs not spam, tiny fictional corpus) ---- */
export const tokenize = s => (s.toLowerCase().match(/[a-z']+/g) || []).filter(w => w.length > 1);
export const CORPUS = [
  ['win a free prize now', 'spam'], ['claim your free gift card today', 'spam'], ['urgent your account is suspended click now', 'spam'], ['cheap pills limited offer buy now', 'spam'], ['you have won the lottery claim prize', 'spam'], ['free money guaranteed act now', 'spam'], ['exclusive deal click here to win', 'spam'], ['verify your password urgent click link', 'spam'],
  ['meeting moved to friday at noon', 'ham'], ['can you review my draft before lunch', 'ham'], ['dinner at my place on saturday', 'ham'], ['here are the notes from today', 'ham'], ['thanks for the help with the project', 'ham'], ['reminder the report is due on monday', 'ham'], ['lunch tomorrow at the usual place', 'ham'], ['happy birthday see you at the party', 'ham'],
];
export function trainNB(docs = CORPUS, alpha = 1) {
  const classes = ['spam', 'ham'], counts = { spam: {}, ham: {} }, totals = { spam: 0, ham: 0 }, nd = { spam: 0, ham: 0 }, vocab = new Set();
  for (const [text, c] of docs) { nd[c]++; for (const w of tokenize(text)) { counts[c][w] = (counts[c][w] || 0) + 1; totals[c]++; vocab.add(w); } }
  return { classes, counts, totals, nd, vocab: vocab.size, alpha, n: docs.length };
}
export function classifyNB(m, text) {
  const words = tokenize(text), logs = {}, contrib = [];
  for (const c of m.classes) { let l = Math.log((m.nd[c] + 1e-9) / m.n); for (const w of words) l += Math.log(((m.counts[c][w] || 0) + m.alpha) / (m.totals[c] + m.alpha * (m.vocab + 1))); logs[c] = l; }
  for (const w of new Set(words)) { const s = Math.log(((m.counts.spam[w] || 0) + m.alpha) / (m.totals.spam + m.alpha * (m.vocab + 1))), h = Math.log(((m.counts.ham[w] || 0) + m.alpha) / (m.totals.ham + m.alpha * (m.vocab + 1))); contrib.push({ word: w, score: s - h, known: !!(m.counts.spam[w] || m.counts.ham[w]) }); }
  const mx = Math.max(logs.spam, logs.ham), es = Math.exp(logs.spam - mx), eh = Math.exp(logs.ham - mx), pSpam = es / (es + eh);
  return { label: pSpam >= 0.5 ? 'spam' : 'ham', pSpam, contrib: contrib.sort((a, b) => Math.abs(b.score) - Math.abs(a.score)) };
}

/* ---- embeddings: hashed bag-of-words + curated semantic groups, projected to 2-D with PCA ---- */
export const WORD_GROUPS = {
  animals: 'cat dog horse bird fish lion tiger wolf rabbit puppy kitten',
  food: 'bread pizza apple banana cheese pasta soup rice cake coffee',
  vehicles: 'car bus train bike truck plane boat ship taxi scooter',
  feelings: 'happy sad angry calm afraid proud lonely excited joyful upset',
  tech: 'computer phone laptop robot code network internet software server pixel',
};
export const EMBED_DIM = 16;
function hash32(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function embedWord(word) {
  const w = word.toLowerCase(), v = Array(EMBED_DIM).fill(0), r = rng(hash32(w)); for (let i = 0; i < EMBED_DIM; i++) v[i] = (r() - 0.5) * 0.6;
  for (const [g, list] of Object.entries(WORD_GROUPS)) if (list.split(' ').includes(w)) { const gr = rng(hash32('group:' + g)); for (let i = 0; i < EMBED_DIM; i++) v[i] += (gr() - 0.5) * 3; }
  return v;
}
export function embedText(text) { const ws = tokenize(text), v = Array(EMBED_DIM).fill(0); for (const w of ws) { const e = embedWord(w); for (let i = 0; i < EMBED_DIM; i++) v[i] += e[i] / Math.max(1, ws.length); } return v; }
export const cosine = (a, b) => { let d = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return na && nb ? d / Math.sqrt(na * nb) : 0; };
export function nearest(query, items, k = 3) { const q = embedText(query); return items.map(t => ({ text: t, sim: cosine(q, embedText(t)) })).sort((a, b) => b.sim - a.sim).slice(0, k); }
/** PCA to 2 components with power iteration (deterministic). Returns [{x,y}] normalised to 0..1. */
export function pca2(vectors) {
  const n = vectors.length, d = vectors[0].length, mean = Array(d).fill(0); for (const v of vectors) for (let i = 0; i < d; i++) mean[i] += v[i] / n;
  const X = vectors.map(v => v.map((x, i) => x - mean[i])); const comps = [];
  for (let c = 0; c < 2; c++) {
    let vec = Array.from({ length: d }, (_, i) => Math.sin(i + 1 + c)); for (let it = 0; it < 80; it++) {
      const t = X.map(row => row.reduce((s, x, i) => s + x * vec[i], 0)), nv = Array(d).fill(0); X.forEach((row, k) => { for (let i = 0; i < d; i++) nv[i] += row[i] * t[k]; });
      for (const p of comps) { const dot = nv.reduce((s, x, i) => s + x * p[i], 0); for (let i = 0; i < d; i++) nv[i] -= dot * p[i]; }
      const norm = Math.hypot(...nv) || 1; vec = nv.map(x => x / norm);
    } comps.push(vec);
  }
  const proj = X.map(row => ({ x: row.reduce((s, x, i) => s + x * comps[0][i], 0), y: row.reduce((s, x, i) => s + x * comps[1][i], 0) }));
  const xs = proj.map(p => p.x), ys = proj.map(p => p.y), mnx = Math.min(...xs), mxx = Math.max(...xs), mny = Math.min(...ys), mxy = Math.max(...ys);
  return proj.map(p => ({ x: (p.x - mnx) / (mxx - mnx || 1), y: (p.y - mny) / (mxy - mny || 1) }));
}
