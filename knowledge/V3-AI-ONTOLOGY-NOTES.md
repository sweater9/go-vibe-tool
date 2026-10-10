# IntelliTools Knowledge V3 — AI ontology content

Branch: `feature/knowledge-ai-v3-ontology` (from `feature/knowledge-integration-v3`). Not merged. Not deployed. Production untouched.

## Provenance (read this first)
This content was **authored from the V3 topic specification and general technical knowledge. It is not a conversion of the V2 ontology document** (`knowledge/spec/ai-knowledge-ontology-v2.json` was never available in the repository). No live source checking was possible while writing.

- Every canonical source is an **unverified lead**: `verified:false` and `verification_date:null` on all 334 source records (44 have no locator yet). Identifiers (arXiv IDs, DOIs, URLs) came from memory and must be confirmed before publication.
- 71 entities are `volatile`; together they list 126 time-sensitive claims in `time_sensitive_claims_to_verify`. Treat benchmarks scores, model names, versions, prices, licences, regulatory dates, project governance and "who offers what" as unverified.
- Each page shows a "sources not yet verified" pill and a "Sources and verification" section.
- `AUTHORED` date is 2026-10-06 (see `src/entity-model.mjs`).

## What was added
- **143 entity records** in `ontology-v3.json`: **140 new pages** (128 explainers + 12 comparisons) and **3 overlay records** on existing pages (`langchain`, `llamaindex`, `hugging-face`: their aliases/keywords are merged into search, their HTML is unchanged).
- 13 domains: reasoning & test-time compute (13), structured generation (8), ML/DL/RL (12), model architectures (15), LLM techniques (9), multimodal (5), agent protocols/frameworks/runtimes (20), agent & RAG patterns (8), evaluation & benchmarks (12), infrastructure & MLOps (11), safety/alignment/governance (19), AI for science (6), robotics & embodied AI (5).
- Entity types used: concept 60, technique 46, framework 10, model 6, standard 6, benchmark 4, runtime 4, library 2, protocol 1, language 1, platform 1, database 1, regulation 1.
- 52 glossary terms (143 total), 7 learning paths, lexicon part D (72 intents, 142 concepts, 25 "what you'll need" blocks, 1 ambiguity guard), search-index entity metadata.

## Entity schema
See `spec/ENTITY-SCHEMA-V3.md`. Source of truth is `src/entities-*.mjs`; `src/entity-model.mjs` validates and converts. Fields: canonical name, entity_type, plain-English and technical definitions, aliases/acronyms, user intents, natural-language questions (≥3), prerequisites, related, contrasted-with, technologies, implementation patterns, failure modes, troubleshooting, practical guide, canonical sources, verification, freshness class, time-sensitive claims, IntelliTools mappings.

## Modelling rules (enforced by `tests/knowledge-ontology-v3.mjs`)
- **DPO** is filed under *Safety, Alignment & Governance* with parent `preference-optimization`; it is described as preference optimisation, not ordinary RL. `reinforcement-learning` says so explicitly. RLVR/GRPO (verifiable-reward RL) is a separate entry from preference methods.
- **No private chain-of-thought is exposed or elicited.** `reasoning-transparency` tells readers not to extract hidden reasoning, to design around final answers and purpose-written justifications, and not to treat displayed reasoning as a faithful explanation. A test scans every entity for instructions to reveal hidden reasoning.
- **IntelliTools mappings are sparse**: 4 of 143 entities. `context-engineering` → AI Prompt Builder; `rag-evaluation` → Fact Anchor Checker; `llm-observability` → PII & Secret Redactor; `structured-outputs` → JSON formatter (ontology-only note; syntax check only). Everything else is Knowledge-only.
- No invented facts: named products/versions are described generically, and uncertain claims are in `tsc`.

## Search
No threshold was changed (`minSolidScore` is still 20, `maxIntentBoost` 56; `search-core.mjs` and `search.js` are untouched). Part D uses the existing intent/concept/synonym/coverage-gap mechanisms. Entity `questions` beyond the first are added as page aliases.
- `node tests/knowledge-ai-v3-queries.mjs` → `AI-V3-QUERY-REPORT.md` (358 queries: 328 positive, 30 negative).
- Baseline before lexicon part D: 180 pass / 111 weak / 37 miss of 328 positive, 5 false positives of 30 negatives.
- After: 293 pass / 25 weak / 10 miss. Tuning set 251/258 pass; **held-out set 42/70 pass, 18 weak, 10 miss** (written before part D, but by the same author, so it is not fully independent).
- Existing `tests/knowledge-search.mjs`: 48 pass / 1 weak / 0 miss on 49 queries. One accepted-page list was widened ("How do I evaluate a RAG system?" now also accepts the new `rag-evaluation` page).

## Housekeeping and caveats for the integrator
- `src/build.mjs` edits (additive): imports entity aggregator and V3 glossary, applies overlay aliases, adds lexicon part D to the merge list, an entity metadata pill, `entity` in the search index, and writes `ontology-v3.json`. `src/meta.mjs`: 7 new learning paths. `knowledge.css`: `.kn-meta` pill. `package.json`: one new script `test:ai-v3`.
- Learning paths are rendered on every page they include, so `ai-evaluation.html`, `large-language-models.html` and `local-ai.html` now show extra path boxes.
- The integration branch's committed generated files were behind `src/` (committed index had 35 pages, 80+ technology pages untracked). This commit includes the regenerated outputs for all pages so links and search are consistent. `json-validation.html` was deliberately left at its committed bytes.
- `src/lexicon-part-d.generator.py` is the compact source used to write `lexicon-part-d.json`; the build reads only the JSON.
- `tests/knowledge-search.mjs` rewrites `SEARCH-TEST-REPORT.md` each run.

## Unresolved gaps
See the final hand-off message and `AI-V3-QUERY-REPORT.md`. Short list: nothing is source-verified; paraphrased natural-language queries without a keyword still miss (held-out set); generic hub pages (`model-apis`, `model-cards`) surface through the token "model"; ambiguous acronyms (BoN, bare DPO/PRM) stay weak by design; two out-of-scope queries still get confident answers via existing concepts ("transformer toy robots", "ollama llama animal facts"); existing core pages (RAG, embeddings, etc.) do not yet carry the V3 fields.
