# Mahjong Solitaire-only release

Four-player Mahjong ("Mahjong with Friends") has not passed live multiplayer acceptance, so the production site ships
**Mahjong Solitaire only**. The multiplayer source stays in the repository for a future release.

## What is gated

| Surface | How it is closed |
|---|---|
| Built output | `play/mahjong` is listed in `UNRELEASED_SITE_PATHS` (`scripts/site-manifest.mjs`); `build-static.mjs` never copies it and `verify-dist.mjs` fails if it, or a service-worker precache entry for it, appears in `dist/`. |
| Direct URLs | `/play/mahjong/`, `/play/mahjong/*` and `/multiplayer/*` are not in `dist/`, so the Worker answers with the site 404 page. |
| Navigation and links | Play hub card, home-page copy and the cross-links on 2048, Daily Word and Logic Crypt now point to Mahjong Solitaire only. |
| Discovery search | The `mahjong-multiplayer` entry is removed from `discovery.js`. |
| Sitemap | `/play/mahjong/` removed. |
| Service worker | Four-player precache entries removed; cache bumped `govibetool-v8-9` -> `govibetool-v8-10`, so activation deletes any visitor's old cache that held the four-player pages. |
| Endpoints | The production Worker (`wrangler.jsonc`) is static assets only: no script, Durable Object, binding or route. The multiplayer backend has its own config (`multiplayer/cloudflare/wrangler.jsonc`) which no production workflow deploys. |

## Tests

`tests/solitaire-only-release.mjs` (`npm run test:solitaire-only`, 3 engines in V9 Integration QA) builds `dist/` and checks
all of the above, plus Solitaire play (match a pair) on desktop and mobile with no four-player request and no WebSocket,
a simulated upgrade over a stale cache, and that the multiplayer source files still exist. `dist-browser`,
`play-games-browser`, `v5-maintenance-browser`, `v5-navigation-integrity`, `v5-browser-smoke` and `static-dist` were updated
to expect the gated state; no assertion about Solitaire, tools or Labs was weakened.

## Releasing four-player Mahjong later

1. Pass live multiplayer acceptance.
2. Empty `UNRELEASED_SITE_PATHS`.
3. Restore the Play hub card, discovery entry, sitemap URL, service-worker precache entries and cross-links (`git revert` of this change is the starting point).
4. Revert the new tests' "not shipped" expectations and deploy the multiplayer Worker separately.
