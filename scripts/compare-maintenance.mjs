#!/usr/bin/env node
/* A/B gate for tests/v5-maintenance-browser.mjs.
   usage: node scripts/compare-maintenance.mjs <baseline results.json> <candidate results.json>
   Passes when the candidate has no issue the accepted V8 baseline does not also have, and no fewer passing checks.
   Known baseline-equivalent issue (docs/V9-INTEGRATION.md, "Known baseline-equivalent legacy failure"):
   a browser-owned favicon "ERR_CONNECTION_REFUSED" console message while the origin is stopped but navigator.onLine
   is still true (PR #19 trade-off). It is reproduced on the baseline, never assumed. Width prefixes are ignored. */
import fs from 'node:fs';
const [, , baseFile, candFile] = process.argv;
const load = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const b = load(baseFile), c = load(candFile);
if (!b || !c) { console.error(`::error title=maintenance A/B::missing results (baseline ${!!b}, candidate ${!!c})`); process.exit(1); }
const norm = m => m.replace(/^\d+ /, '');
const baseIssues = new Set(b.issues.map(norm));
const fresh = [...new Set(c.issues.map(norm))].filter(m => !baseIssues.has(m));
console.log(`baseline:  ${b.results.length} checks passed, issues: ${JSON.stringify([...baseIssues])}`);
console.log(`candidate: ${c.results.length} checks passed, issues: ${JSON.stringify([...new Set(c.issues.map(norm))])}`);
if (c.results.length < b.results.length) { console.error('::error title=maintenance A/B::fewer passing checks than the baseline'); process.exit(1); }
if (fresh.length) { console.error(`::error title=maintenance A/B::NEW issues vs the V8 baseline: ${JSON.stringify(fresh)}`); process.exit(1); }
console.log(baseIssues.size ? 'no new issues vs the V8 baseline (baseline-equivalent issues remain; see docs)' : 'clean on both sides');
