# GoVibe PDF Studio — implementation contract

Status: development branch, NOT production released. Existing PDF tools remain unchanged until acceptance passes.

## Architecture
- PDF.js (self-hosted distribution and worker, version pinned) for rendering and page thumbnails.
- pdf-lib (self-hosted pinned browser bundle) for document modification and exporting.
- No CDN, network upload, backend PDF storage, analytics on documents, or external font requests.
- Local File input -> Uint8Array -> PDF.js preview; pdf-lib loads a separate copy for editing.
- Output via Blob URL and a visible Download edited PDF anchor, retained until replacement, close, or unload. Revoke stale URLs.
- Worker files and library assets must be included in static build, Cloudflare deployment, service-worker cache, and CSP. Never assume npm packages are browser assets without bundling.
- Explicit memory and file-size guardrails, loading/error states, password handling, and user-facing unsupported-feature errors.
- Never silently rasterize a digitally signed PDF; warn that modification may invalidate signatures.
- A visible drawn/typed signature is NOT a cryptographic digital signature.

## Release 1
1. Open PDF from device; show page count, thumbnails, current page, zoom and next/previous navigation.
2. Add text and visible signature/image overlay; coordinates map correctly across zoom and rotation.
3. Rotate, delete, reorder, extract, merge pages with an undoable pre-export state.
4. Export a new PDF with a persistent accessible download link and descriptive filename.
5. Fully local processing, responsive desktop/iPhone/Android layout, keyboard and touch operation.
6. 'Flatten' must be labeled precisely: bake supported overlays into page content; do not claim secure redaction or guaranteed flattening of every PDF annotation.

## Out of scope for Release 1
- Word-style editing of existing PDF text; OCR; guaranteed compression; cryptographic signing; secure redaction; arbitrary interactive form preservation.

## Integration
- Replace the existing embedded PDF Signer only AFTER acceptance. Until then, expose the new editor only via a development route.
- Single GoVibeTool workspace chrome. No nested navigation, duplicate title, or fixed-height iframe.
- Existing PDF tools and category tiles must not regress.

## Acceptance gates (must provide evidence)
- Automated unit tests for PDF import/export, page rotation/reorder/delete, text/signature placement, and blob download.
- Browser E2E tests on Chromium, WebKit and Firefox at 1440, 390, and 375px.
- Test one-page, multipage, landscape, malformed, password-protected, and larger PDFs.
- Export and reopen the resulting PDF, inspect page count, rendered changes, and file validity.
- Verify actual download in mobile Safari and desktop; link remains after processing completes.
- Verify network requests are only same-origin assets, no PDF upload.
- Build, deploy to preview, run live preview checks, then request production go/no-go.

## Editor status (development branch)
Implemented: open and preview, page navigation, rotate, delete, reorder, merge, selected-page download, undo, and positioned text.
Text is placed where the user taps (top-left by default, stepping down so successive items never overlap), can be selected, edited, resized, moved and deleted, and is only baked into the PDF on preview/export. Text is drawn upright for the page rotation it was placed under and then turns with the page like other content.
Tested by `tests/pdf-editor-browser.mjs` (desktop 1440px and phone 390px; export, re-read and re-open) and `tests/pdf-studio.mjs`.

Known limitations (not release blockers, documented for users): standard Helvetica only, so emoji and non-Latin scripts are rejected with a clear message; no zoom; page list is text buttons, not image thumbnails; password-protected PDFs are refused with a clear message; existing text cannot be edited; no signature/image overlay yet; exported file is always named `govibe-edited.pdf`; file size capped at 25 MB; verified on Chromium in this branch's local run with Firefox/WebKit left to CI, and not yet on a physical iPhone/Android device.
