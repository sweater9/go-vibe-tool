import { $, el, store, reduceMotion, slider, select, button, canvas, bars, mountLab, fmt, clamp } from '../shared/kit.js';
import { rng } from '../shared/rng.js';
import { GRAVITY, projectile, idealRange, orbit, pendulum, diceDistribution, rollDice, flipCoins, galtonPmf, dropBalls } from './physics-engine.js';

const readout = (parent, items) => { const box = el('div', { class: 'lk-readout' }); const map = {}; for (const [k, label] of items) { const v = el('strong', {}, '—'); map[k] = v; box.append(el('div', { class: 'lk-stat' }, el('small', {}, label), v)); } parent.append(box); return (k, v) => { map[k].textContent = v; }; };
const controls = parent => { const c = el('div', { class: 'lk-controls' }); parent.append(c); return c; };
const animate = (draw, durationMs, done) => {
  if (reduceMotion()) { draw(1); done && done(); return () => {}; }
  let raf, t0; const step = ts => { t0 = t0 ?? ts; const k = Math.min(1, (ts - t0) / durationMs); draw(k); if (k < 1) raf = requestAnimationFrame(step); else done && done(); };
  raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
};
const C = { ink: '#2a1f6b', brand: '#5548DE', soft: '#bfb3ff', ground: '#d9d3f7', accent: '#e35ca9', good: '#2f9e6b' };

