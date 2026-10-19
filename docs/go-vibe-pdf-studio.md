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


## PDF Editor Rebuild — Research-led product contract (2026-10-19)

### Competitive evidence and capability boundaries
- iLovePDF Edit PDF: text, images, shapes, comments, highlights and element ordering; its advanced editor also advertises existing-text editing and form fields. Sources: https://www.ilovepdf.com/edit-pdf and https://www.ilovepdf.com/blog/new-advanced-pdf-editing-ilovepdf
- Adobe Acrobat Web: text and image editing, highlighting, redlining, freehand markup and comments. Sources: https://helpx.adobe.com/acrobat/web/edit-pdfs/edit-text-images-and-objects/editing-pdfs-overview.html and https://helpx.adobe.com/acrobat/web/share-review-and-export/review-pdfs/markup-document-redlining.html
- Current pdf-lib limitation: cannot remove or rewrite existing page text outside form fields. Source: https://github.com/Hopding/pdf-lib/blob/master/README.md

### User-facing acceptance criteria
1. A document-first workspace: upload/drag-drop, prominent document canvas, consistent tool rail, thumbnail navigation, page controls, visible download, keyboard and touch interaction.
2. Direct manipulation: add, select, drag, resize, recolor, duplicate and delete text boxes, images and shapes. Zoom must preserve element positions. Undo/redo must preserve document and overlay state.
3. Annotation tools: highlights, underline, freehand pen, comments/sticky notes, arrows and rectangles, with legible tool state and accessible keyboard alternatives.
4. Page tools: rotate, reorder, delete, extract and add pages, retaining the source document's appearance and non-destructive editing until export.
5. Export: embed supported edits into a valid PDF, reopen it and verify all edits and page order. Offer explicit errors for unsupported or encrypted PDFs; never silently rasterize signatures or imply visual whiteout is secure redaction.
6. Privacy and resilience: browser-only document processing, no third-party PDF upload, self-hosted pinned dependencies, size limits, crash/error handling, same-origin CSP and service-worker compatibility.
7. Mobile: usable controls and accurate touch positioning at 390/375px, not merely a compressed desktop toolbar.

### Existing-text editing decision gate
The current pdf-lib overlay engine is not sufficient for rewriting existing PDF text. Research and evaluate a compatible in-browser editing engine (license, security, bundle size, fonts, text extraction/layout fidelity and offline support) before promising existing-text editing. If a reliable solution is not feasible, label the capability precisely and keep the document editor useful for overlays, annotations and forms. Do not mask original content and describe that as true editing or secure redaction.

### Engineering sequence
A. Diagnose the live editor launch failure from production assets and browser errors; isolate root cause with a failing regression test.
B. Build the new document-first interface and editing interaction model on this branch, retaining existing GoVibeTool navigation and categories.
C. Add core tools and persistable model, then export round-trip validation.
D. Cross-browser functional and accessibility acceptance, mobile interaction, preview deployment, then release. Do not redo unrelated PDF utility tests absent regression evidence.

### Release state
Design/research baseline recorded; feature implementation and production deployment NOT yet complete.
