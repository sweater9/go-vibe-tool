import { el, store, slider, select, number, button, canvas, mountLab, fmt, money, clamp } from '../shared/kit.js';
import { compound, rule72, equalWeightVol, simulateBands, ASSET_CLASSES, SCENARIOS, applyScenario, normaliseAlloc, maxDrawdown, COMPANIES, newMarket, stepMarket, netWorth, trade } from './finance-engine.js';

const readout = (parent, items) => { const box = el('div', { class: 'lk-readout' }); const map = {}; for (const [k, label] of items) { const v = el('strong', {}, '—'); map[k] = v; box.append(el('div', { class: 'lk-stat' }, el('small', {}, label), v)); } parent.append(box); return (k, v) => { map[k].textContent = v; }; };
const controls = parent => { const c = el('div', { class: 'lk-controls' }); parent.append(c); return c; };
const C = { brand: '#5548DE', soft: '#bfb3ff', accent: '#e35ca9', good: '#2f9e6b', grid: '#e1dcf7', text: '#4b4570' };
function axes(g, w, h, m, maxV, xl, yl) { g.strokeStyle = C.grid; g.fillStyle = '#6a6396'; g.font = '11px system-ui'; g.lineWidth = 1; for (let i = 0; i <= 4; i++) { const y = m.t + (h - m.t - m.b) * i / 4; g.beginPath(); g.moveTo(m.l, y); g.lineTo(w - m.r, y); g.stroke(); g.fillText(yl(maxV * (1 - i / 4)), 2, y + 4); } }

