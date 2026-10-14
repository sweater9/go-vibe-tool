/* V8 integration regression tests (static; no browser). Guards the defects found while combining
   developer/design tools, file & media tools and consolidated studios onto the discovery base. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

let passed = 0, failed = 0;
const ok = (name, fn) => { try { fn(); passed++; console.log('PASS', name); } catch (e) { failed++; console.error('FAIL', name, '::', e.message); } };
const read = f => fs.readFileSync(f, 'utf8');

const sw = read('sw.js'), html = read('index.html');
const routing = read('studios-routing.js'), studios = read('studios.js');

function precacheList() {
  const m = sw.match(/const ASSETS=\[([\s\S]*?)\];/);
  assert.ok(m, 'ASSETS array found');
  return vm.runInNewContext('[' + m[1] + ']');
}
function routeTable() {
  const context={module:{exports:{}}};vm.runInNewContext(read('studios-core.js'),context);
  return JSON.parse(JSON.stringify(context.module.exports.aliases));
}

ok('sw.js is valid JavaScript with no literal "\\n" escape sequences leaking into code', () => {
  new vm.Script(sw);
  const assets = sw.match(/const ASSETS=\[[\s\S]*?\];/)[0];
  assert.ok(!/\\n/.test(assets), 'literal backslash-n inside the precache list');
});

ok('index.html has no literal "\\n" text nodes between tags', () => {
  assert.ok(!/<\/script>\\n|>\\n</.test(html), 'literal backslash-n in markup would render as visible text');
});

ok('service-worker cache name is numeric, and a single version is used everywhere', () => {
  const name = sw.match(/const CACHE="(govibetool-v8-\d+)"/);
  assert.ok(name, 'cache name matches govibetool-v8-<n>');
  for (const f of ['tests/v8-discovery.mjs', 'tests/v5-maintenance-browser.mjs']) assert.ok(read(f).includes(name[1]), f + ' pins ' + name[1]);
});

ok('every precached asset exists on disk and nothing is listed twice', () => {
  const list = precacheList();
  const seen = new Set();
  for (const a of list) {
    assert.ok(!seen.has(a), 'duplicate precache entry ' + a); seen.add(a);
    const p = a === './' ? 'index.html' : a.replace(/^\.\//, '');
    assert.ok(fs.existsSync(p), 'precache entry missing on disk: ' + a);
  }
});

ok('every local script and stylesheet referenced by index.html exists and is precached', () => {
  const list = new Set(precacheList());
  const refs = [...html.matchAll(/<script[^>]+src="([^"]+)"|<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map(m => m[1] || m[2]).filter(u => !/^https?:/.test(u));
  assert.ok(refs.length >= 15, 'found ' + refs.length + ' local references');
  for (const r of refs) { assert.ok(fs.existsSync(r), 'missing file ' + r); assert.ok(list.has('./' + r), 'not precached ' + r); }
});

ok('all three feature branches are wired: developer, file & media and studios assets are loaded and precached', () => {
  const list = new Set(precacheList());
  for (const f of ['v8-developer-core.js', 'v8-developer-tools.js', 'v8-developer.css', 'v8-regex-worker.js', 'tools/file-media/file-media-tools.js', 'tools/file-media/file-media.css', 'tools/file-media/fm-svg.js', 'tools/file-media/fm-image.js', 'tools/file-media/fm-table.js', 'vendor/svgo.browser.js', 'studios.html', 'studios.js', 'studios-routing.js']) assert.ok(list.has('./' + f), f + ' precached');
  for (const f of ['v8-developer-core.js', 'v8-developer-tools.js', 'tools/file-media/file-media-tools.js', 'studios-routing.js', 'v8-discovery.js']) assert.ok(html.includes('src="' + f + '"'), f + ' loaded by index.html');
  assert.ok(html.includes('href="v8-developer.css"') && html.includes('href="v8.css"'), 'stylesheets linked');
});

ok('script order: catalogue scripts register tools before discovery boots, routing wraps openTool last', () => {
  const order = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]);
  const at = f => order.indexOf(f);
  for (const f of ['tools.js', 'v21-tools.js', 'v6-tools.js', 'v8-developer-tools.js', 'tools/file-media/file-media-tools.js']) assert.ok(at(f) >= 0 && at(f) < at('v8-discovery.js'), f + ' loads before v8-discovery.js');
  assert.ok(at('studios-routing.js') > at('tools/file-media/file-media-tools.js') && at('studios-routing.js') < at('v8-discovery.js'), 'studios-routing.js loads after every openTool wrapper');
});

ok('studio route table: routing script and studio page agree, targets are the four studios', () => {
  const a = routeTable(routing), b = routeTable(studios);
  assert.deepEqual(a, b);
  assert.deepEqual([...new Set(Object.values(a))].sort(), ['freelance', 'privacy', 'qr', 'url']);
});

ok('studio route table only uses real catalogue IDs and never captures a richer in-app tool', () => {
  const ids = new Set(); const dir = ['tools.js', 'v2-tools.js', 'v21-tools.js', 'v6-tools.js'];
  for (const f of dir) for (const m of read(f).matchAll(/\["([a-z0-9-]+)","[A-Za-z &]+","[^"]+"/g)) ids.add(m[1]);
  const table = routeTable(routing);
  for (const id of Object.keys(table)) assert.ok(ids.has(id) || ['link-fingerprint-inspector','effective-hourly-rate'].includes(id), 'unknown tool id in routes: ' + id);
  assert.ok(!('percentage-change' in table), 'Percentage Change remains independent'); assert.equal(table['qr-studio'], 'qr'); assert.equal(table['pii-secret-redactor'], 'privacy'); for (const retained of ['qrTemplate()', 'redactorTemplate()', 'originalGenerate()', 'originalRedact()']) assert.ok(studios.includes(retained), retained + ' retains richer shared engine');
  for (const real of ['url-cleaner', 'utm-builder', 'link-fingerprint', 'hourly-rate']) assert.ok(real in table, real + ' routes to a studio');
});

ok('package.json test script runs the integration and studio checks; nine categories are not changed here', () => {
  const t = JSON.parse(read('package.json')).scripts.test;
  for (const needle of ['tests/v8-integration.mjs', 'node --check studios.js', 'node --check studios-routing.js', 'tests/file-media-core.mjs', 'tests/v8-developer-design.mjs', 'tests/v8-service-worker.mjs']) assert.ok(t.includes(needle), 'missing from npm test: ' + needle);
});

ok('built dist (when present) ships studios, developer, file-media and wasm assets', () => {
  if (!fs.existsSync('dist')) { console.log('  (dist not built; skipped)'); return; }
  for (const f of ['studios.html', 'studios.js', 'studios-routing.js', 'v8-developer-core.js', 'v8-developer-tools.js', 'v8-developer.css', 'v8-regex-worker.js', 'tools/file-media/file-media-tools.js', 'tools/file-media/fm-avif-worker.js', 'vendor/avif/avif_enc.wasm', 'vendor/avif/avif_enc.js', 'vendor/svgo.browser.js', 'sw.js']) assert.ok(fs.existsSync('dist/' + f), 'dist is missing ' + f);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
