# V8 combined acceptance QA

Candidate branch: `integration/v8-combined-acceptance`. Source revisions and overlap decisions: [integration audit](V8-INTEGRATION-AUDIT.md). Exact integration commit is the draft PR head; obtain with `git rev-parse HEAD` on that branch.

## Scope and verified behavior

Nine new utilities and four consolidated studios are included. Catalogue remains 60 listed tools in exactly nine categories. Existing IDs and category URLs remain stable; studio aliases open in place. Independent Percentage Change, original QR generation/reading/payload modes and redaction patterns are retained. Favourites and recent keys survive reload. No tool executes pasted commands or sends entered content to an external service.

## Local evidence

| Suite | Chromium | Firefox | WebKit |
| --- | --- | --- | --- |
| Developer/design, desktop + 375px | 18 passed | 18 passed | 18 passed |
| File/media, desktop/tablet/mobile, security, offline | 37 passed | 37 passed | 37 passed |
| Combined smoke, desktop + 375px, cold offline AVIF/Knowledge/Labs/Play | 42 passed | 42 passed | 42 passed |
| Knowledge learning/progress/storage/accessibility | 14 passed | 14 passed | 14 passed |
| Labs functional/mobile/keyboard/privacy/offline | 30 passed | 30 passed | 30 passed |
| Play functional/mobile/keyboard/privacy/offline | 28 passed | 28 passed | 28 passed |
| Full V8 discovery/navigation, five widths | 126 passed | incomplete: timed out | incomplete: stalled |
| Consolidation regression, desktop/mobile/deep links/aliases/saved state/offline | 68 passed | 68 passed | 68 passed |

`npm test` completed successfully, retaining the entire base test chain and adding developer, media, studio and integration checks. Developer unit tests: 19; media: 35; studio: 8; integration static: 11; Mahjong: 13. Tailwind 3.4.17 real compiler checks passed. After the final service-worker change, service-worker, discovery, studio and integration checks were rerun successfully.

Static build and `verify:dist`: 399 files, 13.02 MiB, largest AVIF WASM 3404 KiB. References, precache assets and sitemap verification pass. Cloudflare/Render build guard tests confirm hosting builds stop before changing dist. QA used Playwright 1.56.0, actual Chromium 141, Firefox 142 and WebKit 26. Firefox content sandbox was disabled only in this restricted local test runtime; WebKit host libraries were extracted into a temporary directory. Neither changes product code.

## Defects repaired

- Invalid studio/service-worker escaped-newline code and unsupported QR library call.
- Incorrect legacy aliases and loss of richer QR/redactor features.
- Workspace navigation lifecycle, discarded object URLs and abandoned AVIF workers.
- First-use offline AVIF dependencies and offline Knowledge dependencies.
- Offline navigation with a new studio query string incorrectly fell back to the home document. Cache lookup now resolves its own path before home fallback, including canonical extensionless URLs.
- Maintenance cache pin updated from v8-6 to v8-7 with assertions retained.
- Concurrent integration regression tests consume the shared route table, verify the retained shared QR/redaction engines, exercise percentage math in its independent tool, and stop the local origin for genuine offline checks. Native browser-driver offline toggles previously produced Firefox/WebKit driver errors; no offline assertions were removed.

## Remaining acceptance blockers

**NO-GO for staging acceptance until the full V8 navigation suite completes in Firefox and WebKit.** Both runs stopped progressing in the first mobile iteration; Firefox was bounded by a 240-second command timeout. The independent combined, utility, Knowledge, Labs and Play suites passed in these engines, but they do not replace the outstanding full navigation gate. The consolidation suite initially reported a Firefox icon request error while the service worker was still installing; waiting for cache installation before navigation removed the race, with all 68 assertions passing. No failing assertions are suppressed. The dedicated PR workflow reruns the complete matrix and retains artifacts.

No deployment or merge was performed. External hosting build checks are expected to fail deliberately at `INTEGRATION_NO_DEPLOY`; deployment requires separate approval and removal of that guard. No production, DNS, account or IntelliTools changes were made. Existing Cloudflare workflow is unchanged relative to the V8 base.

Camera hardware and assistive technology need human device validation; cache eviction remains browser-dependent. See per-tool documentation for parser, regex, CSS conversion, image format and privacy limitations.
