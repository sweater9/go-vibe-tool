import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as A from '../labs/ai/ai-engine.mjs';
console.log('Running AI & ML Lab engine tests...');
assert.equal(fs.readFileSync(new URL('../labs/ai/ai-engine.js', import.meta.url), 'utf8'), fs.readFileSync(new URL('../labs/ai/ai-engine.mjs', import.meta.url), 'utf8'), '.js and .mjs copies are identical');
// determinism
assert.deepEqual(A.makeDataset('moons', 50, 0.08, 4), A.makeDataset('moons', 50, 0.08, 4));
for (const k of A.DATASETS) { const d = A.makeDataset(k, 100); assert.equal(d.length, 100); assert.equal(d.filter(p => p.label).length, 50); assert.ok(d.every(p => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)); }
// kNN
{ const d = A.makeDataset('blobs', 120, 0.04, 2), { train, test } = A.splitData(d); assert.equal(train.length + test.length, 120);
  assert.ok(A.accuracy(test, (x, y) => A.knnPredict(train, x, y, 3).label) > 0.9, 'kNN separates blobs');
  const r = A.knnPredict([{ x: 0, y: 0, label: 0 }, { x: 1, y: 1, label: 1 }], 0.1, 0.1, 1); assert.equal(r.label, 0); assert.equal(r.confidence, 1);
  const rings = A.makeDataset('rings', 200, 0.05, 2), s = A.splitData(rings); const k1 = A.accuracy(s.train, (x, y) => A.knnPredict(s.train, x, y, 1).label); assert.equal(k1, 1, 'k=1 memorises training data'); }
// MLP learns, loss decreases, xor needs hidden layer
{ const d = A.makeDataset('blobs', 100, 0.04, 1), m = A.newMLP(4, 1), l0 = A.mlpLoss(m, d); A.mlpTrain(m, d, { epochs: 300, lr: 1 }); assert.ok(A.mlpLoss(m, d) < l0 * 0.5, 'loss falls'); assert.ok(A.accuracy(d, (x, y) => A.mlpPredict(m, x, y)) > 0.95); assert.equal(m.epochs, 300);
  const x = A.makeDataset('xor', 120, 0.03, 1), big = A.newMLP(8, 2); A.mlpTrain(big, x, { epochs: 3000, lr: 1.5 }); assert.ok(A.accuracy(x, (px, py) => A.mlpPredict(big, px, py)) > 0.9, 'hidden layer solves XOR');
  const same = A.newMLP(4, 5), same2 = A.newMLP(4, 5); A.mlpTrain(same, d, { epochs: 20 }); A.mlpTrain(same2, d, { epochs: 20 }); assert.deepEqual(same, same2, 'training is deterministic'); }
// Naive Bayes
{ const m = A.trainNB(); assert.equal(A.classifyNB(m, 'Free prize, click now to claim!').label, 'spam'); assert.equal(A.classifyNB(m, 'Lunch meeting on Friday, notes attached').label, 'ham');
  const r = A.classifyNB(m, 'free lunch'); assert.ok(r.pSpam > 0 && r.pSpam < 1); assert.ok(r.contrib.some(c => c.word === 'free' && c.score > 0)); assert.ok(A.classifyNB(m, 'zzzz qqqq').contrib.every(c => !c.known));
  assert.equal(A.tokenize("Don't PANIC, 42!").join(','), "don't,panic"); }
// embeddings
{ assert.ok(A.cosine(A.embedWord('cat'), A.embedWord('dog')) > A.cosine(A.embedWord('cat'), A.embedWord('pizza')), 'related words are closer');
  assert.deepEqual(A.embedWord('cat'), A.embedWord('CAT')); assert.ok(Math.abs(A.cosine(A.embedWord('car'), A.embedWord('car')) - 1) < 1e-9);
  const n = A.nearest('puppy', ['kitten', 'bread', 'bus', 'computer'], 2); assert.equal(n[0].text, 'kitten');
  const words = Object.values(A.WORD_GROUPS).flatMap(g => g.split(' ')), pts = A.pca2(words.map(A.embedWord)); assert.equal(pts.length, words.length); assert.ok(pts.every(p => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1));
  const c = g => { const idx = Object.values(A.WORD_GROUPS)[g].split(' ').map(w => words.indexOf(w)).map(i => pts[i]); return { x: idx.reduce((s, p) => s + p.x, 0) / idx.length, y: idx.reduce((s, p) => s + p.y, 0) / idx.length }; };
  const within = (g) => { const m = c(g); const l = Object.values(A.WORD_GROUPS)[g].split(' ').map(w => pts[words.indexOf(w)]); return l.reduce((s, p) => s + Math.hypot(p.x - m.x, p.y - m.y), 0) / l.length; }; const between = Math.hypot(c(0).x - c(4).x, c(0).y - c(4).y);
  assert.ok(between > within(0), 'groups cluster in the 2-D map'); }
console.log('✓ AI engine: datasets, kNN, MLP training, Naive Bayes, embeddings + PCA');
