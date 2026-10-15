# V9 Agent 2 media tools

Branch: `feature/v9-agent2-media`, based on `feature/v9-browser-utilities` at `015549419d20d95fb1ba1f275609431f26a2cf2c`. Review only; do not merge, deploy, or modify V8 release branches/production.

## Integration

Implementation lives in `tools/v9-media/`. `register.js` adds six catalogue entries and wraps the existing `openTool` chain. It is loaded by one added script tag in `index.html` before discovery runs. Each tool opens in a titled iframe with its own strict CSP and no third-party scripts. Direct URLs also work at `/tools/v9-media/?tool=<id>`.

The existing `v9-utilities-core.js` Bézier validator is reused and gains `bezierAt(progress,x1,y1,x2,y2)`, which inverts x with bounded bisection before evaluating y. It retains the epoch API. Agent 1 integration should preserve this export rather than introducing another curve engine. No other shared source, package scripts, category definitions, global service worker, or deployment configuration was changed. Exactly nine top-level categories remain; audio/video share the existing Images & Design category.

| ID | Working behavior | Explicit limits |
| --- | --- | --- |
| `cubic-bezier` | Numeric/keyboard controls, presets, curve plot, CSS copy, progress sampling and animation | X 0–1; UI Y −10–10; animation respects reduced motion |
| `screenshot-beautifier` | Browser/plain frame, rounded corners, colored background, shadow, tessellated perspective baked into PNG | PNG/JPEG/WebP; 25 MB / 16 MP; source scales down to 1600 px; perspective approximation rather than a 3D device model |
| `pdf-signer` | Pointer-drawn or typed visible signature, page selection and percentage placement, rotated-page preview, all-page raster flattening | 20 MB / 20 pages / 40 million total raster pixels; image-only export loses text, forms, links and accessibility; encrypted PDFs unsupported |
| `offline-ocr` | Local English Tesseract worker, editable text, confidence and TXT export | 12 MB / 16 MP; accuracy varies; English printed text only |
| `silence-stripper` | Linked stereo RMS silence detection, minimum-duration/padding controls, smoothed peak leveling, ceiling, short cut fades, audition/export | Browser-decodable audio, 30 MB / 180 s / 2 channels; 16-bit PCM WAV; not LUFS normalization; quiet speech can be cut |
| `video-gif-trimmer` | Real GIF decoding/compositing/re-encoding; video-to-GIF sampling; real-time WebM re-encoding with captured audio | 30 MB; GIF 300 frames / 40 million decoded pixels / 4 MP canvas; video 8 MP; WebM interval ≤60 s; video GIF ≤10 s at 10 fps / 480 px; browser codecs/captureStream required |

PDF signatures are visible images, **not cryptographic digital signatures**. No identity verification or legal validity is claimed. Editing invalidates existing cryptographic signatures. Raster flattening is not certified redaction. Original files are never overwritten. GIF timing is quantized to 10 ms; zero delays normalize to 10 ms; source loop counts become infinite looping. Re-encoding can change colors/timing. No added watermark; existing watermarks are retained. WebM export requires the foreground tab and should be reviewed; Safari/captureStream limitations are reported with a GIF alternative. Only Chromium was validated in this environment.

## Privacy, offline, accessibility and resource safeguards

Tools have no upload, telemetry, CDN, remote-font, or remote-engine requests. File content stays in memory; object URLs are revoked on replacement/page exit. ImageBitmaps, audio contexts, OCR/PDF workers and captured media tracks are released. Limits are checked before GIF decompression, image drawing, PDF allocation and video rendering; audio duration metadata is checked before decoding and decoded duration/channels are checked again. Cancellation checks occur between processing steps; OCR and video can be interrupted. Some bounded audio/image CPU work runs on the main thread and can briefly block interaction.

Use the **Offline readiness and privacy → Prepare offline use** button while online. The scoped service worker caches the six tools, shared Bézier/PDF writer, local OCR model/engine and PDF/GIF resources, verifying vendor SHA-256 pins. It never caches selected files, output blobs or entered text. It requires HTTPS or localhost. The roughly 22 MB asset payload is an explicit action, not an automatic homepage download. Browser eviction, clearing site storage, or a future global service-worker upgrade can remove the cache; prepare again if needed. Cache preparation success is shown only after worker activation. Worker version must be bumped when assets change.

UI provides explicit form labels, native keyboard inputs, visible focus, status announcements, cancellation, a keyboard alternative to signature drawing, reduced-motion handling, high contrast, and responsive layout checked at 390 px. OCR results and image-only PDFs require human review; raster PDF output is not accessible document output.

## Run and validate

No runtime dependency install is needed. Serve the repository or built `dist/` with a static HTTP server. Do not use `file://`. Use the existing checkout; no worktree is needed.

```sh
node --test tests/v9-media.mjs tests/v9-utilities.mjs
node tests/v9-media-browser.mjs
node scripts/build-static.mjs
SITE_ROOT=dist node tests/v9-media-browser.mjs
```

Browser tests use Playwright from the environment (`require.resolve('playwright')`) or `PLAYWRIGHT_PACKAGE` as a module path, and `/usr/bin/chromium` or `BROWSER_EXECUTABLE`. They start/stop a loopback static server internally. Optional `MEDIA_CHECK` selects a check by substring; `MEDIA_TRACE=1` prints browser diagnostics. An unfiltered run exercises all nine scenarios. Test dependencies are not added to the shipping package.

Evidence: 11 unit tests; nine browser scenarios covering all six tools, actual file downloads, audible captured video audio, video-to-GIF frame counts/timing, mobile width, invalid curve input, OCR cancellation/retry, offline OCR and multipage PDF processing, homepage routing, nine categories, no external tool requests, and no uncaught page errors. Static build/reference/size verification also passes. The built distribution is tested separately.

`npm test` reaches a pre-existing failure in `tests/v8-studios.mjs`: the legacy test expects `aliases['hourly-rate'] === 'freelance'`, but Freelance Studio was removed from the base. `studios-core.js` and the test are byte-identical to base `0155494`; evaluating that base engine confirms the alias is undefined. The remaining commands after that failure in the npm test chain do not execute. This change does not restore retired functionality. The search suite rewrites a latency report; that incidental output was restored before committing.
