/* Validate the intentionally failing Firefox probe, not a weakened product assertion. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=process.argv[2]||'artifacts/studios-diagnostics-probe-firefox';
const result=JSON.parse(fs.readFileSync(path.join(root,'results.json')));
assert.equal(result.engine,'firefox');
const failures=result.results.filter(check=>!check.ok);
assert.equal(failures.length,2);assert.ok(failures.every(check=>check.error==='Controlled diagnostic artifact probe'));
for(const width of [375,1280]){
 const data=JSON.parse(fs.readFileSync(path.join(root,`interactions-${width}.json`)));
 assert.equal(data.droppedEvents,0);assert.equal(data.collectionError,null);
 for(const type of ['pointerdown','pointerup','click','tab-selection','analysis-request','analysis-complete','analysis-result'])assert.ok(data.events.some(event=>event.type===type),`${width}: ${type}`);
 const calculation=data.events.find(event=>event.type==='analysis-request'&&event.control==='urlAnalyze');assert.ok(calculation);assert.match(calculation.check,/initial route/);
 const valid=spawnSync('python3',['-c','import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; assert any(n.endswith(".trace") for n in z.namelist()); assert any(n.endswith(".network") for n in z.namelist())',path.join(root,`trace-${width}.zip`)],{encoding:'utf8'});
 assert.equal(valid.status,0,valid.stderr);
}
console.log('Firefox failure probe: both event logs and valid Playwright traces retained.');
