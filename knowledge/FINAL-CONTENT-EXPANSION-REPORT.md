# Knowledge V3 — Final Content Expansion & Source Verification Report

- **Branch:** `agent/knowledge-v3-final-expansion` → PR into `feature/knowledge-base-preview` (base commit `0b713df`)
- **Check date:** 2026-10-09 (every "verified" statement below means *compared with the cited primary page on this date*)
- **Scope:** content and factual verification only. Search ranking, lexicon parts, ambiguity rules and `search-core.mjs` / `search.js` were **not** changed (another engineer owns them). No merge, no `main` change, no deployment.
- **Release-blocker pass (section 11) supersedes sections 7 and 10 where they differ.**
- **Machine-readable records:** `knowledge/source-verification.json` (records, change log, sources) and `knowledge/ontology-v3.json` (`verification.source_check` per page).

## 1. Recommendation

**The content portion is ready for the V3 release to staging, and ready for production once two conditions are met:**

1. A reviewer signs off the three pages that make legal, security or privacy statements — `eu-ai-act`, `mcp-authorization`, `gmail-api-scopes-and-verification` (all are orientation, not legal advice, and say which parts could not be verified).
2. The time-sensitive items in section 6 are re-checked on the release day (notably the OpenAI shutdown date of **23 October 2026** and the Sora API outcome).

This is not a claim that the whole corpus is verified. **188 of 270 pages remain unverified at claim level** (unchanged from the audit); V3 entity pages carry a visible status banner and the 120 legacy pages have no source section. The 62 pages with checked key claims are listed in `source-verification.json`.

## 2. Coverage added (10 new pages, 6 re-checked pages)

All new pages follow the existing entity schema, appear in search/ontology/sitemap, state the check date, list the primary sources consulted, and list what could **not** be verified.

| Page | Covers | Main primary sources | Not verified (see page) |
|---|---|---|---|
| `microsoft-agent-framework` | What MAF is, features, install names, relation to AutoGen/Semantic Kernel, patterns, failure modes | MAF, AutoGen and Semantic Kernel READMEs; migration guide | Current release number, licence, Python/.NET parity |
| `migrate-to-microsoft-agent-framework` | AutoGen → MAF mapping (AssistantAgent→Agent, FunctionTool→@tool, Team/GraphFlow→Workflow, sessions, MCP, checkpointing) and a staged migration approach | Microsoft Learn AutoGen guide | **Semantic Kernel guide could not be read — no SK API mappings given**; the guide's "future patterns" note conflicts with the MAF README (reported, not resolved) |
| `mcp-authorization` | OAuth 2.1 for MCP: roles, RFC 9728/8414/8707/9207, Client ID Metadata Documents, DCR deprecation, token-passthrough ban, stdio exception | MCP specification revision 2026-07-28 (overview, client registration, changelog) | Discovery and scope sub-pages not retrieved; whether 2026-07-28 is still newest; SDK uptake |
| `gmail-api-scopes-and-verification` | Gmail scope classes, restricted-scope verification, security assessment, Limited Use rules incl. the AI/ML training prohibition | Google Gmail scopes page; Workspace user-data policy (updated 2026-09-03); API Services policy | Fees/timelines/thresholds, unverified-app limits, consumer vs Workspace rules; whether the older policy page omits the AI sentence |
| `inspect-ai-evaluation-framework` | Inspect (UK AI Security Institute): task = dataset + solver + scorer, agents, tools/MCP, sandboxing, logs; Inspect Evals ownership | Inspect docs index, `inspect_ai` and `inspect_evals` READMEs, MIT licence | Import paths/CLI flags (no code sketch given on purpose), PyPI name, current eval count |
| `openai-reasoning-models` | Reasoning tokens, billing, effort values, summaries, incomplete responses, o-series history, deprecation dates | OpenAI reasoning guide; API deprecations page; announcements | **Current model names** (OpenAI docs disagreed on the same day, so none are named), exact launch days, pricing |
| `sora-ai-video` | Sora research report, Sora 2, discontinuation (app 26 Apr 2026, API scheduled 24 Sep 2026), lessons for vendor dependency | OpenAI report, announcement, Help Center article, deprecations page | **Whether the API actually stopped on 24 Sep 2026**; Sora 1 retirement; Azure end date; reasons |
| `nvidia-cosmos` | Cosmos 3 (Reasoner/Generator, Super 64B/Nano 16B/Edge 4B), tooling, licence, limitations, earlier families | NVIDIA/cosmos and Cosmos-Predict2.5 READMEs | Technical report not read; independent quality evaluations; OSI status of OpenMDW-1.1 |
| `attention-sinks` | Attention sinks, StreamingLLM (4 sink tokens, 4M+ tokens, 22.2× vs recomputation), what it does *not* do | arXiv:2309.17453 | Inference that evicted tokens are unavailable is labelled as inference; repo FAQ not read |
| `flashattention-3` | FA-3 techniques and reported numbers, Hopper/CUDA requirements, FlashAttention-4 as README-level information | arXiv:2407.08608; flash-attention README | Independent reproductions; FA-4 has no paper cited; README beta status may change |

