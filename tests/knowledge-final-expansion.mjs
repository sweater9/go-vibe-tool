// Focused checks for the V3 final content expansion. No network, no browser.
// Covers: new pages exist and are indexed; source-check records are complete and honest; key verified facts are present;
// corrections to existing pages are in place; internal links and sitemap entries resolve; existing wording safeguards hold.
import { readFileSync, existsSync } from "node:fs";
import { searchKnowledge } from "../knowledge/search-core.mjs";

const K = (p) => new URL("../knowledge/" + p, import.meta.url);
const read = (p) => readFileSync(K(p), "utf8");
const json = (p) => JSON.parse(read(p));
const failures = [];
const need = (ok, msg) => { if (!ok) failures.push(msg); };
const text = (id) => read(id + ".html").replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ");

const NEW = [
  "microsoft-agent-framework", "migrate-to-microsoft-agent-framework", "mcp-authorization", "gmail-api-scopes-and-verification",
  "inspect-ai-evaluation-framework", "openai-reasoning-models", "sora-ai-video", "nvidia-cosmos", "attention-sinks", "flashattention-3"
];
// Existing entities that received a source-check block in this pass.
const UPDATED_CHECKED = ["a2a-protocol", "autogen", "semantic-kernel", "eu-ai-act", "nist-ai-rmf", "owasp-llm-top-10"];

const index = json("search-index.json");
const onto = json("ontology-v3.json");
const lexicon = json("search-lexicon.json");
const pageIds = new Set(index.pages.map((p) => p.id));
need(pageIds.size === index.pages.length, "duplicate page ids in search index");
const byId = new Map(onto.entities.map((e) => [e.id, e]));

