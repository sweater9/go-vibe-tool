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

## Known baseline mismatch to investigate

The V9 base includes `2fcde74` and earlier commits explicitly retiring Freelance Studio. Several legacy V8 acceptance tests still require that studio (`hourly-rate`, `studio-freelance`, the fourth keyboard tab). Initial full `npm test` fails at `tests/v8-studios.mjs:9` for this reason. These assertions have not been removed, skipped or weakened. The combined gate records their results rather than hiding the mismatch. Deployment readiness requires reconciling the approved retirement contract and its legacy regression coverage.

## Limitations retained

PDF signatures are visible raster marks, not cryptographic digital signatures or certified redaction. Raster exports lose selectable text, links, forms and accessibility. OCR is local English printed-text recognition. Audio is peak leveling, not LUFS mastering. Firefox/WebKit WebM capture may be unavailable; GIF alternatives are separately exercised. No watermark is added; existing watermarks are retained. Offline storage can be evicted and must be prepared again.

Status: combined release validation in progress; not deployment-approved. Final evidence must refer to the exact tested candidate, not the earlier individually green lane commits.
