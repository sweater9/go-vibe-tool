# Cloudflare Workers static-assets deployment (GoVibeTool V8)

Status: configuration prepared on `feature/v8-discovery-navigation`. Nothing has been deployed by this change. PR #11 stays draft.

## What was wrong

The repository had no Wrangler configuration, so `wrangler deploy` auto-detected a static site and uploaded the **repository root**. The build had installed `node_modules` (including `node_modules/workerd/bin/workerd`, 129 MiB), which exceeds the 25 MiB per-asset limit, and the root also held tests, docs, screenshots and server code that must never be public.

## What changed

| File | Purpose |
| --- | --- |
| `wrangler.jsonc` | Worker `go-vibe-tool` (the existing Workers project), `assets.directory = ./dist`, `not_found_handling = 404-page`, `html_handling = auto-trailing-slash`. No `main`: assets only, no Worker code. |
| `scripts/build-static.mjs` | `npm run build`. Copies an explicit allowlist into `dist/` and verifies it. Node built-ins only, no network. |
| `scripts/site-manifest.mjs` | The single list of what ships and what never ships. |
| `scripts/verify-dist.mjs` | `npm run verify:dist`. Size and file-count limits, forbidden paths, reference closure, service-worker precache, sitemap. Run automatically by the build; a failure fails the build. |
| `scripts/serve-dist.mjs` | `npm run preview`. Local server with Cloudflare-style routing (`/x.html` -> `/x`, folder index with trailing slash, 404 page). |
| `tests/dist-browser.mjs` | `npm run test:dist:browser`. Rebuilds `dist/` and tests it in a real browser, including offline. In the Chromium/Firefox/WebKit CI loop. |
| `sw.js` | Cache `govibetool-v8-5`. Precached and runtime-cached responses are stored without the "redirected" flag (see below). |

### Service-worker fix required by Cloudflare

Cloudflare answers `/labs/index.html` with a 307 redirect to `/labs/`. The service worker precached `./labs/index.html`, so it stored a redirected response, and browsers refuse to use a redirected response for a navigation: offline visits to `/labs/` failed with `net::ERR_FAILED`. This only appeared when testing against Cloudflare-style routing. The worker now stores a plain copy, and the cache name changed so existing installs refresh.

## What is in `dist/`

Root pages and scripts (`index.html`, `404.html`, `privacy.html`, `terms.html`, `contact.html`, `ads.txt`, `robots.txt`, `sitemap.xml`, `manifest.webmanifest`, `sw.js`, `tools.js`, `v2-tools.js`, `v21-tools.js`, `v6-tools.js`, `discovery.js`, `v8-discovery.js`, `prompt-improver-core.js`, `v2.css`, `v5.css`, `v8.css`), plus `assets/`, `vendor/`, `tools/`, `learn/`, `knowledge/`, `labs/` (hub and six labs) and `play/` (including the Mahjong frontend).

Never shipped: `node_modules`, `.git`, `.github`, `tests`, `docs`, `qa`, `scripts`, `artifacts`, `multiplayer/` (Mahjong Node backend), `knowledge/src`, markdown reports, Python build helpers, source maps, test-only `.mjs` twins of browser `.js` files, `CNAME` (a GitHub Pages file with no meaning on Workers), `package.json`, Wrangler files.

Current output: 378 files, about 8.7 MiB, largest file `knowledge/semantic-index.json` (about 1.3 MiB).

## Mahjong

The Mahjong **frontend** (`/play/mahjong/`) is included and loads. `play/mahjong/config.js` sets the API URL only for `localhost`/`127.0.0.1`; on any other hostname it is empty, so no backend is contacted. `multiplayer/server.mjs` is not built, uploaded or started. Multiplayer needs a separately reviewed and approved backend.

## Cloudflare dashboard settings (existing Workers project `go-vibe-tool`)

Workers & Pages -> `go-vibe-tool` -> Settings -> Builds:

| Setting | Value |
| --- | --- |
| Git repository / branch | `sweater9/go-vibe-tool`, the branch you choose to build (the production branch is not changed by this work) |
| Root directory | `/` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Non-production branch deploy command (optional previews) | `npx wrangler versions upload` |
| Build output directory | not used for Workers; `wrangler.jsonc` sets `assets.directory` to `./dist` |
| Node version | 22 (any version supporting `node:fs` recursion works; no packages are installed) |
| Environment variables | none required |

Equivalent from a terminal with your own credentials (not run here):

```bash
npm run build          # writes and verifies dist/
npx wrangler deploy    # uploads ./dist as static assets to the Worker named in wrangler.jsonc
```

Before deploying, check locally:

```bash
npm run build && npm run verify:dist
npm run preview        # http://127.0.0.1:8080 with Cloudflare-style routing
npm run test:dist:browser
```

## Not changed

Production hosting, custom domains and DNS, AdSense (`ads.txt` and all markup are copied byte for byte), IntelliTools, repository visibility, paid services and the Mahjong backend.
