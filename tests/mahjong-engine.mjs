import {test} from 'node:test';
import assert from 'node:assert/strict';
import {wall,deal,winning,move,choices,resolve,settlement,view} from '../multiplayer/engine.mjs';
const hand=[0,1,2,3,4,5,9,10,11,27,27,27,31,31];
test('136 tiles, four of each, randomized wall and 14/13/13/13 deal',()=>{for(let n=0;n<30;n++){const w=wall();assert.equal(w.length,136);for(let t=0;t<34;t++)assert.equal(w.filter(x=>x===t).length,4);const g=deal(w);assert.deepEqual(g.hands.map(h=>h.length),[14,13,13,13]);assert.equal(g.wall.length,83);assert.deepEqual([...g.wall,...g.hands.flat()].sort((a,b)=>a-b),w.sort((a,b)=>a-b));}});
test('standard hands, honor triplets, ambiguous decompositions and open kongs',()=>{assert.ok(winning(hand));assert.ok(winning([0,0,0,1,1,1,2,2,2,3,3,3,4,4]));assert.ok(winning(hand.slice(3),[{type:'kong',tiles:[20,20,20,20]}]));assert.ok(!winning(hand.slice(1)));assert.ok(!winning([0,1,2,3,4,5,9,10,11,27,28,29,31,31]));assert.ok(!winning([0,0,1,1,3,3,5,5,7,7,9,9,11,11]));assert.ok(!winning(Array(14).fill(0)));assert.ok(!winning([...hand.slice(1),34]));});
test('server validates turn, tile ownership and self draw; hidden opponent hands',()=>{const g=deal();assert.throws(()=>move(g,1,{type:'discard',tile:g.hands[1][0]}));assert.throws(()=>move(g,0,{type:'discard',tile:99}));assert.throws(()=>move(g,0,{type:'discard',tile:'0'}));g.hands[0]=hand;const v=view(g,1);assert.equal(v.hand.length,13);assert.equal(v.players[0].hand,undefined);assert.equal(v.revealed,null);move(g,0,{type:'win'});assert.deepEqual(g.result.scores,[6,-2,-2,-2]);assert.equal(view(g,1).revealed.length,4);assert.throws(()=>move(g,0,{type:'win'}));});
function claimGame(){const g=deal();g.hands[0]=[...hand];g.hands[1]=[31,31,0,2,4,6,8,10,12,14,16,18,20];g.hands[2]=[...hand.slice(0,13)];g.hands[3]=[1,3,5,7,9,11,13,15,17,19,21,23,25];return g;}
test('claim priority, responder rejection, duplicate rejection and discard win',()=>{const g=claimGame();move(g,0,{type:'discard',tile:31},100);assert.ok(choices(g,1).some(a=>a.type==='pung'));assert.ok(choices(g,2).some(a=>a.type==='win'));assert.throws(()=>move(g,0,{type:'pass'}));move(g,1,{type:'pung',tiles:[31,31]});assert.throws(()=>move(g,1,{type:'pass'}));move(g,2,{type:'win'});assert.equal(g.result.winner,2);assert.deepEqual(g.result.scores,[-6,0,6,0]);});
test('chow only next seat and same suit; pung consumes tiles and changes turn',()=>{const g=claimGame();move(g,0,{type:'discard',tile:31});move(g,2,{type:'pass'});move(g,1,{type:'pung',tiles:[31,31]});assert.equal(g.turn,1);assert.equal(g.phase,'discard');assert.equal(g.hands[1].length,11);assert.equal(g.discards[0].claimed,true);
 const c=deal();c.hands[0]=[1,...hand.slice(1)];c.hands[1]=[0,2,...hand.slice(3)];c.hands[2]=[0,2,...hand.slice(3)];move(c,0,{type:'discard',tile:1});assert.ok(choices(c,1).some(a=>a.type==='chow'));assert.ok(!choices(c,2).some(a=>a.type==='chow'));});
test('pass/deadline moves clockwise, wall exhaustion draws, kong replacement',()=>{const g=claimGame();move(g,0,{type:'discard',tile:31},100);resolve(g);assert.equal(g.turn,1);assert.equal(g.hands[1].length,14);
 const k=deal();k.hands[0]=[0,0,0,0,...hand.slice(4)];const count=k.wall.length;move(k,0,{type:'concealed-kong',tile:0});assert.equal(k.wall.length,count-1);assert.equal(k.hands[0].length,11);assert.equal(k.melds[0][0].tiles.length,4);assert.throws(()=>move(k,0,{type:'concealed-kong',tile:0}));
 const d=claimGame();d.wall=[];move(d,0,{type:'discard',tile:31});resolve(d);assert.equal(d.result.winner,null);assert.deepEqual(d.result.scores,[0,0,0,0]);});
test('zero sum fixed scoring for every seat and payer',()=>{for(let s=0;s<4;s++)for(let p=0;p<4;p++){assert.equal(settlement(s,p,true).reduce((a,b)=>a+b),0);if(s!==p){assert.equal(settlement(s,p,false)[s],6);assert.equal(settlement(s,p,false)[p],-6);}}});
test('discard kong, added kong and equal winning claims use seat order',()=>{
 const g=claimGame();g.hands[1]=[31,31,31,...g.hands[1].slice(3)];move(g,0,{type:'discard',tile:31});move(g,1,{type:'kong',tiles:[31,31,31]});move(g,2,{type:'pass'});assert.equal(g.turn,1);assert.equal(g.melds[1][0].type,'kong');assert.equal(g.hands[1].length,11);
 const a=deal();a.hands[0]=[31,...hand.slice(4)];a.melds[0]=[{type:'pung',tiles:[31,31,31],from:1}];const n=a.wall.length;move(a,0,{type:'added-kong',tile:31});assert.equal(a.melds[0][0].tiles.length,4);assert.equal(a.wall.length,n-1);
 const w=claimGame();w.hands[1]=hand.slice(0,13);w.hands[2]=hand.slice(0,13);move(w,0,{type:'discard',tile:31});move(w,2,{type:'win'});assert.equal(w.phase,'claim');move(w,1,{type:'win'});assert.equal(w.result.winner,1);
});
test('complete hands preserve all 136 tiles while rotating through every seat',()=>{
 for(let run=0;run<20;run++){
 const g=deal(),seats=new Set();let turns=0;
 while(g.phase!=='finished'){
 if(g.phase==='claim'){resolve(g);continue;}seats.add(g.turn);
 move(g,g.turn,{type:'discard',tile:g.hands[g.turn][0]});
 const tiles=[...g.wall,...g.hands.flat(),...g.melds.flatMap(ms=>ms.flatMap(m=>m.tiles)),...g.discards.filter(d=>!d.claimed).map(d=>d.tile)];assert.equal(tiles.length,136);for(let t=0;t<34;t++)assert.equal(tiles.filter(x=>x===t).length,4);
 if(++turns>136)throw Error('Nonterminating game');
 }
 assert.equal(seats.size,4);assert.equal(g.result.winner,null);
 }
});
