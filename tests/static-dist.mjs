import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['scripts/build-static.mjs']);
for(const p of ['index.html','404.html','sw.js','play/mahjong/mahjong.mjs','learn/index.html','labs/workflow/index.html','labs/api-playground/index.html','labs/ai/index.html','labs/cyber/index.html','labs/science/index.html','labs/finance/index.html'])assert.ok(existsSync('dist/'+p),p);
for(const p of ['multiplayer','tests','docs','qa','.github','CNAME','package.json','knowledge/src','play/daily-word/src'])assert.equal(existsSync('dist/'+p),false,p);
assert.equal(readFileSync('dist/ads.txt','utf8'),readFileSync('ads.txt','utf8'));
console.log('Static dist asset preservation and exclusions PASS');