// 1. New pages exist, are indexed with entity metadata, and carry a complete source-check record.
for (const id of NEW) {
  need(existsSync(K(id + ".html")), id + ": html missing");
  const p = index.pages.find((x) => x.id === id);
  need(p && p.entity && p.entity.verification_status === "key-claims-checked" && p.entity.checked_date === "2026-10-09", id + ": index entity metadata missing or not key-claims-checked");
  need(read("sitemap-fragment.xml").includes("/knowledge/" + id + ".html"), id + ": not in sitemap fragment");
}
for (const id of [...NEW, ...UPDATED_CHECKED]) {
  const e = byId.get(id);
  need(!!e, id + ": not in ontology");
  if (!e) continue;
  const v = e.verification;
  need(v.status === "key-claims-checked" && v.verified === false && v.verification_date === null, id + ": verification block must be key-claims-checked, verified:false, verification_date:null");
  const sc = v.source_check;
  need(sc && /^\d{4}-\d{2}-\d{2}$/.test(sc.date), id + ": source_check.date missing");
  need(sc && sc.claims_checked.length >= 1, id + ": no claims_checked");
  need(sc && sc.sources.length >= 1 && sc.sources.every((s) => /^https:\/\//.test(s.url) && s.title), id + ": source_check sources need title and https URL");
  need(sc && Array.isArray(sc.not_independently_verified) && sc.not_independently_verified.length >= 1, id + ": must list what could not be verified");
  need(e.canonical_sources.every((s) => s.verified === false), id + ": canonical_sources must stay unverified leads");
  // Every checked source must be a clickable external link that opens safely.
  const html = read(id + ".html");
  for (const s of sc ? sc.sources : []) need(html.includes('<a href="' + s.url + '" rel="noopener noreferrer">'), id + ": source not rendered as a link: " + s.url);
  const t = text(id);
  need(/key claims checked on 2026-10-09/.test(t) && /not independently verified/.test(t), id + ": page must state the check date and what is not verified");
  need(!/\bverified\b\s*:\s*true/i.test(read(id + ".html")), id + ": must not claim verified:true");
}
need(onto.entities.every((e) => e.verification.verified === false), "no ontology entity may be marked verified");

// 2. Key facts from primary sources are present (dates/values as read on 2026-10-09).
const has = (id, re, msg) => need(re.test(text(id)), id + ": " + msg);
has("microsoft-agent-framework", /maintenance mode/, "should mention AutoGen maintenance mode");
has("microsoft-agent-framework", /pip install agent-framework/, "should give the Python install name");
has("microsoft-agent-framework", /Microsoft\.Agents\.AI/, "should give the .NET package name");
has("migrate-to-microsoft-agent-framework", /AssistantAgent/, "should map AssistantAgent");
has("migrate-to-microsoft-agent-framework", /GraphFlow/, "should contrast GraphFlow with Workflow");
has("migrate-to-microsoft-agent-framework", /Semantic Kernel migration guide/, "should point to the Semantic Kernel guide");
has("migrate-to-microsoft-agent-framework", /could not be extracted|could not be read/, "must admit the Semantic Kernel guide was not read");
has("mcp-authorization", /RFC 9728/, "should cite RFC 9728");
has("mcp-authorization", /RFC 8707/, "should cite RFC 8707");
has("mcp-authorization", /stdio/i, "should say stdio servers use environment credentials");
has("mcp-authorization", /token passthrough/i, "should warn about token passthrough");
has("mcp-authorization", /2026-07-28/, "should name the specification revision");
has("gmail-api-scopes-and-verification", /gmail\.readonly/, "should name gmail.readonly");
has("gmail-api-scopes-and-verification", /restricted/i, "should state restricted class");
has("gmail-api-scopes-and-verification", /security assessment/i, "should mention the security assessment");
has("gmail-api-scopes-and-verification", /train, or improve a machine learning or artificial intelligence model/, "should quote the AI/ML training prohibition");
has("gmail-api-scopes-and-verification", /2026-09-03/, "should date the Workspace policy page");
has("inspect-ai-evaluation-framework", /UK AI Security Institute/, "should name the UK AI Security Institute");
has("inspect-ai-evaluation-framework", /MIT/, "should state the licence");
has("inspect-ai-evaluation-framework", /Generality Labs/, "should credit Inspect Evals maintenance correctly");
has("openai-reasoning-models", /reasoning tokens/i, "should explain reasoning tokens");
has("openai-reasoning-models", /not exposed/i, "should say raw reasoning is not exposed");
has("openai-reasoning-models", /2026-10-23/, "should give the o1/o3-mini/o4-mini shutdown date");
has("openai-reasoning-models", /2026-12-11/, "should give the o3/GPT-5 snapshot shutdown date");
has("sora-ai-video", /26 April 2026/, "should give the app discontinuation date");
has("sora-ai-video", /24 September 2026/, "should give the API shutdown date");
has("sora-ai-video", /Whether the API actually stopped working/, "must flag the unverified API shutdown outcome");
has("nvidia-cosmos", /Cosmos3-Super/, "should name model tiers");
has("nvidia-cosmos", /64B/, "should state the Super size");
has("nvidia-cosmos", /OpenMDW-1\.1/, "should state the licence");
has("attention-sinks", /2309\.17453/, "should cite the StreamingLLM paper");
has("attention-sinks", /22\.2/, "should state the reported speedup");
has("flashattention-3", /2407\.08608/, "should cite the FlashAttention-3 paper");
has("flashattention-3", /740 TFLOPs/, "should state the reported FP16 throughput");
has("flashattention-3", /flash-attn-4/, "should mention FlashAttention-4 only as README-level information");

// 3. Corrections to existing pages.
has("mcp", /2026-07-28/, "mcp page must describe the stateless revision");
has("mcp", /server\/discover/, "mcp page must mention server/discover");
has("mcp-servers-and-clients", /Mcp-Session-Id/, "lifecycle must note sessions were removed");
has("gmail-for-ai-agents", /restricted/i, "gmail page must say readonly is restricted");
has("gmail-for-ai-agents", /gmail-api-scopes-and-verification|Gmail API Scopes/, "gmail page must link to the scopes page");
need(!/prefer readonly while prototyping/i.test(text("gmail-for-ai-agents")), "gmail page still advises readonly as the easy default");
has("video-generation-models", /Sora/, "video page must mention Sora");
has("video-generation-models", /26 April 2026/, "video page must note the Sora discontinuation");
has("agent-frameworks-compared", /Microsoft Agent Framework/, "comparison table must include Microsoft Agent Framework");
has("nist-ai-rmf", /26 January 2023/, "NIST page must give the AI RMF 1.0 release date");
has("nist-ai-rmf", /being revised/, "NIST page must note the announced revision");
has("eu-ai-act", /2 December 2026/, "EU AI Act page must give the new prohibitions date");
has("owasp-llm-top-10", /early August 2026/, "OWASP page must not assert a single publication day");
for (const [from, to] of [["world-models", "nvidia-cosmos"], ["reasoning-models", "openai-reasoning-models"], ["flash-attention", "flashattention-3"], ["kv-cache", "attention-sinks"], ["agent-evaluation", "inspect-ai-evaluation-framework"], ["mcp", "mcp-authorization"], ["autogen", "microsoft-agent-framework"], ["semantic-kernel", "microsoft-agent-framework"]]) {
  need(read(from + ".html").includes('href="' + to + '.html"'), from + ": should link to " + to);
}

// 4. Every internal link on the new/updated pages resolves; no page links to itself only via fragments.
for (const id of [...NEW, ...UPDATED_CHECKED, "mcp", "mcp-servers-and-clients", "gmail-for-ai-agents", "oauth-for-ai-agents", "video-generation-models", "world-models"]) {
  const html = read(id + ".html");
  for (const m of html.matchAll(/href="([a-z0-9-]+)\.html(?:#[^"]*)?"/g)) {
    need(pageIds.has(m[1]) || existsSync(K(m[1] + ".html")), id + ": broken internal link " + m[1] + ".html");
  }
}

// 5. Wording safeguards on the new pages: no instruction to extract hidden reasoning; no named "current best" model claims.
for (const id of NEW) {
  const t = text(id);
  need(!/(extract|leak|dump|reveal)\s+(the\s+)?(hidden|private|raw)\s+(reasoning|chain)/i.test(t), id + ": must not instruct extracting hidden reasoning");
  need(!/\b(best|leading|state[- ]of[- ]the[- ]art)\s+(model|video|agent framework)\b/i.test(t), id + ": must not rank products as best/leading");
}
need(!/gpt-5\.6|gpt-6|gpt-5\.5/i.test(text("openai-reasoning-models").replace(/Current model names:[^.]*\./, "")), "openai page must not name current models whose naming is inconsistent across OpenAI docs");

// 6. Search smoke (read-only, tolerant: expected page within the top 3; no unexpected tool).
const smoke = [
  ["what is microsoft agent framework", "microsoft-agent-framework"],
  ["migrate from autogen to microsoft agent framework", "migrate-to-microsoft-agent-framework"],
  ["is sora still available", "sora-ai-video"],
  ["what is nvidia cosmos", "nvidia-cosmos"],
  ["what is an attention sink", "attention-sinks"],
  ["what is flashattention-3", "flashattention-3"],
  ["uk ai security institute inspect evaluation framework", "inspect-ai-evaluation-framework"],
  ["how does oauth work for mcp servers", "mcp-authorization"],
  ["is gmail.readonly a restricted scope", "gmail-api-scopes-and-verification"],
  ["what are openai reasoning tokens", "openai-reasoning-models"]
];
const rank = [];
for (const [q, id] of smoke) {
  const r = searchKnowledge(index, lexicon, q);
  const top = r.ranked.slice(0, 3).map((x) => x.page.id);
  rank.push(q + " -> " + top.join(", "));
  need(top.includes(id), "search: '" + q + "' should have " + id + " in the top 3, got " + top.join(", "));
  need(r.tools.length === 0, "search: '" + q + "' should not suggest a tool");
}

console.log("new pages:", NEW.length, "| existing pages with source-check blocks:", UPDATED_CHECKED.length, "| index pages:", index.pages.length);
console.log(rank.join("\n"));
if (failures.length) { console.error("FAILURES (" + failures.length + "):\n" + failures.slice(0, 60).join("\n")); process.exit(1); }
console.log("final expansion checks passed");
