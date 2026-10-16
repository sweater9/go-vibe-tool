# V9 combined release candidate — review only

Branch: `integration/v9-combined-qa`. No PR merge or deployment is authorized.

## Reconciliation

- Media input: `b38998f055f682f1431174739872ff0085f35c19` (PR #27).
- Utilities input: `ae305032f0d6a99fc08ce098eaf79f00c00c40db` (PR #25).
- Shared base: `015549419d20d95fb1ba1f275609431f26a2cf2c`.
- Retained Agent 1's complete timestamp engine and namespace-merging convention; added the existing media `bezierAt` solver/export without duplicating engines.
- Retained both script registration chains before studio routing/discovery; ten new tools use exactly nine existing categories.
- Retained newer media codec probes, blob/data request handling, real-origin offline testing, and audio decoding safeguards.
- Reconciled local QA fixes: reject empty numeric values; clear rejected media load state; stop captured tracks before disposing video; clean OCR callbacks after failures; verify/repair evicted offline assets.
- Root worker now owns only `govibetool-*` caches, uses `govibetool-v9-1`, and precaches the media registration. Scoped media resources remain opt-in. Both workers coexist without deleting each other's assets.
- Existing production/deployment workflows and V8 release branches remain unchanged.

## Combined gate

`node scripts/test-v9-release.mjs static` executes every command in `npm test`, including commands after a failure, plus media units, lane-1 dist verification, general dist verification and Mahjong Cloudflare unit tests. Multi-GB SHA validation is enabled (`V9_BIG_GIB=1`), not skipped.

`node scripts/test-v9-release.mjs browser <chromium|firefox|webkit> <source|dist>` executes both V9 suites, a new joint catalogue/worker/offline suite, and all eight suites from the V8 release-candidate acceptance matrix. Both targets run on independent origins. No remote production website is tested or modified. Suite failures remain failures; execution continues to collect independent results.

`.github/workflows/v9-combined-qa.yml` runs the static gate and six browser/target jobs on this isolated branch. Logs and exact revision/dirty-worktree metadata are retained under `artifacts/v9-release/`. A successful job does not imply unavailable browser exports ran: media reports retain `capability-limited` outcomes.

## Baseline test reconciliation

The V9 base includes `2fcde74` and earlier commits explicitly retiring Freelance Studio. Legacy V8 acceptance tests still required that studio (`hourly-rate`, `studio-freelance`, the fourth keyboard tab). The initial full run reproduced the mismatch. Regression expectations now follow that explicit retirement: three retained tabs, no retired alias/UI/catalogue/favourite link, preserved stored favourite IDs, and unchanged arithmetic/input-validation coverage through the retained engine. Independent percentage calculations still run in the browser. No production functionality was restored or removed for these test updates.

The combined catalogue is 69 listed tools (59 retained plus ten V9 additions), still exactly nine categories. Cache assertions now pin the new V9 cache generation consistently. The extra local Cloudflare-runtime unit suite needs Miniflare `4.20260730.0`, matching its existing review workflow; the combined CI installs it explicitly. No Cloudflare service is contacted or deployed by those local runtime tests.

## Limitations retained

PDF signatures are visible raster marks, not cryptographic digital signatures or certified redaction. Raster exports lose selectable text, links, forms and accessibility. OCR is local English printed-text recognition. Audio is peak leveling, not LUFS mastering. Firefox/WebKit WebM capture may be unavailable; GIF alternatives are separately exercised. No watermark is added; existing watermarks are retained. Offline storage can be evicted and must be prepared again.

Status: combined release validation in progress; not deployment-approved. Final evidence must refer to the exact tested candidate, not the earlier individually green lane commits.

Local reconciliation evidence at `dcac129`: all 65 static gate commands passed, including 56 lane-1/epoch tests with the large-file case enabled (zero skips), nine additional media tests, static distribution checks and three local Cloudflare-runtime tests. The legacy Chromium integration suite passed 66 checks after the retirement-contract reconciliation. Joint worker/catalogue checks passed in Chromium and Firefox. These results do not replace the pending six-job hosted browser matrix.

The media runner classifies `SITE_ROOT=.` as source explicitly, so the combined source gate uses its plain source server and reports the correct target; `SITE_ROOT=dist` keeps the production-equivalent routing server. Firefox/WebKit capture limitations remain distinct from successful exports.
