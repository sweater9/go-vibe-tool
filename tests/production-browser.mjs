import { chromium, firefox, webkit } from 'playwright';
import fs from 'node:fs/promises';
const base='https://intellitools.online';
const queries=['What is an LLM?','How do AI agents work?','Python programming','Machine learning','How do I build an AI workflow?'];
const browsers={chromium,firefox,webkit};
const engine=process.argv[2]||'chromium';
if(!browsers[engine]) throw new Error('Unknown browser: '+engine);
const browser=await browsers[engine].launch({headless:true});
const issues=[];
const output=[];
try {
 for(const width of [1280,375]){
  const page=await browser.newPage({viewport:{width,height:900}});
  page.on('pageerror',e=>issues.push(engine+' '+width+' JS: '+e.message));
  page.on('console',m=>{if(m.type()==='error')issues.push(engine+' '+width+' console: '+m.text())});
  page.on('requestfailed',r=>{ const reason=r.failure()?.errorText || ''; const url=new URL(r.url()); if(engine==='firefox' && reason==='NS_BINDING_ABORTED' && url.origin===base && url.pathname==='/assets/icon.svg') return; issues.push(engine+' '+width+' request: '+r.url()+' '+reason); });
  const response=await page.goto(base+'/knowledge/',{waitUntil:'domcontentloaded',timeout:45000});
  if(!response?.ok())throw new Error('Knowledge HTTP '+response?.status());
  for(const query of queries){
   await page.locator('#kn-q').fill(query);
   await page.waitForTimeout(1100);
   const links=page.locator('#kn-search-results a[href]');
   const count=await links.count();
   if(!count)throw new Error(engine+' '+width+' no result link for '+query);
   const href=await links.first().getAttribute('href');
   const dest=new URL(href,page.url()).href;
   const article=await page.goto(dest,{waitUntil:'domcontentloaded',timeout:45000});
   if(!article?.ok())throw new Error('Article HTTP '+article?.status()+' '+dest);
   await page.goto(base+'/knowledge/',{waitUntil:'domcontentloaded'});
   output.push({engine,width,query,result:dest});
  }
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
  if(overflow)issues.push(engine+' '+width+' horizontal overflow');
  await page.screenshot({path:'artifacts/'+engine+'-'+width+'.png',fullPage:false});
  await page.close();
 }
 const home=await browser.newPage();
 const response=await home.goto(base+'/',{waitUntil:'domcontentloaded',timeout:45000});
 if(!response?.ok())throw new Error('Homepage HTTP '+response?.status());
 for(const id of ['ai-prompt-builder','password-generator','json-formatter']){
  const r=await home.goto(base+'/?tool='+id,{waitUntil:'domcontentloaded',timeout:45000});
  if(!r?.ok())throw new Error('Tool HTTP '+r?.status()+' '+id);
  await home.waitForTimeout(900);
  const text=(await home.locator('body').innerText()).toLowerCase();
  if(!text.includes(id.replaceAll('-',' ').split(' ')[0]))issues.push('Tool content uncertain: '+id);
  output.push({engine,tool:id,opened:true});
 }
 await home.close();
}finally{await browser.close();await fs.writeFile('artifacts/'+engine+'.json',JSON.stringify({output,issues},null,2));}
console.log(JSON.stringify({engine,checks:output.length,issues},null,2));
if(issues.length)process.exitCode=1;
