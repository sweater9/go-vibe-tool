# V9 integration (Agent 1 + Agent 2): release-candidate notes

Branch `integration/v9-agent1-agent2`, based on the accepted V8 baseline `db1d37540d92919f7b09612a91502dff0faf358c` (the SHA pinned by `cloudflare-v8-production.yml` on `main`). Review only: nothing here is merged or deployed, and no Cloudflare, DNS or credential setting is touched.

## What is in it

| Lane | Tools | Source |
| --- | --- | --- |
| Agent 1 | SQL Beautifier & Minifier (`sql-formatter`), Large File SHA-256 (`file-sha256`), Universal Epoch & Time Matrix (`epoch-matrix`), Social Card & OG Simulator (`og-simulator`) | PR #25 head `ae30503` |
| Agent 2 | Cubic-Bezier Editor (`cubic-bezier`), Screenshot Beautifier (`screenshot-beautifier`), PDF Signer (`pdf-signer`), Offline OCR (`offline-ocr`), Audio Leveler / Silence Stripper (`silence-stripper`), Video / GIF Trimmer (`video-gif-trimmer`) | `feature/v9-agent2-media` (PR #27) plus the fixes below |

Catalogue: exactly nine categories; 59 V8 listed tools + 10 V9 = 69 (the V8 baseline was reproduced at 59 listed / 74 registered). The PDF Signer produces a **visible raster signature, not a cryptographic digital signature**; the UI and docs say so.

## How it was integrated

Not by merging old foundation branches. The baseline already contains the V9 foundation commits (`2fcde74`). Only the two lanes' own commits were merged, in this order:

1. `main` (adds only the gated production workflow; see "Decision for the release owner").
2. Agent 1 (conflict: `index.html`, resolved by keeping the baseline's `studios.css` preload and adding `v9-agent1.css`).
3. Agent 2 (conflicts: `index.html`, `v9-utilities-core.js`).

`v9-utilities-core.js`: Agent 1's extended epoch engine (exact ns BigInt, floor division for negatives, DST gap/overlap, bulk lines, deep link) is kept in full, `bezier()` is unchanged, and Agent 2's `bezierAt()` (x solved before y) is added and exported. The combined test checks all of these exports and that the Bézier tool's sampled value agrees with the core.

Integration changes beyond the merges:

- `sw.js`: cache `govibetool-v8-7` -> `govibetool-v8-8` (the V8 integration test requires a single numeric `v8-<n>` name pinned in two V8 test files; both were updated). Precaches Agent 1's six files (already added by Agent 1) and `tools/v9-media/register.js`.
- **Defect found and fixed:** the global worker's `activate` deleted every cache that was not its own, which would have purged the scoped media worker's offline cache (`gvt-v9-media-*`, the OCR model and PDF engine, about 22 MB) on every global upgrade. It now keeps that prefix. Covered by `tests/v8-service-worker.mjs` and by `tests/v9-integration-browser.mjs`, which fails without the fix (negative control run).
- `package.json`: `npm test` and `test:v9` include `tests/v9-media.mjs`; `test:v9:media:browser` added.
- V8 test expectations changed for intended catalogue growth only, kept exact: `v8-combined-browser` 59 -> 69 listed tools; `v8-browser` PDF & Tables list gains `pdf-signer`. No assertion was loosened or removed.
- New: `tests/v9-integration-browser.mjs` (13 checks) and `.github/workflows/v9-integration-qa.yml`.

## Root causes of the Agent 2 Firefox and WebKit failures

See `docs/v9-agent2-media.md` for the table. In short: the failures were in the test harness, not the codecs.

1. `context.setOffline(true)` fails navigations in Firefox (`NS_ERROR_OFFLINE`) and WebKit ("internal error") before the service worker can answer. Offline is now a real outage (origin server stopped), after asserting the page is controlled by the intended worker and its cache is populated.
2. The privacy route aborted every non-origin URL, including `blob:`. WebKit reports `blob:` media loads as intercepted requests, so every `<video>` and `<audio>` failed (`MEDIA_ERR_SRC_NOT_SUPPORTED`) though WebKit decodes the same files without interception (`tests/v9-media-probe.mjs`, run in CI). The route now blocks only third-party `http(s)`.
3. App hardening found along the way: audio duration no longer depends on a detached `<audio>` element, `decodeAudioData` has a timeout and clear error, and "offline ready" waits for the page to be controlled.

## Test evidence (hosted GitHub Actions)

Integration, tested at commit `42555d6a6c1347eead1cd836a55ed6f8452b7c68`: [run 38798983694](https://github.com/sweater9/go-vibe-tool/actions/runs/38798983694), all 7 jobs green (an earlier identical-code run on `c0abf5d`: [38795262845](https://github.com/sweater9/go-vibe-tool/actions/runs/38795262845)). Commits after `42555d6` change only documentation and CI configuration; the full QA also passed at `9c54b93` ([run 38800959555](https://github.com/sweater9/go-vibe-tool/actions/runs/38800959555), attempt 2 after one Firefox `v8-browser` timeout in attempt 1, see Remaining risks).

| Gate | Result |
| --- | --- |
| `npm test` (V8 + V9 unit, static, studios, build, Cloudflare config, live-asset checks) | pass |
| V9 unit tests (`V9_BIG_GIB=1`) | 64 tests (11 media, 53 epoch/Bezier core + Agent 1) pass |
| Production-equivalent build + `verify:dist` + `test:v9:dist` | 613 files, 33.86 MiB, largest 10 667 KiB; 7 dist checks pass |
| V9 integration browser suite, Chromium / Firefox / WebKit | 13 checks each, pass |
| Agent 1 browser suite on `dist`, three engines | 23 checks (Chromium count read from log), pass |
| Agent 2 media suite, source and `dist`, three engines | Chromium 10/10; WebKit 9 pass + 1 capability-limited; Firefox pass with WebM export capability-limited |
| V8 acceptance suites on `dist`, three engines | `v8-integration-browser`, `v8-combined-browser`, `v8-developer-browser`, `file-media-browser`, `v8-browser` (126 checks on Chromium/WebKit), `knowledge-v4-dist-browser`, `labs-browser`, `play-games-browser`, `v8-studios-lifecycle-browser`: pass |
| Legacy V5/V8 suites | `v5-browser-smoke`, `prompt-improver-browser`, `tool-fixes-browser`: pass |
| `v5-maintenance-browser`, `dist-browser` | A/B against the accepted V8 baseline in the same job: no new issues (see below) |

Agent 2 branch, commit `b38998f055f682f1431174739872ff0085f35c19`: [run 38792811595](https://github.com/sweater9/go-vibe-tool/actions/runs/38792811595) green. The original failing run was [38785534553](https://github.com/sweater9/go-vibe-tool/actions/runs/38785534553) (`6d2c8c5`).

## Regression findings (reproduced on the baseline, not assumed)

- `v5-maintenance-browser` reports `console: Failed to load resource: net::ERR_CONNECTION_REFUSED` (4 widths) on Chromium and WebKit. **Reproduced identically on the V8 baseline `db1d375`** (local Chromium and CI). Cause: with the origin stopped but `navigator.onLine` still true, the worker deliberately leaves the browser-owned favicon request to the browser (PR #19 trade-off). Unchanged by V9; the CI step fails only on issues absent from the baseline.
- `dist-browser` on WebKit intermittently fails with `pageerror: int64` (seen on `/tools/password-generator` on this branch, run 38792814186, and on `/terms` on the **V8 baseline** `db1d375`). Measured by [repeat run 38798971076](https://github.com/sweater9/go-vibe-tool/actions/runs/38798971076): WebKit `dist-browser` x6 on the baseline = 1 failure (`/terms`), x6 on this branch = 0 failures. Pages and `tools.js` are unchanged by V9. **Pre-existing, intermittent, WebKit-only, unrelated to V9**; the same run repeated the Agent 2 media suite on Firefox and WebKit (source and `dist`, 5 each) with no failures.
- An unknown `?tool=<id>` throws in `tools.js` `shell()` on the baseline too (reproduced). Not changed.
- Agent 1's PR listed `v8-studios`, `v8-integration` and `v8-integration-browser` as failing on its (older) base. On the accepted V8 baseline they pass (`v8-integration` 11 checks, `v8-integration-browser` 66 on Chromium).

## Privacy and security review

- No tool uploads data, uses telemetry, CDNs, remote fonts or remote engines. The integration test records every request leaving the origin across all ten tools on desktop and 390 px: none. The OG Simulator fetches a remote image only after an explicit opt-in.
- Media tools run in iframes with their own strict CSP; vendored engines (pdf.js, Tesseract, OCR model, GIF codec) are SHA-256 pinned in `vendor-assets.json` and verified by the worker before caching. Selected files, outputs and entered text are never cached.
- File-size and resource limits are enforced before decoding (30 MB audio/video, 20 MB / 20 pages PDF, 12 MB / 16 MP OCR, GIF frame and pixel limits); audio of unknown duration is refused above 12 MB.
- The PDF Signer flattens pages to images: text, forms and links are lost and existing cryptographic signatures are invalidated. It makes no identity or legal-validity claim.
- Workflows added here are validation-only (read-only `contents`, no secrets, no deploy step).

## Known limitations

- WebM export needs `HTMLMediaElement.captureStream` and `MediaRecorder`: unavailable in WebKit (no `MediaRecorder`) and in Firefox (no `captureStream`; `mozCaptureStream` is intentionally not used in V9). The tool says so, offers the GIF alternative and never reports a successful export; CI records this as `capability-limited`. Video-to-GIF, GIF trimming, audio, PDF, OCR, screenshot and Bézier pass in all three engines.
- A deep link to a media tool opened offline works from the global cache only for the shell visited online before; PDF and OCR engines need the in-tool "Prepare offline use" step (about 22 MB).
- Output is limited to what browsers can decode; MP4 is not decodable in Firefox, and Chromium (open-source build) cannot decode H.264.

## Remaining risks

- The WebKit `int64` page error above is intermittent in the existing V8 site (about 1 in 6 mobile `dist-browser` runs on the baseline). Not fixed here (out of scope, V8 preserved); a release owner may want to track it.
- `v5-maintenance-browser` flags the favicon request while the origin is stopped (baseline behaviour). The repository's existing "V5/V8 Cross-Browser PR Gate" runs that suite without an A/B and will show red on Chromium and WebKit for this reason (it reports `failed suites = v5-maintenance-browser` only); the V9 workflow's A/B comparison shows no new issues.
- **Intermittent WebKit page crash, cause not established.** Once in this validation (repeat run 38802951752, `media-repeat (webkit, source, 2)`) the WebKit content process crashed ("Page crashed") while the Agent 2 offline test was preparing offline assets; the other WebKit media runs (about 40 across source and `dist`, including 20 in repeat runs) passed. It is not an assertion failure, it cannot be reproduced locally (no WebKit here), and there is no baseline to compare with because the media tools are new. It is recorded, not masked: no retry was added. A release owner should decide whether this rate (about 1 in 40 CI runs) is acceptable for Safari-class browsers, or ask for a memory-lean offline preparation (sequential fetches, no response cloning) as a follow-up.
- Firefox `v8-browser` failed once (1 of 126 checks, a 10 s wait for category tool cards at 1440 px) in the first attempt of the final QA run and passed on the rerun and in 12 of 12 repeat runs (6 integration, 6 baseline). Treated as an intermittent V8 flake; not caused by V9 code paths as far as measured.
- Firefox and WebKit cannot export WebM (see limitations); users get an accurate message and a GIF alternative.
- Local verification covered Chromium only; Firefox and WebKit evidence is hosted CI.

## Decision for the release owner

- `main` does not contain V8 at all (it has only the gated production workflow pinned to `db1d375`). A PR into `main` therefore shows the whole V8 plus V9 diff. Merging it is a release decision, not part of this task.
- This branch keeps the V8 baseline's `cloudflare-v8-preview.yml` (enforced by `tests/cf-preview-config.mjs`) instead of `main`'s dispatch stub. Choose which to keep before merging.

## Release-gate cleanup (follow-up)

### Known baseline-equivalent legacy failure

`tests/v5-maintenance-browser.mjs` fails on Chromium and WebKit with a console message, once per width (4 per run):

- Chromium: `Failed to load resource: net::ERR_CONNECTION_REFUSED`
- WebKit: `Failed to load resource: Could not connect to 127.0.0.1: Connection refused`

Evidence that it is baseline-equivalent, not assumed:

- Reproduced on the accepted V8 baseline `db1d37540d92919f7b09612a91502dff0faf358c` (local Chromium, same suite, same four messages, 32 checks passed on both sides).
- Direct probe on the baseline: with the origin stopped and `navigator.onLine` still true, the refused requests are `/assets/icon.svg` (and the SW-internal `/studios.css` fetch that the worker answers from cache). The icon bypass is the documented PR #19 trade-off: while online, the worker leaves browser-owned favicon requests to the browser.
- Firefox does not report it, so the repository gate was red on exactly two of three engines.

What changed (no assertion weakened, no suite skipped):

- `scripts/compare-maintenance.mjs` compares candidate results with the baseline results. It fails on any issue the baseline lacks, or on fewer passing checks. Negative control: an injected extra console error exits 1.
- `.github/workflows/v5-cross-browser-pr.yml` runs the suite on both the PR and the pinned baseline and applies that comparison, instead of failing on the baseline-equivalent message. The other seven suites are unchanged.
- `.github/workflows/v9-integration-qa.yml` uses the same script.

The proper long-term fix (serving or suppressing the favicon during an intentional outage) changes V8 behaviour or a V8 test and is deliberately not part of this cleanup.

### WebKit "Page crashed" during offline preparation

Observed once in about 40 repeat jobs (Agent 2 media suite, WebKit, source): `Page crashed` while the page waited for "Offline assets cached", then every later check in that process failed on the dead page.

Findings:

- It is a content-process crash event, not an assertion or timeout; no application error preceded it.
- Memory is not a plausible cause. The worker installs 201 pinned files (20.6 MiB; largest 10.4 MiB) with concurrency 4. Worst case is the four largest files at once, about 18 MiB raw and roughly 55 MiB with clone, hash buffer and cache write. That is small for a worker process.
- The page itself does nothing heavy at that point (registration and waiting); OCR has not started. No product change is justified by this evidence, and none was made.
- It cannot be reproduced locally (no WebKit build in the authoring environment), so the cause is not established.

What changed (harness only):

- `tests/v9-media-browser.mjs` now treats a crashed or closed page as a recorded failure (`crashed: true`, listed in `results.json` under `crashes`), then opens a fresh page in the same browser context and continues. The context is kept, so the service worker and cache survive just as for a user reloading a crashed tab. Nothing is retried or hidden: the crashed check stays failed and the run stays red.
- Verification hook: `MEDIA_SIMULATE_CRASH=<check name substring>` crashes the page (`chrome://crash`, Chromium only). With `offline asset` selected the run showed the crash recorded, the independent homepage check still passing after recovery, and the dependent offline-reload check failing honestly because its preparation never happened.

### Cloudflare workflow reconciliation

`main` carries a dispatch-only stub of `cloudflare-v8-preview.yml`; the V8 branch carries the real preview workflow. Decision: keep the real workflow (it is what `tests/cf-preview-config.mjs` enforces), and prove it cannot affect production.

- `cloudflare-v8-production.yml` is byte-identical on `main` and on this branch, dispatch-only, pinned to `db1d375…`, gated by `inputs.deploy == true` and the `cloudflare-production` environment. Not modified.
- The preview workflow deploys only with `wrangler.preview.jsonc` to `go-vibe-tool-v8-preview`, has no `pull_request`/`schedule`/`workflow_run` triggers, its only `push` trigger is scoped to `feature/v8-discovery-navigation` and its own file, and a `REQUIRED_REF` guard makes it refuse every other ref. On `main` it therefore cannot build or deploy, which matches the stub's behaviour; the "Run workflow" button remains because the file has `workflow_dispatch` on the default branch.
- `tests/cf-preview-config.mjs` gained a reconciliation guard asserting all of the above (production pinned to one 40-hex SHA on every checkout, dispatch-only, gated; preview never references the production environment or config). Negative control: pointing a production checkout at `main` fails the guard.
- Production deployment behaviour, secrets, environments, domains and automatic builds are unchanged.
