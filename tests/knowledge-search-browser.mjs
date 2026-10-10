// Real-browser checks for Knowledge search, served from the working tree (no network, no production).
//   node tests/knowledge-search-browser.mjs                 every installed engine of chromium, firefox, webkit
//   BROWSERS=chromium node tests/knowledge-search-browser.mjs
// Engines that cannot be launched are reported as SKIPPED with the reason; they are never counted as passing.
import http from "node:http";
import { readFileSync, existsSync, statSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { extname, join, normalize as pnorm } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("/opt/npm-tools/node_modules/playwright"); }

const root = new URL("..", import.meta.url).pathname;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  let path = pnorm(join(root, decodeURIComponent(url.pathname)));
  if (!path.startsWith(root)) { res.writeHead(403).end(); return; }
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, "index.html");
  if (!existsSync(path)) { res.writeHead(404).end("not found"); return; }
  res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" }).end(readFileSync(path));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = "http://127.0.0.1:" + server.address().port;

const wanted = (process.env.BROWSERS || "chromium,firefox,webkit").split(",");
const failures = [];
const lines = [];
const perf = {};
const need = (engine, ok, msg) => { if (!ok) failures.push(engine + ": " + msg); };

async function results(page, q, { settle = 450 } = {}) {
  await page.fill("#kn-q", q);
  await page.waitForTimeout(settle + 250);
  return page.locator("#kn-search-results");
}

