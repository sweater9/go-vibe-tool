// Verifies knowledge/tool-map.json against the real IntelliTools catalogue and routes, and proves that a bad mapping
// can never reach a visitor. No browser, no network.
import { readFileSync, existsSync } from "node:fs";
import { searchIntelligent, loadExtras } from "../knowledge/search-intelligence.mjs";
import { loadAssets } from "./lib/relevance-harness.mjs";

const root = new URL("../", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), "utf8");
const readJson = (rel) => JSON.parse(read(rel));
const failures = [];
const need = (ok, msg) => { if (!ok) failures.push(msg); };

// 1. the real catalogue: [id, category, name, description] rows in tools.js, v2-tools.js and v21-tools.js
const catalogue = new Map();
for (const file of ["tools.js", "v2-tools.js", "v21-tools.js"]) {
  const re = /\[\s*"([a-z0-9-]+)"\s*,\s*"([^"]+)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*\]/g;
  let m;
  while ((m = re.exec(read(file)))) catalogue.set(m[1], { id: m[1], category: m[2], name: m[3] });
}
need(catalogue.size >= 60, "catalogue extraction found only " + catalogue.size + " tools");
const router = read("index.html");
need(/get\("tool"\)/.test(router) && /openTool/.test(router), "index.html no longer routes ?tool=<id>");

