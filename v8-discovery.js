/* GoVibeTool V8 — discovery & navigation. Layers on the existing catalogue; tool IDs and local data are untouched. */
(function(){
"use strict";
const V8_CATEGORIES=[
 {id:"ai-prompts",label:"AI & Prompts",blurb:"Build, improve and compare prompts and workflows.",ids:["prompt-improver","ai-prompt-builder","prompt-diff","agentic-workflow-generator","ai-signals","fact-anchor-checker"]},
 {id:"productivity",label:"Productivity",blurb:"Plan, focus and decide faster.",cats:["Productivity"],exclude:["ai-prompt-builder","agentic-workflow-generator","prompt-diff"]},
 {id:"files-pdf",label:"Files & PDF",blurb:"Merge, split and convert documents locally.",cats:["Files & PDF"],ids:["table-formatter"]},
 {id:"images-design",label:"Images & Design",blurb:"Resize, compress and style visuals.",cats:["Images & Design"]},
 {id:"privacy-security",label:"Privacy & Security",blurb:"Redact, check and protect sensitive data.",cats:["Privacy & Safety"]},
 {id:"developer",label:"Developer",blurb:"Format, decode and sanitise code and data.",cats:["Developer"]},
 {id:"business-finance",label:"Business & Finance",blurb:"Invoices, budgets and pricing maths.",cats:["Business","Money & Calculators"]},
 {id:"writing-text",label:"Writing & Text",blurb:"Clean, compare and polish text.",cats:["Writing & Text","Text"],exclude:["ai-signals","fact-anchor-checker","table-formatter"]}
];
const $=(s,r)=>(r||document).querySelector(s);
const listed=t=>typeof isListed==="function"?isListed(t):true;
function members(c){
 const ids=new Set();
 (typeof tools!=="undefined"?tools:[]).forEach(t=>{
  if(!listed(t))return;
  if((c.exclude||[]).includes(t[0]))return;
  if((c.cats||[]).includes(t[1])||(c.ids||[]).includes(t[0]))ids.add(t[0]);
 });
 return ids;
}
let active=null;
function setActive(id,opts){
 active=active===id&&!(opts&&opts.force)?null:id;
 const sel=$("#categoryFilter");
 if(active){if(sel)sel.value="All categories";document.querySelectorAll(".category-chips button").forEach(b=>b.classList.toggle("active",b.dataset.category==="All categories"))}
 renderCatalog();renderCategoryCards();
}
function clearActive(){if(active){active=null;renderCategoryCards();updateStatus(null,0)}}
function updateStatus(cat,n){
 const el=$("#categoryStatus");if(!el)return;
 if(!cat){el.innerHTML="";return}
 el.innerHTML='<span>Showing <strong>'+n+'</strong> '+(n===1?'tool':'tools')+' in <strong>'+cat.label+'</strong></span> <button type="button" class="link-btn" id="clearCategory">Show all tools</button>';
 $("#clearCategory").addEventListener("click",()=>{active=null;renderCatalog();renderCategoryCards();$("#toolSearch")&&$("#toolSearch").focus()});
}
function renderCategoryCards(){
 const host=$("#categoryGrid");if(!host)return;
 host.innerHTML=V8_CATEGORIES.map(c=>{
  const n=members(c).size;
  return '<button type="button" class="category-card'+(active===c.id?' is-active':'')+'" data-cat="'+c.id+'" aria-pressed="'+(active===c.id)+'"><span class="cat-count">'+n+'</span><strong>'+c.label.replace(/&/g,"&amp;")+'</strong><small>'+c.blurb.replace(/&/g,"&amp;")+'</small></button>';
 }).join("");
 host.querySelectorAll(".category-card").forEach(b=>b.addEventListener("click",()=>{setActive(b.dataset.cat);if(active){const t=$("#categoryStatus")||$("#tools");t&&t.scrollIntoView({block:"start"})}}));
}
const baseRender=renderCatalog;
renderCatalog=function(){
 baseRender();
 const cat=V8_CATEGORIES.find(c=>c.id===active);
 if(!cat){updateStatus(null,0);return}
 const ids=members(cat),box=$("#toolCatalog");if(!box)return;
 let n=0;
 box.querySelectorAll(".toolcard").forEach(card=>{
  const m=/openTool\('([^']+)'\)/.exec((card.querySelector(".btn")||{}).getAttribute?.("onclick")||"");
  if(m&&ids.has(m[1]))n++;else card.remove();
 });
 if(!n)box.innerHTML='<div class="empty"><strong>No matching tools.</strong><br>Try a broader task or another category.</div>';
 const cnt=$("#visibleCount");if(cnt)cnt.textContent=n;
 updateStatus(cat,n);
};
document.addEventListener("DOMContentLoaded",()=>{
 renderCategoryCards();
 document.querySelectorAll(".category-chips button").forEach(b=>b.addEventListener("click",clearActive));
 const sel=$("#categoryFilter");sel&&sel.addEventListener("change",clearActive);
 // Task suggestions feed the real intent search.
 const input=$("#intent");
 document.querySelectorAll(".task-chip").forEach(b=>b.addEventListener("click",()=>{if(!input)return;input.value=b.dataset.q;renderIntentResults(input.value);input.focus()}));
 // "AI & Prompts" navigation entry opens that category.
 document.querySelectorAll("[data-v8-category]").forEach(a=>a.addEventListener("click",()=>{active=null;setActive(a.dataset.v8Category,{force:true});closeMenu()}));
 // Accessible mobile menu.
 const btn=$(".menu-toggle"),panel=$("#primaryNav");
 function openMenu(){document.documentElement.classList.add("menu-open");btn.setAttribute("aria-expanded","true")}
 window.closeMenu=closeMenu;
 function closeMenu(returnFocus){document.documentElement.classList.remove("menu-open");if(btn){btn.setAttribute("aria-expanded","false");if(returnFocus===true)btn.focus()}}
 if(btn&&panel){
  btn.addEventListener("click",()=>btn.getAttribute("aria-expanded")==="true"?closeMenu():openMenu());
  panel.addEventListener("click",e=>{if(e.target.closest("a"))closeMenu()});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&btn.getAttribute("aria-expanded")==="true")closeMenu(true)});
  document.addEventListener("click",e=>{if(btn.getAttribute("aria-expanded")==="true"&&!e.target.closest("nav"))closeMenu()});
  matchMedia("(min-width: 861px)").addEventListener("change",()=>closeMenu());
 }
});
})();
