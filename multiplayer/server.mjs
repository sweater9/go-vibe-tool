import http from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deal, move, resolve, view, WINDS } from './engine.mjs';
const hash=t=>createHash('sha256').update(t).digest('hex');
const secret=()=>randomBytes(24).toString('base64url');
export function createService({origins=['http://localhost:8080'],now=()=>Date.now(),idleMs=30*60*1000,lifeMs=4*60*60*1000,maxRooms=100,stateFile=null,trustProxy=false}={}) {
 const rooms=new Map(),limits=new Map();
 if(stateFile){try{for(const r of JSON.parse(readFileSync(stateFile,'utf8'))){r.players.forEach(p=>p.connected=false);rooms.set(r.code,r);}}catch(e){if(e.code!=='ENOENT')throw e;}}
 const streams=new Map();
 const save=()=>{if(!stateFile)return;mkdirSync(dirname(stateFile),{recursive:true});writeFileSync(stateFile+'.tmp',JSON.stringify([...rooms.values()]),{mode:0o600,flush:true});renameSync(stateFile+'.tmp',stateFile);};
 const snapshot=(r,s)=>({code:r.code,seat:s,revision:r.revision,expiresAt:Math.min(r.created+lifeMs,r.activity+idleMs),players:r.players.map((p,i)=>({name:p.name,wind:WINDS[i],connected:p.connected,ready:p.ready})),game:view(r.game,s)});
 const send=(res,v)=>{if(res.writableLength>65536){res.destroy();return;}res.write('data: '+JSON.stringify(v)+'\n\n');};
 const broadcast=r=>{for(let s=0;s<r.players.length;s++){const stream=streams.get(r.code+':'+s);if(stream)send(stream,snapshot(r,s));}};
 const change=r=>{r.revision++;save();broadcast(r);};
 function sweep(){let dirty=false;for(const [code,r]of rooms){if(now()-r.created>=lifeMs||now()-r.activity>=idleMs){for(let s=0;s<4;s++){const key=code+':'+s,res=streams.get(key);if(res){send(res,{expired:true});res.end();streams.delete(key);}}rooms.delete(code);dirty=true;}else if(r.game?.phase==='claim'&&now()>=r.game.pending.deadline){resolve(r.game);change(r);}}for(const[k,v]of limits)if(now()-v.at>60000)limits.delete(k);if(dirty)save();}
 const timer=setInterval(sweep,1000);timer.unref();
 const beat=setInterval(()=>{for(const res of streams.values())res.write(': heartbeat\n\n');},15000);beat.unref();
 function limit(key,max){let v=limits.get(key);if(!v||now()-v.at>60000){if(limits.size>=10000)throw Object.assign(Error('Server busy.'),{status:503});limits.set(key,v={at:now(),n:0});}if(++v.n>max)throw Object.assign(Error('Too many requests. Try again in a minute.'),{status:429});}
 const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 const reply=(status,v)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(v));};
 try{
 const origin=req.headers.origin;
 if(origin&&!origins.includes(origin))return reply(403,{error:'Origin denied.'});
 if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
 if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.writeHead(204);return res.end();}
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/health'&&req.method==='GET')return reply(200,{ok:true});
 if(!origin)return reply(403,{error:'Origin required.'});
 const ip=trustProxy?String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',').at(-1).trim():req.socket.remoteAddress;
 limit('ip:'+ip,120);sweep();
 let body={};if(req.method==='POST'){
 if(!String(req.headers['content-type']).startsWith('application/json'))return reply(415,{error:'JSON required.'});
 let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>2048){reply(413,{error:'Request too large.'});req.destroy();return;}}
 try{body=JSON.parse(text);}catch{return reply(400,{error:'Invalid JSON.'});}
 if(!body||typeof body!=='object'||Array.isArray(body))return reply(400,{error:'Invalid input.'});
 }
 const name=()=>{if(typeof body.name!=='string'||body.name.trim().length<1||body.name.trim().length>24||/[\x00-\x1f\x7f]/.test(body.name))throw Error('Use a name of 1–24 characters.');return body.name.trim();};
 const player=()=>{const token=secret();return {token,record:{name:name(),auth:hash(token),ready:false,connected:false}};};
 if(url.pathname==='/rooms'&&req.method==='POST'){
 limit('create:'+ip,6);if(rooms.size>=maxRooms)return reply(503,{error:'Room capacity reached.'});
 const p=player(),code=randomBytes(12).toString('hex');const r={code,created:now(),activity:now(),revision:0,players:[p.record],game:null};rooms.set(code,r);save();return reply(201,{token:p.token,...snapshot(r,0)});
 }
 const match=/^\/rooms\/([a-f0-9]{24})(?:\/(join|events|actions))?$/.exec(url.pathname);
 if(!match)return reply(404,{error:'Not found.'});
 const [,code,route]=match,r=rooms.get(code);if(!r)return reply(404,{error:'Room not found or expired. Create a new room.'});
 if(route==='join'&&req.method==='POST'){
 limit('join:'+ip,12);if(r.players.length>=4||r.game)return reply(409,{error:'This room is full or already playing.'});
 const p=player();r.players.push(p.record);r.activity=now();change(r);return reply(201,{token:p.token,...snapshot(r,r.players.length-1)});
 }
 const auth=req.headers.authorization;if(typeof auth!=='string'||!/^Bearer [A-Za-z0-9_-]{32}$/.test(auth))return reply(401,{error:'Seat access required.'});
 const s=r.players.findIndex(p=>p.auth===hash(auth.slice(7)));if(s<0)return reply(401,{error:'Seat access denied.'});
 limit('seat:'+r.players[s].auth,90);
 if(route==='events'&&req.method==='GET'){
 const key=code+':'+s,old=streams.get(key);if(old)old.end();
 res.writeHead(200,{'Content-Type':'text/event-stream','Connection':'keep-alive','X-Accel-Buffering':'no'});streams.set(key,res);r.players[s].connected=true;change(r);
 req.on('close',()=>{if(streams.get(key)===res){streams.delete(key);r.players[s].connected=false;if(rooms.has(code))change(r);}});return;
 }
 if(!route&&req.method==='GET')return reply(200,snapshot(r,s));
 if(route!=='actions'||req.method!=='POST')return reply(405,{error:'Method not allowed.'});
 if(!Number.isSafeInteger(body.revision)||body.revision!==r.revision)return reply(409,{error:'Table updated. Please try your action again.',state:snapshot(r,s)});
 const a=body.action;if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).some(k=>!['type','tile','tiles'].includes(k))||a.tiles&&(!Array.isArray(a.tiles)||a.tiles.length>3))throw Error('Invalid action.');
 if(a.type==='ready'){
 if(r.game)throw Error('Already started.');r.players[s].ready=true;
 if(r.players.length===4&&r.players.every(p=>p.ready))r.game=deal();
 }else{
 if(!r.game)throw Error('Wait for four ready players.');move(r.game,s,a,now());
 }
 r.activity=now();change(r);return reply(200,snapshot(r,s));
 }catch(e){if(!res.headersSent)reply(e.status||400,{error:e.status?e.message:'Action rejected: '+e.message});else res.destroy();}
 });
 server.requestTimeout=10000;server.headersTimeout=10000;server.maxConnections=500;
 server.on('close',()=>{clearInterval(timer);clearInterval(beat);for(const res of streams.values())res.end();});
 return {server,rooms,sweep,close:()=>{for(const res of streams.values())res.end();server.close();}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const origins=(process.env.ALLOWED_ORIGINS||'http://localhost:8080').split(',');
 const service=createService({origins,stateFile:process.env.STATE_FILE||null,trustProxy:process.env.TRUST_RENDER_PROXY==='true'});
 service.server.listen(Number(process.env.PORT||8787),'0.0.0.0',()=>console.log('Mahjong service ready'));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>service.close());
}
