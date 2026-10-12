import { randomInt } from 'node:crypto';
export const WINDS = ['East','South','West','North'];
export const validTile = t => Number.isInteger(t) && t >= 0 && t < 34;
export function wall() {
 const tiles = Array.from({length:136},(_,i)=>Math.floor(i/4));
 for(let i=tiles.length-1;i>0;i--){const j=randomInt(i+1);[tiles[i],tiles[j]]=[tiles[j],tiles[i]];}
 return tiles;
}
function groups(c, n) {
 const t=c.findIndex(x=>x>0); if(t<0)return n===0; if(n===0)return false;
 if(c[t]>=3){c[t]-=3;const ok=groups(c,n-1);c[t]+=3;if(ok)return true;}
 if(t<27 && t%9<7 && c[t+1] && c[t+2]){c[t]--;c[t+1]--;c[t+2]--;const ok=groups(c,n-1);c[t]++;c[t+1]++;c[t+2]++;if(ok)return true;}
 return false;
}
export function winning(hand,melds=[]) {
 if(melds.length>4 || hand.length!==14-3*melds.length || hand.some(t=>!validTile(t)))return false;
 const c=Array(34).fill(0);for(const t of hand)if(++c[t]>4)return false;
 for(let t=0;t<34;t++)if(c[t]>=2){c[t]-=2;const ok=groups(c,4-melds.length);c[t]+=2;if(ok)return true;}
 return false;
}
export function settlement(winner,from,selfDraw) {
 const scores=Array(4).fill(0);
 if(selfDraw){scores.fill(-2);scores[winner]=6;}else{scores[winner]=6;scores[from]=-6;}
 return scores;
}
export function deal(tiles=wall()) {
 const g={wall:[...tiles],hands:[[],[],[],[]],melds:[[],[],[],[]],discards:[],turn:0,phase:'discard',pending:null,result:null};
 for(let i=0;i<13;i++)for(let s=0;s<4;s++)g.hands[s].push(g.wall.pop());
 g.hands[0].push(g.wall.pop());return g;
}
const fail=message=>{throw new Error(message);};
function take(hand,tiles){const copy=[...hand];for(const t of tiles){const i=copy.indexOf(t);if(i<0)fail('You do not own those tiles.');copy.splice(i,1);}return copy;}
function finish(g,s,from,self){g.phase='finished';g.pending=null;g.result={winner:s,from,selfDraw:self,scores:settlement(s,from,self)};}
function draw(g,s){g.turn=s;if(!g.wall.length){g.phase='finished';g.result={winner:null,scores:[0,0,0,0]};return;}g.hands[s].push(g.wall.pop());g.phase='discard';}
export function choices(g,s){
 if(g.phase!=='claim'||s===g.pending.from)return [];
 const t=g.pending.tile,h=g.hands[s],n=h.filter(x=>x===t).length,opts=[];
 if(winning([...h,t],g.melds[s]))opts.push({type:'win'});
 if(n>=3&&g.wall.length)opts.push({type:'kong',tiles:[t,t,t]});
 if(n>=2)opts.push({type:'pung',tiles:[t,t]});
 if(s===(g.pending.from+1)%4 && t<27)for(let start=t-2;start<=t;start++){
 if(start<0||start%9>6||Math.floor(start/9)!==Math.floor(t/9))continue;
 const tiles=[start,start+1,start+2];tiles.splice(tiles.indexOf(t),1);
 try{take(h,tiles);opts.push({type:'chow',tiles});}catch{}
 }
 return opts;
}
export function resolve(g){
 if(g.phase!=='claim')return;
 const p=g.pending;
 const ranked=Object.entries(p.responses).filter(([,a])=>a.type!=='pass').sort(([sa,a],[sb,b])=>{
 const rank={win:3,pung:2,kong:2,chow:1};return rank[b.type]-rank[a.type]||((+sa-p.from+4)%4)-((+sb-p.from+4)%4);
 });
 if(!ranked.length){g.pending=null;draw(g,(p.from+1)%4);return;}
 const [seat,a]=ranked[0],s=+seat;
 if(a.type==='win'){finish(g,s,p.from,false);return;}
 g.hands[s]=take(g.hands[s],a.tiles);g.melds[s].push({type:a.type,tiles:[...a.tiles,p.tile].sort((a,b)=>a-b),from:p.from});
 g.discards[g.discards.length-1].claimed=true;g.pending=null;g.turn=s;
 if(a.type==='kong')draw(g,s);else g.phase='discard';
}
export function move(g,s,a,now=Date.now()) {
 if(!Number.isInteger(s)||s<0||s>3||!a||typeof a.type!=='string')fail('Invalid action.');
 if(g.phase==='finished')fail('This hand has ended.');
 if(g.phase==='claim'){
 if(s===g.pending.from||g.pending.responses[s])fail('You cannot respond now.');
 const option=a.type==='pass'?{type:'pass'}:choices(g,s).find(o=>o.type===a.type&&JSON.stringify(o.tiles||[])===JSON.stringify(a.tiles||[]));
 if(!option)fail('Illegal claim.');g.pending.responses[s]=option;
 if(Object.keys(g.pending.responses).length===3)resolve(g);return;
 }
 if(s!==g.turn)fail('Wait for your turn.');
 if(a.type==='win'){
 if(!winning(g.hands[s],g.melds[s]))fail('This is not a winning hand.');finish(g,s,s,true);return;
 }
 if(a.type==='concealed-kong'){
 if(!validTile(a.tile)||g.hands[s].filter(t=>t===a.tile).length!==4||!g.wall.length)fail('Illegal kong.');
 g.hands[s]=take(g.hands[s],[a.tile,a.tile,a.tile,a.tile]);g.melds[s].push({type:'concealed-kong',tiles:Array(4).fill(a.tile)});draw(g,s);return;
 }
 if(a.type==='added-kong'){
 const m=g.melds[s].find(m=>m.type==='pung'&&m.tiles[0]===a.tile);
 if(!m||!validTile(a.tile)||!g.hands[s].includes(a.tile)||!g.wall.length)fail('Illegal kong.');
 g.hands[s]=take(g.hands[s],[a.tile]);m.type='kong';m.tiles.push(a.tile);draw(g,s);return;
 }
 if(a.type!=='discard'||!validTile(a.tile))fail('Choose a tile to discard.');
 g.hands[s]=take(g.hands[s],[a.tile]);g.discards.push({seat:s,tile:a.tile,claimed:false});
 g.phase='claim';g.pending={id:g.discards.length,from:s,tile:a.tile,responses:{},deadline:now+15000};
 for(let other=0;other<4;other++)if(other!==s&&!choices(g,other).length)g.pending.responses[other]={type:'pass'};
 if(Object.keys(g.pending.responses).length===3)resolve(g);
}
export function view(g,s){
 if(!g)return null;
 return {phase:g.phase,turn:g.turn,wallCount:g.wall.length,hand:[...g.hands[s]].sort((a,b)=>a-b),
 players:g.hands.map((h,i)=>({count:h.length,melds:g.melds[i]})),discards:g.discards,
 pending:g.pending?{id:g.pending.id,from:g.pending.from,tile:g.pending.tile,deadline:g.pending.deadline,responded:!!g.pending.responses[s]}:null,
 choices:g.phase==='claim'&&!g.pending.responses[s]?choices(g,s):[],result:g.result,
 revealed:g.phase==='finished'?g.hands:null,
 canWin:g.phase==='discard'&&g.turn===s&&winning(g.hands[s],g.melds[s]),
 kongs:g.phase==='discard'&&g.turn===s&&g.wall.length? [...new Set(g.hands[s])].flatMap(t=>g.hands[s].filter(x=>x===t).length===4?[{type:'concealed-kong',tile:t}]:g.melds[s].some(m=>m.type==='pung'&&m.tiles[0]===t)?[{type:'added-kong',tile:t}]:[]):[]};
}
