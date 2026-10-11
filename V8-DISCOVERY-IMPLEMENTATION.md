# GoVibeTool V8 — Discovery & Navigation

Status: implementation brief; NOT a completed redesign. Target branch: `feature/v8-discovery-navigation`. Do not merge without owner review.

## Approved identity
- Brand: GoVibeTool only. Preserve IntelliTools and all other repositories.
- Primary logo: rounded violet square with white four-point sparkle, paired with bold black “GoVibeTool” wordmark; user-supplied reference is authoritative. Do not substitute the prior GV icon.
- Visual character: modern, vibrant, professional, premium. Deep navy, violet, lavender, white/off-white; teal only as restrained supporting accent.
- Respect reduced-motion preferences, WCAG AA text contrast, keyboard navigation and 44×44 px tap targets.

## Information architecture
1. Top navigation: Discover, Tools, AI & Prompts, Learn, Labs & Play. Mobile navigation must be keyboard accessible.
2. Search-first hero: “What do you want to accomplish?” with working catalogue search and task suggestions. No fake search field.
3. Category discovery: AI & Prompts, Productivity, PDF & Tables, Images & Design, Privacy & Security, Developer, Business & Finance, Writing & Text. Category cards must filter/navigate to existing real tools.
4. Curated “Start with these” and useful/popular task entry points. Do not invent popularity analytics.
5. Personal workspace: favourites and recently used. Reuse existing localStorage and functions; do not clear/migrate saved user data without compatibility.
6. Learn, Knowledge, Labs and Play remain discoverable but distinct from utility catalogue.
7. Preserve existing tool IDs, standalone URLs, sitemap, service-worker/offline behavior and privacy disclosures.

## Technical boundaries
- Static HTML/CSS/vanilla JS, no bundler or external UI libraries.
- Keep current tools functioning; avoid rewriting tool implementations.
- Work only in this branch; separate from `feature/prompt-library`.
- No custom domain, DNS, IntelliTools or production changes.
- Do not change AdSense/privacy wording as part of visual redesign.
- Preview must be a separate Render service/branch deployment, not a forced update of the main preview.

## Acceptance criteria
- 375px, 390px, 768px, 1024px and 1440px without horizontal overflow.
- Search, category selection, featured shelf, favourites, recent tools, tool opening and closing all functional.
- All controls keyboard-operable, labelled and accessible; reduced-motion support.
- Run full `npm test`, existing maintenance/browser suites and Chromium/Firefox/WebKit smoke coverage; report failures precisely.
- One unmerged PR with screenshots or preview link and clear checklist of tests.
