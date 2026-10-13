# V8 combined integration — QA report

Branch: `integration/v8-combined-acceptance` (from `feature/v8-discovery-navigation` @ `ca5f926`)
Target of the draft PR: `feature/v8-discovery-navigation`. Nothing here is merged to `main`, deployed, or pointed at production.

## What was integrated

| Branch | Merge | Conflicts |
| --- | --- | --- |
| `feature/v8-developer-design-tools` (5 tools) | clean | none |
| `feature/v8-file-media-tools` (4 tools) | `index.html`, `package.json`, `sw.js` | resolved as a union (script tags, npm test chain, precache list) |
| `feature/v8-consolidated-studios` (4 studios) | `index.html`, `sw.js` | resolved as a union; see defect 1 |

Result: 75 catalogue entries / 60 listed tools, still exactly nine top-level categories
(`ai-prompts, productivity, files-pdf, images-design, privacy-security, developer, business-finance, writing-text, links-web`).

## Defects found and fixed

1. **`sw.js` syntax error / `index.html` stray text** — the studios branch wrote literal `\n` into the precache list (`"./studios.html",\n  "./studios.js"…`), which is a syntax error that would stop the service worker installing, and a literal `\n` text node into the home page. Fixed. Regression: `tests/v8-integration.mjs`.
2. **Studio routing used non-existent tool IDs and captured richer tools** — `effective-hourly-rate` and `link-fingerprint-inspector` do not exist (the real IDs are `hourly-rate` and `link-fingerprint`), while `qr-studio`, `pii-secret-redactor` and `percentage-change` were diverted to a smaller page. That broke the Prompt Improver's "Open PII & Secret Redactor" button (`prompt-improver-browser` failed against the combined branch and passes on the base), lost Wi-Fi/contact/scan QR, and contradicted the spec's "keep Percentage Change independently accessible". Routes now use real IDs and cover only tools the studio fully replaces. Regression: static + browser tests.
3. **QR Studio v2 could not generate a QR code** — it used a `QRCode` constructor from a different library than the vendored `qrcode()` one ("QR library unavailable"). Rewritten against the vendored API.
4. **Offline deep links with a query string showed the home page** — e.g. `studios.html?studio=qr` offline fell back to `index.html`. `sw.js` now falls back with `ignoreSearch` for navigations. Regression: offline check in the browser suite.
5. **Studio tabs had `aria-selected` on plain buttons** (invalid ARIA) — now `tablist/tab/tabpanel`, Arrow-key support, visible focus ring.
6. **Text Metadata Check parity** — the PII studio dropped the URL / query-parameter count of the tool it replaces; added.
7. **"sha256" found nothing** — the Key & Hash tool description only said "SHA hashes". Description now names SHA-1/SHA-256/SHA-512.
8. **Cache name drift** — three branches bumped `sw.js` to three different names; unified to `govibetool-v8-7` and the pinned tests updated.

## Not changed on purpose (needs an owner decision)

* **AdSense**: the developer branch removed the homepage `adsbygoogle` script (replacing it with the `google-adsense-account` meta) because the page now handles secrets. That is an ad-revenue / AdSense change I was told not to make; I tried to restore the base markup and was blocked by the sandbox permission guard, so it is **left as merged** and listed as a release decision below.
* **Studio coverage gaps** (below).

## Remaining blockers / risks

1. **AdSense decision** (above): ship with the script removed (secret-handling tools without a third-party script) or restore it. Needs the owner.
2. **Studios are a standalone `studios.html`, not the canonical tools.** QR Studio v2 and the PII studio are *less* capable than the existing `qr-studio` (Wi-Fi, contacts, camera scan, colours) and `pii-secret-redactor`, so those two still open their own tools. The spec intends consolidation into those tools; that is unfinished and is not something I could safely do inside an integration pass. Studios are not in search results as their own entries (legacy names still find the original tools).
3. **Firefox / WebKit could not be run in this sandbox** (browser downloads are blocked by the egress proxy). Their results come from GitHub Actions on this branch — see the results table.
4. AVIF encoder (3.4 MB wasm) is cached on first use, not precached (documented design in the file-media branch); AVIF offline needs one earlier online use.

## Test evidence

See the PR description for the run table. Reproduce locally:

```
npm test                         # unit + static + build + verify
npm run test:developer:tailwind  # needs: npm i --no-save tailwindcss@3.4.17
node tests/v8-integration-browser.mjs chromium|firefox|webkit
```
