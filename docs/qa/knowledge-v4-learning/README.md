# Knowledge V4 learning candidate

The learning interface now supports three subjects at Beginner, Intermediate and Advanced levels (nine paths, four ordered guides each). Learners explicitly mark guides complete, reverse completion, resume their last unfinished guide or first unfinished step, review completed paths, and reset one path with confirmation. Progress and selection stay in localStorage in this browser, with no account, analytics or external API. Clearing site data removes progress; it does not sync across devices. When storage is blocked, full, or becomes unreadable, in-memory progress survives on the current page and the interface explains that it will not persist.

Article links carry `learn` and `level` context, provide previous/next navigation, and return to the selected path. Mere visits never count as completion. Active guided navigation suppresses competing legacy path navigation; disabled JavaScript, load errors, or partial indexes retain the original readable pages and legacy links. Native selects, buttons, progress meters, status announcements and focus handling support keyboard use. Responsive layouts were checked at 320, 375, 768 and 1280 pixels.

## Verification on 2026-10-10

- Node 22.22.0: `npm test` passed, including new progress tests and existing smoke/search/ontology/integration/editorial tests.
- CI ambiguity gate: 18/18 passed.
- Content generator: 270 articles, 143 glossary terms. Generated files include the new stylesheet/module; curriculum and retrieval data are unchanged.
- Chromium 151.0.7922.173 with Playwright 1.58.2: 14 browser scenarios passed; see `chromium-results.json` and `browser.log`.
- axe-core 4.11.1: zero WCAG 2 A/AA and 2.1 AA violations in the active article learning panel. This is an automated panel check, not a full-site accessibility certification.
- Existing search reports still contain weak matches and false positives. Their content is unchanged by this learning workstream; passing exit status does not mean every search query is a perfect match.
- GitHub browser CI passed all three engines: Chromium, Firefox and WebKit, with 14 scenarios each. Run: https://github.com/sweater9/intellitools/actions/runs/38031523530 (implementation commit `3f126393ef7553e0cda8f0dd2d09a6cb211a58c7`). The quality job also passed: https://github.com/sweater9/intellitools/actions/runs/38031523507. See `ci-checks.json`.
- A clean remote clone passed the Node suite, ambiguity gate and all 14 Chromium browser scenarios; regeneration produced no tracked diffs.
- Local WebKit passed all 14 scenarios, including axe, after installing signature/hash-verified Debian libraries into a user-owned sysroot; see `webkit-results.json` and `webkit.log`. Local Firefox could not finish startup under this container's namespace restrictions; its CI run passed. Initial network-policy failures cleared during this task and all browser archives downloaded successfully.

Screenshots: `chromium-learning-{320,375,768,1280}.png`, `chromium-article-375.png`. The fixed site header is hidden only during panel screenshot capture so it does not obscure the panel; functional tests run with the real header visible.

## Independent QA

Use the existing checkout; do not create a Git worktree unless explicitly requested. Node 22 and Python 3 are needed. No application dependencies need installation. Run:

```bash
npm test
node tests/knowledge-ambiguity-gate.mjs
node knowledge/src/build.mjs
python3 -m http.server 8000 --bind 127.0.0.1
```

In another shell, install browser tools outside the checkout and run:

```bash
npm install --prefix /tmp/intellitools-browser --no-audit --no-fund --package-lock=false playwright@1.58.2 @axe-core/playwright@4.11.1
/tmp/intellitools-browser/node_modules/.bin/playwright install --with-deps chromium firefox webkit
PLAYWRIGHT_PACKAGE=/tmp/intellitools-browser/node_modules/playwright/index.mjs \
AXE_PACKAGE=/tmp/intellitools-browser/node_modules/@axe-core/playwright/dist/index.mjs \
node tests/knowledge-v4-browser.mjs chromium
```

Repeat the last command with `firefox` and `webkit`. With an existing system Chromium, set `BROWSER_EXECUTABLE=/usr/bin/chromium` instead of installing that engine. `KNOWLEDGE_BASE_URL` can select a different local server; `KNOWLEDGE_ARTIFACTS` controls artifact output (default `/tmp/intellitools-v4-artifacts`). `AXE_PACKAGE` enables the optional automated accessibility scenario; CI enables it. The default suite has 13 scenarios, or 14 with axe enabled.

Tests rewrite the committed search report files; during onboarding, use a disposable copy if preserving all tracked files is required. The content build regenerates committed HTML and must run after generator changes. Browser tests target the local checkout and do not visit production.

Manual checks: select each level, start a path, read and mark a guide complete, use Next, return and Resume; reload/reopen a page; undo completion; cancel and confirm Reset; finish all four guides; verify another path's progress is unaffected. Inspect mobile widths, keyboard focus, and temporary-storage notices.

## Agent 2 integration contract

The coordination audit verified all 36 curriculum references against existing guides and confirmed `knowledge/search.js` matches `origin/main`. The old branch-local chooser was removed from that shared wrapper; learning initializes independently through the generator shell. Search owns `kn-search-*`, retrieval modules, index/lexicon and semantic/hybrid components. Learning owns `kn-learning-*`, `kn-v4-learning`, learning modules/styles and localStorage key `intellitools.knowledge.learning.v4`. It reads article metadata without modifying index data or ranking, and preserves existing `q`/`semantic` URL parameters when choosing a path. Curated step order must not change with search ranking.

The local Agent 2 coordination review found two fallback defects (late storage-read denial and partial-index navigation); both were fixed and given regression coverage. This audit does not represent integration of a separate, completed search-intelligence PR, which was not supplied to this session.

## External limitations

Environment installation/start instructions and required network additions are saved as a draft. Publication is a user action in environment settings; no tool in this session can publish or create a fresh cloud session. A fresh-process or clean-checkout test is not proof of cloud snapshot restoration. GitHub API and browser download access subsequently became usable. PR #32 was updated through the REST API and marked ready for review; the GraphQL-based `gh pr edit` encountered a deprecated Projects field. The environment draft includes `api.github.com`, `cdn.playwright.dev` and `playwright.download.prss.microsoft.com`. No merge into main or production deployment is authorized or performed.
