/* Risk-based CI selection: classifier rules and config sanity. node tests/ci-plan.mjs */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classify, loadRules, globToRegExp, isTextOnlyHtml } from '../scripts/ci-plan.mjs';

const rules = loadRules(), pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const f = (...paths) => paths.map(p => (typeof p === 'string' ? { path: p, status: 'M' } : p));
const plan = (files, extra = {}) => classify({ files: f(...files), ...extra }, rules);
const textDiff = '@@ -1 +1 @@\n-<p>Old wording here</p>\n+<p>New wording here</p>\n';

/* globs */
assert.ok(globToRegExp('tools/*.html').test('tools/a.html') && !globToRegExp('tools/*.html').test('tools/pdf-editor/index.html'));
assert.ok(globToRegExp('**/*.md').test('README.md') && globToRegExp('**/*.md').test('a/b/c.md') && !globToRegExp('**/*.md').test('a.mdx'));
assert.ok(globToRegExp('tools/pdf-editor/**').test('tools/pdf-editor/engine/x.mjs') && globToRegExp('wrangler*.jsonc').test('wrangler.preview.jsonc'));

/* docs */
let p = plan(['docs/ci-test-selection.md', 'README.md']); assert.equal(p.tier, 'docs'); assert.equal(p.v5_suites, ''); assert.equal(p.unit_full, false); assert.equal(p.run_pdf, false); assert.equal(p.essentials, true);
assert.equal(plan([]).tier, 'docs');

/* minor: styling, images, text-only html */
p = plan(['play/games.css']); assert.equal(p.tier, 'minor'); assert.deepEqual(p.areas, ['play']); assert.deepEqual(p.browsers, ['chromium']); assert.equal(p.unit_full, false); assert.equal(p.unit_scripts, 'test:play-unit');
assert.match(p.v5_suites, /play-games-browser/); assert.equal(p.run_mahjong, false); assert.equal(p.v5_maintenance, false);
p = plan(['v8.css']); assert.equal(p.tier, 'minor'); assert.match(p.v5_suites, /v8-browser/, 'shared styling still gets the homepage smoke suites'); assert.equal(p.unit_full, false); assert.deepEqual(p.browsers, ['chromium']);
p = classify({ files: f('play/index.html'), htmlDiffs: { 'play/index.html': textDiff } }, rules); assert.equal(p.tier, 'minor');
p = classify({ files: f('index.html'), htmlDiffs: { 'index.html': textDiff } }, rules); assert.equal(p.tier, 'minor'); assert.match(p.v5_suites, /v8-browser/);
for (const risky of ['+<script src="x.js"></script>', '+<a href="/new">x</a>', '+<form action="/x">', '+<button onclick="go()">', '+<img src="a.png">', '+<meta http-equiv="refresh">']) {
  p = classify({ files: f('index.html'), htmlDiffs: { 'index.html': `@@ -1 +1 @@\n-<p>x</p>\n${risky}\n` } }, rules); assert.equal(p.tier, 'shared', `risky html edit is not minor: ${risky}`);
}
assert.equal(isTextOnlyHtml('@@\n' + Array.from({ length: 41 }, (_, i) => `+line ${i}`).join('\n'), rules), false, 'large html edits are not minor');
assert.equal(classify({ files: [{ path: 'play/2048/new.html', status: 'A' }] }, rules).tier, 'feature', 'a new file is never minor');
assert.equal(classify({ files: [{ path: 'play/index.html', status: 'M' }] }, rules).tier, 'feature', 'html without a diff to inspect is not minor');

