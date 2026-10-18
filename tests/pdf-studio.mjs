import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../tools/pdf-studio/index.html',import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../tools/pdf-studio/studio.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../tools/pdf-studio/studio.css',import.meta.url),'utf8');
test('PDF Studio uses only same-origin PDF engines and no upload API',()=>{
 assert.match(js,/pdf\.min\.mjs/);
 assert.match(js,/pdf\.worker\.min\.mjs/);
 assert.match(html,/pdf-lib\.min\.js/);
 assert.doesNotMatch(js,/fetch\(|XMLHttpRequest|sendBeacon|https?:\/\//);
 assert.match(html,/connect-src 'self' blob:/);
});
test('PDF Studio exposes editing and persistent PDF export',()=>{
 for(const id of ['file','canvas','pages','rotate','remove','addText','save','download','status']) assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(js,/PDFDocument\.load/);
 assert.match(js,/page\.drawText/);
 assert.match(js,/doc\.removePage/);
 assert.match(js,/setRotation/);
 assert.match(js,/URL\.createObjectURL/);
 assert.match(js,/a\.download="govibe-edited\.pdf"/);
 assert.match(js,/window\.addEventListener\("pagehide",clearDownload\)/);
});
test('PDF Studio provides mobile layout and no nested iframe',()=>{
 assert.match(css,/@media\(max-width:700px\)/);
 assert.doesNotMatch(html,/<iframe\b/i);
});
