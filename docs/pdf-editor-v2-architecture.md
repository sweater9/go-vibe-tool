# PDF Editor V2 — architecture and feasibility assessment

Branch `feature/advanced-pdf-editor-v2` (from `main` at d811481, which already contains the V1 editor from PR #50).
Scope of this document: how V2 will change *existing* PDF content, what is technically possible in the browser,
and where the honest limits are. Nothing here is a claim that a feature works; the delivery report lists only what
was verified on exported files.

## 1. Where V1 stops

V1 (`tools/pdf-editor/`) is non-destructive: page list + overlay objects, baked on export with pdf-lib. Its only
"existing text" editing (`textedit.mjs`) rewrites a string in the content stream, and only for **non-embedded
standard fonts with WinAnsi encoding**. Measured on real producers this covers almost nothing:

| Producer (fixture generated here)      | Font structure                                   | V1 can edit? |
|----------------------------------------|--------------------------------------------------|--------------|
| Chrome / Skia print-to-PDF             | CID TrueType, Identity-H, subset, ToUnicode      | no           |
| LibreOffice 24.2                       | simple TrueType, subset, custom codes, ToUnicode | no           |
| pdf-lib / reportlab, Helvetica etc.    | standard 14, WinAnsi                             | yes          |

So V2 needs a real text layer, not a UI change.

## 2. Options considered

| Option | Verdict |
|---|---|
| A. Cover old text with a white box and draw new text (what many "editors" do) | Rejected. Explicitly out of scope: it leaves the old text in the file (extractable, searchable) and is not editing. |
| B. WASM engine (MuPDF, PDFium) for text objects | Rejected for now. MuPDF is AGPL; PDFium builds are 4–10 MB and still do not edit text in embedded subset fonts. Adds a second PDF implementation to keep in sync with PDF.js. |
| C. Custom content-stream layer on top of pdf-lib (parse, model, rewrite) | **Chosen.** Pure ES modules, runs in the browser and in Node, no new runtime dependency, full control over what is rewritten and what is refused. |

PDF.js remains the renderer and an independent verifier. pdf-lib is the object model / serializer. PDF.js cannot
tell us byte offsets in the content stream, so the text model is built by our own interpreter, not from
`getTextContent()`.

## 3. The core problem: editing text in a subset font

A show operator carries *glyph codes of a specific font*, not characters. An embedded subset contains only the
glyphs the author used. Consequences:

* A character that already occurs in the document **with that same font** can be re-encoded exactly: look up its
  code in the font's reverse `ToUnicode`/encoding map and reuse it. The look is identical and extraction still
  works because the font's own `ToUnicode` covers that code.
* A character that never occurs in that font cannot be drawn with it. The engine falls back **for those characters
  only** to a standard-14 font (Helvetica/Times/Courier, WinAnsi), reported to the user as a substitution. Characters
  outside WinAnsi are refused with a clear message in V2 (no font embedding of arbitrary Unicode yet).
* Bold / italic / another family on an *embedded* font cannot be synthesised from the subset, so they select the
  matching standard font. The UI says so before applying.

No page is rasterised, no text is converted to outlines, no cover boxes are drawn, and unchanged text keeps its
original codes, font, kerning adjustments and position.

## 4. Engine design (`tools/pdf-editor/engine/`)

1. **`content.mjs`** — tokenizer plus a content-stream interpreter that tracks the graphics/text state needed for
   text: `q/Q`, `cm`, `BT/ET`, `Tf Tc Tw Tz TL Ts Tr`, `Td TD Tm T* ' "`, `Tj TJ`, fill colour operators.
   It records, for every show operator, the byte range, the state (font, size, fill colour, matrices) and the
   positioning operator that precedes it.
2. **`fonts.mjs`** — reads font dictionaries: subtype, encoding (WinAnsi/MacRoman/Differences), `ToUnicode` CMap
   (`bfchar`/`bfrange`), widths (`Widths`, `W`/`DW`, standard-14 metrics), and the set of codes actually used in
   the document. Produces `decode(bytes)`, `encode(char)` (or "not in this font") and `width(code)`.
   Refused with a reason: Type3, vertical writing, non-Identity composite CMaps, fonts without any usable
   Unicode mapping.
3. **`textmodel.mjs`** — groups show operators into **blocks**: consecutive shows in the same text object with the
   same matrix linear part and baseline, where the horizontal gap is small. A block is what the user selects
   ("a line of text"); a block's characters carry their own font/size/colour/adjustment.
4. **`edit.mjs`** — `applyBlockEdit(...)`: diff old text vs new text, assign each new character the style of its
   neighbour (plus requested overrides), encode with the original font where possible or the fallback otherwise,
   regenerate the block as `TJ` runs, and restore the text state afterwards so every later operator in the stream is
   unaffected. It keeps the text-line matrix consistent (relative `Td` chains after the block still land in the
   right place) and applies alignment as a leading `TJ` adjustment, which does not disturb the line matrix.
5. **`links.mjs`** — `Link` annotations: read (URI and internal `GoTo`/`Dest`), create, retarget, remove.
6. **`outline.mjs`** — `/Outlines` tree: read (with destinations resolved to page index), edit as a tree, rewrite
   `First/Last/Next/Prev/Parent/Count` and `Dest` arrays on export; page reordering/deletion remaps destinations.
7. **Export** (`bake.mjs`, extended): text edits are applied to the source bytes first (as V1 already does for runs),
   then page operations and overlay objects, then links and bookmarks, then the self-check.

## 5. Safety rules (what "unsupported" means)

A block is refused, with a specific message, when: its font is Type3 or vertical; no Unicode mapping can be
established; the show operators sit inside a Form XObject (text drawn by `Do`); the block contains operators the
rewriter cannot reproduce faithfully (`"`, extra state operators between fragments, marked content between
fragments); the text render mode is invisible (`Tr 3`, typical of OCR layers); the page has no text at all
(scanned) or the file is encrypted. The export never silently proceeds past a refusal.

## 6. Verification plan (independent of our engine)

Every P0 feature is checked on the **exported bytes**, using parsers that do not share our code:

* PDF.js (in the browser tests): `getTextContent`, `getAnnotations`, `getOutline`, `getPage` for every page.
* pdf-lib reload: page count, annotation and outline structure.
* Poppler (`pdftotext`, `pdfinfo`, `pdffonts`, `pdftoppm`) and `pypdf` where installed: extracted text, links,
  outline, fonts present, and a rendered-pixel comparison proving that regions *outside* the edited block are
  unchanged.
* Round trip: re-open the exported file in the editor, confirm the edit is visible as text (not as a cover box).

## 7. Dependencies and limits

* New runtime dependencies: **none** for P0. Fonts used for substitution are the PDF standard 14 (no files shipped).
* Dev/CI only: poppler-utils and `pypdf` for independent checks; the tests print SKIPPED (not PASS) when a tool is
  missing.
* Known limits (carried into the final report): text inside Form XObjects, non-Latin scripts for newly typed
  characters, justification (`Tw`) inside edited blocks is kept but not recomputed, edited text does not reflow
  neighbouring blocks (the UI warns when the new text is wider than the original and may overlap), Link/underline
  decorations drawn as separate paths are not moved with edited text.

---

# Implementation status (what shipped on this branch, and how it was verified)

Everything below is implemented in `tools/pdf-editor/engine/*` and `tools/pdf-editor/v2ui.js`. "Verified" means checked on the
**exported bytes** by tools that share no code with the editor (Poppler, pypdf, PDF.js) — see `tests/pdf-editor-v2-engine.mjs`
(Node, 45 tests) and `tests/pdf-editor-v2-browser.mjs` (Chromium, Firefox, WebKit; 1440 px and 390 px).

| Requirement | Status | Evidence |
|---|---|---|
| P0-1 Edit existing text (replace words, sentences, numbers, amounts; delete; multipage; no cover boxes) | done | Replacing/deleting verified with `pdftotext` and pypdf on Chrome (CID subset), LibreOffice (simple subset), reportlab (std + TTF), pdf-lib (standard) and hand-written streams. Deleted characters are absent from the file. Pixels outside the edited line are identical. |
| P0-2 Formatting (family, size, colour, bold/italic, anchor) | done, with the documented font limits | Fonts listed by `pdffonts`; size from word boxes; colour from rendered pixels; right/centre anchors from word boxes. A colour change does not leak into later text (regression test). |
| P0-3 Hyperlinks (create, retarget, remove, internal page links, preserved after export) | done | pypdf + PDF.js read the saved annotations; `javascript:`, `data:`, `file:` and `vbscript:` addresses are refused. |
| P0-4 Bookmarks (view, add, rename, delete, reorder, nest, destinations kept) | done | Outline and destination pages read back with pypdf and PDF.js; reorder/delete/extract of pages remap or drop destinations with a warning. |
| P0-5 Reliable saving | done | Before offering a download the editor reopens the result, and compares link count, bookmark count and every edited text with what the page now contains; a mismatch blocks the download. Poppler reports no syntax errors on any exported test file. |
| P1 New text, images, move/resize, kept after export | done (V1 features, re-verified together with V2 edits) | Image count with `pdfimages`, text with PDF.js. |

## Safety net that found real bugs

Re-encoding **every** block of a document unchanged must render **pixel-identically**. This runs on every fixture (Chrome, Chrome
multilingual with CJK/Arabic/ligatures, LibreOffice, reportlab, pdf-lib standard fonts, hand-written kerning/`Tc`/`Tw`/`Tz`/`'`/rotated/
font-switching streams). Looking at an exported page also caught one defect the numeric checks missed: a colour override on text
whose fill was never set explicitly left all later text in that colour. It is fixed and covered by a pixel regression test.

## Known limits (shown to the user where they apply)

* Text inside Form XObjects is not part of the page stream the engine edits. The editor counts such words and says so.
* A typed character can reuse the original embedded font only if that font already draws it somewhere in the document. Otherwise
  it is drawn with the matching standard font (Helvetica, Times or Courier), and the panel says which characters. Characters
  outside WinAnsi that the embedded font lacks are refused.
* Bold, italic and a different family on text in an embedded font switch those characters to a standard font (the subset cannot be made bold).
* Editing is per line by default. A wrapped paragraph (lines sharing a left edge, font, size, colour and leading, with nothing else inside its width) can be edited as a whole: its words are re-wrapped onto the paragraph's existing lines with the original font and colour (`engine/reflow.mjs`). Reflow never adds lines, so text that needs more lines is refused, justified paragraphs become ragged-right (the editor says so), and paragraphs with mixed fonts or colours are only offered line by line. Within a single line, a longer replacement warns; "Move the rest of the line along" shifts closely
  following text, but underlines, boxes and link rectangles that were drawn separately are not moved.
* Not editable, with a reason shown: Type 3 fonts, composite fonts without ToUnicode or with other CMaps, vertical writing,
  invisible OCR text, text drawn with stroke/clip render modes. Scanned pages show "no selectable text" (no OCR). Encrypted files are refused.
* Links: URI and internal page destinations are editable (internal destinations created here point to the top of the page).
  Other actions (launch, remote file) are kept in place when pages stay in the same document, and dropped with a warning when pages are copied into a new file.
* Bookmarks of a PDF inserted into the document are not imported; the first document's bookmarks are kept and remapped.
* Signed PDFs: any edit invalidates the signature (the editor says so on open).
* Real-device Safari/Chrome/Firefox were not tested; Safari is covered by Playwright WebKit.

## Dependencies

No new runtime dependency (pdf-lib 1.17.1 and PDF.js 4.10.38 were already vendored). Test/CI only: Poppler (`poppler-utils`) and `pypdf`;
the QA workflow installs both and fails if a tool is missing instead of skipping.
