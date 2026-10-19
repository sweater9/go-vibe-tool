import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const dir='../tools/pdf-editor/';
const html=fs.readFileSync(new URL(dir+'index.html',import.meta.url),'utf8');
const js=fs.readFileSync(new URL(dir+'editor.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL(dir+'editor.css',import.meta.url),'utf8');
const bake=fs.readFileSync(new URL(dir+'bake.mjs',import.meta.url),'utf8');
const model=fs.readFileSync(new URL(dir+'model.mjs',import.meta.url),'utf8');
const textedit=fs.readFileSync(new URL(dir+'textedit.mjs',import.meta.url),'utf8');
const register=fs.readFileSync(new URL(dir+'register.js',import.meta.url),'utf8');
test('PDF Editor is standalone, same-origin only and never uploads documents',()=>{
 for(const [name,src] of [['editor.js',js],['bake.mjs',bake],['model.mjs',model],['textedit.mjs',textedit]]) assert.doesNotMatch(src,/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|https?:\/\//,name+' must not use the network');
 assert.match(js,/pdf\.min\.mjs/); assert.match(js,/pdf\.worker\.min\.mjs/); assert.match(html,/vendor\/pdf-lib\.min\.js/);
 assert.match(html,/connect-src 'self' blob:/); assert.match(html,/script-src 'self'/); assert.doesNotMatch(html,/<iframe\b/i);
 assert.doesNotMatch(html,/ style="/,'CSP style-src forbids inline style attributes'); assert.doesNotMatch(js,/\.setAttribute\("style"|\.style\.cssText/);
 assert.match(js,/disableFontFace:\s*true/,'no FontFace registration (WebKit reports it as a style-src violation)');
});
test('PDF Editor exposes the document-first workspace: tools, thumbnails, zoom, undo/redo and an obvious download',()=>{
 for(const id of ['undo','redo','zoomIn','zoomOut','zoomFit','download','downloadLink','thumbs','pageCanvas','overlay','rail','props','status','fileInput','imageInput','pgRotL','pgRotR','pgDel','pgExtract','pgBlank','pgInsert','objList']) assert.match(html,new RegExp('id="'+id+'"'),id);
 for(const t of ['select','text','image','rect','ellipse','line','arrow','draw','highlight','underline','strike','note','edittext']) assert.match(html,new RegExp('data-tool="'+t+'"'),t);
 assert.match(html,/aria-live="polite"/); assert.match(css,/@media \(max-width:900px\)/); assert.match(css,/:focus-visible/); assert.match(css,/prefers-reduced-motion/);
});
test('PDF Editor export keeps original pages, embeds edits as vector content and verifies the result re-opens',()=>{
 assert.match(bake,/canEditInPlace/); assert.match(bake,/copyPages/); assert.match(bake,/drawText/); assert.match(bake,/drawImage/); assert.match(bake,/Subtype: 'Text'/); assert.match(bake,/BlendMode\.Multiply/);
 assert.doesNotMatch(bake,/toDataURL|rasteri[sz]e\(|getImageData/,'the export must never rasterise pages');
 assert.match(js,/getPageCount\(\) !== expected/); assert.match(js,/URL\.createObjectURL/); assert.match(js,/a\.download = fname|\.download = fname/); assert.match(js,/pagehide/);
});
test('Existing-text editing is genuine content-stream editing, limited to fonts that can be rewritten, and overlays are labelled as overlays',()=>{
 assert.match(textedit,/subset-font/); assert.match(textedit,/composite-font/); assert.match(textedit,/custom-encoding/); assert.match(textedit,/Tj/); assert.match(textedit,/TJ/);
 assert.match(html,/Cover and retype \(visual overlay\)/); assert.match(js,/not secure redaction/); assert.match(js,/not editing and it is not redaction/);
});
test('PDF Editor discovery adds one tile next to Private PDF Tools and opens its own page',()=>{
 assert.match(register,/"pdf-editor", "PDF & Tables", "PDF Editor"/); assert.match(register,/tools\/pdf-editor\//); assert.match(register,/findIndex\(\(t\) => t\[0\] === "pdf-studio"\)/);
 assert.doesNotMatch(register,/innerHTML|iframe/);
 const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.match(index,/tools\/pdf-editor\/register\.js/); assert.match(sw,/\.\/tools\/pdf-editor\/register\.js/);
 const legacy=fs.readFileSync(new URL('../tools/pdf-studio/index.html',import.meta.url),'utf8'); assert.match(legacy,/url=\.\.\/pdf-editor\//,'the old PDF Studio URL must forward to the editor');
});

test('Screenshot Beautifier uses dedicated UI with CSP-compliant embedded styling',()=>{
 const html=fs.readFileSync(new URL('../tools/v9-media/index.html',import.meta.url),'utf8');
 const media=fs.readFileSync(new URL('../tools/v9-media/media.js',import.meta.url),'utf8');
 const styles=fs.readFileSync(new URL('../tools/v9-media/media.css',import.meta.url),'utf8');
 assert.doesNotMatch(html,/<script(?![^>]*src=)[^>]*>/i);
 assert.doesNotMatch(html,/<style[\\s>]/i);
 assert.match(media,/classList\.add\("beautifier"\)/);
 assert.match(media,/beautifier-preview/);
 assert.match(media,/Generate preview &amp; PNG/);
 assert.match(styles,/body\.beautifier #nav/);
 assert.match(styles,/body\.embedded main/);
});
test('Arcade game launch actions use the primary theme colour',()=>{
 const arcade=fs.readFileSync(new URL('../play/vibe-arcade/index.html',import.meta.url),'utf8');
 assert.match(arcade,/\.gcard > \.btn, \.list \[data-act="level"\]/);
 assert.match(arcade,/background: var\(--thread\); color: var\(--on-thread\)/);
});

test('Existing Private PDF Tools exposes a reliable download state',()=>{
 const legacy=fs.readFileSync(new URL('../v2-tools.js',import.meta.url),'utf8');
 assert.match(legacy,/id="pdfDownloadArea" class="actions"/);
 assert.match(legacy,/id="pdfDownloadLink" class="btn alt" aria-disabled="true"/);
 assert.match(legacy,/pdfClearDownload\(\);document\.getElementById\(\\'pdfStatus\\'\)/); // inside a single-quoted JS string, so the quotes are escaped
 assert.match(legacy,/link\.removeAttribute\("aria-disabled"\)/);
 assert.match(legacy,/link\.href=pdfResultUrl/);
 assert.match(legacy,/link\.download=name/);
 assert.match(legacy,/URL\.revokeObjectURL\(pdfResultUrl\)/);
});
