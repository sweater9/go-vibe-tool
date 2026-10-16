import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,createWriteStream} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createPreviewServer} from './serve-preview.mjs';
const engine=process.argv[2]||'chromium',root=resolve(process.env.PREVIEW_ROOT||'preview'),site=resolve(process.env.SITE_DIR||'site'),out=resolve(process.env.QA_OUT||'artifacts/prefix-'+engine);
mkdirSync(out,{recursive:true});
const pw=await import(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const {dailyAnswer,evaluateGuess}=await import(pathToFileURL(join(site,'play/daily-word/engine.mjs')));
const {ANSWERS}=await import(pathToFileURL(join(site,'play/daily-word/words.mjs')));
const svc=createPreviewServer(root),origin=await svc.start(),base=origin+svc.manifest.prefix,results=[];
let browser;
function report(name,status,extra={}){results.push({name,status,...extra});console.log(status.toUpperCase(),name);}
async function childSuite(){
 const file=createWriteStream(join(out,'original-play-games-prefix.log'));
 const child=spawn(process.execPath,[join(site,'tests/play-games-browser.mjs'),engine],{cwd:site,env:{...process.env,PLAY_BASE_URL:base,PLAY_ARTIFACTS:join(out,'full-play-prefix')},stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',b=>{file.write(b);process.stdout.write(b);});child.stderr.on('data',b=>{file.write(b);process.stderr.write(b);});
 const code=await new Promise((r,j)=>{child.on('error',j);child.on('close',r);});file.end();assert.equal(code,0,'Original target-commit Play acceptance suite must pass under the preview prefix');
}
async function screenshot(page,name){await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';document.activeElement?.blur();scrollTo({top:0,left:0,behavior:'instant'});});await page.waitForFunction(()=>scrollY===0);await page.screenshot({path:join(out,name+'.png'),fullPage:true});}
async function controlled(page){await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));});}
async function noOverflow(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');}
try{
 // Prove content identity from served bytes, not just a displayed commit marker.
 const manifest=await fetch(origin+'/preview-provenance.json').then(r=>r.json());assert.equal(manifest.resolvedCommit,'f6685bff58ae91f835b41963239cda2355c8554c');assert.equal(manifest.tree,'57754c128de33e3fe0e3a6c8e145bd4afccc3650');
 const sw=readFileSync(join(root,'.'+manifest.prefix,'sw.js'),'utf8'),assets=JSON.parse(sw.match(/const ASSETS=(\[[\s\S]*?\]);/)[1]);
 const files=new Map(manifest.files.map(f=>[f.path,f]));const checked=[];
 for(const route of [...assets,'./play/2048/','./play/daily-word/','./assets/icon-maskable-512.png']){
  const url=new URL(route,base),path=url.pathname.slice(manifest.prefix.length)||'index.html',file=files.get(path.endsWith('/')?path+'index.html':path);
  assert.ok(url.pathname.startsWith(manifest.prefix),'Asset escapes preview prefix: '+route);assert.ok(file,'Manifest entry: '+route);
  const response=await fetch(url);assert.equal(response.status,200,route);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,'Served file matches exact target: '+route);checked.push(route);
 }
 assert.equal((await fetch(origin+'/play/2048/')).status,404,'No root-path alias may mask broken relative links');
 assert.equal((await fetch(origin+'/')).status,404,'Preview is isolated under its prefix');
 writeFileSync(join(out,'served-commit.json'),JSON.stringify({requestedCommit:manifest.requestedCommit,resolvedCommit:manifest.resolvedCommit,tree:manifest.tree,prefix:manifest.prefix,verifiedAssets:checked,publicPreviewUrl:null},null,2));report('served target commit and all precache assets match Git blob-derived checksums','pass');
 await childSuite();report('original target Play acceptance suite under project path','pass');
 browser=await pw[engine].launch({headless:true});
 for(const width of [1280,375]){
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width===375,timezoneId:'UTC'});
  await context.addInitScript(()=>{const R=Date,F=new R('2026-10-12T12:00:00Z').getTime();class D extends R{constructor(...a){a.length?super(...a):super(F);}static now(){return F;}}window.Date=D;Math.random=()=>0;});
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==origin&&/^https?:/.test(u.protocol))return route.fulfill({status:204,contentType:'text/javascript',body:''});return route.continue();});
  await context.tracing.start({screenshots:true,snapshots:true});const page=await context.newPage();page.setDefaultTimeout(20000);let phase='online',failed=false;const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>{if(phase==='online'&&new URL(r.url()).origin===origin)requests.push(r.url()+': '+r.failure()?.errorText);});page.on('response',r=>{if(phase==='online'&&new URL(r.url()).origin===origin&&r.status()>=400)requests.push(r.status()+' '+r.url());});
  try{
   await page.goto(base);await controlled(page);await page.waitForSelector('.cat-tile');assert.equal(await page.locator('.cat-tile').count(),9);await noOverflow(page);
   if(width===375){await page.locator('.menu-toggle').click();assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'true');assert.ok(await page.locator('#primaryNav a[href="play/"]').isVisible());await page.locator('.menu-toggle').click();}
   await screenshot(page,'home-'+width);
   await page.locator('.cat-tile[data-cat="developer"]').click();await page.waitForSelector('#categoryTools .toolcard');assert.ok(page.url().startsWith(base+'?category=developer'));assert.ok(await page.locator('#categoryTools .toolcard').count()>=5);await page.goBack();await page.waitForSelector('.cat-tile');
   // Every main pillar link remains inside the nested preview and loads its assets.
   for(const route of ['learn/','knowledge/','labs/','play/']){const r=await page.goto(base+route,{waitUntil:'domcontentloaded'});assert.equal(r.status(),200);assert.ok(page.url().startsWith(base));await noOverflow(page);}
   assert.equal(await page.locator('.hero-stats strong').first().innerText(),'4','Frozen pre-Mahjong target has four games');
   assert.deepEqual(await page.locator('.v5-card a.btn').evaluateAll(as=>as.map(a=>a.getAttribute('href'))),['daily/','word-logic/','2048/','daily-word/']);await screenshot(page,'play-hub-'+width);
   await page.locator('a[href="2048/"]').click();await page.waitForSelector('.g2048-tile');assert.equal(await page.locator('.g2048-cell').count(),16);await noOverflow(page);
   await page.evaluate(()=>localStorage.setItem('it_play_2048_state',JSON.stringify({v:[[2,2,4,4],[0,0,0,0],[0,0,0,0],[0,0,0,0]],s:0,w:false})));await page.reload();await page.waitForSelector('.g2048-tile');await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('#score').innerText(),'12');await page.locator('#btnUndo').click();assert.equal(await page.locator('#score').innerText(),'0');await screenshot(page,'2048-'+width);
   await page.goto(base+'play/daily-word/');await page.waitForSelector('.gw-tile');await noOverflow(page);const answer=dailyAnswer('2026-10-12',ANSWERS);
   for(const ch of answer)await page.keyboard.press(ch);await page.keyboard.press('Enter');await page.waitForSelector('#dlgStats[open]');assert.match(await page.locator('#resultLine').innerText(),/Solved in 1 of 6/);assert.deepEqual(await page.locator('.gw-row').first().locator('.gw-tile').evaluateAll(ts=>ts.map(t=>t.classList.contains('correct'))),Array(5).fill(true));await page.keyboard.press('Escape');await screenshot(page,'daily-word-'+width);
   const registration=await page.evaluate(async()=>{const r=await navigator.serviceWorker.ready;return {scope:r.scope,script:r.active.scriptURL};});assert.equal(registration.scope,base);assert.equal(registration.script,base+'sw.js');
   await page.waitForFunction(async prefix=>{const ns=await caches.keys();for(const name of ns){const c=await caches.open(name);const paths=(await c.keys()).map(r=>new URL(r.url).pathname);if(['play/index.html','play/2048/index.html','play/daily-word/index.html','play/daily-word/words.js','play/games.css'].every(p=>paths.includes(prefix+p)))return true;}return false;},manifest.prefix);
   const cachePaths=await page.evaluate(async()=>{const paths=[];for(const n of await caches.keys())for(const r of await (await caches.open(n)).keys())paths.push(new URL(r.url).pathname);return paths;});assert.ok(cachePaths.length>20);assert.ok(cachePaths.every(p=>p.startsWith(manifest.prefix)),'Service-worker cache stays inside preview path');
   report(engine+' '+width+'px navigation, assets, game controls, exact scoped worker','pass',{worker:registration,cacheEntries:cachePaths.length});
   await page.evaluate(()=>{localStorage.setItem('it_play_2048_state',JSON.stringify({v:[[2,2,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],s:0,w:false}));localStorage.removeItem('it_play_dailyword_practice');});
   phase='offline';await svc.stop();
   try{
    await page.goto(base+'play/',{waitUntil:'domcontentloaded'});assert.equal(await page.locator('.v5-card').count(),4);await noOverflow(page);
    await page.goto(base+'play/2048/',{waitUntil:'domcontentloaded'});await page.waitForSelector('.g2048-tile');await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('#score').innerText(),'4');await screenshot(page,'offline-2048-'+width);
    await page.goto(base+'play/daily-word/',{waitUntil:'domcontentloaded'});await page.waitForSelector('.gw-tile');await page.locator('#modePractice').click();for(const ch of 'crane')await page.keyboard.press(ch);await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelectorAll('.gw-tile.absent,.gw-tile.present,.gw-tile.correct').length>=5);await screenshot(page,'offline-word-'+width);
    await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForSelector('.cat-tile');assert.equal(await page.locator('.cat-tile').count(),9);await noOverflow(page);
   }finally{await svc.start();phase='online';}
   assert.deepEqual(errors,[],'No page JavaScript errors');assert.deepEqual(requests,[],'No unexpected same-origin network errors');report(engine+' '+width+'px offline home/Play/2048/Daily Word with the origin server stopped','pass');
  }catch(e){failed=true;report(engine+' '+width+'px prefix acceptance','fail',{error:e.stack});await screenshot(page,'failure-'+width).catch(()=>{});process.exitCode=1;}
  finally{await context.tracing.stop(failed?{path:join(out,'failure-'+width+'.zip')}:undefined);await context.close();}
 }
}catch(e){report('prefix test runner','fail',{error:e.stack});process.exitCode=1;}
finally{await browser?.close();svc.close();writeFileSync(join(out,'results.json'),JSON.stringify({engine,targetCommit:svc.manifest.resolvedCommit,tree:svc.manifest.tree,basePath:svc.manifest.prefix,publicPreviewUrl:null,results},null,2));console.log(JSON.stringify(results,null,2));}
