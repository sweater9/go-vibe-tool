# Mahjong on Cloudflare Free — deployment review

Recommended: separate static Cloudflare Pages preview plus one Workers API, SQLite-backed MahjongRoom Durable Object per room, and one SQLite RoomRegistry for admission. Keep Render and its Node/SSE server available. No service has been provisioned or deployed. PR #11 must remain draft.

The engine in multiplayer/engine.mjs is unchanged: 136 tiles, four players, existing documented standard-hand rules and fixed zero-sum scoring. No AI opponents or design changes. The adapter imports the same deal/move/resolve/view functions, and uses nodejs_compat for secure Node crypto/shuffle. Only server-generated state is persisted. Clients submit actions and revisions, never authoritative tiles or winners.

## Implementation

- worker.mjs: strict origin allowlist, native per-IP HTTP rate limiting (120/minute) and creation limit (6/minute), streaming 2 KB JSON cap, random 96-bit private invitation codes, hashed 192-bit guest seat secrets.
- RoomRegistry: rejects unknown codes before allocating a room database; enforces 150 rooms per UTC day and 100 registered rooms concurrently. Expired registrations are pruned. Those limits are defensive admission limits, not a guarantee against exhausting account-wide quotas.
- MahjongRoom: four reserved seats; one current socket per seat, eight transient sockets maximum; 90 messages/minute/socket; 2 KB message cap. Hibernatable acceptWebSocket, serialized seat attachments, no interval/heartbeat loops. Authorization travels in WebSocket subprotocol headers, never invitation URLs or query strings. Response selects only govibe, never echoes the credential. Do not log headers/messages/tokens.
- SQLite stores one private room snapshot. Actions are validated through the existing engine, persisted before acknowledgment and seat-filtered broadcast. Rejected actions restore the prior in-memory snapshot. Duplicate/stale actions are rejected; lost acknowledgments require reconnecting and reading state before retrying.
- Alarms resolve 15-second claim deadlines and expire rooms after 30 minutes of game inactivity or four hours absolute lifetime. Reconnect/presence does not extend room expiry. Expiry deletes room storage and closes sockets. Presence is derived from socket attachments, not repeatedly written to SQLite.
- Guest credentials remain in per-tab sessionStorage, preserving the existing behavior. Share only room-code links, not credentials. Losing tab storage loses the seat until expiry.
- The existing frontend chooses WebSockets only when MAHJONG_TRANSPORT is websocket. Render/local Node continues using SSE. Hosted config remains disabled unless explicitly enabled in a later approved static build.

## Static publishing fix (separate from backend)

Build command: npm run build && node scripts/configure-mahjong-preview.mjs
Output directory: dist
Root: repository root; framework None; NODE_VERSION=22; SKIP_DEPENDENCY_INSTALL=1.

The existing allowlisted scripts/build-static.mjs and verify-dist.mjs are preserved from concurrent commit e9c4c663; they stage only static root assets and assets/, knowledge/, labs/, learn/, play/, tools/, vendor/. It excludes source-only src directories, CNAME, multiplayer, tests, docs, QA reports, package metadata and git files. Tests verify all six Labs, Learn and Mahjong assets remain present and ads.txt unchanged. Never publish the repository root.

Keep main as the eventual production branch; automatic production deployments OFF. Preview custom include feature/v8-discovery-navigation, exclude empty. Disable production publishing before any initial main build. The multiplayer configuration helper refuses to enable an API outside the approved Pages preview branch. No custom domain or DNS changes. Serve at hostname root, no SPA rewrite. previews on separate hostnames avoid service-worker cache collisions. Cache govibetool-v8-5 and localStorage are origin-bound; the moving branch alias shares storage across releases. Fresh profiles and actual offline reloads are required for hosted verification.

Verify Cloudflare deployment metadata and served file hashes against the approved commit; do not confuse a deployment hash with a Git SHA. The immutable URL has form https://<deployment-hash>.<project>.pages.dev. No such URL is currently deployed.

