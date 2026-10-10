# Knowledge search intelligence: browser results

Run: `node tests/knowledge-search-browser.mjs` (local static server, no production traffic).

- chromium: PASS (query render p50 30.1 ms, max 117.9 ms, page load 121 ms)

Asset sizes (raw / gzip):
- knowledge/search-core.mjs: 9.9 KB / 3.2 KB
- knowledge/search-intelligence.mjs: 36.1 KB / 11.5 KB
- knowledge/relations.mjs: 1.9 KB / 0.9 KB
- knowledge/query-understanding.json: 11.4 KB / 2.5 KB
- knowledge/tool-map.json: 11.9 KB / 3.6 KB
- knowledge/relations.json: 83.0 KB / 9.2 KB
- knowledge/search-index.json: 446.5 KB / 82.9 KB
- knowledge/search-lexicon.json: 156.7 KB / 25.2 KB
- knowledge/semantic-index.json: 1342.6 KB / 857.1 KB
- added by this work: 144.3 KB raw / 27.8 KB gzip
