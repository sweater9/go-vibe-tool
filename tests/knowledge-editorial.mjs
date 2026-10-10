// Editorial assertions for user-visible Knowledge UI copy. No network, no browser.
import { readFileSync } from "node:fs";
const K = (p) => readFileSync(new URL("../knowledge/" + p, import.meta.url), "utf8");
const failures = [];
const need = (ok, msg) => { if (!ok) failures.push(msg); };

const home = K("index.html");
need(/<h1>Explore Artificial Intelligence<\/h1>/.test(home), "home H1 must be 'Explore Artificial Intelligence'");
need(home.includes("Explore modern artificial intelligence through free, clear, and accessible guides that explain complex AI concepts in simple, practical language."), "home lede must match the approved copy");
need(/<title>Knowledge: Artificial Intelligence Guides/.test(home), "home title must use the professional title");

// Chrome (everything except article bodies) must avoid informal wording and unverified privacy claims.
const chrome = [home, K("glossary.html"), K("search.js")].join("\n");
for (const [re, why] of [
  [/plain-english/i, "informal 'plain-English'"],
  [/understand AI, practically/i, "old informal title"],
  [/browser-first/i, "jargon 'browser-first'"],
  [/nothing you type is sent/i, "unverified privacy claim"],
  [/we don't have a solid guide/i, "informal empty-state wording"],
  [/still loading/i, "informal loading status"]
]) need(!re.test(chrome), "banned UI wording present: " + why);

// Every generated page shares the same footer wording.
for (const f of ["index.html", "glossary.html", "rag.html", "mcp.html"]) need(K(f).includes("© IntelliTools. Free, browser-based tools."), f + ": footer copy");
if (failures.length) { console.error("FAILURES:\n" + failures.join("\n")); process.exit(1); }
console.log("editorial UI copy checks passed");
