import { el, slider, select, button, bars, canvas, mountLab, fmt, clamp, reduceMotion } from '../shared/kit.js';
import * as M from './ai-engine.js';

const controls = parent => { const c = el('div', { class: 'lk-controls' }); parent.append(c); return c; };
const readout = (parent, items) => { const box = el('div', { class: 'lk-readout' }); const map = {}; for (const [k, label] of items) { const v = el('strong', {}, '—'); map[k] = v; box.append(el('div', { class: 'lk-stat' }, el('small', {}, label), v)); } parent.append(box); return (k, v) => { map[k].textContent = v; }; };
const DS_OPTS = [{ value: 'blobs', label: 'Two blobs (easy)' }, { value: 'moons', label: 'Two moons (curved)' }, { value: 'rings', label: 'Rings (circular)' }, { value: 'xor', label: 'XOR (needs a hidden layer)' }];
const COL = ['#5548DE', '#e35ca9'], BG = ['rgba(85,72,222,.16)', 'rgba(227,92,169,.16)'];

function paintField(g, w, h, predict, res = 24) {
  const cw = w / res, ch = h / res; for (let i = 0; i < res; i++) for (let j = 0; j < res; j++) { g.fillStyle = BG[predict((i + 0.5) / res, 1 - (j + 0.5) / res)]; const x0 = Math.round(i * cw), y0 = Math.round(j * ch); g.fillRect(x0, y0, Math.round((i + 1) * cw) - x0, Math.round((j + 1) * ch) - y0); }
}
function paintPoints(g, w, h, pts, ring) { for (const p of pts) { g.beginPath(); g.arc(p.x * w, (1 - p.y) * h, 5, 0, 6.3); if (p.label) { g.fillStyle = COL[1]; g.fill(); } else { g.fillStyle = COL[0]; g.fillRect(p.x * w - 5, (1 - p.y) * h - 5, 10, 10); } if (ring) { g.strokeStyle = '#2a1f6b'; g.lineWidth = 2; g.stroke(); } } }

// ===== 1. Classifier (k-NN) =====
function knnExp(stage, ctx) {
  const ctl = controls(stage), ds = select(ctl, { id: 'k-ds', label: 'Data set', options: DS_OPTS, value: 'blobs', onChange: () => load() });
  const k = slider(ctl, { id: 'k-k', label: 'Neighbours (k)', min: 1, max: 25, value: 3, format: v => fmt(v, 0), onInput: () => refresh() });
  const noise = slider(ctl, { id: 'k-n', label: 'Noise in data', min: 0, max: 0.2, step: 0.01, value: 0.06, format: v => fmt(v, 2), onInput: () => load() });
  const cv = canvas(stage, { aspect: 0.8, label: 'Classifier decision regions', maxH: 480 }); const set = readout(stage, [['train', 'Training accuracy'], ['test', 'Test accuracy (held out)'], ['gap', 'Gap']]);
  const hint = el('p', { class: 'lk-hint' }, 'Click or tap the plot to ask the model about a new point; its nearest neighbours light up. Squares and circles are the two classes.'); stage.append(hint);
  let train = [], test = [], probe = null, st = { ks: new Set(), noisy: false, probed: false, overfit: false, k: 3 };
  function load() { const d = M.makeDataset(ds.get(), 140, noise.get(), 1), s = M.splitData(d, 0.3, 3); train = s.train; test = s.test; probe = null; refresh(); }
  function refresh() { const K = k.get(), pr = (x, y) => M.knnPredict(train, x, y, K).label; const a = M.accuracy(train, pr), b = M.accuracy(test, pr); set('train', fmt(a * 100, 0) + '%'); set('test', fmt(b * 100, 0) + '%'); set('gap', fmt((a - b) * 100, 0) + ' pts');
    st.ks.add(K); st.k = K; st.noisy = noise.get() >= 0.12; st.overfit = K === 1 && noise.get() >= 0.12 && a - b > 0.05; st.trainAcc = a; st.testAcc = b;
    cv.setLabel(`k-nearest neighbours with k=${K}. Training accuracy ${fmt(a * 100, 0)} percent, test accuracy ${fmt(b * 100, 0)} percent.`); cv.redraw(); ctx.report({ ...st, ks: st.ks.size }); }
  cv.draw = (g, w, h) => { paintField(g, w, h, (x, y) => M.knnPredict(train, x, y, k.get()).label); paintPoints(g, w, h, train); g.globalAlpha = 0.9; paintPoints(g, w, h, test.map(p => ({ ...p })), true); g.globalAlpha = 1;
    if (probe) { const r = M.knnPredict(train, probe.x, probe.y, k.get()); g.strokeStyle = '#2a1f6b'; g.lineWidth = 1.5; for (const n of r.neighbours) { g.beginPath(); g.moveTo(probe.x * w, (1 - probe.y) * h); g.lineTo(n.x * w, (1 - n.y) * h); g.stroke(); } g.fillStyle = '#fff'; g.strokeStyle = COL[r.label]; g.lineWidth = 4; g.beginPath(); g.arc(probe.x * w, (1 - probe.y) * h, 9, 0, 6.3); g.fill(); g.stroke(); } };
  cv.c.addEventListener('click', e => { const r = cv.c.getBoundingClientRect(); probe = { x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height }; const res = M.knnPredict(train, probe.x, probe.y, k.get()); st.probed = true; hint.textContent = `That point is classified as class ${res.label ? 'circle' : 'square'} (${fmt(res.confidence * 100, 0)}% of its ${k.get()} neighbours agree).`; cv.redraw(); ctx.report({ ...st, ks: st.ks.size }); ctx.announce(hint.textContent); });
  cv.c.tabIndex = 0; cv.c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); probe = { x: Math.random(), y: Math.random() }; st.probed = true; const res = M.knnPredict(train, probe.x, probe.y, k.get()); hint.textContent = `A random point is classified as ${res.label ? 'circle' : 'square'}.`; cv.redraw(); ctx.report({ ...st, ks: st.ks.size }); } });
  const row = el('div', { class: 'lk-row' }); stage.append(row); button(row, 'Add random test point (or press Enter on the plot)', () => cv.c.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })), 'ghost');
  load();
  return { reset: () => { ds.set('blobs'); k.set(3); noise.set(0.06); st = { ks: new Set(), noisy: false, probed: false, overfit: false, k: 3 }; load(); }, show: () => cv.redraw() };
}
const knnSteps = [
  { text: 'Click the plot to classify a new point and see its nearest neighbours.', check: s => s.probed },
  { text: 'Try at least three different values of k.', check: s => s.ks >= 3 },
  { text: 'Add lots of noise and set k = 1 — training accuracy beats test accuracy (overfitting).', check: s => s.overfit },
];

