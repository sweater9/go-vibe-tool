/* Run the unchanged Knowledge acceptance assertions against an isolated built origin. */
import {createDistServer} from '../scripts/serve-dist.mjs';
import {spawn} from 'node:child_process';
const engine=process.argv[2]||'chromium';
const server=createDistServer(process.env.SITE_ROOT||'dist');await server.start();
try {
 const code=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['tests/knowledge-v4-browser.mjs',engine],{stdio:'inherit',env:{...process.env,KNOWLEDGE_BASE_URL:server.base.replace(/\/$/,''),KNOWLEDGE_ARTIFACTS:`artifacts/knowledge-${engine}`}});
  child.on('error',reject);child.on('exit',(code,signal)=>resolve(signal?1:code));
 });
 if(code)process.exitCode=code;
} finally {await server.stop();}
