# Rapid release standard — tools and games

**Target:** release a small, well-scoped, browser-first tool or game in **60–120 minutes** from approved scope to production verification. This is a service target, **not a guarantee** and never permission to skip safety, required branch protections, or explicit deployment approval.

## Before coding (0–10 minutes)
- Record route, feature scope, acceptance criteria, data/storage migration contract, supported browsers, mobile widths, offline requirements, dependencies and rollback path in the PR.
- Verify any original source or historical localStorage schema **before** implementing a migration; if unavailable, explicitly classify migration as unverified, don't invent a fixture.
- Identify production-impacting changes (shared JS/CSS, service worker, routes, navigation). Agree on any exception to the standard timeline immediately.
- No scope creep after this point; new ideas become follow-up issues.

## Build + parallel tests (10–65 minutes)
- Build incrementally; run lint/static checks and game/tool-specific unit tests first.
- Run the built artifact through a scoped browser matrix (Chromium, Firefox, WebKit), including mobile widths 320/375/390/430 and desktop, touch or pointer/keyboard as applicable, offline, persistence, navigation and security boundaries.
- Do **not** wait for full-site suites before starting focused acceptance. Run broad regressions in parallel. A broad regression failure needs a documented impact assessment, not automatic dismissal.
- Treat flaky tests as engineering issues: preserve logs, identify the failing assertion, reproduce or isolate, and fix without weakening meaningful product assertions.

## Release decision (65–95 minutes)
- Single checklist: all scope requirements verified, no critical game/tool defects, no known shared-production regression, migrations verified from original schema, manual checks evidenced where required, rollback prepared.
- Classify each check as PASS / FAIL / NOT VERIFIED / NOT APPLICABLE, with evidence links. Never relabel NOT VERIFIED as PASS.
- A failed required repository check remains blocking until corrected or explicitly handled under authorized repository policy. No bypasses.
- Obtain explicit production approval; do not infer approval from permission to test or prepare.

## Publish + verify (95–120 minutes)
- Merge only the approved, validated commit; deploy via the established production pipeline.
- Verify live route, assets, game/tool core workflow, mobile navigation, offline/update behavior and production console/network errors.
- If live smoke fails, roll back and report the exact failure. Never claim a launch from green PR checks alone.

## Escalation and scope control
- At ~60 minutes, report whether the 120-minute target is realistic and the specific blocker, with a proposed path. Do not hide a blocker or silently extend the scope.
- At 120 minutes, either publish a verified release **with authorization**, or explicitly report HOLD with the smallest concrete remaining work and evidence.
- Complex multi-game releases, major architectural changes, migrations without source evidence, or unavailable physical-device acceptance may exceed the target. Separate them into smaller shippable increments when safe.
- Keep unrelated improvements out of the release PR; track them separately.

## Current baseline
- PR #40 Mahjong Solitaire and PR #41 Vibe Arcade use `.github/workflows/game-release-gate.yml` for focused cross-browser validation.
- Four-player Mahjong must remain excluded.
- Manual physical-device checks cannot be asserted based only on Playwright emulation.
- No automatic merge, production deployment, Cloudflare configuration or release-pin change is authorized by this document.
