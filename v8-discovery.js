/* GoVibeTool V8 — category-first homepage discovery.
   Layers on the existing catalogue (tools.js / v2-tools.js / discovery.js). Tool IDs, standalone URLs (?tool=<id>),
   localStorage keys and openTool() behaviour are untouched; this file only changes how the homepage presents them.
   The homepage shows categories and search; a category opens its own view at ?category=<id> (history-aware). */
(function(){
"use strict";

/* ---------- Categories (every listed tool belongs to at least one) ---------- */
const V8_CATEGORIES=[
 {id:"ai-prompts",label:"AI & Prompts",icon:"sparkle",tone:"h-v",blurb:"Build, improve and compare AI prompts and workflows.",ids:["prompt-improver","ai-prompt-builder","prompt-diff","agentic-workflow-generator","ai-signals","fact-anchor-checker"]},
 {id:"productivity",label:"Productivity",icon:"bolt",tone:"h-a",blurb:"Plan, focus and decide faster.",cats:["Productivity"],exclude:["ai-prompt-builder","agentic-workflow-generator","prompt-diff"]},
 {id:"files-pdf",label:"Files & PDF",icon:"file",tone:"h-r",blurb:"Merge, split and convert documents locally.",cats:["Files & PDF"],ids:["table-formatter"]},
 {id:"images-design",label:"Images & Design",icon:"image",tone:"h-b",blurb:"Resize, compress and style visuals.",cats:["Images & Design"]},
 {id:"privacy-security",label:"Privacy & Security",icon:"shield",tone:"h-g",blurb:"Redact, check and protect sensitive data.",cats:["Privacy & Safety"]},
 {id:"developer",label:"Developer",icon:"code",tone:"h-t",blurb:"Format, decode and sanitise code and data.",cats:["Developer"]},
 {id:"business-finance",label:"Business & Finance",icon:"briefcase",tone:"h-a",blurb:"Invoices, budgets and pricing maths.",cats:["Business","Money & Calculators"]},
 {id:"writing-text",label:"Writing & Text",icon:"pen",tone:"h-b",blurb:"Clean, compare and polish text.",cats:["Writing & Text","Text"],exclude:["ai-signals","fact-anchor-checker","table-formatter"]},
 {id:"links-web",label:"Links & Web",icon:"link",tone:"h-v",blurb:"Clean, build and inspect links.",cats:["Links & Web"]}
];

/* Icon + tone per catalogue category for tool rows (icons live in the inline sprite in index.html). */
const ICONS={
 "Productivity":["sparkle","h-v"],"Text":["type","h-b"],"Writing & Text":["pen","h-b"],"Developer":["code","h-t"],
 "Privacy & Safety":["shield","h-g"],"Images & Design":["image","h-r"],"Files & PDF":["file","h-r"],
 "Business":["briefcase","h-a"],"Money & Calculators":["calc","h-a"],"Links & Web":["link","h-b"]
};
const STOP=new Set("a an the to of for and or in on with my me i want need how do can you your is it this that from into by at as be".split(" "));

/* ---------- Helpers ---------- */
const $=(s,r)=>(r||document).querySelector(s);
const $$=(s,r)=>Array.prototype.slice.call((r||document).querySelectorAll(s));
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const reduced=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
const listed=t=>typeof isListed==="function"?isListed(t):true;
const allTools=()=>typeof tools!=="undefined"?tools.filter(listed):[];
const byId=id=>allTools().filter(t=>t[0]===id)[0];
const ic=(name,cls)=>'<svg class="ic'+(cls?" "+cls:"")+'" aria-hidden="true" focusable="false"><use href="#i-'+name+'"/></svg>';
const iconFor=t=>ICONS[t[1]]||["sparkle","h-v"];
const tok=s=>String(s||"").toLowerCase().replace(/[^a-z0-9+#.]+/g," ").trim().split(/\s+/).filter(Boolean);
const plural=n=>n+" "+(n===1?"tool":"tools");
const plain=e=>e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey;

function members(c){
 const out=new Set();
 allTools().forEach(t=>{
  if((c.exclude||[]).indexOf(t[0])>-1)return;
  if((c.cats||[]).indexOf(t[1])>-1||(c.ids||[]).indexOf(t[0])>-1)out.add(t[0]);
 });
 return out;
}
function categoryTools(c){
 const ids=members(c);
 return allTools().map((t,i)=>({t:t,i:i})).filter(r=>ids.has(r.t[0]))
  .sort((a,b)=>(typeof toolTier==="function"?toolTier(a.t[0])-toolTier(b.t[0]):0)||a.i-b.i).map(r=>r.t);
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

/* ---------- Tool rows (dense; same classes the existing tests/styles rely on) ---------- */
function card(t,isFav){
 const id=E(t[0]),title=E(t[2]),i=iconFor(t);
 return '<article class="toolcard" data-tool="'+id+'">'+
  '<button class="btn tool-open" type="button" data-open="'+id+'" aria-label="Open '+title+'" aria-describedby="d-'+id+'">'+
   '<span class="ico sm '+i[1]+'">'+ic(i[0])+'</span><span class="tc-text"><strong>'+title+'</strong><small id="d-'+id+'">'+E(t[3])+'</small></span><span class="tc-go" aria-hidden="true"><span class="tc-open">Open</span>'+ic("arrow")+'</span></button>'+
  '<button class="favorite-btn" type="button" data-fav="'+id+'" aria-pressed="'+(isFav?"true":"false")+'" aria-label="'+(isFav?"Remove "+title+" from favourites":"Add "+title+" to favourites")+'" title="'+(isFav?"Remove from favourites":"Add to favourites")+'">'+(isFav?"★":"☆")+'</button>'+
 '</article>';
}
const favs=()=>typeof discoveryLoad==="function"?discoveryLoad(DISCOVERY_FAV_KEY):[];
/* Re-render a list while keeping keyboard focus on the same favourite button. */
function keepFocus(box,fn){
 const ae=document.activeElement,id=ae&&ae.dataset&&ae.dataset.fav&&box.contains(ae)?ae.dataset.fav:null;
 fn();
 if(id){const b=box.querySelector('[data-fav="'+id+'"]');if(b)b.focus({preventScroll:true})}
}

/* ---------- Home: category tiles ---------- */
function renderTiles(){
 const host=$("#categoryGrid");if(!host)return;
 host.innerHTML=V8_CATEGORIES.map(c=>{
  const n=members(c).size;
  return '<a class="cat-tile" href="?category='+c.id+'" data-cat="'+c.id+'"><span class="ico sm '+c.tone+'">'+ic(c.icon)+'</span>'+
   '<span class="ct-text"><strong>'+E(c.label)+'</strong><small>'+plural(n)+'</small></span><span class="ct-go" aria-hidden="true">'+ic("arrow")+'</span></a>';
 }).join("");
}

/* ---------- Home: search results (nothing is listed until the visitor searches) ---------- */
function renderSearch(){
 const box=$("#toolCatalog"),status=$("#searchStatus"),input=$("#toolSearch");
 if(!box||typeof tools==="undefined")return;
 const q=(input&&input.value||"").trim(),scores=q?searchTools(q):null;
 if(!scores){box.hidden=true;box.innerHTML="";if(status)status.innerHTML="";return}
 const fav=favs();
 const rows=allTools().map((t,i)=>({t:t,i:i})).filter(r=>scores.has(r.t[0]));
 rows.sort((a,b)=>scores.get(b.t[0])-scores.get(a.t[0])||(typeof toolTier==="function"?toolTier(a.t[0])-toolTier(b.t[0]):0)||a.i-b.i);
 keepFocus(box,()=>{
  box.innerHTML=rows.length?rows.map(r=>card(r.t,fav.indexOf(r.t[0])>-1)).join(""):
   '<div class="empty"><strong>No matching tools.</strong><br>Try fewer words, a broader task or pick a category above.</div>';
 });
 box.hidden=false;
 if(status)status.innerHTML='<span>Showing <strong>'+rows.length+'</strong> '+(rows.length===1?"tool":"tools")+' matching “<strong>'+E(q)+'</strong>”</span><button type="button" class="link-btn" id="clearSearch">Clear search</button>';
}
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

/* The catalogue renderer other scripts call (favourite toggles, storage events, load): refresh whatever is on screen. */
renderCatalog=function(){
 renderSearch();
 const cat=routeCategory(),view=$("#categoryView");
 if(cat&&view&&!view.hidden){
  const box=$("#categoryTools");
  if(box){const fav=favs();keepFocus(box,()=>{box.innerHTML=categoryTools(cat).map(t=>card(t,fav.indexOf(t[0])>-1)).join("")})}
 }
};
/* Featured tools no longer exist on the homepage; keep the legacy hook as a harmless no-op. */
renderFeatured=function(){};

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

/* ---------- Category view (dedicated view at ?category=<id>) ---------- */
const baseTitle=document.title;
let lastCategory=null;
function routeCategory(){
 const id=new URLSearchParams(location.search).get("category");
 return V8_CATEGORIES.filter(c=>c.id===id)[0]||null;
}
function renderCategoryView(cat){
 const host=$("#categoryView");if(!host)return;
 const list=categoryTools(cat),fav=favs();
 host.innerHTML=
  '<section class="cv-hero"><div class="wrap">'+
   '<a class="back-link" href="'+E(location.pathname)+'" data-back>'+ic("arrow")+'<span>All categories</span></a>'+
   '<div class="cv-head"><span class="ico lg '+cat.tone+'">'+ic(cat.icon)+'</span>'+
    '<div class="cv-title"><h1 id="categoryTitle" tabindex="-1">'+E(cat.label)+'</h1><p>'+E(cat.blurb)+'</p></div>'+
    '<span class="count-badge cv-count"><b>'+list.length+'</b> '+(list.length===1?"tool":"tools")+'</span></div>'+
  '</div></section>'+
  '<section class="sec cv-list" aria-label="'+E(cat.label)+' tools"><div class="wrap"><div class="list" id="categoryTools">'+
   list.map(t=>card(t,fav.indexOf(t[0])>-1)).join("")+'</div></div></section>';
}
const inCategory=()=>{const v=$("#categoryView");return !!v&&!v.hidden};

/* Show whichever view the URL asks for. Pushing history entries is the caller's job. */
function applyRoute(opts){
 opts=opts||{};
 const home=$("#homeView"),view=$("#categoryView");if(!home||!view)return;
 const cat=routeCategory(),wasCategory=!view.hidden;
 if(cat){
  lastCategory=cat.id;
  renderCategoryView(cat);
  home.hidden=true;view.hidden=false;
  document.title=cat.label+" tools — GoVibeTool";
  window.scrollTo({top:0,behavior:"auto"});
  const h=$("#categoryTitle");if(h&&!opts.initial)h.focus({preventScroll:true});
 }else{
  view.hidden=true;view.innerHTML="";home.hidden=false;
  document.title=baseTitle;
  if(wasCategory||opts.hash){
   const target=opts.hash?document.getElementById(opts.hash.slice(1)):$("#tools");
   if(target)target.scrollIntoView({block:"start",behavior:"auto"});else window.scrollTo({top:0,behavior:"auto"});
   if(!opts.hash&&lastCategory){const tile=$('.cat-tile[data-cat="'+lastCategory+'"]');if(tile)tile.focus({preventScroll:true})}
  }
 }
}
function openCategory(id){
 if(!V8_CATEGORIES.some(c=>c.id===id))return;
 history.pushState({v8:"category"},"",location.pathname+"?category="+id);
 applyRoute();
}
function openHome(hash){
 history.pushState({v8:"home"},"",location.pathname+(hash||""));
 applyRoute({hash:hash});
}
function focusSearch(){
 const i=$("#toolSearch");if(!i)return;
 if(typeof window.closeMenu==="function")window.closeMenu();
 if(inCategory())openHome("#search");
 const s=$("#search");if(s)s.scrollIntoView({block:"start",behavior:reduced()?"auto":"smooth"});
 i.focus({preventScroll:true});if(i.select)i.select();
}

function boot(){
 renderTiles();renderCatalog();renderDiscoveryShelf();
 applyRoute({initial:true});
 window.addEventListener("popstate",()=>applyRoute());

 /* Delegated actions: category tiles, Back, open a tool, toggle a favourite, clear search. */
 document.addEventListener("click",e=>{
  const a=e.target.closest("a");
  if(a&&plain(e)){
   if(a.classList.contains("cat-tile")){e.preventDefault();openCategory(a.dataset.cat);return}
   if(a.hasAttribute("data-back")){e.preventDefault();openHome();return}
   const href=a.getAttribute("href")||"";
   if(inCategory()&&href.charAt(0)==="#"&&href.length>1&&!a.classList.contains("skip")){e.preventDefault();openHome(href);return}
  }
  const open=e.target.closest("[data-open]");
  if(open&&typeof openTool==="function"){openTool(open.dataset.open);return}
  const fav=e.target.closest("[data-fav]");
  if(fav&&typeof toggleFavorite==="function"){toggleFavorite(fav.dataset.fav,e);return}
  if(e.target.closest("#clearSearch")){const i=$("#toolSearch");if(i){i.value="";renderAlso("");renderSearch();i.focus()}}
 });

 /* One search: live tool results + Learn/Labs/Play matches. */
 const input=$("#toolSearch"),form=$("#searchForm");
 if(input){
  const long=input.getAttribute("placeholder"),mq=matchMedia("(max-width: 640px)");
  const fit=()=>input.setAttribute("placeholder",mq.matches?"What do you want to do?":long);
  fit();mq.addEventListener("change",fit);
  input.addEventListener("input",()=>{renderSearch();renderAlso(input.value)});
  input.addEventListener("keydown",e=>{if(e.key==="Escape"&&input.value){input.value="";renderAlso("");renderSearch()}});
  if(input.value){renderSearch();renderAlso(input.value)}
 }
 if(form)form.addEventListener("submit",e=>{e.preventDefault();if(input)input.blur();const s=$("#searchStatus");if(s&&s.innerHTML)s.scrollIntoView({block:"start",behavior:reduced()?"auto":"smooth"})});
 $$(".task-chip").forEach(b=>b.addEventListener("click",()=>{
  if(!input)return;
  input.value=b.dataset.q;renderSearch();renderAlso(input.value);
 }));

 /* "/" and Ctrl/⌘+K focus the search without leaving the page. Runs before the legacy handlers. */
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

 /* Active state for the in-page links: Tools by default, About while the About section is in view. */
 const links=$$(".navlinks a"),tl=links.filter(a=>a.getAttribute("href")==="#tools")[0],al=links.filter(a=>a.getAttribute("href")==="#about")[0];
 const setCurrent=a=>{links.forEach(l=>l.removeAttribute("aria-current"));if(a)a.setAttribute("aria-current","page")};
 const about=$("#about");
 if(about&&tl&&al&&"IntersectionObserver" in window){
  new IntersectionObserver(es=>{es.forEach(en=>setCurrent(en.isIntersecting?al:tl))},{rootMargin:"-40% 0px -45% 0px"}).observe(about);
 }
}
/* The script sits at the end of <body>, so the DOM above already exists: render immediately to avoid any flash of
   the legacy full-catalogue render that v2-tools.js performs while later scripts load. */
if($("#categoryGrid"))boot();else document.addEventListener("DOMContentLoaded",boot);
})();
