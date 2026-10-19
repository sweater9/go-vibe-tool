# GoVibeTool AdSense Step 2 — implementation checklist

Status: preparation only. AdSense site status last reported **Getting ready**; ads.txt **Authorized**. No live ads may be activated by this document or config.

## Repository audit (2026-10-20)

- `ads.txt` contains Google seller authorization; preserve unchanged.
- `index.html` has AdSense account verification metadata, but deliberately avoids third-party executable scripts because sensitive tools share the homepage.
- `privacy.html` describes AdSense and browser-local processing; confirm accuracy of the present-tense claim 'uses Google AdSense to display advertising' while approval is pending.
- `privacy.html` contains an AdSense loader script. **Review and gate/remove it before claiming ads are disabled sitewide.** Do not add new ad scripts until consent requirements are satisfied.
- No consent-management integration was established by this audit; select and configure a Google-certified CMP where applicable, including EEA/UK/Switzerland requirements, before serving ads there.
- `tools/pdf-editor/index.html` has a restrictive CSP; preserve it and never load third-party ad scripts in editor pages.
- `play/vibe-arcade/index.html` combines hub and gameplay in one document; exclude the whole page until a reliable hub-only implementation exists.

## Policy

- All tools and games remain free. No forced views, pop-ups, interstitials, autoplay, sticky/anchor ads or download-gating.
- Maximum 2 clearly labeled ads per eligible page; initial plan is **one** slot on /play/ only.
- Homepage is **not approved for scripts** without isolation review; the configuration's homepage candidate is non-operational.
- Never access tool inputs, uploaded files, PDF content, game state or local-storage secrets from advertising code.
- Never place ads adjacent to buttons, navigation, game boards, download controls or upload zones.
- Reserve responsive space without CLS and hide unfilled slots; mobile QA at 375/390 px and desktop at 1280/1440 px.
- Approval, consent, privacy copy review, security review and browser regression tests are release gates.

## Activation gate

1. AdSense site status must be **Ready**, not merely ads.txt Authorized or Getting ready.
2. Confirm consent management and the privacy notice against actual scripts and jurisdictions.
3. Verify ad isolation on sensitive tools and games, including route transitions.
4. Implement slots only in eligible page templates; do not turn on Auto ads sitewide.
5. Run build, browser and mobile tests and review the resulting page before any production activation.

`config/ads-readiness.json` is a planning artifact only: no site code currently consumes it.
