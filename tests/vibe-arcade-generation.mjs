import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
const html=fs.readFileSync(new URL('../play/vibe-arcade/index.html',import.meta.url),'utf8');
const code=html.split('/*PURE-START*/')[1].split('/*PURE-END*/')[0];
const ctx=vm.createContext({Math,Array,Object});vm.runInContext(code,ctx);
const adjacent=(a,b,n)=>Math.abs(Math.floor(a/n)-Math.floor(b/n))+Math.abs(a%n-b%n)===1;
const timings={};
for(const kind of ['vl','tw','ca']){
 let slow={ms:0,level:0},t0=performance.now();
 for(let L=1;L<=120;L++){
  const seed=`arcade-${kind}-L${L}`,make=ctx[kind+'Make'];let start=performance.now();
  const p=make(seed,L); const ms=performance.now()-start;
  if(ms>slow.ms)slow={ms:Math.round(ms*100)/100,level:L};
  assert.equal(JSON.stringify(p),JSON.stringify(make(seed,L)),kind+' deterministic '+L);
  const n=p.n,N=n*n;
  if(kind==='vl'){
   assert.equal(p.sol.length,N);assert.equal(new Set(p.sol).size,N);
   for(let i=1;i<N;i++){assert(adjacent(p.sol[i-1],p.sol[i],n));let a=p.sol[i-1],b=p.sol[i],edge=[a,b].sort((a,b)=>a-b).join('-');assert(!p.wallSet[edge]);assert(!p.oneSet[b+'>'+a]);}
   let indices=p.cellOf.slice(1).map(c=>p.sol.indexOf(c));assert(indices.every((x,i)=>i===0||x>indices[i-1]));
  }else if(kind==='tw'){
   assert.equal(p.sol.length,N);assert(p.sol.every(x=>x===0||x===1));
   for(const line of p.lines){let vals=line.map(i=>p.sol[i]);assert.equal(vals.filter(x=>x===0).length,n/2);for(let j=2;j<n;j++)assert(!(vals[j]===vals[j-1]&&vals[j]===vals[j-2]));}
   for(let i=0;i<N;i++)if(p.given[i])assert.equal(p.start[i],p.sol[i]);
   for(const e of p.edges)assert.equal(p.sol[e.a]===p.sol[e.b],e.t==='=');
   assert.equal(ctx.twCount(p.start,n,p.lines,p.edges,2,{n:3000}),1,'unique '+L);
  }else{
   const covers=new Array(N).fill(0);let clues=0;
   for(const r of p.sol){let inside=[];for(let y=r.r;y<r.r+r.h;y++)for(let x=r.c;x<r.c+r.w;x++){let i=y*n+x;covers[i]++;inside.push(i)};assert.equal(inside.filter(i=>p.numAt[i]>0).length,1);assert.equal(p.numAt[inside.find(i=>p.numAt[i]>0)],r.h*r.w);clues++;}
   assert(covers.every(x=>x===1));assert.equal(p.numAt.filter(x=>x>0).length,clues);
  }
 }
 timings[kind]={tested:120,totalMs:Math.round(performance.now()-t0),slow};console.log(kind,JSON.stringify(timings[kind]));
}
