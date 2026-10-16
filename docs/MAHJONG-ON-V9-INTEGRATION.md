# Mahjong Solitaire on V9 integration

- Base: V9 baseline `6b6e34bec3a0725fa852fb3cfb96bc9e5640737f` (main). Merged: `feature/mahjong-multiplayer-solitaire` at `026cd6c26e207a449c9dde0caae7da2a2dc7018c`.
- Source branch adds Mahjong Solitaire only (`play/mahjong-solitaire/`, tests, QA workflow, `play/index.html` card, sitemap entry). The multiplayer engine/Durable Object (`multiplayer/`, `play/mahjong/`) already exists on V9 and is unchanged.
- `sw.js`: all V9 entries kept; four Solitaire assets added; cache `govibetool-v8-8` -> `govibetool-v8-9` (pinned in `tests/v5-maintenance-browser.mjs` and `tests/v8-discovery.mjs`). The V9 media-cache exclusion in `activate` is untouched.
- Not changed: `wrangler.jsonc`, `wrangler.preview.jsonc`, Cloudflare workflows, secrets, V9 tools.
