// Knowledge search checks. No browser, no network. Uses the committed index and lexicon.
import { readFileSync, writeFileSync } from "node:fs";
import { searchKnowledge } from "../knowledge/search-core.mjs";

const index = JSON.parse(readFileSync(new URL("../knowledge/search-index.json", import.meta.url), "utf8"));
const lexicon = JSON.parse(readFileSync(new URL("../knowledge/search-lexicon.json", import.meta.url), "utf8"));

const cases = [
  { area: "AI fundamentals", q: "What is AI?", top: ["what-is-ai"], tool: null, label: "pass" },
  { area: "AI fundamentals", q: "What is machine learning versus AI?", top: ["what-is-ai"], tool: null, label: "pass" },
  { area: "AI fundamentals", q: "What is generative AI?", top: ["generative-ai"], tool: null, label: "pass" },
  { area: "LLMs", q: "What is an LLM?", top: ["large-language-models"], tool: null, label: "pass" },
  { area: "LLMs", q: "How do LLMs generate text?", top: ["large-language-models"], tool: null, label: "pass" },
  { area: "LLMs", q: "What is a token?", top: ["tokens"], tool: null, label: "pass" },
  { area: "LLMs", q: "What is a transformer and attention?", top: ["transformers"], tool: null, label: "pass" },
  { area: "prompting", q: "How do I write better prompts?", top: ["prompt-engineering"], tool: "ai-prompt-builder", label: "pass" },
  { area: "prompting", q: "What is a system prompt?", top: ["system-prompts"], tool: null, label: "pass" },
  { area: "prompting", q: "Why are my prompts giving bad answers?", top: ["common-prompting-mistakes"], tool: null, label: "pass" },
  { area: "hallucinations", q: "Why is my LLM hallucinating?", top: ["ai-hallucinations"], tool: null, label: "pass" },
  { area: "hallucinations", q: "How do I reduce hallucinations?", top: ["how-to-reduce-hallucinations"], tool: null, label: "pass" },
  { area: "hallucinations", q: "How do I check claims against the source text?", top: ["how-to-reduce-hallucinations", "ai-evaluation", "ai-hallucinations"], tool: "fact-anchor-checker", label: "pass" },
  { area: "RAG", q: "What is RAG?", top: ["rag"], tool: null, label: "pass" },
  { area: "RAG", q: "let AI answer questions from my documents", top: ["rag"], within: ["embeddings", "chunking", "vector-databases"], tool: null, label: "pass" },
  { area: "RAG", q: "How should I chunk documents for retrieval?", top: ["chunking"], tool: null, label: "pass" },
  { area: "embeddings", q: "What are embeddings?", top: ["embeddings"], tool: null, label: "pass" },
  { area: "embeddings", q: "What is cosine similarity?", top: ["embeddings"], tool: null, label: "pass" },
  { area: "vector databases", q: "When do I need a vector database?", top: ["vector-databases", "vector-database-vs-traditional-database"], tool: null, label: "pass" },
  { area: "vector databases", q: "vector database vs SQL", top: ["vector-database-vs-traditional-database"], tool: null, label: "pass" },
  { area: "vector databases", q: "What database should I use for embeddings?", top: ["embeddings", "vector-databases"], tool: null, label: "pass" },
  { area: "agents", q: "What are AI agents?", top: ["ai-agents"], tool: null, label: "pass" },
  { area: "agents", q: "What is the difference between an agent and a chatbot?", top: ["ai-agent-vs-chatbot"], tool: null, label: "pass" },
  { area: "agents", q: "How do agents call tools?", top: ["agent-tools", "function-calling"], tool: null, label: "pass" },
  { area: "agent memory", q: "How do I give an AI agent memory?", top: ["agent-memory"], tool: null, label: "pass" },
  { area: "agent memory", q: "AI keeps forgetting previous conversation", top: ["agent-memory"], within: ["context-windows", "ai-agents"], tool: null, label: "pass" },
  { area: "MCP", q: "What is MCP?", top: ["mcp"], tool: null, label: "pass" },
  { area: "MCP", q: "How is MCP different from an API?", top: ["mcp-vs-api"], tool: null, label: "pass" },
  { area: "function calling", q: "What is function calling?", top: ["function-calling"], tool: null, label: "pass" },
  { area: "function calling", q: "function calling vs MCP", top: ["function-calling-vs-mcp"], tool: null, label: "pass" },
  { area: "local AI", q: "How do I run an LLM locally?", top: ["local-ai"], tool: null, label: "pass" },
  { area: "local AI", q: "Should I run AI locally or in the cloud?", top: ["local-ai-vs-cloud-ai", "local-ai"], tool: null, label: "pass" },
  { area: "frameworks", q: "Which framework can I use for an AI agent?", top: ["choosing-an-agent-framework"], tool: null, label: "pass" },
  { area: "frameworks", q: "Should I use RAG or fine-tuning?", top: ["rag-vs-fine-tuning"], tool: null, label: "pass" },
  { area: "Python", q: "How do I build RAG with Python?", top: ["rag-with-python"], within: ["rag", "chunking"], tool: null, label: "pass" },
  { area: "JavaScript/TypeScript", q: "TypeScript types for an API client", top: ["typescript-api-client-types"], tool: null, label: "pass" },
  { area: "JavaScript/TypeScript", q: "React state for a chatbot", top: ["react-chatbot-state"], tool: null, label: "pass" },
  { area: "APIs", q: "Node.js streaming responses from an API", top: ["streaming-ai-with-nodejs"], tool: null, label: "pass" },
  { area: "databases", q: "How do I use PostgreSQL with my app?", top: ["postgresql-for-ai-apps"], tool: null, label: "pass" },
  { area: "AI security", q: "What is prompt injection?", top: ["prompt-injection"], tool: null, label: "pass" },
  { area: "AI security", q: "How do I stop a jailbreak?", top: ["prompt-injection"], tool: null, label: "pass" },
  { area: "AI security", q: "Is it safe to paste customer data into an AI tool?", top: ["ai-privacy-and-security"], tool: null, label: "pass" },
  { area: "AI security", q: "How do I redact secrets before pasting a prompt?", top: ["ai-privacy-and-security"], tool: "pii-secret-redactor", label: "pass" },
  { area: "task", q: "How can an AI agent access Gmail?", top: ["gmail-for-ai-agents"], within: ["gmail-api-scopes-and-verification", "oauth-for-ai-agents"], tool: null, label: "pass" },
  { area: "task", q: "How do I evaluate a RAG system?", top: ["ai-evaluation", "rag", "rag-evaluation"], tool: null, label: "pass" },
  { area: "task", q: "Design a multi-agent workflow with roles and handoffs", top: ["agentic-workflows"], tool: "agentic-workflow-generator", label: "pass" },
  { area: "task", q: "Compare two prompt versions", solid: false, tool: "prompt-diff", label: "weak", gapNote: "No guide about diffing prompts. Prompt Diff is the matching tool." },
  { area: "task", q: "How do I validate JSON?", top: ["json-validation"], tool: "json-formatter", label: "pass" },
  { area: "task", q: "Can I fine-tune instead of prompting?", top: ["rag-vs-fine-tuning", "fine-tuning"], tool: null, label: "pass" }
];

