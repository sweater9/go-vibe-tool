# PDF Compare V1

Standalone tool at `/tools/pdf-compare/`, listed in **PDF & Tables** next to the PDF Editor. It compares the *selectable text* of two PDFs entirely in the browser.

## Technical validation (done before building)

Question: can the PDF libraries already in the repo meet the site's privacy and performance requirements?

| Requirement | Finding |
|---|---|
| No document content leaves the device | PDF.js (already vendored at `tools/v9-media/vendor/pdf/`, same-origin worker) reads the files. The page's CSP allows only `'self'` and `blob:` for `connect-src`; the browser test fails on any external request. No new dependency, no server, no storage, no analytics. |
| Reads real-world PDFs | Checked on the repo's Chrome-made, LibreOffice-made and merged fixtures (subset/CID fonts): text, ligatures, CJK and Arabic extracted; the encrypted fixture is detected and explained. |
| Performance | Measured in Node on the diff engine: 400,000 words with one edit 0.7 s; 100,000 words with 50 edits 0.2 s; 50,000 vs 50,000 completely different words 0.1 s. End to end in Chromium, two 120-page PDFs (read + compare) ≈ 0.45 s. |
| Bounded worst case | Common start/end are trimmed, large stretches are split at words that occur once on each side, small stretches use exact Myers diff. A stretch needing more than 1,500 edits is not aligned: it is reported as one replaced block and the user is told. It cannot hang. |

Decision: build V1 on PDF.js text extraction plus a word-level diff. No WASM, no OCR, no new library.

## What V1 does

- Pick or drop two PDFs (A original, B revised); swap them; clear.
- Word-level diff with **added / removed / changed** blocks, each with page numbers and surrounding context.
- Two views: **Differences** (mobile-first list) and **Full text** (two columns on desktop, stacked on phones) with changes marked in place.
- Navigation: Previous/Next buttons (sticky at the bottom of the screen), `n`/`p` (or `j`/`k`), position counter, wraps around, announced to screen readers.
- Options: ignore capital letters, ignore punctuation. Spacing and line-break differences are always ignored.
- Warnings: pages with no selectable text (likely scanned), pages whose text cannot be decoded reliably, page-count differences, stretches that could not be aligned. A file with no text at all is refused with an explanation instead of showing a misleading "everything added".
- "No differences" is worded as *the readable text matched*, never as "identical".

## Limitations (also shown on the page)

- Text only. Images, drawings, colours, fonts, layout, form fields, comments and links are not compared. **No OCR.**
- Reading order follows how the PDF stores text. Columns, tables, headers and footers can be stored unusually and produce extra differences.
- Moved text shows as one removal plus one addition.
- Line-end hyphenation is re-joined only when the next line continues in lower case.
- Right-to-left scripts are compared in stored (visual) order; results are consistent between two files from the same producer but can differ across producers.
- Password-protected PDFs must be unlocked first (no password prompt in V1).
- Limits: 50 MB and 300 pages per file, 400,000 words per file.
- Very repetitive, heavily rewritten stretches may be shown as larger replaced blocks than a human would draw.
- Tested in Chromium (desktop and 390 px phone width). Firefox and WebKit have not been run for this tool yet.

## Files

`tools/pdf-compare/` — `index.html`, `compare.css`, `compare.js` (UI), `diff.mjs` (tokenise + diff, pure), `extract.mjs` (text items to lines, scan/garble checks, pure), `register.js` (catalogue entry).
Tests: `npm run test:pdf-compare` (core, in `npm test`) and `npm run test:pdf-compare:browser`.