// 2. every mapped tool exists, is not a Compliance tool, has the catalogue name, and a route that resolves
const map = readJson("knowledge/tool-map.json");
const lexicon = readJson("knowledge/search-lexicon.json");
const seen = new Set();
for (const tool of map.tools) {
  need(!seen.has(tool.id), "duplicate tool id " + tool.id);
  seen.add(tool.id);
  const real = catalogue.get(tool.id);
  need(Boolean(real), tool.id + " is not in the tool catalogue");
  if (!real) continue;
  need(real.category !== "Compliance & AML", tool.id + " is a Compliance tool and must not be recommended from Knowledge");
  need(real.name === tool.catalogueName, tool.id + ": catalogueName '" + tool.catalogueName + "' differs from catalogue '" + real.name + "'");
  const query = /[?&]tool=([a-z0-9-]+)/.exec(tool.url);
  if (query) need(query[1] === tool.id, tool.id + ": url routes to " + query[1]);
  else need(/^tools\/[a-z0-9-]+\.html$/.test(tool.url) && existsSync(new URL(tool.url, root)), tool.id + ": landing page " + tool.url + " does not exist");
  if (!query && existsSync(new URL(tool.url, root))) need(read(tool.url).includes("?tool=" + tool.id) || read(tool.url).includes("tool=" + tool.id), tool.id + ": landing page does not open the tool " + tool.id);
  need(Boolean(tool.reason) && tool.reason.length > 30, tool.id + " needs a reason that says why it helps");
  need(/\bnot\b|does not|doesn't|never/i.test(tool.reason), tool.id + ": reason should state a limit (what it does not do)");
  need(!(tool.topics || []).length || Boolean(tool.topicWhy), tool.id + ": topics need a topicWhy");
  need((tool.phrases || []).length + (tool.intents || []).length > 0, tool.id + " has no way to be triggered");
}
const { index } = loadAssets();
const pageIds = new Set(index.pages.map((p) => p.id));
for (const tool of map.tools) for (const t of tool.topics || []) need(pageIds.has(t), tool.id + ": topic " + t + " is not a Knowledge guide");

// 3. the original six lexicon tools keep their phrases and URLs (existing behaviour is preserved)
for (const old of lexicon.tools) {
  const mapped = map.tools.find((t) => t.id === old.id);
  need(Boolean(mapped), "lexicon tool " + old.id + " missing from tool-map.json");
  if (!mapped) continue;
  need(mapped.url === old.url, old.id + ": url changed from " + old.url + " to " + mapped.url);
  for (const phrase of old.when || []) need((mapped.phrases || []).includes(phrase), old.id + ": lexicon phrase '" + phrase + "' dropped");
}

// 4. bad data never reaches a visitor: unknown ids, wrong names, and malformed entries are dropped, search still works
const readKnowledge = (rel) => readJson("knowledge/" + rel);
const extras = loadExtras(readKnowledge);
const hostile = structuredClone(extras);
hostile.toolMap.tools.push(
  { id: "no-such-tool", name: "Ghost", url: "index.html?tool=no-such-tool", reason: "x", phrases: ["ghost phrase here"], intents: [] },
  { id: "kyc-remediation", name: "KYC", catalogueName: "KYC", url: "index.html?tool=kyc-remediation", reason: "x", phrases: ["kyc phrase here"], intents: [] },
  { id: 7, phrases: null },
  null
);
hostile.toolMap.tools.find((t) => t.id === "base64").url = "index.html?tool=not-base64";
hostile.toolMapOptions = { catalogue: Object.fromEntries(catalogue) };
let crashed = null;
let ghost;
let kyc;
let b64;
try {
  ghost = searchIntelligent(index, lexicon, "ghost phrase here", hostile);
  kyc = searchIntelligent(index, lexicon, "kyc phrase here", hostile);
  b64 = searchIntelligent(index, lexicon, "decode base64", hostile);
} catch (error) { crashed = error; }
need(!crashed, "malformed tool-map data crashed search: " + (crashed && crashed.message));
if (!crashed) {
  need(!ghost.tools.some((t) => t.id === "no-such-tool"), "an unknown tool id was recommended");
  need(!kyc.tools.some((t) => t.id === "kyc-remediation"), "a Compliance tool was recommended");
  need(!b64.tools.some((t) => t.id === "base64"), "a tool whose route does not match its id was recommended");
}
// and with the tool map missing entirely, Knowledge answers still work and nothing is recommended
const noMap = { ...extras, toolMap: null };
const plain = searchIntelligent(index, lexicon, "what is rag", noMap);
need(plain.solid && plain.answer.page.id === "rag" && plain.tools.length === 0, "search must work without tool-map.json");

// 5. brief examples map to the right tool, and a tool never replaces a Knowledge answer
const EXPECT = [
  ["design a multi-agent workflow with roles and handoffs", "agentic-workflow-generator"],
  ["how do i write a better prompt", "ai-prompt-builder"],
  ["remove personal data from text before pasting into chatgpt", "pii-secret-redactor"],
  ["compress an image", "image-studio"],
  ["merge two pdf files", "pdf-studio"],
  ["decode a jwt", "oauth-jwt-decoder"],
  ["compare two env files", "env-diff"]
];
for (const [q, id] of EXPECT) {
  const r = searchIntelligent(index, lexicon, q, extras);
  need(r.tools.some((t) => t.id === id), "'" + q + "' should recommend " + id + " (got " + r.tools.map((t) => t.id).join(",") + ")");
}
for (const q of ["what is rag", "what is prompt engineering", "what is an ai agent", "agentic workflows vs ai agents", "what is json"]) {
  const r = searchIntelligent(index, lexicon, q, extras);
  need(r.tools.length === 0, "'" + q + "' is a definition or comparison and must not recommend " + r.tools.map((t) => t.id).join(","));
}
const withBoth = searchIntelligent(index, lexicon, "how do i write better prompts", extras);
need(withBoth.solid && withBoth.tools.length > 0, "a how-to with a matching tool should show the guide and the tool");
need(withBoth.tools.every((t) => t.reason && t.name && t.url), "every recommendation carries a name, reason and url");
const keywordOnly = searchIntelligent(index, lexicon, "image classification models", extras);
need(!keywordOnly.tools.some((t) => t.id === "image-studio"), "'image' alone must not trigger Image Studio");
const pdfOnly = searchIntelligent(index, lexicon, "pdf", extras);
need(!pdfOnly.tools.some((t) => t.id === "pdf-studio"), "a bare keyword must not trigger PDF tools");

if (failures.length) { console.error("TOOL MAP FAILURES (" + failures.length + "):\n" + failures.map((f) => "- " + f).join("\n")); process.exit(1); }
console.log("tool map checks passed: " + map.tools.length + " tools verified against " + catalogue.size + " catalogue entries");
