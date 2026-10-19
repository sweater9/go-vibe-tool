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

### Implementation status (standalone PDF Editor, `tools/pdf-editor/`)
The editor is a standalone page, listed as its own tile in PDF & Tables beside Private PDF Tools. It is not embedded in Private PDF Tools. The earlier "PDF Studio" prototype was removed; `/tools/pdf-studio/` now forwards to the editor.

**Implemented**
- Document-first workspace: top bar (open, undo, redo, zoom out/in/fit, download), tool rail, page thumbnails, large page canvas, properties panel, status line; phone layout with a bottom tool bar, a pages drawer and a properties panel that appears for the selected object.
- Objects with direct manipulation (select, drag, resize handles, rotation handle, nudge with the arrow keys, duplicate, layer order, delete): text boxes (font family, size, bold/italic, colour, alignment, opacity), images (PNG/JPEG; WebP/GIF converted to PNG), rectangles, ovals, lines, arrows, freehand drawing.
- Markup: highlight, underline and strike-through that snap to the text under the drag; comment notes exported as real PDF `Text` annotations with an appearance stream.
- Pages: rotate (one or several), reorder (buttons or drag and drop), delete, extract to a new PDF, add a blank page, insert pages from another PDF. All page work is non-destructive until export.
- Zoom 25-400% and fit-to-width, pinch zoom on touch screens; objects are stored in PDF user space so zoom never moves them.
- Undo/redo across every action (objects, page operations, existing-text edits).
- Export: original pages are kept as they are (never rasterised) and the edits are drawn on top as vector text, images and shapes. A single-source document is edited in place, which keeps form fields, bookmarks and metadata; documents assembled from several sources are copied page by page. The result is re-opened with pdf-lib and PDF.js before it is offered. A persistent download link remains after the automatic download.
- Privacy: everything runs in the browser; same-origin CSP (`connect-src 'self' blob:`), no network calls in the editor code, pinned self-hosted pdf-lib 1.17.1 and PDF.js 4.10.38.

**Existing-text editing: decision**
- Researched: iLovePDF and Adobe Acrobat on the web offer true existing-text editing with proprietary server-side or desktop-class layout engines. pdf-lib (the writer used here) cannot rewrite page content, and no open, offline, reliably licensed in-browser engine for general PDF text re-flow was found.
- Shipped: genuine in-place editing of text runs whose font can be rewritten safely (simple, non-embedded fonts with a Latin encoding, i.e. the standard fonts and similar). The string in the page's content stream is replaced, so the text stays real, selectable and searchable, and the original is gone. Characters outside WinAnsi are refused with a clear message. Positions are kept; text is not re-flowed.
- Not possible this way: subset-embedded and composite (CID) fonts, which is what Word, Chrome, LibreOffice and most design tools export. The editor says so and names the reason.
- For those runs it offers a clearly labelled "Cover and retype (visual overlay)". That is an overlay: the original text stays in the file and is still extractable. It is never described as editing or as redaction.

**Known limitations**
- Standard Helvetica/Times/Courier only for new text (WinAnsi): no emoji, Arabic, CJK, Cyrillic or Greek. No custom font embedding yet.
- No form filling, no digital signing, no page-content reflow, no OCR, no secure redaction. Editing invalidates existing digital signatures (a warning is shown). Password-protected PDFs are refused.
- Inserting or extracting pages does not carry over form fields or bookmarks.
- 50 MB file limit; very large pages are rendered at a reduced pixel density.
- Not tested on a physical iPhone or Android device (Chromium touch emulation and, in CI, Firefox and WebKit are used).

**Production page loading**
The earlier live failure was a syntax error in `v2-tools.js` (`async let`) that stopped every shared homepage script, so the category tiles, the PDF tools and the way into the editor never appeared. It was fixed by hotfix `edb6a24`. `tests/homepage-scripts-parse.mjs` now fails the build when any homepage script does not parse, and `tests/pdf-editor-live-load.mjs` walks the built site with Cloudflare-style routing and the service worker from the homepage to an exported PDF.

### Release state
Implemented and verified locally in Chromium; Firefox and WebKit run in CI. NOT deployed.
