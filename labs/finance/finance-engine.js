/* GoVibeTool Finance & Market Simulation Lab — pure engine. Educational models; fictional companies; simulated prices only. */
import { rng } from '../shared/rng.js';

/** Month-by-month growth with monthly compounding. Contributions are added at the end of each month. */
export function compound({ principal = 0, monthly = 0, annualRate = 0.07, years = 10, inflation = 0 }) {
  let bal = principal, contributed = principal; const mr = annualRate / 12;
  const rows = [{ year: 0, balance: bal, contributed, interest: 0, real: bal }];
  for (let m = 1; m <= Math.round(years * 12); m++) {
    bal = bal * (1 + mr) + monthly; contributed += monthly;
    if (m % 12 === 0) rows.push({ year: m / 12, balance: bal, contributed, interest: bal - contributed, real: bal / Math.pow(1 + inflation, m / 12) });
  }
  return rows;
}
/** Annual-compounding variant computed year by year (contributions added monthly, interest credited once a year). */
export function compoundAnnual({ principal = 0, monthly = 0, annualRate = 0.07, years = 10, inflation = 0 }) {
  const rows = [{ year: 0, balance: principal, contributed: principal, interest: 0, real: principal }]; let bal = principal, contributed = principal;
  for (let y = 1; y <= years; y++) { let yearContrib = 0, simple = 0; for (let m = 0; m < 12; m++) { yearContrib += monthly; simple += monthly * annualRate * ((11 - m) / 12); }
    bal = bal * (1 + annualRate) + yearContrib + simple; contributed += yearContrib; rows.push({ year: y, balance: bal, contributed, interest: bal - contributed, real: bal / Math.pow(1 + inflation, y) }); }
  return rows;
}
export const rule72 = ratePct => 72 / ratePct;
export const futureValue = (p, r, n) => p * Math.pow(1 + r, n);

/** Standard deviation of an equal-weight portfolio of n assets with equal volatility and equal pairwise correlation rho. */
export const equalWeightVol = (sigma, rho, n) => sigma * Math.sqrt(1 / n + (1 - 1 / n) * rho);
export function portfolioStats(weights, assets, corr) {
  let mu = 0, v = 0;
  for (let i = 0; i < assets.length; i++) { mu += weights[i] * assets[i].mu; for (let j = 0; j < assets.length; j++) v += weights[i] * weights[j] * assets[i].sigma * assets[j].sigma * (i === j ? 1 : corr[i][j]); }
  return { mu, sigma: Math.sqrt(v) };
}
/** Box–Muller normal from a uniform source. */
export function normal(rand) { let u = 0; while (u === 0) u = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand()); }
/** Monte-Carlo wealth paths (yearly steps, lognormal returns). Returns percentile bands per year. */
export function simulateBands({ start = 10000, mu = 0.07, sigma = 0.15, years = 20, paths = 500, seed = 1, yearlyAdd = 0 }) {
  const rand = rng(seed), all = Array.from({ length: years + 1 }, () => []);
  for (let p = 0; p < paths; p++) { let v = start; all[0].push(v); for (let y = 1; y <= years; y++) { v = (v + yearlyAdd) * Math.exp((mu - sigma * sigma / 2) + sigma * normal(rand)); all[y].push(v); } }
  const q = (arr, f) => { const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
  return { years, bands: all.map(a => ({ p10: q(a, 0.1), p50: q(a, 0.5), p90: q(a, 0.9) })), probLoss: all[years].filter(v => v < start + yearlyAdd * years).length / paths, finals: all[years] };
}
export function maxDrawdown(series) { let peak = series[0], mdd = 0; for (const v of series) { peak = Math.max(peak, v); mdd = Math.max(mdd, (peak - v) / peak); } return mdd; }

export const ASSET_CLASSES = [
  { id: 'stocks', name: 'Stocks', mu: 0.08, sigma: 0.18 }, { id: 'bonds', name: 'Bonds', mu: 0.035, sigma: 0.06 },
  { id: 'cash', name: 'Cash', mu: 0.02, sigma: 0.005 }, { id: 'gold', name: 'Gold', mu: 0.04, sigma: 0.15 },
];
/** Stress scenarios: instant percentage shocks per asset class (illustrative, not forecasts or historical measurements). */
export const SCENARIOS = {
  crash: { name: 'Stock market crash', shock: { stocks: -0.35, bonds: 0.04, cash: 0, gold: 0.08 } },
  inflation: { name: 'Inflation & rate spike', shock: { stocks: -0.18, bonds: -0.14, cash: -0.04, gold: 0.1 } },
  recession: { name: 'Deep recession', shock: { stocks: -0.28, bonds: 0.06, cash: 0, gold: 0.05 } },
  boom: { name: 'Strong boom', shock: { stocks: 0.25, bonds: -0.02, cash: 0.01, gold: -0.05 } },
};
export function applyScenario(alloc, scenarioId, value = 100000) {
  const sc = SCENARIOS[scenarioId]; let after = 0;
  for (const [k, w] of Object.entries(alloc)) after += value * w * (1 + (sc.shock[k] || 0));
  return { before: value, after, change: after / value - 1 };
}
export function normaliseAlloc(raw) { const total = Object.values(raw).reduce((a, b) => a + b, 0) || 1; return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v / total])); }

