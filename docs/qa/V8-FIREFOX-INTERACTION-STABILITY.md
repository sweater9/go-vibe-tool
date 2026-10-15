# Firefox Studio interaction stability

Scope: intermittent Firefox failures in the Studio tab and Freelance Calculator checks. No assertion was removed or
weakened (integration suite 44 `assert.` calls before and after; lifecycle suite 13 before and after), the nine
categories, stable tool IDs and browser-local behaviour are untouched, and nothing was deployed.

## Root causes (two, independent)

**1. Press and release straddling a smooth-scroll animation (Playwright interaction timing).**
`v2.css` sets `html{scroll-behavior:smooth}`. In Firefox a `fill()`/`click()` chain on the Studio pages can press the mouse
while the page is still scrolling, so the release lands on a different element. Recorded failure (lifecycle suite, run at
`a2f321d`): `pointerdown` target `#calcRate`, `pointerup` target `#rateResult` (pointer y differs by about 0.45 px), `click`
dispatched on the common ancestor `#studio-freelance`. The button handler never ran. Application handlers were bound in
100 % of probe runs and every recorded pointer event reached the intended element at press time, so this is not an
application event-handling defect.

**2. Studio visible before `studios.css` (navigation timing).**
`index.html` did not link `studios.css`; `studios.js` injected it after the Studio was already shown. Leaving the page
right after the Studio appeared left a service-worker-intercepted request in flight, which Firefox reports as
"A ServiceWorker intercepted the request and encountered an unexpected error" (the worker's fetch handler never rejects;
see the comment in `sw.js`). About 2 % of runs, independent of motion.

## Fix

- `index.html` links `studios.css` in the head. `mount()` already skips injection when the link exists.
- `tests/v8-integration-browser.mjs` (desktop and mobile contexts) and `tests/v8-studios-lifecycle-browser.mjs` run with
  `reducedMotion: 'reduce'`, which `v8.css` already honours. `V8_REDUCED_MOTION=0` restores default motion. The
  keyboard/offline context and the new late-stylesheet test keep default motion.
- Guards: a static check in `tests/v8-integration.mjs` (fails on the old `index.html`) and
  `tests/v8-studios-late-stylesheet-browser.mjs` (delays `studios.css` 700 ms).
- `V8_STUDIO_EVENT_TRACE=1` was set by the release-candidate workflow but read by no code. It now enables a
  failure-only trace in the integration suite.

## Evidence (all Firefox unless stated; counts are failing runs)

| Experiment | Commit | Result |
|---|---|---|
| Baseline integration, untraced and traced | `7f3ed83`, `5ff42ba` | 10 of 120 |
| Late-stylesheet probe, 4 delay/service-worker modes x 2 widths x 12, all engines | `7f3ed83` | 0 lost clicks (hypothesis "layout shift loses clicks" rejected) |
| Isolated scroll replay | `c0ded75` | 1 of 180 shipped, 0 of 360 otherwise (too weak to conclude) |
| Real-suite A/B/C | `260eca3` | shipped 5 of 40 (4 interaction, 1 service-worker); reduced motion 1 of 80 (service-worker); CSS scroll off 2 of 80 (service-worker). All 4 interaction failures were in the control (p about 0.0014) |
| Lifecycle A/B | `a2f321d` | shipped 3 of 200; reduced motion 0 of 200 |
| **Final integration x20, 10 shards** | `369ea8b` | **0 of 200** |
| Final Studio lifecycle x20 | `369ea8b` | 0 of 20 |
| Final regression, 10 suites each | `369ea8b` | Chromium, Firefox, WebKit all pass |
| Developer suite x20, 3 shards (informational) | `369ea8b` | 1 of 60 (see risks) |

CI logs and artifacts were not retrievable from the authoring environment, so evidence comes from job conclusions and
CI annotations written by `tests/diag/emit-annotation.mjs`. One-off diagnostics were removed from the tree and remain in
history at the commits above.

## Remaining risks

- The fix for cause 1 is in the test harness. The product still smooth-scrolls, and a real user is not affected by the race,
  but the two main interaction contexts no longer exercise the default-motion path.
- `v8-developer-browser` failed once at the PR head (`7664e1b`) and once in 60 informational runs
  (`375 native hash/HMAC, UUID batch, token bounds...`, empty result after an interaction). Same signature, different
  suite; not diagnosed and not changed. A reduced-motion ablation like the one above is the next step.
- Cause 2 had a roughly 2 % base rate. 0 of 200 afterwards is consistent with the fix (about 2 % chance if nothing changed)
  but is not proof. The new browser test was green on all three engines; only its static counterpart was shown to fail
  before the fix.
- Other suites that chain `fill()`/`click()` in Firefox may have the same exposure; none has failed in this evidence.
