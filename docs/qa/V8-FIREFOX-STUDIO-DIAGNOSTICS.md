# Firefox Studio interaction diagnostics

Instrumentation is confined to the Playwright test harness; production Studio code is unchanged.

`tests/helpers/studio-interaction-recorder.mjs` records document initialization/readiness, `pointerdown`, `pointerup`, capture-phase `click`, active-tab transitions, calculation requests, post-click calculation completion, and observed calculator-result changes. Records include document-local sequence/time, test-step label, pointer coordinates/type, target/button ID, hit-tested element, workspace readiness and selected tab. This distinguishes a pointer failing to reach a control, a click not reaching its handler, a tab not selecting, and a calculator not updating its result.

Input values, passwords, cookies, localStorage and URL query strings are omitted from the structured event log. Calculator output and Playwright DOM snapshots contain automated fixture data. The recorder runs only in automated local/CI test pages, never in the shipped site. Collection is bounded at 10,000 events per viewport and explicitly reports dropped events and collection errors.

## Artifacts

Normal Firefox runs always save event logs for 375px and 1280px:

- `artifacts/studios-lifecycle-firefox/interactions-375.json`
- `artifacts/studios-lifecycle-firefox/interactions-1280.json`
- `artifacts/studios-lifecycle-firefox/results.json`

Each Firefox context starts tracing before navigation with screenshots, DOM snapshots and source capture. A failed check or setup/navigation error saves the matching `trace-375.zip` or `trace-1280.zip`. Successful context traces are discarded. CI uploads the whole diagnostic directory even when the test fails; existing assertions remain intact.

Open a saved trace:

```sh
npx playwright show-trace artifacts/studios-lifecycle-firefox/trace-375.zip
```

## Failure-path verification

The dedicated Studio workflow first runs all normal assertions, then runs a separate Firefox artifact probe. `GVT_STUDIO_DIAGNOSTIC_PROBE=1` deliberately fails the initial calculation check after clicking the real button. Both viewport failures must produce a process exit code of 1. `tests/v8-studio-diagnostics-artifacts.mjs` requires exactly those two controlled failures, all requested event types, no dropped events, and valid trace ZIP archives containing trace and network data. Unexpected failures still fail CI. Probe artifacts are stored separately under `artifacts/studios-diagnostics-probe-firefox/`, so they cannot replace normal results.

```sh
GVT_STUDIO_DIAGNOSTIC_PROBE=1 \
  STUDIO_QA_ARTIFACTS=artifacts/studios-diagnostics-probe-firefox \
  node tests/v8-studios-lifecycle-browser.mjs firefox
# The probe must exit 1.
node tests/v8-studio-diagnostics-artifacts.mjs artifacts/studios-diagnostics-probe-firefox
```

Local validation: all 17 recorder/Studio unit and DOM tests passed, including event ordering, secret omission, collection bounds, closed-page evidence retention and existing lifecycle behavior. Native normal/failure-probe verification runs in GitHub Actions; CI results are the final validation for actual Firefox pointer events and trace files.