Re-checked existing pages (each now has a dated source-check block): `a2a-protocol`, `autogen`, `semantic-kernel`, `eu-ai-act`, `nist-ai-rmf`, `owasp-llm-top-10`.

Cross-links added so the new pages are reachable: `world-models`, `video-generation-models`, `reasoning-models`, `flash-attention`, `kv-cache`, `agent-evaluation`, `mcp`, `mcp-security`, `autogen`, `semantic-kernel`, `agent-frameworks-compared` (which also gained a Microsoft Agent Framework row), `gmail-for-ai-agents`, `oauth-for-ai-agents`.

## 3. Factual corrections to existing pages (11 change-log entries)

| Page | Correction | Source |
|---|---|---|
| `mcp`, `mcp-servers-and-clients` | Described only the `initialize` handshake. Revision 2026-07-28 removed the handshake and protocol-level sessions (`Mcp-Session-Id`), added `server/discover`, and replaced server-initiated requests with a multi-round-trip pattern. Pages now describe both models. | MCP spec 2026-07-28 "Key Changes" |
| `gmail-for-ai-agents` (3 edits), `oauth-for-ai-agents` | "Prefer readonly while prototyping" understated the burden: **`gmail.readonly` is a Restricted scope** (verification; security assessment if stored on servers). Added the Limited Use / AI-training prohibition. | Google Gmail scopes page; Workspace policy page |
| `video-generation-models` | Added Sora discontinuation (time-sensitive product status). | OpenAI Help Center; deprecations page |
| `agent-frameworks-compared` | Added Microsoft Agent Framework row. | MAF README |
| `nist-ai-rmf` | Resolved the "insufficient evidence" item: AI RMF 1.0 = NIST AI 100-1, released 26 Jan 2023; NIST says it is being **revised** (White House AI Action Plan), Playbook to follow; 7 Apr 2026 critical-infrastructure concept note. | nist.gov pages |
| `eu-ai-act` | Read the EUR-Lex text of Regulation (EU) 2026/1744 (OJ 24.7.2026): new Article 5 prohibitions apply from **2 Dec 2026**; Annex III high-risk **2 Dec 2027**; Annex I **2 Aug 2028**. The audit text said "a new prohibited practice" and "kept their earlier dates" — neither was supported by the text read, so both were reworded. | EUR-Lex |
| `owasp-llm-top-10` | The audit said "4 August 2026"; OWASP's resource page says 3 August. Page now says "early August 2026". | genai.owasp.org |

## 4. Verification method and honesty rules

