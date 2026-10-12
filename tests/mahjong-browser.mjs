import assert from 'node:assert/strict';
import http from 'node:http';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {createService} from '../multiplayer/server.mjs';
const pw=await import(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const engines=process.argv[2]?[process.argv[2]]:['chromium','firefox','webkit'];
const root=resolve('.'),dir='artifacts/mahjong';mkdirSync(dir,{recursive:true});
const svc=createService({origins:['http://localhost:8080']});
await new Promise(r=>svc.server.listen(8787,r));
const staticServer=http.createServer((req,res)=>{const p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));if(!file.startsWith(root+'/')||!existsSync(file)){res.writeHead(404);res.end();return;}const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'};res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(readFileSync(file));});await new Promise(r=>staticServer.listen(8080,r));
const results=[];
try{for(const engine of engines){let browser;try{browser=await pw[engine].launch();for(const width of [1280,375]){
 const contexts=[],pages=[],errors=[],failures=[];
 try{
 for(let i=0;i<4;i++){const c=await browser.newContext({viewport:{width,height:900}});contexts.push(c);const p=await c.newPage();pages.push(p);p.on('pageerror',e=>errors.push(e.message));p.on('requestfailed',r=>{if(!r.url().includes('/events')&&!r.failure()?.errorText?.includes('ABORT'))failures.push(r.url()+': '+r.failure()?.errorText);});await p.goto('http://localhost:8080/play/mahjong/');}
 await pages[0].screenshot({path:`${dir}/${engine}-${width}-lobby.png`,fullPage:true});
 await pages[0].locator('#name').fill('East guest');await pages[0].locator('#create').click();await pages[0].locator('#room').waitFor({state:'visible'});
 await pages[0].waitForFunction(()=>document.getElementById('status').textContent.startsWith('Connected'));
 const code=(await pages[0].locator('#room-code').textContent()).split(': ')[1];
 for(let i=1;i<4;i++){await pages[i].goto('http://localhost:8080/play/mahjong/#'+code);assert.equal(await pages[i].locator('#code').inputValue(),code);await pages[i].locator('#name').fill(i===1?'<img src=x onerror=alert(1)>'.slice(0,24):'Friend '+i);await pages[i].locator('#join-form button').click();await pages[i].waitForFunction(()=>document.getElementById('status').textContent.startsWith('Connected'));}
 for(const p of pages)await p.waitForFunction(()=>document.querySelectorAll('.seat h3').length===4&&document.querySelectorAll('.seat p')[0].textContent.includes('Connected')&&!document.querySelector('#seats').textContent.includes('Open seat'));
 // Verify guest display names are rendered as text.
 assert.equal(await pages[0].locator('#seats img').count(),0);
 for(const p of pages){await p.locator('#ready').click();await p.waitForFunction(()=>document.getElementById('ready').hidden||document.getElementById('ready').textContent.startsWith('Ready'));}
 await Promise.all(pages.map(p=>p.waitForFunction(()=>document.querySelectorAll('#hand button').length>=13)));
 assert.deepEqual(await Promise.all(pages.map(p=>p.locator('#hand button').count())),[14,13,13,13]);
 assert.ok((await pages[0].locator('#turn').textContent()).includes('Your turn'));assert.equal(await pages[1].locator('#hand button:not([disabled])').count(),0);
 await pages[0].locator('#hand button').first().focus();await pages[0].keyboard.press('Enter');assert.ok(await pages[0].locator('#hand button[aria-pressed=true]').count()>0);await pages[0].locator('#discard').click();
 await Promise.all(pages.map(p=>p.waitForFunction(()=>document.querySelectorAll('#discards li').length===1)));
 for(let i=1;i<4;i++){const pass=pages[i].getByRole('button',{name:'Pass',exact:true});if(await pass.count())await pass.click();}
 await pages[1].waitForFunction(()=>document.getElementById('turn').textContent.includes('Your turn'));
 const before=await pages[2].locator('#hand').textContent();await pages[2].reload();await pages[2].waitForFunction(()=>document.getElementById('status').textContent.startsWith('Connected'));assert.equal(await pages[2].locator('#hand').textContent(),before);
 const stale=await pages[0].evaluate(async()=>{const seat=JSON.parse(sessionStorage.getItem('govibe-mahjong-seat'));const r=await fetch(window.MAHJONG_API+'/rooms/'+seat.code+'/actions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+seat.token},body:JSON.stringify({revision:-1,action:{type:'discard',tile:999}})});return r.status;});assert.equal(stale,409);
 for(const p of pages)assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow');
 await pages[0].screenshot({path:`${dir}/${engine}-${width}-table.png`,fullPage:true});
 // Reconnection from a temporary network outage retains the same seat and hand.
 const south=await pages[1].locator('#hand').textContent();await contexts[1].setOffline(true);await pages[0].waitForFunction(()=>document.querySelector('#seats').textContent.includes('Reconnecting / offline'));await contexts[1].setOffline(false);await pages[1].waitForFunction(()=>document.getElementById('status').textContent.startsWith('Connected'),null,{timeout:20000});assert.equal(await pages[1].locator('#hand').textContent(),south);
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
 results.push({engine,width,status:'pass',checks:'four guests, invitations, keyboard discard, turn sync, private hands, XSS text rendering, stale action, reload, network reconnect, no overflow/errors',screenshots:[`${engine}-${width}-lobby.png`,`${engine}-${width}-table.png`]});
 }finally{await Promise.all(contexts.map(c=>c.close()));}
 }}catch(e){results.push({engine,status:'fail',error:e.stack});process.exitCode=1;}finally{await browser?.close();}}
}finally{svc.close();staticServer.close();writeFileSync(dir+'/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));}