After backend deployment approval only, set the Pages preview environment MAHJONG_API to the approved HTTPS workers.dev origin. scripts/configure-mahjong-preview.mjs emits websocket config into dist only after the existing verified static build. Leave it unset now. Never enable backend on production as part of preview setup.

## Free-tier requirements (verified 2026-10-12 UTC)

Workers Free, SQLite Durable Objects (new_sqlite_classes migration required); no KV-backed DO, D1, R2, paid Worker, persistent disk or secret is needed. A Cloudflare account and scoped GitHub integration are required; local tests need no Cloudflare login. Deploy authorization/credentials must remain outside the repository.

Current account-wide limits: Workers 100,000 requests/day and 10 ms CPU/request; DO 100,000 metered requests/day, 13,000 GB-seconds/day; SQLite 5 million rows read/day, 100,000 rows written/day, 5 GB total storage and 1 GB per object on Free. Daily limits reset at 00:00 UTC. Exceeding a Free allowance causes failures, not automatic paid overage. Other Workers/DOs share account allowances.

Incoming DO WebSocket messages are metered at 20:1 for billing; outgoing messages are uncharged. HTTP upgrades, RPC calls and alarms also count. Do not treat the 20:1 billing ratio as an analytics or abuse limit. Hibernation avoids idle duration; ordinary WebSocket.accept or SSE would keep rooms active. Native rate limits are local to a Cloudflare location and approximate, not global quotas. Registry provides global admission separately.

## Consumption estimate — assumptions, not measured production usage

One game means one four-player hand/room, 45-minute connected session, 200 incoming actions including readiness/claims, 12 HTTP requests including four upgrades and reconnect allowance, 20 claim/expiry alarms, 15 seconds aggregate active handler wall time (50 ms per action plus startup/alarms), 50 KB snapshot; no polling. Conservative SQLite budget: 500 reads and 450 writes/game including persistence, alarm updates, registry indexes and deletion. Hibernation duration uses 0.128 GB allocation. Actual query/index/internal metadata and handler timings must be measured after approved preview deployment.

| Games/day | Worker HTTP requests | DO metered requests (approx.) | Active GB-s | SQLite reads | SQLite writes | Snapshot storage upper estimate* | Free assessment |
|---:|---:|---:|---:|---:|---:|---:|---|
| 10 | 120 | 550 | 19.2 | 5,000 | 4,500 | 0.5 MB | Comfortable projected margin |
| 100 | 1,200 | 5,500 | 192 | 50,000 | 45,000 | 5 MB | Feasible subject to measured CPU/writes |
| 1,000 | 12,000 | 55,000 | 1,920 | 500,000 | 450,000 | 50 MB | NOT feasible on Free: write allowance exceeded; current admission blocks it |

*Conservatively assumes a full day's snapshots remain. Actual four-hour deletion reduces logical retained data; SQLite allocated pages/metadata can exceed snapshot sizes. Registry caps the implementation to 100 registered rooms, so 1,000/day is a hypothetical uncapped capacity model.

Approximate DO requests include 12 HTTP/RPC room requests, 12 registry lookups/reservations, 200/20 socket-message units, 20 alarms plus cleanup margin. For a 45-minute NON-hibernating room, duration alone is 345.6 GB-s/game: 100/day would exceed 13,000. Hibernation is necessary. At 100 games/day, 10 ms CPU budget and 450 writes/game are assumptions requiring measurement; no guaranteed free capacity is claimed. Pathological clients and reconnect storms increase consumption. Rate limits and quotas reduce abuse but cannot prevent all quota exhaustion.

Estimated ongoing charge while staying within Free: $0. No paid plan is authorized. For 1,000/day, reduce durable writes via an independently reviewed design or seek paid approval; do not silently relax persistence, scoring or tests.

## Cloudflare Free versus Render Free

