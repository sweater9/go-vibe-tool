/* Every classic <script> the homepage loads (and every inline one) must at least parse. A single SyntaxError in one shared script (for example
   `async let x` in v2-tools.js) silently stops all later code: the category tiles never render and every tool is unreachable. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const pages = ['index.html'];
let checked = 0;
for (const page of pages) {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1], src = /\bsrc="([^"]+)"/.exec(attrs), type = /\btype="([^"]+)"/.exec(attrs);
    if (type && !/^(text|application)\/javascript$/.test(type[1])) continue; // JSON-LD, modules, etc.
    let code, name;
    if (src) { if (/^https?:/.test(src[1])) continue; name = src[1]; code = fs.readFileSync(path.join(root, path.dirname(page), src[1]), 'utf8'); }
    else { name = page + ' (inline)'; code = m[2]; if (!code.trim()) continue; }
    try { new vm.Script(code, { filename: name }); } catch (e) { console.error(`SYNTAX ERROR in ${name}: ${e.message}`); process.exit(1); }
    checked++;
  }
}
if (!checked) { console.error('no scripts checked'); process.exit(1); }
console.log(`homepage scripts parse: ${checked} scripts OK`);
