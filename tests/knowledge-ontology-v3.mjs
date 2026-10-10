// Structural and policy checks for the V3 AI ontology. No network.
import { readFileSync, existsSync } from "node:fs";
const read = (p) => JSON.parse(readFileSync(new URL("../knowledge/" + p, import.meta.url), "utf8"));
const onto = read("ontology-v3.json");
const index = read("search-index.json");
const pageIds = new Set(index.pages.map((p) => p.id));
const failures = [];
const need = (ok, msg) => { if (!ok) failures.push(msg); };

const REQUIRED = ["id", "canonical_name", "entity_type", "domain", "plain_english_definition", "technical_definition", "aliases", "user_intents", "natural_language_questions", "prerequisites", "related_concepts", "contrasted_with", "technologies_frameworks", "implementation_patterns", "common_failure_modes", "troubleshooting", "practical_guide", "canonical_sources", "verification", "freshness_class", "time_sensitive_claims_to_verify", "intellitools_mappings"];
const ALLOWED_TOOLS = new Set(["ai-prompt-builder", "fact-anchor-checker", "pii-secret-redactor", "json-formatter"]);
const ids = new Set(onto.entities.map((e) => e.id));
need(ids.size === onto.entities.length, "duplicate entity ids");

for (const e of onto.entities) {
  const at = e.id + ": ";
  for (const k of REQUIRED) need(Object.prototype.hasOwnProperty.call(e, k), at + "missing field " + k);
  need(onto.entity_types.includes(e.entity_type), at + "bad entity_type");
  need(Object.keys(onto.freshness_classes).includes(e.freshness_class), at + "bad freshness_class");
  need(e.natural_language_questions.length >= 3, at + "fewer than 3 questions");
  need(e.user_intents.length >= 2, at + "fewer than 2 intents");
  need(e.canonical_sources.length >= 1, at + "no sources");
  for (const s of e.canonical_sources) need(s.verified === false, at + "source marked verified");
  need(e.verification.verified === false && e.verification.verification_date === null, at + "verification must be unverified/null-dated");
  if (e.freshness_class === "volatile") need(e.time_sensitive_claims_to_verify.length > 0, at + "volatile without time-sensitive claims");
  for (const r of [...e.prerequisites, ...e.related_concepts]) need(pageIds.has(r), at + "relation does not resolve: " + r);
  for (const c of e.contrasted_with) if (/^[a-z0-9-]+$/.test(c.ref)) need(pageIds.has(c.ref), at + "contrast ref does not resolve: " + c.ref);
  for (const m of e.intellitools_mappings) need(ALLOWED_TOOLS.has(m.tool_id), at + "unexpected tool mapping " + m.tool_id);
  if (e.page_kind !== "existing-page-overlay") {
    need(existsSync(new URL("../knowledge/" + e.id + ".html", import.meta.url)), at + "html page missing");
    need(index.pages.some((p) => p.id === e.id && p.entity && p.entity.entity_type === e.entity_type), at + "not in search index with entity metadata");
  }
}

// Modelling rules from the brief
const dpo = onto.entities.find((e) => e.id === "dpo");
need(dpo && dpo.parent === "preference-optimization", "DPO must have parent preference-optimization");
need(dpo && dpo.domain === "Safety, Alignment & Governance", "DPO must be under alignment, not RL");
need(!onto.entities.some((e) => e.domain === "ML, Deep Learning & RL" && /dpo|preference/i.test(e.id)), "preference methods must not be filed under the RL domain");
const rl = onto.entities.find((e) => e.id === "reinforcement-learning");
need(rl && /not ordinary reinforcement learning|preference optimization|preference optimisation/i.test(rl.technical_definition), "RL entity should state that DPO is preference optimisation");

// Hidden chain-of-thought policy: no entity may instruct readers to extract or reveal concealed reasoning.
const DISALLOWED = [/reveal (your|its|the model'?s) (hidden|private|internal|raw) (reasoning|chain)/i, /print (your|its) (hidden|private|internal) (reasoning|chain of thought)/i, /(extract|leak|dump) (the )?(hidden|private|raw) (reasoning|chain[- ]of[- ]thought)/i];
const blob = (e) => JSON.stringify(e);
for (const e of onto.entities) for (const re of DISALLOWED) need(!re.test(blob(e)), e.id + ": matches disallowed hidden-reasoning instruction pattern " + re);
const rt = onto.entities.find((e) => e.id === "reasoning-transparency");
need(rt && /not.*(extract|disclose)|do not try to extract|Don't build features that depend on seeing/i.test(blob(rt)), "reasoning-transparency must tell readers not to extract hidden reasoning");

// Counts for the report
const byType = {}; for (const e of onto.entities) byType[e.entity_type] = (byType[e.entity_type] || 0) + 1;
console.log("entities:", onto.entities.length, "| new pages:", onto.entities.filter((e) => e.page_kind !== "existing-page-overlay").length, "| overlays:", onto.entities.filter((e) => e.page_kind === "existing-page-overlay").length);
console.log("by type:", JSON.stringify(byType));
if (failures.length) { console.error("FAILURES (" + failures.length + "):\n" + failures.slice(0, 40).join("\n")); process.exit(1); }
console.log("ontology checks passed");
