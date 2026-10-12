/* GoVibeTool Science & Physics Lab — pure simulation engine (no DOM). Educational models in simple units. */
export const GRAVITY = { earth: 9.81, moon: 1.62, mars: 3.71, jupiter: 24.79 };

/** Projectile with optional linear air drag (ax = -k*vx, ay = -g - k*vy), RK4 integration. Angle in degrees. */
export function projectile({ v0, angle, g = 9.81, h0 = 0, drag = 0, dt = 0.005 }) {
  const th = angle * Math.PI / 180;
  let s = { x: 0, y: h0, vx: v0 * Math.cos(th), vy: v0 * Math.sin(th) }, t = 0;
  const f = st => ({ x: st.vx, y: st.vy, vx: -drag * st.vx, vy: -g - drag * st.vy });
  const add = (a, b, h) => ({ x: a.x + b.x * h, y: a.y + b.y * h, vx: a.vx + b.vx * h, vy: a.vy + b.vy * h });
  const pts = [{ t, x: s.x, y: s.y, vx: s.vx, vy: s.vy }];
  let apex = h0, apexT = 0, guard = 0;
  while (guard++ < 400000) {
    const k1 = f(s), k2 = f(add(s, k1, dt / 2)), k3 = f(add(s, k2, dt / 2)), k4 = f(add(s, k3, dt));
    const n = { x: s.x + dt / 6 * (k1.x + 2 * k2.x + 2 * k3.x + k4.x), y: s.y + dt / 6 * (k1.y + 2 * k2.y + 2 * k3.y + k4.y), vx: s.vx + dt / 6 * (k1.vx + 2 * k2.vx + 2 * k3.vx + k4.vx), vy: s.vy + dt / 6 * (k1.vy + 2 * k2.vy + 2 * k3.vy + k4.vy) };
    if (n.y < 0) { const r = s.y / (s.y - n.y); const x = s.x + (n.x - s.x) * r; t += dt * r; pts.push({ t, x, y: 0, vx: n.vx, vy: n.vy }); s = { ...n, x, y: 0 }; break; }
    s = n; t += dt; pts.push({ t, x: s.x, y: s.y, vx: s.vx, vy: s.vy });
    if (s.y > apex) { apex = s.y; apexT = t; }
  }
  return { points: pts, range: s.x, apex, apexTime: apexT, flightTime: t, impactSpeed: Math.hypot(s.vx, s.vy) };
}
export const idealRange = (v0, angle, g, h0 = 0) => projectile({ v0, angle, g, h0, drag: 0 }).range;

/** Central-force orbit in normalized units (GM = 1, start at r = 1 moving tangentially at speed v). Velocity-Verlet. */
export function orbit({ speed, dt = 0.002, maxTime = 40, escapeR = 12 }) {
  let x = 1, y = 0, vx = 0, vy = speed, t = 0;
  const acc = (px, py) => { const r2 = px * px + py * py, r3 = r2 * Math.sqrt(r2); return [-px / r3, -py / r3]; };
  let [ax, ay] = acc(x, y);
  const pts = [{ t, x, y }]; let rmin = 1, rmax = 1, steps = 0;
  const energy = () => 0.5 * (vx * vx + vy * vy) - 1 / Math.hypot(x, y);
  const E0 = energy(), L = x * vy - y * vx;
  let drift = 0;
  while (t < maxTime && steps++ < 200000) {
    x += vx * dt + 0.5 * ax * dt * dt; y += vy * dt + 0.5 * ay * dt * dt;
    const [nx, ny] = acc(x, y); vx += 0.5 * (ax + nx) * dt; vy += 0.5 * (ay + ny) * dt; ax = nx; ay = ny; t += dt;
    const r = Math.hypot(x, y); rmin = Math.min(rmin, r); rmax = Math.max(rmax, r);
    drift = Math.max(drift, Math.abs(energy() - E0));
    if (steps % 5 === 0) pts.push({ t, x, y });
    if (r > escapeR || r < 0.03) break;
  }
  const e = Math.sqrt(Math.max(0, 1 + 2 * E0 * L * L));
  const type = E0 >= -1e-9 ? 'escape' : e < 0.02 ? 'circular' : 'elliptical';
  return { points: pts, energy: E0, angularMomentum: L, eccentricity: e, type, rmin, rmax, energyDrift: drift, escaped: E0 >= -1e-9 };
}

