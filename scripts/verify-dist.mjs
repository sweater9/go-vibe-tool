#!/usr/bin/env node
/* Verifies a static output directory against Cloudflare limits and site integrity. Usable as a module or a CLI. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_ASSET_BYTES, MAX_ASSET_FILES, FORBIDDEN_TOP_LEVEL, FORBIDDEN_ROOT_FILES } from './site-manifest.mjs';

function listFiles(dir, base = dir) { const out = []; for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) out.push(...listFiles(p, base)); else out.push(path.relative(base, p).split(path.sep).join('/')); } return out; }
const isLocal = u => u && !/^([a-z][a-z0-9+.-]*:|\/\/|#|mailto:|tel:|data:|javascript:)/i.test(u);

export function verifyDist(dist, { root } = {}) {
  const errors = []; const files = listFiles(dist); const set = new Set(files);
  let totalBytes = 0; let largest = { file: '', bytes: 0 };
  for (const f of files) { const b = fs.statSync(path.join(dist, f)).size; totalBytes += b; if (b > largest.bytes) largest = { file: f, bytes: b }; if (b > MAX_ASSET_BYTES) errors.push(`${f} is ${(b / 1048576).toFixed(1)} MiB, over the ${MAX_ASSET_BYTES / 1048576} MiB per-file limit`); }
  if (files.length > MAX_ASSET_FILES) errors.push(`${files.length} files exceeds the ${MAX_ASSET_FILES} file limit`);
  for (const f of files) { const top = f.split('/')[0]; if (f.includes('/node_modules/') || f.includes('/.git/') || FORBIDDEN_TOP_LEVEL.includes(top) && f.includes('/')) errors.push(`forbidden path in output: ${f}`); if (!f.includes('/') && FORBIDDEN_ROOT_FILES.includes(f) && f !== '.assetsignore') errors.push(`forbidden root file in output: ${f}`); if (/\.(md|py)$/i.test(f)) errors.push(`non-site file in output: ${f}`); if (/(^|\/)workerd$/.test(f)) errors.push(`binary in output: ${f}`); }
  if (/(^|\/)multiplayer\//.test(files.join('\n'))) errors.push('multiplayer backend code must not be in the output');
  for (const f of files) { if (/\.(js|mjs)$/.test(f) && /from\s+['"][^'"]*multiplayer\/server/.test(fs.readFileSync(path.join(dist, f), 'utf8'))) errors.push(`${f} imports the Mahjong server`); }

  const resolve = (fromFile, ref) => { const clean = ref.split('#')[0].split('?')[0]; if (!clean) return null; const p = clean.startsWith('/') ? clean.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), clean)); return p; };
  const hasPath = p => { p = p.replace(/^\.\/?$/, ''); return p === '' ? set.has('index.html') : set.has(p) || set.has(p.replace(/\/?$/, '/index.html')) || set.has(p + '.html'); };
  const missing = new Set();
  for (const f of files) {
    const text = /\.(html|js|mjs|css|webmanifest)$/.test(f) ? fs.readFileSync(path.join(dist, f), 'utf8') : '';
    const refs = [];
    if (f.endsWith('.html')) { for (const m of text.matchAll(/\s(?:src|href)=["']([^"']+)["']/g)) refs.push(m[1]); }
    if (/\.(js|mjs)$/.test(f)) { for (const m of text.matchAll(/(?:import\s+(?:[^'"()]*?\s+from\s+)?|import\(\s*|export\s+[^'"]*?from\s+)['"](\.{1,2}\/[^'"]+)['"]/g)) refs.push(m[1]); for (const m of text.matchAll(/new URL\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*,\s*import\.meta\.url/g)) refs.push(m[1]); }
    if (f.endsWith('.css')) { for (const m of text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) refs.push(m[1]); }
    if (f === 'manifest.webmanifest') { for (const m of text.matchAll(/"src"\s*:\s*"([^"]+)"/g)) refs.push(m[1]); }
    for (const r of refs) { if (!isLocal(r)) continue; const p = resolve(f, r); if (p !== null && !hasPath(p)) missing.add(`${f} -> ${r}`); }
  }
  for (const m of missing) errors.push(`unresolved reference: ${m}`);

  const sw = set.has('sw.js') ? fs.readFileSync(path.join(dist, 'sw.js'), 'utf8') : '';
  if (!sw) errors.push('sw.js missing from output');
  const precache = [...sw.matchAll(/"(\.\/[^"]*)"/g)].map(m => m[1]);
  for (const a of precache) { const p = a.slice(2); if (!hasPath(p)) errors.push(`service worker precaches a file that is not in the output: ${a}`); }
  const need = ['./index.html', './labs/index.html', './labs/ai/index.html', './labs/cyber/index.html', './labs/science/index.html', './labs/finance/index.html', './labs/workflow/index.html', './labs/api-playground/index.html', './play/index.html', './play/mahjong/index.html', './play/2048/index.html', './play/daily-word/index.html', './labs/shared/kit.js'];
  for (const n of need) if (!precache.includes(n)) errors.push(`service worker does not precache ${n}`);

  if (set.has('sitemap.xml')) { for (const m of fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8').matchAll(/<loc>https:\/\/govibetool\.com\/([^<]*)<\/loc>/g)) { const p = m[1]; if (!hasPath(p)) errors.push(`sitemap URL has no page in the output: /${p}`); } }
  for (const f of ['index.html', '404.html', 'robots.txt', 'ads.txt', 'sitemap.xml', 'manifest.webmanifest', 'sw.js']) if (!set.has(f)) errors.push(`missing ${f}`);
  if (root) { for (const f of ['ads.txt', 'robots.txt', 'privacy.html', 'terms.html']) { const a = path.join(root, f), b = path.join(dist, f); if (fs.existsSync(a) && fs.existsSync(b) && !fs.readFileSync(a).equals(fs.readFileSync(b))) errors.push(`${f} differs from the source file`); } }
  return { ok: errors.length === 0, errors, files: files.length, totalBytes, largest };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = path.resolve(process.argv[2] || 'dist'); const r = verifyDist(dist, { root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..') });
  console.log(`${r.files} files, ${(r.totalBytes / 1048576).toFixed(2)} MiB, largest ${r.largest.file} (${(r.largest.bytes / 1024).toFixed(0)} KiB)`);
  if (!r.ok) { console.error(r.errors.join('\n')); process.exit(1); } console.log('OK');
}
