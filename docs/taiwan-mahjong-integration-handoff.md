# Taiwanese Mahjong integration — agent handoff

Status: INTEGRATION NOT STARTED. This branch was created from main at a45f5185d84cf3227212f9d700538c492d5e7fc0. Do not merge or deploy until gates below pass.

## Source of truth
The owner uploaded `taiwan-mahjong(1).zip` (folder `taiwan-mahjong/`) and `HANDOFF.md` in the ChatGPT conversation. **Ask the owner for the ZIP if it is not accessible to your agent**. Do not recreate or rewrite the supplied game.

## Scope
- Copy the supplied `index.html`, `style.css`, `engine.js`, `game.js` to `play/taiwan-mahjong/` unchanged except minimal integration changes to HTML chrome, canonical/breadcrumb, and removal of the optional local service worker registration in `game.js` if the site-wide worker is used.
- Preserve the supplied test files and run `node test/engine.test.js`, `node test/scenarios.test.js`, `node test/fuzz.test.js` from the game directory.
- Integrate with existing GoVibeTool header/footer, privacy, local-only/offline policy, and existing shared `sw.js`. Cache all four game assets; bump the site cache version carefully.
- Replace Mahjong Solitaire on `play/index.html`, homepage `index.html`, site discovery/search index, sitemap, metadata, structured data and internal links. Keep the Play game count at five. Do **not** replace or alter unrelated `play/mahjong/` without verifying its purpose.
- Implement a **real HTTP 301** redirect from `/play/mahjong-solitaire/` to `/play/taiwan-mahjong/` appropriate for Cloudflare Workers (not merely a client-side meta refresh). Confirm old route redirects in production preview. Remove stale Solitaire assets from offline cache.
- Preserve existing PDF Editor, other games, homepage layout, SEO work, privacy/consent, and ad placements. Do not add ads to gameplay.
- No server/API/model calls, external scripts/fonts/images, accounts or wagering. All scoring is for entertainment only.

## Release gates
1. All game engine/scenario/fuzz tests pass and total 144-tile accounting and point conservation hold.
2. Existing site tests/CI pass on this branch, including Firefox and WebKit.
3. Desktop and 390px mobile viewport browser playthrough; real-phone portrait and landscape verification before deployment; dialogs scroll, tiles are readable/tappable, no horizontal overflow.
4. No external network requests from the game; offline reload works via the site's worker.
5. Redirect returns HTTP 301 and correct Location; new URL canonical and sitemap/search index updated.
6. Review the scoring table with the owner as the default casual tai variant; disclose unsupported special hands and multi-winner claims.
7. Keep this one focused draft PR. Do not merge/deploy until reviewed and authorized.

The ZIP is the source of truth; this file is integration guidance only.
