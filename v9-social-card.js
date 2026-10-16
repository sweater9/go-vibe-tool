/* V9 Social Card & Open Graph simulator engine. Pure functions: nothing here touches the network or the DOM.
   Previews are APPROXIMATIONS built from the values the user enters or pastes. Real platforms crop, truncate and
   re-style cards differently over time, and they read live pages we cannot fetch from a browser (CORS). */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.GVTV9=Object.assign(root.GVTV9||{},api);})(typeof self!=="undefined"?self:globalThis,function(){"use strict";

const MAX_HTML=300000;
/* Display limits are rough character budgets observed for each surface, not published specifications. */
const PLATFORMS={
  x:{label:"X (Twitter)",aspect:[2,1],titleMax:70,descMax:125,shows:"title, description, domain",note:"summary_large_image: 2:1 image (minimum 300×157, recommended 1200×600)."},
  linkedin:{label:"LinkedIn",aspect:[1.91,1],titleMax:100,descMax:0,shows:"title, domain",note:"1.91:1 image (recommended 1200×627). LinkedIn usually omits the description in feed cards."},
  slack:{label:"Slack",aspect:[1.91,1],titleMax:100,descMax:200,shows:"site name, title, description, image",note:"Slack unfurls show site name, linked title, description and a smaller image."}
};
const TWITTER_CARDS=["summary","summary_large_image","app","player"];

const decodeEntities=s=>String(s).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(m,e)=>{
  const l=e.toLowerCase();
  if(l==="amp")return"&";if(l==="lt")return"<";if(l==="gt")return">";if(l==="quot")return'"';if(l==="apos")return"'";if(l==="nbsp")return" ";
  const code=l[1]==="x"?parseInt(l.slice(2),16):parseInt(l.slice(1),10);
  try{return code>0&&code<=0x10ffff?String.fromCodePoint(code):m;}catch(e2){return m;}
});
const escapeHtml=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function parseAttrs(tag){
  const attrs={};
  const re=/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while((m=re.exec(tag))){const v=m[2]!==undefined?m[2]:m[3]!==undefined?m[3]:m[4]!==undefined?m[4]:"";attrs[m[1].toLowerCase()]=decodeEntities(v);}
  return attrs;
}
/* Reads <meta property|name=… content=…> and <title> from pasted HTML. It is a tolerant text scan, not an HTML parser: scripts
   are never executed and nothing is loaded. */
function parseMetaHtml(html){
  const src=String(html==null?"":html);
  if(src.length>MAX_HTML)throw Error("Pasted HTML is larger than 300,000 characters.");
  const cleaned=src.replace(/<!--[\s\S]*?-->/g,"");
  const meta={},rawTags=[];
  const tagRe=/<meta\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;let m;
  while((m=tagRe.exec(cleaned))){
    const a=parseAttrs(m[1]);
    const key=(a.property||a.name||"").toLowerCase();
    if(key&&a.content!==undefined){if(!(key in meta))meta[key]=a.content;rawTags.push(key);}
  }
  const t=/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(cleaned);
  const link=/<link\b(?:"[^"]*"|'[^']*'|[^'">])*rel\s*=\s*["']?canonical["']?(?:"[^"]*"|'[^']*'|[^'">])*>/i.exec(cleaned);
  const canonical=link?(parseAttrs(link[0]).href||""):"";
  return{
    fields:{
      title:meta["og:title"]||meta["twitter:title"]||(t?decodeEntities(t[1]).trim():""),
      description:meta["og:description"]||meta["twitter:description"]||meta["description"]||"",
      image:meta["og:image"]||meta["og:image:url"]||meta["twitter:image"]||meta["twitter:image:src"]||"",
      imageAlt:meta["og:image:alt"]||meta["twitter:image:alt"]||"",
      url:meta["og:url"]||canonical||"",
      siteName:meta["og:site_name"]||"",
      author:meta["article:author"]||meta["author"]||"",
      twitterCard:meta["twitter:card"]||"",
      twitterSite:meta["twitter:site"]||"",
      twitterCreator:meta["twitter:creator"]||"",
      type:meta["og:type"]||""
    },
    found:rawTags.length,
    tags:Array.from(new Set(rawTags))
  };
}

function hostOf(url){
  try{const u=new URL(url);if(!/^https?:$/.test(u.protocol))return"";return u.hostname.replace(/^www\./,"");}catch(e){return"";}
}
/* Only http(s) and inline raster data: URLs are ever used as image sources. */
function classifyImageUrl(url){
  const v=String(url||"").trim();
  if(!v)return{kind:"none"};
  if(/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(v))return{kind:"data",url:v};
  try{
    const u=new URL(v);
    if(u.protocol==="https:")return{kind:"https",url:u.href};
    if(u.protocol==="http:")return{kind:"http",url:u.href};
    return{kind:"blocked",reason:"Only http(s) image URLs are supported."};
  }catch(e){return{kind:"relative",reason:"Open Graph images must be absolute URLs (https://…); relative paths are ignored by most platforms."};}
}
function truncate(text,max){
  const s=String(text==null?"":text).replace(/\s+/g," ").trim();
  if(!max||s.length<=max)return{text:s,truncated:false};
  let cut=s.slice(0,max-1);
  const sp=cut.lastIndexOf(" ");
  if(sp>max*0.6)cut=cut.slice(0,sp);
  return{text:cut.replace(/[\s,.;:–-]+$/,"")+"…",truncated:true};
}
/* Per-platform display values: the same fallback rules platforms use (twitter:* falls back to og:*). */
function layout(platform,f){
  const p=PLATFORMS[platform];if(!p)throw Error("Unknown platform: "+platform);
  const title=truncate(f.title||f.siteName||hostOf(f.url)||"Untitled",p.titleMax);
  const desc=p.descMax?truncate(f.description,p.descMax):{text:"",truncated:false};
  const card=platform==="x"?(TWITTER_CARDS.indexOf(f.twitterCard)>=0?f.twitterCard:"summary_large_image"):"";
  const host=hostOf(f.url);
  return{
    platform,label:p.label,
    title:title.text,titleTruncated:title.truncated,
    description:desc.text,descriptionTruncated:desc.truncated,
    domain:host,siteName:f.siteName||host,
    aspect:platform==="x"&&card==="summary"?[1,1]:p.aspect,
    card,small:platform==="x"&&card==="summary",
    hasImage:classifyImageUrl(f.image).kind!=="none"
  };
}
function lint(f){
  const out=[],add=(level,field,message)=>out.push({level,field,message});
  const title=(f.title||"").trim(),desc=(f.description||"").trim();
  if(!title)add("error","title","Add a title: it is the main text of every card.");
  else{
    if(title.length>70)add("warn","title","Title is "+title.length+" characters; X cuts it near 70 and search near 60.");
    else if(title.length<15)add("info","title","Title is very short ("+title.length+" characters).");
  }
  if(!desc)add("warn","description","No description: X and Slack show an empty line instead.");
  else if(desc.length>200)add("warn","description","Description is "+desc.length+" characters; most platforms show under 200.");
  if(!f.url)add("warn","url","No canonical URL: the domain line on the card will be blank.");
  else if(!hostOf(f.url))add("error","url","URL must start with http:// or https://.");
  const img=classifyImageUrl(f.image);
  if(img.kind==="none")add("warn","image","No image: X and LinkedIn fall back to a text-only card.");
  else if(img.kind==="relative"||img.kind==="blocked")add("error","image",img.reason);
  else if(img.kind==="http")add("warn","image","Image uses http://. Use https:// so every platform can fetch it.");
  if(f.twitterCard&&TWITTER_CARDS.indexOf(f.twitterCard)<0)add("error","twitterCard","twitter:card must be one of "+TWITTER_CARDS.join(", ")+".");
  if(f.twitterSite&&!/^@\w{1,15}$/.test(f.twitterSite))add("warn","twitterSite","twitter:site should look like @handle.");
  if(f.image&&!f.imageAlt)add("info","imageAlt","Add og:image:alt so screen-reader users get the image's meaning.");
  return out;
}
const tag=(attr,key,value)=>value?'<meta '+attr+'="'+key+'" content="'+escapeHtml(value)+'">':"";
function buildMetaTags(f){
  const lines=[
    tag("property","og:type",f.type||"website"),
    tag("property","og:title",f.title),
    tag("property","og:description",f.description),
    tag("property","og:url",f.url),
    tag("property","og:site_name",f.siteName),
    tag("property","og:image",f.image),
    tag("property","og:image:alt",f.imageAlt),
    tag("name","twitter:card",f.twitterCard||(f.image?"summary_large_image":"summary")),
    tag("name","twitter:title",f.title),
    tag("name","twitter:description",f.description),
    tag("name","twitter:image",f.image),
    tag("name","twitter:site",f.twitterSite),
    tag("name","twitter:creator",f.twitterCreator)
  ].filter(Boolean);
  return lines.join("\n");
}
/* Greedy word wrap for Canvas export. `measure(text)` returns pixel width. */
function wrapLines(measure,text,maxWidth,maxLines){
  const words=String(text||"").split(/\s+/).filter(Boolean),lines=[];
  let cur="";
  for(let i=0;i<words.length;i++){
    const trial=cur?cur+" "+words[i]:words[i];
    if(measure(trial)<=maxWidth||!cur)cur=trial;
    else{lines.push(cur);cur=words[i];}
    if(lines.length===maxLines){cur="";break;}
  }
  if(cur&&lines.length<maxLines)lines.push(cur);
  const used=lines.join(" ").split(/\s+/).length;
  if(lines.length===maxLines&&used<words.length){
    let last=lines[maxLines-1];
    while(last.length>1&&measure(last+"…")>maxWidth)last=last.slice(0,-1);
    lines[maxLines-1]=last.replace(/[\s,.;:]+$/,"")+"…";
  }
  return lines;
}

return{PLATFORMS,TWITTER_CARDS,parseMetaHtml,hostOf,classifyImageUrl,truncate,socialLayout:layout,socialLint:lint,buildMetaTags,wrapLines,escapeHtml};});