- Each new/re-checked page has a `checked` block: claims compared, primary sources (title + https URL), check date, and an explicit **not independently verified** list. It renders as "Checked against primary sources", "Primary sources consulted" and "Not independently verified" sections, and the header chip reads "key claims checked 2026-10-09".
- **Schema change (backward compatible):** optional `checked` field in `entity-model.mjs` (validated: date, https sources, claims, unverified array). Ontology records for these pages get `verification.status: "key-claims-checked"` plus `source_check`. **`verified` stays `false` and `verification_date` stays `null` for every entry, `canonical_sources[].verified` stays `false`, and the ontology test was not weakened.** The ontology provenance sentence was updated because "no source has been verified" was no longer accurate.
- Vendor statements are recorded as "the source says", not as independent confirmation of product behaviour (for example Sora 2 realism claims, Cosmos capability claims, FlashAttention-3 speedups).
- Secondary sources were used only to flag items (for example the content of the new EU Article 5 prohibitions) and are labelled as secondary on the page.
- Volatile model names were deliberately avoided on the OpenAI page.

## 5. QA and test results

All run on the final branch state.

| Check | Result |
|---|---|
| `npm test` (syntax checks, smoke, knowledge-search, ontology, **new final-expansion test**, AI-V3 queries) | **exit 0** |
| `tests/knowledge-search.mjs` | 49 queries: 48 pass, 1 weak (documented Prompt Diff gap), 0 miss. One existing expectation was edited (see §7) |
| `tests/knowledge-ontology-v3.mjs` | passed; 153 entities (150 new pages, 3 overlays) |
| `tests/knowledge-final-expansion.mjs` (new) | passed — see below |
| `tests/knowledge-ai-v3-queries.mjs` | positive 328: pass 293 / weak 25 / miss 10 (identical to the committed report); negatives 29 pass / 1 false positive |
| `tests/knowledge-ambiguity-gate.mjs` | 18/18 passed |
| Internal links | 273 HTML pages, 6,736 relative links, **0 broken** |
| Page IDs / index / sitemap | 270 indexed pages, unique IDs; sitemap lists all 270 pages plus the index and glossary; semantic index `pageIds` equals the search-index order (270) |
| Same-answer safety on 1,607 frozen queries | Lexical search, old index vs new index: **0 changes** to solid flag, answer page, tools or gap. No confident answer moved to a new page |
| Limited-mode semantic runtime, rebuilt `semantic-index.json` (3,346 units, dim 64) | 1,607 queries: **0 violations** for solid/answer/tools/gap/need/learn; page-query top-1/3/5: lexical 484/653/726 → hybrid 652/830/902 |

The new test checks: pages exist and are indexed with `key-claims-checked`; each source-check record is complete and https-sourced; `verified` stays false; 40+ specific facts are present (dates, RFC numbers, scope classes, licences, arXiv IDs); the corrections to existing pages; links from related pages; internal link resolution; no instruction to extract hidden reasoning; no "best/leading" product ranking; no named current OpenAI models; and a tolerant search smoke (expected page within the top 3, no tool suggested) for 10 queries.

Not run: any browser/UI test (no UI code changed), any deployment.

## 6. Outstanding risks and unverified items

1. **Most of the corpus is unverified** (188 pages). Priority legal/security/privacy/governance pages checked or corrected here: EU AI Act, NIST AI RMF, OWASP LLM Top 10, MCP authorization, Gmail scopes/policy. **Not** re-checked: `ai-governance`, `ai-privacy-and-security`, `prompt-injection`, `ai-guardrails`, `computer-use-agents`, `prompt-caching`, `llm-cost-optimization`, `model-apis` — these use durable wording and list no specific volatile figures, but remain "staging only" in the audit.
2. **OpenAI shutdown on 23 October 2026** (o1, o1-pro, o3-mini, o4-mini) is 14 days after the check date; the page must be re-read on release day.
3. **Sora:** the API shutdown date (24 Sep 2026) has passed; no source confirming it actually happened was found. The page says so.
4. **Semantic Kernel migration guide could not be read**, so no Semantic Kernel mappings were written.
5. **MCP revision 2026-07-28** may not be implemented by the SDKs readers use; both models are described. I could not confirm it is still the newest revision.
6. **Legal pages are orientation only.** The EU AI Act page rests on the EUR-Lex amendment text for dates; the content of the new prohibitions rests on secondary commentary; consolidated text and Commission guidance were not read.
7. **Pre-existing, not changed:** `knowledge/hugging-face-transformers.html` exists but has no search-index or sitemap entry; the committed `AI-V3-QUERY-REPORT.md` was already stale relative to the committed lexicon (the tests regenerate it; I did not commit the regenerated copy to avoid conflicts); the build regenerates `search-lexicon.json` with part D appended and re-escapes `json-validation.html`, so I left both at their committed bytes.
8. Minor wording risk: the Cosmos and FlashAttention-3 pages report vendor/author numbers as claims; they are not reproduced.