// ============ 1. Projectile motion ============
function projectileExp(stage, ctx) {
  const ctl = controls(stage), cv = canvas(stage, { aspect: 0.5, label: 'Projectile motion view' }), set = readout(stage, [['range', 'Range'], ['apex', 'Max height'], ['time', 'Flight time'], ['speed', 'Impact speed']]);
  const speed = slider(ctl, { id: 'pj-v', label: 'Launch speed', min: 5, max: 60, step: 1, value: 25, unit: ' m/s', format: v => fmt(v, 0), onInput: () => preview() });
  const angle = slider(ctl, { id: 'pj-a', label: 'Launch angle', min: 5, max: 85, step: 1, value: 45, unit: '°', format: v => fmt(v, 0), onInput: () => preview() });
  const grav = select(ctl, { id: 'pj-g', label: 'World', options: [{ value: 'earth', label: 'Earth (9.81 m/s²)' }, { value: 'moon', label: 'Moon (1.62 m/s²)' }, { value: 'mars', label: 'Mars (3.71 m/s²)' }, { value: 'jupiter', label: 'Jupiter (24.8 m/s²)' }], value: 'earth', onChange: () => preview() });
  const drag = slider(ctl, { id: 'pj-d', label: 'Air drag', min: 0, max: 0.5, step: 0.01, value: 0, format: v => v === 0 ? 'none' : fmt(v, 2) + ' /s', onInput: () => preview() });
  const height = slider(ctl, { id: 'pj-h', label: 'Launch height', min: 0, max: 30, step: 1, value: 0, unit: ' m', format: v => fmt(v, 0), onInput: () => preview() });
  const row = el('div', { class: 'lk-row' }); stage.append(row);
  let trails = [], current = null, progress = 1, fired = false, cancel = () => {}, lastResult = null;
  const params = () => ({ v0: speed.get(), angle: angle.get(), g: GRAVITY[grav.get()], drag: drag.get(), h0: height.get() });
  const compute = () => { const p = params(); const r = projectile(p); return { p, r, ideal: p.drag ? idealRange(p.v0, p.angle, p.g, p.h0) : r.range }; };
  function preview() { current = compute(); fired = false; progress = 1; cancel(); show(current, true); cv.redraw(); }
  function show(c, isPreview) { set('range', fmt(c.r.range, 1) + ' m'); set('apex', fmt(c.r.apex, 1) + ' m'); set('time', fmt(c.r.flightTime, 2) + ' s'); set('speed', fmt(c.r.impactSpeed, 1) + ' m/s'); cv.setLabel(`${isPreview ? 'Predicted' : 'Launched'} path: range ${fmt(c.r.range, 1)} metres, peak height ${fmt(c.r.apex, 1)} metres, flight time ${fmt(c.r.flightTime, 2)} seconds.`); }
  cv.draw = (g, w, h) => {
    const all = [...trails.map(t => t.r), ...(current ? [current.r] : [])]; const maxX = Math.max(30, ...all.map(r => r.range)) * 1.08, maxY = Math.max(10, ...all.map(r => r.apex)) * 1.25;
    const m = 24, sx = (w - 2 * m) / maxX, sy = Math.min((h - 2 * m) / maxY, sx * 1.4), X = x => m + x * sx, Y = y => h - m - y * sy;
    g.fillStyle = C.ground; g.fillRect(0, Y(0), w, h - Y(0)); g.strokeStyle = '#a99fe0'; g.beginPath(); g.moveTo(0, Y(0)); g.lineTo(w, Y(0)); g.stroke();
    g.fillStyle = '#6a6396'; g.font = '11px system-ui'; for (let d = 0; d <= maxX; d += maxX > 120 ? 40 : maxX > 60 ? 20 : 10) { g.fillText(d + ' m', X(d) - 10, h - 6); }
    const path = (r, upto = 1, color, dash) => { g.beginPath(); g.setLineDash(dash || []); g.strokeStyle = color; g.lineWidth = dash ? 1.5 : 2.5; const n = Math.max(1, Math.floor(r.points.length * upto)); for (let i = 0; i < n; i++) { const p = r.points[i]; i ? g.lineTo(X(p.x), Y(p.y)) : g.moveTo(X(p.x), Y(p.y)); } g.stroke(); g.setLineDash([]); return r.points[Math.max(0, n - 1)]; };
    trails.slice(-4).forEach(t => path(t.r, 1, '#c9c1ee', [4, 4]));
    if (current) { const showPath = fired ? progress : 1; const tip = path(current.r, showPath, fired ? C.brand : '#8f84e8', fired ? null : [6, 4]);
      if (fired) { g.fillStyle = C.accent; g.beginPath(); g.arc(X(tip.x), Y(tip.y), 7, 0, 6.3); g.fill(); }
      else { g.fillStyle = C.ink; g.beginPath(); g.arc(X(0), Y(current.p.h0), 6, 0, 6.3); g.fill(); const a = current.p.angle * Math.PI / 180; g.strokeStyle = C.ink; g.lineWidth = 2; g.beginPath(); g.moveTo(X(0), Y(current.p.h0)); g.lineTo(X(0) + Math.cos(a) * 40, Y(current.p.h0) - Math.sin(a) * 40); g.stroke(); }
      if (fired && progress >= 1) { g.fillStyle = C.good; g.beginPath(); g.arc(X(current.r.range), Y(0), 5, 0, 6.3); g.fill(); } }
  };
  button(row, 'Launch', () => { current = compute(); fired = true; progress = 0; cancel(); show(current, false); ctx.announce(`Launched. Range ${fmt(current.r.range, 1)} metres.`);
    cancel = animate(k => { progress = k; cv.redraw(); }, clamp(current.r.flightTime * 350, 500, 2200), () => { trails.push(current); lastResult = { ...current, launches: trails.length }; report(); }); });
  button(row, 'Clear trails', () => { trails = []; cv.redraw(); }, 'ghost');
  const ex = el('div', { class: 'lk-row' }); stage.append(ex); el('span', {});
  select(ex, { id: 'pj-ex', label: 'Examples', options: [{ value: '', label: 'Choose an example…' }, { value: 'cannon', label: 'Classic cannon (45°, 30 m/s)' }, { value: 'lob', label: 'High lob (80°, 30 m/s)' }, { value: 'flat', label: 'Flat shot from a cliff (0° → 5°, 20 m height)' }, { value: 'moon', label: 'Moon golf shot (40°, 30 m/s)' }], value: '', onChange: v => { const d = { cannon: [30, 45, 'earth', 0, 0], lob: [30, 80, 'earth', 0, 0], flat: [20, 5, 'earth', 0, 20], moon: [30, 40, 'moon', 0, 0] }[v]; if (!d) return; speed.set(d[0]); angle.set(d[1]); grav.set(d[2]); drag.set(d[3]); height.set(d[4]); preview(); } });
  const report = () => { if (!lastResult) return; const c = lastResult; ctx.report({ launched: true, angle: c.p.angle, g: c.p.g, drag: c.p.drag, h0: c.p.h0, range: c.r.range, ideal: c.ideal, launches: trails.length, bestAngleSeen: trails.length >= 3 }); };
  const reset = () => { speed.set(25); angle.set(45); grav.set('earth'); drag.set(0); height.set(0); trails = []; lastResult = null; preview(); };
  preview();
  return { reset, show: () => cv.redraw() };
}
const projectileSteps = [
  { text: 'Launch at about 45° (40–50°) on Earth with no air drag.', check: s => s.launched && s.angle >= 40 && s.angle <= 50 && s.g === GRAVITY.earth && s.drag === 0 },
  { text: 'Launch on the Moon and notice the much longer flight.', check: s => s.launched && s.g === GRAVITY.moon },
  { text: 'Turn air drag on and launch — the range falls short of the ideal parabola.', check: s => s.launched && s.drag > 0 && s.range < s.ideal * 0.95 },
  { text: 'Try three different launches to hunt for the angle that goes farthest.', check: s => s.launches >= 3 },
];

