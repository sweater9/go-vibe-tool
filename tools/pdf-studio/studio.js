import * as pdfjs from "../v9-media/vendor/pdf/pdf.min.mjs";
pdfjs.GlobalWorkerOptions.workerSrc=new URL("../v9-media/vendor/pdf/pdf.worker.min.mjs",import.meta.url).href;
const {PDFDocument,StandardFonts,degrees,rgb}=window.PDFLib;
const $=id=>document.getElementById(id);
const MAX_BYTES=25*1024*1024,UNDO_LIMIT=12,UNDO_BYTES=160*1024*1024,DEFAULT_SIZE=14,MARGIN=36;
const controls=["prev","next","rotate","remove","addText","save","split","mergeFile","moveUp","moveDown"];
// doc holds the pages; notes are kept separately (in PDF user space) so they stay editable until they are baked in for preview/export.
let doc=null,preview=null,index=0,downloadUrl=null,renderTask=null,busy=false,idSeq=0,noteSeq=0;
let ids=[],notes=[],selected=null,marker=null,viewport=null,undoStack=[];
const rotationOf=page=>((page.getRotation().angle%360)+360)%360;
function message(s){$("status").textContent=s}
function clearDownload(){if(downloadUrl)URL.revokeObjectURL(downloadUrl);downloadUrl=null;$("download").replaceChildren()}
function friendly(e){const m=String(e&&e.message||e);
 if(/encrypted/i.test(m))return"This PDF is password-protected. Remove the password in the app that created it, then open it again.";
 if(/WinAnsi|cannot encode/i.test(m))return"The text contains characters the built-in PDF font cannot draw (for example emoji or Arabic). Use Latin letters, numbers and common symbols such as € or é.";
 if(/No PDF header|Failed to parse|Invalid PDF/i.test(m))return"This file is not a readable PDF (it may be damaged or truncated).";
 return m}
// Serialise every action that touches the document so a double tap cannot interleave two edits.
async function exclusive(fn){if(busy)return;busy=true;document.body.setAttribute("aria-busy","true");try{return await fn()}finally{busy=false;document.body.removeAttribute("aria-busy")}}
function buttons(){const ready=!!doc,n=doc?.getPageCount()||0;
 for(const id of controls)$(id).disabled=!ready;
 $("prev").disabled=!ready||index===0;$("next").disabled=!ready||index>=n-1;$("remove").disabled=!ready||n===1;$("moveUp").disabled=!ready||index===0;$("moveDown").disabled=!ready||index>=n-1;
 $("undo").disabled=!ready||!undoStack.length;
 const note=currentNote();$("text").disabled=!ready;$("noteSize").disabled=!ready;$("updateNote").disabled=!note;$("moveNote").disabled=!note||!marker;$("deleteNote").disabled=!note;
 $("pageInfo").textContent=ready?`${index+1} / ${n}`:"No PDF opened"}
function currentNote(){return notes.find(n=>n.id===selected&&n.pid===ids[index])||null}
function pageNotes(){return notes.filter(n=>n.pid===ids[index])}
// ---- baking notes into a copy of the document (preview and export) ----
async function bake(){
 const bytes=await doc.save(),out=await PDFDocument.load(bytes);
 if(!notes.length)return {out,bytes};
 const font=await out.embedFont(StandardFonts.Helvetica);
 notes.forEach(n=>{const at=ids.indexOf(n.pid);if(at<0)return;const page=out.getPage(at);
  page.drawText(n.text,{x:n.x,y:n.y,size:n.size,font,color:rgb(0,0,0),rotate:degrees(n.rot),maxWidth:n.cap,lineHeight:n.size*1.3})});
 return {out,bytes:await out.save()}}
function boxWidth(page){const{width,height}=page.getSize();return rotationOf(page)%180?height:width}
async function refresh(){
 if(!doc)return;
 const {bytes}=await bake();
 if(preview)await preview.destroy();
 preview=await pdfjs.getDocument({data:new Uint8Array(bytes),isEvalSupported:false}).promise;
 index=Math.min(index,doc.getPageCount()-1);
 await render();drawPages();buttons()}