// ============ 1. Compounding ============
function compoundingExp(stage, ctx) {
  const ctl = controls(stage), cv = canvas(stage, { aspect: 0.55, label: 'Growth chart' });
  const set = readout(stage, [['final', 'Final balance'], ['contrib', 'You contributed'], ['interest', 'Growth'], ['real', 'In today’s money'], ['double', 'Doubling time']]);
  const P = slider(ctl, { id: 'cp-p', label: 'Starting amount', min: 0, max: 100000, step: 500, value: 5000, format: money, onInput: () => run() });
  const M = slider(ctl, { id: 'cp-m', label: 'Added each month', min: 0, max: 3000, step: 25, value: 200, format: money, onInput: () => run() });
  const R = slider(ctl, { id: 'cp-r', label: 'Yearly growth rate', min: 0, max: 15, step: 0.5, value: 7, unit: '%', format: v => fmt(v, 1), onInput: () => run() });
  const Y = slider(ctl, { id: 'cp-y', label: 'Years', min: 1, max: 50, step: 1, value: 30, format: v => fmt(v, 0), onInput: () => run() });
  const I = slider(ctl, { id: 'cp-i', label: 'Inflation', min: 0, max: 8, step: 0.5, value: 2.5, unit: '%', format: v => fmt(v, 1), onInput: () => run() });
  let rows = [], base = null;
  function run() {
    const o = { principal: P.get(), monthly: M.get(), annualRate: R.get() / 100, years: Y.get(), inflation: I.get() / 100 }; rows = compound(o); const last = rows.at(-1);
    set('final', money(last.balance)); set('contrib', money(last.contributed)); set('interest', money(last.interest) + (last.balance ? ` (${fmt(100 * last.interest / last.balance, 0)}%)` : '')); set('real', money(last.real)); set('double', R.get() > 0 ? `${fmt(rule72(R.get()), 1)} yrs (rule of 72)` : '—');
    cv.setLabel(`After ${o.years} years the balance is ${money(last.balance)}, of which ${money(last.contributed)} was contributed and ${money(last.interest)} is growth. In today's money that is ${money(last.real)}.`);
    cv.redraw(); ctx.report({ o, last, interestShare: last.interest / (last.balance || 1), baseline: base }); }
  cv.draw = (g, w, h) => {
    if (!rows.length) return; const m = { l: 56, r: 12, t: 12, b: 26 }, maxV = Math.max(...rows.map(r => r.balance)) * 1.05 || 1, X = i => m.l + (w - m.l - m.r) * i / (rows.length - 1 || 1), Y_ = v => h - m.b - (h - m.t - m.b) * v / maxV;
    axes(g, w, h, m, maxV, '', v => v >= 1e6 ? '$' + fmt(v / 1e6, 1) + 'M' : '$' + fmt(v / 1e3, 0) + 'k');
    const area = (key, color) => { g.fillStyle = color; g.beginPath(); g.moveTo(X(0), Y_(0)); rows.forEach((r, i) => g.lineTo(X(i), Y_(r[key]))); g.lineTo(X(rows.length - 1), Y_(0)); g.closePath(); g.fill(); };
    area('balance', '#9d8dfa'); area('contributed', '#d9d3f7');
    g.strokeStyle = C.good; g.lineWidth = 2; g.setLineDash([5, 4]); g.beginPath(); rows.forEach((r, i) => i ? g.lineTo(X(i), Y_(r.real)) : g.moveTo(X(i), Y_(r.real))); g.stroke(); g.setLineDash([]);
    g.fillStyle = C.text; g.fillText('years →', w - 60, h - 8); [0, Math.floor(rows.length / 2), rows.length - 1].forEach(i => g.fillText(String(rows[i].year), X(i) - 4, h - 8));
    g.fillStyle = '#9d8dfa'; g.fillRect(m.l + 6, m.t + 4, 10, 10); g.fillStyle = C.text; g.fillText('growth', m.l + 20, m.t + 13); g.fillStyle = '#d9d3f7'; g.fillRect(m.l + 70, m.t + 4, 10, 10); g.fillStyle = C.text; g.fillText('your money in', m.l + 84, m.t + 13); g.strokeStyle = C.good; g.beginPath(); g.moveTo(m.l + 170, m.t + 9); g.lineTo(m.l + 186, m.t + 9); g.stroke(); g.fillText('today’s money', m.l + 190, m.t + 13); };
  const row = el('div', { class: 'lk-row' }); stage.append(row);
  button(row, 'Remember this scenario as baseline', () => { base = { final: rows.at(-1).balance, years: Y.get(), rate: R.get() }; ctx.announce(`Baseline saved: ${money(base.final)}.`); }, 'ghost');
  select(row, { id: 'cp-ex', label: 'Examples', options: [{ value: '', label: 'Choose an example…' }, { value: 'early', label: 'Start early: $200/month for 40 years' }, { value: 'late', label: 'Start late: $200/month for 10 years' }, { value: 'lump', label: 'Lump sum only: $20,000, no additions' }], value: '', onChange: v => { const d = { early: [0, 200, 7, 40, 2.5], late: [0, 200, 7, 10, 2.5], lump: [20000, 0, 7, 30, 2.5] }[v]; if (!d) return; P.set(d[0]); M.set(d[1]); R.set(d[2]); Y.set(d[3]); I.set(d[4]); run(); } });
  run();
  return { reset: () => { P.set(5000); M.set(200); R.set(7); Y.set(30); I.set(2.5); base = null; run(); }, show: () => cv.redraw() };
}
const compoundingSteps = [
  { text: 'Stretch the timeline to 30+ years — growth overtakes what you put in.', check: s => s.o.years >= 30 && s.last.interest > s.last.contributed },
  { text: 'Raise the growth rate by 2 points or more and compare the final balance.', check: s => s.o.annualRate >= 0.09 },
  { text: 'Add 3% or more inflation and compare "today’s money" with the balance.', check: s => s.o.inflation >= 0.03 && s.last.real < s.last.balance * 0.7 },
  { text: 'Save a baseline, then change the years — see how time beats everything else.', check: s => s.baseline && s.last.balance > s.baseline.final * 1.2 && s.o.years > s.baseline.years },
];

