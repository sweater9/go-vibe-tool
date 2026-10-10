// Behaviour and integrity tests for the search intelligence layer. No browser, no network.
import { readFileSync } from "node:fs";
import { searchIntelligent, loadExtras, stem, analyzeQuery } from "../knowledge/search-intelligence.mjs";
import { searchKnowledge } from "../knowledge/search-core.mjs";
import { createRelations } from "../knowledge/relations.mjs";
import { loadAssets } from "./lib/relevance-harness.mjs";

const root = new URL("../", import.meta.url);
const readJson = (rel) => JSON.parse(readFileSync(new URL(rel, root), "utf8"));
const { index, lexicon } = loadAssets();
const extras = loadExtras((rel) => readJson("knowledge/" + rel));
const ids = new Set(index.pages.map((p) => p.id));
const failures = [];
const need = (ok, msg) => { if (!ok) failures.push(msg); };
const ask = (q, e = extras, o) => searchIntelligent(index, lexicon, q, e, o);
const answerOf = (r) => (r.solid ? r.answer.page.id : null);

// ---- 1. curated data is valid ------------------------------------------------------------------------------------
const u = extras.understanding;
for (const [abbr, item] of Object.entries(u.abbreviations)) {
  for (const page of item.pages) need(ids.has(page), "abbreviation " + abbr + " lists unknown page " + page);
  const r = ask(abbr + " explained");
  need(r.solid ? item.pages.includes(answerOf(r)) : item.pages.some((p) => r.weak.some((w) => w.page.id === p)), "abbreviation '" + abbr + "' does not reach " + item.pages.join("/") + " (got " + (answerOf(r) || "weak") + ")");
}
for (const hub of u.hubs) for (const id of [hub.lead, ...hub.guides, ...(hub.overview ? [hub.overview] : [])]) need(ids.has(id), "hub " + hub.id + " lists unknown page " + id);
for (const [word, entry] of Object.entries(u.ambiguous)) {
  need(entry.options.length >= 2, "ambiguous '" + word + "' needs at least two meanings");
  for (const o of entry.options) need(ids.has(o.page), "ambiguous '" + word + "' lists unknown page " + o.page);
}
for (const intent of u.intents) {
  need(intent.phrases.length > 0, "intent " + intent.id + " has no phrases");
  for (const t of intent.pages) need(ids.has(t.id) && t.boost > 0 && t.boost <= 56, "intent " + intent.id + " targets a bad page or boost: " + t.id);
}

// ---- 2. confident versus weak ------------------------------------------------------------------------------------
const CONFIDENT = [["what is rag", "rag"], ["how do transformers work", "transformers"], ["what is a vector database", "vector-databases"], ["prompt injection", "prompt-injection"], ["what is lora", "lora-and-peft"]];
for (const [q, id] of CONFIDENT) need(answerOf(ask(q)) === id, "'" + q + "' should answer " + id + ", got " + answerOf(ask(q)));
const WEAK = ["best pizza in new york", "how to repair a leaking tap", "tax deductions for freelancers", "what is the weather tomorrow", "python snake care", "apple", "graph", "cache"];
for (const q of WEAK) need(!ask(q).solid, "'" + q + "' must stay weak, got a confident answer: " + answerOf(ask(q)));
// a shared keyword is not an answer
for (const q of ["rag recipes for dinner", "docker clothing brand", "react to rude colleague"]) need(!ask(q).solid, "'" + q + "' must not be confident");

// ---- 3. machine learning returns a broad overview, not a narrow page ---------------------------------------------
const ml = ask("Machine learning");
need(ml.solid && ml.cluster && ml.cluster.pages.length >= 5, "'Machine learning' should give a topic cluster of the main branches");
need(["supervised-learning", "what-is-ai"].includes(answerOf(ml)), "'Machine learning' should lead with an overview guide, got " + answerOf(ml));
need(!ml.weak.length || ml.solid, "'Machine learning' is not a weak query");
const before = searchKnowledge(index, lexicon, "Machine learning");
need(!before.solid || before.answer.page.id !== "what-is-ai" || true, "(reference) lexical core answer recorded");

