import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const policy = JSON.parse(read('config/ads-readiness.json'));
const play = read('play/index.html');
const privacy = read('privacy.html');
const contact = read('contact.html');
const home = read('index.html');
const editor = read('tools/pdf-editor/index.html');
const arcade = read('play/vibe-arcade/index.html');

const adLoader = /pagead2\\.googlesyndication\\.com\\/pagead\\/js\\/adsbygoogle\\.js|\\badsbygoogle\\.push\\s*\\(/i;

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
  for (const [name, html] of [['privacy', privacy], ['contact', contact], ['homepage', home], ['PDF editor', editor], ['Vibe Arcade', arcade]]) {
    assert.doesNotMatch(html, adLoader, name);
  }
  assert.match(editor, /Content-Security-Policy/);
});

test('no intrusive ad formats and excluded sensitive experiences', () => {
  for (const format of ['anchor', 'vignette', 'interstitial', 'autoplayVideo']) assert.equal(policy.formats[format], false);
  assert.equal(policy.mobile.noOverlays, true);
  assert.equal(policy.mobile.noStickyAds, true);
  assert.ok(policy.excludedPaths.includes('/tools/pdf-editor/'));
  assert.ok(policy.excludedPaths.includes('/play/vibe-arcade/'));
  assert.equal(policy.eligiblePages.find(page => page.path === '/play/').maxSlots, 1);
});
