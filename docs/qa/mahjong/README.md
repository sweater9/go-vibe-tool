# Mahjong review screenshots

These screenshots come from the real Chromium Playwright run on `ce8bacbe9542ef6eb5b0e0128f5ab12fc6690d91`, using the local authoritative room service and four independent guest contexts.

- `desktop.png`: 1280×900 viewport, full page.
- `mobile.png`: 375×900 viewport, full page.

The literal `<img...` player name is an intentional input-validation/XSS test. It is rendered as text and never inserted as HTML. The highlighted South seat has the current turn, so East's hand is disabled. Header capture waits for an instant scroll to the top, avoiding smooth-scroll/sticky-header screenshot artifacts.

All engines' lobby/table screenshots and machine-readable results are available in [the CI matrix artifacts](https://github.com/sweater9/go-vibe-tool/actions/runs/38308374340). Architecture, rules, costs and remaining staging gates are in [the implementation review](../../MAHJONG-MULTIPLAYER-REVIEW.md).
