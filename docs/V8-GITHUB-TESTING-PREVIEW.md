# V8 GitHub testing and preview artifacts

Requested site snapshot: `f6685bff58ae91f835b41963239cda2355c8554c`.
Expected Git tree: `57754c128de33e3fe0e3a6c8e145bd4afccc3650`.
Repository: `sweater9/go-vibe-tool`, private. PR #11 stays draft and unmerged.

## Hosting decision

Repository metadata reports `has_pages: false`. The connector cannot access the Pages-settings endpoint, so the Actions workflow performs a read-only REST check with a `pages: read` token and uploads `pages.json`. The owner's billing plan is not exposed to that workflow. A disabled site is not proof that the private repository's owner has a Pages-eligible subscription.

GitHub Pages supports private repositories on GitHub Pro, Team or Enterprise, but allows only one project Pages site per repository. The official `actions/deploy-pages` preview input is still an alpha feature unavailable to the public. Third-party branch/subfolder preview actions write to a shared Pages publishing artifact/branch, so they do not provide the isolated deployment permitted here. Changing this repository's Pages source to publish the V8 branch could also select its committed production CNAME. None of those settings are changed.

The authorized fallback is a **GitHub Actions artifact preview**, not a publicly hosted website. A separate private preview repository with Pages enabled on an eligible account would be the safest future GitHub-hosted website option. It would need a separate repository and Pages authorization, confirmed plan eligibility and an explicit publication decision because private source does not automatically imply a private Pages website. No repository was created, visibility changed or Pages site enabled.

Official references:
- https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- https://github.com/actions/deploy-pages/blob/main/action.yml
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Primary testing workflow

`.github/workflows/v8-live-preview-qa.yml` now runs **V8 GitHub snapshot QA**. It replaces the Render-dependent primary V8 review workflow. On the V8 branch, changes to this workflow or its `qa/v8-github/` harness automatically run it. It also declares `workflow_dispatch`; GitHub may not offer manual dispatch until the workflow is present on the default branch. No merge is required for its branch-push execution.

Every site checkout is pinned to the requested full SHA. The workflow/harness commit is separate from the tested website commit. The current V8 branch is not reset to that historical snapshot; later Mahjong work stays intact. Accordingly, the frozen target's Play hub intentionally has Daily Knowledge, Logic Crypt, 2048 and Daily Word, with **four** active games. The newer branch's Mahjong preview is not part of this target snapshot.

Jobs:
1. Read repository/Pages settings with contents/pages read permissions; make no settings mutations.
2. Verify Git HEAD and tree, create an isolated static payload and provenance manifest, and run the target commit's `npm test`.
3. Run actual Chromium, Firefox and WebKit engines on GitHub-hosted Ubuntu runners. The original target's V8 and Play browser suites run at the origin root. The full original Play acceptance suite also runs under the artifact's nested preview path. Additional checks cover 1280px and 375px navigation, controls, assets, worker scope/cache isolation and true offline play with the origin server stopped.
4. Publish the preview, Pages inspection and per-engine screenshots, traces, logs and result JSON as separate artifacts, retained for 14 days.

The root V8 suite also checks 375/390/768/1024/1440 widths. The original Play suite checks 1280 and 390 widths; the additional nested-path suite explicitly checks 1280 and 375. Target tests include 2048 merge/scoring/undo/swipe/win/game-over/storage behavior, Daily Word feedback/keyboard/win/loss/streak/share/practice/storage behavior, and offline loads and play. A failed test remains a failed workflow; no acceptance assertion is skipped to make the snapshot appear ready.

## Preview identity and isolation

Payload base path:
`/go-vibe-tool/v8-preview/f6685bff58ae91f835b41963239cda2355c8554c/`

`build-preview.mjs` requires both the exact Git HEAD and Git tree. Each exported file must match its committed Git blob before copying; its SHA-256 and byte length are recorded in `preview-provenance.json`. CNAME, repository workflows, tests, build-only source and historical QA documents are omitted from the downloadable static payload. Exported site HTML, scripts, styles, asset bytes, robots, manifest and AdSense configuration are not edited.

The downloaded payload is checksum-verified before browser testing or local serving. The acceptance harness also hashes served responses for every service-worker precache URL and critical games/assets. The test server does not provide root-path aliases, so incorrect absolute links cannot accidentally pass. The service-worker registration and every cache entry must remain under the snapshot path. No persistent public preview URL is claimed, and a commit marker alone is not treated as proof of deployed content.

Third-party HTTP requests are fulfilled locally in the additional browser fixture to avoid sending analytics/ad traffic during tests. This is test-only network isolation; no AdSense settings or site markup are changed. These tests do not validate live third-party ad delivery.

## Opening the artifact

