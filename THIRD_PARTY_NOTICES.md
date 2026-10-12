# Third-party notices

GoVibeTool bundles the following browser libraries so PDF and QR files can be processed locally without a third-party CDN:

- pdf-lib 1.17.1 — MIT License — Copyright Andrew Dillon
- qrcode-generator 2.0.4 — MIT License — Copyright Kazuhiko Arase
- jsQR 1.4.0 — Apache License 2.0 — Copyright Cozmo

The source packages and their complete license texts are available from:

- https://www.npmjs.com/package/pdf-lib
- https://www.npmjs.com/package/qrcode-generator
- https://www.npmjs.com/package/jsqr


## Daily Word Challenge word lists (play/daily-word/words.js)
- Answer list derived from SCOWL / 12dicts common-word tiers via the `wordlist-english` package (Copyright 2000-2016 Kevin Atkinson; permission to use, copy, modify, distribute and sell granted provided the copyright notice and permission notice appear in supporting documentation; provided "as is"). Alan Beale and the ENABLE contributors are credited by that project.
- Valid-guess list derived from the ENABLE word list (public domain) via the `word-list` package (MIT).
- Lists are bundled; the game makes no network requests. Regenerate with `play/daily-word/src/build-words.mjs`.
