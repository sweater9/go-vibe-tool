import assert from 'node:assert/strict';
import test from 'node:test';
import {recordStudioInteractions,createStudioRecorder} from './helpers/studio-interaction-recorder.mjs';
const {JSDOM}=await import(process.env.JSDOM_PACKAGE||'jsdom');

test('recorder captures pointer-to-analysis ordering and observed tab/result changes without input secrets or result text',async()=>{
 const dom=new JSDOM('<div id="workspace" class="active"><div id="studioRoot"><button data-studio="url" role="tab" aria-selected="true">URL</button><button data-studio="qr" role="tab" aria-selected="false">QR</button><button id="urlAnalyze">Inspect</button><button id="urlUtm">UTM</button><div id="urlResult">Enter a link to inspect.</div><input id="password" value="fixture-secret-never-record"></div></div>',{url:'https://example.test/studios?token=fixture-secret-never-record',runScripts:'outside-only'});
 const w=dom.window,events=[];w.__gvtStudioDiagnosticEvent=event=>{events.push(event);return Promise.resolve();};
 w.eval('('+recordStudioInteractions.toString()+')()');
 const output='Scheme: https:\nHost: fixture-host-never-record.example';
 const button=w.document.getElementById('urlAnalyze');button.onclick=()=>{w.document.getElementById('urlResult').textContent=output;};
 for(const type of ['pointerdown','pointerup','click'])button.dispatchEvent(new w.MouseEvent(type,{bubbles:true,clientX:5,clientY:8}));
 const tabs=w.document.querySelectorAll('[role=tab]');tabs[0].setAttribute('aria-selected','false');tabs[1].setAttribute('aria-selected','true');
 await w.__gvtFlushStudioDiagnostics();
 const kinds=events.map(event=>event.type);
 for(const type of ['pointerdown','pointerup','click','analysis-request','analysis-complete','analysis-result','tab-selection'])assert.ok(kinds.includes(type),type);
 assert.ok(kinds.indexOf('pointerdown')<kinds.indexOf('pointerup'));assert.ok(kinds.indexOf('pointerup')<kinds.indexOf('click'));assert.ok(kinds.indexOf('analysis-request')<kinds.indexOf('analysis-complete'));
 const complete=events.find(event=>event.type==='analysis-complete');assert.equal(complete.control,'urlAnalyze');assert.equal(complete.resultState,'inspected');assert.equal(complete.resultLength,output.length);
 assert.equal(events.find(event=>event.type==='analysis-result').resultState,'inspected');assert.equal(events.find(event=>event.type==='tab-selection').selectedTab,'qr');
 assert.equal(events.find(event=>event.type==='pointerdown').target.buttonId,'urlAnalyze');assert.ok(events.every(event=>event.path==='/studios'));
 assert.ok(!JSON.stringify(events).includes('fixture-secret-never-record'));assert.ok(!JSON.stringify(events).includes('fixture-host-never-record'),'result text is summarised, not recorded');
 dom.window.close();
});
test('recorder classifies URL Studio result states without recording their text',async()=>{
 const dom=new JSDOM('<div id="workspace" class="active"><div id="studioRoot"><button id="urlAnalyze">Inspect</button><div id="urlResult"></div></div></div>',{url:'https://example.test/studios',runScripts:'outside-only'});
 const w=dom.window,events=[];w.__gvtStudioDiagnosticEvent=event=>{events.push(event);return Promise.resolve();};
 w.eval('('+recordStudioInteractions.toString()+')()');
 const expected=[['Enter a link to inspect.','initial'],['Input changed; inspect or build again.','invalidated'],['Inspect or build a URL first.','refused'],['Scheme: https:\nHost: example.com','inspected'],['Campaign URL:\nhttps://example.com/?utm_source=a','built'],['Invalid URL: Only HTTP and HTTPS links are supported.','error'],['Unsupported UTM field.','error'],['','empty'],['something unexpected','other']];
 for(const [text,state] of expected){
  events.length=0;w.document.getElementById('urlResult').textContent=text;await w.__gvtFlushStudioDiagnostics();
  const seen=events.filter(event=>event.type==='analysis-result');
  if(text===''){assert.ok(seen.length===0||seen.every(event=>event.resultState===state),'empty');continue;}
  assert.ok(seen.length>0,text);assert.equal(seen.at(-1).resultState,state,text);assert.equal(seen.at(-1).resultLength,text.length);assert.ok(!JSON.stringify(seen).includes('example.com'),'no result text recorded');
 }
 dom.window.close();
});
test('Node collector correlates test steps and explicitly counts events exceeding its memory bound',async()=>{
 let binding;
 const page={exposeBinding:async(_name,callback)=>{binding=callback;},addInitScript:async()=>{},evaluate:async()=>{}};
 const recorder=await createStudioRecorder(page);recorder.mark('mobile URL Studio','start');
 for(let i=0;i<10001;i++)binding({}, {type:'click',sequence:i});
 const data=await recorder.flush();assert.equal(data.events.length,10000);assert.equal(data.droppedEvents,2);assert.equal(data.events[1].check,'mobile URL Studio');assert.equal(data.collectionError,null);
});
test('closed-page flushing preserves collected evidence and reports the collection failure',async()=>{
 const page={exposeBinding:async()=>{},addInitScript:async()=>{},evaluate:async()=>{throw Error('Page closed');}};
 const recorder=await createStudioRecorder(page);recorder.mark('failed navigation','failed');const data=await recorder.flush();assert.equal(data.events.length,1);assert.equal(data.collectionError,'Page closed');
});
