# GoVibeTool consent integration and verification

## Status

Google AdSense European regulations and US state regulations messages: user reports **both published**. US geography configured for all current and future supported states; site logo added. Site approval: last reported **Getting ready**. Advertising remains disabled.

## Confirmed Google behavior

- Publishing a Privacy & messaging message alone does not insert the required website tag.
- Google's published message can be previewed on a correctly tagged page using `?fc=alwaysshow&fctype=gdpr`.
- For IAB TCF, visitors must be able to revisit their consent preferences. Google provides a `googlefc` JavaScript API for consent revocation entrypoints.
- Do not build an independent fake consent dialog or treat a local checkbox as a substitute for Google's certified CMP.

## GoVibeTool rollout gate

1. Keep `config/ads-readiness.json` `enabled: false` and `ads/ad-gate.mjs` `ADS_ENABLED = false` until approval.
2. Before introducing any Google tag, verify whether Google's approved messaging setup can run separately from ad serving, and review all privacy/network implications. No Google scripts on tool workspaces, the homepage, or active game pages.
3. Once AdSense reports **Ready**, add the approved Google tag only to `/play/` with manual placements; do not enable site-wide Auto ads.
4. Verify both messages in clean browsers using Google's documented debug parameters on a correctly tagged page:
   - EU: `https://govibetool.com/play/?fc=alwaysshow&fctype=gdpr` (Consent / Do not consent / Manage options).
   - US California: `https://govibetool.com/play/?fc=alwaysshow&fctype=ccpa` (opt-out link and confirmation).
   - US other supported states: `https://govibetool.com/play/?fc=alwaysshow&fctype=usnat`.
   - Florida: `https://govibetool.com/play/?fc=alwaysshow&fctype=usfl`.
   These links are **not expected to display messages until Google's required tag is installed**.
5. Implement visible, accessible privacy-choice reopening using Google's documented `googlefc` revocation API and the US opt-out link behavior, only after their availability and lifecycle are verified in the browser. Avoid hiding Google's default US opt-out link until a working equivalent exists.
6. Test acceptance, rejection, preference change, and navigation; no ad requests before the required consent state, and no ad scripts on excluded routes.
7. Validate desktop 1280/1440 px and mobile 375/390 px, including touch targets, scrolling, focus, navigation and game entry.
8. Confirm no layout shifts, overlay on navigation/download controls, or blocked functionality. Keep all tools and games free.

## Manual checks needed

- Confirm AdSense status **Ready** before enabling ad requests.
- Both messages reported published by the user; review European regulations settings for Google Consent Mode and confirm the US state opt-out behavior on the live site.
- Confirm consent link works from the site after integration; published dashboard status alone is insufficient.

References: https://support.google.com/adsense/answer/10924669 and https://developers.google.com/funding-choices/fc-api-docs

## Integration caveat

Google documents that Privacy & messaging messages are served by the AdSense/publisher tag; no standalone messaging-only tag is established by the referenced documentation. A published dashboard message alone is not evidence that a message appears on an untagged page. Do not add the ad-serving tag just to make a test pass while site approval and consent handling are unresolved. Maintain the fail-closed gate and record a separate approval decision before tagging any page.