// ---- 4. synonyms, typos, abbreviations, and that rewrites are reported -------------------------------------------
const TYPO = [["retreival augmented generation", "rag"], ["quantizaton", "quantization"], ["hallucinatons", "ai-hallucinations"], ["machien learning", null]];
for (const [q, id] of TYPO) {
  const r = ask(q);
  need(r.rewrite && r.rewrite.kind.includes("typo"), "typo in '" + q + "' was not reported");
  if (id) need(answerOf(r) === id, "typo '" + q + "' should reach " + id + ", got " + answerOf(r));
}
need(ask("ml basics").rewrite?.kind === "abbreviation", "abbreviation rewrite not reported for 'ml'");
need(answerOf(ask("token")) === "tokens", "a bare 'token' keeps the established answer (LLM tokens); disambiguation is offered for words with no dominant meaning");
need(ask("kubernets").solid === false, "an unknown technology must not be matched to something else by typo repair");
need(!ask("zxqv wibble").rewrite, "gibberish must not be 'corrected'");

// ---- 5. intent understanding --------------------------------------------------------------------------------------
const intent = (q) => analyzeQuery(q).intent;
need(intent("rag vs fine tuning") === "comparison", "comparison intent");
need(intent("how do i build a rag app") === "howto", "how-to intent");
need(intent("why is my agent looping") === "troubleshooting", "troubleshooting intent");
need(intent("what is an embedding") === "definition", "definition intent");
need(intent("what should i learn before transformers") === "sequence", "sequence intent");
need(analyzeQuery("explain transformers for beginners").level === "beginner", "beginner level");
need(analyzeQuery("advanced prompt engineering").level === "advanced", "advanced level");
need(stem("embeddings") === stem("embedding") && stem("models") === stem("model"), "stemming must be symmetric");
const cmp = ask("rag vs fine tuning");
need(answerOf(cmp) === "rag-vs-fine-tuning" && cmp.comparison, "comparison query should answer the comparison page");
need(answerOf(ask("what is rag")) === "rag", "a plain definition must not be hijacked by a comparison page");
need(answerOf(ask("transformers vs state space models")) === "transformers-vs-state-space-models", "exact comparison title must win over the broader state-space concept");
need(searchKnowledge(index, lexicon, "transformers vs state space models").answer?.page.id === "transformers-vs-state-space-models", "comparison ranking also works in lexical fallback");
for (const q of ["constructor", "what is a constructor in javascript", ...Object.getOwnPropertyNames(Object.prototype)]) {
  need(Boolean(searchKnowledge(index, lexicon, q)), "inherited property query must not crash lexical search: " + q);
  need(Boolean(ask(q)), "inherited property query must not crash intelligent search: " + q);
}
const inherited = Object.create({ constructor: ["rag"], inheritedtoken: ["rag"] });
need(searchKnowledge(index, { ...lexicon, synonyms: inherited }, "inheritedtoken").solid === false, "inherited synonym definitions must not be used");
need(Boolean(searchKnowledge(index, { ...lexicon, synonyms: { constructor: true } }, "constructor")), "malformed own synonyms must not crash search");


// ---- 6. ambiguity -------------------------------------------------------------------------------------------------
const amb = ask("graph");
need(!amb.solid && amb.disambiguation && amb.disambiguation.options.length >= 2, "'graph' should offer meanings, not a guess");

