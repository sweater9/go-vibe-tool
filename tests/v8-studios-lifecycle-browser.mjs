/* Native browser regression checks for Studio lifecycle; local origin only. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createStudioRecorder} from './helpers/studio-interaction-recorder.mjs';
import {createDistServer} from '../scripts/serve-dist.mjs';
const pw=await import(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const engine=process.argv[2]||'chromium';
const server=createDistServer(process.env.SITE_ROOT||'dist');await server.start();
const out=process.env.STUDIO_QA_ARTIFACTS||`artifacts/studios-lifecycle-${engine}`;
await fs.mkdir(out,{recursive:true});
const results=[];let browser,currentRecorder,currentWidth;const failedWidths=new Set();
async function check(label,run){currentRecorder?.mark(label,'start');try{await run();results.push({label,ok:true});currentRecorder?.mark(label,'passed');console.log('PASS',label);}catch(error){failedWidths.add(currentWidth);results.push({label,ok:false,error:error.message});currentRecorder?.mark(label,'failed');console.error('FAIL',label,error.message);}}
try{
 browser=await pw[engine].launch({headless:true});
 for(const width of [375,1280]){
  currentWidth=width;
  const ctx=await browser.newContext({viewport:{width,height:900}});let recorder;
  try {
  if(engine==='firefox')await ctx.tracing.start({screenshots:true,snapshots:true,sources:true});
  const page=await ctx.newPage();page.setDefaultTimeout(15000);
  if(engine==='firefox')recorder=await createStudioRecorder(page);
  currentRecorder=recorder;
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const DEFAULT_URL='https://example.com/page?utm_source=newsletter&ref=keep';
  await page.goto(server.base+'?category=links-web&tool=url-cleaner');await page.waitForSelector('#studio-url:not([hidden])');
  await check(`${width} initial route and URL Studio bindings`,async()=>{
   await page.click('#urlAnalyze');const text=await page.locator('#urlResult').innerText();
   assert.match(text,/Scheme: https/);assert.match(text,/Removed trackers: utm_source/);assert.match(text,/Clean URL: https:\/\/example\.com\/page\?ref=keep/);
   if(engine==='firefox'&&process.env.GVT_STUDIO_DIAGNOSTIC_PROBE==='1')throw Error('Controlled diagnostic artifact probe');
  });
  await check(`${width} repeated alias opens preserve the form and live handlers`,async()=>{
   await page.fill('#urlInput','https://example.org/a?gclid=1&keep=2');await page.click('#urlAnalyze');const result=await page.locator('#urlResult').innerText();
   await page.evaluate(()=>openTool('qr-studio'));await page.waitForSelector('#studio-qr:not([hidden])');
   await page.evaluate(()=>openTool('url-cleaner'));await page.waitForSelector('#studio-url:not([hidden])');
   assert.equal(await page.inputValue('#urlInput'),'https://example.org/a?gclid=1&keep=2');assert.equal(await page.locator('#urlResult').innerText(),result);
   await page.click('#urlAnalyze');assert.match(await page.locator('#urlResult').innerText(),/Clean URL: https:\/\/example\.org\/a\?keep=2/);assert.equal(new URL(page.url()).searchParams.get('category'),'links-web');
  });
  await check(`${width} stale URL results invalidate on edits and errors are explicit`,async()=>{
   await page.fill('#urlInput','https://example.com/?a=1');await page.click('#urlAnalyze');await page.fill('#urlInput','https://example.com/?a=2');
   assert.match(await page.locator('#urlResult').innerText(),/Input changed/);
   await page.click('#urlCopy');assert.match(await page.locator('#urlResult').innerText(),/Inspect or build a URL first/);
   await page.fill('#urlInput','javascript:alert(1)');await page.click('#urlAnalyze');assert.match(await page.locator('#urlResult').innerText(),/Invalid URL/);
   await page.fill('#urlInput','');await page.click('#urlAnalyze');assert.match(await page.locator('#urlResult').innerText(),/Invalid URL/);
   await page.fill('#urlInput','https://example.com/?x=1#frag');await page.fill('#utmSource','news letter');await page.fill('#utmMedium','email');await page.fill('#utmCampaign','launch');
   await page.evaluate(()=>{const d=document.querySelector('#studio-url details');if(d)d.open=true;});await page.click('#urlUtm');
   const built=await page.locator('#urlResult').innerText();assert.match(built,/^Campaign URL:/);assert.match(built,/utm_source=news\+letter/);assert.match(built,/#frag/);
  });
  await check(`${width} Privacy Studio previews invalidate, Apply needs a current preview, and Audit leaves text unchanged`,async()=>{
   await page.click('[data-studio=privacy]');await page.waitForSelector('#studio-privacy:not([hidden])');
   await page.fill('#redactInput','mail jane@example.com ip 10.0.0.1');
   await page.evaluate(()=>runRedactor());assert.match(await page.locator('#redactSummary').innerText(),/Redacted preview.*Email: 1/);assert.ok(!(await page.locator('#redactOutput').innerText()).includes('jane@example.com'));
   await page.fill('#redactInput','mail jane@example.com ip 10.0.0.1 more');assert.match(await page.locator('#redactSummary').innerText(),/analyze again/);assert.equal(await page.locator('#redactOutput').innerText(),'');
   await page.click('#piiApply');assert.match(await page.locator('#redactSummary').innerText(),/current Auto-Redact preview/);
   await page.selectOption('#piiMode','audit');await page.evaluate(()=>runRedactor());assert.match(await page.locator('#redactSummary').innerText(),/Audit Only/);assert.equal(await page.inputValue('#redactInput'),'mail jane@example.com ip 10.0.0.1 more');
  });
  await check(`${width} QR remount synchronizes mode and clears prior secrets/canvas`,async()=>{
   await page.click('[data-studio=qr]');await page.selectOption('#qrType','text');await page.fill('#qrText','previous payload');await page.getByRole('button',{name:'Generate QR',exact:true}).click();await page.waitForSelector('#qrOutput canvas');
   await page.locator('#studioRoot').getByRole('button',{name:'Close',exact:true}).click();assert.equal(await page.locator('#studioRoot').count(),0);assert.equal(await page.locator('#qrText').count(),0);
   await page.evaluate(()=>openTool('qr-studio'));assert.equal(await page.inputValue('#qrType'),'url');assert.equal(await page.locator('#qrUrl').count(),1);assert.equal(await page.locator('#qrOutput canvas').count(),0);
   await page.getByRole('button',{name:'Generate QR',exact:true}).click();await page.waitForSelector('#qrOutput canvas');
  });
  await check(`${width} metadata alias opens Privacy in audit mode and the standalone page deep-links`,async()=>{
   await page.evaluate(()=>openTool('metadata'));assert.equal(await page.inputValue('#piiMode'),'audit');
   for(const studio of ['url','qr','privacy']){
    await page.goto(server.base+'studios?studio='+studio);await page.waitForSelector(`#studio-${studio}:not([hidden])`);
    assert.equal(await page.getAttribute(`#studio-tab-${studio}`,'aria-selected'),'true');
   }
   await page.goto(server.base+'studios?studio=url');await page.waitForSelector('#studio-url:not([hidden])');await page.click('#urlAnalyze');assert.match(await page.locator('#urlResult').innerText(),/Scheme: https/);
   assert.equal(await page.inputValue('#urlInput'),DEFAULT_URL);
  });
  await check(`${width} no uncaught errors or horizontal overflow`,async()=>{assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));});
  } catch(error) {
   failedWidths.add(width);results.push({label:`${width} setup/execution`,ok:false,error:error.message});console.error('FAIL',width,error.message);
  } finally {
   if(recorder)await fs.writeFile(`${out}/interactions-${width}.json`,JSON.stringify({engine,width,...await recorder.flush()},null,2));
   if(engine==='firefox') {
    try{await ctx.tracing.stop(failedWidths.has(width)?{path:`${out}/trace-${width}.zip`}:undefined);}catch(error){results.push({label:`${width} trace finalization`,ok:false,error:error.message});}
   }
   currentRecorder=null;await ctx.close();
  }
 }
}finally{if(browser)await browser.close();await server.stop();await fs.mkdir('artifacts',{recursive:true});await fs.writeFile(`${out}/results.json`,JSON.stringify({engine,results},null,2));if(!process.env.STUDIO_QA_ARTIFACTS)await fs.writeFile(`artifacts/studios-lifecycle-${engine}.json`,JSON.stringify({engine,results},null,2));}
if(results.some(result=>!result.ok))process.exitCode=1;
