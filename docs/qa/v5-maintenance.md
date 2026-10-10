# V5 maintenance verification

The maintenance candidate starts at production merge `3f7976af0763cda9107baf50944a8ed1252ea1eb` and fixes D1–D5 and the service-worker fallback defect discovered during browser QA. The existing `fix/v5-postlaunch-homepage-escape` commit `bce9f084228dd5cecd11384a3747cb7923bf13cf` was inspected; its one-line newline correction is included without merging that branch.

- D1: Replace the literal section separator `\n` with a newline.
- D2: Give the homepage catalogue search an explicit accessible name.
- D3: One tab stop in the labelled quiz radiogroup; arrow/Home/End answer selection; native Space/Enter activation; scoped A–D/1–4 shortcuts; retain focus on the chosen answer, then Tab to Next; focus the first answer in the next question. Only the user-selected answer is checked, including wrong answers. Locked answers use `aria-disabled` and cannot change the recorded result. Native Enter no longer advances twice.
- D4: Homepage controls and navigation/footer links have at least 44px target height; narrow navigation links and favourite buttons also have 44px width. Rules are scoped to the homepage.
- D5: Quick Start uses four equal grid rows with consistent text/icon/arrow columns and line heights.

The service worker now leaves cross-origin requests to the browser, and returns a network error for uncached non-navigation assets rather than incorrectly returning homepage HTML as JavaScript or CSS. Cached assets and offline navigation fallback remain supported; `tests/v5-service-worker.mjs` covers these behaviors.

The approved privacy eyebrow, headline, body and indicators remain byte-for-byte unchanged. `tests/v5-maintenance.mjs`, included in `npm test`, guards the full block.

## Browser reproduction

Install Playwright and browser dependencies, then run (the maintenance runner serves an isolated checkout automatically):

```sh
npm test
BASE_URL=http://127.0.0.1:8765 node tests/v5-maintenance-browser.mjs chromium
BASE_URL=http://127.0.0.1:8765 node tests/v5-maintenance-browser.mjs firefox
BASE_URL=http://127.0.0.1:8765 node tests/v5-maintenance-browser.mjs webkit
```

The separate production smoke command is:

```sh
BASE_URL=https://intellitools.online PRODUCTION_SMOKE=1 node tests/v5-maintenance-browser.mjs chromium
```

Repeat for Firefox and WebKit. The production workflow can be dispatched on this maintenance branch; it reads production and does not deploy.

Each engine checks 1440, 1024, 390 and 375px widths, with 8 scenario groups per width: homepage/54-tool catalogue/privacy/navigation/shortcuts, three existing tool workspaces, Knowledge search and article navigation, workflow simulation/save, mock API response/invalid JSON, daily quiz completion/persistence, word puzzle solve, and service-worker precache/controller and offline fallback. Candidate tests simulate an actual localhost server outage, exercising service-worker fallback in all engines without Playwright offline transport restrictions. Production verifies offline reload in Chromium; Firefox/WebKit live offline navigation remains unverified because Playwright offline transport prevents service-worker dispatch. Their production cache/controller checks still execute. The limitation is recorded in JSON, not presented as an offline pass. JSON results and homepage/workflow screenshots are uploaded by CI. Production reports D1–D5 findings separately from functional failures because those fixes have not been deployed. A smoke pass does not mean the production defects have disappeared.

The isolated candidate server omits only the external advertising script from served homepage HTML (including its service-worker precache) to isolate application regressions; the checkout and production HTML are not altered by the harness. Production tests do not intercept advertisements. JavaScript and console errors fail the run. Missing Playwright or browser launch failures do not silently pass.

## Deployment and environment evidence

GitHub Pages build/deployment run `38053075015` and post-merge Quality run `38053075753` both succeeded for the specified V5 merge SHA. Pages API reports `built`, custom domain `intellitools.online`.

Direct production HTTPS from the cloud workspace returned a proxy CONNECT HTTP 403 even after network permission was granted. An actual local Chromium production attempt returned `net::ERR_TUNNEL_CONNECTION_FAILED` with zero successful scenario groups. This is blocked verification, not a pass. Local Firefox was previously unable to launch reliably under the container namespace restrictions; the three-engine GitHub Actions matrix is the required evidence for Firefox. Final workflow results and release recommendation are recorded in the PR handoff.

No merge, production deployment, main modification, external AI dependency, or privacy-copy rewrite is included.

## Final code review and error attribution

D1–D5 product changes were reviewed against the production merge. The approved privacy block was independently compared byte-for-byte against main. Follow-up changes add verification only: origin/phase tracing of production exceptions, service-worker responses containing HTML for external requests, and offline initialization of all four previously visited V5 experiences during a candidate server outage.

Google AdSense stack frames identify where an exception is thrown, but do not alone prove a third-party cause. The deployed worker's failed-GET fallback can return the cached homepage even to cross-origin ad requests; that application behavior must not be dismissed as a third-party error. Production JSON now records the request URL, resource type, response content type, whether the response came from the service worker, and the body prefix. All JavaScript errors still fail the production run; classification does not filter them out. Final captured evidence and merge recommendation are recorded in the PR description.

The candidate leaves cross-origin requests to the browser, returns network errors for uncached non-navigation assets, and preserves the existing offline HTML fallback for navigation. Offline deep links are verified after their online visit; uncached navigation can still fall back to the homepage. Third-party advertising is not promised to work offline. The isolated candidate harness omits advertisements, so the unmodified advertising integration requires a separate post-approval production smoke run. A GO for merging this repair is distinct from certifying an undeployed production version.