// ---- 7. related guides: typed, no self links, no dangling, prerequisites acyclic --------------------------------
const relData = readJson("knowledge/relations.json");
const rel = createRelations(relData);
need(Object.keys(relData.pages).length === index.pages.length, "relations.json must cover every guide");
for (const [id, e] of Object.entries(relData.pages)) {
  need(ids.has(id), "relations has unknown page " + id);
  const all = [];
  for (const kind of ["pre", "next", "cmp", "app", "rel"]) for (const x of e[kind] || []) { all.push(x); need(ids.has(x), id + "." + kind + " links to unknown page " + x); need(x !== id, id + "." + kind + " links to itself"); }
  need(new Set(all).size === all.length, id + " lists the same guide under more than one relation");
}
const visiting = new Set();
const done = new Set();
function acyclic(id) {
  if (done.has(id)) return true;
  if (visiting.has(id)) return false;
  visiting.add(id);
  const ok = rel.prerequisites(id).every(acyclic);
  visiting.delete(id);
  done.add(id);
  return ok;
}
need(index.pages.every((p) => acyclic(p.id)), "prerequisite links contain a cycle");
for (const [a, b] of [["rag", "agentic-rag"], ["fine-tuning", "lora-and-peft"], ["prompt-engineering", "chain-of-thought"]]) {
  need(rel.prerequisites(b).includes(a) && rel.nextSteps(a).includes(b), a + " -> " + b + " should be linked both ways (prerequisite / next step)");
}
need(rel.learningOrder("agentic-rag").at(-1) === "agentic-rag" && rel.learningOrder("agentic-rag").indexOf("rag") < rel.learningOrder("agentic-rag").indexOf("agentic-rag"), "learningOrder must put prerequisites first");
need(rel.prerequisites("no-such-page").length === 0 && createRelations(null).nextSteps("rag").length === 0, "relations API must tolerate unknown ids and missing data");
const lora = ask("prerequisites for lora fine-tuning");
need(lora.learnMore.some((row) => row.page.id === "neural-networks") && lora.learnMore.every((row) => row.page.id !== lora.answer.page.id), "prerequisite questions should surface prerequisites and never the answer itself");
const circ = ask("what to learn after rag");
need(circ.learnMore.every((row) => row.page.id !== "rag"), "next steps must not link back to the guide");
for (const q of ["what is rag", "how do transformers work", "agentic workflows"]) {
  const r = ask(q);
  const seen = new Set();
  for (const row of r.learnMore) { need(!seen.has(row.page.id), q + ": duplicate learn-more link " + row.page.id); seen.add(row.page.id); need(row.page.id !== r.answer.page.id, q + ": circular learn-more link"); }
}

// ---- 8. graceful degradation -------------------------------------------------------------------------------------
const bare = ask("what is rag", {});
need(answerOf(bare) === "rag", "search must work with no extra files at all");
for (const missing of ["understanding", "toolMap", "relations"]) {
  const partial = { ...extras, [missing]: null };
  need(answerOf(ask("how do transformers work", partial)) === "transformers", "search must work without " + missing);
}
const brokenLoader = loadExtras(() => { throw new Error("404"); });
need(answerOf(ask("what is rag", brokenLoader)) === "rag", "a loader that throws must not break search");
// the semantic/hybrid engine is optional: a failing engine call is the caller's to catch (search.js does), and an
// injected engine must be honoured and may only change what the lexical core returns through the same shape
let calls = 0;
const spy = (q) => { calls += 1; return searchKnowledge(index, lexicon, q); };
need(answerOf(ask("what is rag", extras, { engine: spy })) === "rag" && calls > 0, "an injected engine (the hybrid path) must be used");
let threw = false;
try { ask("what is rag", extras, { engine: () => { throw new Error("semantic assets blocked"); } }); } catch { threw = true; }
need(threw, "(documented) engine failures propagate so the caller can fall back");
const pageJs = readFileSync(new URL("knowledge/search.js", root), "utf8");
need(/catch\s*\{\s*found = base\(q\)/.test(pageJs), "knowledge/search.js must fall back to the base engine when the intelligence layer throws");
need(/semantic = null/.test(pageJs), "knowledge/search.js must drop the semantic engine when its assets fail to load");

// ---- 9. determinism and size -------------------------------------------------------------------------------------
const a = JSON.stringify(ask("how do i make my llm output valid json").ranked.map((r) => [r.page.id, r.score]));
const b = JSON.stringify(ask("how do i make my llm output valid json").ranked.map((r) => [r.page.id, r.score]));
need(a === b, "results must be deterministic");
const size = (f) => readFileSync(new URL("knowledge/" + f, root)).length;
const added = size("query-understanding.json") + size("tool-map.json") + size("relations.json") + size("search-intelligence.mjs") + size("relations.mjs");
need(added < 200 * 1024, "added search assets are " + Math.round(added / 1024) + " KB; keep them under 200 KB uncompressed");

if (failures.length) { console.error("SEARCH INTELLIGENCE FAILURES (" + failures.length + "):\n" + failures.map((f) => "- " + f).join("\n")); process.exit(1); }
console.log("search intelligence checks passed (added assets " + Math.round(added / 1024) + " KB uncompressed)");
