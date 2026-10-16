# V8 developer and design tools — Agent 1

Branch: `feature/v8-developer-design-tools`

Target: `feature/v8-discovery-navigation`

Starting commit: `ca5f926a581f0620caf02dc38e06871797fe9aab`

Five functioning tools extend the existing vanilla JavaScript catalog and workspace shell. The catalog now contains **55 listed tools** and still has **exactly nine V8 categories**. Counts, navigation, favorites and search derive from the existing catalog; no category definitions or Agent 2 implementations are changed.

| Tool ID / direct route | V8 category | Behavior |
| --- | --- | --- |
| `?tool=curl-snippets` | Developer | cURL to fetch, axios, requests, httpx, Go net/http and PHP curl_exec |
| `?tool=key-hash` | Privacy & Security | SHA, HMAC, UUID batches, secure hex tokens and API keys |
| `?tool=regex-playground` | Developer | Live matching, highlighted captures, indices, named groups, safe worker execution |
| `?tool=tailwind-css` | Images & Design | Common CSS declarations ⇄ Tailwind CSS 3.4 utilities |
| `?tool=shadow-glass` | Images & Design | 1–5 shadows, glass controls, CSS and Tailwind output |

## Privacy and architecture

- `v8-developer-core.js` contains deterministic engines and Web Crypto helpers. It also exports a CommonJS API for tests.
- `v8-developer-tools.js` registers tools before V8 discovery boots and wraps the existing `openTool` / `closeTool` functions. It reuses `shell`, shared fields, buttons, grids and workspace styling.
- `v8-developer.css` adds only workspace-specific styles. Untrusted input is rendered through text nodes, escaped initial values or textarea values.
- Inputs and results remain in memory. Closing or clearing removes secret fields and invalidates asynchronous results. The existing recent-tools shelf stores tool IDs only, never entered values.
- No pasted command is evaluated or executed. Generated request snippets are displayed as text; the tool never calls them or sends their requests.
- The workspace homepage no longer loads the existing third-party AdSense executable script. Its publisher ID remains as inert metadata. Other site pages and deployment configuration are outside this change.
- Copying or exporting output with authorization, cookies, credentials, secret-like query/body fields, API keys or tokens requires a warning confirmation. Clipboard fallback selects the output for manual copying.
- The service worker precaches all four new root assets. Offline use requires one successful online load/install on HTTPS or localhost. The static builder already includes root `.js` / `.css`; its manifest and Cloudflare workflows are unchanged.

## Supported behavior and limits

### cURL

Single literal POSIX-style command with single/double quotes, escaped characters and line continuations. Supports `-X`, `--request`, `-H`, `--header`, `-d`, `--data`, `--data-raw`, `--data-binary`, `--data-urlencode`, `-u`, `--user`, `--url`, attached short values and long `--flag=value` syntax. Preserves query strings, literal bodies and Basic authentication; URL user-info is converted to an Authorization header.

Unsupported flags, file/stdin references, interactive passwords, multiple requests and shell expansion/substitution block generation. Input limit: 100,000 characters. ANSI-C, PowerShell and cmd.exe-specific escaping are not implemented. Repeated headers are retained separately in Go/PHP and combined with an explicit warning for dictionary-based Python/axios output. Browser-forbidden headers and methods block fetch output; GET/HEAD bodies also cannot produce a valid fetch snippet. Browser axios shares browser restrictions; Node axios can send server-side headers. Go assigns Host and Content-Length to their special request fields. Dependencies in snippets must be installed in the consuming project; snippets are never executed for QA.

### Keys and hashes

Native `crypto.subtle` SHA-1/256/384/512 and HMAC on UTF-8 text; `crypto.getRandomValues()` for UUID v4 and tokens. UUID batches are 1, 10 or 100. Tokens use 1–4096 random bytes; API keys have a `gvt_` prefix followed by secure hex. UTF-8 text/key limit: 1,000,000 characters. HMAC requires a non-empty key. SHA-1 is explicitly marked legacy/insecure, and the UI explains why fast hashes are unsuitable for password storage. This is text hashing, not a file hash utility. Web Crypto requires a secure context.

### Regex

JavaScript regex syntax and flags `g`, `i`, `m`, `s`; indices use modern browser support for the internal `d` flag. Regex compilation and execution occur only in `v8-regex-worker.js`, never on the UI thread. Each update replaces the worker. Startup is bounded to 3 seconds, execution to 300 ms after its ready handshake; updates are debounced 180 ms. Superseded workers are terminated, including on close/clear. Firefox import cancellation is handled without uncaught errors.

Limits: 2,000 pattern characters, 100,000 text characters, 100 capture groups, 1,000 matches, 4,000 capture values and 1,000,000 result characters. Results report truncation. Zero-length global matches advance by one UTF-16 code unit. Zero-width matches are visible markers; optional unmatched groups are distinct from empty captures. Nested capture ranges appear inline and in group details.

Email, RFC3339 and IPv6 presets are explicitly simplified. IPv6 covers full eight-group notation, not compressed/mixed addresses. RFC3339 syntax does not validate calendar dates or leap seconds. The slug convention is ASCII. The semantic-version pattern implements SemVer 2.0.0 syntax. A timeout indicates a resource bound, not that the expression is universally invalid.