## 7. Notes for the search/ranking engineer (not acted on)

- New pages enter lexical results but never became a confident answer on any of 1,607 frozen queries. They do take **top-1 on 34 non-confident queries** (27 after the Gmail title was shortened in the review pass, §10), mostly low-score tie noise. Two meaningful shifts: `planner and worker agents` (was `multi-agent-systems`, now `microsoft-agent-framework`, 37 vs 36) and `which framework for a production agent` (was `choosing-an-agent-framework`).
- `How can an AI agent access Gmail?` now lists `gmail-api-scopes-and-verification` in its five "learn more" slots, displacing `connecting-agents-to-apps`. I changed the **existing** `within` expectation in `tests/knowledge-search.mjs` from `connecting-agents-to-apps` to the new page (still two related pages must appear). Revert that edit if you prefer to change ranking instead.
- `how do I connect an AI agent to Gmail` answers `ai-agent-vs-chatbot` (pre-existing; the gate only checks it is solid).
- Generic words in titles, tech lists and first questions drive lexical overlap; I removed generic aliases/keywords from the new pages (for example "Agent Framework", "Data-Use Rules") to limit noise.

## 8. Modified files

Generated artefacts were rebuilt with `node knowledge/src/build.mjs` (and `python3 knowledge/src/build-semantic.py … --dim 64 --vocab 5000` for the semantic index; GloVe vectors are build-time only and not committed).

**New:** ten `knowledge/<id>.html` pages (the ids in §2), `knowledge/src/entities-final-expansion.mjs`, `knowledge/src/entities-final-expansion-models.mjs`, `tests/knowledge-final-expansion.mjs`, this report.

**Source:** `knowledge/src/entity-model.mjs` (optional `checked` block, validation, rendering, ontology), `knowledge/src/entities.mjs` (module list, ontology provenance wording), `knowledge/src/build.mjs` (page chip text), `knowledge/src/pages-agents.mjs`, `knowledge/src/pages-building-platforms.mjs`, `knowledge/src/entities-agents.mjs`, `entities-eval-infra.mjs`, `entities-llm.mjs`, `entities-ml.mjs`, `entities-reasoning.mjs`, `entities-safety-science.mjs`.

**Rebuilt pages with changes:** `a2a-protocol`, `agent-evaluation`, `agent-frameworks-compared`, `autogen`, `eu-ai-act`, `flash-attention`, `gmail-for-ai-agents`, `kv-cache`, `mcp`, `mcp-security`, `mcp-servers-and-clients`, `nist-ai-rmf`, `oauth-for-ai-agents`, `owasp-llm-top-10`, `reasoning-models`, `semantic-kernel`, `video-generation-models`, `world-models`, `index`.

**Generated data:** `knowledge/search-index.json`, `knowledge/semantic-index.json`, `knowledge/ontology-v3.json`, `knowledge/sitemap-fragment.xml`.

**Records and tests:** `knowledge/source-verification.json`, `knowledge/SOURCE-VERIFICATION-REPORT.md`, `package.json` (new test wired into `test` and `test:ai-v3`), `tests/knowledge-search.mjs` (one expectation, see §7).

**Review pass (§10) also touched:** `knowledge/knowledge.css` (one overflow-wrap rule), `knowledge/src/entities-final-expansion.mjs` and `entities-safety-science.mjs` (Gmail scope list, EU Article 5 wording), and regenerated pages, indexes and records.

