import {randomBytes,createHash} from 'node:crypto';
import {deal,move,resolve,view,WINDS} from '../engine.mjs';
const hash=t=>createHash('sha256').update(t).digest('hex');
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
export class Room {
 constructor(record=null,now=()=>Date.now()){this.record=record;this.now=now;}
 expired(){const r=this.record;return !r||this.now()>=Math.min(r.created+14400000,r.activity+1800000);}
 nextAlarm(){const r=this.record;return Math.min(r.created+14400000,r.activity+1800000,r.game?.phase==='claim'?r.game.pending.deadline:Infinity);}
 seat(token){if(typeof token!=='string'||! /^[A-Za-z0-9_-]{32}$/.test(token))fail('Seat access required.',401);const s=this.record.players.findIndex(p=>p.auth===hash(token));if(s<0)fail('Seat access denied.',401);return s;}
 snapshot(s,connected=[]){const r=this.record;return {code:r.code,seat:s,revision:r.revision,expiresAt:Math.min(r.created+14400000,r.activity+1800000),players:r.players.map((p,i)=>({name:p.name,wind:WINDS[i],ready:p.ready,connected:connected.includes(i)})),game:view(r.game,s)};}
 join(code,name,create=false){if(typeof name!=='string'||name.trim().length<1||name.trim().length>24||/[\x00-\x1f\x7f]/.test(name))fail('Use a name of 1–24 characters.');if(create){if(this.record)fail('Room exists.',409);this.record={code,created:this.now(),activity:this.now(),revision:0,players:[],game:null};}const r=this.record;if(!r||this.expired())fail('Room expired.',404);if(r.players.length>=4||r.game)fail('Room full or playing.',409);const token=randomBytes(24).toString('base64url');r.players.push({name:name.trim(),auth:hash(token),ready:false});r.activity=this.now();r.revision++;return {token,...this.snapshot(r.players.length-1)};}
 sweep(){if(this.expired())return false;const g=this.record.game;if(g?.phase==='claim'&&this.now()>=g.pending.deadline){resolve(g);this.record.revision++;return true;}return false;}
 action(s,body){const r=this.record,a=body?.action;const current=r.game?.phase==='claim'&&Number.isSafeInteger(a?.claimId)&&a.claimId===r.game.pending.id;if(!Number.isSafeInteger(body?.revision)||body.revision<0||body.revision>r.revision||(body.revision!==r.revision&&a?.type!=='ready'&&!current))fail('Table updated. Please try again.',409);if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).some(k=>!['type','tile','tiles','claimId'].includes(k))||(a.tiles&&(!Array.isArray(a.tiles)||a.tiles.length>3)))fail('Invalid action.');if(a.type==='ready'){if(r.game)fail('Already started.');r.players[s].ready=true;if(r.players.length===4&&r.players.every(p=>p.ready))r.game=deal();}else{if(!r.game)fail('Wait for four ready players.');move(r.game,s,a,this.now());}r.activity=this.now();r.revision++;return this.snapshot(s);}
}
