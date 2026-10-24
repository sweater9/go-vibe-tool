# Phase 1 route classification — 2026-10-20

Source-only review; live govibetool.com HTTP requests could not be completed in this environment. Do not treat source file existence as proof of deployment or indexability.

| Missing path | Source finding | Decision |
| --- | --- | --- |
| /404.html | Error page | Exclude |
| /knowledge/hugging-face-transformers.html | Redirects to hugging-face.html; canonical targets destination | Exclude |
| /knowledge/ | index.html has canonical /knowledge/index.html | Hold: decide canonical consistency before sitemap change |
| /play/daily/ | noindex, retired redirect | Exclude |
| /play/mahjong/ | Four-player game source exists, but route retired from discovery | Exclude; do not restore multiplayer |
| /play/vibe-arcade/new-games.html | Standalone Crown Grid / Loopcraft page with title and description | Hold for live status, canonical and navigation verification |
| /studios.html | Standalone consolidated studios page | Hold for production/public navigation verification |
| /tools/pdf-editor/ | Canonical self-reference and descriptive metadata | Strong candidate pending live HTTP/indexability verification |
| /tools/pdf-studio/ | noindex redirect to /tools/pdf-editor/ | Exclude |
| /tools/v9-media/ | Standalone local media page | Hold for canonical, live status and navigation verification |

## Remaining release gates
- Live HTTP 200/redirect behavior, robots headers, meta robots and canonical alignment.
- Source-to-deployment mapping, navigation reachability, no accidental exposure of experimental pages.
- Validate 301 existing sitemap entries against published pages and preferred canonical URLs.
- Search Console indexing data and regression tests.
- No changes to gameplay, design, downloads, privacy, AdSense/consent, Cloudflare, or production.