**Not touched:** `search-core.mjs`, `search.js`, `hybrid-search.mjs`, `semantic-core.mjs`, lexicon parts, `search-lexicon.json`, `sw.js`, tools, `main`.

## 9. Ideas for V3.1 (not done)

Read the Semantic Kernel migration guide and add mappings; add a Gemini/Claude reasoning-terminology comparison page; verify the remaining "staging only" pages (`ai-governance`, `computer-use-agents`, `prompt-caching`); add GDPR/AI and DSAR pages with primary-source checks; add Inspect code samples after reading the tutorial; give legacy pages source sections; re-check Sora, OpenAI deprecations and MCP revisions on a monthly schedule.

## 10. Release-gate review pass (2026-10-09, after the handoff review on PR #30)

Content was frozen; only corrections and a CSS fix were made. Sign-offs remain with the human reviewers.

**Independent re-reads of primary sources (fresh fetches, `maxAge: 0`)**
- EU AI Act: EUR-Lex text of Regulation (EU) 2026/1744 re-read. Article 5(1) points (ba) (intimate-image generation without explicit consent) and (bb) (child sexual abuse material generation), and paragraphs 1a/1b (purpose/foreseeability limits), apply from 2 December 2026; Annex III 2 December 2027; Annex I 2 August 2028. The page now quotes the primary text instead of secondary commentary. Not re-read: Article 50 and GPAI date handling.
- MCP: revision 2026-07-28 authorization page re-read; every requirement stated on the page matches. New nuance noted by the source: a future revision is expected to raise `iss` inclusion from SHOULD to MUST.
- Gmail: scope page and Workspace policy re-read. **Correction made:** `gmail.settings.sharing` is also restricted and was missing from the list; add-on scopes exist and are not classified on the page. Policy page still reads "Last updated 2026-09-03 UTC" and the AI/ML prohibition sentence is unchanged.
- OpenAI deprecations page re-read: o1, o1-pro, o3-mini, o4-mini still 23 October 2026; Sora/Videos API rows unchanged (24 September 2026). **Sora API outcome still not confirmed**: search results are pre-shutdown blog posts and OpenAI's help page; no post-24-September source was found.

**Browser QA** (headless Chromium, local static server, 375px and 1280px, all 10 new pages + search):
- Found and fixed: **horizontal overflow at 375px** on 5 new pages and on `a2a-protocol`, caused by long source URLs in the new source-check lists. Fix: `overflow-wrap:anywhere` for `.kn-article p, li` in `knowledge/knowledge.css`. After the fix 0 of 273 pages overflow at 375px.
- 0 console errors; every new page returns 200 and shows the "key claims checked 2026-10-09" chip.
- Search in the page: "is sora still available" and "what is nvidia cosmos" show the right guide; offline (network disabled after load) search for "what is an attention sink" still returns `attention-sinks`. `how does oauth work for mcp servers` shows the existing OAuth 2.0 guide as the answer and does **not** surface `mcp-authorization` in its learn-more list (lexical ranking: new page is in the ranked top 3 but not selected).
- Not done: real devices, Safari/Firefox, the deployed staging URL, and per-link reachability checks of every external source URL.

**Items named in the review**
1. *Top-1 changes:* with the shorter Gmail title the count is now **27** (it was 34). Against the expected pages in the frozen sets there are **2 top-1 regressions** (`which framework for a production agent`: `choosing-an-agent-framework` to `microsoft-agent-framework`; `planner and worker agents`: `multi-agent-systems` to `microsoft-agent-framework`) and **8 top-3 regressions** (all agent-framework/protocol or attention queries, e.g. `microsoft framework where agents chat with each other to solve tasks` no longer lists `autogen` in the top 3). No improvements. None changed a confident answer, tool or gap.
2. *Gmail learn-more:* new page legitimately enters the five "learn more" slots (score 53) and pushes `connecting-agents-to-apps` out. The test edit is the minimum change; the alternative is a ranking change.
3. *Pre-existing Gmail misrouting:* `how do I connect an AI agent to Gmail` ranks `gmail-for-ai-agents` first (68) but the answer is `ai-agent-vs-chatbot` (58) because the answer selector requires an anchored match (alias/intent/concept) and `gmail-for-ai-agents` has no alias for this phrasing. Identical on the base commit. A one-line alias would fix it but changes a confident answer, so it was not applied.
4. *`hugging-face-transformers.html`:* a stale generated page from commit `da370dd` (title "Hugging Face Transformers and the Hub"), self-canonical, no source module, not in the index or sitemap, not linked from any page; superseded by `hugging-face.html`. Not removed; the owner should decide between deleting it and adding a redirect, because the old URL may be indexed externally.

