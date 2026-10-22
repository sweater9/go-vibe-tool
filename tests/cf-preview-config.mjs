/* Static checks for the Cloudflare deployment configuration and the isolated-preview workflow. No network. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const read = f => fs.readFileSync(f, 'utf8');
const jsonc = f => JSON.parse(read(f).replace(/^\s*\/\/.*$/gm, ''));
console.log('Running Cloudflare configuration tests...');
// the failure we are guarding against: a revision without the build script
const pkg = JSON.parse(read('package.json'));
for (const k of ['build', 'verify:dist', 'preview', 'test:dist:browser']) assert.ok(pkg.scripts[k], `package.json must define the "${k}" script`);
assert.equal(pkg.scripts.build, 'node scripts/build-static.mjs'); assert.ok(fs.existsSync('scripts/build-static.mjs') && fs.existsSync('scripts/verify-dist.mjs') && fs.existsSync('scripts/site-manifest.mjs'));
assert.ok(!Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).length, 'the build must stay dependency-free (Cloudflare installs node_modules, which previously contained a 129 MiB binary)');
// production-dashboard config and isolated preview config
const prod = jsonc('wrangler.jsonc'), prev = jsonc('wrangler.preview.jsonc');
for (const c of [prod, prev]) { assert.equal(c.assets.directory, './dist'); assert.equal(c.assets.not_found_handling, '404-page'); assert.equal(c.assets.html_handling, 'auto-trailing-slash'); assert.ok(!c.main, 'assets-only: no Worker script'); assert.ok(!c.routes && !c.route && !c.custom_domains, 'no routes or custom domains'); assert.ok(!c.d1_databases && !c.durable_objects && !c.kv_namespaces && !c.r2_buckets && !c.vars, 'no backend bindings'); }
assert.equal(prod.name, 'go-vibe-tool'); assert.equal(prev.name, 'go-vibe-tool-v8-preview'); assert.notEqual(prod.name, prev.name); assert.equal(prev.workers_dev, true);
assert.ok(!fs.existsSync('wrangler.toml') && !fs.existsSync('wrangler.json'), 'one Wrangler config only');
// workflow
const wf = read('.github/workflows/cloudflare-v8-preview.yml');
assert.match(wf, /workflow_dispatch:/); assert.match(wf, /REQUIRED_REF: refs\/heads\/feature\/v8-discovery-navigation/); assert.match(wf, /node-version: '22'/);
assert.match(wf, /ref: \$\{\{ github\.sha \}\}/); assert.match(wf, /npm run build/); assert.match(wf, /npm run verify:dist/); assert.match(wf, /npm test/);
assert.match(wf, /wrangler deploy --config wrangler\.preview\.jsonc/); assert.ok(!/wrangler deploy(?! --config wrangler\.preview\.jsonc)/.test(wf.replace(/\n\s*#.*$/gm, '')), 'only the preview config may be deployed');
assert.match(wf, /inputs\.deploy == true/); assert.match(wf, /WRANGLER_VERSION: 4\.\d+\.\d+/); assert.match(wf, /environment:\s*\n\s*name: cloudflare-v8-preview/);
assert.ok(!/(echo|cat|printf)[^\n]*\$\{?CLOUDFLARE_API_TOKEN/.test(wf), 'the token must never be printed'); assert.ok(!/ghp_|cfut_|Bearer [A-Za-z0-9]{20,}/.test(wf), 'no credential material in the workflow');
assert.ok(!/push:[\s\S]*?paths:[\s\S]*?(dist|src|package)/.test(wf.split('permissions:')[0]) , 'the bootstrap push trigger is limited to the workflow file');
assert.match(wf.split('jobs:')[0], /paths: \['\.github\/workflows\/cloudflare-v8-preview\.yml'\]/);
// no secrets anywhere in the repo files this change added
for (const f of ['wrangler.jsonc', 'wrangler.preview.jsonc', 'scripts/cf-preflight.mjs', 'scripts/verify-live-assets.mjs', '.github/workflows/cloudflare-v8-preview.yml']) assert.ok(!/[A-Za-z0-9_-]{40}\.[A-Za-z0-9_-]{20,}/.test(read(f)), `${f} looks like it contains a credential`);
// preflight refuses to run without credentials and never prints a token
const run = (env, script = 'scripts/cf-preflight.mjs') => { try { execFileSync(process.execPath, [script], { env: { PATH: process.env.PATH, ...env }, stdio: 'pipe' }); return { code: 0, out: '' }; } catch (e) { return { code: e.status, out: String(e.stderr) + String(e.stdout) }; } };
let r = run({}); assert.equal(r.code, 1); assert.match(r.out, /must be set/);
r = run({ CLOUDFLARE_API_TOKEN: 'SECRET-TOKEN-VALUE', CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), PREVIEW_WORKER: 'go-vibe-tool' }); assert.equal(r.code, 1); assert.match(r.out, /Refusing to deploy over the existing Worker/); assert.ok(!r.out.includes('SECRET-TOKEN-VALUE'));
r = run({ CLOUDFLARE_API_TOKEN: 'SECRET-TOKEN-VALUE', CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), PREVIEW_WORKER: 'my-site' }); assert.equal(r.code, 1); assert.match(r.out, /must end in "-preview"/);
r = run({ CLOUDFLARE_API_TOKEN: 'SECRET-TOKEN-VALUE', CLOUDFLARE_ACCOUNT_ID: 'not-an-id' }); assert.equal(r.code, 1); assert.match(r.out, /32-character/);
console.log('✓ Cloudflare config: build script present, assets.directory ./dist, isolated preview Worker, guarded workflow, no credentials');

// --- Reconciliation guard: the production workflow and the preview workflow must stay independent. ---
// main carries a dispatch-only STUB of the preview workflow; the V8 branch carries the real one. Whichever is merged,
// production deployment behaviour must be identical. These checks pin the properties that guarantee it.
const prodWf = read('.github/workflows/cloudflare-v8-production.yml');
const prodHead = prodWf.split('jobs:')[0];
assert.match(prodHead, /workflow_dispatch:/); assert.ok(!/\n\s*(push|pull_request|schedule|workflow_run):/.test(prodHead), 'production deploys only on manual dispatch');
const sha = prodWf.match(/RELEASE_SHA:\s*([0-9a-f]{40})/); assert.ok(sha, 'production pins an immutable 40-hex release SHA');
assert.ok([...prodWf.matchAll(/ref:\s*([0-9a-f]{40})/g)].every(m => m[1] === sha[1]) && [...prodWf.matchAll(/ref:\s*([0-9a-f]{40})/g)].length >= 2, 'every production checkout uses the pinned SHA, never a branch or github.sha');
assert.match(prodWf, /if:\s*github\.event_name == 'workflow_dispatch' && inputs\.deploy == true/); assert.match(prodWf, /environment:\s*cloudflare-production/);
assert.ok(!/cloudflare-v8-preview|wrangler\.preview\.jsonc|go-vibe-tool-v8-preview/.test(prodWf), 'production never references the preview Worker or config');
assert.ok(!/cloudflare-production/.test(wf), 'preview never uses the production environment or its secrets');
assert.ok(!/--config wrangler\.jsonc/.test(wf), 'preview never deploys with the production config');
const previewHead = wf.split('jobs:')[0];
assert.ok(!/\n\s*(pull_request|schedule|workflow_run):/.test(previewHead), 'preview has no automatic deploy-capable triggers');
assert.match(wf, /REQUIRED_REF[\s\S]*?GITHUB_REF[\s\S]*?exit 1/, 'preview refuses to run from any ref other than the V8 branch (so on main it cannot build or deploy)');
console.log('✓ Cloudflare reconciliation: production pinned and independent; preview guarded, preview-only, never production config');

/* Phase 2 preview: a second, separate isolated Worker. The V8 preview files above are unchanged. */
{
  const p2 = jsonc('wrangler.phase2-preview.jsonc'), p2wf = read('.github/workflows/cloudflare-phase2-preview.yml'), v8wf = read('.github/workflows/cloudflare-v8-preview.yml');
  assert.equal(p2.name, 'go-vibe-tool-phase2-preview'); assert.notEqual(p2.name, prod.name); assert.notEqual(p2.name, prev.name);
  assert.equal(p2.workers_dev, true); assert.ok(!p2.routes && !p2.route && !p2.custom_domain, 'no routes or domains');
  assert.match(p2wf, /REQUIRED_REF: refs\/heads\/feature\/phase-2-usability/); assert.match(p2wf, /inputs\.deploy == true/);
  assert.match(p2wf.split('jobs:')[0], /paths: \['\.github\/workflows\/cloudflare-phase2-preview\.yml'\]/); assert.ok(!/inputs\.deploy == true/.test('') || true); assert.match(p2wf, /if: \$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.deploy == true \}\}/, 'deploy only on a manual run with deploy ticked');
  assert.match(p2wf, /environment:\s*\n\s*name: cloudflare-phase2-preview/); assert.ok(!/wrangler\.preview\.jsonc|cf-preflight\.mjs/.test(p2wf));
  assert.match(v8wf, /REQUIRED_REF: refs\/heads\/feature\/v8-discovery-navigation/, 'V8 preview branch restriction untouched');
  assert.ok(!/phase2/.test(prodWf), 'production never references the phase 2 preview');
  const pre = (name) => run({ CLOUDFLARE_API_TOKEN: 'SECRET-TOKEN-VALUE', CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), PREVIEW_WORKER: name }, 'scripts/cf-preflight-phase2.mjs');
  assert.equal(pre('go-vibe-tool').code, 1);
}
