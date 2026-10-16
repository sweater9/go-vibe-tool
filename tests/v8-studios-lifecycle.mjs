/* DOM interaction regressions for the URL, QR and Privacy Studios. npm install --no-save jsdom@26.1.0; never fetches user content. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const {JSDOM}=await import(process.env.JSDOM_PACKAGE || 'jsdom');
const DEFAULT_URL='https://example.com/page?utm_source=newsletter&ref=keep';
async function fixture({standalone=false,lateWorkspace=false,studio='url'}={}) {
 const html=standalone?'<main class="studio-page"></main>':fs.readFileSync('index.html','utf8');
 const dom=new JSDOM(html,{url:'https://example.test/'+(standalone?'studios.html?studio='+studio:'?category=links-web'),runScripts:'outside-only'});
 const w=dom.window;w.HTMLElement.prototype.scrollIntoView=function(){};w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){}});
 const errors=[];w.addEventListener('error',e=>errors.push(e.error?.message||e.message));
 if(standalone&&!lateWorkspace)w.document.querySelector('main').innerHTML='<div id="workspace" class="workspace" tabindex="-1"></div>';
 w.eval(['tools.js','v2-tools.js','v21-tools.js','studios-core.js','studios.js','studios-routing.js'].map(file=>fs.readFileSync(file.startsWith('studios') && process.env.STUDIOS_SOURCE_ROOT ? process.env.STUDIOS_SOURCE_ROOT+'/'+file : file,'utf8')).join('\n;\n'));
 if(lateWorkspace)w.document.querySelector('main').innerHTML='<div id="workspace" class="workspace" tabindex="-1"></div>';
 await new Promise(r=>setTimeout(r,0));
 const get=id=>w.document.getElementById(id);
 const input=(id,value)=>{get(id).value=value;get(id).dispatchEvent(new w.Event('input',{bubbles:true}));};
 const change=(id,value)=>{get(id).value=value;get(id).dispatchEvent(new w.Event('change',{bubbles:true}));};
 return {w,get,input,change,errors,close:()=>dom.window.close()};
}
test('standalone initialization waits for the workspace and binds once after DOM ready',async()=>{
 const f=await fixture({standalone:true,lateWorkspace:true});try{
  assert.equal(f.get('studio-url').hidden,false);f.get('urlAnalyze').click();assert.match(f.get('urlResult').textContent,/Clean URL: https:\/\/example\.com\/page\?ref=keep/);
  f.input('urlInput','https://example.org/typed');f.w.document.dispatchEvent(new f.w.Event('DOMContentLoaded'));
  assert.equal(f.get('urlInput').value,'https://example.org/typed');assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
test('standalone deep links select the requested Studio, its panel and title',async()=>{
 for(const studio of ['url','qr','privacy']){
  const f=await fixture({standalone:true,studio});try{
   const titles=f.w.GVTStudios.titles;
   assert.equal(f.w.document.querySelector('[role=tab][aria-selected=true]').dataset.studio,studio);
   assert.deepEqual([...f.w.document.querySelectorAll('[role=tabpanel]')].filter(p=>!p.hidden).map(p=>p.id),['studio-'+studio]);
   assert.equal(f.get('studioTitle').textContent,titles[studio]);assert.deepEqual(f.errors,[]);
  }finally{f.close();}
 }
});
test('reopening a Studio alias preserves the live DOM, inputs, results, handlers, and category query',async()=>{
 const f=await fixture();try{
  f.w.openTool('url-cleaner');const old=f.get('studioRoot');f.input('urlInput','https://example.com/a?utm_source=x&keep=1');f.get('urlAnalyze').click();const result=f.get('urlResult').textContent;
  assert.match(result,/Clean URL: https:\/\/example\.com\/a\?keep=1/);
  f.w.openTool('qr-studio');assert.equal(f.get('studioRoot'),old);assert.equal(f.get('studio-qr').hidden,false);assert.equal(f.get('studio-url').hidden,true);
  f.w.openTool('url-cleaner');assert.equal(f.get('studioRoot'),old);assert.equal(f.get('urlInput').value,'https://example.com/a?utm_source=x&keep=1');assert.equal(f.get('urlResult').textContent,result);
  f.get('urlAnalyze').click();assert.match(f.get('urlResult').textContent,/Removed trackers: utm_source/);
  f.w.openTool('metadata');assert.equal(f.get('piiMode').value,'audit');assert.equal(f.get('studioRoot'),old);
  assert.equal(new URL(f.w.location.href).searchParams.get('category'),'links-web');assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
test('fresh QR mounts reset the retained shared mode and fields; close removes sensitive inputs',async()=>{
 const f=await fixture();try{
  f.w.openTool('qr-studio');f.get('qrType').value='wifi';f.get('qrType').dispatchEvent(new f.w.Event('change'));f.input('qrWifiPass','private-password');
  f.w.closeTool();assert.equal(f.get('studioRoot'),null);assert.equal(f.get('qrWifiPass'),null);
  f.w.openTool('link-fingerprint');assert.equal(f.get('qrType').value,'url');assert.ok(f.get('qrUrl'));assert.equal(f.get('qrSSID'),null);
  f.get('studio-tab-qr').click();assert.equal(f.get('studio-qr').hidden,false);
  f.get('studio-tab-url').click();f.get('urlAnalyze').click();assert.match(f.get('urlResult').textContent,/Host: example\.com/);assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
test('URL results invalidate on edits; invalid and oversized input produce explicit finite error states',async()=>{
 const f=await fixture();try{
  f.w.openTool('url-cleaner');f.get('urlAnalyze').click();assert.match(f.get('urlResult').textContent,/Removed trackers: utm_source/);
  f.input('urlInput','https://example.com/changed');assert.equal(f.get('urlResult').textContent,'Input changed; inspect or build again.');
  f.get('urlCopy').click();assert.equal(f.get('urlResult').textContent,'Inspect or build a URL first.');
  for(const bad of ['javascript:alert(1)','not a URL','']){f.input('urlInput',bad);f.get('urlAnalyze').click();assert.match(f.get('urlResult').textContent,/^Invalid URL: /,JSON.stringify(bad));}
  f.input('urlInput','https://example.com/?'+'a'.repeat(100000));f.get('urlAnalyze').click();
  assert.match(f.get('urlResult').textContent,/Maximum 100,000 characters/);assert.doesNotMatch(f.get('urlResult').textContent,/Infinity|NaN|undefined/);
  f.input('urlInput','https://example.com/p?x=1');f.input('utmSource','news');f.get('urlUtm').click();
  assert.equal(f.get('urlResult').textContent,'Campaign URL:\nhttps://example.com/p?x=1&utm_source=news&utm_medium=email&utm_campaign=launch');
  f.input('utmSource','');f.input('urlInput','ftp://example.com');f.get('urlUtm').click();assert.match(f.get('urlResult').textContent,/HTTP/);assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
test('Privacy previews invalidate on edits and option changes; Apply and Copy need a current preview',async()=>{
 const f=await fixture();try{
  f.w.openTool('pii-secret-redactor');assert.equal(f.get('piiMode').value,'redact');
  const source='mail jane@example.com call +1 415 555 0100 password=hunter2hunter2';
  f.input('redactInput',source);f.w.copyRedacted();assert.equal(f.get('redactSummary').textContent,'Run Auto-Redact to create a current preview before copying.');
  f.get('piiApply').click();assert.equal(f.get('redactSummary').textContent,'Create a current Auto-Redact preview first.');assert.equal(f.get('redactInput').value,source);
  f.change('piiMode','audit');f.w.runRedactor();
  assert.match(f.get('redactSummary').textContent,/Audit Only/);assert.match(f.get('redactSummary').textContent,/Email: 1/);assert.equal(f.get('redactOutput').textContent,source);
  f.change('piiMode','redact');assert.equal(f.get('redactSummary').textContent,'Input or options changed; analyze again.');assert.equal(f.get('redactOutput').textContent,'');
  const phone=f.w.document.querySelector('[data-pii=phone]');phone.checked=false;phone.dispatchEvent(new f.w.Event('change',{bubbles:true}));f.w.runRedactor();
  const redacted=f.get('redactOutput').textContent;
  assert.match(redacted,/\[EMAIL_REDACTED\]/);assert.match(redacted,/\[API_KEY_REDACTED\]/);assert.ok(redacted.includes('415 555 0100'),'unchecked category must stay');assert.ok(!redacted.includes('hunter2hunter2'));
  f.get('piiApply').click();assert.equal(f.get('redactInput').value,redacted);assert.equal(f.get('redactSummary').textContent,'Input or options changed; analyze again.');
  f.w.runRedactor();f.input('redactInput','edited after preview');assert.equal(f.get('redactOutput').textContent,'');f.get('piiApply').click();assert.equal(f.get('redactInput').value,'edited after preview');
  assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
test('leaving for a legacy tool and reopening does not carry Studio state or duplicate bindings',async()=>{
 const f=await fixture();try{
  f.w.openTool('url-cleaner');f.input('urlInput','https://example.com/leaving');f.get('urlAnalyze').click();f.w.openTool('base64');assert.equal(f.get('studioRoot'),null);assert.equal(f.get('urlInput'),null);
  f.w.openTool('url-cleaner');assert.equal(f.get('urlInput').value,DEFAULT_URL);assert.equal(f.get('urlResult').textContent,'Enter a link to inspect.');
  f.get('studio-tab-privacy').click();assert.equal(f.get('studio-privacy').hidden,false);assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
test('the Studio exposes exactly the URL, QR and Privacy tabs and panels, with consistent ARIA and keyboard navigation',async()=>{
 const f=await fixture();try{
  f.w.openTool('link-fingerprint');const doc=f.w.document,titles=f.w.GVTStudios.titles;
  const tabs=[...doc.querySelectorAll('#studioRoot [role=tab]')],panels=[...doc.querySelectorAll('#studioRoot [role=tabpanel]')];
  assert.deepEqual(tabs.map(t=>t.dataset.studio),['url','qr','privacy']);assert.deepEqual(panels.map(p=>p.id),['studio-url','studio-qr','studio-privacy']);
  assert.equal(doc.querySelectorAll('#studioRoot [role=tablist]').length,1);
  for(const t of tabs){assert.equal(t.getAttribute('aria-controls'),'studio-'+t.dataset.studio);assert.equal(doc.getElementById('studio-'+t.dataset.studio).getAttribute('aria-labelledby'),t.id);}
  const expectSelected=studio=>{
   assert.deepEqual(tabs.filter(t=>t.getAttribute('aria-selected')==='true').map(t=>t.dataset.studio),[studio]);
   assert.deepEqual(tabs.filter(t=>t.tabIndex===0).map(t=>t.dataset.studio),[studio],'roving tabindex');
   assert.deepEqual(panels.filter(p=>!p.hidden).map(p=>p.id),['studio-'+studio]);
   assert.equal(f.get('studioTitle').textContent,titles[studio]);assert.equal(doc.activeElement.dataset.studio,studio,'focus follows selection');
   assert.equal(new URL(f.w.location.href).searchParams.get('studio'),studio);
  };
  tabs[0].focus();
  for(const [key,expected] of [['ArrowRight','qr'],['ArrowRight','privacy'],['ArrowRight','url'],['ArrowLeft','privacy'],['Home','url'],['End','privacy'],['ArrowLeft','qr']]){
   doc.activeElement.dispatchEvent(new f.w.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));expectSelected(expected);
  }
  assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
test('QR validation follows the selected type and input; a blank payload is refused before the engine runs',async()=>{
 const f=await fixture();try{
  f.w.openTool('qr-studio');assert.match(f.get('qrValidation').textContent,/Plain text and HTTP\(S\) links can be encoded/);
  f.input('qrUrl','https://example.com/ok');assert.equal(f.get('qrValidation').textContent,'Valid HTTP(S) URL payload.');
  f.input('qrUrl','not a url');assert.match(f.get('qrValidation').textContent,/^Warning: malformed URL/);
  f.input('qrUrl','   ');assert.equal(f.get('qrValidation').textContent,'Enter text or a URL.');f.w.generateQR();assert.equal(f.get('out').textContent,'');
  f.change('qrType','text');f.input('qrText','hello ✓');assert.match(f.get('qrValidation').textContent,/Plain-text payload/);
  f.input('qrText','https://');assert.match(f.get('qrValidation').textContent,/^Warning/);
  f.change('qrType','wifi');f.input('qrSSID','Home');assert.match(f.get('qrValidation').textContent,/Plain-text payload/);
  f.change('qrType','contact');assert.ok(f.get('qrName'));assert.equal(f.get('qrSSID'),null);assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
test('stored favourites and recents missing from the catalogue are ignored without errors and left in storage',async()=>{
 const f=await fixture();try{
  const favourites=['url-cleaner','retired-tool-fixture','qr-payload'];
  f.w.localStorage.setItem('it.discovery.favorites',JSON.stringify(favourites));f.w.localStorage.setItem('it.discovery.recent',JSON.stringify(['retired-tool-fixture','metadata']));
  f.w.renderDiscoveryShelf();const shelf=f.get('discoveryShelf').textContent;
  for(const name of ['URL Cleaner','QR Payload Validator','Text Metadata Check'])assert.ok(shelf.includes(name),name);assert.ok(!shelf.includes('retired-tool-fixture'));
  f.w.openTool('qr-studio');const recent=JSON.parse(f.w.localStorage.getItem('it.discovery.recent'));
  assert.equal(recent[0],'qr-studio');assert.ok(recent.includes('metadata'));
  assert.deepEqual(JSON.parse(f.w.localStorage.getItem('it.discovery.favorites')),favourites);assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