**Commands**: `npm test`; `node tests/knowledge-ambiguity-gate.mjs`; `node knowledge/src/build.mjs`; `python3 knowledge/src/build-semantic.py <glove.json> --dim 64 --vocab 5000`; Playwright script at `/tmp/final/qa/qa.mjs` (not committed); same-answer and regression scripts under `/tmp/final` (not committed).

**Reviewer sign-offs:** none recorded. Production approval remains separate.

## 11. Release-blocker pass (search relevance, legacy URL, verification, QA)

No new knowledge pages were added; no unrelated tools or existing tests were weakened. Every number below was produced on the commit that carries this report.

### 11.1 Search relevance
- **Root cause of most regressions:** generic tokens in the new pages' technology/keyword lists ("agent", "attention") gave them lexical overlap with unrelated agent/attention queries. Trimming those (`microsoft-agent-framework`, `migrate-to-microsoft-agent-framework`, `attention-sinks`) took the 10 regressions (2 top-1 + 8 top-3) down to 2 without touching ranking code.
- **Remaining routing fixes** live in a new lexicon source `knowledge/src/lexicon-part-e.json` (9 intents), registered in `build.mjs`: Gmail agent connection, Gmail scopes/verification, MCP authorization, conversational multi-agent (AutoGen), attention alternatives (state-space models), planner/worker agents, cross-vendor agents, email-agent permissions, production agent framework. `search-core.mjs` and `search.js` are unchanged.
- **Important disclosure:** the committed `search-lexicon.json` was **stale against its own source parts** (31 intents from `lexicon-part-d.json` were never merged into it). Rebuilding merges them. Effect on the 1,607 frozen queries versus the base commit: 10 answers change, **10 are fixes and 0 are breaks**; no non-page query became newly solid; the AI-V3 query report moves from pass 293 / weak 25 / miss 10 to **pass 320 / weak 8 / miss 0** (negatives 29 pass / 1 false positive, unchanged). `lexicon-part-d.generator.py` does **not** reproduce `lexicon-part-d.json` (it differs from line 57), so I edited neither; the ranking owner should decide which is canonical.
- **Gmail:** `how do I connect an AI agent to Gmail` now answers `gmail-for-ai-agents` (112 vs 58) instead of `ai-agent-vs-chatbot`. The accepted learn-more result is preserved: `How can an AI agent access Gmail?` still lists `gmail-api-scopes-and-verification` and `oauth-for-ai-agents` (asserted in tests; the earlier edit to `tests/knowledge-search.mjs` is unchanged).
- **MCP:** `mcp authorization`, `how does oauth work for mcp servers`, `oauth for mcp servers`, `how do I add OAuth to an MCP server`, `what is protected resource metadata` and `mcp token passthrough` all answer `mcp-authorization`. `how to secure an mcp server`, `is mcp safe to install`, `What is MCP?`, `mcp or a2a`, `What is OAuth?` keep their previous answers.
- **Versus the base commit on all 1,607 frozen queries:** top-1 regressions 0, top-3 regressions 0.
- **Tests:** new `tests/knowledge-search-regressions.mjs` (wired into `npm test` and `npm run test:ai-v3`) covers the 10 ranking cases, the Gmail answers and learn-more, Gmail scopes, MCP authorization, 8 neighbouring queries that must not change, and the redirect. Run against the pre-fix lexicon it fails 9 checks, so it detects the problems.

