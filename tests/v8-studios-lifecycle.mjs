/* DOM interaction regressions. npm install --no-save jsdom@26.1.0; never fetches user content. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const {JSDOM}=await import(process.env.JSDOM_PACKAGE || 'jsdom');
async function fixture({standalone=false,lateWorkspace=false}={}) {
 const html=standalone?'<main class="studio-page"></main>':fs.readFileSync('index.html','utf8');
 const dom=new JSDOM(html,{url:'https://example.test/'+(standalone?'studios.html?studio=freelance':'?category=business-finance'),runScripts:'outside-only'});
 const w=dom.window;w.HTMLElement.prototype.scrollIntoView=function(){};w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){}});
 const errors=[];w.addEventListener('error',e=>errors.push(e.error?.message||e.message));
 if(standalone&&!lateWorkspace)w.document.querySelector('main').innerHTML='<div id="workspace" class="workspace" tabindex="-1"></div>';
 w.eval(['tools.js','v2-tools.js','v21-tools.js','studios-core.js','studios.js','studios-routing.js'].map(file=>fs.readFileSync(file.startsWith('studios') && process.env.STUDIOS_SOURCE_ROOT ? process.env.STUDIOS_SOURCE_ROOT+'/'+file : file,'utf8')).join('\n;\n'));
 if(lateWorkspace)w.document.querySelector('main').innerHTML='<div id="workspace" class="workspace" tabindex="-1"></div>';
 await new Promise(r=>setTimeout(r,0));
 const get=id=>w.document.getElementById(id);
 const input=(id,value)=>{get(id).value=value;get(id).dispatchEvent(new w.Event('input',{bubbles:true}));};
 return {w,get,input,errors,close:()=>dom.window.close()};
}
test('standalone initialization waits for the workspace and binds once after DOM ready',async()=>{
 const f=await fixture({standalone:true,lateWorkspace:true});try{
  assert.equal(f.get('studio-freelance').hidden,false);f.get('calcRate').click();assert.match(f.get('rateResult').textContent,/113\.12/);
  f.input('target','123456');f.w.document.dispatchEvent(new f.w.Event('DOMContentLoaded'));
  assert.equal(f.get('target').value,'123456');assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
test('reopening a Studio alias preserves the live DOM, inputs, handlers, and category query',async()=>{
 const f=await fixture();try{
  f.w.openTool('hourly-rate');const old=f.get('studioRoot');f.input('target','120000');f.get('calcRate').click();const quote=f.get('rateResult').textContent;
  f.w.openTool('url-cleaner');assert.equal(f.get('studioRoot'),old);assert.equal(f.get('studio-url').hidden,false);
  f.w.openTool('hourly-rate');assert.equal(f.get('target').value,'120000');assert.equal(f.get('rateResult').textContent,quote);
  f.get('calcRate').click();assert.match(f.get('rateResult').textContent,/Quote:/);
  f.w.openTool('metadata');assert.equal(f.get('piiMode').value,'audit');assert.equal(f.get('studioRoot'),old);
  assert.equal(new URL(f.w.location.href).searchParams.get('category'),'business-finance');assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
test('fresh QR mounts reset the retained shared mode and fields; close removes sensitive inputs',async()=>{
 const f=await fixture();try{
  f.w.openTool('qr-studio');f.get('qrType').value='wifi';f.get('qrType').dispatchEvent(new f.w.Event('change'));f.input('qrWifiPass','private-password');
  f.w.closeTool();assert.equal(f.get('studioRoot'),null);assert.equal(f.get('qrWifiPass'),null);
  f.w.openTool('hourly-rate');assert.equal(f.get('qrType').value,'url');assert.ok(f.get('qrUrl'));assert.equal(f.get('qrSSID'),null);
  f.get('studio-tab-qr').click();assert.equal(f.get('studio-qr').hidden,false);
  f.get('studio-tab-freelance').click();f.get('calcRate').click();assert.match(f.get('rateResult').textContent,/113\.12/);assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
test('calculator results invalidate on edits; empty and extreme assumptions produce finite error states',async()=>{
 const f=await fixture();try{
  f.w.openTool('hourly-rate');f.get('calcRate').click();assert.match(f.get('rateResult').textContent,/Quote: 2262\./);
  f.input('target','');assert.match(f.get('rateResult').textContent,/calculate again/);f.get('calcRate').click();assert.match(f.get('rateResult').textContent,/every numeric/);
  f.input('target','100000');f.input('hours','1e-300');f.input('weeks','1e-300');f.get('calcRate').click();assert.match(f.get('rateResult').textContent,/calculation range/);assert.doesNotMatch(f.get('rateResult').textContent,/Infinity|NaN/);
  f.get('calcEffective').click();assert.match(f.get('effectiveResult').textContent,/90\.00/);f.input('hrBill','0');assert.match(f.get('effectiveResult').textContent,/calculate again/);
  f.input('hrUnpaid','0');f.get('calcEffective').click();assert.match(f.get('effectiveResult').textContent,/Undefined from zero hours/);
  assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
test('leaving for a legacy tool and reopening does not carry Studio state or duplicate bindings',async()=>{
 const f=await fixture();try{
  f.w.openTool('hourly-rate');f.input('target','50000');f.w.openTool('base64');assert.equal(f.get('studioRoot'),null);
  f.w.openTool('hourly-rate');assert.equal(f.get('target').value,'100000');f.get('studio-tab-privacy').click();assert.equal(f.get('studio-privacy').hidden,false);assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
