import {writeFileSync} from 'node:fs';
if(process.env.MAHJONG_API){
 if(process.env.CF_PAGES_BRANCH!=='feature/v8-discovery-navigation')throw Error('Only approved Pages preview may enable multiplayer.');
 const url=new URL(process.env.MAHJONG_API);
 if(url.protocol!=='https:'||url.pathname!=='/'||url.search||url.hash||url.username||url.password)throw Error('MAHJONG_API must be an HTTPS origin.');
 writeFileSync('dist/play/mahjong/config.js','window.MAHJONG_API='+JSON.stringify(url.origin)+';window.MAHJONG_TRANSPORT="websocket";\n');
}
