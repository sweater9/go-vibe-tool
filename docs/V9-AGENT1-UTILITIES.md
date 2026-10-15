# V9 lane 1: SQL, SHA-256, Epoch matrix, OG simulator

| Tool id | Category (existing) | Files |
| --- | --- | --- |
| `sql-formatter` | Developer | `v9-sql-engine.js` |
| `file-sha256` | Privacy & Safety | `v9-sha256.js` |
| `epoch-matrix` | Developer | `v9-utilities-core.js` (existing epoch engine, extended) |
| `og-simulator` | Links & Web | `v9-social-card.js` |

UI: `v9-agent1-tools.js` + `v9-agent1.css`. Catalogue rows are pushed onto `tools`, so search, favourites, recents and `?tool=<id>` work. Top-level categories stay at nine.

Epoch: exact BigInt nanoseconds, floor division for negatives, decimal fractions, auto unit guess (labelled), zone offset/DST via Intl, DST gap/overlap detection, log formats, bulk lines. `?tool=epoch-matrix&ts=…&unit=…&tz=a,b` is the only URL state (non-sensitive).
SQL: tokenizer-first; output tokens are verified equal to input tokens, otherwise the original text is shown with a warning. Not a validator.
SHA-256: bundled incremental implementation, 4 MiB Blob slices, cancel, expected-hash compare. Verified at 4.3 GiB with ~35 MiB browser memory growth.
OG: simulation from user-entered values; no fetch. A remote image loads only after an explicit opt-in checkbox. PNG export needs a local image or a CORS-enabled host.

Tests: `npm run test:v9`, `npm run test:v9:dist`, `node tests/v9-agent1-browser.mjs <chromium|firefox|webkit>` (`V9_HUGE_FILE_MIB=4300` for the >4 GiB run, `V9_BIG_GIB=4.5` for the Node unit run).
Not changed: service-worker cache name (integration lead to bump for V9), V8 branches, production.