function drawPages(){$("pages").replaceChildren();
 ids.forEach((pid,i)=>{const b=document.createElement("button"),c=notes.filter(n=>n.pid===pid).length;
  b.textContent=`Page ${i+1}`+(c?` · ${c} note${c>1?"s":""}`:"");b.setAttribute("aria-current",i===index?"page":"false");
  b.onclick=()=>goTo(i);$("pages").append(b)})}
function markCurrent(){[...$("pages").children].forEach((b,i)=>b.setAttribute("aria-current",i===index?"page":"false"))}
async function goTo(i){if(busy||!doc||i<0||i>=ids.length)return;index=i;marker=null;selected=null;await render();markCurrent();buttons()}
async function render(){
 if(renderTask){try{renderTask.cancel();await renderTask.promise}catch{}}
 const page=await preview.getPage(index+1);
 viewport=page.getViewport({scale:Math.min(1.4,850/page.getViewport({scale:1}).width)});
 const canvas=$("canvas");canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
 renderTask=page.render({canvasContext:canvas.getContext("2d"),viewport});await renderTask.promise;renderTask=null;
 drawNotesList();drawOverlay()}
// ---- annotation geometry ----
// A note's anchor (x,y) is the baseline-left of its first line in PDF user space. It is drawn upright for the page rotation it was created (or moved) under, then turns with the page like any other page content.
function toViewport(x,y){return viewport.convertToViewportPoint(x,y)}
function noteCorners(n){const a=n.rot*Math.PI/180,c=Math.cos(a),s=Math.sin(a),w=Math.max(8,Math.min(n.width,n.cap)),top=n.size*.95,bottom=-(n.lines-1)*n.size*1.3-n.size*.3;
 return [[0,top],[w,top],[w,bottom],[0,bottom]].map(([u,v])=>toViewport(n.x+u*c-v*s,n.y+u*s+v*c))}
function drawOverlay(){const layer=$("overlay");layer.replaceChildren();if(!viewport||!doc)return;
 const sx=$("canvas").clientWidth/$("canvas").width||1;
 const spot=(cls,px,py,label)=>{const d=document.createElement("div");d.className=cls;d.style.left=(px*sx)+"px";d.style.top=(py*sx)+"px";if(label)d.title=label;layer.append(d);return d};
 const note=currentNote();
 if(note){const pts=noteCorners(note),xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),box=spot("noteBox",Math.min(...xs),Math.min(...ys));box.style.width=((Math.max(...xs)-Math.min(...xs))*sx)+"px";box.style.height=((Math.max(...ys)-Math.min(...ys))*sx)+"px"}
 if(marker){const[px,py]=toViewport(marker.x,marker.y);spot("marker",px,py,"Text position")}}
function drawNotesList(){const list=$("notes");list.replaceChildren();
 const here=pageNotes();
 if(!here.length){const p=document.createElement("p");p.className="hint";p.textContent="No text on this page yet. Type text, tap the page to choose a position, then Add text.";list.append(p);return}
 here.forEach((n,i)=>{const b=document.createElement("button");b.type="button";b.textContent=`${i+1}. ${n.text.length>28?n.text.slice(0,27)+"…":n.text}`;b.setAttribute("aria-pressed",String(n.id===selected));
  b.onclick=()=>{selected=n.id;$("text").value=n.text;$("noteSize").value=n.size;message("Editing text "+(i+1)+". Change it and choose Update text, or tap the page and choose Move text here.");drawNotesList();drawOverlay();buttons()};list.append(b)})}
function defaultPoint(){const size=sizeValue(),pt=viewport.convertToPdfPoint(MARGIN*viewport.scale,(MARGIN+size)*viewport.scale);return {x:pt[0],y:pt[1]}}
function sizeValue(){const v=Math.round(Number($("noteSize").value));return Number.isFinite(v)?Math.min(72,Math.max(8,v)):DEFAULT_SIZE}
async function measure(text,size,capWidth){
 const scratch=await PDFDocument.create(),font=await scratch.embedFont(StandardFonts.Helvetica);
 const cap=capWidth||Math.max(100,boxWidth(doc.getPage(index))-2*MARGIN);let lines=0,width=0;
 for(const para of text.split(/\r?\n/)){let line="";lines++;
  for(const word of para.split(" ")){const trial=line?line+" "+word:word;if(line&&font.widthOfTextAtSize(trial,size)>cap){width=Math.max(width,font.widthOfTextAtSize(line,size));line=word;lines++}else line=trial}
  width=Math.max(width,font.widthOfTextAtSize(line,size))}
 return {width,lines,cap}}
