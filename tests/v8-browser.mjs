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
let curPage=null,widthFails=0;
async function check(n,fn){try{await fn();passed++;console.log('PASS',n)}catch(e){widthFails++;const where=(e.stack||'').split('\n').filter(l=>/v8-browser\.mjs/.test(l)).slice(0,2).map(l=>l.trim()).join(' <- ');fails.push(n+': '+e.message.split('\n')[0]+(where?' @ '+where:''));console.error('FAIL',n,'::',e.message.split('\n').slice(0,6).join(' | '),where?'\n   at '+where:'');try{if(curPage)await curPage.screenshot({path:`${dir}/fail-${n.replace(/[^a-z0-9]+/gi,'_').slice(0,60)}.png`})}catch{}}}
async function swControlling(p){await p.evaluate(async()=>{if(!('serviceWorker' in navigator))return;await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(r=>{navigator.serviceWorker.addEventListener('controllerchange',r,{once:true});setTimeout(r,8000)})})}
try{
 for(const width of [375,390,768,1024,1440]){
  const ctx=await browser.newContext({viewport:{width,height:900}});await ctx.tracing.start({screenshots:true,snapshots:true});widthFails=0;const page=await ctx.newPage();curPage=page;page.setDefaultTimeout(10000);
  const errs=[];page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|net::ERR|Failed to load resource/.test(m.text()))errs.push('console: '+m.text())});
  await page.goto(base);await swControlling(page);
  const cctx=await browser.newContext({viewport:{width,height:900}});const cp=await cctx.newPage();cp.setDefaultTimeout(10000);await cp.goto(base);await swControlling(cp);
  const home=async()=>{if(!(await cp.locator('#homeView').isVisible())){await cp.locator('[data-back]').first().click()}await cp.waitForSelector('.cat-tile');await cp.fill('#toolSearch','')};
  const REAL=await page.evaluate(()=>tools.filter(isListed).length);
  await check(`${width} real catalogue has at least 50 listed tools`,async()=>assert.ok(REAL>=50,'listed '+REAL));
  await check(`${width} no horizontal overflow`,async()=>{const o=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert.ok(o<=0,'overflow '+o)});
  await check(`${width} no "Start with these", no featured grid, no public 51 total`,async()=>{const t=await page.locator('body').innerText();assert.ok(!/start with these/i.test(t));assert.equal(await page.locator('#featuredTools,#popular,.featured-card').count(),0);assert.ok(!/\b51\s+(tools|fast|free)/i.test(t),'51 label shown');assert.ok(/50\+\s+(?:\w+\s+){0,2}tools/i.test(t),'50+ present');const meta=await page.evaluate(()=>document.documentElement.innerHTML.match(/\b51\s+(free|tools|fast|browser)/gi));assert.equal(meta,null,'51 in markup/meta: '+meta)});
  await check(`${width} homepage shows no catalogue and has category tiles`,async()=>{assert.equal(await page.locator('#toolCatalog .toolcard').count(),0);assert.equal(await page.locator('#homeView .toolcard').count(),0);assert.equal(await page.locator('.cat-tile').count(),9)});
  await check(`${width} order: header, intro, categories, search, more, privacy`,async()=>{const y=await page.evaluate(()=>['.hero','#tools','#search','#more','#privacy','footer'].map(s=>Math.round(document.querySelector(s).getBoundingClientRect().top+scrollY)));for(let i=1;i<y.length;i++)assert.ok(y[i]>y[i-1],'order '+y);console.log('positions',width,y)});
  await check(`${width} search sits below the category tiles`,async()=>{const t=await page.evaluate(()=>[document.querySelector('#categoryGrid').getBoundingClientRect().bottom,document.querySelector('#toolSearch').getBoundingClientRect().top]);assert.ok(t[1]>t[0],'search above tiles '+t)});
  await check(`${width} search finds tool`,async()=>{await page.fill('#toolSearch','compress an image');const names=await page.locator('#toolCatalog .toolcard strong').allTextContents();assert.ok(names.length>=1&&names.length<10,'results '+names.length);assert.ok(names.some(n=>/image/i.test(n)),'image tool listed: '+names);await page.fill('#toolSearch','');assert.equal(await page.locator('#toolCatalog .toolcard').count(),0,'catalogue hidden again')});
  await check(`${width} search surfaces Learn/Labs/Play matches`,async()=>{await page.fill('#toolSearch','regex');await page.waitForSelector('#intentResults .also-hit');assert.match(await page.locator('#intentResults').innerText(),/regular expressions/i);await page.fill('#toolSearch','')});
  await check(`${width} empty search shows message`,async()=>{await page.fill('#toolSearch','zzzzqqq');assert.equal(await page.locator('#toolCatalog .toolcard').count(),0);assert.match(await page.locator('#toolCatalog').innerText(),/No matching tools/);await page.locator('#clearSearch').click();assert.equal(await page.locator('#toolCatalog .toolcard').count(),0)});
  await check(`${width} task chip fills search`,async()=>{await page.locator('.task-chip').first().click();assert.equal(await page.inputValue('#toolSearch'),'compress an image');assert.ok(await page.locator('#toolCatalog .toolcard').count()>=1);await page.fill('#toolSearch','')});
  await check(`${width} category tile opens dedicated view with URL, Back works`,async()=>{
   await cp.locator('.cat-tile[data-cat="developer"]').click();
   await cp.waitForSelector('#categoryTools .toolcard');
   assert.match(cp.url(),/\?category=developer/);
   const n=await cp.locator('#categoryTools .toolcard').count();assert.ok(n>=5,'dev tools '+n);
   assert.equal(await cp.locator('#categoryView h1').innerText(),'Developer');
   assert.equal(await cp.locator('#homeView').isVisible(),false);
   await cp.locator('[data-back]').first().click();
   await cp.waitForSelector('.cat-tile');assert.ok(!cp.url().includes('category='));assert.equal(await cp.locator('#homeView').isVisible(),true);
   await cp.locator('.cat-tile[data-cat="developer"]').click();await cp.waitForSelector('#categoryTools .toolcard');
   await cp.goBack();assert.equal(await cp.locator('#homeView').isVisible(),true);
   await cp.goForward();assert.equal(await cp.locator('#categoryTools .toolcard').count(),n);await home()});
  await check(`${width} direct category URL and invalid category`,async()=>{
   const c2=await browser.newContext({viewport:{width,height:900}});const p2=await c2.newPage();p2.setDefaultTimeout(15000);
   try{await p2.goto(base+'?category=writing-text');await p2.waitForSelector('#categoryTools .toolcard');assert.ok(await p2.locator('#categoryTools .toolcard').count()>=1);
   await p2.goto(base+'?category=nonsense');await p2.waitForSelector('.cat-tile');assert.equal(await p2.locator('#homeView').isVisible(),true)}finally{await c2.close()}});
  await check(`${width} all listed tools reachable; each belongs to exactly one category; counts consistent`,async()=>{
   await home();const seen=new Map();let total=0;
   const tiles=await cp.locator('.cat-tile').evaluateAll(e=>e.map(x=>({id:x.dataset.cat,href:x.getAttribute('href'),n:parseInt(x.querySelector('small').textContent)})));
   assert.equal(tiles.length,9);
   for(const t of tiles){assert.equal(t.href,'?category='+t.id,'tile link '+t.id);
    const r=await cctx.request.get(base+t.href);assert.ok(r.ok(),'category URL status '+t.id+' '+r.status());
    await cp.locator(`.cat-tile[data-cat="${t.id}"]`).click();await cp.waitForSelector('#categoryTools .toolcard');
    const ids=await cp.locator('#categoryTools .toolcard').evaluateAll(e=>e.map(x=>x.dataset.tool));
    assert.ok(ids.length>0,'empty '+t.id);assert.equal(new Set(ids).size,ids.length,'duplicate within '+t.id);
    assert.equal(String(ids.length),await cp.locator('#categoryView .cv-count b').innerText(),'view count '+t.id);
    assert.equal(ids.length,t.n,'tile count equals view count '+t.id);
    ids.forEach(i=>seen.set(i,[...(seen.get(i)||[]),t.id]));total+=ids.length;
    await cp.locator('[data-back]').first().click();await cp.waitForSelector('.cat-tile')}
   const multi=[...seen].filter(([,v])=>v.length!==1);assert.deepEqual(multi,[],'tools not in exactly one category');
   const listedIds=await cp.evaluate(()=>tools.filter(isListed).map(t=>t[0]));
   assert.deepEqual([...seen.keys()].sort(),listedIds.sort(),'categories cover exactly the listed catalogue');
   assert.equal(total,REAL,'category counts sum to catalogue total');
   assert.equal(tiles.reduce((a,t)=>a+t.n,0),REAL,'tile counts sum to catalogue total')});
  await check(`${width} PDF & Tables category label, description and stable URL`,async()=>{await home();
   assert.equal(await cp.locator('.cat-tile[data-cat="files-pdf"] strong').innerText(),'PDF & Tables');
   assert.equal(await cp.locator('.cat-tile[data-cat="files-pdf"]').getAttribute('href'),'?category=files-pdf');
   await cp.locator('.cat-tile[data-cat="files-pdf"]').click();await cp.waitForSelector('#categoryTools .toolcard');
   assert.equal(await cp.locator('#categoryView h1').innerText(),'PDF & Tables');
   assert.match(await cp.locator('#categoryView .cv-title p').innerText(),/Work with PDFs and spreadsheet-style tables locally\./);
   assert.deepEqual((await cp.locator('#categoryTools .toolcard').evaluateAll(e=>e.map(x=>x.dataset.tool))).sort(),['pdf-studio','table-formatter']);
   assert.ok(!/Files & PDF/.test(await cp.locator('body').innerText()));
   assert.equal(await cp.locator('#categoryTools .toolcard').filter({hasText:'Private PDF Tools'}).count(),1);
   assert.equal(await cp.locator('#categoryTools .toolcard').filter({hasText:'Markdown Table ↔ Spreadsheet Formatter'}).count(),1);
   await home()});
  await check(`${width} Prompt Improver only under AI & Prompts`,async()=>{await home();
   await cp.locator('.cat-tile[data-cat="productivity"]').click();await cp.waitForSelector('#categoryTools .toolcard');assert.equal(await cp.locator('#categoryTools .toolcard[data-tool="prompt-improver"]').count(),0);await cp.locator('[data-back]').first().click();await cp.waitForSelector('.cat-tile');
   await cp.locator('.cat-tile[data-cat="ai-prompts"]').click();await cp.waitForSelector('#categoryTools .toolcard');assert.equal(await cp.locator('#categoryTools .toolcard[data-tool="prompt-improver"]').count(),1);await home()});
  await check(`${width} category Open launches tool and close returns`,async()=>{await home();await cp.locator('.cat-tile[data-cat="developer"]').click();await cp.waitForSelector('#categoryTools .tool-open');await cp.locator('#categoryTools .tool-open').first().click();await cp.waitForSelector('#workspace.active');await cp.evaluate(()=>closeTool());assert.ok(!(await cp.locator('#workspace.active').count()));await home()});
  await check(`${width} favourites and recent persist`,async()=>{await page.fill('#toolSearch','json');await page.locator('#toolCatalog .favorite-btn').first().click();await page.fill('#toolSearch','');assert.ok(await page.locator('#discoveryShelf .shelf-label',{hasText:'Favourites'}).count());await page.reload();assert.ok(await page.locator('#discoveryShelf .shelf-label',{hasText:'Favourites'}).count());
   assert.ok(JSON.parse(await page.evaluate(()=>localStorage.getItem('it.discovery.favorites'))).length>=1)});
  await check(`${width} navigation`,async()=>{
   const toggle=page.locator('.menu-toggle');
   if(width<=860){assert.ok(await toggle.isVisible());assert.equal(await page.locator('#primaryNav').isVisible(),false);await toggle.focus();await page.keyboard.press('Enter');assert.equal(await toggle.getAttribute('aria-expanded'),'true');assert.ok(await page.locator('#primaryNav').isVisible());
    const boxes=await page.locator('#primaryNav a').evaluateAll(e=>e.map(x=>x.getBoundingClientRect().height));assert.ok(boxes.every(h=>h>=44),'tap targets '+boxes);
    await page.keyboard.press('Escape');assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert.equal(await page.evaluate(()=>document.activeElement.className),'menu-toggle')}
   else{assert.equal(await toggle.isVisible(),false);assert.ok(await page.locator('#primaryNav').isVisible())}});
  await check(`${width} touch targets >=44px`,async()=>{const bad=await page.evaluate(()=>[...document.querySelectorAll('.cat-tile,.task-chip,.nav-search,.tool-open,.favorite-btn,.pill,.skip,header .brand')].filter(e=>e.offsetParent!==null||getComputedStyle(e).position==='fixed').map(e=>{const r=e.getBoundingClientRect();return[e.className,Math.round(r.width),Math.round(r.height)]}).filter(([,w,h])=>w<44||h<44));assert.deepEqual(bad,[])});
  await check(`${width} keyboard operates category tile`,async()=>{await home();await cp.locator('.cat-tile[data-cat="writing-text"]').focus();await cp.keyboard.press('Enter');await cp.waitForSelector('#categoryTools .toolcard');await cp.waitForTimeout(150);assert.equal(await cp.evaluate(()=>document.activeElement.id),'categoryTitle');await home()});
  await check(`${width} slash shortcut focuses hero search`,async()=>{await page.locator('body').click({position:{x:2,y:300}});await page.keyboard.press('/');assert.equal(await page.evaluate(()=>document.activeElement.id),'toolSearch');assert.ok(!page.url().includes('#tools'))});
  await check(`${width} nav links and Knowledge present`,async()=>{const t=await page.locator('#primaryNav a').allTextContents();assert.deepEqual(t,['Tools','Learn','Knowledge','Labs','Play','About']);assert.equal(await page.locator('#primaryNav a[href="knowledge/"]').count(),1)});
  await check(`${width} category tiles start in first screen`,async()=>{const y=await page.evaluate(()=>Math.round(document.querySelector('.cat-tile').getBoundingClientRect().top+scrollY));console.log('first tile top',width,y);assert.ok(y<=(width>=1024?500:520),'first tile at '+y)});
  await check(`${width} privacy copy intact`,async()=>{assert.equal(await page.locator('.privacy h2').textContent(),'Your Data.Your Browser.Your Control.');assert.equal(await page.locator('.privacy-copy > p').innerText(),'GoVibeTool is designed with your privacy in mind. Our browser-based tools process your files and information directly on your device, giving you greater control over your data. Our tools also work without an internet connection, and no account is required.');assert.equal(await page.locator('h1').count(),1)});
  await check(`${width} no page errors`,async()=>assert.deepEqual(errs,[]));
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(300);await page.screenshot({path:`${dir}/home-${width}.png`,fullPage:false});
  if(width===375){await page.locator('.menu-toggle').click();await page.screenshot({path:`${dir}/menu-open-375.png`});}
  if(width===1440||width===390){await page.locator('.cat-tile[data-cat="ai-prompts"]').click();await page.waitForTimeout(400);await page.screenshot({path:`${dir}/category-ai-prompts-${width}.png`});}
  await cctx.close();await ctx.tracing.stop(widthFails?{path:`${dir}/trace-${width}.zip`}:undefined);await ctx.close();
 }
 const ctx=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});const page=await ctx.newPage();await page.goto(base);
 await check('reduced motion disables transitions',async()=>assert.equal(await page.locator('.cat-tile').first().evaluate(e=>getComputedStyle(e).transitionDuration),'0s'));
 await page.screenshot({path:`${dir}/home-full-1440.png`,fullPage:true});
}finally{await browser.close();server.close()}
console.log(`${engine}: ${passed} passed, ${fails.length} failed`);
if(fails.length){console.error(fails.join('\n'));process.exit(1)}
