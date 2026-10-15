/* Static dist checks for V9 lane 1. Run after `npm run build` (npm run test:v9:dist does both). */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyDist } from "../scripts/verify-dist.mjs";
const repo = fileURLToPath(new URL("../", import.meta.url)), dist = path.join(repo, "dist");
assert.ok(fs.existsSync(dist), "dist/ missing: run npm run build first");
let passed = 0;
const ok = (name, fn) => { try { fn(); passed++; console.log("PASS", name); } catch (e) { console.error("FAIL", name, "\n   ", e.message.split("\n").slice(0, 4).join("\n    ")); process.exitCode = 1; } };
const LANE = ["v9-utilities-core.js", "v9-sql-engine.js", "v9-sha256.js", "v9-social-card.js", "v9-agent1-tools.js", "v9-agent1.css"];
const read = (f) => fs.readFileSync(path.join(dist, f), "utf8");

ok("dist passes the repository's own verifier (size limits, forbidden paths, references, precache, sitemap)", () => { const r = verifyDist(dist, { root: repo }); assert.deepEqual(r.errors, []); });
ok("every lane-1 script and stylesheet ships, byte-identical to source, well under the per-file limit", () => {
  for (const f of LANE) { assert.ok(fs.existsSync(path.join(dist, f)), f + " missing from dist"); assert.ok(fs.readFileSync(path.join(dist, f)).equals(fs.readFileSync(path.join(repo, f))), f + " differs from source"); assert.ok(fs.statSync(path.join(dist, f)).size < 200 * 1024, f + " unexpectedly large"); }
  const total = LANE.reduce((s, f) => s + fs.statSync(path.join(dist, f)).size, 0); console.log("    lane-1 payload: " + (total / 1024).toFixed(1) + " KiB uncompressed, " + LANE.length + " files");
});
ok("dist/index.html loads the engines before the UI and before discovery/routing, and links the stylesheet", () => {
  const html = read("index.html"), order = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]), at = (f) => order.indexOf(f);
  for (const f of LANE.filter((f) => f.endsWith(".js"))) assert.ok(at(f) > at("tools.js") && at(f) < at("studios-routing.js") && at(f) < at("v8-discovery.js"), f);
  for (const f of ["v9-utilities-core.js", "v9-sql-engine.js", "v9-sha256.js", "v9-social-card.js"]) assert.ok(at(f) < at("v9-agent1-tools.js"), f + " before the UI");
  assert.ok(html.includes('href="v9-agent1.css"'));
});
ok("dist service worker precaches every lane-1 file, so the tools work offline from the first visit", () => {
  const sw = read("sw.js"); for (const f of LANE) assert.ok(sw.includes('"./' + f + '"'), f);
});
ok("the shipped bundle has no network primitives, no remote script or stylesheet, and no browser-storage writes", () => {
  for (const f of LANE) {
    const src = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const bad of [/\bfetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /EventSource/, /localStorage/, /sessionStorage/, /indexedDB/, /document\.cookie/, /<script[^>]+src=/i, /@import/, /<link[^>]+href=["']https?:/i, /import\s*\(\s*["']https?:/]) assert.ok(!bad.test(src), f + " must not contain " + bad);
  }
});
ok("exactly nine top-level categories are shipped, and the four new tools resolve to existing ones", () => {
  const v8 = read("v8-discovery.js"); assert.equal([...v8.matchAll(/\{id:"[a-z-]+",label:/g)].length, 9);
  const ui = read("v9-agent1-tools.js"); const cats = [...ui.matchAll(/^\s*\["(?:sql-formatter|file-sha256|epoch-matrix|og-simulator)", "([^"]+)"/gm)].map((m) => m[1]);
  assert.deepEqual(cats, ["Developer", "Privacy & Safety", "Developer", "Links & Web"]);
  for (const c of cats) assert.ok(v8.includes('cats:["' + c + '"]'), c + " is mapped by a top-level category");
});
ok("dist leaks no tests, docs, artifacts or deploy config", () => {
  for (const f of ["tests", "docs", "artifacts", "scripts", "qa", ".github", "package.json", "wrangler.jsonc", "CNAME"]) assert.ok(!fs.existsSync(path.join(dist, f)), f + " must not be in dist");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