Download the `v8-preview-f6685bff` ZIP from the workflow run and unzip it. With Node 22+ installed, run from the extracted directory:

```bash
node serve.mjs
```

Open:
`http://127.0.0.1:8080/go-vibe-tool/v8-preview/f6685bff58ae91f835b41963239cda2355c8554c/`

This localhost URL is a way to inspect the artifact, **not an accessible GitHub Pages deployment URL**. Double-clicking HTML through `file://` is insufficient for modules and service workers. The included server verifies all payload hashes before listening and binds only to localhost.

## Release controls

No production deployment, Pages publishing-source change, CNAME/custom-domain change, DNS change, visibility change, AdSense modification, IntelliTools change or Render deletion. Render remains available; its former read-only diagnostics are retained as the optional manual `.github/workflows/v8-render-preview-qa.yml`, outside the primary snapshot pipeline. There is no Render API dependency in the primary workflow and no Pages write/id-token deployment permission.

The execution evidence below verifies the downloadable snapshot. No GitHub-hosted website is declared ready without a real URL and proof that its served bytes match the target.

## Verified execution — 13 October 2026 (Dubai)

Workflow/harness commit: `0e9edab3b7f1b6cdb4881d7c92a8ee905d4b122f`.
Tested/exported **site** commit: `f6685bff58ae91f835b41963239cda2355c8554c`.
Git tree: `57754c128de33e3fe0e3a6c8e145bd4afccc3650`.
Workflow: [V8 GitHub snapshot QA — run 38310449904](https://github.com/sweater9/go-vibe-tool/actions/runs/38310449904), **success**, first attempt, with no test retries.

`npm test` passed on the target checkout. All three real browser jobs passed:

| Engine | V8 root checks | Play root checks | Play under preview path | Additional path/identity/offline checks |
| --- | --- | --- | --- | --- |
| Chromium | 126 pass / 0 fail | 28 pass / 0 fail | 27 pass / 0 fail | 6 pass / 0 fail |
| Firefox | 126 pass / 0 fail | 28 pass / 0 fail | 27 pass / 0 fail | 6 pass / 0 fail |
| WebKit | 126 pass / 0 fail | 28 pass / 0 fail | 27 pass / 0 fail | 6 pass / 0 fail |

The 27 online Play checks under the nested path are supplemented by separate 1280px and 375px offline checks with the origin server stopped. Those checks loaded and played 2048 and Daily Word, loaded the Play hub and homepage, verified worker scope and cache isolation, and found no page JavaScript errors, unexpected same-origin failed requests or horizontal overflow. Every engine verified all 47 precache/critical asset routes against Git-derived content hashes.

Artifacts, requiring authorized access to this private repository:

- [Verified downloadable preview](https://github.com/sweater9/go-vibe-tool/actions/runs/38310449904/artifacts/11774362739)
- [Pages configuration inspection](https://github.com/sweater9/go-vibe-tool/actions/runs/38310449904/artifacts/11774147955)
- [Chromium screenshots and results](https://github.com/sweater9/go-vibe-tool/actions/runs/38310449904/artifacts/11774761046)
- [Firefox screenshots and results](https://github.com/sweater9/go-vibe-tool/actions/runs/38310449904/artifacts/11774518074)
- [WebKit screenshots and results](https://github.com/sweater9/go-vibe-tool/actions/runs/38310449904/artifacts/11774990740)

Each engine artifact contains root V8/Play screenshots and full Play acceptance results, plus nested-path screenshots for the homepage, Play hub, 2048 and Daily Word at 1280/375 widths, including offline states. Selected Chromium Play hub, 2048 and Daily Word images were visually reviewed. Machine-readable aggregate evidence is committed at [docs/qa/v8-github/results.json](qa/v8-github/results.json).

The preview ZIP was independently downloaded and verified: all **365** exported static files matched its provenance hashes. Local serving proved the target homepage's served hash, root-path isolation and CNAME omission. A deliberately altered copy was rejected before serving. This verifies an artifact payload, not an internet deployment.

Read-only Pages inspection returned HTTP **404**, repository `private: true`, `has_pages: false`, and no configured source, Pages URL or Pages CNAME. The committed source `CNAME` remains `govibetool.com`, untouched. Private Pages account-plan entitlement remains unconfirmed; no attempt was made to enable Pages as a capability test.

**Public GitHub preview URL: none. Deployed website commit: none.** The downloadable artifact is verified to contain the requested site commit. Native isolated PR previews are unavailable publicly; safely creating an internet preview would require a separately authorized preview repository/site and eligible plan, or another approved isolated host. No GitHub-hosted website is declared ready. Production publishing settings, custom domain/DNS, visibility, AdSense, IntelliTools and the Render service were not changed by this work. PR #11 remains draft and unmerged.