// ============ 2. Diversification ============
function diversificationExp(stage, ctx) {
  const ctl = controls(stage), cv = canvas(stage, { aspect: 0.55, label: 'Diversification chart' });
  const set = readout(stage, [['vol', 'Portfolio volatility'], ['single', 'One holding'], ['cut', 'Risk removed'], ['floor', 'Floor at this correlation']]);
  const N = slider(ctl, { id: 'dv-n', label: 'Number of equally weighted holdings', min: 1, max: 60, step: 1, value: 1, format: v => fmt(v, 0), onInput: () => run() });
  const S = slider(ctl, { id: 'dv-s', label: 'Each holding’s volatility', min: 10, max: 60, step: 1, value: 30, unit: '%', format: v => fmt(v, 0), onInput: () => run() });
  const RH = slider(ctl, { id: 'dv-c', label: 'How alike holdings move (correlation)', min: 0, max: 1, step: 0.05, value: 0.3, format: v => fmt(v, 2), onInput: () => run() });
  const Y = slider(ctl, { id: 'dv-y', label: 'Outcome fan after', min: 5, max: 30, step: 1, value: 15, unit: ' yrs', format: v => fmt(v, 0), onInput: () => run() });
  let bands = null, seed = 1;
  function run() {
    const s = S.get() / 100, rho = RH.get(), n = Math.round(N.get()), vol = equalWeightVol(s, rho, n), floor = s * Math.sqrt(rho);
    set('vol', fmt(vol * 100, 1) + '%'); set('single', fmt(s * 100, 0) + '%'); set('cut', fmt(100 * (1 - vol / s), 0) + '%'); set('floor', fmt(floor * 100, 1) + '%');
    bands = simulateBands({ start: 10000, mu: 0.07, sigma: vol, years: Y.get(), paths: 400, seed }); bands.vol = vol; bands.n = n;
    cv.setLabel(`With ${n} holdings the portfolio volatility is ${fmt(vol * 100, 1)} percent versus ${fmt(s * 100, 0)} percent for one holding. Simulated outcomes after ${Y.get()} years range from ${money(bands.bands.at(-1).p10)} to ${money(bands.bands.at(-1).p90)}.`);
    cv.redraw(); ctx.report({ n, rho, s, vol, ratio: vol / s, floorHit: n >= 30 && rho >= 0.5 }); }
  cv.draw = (g, w, h) => {
    if (!bands) return; const half = Math.floor(w * 0.46), m = { l: 40, r: 6, t: 14, b: 26 }, s = S.get() / 100, rho = RH.get();
    // left: volatility vs holdings
    g.fillStyle = C.text; g.font = '11px system-ui'; g.fillText('Risk vs number of holdings', m.l, 10);
    const maxVol = s * 1.05, X = n => m.l + (half - m.l - m.r) * (n - 1) / 59, Yv = v => h - m.b - (h - m.t - m.b) * v / maxVol;
    g.strokeStyle = C.grid; for (let i = 0; i <= 4; i++) { const y = m.t + (h - m.t - m.b) * i / 4; g.beginPath(); g.moveTo(m.l, y); g.lineTo(half - m.r, y); g.stroke(); g.fillStyle = '#6a6396'; g.fillText(fmt(maxVol * (1 - i / 4) * 100, 0) + '%', 2, y + 4); }
    g.strokeStyle = C.brand; g.lineWidth = 2.5; g.beginPath(); for (let n = 1; n <= 60; n++) { const v = equalWeightVol(s, rho, n); n === 1 ? g.moveTo(X(n), Yv(v)) : g.lineTo(X(n), Yv(v)); } g.stroke();
    g.strokeStyle = C.accent; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(m.l, Yv(s * Math.sqrt(rho))); g.lineTo(half - m.r, Yv(s * Math.sqrt(rho))); g.stroke(); g.setLineDash([]);
    g.fillStyle = C.accent; g.beginPath(); g.arc(X(bands.n), Yv(bands.vol), 6, 0, 6.3); g.fill(); g.fillStyle = C.text; g.fillText('holdings →', half - 62, h - 8);
    // right: fan
    const x0 = half + 24, yrs = bands.bands.length - 1, maxV = Math.max(...bands.bands.map(b => b.p90)) * 1.05, XX = i => x0 + (w - x0 - 10) * i / yrs, YY = v => h - m.b - (h - m.t - m.b) * v / maxV;
    g.fillStyle = C.text; g.fillText('Simulated outcomes of $10,000 (10th–90th percentile)', x0, 10);
    g.fillStyle = 'rgba(85,72,222,.2)'; g.beginPath(); bands.bands.forEach((b, i) => i ? g.lineTo(XX(i), YY(b.p90)) : g.moveTo(XX(i), YY(b.p90))); for (let i = yrs; i >= 0; i--) g.lineTo(XX(i), YY(bands.bands[i].p10)); g.closePath(); g.fill();
    g.strokeStyle = C.brand; g.lineWidth = 2; g.beginPath(); bands.bands.forEach((b, i) => i ? g.lineTo(XX(i), YY(b.p50)) : g.moveTo(XX(i), YY(b.p50))); g.stroke(); g.fillStyle = C.text; g.fillText(money(bands.bands.at(-1).p90), XX(yrs) - 44, YY(bands.bands.at(-1).p90) - 4); g.fillText(money(bands.bands.at(-1).p10), XX(yrs) - 40, YY(bands.bands.at(-1).p10) + 12); };
  const row = el('div', { class: 'lk-row' }); stage.append(row); button(row, 'New random simulation', () => { seed++; run(); }, 'ghost');
  run();
  return { reset: () => { N.set(1); S.set(30); RH.set(0.3); Y.set(15); seed = 1; run(); }, show: () => cv.redraw() };
}
const diversificationSteps = [
  { text: 'Add holdings — watch portfolio volatility fall. Go past 15.', check: s => s.n >= 15 && s.ratio < 0.7 },
  { text: 'Slide correlation to 1.0 — holdings move together and diversification stops helping.', check: s => s.rho >= 0.95 && s.n >= 10 && s.ratio > 0.95 },
  { text: 'Set correlation to 0 and 30+ holdings for the biggest risk cut.', check: s => s.rho === 0 && s.n >= 30 && s.ratio < 0.2 },
];

