// Runs the existing search suites against the NEW engine, in a throwaway copy of the repo, so committed reports are
// never overwritten. In the copy, knowledge/search-core.mjs becomes a shim: searchKnowledge() calls searchIntelligent()
// over the original core. The suites themselves are untouched. This proves the intelligence layer keeps every
// behaviour those suites protect (confident vs weak, expected top pages, tool recommendations, ambiguity gates).
import { cpSync, mkdtempSync, readFileSync, writeFileSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const work = mkdtempSync(join(tmpdir(), "kb-compat-"));
const SUITES = ["knowledge-search", "knowledge-search-regressions", "knowledge-ambiguity-gate", "knowledge-ai-v3-queries", "knowledge-final-expansion"];
let failed = false;
try {
  cpSync(root, work, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
  const core = join(work, "knowledge/search-core.mjs");
  renameSync(core, join(work, "knowledge/search-core-orig.mjs"));
  const layer = join(work, "knowledge/search-intelligence.mjs");
  writeFileSync(layer, readFileSync(layer, "utf8").replace(/"\.\/search-core\.mjs"/g, '"./search-core-orig.mjs"'));
  writeFileSync(core, [
    'import { readFileSync } from "node:fs";',
    'import { searchIntelligent, loadExtras } from "./search-intelligence.mjs";',
    'export * from "./search-core-orig.mjs";',
    "let extras;",
    "export function searchKnowledge(index, lexicon, q) {",
    '  extras ||= loadExtras((rel) => JSON.parse(readFileSync(new URL("./" + rel, import.meta.url), "utf8")));',
    "  return searchIntelligent(index, lexicon, q, extras);",
    "}",
    ""
  ].join("\n"));
  for (const suite of SUITES) {
    const run = spawnSync(process.execPath, ["tests/" + suite + ".mjs"], { cwd: work, encoding: "utf8", maxBuffer: 1 << 26 });
    const ok = run.status === 0;
    console.log((ok ? "PASS " : "FAIL ") + suite);
    if (!ok) { failed = true; console.log((run.stdout + run.stderr).split("\n").filter((l) => !l.startsWith("|")).slice(-14).join("\n")); }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
if (failed) { console.error("legacy suites fail against the intelligence engine"); process.exit(1); }
console.log("legacy compatibility checks passed");
