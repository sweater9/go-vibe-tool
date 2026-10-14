import assert from 'node:assert/strict';
import test from 'node:test';
import {recordStudioInteractions,createStudioRecorder} from './helpers/studio-interaction-recorder.mjs';
const {JSDOM}=await import(process.env.JSDOM_PACKAGE||'jsdom');

test('recorder captures pointer-to-calculation ordering and observed tab/result changes without input secrets',async()=>{
 const dom=new JSDOM('<div id="workspace" class="active"><div id="studioRoot"><button data-studio="freelance" role="tab" aria-selected="true">Rate</button><button data-studio="url" role="tab" aria-selected="false">URL</button><button id="calcRate">Calculate</button><div id="rateResult"></div><input id="password" value="fixture-secret-never-record"></div></div>',{url:'https://example.test/studios?token=fixture-secret-never-record',runScripts:'outside-only'});
 const w=dom.window,events=[];w.__gvtStudioDiagnosticEvent=event=>{events.push(event);return Promise.resolve();};
 w.eval('('+recordStudioInteractions.toString()+')()');
 const button=w.document.getElementById('calcRate');button.onclick=()=>{w.document.getElementById('rateResult').textContent='Quote: 2262.24';};
 for(const type of ['pointerdown','pointerup','click'])button.dispatchEvent(new w.MouseEvent(type,{bubbles:true,clientX:5,clientY:8}));
 const tabs=w.document.querySelectorAll('[role=tab]');tabs[0].setAttribute('aria-selected','false');tabs[1].setAttribute('aria-selected','true');
 await w.__gvtFlushStudioDiagnostics();
 const kinds=events.map(event=>event.type);
 for(const type of ['pointerdown','pointerup','click','calculation-request','calculation-complete','calculation-result','tab-selection'])assert.ok(kinds.includes(type),type);
 assert.ok(kinds.indexOf('pointerdown')<kinds.indexOf('pointerup'));assert.ok(kinds.indexOf('pointerup')<kinds.indexOf('click'));assert.ok(kinds.indexOf('calculation-request')<kinds.indexOf('calculation-complete'));
 assert.equal(events.find(event=>event.type==='calculation-complete').result,'Quote: 2262.24');assert.equal(events.find(event=>event.type==='tab-selection').selectedTab,'url');
 assert.equal(events.find(event=>event.type==='pointerdown').target.buttonId,'calcRate');assert.ok(events.every(event=>event.path==='/studios'));assert.ok(!JSON.stringify(events).includes('fixture-secret-never-record'));
 dom.window.close();
});
test('Node collector correlates test steps and explicitly counts events exceeding its memory bound',async()=>{
 let binding;
 const page={exposeBinding:async(_name,callback)=>{binding=callback;},addInitScript:async()=>{},evaluate:async()=>{}};
 const recorder=await createStudioRecorder(page);recorder.mark('mobile calculator','start');
 for(let i=0;i<10001;i++)binding({}, {type:'click',sequence:i});
 const data=await recorder.flush();assert.equal(data.events.length,10000);assert.equal(data.droppedEvents,2);assert.equal(data.events[1].check,'mobile calculator');assert.equal(data.collectionError,null);
});
test('closed-page flushing preserves collected evidence and reports the collection failure',async()=>{
 const page={exposeBinding:async()=>{},addInitScript:async()=>{},evaluate:async()=>{throw Error('Page closed');}};
 const recorder=await createStudioRecorder(page);recorder.mark('failed navigation','failed');const data=await recorder.flush();assert.equal(data.events.length,1);assert.equal(data.collectionError,'Page closed');
});
