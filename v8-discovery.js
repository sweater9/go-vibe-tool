/* GoVibeTool V8 — hybrid homepage discovery.
   Layers on the existing catalogue (tools.js / v2-tools.js / discovery.js). Tool IDs, standalone URLs,
   localStorage keys and openTool() behaviour are untouched; this file only changes how the homepage presents them. */
(function(){
"use strict";

/* ---------- Categories (every listed tool belongs to at least one) ---------- */
const V8_CATEGORIES=[
 {id:"ai-prompts",label:"AI & Prompts",short:"AI & Prompts",ids:["prompt-improver","ai-prompt-builder","prompt-diff","agentic-workflow-generator","ai-signals","fact-anchor-checker"]},
 {id:"productivity",label:"Productivity",short:"Productivity",cats:["Productivity"],exclude:["ai-prompt-builder","agentic-workflow-generator","prompt-diff"]},
 {id:"files-pdf",label:"Files & PDF",short:"Files & PDF",cats:["Files & PDF"],ids:["table-formatter"]},
 {id:"images-design",label:"Images & Design",short:"Images",cats:["Images & Design"]},
 {id:"privacy-security",label:"Privacy & Security",short:"Privacy",cats:["Privacy & Safety"]},
 {id:"developer",label:"Developer",short:"Developer",cats:["Developer"]},
 {id:"business-finance",label:"Business & Finance",short:"Business",cats:["Business","Money & Calculators"]},
 {id:"writing-text",label:"Writing & Text",short:"Writing",cats:["Writing & Text","Text"],exclude:["ai-signals","fact-anchor-checker","table-formatter"]},
 {id:"links-web",label:"Links & Web",short:"Links & Web",cats:["Links & Web"]}
];

/* Icon + tone per catalogue category (icons live in the inline sprite in index.html). */
const ICONS={
 "Productivity":["sparkle","h-v"],"Text":["type","h-b"],"Writing & Text":["pen","h-b"],"Developer":["code","h-t"],
 "Privacy & Safety":["shield","h-g"],"Images & Design":["image","h-r"],"Files & PDF":["file","h-r"],
 "Business":["briefcase","h-a"],"Money & Calculators":["calc","h-a"],"Links & Web":["link","h-b"]
};
/* Six compact featured tools — all real catalogue IDs. */
const FEATURED=["prompt-improver","ai-prompt-builder","pii-secret-redactor","image-studio","pdf-studio","invoice-studio"];
const STOP=new Set("a an the to of for and or in on with my me i want need how do can you your is it this that from into by at as be".split(" "));

/* ---------- Helpers ---------- */
const $=(s,r)=>(r||document).querySelector(s);
const $$=(s,r)=>Array.prototype.slice.call((r||document).querySelectorAll(s));
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const reduced=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
const listed=t=>typeof isListed==="function"?isListed(t):true;
const allTools=()=>typeof tools!=="undefined"?tools.filter(listed):[];
const byId=id=>allTools().find(t=>t[0]===id);
const ic=(name,cls)=>'<svg class="ic'+(cls?" "+cls:"")+'" aria-hidden="true" focusable="false"><use href="#i-'+name+'"/></svg>';
const iconFor=t=>ICONS[t[1]]||["sparkle","h-v"];
const tok=s=>String(s||"").toLowerCase().replace(/[^a-z0-9+#.]+/g," ").trim().split(/\s+/).filter(Boolean);

function members(c){
 const out=new Set();
 allTools().forEach(t=>{
  if((c.exclude||[]).indexOf(t[0])>-1)return;
  if((c.cats||[]).indexOf(t[1])>-1||(c.ids||[]).indexOf(t[0])>-1)out.add(t[0]);
 });
 return out;
}

/* ---------- Search: word-prefix AND matching, assisted by the curated intent index ---------- */
function searchTools(q){
 let words=tok(q).filter(w=>!STOP.has(w));
 if(!words.length)words=tok(q);
 if(!words.length)return null;
 const scores=new Map();
 allTools().forEach(t=>{
  const titleWords=tok(t[2]),allWords=tok([t[0].replace(/-/g," "),t[1],t[2],t[3]].join(" "));
  let ok=true,score=10;
  for(const w of words){
   if(!allWords.some(x=>x.indexOf(w)===0)){ok=false;break}
   score+=titleWords.some(x=>x.indexOf(w)===0)?3:1;
  }
  if(ok)scores.set(t[0],score);
 });
 if(typeof intentResults==="function"){
  intentResults(words.join(" ")).forEach((r,i)=>{
   if(r.score>=4&&r.tool&&(r.type==="Tool"||r.type==="Lab")&&!scores.has(r.tool)&&byId(r.tool))scores.set(r.tool,5-i*.1);
  });
 }
 return scores;
}

/* ---------- State ---------- */
let active=null;

function syncTabs(){
 $$(".cat-tab").forEach(b=>b.setAttribute("aria-pressed",String((b.dataset.cat||null)===active)));
}
function renderTabs(){
 const host=$("#categoryGrid");if(!host)return;
 host.innerHTML='<button type="button" class="cat-tab" data-cat="" aria-pressed="true">All</button>'+
  V8_CATEGORIES.map(c=>'<button type="button" class="cat-tab" data-cat="'+c.id+'" aria-pressed="false" aria-label="'+E(c.label)+'" title="'+E(c.label)+'">'+E(c.short)+'</button>').join("");
}
function setActive(id){
 active=(id&&active!==id)?id:null;
 syncTabs();renderCatalog();
}

/* ---------- Catalogue (dense rows; same classes the existing tests/styles rely on) ---------- */
function card(t,isFav){
 const id=E(t[0]),title=E(t[2]),i=iconFor(t);
 return '<article class="toolcard" data-tool="'+id+'">'+
  '<button class="btn tool-open" type="button" data-open="'+id+'" aria-label="Open '+title+'" aria-describedby="d-'+id+'">'+
   '<span class="ico sm '+i[1]+'">'+ic(i[0])+'</span><span class="tc-text"><strong>'+title+'</strong><small id="d-'+id+'">'+E(t[3])+'</small></span><span class="tc-go" aria-hidden="true">'+ic("arrow")+'</span></button>'+
  '<button class="favorite-btn" type="button" data-fav="'+id+'" aria-pressed="'+(isFav?"true":"false")+'" aria-label="'+(isFav?"Remove "+title+" from favourites":"Add "+title+" to favourites")+'" title="'+(isFav?"Remove from favourites":"Add to favourites")+'">'+(isFav?"★":"☆")+'</button>'+
 '</article>';
}
function updateStatus(n,q,cat){
 const el=$("#categoryStatus");if(!el)return;
 if(!q&&!cat){el.innerHTML="";return}
 let msg='Showing <strong>'+n+'</strong> '+(n===1?"tool":"tools");
 if(cat)msg+=' in <strong>'+E(cat.label)+'</strong>';
 if(q)msg+=' matching “<strong>'+E(q)+'</strong>”';
 el.innerHTML='<span>'+msg+'</span>'+(cat?'<button type="button" class="link-btn" id="clearCategory">Show all tools</button>':'')+(q?'<button type="button" class="link-btn" id="clearSearch">Clear search</button>':'');
}
renderCatalog=function(){
 const box=$("#toolCatalog");if(!box||typeof tools==="undefined")return;
 const input=$("#toolSearch"),q=(input&&input.value||"").trim();
 const cat=V8_CATEGORIES.filter(c=>c.id===active)[0]||null;
 const ids=cat?members(cat):null,scores=q?searchTools(q):null;
 const fav=typeof discoveryLoad==="function"?discoveryLoad(DISCOVERY_FAV_KEY):[];
 const ae=document.activeElement,keep=ae&&ae.classList&&ae.classList.contains("favorite-btn")&&ae.closest(".toolcard")?ae.closest(".toolcard").dataset.tool:null;
 const rows=allTools().map((t,i)=>({t:t,i:i})).filter(r=>(!ids||ids.has(r.t[0]))&&(!scores||scores.has(r.t[0])));
 rows.sort((a,b)=>(scores?scores.get(b.t[0])-scores.get(a.t[0]):0)||(typeof toolTier==="function"?toolTier(a.t[0])-toolTier(b.t[0]):0)||a.i-b.i);
 box.innerHTML=rows.length?rows.map(r=>card(r.t,fav.indexOf(r.t[0])>-1)).join(""):
  '<div class="empty"><strong>No matching tools.</strong><br>Try fewer words, a broader task or another category.</div>';
 if(keep){const b=$('.toolcard[data-tool="'+keep+'"] .favorite-btn');if(b)b.focus({preventScroll:true})}
 const vc=$("#visibleCount");if(vc)vc.textContent=rows.length;
 const ac=$("#activeCount");if(ac)ac.textContent=allTools().length;
 updateStatus(rows.length,q,cat);
 const pop=$("#popular");if(pop)pop.hidden=!!(q||cat);
 if(!$("#featuredTools .featured-card"))renderFeatured();
};

/* ---------- Featured (six compact tools) ---------- */
renderFeatured=function(){
 const host=$("#featuredTools");if(!host)return;
 host.innerHTML=FEATURED.map(byId).filter(Boolean).map(t=>{
  const id=E(t[0]),i=iconFor(t);
  return '<button type="button" class="featured-card" data-open="'+id+'" aria-label="Open '+E(t[2])+'" aria-describedby="f-'+id+'">'+
   '<span class="ico lg '+i[1]+'">'+ic(i[0])+'</span><span class="fc-text"><strong>'+E(t[2])+'</strong><small id="f-'+id+'">'+E(t[3])+'</small></span>'+
   '<span class="fc-go" aria-hidden="true">Open '+ic("arrow")+'</span></button>';
 }).join("");
};

/* ---------- Favourites + Recently used (compact, scrollable row) ---------- */
renderDiscoveryShelf=function(){
 const box=$("#discoveryShelf");if(!box||typeof discoveryLoad!=="function")return;
 const pick=k=>discoveryLoad(k).map(byId).filter(Boolean);
 const fav=pick(DISCOVERY_FAV_KEY),rec=pick(DISCOVERY_RECENT_KEY);
 if(!fav.length&&!rec.length){
  box.innerHTML='<span class="shelf-empty">'+ic("sparkle")+'<span>Favourites and recently used tools appear here — saved only on this device.</span></span>';
  return;
 }
 const pill=(t,star)=>{const i=iconFor(t);return '<button type="button" class="pill" data-open="'+E(t[0])+'"><span class="ico xs '+i[1]+'">'+ic(i[0])+'</span>'+E(t[2])+(star?'<i aria-hidden="true">★</i>':"")+'</button>'};
 box.innerHTML=
  (fav.length?'<div class="shelf-group" role="group" aria-label="Favourites"><span class="shelf-label">★ Favourites</span>'+fav.map(t=>pill(t,true)).join("")+'</div>':"")+
  (rec.length?'<div class="shelf-group" role="group" aria-label="Recently used"><span class="shelf-label">Recently used</span>'+rec.map(t=>pill(t,false)).join("")+'</div>':"");
};

/* ---------- "Also in Learn, Labs & Play" panel under the hero search ---------- */
function renderAlso(q){
 const host=$("#intentResults");if(!host)return;
 q=(q||"").trim();
 const words=tok(q).filter(w=>!STOP.has(w)).join(" ");
 const hits=!words||typeof intentResults!=="function"?[]:intentResults(words).filter(r=>r.type!=="Tool"&&r.score>=8).slice(0,4);
 if(!hits.length){host.hidden=true;host.innerHTML="";return}
 host.innerHTML='<div class="also-label">Also in Learn, Labs &amp; Play</div>'+hits.map(r=>
  '<a class="also-hit" href="'+E(r.href)+'"><span class="also-type">'+E(r.type)+'</span><span class="also-text"><strong>'+E(r.title)+'</strong><small>'+E(r.summary)+'</small></span>'+ic("arrow")+'</a>').join("");
 host.hidden=false;
}

/* ---------- Search focus helper ---------- */
function focusSearch(){
 const i=$("#toolSearch");if(!i)return;
 if(typeof window.closeMenu==="function")window.closeMenu();
 window.scrollTo({top:0,behavior:reduced()?"auto":"smooth"});
 i.focus({preventScroll:true});if(i.select)i.select();
}

document.addEventListener("DOMContentLoaded",()=>{
 renderTabs();renderCatalog();renderDiscoveryShelf();

 /* Delegated actions: open a tool, toggle a favourite, filter by category, clear filters. */
 document.addEventListener("click",e=>{
  const open=e.target.closest("[data-open]");
  if(open&&typeof openTool==="function"){openTool(open.dataset.open);return}
  const fav=e.target.closest("[data-fav]");
  if(fav&&typeof toggleFavorite==="function"){toggleFavorite(fav.dataset.fav,e);return}
  const tab=e.target.closest(".cat-tab");
  if(tab){setActive(tab.dataset.cat||null);return}
  if(e.target.closest("#clearCategory")){active=null;syncTabs();renderCatalog();const all=$('.cat-tab[data-cat=""]');all&&all.focus();return}
  if(e.target.closest("#clearSearch")){const i=$("#toolSearch");if(i){i.value="";renderAlso("");renderCatalog();i.focus()}}
 });

 /* One integrated search: live catalogue filtering + Learn/Labs/Play matches. */
 const input=$("#toolSearch"),form=$("#searchForm");
 if(input){
  const long=input.getAttribute("placeholder"),mq=matchMedia("(max-width: 640px)");
  const fit=()=>input.setAttribute("placeholder",mq.matches?"What do you want to do?":long);
  fit();mq.addEventListener("change",fit);
  input.addEventListener("input",()=>{renderCatalog();renderAlso(input.value)});
  input.addEventListener("keydown",e=>{if(e.key==="Escape"&&input.value){input.value="";renderAlso("");renderCatalog()}});
  if(input.value){renderAlso(input.value)}
 }
 if(form)form.addEventListener("submit",e=>{
  e.preventDefault();
  const t=$("#tools");if(t)t.scrollIntoView({behavior:reduced()?"auto":"smooth",block:"start"});
  if(input)input.blur();
 });
 $$(".task-chip").forEach(b=>b.addEventListener("click",()=>{
  if(!input)return;
  input.value=b.dataset.q;
  renderCatalog();renderAlso(input.value);
 }));
 document.addEventListener("click",e=>{if(!e.target.closest("#intentResults,#searchForm")){const h=$("#intentResults");if(h&&!h.hidden)h.hidden=true}});
 if(input)input.addEventListener("focus",()=>{const h=$("#intentResults");if(h&&h.innerHTML)h.hidden=false});

 /* "/" and Ctrl/⌘+K focus the hero search without jumping to the catalogue. Runs before the legacy handlers. */
 document.addEventListener("keydown",e=>{
  const tag=(document.activeElement&&document.activeElement.tagName)||"";
  const typing=/^(input|textarea|select)$/i.test(tag)||(document.activeElement&&document.activeElement.isContentEditable);
  const slash=e.key==="/"&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!typing;
  const k=(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k";
  if(slash||k){e.preventDefault();e.stopImmediatePropagation();focusSearch()}
 },true);
 const ns=$(".nav-search");if(ns)ns.addEventListener("click",focusSearch);

 /* Accessible mobile menu. */
 const btn=$(".menu-toggle"),panel=$("#primaryNav");
 function closeMenu(returnFocus){
  document.documentElement.classList.remove("menu-open");
  if(btn){btn.setAttribute("aria-expanded","false");if(returnFocus===true)btn.focus()}
 }
 window.closeMenu=closeMenu;
 if(btn&&panel){
  btn.addEventListener("click",()=>{
   if(btn.getAttribute("aria-expanded")==="true")closeMenu();
   else{document.documentElement.classList.add("menu-open");btn.setAttribute("aria-expanded","true")}
  });
  panel.addEventListener("click",e=>{if(e.target.closest("a"))closeMenu()});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&btn.getAttribute("aria-expanded")==="true")closeMenu(true)});
  document.addEventListener("click",e=>{if(btn.getAttribute("aria-expanded")==="true"&&!e.target.closest("nav"))closeMenu()});
  matchMedia("(min-width: 861px)").addEventListener("change",()=>closeMenu());
 }

 /* Active state for the in-page links (Tools / About). */
 const links=$$(".navlinks a"),tl=links.filter(a=>a.getAttribute("href")==="#tools")[0],al=links.filter(a=>a.getAttribute("href")==="#about")[0];
 const setCurrent=a=>{links.forEach(l=>l.removeAttribute("aria-current"));if(a)a.setAttribute("aria-current","page")};
 const about=$("#about");
 if(about&&tl&&al&&"IntersectionObserver" in window){
  new IntersectionObserver(es=>{es.forEach(en=>setCurrent(en.isIntersecting?al:tl))},{rootMargin:"-40% 0px -45% 0px"}).observe(about);
 }
});
})();