// ============ 2. Orbital gravity ============
function orbitExp(stage, ctx) {
  const ctl = controls(stage), cv = canvas(stage, { aspect: 0.75, label: 'Orbit view', maxH: 520 }), set = readout(stage, [['type', 'Orbit type'], ['ecc', 'Eccentricity'], ['energy', 'Total energy'], ['drift', 'Energy drift']]);
  const spd = slider(ctl, { id: 'ob-v', label: 'Launch speed (1.00 = circular orbit)', min: 0.3, max: 1.7, step: 0.01, value: 1, format: v => fmt(v, 2) + '×', onInput: () => run() });
  let res = null, progress = 1, cancel = () => {}, played = new Set();
  const describe = r => r.type === 'escape' ? 'Escape trajectory: the planet leaves and never returns.' : r.type === 'circular' ? 'Circular orbit.' : `Elliptical orbit, closest ${fmt(r.rmin, 2)} and farthest ${fmt(r.rmax, 2)} units from the star.`;
  function run() {
    res = orbit({ speed: spd.get(), maxTime: 25 }); set('type', { circular: 'Circular', elliptical: 'Elliptical', escape: 'Escape' }[res.type]); set('ecc', res.escaped ? '≥ 1 (open)' : fmt(res.eccentricity, 2)); set('energy', fmt(res.energy, 3)); set('drift', res.energyDrift < 1e-4 ? '< 0.0001' : fmt(res.energyDrift, 4));
    cv.setLabel(describe(res)); progress = 0; cancel(); cancel = animate(k => { progress = k; cv.redraw(); }, 2200);
    played.add(res.type); ctx.report({ type: res.type, speed: spd.get(), kinds: played.size, ecc: res.eccentricity }); }
  cv.draw = (g, w, h) => {
    const maxR = Math.max(2.2, ...(res ? res.points.map(p => Math.hypot(p.x, p.y)).filter(r => r < 6) : [1])) * 1.1, s = Math.min(w, h) / 2 / maxR, cx = w / 2, cy = h / 2;
    g.strokeStyle = '#d9d3f7'; g.beginPath(); g.arc(cx, cy, s, 0, 6.3); g.stroke();
    g.fillStyle = '#f5b83d'; g.beginPath(); g.arc(cx, cy, 12, 0, 6.3); g.fill();
    if (!res) return; const n = Math.max(2, Math.floor(res.points.length * progress)); g.strokeStyle = C.brand; g.lineWidth = 2.5; g.beginPath();
    for (let i = 0; i < n; i++) { const p = res.points[i]; const x = cx + p.x * s, y = cy - p.y * s; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    const tip = res.points[n - 1]; g.fillStyle = C.accent; g.beginPath(); g.arc(cx + tip.x * s, cy - tip.y * s, 7, 0, 6.3); g.fill(); };
  const row = el('div', { class: 'lk-row' }); stage.append(row);
  button(row, 'Replay orbit', () => run()); [['Circular', 1], ['Elliptical', 0.8], ['Comet-like', 0.5], ['Escape', 1.5]].forEach(([l, v]) => button(row, l, () => { spd.set(v); run(); }, 'ghost'));
  run();
  return { reset: () => { spd.set(1); run(); }, show: () => cv.redraw() };
}
const orbitSteps = [
  { text: 'Set the speed to 1.00× to make a (nearly) circular orbit.', check: s => Math.abs(s.speed - 1) < 0.015 && s.type === 'circular' },
  { text: 'Slow the planet down to make an elongated ellipse.', check: s => s.type === 'elliptical' && s.ecc > 0.2 },
  { text: 'Speed it past the escape speed (about 1.41×) and watch it leave.', check: s => s.type === 'escape' },
  { text: 'Discover all three orbit types: circular, elliptical and escape.', check: s => s.kinds >= 3 },
];

// ============ 3. Pendulum & energy ============
function pendulumExp(stage, ctx) {
  const ctl = controls(stage), cv = canvas(stage, { aspect: 0.62, label: 'Pendulum view' }), set = readout(stage, [['period', 'Measured period'], ['t0', 'Small-angle formula'], ['ratio', 'Difference'], ['energy', 'Energy left']]);
  const len = slider(ctl, { id: 'pe-l', label: 'Length', min: 0.3, max: 3, step: 0.1, value: 1, unit: ' m', format: v => fmt(v, 1), onInput: () => run() });
  const ang = slider(ctl, { id: 'pe-a', label: 'Start angle', min: 5, max: 150, step: 1, value: 40, unit: '°', format: v => fmt(v, 0), onInput: () => run() });
  const damp = slider(ctl, { id: 'pe-d', label: 'Damping (friction)', min: 0, max: 1, step: 0.02, value: 0, format: v => v === 0 ? 'none' : fmt(v, 2), onInput: () => run() });
  let res = null, prog = 0, cancel = () => {}, maxPE = 1;
  function run() {
    res = pendulum({ length: len.get(), theta0: ang.get(), damping: damp.get(), duration: 12 }); maxPE = res.startEnergy || 1; const ratio = res.period / res.smallAnglePeriod;
    set('period', Number.isFinite(res.period) ? fmt(res.period, 2) + ' s' : 'needs more swings'); set('t0', fmt(res.smallAnglePeriod, 2) + ' s'); set('ratio', Number.isFinite(ratio) ? (ratio >= 1 ? '+' : '') + fmt((ratio - 1) * 100, 1) + '%' : '—'); set('energy', fmt(100 * res.endEnergy / res.startEnergy, 0) + '%');
    cv.setLabel(`Pendulum of length ${fmt(len.get(), 1)} metres released from ${ang.get()} degrees. Measured period ${Number.isFinite(res.period) ? fmt(res.period, 2) + ' seconds' : 'not yet available'}.`);
    cancel(); prog = 0; cancel = animate(k => { prog = k; cv.redraw(); }, 12000 * 0.6 > 6000 ? 6000 : 4000, () => {});
    ctx.report({ ang: ang.get(), len: len.get(), damp: damp.get(), ratio, endFrac: res.endEnergy / res.startEnergy, ran: true }); }
  cv.draw = (g, w, h) => {
    if (!res) return; const idx = Math.min(res.points.length - 1, Math.floor(res.points.length * prog)), p = res.points[idx], px = w * 0.34, py = 26, L = Math.min(h - 70, (w * 0.32)) * (len.get() / 3 * 0.7 + 0.3);
    const bx = px + Math.sin(p.theta) * L, by = py + Math.cos(p.theta) * L;
    g.strokeStyle = '#a99fe0'; g.beginPath(); g.moveTo(px - 40, py); g.lineTo(px + 40, py); g.stroke(); g.strokeStyle = C.ink; g.lineWidth = 2; g.beginPath(); g.moveTo(px, py); g.lineTo(bx, by); g.stroke();
    g.fillStyle = C.brand; g.beginPath(); g.arc(bx, by, 14, 0, 6.3); g.fill();
    const bw = Math.min(150, w * 0.34), bxm = w - bw - 24, hh = h - 60; const E = Math.max(1e-9, maxPE);
    const bar = (x, v, color, label) => { const bh = clamp(v / E, 0, 1) * hh; g.fillStyle = '#ebe7ff'; g.fillRect(x, 24, 34, hh); g.fillStyle = color; g.fillRect(x, 24 + hh - bh, 34, bh); g.fillStyle = '#4b4570'; g.font = '11px system-ui'; g.fillText(label, x - 2, h - 14); };
    bar(bxm, p.ke, C.accent, 'Motion'); bar(bxm + 52, p.pe, C.brand, 'Height'); bar(bxm + 104, p.ke + p.pe, C.good, 'Total'); };
  const row = el('div', { class: 'lk-row' }); stage.append(row); button(row, 'Release again', () => run());
  run();
  return { reset: () => { len.set(1); ang.set(40); damp.set(0); run(); }, show: () => cv.redraw() };
}
const pendulumSteps = [
  { text: 'Use a small start angle (≤ 10°) — the measured period matches the textbook formula.', check: s => s.ang <= 10 && Number.isFinite(s.ratio) && Math.abs(s.ratio - 1) < 0.01 },
  { text: 'Swing it from 90° or more — a big swing takes noticeably longer.', check: s => s.ang >= 90 && s.ratio > 1.1 },
  { text: 'Add damping and watch the total energy fade away.', check: s => s.damp >= 0.2 && s.endFrac < 0.3 },
  { text: 'Make the pendulum longer than 2 m — longer pendulums swing slower.', check: s => s.len >= 2 },
];

// ============ 4. Probability ============
function probabilityExp(stage, ctx) {
  const ctl = controls(stage), cv = canvas(stage, { aspect: 0.55, label: 'Probability histogram' });
  const mode = select(ctl, { id: 'pr-m', label: 'Experiment', options: [{ value: 'dice', label: 'Rolling dice' }, { value: 'coin', label: 'Coin flips (law of large numbers)' }, { value: 'galton', label: 'Galton board (bell curve)' }], value: 'dice', onChange: () => { sync(); draw(); } });
  const nDice = slider(ctl, { id: 'pr-n', label: 'Number of dice', min: 1, max: 6, step: 1, value: 2, format: v => fmt(v, 0), onInput: () => draw() });
  const trials = slider(ctl, { id: 'pr-t', label: 'Trials', min: 10, max: 20000, step: 10, value: 100, format: v => fmt(v, 0), onInput: () => draw() });
  const bias = slider(ctl, { id: 'pr-b', label: 'Coin chance of heads', min: 0.1, max: 0.9, step: 0.05, value: 0.5, format: v => fmt(v * 100, 0) + '%', onInput: () => draw() });
  const set = readout(stage, [['a', 'Result'], ['b', 'Theory'], ['c', 'Difference'], ['d', 'Seed']]);
  let seed = 1, data = null, kind = 'dice';
  const sync = () => { kind = mode.get(); nDice.el.hidden = kind !== 'dice'; bias.el.hidden = kind !== 'coin'; };
  function draw() {
    const rand = rng(seed * 7919); sync(); const T = Math.round(trials.get());
    if (kind === 'dice') { const n = Math.round(nDice.get()), th = diceDistribution(n, 6), sim = rollDice(rand, n, 6, T), total = sim.counts.reduce((a, b) => a + b, 0), mi = th.probs.indexOf(Math.max(...th.probs));
      data = { kind, labels: th.probs.map((_, i) => String(i + n)), sim: sim.counts.map(c => c / total), th: th.probs }; set('a', `Most common sum: ${sim.counts.indexOf(Math.max(...sim.counts)) + n}`); set('b', `Most likely sum: ${mi + n} (${fmt(th.probs[mi] * 100, 1)}%)`); set('c', `${fmt(Math.max(...th.probs.map((p, i) => Math.abs(p - sim.counts[i] / total))) * 100, 1)} pts max gap`);
      ctx.report({ mode: 'dice', n, T, mostCommonIsTheory: sim.counts.indexOf(Math.max(...sim.counts)) === mi, rolls: 1 }); }
    else if (kind === 'coin') { const p = bias.get(), f = flipCoins(rand, T, p); data = { kind, running: f.running, p }; set('a', `${fmt(f.proportion * 100, 1)}% heads (${f.heads} of ${T})`); set('b', `${fmt(p * 100, 0)}% expected`); set('c', `${fmt(Math.abs(f.proportion - p) * 100, 1)} pts`); ctx.report({ mode: 'coin', T, off: Math.abs(f.proportion - p), p }); }
    else { const rows = 12, th = galtonPmf(rows), bins = dropBalls(rand, rows, T); data = { kind, labels: th.map((_, i) => String(i)), sim: bins.map(b => b / T), th }; set('a', `${T} balls dropped`); set('b', `Centre bin ${fmt(th[6] * 100, 1)}%`); set('c', `${fmt(Math.abs(bins[6] / T - th[6]) * 100, 1)} pts`); ctx.report({ mode: 'galton', T }); }
    set('d', String(seed)); cv.setLabel(`${kind === 'coin' ? 'Running proportion of heads settles near the true chance as flips increase.' : 'Bars show simulated frequencies; outlines show the exact theoretical probabilities.'} ${document.querySelector('#panel-probability .lk-readout')?.innerText.replace(/\n/g, ' ') || ''}`);
    cv.redraw(); }
  cv.draw = (g, w, h) => {
    if (!data) return; const m = 32, W = w - m * 1.5, H = h - m * 1.6;
    if (data.kind === 'coin') { const maxN = data.running.at(-1)[0]; g.strokeStyle = '#d9d3f7'; g.beginPath(); const y = v => m / 2 + (1 - v) * H; g.moveTo(m, y(data.p)); g.lineTo(m + W, y(data.p)); g.stroke(); g.fillStyle = '#6a6396'; g.font = '11px system-ui'; g.fillText(fmt(data.p * 100, 0) + '%', 2, y(data.p) + 4);
      g.strokeStyle = C.brand; g.lineWidth = 2; g.beginPath(); data.running.forEach(([n, v], i) => { const x = m + (Math.log10(n) / Math.log10(Math.max(10, maxN))) * W; i ? g.lineTo(x, y(v)) : g.moveTo(x, y(v)); }); g.stroke(); g.fillText('flips (log scale) →', w - 120, h - 8); return; }
    const n = data.sim.length, bw = W / n, max = Math.max(...data.sim, ...data.th) * 1.1; g.font = '11px system-ui';
    data.sim.forEach((v, i) => { const x = m + i * bw, bh = v / max * H; g.fillStyle = C.soft; g.fillRect(x + 2, m / 2 + H - bh, bw - 4, bh); const tv = data.th[i] / max * H; g.strokeStyle = C.accent; g.lineWidth = 2; g.strokeRect(x + 2, m / 2 + H - tv, bw - 4, tv); g.fillStyle = '#4b4570'; if (n <= 24 || i % 2 === 0) g.fillText(data.labels[i], x + bw / 2 - 5, h - 10); }); };
  const row = el('div', { class: 'lk-row' }); stage.append(row);
  button(row, 'Run again (new random seed)', () => { seed++; draw(); ctx.announce('New random run.'); }); button(row, 'Same seed, more trials: 20,000', () => { trials.set(20000); draw(); }, 'ghost');
  sync(); draw();
  return { reset: () => { mode.set('dice'); nDice.set(2); trials.set(100); bias.set(0.5); seed = 1; draw(); }, show: () => cv.redraw() };
}
const probabilitySteps = [
  { text: 'Roll 2 dice 1,000+ times — the sum 7 comes up most often.', check: s => s.mode === 'dice' && s.n === 2 && s.T >= 1000 && s.mostCommonIsTheory },
  { text: 'Flip a fair coin 1,000+ times and see the share of heads settle near 50%.', check: s => s.mode === 'coin' && s.T >= 1000 && s.p === 0.5 && s.off < 0.05 },
  { text: 'Drop 5,000+ balls on the Galton board to reveal the bell curve.', check: s => s.mode === 'galton' && s.T >= 5000 },
];

const experiments = [
  { id: 'projectile', title: 'Projectile motion', summary: 'Launch a ball and see how speed, angle, gravity and air drag shape its path.',
    explain: '<p>Without air, a launched object follows a parabola: sideways speed stays constant while gravity pulls it down at <code>g</code>. Range is greatest near 45° on flat ground. Air drag slows both directions, shortening the flight and favouring lower angles.</p><p>Drag here is a simple linear model solved with a numerical (RK4) integrator.</p>',
    real: 'A simplified model with no wind, spin or changing air density. Numbers are illustrative, not engineering-grade.', build: projectileExp, steps: projectileSteps },
  { id: 'orbit', title: 'Orbital gravity', summary: 'Change a planet’s launch speed and discover circular, elliptical and escape orbits.',
    explain: '<p>A planet pulled by gravity falls around its star. At exactly the circular speed the path is a circle; slower gives a stretched ellipse; at about 1.41× (the escape speed) the path stops closing and the planet leaves.</p><p>Units are normalised (star strength and start distance = 1). The integrator conserves energy, shown as “energy drift”.</p>',
    real: 'A two-body model in normalised units. Real systems have many bodies, relativity and measured masses.', build: orbitExp, steps: orbitSteps },
  { id: 'pendulum', title: 'Pendulum & energy', summary: 'Watch energy swap between motion and height, and test the textbook period formula.',
    explain: '<p>A pendulum constantly trades <b>height energy</b> for <b>motion energy</b>; their total stays constant unless friction removes it. The formula <code>T = 2π√(L/g)</code> only holds for small swings — large swings take longer.</p>',
    real: 'Idealised point mass on a massless rod, with simple linear damping.', build: pendulumExp, steps: pendulumSteps },
  { id: 'probability', title: 'Probability', summary: 'Roll dice, flip coins and drop balls to see chance turn into predictable patterns.',
    explain: '<p>Single outcomes are random, but many trials follow the exact probabilities (bars vs outlines). More trials mean the simulated bars hug the theory — the <b>law of large numbers</b>. Adding many small random steps makes a <b>bell curve</b>.</p><p>The simulation uses a seeded generator so a run can be reproduced.</p>',
    real: 'Pseudo-random simulation on your device; not a source of real random numbers for security or gambling.', build: probabilityExp, steps: probabilitySteps },
];
mountLab({ lab: 'science', root: document.getElementById('labRoot'), experiments });
