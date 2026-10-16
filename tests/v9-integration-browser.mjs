/* V9 integration browser QA (Agent 1 + Agent 2 together): node tests/v9-integration-browser.mjs [chromium|firefox|webkit]
   env: SITE_ROOT (default "dist" after `npm run build`), PLAYWRIGHT_PACKAGE, BROWSER_EXECUTABLE, V9_QA_ARTIFACTS.
   Serves the built site with Cloudflare-style routing, blocks third-party http(s) (never blob:/data:), and records any
   request that leaves the origin. "Offline" means the origin server is stopped, not an emulator switch. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDistServer } from "../scripts/serve-dist.mjs";
const pwm = await import(process.env.PLAYWRIGHT_PACKAGE || "playwright");
const pw = pwm.chromium ? pwm : pwm.default;
const engine = process.argv[2] || "chromium";
const repo = fileURLToPath(new URL("../", import.meta.url));
const root = path.resolve(repo, process.env.SITE_ROOT || "dist");
const out = process.env.V9_QA_ARTIFACTS || path.join(repo, "artifacts", "v9-integration-" + engine);
fs.mkdirSync(out, { recursive: true });

const AGENT1 = ["sql-formatter", "file-sha256", "epoch-matrix", "og-simulator"];
const MEDIA = ["cubic-bezier", "screenshot-beautifier", "pdf-signer", "offline-ocr", "silence-stripper", "video-gif-trimmer"];
const ALL = [...AGENT1, ...MEDIA];
const SEARCH = {
  "sql-formatter": ["format sql", "minify sql"],
  "file-sha256": ["sha256", "verify download hash"],
  "epoch-matrix": ["epoch", "unix timestamp time zone"],
  "og-simulator": ["open graph", "twitter card"],
  "cubic-bezier": ["bezier", "easing curve"],
  "screenshot-beautifier": ["screenshot", "mockup"],
  "pdf-signer": ["sign pdf", "flattener"],
  "offline-ocr": ["ocr", "image to text"],
  "silence-stripper": ["silence", "audio leveler"],
  "video-gif-trimmer": ["trim video", "gif trimmer"],
};
const MARKER = {
  "sql-formatter": "#v9-sql-in", "file-sha256": "#v9-sha-file", "epoch-matrix": "#v9-ep-in", "og-simulator": "#v9-og-title",
};
const BASELINE_LISTED = 59; // accepted V8 baseline db1d375 (reproduced: 59 listed of 74 registered; Freelance Studio retired)
let server = createDistServer(root);
const port = await server.start();
const base = `http://127.0.0.1:${port}/`;
const origin = new URL(base).origin;
const AD_HOST = /(googlesyndication|doubleclick|googleadservices|adtrafficquality|adsbygoogle|(^|\.)google\.com$|^csi\.gstatic\.com$)/;
const isAd = (u) => AD_HOST.test(u.hostname) || /pagead/i.test(u.href);
const browser = await pw[engine].launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
  ...(engine === "chromium" ? { args: ["--no-sandbox"] } : {}),
});
const checks = [];
let current = "";
async function check(label, fn) {
  current = label;
  const t0 = Date.now();
  try { await fn(); checks.push({ label, ok: true, ms: Date.now() - t0 }); console.log("PASS", label); }
  catch (e) { checks.push({ label, ok: false, ms: Date.now() - t0, error: String(e.message).slice(0, 1500) }); console.error("FAIL", label, "\n    ", String(e.message).split("\n").slice(0, 6).join("\n     ")); }
}
async function open({ w = 1280, h = 900 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  const errs = [], external = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message + " [during: " + current.slice(0, 40) + "] " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  page.on("console", (m) => { if (m.type() === "error" && !/pagead|googlesyndication|Failed to load resource|ERR_FAILED|net::|NS_ERROR|blocked/i.test(m.text())) errs.push("console: " + m.text()); });
  page.on("request", (r) => { let u; try { u = new URL(r.url()); } catch { return; } if (/^https?:$/.test(u.protocol) && u.origin !== origin && !isAd(u)) external.push(u.href); });
  await ctx.route((u) => /^https?:/.test(u.protocol) && u.origin !== origin, (r) => r.abort());
  return { ctx, page, errs, external };
}
const mediaReady = async (page, id) => {
  const frame = page.frameLocator("#v9MediaFrame");
  await frame.locator("#tool[data-ready]").waitFor();
  assert.equal(await frame.locator("h1").count(), 1, id + " heading");
  return frame;
};
const ready = async (page, id) => {
  if (MEDIA.includes(id)) return mediaReady(page, id);
  await page.waitForSelector(MARKER[id] || "#workspace.active");
  assert.ok(await page.locator("#workspace.active").count(), id);
};

try {
  const A = await open();
  const { page } = A;
  await page.goto(base);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });

  await check("catalogue: ten V9 ids registered exactly once, ids unique, nine categories, tile counts equal listed tools", async () => {
    const ids = await page.evaluate(() => tools.map((t) => t[0]));
    assert.equal(new Set(ids).size, ids.length, "tool ids are unique");
    for (const id of ALL) assert.equal(ids.filter((x) => x === id).length, 1, id);
    assert.equal(await page.locator(".cat-tile").count(), 9);
    const listed = await page.evaluate(() => tools.filter(isListed).length);
    const sum = await page.locator(".cat-tile small").evaluateAll((ns) => ns.reduce((s, n) => s + parseInt(n.textContent), 0));
    assert.equal(sum, listed, "tile counts equal listed tools");
    assert.equal(listed, BASELINE_LISTED + ALL.length, "V8 baseline tools + the ten V9 tools");
  });
  await check("categories: each V9 tool appears in exactly its category view", async () => {
    const SLUG = { "Developer": "developer", "Privacy & Safety": "privacy-security", "Privacy & Security": "privacy-security", "Links & Web": "links-web", "Images & Design": "images-design", "PDF & Tables": "files-pdf", "Writing & Text": "writing-text" };
    const cat = await page.evaluate((ALL) => Object.fromEntries(tools.filter((t) => ALL.includes(t[0])).map((t) => [t[0], t[1]])), ALL);
    for (const id of ALL) {
      const slug = SLUG[cat[id]];
      assert.ok(slug, "category slug for " + cat[id]);
      await page.goto(base + "?category=" + slug);
      assert.equal(await page.locator(`#categoryTools [data-open="${id}"]`).count(), 1, `${id} in ${cat[id]}`);
    }
    await page.goto(base);
  });
  await check("search: task-style queries find every V9 tool", async () => {
    await page.goto(base);
    for (const id of ALL) for (const q of SEARCH[id]) {
      await page.fill("#toolSearch", q);
      assert.equal(await page.locator(`#toolCatalog [data-open="${id}"]`).count(), 1, `"${q}" should find ${id}`);
    }
    await page.fill("#toolSearch", "");
  });
  await check("favourites and recents: all ten persist across reload, shelf shows them, removal works, opening records a recent", async () => {
    await page.goto(base);
    for (const id of ALL) {
      await page.fill("#toolSearch", SEARCH[id][0]);
      await page.locator(`#toolCatalog [data-fav="${id}"]`).click();
      assert.equal(await page.locator(`#toolCatalog [data-fav="${id}"]`).getAttribute("aria-pressed"), "true", id);
    }
    await page.reload();
    for (const id of ALL) assert.equal(await page.locator(`#discoveryShelf [role=group][aria-label=Favourites] [data-open="${id}"]`).count(), 1, id + " on shelf after reload");
    for (const id of ["cubic-bezier", "epoch-matrix"]) {
      await page.locator(`#discoveryShelf [data-open="${id}"]`).first().click();
      await ready(page, id);
      await page.goto(base);
      assert.equal(await page.locator(`#discoveryShelf [aria-label="Recently used"] [data-open="${id}"]`).count(), 1, id + " recent");
    }
    for (const id of ALL) {
      await page.fill("#toolSearch", SEARCH[id][0]);
      await page.locator(`#toolCatalog [data-fav="${id}"]`).click();
      assert.equal(await page.locator(`#toolCatalog [data-fav="${id}"]`).getAttribute("aria-pressed"), "false", id);
    }
    await page.fill("#toolSearch", "");
  });
  await check("deep links: ?tool=<id> opens all ten; V8/legacy deep links still work", async () => {
    for (const id of ALL) {
      await page.goto(base + "?tool=" + id);
      await ready(page, id);
    }
    for (const [id, marker] of [["json-formatter", "#workspace.active"], ["timestamp", "#workspace.active"], ["qr-code", "#workspace.active"]]) {
      const exists = await page.evaluate((id) => tools.some((t) => t[0] === id), id);
      if (!exists) continue;
      await page.goto(base + "?tool=" + id);
      await page.waitForSelector(marker);
    }
    await page.goto(base + "?tool=epoch-matrix&ts=1700000000123456789&unit=ns&tz=UTC,Asia/Tokyo");
    await page.waitForSelector("#v9-ep-out table");
    assert.match(await page.locator("#v9-ep-out .v9a-lead").innerText(), /2023-11-14T22:13:20\.123456789Z/);
    // Note: an unknown ?tool=<id> throws in tools.js shell() on the V8 baseline too (reproduced on db1d375); not changed here.
  });
  await check("shared engines: epoch (exact ns) and Bézier (x-solving) survive the merge, and the Bézier tool agrees with them", async () => {
    await page.goto(base);
    const r = await page.evaluate(() => {
      const G = window.GVTV9;
      const e = G.epoch ? G.epoch("1700000000123456789", "ns", ["UTC"]) : null;
      return {
        api: ["epoch", "bezier", "bezierAt", "parseEpoch", "formats", "diff"].filter((k) => typeof G[k] !== "function"),
        iso: e && e.iso,
        mid: G.bezierAt(0.5, 0.25, 0.1, 0.25, 1),
        css: G.bezier(0.25, 0.1, 0.25, 1),
        linear: G.bezierAt(0.3, 0, 0, 1, 1),
      };
    });
    assert.deepEqual(r.api, [], "missing engine exports");
    assert.ok(Math.abs(r.mid - 0.8024) < 0.001, "bezierAt(0.5, ease) = " + r.mid);
    assert.equal(r.css, "cubic-bezier(0.25, 0.1, 0.25, 1)");
    assert.ok(Math.abs(r.linear - 0.3) < 1e-6);
    await page.goto(base + "?tool=cubic-bezier");
    const frame = await mediaReady(page, "cubic-bezier");
    assert.match(await frame.locator("#css").inputValue(), /cubic-bezier\(0\.25, 0\.1, 0\.25, 1\)/);
    await frame.locator("#progress").fill("0.5");
    await frame.locator("#progress").dispatchEvent("input");
    await page.waitForTimeout(150);
    assert.match(await frame.locator("body").innerText(), /0\.80/, "frame shows the same sampled value as the core");
  });
  await check("tool switching: all ten in sequence leave no stale frame, page errors or horizontal overflow (desktop)", async () => {
    await page.goto(base);
    for (const id of [...ALL, ...ALL.slice().reverse()]) {
      await page.evaluate((id) => openTool(id), id);
      await ready(page, id);
      assert.equal(await page.locator("#v9MediaFrame").count(), MEDIA.includes(id) ? 1 : 0, id + " frame state");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), id + " overflow");
    }
    await page.evaluate(() => closeTool());
    assert.equal(await page.locator("#v9MediaFrame").count(), 0);
    assert.deepEqual(A.errs, []);
  });
  await check("privacy: no request left the origin across every V9 tool", async () => { assert.deepEqual(A.external, []); });

  await check("mobile 390px: home and every V9 tool fit without horizontal scroll; controls are reachable", async () => {
    const M = await open({ w: 390, h: 844 });
    await M.page.goto(base);
    assert.ok(await M.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "home overflow");
    for (const id of ALL) {
      await M.page.goto(base + "?tool=" + id);
      await ready(M.page, id);
      assert.ok(await M.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), id + " page overflow");
      if (MEDIA.includes(id)) assert.ok(await M.page.frameLocator("#v9MediaFrame").locator("body").evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), id + " frame overflow");
    }
    assert.deepEqual(M.errs, []);
    assert.deepEqual(M.external, []);
    await M.ctx.close();
  });
  await check("accessibility: V9 tool frames have titles, one h1, and no unlabelled form controls", async () => {
    for (const id of MEDIA) {
      await page.goto(base + "?tool=" + id);
      const frame = await mediaReady(page, id);
      assert.ok((await page.locator("#v9MediaFrame").getAttribute("title")) || "", id + " iframe title");
      const unlabeled = await frame.locator("input:not([type=hidden]):not([type=file]), select, textarea").evaluateAll((els) => els.filter((e) => !(e.labels && e.labels.length) && !e.getAttribute("aria-label") && !e.getAttribute("aria-labelledby")).map((e) => e.id || e.name || e.tagName));
      assert.deepEqual(unlabeled, [], id + " has unlabelled controls");
    }
  });

  await check("service-worker upgrade: V9 assets precached, old caches dropped, scoped media cache preserved", async () => {
    const O = await open();
    await O.page.goto(base);
    await O.page.evaluate(async () => { await navigator.serviceWorker.ready; });
    const cacheName = fs.readFileSync(path.join(root, "sw.js"), "utf8").match(/const CACHE="([^"]+)"/)[1];
    await O.page.waitForFunction(async (name) => { const c = await caches.open(name); return (await c.keys()).length > 300; }, cacheName, { timeout: 90000 });
    const need = ["/v9-utilities-core.js", "/v9-sql-engine.js", "/v9-sha256.js", "/v9-social-card.js", "/v9-agent1-tools.js", "/v9-agent1.css", "/tools/v9-media/register.js", "/index.html"];
    const keys = await O.page.evaluate(async (name) => (await (await caches.open(name)).keys()).map((r) => new URL(r.url).pathname), cacheName);
    assert.deepEqual(need.filter((p) => !keys.includes(p) && !(p === "/index.html" && keys.includes("/"))), [], "missing from the global precache");
    // Simulate the previous release's caches and the scoped media worker's cache, then force a worker upgrade.
    await O.page.evaluate(async () => {
      for (const n of ["govibetool-v8-7", "govibetool-v2-7", "gvt-v9-media-1"]) await (await caches.open(n)).put("/probe-" + n, new Response("x"));
      for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    });
    await O.page.reload();
    await O.page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await O.page.waitForFunction(() => !!navigator.serviceWorker.controller || true);
    await O.page.waitForFunction(async () => { const k = await caches.keys(); return !k.includes("govibetool-v8-7") && !k.includes("govibetool-v2-7"); }, null, { timeout: 30000 });
    const after = await O.page.evaluate(() => caches.keys());
    assert.ok(after.includes(cacheName), "current cache present: " + after);
    assert.ok(after.includes("gvt-v9-media-1"), "scoped media cache must survive a global upgrade: " + after);
    await O.ctx.close();
  });
  await check("offline: with the origin stopped, the home page, Agent 1 tools and the media shell open from the worker cache", async () => {
    const O = await open();
    await O.page.goto(base);
    await O.page.evaluate(async () => { await navigator.serviceWorker.ready; });
    const cacheName = fs.readFileSync(path.join(root, "sw.js"), "utf8").match(/const CACHE="([^"]+)"/)[1];
    await O.page.waitForFunction(async (name) => { const c = await caches.open(name); return (await c.keys()).length > 300; }, cacheName, { timeout: 90000 });
    await O.page.reload();
    assert.ok(await O.page.evaluate(() => !!navigator.serviceWorker.controller), "page controlled by the global worker");
    // Visit the media shell once while online so the worker can cache what it serves, as a returning user would.
    await O.page.goto(base + "?tool=cubic-bezier");
    await mediaReady(O.page, "cubic-bezier");
    await server.stop();
    try {
      for (const id of AGENT1) {
        await O.page.goto(base + "?tool=" + id);
        await ready(O.page, id);
      }
      await O.page.goto(base + "?tool=cubic-bezier");
      const frame = await mediaReady(O.page, "cubic-bezier");
      assert.match(await frame.locator("#css").inputValue(), /cubic-bezier/);
      await O.page.goto(base + "?tool=epoch-matrix&ts=0&unit=s&tz=UTC");
      await O.page.waitForSelector("#v9-ep-out table");
      assert.deepEqual(O.errs, []);
    } finally {
      server = createDistServer(root, { port });
      await server.start();
    }
    await O.ctx.close();
  });
  await check("console: no page errors across the whole run", async () => { assert.deepEqual(A.errs, []); });
  await A.ctx.close();
} finally {
  const failed = checks.filter((c) => !c.ok);
  fs.writeFileSync(path.join(out, "results.json"), JSON.stringify({ engine, browser: browser.version(), root: path.relative(repo, root), passed: checks.length - failed.length, failed: failed.length, checks }, null, 2));
  console.log(`RESULT ${JSON.stringify({ engine, browser: browser.version(), passed: checks.length - failed.length, failed: failed.length })}`);
  await browser.close();
  await server.stop();
  if (failed.length) process.exitCode = 1;
}
