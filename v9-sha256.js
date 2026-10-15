/* V9 incremental SHA-256 (FIPS 180-4) for hashing very large files locally.
   Web Crypto's crypto.subtle.digest is one-shot: it needs the whole file in memory. This implementation is fed bounded
   Blob slices (default 4 MiB), so memory use stays flat for multi-GB files. Bytes never leave the device. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.GVTV9=Object.assign(root.GVTV9||{},api);})(typeof self!=="undefined"?self:globalThis,function(){"use strict";

const K=new Int32Array([
0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
const W=new Int32Array(64);   /* shared scratch: hashing is synchronous per block */
const HEX=Array.from({length:256},(_,i)=>(i<16?"0":"")+i.toString(16));

class Sha256{
  constructor(){this.reset();}
  reset(){
    this.h=new Int32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
    this.buf=new Uint8Array(64);this.bufLen=0;this.length=0;this.done=false;return this;
  }
  _block(b,o){
    const h=this.h;
    for(let i=0;i<16;i++,o+=4)W[i]=(b[o]<<24)|(b[o+1]<<16)|(b[o+2]<<8)|b[o+3];
    for(let i=16;i<64;i++){
      const a=W[i-15],c=W[i-2];
      const s0=((a>>>7)|(a<<25))^((a>>>18)|(a<<14))^(a>>>3);
      const s1=((c>>>17)|(c<<15))^((c>>>19)|(c<<13))^(c>>>10);
      W[i]=(W[i-16]+s0+W[i-7]+s1)|0;
    }
    let a=h[0],bb=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],hh=h[7];
    for(let i=0;i<64;i++){
      const S1=((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7));
      const ch=(e&f)^(~e&g);
      const t1=(hh+S1+ch+K[i]+W[i])|0;
      const S0=((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10));
      const maj=(a&bb)^(a&c)^(bb&c);
      const t2=(S0+maj)|0;
      hh=g;g=f;f=e;e=(d+t1)|0;d=c;c=bb;bb=a;a=(t1+t2)|0;
    }
    h[0]=(h[0]+a)|0;h[1]=(h[1]+bb)|0;h[2]=(h[2]+c)|0;h[3]=(h[3]+d)|0;h[4]=(h[4]+e)|0;h[5]=(h[5]+f)|0;h[6]=(h[6]+g)|0;h[7]=(h[7]+hh)|0;
  }
  update(data){
    if(this.done)throw Error("Hash already finalised; call reset().");
    if(!(data instanceof Uint8Array))data=data instanceof ArrayBuffer?new Uint8Array(data):ArrayBuffer.isView(data)?new Uint8Array(data.buffer,data.byteOffset,data.byteLength):new Uint8Array(data);
    let i=0;const n=data.length;
    this.length+=n;
    if(this.bufLen){
      const take=Math.min(64-this.bufLen,n);
      this.buf.set(data.subarray(0,take),this.bufLen);this.bufLen+=take;i=take;
      if(this.bufLen<64)return this;
      this._block(this.buf,0);this.bufLen=0;
    }
    for(;i+64<=n;i+=64)this._block(data,i);
    if(i<n){this.buf.set(data.subarray(i),0);this.bufLen=n-i;}
    return this;
  }
  digest(){
    if(this.done)throw Error("Hash already finalised; call reset().");
    const bits=this.length*8;                 /* exact up to 2^53 bits (~1 PiB) */
    const hi=Math.floor(bits/4294967296),lo=bits>>>0;
    const padLen=this.bufLen<56?56-this.bufLen:120-this.bufLen;
    const tail=new Uint8Array(padLen+8);tail[0]=0x80;
    tail[padLen]=hi>>>24;tail[padLen+1]=hi>>>16;tail[padLen+2]=hi>>>8;tail[padLen+3]=hi;
    tail[padLen+4]=lo>>>24;tail[padLen+5]=lo>>>16;tail[padLen+6]=lo>>>8;tail[padLen+7]=lo;
    const saved=this.length;this.update(tail);this.length=saved;
    let out="";
    for(let i=0;i<8;i++){const v=this.h[i];out+=HEX[(v>>>24)&255]+HEX[(v>>>16)&255]+HEX[(v>>>8)&255]+HEX[v&255];}
    this.done=true;return out;
  }
}
function sha256Hex(bytes){return new Sha256().update(bytes).digest();}
function sha256Text(text){return sha256Hex(new TextEncoder().encode(String(text)));}

