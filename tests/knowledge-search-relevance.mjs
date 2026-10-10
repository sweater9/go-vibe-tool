// Knowledge search relevance: before/after evidence and regression protection. No browser, no network.
//
//   node tests/knowledge-search-relevance.mjs                    run the checks, rewrite the report
//   node tests/knowledge-search-relevance.mjs --freeze-baseline  re-record the unmodified engine (do this only on purpose)
//
// "Before" is the unmodified lexical engine (knowledge/search-core.mjs). "After" is searchIntelligent over the same
// index and lexicon. The dataset is tests/data/search-relevance-dataset.json (methodology is in its header).
import { readFileSync, writeFileSync } from "node:fs";
import { searchKnowledge } from "../knowledge/search-core.mjs";
import { loadDataset, loadAssets, runDataset, summarize, normalizeResult, percentile } from "./lib/relevance-harness.mjs";

const BASELINE_URL = new URL("./data/search-relevance-baseline.json", import.meta.url);
const REPORT_URL = new URL("../knowledge/SEARCH-INTELLIGENCE-REPORT.md", import.meta.url);
const dataset = loadDataset();
const { index, lexicon } = loadAssets();
const entries = dataset.queries;

const baselineRows = runDataset(entries, (q) => searchKnowledge(index, lexicon, q));
const baselineSummary = summarize(baselineRows);

if (process.argv.includes("--freeze-baseline")) {
  const frozen = {
    version: 1,
    engine: "knowledge/search-core.mjs, unmodified, over the committed search-index.json and search-lexicon.json",
    queries: entries.length,
    summary: { ...baselineSummary, categories: undefined },
    results: Object.fromEntries(baselineRows.map((r) => [r.entry.q, { pass: r.pass, answer: r.res.answerId, solid: r.res.solid, tools: r.res.tools, failures: r.failures }]))
  };
  writeFileSync(BASELINE_URL, JSON.stringify(frozen, null, 1) + "\n");
  console.log("baseline frozen:", entries.length, "queries,", baselineSummary.pass, "pass");
  process.exit(0);
}

const frozen = JSON.parse(readFileSync(BASELINE_URL, "utf8"));
const failures = [];
const need = (ok, msg) => { if (!ok) failures.push(msg); };

need(frozen.queries === entries.length, "baseline is stale: re-freeze after changing the dataset (" + frozen.queries + " vs " + entries.length + ")");
const drift = baselineRows.filter((r) => frozen.results[r.entry.q] && frozen.results[r.entry.q].pass !== r.pass).map((r) => r.entry.q);
need(drift.length === 0, "the unmodified engine no longer matches the frozen baseline for: " + drift.slice(0, 5).join(" | "));

const { searchIntelligent, loadExtras } = await import("../knowledge/search-intelligence.mjs");
const extras = loadExtras((rel) => JSON.parse(readFileSync(new URL("../knowledge/" + rel, import.meta.url), "utf8")));
const afterRows = runDataset(entries, (q) => searchIntelligent(index, lexicon, q, extras));
const after = summarize(afterRows);

// 1. Nothing that worked before may break.
const protectedRows = afterRows.filter((r) => frozen.results[r.entry.q]?.pass);
const regressed = protectedRows.filter((r) => !r.pass);
need(regressed.length === 0, "regressions on previously passing queries: " + regressed.map((r) => r.entry.q + " [" + r.failures.join("; ") + "]").join(" || "));

// 2. Confident answers must not get less trustworthy, and tool recommendations must not add false positives.
need(after.wrongConfident <= baselineSummary.wrongConfident, "wrong confident answers rose from " + baselineSummary.wrongConfident + " to " + after.wrongConfident);
need(after.toolFalsePositives === 0, "unexpected tool recommendations: " + after.toolFalsePositives);

// 3. Measured improvement floors. These are set from the first accepted run and ratchet upward only deliberately.
const FLOORS = { passRate: 93, confidentAccuracy: 93, weakCorrect: 97, toolRecall: 95 };
for (const [key, floor] of Object.entries(FLOORS)) need(after[key] >= floor, key + " " + after[key] + " is below the floor " + floor);
need(after.passRate > baselineSummary.passRate + 10, "overall pass rate must beat the baseline by more than 10 points");

// 4. Rewrites are transparent: typo/abbreviation queries must say what was rewritten.
for (const r of afterRows.filter((row) => row.entry.rw === "typo" || row.entry.rw === "abbreviation")) {
  if (!r.pass) continue;
  need(r.res.rewrite === r.entry.rw || r.res.rewrite === "typo+abbreviation", "rewrite not reported for " + r.entry.q + " (got " + r.res.rewrite + ")");
}