// ============ 3. Risk & stress scenarios ============
function riskExp(stage, ctx) {
  const ctl = controls(stage), cv = canvas(stage, { aspect: 0.5, label: 'Scenario chart' });
  const set = readout(stage, [['before', 'Portfolio value'], ['after', 'After the scenario'], ['change', 'Change'], ['dd', 'Typical bad-year drawdown']]);
  const raw = { stocks: 60, bonds: 30, cash: 5, gold: 5 }; const sliders = {};
  ASSET_CLASSES.forEach(a => { sliders[a.id] = slider(ctl, { id: 'rk-' + a.id, label: a.name + ' weight', min: 0, max: 100, step: 5, value: raw[a.id], unit: '%', format: v => fmt(v, 0), onInput: () => run() }); });
  const scn = select(ctl, { id: 'rk-s', label: 'Scenario', options: Object.entries(SCENARIOS).map(([id, s]) => ({ value: id, label: s.name })), value: 'crash', onChange: () => run() });
  const alloc = () => normaliseAlloc(Object.fromEntries(ASSET_CLASSES.map(a => [a.id, sliders[a.id].get()])));
  let seen = new Set();
  function run() {
    const al = alloc(), res = applyScenario(al, scn.get(), 100000);
    // typical bad year: portfolio volatility with the sample correlations of asset classes (simple model) → use seeded paths max drawdown
    const vol = Math.sqrt(ASSET_CLASSES.reduce((a, x) => a + (al[x.id] * x.sigma) ** 2, 0) + 0.3 * 2 * ['stocks-gold', 'stocks-bonds'].reduce((a, p) => { const [u, v] = p.split('-'); return a + al[u] * al[v] * ASSET_CLASSES.find(z => z.id === u).sigma * ASSET_CLASSES.find(z => z.id === v).sigma; }, 0));
    const path = simulateBands({ start: 100000, mu: ASSET_CLASSES.reduce((a, x) => a + al[x.id] * x.mu, 0), sigma: Math.max(vol, 0.001), years: 10, paths: 60, seed: 3 }); const dd = maxDrawdown(path.bands.map(b => b.p10)) || 0;
    set('before', money(res.before)); set('after', money(res.after)); set('change', (res.change >= 0 ? '+' : '') + fmt(res.change * 100, 1) + '%'); set('dd', fmt(Math.max(0, 1 - Math.exp(-2 * vol)) * 100, 0) + '% (est.)');
    seen.add(scn.get()); cv.setLabel(`${SCENARIOS[scn.get()].name}: the portfolio would move from ${money(res.before)} to ${money(res.after)}, a change of ${fmt(res.change * 100, 1)} percent.`);
    cv.redraw(); ctx.report({ al, res, scenario: scn.get(), seenCount: seen.size, stocks: al.stocks }); }
  cv.draw = (g, w, h) => {
    const al = alloc(), items = ASSET_CLASSES.map(a => { const sh = SCENARIOS[scn.get()].shock[a.id] || 0; return { a, w: al[a.id], shock: sh, impact: al[a.id] * sh }; }), m = { l: 90, r: 40, t: 14, b: 14 }, bh = (h - m.t - m.b) / items.length;
    const maxI = Math.max(0.05, ...items.map(i => Math.abs(i.impact))), cx = m.l + (w - m.l - m.r) / 2, sc = (w - m.l - m.r) / 2 / maxI;
    g.font = '12px system-ui'; g.strokeStyle = C.grid; g.beginPath(); g.moveTo(cx, m.t); g.lineTo(cx, h - m.b); g.stroke();
    items.forEach((it, i) => { const y = m.t + i * bh + 6; g.fillStyle = C.text; g.fillText(`${it.a.name} ${fmt(it.w * 100, 0)}%`, 4, y + bh / 2 - 2); g.fillStyle = it.impact >= 0 ? C.good : C.accent; const x = cx + Math.min(0, it.impact) * sc, bw = Math.abs(it.impact) * sc; g.fillRect(x, y, Math.max(2, bw), bh - 14); g.fillStyle = C.text; g.fillText((it.shock >= 0 ? '+' : '') + fmt(it.shock * 100, 0) + '% asset move', it.impact >= 0 ? x + bw + 4 : x + 4, y + bh - 22 + 12 * 0); }); };
  const row = el('div', { class: 'lk-row' }); stage.append(row);
  [['Aggressive', 90, 5, 0, 5], ['Balanced', 60, 30, 5, 5], ['Cautious', 20, 50, 25, 5]].forEach(([l, a, b, c, d]) => button(row, l, () => { sliders.stocks.set(a); sliders.bonds.set(b); sliders.cash.set(c); sliders.gold.set(d); run(); }, 'ghost'));
  run();
  return { reset: () => { ASSET_CLASSES.forEach(a => sliders[a.id].set(raw[a.id])); scn.set('crash'); seen = new Set(); run(); }, show: () => cv.redraw() };
}
const riskSteps = [
  { text: 'Run the stock market crash on an aggressive mix (80%+ stocks).', check: s => s.scenario === 'crash' && s.stocks >= 0.8 && s.res.change < -0.2 },
  { text: 'Shift to a cautious mix (≤ 25% stocks) and compare the same crash.', check: s => s.scenario === 'crash' && s.stocks <= 0.25 && s.res.change > -0.12 },
  { text: 'Try the inflation spike — bonds are not always a safe haven.', check: s => s.scenario === 'inflation' },
  { text: 'Look at all four scenarios.', check: s => s.seenCount >= 4 },
];

