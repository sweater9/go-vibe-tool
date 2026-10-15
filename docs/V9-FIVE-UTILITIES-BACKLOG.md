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


## Additional V9 tools — premium-style features without mandatory subscriptions

| Tool | Client-side approach | Intended value |
| --- | --- | --- |
| Screenshot Beautifier & 3D Mockup | Canvas + CSS transforms | Professional screenshots, device frames, perspective mockups and high-resolution PNG export without imposed watermarks |
| PDF Signer & Document Flattener | Locally bundled pdf-lib | Add a drawn, typed or uploaded signature and flatten supported form/annotation content into an exported PDF |
| Offline Image-to-Text OCR | Locally bundled Tesseract.js + WASM/language packs | Extract editable text from images without server upload or account |
| Silence Stripper & Audio Leveler | Web Audio API + offline decoding/encoding | Detect and trim pauses, adjust gain, prevent clipping and export processed audio |
| Watermark-Free Video/GIF Trimmer | Locally bundled ffmpeg.wasm, with capability-based fallback | Trim user-provided videos or GIFs without export watermark or account |

### Screenshot Beautifier & 3D Mockup
Provide padding, background gradients, shadow, rounded corners, device/browser frames, perspective tilt, live preview and high-resolution PNG export. Make export limits explicit and avoid copying third-party branded device artwork without rights. Handle large image memory and canvas limits; never add a watermark.

### PDF Signer & Document Flattener
Support placing a visible signature on chosen pages, resizing and previewing, and exporting the edited PDF locally. **A visible drawn/typed signature is not a cryptographic digital signature**; do not advertise certificate-based signing or legal validity without the necessary cryptographic workflow. Distinguish flattening interactive form fields from flattening arbitrary annotations; verify pdf-lib support, warn about unsupported PDF features, and preserve original files. Never claim to remove document security controls.

### Offline Image-to-Text OCR
Bundle OCR runtime and relevant language data locally for genuine offline operation after installation/cache; show download/storage size and optional language choices. Process images in a worker, with progress, cancellation, text correction and copy/export. OCR is imperfect, especially for handwriting, low-resolution text and complex layouts. No server processing.

### Silence Stripper & Audio Leveler
Provide adjustable silence threshold, minimum pause length and padding; visual waveform, before/after preview and export. Use offline audio processing and bounded memory. Basic normalization/compression is **not** AI noise removal, mastering or automatic speech enhancement. Preserve timing where requested and test mono/stereo, clipping and silent input.

### Watermark-Free Video/GIF Trimmer
Provide start/end markers, preview, format choice, local export and clear processing/memory progress. ffmpeg.wasm can require substantial download, CPU and RAM, especially on mobile; evaluate codecs, licensing, browser support, SharedArrayBuffer requirements and practical file limits before promising full support. Export without adding a watermark, but do not remove pre-existing watermarks or third-party rights notices. Provide graceful failure/fallback for unsupported formats.

### V9 delivery gates for these five
- Test offline operation with all required assets locally cached; no uploads or hidden remote calls.
- Validate performance and memory on realistic large files, and document supported browsers/codecs.
- Verify output fidelity, accessibility, cancellation and privacy.
- Keep all ten V9 tools within the existing nine top-level categories.
- No V9 deployment or production modification until V8 is accepted and V9 receives its own release review.