// 5. Latency over the whole dataset (single process, warm). Generous ceilings; real numbers are in the report.
const timings = [];
for (const entry of entries) {
  const t0 = performance.now();
  searchIntelligent(index, lexicon, entry.q, extras);
  timings.push(performance.now() - t0);
}
const baseTimings = [];
for (const entry of entries) {
  const t0 = performance.now();
  searchKnowledge(index, lexicon, entry.q);
  baseTimings.push(performance.now() - t0);
}
const latency = { p50: percentile(timings, 50), p95: percentile(timings, 95), max: Math.max(...timings), baseP50: percentile(baseTimings, 50), baseP95: percentile(baseTimings, 95) };
need(latency.p95 < 50, "p95 query latency " + latency.p95.toFixed(1) + " ms exceeds 50 ms");

// ---- report ---------------------------------------------------------------------------------------------------------
const f1 = (n) => (n === null ? "n/a" : String(n));
const delta = (a, b) => (a === null || b === null ? "" : (b - a >= 0 ? "+" : "") + (Math.round((b - a) * 10) / 10));
const lines = [];
lines.push("# Knowledge search intelligence: relevance report");
lines.push("");
lines.push("Run: `node tests/knowledge-search-relevance.mjs`. Dataset: `tests/data/search-relevance-dataset.json` (" + entries.length + " queries; methodology is in the file header).");
lines.push("");
lines.push("**Before** is the unmodified lexical engine (`knowledge/search-core.mjs`). **After** is `searchIntelligent` over the same committed index and lexicon. The solid-match threshold (`minSolidScore`) was not changed. Semantic search stays opt-in and was not used for these numbers.");
lines.push("");
lines.push("## Headline");
lines.push("");
lines.push("| Metric | Before | After | Change |");
lines.push("| --- | --- | --- | --- |");
const metric = (label, key, unit = "") => lines.push("| " + label + " | " + f1(baselineSummary[key]) + unit + " | " + f1(after[key]) + unit + " | " + delta(baselineSummary[key], after[key]) + unit + " |");
metric("Queries passing every check", "passRate", "%");
metric("Confident answers that are correct (" + after.confidentTotal + " queries)", "confidentAccuracy", "%");
metric("Out-of-scope / ambiguous queries kept weak (" + after.weakTotal + " queries)", "weakCorrect", "%");
metric("Wrong confident answers (count, lower is better)", "wrongConfident");
metric("Tool recommendation recall (" + after.toolCases + " queries)", "toolRecall", "%");
metric("Unexpected tool recommendations (count)", "toolFalsePositives");
metric("Mean reciprocal rank of the first right guide", "mrr");
lines.push("");
lines.push("Protected queries (passed before): " + protectedRows.length + ". Regressions among them: " + regressed.length + ".");
lines.push("");
lines.push("## By category");
lines.push("");
lines.push("| Category | Queries | Before pass | After pass |");
lines.push("| --- | --- | --- | --- |");
for (const [category, value] of Object.entries(after.categories)) {
  lines.push("| " + category + " | " + value.total + " | " + baselineSummary.categories[category].pass + " | " + value.pass + " |");
}
lines.push("");
lines.push("## Latency (Node " + process.version + ", warm, single process, " + entries.length + " queries)");
lines.push("");
lines.push("| Engine | p50 | p95 |");
lines.push("| --- | --- | --- |");
lines.push("| Before (lexical core) | " + latency.baseP50.toFixed(2) + " ms | " + latency.baseP95.toFixed(2) + " ms |");
lines.push("| After (intelligence layer) | " + latency.p50.toFixed(2) + " ms | " + latency.p95.toFixed(2) + " ms |");
lines.push("");
lines.push("## Queries fixed");
lines.push("");
const fixed = afterRows.filter((r) => r.pass && !frozen.results[r.entry.q]?.pass);
for (const r of fixed) lines.push("- " + r.entry.q + " → " + (r.res.answerId || "closest pages") + (r.res.tools.length ? " (tools: " + r.res.tools.join(", ") + ")" : "") + (frozen.results[r.entry.q]?.failures?.[0] ? " — was: " + frozen.results[r.entry.q].failures[0] : ""));
lines.push("");
lines.push("## Still failing");
lines.push("");
const still = afterRows.filter((r) => !r.pass);
if (!still.length) lines.push("None.");
for (const r of still) lines.push("- [" + r.entry.c + "] " + r.entry.q + " — " + r.failures.join("; "));
lines.push("");
lines.push("## Checks");
lines.push("");
lines.push(failures.length ? "Failures:\n" + failures.map((f) => "- " + f).join("\n") : "All checks passed: no regressions among protected queries, no rise in wrong confident answers, no unexpected tool recommendations, improvement floors met.");
lines.push("");

const report = lines.join("\n");
writeFileSync(REPORT_URL, report);
console.log(report);
if (failures.length) { console.error("\nFAILURES (" + failures.length + "):\n" + failures.join("\n")); process.exit(1); }
console.log("search relevance checks passed");
