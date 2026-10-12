const $=id=>document.getElementById(id), API=window.MAHJONG_API;
let state=null,token='',selected=null,busy=false,controller=null,generation=0,connected=false;
const winds=['East','South','West','North'];
function label(t){return t<27?`${t%9+1} ${['Characters','Bamboo','Dots'][Math.floor(t/9)]}`:[...winds,'Red dragon','Green dragon','White dragon'][t-27];}
function status(message){$('status').textContent=message;}
const storageKey='govibe-mahjong-seat';
function remember(){try{sessionStorage.setItem(storageKey,JSON.stringify({code:state.code,token}));}catch{status('Room joined. Tab storage is unavailable; closing this page loses your seat.');}}
function forget(){try{sessionStorage.removeItem(storageKey);}catch{}}
async function request(path,body,auth=true){
 const res=await fetch(API+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(auth?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
 const data=await res.json();if(!res.ok){if(data.state)render(data.state);throw new Error(data.error||'Room service unavailable.');}return data;
}
function button(text,action){const b=document.createElement('button');b.type='button';b.textContent=text;b.disabled=busy||!connected;b.onclick=()=>act(action);return b;}
function render(s){
 const hadGame=!!state?.game;state=s;$('lobby').hidden=true;$('room').hidden=false;$('room-code').textContent='Room code: '+s.code;
 $('expiry').textContent='Room expires by '+new Date(s.expiresAt).toLocaleTimeString()+'. Gameplay extends the idle limit.';
 $('seats').replaceChildren();for(let i=0;i<4;i++){
 const p=s.players[i],seat=document.createElement('section');seat.className='seat'+(s.game?.turn===i?' current':'');
 const h=document.createElement('h3');h.textContent=winds[i]+(i===s.seat?' · You':'')+' — '+(p?.name||'Open seat');seat.append(h);
 const desc=document.createElement('p');desc.textContent=p?(p.connected?'Connected':'Reconnecting / offline')+(p.ready?' · Ready':' · Not ready'):'Invite a friend';seat.append(desc);
 if(s.game){const d=document.createElement('p');d.textContent=s.game.players[i].count+' concealed tiles';seat.append(d);for(const m of s.game.players[i].melds){const x=document.createElement('p');x.className='meld';x.textContent=m.type+': '+m.tiles.map(label).join(' · ');seat.append(x);}}
 $('seats').append(seat);
 }
 const g=s.game;if(g&&!hadGame){$('invite').open=false;$('instructions').open=false;}$('ready').hidden=!!g;$('ready').disabled=busy||!connected||s.players[s.seat].ready;
 $('ready').textContent=s.players[s.seat].ready?'Ready — waiting for friends':"I'm ready";
 $('claims').replaceChildren();$('kongs').replaceChildren();$('hand').replaceChildren();$('revealed').replaceChildren();$('win').hidden=true;$('result').textContent='';$('claim-clock').textContent='';
 if(!g){$('turn').textContent=s.players.length+'/4 friends at the table';$('wall').textContent='The hand starts when four guests are ready.';$('discard').disabled=true;return;}
 const ownTurn=g.phase==='discard'&&g.turn===s.seat;
 $('turn').textContent=g.phase==='finished'?'Hand complete':g.phase==='claim'?'Claim window — choose or pass':winds[g.turn]+(ownTurn?' · Your turn':'')+' to discard';
 $('wall').textContent=g.wallCount+' tiles in the wall';
 $('hand-help').textContent=ownTurn?'Select a tile, then confirm your discard.':g.phase==='finished'?'Create a new room for the next hand.':'Watch the table. Your legal actions appear when available.';
 if(!g.hand.includes(selected))selected=null;
 g.hand.forEach((t,i)=>{const b=document.createElement('button');b.type='button';b.className='tile';b.dataset.tile=t;b.disabled=!ownTurn||busy||!connected;b.setAttribute('aria-label',label(t)+', tile '+(i+1));b.setAttribute('aria-pressed',String(t===selected));const strong=document.createElement('strong');strong.textContent=t<27?t%9+1:['東','南','西','北','中','發','白'][t-27];const small=document.createElement('small');small.textContent=t<27?['Chars','Bamboo','Dots'][Math.floor(t/9)]:label(t);b.append(strong,small);b.onclick=()=>{selected=t;for(const tile of $('hand').children)tile.setAttribute('aria-pressed',String(Number(tile.dataset.tile)===t));$('discard').disabled=!connected||busy;};$('hand').append(b);});
 $('discard').disabled=!ownTurn||selected===null||busy||!connected;
 $('win').hidden=!g.canWin;$('win').disabled=busy||!connected;
 for(const a of g.kongs)$('kongs').append(button('Kong: '+label(a.tile),a));
 if(g.phase==='claim'&&g.pending.from!==s.seat&&!g.pending.responded){for(const a of g.choices)$('claims').append(button(a.type==='win'?'Win — Mahjong':a.type+' '+(a.tiles||[]).map(label).join(' + '),a));$('claims').append(button('Pass',{type:'pass'}));}
 $('discards').replaceChildren();g.discards.forEach((d,i)=>{const li=document.createElement('li');li.textContent=(i+1)+'. '+winds[d.seat]+': '+label(d.tile)+(d.claimed?' (claimed)':'');$('discards').append(li);});
 if(g.result){$('result').textContent=g.result.winner===null?'Draw — the wall is empty.':winds[g.result.winner]+' wins'+(g.result.selfDraw?' by self draw':' on '+winds[g.result.from]+"'s discard")+'. '+g.result.scores.map((n,i)=>winds[i]+': '+(n>0?'+':'')+n).join(' · ');g.revealed.forEach((h,i)=>{const p=document.createElement('p');p.textContent=winds[i]+' concealed hand: '+h.map(label).join(', ');$('revealed').append(p);});}
}
async function act(action){
 if(busy||!state||!connected)return;busy=true;render(state);
 try{const next=await request('/rooms/'+state.code+'/actions',{revision:state.revision,action});if(next.revision>=state.revision)render(next);if(action.type==='discard')selected=null;status('Table synchronized.');}catch(e){status(e.message);}finally{busy=false;if(state)render(state);}
}
async function stream(){
 const run=++generation;controller?.abort();controller=new AbortController();let retry=1000;
 while(run===generation&&state){
 try{
 const res=await fetch(API+'/rooms/'+state.code+'/events',{headers:{Authorization:'Bearer '+token},signal:controller.signal});
 if(!res.ok){if([401,404].includes(res.status)){end('Room expired or seat unavailable. Create a new room.');return;}throw Error('Connection interrupted.');}
 connected=true;status('Connected — your hand is private.');retry=1000;let buffer='';const reader=res.body.getReader(),decoder=new TextDecoder();
 while(run===generation){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let n;while((n=buffer.indexOf('\n\n'))>=0){const event=buffer.slice(0,n);buffer=buffer.slice(n+2);if(event.startsWith('data: ')){const data=JSON.parse(event.slice(6));if(data.expired){end('This room has expired. Create a new room.');return;}if(!state||data.revision>=state.revision)render(data);}}}
 }catch(e){if(e.name==='AbortError')return;}
 if(run!==generation)return;connected=false;if(state)render(state);status('Connection lost. Reconnecting to your reserved seat…');await new Promise(r=>setTimeout(r,retry));retry=Math.min(retry*2,10000);
 }
}
function end(message){generation++;controller?.abort();connected=false;state=null;token='';selected=null;forget();$('room').hidden=true;$('lobby').hidden=false;status(message);}
async function enter(create){
 if(busy)return;busy=true;$('create').disabled=true;$('join-form').querySelector('button').disabled=true;
 try{const code=$('code').value.trim().toLowerCase();if(!create&&!/^[a-f0-9]{24}$/.test(code))throw Error('Enter the full 24-character room code.');const s=await request(create?'/rooms':'/rooms/'+code+'/join',{name:$('name').value},false);token=s.token;delete s.token;selected=null;render(s);remember();history.replaceState(null,'',location.pathname+'#'+s.code);stream();}catch(e){status(e.message);}finally{busy=false;$('create').disabled=!API;$('join-form').querySelector('button').disabled=!API;if(state)render(state);}
}
window.addEventListener('offline',()=>{generation++;controller?.abort();connected=false;if(state){render(state);status('You are offline. Your seat is reserved; reconnect when your network returns.');}});
window.addEventListener('online',()=>{if(state)stream();});
$('create').onclick=()=>enter(true);$('join-form').onsubmit=e=>{e.preventDefault();enter(false);};$('ready').onclick=()=>act({type:'ready'});$('discard').onclick=()=>act({type:'discard',tile:selected});$('win').onclick=()=>act({type:'win'});
$('leave').onclick=()=>{end('You left this device. Your seat stays reserved until expiry.');history.replaceState(null,'',location.pathname);};
async function copy(value){try{await navigator.clipboard.writeText(value);status('Copied. Share privately with your friends.');}catch{status('Clipboard unavailable. Copy the room code shown above.');}}
$('copy-link').onclick=()=>copy(location.origin+location.pathname+'#'+state.code);$('copy-code').onclick=()=>copy(state.code);
setInterval(()=>{if(state?.game?.pending)$('claim-clock').textContent='Claims close in '+Math.max(0,Math.ceil((state.game.pending.deadline-Date.now())/1000))+' seconds. No response counts as pass.';},500);
function invitation(){const code=location.hash.slice(1);if(/^[a-f0-9]{24}$/.test(code)){if(!state)$('code').value=code;else if(state.code!==code)status('You already have a reserved seat. Leave this device before joining another room.');}}
window.addEventListener('hashchange',invitation);invitation();
if(!API){status('Multiplayer preview: the room service is awaiting deployment review. Please return after it is enabled.');$('create').disabled=true;$('join-form').querySelector('button').disabled=true;}
else{
 let saved;try{saved=JSON.parse(sessionStorage.getItem(storageKey));}catch{}
 if(saved&&/^[a-f0-9]{24}$/.test(saved.code)&&(!location.hash||location.hash.slice(1)===saved.code)){token=saved.token;try{render(await request('/rooms/'+saved.code));stream();}catch(e){forget();status(e.message);}}
 else status('Create a private room or join a friend with their code.');
}
