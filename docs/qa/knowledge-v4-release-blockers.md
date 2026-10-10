# V4 release blockers D1–D3

Base: `c2456b3d70354ca271ff4423f3bfaf70f6f25b5d`, branch `feature/knowledge-v4-search-intelligence`, draft PR #33. No merge or deployment.

- **D1:** Learning mounts immediately after `#kn-search-results`. Both learning and search browser suites assert that a submitted RAG query's first result title is entirely inside 1280×800 and 375×800 viewports, `scrollY` remains zero, and learning follows results in document order. This checks actual viewport geometry, not merely DOM visibility; it does not claim the entire result list fits above the fold.
- **D2:** Synonym expansion reads only own properties and accepts only arrays. Tests exercise `constructor`, `what is a constructor in javascript`, every `Object.prototype` property name, inherited synonym definitions, and malformed own definitions. The browser wrapper catches unexpected retrieval or rendering failures, replaces partial/empty output with a safe message, and announces it through the status region. Browser fault injection makes the core and intelligence fallback fail, verifies the message, and verifies recovery on the next valid query.
- **D3:** The title bonus is 42 instead of 14 only when a query exactly matches a normalized comparison title containing `vs` or `versus`. Other title matching, confidence thresholds, and the frozen relevance dataset are unchanged. Both lexical and intelligent search now return `transformers-vs-state-space-models` for `transformers vs state space models`. Unit and browser assertions protect that outcome.

## Local validation

Node 22.22.0 `npm test`: passed. Relevance: 303/303 queries passed, 221 protected queries, zero regressions, zero wrong confident answers and unexpected tools in that dataset. The independent held-out suite passes its regression/floor checks at 53/69 query judgments (76.8%); its existing coverage limitations are unchanged. Legacy compatibility and relations freshness checks passed.

Learning browser suite with axe enabled: Chromium and WebKit each passed 15 scenarios, including the new D1 viewport assertions. Search browser suite: Chromium and WebKit passed, including inherited-property searches, D1 viewport assertions, D2 failure/recovery, D3 ranking, optional-asset fallback, and the existing rendering-time limit. Local Firefox startup is incompatible with this cloud container; the CI workflows run it on supported Ubuntu runners.

## Reproduce / CI evidence

```bash
npm test
PLAYWRIGHT_PACKAGE=/path/to/playwright/index.mjs AXE_PACKAGE=/path/to/@axe-core/playwright/dist/index.mjs node tests/knowledge-v4-browser.mjs chromium
BROWSERS=chromium node tests/knowledge-search-browser.mjs
```

Serve the checkout at `http://127.0.0.1:8000` for the learning suite (`python3 -m http.server 8000 --bind 127.0.0.1`). The search suite starts its own local server. Repeat both suites with Firefox and WebKit after installing their browser runtimes. A system or custom runtime can be selected with `BROWSER_EXECUTABLE` while testing one engine. The search suite accepts installed Playwright through normal Node resolution, including `NODE_PATH` for isolated external tooling.

The existing Quality workflow runs Node tests and all three search browsers; the Learning Browser QA workflow runs 15 learning scenarios per engine with axe. An unavailable engine fails search CI rather than counting as a pass. Authoritative commit-specific results are attached to [PR #33 checks](https://github.com/sweater9/intellitools/pull/33/checks).

D4–D8 remain follow-up items from the external QA report and are intentionally outside this change; their detailed descriptions were not included in this assignment. Keep PR #33 in draft until final review.
