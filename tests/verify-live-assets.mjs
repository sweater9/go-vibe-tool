/* verify-live-assets must pass for identical bytes and fail for tampered, missing or leaked files. Local server only. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, execFile } from 'node:child_process';
import { createDistServer } from '../scripts/serve-dist.mjs';
console.log('Running live-asset verification tests...');
execFileSync(process.execPath, ['scripts/build-static.mjs'], { stdio: 'pipe' });
const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-copy-')); fs.cpSync('dist', copy, { recursive: true });
// async on purpose: the server lives in this process, so a blocking child call would deadlock it
const run = base => new Promise(resolve => execFile(process.execPath, ['scripts/verify-live-assets.mjs', base, 'dist'], (err, stdout, stderr) => resolve({ code: err ? err.code : 0, out: String(stdout) + String(stderr) })));
// 1. identical bytes
let s = createDistServer('dist'); await s.start(); let r = await run(s.base); assert.equal(r.code, 0, r.out); assert.match(r.out, /(\d+)\/\1 files served byte-identical/); await s.stop();
// 2. one tampered file is detected
fs.appendFileSync(path.join(copy, 'labs/ai/ai-app.js'), '\n// tampered'); s = createDistServer(copy); await s.start(); r = await run(s.base); assert.equal(r.code, 1); assert.match(r.out, /labs\/ai\/ai-app\.js: bytes differ/); await s.stop();
// 3. a missing file is detected
fs.rmSync(path.join(copy, 'labs/ai/ai-app.js')); s = createDistServer(copy); await s.start(); r = await run(s.base); assert.equal(r.code, 1); assert.match(r.out, /labs\/ai\/ai-app\.js: HTTP 404/); await s.stop();
// 4. a leaked server file is detected
fs.mkdirSync(path.join(copy, 'multiplayer'), { recursive: true }); fs.writeFileSync(path.join(copy, 'multiplayer/server.mjs'), 'x'); fs.copyFileSync('dist/labs/ai/ai-app.js', path.join(copy, 'labs/ai/ai-app.js')); s = createDistServer(copy); await s.start(); r = await run(s.base); assert.equal(r.code, 1); assert.match(r.out, /multiplayer\/server\.mjs must not be served/); await s.stop();
fs.rmSync(copy, { recursive: true, force: true });
console.log('✓ live-asset verifier: identical passes; tampered, missing and leaked files fail');
