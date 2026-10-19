import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createDistServer} from '../scripts/serve-dist.mjs';
const pw=await import(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const engine=process.argv[2]||'chromium';
const server=createDistServer(process.env.SITE_ROOT||'dist');
await server.start();
const browser=await pw[engine].launch({headless:true});
const results=[];
let offline=false;
async function check(label,fn){try{await fn();results.push({label,ok:true});console.log('PASS',label);}catch(e){results.push({label,ok:false,error:e.message});console.error('FAIL',label,e.message);}}
try{
for(const width of [375,1280]){
 const context=await browser.newContext({viewport:{width,height:900}});
 const page=await context.newPage();page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.base);
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));});
 await check(`${width}: nine categories and 70 listed tools (59 V8 + 10 V9 + the standalone PDF Editor)`,async()=>{assert.equal(await page.locator('.cat-tile').count(),9);assert.equal(await page.evaluate(()=>tools.filter(isListed).length),70);});
 for(const id of ['curl-snippets','key-hash','regex-playground','tailwind-css','shadow-glass','svg-sanitizer','image-metadata-stripper','image-batch-compressor','table-converter']){
 await check(`${width}: ${id} deep link`,async()=>{await page.goto(server.base+'?tool='+id);await page.waitForSelector('#workspace.active');assert.ok((await page.locator('#workspace').innerText()).length>100);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));});
 }
 for(const [id,key] of [['link-fingerprint','url'],['qr-studio','qr'],['pii-secret-redactor','privacy']]){
 await check(`${width}: ${key} studio and retained functionality`,async()=>{
 await page.goto(server.base+'?tool='+id);await page.waitForSelector('#studio-'+key+':not([hidden])');
 if(key==='url'){await page.fill('#urlInput','https://example.com/?ref=keep&utm_source=test');await page.click('#urlAnalyze');assert.match(await page.locator('#urlResult').innerText(),/ref=keep/);}
 if(key==='qr'){assert.ok(await page.locator('#qrUrl').count());await page.evaluate(()=>generateQR());assert.ok(await page.locator('#qrOutput canvas').count());}
 if(key==='privacy'){await page.fill('#redactInput','Contact test@example.com Bearer abc.def.ghi');await page.evaluate(()=>runRedactor());assert.match(await page.locator('#redactOutput').innerText(),/REDACTED/i);}
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 });
 }
 await check(`${width}: independent percentage tool`,async()=>{await page.goto(server.base+'?tool=percentage-change');assert.equal(await page.locator('#studioRoot').count(),0);assert.match(await page.locator('#workspace').innerText(),/Percentage/i);});
 await check(`${width}: no JavaScript exceptions`,async()=>assert.deepEqual(errors,[]));
 await server.stop();offline=true;
 await check(`${width}: cold offline AVIF dependencies`,async()=>{await page.goto(server.base+'?tool=image-batch-compressor');const sizes=await page.evaluate(async()=>{const paths=['vendor/avif/avif_enc.wasm','vendor/avif/avif_enc.js','tools/file-media/fm-avif-worker.js'];return Promise.all(paths.map(async p=>{const r=await fetch(p);if(!r.ok)throw Error(p);return (await r.arrayBuffer()).byteLength;}));});assert.ok(sizes[0]>3000000);assert.ok(sizes.every(n=>n>0));});
 for(const route of ['studios?studio=url','knowledge/','labs/','play/'])await check(`${width}: offline ${route}`,async()=>{await page.goto(server.base+route);assert.ok((await page.locator('body').innerText()).length>100);});
 await server.start();offline=false;await context.close();
}
}finally{if(offline)await server.start();await browser.close();await server.stop();await fs.mkdir('artifacts',{recursive:true});await fs.writeFile(`artifacts/integration-${engine}.json`,JSON.stringify({engine,results},null,2));}
if(results.some(r=>!r.ok))process.exitCode=1;