// ---- history ----
async function snapshot(){const bytes=await doc.save();undoStack.push({bytes,ids:ids.slice(),notes:notes.map(n=>({...n})),index});
 let total=undoStack.reduce((t,s)=>t+s.bytes.length,0);
 while(undoStack.length>1&&(undoStack.length>UNDO_LIMIT||total>UNDO_BYTES))total-=undoStack.shift().bytes.length}
async function change(fn,done){
 return exclusive(async()=>{try{if(!doc)return;clearDownload();message("Updating locally…");await snapshot();
  try{await fn()}catch(e){undoStack.pop();throw e}
  await refresh();message(done||"Change applied. Export to download your PDF.")}catch(e){message("Could not edit PDF: "+friendly(e));buttons()}})}
// ---- opening ----
$("file").addEventListener("change",e=>{const file=e.target.files[0];if(!file)return;
 return exclusive(async()=>{try{if(file.size>MAX_BYTES)throw Error("Maximum file size is 25 MB.");message("Opening PDF locally…");clearDownload();
  const next=await PDFDocument.load(new Uint8Array(await file.arrayBuffer()),{ignoreEncryption:false});
  if(next.getPageCount()<1)throw Error("PDF has no pages.");
  doc=next;ids=doc.getPageIndices().map(()=>++idSeq);notes=[];selected=null;marker=null;undoStack=[];index=0;
  await refresh();message(`Opened ${file.name}. Nothing has been uploaded.`)}
 catch(err){doc=null;preview=null;ids=[];notes=[];undoStack=[];selected=null;marker=null;viewport=null;$("pages").replaceChildren();$("notes").replaceChildren();$("overlay").replaceChildren();$("canvas").width=0;buttons();message("Could not open PDF: "+friendly(err))}})});
$("prev").onclick=()=>goTo(index-1);
$("next").onclick=()=>goTo(index+1);
// ---- page operations ----
async function movePage(delta){await change(async()=>{const target=index+delta;if(target<0||target>=doc.getPageCount())return;
 const order=doc.getPageIndices(),selectedPage=order.splice(index,1)[0];order.splice(target,0,selectedPage);
 const reordered=await PDFDocument.create(),pages=await reordered.copyPages(doc,order);pages.forEach(p=>reordered.addPage(p));
 const pid=ids.splice(index,1)[0];ids.splice(target,0,pid);doc=reordered;index=target},"Page moved. Export to download your PDF.")}
$("moveUp").onclick=()=>movePage(-1);
$("moveDown").onclick=()=>movePage(1);
$("rotate").onclick=()=>change(()=>{const p=doc.getPage(index);p.setRotation(degrees((p.getRotation().angle+90)%360))});
$("remove").onclick=()=>change(()=>{const pid=ids[index];doc.removePage(index);ids.splice(index,1);notes=notes.filter(n=>n.pid!==pid);selected=null;marker=null;index=Math.min(index,doc.getPageCount()-1)},"Page deleted. Undo is available. Export to download your PDF.");
$("undo").onclick=()=>exclusive(async()=>{const s=undoStack.pop();if(!s)return;
 try{clearDownload();doc=await PDFDocument.load(s.bytes);ids=s.ids;notes=s.notes;index=Math.min(s.index,ids.length-1);selected=null;marker=null;await refresh();message("Last change undone.")}catch(e){message("Could not undo: "+friendly(e))}});
// ---- text annotations ----
$("canvas").addEventListener("click",e=>{if(!doc||!viewport||busy)return;
 const r=$("canvas").getBoundingClientRect(),cx=(e.clientX-r.left)/r.width*$("canvas").width,cy=(e.clientY-r.top)/r.height*$("canvas").height,pt=viewport.convertToPdfPoint(cx,cy);
 marker={x:pt[0],y:pt[1]};drawOverlay();buttons();message("Position chosen. Type text and choose Add text, or choose Move text here for the selected text.")});
