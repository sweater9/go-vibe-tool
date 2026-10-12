# Mahjong Multiplayer — implementation and deployment review

Release scope: `feature/v8-discovery-navigation`, draft PR #11. No merge, production deployment, backend provisioning, DNS, AdSense or IntelliTools changes are authorized or performed. The public backend endpoint stays disabled until reviewed. Logic Crypt, 2048 and Daily Word remain the three active solo games; Mahjong is explicitly a multiplayer preview. The approved homepage structure, privacy block, branding and other tools remain unchanged apart from replacing its Daily Knowledge Challenge reference. Knowledge and Learn content remain untouched. The retired `/play/daily/` route redirects to Play; its original engine files remain for legacy unit coverage, with no discovery entry or running game page.

## Ruleset: GoVibe Classical v1

This is a documented house ruleset of traditional four-player Mahjong, not solitaire, Hong Kong fan scoring, Riichi or tournament MCR. It uses 136 tiles (four copies of each of 34 types), no flowers, seasons, jokers or dead wall. A room plays one hand; East/South/West/North are seat order, with East the initial dealer. Each player receives 13 tiles in seat-order rounds, and East receives the first extra draw. The remaining 83 tiles form the wall.

- Win: four sets and one pair. A set is a suited chow (three consecutive tiles in the same suit), pung (three identical tiles), or kong (four identical tiles). Honor tiles cannot form chows. Open and concealed sets are allowed. Seven pairs and thirteen orphans are excluded.
- On the current seat's turn, declare a legal self-draw win, declare a legal kong, or discard a tile you own. The server draws for the next seat after the discard claim window.
- A discard can be claimed for a winning hand by any other seat, for pung/kong by any other seat, or for chow by only the next seat. Each eligible player gets one response within a 15-second server deadline; players without any legal claim automatically pass. Missing responses at the deadline count as pass.
- Claim priority is win > pung/kong > chow. Equal-priority claims go to the nearest seat after the discarder in turn order, independent of request arrival order. Only one winning claimant is accepted. A claimed discard remains marked in history.
- A kong (discard claim, concealed or added to an open pung) draws a replacement from the remaining wall. A kong is illegal with no replacement available. No robbing a kong and no bonus kong points in this ruleset. An added pung can be upgraded only on that seat's turn.
- A self-draw winner gains 6 points, each other player pays 2. A discard winner gains 6 from the discarder only. Exhausting the wall without a win draws the hand at 0 each. Points are zero sum, with no gambling, minimum fan, pattern bonuses, dealer multiplier or round continuation.

The browser instructions and engine implement these same rules. No computer opponents are included.

## Architecture and alternatives

Chosen: static GitHub Pages frontend plus a dedicated Node 22+ Render Web Service. It has no runtime package dependencies. REST submits intents and uses optimistic state revisions to reject replayed/stale turn actions. Independent Ready responses are idempotent; claims carry a server-generated window identity so simultaneous eligible responses are accepted and resolved by rules, rather than HTTP arrival speed. Authenticated Server-Sent Events (SSE) stream seat-specific snapshots via fetch, with a heartbeat, disconnect presence and exponential reconnect. This needs only HTTP, not a WebSocket library. A reconnect obtains a complete current snapshot; missing events never need client replay. Only the server generates/shuffles/deals tiles and checks ownership, turn, claims, wins and scores. The browser never sends a hand, score, player ID or wall.

A managed realtime database could distribute broadcasts, but it would still require an authoritative game service for atomic move validation. A WebSocket service would also work, but adds a transport dependency without reducing the authority requirements. The bounded single-process Render service is simpler for this site's expected initial scale. Multi-instance scaling is deliberately unsupported; use a shared transactional store and pub/sub before enabling replicas.

Optional `STATE_FILE` on a persistent disk stores a complete atomic snapshot after changes (private file mode, flush and rename). Seat bearer tokens are stored as SHA-256 hashes; raw tokens stay in tab sessionStorage. On restart, presence resets and clients reconnect; claim deadlines and room expiry remain in server time. Expired room records are deleted. Without persistent storage, a process restart ends every room. That is acceptable only for disposable development previews, not the recommended production setup.

## Security and resource limits

- Unlisted 96-bit random room codes act as invitation capabilities. No room listing or unauthenticated snapshots. A room code cannot read hands or seize occupied seats. Share links use the URL fragment and no-referrer metadata, avoiding code leakage through referrers or the static server's URL query logs.
- Independent 192-bit seat bearer tokens are required in Authorization headers. Tokens never appear in event URLs. Names are limited to 1–24 characters, control characters rejected, and rendered with textContent.
- Origin allowlist enforced on room endpoints, restricted CORS, no cookies/mandatory accounts, no-store responses. Origin is a browser boundary; bearer credentials and high-entropy codes provide access control for non-browser callers too.
- Maximum 100 rooms, four reserved seats each, one live stream per seat, 500 socket connections, 2 KiB JSON bodies, 10-second request/header deadlines, bounded stream buffers and a bounded rate-limit map.
- Per minute: 120 requests per IP, 6 room creations per IP, 12 joins per IP, 90 requests per authenticated seat. Limits reset after a minute and are process-local. Configure trusted Render proxy handling only when deployed behind Render; direct development defaults to socket IP. Never expose a proxy-trusting process directly to the internet.
- Rooms expire after 30 minutes without successful join/gameplay or after 4 hours absolutely. Heartbeats and reconnects do not keep an abandoned room alive. Disconnected players retain their seat. A hand can wait for a disconnected player until expiry; no unreliable automatic opponents or silent seat substitution.
- No secrets committed. Room state is operational private data: store it outside the checkout, restrict operator access, never serve that directory or log request credentials. JSON snapshots are not a backup/history product. Disk or filesystem failure must be resolved before public operation. Reverse-proxy TLS and abuse/DDoS protection remain infrastructure requirements.