// ============ 4. Virtual market ============
function marketExp(stage, ctx) {
  const KEY = 'it_labs_finance_market';
  let m = store.get(KEY) || newMarket(1); let sel = 'NMB', traded = false, msg = '';
  const cv = canvas(stage, { aspect: 0.5, label: 'Virtual market chart' });
  const set = readout(stage, [['cash', 'Virtual cash'], ['worth', 'Net worth'], ['ret', 'Return'], ['day', 'Simulated day']]);
  const ctl = controls(stage);
  const stock = select(ctl, { id: 'mk-t', label: 'Fictional company', options: COMPANIES.map(c => ({ value: c.t, label: `${c.t} — ${c.name}` })), value: sel, onChange: v => { sel = v; draw(); } });
  const qty = number(ctl, { id: 'mk-q', label: 'Shares', min: 1, max: 1000, step: 1, value: 10 });
  const row = el('div', { class: 'lk-row' }); stage.append(row);
  const feed = el('p', { class: 'lk-mono', role: 'status', 'aria-live': 'polite' }); const table = el('div', {}); const news = el('div', { class: 'lk-explain', style: 'padding:8px 14px' });
  stage.append(feed, table, news);
  const save = () => store.set(KEY, m);
  function doTrade(side) { const r = trade(m, sel, Math.round(qty.get()), side); if (!r.ok) { msg = r.error; ctx.announce(msg); } else { m = r.market; traded = true; msg = `${side === 'buy' ? 'Bought' : 'Sold'} ${Math.round(qty.get())} ${sel} at $${m.prices[sel].toFixed(2)} (virtual).`; save(); ctx.announce(msg); } draw(); }
  function advance(d) { m = stepMarket(m, d); save(); msg = `Advanced ${d} simulated trading days.`; ctx.announce(msg); draw(); }
  button(row, 'Buy', () => doTrade('buy')); button(row, 'Sell', () => doTrade('sell'), 'ghost');
  button(row, '+1 week', () => advance(5), 'ghost'); button(row, '+1 month', () => advance(21), 'ghost'); button(row, '+3 months', () => advance(63), 'ghost');
  function draw() {
    const w = netWorth(m); set('cash', money(m.cash)); set('worth', money(w)); const ret = w / m.startCash - 1; set('ret', (ret >= 0 ? '+' : '') + fmt(ret * 100, 1) + '%'); set('day', String(m.day));
    feed.textContent = msg || 'Choose a company, pick a number of shares and press Buy. Then advance time and watch the simulated price move.';
    const held = Object.entries(m.holdings);
    table.innerHTML = held.length ? '<table class="lk-table"><caption class="sr-only">Your virtual holdings</caption><thead><tr><th>Company</th><th>Shares</th><th>Price</th><th>Value</th></tr></thead><tbody>' + held.map(([t, n]) => `<tr><td>${t}</td><td>${n}</td><td>$${m.prices[t].toFixed(2)}</td><td>${money(n * m.prices[t])}</td></tr>`).join('') + '</tbody></table>' : '<p class="lk-hint">No holdings yet. You start with $10,000 of virtual cash.</p>';
    news.innerHTML = '<b>Simulated news</b> (fictional): ' + (m.news.slice(0, 4).join(' · ') || 'none yet — advance time.');
    cv.setLabel(`${sel} simulated price is $${m.prices[sel].toFixed(2)} on day ${m.day}. Your net worth is ${money(w)}, a return of ${fmt(ret * 100, 1)} percent.`); cv.redraw();
    ctx.report({ traded, day: m.day, ret, held: held.length, worth: w }); }
  cv.draw = (g, w, h) => {
    const hist = m.history[sel], mm = { l: 46, r: 10, t: 12, b: 24 }, min = Math.min(...hist) * 0.97, max = Math.max(...hist) * 1.03, X = i => mm.l + (w - mm.l - mm.r) * i / Math.max(1, hist.length - 1), Y = v => h - mm.b - (h - mm.t - mm.b) * (v - min) / (max - min || 1);
    g.strokeStyle = C.grid; g.fillStyle = '#6a6396'; g.font = '11px system-ui'; for (let i = 0; i <= 4; i++) { const v = max - (max - min) * i / 4, y = Y(v); g.beginPath(); g.moveTo(mm.l, y); g.lineTo(w - mm.r, y); g.stroke(); g.fillText('$' + fmt(v, 0), 2, y + 4); }
    g.strokeStyle = C.brand; g.lineWidth = 2.5; g.beginPath(); hist.forEach((v, i) => i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v))); g.stroke(); g.fillStyle = C.text; g.fillText(`${sel} simulated price — day ${m.day}`, mm.l + 4, 10 + 8); };
  const reset = () => { m = newMarket(1); traded = false; msg = 'Market reset. Same fictional market, back to day 0.'; save(); draw(); };
  button(row, 'New market (different seed)', () => { m = newMarket((m.seed % 9) + 1); traded = false; msg = 'New fictional market started with fresh virtual cash.'; save(); draw(); }, 'ghost');
  draw();
  return { reset, show: () => cv.redraw() };
}
const marketSteps = [
  { text: 'Buy some shares of any fictional company.', check: s => s.traded && s.held >= 1 },
  { text: 'Advance one month (21 days) or more and watch prices move.', check: s => s.day >= 21 },
  { text: 'Spread your money over 3 or more companies.', check: s => s.held >= 3 },
  { text: 'Advance past day 100 to see how events and chance change your result.', check: s => s.day >= 100 },
];

