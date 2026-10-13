# GoVibeTool V9 — Five client-side utilities (approved backlog)

Status: **V9 planned; not implemented.** V8 release scope is unchanged. Keep the existing nine top-level categories; map these into the nearest existing categories, rather than adding top-level categories.

| Requested category | Tool | Client-side implementation | User value |
| --- | --- | --- | --- |
| Developer | SQL Beautifier & Minifier | Lightweight pure-JS SQL tokenizer/formatter | Read and clean unformatted ORM/log queries |
| Security | Large File SHA-256 Checksum | File/Blob streaming or chunked reads plus a vetted incremental SHA-256 implementation | Verify large downloaded files without upload |
| Marketing/Web | Social Card & OG Simulator | DOM and Canvas previews | Preview X, LinkedIn and Slack link cards |
| Design | Cubic-Bezier Easing Curve | Canvas with draggable handles | Tune UI micro-animation timing |
| Data | Universal Epoch & Time Matrix | Native Intl.DateTimeFormat | Debug and compare log timestamps |

## Engineering and UX acceptance notes

### SQL Beautifier & Minifier
Preserve SQL string literals, quoted identifiers, dialect-specific syntax and comments. Do not claim to validate or execute SQL. Provide input/output copy, indentation controls, dialect guidance, and formatter/minifier toggles. Test multiline strings, nested expressions, comments and placeholders.

### Large File SHA-256 Checksum
**Important technical correction:** Web Crypto `crypto.subtle.digest` is not an incremental streaming API; reading a multi-GB file into memory is unacceptable. Use a locally bundled audited incremental SHA-256 implementation fed with bounded Blob slices, or an appropriate streaming WASM hash library. `FileReader`/Blob slicing may read chunks; never upload file bytes. Show progress, cancellation, expected-checksum comparison and hex output. Test multi-GB memory behavior and known SHA-256 vectors.

### Social Card & OG Simulator
Allow manual title, description, image URL and site/author inputs, with X, LinkedIn and Slack approximations. Browser CORS restrictions mean arbitrary remote OG scraping or image fetching cannot be guaranteed in a purely client-side tool; clearly distinguish user-entered simulation from live fetched metadata. Avoid representing previews as pixel-perfect provider rendering. Support canvas/image export where permitted.

### Cubic-Bezier Easing Curve
Provide draggable P1/P2 control points, numeric inputs, live animated example, CSS `cubic-bezier(x1,y1,x2,y2)` output, and copy. Enforce CSS x-coordinate range [0,1]; respect prefers-reduced-motion.

### Universal Epoch & Time Matrix
Convert epoch seconds, milliseconds, microseconds and nanoseconds with explicit unit selection and precision safeguards (JS Number cannot exactly represent all large timestamps). Show UTC, local time, ISO 8601 and multiple user-selected time zones with Intl.DateTimeFormat. Clarify that time-zone offsets vary with daylight saving rules. Support copy and common log timestamp formats.

## Cross-cutting requirements
- Browser-first and privacy-preserving; no mandatory API or account.
- Preserve nine V8 categories, search, favourites, recently used and legacy deep links.
- Keyboard and mobile accessibility, offline operation where practical.
- Unit tests, Chromium/Firefox/WebKit browser QA, static dist verification.
- Do not merge or deploy V9 during V8 acceptance. Production changes require separate approval.
