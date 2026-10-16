# V9 media dependencies

All runtime dependencies are vendored locally. Package versions and npm SHA-512 provenance are recorded in `docs/v9-media-vendor-provenance.json`; per-file SHA-256 pins are in `vendor-assets.json`. npm verified tarball integrity during installation. Offline installation verifies the per-file pins again over HTTPS (or localhost for development).

- Tesseract.js 6.0.1 and Tesseract.js-core 6.0.0: Apache-2.0. License texts and minified bundle notices are in `vendor/ocr/`.
- English traineddata: `@tesseract.js-data/eng` 1.0.0, `4.0.0/eng.traineddata.gz`, from https://github.com/naptha/tessdata. The npm package declares MIT; underlying Tesseract traineddata is distributed under Apache-2.0 (included beside the engine). Only English is bundled.
- PDF.js (`pdfjs-dist`) 4.10.38: Apache-2.0. `vendor/pdf/LICENSE.txt`; CMap and standard-font licenses are retained in their original subdirectories. Evaluation of embedded PDF JavaScript is disabled and document action scripts are never executed.
- gifenc 1.0.3: MIT, `vendor/LICENSE-gifenc.txt`.
- gifuct-js 2.1.2: MIT, `vendor/LICENSE-gifuct.txt`. Its dependency js-binary-schema-parser is bundled under MIT; its notice is retained in `vendor/LICENSE-js-binary-schema-parser.txt`.
- Existing site `vendor/pdf-lib.min.js` is reused without modification.

`vendor/gif.mjs` was built with esbuild 0.25.12 using this entry:

```js
export { GIFEncoder, quantize, applyPalette } from 'gifenc';
export { parseGIF, decompressFrames } from 'gifuct-js';
```

Build command: `esbuild gif-entry.js --bundle --format=esm --minify --outfile=vendor/gif.mjs`. Original sources are available in the corresponding pinned npm packages. No runtime npm installation is required. Preserve licenses and regenerate the SHA-256 manifest when updating assets. Bump the offline worker cache version whenever application assets change.
