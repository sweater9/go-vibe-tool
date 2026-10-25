# Third-party notices

GoVibeTool bundles the following browser libraries so PDF and QR files can be processed locally without a third-party CDN:

- pdf-lib 1.17.1 — MIT License — Copyright Andrew Dillon
- qrcode-generator 2.0.4 — MIT License — Copyright Kazuhiko Arase
- jsQR 1.4.0 — Apache License 2.0 — Copyright Cozmo

The source packages and their complete license texts are available from:

- https://www.npmjs.com/package/pdf-lib
- https://www.npmjs.com/package/qrcode-generator
- https://www.npmjs.com/package/jsqr


## File & media tools (tools/file-media, vendor/svgo.browser.js, vendor/avif)
- SVGO 4.1.0 — MIT License — Copyright Kir Belevich and contributors. Bundled as `vendor/svgo.browser.js` (the project's own browser build, unmodified; its bundled dependencies css-tree and csso are MIT, css-select and css-what are BSD-2-Clause, sax is BlueOak-1.0.0, picocolors is ISC). Licence text: `vendor/svgo.LICENSE.txt`. Source: https://github.com/svg/svgo
- jSquash AVIF 2.1.1 (`vendor/avif/avif_enc.js`, `avif_enc.wasm`; single-threaded build of the Squoosh/jSquash AVIF encoder) — Apache License 2.0 — Copyright Google Inc. and the jSquash authors. Licence text: `vendor/avif/LICENSE-jsquash-Apache-2.0.txt`. Source: https://github.com/jamsinclair/jSquash
- libavif 1.0.1 and libaom, compiled into `avif_enc.wasm` — BSD 2-Clause License (libavif: Copyright Joe Drago; libaom: Copyright the Alliance for Open Media, with the AOMedia Patent License 1.0). Sources: https://github.com/AOMediaCodec/libavif and https://aomedia.googlesource.com/aom
- The ZIP writer, EXIF/IPTC/XMP scanner, CSV/Markdown table converter and SVG sanitiser are original GoVibeTool code and make no network requests.

## Daily Word Challenge word lists (play/daily-word/words.js)
- Answer list derived from SCOWL / 12dicts common-word tiers via the `wordlist-english` package (Copyright 2000-2016 Kevin Atkinson; permission to use, copy, modify, distribute and sell granted provided the copyright notice and permission notice appear in supporting documentation; provided "as is"). Alan Beale and the ENABLE contributors are credited by that project.
- Valid-guess list derived from the ENABLE word list (public domain) via the `word-list` package (MIT).
- Lists are bundled; the game makes no network requests. Regenerate with `play/daily-word/src/build-words.mjs`.

## PDF Editor, OCR and media tools (tools/v9-media/vendor)
These libraries are bundled locally and used by the PDF Editor, PDF Studio, OCR and GIF tools. Versions, licences and provenance are recorded in `tools/v9-media/THIRD_PARTY_NOTICES.md`, `docs/v9-media-vendor-provenance.json` and the licence files beside each asset.
- PDF.js (`pdfjs-dist`) 4.10.38 — Apache License 2.0. Licence text: `tools/v9-media/vendor/pdf/LICENSE.txt`. Includes CMaps (`vendor/pdf/cmaps/LICENSE`) and standard fonts (`vendor/pdf/standard_fonts/LICENSE_FOXIT`, `LICENSE_LIBERATION`). Evaluation of embedded PDF JavaScript is disabled.
- Tesseract.js 6.0.1 and Tesseract.js-core 6.0.0 — Apache License 2.0. Licence texts: `tools/v9-media/vendor/ocr/`. English traineddata from `@tesseract.js-data/eng` 1.0.0 (only English is bundled).
- gifenc 1.0.3 — MIT; gifuct-js 2.1.2 — MIT; js-binary-schema-parser — MIT. Licence texts: `tools/v9-media/vendor/LICENSE-*.txt`.
- pdf-lib 1.17.1 (listed above) is reused by these tools without modification.
