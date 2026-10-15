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
/* reducedMotion: v2.css sets html{scroll-behavior:smooth}; in Firefox a press and release can straddle a scroll animation, so the
   release lands on a different element and no click reaches the button (see docs/qa/V8-FIREFOX-INTERACTION-STABILITY.md).
   Assertions are unchanged; V8_REDUCED_MOTION=0 restores default motion. */
try{
 browser=await pw[engine].launch({headless:true});
 for(const width of [375,1280]){
  currentWidth=width;
  const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:process.env.V8_REDUCED_MOTION==='0'?'no-preference':'reduce'});let recorder;
  try {
  if(engine==='firefox')await ctx.tracing.start({screenshots:true,snapshots:true,sources:true});
  const page=await ctx.newPage();page.setDefaultTimeout(15000);
  if(engine==='firefox')recorder=await createStudioRecorder(page);
  currentRecorder=recorder;
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(server.base+'?category=business-finance&tool=hourly-rate');await page.waitForSelector('#studio-freelance:not([hidden])');
  await check(`${width} initial route and calculator bindings`,async()=>{await page.click('#calcRate');assert.match(await page.locator('#rateResult').innerText(),/Quote: 2262\./);if(engine==='firefox'&&process.env.GVT_STUDIO_DIAGNOSTIC_PROBE==='1')throw Error('Controlled diagnostic artifact probe');});
  await check(`${width} repeated alias opens preserve the form and live handlers`,async()=>{
   await page.fill('#target','120000');await page.click('#calcRate');const quote=await page.locator('#rateResult').innerText();
   await page.evaluate(()=>openTool('url-cleaner'));await page.waitForSelector('#studio-url:not([hidden])');
   await page.evaluate(()=>openTool('hourly-rate'));assert.equal(await page.inputValue('#target'),'120000');assert.equal(await page.locator('#rateResult').innerText(),quote);
   await page.click('#calcRate');assert.equal(new URL(page.url()).searchParams.get('category'),'business-finance');
  });
  await check(`${width} stale quote and effective results invalidate on edits`,async()=>{
   await page.fill('#target','');assert.match(await page.locator('#rateResult').innerText(),/calculate again/);await page.click('#calcRate');assert.match(await page.locator('#rateResult').innerText(),/every numeric/);
   await page.fill('#target','100000');await page.fill('#hours','1e-300');await page.fill('#weeks','1e-300');await page.click('#calcRate');assert.match(await page.locator('#rateResult').innerText(),/calculation range/);assert.doesNotMatch(await page.locator('#rateResult').innerText(),/Infinity|NaN/);
   await page.click('#calcEffective');assert.match(await page.locator('#effectiveResult').innerText(),/90\.00/);await page.fill('#hrBill','0');assert.match(await page.locator('#effectiveResult').innerText(),/calculate again/);
   await page.fill('#hrUnpaid','0');await page.click('#calcEffective');assert.match(await page.locator('#effectiveResult').innerText(),/Undefined from zero hours/);
  });
  await check(`${width} QR remount synchronizes mode and clears prior secrets/canvas`,async()=>{
   await page.click('[data-studio=qr]');await page.selectOption('#qrType','text');await page.fill('#qrText','previous payload');await page.getByRole('button',{name:'Generate QR',exact:true}).click();await page.waitForSelector('#qrOutput canvas');
   await page.locator('#studioRoot').getByRole('button',{name:'Close',exact:true}).click();assert.equal(await page.locator('#studioRoot').count(),0);assert.equal(await page.locator('#qrText').count(),0);
   await page.evaluate(()=>openTool('qr-studio'));assert.equal(await page.inputValue('#qrType'),'url');assert.equal(await page.locator('#qrUrl').count(),1);assert.equal(await page.locator('#qrOutput canvas').count(),0);
   await page.getByRole('button',{name:'Generate QR',exact:true}).click();await page.waitForSelector('#qrOutput canvas');
  });
  await check(`${width} metadata alias and post-close calculator remain interactive`,async()=>{
   await page.evaluate(()=>openTool('metadata'));assert.equal(await page.inputValue('#piiMode'),'audit');
   await page.click('[data-studio=freelance]');await page.click('#calcRate');assert.match(await page.locator('#rateResult').innerText(),/113\.12/);
   await page.goto(server.base+'studios?studio=freelance');await page.waitForSelector('#studio-freelance:not([hidden])');await page.click('#calcRate');assert.match(await page.locator('#rateResult').innerText(),/113\.12/);
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