async function validText(){const value=$("text").value.replace(/\s+$/g,"").replace(/^\s+/g,"");if(!value)throw Error("Enter text first.");
 const scratch=await PDFDocument.create(),font=await scratch.embedFont(StandardFonts.Helvetica);font.encodeText(value);return value}
$("addText").onclick=()=>change(async()=>{const value=await validText(),size=sizeValue(),at=marker||defaultPoint(),m=await measure(value,size);
 const n={id:++noteSeq,pid:ids[index],text:value,size,x:at.x,y:at.y,width:m.width,lines:m.lines,cap:m.cap,rot:rotationOf(doc.getPage(index))};notes.push(n);selected=n.id;
 // Step the marker down (in display space) so the next note does not land on top of this one.
 const [vx,vy]=toViewport(at.x,at.y),step=(size*1.3*m.lines+size*.6)*viewport.scale,pt=viewport.convertToPdfPoint(vx,Math.min(vy+step,viewport.height-4));marker={x:pt[0],y:pt[1]}},"Text added. Tap the page to place the next one, or select it in the list to edit. Export when finished.");
$("updateNote").onclick=()=>change(async()=>{const n=currentNote();if(!n)throw Error("Select a text item first.");const value=await validText(),size=sizeValue(),m=await measure(value,size,n.cap);Object.assign(n,{text:value,size,width:m.width,lines:m.lines})},"Text updated. Export to download your PDF.");
$("moveNote").onclick=()=>change(()=>{const n=currentNote();if(!n||!marker)throw Error("Select a text item and tap the page to choose where it goes.");n.x=marker.x;n.y=marker.y;n.rot=rotationOf(doc.getPage(index))},"Text moved. Export to download your PDF.");
$("deleteNote").onclick=()=>change(()=>{const n=currentNote();if(!n)throw Error("Select a text item first.");notes=notes.filter(x=>x!==n);selected=null},"Text removed. Export to download your PDF.");
// ---- export / split / merge ----
function downloadable(data,name,label){clearDownload();const blob=new Blob([data],{type:"application/pdf"});downloadUrl=URL.createObjectURL(blob);const a=document.createElement("a");a.href=downloadUrl;a.download=name;a.textContent=label+" ("+Math.ceil(blob.size/1024)+" KB)";$("download").append(a);return a}
$("save").onclick=()=>exclusive(async()=>{try{message("Exporting PDF…");clearDownload();const {bytes}=await bake();const blob=new Blob([bytes],{type:"application/pdf"});downloadUrl=URL.createObjectURL(blob);const a=document.createElement("a");a.href=downloadUrl;a.download="govibe-edited.pdf";a.textContent=`Download edited PDF (${Math.ceil(blob.size/1024)} KB)`;$("download").append(a);message("PDF ready. Select Download edited PDF to save it.")}catch(e){message("Export failed: "+friendly(e))}});
$("mergeFile").addEventListener("change",e=>{const file=e.target.files[0];if(!file||!doc)return;
 return exclusive(async()=>{try{if(file.size>MAX_BYTES)throw Error("Maximum file size is 25 MB.");message("Merging locally…");
  const incoming=await PDFDocument.load(new Uint8Array(await file.arrayBuffer()),{ignoreEncryption:false});
  if(!incoming.getPageCount())throw Error("The second PDF has no pages.");
  await snapshot();
  try{const combined=await PDFDocument.load(await doc.save());const pages=await combined.copyPages(incoming,incoming.getPageIndices());pages.forEach(page=>combined.addPage(page));doc=combined;pages.forEach(()=>ids.push(++idSeq));clearDownload();await refresh();message("Merged "+pages.length+" page(s). Export to download the combined PDF.")}catch(inner){undoStack.pop();throw inner}}
 catch(err){message("Could not merge PDF: "+friendly(err))}finally{e.target.value=""}})});
async function extractPage(){const {out:doc}=await bake(),single=await PDFDocument.create(),[page]=await single.copyPages(doc,[index]);single.addPage(page);return single.save()}
$("split").onclick=()=>exclusive(async()=>{try{if(!doc)return;message("Preparing selected page…");downloadable(await extractPage(),"govibe-page-"+(index+1)+".pdf","Download page "+(index+1));message("Selected page ready to download.")}catch(err){message("Could not split PDF: "+friendly(err))}});
window.addEventListener("pagehide",clearDownload);
buttons();