// ===== 2. Neural network =====
function nnExp(stage, ctx) {
  const ctl = controls(stage), ds = select(ctl, { id: 'n-ds', label: 'Data set', options: DS_OPTS, value: 'blobs', onChange: () => load() });
  const hid = slider(ctl, { id: 'n-h', label: 'Hidden neurons', min: 1, max: 12, value: 6, format: v => fmt(v, 0), onInput: () => load() });
  const lr = slider(ctl, { id: 'n-lr', label: 'Learning rate', min: 0.05, max: 3, step: 0.05, value: 1, format: v => fmt(v, 2), onInput: () => { st.lr = lr.get(); } });
  const cv = canvas(stage, { aspect: 0.8, label: 'Neural network decision regions', maxH: 480 }), loss = canvas(stage, { aspect: 0.28, label: 'Training loss over time', maxH: 140 });
  const set = readout(stage, [['epoch', 'Epochs'], ['loss', 'Loss'], ['acc', 'Accuracy']]); const row = el('div', { class: 'lk-row' }); stage.append(row);
  let data = [], net = null, hist = [], timer = 0, running = false, st = { epochs: 0, acc: 0, ds: 'blobs', hidden: 6, lr: 1, trained: false };
  const stop = () => { if (timer) cancelAnimationFrame(timer); timer = 0; running = false; runBtn.textContent = 'Train continuously'; };
  function load() { stop(); data = M.makeDataset(ds.get(), 140, 0.05, 1); net = M.newMLP(hid.get(), 2); hist = [M.mlpLoss(net, data)]; st = { ...st, epochs: 0, acc: 0, ds: ds.get(), hidden: hid.get(), trained: false }; update(); }
  function update() { const acc = M.accuracy(data, (x, y) => M.mlpPredict(net, x, y)), l = hist.at(-1); st.acc = acc; st.epochs = net.epochs; set('epoch', fmt(net.epochs, 0)); set('loss', fmt(l, 3)); set('acc', fmt(acc * 100, 0) + '%'); cv.setLabel(`Neural network with ${net.hidden} hidden neurons after ${net.epochs} epochs: accuracy ${fmt(acc * 100, 0)} percent, loss ${fmt(l, 3)}.`); cv.redraw(); loss.redraw(); ctx.report({ ...st }); }
  const step = n => { M.mlpTrain(net, data, { epochs: n, lr: lr.get() }); hist.push(M.mlpLoss(net, data)); if (hist.length > 400) hist.splice(1, 1); st.trained = true; update(); };
  cv.draw = (g, w, h) => { paintField(g, w, h, (x, y) => M.mlpPredict(net, x, y), 28); paintPoints(g, w, h, data); };
  loss.draw = (g, w, h) => { const mx = Math.max(...hist, 0.7), m = 14; g.strokeStyle = '#d9d3f7'; g.strokeRect(m, 6, w - 2 * m, h - 18); g.strokeStyle = '#5548DE'; g.lineWidth = 2; g.beginPath(); hist.forEach((v, i) => { const x = m + i / Math.max(1, hist.length - 1) * (w - 2 * m), y = 6 + (1 - v / mx) * (h - 18); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); g.fillStyle = '#6a6396'; g.font = '11px system-ui'; g.fillText('loss ↓ (lower is better)', m + 4, h - 3); };
  button(row, 'Train 10 epochs', () => step(10)); button(row, 'Train 200 epochs', () => step(200));
  const runBtn = button(row, 'Train continuously', () => { if (running) { stop(); return; } running = true; runBtn.textContent = 'Pause training'; const tick = () => { if (!running) return; step(reduceMotion() ? 20 : 5); if (net.epochs >= 4000) { stop(); return; } timer = requestAnimationFrame(tick); }; tick(); }, 'ghost');
  button(row, 'Re-initialise weights', () => { stop(); net = M.newMLP(hid.get(), (net.epochs + 3) % 97 + 1); hist = [M.mlpLoss(net, data)]; st.trained = false; update(); }, 'ghost');
  load();
  return { reset: () => { stop(); ds.set('blobs'); hid.set(6); lr.set(1); load(); }, show: () => { cv.redraw(); loss.redraw(); } };
}
const nnSteps = [
  { text: 'Train the network on the two blobs for 200 epochs and watch the loss fall.', check: s => s.ds === 'blobs' && s.epochs >= 200 && s.acc >= 0.9 },
  { text: 'Switch to the rings data set and train it to 85%+ accuracy.', check: s => s.ds === 'rings' && s.acc >= 0.85 },
  { text: 'Pick XOR, reach 85%+ accuracy with at least 4 hidden neurons.', check: s => s.ds === 'xor' && s.hidden >= 4 && s.acc >= 0.85 },
];

// ===== 3. Text classifier =====
function textExp(stage, ctx) {
  const ctl = controls(stage), box = el('textarea', { id: 'x-txt', rows: 3, spellcheck: 'false' }); box.value = 'Claim your free prize now';
  ctl.append(el('div', { class: 'lk-field' }, el('label', { for: 'x-txt' }, 'Type a short message'), box));
  const smooth = slider(ctl, { id: 'x-a', label: 'Smoothing for unseen words', min: 0.1, max: 3, step: 0.1, value: 1, format: v => fmt(v, 1), onInput: () => run() });
  const verdict = el('p', { class: 'lk-verdict', role: 'status' }); stage.append(verdict); const words = bars(stage, { label: 'How each word pushes towards spam or not spam' });
  const row = el('div', { class: 'lk-row' }); stage.append(row); const set = readout(stage, [['spam', 'Chance of spam'], ['n', 'Training messages']]);
  let docs = M.CORPUS.slice(), st = { classified: new Set(), flipped: false, taught: false, last: null };
  function run() { const m = M.trainNB(docs, smooth.get()), r = M.classifyNB(m, box.value); verdict.textContent = box.value.trim() ? `Verdict: ${r.label === 'spam' ? 'Spam' : 'Not spam'} (${fmt(r.pSpam * 100, 0)}% spam)` : 'Type a message to classify it.'; set('spam', fmt(r.pSpam * 100, 0) + '%'); set('n', docs.length);
    words.replaceChildren(); for (const c of r.contrib.slice(0, 8)) words.append(el('div', { class: 'lk-bar' }, el('span', {}, c.word + (c.known ? '' : ' (new)')), el('i', { style: `width:${clamp(Math.abs(c.score) / 3, 0.02, 1) * 100}%;${c.score < 0 ? 'background:linear-gradient(90deg,#2f9e6b,#7fd3a9)' : ''}` }), el('span', {}, c.score >= 0 ? 'spam' : 'ok')));
    if (box.value.trim()) { st.classified.add(r.label); if (st.last && st.last !== r.label) st.flipped = true; st.last = r.label; } ctx.report({ ...st, kinds: st.classified.size, taught: st.taught }); ctx.announce(verdict.textContent); }
  box.addEventListener('input', run);
  select(row, { id: 'x-ex', label: 'Examples', options: [{ value: '', label: 'Choose an example…' }, { value: 'Claim your free prize now', label: 'Prize offer' }, { value: 'Lunch meeting on Friday', label: 'Lunch meeting' }, { value: 'Free lunch on Friday', label: 'Mixed signals' }, { value: 'Quarterly synergy blockchain', label: 'Unknown words' }], value: '', onChange: v => { if (v) { box.value = v; run(); } } });
  button(row, 'Teach: this is NOT spam', () => { docs.push([box.value, 'ham']); st.taught = true; run(); ctx.announce('Added to the training data as not spam.'); }, 'ghost'); button(row, 'Teach: this IS spam', () => { docs.push([box.value, 'spam']); st.taught = true; run(); ctx.announce('Added to the training data as spam.'); }, 'ghost');
  run(); st.classified.clear(); st.last = null; st.flipped = false;
  return { reset: () => { docs = M.CORPUS.slice(); box.value = 'Claim your free prize now'; smooth.set(1); st = { classified: new Set(), flipped: false, taught: false, last: null }; run(); st.classified.clear(); st.last = null; } };
}
const textSteps = [
  { text: 'Classify one spam-like and one normal message.', check: s => s.kinds >= 2 },
  { text: 'Teach the model a new example with one of the Teach buttons.', check: s => s.taught },
];

// ===== 4. Embeddings =====
function embedExp(stage, ctx) {
  const all = Object.entries(M.WORD_GROUPS).flatMap(([g, l]) => l.split(' ').map(w => ({ w, g }))), gcol = { animals: '#e35ca9', food: '#e8a13a', vehicles: '#2f9e6b', feelings: '#5548DE', tech: '#2a8fc9' };
  const pts = M.pca2(all.map(a => M.embedWord(a.w))), cv = canvas(stage, { aspect: 0.75, label: 'Word embedding map', maxH: 460 });
  const ctl = controls(stage), inp = el('input', { type: 'text', id: 'm-q', value: 'puppy', autocomplete: 'off', spellcheck: 'false' }); ctl.append(el('div', { class: 'lk-field' }, el('label', { for: 'm-q' }, 'Pick or type a word from the map'), inp));
  const list = el('div', { 'aria-live': 'polite' }), legend = el('p', { class: 'lk-hint' }, 'Colours: ' + Object.keys(gcol).join(', ') + '. Words with similar meaning sit close together. Letter size shows nothing; only distance matters.'); stage.append(list, legend);
  let sel = 'puppy', st = { searched: new Set(), cross: false };
  const idx = w => all.findIndex(a => a.w === w.toLowerCase());
  function show() { const q = inp.value.trim().toLowerCase(), i = idx(q); sel = i >= 0 ? q : sel;
    const ranked = all.filter(a => a.w !== sel).map(a => ({ ...a, sim: M.cosine(M.embedWord(sel), M.embedWord(a.w)) })).sort((a, b) => b.sim - a.sim).slice(0, 5);
    list.replaceChildren(el('p', {}, el('b', {}, `Closest to “${sel}”:`)), el('ol', { class: 'lk-list' }, ranked.map(r => el('li', {}, `${r.w} (${r.g}) — similarity ${fmt(r.sim, 2)}`))), i < 0 && q ? el('p', { class: 'lk-hint' }, `“${q}” is not on this small map; showing results for “${sel}”.`) : '');
    st.searched.add(sel); const g = all[idx(sel)].g; st.cross = st.cross || ranked.slice(0, 3).some(r => r.g !== g) ? true : st.cross; ctx.report({ ...st, count: st.searched.size, sel, top: ranked[0].g === g }); cv.setLabel(`Word map with ${all.length} words in 5 groups. Selected: ${sel}. Nearest: ${ranked.slice(0, 3).map(r => r.w).join(', ')}.`); cv.redraw(); }
  cv.draw = (g, w, h) => { const m = 28; g.font = '12px system-ui'; all.forEach((a, i) => { const x = m + pts[i].x * (w - 2 * m), y = m + (1 - pts[i].y) * (h - 2 * m); const on = a.w === sel; g.fillStyle = gcol[a.g]; g.globalAlpha = on ? 1 : 0.85; g.beginPath(); g.arc(x, y, on ? 7 : 4.5, 0, 6.3); g.fill(); g.globalAlpha = 1; g.fillStyle = on ? '#2a1f6b' : '#6a6396'; if (on || w > 520) g.fillText(a.w, x + 8, y + 4); }); };
  cv.c.addEventListener('click', e => { const r = cv.c.getBoundingClientRect(), mx = (e.clientX - r.left) / r.width * cv.w, my = (e.clientY - r.top) / r.height * cv.h, m = 28; let best = 0, bd = 1e9; pts.forEach((p, i) => { const d = Math.hypot(m + p.x * (cv.w - 2 * m) - mx, m + (1 - p.y) * (cv.h - 2 * m) - my); if (d < bd) { bd = d; best = i; } }); inp.value = all[best].w; show(); });
  inp.addEventListener('change', show); inp.addEventListener('keydown', e => { if (e.key === 'Enter') show(); });
  const row = el('div', { class: 'lk-row' }); stage.append(row); select(row, { id: 'm-ex', label: 'Examples', options: [{ value: '', label: 'Choose a word…' }, ...['puppy', 'pizza', 'train', 'joyful', 'robot'].map(w => ({ value: w, label: w }))], value: '', onChange: v => { if (v) { inp.value = v; show(); } } });
  const sb = el('div', { class: 'lk-field' }); row.append(sb); button(sb, 'Show nearest words', show);
  show(); st.searched.clear();
  return { reset: () => { inp.value = 'puppy'; st = { searched: new Set(), cross: false }; show(); st.searched.clear(); }, show: () => cv.redraw() };
}
const embedSteps = [
  { text: 'Select three different words and read their nearest neighbours.', check: s => s.count >= 3 },
  { text: 'Find a word whose closest match belongs to the same colour group.', check: s => s.top },
];

const experiments = [
  { id: 'classifier', title: 'Classifier (k-NN)', summary: 'Teach a model with coloured points, then ask it about new ones.',
    explain: '<p><b>k-nearest neighbours</b> labels a new point by a vote among its k closest training examples. Small k follows every wiggle (and the noise); large k smooths things out.</p><p>Always judge a model on <b>held-out test data</b> — outlined points here. A big gap between training and test accuracy means <b>overfitting</b>.</p>',
    real: 'A tiny toy data set generated on your device. Real systems use far more data and features.', build: knnExp, steps: knnSteps },
  { id: 'neural', title: 'Neural network', summary: 'Train a small neural network and watch its decision boundary form.',
    explain: '<p>A neuron mixes its inputs, then squashes the result. A few hidden neurons together can bend the boundary around curved data. <b>Training</b> nudges the weights downhill on the loss (gradient descent); the learning rate sets the step size.</p><p>XOR cannot be solved by a single straight line, which is why hidden neurons matter.</p>',
    real: 'A real, but tiny, network trained locally with a fixed random seed. No pre-trained models or servers involved.', build: nnExp, steps: nnSteps },
  { id: 'text', title: 'Text classifier', summary: 'A Naive Bayes spam filter you can inspect and teach.',
    explain: '<p>Naive Bayes counts how often each word appears in spam and in normal messages, then multiplies the evidence for a new message. The bars show which words pushed the verdict. <b>Smoothing</b> stops unseen words from breaking the maths.</p>',
    real: 'Trained on 16 invented example messages. It will be wrong often — that is the lesson about data size and bias.', build: textExp, steps: textSteps },
  { id: 'embeddings', title: 'Word embeddings', summary: 'Explore a map where similar words sit close together.',
    explain: '<p>An <b>embedding</b> turns a word into a list of numbers so similarity becomes distance. Here each word has a 16-number vector and a projection (PCA) squeezes it onto a 2-D map. Related words share a pattern and cluster together.</p>',
    real: 'Hand-built vectors for ~50 words, not a trained language model. Unknown words are not understood.', build: embedExp, steps: embedSteps },
];
mountLab({ lab: 'ai', root: document.getElementById('labRoot'), experiments });
