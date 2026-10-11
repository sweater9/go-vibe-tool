# V8 hybrid homepage — verification notes

Concept B visual identity + Concept A navigation/content. Screenshots in this folder were captured with Chromium (headless) against the branch build.

## First tool card position (top of the first featured tool card, px from page top)

| Viewport | 375 | 390 | 768 | 1024 | 1440 |
|---|---|---|---|---|---|
| First featured card | 615 | 598 | 653 | 626 | 636 |
| First catalogue card | 1150 | 1133 | 1012 | 924 | 894 |

Targets: ≤ ~700 desktop, ≤ ~850 mobile. Prior measurements for reference: Concept B 652 / 759, Concept A 766 / 1,223 (first catalogue card), V8 rejected 2,303 / 4,399. No page-level horizontal overflow at any width above.

Files: `home-<w>.png` (first screen), `full-<w>.png` (full page), `states/` (search with Learn/Labs/Play matches, category filter with favourites + recents, open mobile menu).
