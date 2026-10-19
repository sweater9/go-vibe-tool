import test from 'node:test';
import assert from 'node:assert/strict';
import { ADS_ENABLED, mayRequestAds, MAX_PLAY_DIRECTORY_ADS } from '../ads/ad-gate.mjs';

test('advertising is disabled even with approval and consent simulated', () => {
  assert.equal(ADS_ENABLED, false);
  assert.equal(MAX_PLAY_DIRECTORY_ADS, 1);
  for (const pathname of ['/play/', '/', '/tools/pdf-editor/', '/play/vibe-arcade/']) {
    assert.equal(mayRequestAds({ pathname, approved: true, cmpReady: true, consentGranted: true }), false);
  }
});

test('missing consent, approval or CMP fails closed', () => {
  for (const state of [{}, { approved: true }, { approved: true, cmpReady: true }]) {
    assert.equal(mayRequestAds({ pathname: '/play/', ...state }), false);
  }
});
