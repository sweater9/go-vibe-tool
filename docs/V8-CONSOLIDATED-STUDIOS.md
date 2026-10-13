# GoVibeTool V8 — Consolidated Studios acceptance specification

Status: implementation branch; **not deployed or approved for production**.
Base: `feature/v8-discovery-navigation`. Integrate Agent 1 and Agent 2 work before release acceptance. Keep nine top-level categories.

## Four approved consolidations

### URL & Link Studio (Links & Web)
Combine URL Cleaner, URL Inspector, UTM Builder, Tracking Parameter Detector and Link Fingerprint Inspector. One pasted URL provides parsed scheme/host/path/query, tracking parameter audit, cleaned link, and fingerprint/suspicious-character signals. UTM builder is an optional expandable section. Provide Copy Clean URL. Never imply a URL is safe just because checks pass.

### Freelance & Hourly Rate Calculator (Business & Finance)
Combine Effective Hourly Rate and relevant percentage-change arithmetic into a richer pricing workflow: target income, available hours, billable utilization, overhead, optional user-entered tax assumptions, margin and quote generation. Keep Percentage Change independently searchable and directly accessible because it is a general-purpose calculation. No jurisdiction-specific tax assertions.

### QR Studio v2 (Links & Web)
Integrate QR Payload Validator into QR Studio: validate URL or plain-text payload inline, render QR preview, and export. Plain text is valid; warn for malformed URLs without blocking valid text.

### PII & Secret Redactor (Privacy & Security)
Integrate Text Metadata Check into PII & Secret Redactor. Provide Audit Only (detect/classify, unchanged text) and Auto-Redact (preview masks, selectable categories, explicit apply/copy). Keep processing browser-local and never send content to remote services.

## Non-negotiable compatibility
- Preserve existing tool IDs, `?tool=<id>` deep links and standalone URLs; legacy links open the relevant consolidated section.
- Preserve favourites and recently-used local storage; old IDs resolve to the correct studio.
- Search returns the studio for legacy names, synonyms and original tool intents.
- Maintain nine top-level categories; no extra category.
- No unrelated IntelliTools changes; no production, DNS, Cloudflare or AdSense changes.
- Avoid adding third-party network calls for processing; avoid collecting sensitive input.

## QA and release gate
1. Integrate Agent 1's five tools and Agent 2's four tools, resolving `index.html`, `sw.js`, `package.json` and test/workflow overlaps.
2. Unit tests for all four studio workflows, malformed inputs, offline behavior, and legacy aliases.
3. Verify build/dist output and service-worker cache versioning.
4. Browser tests Chromium/Firefox/WebKit at desktop and mobile widths: all nine new tools, four studios, nine categories, search, favourites, recents, Knowledge/Labs/Play and deep links.
5. Deploy only to the existing Render staging service after green tests; Render must publish verified `dist` rather than raw repository root for acceptance.
6. Document evidence and outstanding defects before Product GO. No production changes without separate approval.
