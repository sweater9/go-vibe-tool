# GoVibeTool V8 — File & media tools

Branch: `feature/v8-file-media-tools` (draft PR into `feature/v8-discovery-navigation`; not merged). Four client-side tools, no backend, no uploads, no paid APIs.

| Tool id | Name | Category (existing id) | Route |
| --- | --- | --- | --- |
| `svg-sanitizer` | SVG Sanitizer & Optimizer | Developer (`developer`) | `/?tool=svg-sanitizer` |
| `image-metadata-stripper` | Image Metadata & EXIF Stripper | Privacy & Security (`privacy-security`) | `/?tool=image-metadata-stripper` |
| `image-batch-compressor` | WebP / AVIF Batch Image Compressor | Images & Design (`images-design`) | `/?tool=image-batch-compressor` |
| `table-converter` | Markdown Table ↔ CSV / Sheets Converter | PDF & Tables (`files-pdf`) | `/?tool=table-converter` |

## Category structure (exactly nine, unchanged)

`v8-discovery.js` was **not edited**. The nine categories (`ai-prompts`, `productivity`, `files-pdf`, `images-design`, `privacy-security`, `developer`, `business-finance`, `writing-text`, `links-web`) keep their ids, labels, routes (`?category=<id>`) and behaviour. A tool joins a category purely through its catalogue category string (`Developer`, `Privacy & Safety`, `Images & Design`, `PDF & Tables`), which each V8 category already maps. Tile counts, category pages, favourites, recents, search and the listed-tool count are therefore derived automatically and stay consistent. Existing tool ids, standalone URLs and bookmarks are untouched.

Before: 9 categories. After: 9 categories. `tests/file-media-browser.mjs` asserts the nine tile ids, that every listed tool appears in at least one category, that each new tool appears in exactly its mapped category, and that the tile counts equal the category page contents; `tests/file-media-core.mjs` asserts `v8-discovery.js` still defines nine categories.

Overlap note: the older `table-formatter` (CSV → Markdown only, "Writing & Text" with a `files-pdf` override) is kept so its URL and tests do not change. `table-converter` supersedes it functionally; retiring `table-formatter` (it would redirect via `retiredTools`) is a product decision left for review.

No category rename is proposed. For the other agent’s tools: choose the catalogue category string from the table above; do not edit `V8_CATEGORIES`, and add any new tools in their own script file registered after `v6-tools.js` so shared files conflict only on one `<script>` line in `index.html` and one block in `sw.js`.

## Files

```
tools/file-media/file-media-tools.js   registers the four tools, workspace UI (loaded after v6-tools.js)
tools/file-media/file-media.css        styles (loaded on first use)
tools/file-media/fm-svg.js             SVG sanitiser + SVGO pipeline + independent verifier
tools/file-media/fm-image.js           metadata scanner, ZIP writer, encoder detection, decode/encode, AVIF worker client
tools/file-media/fm-avif-worker.js     module worker that runs the bundled AVIF encoder
tools/file-media/fm-table.js           CSV / TSV / Markdown table core (pure functions)
vendor/svgo.browser.js                 SVGO 4.1.0 (MIT) — unmodified browser build
vendor/avif/avif_enc.{js,wasm}         jSquash/libavif AVIF encoder (Apache-2.0 / BSD-2), 3.4 MB wasm
tests/file-media-core.mjs              Node unit tests (in `npm test`)
tests/file-media-browser.mjs           Playwright tests for all engines
tests/helpers/file-media-fixtures.mjs  builds JPEG/PNG files with real EXIF, GPS, IPTC, XMP, ICC and text chunks
```

Shared files touched: `index.html` (one `<script>`), `sw.js` (precache list; cache `govibetool-v8-6`), `package.json` (scripts), `THIRD_PARTY_NOTICES.md`, `scripts/serve-dist.mjs` (`.wasm` MIME), the two workflows (`file-media-browser` added to the suite loops), and the two tests that pin the cache name or the PDF & Tables list.

## D. SVG Sanitizer & Optimizer

Pipeline: strict XML parse (`DOMParser`, `image/svg+xml`) → **rebuild a new document from an allowlist** (elements, attributes, URL schemes, CSS) → SVGO → sanitise the SVGO output again → an **independent verifier** re-parses the result. If the verifier objects nothing is exported.

* Dropped by construction: `script`, `foreignObject`, `iframe`/`object`/`embed`/media, `handler`/`listener`, anything outside the SVG namespace (XHTML, editor namespaces), unknown elements and attributes, `on*` handlers, processing instructions and comments.
* References: `href`/`xlink:href` may only be `#fragment`; `image`/`feImage` may also use `data:image/{png,jpeg,gif,webp}`; `<a>` may use `http(s):`, `mailto:`, `tel:`. `javascript:`, `vbscript:`, `data:text/html`, `data:image/svg+xml` and external `<use>` are removed, including whitespace/entity/case obfuscation. `https://` images can be allowed with an explicit checkbox (tracking risk is stated).
* `url(...)` in presentation attributes and CSS may only point to `#id` or raster data URIs.
* `<style>` and `style=""`: parsed into rules and declarations; `@import`, `@font-face`, unknown at-rules, `expression()`, `behavior`, `-moz-binding`, `image-set`, escape sequences and markup in values are removed.
* Animation elements are kept unless they retarget `href`, event handlers or `style`.
* XML entity declarations (`<!ENTITY`) are refused (entity-expansion attacks); DOCTYPE is dropped. Limits: 5 MB, 50,000 nodes, depth 200.
* Duplicate ids: browsers resolve references to the *first* element with an id, so later duplicates are renamed (`id-2`) and no reference changes meaning. SVGO then minifies ids and updates references; optional id prefixing avoids clashes when inlining.
* Previews use `<img src="blob:…">`, which browsers sandbox (no scripts, no network). Original and optimised versions are previewed side by side with byte sizes, savings and an estimated gzip size.

