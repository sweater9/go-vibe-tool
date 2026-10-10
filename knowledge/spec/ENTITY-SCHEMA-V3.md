# IntelliTools Knowledge — entity schema (V3)

Authored from the topic specification in the V3 brief. **This is not a conversion of the V2 ontology document** (`knowledge/spec/ai-knowledge-ontology-v2.json` was never available in the repo).

Source of truth: `knowledge/src/entities-*.mjs`, validated by `knowledge/src/entity-model.mjs`. Build output: one article per entity, plus `knowledge/ontology-v3.json`.

| Field (ontology JSON) | Authoring key | Notes |
| --- | --- | --- |
| canonical_name, id | `name`, `id` | `id` is the page slug |
| entity_type | `entity_type` | concept, protocol, language, framework, library, model, runtime, database, platform, technique, benchmark, standard, regulation |
| plain_english_definition / technical_definition | `plain` / `technical` | |
| aliases, acronyms | `aliases`, `acronyms` | Feed search alias matching. Acronyms live only on their own entity. |
| user_intents | `intents` | What a searcher is trying to do |
| natural_language_questions | `questions` | First one becomes the page's primary question; ≥3 required |
| prerequisites / related_concepts | `pre` / `rel` | Entity ids or existing page slugs; build fails on a bad id |
| contrasted_with | `vs` | `[ref, difference]`; ref is a slug (validated) or a plain name |
| technologies_frameworks | `tech` | Examples, not recommendations |
| implementation_patterns, common_failure_modes, troubleshooting, practical_guide | `patterns`, `fails`, `fix`, `guide` | |
| canonical_sources | `sources` | `[title, locator|null]`. All unverified; `verified:false` is enforced |
| verification | generated | `verification_date` is `null` — nothing has been verified against a live source |
| freshness_class | `fresh` | stable / evolving / volatile; volatile entities must list `tsc` |
| time_sensitive_claims_to_verify | `tsc` | |
| intellitools_mappings | `tool`, `tool_note_only` | Only genuinely relevant tools; most entities have none |

Modelling rules enforced by the validator: DPO has parent `preference-optimization` and lives under *Safety, Alignment & Governance*, never under RL; no source may be marked verified; reasoning pages must not instruct readers to extract hidden chain-of-thought.
