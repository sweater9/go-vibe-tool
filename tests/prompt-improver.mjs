import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const core = require("../prompt-improver-core.js");
let passed = 0;
function ok(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    console.error(`FAIL: ${name}\n  ${err.message}`);
    process.exitCode = 1;
  }
}

const VAGUE = core.EXAMPLE_PROMPT;
const STRONG =
  "You are a senior product marketer. Write a 300-word launch email for our new budgeting app, aimed at freelancers who struggle with irregular income. " +
  "Use a friendly, confident tone. Must include one customer quote placeholder and a clear call to action. " +
  "Format as: subject line, preview text, then body in short paragraphs. Avoid jargon. For example, open with a relatable problem.";

ok("empty and whitespace-only input report empty", () => {
  for (const v of ["", "   ", "\n\n\t", null, undefined]) assert.equal(core.analyze(v).empty, true);
});

ok("non-string input never throws", () => {
  for (const v of [42, {}, [], true, "😀".repeat(50), "مرحبا بالعالم", "\u0000\u0001"]) core.analyze(v);
});

ok("nine checks whose weights sum to 100", () => {
  const r = core.analyze(VAGUE);
  assert.equal(r.checks.length, 9);
  assert.equal(r.checks.reduce((n, c) => n + c.weight, 0), 100);
  assert.deepEqual(r.checks.map((c) => c.id), ["task", "context", "audience", "constraints", "format", "examples", "role", "clarity", "scope"]);
});

ok("score equals the sum of earned points and stays within 0-100", () => {
  for (const v of [VAGUE, STRONG, "hi", "explain how oauth works to a beginner in 5 bullet points"]) {
    const r = core.analyze(v);
    assert.ok(r.score >= 0 && r.score <= 100);
    const sum = Math.round(r.checks.reduce((n, c) => n + c.earned, 0));
    assert.ok(r.flags.some((f) => f.type === "short") ? r.score <= sum : r.score === sum);
  }
});

ok("vague prompt scores low, names the vague word and keeps original wording", () => {
  const r = core.analyze(VAGUE);
  assert.ok(r.score < 40, `score ${r.score}`);
  assert.equal(r.label, "Needs work");
  assert.ok(r.vague.includes("good"));
  assert.ok(r.improved.includes(VAGUE), "original wording must appear verbatim");
  assert.ok(r.improved.startsWith("You are a professional editor and writer."));
  assert.ok(r.added.includes("context") && r.added.includes("format"));
});

ok("strong prompt scores high and is left alone", () => {
  const r = core.analyze(STRONG);
  assert.ok(r.score >= 85, `score ${r.score}`);
  assert.equal(r.label, "Strong");
  assert.equal(r.alreadyStrong, true);
  assert.equal(r.improved, STRONG);
});

ok("a very short prompt is capped and flagged", () => {
  const r = core.analyze("hi");
  assert.ok(r.score <= 25);
  assert.ok(r.flags.some((f) => f.type === "short"));
});

ok("adding context, limits and format raises the score", () => {
  const before = core.analyze("write a blog post about productivity").score;
  const after = core.analyze(
    "Write a blog post about productivity for busy freelancers because they struggle to focus. Keep it under 600 words and use bullet points."
  ).score;
  assert.ok(after > before + 25, `${before} -> ${after}`);
});

ok("task types are detected", () => {
  const cases = {
    coding: "Fix this python function, it throws an error on an empty list",
    summarize: "Summarize this report in a few key points",
    data: "Extract the names and dates from this text into a csv table",
    analysis: "Compare these two vendors and evaluate the trade-offs",
    planning: "Plan a roadmap and milestones for the product launch",
    learning: "Explain how photosynthesis works so I can study for the quiz",
    writing: "Draft an email to my landlord about the broken heater",
    brainstorm: "Brainstorm ideas and names for a coffee shop",
    general: "Tell me about my day"
  };
  for (const [id, text] of Object.entries(cases)) assert.equal(core.analyze(text).taskType, id, text);
});

ok("a chosen task type overrides detection", () => {
  const r = core.analyze("Fix this python function", { taskType: "writing" });
  assert.equal(r.taskType, "writing");
  assert.equal(core.analyze("Fix this python function", { taskType: "auto" }).taskType, "coding");
});