/** Damped pendulum, RK4. theta0 in degrees. Energy per unit mass: 0.5 L^2 w^2 + g L (1 - cos theta). */
export function pendulum({ length, theta0, g = 9.81, damping = 0, duration = 10, dt = 0.002 }) {
  let th = theta0 * Math.PI / 180, w = 0, t = 0;
  const f = (a, b) => [b, -(g / length) * Math.sin(a) - damping * b];
  const E = (a, b) => 0.5 * length * length * b * b + g * length * (1 - Math.cos(a));
  const pts = [{ t, theta: th, omega: w, ke: 0.5 * length * length * w * w, pe: g * length * (1 - Math.cos(th)) }];
  let crossings = [], prev = th;
  while (t < duration) {
    const [k1a, k1b] = f(th, w), [k2a, k2b] = f(th + dt / 2 * k1a, w + dt / 2 * k1b), [k3a, k3b] = f(th + dt / 2 * k2a, w + dt / 2 * k2b), [k4a, k4b] = f(th + dt * k3a, w + dt * k3b);
    th += dt / 6 * (k1a + 2 * k2a + 2 * k3a + k4a); w += dt / 6 * (k1b + 2 * k2b + 2 * k3b + k4b); t += dt;
    if (prev > 0 && th <= 0) crossings.push(t - dt + dt * prev / (prev - th)); // downward zero crossing, linearly interpolated
    prev = th;
    if (Math.round(t / dt) % 5 === 0) pts.push({ t, theta: th, omega: w, ke: 0.5 * length * length * w * w, pe: g * length * (1 - Math.cos(th)) });
  }
  // period = time between successive downward zero crossings of theta (when swinging through both sides)
  const period = crossings.length >= 2 ? (crossings[crossings.length - 1] - crossings[0]) / (crossings.length - 1) : NaN;
  return { points: pts, period, smallAnglePeriod: 2 * Math.PI * Math.sqrt(length / g), startEnergy: E(theta0 * Math.PI / 180, 0), endEnergy: E(th, w) };
}

/** Exact distribution of the sum of n fair dice with `sides` faces (convolution). Returns {min, probs[]}. */
export function diceDistribution(n, sides = 6) {
  let dist = [1];
  for (let i = 0; i < n; i++) { const next = Array(dist.length + sides - 1).fill(0); dist.forEach((p, a) => { for (let f = 0; f < sides; f++) next[a + f] += p / sides; }); dist = next; }
  return { min: n, probs: dist };
}
export function rollDice(rand, n, sides, trials) {
  const counts = Array(n * sides - n + 1).fill(0);
  for (let t = 0; t < trials; t++) { let s = 0; for (let i = 0; i < n; i++) s += 1 + Math.floor(rand() * sides); counts[s - n]++; }
  return { min: n, counts };
}
export function flipCoins(rand, flips, pHeads = 0.5) {
  let heads = 0; const running = [];
  for (let i = 1; i <= flips; i++) { if (rand() < pHeads) heads++; if (i <= 20 || i % Math.max(1, Math.floor(flips / 200)) === 0 || i === flips) running.push([i, heads / i]); }
  return { heads, proportion: heads / flips, running };
}
/** Galton board: exact binomial pmf for `rows` rows plus a seeded ball-drop simulation. */
export function galtonPmf(rows) { const p = [1]; for (let r = 0; r < rows; r++) { for (let i = p.length; i > 0; i--) p[i] = (p[i] || 0) / 2 + (p[i - 1] || 0) / 2 ; p[0] = (p[0] || 0) / 2; } return p.slice(0, rows + 1); }
export function dropBalls(rand, rows, balls) { const bins = Array(rows + 1).fill(0); for (let b = 0; b < balls; b++) { let k = 0; for (let r = 0; r < rows; r++) if (rand() < 0.5) k++; bins[k]++; } return bins; }
