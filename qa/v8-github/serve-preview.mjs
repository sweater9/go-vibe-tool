import http from 'node:http';
import {readFileSync,statSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
export function verify(root){
 const manifest=JSON.parse(readFileSync(resolve(root,'preview-provenance.json'),'utf8'));
 assert.equal(manifest.resolvedCommit,'f6685bff58ae91f835b41963239cda2355c8554c');
 assert.equal(manifest.tree,'57754c128de33e3fe0e3a6c8e145bd4afccc3650');
 for(const f of manifest.files){const file=resolve(root,'.'+manifest.prefix,f.path);assert.ok(file.startsWith(resolve(root)+ '/'));const data=readFileSync(file);assert.equal(createHash('sha256').update(data).digest('hex'),f.sha256,'Snapshot checksum mismatch: '+f.path);assert.equal(data.length,f.bytes);}
 return manifest;
}
export function createPreviewServer(root){
 root=resolve(root);const manifest=verify(root);
 const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.txt':'text/plain','.xml':'application/xml'};
 const sockets=new Set();let port;
 const server=http.createServer((req,res)=>{
 try{
 const p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(p!=='/preview-provenance.json'&&!p.startsWith(manifest.prefix)){res.writeHead(404);res.end('Outside isolated preview');return;}
 let file=resolve(root,'.'+p);if(!file.startsWith(root+'/')){res.writeHead(403);res.end();return;}
 if(statSync(file).isDirectory())file=resolve(file,'index.html');
 const data=readFileSync(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);
 }catch{res.writeHead(404);res.end('Not found');}
 });
 server.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));});
 return {server,manifest,
 start:()=>new Promise(r=>server.listen(port||0,'127.0.0.1',()=>{port=server.address().port;r('http://127.0.0.1:'+port);})),
 stop:()=>new Promise(r=>{server.close(r);for(const s of sockets)s.destroy();}),
 close:()=>{server.close();for(const s of sockets)s.destroy();}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const root=process.env.PREVIEW_ROOT||dirname(fileURLToPath(import.meta.url)),svc=createPreviewServer(root),port=Number(process.env.PORT||8080);
 svc.server.listen(port,'127.0.0.1',()=>console.log('Verified commit '+svc.manifest.resolvedCommit+'\nOpen http://127.0.0.1:'+port+svc.manifest.prefix));
}