ok("a prompt that opens with a role line still gets task credit", () => {
  const r = core.analyze("You are a careful editor. Proofread the paragraph below and list every error.");
  assert.equal(r.checks.find((c) => c.id === "task").status, "pass");
});

ok("short, long and small are not treated as vague", () => {
  const r = core.analyze("Write short paragraphs for a small team and avoid long sentences.");
  assert.deepEqual(r.vague, []);
});

ok("several separate requests trigger the scope warning", () => {
  const r = core.analyze("Write a plan. Create a budget. Draft an email. Summarize the report. Compare the vendors.");
  assert.equal(r.checks.find((c) => c.id === "scope").status, "warn");
});

ok("numbered steps are not counted as separate requests", () => {
  const r = core.analyze("Write a guide with these steps:\n1. Explain the basics.\n2. Show an example.\n3. List common mistakes.\n4. Summarize.");
  assert.equal(r.checks.find((c) => c.id === "scope").status, "pass");
});

ok("sensitive data is detected and masked", () => {
  const secret = "sk-abc123def456ghi789jkl012";
  const r = core.analyze(
    `Summarize this thread. Contact jane.doe@example.com or +1 415 555 0132. key ${secret}. Card 4242 4242 4242 4242. password: hunter2hunter2`
  );
  const types = r.sensitive.map((s) => s.type).sort();
  assert.deepEqual(types, ["card", "email", "phone", "secret", "secret"].sort());
  const flag = r.flags.find((f) => f.type === "sensitive");
  assert.ok(flag);
  for (const leak of [secret, "jane.doe@example.com", "4242 4242 4242 4242", "hunter2hunter2"]) assert.ok(!flag.detail.includes(leak), `leaked ${leak}`);
});

ok("ordinary numbers and dates are not flagged as sensitive", () => {
  const r = core.analyze("Write a 300-word summary of 2024 revenue: 1,250,000 USD, 12 percent growth in 3 regions, from 12-14 March 2025.");
  assert.deepEqual(r.sensitive, []);
});

ok("a number that fails the Luhn check is not a card", () => {
  assert.ok(!core.analyze("Reference 1234 5678 9012 3456 for the order").sensitive.some((s) => s.type === "card"));
});

ok("placeholders are counted accurately", () => {
  const r = core.analyze(VAGUE);
  const brackets = (r.improved.match(/\[[^\]]+\]/g) || []).length;
  assert.equal(r.placeholderCount, brackets);
});

ok("output is deterministic", () => {
  assert.deepEqual(core.analyze(VAGUE), core.analyze(VAGUE));
});

ok("very long input is trimmed and flagged", () => {
  const r = core.analyze("Write a story. ".repeat(3000));
  assert.ok(r.flags.some((f) => f.type === "truncated"));
});

ok("adversarial input stays fast", () => {
  const cases = ["9".repeat(20000), "12-".repeat(6000), "a".repeat(20000), "a".repeat(10000) + "@" + "b".repeat(9000), ". ".repeat(10000), "a.".repeat(10000) + "@x"];
  for (const c of cases) {
    const t = performance.now();
    core.analyze(c);
    const ms = performance.now() - t;
    assert.ok(ms < 400, `${ms.toFixed(0)}ms for ${c.slice(0, 12)}…`);
  }
});

ok("the tool never touches the network or loads remote code", () => {
  const banned = /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|importScripts|\bimport\s*\(|navigator\.serviceWorker|\.src\s*=/;
  for (const file of ["../prompt-improver-core.js", "../v6-tools.js"]) {
    const src = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.ok(!banned.test(src), `${file} contains a network or remote-code API`);
  }
});

ok("user text is always escaped before it reaches innerHTML", () => {
  const src = readFileSync(new URL("../v6-tools.js", import.meta.url), "utf8");
  assert.ok(src.includes("esc(r.improved)"), "improved prompt must be escaped");
  assert.ok(!/innerHTML\s*=\s*[^;]*inputEl\.value/.test(src), "raw input must not be assigned to innerHTML");
});

if (!process.exitCode) console.log(`Prompt Improver core: ${passed} checks passed`);
