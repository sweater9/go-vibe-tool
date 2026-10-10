import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const handlers = {};
const html = new Response('<!doctype html><title>Offline</title>',{headers:{'Content-Type':'text/html'}});
const script = new Response('window.cached=true',{headers:{'Content-Type':'application/javascript'}});
const sandbox = {
 self:{addEventListener:(name,handler)=>handlers[name]=handler},
 location:{origin:'https://intellitools.online'}, URL, Response,
 fetch:async()=>{throw new Error('offline')},
 caches:{match:async(request)=>request==='./index.html'?html:request.url?.endsWith('cached.js')?script:undefined}
};
vm.runInNewContext(fs.readFileSync('sw.js','utf8'),sandbox);
async function request(path,mode='cors') {
 let response;
 handlers.fetch({request:{url:new URL(path,sandbox.location.origin).href,method:'GET',mode},respondWith:p=>response=p});
 return response ? await response : undefined;
}
assert.equal(await request('https://example.com/ad.js'),undefined,'external requests must not be intercepted');
assert.equal((await request('/missing.js')).type,'error','missing scripts must not receive HTML');
assert.equal((await request('/missing.svg')).type,'error','missing non-navigation assets must not receive HTML');
assert.equal(await request('/cached.js'),script,'cached scripts must remain available offline');
assert.equal(await request('/offline/','navigate'),html,'offline navigation retains homepage fallback');
console.log('V5 service worker: cross-origin isolation, asset MIME safety, cached scripts, navigation fallback PASS');
