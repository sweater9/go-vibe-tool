/* Combined release gate: retain every suite's exit status and continue after failures.
   No deployment, remote-site checks, test filtering, or skipped failures. */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
const [mode = 'static', engine = 'chromium', target = 'dist'] = process.argv.slice(2);
if (!['static', 'browser'].includes(mode) || !['chromium', 'firefox', 'webkit'].includes(engine) || !['source', 'dist'].includes(target)) throw Error('Usage: test-v9-release.mjs static | browser <engine> <source|dist>');
const out = path.resolve('artifacts/v9-release', mode === 'static' ? 'static' : `${engine}-${target}`);
fs.mkdirSync(out, { recursive: true });
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const dirty = !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
const env = { ...process.env, V9_BIG_GIB: '1', V9_QA_ARTIFACTS: path.join(out, 'agent1'), MEDIA_ARTIFACTS: path.join(out, 'media') };
env.SITE_ROOT = target === 'source' ? '.' : 'dist';
const legacy = ['v8-integration-browser', 'v8-combined-browser', 'v8-developer-browser', 'file-media-browser', 'v8-browser', 'knowledge-v4-dist-browser', 'labs-browser', 'play-games-browser'];
const commands = mode === 'static'
  ? [...JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts.test.split(' && '), 'node --test tests/v9-media.mjs', 'node tests/v9-agent1-dist.mjs', 'node scripts/verify-dist.mjs dist', 'node --test tests/mahjong-cloudflare.mjs']
  : ['v9-agent1-browser', 'v9-media-browser', 'v9-combined-browser', ...legacy].map((name) => `node tests/${name}.mjs ${engine}`);
const results = [];
for (const [i, command] of commands.entries()) {
  const log = path.join(out, `${String(i + 1).padStart(2, '0')}.log`);
  const fd = fs.openSync(log, 'w');
  const started = Date.now();
  console.log(`START ${command}`);
  const result = await new Promise((resolve) => {
    const child = spawn(command, { shell: true, env, stdio: ['ignore', fd, fd], detached: true });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; try { process.kill(-child.pid, 'SIGTERM'); } catch {} }, 15 * 60 * 1000);
    child.on('error', error => { clearTimeout(timer); resolve({ exitCode: 1, error: error.message }); });
    child.on('exit', (code, signal) => { clearTimeout(timer); resolve({ exitCode: code ?? 1, signal, timedOut }); });
  });
  fs.closeSync(fd);
  results.push({ command, ...result, elapsedMs: Date.now() - started, log: path.relative(process.cwd(), log) });
  console.log(`${result.exitCode ? 'FAIL' : 'PASS'} ${command} (${Date.now() - started} ms)`);
  if (result.exitCode) {
    console.error(fs.readFileSync(log, 'utf8').slice(-5000));
    if (process.env.GITHUB_ACTIONS) console.error(`::error::${command} failed; see ${path.basename(log)} in v9-release artifacts`);
  }
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ revision, dirty, mode, engine, target, results }, null, 2));
}
process.exitCode = results.some(r => r.exitCode) ? 1 : 0;
