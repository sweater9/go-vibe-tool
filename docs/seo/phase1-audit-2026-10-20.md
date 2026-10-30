# GoVibeTool SEO Phase 1 — Non-invasive audit (2026-10-20)

Scope: repository main branch vs sitemap.xml. This is an inventory, not a live HTTP, Google indexing, or canonical verification.

## Confirmed
- robots.txt allows crawling and points to https://govibetool.com/sitemap.xml.
- sitemap.xml has 301 URL entries.
- Homepage includes canonical, description, social metadata, and AdSense account metadata.
- 310 HTML files exist outside docs/ in the repository; file existence does not prove publication/indexability.

## HTML paths missing from sitemap (investigate, do not automatically add)
- /404.html — keep excluded
- /knowledge/hugging-face-transformers.html
- /knowledge/ — inspect canonical and indexability
- /play/daily/ — verify whether legacy or duplicate
- /play/mahjong/ — verify whether legacy or duplicate (do not restore retired multiplayer)
- /play/vibe-arcade/new-games.html
- /studios.html
- /tools/pdf-editor/
- /tools/pdf-studio/
- /tools/v9-media/

## Required validation before sitemap edits
1. Confirm live HTTP 200, canonical, robots meta, and actual navigation for each candidate.
2. Exclude redirects, noindex pages, retired/legacy routes, 404s, and duplicate canonical destinations.
3. Ensure sitemap lastmod represents actual substantive changes, not arbitrary dates.
4. Check sitemap-listed URLs against real deployed routes, not only source-tree paths.
5. Check Search Console indexing and Core Web Vitals separately; neither is verified by this audit.
6. Add regression tests for URL validity, canonical alignment and sitemap coverage.

## Non-negotiable safeguards
No changes to homepage appearance, tool layouts, Vibe Arcade, PDF editing, downloads, privacy handling, advertising/AdSense/consent, Cloudflare, or production deployment. Keep changes on a separate branch and draft PR until CI and review pass.
