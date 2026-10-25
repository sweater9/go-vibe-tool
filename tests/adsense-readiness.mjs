import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const policy = JSON.parse(read('config/ads-readiness.json'));
const play = read('play/index.html');
const privacy = read('privacy.html');
const contact = read('contact.html');
const terms = read('terms.html');
const home = read('index.html');
const editor = read('tools/pdf-editor/index.html');
const arcade = read('play/vibe-arcade/index.html');

const adLoader = /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js|\badsbygoogle\.push\s*\(/i;

test('ad activation remains disabled until approval and consent integration', () => {
  assert.equal(policy.enabled, false);
  assert.equal(policy.approvalRequired, true);
  assert.equal(policy.privacy.requireConsentManagement, true);
  assert.equal(policy.privacy.blockAdScriptsUntilAllowed, true);
  assert.equal(policy.autoAds, false);
});

test('Play directory has exactly one dormant, non-rendered ad template', () => {
  assert.equal((play.match(/id="play-directory-ad-slot"/g) || []).length, 1);
  assert.match(play, /<template id="play-directory-ad-slot"[^>]*data-ad-status="disabled"/);
  assert.equal((play.match(/class="play-ad-slot"/g) || []).length, 1);
  assert.doesNotMatch(play, adLoader);
});

test('no ad loader in privacy, homepage, editor or active arcade', () => {
  for (const [name, html] of [['privacy', privacy], ['contact', contact], ['terms', terms], ['homepage', home], ['PDF editor', editor], ['Vibe Arcade', arcade]]) {
    assert.doesNotMatch(html, adLoader, name);
  }
  assert.match(editor, /Content-Security-Policy/);
});

test('no HTML page loads the AdSense script while ads are disabled', () => {
  const root = new URL('../', import.meta.url);
  const skip = new Set(['node_modules', 'dist', '.git', 'test-results']);
  const offenders = [];
  const walk = dir => {
    for (const entry of readdirSync(new URL(dir, root), { withFileTypes: true })) {
      if (entry.isDirectory()) { if (!skip.has(entry.name)) walk(dir + entry.name + '/'); continue; }
      if (entry.name.endsWith('.html') && adLoader.test(read(dir + entry.name))) offenders.push(dir + entry.name);
    }
  };
  walk('');
  assert.equal(policy.enabled, false);
  assert.deepEqual(offenders, [], 'ad loader found on: ' + offenders.join(', '));
  assert.match(home, /<meta name="google-adsense-account" content="ca-pub-6129942955275199">/, 'account verification metadata must stay');
});

test('no intrusive ad formats and excluded sensitive experiences', () => {
  for (const format of ['anchor', 'vignette', 'interstitial', 'autoplayVideo']) assert.equal(policy.formats[format], false);
  assert.equal(policy.mobile.noOverlays, true);
  assert.equal(policy.mobile.noStickyAds, true);
  assert.ok(policy.excludedPaths.includes('/tools/pdf-editor/'));
  assert.ok(policy.excludedPaths.includes('/play/vibe-arcade/'));
  assert.equal(policy.eligiblePages.find(page => page.path === '/play/').maxSlots, 1);
});
