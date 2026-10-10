// Independent ambiguity regression gate. Run with: node tests/knowledge-ambiguity-gate.mjs
// Deliberately not added to npm test until known baseline failures are resolved.
import { readFileSync } from "node:fs";
import { searchKnowledge } from "../knowledge/search-core.mjs";
const index = JSON.parse(readFileSync(new URL("../knowledge/search-index.json", import.meta.url), "utf8"));
const lexicon = JSON.parse(readFileSync(new URL("../knowledge/search-lexicon.json", import.meta.url), "utf8"));
const cases = [
  ["toy transformer robot for kids birthday", false],
  ["transformer toy", false],
  ["can my python pet eat mice", false],
  ["docker is a clothing brand right", false],
  ["react to this message politely", false],
  ["how do I remove rust from a bicycle chain", false],
  ["java coffee beans for espresso", false],
  ["mamba snake habitat", false],
  ["arcade token collection", false],
  ["Rust ownership and borrowing", true],
  ["Java Spring API", true],
  ["Mamba state space model", true],
  ["LLM token limits", true],
  ["how to build an SPFx web part", true],
  ["What is the SharePoint Framework?", true],
  ["what is model context protocol", true],
  ["how to build RAG with Python", true],
  ["how do I connect an AI agent to Gmail", true],
];
let failures = 0;
for (const [query, expectedSolid] of cases) {
  const result = searchKnowledge(index, lexicon, query);
  const pass = Boolean(result.solid) === expectedSolid;
  console.log(JSON.stringify({ pass, query, expectedSolid, actualSolid: Boolean(result.solid), answer: result.answer?.page?.id ?? null }));
  if (!pass) failures++;
}
console.log(`Ambiguity gate: ${cases.length - failures}/${cases.length} passed`);
if (failures) process.exitCode = 1;
