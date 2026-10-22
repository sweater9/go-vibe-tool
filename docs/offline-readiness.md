# Offline readiness indicators

A small pill beside the heading of the PDF Editor, PDF Compare and the game workspaces (2048, Daily Word, Logic Crypt, Taiwanese Mahjong, Vibe Arcade) says whether that feature works offline. It is not shown on homepage tiles.

| Status | Meaning |
| --- | --- |
| Ready offline | A service worker is active **and** every file the feature needs is present in Cache Storage. |
| Download required | The feature has optional offline files the user can download (PDF engine, fonts and character maps) and some are not saved yet. Use *Prepare offline* in a Media Tools page. |
| Online required | No active worker (for example a first visit), or files a page needs are missing (evicted, or not yet loaded). Visiting the page online fills them. |
| Checking offline availability | The first answer is not known yet. It settles in a few seconds and is re-checked on focus, on online/offline changes, and when the worker is replaced or updated. |

Rules: the answer comes from `caches.keys()` and the worker registration, never from `navigator.onLine`. The script (`offline-status.js`) only reads; it never fetches assets, registers workers or writes caches, so the caching strategy is unchanged. Each page lists what it needs in `data-offline-assets`; `tests/offline-status.mjs` fails if a page loads a file it does not declare, or declares a file that is not precached. The PDF engine list is read from `tools/v9-media/vendor-assets.json` (`vendor/pdf/*`).

Known limits: Ready is a presence check, not a content hash check (the media worker verifies hashes when it downloads). The status is per browser profile; private windows and storage clearing return the page to "Online required".
