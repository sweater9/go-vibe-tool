# IntelliTools Knowledge — content workstream

Static, browser-friendly Knowledge content: 35 articles (29 explainers, 6 comparisons), an AI Glossary (64 terms), a local search index and learning paths. No APIs, databases, accounts or server code. Nothing outside `knowledge/` was modified.

## Layout
- `src/pages-*.mjs`, `src/glossary.mjs`, `src/meta.mjs` — the content (source of truth). Body text is light Markdown; `[[slug]]` / `[[slug|label]]` link to other pages and the build fails on any broken link.
- `src/build.mjs` — `node knowledge/src/build.mjs` regenerates every `.html`, `search-index.json` and `sitemap-fragment.xml`. Generated files are committed so the folder can be served as-is.
- `knowledge.css` — small stylesheet that reuses `v2.css` tokens.
- `search-index.json` — for the primary workstream's local Knowledge Search: per page `title`, `question`, `summary`, `aliases`, `keywords`, `related`, `headings`, `relatedTools`; plus `glossary` and `paths`.
- `sitemap-fragment.xml` — the generated list of canonical Knowledge URLs. The same URLs are written into the root `sitemap.xml` by `src/build.mjs` (block between the `knowledge:start` and `knowledge:end` comments, replaced on every build). Redirect stubs such as `hugging-face-transformers.html` are never listed.

## Tool recommendations (deliberately sparse)
`relatedTools` is non-empty on only a few pages; the rest are Knowledge-only. Search should treat an empty `relatedTools` as "show Knowledge results only".
- AI Prompt Builder → prompt-engineering, system-prompts, common-prompting-mistakes
- Fact Anchor Checker → ai-hallucinations, how-to-reduce-hallucinations, ai-evaluation
- PII & Secret Redactor → ai-privacy-and-security

## Integration notes
- Pages ship a minimal header/footer using existing markup; swap for the final Tools | Knowledge | Labs | Play navigation when it exists.
- No analytics, ads or service-worker changes. Add `knowledge/` to the SW precache only if desired.
- Canonical/og URLs assume `https://intellitools.online/knowledge/…`; adjust for staging if needed.
- Fast-moving facts (MCP spec details, provider retention/pricing, model sizes) are written version-agnostically and point to current docs. Re-review before launch.

## Search experience
`search-core.mjs` is the ranker. `search.js` loads `search-index.json` and `search-lexicon.json` in the browser and renders Answer / guide, What you'll need, Learn more, and Use IntelliTools. Nothing is sent off the device. A tool is shown only when the question matches a specific in-house activity (draft a prompt, diff two prompts, check claims against pasted evidence, redact secrets, design a multi-agent workflow, validate JSON). Empty `relatedTools` stays empty. `node tests/knowledge-search.mjs` rewrites `SEARCH-TEST-REPORT.md`. `src/build.mjs` keeps the search box when the HTML is regenerated.

## V3 AI ontology (feature/knowledge-ai-v3-ontology)
140 additional entity pages, `ontology-v3.json`, 52 glossary terms and 7 learning paths, authored from the V3 topic specification (not converted from a V2 file). Nothing is source-verified. See `V3-AI-ONTOLOGY-NOTES.md`, `spec/ENTITY-SCHEMA-V3.md`, `AI-V3-QUERY-REPORT.md`. Tests: `npm run test:ai-v3`.

## Offline behaviour (limitation — not a full offline mode)
Knowledge is **not** an offline-first section and should not be described as one.
- The service worker (`/sw.js`) is registered only by the tools home page. Knowledge pages never register it and it does not precache them.
- If a visitor opens the tools home page first and then Knowledge online, the Knowledge index, search and the articles they visited keep working without a network. An article that was never visited falls back to the tools home page.
- A visitor who lands directly on a Knowledge page has no service worker; offline reload then depends only on the browser's HTTP cache.
- Search itself runs in the browser from `search-index.json` and `search-lexicon.json`; it needs those files to have loaded once.
- Making Knowledge properly offline (registering the worker here and precaching the index, lexicon and pages) is a separate piece of work.

## Legacy URLs
`hugging-face-transformers.html` is a generated redirect stub (meta refresh, canonical link and script that keeps the query string and hash) pointing to `hugging-face.html`. Redirects are declared in `REDIRECTS` in `src/build.mjs` and regenerated on every build. GitHub Pages cannot send an HTTP 301, so this is a soft redirect.