| Item | Cloudflare proposed | Existing Render Node implementation |
|---|---|---|
| Rules/validation | Same engine | Same engine |
| Realtime | Hibernatable WebSockets | HTTP actions + SSE with heartbeat |
| Persistence | SQLite per room survives eviction/restart | Memory by default; STATE_FILE uses local filesystem |
| Free durability | Durable SQLite with quotas/expiry | Free filesystem is ephemeral; no persistent disks |
| Idle behavior | Room may hibernate with sockets attached | Free web service spins down after 15 idle minutes; cold wake can take about a minute |
| Capacity bound | Daily requests/CPU/rows; write bound at scale | 750 free instance hours per workspace/month; memory/process limits and shared hours |
| Porting effort | New Worker/DO adapter and transport | Already implemented |

Render Free remains a useful fallback/test server, but local STATE_FILE is not a free durable storage solution across service restarts/redeployments. Do not delete its service. Neither option has been newly deployed here.

## Configuration and deployment checklist — do not execute yet

1. Review this implementation and completed CI results; preserve draft PR and approve backend deployment separately.
2. Confirm Cloudflare account is Workers Free and SQLite DO is available. Inspect other account quota usage; no paid upgrade.
3. Use multiplayer/cloudflare/wrangler.jsonc: compatibility_date 2026-08-06, nodejs_compat; ROOMS/MahjongRoom and REGISTRY/RoomRegistry bindings; v1 new_sqlite_classes migration. Keep deployment named govibe-mahjong-preview, workers.dev only, no custom routes/domains.
4. Replace ALLOWED_ORIGINS localhost with the exact approved Pages branch hostname and any immutable deployment hostname being tested. No wildcard suffix, null origin or production domain. Keep MAX_ROOMS_PER_DAY <=150. Use separate namespaces/Worker name for any future production system. Never edit an already applied v1 migration; add future migrations.
5. Local validation: install miniflare@4.20260730.0 and playwright@1.58.2; npm test; node tests/static-dist.mjs; npm run test:mahjong:cloudflare; install all three browsers, then MAHJONG_CLOUDFLARE=1 npm run test:mahjong:browser. Wrangler deploy --dry-run bundles without provisioning.
6. After explicit backend approval, deploy Worker using a scoped external credential. This creates SQLite DO namespaces and rate-limit bindings. Confirm no paid provisioning is included. Do not use wrangler deploy during this preparation.
7. After separate static deployment authorization, publish dist only, enable preview MAHJONG_API, verify exact deployed commit/provenance and root paths. Preview URLs are public by default; decide access controls before sharing. Origin allowlisting is browser protection, not authentication against non-browser attackers.
8. Test four independent guest contexts in Chromium/Firefox/WebKit, simultaneous ready/claims, hidden hands, stale/illegal moves, reload/network reconnect, actual hibernation/eviction, claim alarm, expiry and storage removal. Capture desktop/mobile evidence.
9. Measure CPU, rows read/written, duration and reconnect rates. Ensure quotas have headroom; reject admission with a clear capacity message rather than provisioning paid services. Confirm alarm retries are idempotent.
10. Keep production/main deployment disabled, PR unmerged, DNS/AdSense/IntelliTools unchanged. Never migrate Render users silently; in-flight rooms and tokens are not shared between transports/backends.

## Test evidence

Local npm test PASS (including existing 13 Mahjong engine/Node integration cases). New workerd/SQLite tests cover four sockets, readiness, legal/stale/invalid actions, private hands, reconnect state, denied origins, full room, malformed JSON, creation rate limit, and persistence across complete runtime restart. Core tests cover claim deadline/expiry. Static dist preservation/exclusion test PASS. Browser downloads in this environment were truncated; the new Mahjong Cloudflare review workflow runs actual Chromium/Firefox/WebKit on GitHub with four guest contexts at 1280/375 widths and screenshots. See workflow results for final status; do not claim browser success before all jobs finish. Hosted edge hibernation/quota consumption remains unverified until an approved deployment.

Sources:
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/durable-objects/platform/limits/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- https://render.com/docs/free
