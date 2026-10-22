# CI test selection (risk-based)

Pull-request CI no longer runs every browser suite for every change. A `plan` job runs
`scripts/ci-plan.mjs` against `config/ci-risk.json`, classifies the diff, and each gated workflow
reads the resulting plan (`needs.plan.outputs.plan`). Skipped jobs count as passing for required checks.

## Tiers

| Tier | When | What runs |
|---|---|---|
| `docs` | Only docs/markdown globs changed | Essentials only |
| `minor` | Styling, images, or text-only HTML edits (modified file, ≤40 changed lines, no new scripts/links/forms/handlers/images/meta) | Essentials + the changed area's unit tests + that area's smoke suites, Chromium only |
| `feature` | Changes confined to known areas (pdf, play, mahjong, knowledge, labs, utilities, pages) | Essentials + those areas' unit tests + their browser suites; cross-browser areas (play, mahjong, pdf) on Chromium/Firefox/WebKit, others Chromium. V8 regression only for areas that affect the homepage |
| `shared` | Any shared or unclassified file (`sw.js`, `package.json`, `tools.js`, homepage, scripts, config, workflows, vendor, new unknown paths…) | Full regression: `npm test`, all browsers, all V5 suites, maintenance A/B, V8 regression |
| `full` | Manual run, or PR label `ci:full` | Same as `shared` |

When in doubt the classifier escalates; a missing/zero base SHA or any classifier error also means full.
A docs file next to code does not lower the tier; one real code change in a "minor" set makes it `feature`.

## Always run (every tier)

`npm run test:essentials`: static build, Cloudflare preview config, live-asset verification, AdSense
readiness/gate, V5/V8 service-worker tests, and homepage script parsing. Production deploy workflows are
unchanged (pinned, manual, approval-gated).

## Running everything manually

- Actions → **CI full regression (manual)** (`ci-full.yml`) calls all gated workflows with force-full.
- Or run any single workflow via *Run workflow* (`workflow_dispatch` always means full).
- Or add the `ci:full` label to a pull request.
- Locally: `npm test`; preview the plan with `node scripts/ci-plan.mjs --base <sha> --head HEAD`.

## Other changes

- The PDF Editor QA workflow also covers PDF Compare; its Cloudflare-preview job (up to 15 min wait) runs only on manual runs.
- `concurrency` with cancel-in-progress added where missing, so superseded pushes stop burning runners.
- `tests/ci-plan.mjs` (part of `npm test`) checks the rules, glob matching, and that every script/suite named in the config exists.

## Maintaining the rules

Edit `config/ci-risk.json` (paths per area, unit scripts, suites). New top-level folders are `shared` until added to an area.

## Limitations

The workflow YAML could not be executed locally; it was validated for syntax and reviewed by hand. The first PR run is the real check.