/* ---------------- Virtual market (fictional companies) ---------------- */
export const COMPANIES = [
  { t: 'NMB', name: 'Nimbus Cloud', price: 120, mu: 0.14, sigma: 0.38 }, { t: 'VRD', name: 'Verdant Foods', price: 54, mu: 0.06, sigma: 0.16 },
  { t: 'ATL', name: 'Atlas Energy', price: 78, mu: 0.07, sigma: 0.3 }, { t: 'PLS', name: 'Pulse Health', price: 96, mu: 0.09, sigma: 0.22 },
  { t: 'IRN', name: 'Ironworks Industrial', price: 64, mu: 0.05, sigma: 0.2 },
];
const EVENTS = [
  { day: 20, t: 'ATL', pct: -0.12, text: 'Atlas Energy: fictional supply disruption' }, { day: 45, t: 'NMB', pct: 0.15, text: 'Nimbus Cloud: fictional product launch beats expectations' },
  { day: 70, t: 'ALL', pct: -0.06, text: 'Fictional market-wide worry about interest rates' }, { day: 100, t: 'PLS', pct: 0.1, text: 'Pulse Health: fictional approval news' },
  { day: 140, t: 'VRD', pct: -0.08, text: 'Verdant Foods: fictional cost increase' }, { day: 180, t: 'ALL', pct: 0.07, text: 'Fictional market-wide relief rally' },
];
export function newMarket(seed = 1, cash = 10000) {
  return { seed, day: 0, cash, startCash: cash, prices: Object.fromEntries(COMPANIES.map(c => [c.t, c.price])), history: Object.fromEntries(COMPANIES.map(c => [c.t, [c.price]])), holdings: {}, worth: [cash], news: [] };
}
/** Advance `days` trading days. Deterministic: the random draw for each (seed, day, stock) is fixed, so replays match. */
export function stepMarket(m, days = 1) {
  const s = { ...m, prices: { ...m.prices }, history: Object.fromEntries(Object.entries(m.history).map(([k, v]) => [k, v.slice()])), worth: m.worth.slice(), news: m.news.slice() };
  for (let d = 0; d < days; d++) {
    s.day++;
    COMPANIES.forEach((c, i) => {
      const r = rng((s.seed * 100003 + s.day * 977 + i * 31) >>> 0); const z = normal(r), dt = 1 / 252;
      let p = s.prices[c.t] * Math.exp((c.mu - c.sigma * c.sigma / 2) * dt + c.sigma * Math.sqrt(dt) * z);
      for (const ev of EVENTS) if (ev.day === s.day && (ev.t === 'ALL' || ev.t === c.t)) { p *= 1 + ev.pct; if (i === 0 || ev.t !== 'ALL') s.news.unshift(`Day ${s.day}: ${ev.text}`); }
      s.prices[c.t] = Math.max(1, Math.round(p * 100) / 100); s.history[c.t].push(s.prices[c.t]);
    });
    s.worth.push(netWorth(s));
  }
  return s;
}
export function netWorth(m) { return m.cash + Object.entries(m.holdings).reduce((a, [t, n]) => a + n * m.prices[t], 0); }
export function trade(m, ticker, shares, side) {
  if (!Number.isInteger(shares) || shares <= 0 || !(ticker in m.prices)) return { ok: false, error: 'Enter a whole number of shares.', market: m };
  const cost = shares * m.prices[ticker];
  if (side === 'buy') { if (cost > m.cash + 1e-9) return { ok: false, error: 'Not enough virtual cash.', market: m }; return { ok: true, market: { ...m, cash: m.cash - cost, holdings: { ...m.holdings, [ticker]: (m.holdings[ticker] || 0) + shares }, worth: [...m.worth.slice(0, -1), netWorth({ ...m, cash: m.cash - cost, holdings: { ...m.holdings, [ticker]: (m.holdings[ticker] || 0) + shares } })] } }; }
  if ((m.holdings[ticker] || 0) < shares) return { ok: false, error: 'You do not own that many shares.', market: m };
  const holdings = { ...m.holdings, [ticker]: m.holdings[ticker] - shares }; if (!holdings[ticker]) delete holdings[ticker];
  const next = { ...m, cash: m.cash + cost, holdings }; return { ok: true, market: { ...next, worth: [...m.worth.slice(0, -1), netWorth(next)] } };
}