/* ---------- Blob / File hashing ---------- */
const MIN_CHUNK=64*1024,MAX_CHUNK=64*1024*1024,DEFAULT_CHUNK=4*1024*1024;
function readSlice(blob,start,end){
  const part=blob.slice(start,end);
  if(typeof part.arrayBuffer==="function")return part.arrayBuffer().then(b=>new Uint8Array(b));
  return new Promise((resolve,reject)=>{      /* older WebKit: FileReader fallback */
    const r=new FileReader();
    r.onload=()=>resolve(new Uint8Array(r.result));
    r.onerror=()=>reject(r.error||Error("Could not read the file."));
    r.readAsArrayBuffer(part);
  });
}
const tick=()=>new Promise(r=>setTimeout(r,0));
/* hashBlob(blob, {chunkSize, signal, onProgress}) -> Promise<{hex, bytes, ms}>. Rejects with name "AbortError" on cancel. */
async function hashBlob(blob,opts){
  opts=opts||{};
  const size=blob.size,chunk=Math.min(MAX_CHUNK,Math.max(MIN_CHUNK,opts.chunkSize|0||DEFAULT_CHUNK));
  const h=new Sha256(),t0=(typeof performance!=="undefined"?performance:Date).now();
  const abort=()=>{const e=Error("Hashing cancelled.");e.name="AbortError";return e;};
  let off=0,lastYield=t0;
  if(opts.onProgress)opts.onProgress({loaded:0,total:size,ms:0});
  while(off<size){
    if(opts.signal&&opts.signal.aborted)throw abort();
    const end=Math.min(size,off+chunk);
    const bytes=await readSlice(blob,off,end);
    if(bytes.length!==end-off)throw Error("The file changed or could not be read completely.");
    if(opts.signal&&opts.signal.aborted)throw abort();
    h.update(bytes);off=end;
    const now=(typeof performance!=="undefined"?performance:Date).now();
    if(opts.onProgress)opts.onProgress({loaded:off,total:size,ms:now-t0});
    if(now-lastYield>40){await tick();lastYield=(typeof performance!=="undefined"?performance:Date).now();}  /* keep the page responsive */
  }
  return{hex:h.digest(),bytes:size,ms:(typeof performance!=="undefined"?performance:Date).now()-t0};
}

/* ---------- Expected-checksum parsing ---------- */
/* Accepts a bare hash, "sha256:HASH", or sha256sum / shasum lines ("HASH  name" or "HASH *name"). Returns [{hash, name}]. */
function parseChecksums(text){
  const out=[];
  for(const raw of String(text==null?"":text).split(/\r?\n/)){
    const line=raw.trim();if(!line||line[0]==="#")continue;
    let m=/^(?:sha-?256\s*[:=]\s*)?([0-9a-fA-F]{64})(?:\s+\*?(.+))?$/i.exec(line);
    if(!m){m=/^SHA256\s*\((.+)\)\s*=\s*([0-9a-fA-F]{64})$/i.exec(line);if(m)out.push({hash:m[2].toLowerCase(),name:m[1]});continue;}
    out.push({hash:m[1].toLowerCase(),name:m[2]?m[2].trim():""});
  }
  return out;
}
function compareChecksum(actualHex,expectedText,fileName){
  const list=parseChecksums(expectedText);
  if(!list.length)return{state:"invalid",message:"Expected value is not a 64-character hexadecimal SHA-256 hash."};
  const hit=list.find(e=>e.hash===String(actualHex).toLowerCase());
  if(hit)return{state:"match",message:"Match: the file's SHA-256 equals the expected value.",name:hit.name};
  const byName=fileName&&list.find(e=>e.name&&e.name.replace(/^.*[\\/]/,"")===fileName);
  if(byName)return{state:"mismatch",message:"MISMATCH: the file does not match the checksum listed for "+fileName+". Do not trust this file.",name:byName.name};
  return{state:"mismatch",message:"MISMATCH: the computed hash does not equal the expected value.",name:""};
}
function formatSha256Sum(entries){return entries.map(e=>e.hex+"  "+e.name).join("\n");}

return{Sha256,sha256Hex,sha256Text,hashBlob,parseChecksums,compareChecksum,formatSha256Sum,SHA256_DEFAULT_CHUNK:DEFAULT_CHUNK};});
