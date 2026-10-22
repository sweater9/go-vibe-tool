#!/usr/bin/env node
/* Risk-based CI planner. Decides which test suites a change needs. Rules live in config/ci-risk.json and are documented in
   docs/ci-test-selection.md. Pure `classify()` (unit-tested) + a small CLI used by .github/actions/ci-plan.

   Tiers: docs < minor < feature < shared < full
     docs     only documentation / non-shipping files
     minor    only styling, images, or text-only HTML edits (no scripts, links, forms or attributes touched)
     feature  changes confined to known feature areas: that area's unit + browser suites
     shared   anything shared (homepage, catalogue, service worker, scripts, config, CI) or unknown: full regression
     full     requested explicitly (manual run or the `ci:full` label)
   The essentials (build + dist verification, deploy config, ads/privacy gating, service worker) run at every tier. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const loadRules = (file = path.join(ROOT, 'config/ci-risk.json')) => JSON.parse(fs.readFileSync(file, 'utf8'));

const reCache = new Map();
export function globToRegExp(glob) {
  if (reCache.has(glob)) return reCache.get(glob);
  let s = ''; for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') { if (glob[i + 1] === '*') { i++; if (glob[i + 1] === '/') { i++; s += '(?:.*/)?'; } else s += '.*'; } else s += '[^/]*'; }
    else s += c.replace(/[.+^${}()|[\]\\?]/g, '\\$&');
  }
  const re = new RegExp('^' + s + '$'); reCache.set(glob, re); return re;
}
const matches = (file, globs) => globs.some(g => globToRegExp(g).test(file));

/** Is this HTML change a text-only edit? `diff` is the unified diff (-U0) of the file. */
export function isTextOnlyHtml(diff, rules) {
  const cfg = rules.htmlTextOnly; if (!diff) return false;
  const changed = diff.split('\n').filter(l => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l));
  if (!changed.length || changed.length > cfg.maxChangedLines) return false;
  const risky = new RegExp(cfg.riskyPatterns.join('|'), 'i');
  return !changed.some(l => risky.test(l.slice(1)));
}

/** files: [{ path, status }] (status A/M/D/R...). htmlDiffs: { path: unifiedDiff }. Returns the plan. */
export function classify({ files, htmlDiffs = {}, forceFull = false, labels = [] }, rules = loadRules()) {
  const all = rules.allBrowsers, areaNames = Object.keys(rules.areas);
  const plan = (tier, areas, reason, extra = {}) => {
    const full = tier === 'full' || tier === 'shared';
    const hit = new Set(areas);
    const crossBrowser = full || (tier === 'feature' && areas.some(a => rules.areas[a].crossBrowser));
    const unitFull = full;
    const unitScripts = unitFull ? [] : [...new Set(areas.flatMap(a => rules.areas[a].unit))];
    const regression = full || (tier !== 'docs' && areas.some(a => rules.areas[a].regression));
    const v5 = full ? rules.v5Suites.all : (tier === 'docs' ? [] : [...new Set([...rules.v5Suites.always, ...areas.flatMap(a => rules.areas[a].v5Suites || []), ...(extra.homepageTouched ? rules.v5Suites.homepage : [])])]);
    const out = {
      tier, reason, areas: [...hit], full, essentials: true,
      browsers: crossBrowser ? all : ['chromium'], unit_full: unitFull, unit_scripts: unitScripts.join(','),
      v5_suites: (tier === 'docs' ? [] : (regression || full || v5.length ? v5 : [])).join(','), v5_maintenance: full,
      run_regression: regression,
    };
    for (const a of areaNames) out['run_' + a] = full || hit.has(a);
    out.run_any_browser = Object.keys(out).some(k => k.startsWith('run_') && k !== 'run_regression' && k !== 'run_any_browser' && out[k]) || regression;
    return out;
  };

  if (forceFull) return plan('full', areaNames, 'comprehensive run requested manually');
  if (labels.includes('ci:full')) return plan('full', areaNames, 'label ci:full');
  if (!files || !files.length) return plan('docs', [], 'no changed files');

  const areas = new Set(); let shared = false, sharedNonMinor = false, nonMinor = false, anyCode = false, homepageTouched = false; const notes = [];
  for (const f of files) {
    const p = f.path; if (matches(p, rules.docs)) continue;
    anyCode = true;
    const ext = path.extname(p).toLowerCase();
    const minor = f.status !== 'D' && f.status !== 'A' && (rules.minorExtensions.includes(ext) || (ext === '.html' && isTextOnlyHtml(htmlDiffs[p], rules)));
    const area = areaNames.find(a => matches(p, rules.areas[a].paths));
    if (area) { areas.add(area); if (!minor) nonMinor = true; continue; }
    shared = true; if (!minor) { sharedNonMinor = true; nonMinor = true; notes.push(p); } else homepageTouched = true;
    if (!matches(p, rules.shared)) notes.push(`${p} (unclassified, treated as shared)`);
  }
  if (!anyCode) return plan('docs', [], 'only documentation / non-shipping files');
  if (sharedNonMinor) return plan('shared', areaNames, `shared or unclassified files changed: ${[...new Set(notes)].slice(0, 5).join(', ')}${notes.length > 5 ? ', …' : ''}`);
  if (!nonMinor) return plan('minor', [...areas], 'styling, images or text-only HTML edits only', { homepageTouched });
  return plan('feature', [...areas], `changes confined to: ${[...areas].join(', ')}`, { homepageTouched });
}

/* ---------- CLI ---------- */
function git(...args) { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
export function collect(base, head, rules) {
  const files = git('diff', '--name-status', '--no-renames', `${base}...${head}`).split('\n').filter(Boolean).map(l => { const [status, ...rest] = l.split('\t'); return { status: status[0], path: rest.join('\t') }; });
  const htmlDiffs = {}; for (const f of files) if (f.path.endsWith('.html') && f.status === 'M') htmlDiffs[f.path] = git('diff', '-U0', `${base}...${head}`, '--', f.path);
  return { files, htmlDiffs };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : undefined; };
  const rules = loadRules(), zero = /^0+$/;
  let result, base = arg('base'), head = arg('head') || 'HEAD';
  const forceFull = process.argv.includes('--force-full') || arg('force-full') === 'true';
  let labels = []; try { labels = JSON.parse(arg('labels') || '[]') || []; } catch { /* ignore */ }
  try {
    if (forceFull || labels.includes('ci:full')) result = classify({ files: [], forceFull, labels }, rules);
    else if (!base || zero.test(base)) result = classify({ files: [], forceFull: true }, rules), result.reason = 'no base commit to compare with (new branch): running everything';
    else result = classify({ ...collect(base, head, rules), labels }, rules);
  } catch (e) { result = classify({ files: [], forceFull: true }, rules); result.reason = `could not compute the change set (${String(e.message).split('\n')[0]}): running everything`; }
  const json = JSON.stringify(result);
  const out = arg('github-output') || process.env.GITHUB_OUTPUT;
  if (out) fs.appendFileSync(out, `plan=${json}\ntier=${result.tier}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### CI plan: **${result.tier}**\n${result.reason}\n\n- Areas: ${result.areas.join(', ') || 'none'}\n- Browsers: ${result.browsers.join(', ')}\n- Full unit run (\`npm test\`): ${result.unit_full}\n- Area unit scripts: ${result.unit_scripts || 'none'}\n- V5/V8 browser suites: ${result.v5_suites || 'none'}\n- Regression suites: ${result.run_regression}\n`);
  console.log(json);
}