### Tailwind ⇄ CSS

Targets **Tailwind CSS 3.4 default configuration**, verified with the actual **3.4.17 compiler**. Supports spacing, common dimensions, display, flex, grid columns, selected default colors, borders/radii, shadows, font weights/sizes, alignment, line heights and arbitrary values for supported properties. Exact mappings are finite; supported arbitrary values are emitted instead of inventing utilities. Type hints distinguish text colors/sizes, font families/weights and border widths. Underscores and whitespace round-trip correctly.

CSS input is a declaration list without selectors, braces or comments. Input limit: 50,000 characters. Custom themes, plugins, variants, important declarations and unsupported properties/classes are preserved in a separate editable/copyable workflow with warnings. Conflicting CSS shorthand/longhand declarations are preserved to avoid changing the cascade. Overlapping input utilities warn that Tailwind stylesheet order can differ from input token order. Tailwind Preflight can affect reset defaults such as border style; this is a practical converter, not a lossless stylesheet compiler.

### Shadow / glass canvas

Each layer has offset, blur, spread, color, opacity and inset controls. Glass adds background opacity/color, backdrop blur, saturation and border controls. Presets, reset, CSS/Tailwind selection, copy and export are available. Output includes standard and WebKit-prefixed backdrop filters. Valid arbitrary-value classes are checked with the Tailwind compiler. Rendering of backdrop filters depends on browser support. Input bounds are checked again in the core engine.

## Reproduce QA

```sh
npm run test:developer
npm test
npm run build
npm run verify:dist
npm install --no-save --package-lock=false playwright@1.56.0 tailwindcss@3.4.17
npm run test:developer:tailwind
npx playwright install --with-deps chromium firefox webkit
SITE_ROOT=dist node tests/v8-developer-browser.mjs chromium
SITE_ROOT=dist node tests/v8-developer-browser.mjs firefox
SITE_ROOT=dist node tests/v8-developer-browser.mjs webkit
node tests/v8-browser.mjs chromium
```

The browser suite tests actual engines at 375px and 1280px: catalog/search/category reachability, all six generators, warning cancellation, XSS literals, crypto vectors, UUID/export/token validation, regex captures and timeout/recovery, both CSS directions, preserved input, canvas controls, accessible labels/keyboard focus, overflow, secret persistence, external requests and offline operation. The test server serves the actual homepage without stripping third-party scripts. Offline verification stops the origin server and reloads the cached page, matching the existing repository's dist QA strategy. Playwright's WebKit offline toggle has an internal engine error, so it is not used as the offline oracle.

JSON reports and screenshots are written to `artifacts/developer-<engine>/`. The isolated `v8-developer-design-qa.yml` workflow builds and tests pull requests against the V8 branch; it has no deployment steps or Cloudflare credentials. It installs standard browser dependencies on its Ubuntu runner.

## Agent 2 integration notes

No Agent 2 session was attached to this workspace, so direct coordination was unavailable. Review these shared-file additions when combining the separate draft PRs:

1. `index.html`: one stylesheet, two script tags before `discovery.js`; remove the executable ad loader from the secret-input shell.
2. `sw.js`: cache-name suffix and four precache entries. Preserve the union of both agents' entries and use one fresh cache name during a future approved integration.
3. `package.json`: prepend the new core tests and add three `test:developer*` scripts. Preserve Agent 2's scripts as well.
4. All tool logic, styles, tests and documentation are uniquely named. No changes to `v8-discovery.js`, base category definitions, Cloudflare workflows, Wrangler configuration or Agent 2 tools.

No merge or deployment is performed by this branch.

## QA result — 2026-10-13

**GO for draft review.** All five implementations function, and required local checks passed. Merge and deployment remain explicitly unauthorized.

| Check | Result |
| --- | --- |
| Unit/security/input-to-output regressions | 19 passed |
| Actual Tailwind 3.4.17 compilation | Passed |
| Full existing `npm test` suite | Passed |
| Build / dist verification | Passed |
| Chromium, 375px + 1280px | 18 passed |
| Firefox, 375px + 1280px | 18 passed |
| WebKit, 375px + 1280px | 18 passed |
| Existing V8 Chromium suite, five viewport sizes | 126 passed |
| Offline with origin stopped | Passed in all three engines |
| JavaScript errors / external requests / secret persistence | None in successful final browser runs |

Machine-readable details: [QA results](qa/v8-developer-design-results.json). Browser reports and screenshots are available through the isolated QA workflow artifacts when GitHub Actions runs the draft PR. Local screenshot inspection confirmed responsive controls and readable match/capture highlighting.

Environment notes: actual Playwright 1.56.0 engines were used. Firefox required `MOZ_DISABLE_CONTENT_SANDBOX=1` inside this restricted local runner. Missing WebKit libraries were extracted to a local runtime path rather than installed into the host; the CI runner uses the usual `--with-deps` installer. No production setting was changed by these test-environment workarounds. Go and PHP output are covered by deterministic generation tests; the local runner lacks their compilers, so their syntax was not compiler-verified locally. JavaScript and Python snippets were parsed without executing requests.
