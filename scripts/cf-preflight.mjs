#!/usr/bin/env node
/* Read-only Cloudflare safety checks before deploying the isolated preview Worker.
   Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in the environment. Never prints them.
   Refuses to continue if the target is a production name or already has custom domains. */
const PREVIEW = process.env.PREVIEW_WORKER || 'go-vibe-tool-v8-preview';
const PROTECTED = ['go-vibe-tool', 'govibetool', 'govibetool-production', 'zero-api-scout', 'regwatch', 'linkready', 'social-escapes', 'social-escape'];
const fail = m => { console.error('::error title=Cloudflare preflight failed::' + m); process.exit(1); };
const token = process.env.CLOUDFLARE_API_TOKEN, account = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!token || !account) fail('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set as environment secrets (values are never printed).');
if (!/^[a-f0-9]{32}$/i.test(account)) fail('CLOUDFLARE_ACCOUNT_ID does not look like a 32-character account id.');
if (PROTECTED.includes(PREVIEW)) fail(`Refusing to deploy over the existing Worker "${PREVIEW}". Use a separate preview name.`);
if (!/-preview$/.test(PREVIEW)) fail(`Preview Worker name must end in "-preview" (got "${PREVIEW}").`);
async function api(path) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  let body = null; try { body = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, ok: res.ok && body && body.success !== false, body };
}
const scripts = await api('/workers/scripts');
if (scripts.status === 401 || scripts.status === 403) fail(`The API token cannot read Workers scripts (HTTP ${scripts.status}). Create a token with Account > Workers Scripts > Edit.`);
if (!scripts.ok) fail(`Could not list Workers (HTTP ${scripts.status}).`);
const names = (scripts.body.result || []).map(s => s.id || s.name);
console.log(`Account has ${names.length} Worker(s). Target "${PREVIEW}" ${names.includes(PREVIEW) ? 'already exists (isolated preview, will be updated)' : 'does not exist yet (will be created)'}.`);
const domains = await api(`/workers/domains?service=${encodeURIComponent(PREVIEW)}`);
if (domains.ok) { const d = (domains.body.result || []); if (d.length) fail(`The preview Worker already has custom domains attached (${d.map(x => x.hostname).join(', ')}). It must stay on workers.dev only.`); console.log('No custom domains attached to the preview Worker.'); }
else console.log(`Custom-domain listing not available to this token (HTTP ${domains.status}); that is expected for a token without zone permissions.`);
console.log('Preflight passed: no production Worker is targeted.');
