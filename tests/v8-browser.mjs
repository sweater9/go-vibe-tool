import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const pw = await import(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const engine = process.argv[2] || 'chromium';
const dir = process.env.V8_ARTIFACTS || `artifacts/v8-${engine}`;
await fs.mkdir(dir,{recursive:true});
const root = fileURLToPath(new URL('../', import.meta.url));
const server = http.createServer(async (req,res)=>{try{let f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://x').pathname));if((await fs.stat(f)).isDirectory())f=path.join(f,'index.html');let b=await fs.readFile(f);if(f===path.join(root,'index.html'))b=Buffer.from(b.toString().replace(/<script async src="https:\/\/pagead2[^>]*><\/script>/,''));const t={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};res.writeHead(200,{'Content-Type':t[path.extname(f)]||'application/octet-stream'}).end(b)}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}/`;
const browser=await pw[engine].launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
const fails=[];let passed=0;
async function check(n,fn){try{await fn();passed++;console.log('PASS',n)}catch(e){fails.push(n+': '+e.message);console.error('FAIL',n,e.message)}}
try{
 for(const width of [375,390,768,1024,1440]){
  const ctx=await browser.newContext({viewport:{width,height:900}});const page=await ctx.newPage();page.setDefaultTimeout(10000);
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(base);
  await check(`${width} no horizontal overflow`,async()=>{const o=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert.ok(o<=0,'overflow '+o)});
  await check(`${width} search finds tool`,async()=>{await page.fill('#intent','compress an image');await page.waitForSelector('#intentResults .intent-hit');assert.match(await page.locator('#intentResults').innerText(),/image/i)});
  await check(`${width} task chip fills search`,async()=>{await page.locator('.task-chip').first().click();assert.equal(await page.inputValue('#intent'),'build an AI prompt');await page.waitForSelector('#intentResults .intent-hit')});
  await check(`${width} category cards filter real tools`,async()=>{
   assert.equal(await page.locator('.category-card').count(),8);
   await page.locator('.category-card[data-cat="developer"]').click();
   const n=await page.locator('#toolCatalog .toolcard').count();assert.ok(n>=5,'dev tools '+n);
   assert.equal(await page.locator('#visibleCount').innerText(),String(n));
   assert.equal(await page.locator('.category-card[data-cat="developer"]').getAttribute('aria-pressed'),'true');
   await page.locator('#clearCategory').click();assert.ok(await page.locator('#toolCatalog .toolcard').count()>n)});
  await check(`${width} featured, open and close tool`,async()=>{await page.locator('#featuredTools button').first().click();await page.waitForSelector('#workspace.active');await page.evaluate(()=>closeTool());assert.ok(!(await page.locator('#workspace.active').count()))});
  await check(`${width} favourites and recent persist`,async()=>{await page.locator('#toolCatalog .favorite-btn').first().click();assert.ok(await page.locator('#discoveryShelf .shelf-label',{hasText:'Favourites'}).count());await page.reload();assert.ok(await page.locator('#discoveryShelf .shelf-label',{hasText:'Favourites'}).count());
   assert.ok(JSON.parse(await page.evaluate(()=>localStorage.getItem('it.discovery.favorites'))).length>=1)});
  await check(`${width} navigation`,async()=>{
   const toggle=page.locator('.menu-toggle');
   if(width<=860){assert.ok(await toggle.isVisible());assert.equal(await page.locator('#primaryNav').isVisible(),false);await toggle.focus();await page.keyboard.press('Enter');assert.equal(await toggle.getAttribute('aria-expanded'),'true');assert.ok(await page.locator('#primaryNav').isVisible());
    const boxes=await page.locator('#primaryNav a').evaluateAll(e=>e.map(x=>x.getBoundingClientRect().height));assert.ok(boxes.every(h=>h>=44),'tap targets '+boxes);
    await page.keyboard.press('Escape');assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert.equal(await page.evaluate(()=>document.activeElement.className),'menu-toggle')}
   else{assert.equal(await toggle.isVisible(),false);assert.ok(await page.locator('#primaryNav').isVisible())}});
  await check(`${width} privacy copy intact`,async()=>{assert.equal(await page.locator('.hero h1').textContent(),'Your Data.Your Browser.Your Control.')});
  await check(`${width} no page errors`,async()=>assert.deepEqual(errs,[]));
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(300);await page.screenshot({path:`${dir}/home-${width}.png`,fullPage:false});
  if(width===375){await page.locator('.menu-toggle').click();await page.screenshot({path:`${dir}/menu-open-375.png`});}
  if(width===1440){await page.locator('.category-card[data-cat="ai-prompts"]').click();await page.waitForTimeout(400);await page.screenshot({path:`${dir}/category-ai-prompts-1440.png`});}
  await ctx.close();
 }
 const ctx=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});const page=await ctx.newPage();await page.goto(base);
 await check('reduced motion disables transitions',async()=>assert.equal(await page.locator('.category-card').first().evaluate(e=>getComputedStyle(e).transitionDuration),'0s'));
 await page.screenshot({path:`${dir}/home-full-1440.png`,fullPage:true});
}finally{await browser.close();server.close()}
console.log(`${engine}: ${passed} passed, ${fails.length} failed`);
if(fails.length){console.error(fails.join('\n'));process.exit(1)}
