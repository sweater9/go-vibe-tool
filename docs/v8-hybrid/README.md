# V8 category-first homepage — verification notes

Concept B visual identity + Concept A navigation. "Start with these" and its featured cards are removed; the public total is "50+ tools". Screenshots captured with headless Chromium against the branch build.

Category "Files & PDF" is now "PDF & Tables" (same id `files-pdf`, same URL). Every listed tool sits in exactly one category.

Homepage order: header + nav → short intro (50+ tools) → 9 category tiles → search → Learn / Knowledge / Labs / Play → About → approved privacy block → footer. The homepage renders no catalogue cards; a category tile opens `?category=<id>` (dedicated view with all of that category's tools, Open/favourite actions, "All categories" back link, browser Back/Forward).

## Positions (px from page top)

| Viewport | 375 | 390 | 768 | 1024 | 1440 |
|---|---|---|---|---|---|
| First category tile | 332 | 335 | 312 | 337 | 347 |
| Search section | 772 | 775 | 613 | 616 | 626 |
| Catalogue cards on homepage | 0 | 0 | 0 | 0 | 0 |
| Page height | 3193 | 3108 | 2300 | 1992 | 1959 |

No horizontal overflow at any width. Real tool/category counts are computed from the catalogue (`tools.filter(isListed)`), never hard-coded. `docs/concepts/v8/*.html` are historical mock-ups and still say "51 tools".

Files: `home-<w>.png`, `full-<w>.png`, `states/` (category view, search results, open mobile menu).
