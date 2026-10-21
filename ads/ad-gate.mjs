// GoVibeTool AdSense readiness gate. This module intentionally never loads ads.
// A Google-certified CMP and AdSense approval must be verified before replacing
// this no-op with a reviewed, consent-aware integration.
export const ADS_ENABLED = false;
export const MAX_PLAY_DIRECTORY_ADS = 1;
export const EXCLUDED_PREFIXES = Object.freeze([
  '/tools/', '/play/vibe-arcade/', '/play/vibeline/', '/play/2048/',
  '/play/daily-word/', '/play/daily/', '/play/word-logic/',
  '/play/taiwan-mahjong/', '/play/mahjong/'
]);

export function mayRequestAds({ pathname, approved, cmpReady, consentGranted } = {}) {
  if (!ADS_ENABLED || !approved || !cmpReady || !consentGranted) return false;
  if (typeof pathname !== 'string' || pathname !== '/play/') return false;
  return !EXCLUDED_PREFIXES.some(prefix => pathname.startsWith(prefix));
}
