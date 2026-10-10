const CACHE="intellitools-v5-0";
const LEGACY_CACHE="intellitools-v2-7";
const ASSETS=[
  "./",
  "./index.html",
  "./v2.css",
  "./v5.css",
  "./tools.js",
  "./v2-tools.js",
  "./v21-tools.js",
  "./discovery.js",
  "./learn/index.html",
  "./labs/index.html",
  "./labs/workflow/index.html",
  "./labs/workflow/workflow-engine.js",
  "./labs/workflow/workflow-app.js",
  "./labs/api-playground/index.html",
  "./labs/api-playground/api-mock-engine.js",
  "./labs/api-playground/api-app.js",
  "./play/index.html",
  "./play/daily/index.html",
  "./play/daily/daily-engine.js",
  "./play/daily/daily-app.js",
  "./play/word-logic/index.html",
  "./play/word-logic/logic-engine.js",
  "./play/word-logic/logic-app.js",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./vendor/pdf-lib.min.js",
  "./vendor/qrcode.min.js",
  "./vendor/jsqr.min.js"
];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;const url=new URL(event.request.url);if(url.origin!==location.origin)return;const freshFirst=url.origin===location.origin&&(event.request.mode==="navigate"||/\.(?:html|js|mjs|css|json)$/.test(url.pathname));if(freshFirst){event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response}).catch(()=>caches.match(event.request).then(cached=>cached||(event.request.mode==="navigate"?caches.match("./index.html"):Response.error()))));return}event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok&&url.origin===location.origin){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response}).catch(()=>event.request.mode==="navigate"?caches.match("./index.html"):Response.error())))});