const experiments = [
  { id: 'compounding', title: 'Compound growth', summary: 'See how time, rate and regular saving snowball — and what inflation takes back.',
    explain: '<p>With compounding, growth earns growth. Early years look slow; later years steepen. Monthly additions matter, but <b>time</b> matters most. The green dashed line shows the balance in today’s money after inflation.</p><p><code>Years to double ≈ 72 ÷ rate%</code> is the rule of 72.</p>',
    real: 'Constant growth every year is an assumption; real investments rise and fall. Not financial advice.', build: compoundingExp, steps: compoundingSteps },
  { id: 'diversification', title: 'Diversification', summary: 'Find out how spreading money across holdings changes risk — and why it has limits.',
    explain: '<p>Risk (volatility) of an equal-weight portfolio is <code>σ·√(1/n + (1−1/n)·ρ)</code>. More holdings cut the unique risk of each one, but <b>correlation (ρ)</b> sets a floor you cannot diversify away. The fan shows 400 simulated futures (10th to 90th percentile).</p>',
    real: 'Uses assumed volatilities and a single correlation, with random simulated returns. It is a teaching model, not a forecast.', build: diversificationExp, steps: diversificationSteps },
  { id: 'risk', title: 'Risk & stress scenarios', summary: 'Mix asset classes and test the portfolio against illustrative shocks.',
    explain: '<p>A stress test applies an instant shock to each asset class. Stocks usually fall most in a crash while bonds or cash hold up — but an inflation and interest-rate shock can hurt stocks <i>and</i> bonds together.</p>',
    real: 'Shocks are illustrative round numbers, not historical measurements or predictions. Not financial advice.', build: riskExp, steps: riskSteps },
  { id: 'market', title: 'Virtual market', summary: 'Practise buying and selling fictional companies with $10,000 of pretend money.',
    explain: '<p>Prices are generated by a seeded random model with a few scripted fictional news events, so you can replay the same market. Winning here proves nothing about real markets — it is for exploring concepts like risk, spreading and patience.</p><p>Your portfolio is saved only in this browser.</p>',
    real: 'Fictional companies, simulated prices, virtual money. No real market data and no financial advice.', build: marketExp, steps: marketSteps },
];
mountLab({ lab: 'finance', root: document.getElementById('labRoot'), experiments });
