# Vibe Arcade — production release acceptance

Status: **DRAFT / NOT DEPLOYED**. This package now integrates Vibe Arcade at `/play/vibe-arcade/`, not the original standalone `/play/vibeline/` proposal. The current draft is PR #41; Mahjong Solitaire is PR #40.

## Automated release evidence

- Dedicated Game Release Gate on PR #41: passed Chromium, Firefox and WebKit at commit `def8ab93b4f91fa54189a879878d34de50ea5857`.
- The game gate runs `tests/mahjong-solitaire-browser.mjs` and `tests/vibe-arcade-browser.mjs` against a built `dist/` tree.
- Arcade browser coverage includes 320/375/390/400/460px and desktop, puzzle completion, persistence, offline behavior and touch/pointer handling. Emulated touch and browser automation do **not** substitute for physical-device acceptance.
- Quality, Mahjong review and Cloudflare review also passed at that commit. Other integration results must be rechecked immediately before release.

## Manual acceptance (not yet evidenced)

- [ ] On a physical iPhone/Safari and Android/Chrome, check 320/375/390/400/460px-equivalent widths: launch, navigate, complete Vibeline, Twofold and Carve; no accidental zoom or inaccessible board edges.
- [ ] Verify keyboard-only navigation and accessible status/labels. Carve currently requires pointer/touch; decide explicitly whether this is an acceptable launch limitation.
- [ ] Confirm game state and offline reload after browser restart and service-worker update.
- [ ] Confirm original saved-game schema from the **real legacy Vibeline implementation** or a representative real saved value for `vibeline:v1`. The automated migration fixture assumes `{level, best:{<level>:{t,h}}}`; it does not establish that the original app used that shape.
- [ ] Verify migration once, without overwriting `vibeline:v1` or existing `vibearcade:v1`; check invalid/corrupt input handling.
- [ ] Rebase/revalidate against accepted Mahjong PR #40, including five-game Play hub and four-player Mahjong exclusion.
- [ ] Obtain explicit approval before merge or deployment.

## Release control

No production merge, release pin, Cloudflare configuration change or deployment from this document. PR #42 and #43 address broader CI issues independently; game-specific passing checks cannot override a known gameplay defect or a required repository protection check. Keep four-player Mahjong excluded.