const rows = [];
const failures = [];
for (const item of cases) {
  const result = searchKnowledge(index, lexicon, item.q);
  const topId = result.answer?.page.id || result.ranked[0]?.page.id || "(none)";
  const topScore = result.answer?.score || result.ranked[0]?.score || 0;
  const ids = result.ranked.map((row) => row.page.id);
  const tool = result.tools[0]?.id || null;
  let ok = true;
  if (item.top && !item.top.includes(result.answer?.page.id)) ok = false;
  if (item.solid === false && result.solid) ok = false;
  if (item.solid !== false && item.top && !result.solid) ok = false;
  if (item.within && !item.within.every((id) => ids.slice(0, 6).includes(id) || result.learnMore.some((row) => row.page.id === id))) ok = false;
  if (item.tool !== undefined && tool !== item.tool) ok = false;
  if (item.gap && result.gap?.id !== item.gap) ok = false;
  if (!item.gap && item.label === "pass" && result.gap) ok = false;
  const label = ok ? item.label : "miss";
  if (!ok) failures.push(item.q);
  rows.push({ ...item, topId, topScore, tool, gap: result.gap?.id || "", solid: result.solid, label, learn: result.learnMore.map((row) => row.page.id) });
}

const lines = [];
lines.push("# Knowledge search test report");
lines.push("");
lines.push("Run: `node tests/knowledge-search.mjs`");
lines.push("");
lines.push("Judgements are against the guides that actually exist. A related page is not marked pass when the corpus does not answer the question. The solid-match threshold was not lowered to hide those gaps.");
lines.push("");
lines.push("Queries: " + rows.length);
lines.push("Pass: " + rows.filter((row) => row.label === "pass").length);
lines.push("Weak: " + rows.filter((row) => row.label === "weak").length);
lines.push("Miss: " + rows.filter((row) => row.label === "miss").length);
lines.push("");
lines.push("| Label | Area | Query | Top | Score | Tool | Gap |");
lines.push("| --- | --- | --- | --- | --- | --- | --- |");
for (const row of rows) {
  lines.push("| " + [row.label, row.area, row.q.replaceAll("|", "/"), row.topId, row.topScore, row.tool || "\u2014", row.gap || "\u2014"].join(" | ") + " |");
}
lines.push("");
lines.push("## Worked well");
for (const row of rows.filter((row) => row.label === "pass")) lines.push("- " + row.q + " \u2192 " + row.topId + (row.tool ? " (tool: " + row.tool + ")" : ""));
lines.push("");
lines.push("## Insufficient Knowledge coverage");
for (const row of rows.filter((row) => row.label !== "pass")) {
  lines.push("- " + row.q + " \u2014 " + (row.gapNote || "weak match") + " Top signal: " + row.topId + " (" + row.topScore + "). Tool: " + (row.tool || "none") + ".");
}
lines.push("");
lines.push("## Routing checks");
lines.push("These are the behaviour checks, not a lowered score cutoff. A failure exits non-zero.");
lines.push("");
if (failures.length) {
  lines.push("Failures:");
  for (const q of failures) lines.push("- " + q);
} else lines.push("All routing checks matched the expected page, tool and gap.");

const report = lines.join("\n") + "\n";
writeFileSync(new URL("../knowledge/SEARCH-TEST-REPORT.md", import.meta.url), report);
console.log(report);
if (failures.length) process.exit(1);
