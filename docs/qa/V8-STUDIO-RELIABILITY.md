# Studio interactions and Freelance Calculator reliability — Agent 2

Scope: `studios.js`, `studios-routing.js`, calculator support in `studios-core.js`, and Studio regression tests. No navigation/category, shared package scripts, deployment configuration, or other tool implementation changes.

## Findings and repairs

- **Repeated alias opens discarded the live workspace.** Routing called Close and mount rebuilt innerHTML every time. Active Studio aliases now select the existing panel without replacing its DOM, preserving form values, results and event handlers. Explicit Close removes the Studio DOM and clears retained preview/canvas references; opening an unrelated tool cleans up first.
- **Fresh QR mounts inherited old mode and canvas.** The shared engine's lexical `qrType` could remain Text/Wi-Fi while the newly rendered selector said URL. Fresh mounts synchronize the engine with the selector before calling `initQR` and clear the prior canvas. QR's existing generator/read/camera functionality remains shared.
- **Standalone initialization assumed an already parsed workspace.** The API is exposed synchronously for routing; standalone initialization waits for DOMContentLoaded once when necessary. A repeated DOM-ready event does not remount or discard user input.
- **Calculator results could describe old inputs.** Both quote and effective-rate results now invalidate immediately on an input edit. Calculation is still an explicit action.
- **Finite inputs could produce Infinity/NaN through overflow or underflow.** Numeric validation rejects whitespace/null/undefined inputs and out-of-range computed values. Effective rate from zero hours remains explicitly undefined; legitimate negative net income remains supported.
- Metadata aliases still enter Audit Only mode when opened inside an already active Studio. Category query parameters are retained.

## Evidence

Local `node --test tests/v8-studios.mjs`: **9 passed**, including exact quote arithmetic, whitespace, blank fields, overflow/underflow, negative net income and zero hours. Existing integration static checks: **11 passed**. JS syntax checks and static build/reference/precache verification passed (398 files / 13.02 MiB in the local checkout).

`tests/v8-studios-lifecycle.mjs` executes the actual shared engines, Studio scripts, DOM buttons and input events in jsdom 26.1.0. **5 passed after repair**. Running the same tests against the previous implementation yielded **4 failures / 1 pass**, demonstrating regressions rather than merely matching implementation details. Layout and canvas rendering are not claimed from these DOM tests.

Reproduce:

```sh
npm install --no-save --package-lock=false jsdom@26.1.0
node --test tests/v8-studios.mjs tests/v8-studios-lifecycle.mjs
npm run build
```

Native browser regression coverage is in `tests/v8-studios-lifecycle-browser.mjs` (375px and 1280px; twelve assertions per engine). A dedicated test-only workflow runs it in Chromium, Firefox and WebKit with Playwright 1.56.0. Local Chromium installation was attempted once and failed during browser archive download, so native browser execution for this change is pending CI. No assertions were skipped or reduced because of that limitation.

No merge or deployment. Existing broader staging blockers remain outside this focused repair unless their owning QA work clears them.
