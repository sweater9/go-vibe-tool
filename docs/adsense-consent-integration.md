# GoVibeTool consent integration and verification

## Status

Google AdSense European regulations message: user reports **published**. Site approval: last reported **Getting ready**. Advertising remains disabled.

## Confirmed Google behavior

- Publishing a Privacy & messaging message alone does not insert the required website tag.
- Google's published message can be previewed on a correctly tagged page using `?fc=alwaysshow&fctype=gdpr`.
- For IAB TCF, visitors must be able to revisit their consent preferences. Google provides a `googlefc` JavaScript API for consent revocation entrypoints.
- Do not build an independent fake consent dialog or treat a local checkbox as a substitute for Google's certified CMP.

## GoVibeTool rollout gate

1. Keep `config/ads-readiness.json` `enabled: false` and `ads/ad-gate.mjs` `ADS_ENABLED = false` until approval.
2. Before introducing any Google tag, verify whether Google's approved messaging setup can run separately from ad serving, and review all privacy/network implications. No Google scripts on tool workspaces, the homepage, or active game pages.
3. Once AdSense reports **Ready**, add the approved Google tag only to `/play/` with manual placements; do not enable site-wide Auto ads.
4. Verify the European message in a clean browser at `https://govibetool.com/play/?fc=alwaysshow&fctype=gdpr`. Check all three choices and 'Manage options'.
5. Implement a visible, accessible privacy-choice reopening link using Google's documented `googlefc` revocation API, only after its availability and lifecycle are verified in the browser.
6. Test acceptance, rejection, preference change, and navigation; no ad requests before the required consent state, and no ad scripts on excluded routes.
7. Validate desktop 1280/1440 px and mobile 375/390 px, including touch targets, scrolling, focus, navigation and game entry.
8. Confirm no layout shifts, overlay on navigation/download controls, or blocked functionality. Keep all tools and games free.

## Manual checks needed

- Confirm AdSense status **Ready** before enabling ad requests.
- Confirm Google message published for govibetool.com, and review European regulations settings for Google Consent Mode.
- Confirm consent link works from the site after integration; published dashboard status alone is insufficient.

References: https://support.google.com/adsense/answer/10924669 and https://developers.google.com/funding-choices/fc-api-docs
