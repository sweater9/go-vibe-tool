/* Static checks for the offline readiness indicator: every declared asset exists, precached pages only list precached assets,
   the module only reads Cache Storage, and no homepage tile carries an indicator. node tests/offline-status.mjs */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const read = f => fs.readFileSync(f, 'utf8');
const sw = read('sw.js'), precache = new Set([...sw.matchAll(/"\.\/([^"]*)"/g)].map(m => m[1]));
const pages = ['tools/pdf-editor/index.html', 'tools/pdf-compare/index.html', 'play/2048/index.html', 'play/daily-word/index.html', 'play/word-logic/index.html', 'play/taiwan-mahjong/index.html', 'play/vibe-arcade/index.html'];
for (const page of pages) {
  const html = read(page), tags = [...html.matchAll(/<span class="gvt-offline"([^>]*)>/g)];
  assert.equal(tags.length, page.includes('pdf-editor') ? 2 : 1, `${page}: indicator placeholder count (PDF Editor also has one beside the welcome heading for phones)`);
  assert.ok(new Set(tags.map(t => t[1])).size === 1, `${page}: placeholders are identical`);
  assert.match(html, /<script src="(?:\.\.\/){2}offline-status\.js" defer><\/script>/, `${page}: loads offline-status.js`);
  const attrs = tags[0][1], assets = (/data-offline-assets="([^"]*)"/.exec(attrs) || [])[1];
  assert.ok(assets, `${page}: lists its assets`);
  for (const rel of assets.split(',').map(s => s.trim())) {
    const file = path.posix.normalize(path.posix.join(path.posix.dirname(page), rel));
    assert.ok(fs.existsSync(file), `${page}: declared asset exists: ${rel}`);
    if (!/data-offline-manifest/.test(attrs)) assert.ok(precache.has(file), `${page}: ${file} must be precached by sw.js or the indicator could never be Ready`);
  }
  const loaded = [...html.matchAll(/<(?:script|link)[^>]*(?:src|href)="([^"#?:]+\.(?:js|mjs|css))"/g)].map(m => path.posix.normalize(path.posix.join(path.posix.dirname(page), m[1]))).filter(f => !f.endsWith('offline-status.js') && !f.endsWith('offline-status.css'));
  for (const f of loaded) assert.ok(assets.split(',').map(s => path.posix.normalize(path.posix.join(path.posix.dirname(page), s.trim()))).includes(f), `${page}: ${f} is loaded by the page but not declared`);
}
const PDF_APP = { 'tools/pdf-editor/': ['editor.js'], 'tools/pdf-compare/': ['compare.js'] };
for (const [dir, entries] of Object.entries(PDF_APP)) {
  const seen = new Set(), walk = f => { if (seen.has(f)) return; seen.add(f); for (const m of read(f).matchAll(/from\s*['"](\.[^'"]+)['"]/g)) { const t = path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1])); if (fs.existsSync(t) && !t.includes('v9-media')) walk(t); } };
  entries.forEach(e => walk(dir + e));
  const assets = (/data-offline-assets="([^"]*)"/.exec(read(dir + 'index.html')) || [])[1].split(',').map(s => path.posix.normalize(path.posix.join(dir, s.trim())));
  for (const f of seen) assert.ok(assets.includes(f), `${dir}: imported module ${f} is not declared`);
}
const js = read('offline-status.js');
assert.ok(!/serviceWorker\s*\.\s*register|caches\s*\.\s*(?:delete|open\([^)]*\)\s*\.then\(function\s*\(c\)\s*\{\s*return c\.(?:put|add))|\.addAll\(|\.put\(/.test(js), 'indicator must not register workers or write caches');
assert.ok(!/navigator\.onLine\s*[!=]==?\s*(?:true|false)\s*\?/.test(js) && /getRegistration/.test(js) && /caches\.keys/.test(js), 'readiness is derived from the worker and Cache Storage');
for (const label of ['Ready offline', 'Download required', 'Online required', 'Checking offline availability']) assert.ok(js.includes(label), label);
assert.ok(precache.has('offline-status.js') && precache.has('offline-status.css'), 'indicator files are precached');
assert.ok(!/gvt-offline|offline-status/.test(read('index.html') + read('tools.js') + read('v2-tools.js')), 'no indicators on homepage tiles');
console.log('offline-status static checks PASS');
