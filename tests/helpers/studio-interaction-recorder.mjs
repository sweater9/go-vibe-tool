/* Test-only recorder: never imported by the site or deployed static build. */
export function recordStudioInteractions() {
  const pending=new Set();
  let sequence=0,previousRoot=null,previousTab=null;
  const describe=element=>{
    if(!(element instanceof Element))return null;
    const button=element.closest('button');
    return {tag:element.tagName,id:element.id||null,role:element.getAttribute('role'),buttonId:button?.id||null,studio:element.closest('[data-studio]')?.getAttribute('data-studio')||null};
  };
  const state=()=>({readyState:document.readyState,workspaceActive:!!document.querySelector('#workspace.active'),selectedTab:document.querySelector('#studioRoot [role=tab][aria-selected=true]')?.getAttribute('data-studio')||null});
  const emit=(type,detail={})=>{
    const record={type,sequence:++sequence,timeOrigin:performance.timeOrigin,time:performance.now(),path:location.pathname,...state(),...detail};
    const promise=Promise.resolve(window.__gvtStudioDiagnosticEvent(record));
    pending.add(promise);promise.then(()=>pending.delete(promise),()=>pending.delete(promise));
  };
  // No text/textarea/password values, cookies, storage or full URL queries are captured. URL Studio output echoes the
  // analysed URL, so results are reduced to a coarse state and a length rather than recorded verbatim.
  const analysis=target=>target instanceof Element?target.closest('#urlAnalyze,#urlUtm'):null;
  const resultState=text=>!text?'empty':/^Enter a link/.test(text)?'initial':/^Input changed/.test(text)?'invalidated':/^Inspect or build/.test(text)?'refused':/^Scheme:/.test(text)?'inspected':/^Campaign URL:/.test(text)?'built':/^Invalid URL|^Only HTTP|^Unsupported|not a valid URL|Maximum/i.test(text)?'error':'other';
  const summarize=()=>{const text=document.getElementById('urlResult')?.textContent||'';return {resultState:resultState(text),resultLength:text.length};};
  for(const type of ['pointerdown','pointerup','click'])document.addEventListener(type,event=>{
    const hit=Number.isFinite(event.clientX)&&Number.isFinite(event.clientY)?document.elementFromPoint?.(event.clientX,event.clientY):null;
    emit(type,{target:describe(event.target),hit:describe(hit),pointerType:event.pointerType||null,pointerId:event.pointerId??null,button:event.button,buttons:event.buttons,x:event.clientX,y:event.clientY,trusted:event.isTrusted,defaultPrevented:event.defaultPrevented});
    const button=type==='click'&&analysis(event.target);
    if(button)emit('analysis-request',{control:button.id});
  },true);
  document.addEventListener('click',event=>{
    const button=analysis(event.target);
    if(button)emit('analysis-complete',{control:button.id,...summarize()});
  });
  const observe=records=>{
    const root=document.getElementById('studioRoot');
    const tab=root?.querySelector('[role=tab][aria-selected=true]')?.getAttribute('data-studio')||null;
    if(root!==previousRoot||tab!==previousTab){emit('tab-selection',{previousTab,reason:root!==previousRoot?'mount-or-dispose':'selection'});previousRoot=root;previousTab=tab;}
    const results=new Set();
    for(const record of records){
      const element=record.target.nodeType===Node.ELEMENT_NODE?record.target:record.target.parentElement;
      const result=element?.closest('#urlResult');
      if(result)results.add(result);
    }
    for(const result of results)emit('analysis-result',{control:result.id,...summarize()});
  };
  new MutationObserver(observe).observe(document,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-selected']});
  document.addEventListener('DOMContentLoaded',()=>emit('document-ready'),{once:true});
  window.__gvtFlushStudioDiagnostics=async()=>{await Promise.resolve();await Promise.allSettled([...pending]);};
  emit('document-init');
}

export async function createStudioRecorder(page) {
  const events=[];let droppedEvents=0,currentCheck=null;
  await page.exposeBinding('__gvtStudioDiagnosticEvent',(_source,event)=>{
    if(events.length<10000)events.push({...event,receivedAt:new Date().toISOString(),check:currentCheck});else droppedEvents++;
  });
  await page.addInitScript(recordStudioInteractions);
  return {
    mark(label,status){currentCheck=label;events.push({type:'test-step',label,status,receivedAt:new Date().toISOString()});},
    async flush(){let collectionError=null;try{await page.evaluate(async()=>window.__gvtFlushStudioDiagnostics?.());}catch(error){collectionError=error.message;}return {events,droppedEvents,collectionError};}
  };
}