/* feature: confined to areas */
p = plan(['play/2048/app.js']); assert.equal(p.tier, 'feature'); assert.deepEqual(p.areas, ['play']); assert.equal(p.unit_full, false); assert.equal(p.unit_scripts, 'test:play-unit'); assert.deepEqual(p.browsers, ['chromium', 'firefox', 'webkit']);
assert.equal(p.run_play, true); assert.equal(p.run_pdf, false); assert.equal(p.run_mahjong, false); assert.equal(p.run_labs, false); assert.equal(p.run_regression, true); assert.equal(p.v5_maintenance, false);
p = plan(['tools/pdf-editor/editor.js', 'tests/pdf-editor-v2-browser.mjs']); assert.equal(p.tier, 'feature'); assert.deepEqual(p.areas, ['pdf']); assert.equal(p.run_regression, false, 'PDF-only change does not trigger the V8 homepage regression'); assert.equal(p.run_play, false); assert.equal(p.v5_suites, 'dist-browser,v5-browser-smoke'); assert.match(p.unit_scripts, /test:pdf-compare/);
p = plan(['knowledge/src/x.mjs']); assert.deepEqual(p.browsers, ['chromium'], 'non-cross-browser area runs one engine'); assert.equal(p.run_knowledge, true);
p = plan(['tools/pdf-compare/diff.mjs', 'play/continue.js']); assert.deepEqual(p.areas.sort(), ['pdf', 'play']); assert.equal(p.run_pdf && p.run_play, true); assert.equal(p.run_labs, false);
p = plan(['multiplayer/server.mjs']); assert.deepEqual(p.areas, ['mahjong']); assert.match(p.unit_scripts, /test:taiwan-mahjong/);
p = plan(['docs/x.md', 'play/2048/app.js']); assert.equal(p.tier, 'feature', 'docs alongside code do not lower the tier');
p = plan(['play/games.css', 'play/2048/app.js']); assert.equal(p.tier, 'feature', 'one real code change makes it a feature change');

/* shared and unknown: full regression */
for (const file of ['sw.js', 'package.json', 'tools.js', 'v8-discovery.js', '_redirects', 'wrangler.jsonc', 'scripts/build-static.mjs', 'config/ads-readiness.json', '.github/workflows/quality.yml', 'vendor/pdf-lib.min.js', 'privacy.html', 'tests/smoke.mjs', 'some/unknown/file.bin']) {
  p = plan([file]); assert.equal(p.tier, 'shared', file); assert.equal(p.unit_full, true); assert.deepEqual(p.browsers, ['chromium', 'firefox', 'webkit']); assert.equal(p.v5_maintenance, true); assert.ok(p.run_pdf && p.run_play && p.run_mahjong && p.run_knowledge && p.run_labs && p.run_utilities && p.run_pages && p.run_regression, file);
}
p = plan(['play/2048/app.js', 'sw.js']); assert.equal(p.tier, 'shared', 'a shared file anywhere in the change wins');
p = plan(['sw.js']); assert.match(p.reason, /sw\.js/);

/* explicit full */
p = classify({ files: [], forceFull: true }, rules); assert.equal(p.tier, 'full'); assert.equal(p.unit_full, true); assert.equal(p.v5_maintenance, true);
p = classify({ files: f('docs/a.md'), labels: ['ci:full'] }, rules); assert.equal(p.tier, 'full', 'label ci:full forces everything'); assert.equal(classify({ files: f('docs/a.md'), labels: ['other'] }, rules).tier, 'docs');

/* essentials are never dropped */
for (const files of [['README.md'], ['play/games.css'], ['play/2048/app.js'], ['sw.js']]) assert.equal(plan(files).essentials, true);
assert.equal(rules.essentialsScript, 'test:essentials'); assert.ok(pkg.scripts['test:essentials'], 'essentials script exists');
const ess = pkg.scripts['test:essentials']; for (const needle of ['build-static', 'cf-preview-config', 'verify-live-assets', 'adsense', 'service-worker']) assert.ok(ess.includes(needle), `essentials include ${needle}`);

/* config sanity: everything the plan can name really exists */
const scripts = new Set(); for (const a of Object.values(rules.areas)) for (const s of a.unit) scripts.add(s);
for (const s of scripts) assert.ok(pkg.scripts[s], `npm script ${s} is defined`);
const suites = new Set([...rules.v5Suites.always, ...rules.v5Suites.all, ...rules.v5Suites.homepage, ...Object.values(rules.areas).flatMap(a => a.v5Suites || [])]);
for (const s of suites) assert.ok(fs.existsSync(new URL(`../tests/${s}.mjs`, import.meta.url)), `tests/${s}.mjs exists`);
for (const s of rules.v5Suites.always.concat(rules.v5Suites.homepage)) assert.ok(rules.v5Suites.all.includes(s), `${s} is part of the full list`);
for (const [name, a] of Object.entries(rules.areas)) assert.ok(a.paths.length && a.unit.length, `${name} has paths and unit scripts`);
const npmTest = pkg.scripts.test; assert.ok(npmTest.includes('tests/ci-plan.mjs'), 'ci-plan tests run in npm test');
console.log('ci-plan: all checks passed');
