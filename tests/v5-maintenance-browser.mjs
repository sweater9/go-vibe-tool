/** Run against the checkout or live production; production defects are reported separately. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const pw = await import(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const engine = process.argv[2] || 'chromium';
let base = process.env.BASE_URL || 'http://127.0.0.1:8765';
const production = process.env.PRODUCTION_SMOKE === '1';
const dir = process.env.MAINTENANCE_ARTIFACTS || `artifacts/v5-maintenance-${production ? 'production' : 'candidate'}-${engine}`;
await fs.mkdir(dir, { recursive: true });
const results = [], issues = [], defects = [], limitations = [];
const productionDiagnostics = { exceptions: [], serviceWorkerHtmlForExternalRequests: [], responseReadFailures: [] };
// A server outage tests SW fallback without Playwright's offline transport blocking SW dispatch.
// Candidate HTML omits only the external ad script, including in the SW precache.
let server, serverUnavailable = false;
if (!production) {
 const root = fileURLToPath(new URL('../', import.meta.url));
 server = http.createServer(async (req,res)=>{
  if (serverUnavailable) { req.socket.destroy(); return; }
  try {
   let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname));
   if (file !== path.resolve(root) && !file.startsWith(root)) { res.writeHead(403).end(); return; }
   if ((await fs.stat(file)).isDirectory()) file = path.join(file,'index.html');
   let body = await fs.readFile(file);
   if (file === path.join(root,'index.html')) body = Buffer.from(body.toString().replace(/<script async src="https:\/\/pagead2\.googlesyndication\.com[^>]*><\/script>/g,''));
   const types = {'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
   res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(body);
  } catch { res.writeHead(404).end('Not found'); }
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 base = `http://127.0.0.1:${server.address().port}`;
}
const browser = await pw[engine].launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
const privacy = {
 eyebrow: 'PRIVATE BY DESIGN · INTELLITOOLS',
 headline: 'Your Data.Your Browser.Your Control.',
 body: 'IntelliTools is designed with your privacy in mind. Our browser-based tools process your files and information directly on your device, giving you greater control over your data. Our tools also work without an internet connection, and no account is required.',
 indicators: ['✓ On-device processing', '✓ Works offline', '✓ No account required']
};
async function check(name, fn) { try { await fn(); results.push(name); console.log("PASS " + name); } catch (e) { issues.push(`${name}: ${e.message}`); console.error("FAIL " + name + ": " + e.message); } }
async function maintenance(name, fn) { if (!production) return fn(); try { await fn(); } catch(e) { defects.push(`${name}: ${e.message}`); } }
try {
 for (const width of [1440,1024,390,375]) {
  const context = await browser.newContext({ viewport: {width,height:900} });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  let phase = 'online';
  const responseTasks = new Set();
  page.on('pageerror', e => {
   const stack = e.stack || e.message;
   issues.push(`${width} JS: ${stack}`); // Every error still fails the run.
   if (production) productionDiagnostics.exceptions.push({width,phase,stack,throwingScriptOrigin:stack.match(/https?:\/\/[^/\s)]+/)?.[0] || null});
  });
  if (production) page.on('response', response => {
   if (!response.fromServiceWorker() || new URL(response.url()).origin === new URL(base).origin) return;
   const request = response.request(), capturedPhase = phase;
   const task = (async()=>{
    try {
     const body = await response.text();
     if (/^\s*<!doctype html/i.test(body)) productionDiagnostics.serviceWorkerHtmlForExternalRequests.push({width,phase:capturedPhase,url:response.url(),resourceType:request.resourceType(),status:response.status(),contentType:response.headers()['content-type'],fromServiceWorker:true,bodyPrefix:body.slice(0,100)});
    } catch(e) { productionDiagnostics.responseReadFailures.push({width,url:response.url(),message:e.message}); }
   })();
   responseTasks.add(task); task.finally(()=>responseTasks.delete(task));
  });
  page.on('console', m => { if(m.type()==='error') issues.push(`${width} console: ${m.text()}`); });
  async function goto(path) { const r = await page.goto(new URL(path,base).href,{waitUntil:'networkidle',timeout:45000}); assert.ok(r?.ok(),`${path}: HTTP ${r?.status()}`); }
  async function overflow() { assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+2),`horizontal overflow at ${width}`); }
  await check(`${width}: homepage, catalogue, shortcuts, privacy, navigation`, async()=>{
   await goto('/');
   assert.equal(await page.locator('#activeCount').innerText(),'54');
   assert.equal(await page.locator('#toolCatalog .toolcard').count(),54);
   assert.equal(await page.locator('.hero .eyebrow').innerText(),privacy.eyebrow);
   assert.equal(await page.locator('.hero h1').textContent(),privacy.headline);
   assert.equal(await page.locator('.hero-grid > div > p').innerText(),privacy.body);
   assert.deepEqual(await page.locator('.hero-privacy-points span').allTextContents(),privacy.indicators);
   await maintenance('D1 literal escape', async()=>assert.ok(!(await page.locator('body').innerText()).includes('\\n')));
   await maintenance('D2 search label', async()=>assert.equal(await page.locator('#toolSearch').getAttribute('aria-label'),'Search tools by task or result'));
   await page.locator('#toolSearch').fill('json');
   assert.ok(await page.locator('#toolCatalog .toolcard').count()>0);
   assert.ok(await page.locator('#toolCatalog .toolcard').count()<54);
   await page.locator('#toolSearch').fill('');
   await page.locator('.favorite-btn').first().click();
   assert.ok((await page.locator('#discoveryShelf').innerText()).toLowerCase().includes('favourites'));
   await page.locator('#toolCatalog .toolcard .btn').first().click();
   await page.reload({waitUntil:'networkidle'});
   assert.ok((await page.locator('#discoveryShelf').innerText()).toLowerCase().includes('recently used'));
   assert.equal(await page.locator('.favorite-btn').first().getAttribute('aria-pressed'),'true');
   await maintenance('D4 touch targets',async()=>{
    const bad=await page.locator('a[href],button,input,select').evaluateAll(els=>els.filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.height<43.5||r.width<43.5)}).map(e=>({text:e.textContent?.trim(),id:e.id,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
    assert.deepEqual(bad,[]);
   });
   await maintenance('D5 Quick Start alignment',async()=>{
    const rows=await page.locator('.hero-card button').evaluateAll(es=>es.map(e=>{let r=e.getBoundingClientRect(), t=e.children[1].getBoundingClientRect(), a=e.children[2].getBoundingClientRect();return {height:r.height,textX:t.x,arrowX:a.x}}));
    assert.ok(Math.max(...rows.map(r=>r.height))-Math.min(...rows.map(r=>r.height))<1);
    assert.ok(rows.every(r=>Math.abs(r.textX-rows[0].textX)<1&&Math.abs(r.arrowX-rows[0].arrowX)<1));
   });
   const hrefs=await page.locator('a[href]').evaluateAll(es=>[...new Set(es.map(e=>e.getAttribute('href')).filter(h=>h&&!h.startsWith('#')&&!h.startsWith('mailto:')))]);
   for(const href of hrefs){const url=new URL(href,page.url());if(url.origin===new URL(base).origin){const r=await context.request.get(url.href);assert.ok(r.ok(),`navigation ${url.href}: ${r.status()}`);}}
   await overflow();
   await page.evaluate(()=>scrollTo({top:0,behavior:"instant"}));
   await page.screenshot({path:`${dir}/home-${width}.png`,fullPage:false});
   await page.locator(".hero-card").screenshot({path:`${dir}/quick-start-${width}.png`});
  });
  await check(`${width}: existing tool workspaces`,async()=>{
   for(const id of ['ai-prompt-builder','json-formatter','password']){
    await goto('/?tool='+id); assert.ok((await page.locator('#workspace').innerText()).trim().length>50,`empty ${id}`); await overflow();
   }
  });
  await check(`${width}: Knowledge search and result navigation`,async()=>{
   await goto('/knowledge/');await page.locator('#kn-q').fill('What is an LLM?');await page.waitForSelector('#kn-search-results .kn-read');
   const href=await page.locator('#kn-search-results .kn-read').first().getAttribute('href');await goto(new URL(href,page.url()).href);await overflow();
  });
  await check(`${width}: Visual Workflow Lab simulation and persistence`,async()=>{
   await goto('/labs/workflow/');await page.locator('#btnStartSim').click();await page.locator('#btnRunAllSim').click();
   assert.ok((await page.locator('#simLogContainer').innerText()).length>30);assert.notEqual(await page.locator('#simContextContainer').innerText(),'{}');
   await page.locator('#btnSaveWorkflow').click();assert.ok(await page.evaluate(()=>localStorage.getItem('it_workflow_current')));await overflow();
   await page.screenshot({path:`${dir}/workflow-${width}.png`,fullPage:false});
  });
  await check(`${width}: API & JSON Playground response and validation`,async()=>{
   await goto('/labs/api-playground/');await page.locator('#btnSendRequest').click();await page.waitForFunction(()=>document.querySelector('#responseStatusBadge').textContent.includes('200'));
   assert.ok((await page.locator('#responseBodyPre').innerText()).includes('id'));
   await page.locator('#bodyTextarea').fill('{"bad": <img src=x onerror="window.__xss=true">}');assert.equal(await page.locator('#jsonValidationStatus img').count(),0);assert.ok(!(await page.evaluate(()=>window.__xss)));await overflow();
  });
  await check(`${width}: Daily Knowledge Challenge completion and persistence`,async()=>{
   await goto('/play/daily/');
   await maintenance('D3 radiogroup keyboard',async()=>{
    assert.equal(await page.locator('[role=radio][tabindex="0"]').count(),1);
    const wrong = await page.evaluate(()=>(window.dailyChallengeApp.questions[0].correctIndex+1)%4);
    await page.locator('[role=radio]').nth((wrong+3)%4).focus();await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('[role=radio][aria-checked=true]').count(),1);
    assert.equal(await page.locator('[role=radio][aria-checked=true]').getAttribute('data-idx'),String(wrong));
    assert.equal(await page.locator('[role=radio][aria-checked=true]').getAttribute('aria-disabled'),'true');
    await page.keyboard.press('Tab');assert.equal(await page.locator('#btnNext').evaluate(e=>e===document.activeElement),true);
    await page.keyboard.press('Enter');assert.equal(await page.locator('#progressLabel').innerText(),'Question 2 of 5');
   });
   while(await page.locator('.quiz-option').count()){
    await page.locator('.quiz-option').first().click();await page.locator('#btnNext').click();
   }
   assert.ok((await page.locator('#quizContainer').innerText()).includes("Today's Score:"));await page.reload({waitUntil:'networkidle'});assert.ok((await page.locator('#quizContainer').innerText()).toLowerCase().includes('challenge completed'));await overflow();
  });
  await check(`${width}: Word & Logic Challenge solve`,async()=>{
   await goto('/play/word-logic/');await page.keyboard.type('CODE');await page.keyboard.press('Enter');
   await page.waitForFunction(()=>document.querySelector('#slotsContainer').textContent.includes('C'));
   assert.ok(await page.evaluate(()=>window.wordLogicApp?.isCompleted));await overflow();
  });
  await check(`${width}: service worker cache (offline reload where supported)`,async()=>{
   await goto('/');await page.evaluate(()=>navigator.serviceWorker.ready);
   await page.reload({waitUntil:'networkidle'});assert.ok(await page.evaluate(()=>!!navigator.serviceWorker.controller));
   const cached=await page.evaluate(async()=>{const c=await caches.open('intellitools-v5-0');return (await c.keys()).map(r=>new URL(r.url).pathname)});
   for(const path of ['/labs/workflow/index.html','/labs/api-playground/index.html','/play/daily/index.html','/play/word-logic/index.html']) assert.ok(cached.includes(path),`uncached ${path}`);
   if (!production) {
    serverUnavailable = true;
    try {
     await page.reload({waitUntil:'domcontentloaded'});
     assert.equal(await page.locator('#activeCount').innerText(),'54');
     for (const [route, app] of [['/labs/workflow/','workflowApp'],['/labs/api-playground/','apiPlaygroundApp'],['/play/daily/','dailyChallengeApp'],['/play/word-logic/','wordLogicApp']]) {
      const response = await page.goto(new URL(route,base).href,{waitUntil:'domcontentloaded'});
      assert.ok(response?.ok(),`offline route ${route}`);
      await page.waitForFunction(name=>!!window[name],app);
      await overflow();
     }
     await page.locator('#slotsContainer').waitFor();
     await page.keyboard.type('CODE');await page.keyboard.press('Enter');
     assert.ok(await page.evaluate(()=>window.wordLogicApp.isCompleted),'offline word puzzle must execute');
    }
    finally { serverUnavailable = false; }
   } else if (engine === 'chromium') {
    phase = 'offline';
    await context.setOffline(true);
    try { await page.reload({waitUntil:'domcontentloaded'}); assert.equal(await page.locator('#activeCount').innerText(),'54'); await page.waitForTimeout(1500); }
    finally { await context.setOffline(false); phase = 'online'; }
   } else {
    limitations.push(`${width}: ${engine} live-production offline transport/reload not verified; cache population and active controller verified. Playwright offline transport prevents SW navigation in this engine.`);
   }
  });
  await Promise.allSettled([...responseTasks]);
  await context.close();
 }
} finally {
 await browser.close();
 if (server) await new Promise(resolve=>server.close(resolve));
 await fs.writeFile(`${dir}/results.json`,JSON.stringify({engine,base,production,results,issues,defects,limitations,productionDiagnostics},null,2));
}
console.log(JSON.stringify({engine,base,checks:results.length,issues,defects,limitations,productionDiagnostics},null,2));
if(issues.length)process.exitCode=1;