for (const name of wanted) {
  let browser;
  try { browser = await pw[name].launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) }); }
  catch (error) { lines.push("- " + name + ": SKIPPED (" + String(error.message).split("\n")[0] + ")"); continue; }
  const problems = [];
  const open = async (opts = {}) => {
    const context = await browser.newContext({ viewport: { width: opts.width || 1280, height: opts.height || 900 } });
    const page = await context.newPage();
    page.on("pageerror", (e) => problems.push("JS error: " + e.message));
    page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) problems.push("console: " + m.text()); });
    if (opts.block) await page.route(opts.block, (route) => route.abort());
    await page.goto(base + "/knowledge/" + (opts.search || ""), { waitUntil: "load" });
    await page.waitForTimeout(opts.wait || 600);
    return { page, context };
  };

  // 1. broad subject: an overview answer plus a cluster of the main branches
  {
    const { page, context } = await open();
    const out = await results(page, "Machine learning");
    const text = await out.innerText();
    need(name, /Machine learning guides|Related guides/i.test(text) && (await out.locator("a").count()) >= 6, "'Machine learning' should show a cluster of guides");
    need(name, !/No confident match/i.test(text), "'Machine learning' should be answered");
    // 2. typo: the correction is shown
    const typo = await (await results(page, "transfomer attention")).innerText();
    need(name, /Showing results for/.test(typo) && /transformer/i.test(typo), "typo correction note missing: " + typo.slice(0, 80));
    // 3. tool-only: a utility is offered even without a confident guide
    const tool = await results(page, "compress a png image");
    const toolText = await tool.innerText();
    need(name, /Use IntelliTools/i.test(toolText) && /Image Studio/.test(toolText), "Image Studio not recommended for 'compress a png image'");
    const href = await tool.locator(".kn-toolpick a").first().getAttribute("href");
    need(name, href === "../index.html?tool=image-studio", "tool link should route to the tool, got " + href);
    // 4. a knowledge answer is not replaced by a tool
    const how = await (await results(page, "how do i write better prompts")).innerText();
    need(name, /Answer \/ guide/i.test(how) && /Use IntelliTools/i.test(how) && !/No confident match/i.test(how), "guide and tool should appear together");
    // 5. ambiguity: options, no confident guess
    const amb = await (await results(page, "graph")).innerText();
    need(name, /No confident match/i.test(amb) && /Which one do you mean/i.test(amb), "'graph' should offer meanings");
    // 6. out of scope stays weak
    const off = await (await results(page, "best pizza in new york")).innerText();
    need(name, /No confident match|No Knowledge guide matched/i.test(off) && !/Read the guide/i.test(off), "off-topic query must not show a confident guide");
    // 7. typed learn-more labels
    const seq = await (await results(page, "what to learn after rag")).innerText();
    need(name, /next step/.test(seq), "next-step labels missing for 'what to learn after rag'");
    await context.close();
  }

  // Release blockers: inherited object keys never crash; exact comparisons win.
  {
    const { page, context } = await open();
    for (const query of ["constructor", "what is a constructor in javascript", ...Object.getOwnPropertyNames(Object.prototype)]) {
      const text = await (await results(page, query)).innerText();
      need(name, text.length > 0 && !/Search could not complete/.test(text), "inherited property query crashed: " + query);
    }
    const out = await results(page, "transformers vs state space models");
    need(name, await out.locator(".kn-read").getAttribute("href") === "transformers-vs-state-space-models.html", "exact comparison article should win");
    await context.close();
  }
  // D1: submitted result titles are actually within both requested viewports, without scrolling.
  for (const width of [1280, 375]) {
    const { page, context } = await open({ width, height: 800 });
    need(name, await page.evaluate(() => scrollY) === 0, "initial page must start without scrolling");
    await page.fill("#kn-q", "what is rag");
    await page.keyboard.press("Enter");
    const out = page.locator("#kn-search-results");
    await out.locator(".kn-read").waitFor();
    const title = await out.locator("h2").first().boundingBox();
    need(name, title && title.y >= 0 && title.y + title.height <= 800, "first result title must be visible without scrolling at " + width + "x800");
    need(name, await page.evaluate(() => scrollY) === 0, "submitting must not require scrolling at " + width + "x800");
    need(name, await page.evaluate(() => Boolean(document.querySelector('#kn-search-results').compareDocumentPosition(document.querySelector('#kn-v4-learning')) & Node.DOCUMENT_POSITION_FOLLOWING)), "learning panel must follow search results");
    await context.close();
  }
  // D2: a core failure (including the intelligence fallback) shows an error and recovers.
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on("pageerror", error => problems.push("JS error: " + error.message));
    await page.route("**/search-core.mjs", async route => {
      const response = await route.fetch();
      const body = (await response.text()).replace('export function searchKnowledge(index, lexicon, rawQuery) {', 'export function searchKnowledge(index, lexicon, rawQuery) {\n if (rawQuery === "simulate failure") throw new Error("Injected search failure");');
      await route.fulfill({response, body});
    });
    await page.goto(base + "/knowledge/");
    await page.waitForTimeout(600);
    const text = await (await results(page, "simulate failure")).innerText();
    need(name, /Search could not complete/.test(text), "unexpected retrieval failure must display a safe message");
    need(name, /Search could not complete/.test(await page.locator('#kn-search-status').innerText()), "error must also be announced");
    const recovered = await (await results(page, "what is rag")).innerText();
    need(name, /Read the guide/.test(recovered) && !/Search could not complete/.test(recovered), "next query must recover after an error");
    await context.close();
  }

  // 8. every added asset blocked: plain lexical search still answers
  {
    const { page, context } = await open({ block: /(search-intelligence\.mjs|query-understanding\.json|tool-map\.json|relations\.json)$/ });
    const text = await (await results(page, "what is rag")).innerText();
    need(name, /Retrieval/i.test(text) && /Read the guide/i.test(text), "lexical fallback failed when intelligence assets are blocked");
    await context.close();
  }
  // 8b. one file missing (relations.json): the rest still works
  {
    const { page, context } = await open({ block: /relations\.json$/ });
    const text = await (await results(page, "Machine learning")).innerText();
    need(name, !/No confident match/i.test(text), "search broke when only relations.json was unavailable");
    await context.close();
  }
  // 9. semantic opt-in with its assets blocked: still answers, no errors
  {
    const { page, context } = await open({ search: "?semantic=1", block: /(semantic-index\.json|semantic-core\.mjs|hybrid-search\.mjs)$/ });
    const text = await (await results(page, "what is rag")).innerText();
    need(name, /Read the guide/i.test(text), "semantic fallback failed when semantic assets are blocked");
    await context.close();
  }
  // 10. semantic opt-in with assets present
  {
    const { page, context } = await open({ search: "?semantic=1", wait: 3500 });
    const text = await (await results(page, "how do models remember a long conversation")).innerText();
    need(name, text.length > 0 && !/Search could not be loaded/.test(text), "semantic mode produced no result area");
    await context.close();
  }
  // 11. small screen: no horizontal scroll with the new blocks present
  {
    const { page, context } = await open({ width: 375 });
    await results(page, "Machine learning");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    need(name, overflow <= 1, "horizontal overflow of " + overflow + "px at 375px");
    await context.close();
  }
  // 12. performance: time from typing to rendered results, plus load
  {
    const { page, context } = await open();
    const QUERIES = ["what is rag", "machine learning", "transfomer attention", "how do i write better prompts", "compress a png image", "rag vs fine tuning", "graph", "best pizza in new york", "lora versus full finetuning", "what to learn after rag"];
    const times = [];
    for (const q of QUERIES) {
      const ms = await page.evaluate(async (query) => {
        const input = document.querySelector("#kn-q");
        const form = document.querySelector("#kn-search-form");
        const t0 = performance.now();
        input.value = query;
        form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
        await new Promise((r) => requestAnimationFrame(() => r()));
        return performance.now() - t0;
      }, q);
      times.push(ms);
    }
    times.sort((a, b) => a - b);
    const nav = await page.evaluate(() => { const n = performance.getEntriesByType("navigation")[0]; return { dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd }; });
    perf[name] = { p50: times[Math.floor(times.length / 2)], max: times[times.length - 1], load: nav.load };
    need(name, perf[name].max < 250, "slowest query took " + perf[name].max.toFixed(0) + " ms to render (limit 250 ms)");
    await context.close();
  }
  need(name, problems.length === 0, "page errors: " + problems.slice(0, 3).join(" | "));
  lines.push("- " + name + ": " + (failures.some((f) => f.startsWith(name + ":")) ? "FAIL" : "PASS") + (perf[name] ? " (query render p50 " + perf[name].p50.toFixed(1) + " ms, max " + perf[name].max.toFixed(1) + " ms, page load " + perf[name].load.toFixed(0) + " ms)" : ""));
  await browser.close();
}
server.close();