## G. Image Metadata & EXIF Stripper

Images are decoded by the browser, drawn on a new canvas and exported as JPEG (quality slider, transparency flattened to white with a notice) or PNG (lossless). The browser applies EXIF orientation while decoding, so output pixels are upright and carry no orientation tag.

After export the tool **scans the new file’s structure** (JPEG segments, PNG chunks, WebP RIFF chunks, GIF extensions, plus a raw signature search) and reports what it found before and after. “Checked the exported file: none found” is evidence about that file, not a promise about every format or browser.

Honest limits: pixels are untouched (faces, text, watermarks remain); JPEG export recompresses; some browsers add their own standard sRGB ICC profile to exports (Chromium does; it is identified by name and reported separately, and any non-standard profile counts as possible personal data); animated images keep the first frame; SVG is redirected to the SVG tool; HEIC/HEIF/TIFF work only where the browser can decode them; images over 120 megapixels are refused before a canvas is allocated.

## H. WebP / AVIF Batch Image Compressor

* Encoders are detected at runtime by really encoding a probe. WebP, JPEG and PNG use the browser’s canvas encoder. Most browsers cannot encode AVIF natively, so AVIF uses the **bundled WebAssembly encoder in a module worker** (UI stays responsive, worker is terminated after each batch). The 3.4 MB wasm is fetched from this site on first AVIF use and cached by the service worker for offline use.
* Fallbacks are explicit: AVIF → WebP → JPEG, with a per-file message (also if the AVIF encoder fails to load, for example offline before it was ever cached). Alpha sources flattened to white when JPEG is the only choice.
* Quality (1–100), optional max width/height (never enlarges), “keep the original if the result is larger”, sequential processing (memory-friendly), per-file original/output size and percentage saved, totals, Stop button, individual downloads and a ZIP (stored/uncompressed ZIP written by `fm-image.js`; no library needed).
* No server limits exist. Practical limits are device memory: images over 120 MP are refused with a message; a note appears for files over 150 MB; allocation failures become per-file errors and the batch continues; the ZIP step reports a clear message if memory runs out.

## I. Markdown Table ↔ CSV / Sheets Converter

* Reads Markdown (GFM) tables, CSV (comma/semicolon/pipe) and tab-delimited text from Google Sheets/Excel, with auto-detection; writes Markdown, CSV, TSV or semicolon CSV.
* RFC 4180 quoting both ways (quotes, doubled quotes, delimiters and line breaks inside quoted fields, CRLF, BOM). GFM alignment row is read (`:---`, `:---:`, `---:`) and can be kept, forced, or set automatically (numeric columns right-aligned).
* Copy result, **Copy for Sheets / Excel** (tab-delimited), download (`.md`, `.csv`, `.tsv`, optional UTF-8 BOM), paste from clipboard, two examples, “use result as input”, live preview (first 100 rows; cells rendered as text).
* Spreadsheet-formula warning (`= + - @`) with an optional apostrophe-protection mode.
* Documented limitations (also shown in the tool): Markdown cells are single-line (line breaks become `<br>`, and `<br>` becomes a line break again on the way back, so a literal `<br>` typed into a cell is not preserved); `|` is escaped as `\|`; leading/trailing spaces are lost; no types (spreadsheets may reinterpret numbers/dates on paste); extra cells widen the table, short rows are padded; only the first table in pasted text is converted; about 5 MB of text.

## Testing

```
node tests/file-media-core.mjs                       # 35 unit tests (part of npm test)
node tests/file-media-browser.mjs chromium|firefox|webkit
SITE_ROOT=dist node tests/file-media-browser.mjs …    # against the built output
```

Browser suite coverage: categories and search, the SVG corpus (21 hostile samples run *and executed* in iframe and inline contexts, with a control proving the unsanitised payloads do run), idempotence, strict-XML errors, entity/size/depth bombs, pixel-level render fidelity, drag-and-drop/paste/file chooser, EXIF/IPTC/XMP/ICC/text-chunk removal verified on the downloaded bytes, orientation 1/3/6/8, WebP/AVIF output verified from file headers, quality/resize behaviour, batch + ZIP validated by an independent reader, fallback paths (simulated missing WebP and WebAssembly, blocked AVIF encoder), table round trips, XSS in cells, 5,000-row performance, accessibility names/roles, 375/768/1280 px layout with 44 px touch targets, a network spy proving no third-party or non-GET request is made, and offline operation (SVGO, tables, stripping, WebP and cached AVIF).

## Known limitations

* AVIF encoding is slower than WebP (WebAssembly, single thread). Encoding very large images can take a long time and a lot of memory; the tool is not a replacement for a desktop encoder for hundreds of megapixels.
* The AVIF encoder is not precached (3.4 MB): it is cached the first time it is used. Offline AVIF requires one earlier online AVIF use in that browser.
* Safari/WebKit and some Firefox versions cannot encode WebP on canvas; the tool falls back and says so.
* Metadata verification covers JPEG, PNG, WebP and GIF containers; for AVIF/HEIC outputs only the raw signature search runs.
* The SVG allowlist favours safety over completeness: unusual attributes and legacy SVG features (fonts, `cursor` elements, `tref`) are removed. SVGO changes markup (that is its purpose); rendering fidelity is checked in the tests but not guaranteed for every SVG.