### 11.2 Legacy Hugging Face URL
- `knowledge/hugging-face-transformers.html` is now a generated redirect stub: meta refresh, canonical link to `hugging-face.html`, and a script redirect that preserves query string and hash. Static GitHub Pages has no server redirects, so this is the strongest available option; it is not an HTTP 301, and search engines treat meta refresh + canonical as a soft permanent redirect.
- It is declared in `REDIRECTS` in `knowledge/src/build.mjs`, which validates that the target exists and that the source is not a real page. **Survival proven:** deleting the file and rebuilding regenerates it. It is excluded from the sitemap and search index.
- The old page content (an earlier "Transformers and the Hub" article) is no longer served at that URL.

### 11.3 Verification
- **EU AI Act:** consolidated Regulation (EU) 2024/1689 as of 2026-07-27 (EUR-Lex document 02024R1689-20260727) read: general application 2 Aug 2026; Chapter V (GPAI) and other listed chapters from 2 Aug 2025 (except Article 101); Annex III high-risk 2 Dec 2027; Annex I 2 Aug 2028; Articles 102-110 from 27 Jul 2026; new Article 5(1) (ba)/(bb) and 1a/1b from 2 Dec 2026. The page now states these. **Still unverified:** the Article 50(2) transitional period to 2 Dec 2026 (secondary commentary only; Article 50 text not read), Commission guidance, national measures.
- **MCP Authorization** and **Gmail API Scopes** pages: re-read in the previous pass; no new differences found. Open: MCP discovery and scope-selection sub-pages not read; Gmail verification fees/thresholds/unverified-app rules not read; add-on scopes unclassified.
- **OpenAI / Sora (rechecked at the end of this pass):** o1, o1-pro, o3-mini, o4-mini 23 Oct 2026; o3, o3-pro 11 Dec 2026; Videos API and sora-2 models 24 Sep 2026; no row is marked as shut down. OpenAI's Sora help article still uses future tense and has no shutdown notice (its cache may be stale). **Sora API outcome remains unconfirmed.**
- External source URLs: curl from the sandbox is blocked (000/403), so link reachability could not be tested that way; pages for the key sources were retrieved through a scraping tool during verification. A final reachability sweep from a normal network is still owed.

### 11.4 QA (final state)
| Check | Result |
|---|---|
| `npm test` | exit 0 |
| `tests/knowledge-ambiguity-gate.mjs` | 18/18 |
| 1,607 frozen queries, lexical, base commit vs now | 10 answer changes, 10 fixes, 0 breaks; 0 top-1 and 0 top-3 regressions |
| Rebuilt `semantic-index.json` (270 pages, 3,346 units, `pageIds` equal to the search index) | limited-mode check on 1,607 queries: 0 violations for solid/answer/tools/gap/need/learn; top-1/3/5 lexical 494/662/728, hybrid 656/835/894 |
| Internal links | 273 HTML files, 6,713 relative links, 0 broken |
| Browser (headless Chromium, 375px and 1280px) | 0 of 273 pages overflow at 375px; 0 console errors; 8 search queries return the expected guide; offline search works; legacy Hugging Face URL lands on `hugging-face.html` with query and hash kept |
| Staging URL | **not available** (none is configured or documented; production returns 404 for the new pages, as expected before release). Not tested |

### 11.5 Outstanding before production
**Independent approvals still outstanding (none recorded):** (1) legal/regulatory reviewer for `eu-ai-act`; (2) security reviewer for `mcp-authorization`; (3) privacy/platform-policy reviewer for `gmail-api-scopes-and-verification`; (4) owner decision on the search-lexicon change (lexicon was stale; part-d generator not canonical) and the redirect approach; (5) release-day recheck of the OpenAI 23 Oct shutdowns and the Sora API; (6) staging deployment and browser QA on the deployed URL, including real mobile devices and Safari/Firefox; (7) external-link reachability sweep.