const sizes = ["search-core.mjs", "search-intelligence.mjs", "relations.mjs", "query-understanding.json", "tool-map.json", "relations.json", "search-index.json", "search-lexicon.json", "semantic-index.json"].map((f) => {
  const buf = readFileSync(root + "knowledge/" + f);
  return { f, raw: buf.length, gz: gzipSync(buf).length };
});
lines.push("", "Asset sizes (raw / gzip):");
for (const s of sizes) lines.push("- knowledge/" + s.f + ": " + (s.raw / 1024).toFixed(1) + " KB / " + (s.gz / 1024).toFixed(1) + " KB");
const added = sizes.filter((s) => ["search-intelligence.mjs", "relations.mjs", "query-understanding.json", "tool-map.json", "relations.json"].includes(s.f));
lines.push("- added by this work: " + (added.reduce((a, s) => a + s.raw, 0) / 1024).toFixed(1) + " KB raw / " + (added.reduce((a, s) => a + s.gz, 0) / 1024).toFixed(1) + " KB gzip");
console.log(lines.join("\n"));
writeFileSync(new URL("../knowledge/SEARCH-INTELLIGENCE-BROWSER.md", import.meta.url), "# Knowledge search intelligence: browser results\n\nRun: `node tests/knowledge-search-browser.mjs` (local static server, no production traffic).\n\n" + lines.join("\n") + "\n");
const ran = lines.filter((l) => /: (PASS|FAIL)/.test(l)).length;
if (!ran) failures.push("no browser could be launched");
// In CI every requested engine must actually run; a skipped engine is a failure there, never a silent pass.
if (process.env.CI && lines.some((l) => /SKIPPED/.test(l))) failures.push("an engine was skipped in CI: " + lines.filter((l) => /SKIPPED/.test(l)).join("; "));
if (failures.length) { console.error("BROWSER FAILURES (" + failures.length + "):\n" + failures.map((f) => "- " + f).join("\n")); process.exit(1); }
console.log("browser checks passed");
