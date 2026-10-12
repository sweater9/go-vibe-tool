import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GRAVITY, projectile, idealRange, orbit, pendulum, diceDistribution, rollDice, flipCoins, galtonPmf, dropBalls } from '../labs/science/physics-engine.mjs';
import { rng } from '../labs/shared/rng.mjs';
console.log('Running Science & Physics Lab engine tests...');
assert.equal(fs.readFileSync('labs/science/physics-engine.js', 'utf8'), fs.readFileSync('labs/science/physics-engine.mjs', 'utf8'), 'node and browser engine copies match');
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m}: ${a} vs ${b}`);
// projectile vs closed-form
{ const p = projectile({ v0: 20, angle: 45 }); near(p.range, 400 / 9.81, 0.01, 'range'); near(p.apex, 400 * 0.5 / (2 * 9.81), 0.01, 'apex'); near(p.flightTime, 2 * 20 * Math.SQRT1_2 / 9.81, 0.01, 'time'); near(p.impactSpeed, 20, 0.05, 'impact speed equals launch speed without drag'); }
{ const best = [30, 40, 45, 50, 60].map(a => [a, idealRange(25, a, 9.81)]).sort((x, y) => y[1] - x[1])[0][0]; assert.equal(best, 45, '45 degrees maximises range with no drag'); }
{ const e = idealRange(20, 45, GRAVITY.earth), m = idealRange(20, 45, GRAVITY.moon); near(m / e, GRAVITY.earth / GRAVITY.moon, 0.05, 'range scales as 1/g'); }
{ const nd = projectile({ v0: 20, angle: 45 }).range, d = projectile({ v0: 20, angle: 45, drag: 0.2 }).range; assert.ok(d < nd * 0.8, 'drag shortens the flight'); }
{ const h = projectile({ v0: 10, angle: 0, h0: 20 }); near(h.flightTime, Math.sqrt(2 * 20 / 9.81), 0.01, 'horizontal launch from height'); }
// orbit
{ const c = orbit({ speed: 1 }); assert.equal(c.type, 'circular'); near(c.rmax, 1, 1e-3, 'circular radius'); assert.ok(c.energyDrift < 1e-6, 'energy conserved'); }
{ const e = orbit({ speed: 0.8 }); assert.equal(e.type, 'elliptical'); near(e.eccentricity, 0.36, 1e-9, 'eccentricity'); near(e.rmin, 1 / (1 + 0.36) * 1 * (1 - 0.36 * 0 ) , 0.5, 'bounded'); assert.ok(e.energyDrift < 1e-4); }
{ const x = orbit({ speed: 1.5 }); assert.equal(x.type, 'escape'); assert.ok(x.escaped && x.rmax > 5); assert.equal(orbit({ speed: Math.SQRT2 * 1.001 }).type, 'escape'); assert.notEqual(orbit({ speed: Math.SQRT2 * 0.99 }).type, 'escape'); }
// pendulum
{ const small = pendulum({ length: 1, theta0: 5, duration: 30 }); near(small.period / small.smallAnglePeriod, 1, 0.005, 'small angle period'); const big = pendulum({ length: 1, theta0: 60, duration: 30 }); near(big.period / big.smallAnglePeriod, 1.0732, 0.01, 'large angle period is longer'); near(big.endEnergy, big.startEnergy, 1e-4, 'energy conserved without damping');
  const damped = pendulum({ length: 1, theta0: 60, damping: 0.4, duration: 15 }); assert.ok(damped.endEnergy < damped.startEnergy * 0.2, 'damping removes energy');
  const long = pendulum({ length: 4, theta0: 5, duration: 40 }); near(long.period / small.period, 2, 0.02, 'period scales with sqrt(length)'); }
// probability
{ const d = diceDistribution(2); near(d.probs[5], 6 / 36, 1e-12, 'P(7)'); near(d.probs.reduce((a, b) => a + b), 1, 1e-12, 'sums to 1'); assert.equal(d.probs.length, 11); const d3 = diceDistribution(3); near(d3.probs.reduce((a, b) => a + b), 1, 1e-12, '3 dice sum'); near(d3.probs.reduce((a, p, i) => a + p * (i + 3), 0), 10.5, 1e-9, 'mean of 3d6'); }
{ const r = rollDice(rng(7), 2, 6, 60000), n = r.counts.reduce((a, b) => a + b); assert.equal(n, 60000); const seven = r.counts[5] / n; near(seven, 1 / 6, 0.01, 'simulated P(7)'); assert.equal(r.counts.indexOf(Math.max(...r.counts)), 5, '7 is the most common sum'); const again = rollDice(rng(7), 2, 6, 60000); assert.deepEqual(again.counts, r.counts, 'seeded runs are reproducible'); }
{ const f = flipCoins(rng(3), 20000); near(f.proportion, 0.5, 0.02, 'fair coin'); assert.ok(Math.abs(f.running.at(-1)[1] - 0.5) < Math.abs(f.running[3][1] - 0.5) + 0.3); assert.equal(f.running.at(-1)[0], 20000); const b = flipCoins(rng(3), 5000, 0.8); near(b.proportion, 0.8, 0.03, 'biased coin'); }
{ const p = galtonPmf(10); near(p.reduce((a, b) => a + b), 1, 1e-12, 'pmf sums to 1'); assert.equal(p.length, 11); near(p[0], 1 / 1024, 1e-12, 'edge'); near(p[5], 252 / 1024, 1e-12, 'centre'); const bins = dropBalls(rng(11), 10, 30000); assert.equal(bins.reduce((a, b) => a + b), 30000); near(bins[5] / 30000, p[5], 0.01, 'simulation follows the binomial'); }
console.log('✓ Science engine: projectile, orbit, pendulum, probability');