## Estimated monthly cost and requirements (checked 12 October 2026)

| Option | Estimate | Suitability |
| --- | --- | --- |
| Local tests | $0 | Fully functional disposable test rooms |
| Render Free Web Service | $0 base compute within shared allowance | Preview only; sleep/restart loses in-memory rooms; no persistent disk |
| Render Starter + 1 GiB persistent disk | About $7.25/month incremental | Recommended initial always-on single instance, durable reconnect after restart |
| GitHub Pages frontend | No additional backend compute | Existing hosting continues; account/plan conditions unchanged |

Estimates exclude tax, workspace-plan charges, bandwidth/build overages and growth. Recheck the selected workspace's actual dashboard price before provisioning. Official references: [Render pricing](https://render.com/pricing), [Render comparison with Starter $7/month](https://render.com/articles/render-vs-railway), [storage cost model](https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses), [Free limitations](https://render.com/docs/free), [disk requirements](https://render.com/docs/disks). Free services can sleep after 15 minutes without inbound traffic, share 750 monthly instance hours, and can restart unpredictably. Persistent disks require a paid service, allow one instance, and cause brief downtime during deployment.

Nothing has been provisioned. After approval, create a **separate** Render Web Service from this branch with auto-deploy disabled, runtime Node 22+, no build dependencies, start `node multiplayer/server.mjs`, health path `/health`, one instance. Attach `/var/data` disk and set `STATE_FILE=/var/data/mahjong/rooms.json`, `ALLOWED_ORIGINS` to the exact approved frontend origin(s), and `TRUST_RENDER_PROXY=true` only for the Render-owned proxy. Render supplies PORT. Do not reuse or modify unrelated services. The service URL is public configuration, not a secret; update `play/mahjong/config.js` only after live staging validation and release approval. The existing frontend is not deployed by this implementation.

## Running and review gates

Local: run `npm run start:mahjong`, then `python3 -m http.server 8080`. Open `http://localhost:8080/play/mahjong/` in four independent sessions. `npm run test:mahjong` runs engine and HTTP/SSE integration tests. Install Playwright and its three engines, then run `npm run test:mahjong:browser`; the browser script starts its own frontend and backend on 8080/8787. Ports must be free.

Tests cover tile counts and distribution, turn enforcement, legal claims/kongs, winning decompositions, fixed scoring, hidden hands, four simultaneous streams, stale/invalid actions, origin/token denial, reconnect, expiry and durable recovery. The browser matrix uses Chromium/Firefox/WebKit at 1280 and 375 pixels, four guest contexts, invitation fragments, keyboard discard, XSS-safe names, live turns, reload/network reconnect and overflow/JS/network checks. Screenshots and machine-readable results are uploaded under the `Mahjong review tests` workflow artifacts.

Local browser execution is blocked: all three executables are missing, and one installation invocation received non-ZIP/truncated Chromium downloads from the restricted network. Local screenshot generation therefore did not occur. The GitHub Actions runners successfully installed all three real engines and verified desktop/mobile play; see the final test evidence below. Screenshot review also led to a compact in-game layout, mobile navigation and minimum 44-pixel tile touch targets. Live Render SSE buffering, proxy-IP behavior, TLS/CORS, state-disk recovery and public/mobile latency remain staging deployment checks. Keep PR #11 draft and do not merge or deploy while any of those gates are unresolved.

## Final test evidence

Game implementation: `306bbfa33d5079bbf33c3ea5c8e0582fa2175237`. Screenshot capture stabilization only: `ce8bacbe9542ef6eb5b0e0128f5ab12fc6690d91`.

- Full `npm test` passed locally after combining the concurrent 2048/Daily Word additions. CI [Quality](https://github.com/sweater9/go-vibe-tool/actions/runs/38308029583) passed on the final game implementation, including all 13 Mahjong engine/integration tests.
- [Mahjong review matrix](https://github.com/sweater9/go-vibe-tool/actions/runs/38308374340): Chromium, Firefox and WebKit, each at 1280×900 and 375×900. Tests use four independent guest browser contexts, invitations, keyboard tile selection/discard, hidden opponent hands, legal turn updates, stale-action rejection, reload recovery, offline/online recovery, safe display-name rendering, 44-pixel tile targets, mobile navigation, and checks for page errors, unexpected failed requests and overflow.
- Saved review screenshots: [desktop](qa/mahjong/desktop.png) and [mobile](qa/mahjong/mobile.png). The deliberately adversarial guest name shown as literal `<img...` text demonstrates safe rendering. Each engine's complete lobby/table screenshots and results JSON are also in the matrix run's artifacts.
- Initial browser runs found two real issues: same-document invitation fragments did not populate the code; browser offline changes did not stop an already-open event stream. Both were fixed and verified on all three engines. Simultaneous Ready requests and competing winning claims now have explicit HTTP integration coverage; they do not require fresh global revisions for independent responses.
- [V5/V8 browser regression gate](https://github.com/sweater9/go-vibe-tool/actions/runs/38308029558) passed all three engines on the final game implementation. Approved homepage/privacy/static checks, service-worker tests and the preserved 2048/Daily Word engines also pass locally. The later screenshot-only test change leaves the verified game implementation unchanged.

Remaining deployment gates: paid-service approval, the chosen Render workspace's exact price, staging TLS/CORS, SSE proxy buffering and disconnect behavior, trusted proxy rate-limit identification, real persistent-disk restart recovery, and latency/reconnection from actual friend devices. No live backend or production frontend was deployed. The multiplayer endpoint remains disabled for public hosting, and the PR remains draft. This is a review build, not a claim that the unprovisioned backend has been verified in production.
