import {resolve} from 'node:path';
export async function runtime(port=0,persist=false){
 const {Miniflare}=await import(process.env.MINIFLARE_PACKAGE||'miniflare');
 const mf=new Miniflare({modules:true,scriptPath:resolve('multiplayer/cloudflare/worker.mjs'),modulesRules:[{type:'ESModule',include:['**/*.mjs']}],compatibilityDate:'2026-08-06',compatibilityFlags:['nodejs_compat'],port,bindings:{ALLOWED_ORIGINS:'http://localhost:8080'},durableObjects:{ROOMS:{className:'MahjongRoom',useSQLite:true},REGISTRY:{className:'RoomRegistry',useSQLite:true}},durableObjectsPersist:persist,ratelimits:{IP_LIMIT:{namespace_id:'1001',simple:{limit:120,period:60}},CREATE_LIMIT:{namespace_id:'1002',simple:{limit:6,period:60}}}});
 await mf.ready;return {mf,close:()=>mf.dispose()};
}
