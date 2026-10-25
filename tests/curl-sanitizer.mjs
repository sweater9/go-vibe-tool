// Regression coverage for the cURL Code & Token Stripper (sanitizeCurlText / curlToFetch in v2-tools.js).
// Every secret below is a synthetic placeholder. The sanitizer must never let one through.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../v2-tools.js', import.meta.url), 'utf8');
const start = src.indexOf('function sanitizeCurlText(');
const end = src.indexOf('function runCurlSanitizer', start);
assert.ok(start > 0 && end > start, 'sanitizer source not found');
const ctx = vm.createContext({});
vm.runInContext(src.slice(start, end), ctx);
const sanitize = vm.runInContext('sanitizeCurlText', ctx);
const toFetch = vm.runInContext('curlToFetch', ctx);

const S = 'SYNTH3T1CS3CR3T99';
const cases = [
  ['double-quoted Authorization header', `curl https://api.example.com -H "Authorization: Bearer ${S}"`],
  ['single-quoted Authorization header', `curl https://api.example.com -H 'Authorization: Bearer ${S}'`],
  ['--header long flag', `curl https://api.example.com --header "Authorization: Token ${S}"`],
  ['Authorization header containing both quote kinds', `curl https://api.example.com -H "Authorization: Bearer ${S}" -H 'Accept: "x"'`],
  ['Basic auth header', `curl https://api.example.com -H "Authorization: Basic ${S}=="`],
  ['Cookie header', `curl https://api.example.com -H 'Cookie: session=${S}; theme=dark'`],
  ['X-API-Key header', `curl https://api.example.com -H "X-API-Key: ${S}"`],
  ['custom x-auth-token header', `curl https://api.example.com -H "X-Auth-Token: ${S}"`],
  ['lowercase api-key header', `curl https://api.example.com -H "api-key: ${S}"`],
  ['-u user:password', `curl -u admin:${S} https://api.example.com`],
  ['--user=user:password', `curl --user=admin:${S} https://api.example.com`],
  ['quoted --user', `curl --user "admin:${S}" https://api.example.com`],
  ['-b cookie string', `curl -b "session=${S}" https://api.example.com`],
  ['--cookie string', `curl --cookie 'sid=${S}' https://api.example.com`],
  ['--oauth2-bearer', `curl --oauth2-bearer ${S} https://api.example.com`],
  ['URL userinfo', `curl https://admin:${S}@api.example.com/v1`],
  ['api_key query parameter', `curl "https://api.example.com/v1?api_key=${S}&q=1"`],
  ['apikey query parameter', `curl "https://api.example.com/v1?q=1&apikey=${S}"`],
  ['client_secret query parameter', `curl "https://api.example.com/v1?client_secret=${S}"`],
  ['signature query parameter', `curl "https://api.example.com/v1?Signature=${S}"`],
  ['form body password', `curl -d "user=a&password=${S}" https://api.example.com/login`],
  ['single-quoted form body token', `curl --data 'grant=x&refresh_token=${S}' https://api.example.com`],
  ['--data-urlencode with spaces', `curl --data-urlencode "password=${S} with spaces" https://api.example.com`],
  ['JSON body password', `curl -d '{"user":"a","password":"${S}"}' https://api.example.com`],
  ['JSON body with escaped quotes', `curl -d "{\\"client_secret\\":\\"${S}\\"}" https://api.example.com`],
  ['--json body', `curl --json '{"access_token":"${S}"}' https://api.example.com`],
  ['-F multipart secret', `curl -F "api_key=${S}" -F "file=@a.txt" https://api.example.com`],
  ['env-style secret before curl', `API_TOKEN=${S} curl https://api.example.com`],
  ['export secret', `export SECRET_KEY="${S}"\ncurl https://api.example.com`],
  ['GitHub token shape', `curl -H "X-Note: ghp_${'a1B2c3D4e5F6g7H8i9J0k1L2m3N4'}" https://api.example.com`],
  ['JWT shape', `curl https://api.example.com/x/eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJlMTIz`],
  ['AWS key id shape', `curl https://api.example.com -d 'id=AKIAABCDEFGHIJKLMNOP'`],
  ['multi-line command with backslashes', `curl https://api.example.com \\\n  -H "Authorization: Bearer ${S}" \\\n  -d 'password=${S}'`],
];

const leaks = [];
for (const [name, input] of cases) {
  const out = sanitize(input);
  const fetched = toFetch(input);
  const probes = [S, 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4', 'c2lnbmF0dXJlMTIz', 'AKIAABCDEFGHIJKLMNOP'];
  for (const p of probes) {
    if (input.includes(p) && (out.text.includes(p) || fetched.includes(p))) leaks.push(`${name}: leaked ${p}`);
  }
  if (input.includes(S) || /ghp_|eyJ|AKIA/.test(input)) assert.ok(out.removed.length > 0, `${name}: nothing reported as removed`);
}
assert.deepEqual(leaks, [], 'secrets survived sanitization:\n' + leaks.join('\n'));

// Structure must survive: non-secret parts are preserved.
const keep = sanitize(`curl -X POST https://api.example.com/v1/items?page=2 -H "Accept: application/json" -d '{"name":"widget"}'`);
assert.equal(keep.removed.length, 0, 'benign request should not be altered');
assert.ok(keep.text.includes('page=2') && keep.text.includes('Accept: application/json') && keep.text.includes('"name":"widget"'));

const f = toFetch(`curl -X POST https://api.example.com/v1 -H "Authorization: Bearer ${S}" -H "Accept: application/json" -d '{"a":1}'`);
assert.ok(f.includes('"Authorization": "[REDACTED]"') && f.includes('"Accept": "application/json"') && !f.includes(S), 'fetch conversion keeps headers and hides the token');

// The page must tell users to review output before sharing.
assert.ok(/Review the output before sharing/.test(src.slice(src.indexOf('function curlSanitizerTemplate'), src.indexOf('function initCurlSanitizer'))), 'visible review-before-sharing warning is required');
console.log(`curl sanitizer: ${cases.length} secret forms redacted, benign request preserved, warning present`);