**Staging readiness: ready.** Tests, gate, link, semantic and browser checks are green on the branch. **Production readiness: not yet**; it depends on the approvals above.

## 12. Final production-readiness QA (staging `intellitools-knowledge-v3-release.onrender.com`, deployed commit `1fd211d`)

How it was tested: the sandbox's egress policy blocks `onrender.com` for direct requests, so the deployed site was exercised through a hosted rendering browser (Chromium-based) and its page, screenshot and raw-file endpoints. Direct Safari and Firefox testing was not possible (only Chromium exists in the sandbox). Details, screenshots and the specialist-reviewer checklists are on the evidence branch `qa/knowledge-v3-evidence`.

**Defect found and fixed on this branch:** the "Primary sources consulted" lists on the 16 pages with source-check blocks printed source URLs as plain text, so external source links were not clickable. They now render as links with `rel="noopener noreferrer"`; a test asserts it for every checked source. Also updated: the o3/o4-mini (16 Apr 2025) and o1-preview (12 Sep 2024) announcement dates are now confirmed from OpenAI's pages and removed from the unverified list.

**Findings that are not code defects (documented, not fixed):** (1) Offline: only the tools home registers the service worker (`sw.js`); Knowledge pages never register it and are not precached. After visiting the tools home, previously visited Knowledge pages and search work offline, but an unvisited Knowledge article falls back to the tools home page. (2) The root `sitemap.xml` has no Knowledge URLs; `sitemap-fragment.xml` is not wired in (the build says so). (3) The tools home page does not link to `/knowledge/`; Knowledge is reachable by URL only. (4) Learn-more for `is gmail.readonly a restricted scope` includes three generic pages (large-language-models, tokens, context-windows). (5) Chromium's offline emulation does not block service-worker requests, so offline was verified by stopping the local server instead.

**Staging builds on later commits:** staging serves `1fd211d`; the fixes above are on a later commit and need a redeploy plus a staging smoke re-run.

## 13. Production information-architecture integration (owner-approved decisions, no new content)

- **Homepage:** `index.html` now links to `knowledge/` from the header navigation (visible above 900px) and from the footer "Product" column (visible at every width, because the header nav is hidden on small screens by the existing CSS). No other homepage markup, tools or links changed.
- **Root sitemap:** `knowledge/src/build.mjs` now writes one generated block (`knowledge:start` / `knowledge:end` comments) into `sitemap.xml` on every build: Knowledge index, glossary and all 270 articles (272 URLs). It replaces the previous block, so rebuilding is idempotent (verified by hashing across repeated builds). Redirect stubs are never listed. All 14 existing sitemap entries are unchanged. `sitemap-fragment.xml` is still generated with the same URLs.
- **Offline:** documented in `knowledge/README.md` as a limitation, not a feature (service worker registered only by the tools home page, no Knowledge precache, unvisited articles fall back to the home page). A test fails if the Knowledge home page advertises offline support.
- **Redirect:** the owner accepted the soft redirect. Documented in the README.
- **Lexicon:** the owner accepted the rebuilt `search-lexicon.json` (31 part-D intents recovered); `lexicon-part-d.json` is canonical for this release and the non-reproducible generator is tracked separately.
- **Tests:** new `tests/knowledge-integration.mjs` (homepage links, sitemap structure/URL set/duplicates/redirect exclusion/existing entries, offline documentation), wired into `npm test` and `npm run test:ai-v3`.
- **Results on this commit:** `npm test` exit 0; ambiguity 18/18; 1,607 frozen queries vs base: 10 fixes, 0 breaks, 0 top-1/top-3 regressions; semantic limited-mode check 0 violations; 273 Knowledge HTML files, 6,713 internal links, 0 broken, 0 overflow at 375px; homepage renders unchanged apart from the new link (desktop and 375px, no horizontal overflow, link followed to `/knowledge/`).
- **Observation:** the homepage logs one `ERR_TUNNEL_CONNECTION_FAILED` console error in the sandbox; that is an external request blocked by the sandbox proxy, not a Knowledge change.
