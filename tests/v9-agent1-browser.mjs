/* V9 lane 1 browser QA: node tests/v9-agent1-browser.mjs [chromium|firefox|webkit]
   env: SITE_ROOT (default ".", use "dist" after `npm run build`), PLAYWRIGHT_PACKAGE, V9_BIG_FILE_MIB (default 300), V9_HUGE_FILE_MIB (optional, e.g. 4200 to prove >4 GiB).
   Serves the site from a local static server, aborts every other origin, and records any request that leaves it. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { createDistServer } from "../scripts/serve-dist.mjs";
const pwm = await import(process.env.PLAYWRIGHT_PACKAGE || "playwright"); const pw = pwm.chromium ? pwm : pwm.default;
const engine = process.argv[2] || "chromium";
const repo = fileURLToPath(new URL("../", import.meta.url));
const root = path.resolve(repo, process.env.SITE_ROOT || ".");
const out = process.env.V9_QA_ARTIFACTS || path.join(repo, "artifacts", "v9-agent1-" + engine);
fs.mkdirSync(out, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "v9-agent1-"));
const BIG_MIB = Number(process.env.V9_BIG_FILE_MIB || 300), HUGE_MIB = Number(process.env.V9_HUGE_FILE_MIB || 0);

const srv = createDistServer(root); await srv.start(); const base = srv.base, origin = new URL(base).origin;
const AD_HOST = /(googlesyndication|doubleclick|googleadservices|adtrafficquality|adsbygoogle|(^|\.)google\.com$|^csi\.gstatic\.com$)/;
const isAd = (u) => AD_HOST.test(u.hostname) || /pagead/i.test(u.href);
const browser = await pw[engine].launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
const checks = [];
const watchdog = setTimeout(() => { fs.writeFileSync(path.join(out, "results.json"), JSON.stringify({ engine, checks, watchdog: true }, null, 2)); console.error("WATCHDOG: suite exceeded 20 minutes"); process.exit(1); }, 20 * 60 * 1000);
async function check(label, fn) {
  const t0 = Date.now();
  try { await fn(); checks.push({ label, ok: true, ms: Date.now() - t0 }); console.log("PASS", label); }
  catch (e) { checks.push({ label, ok: false, ms: Date.now() - t0, error: String(e.message).slice(0, 1200) }); console.error("FAIL", label, "\n    ", String(e.message).split("\n").slice(0, 6).join("\n     ")); }
}

/* ---------- fixtures ---------- */
function png(w, h, [r, g, b]) {
  const crc = (buf) => { const c = Buffer.alloc(4); c.writeUInt32BE(zlib.crc32(buf) >>> 0); return c; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const t = Buffer.concat([Buffer.from(type), data]); return Buffer.concat([len, t, crc(t)]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.alloc(1 + w * 3); for (let x = 0; x < w; x++) { row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b; }
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
/* sparse file of `size` bytes: zeros plus a 4-byte tail; returns [path, sha256 computed by node from the same byte stream] */
function sparseFile(name, size) {
  const p = path.join(tmp, name), fd = fs.openSync(p, "w");
  fs.ftruncateSync(fd, size); fs.writeSync(fd, Buffer.from("GVT9"), 0, 4, size - 4); fs.closeSync(fd);
  const h = crypto.createHash("sha256"), zeros = Buffer.alloc(8 * 1048576);
  for (let left = size - 4; left > 0; left -= zeros.length) h.update(left >= zeros.length ? zeros : zeros.subarray(0, left));
  h.update(Buffer.from("GVT9"));
  return [p, h.digest("hex")];
}
const ABC = path.join(tmp, "abc.txt"); fs.writeFileSync(ABC, "abc");
const ABC_HASH = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const EMPTY = path.join(tmp, "empty.bin"); fs.writeFileSync(EMPTY, "");
const CARD = path.join(tmp, "card.png"); fs.writeFileSync(CARD, png(1200, 630, [40, 120, 220]));

/* ---------- page factory ---------- */
async function open({ w = 1280, h = 900 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, acceptDownloads: true });
  if (engine === "chromium") await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  const page = await ctx.newPage(); page.setDefaultTimeout(20000);
  const errs = [], external = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/pagead|googlesyndication|Failed to load resource|ERR_FAILED|net::|NS_ERROR|blocked/i.test(m.text())) errs.push("console: " + m.text()); });
  page.on("request", (r) => { let u; try { u = new URL(r.url()); } catch { return; } if (/^https?:$/.test(u.protocol) && u.origin !== origin && !isAd(u)) external.push(u.href); });
  await ctx.route("**/*", (route) => { const u = new URL(route.request().url()); if (u.origin === origin || u.protocol === "blob:" || u.protocol === "data:") return route.continue(); return route.abort(); });
  return { ctx, page, errs, external };
}
/* Resident memory of this run's browser processes (Linux): proves hashing a big file does not pull it into memory. */
function browserRssMiB() {
  if (process.platform !== "linux") return 0;
  let kb = 0;
  for (const pid of fs.readdirSync("/proc").filter((d) => /^\d+$/.test(d))) {
    try { if (!/ms-playwright|pw-browsers/.test(fs.readFileSync(`/proc/${pid}/cmdline`, "utf8"))) continue; kb += Number(/VmRSS:\s+(\d+)/.exec(fs.readFileSync(`/proc/${pid}/status`, "utf8"))[1]); } catch { /* process ended */ }
  }
  return kb / 1024;
}
const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const openTool = (p, id) => p.evaluate((id) => openTool(id), id);
const status = (p) => p.locator("#v9-status").innerText();
async function waitFor(p, fn, arg, ms = 30000) {
  try { await p.waitForFunction(fn, arg, { timeout: ms }); }
  catch (e) { throw Error("timed out waiting for: " + String(fn).replace(/\s+/g, " ").slice(0, 160) + (await p.locator("#v9-status").first().innerText().catch(() => "") ? " | status: " + (await p.locator("#v9-status").first().innerText().catch(() => "")) : "")); }
}
/* clipboard writes are asynchronous: poll the status line */
async function expectStatus(p, re, ms = 8000) {
  const t0 = Date.now(); let last = "";
  while (Date.now() - t0 < ms) { last = await p.locator("#v9-status").innerText(); if (re.test(last)) return last; await p.waitForTimeout(100); }
  throw Error("status never matched " + re + "; last: " + last);
}

try {
  const A = await open();
  const { page } = A;
  await page.goto(base);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });

  /* ---------- catalogue / search / favourites / deep links ---------- */
  const TOOL_CASES = [
    ["sql-formatter", "developer", ["format sql", "beautify sql", "minify sql", "sql pretty print"]],
    ["file-sha256", "privacy-security", ["sha256", "checksum", "verify download hash", "large file hash"]],
    ["epoch-matrix", "developer", ["epoch", "unix timestamp time zone", "nanoseconds", "log timestamp"]],
    ["og-simulator", "links-web", ["open graph", "twitter card", "linkedin preview", "social card"]],
  ];
  await check("catalogue: exactly nine top-level categories, tile counts equal the listed tool count", async () => {
    assert.equal(await page.locator(".cat-tile").count(), 9);
    const total = await page.evaluate(() => tools.filter(isListed).length);
    const sum = await page.locator(".cat-tile small").evaluateAll((ns) => ns.reduce((s, n) => s + parseInt(n.textContent), 0));
    assert.equal(sum, total);
    const ids = await page.evaluate(() => tools.map((t) => t[0])); assert.equal(new Set(ids).size, ids.length, "tool ids are unique");
    for (const [id] of TOOL_CASES) assert.ok(ids.includes(id), id);
  });
  await check("search: every new tool is found by task-style queries", async () => {
    for (const [id, , queries] of TOOL_CASES) for (const q of queries) {
      await page.fill("#toolSearch", q);
      assert.equal(await page.locator(`#toolCatalog [data-open="${id}"]`).count(), 1, `"${q}" should find ${id}`);
    }
    await page.fill("#toolSearch", "");
  });
  await check("categories: each tool appears in exactly its mapped category view", async () => {
    for (const [id, cat] of TOOL_CASES) {
      await page.goto(base + "?category=" + cat);
      assert.equal(await page.locator(`#categoryTools [data-open="${id}"]`).count(), 1, `${id} in ${cat}`);
      for (const other of ["ai-prompts", "productivity", "files-pdf", "images-design", "business-finance", "writing-text"]) {
        await page.goto(base + "?category=" + other);
        assert.equal(await page.locator(`#categoryTools [data-open="${id}"]`).count(), 0, `${id} must not be in ${other}`);
      }
    }
    await page.goto(base);
  });
  await check("favourites and recents: favourite from search, persists across reload, shows on the shelf, can be removed; opening records a recent", async () => {
    for (const [id] of TOOL_CASES) {
      await page.fill("#toolSearch", id.split("-")[0] === "og" ? "open graph" : id === "file-sha256" ? "sha256" : id === "epoch-matrix" ? "epoch" : "sql");
      const fav = page.locator(`#toolCatalog [data-fav="${id}"]`); await fav.click();
      assert.equal(await page.locator(`#toolCatalog [data-fav="${id}"]`).getAttribute("aria-pressed"), "true");
    }
    await page.reload();
    for (const [id] of TOOL_CASES) assert.equal(await page.locator(`#discoveryShelf [role=group][aria-label=Favourites] [data-open="${id}"]`).count(), 1, id + " on shelf after reload");
    await page.locator('#discoveryShelf [data-open="epoch-matrix"]').first().click();
    await page.waitForSelector("#v9-ep-in");
    await page.goto(base);
    assert.equal(await page.locator('#discoveryShelf [aria-label="Recently used"] [data-open="epoch-matrix"]').count(), 1);
    for (const [id] of TOOL_CASES) {
      await page.fill("#toolSearch", id === "og-simulator" ? "open graph" : id === "file-sha256" ? "sha256" : id === "epoch-matrix" ? "epoch" : "sql");
      await page.locator(`#toolCatalog [data-fav="${id}"]`).click();
      assert.equal(await page.locator(`#toolCatalog [data-fav="${id}"]`).getAttribute("aria-pressed"), "false");
    }
    await page.fill("#toolSearch", "");
  });
  await check("deep links: ?tool=<id> opens each tool; legacy and V8 deep links still work", async () => {
    for (const [id, marker] of [["sql-formatter", "#v9-sql-in"], ["file-sha256", "#v9-sha-file"], ["epoch-matrix", "#v9-ep-in"], ["og-simulator", "#v9-og-title"], ["json-formatter", "#v"], ["curl-snippets", "#dev-input"], ["timestamp", "#v"]]) {
      await page.goto(base + "?tool=" + id);
      await page.waitForSelector(marker); assert.ok(await page.locator("#workspace.active").count(), id);
    }
    await page.goto(base + "?tool=epoch-matrix&ts=1700000000123456789&unit=ns&tz=UTC,Asia/Tokyo");
    await page.waitForSelector("#v9-ep-out table");
    assert.match(await page.locator("#v9-ep-out .v9a-lead").innerText(), /2023-11-14T22:13:20\.123456789Z/);
    assert.deepEqual(await page.locator("#v9-ep-chips li span").allInnerTexts(), ["UTC", "Asia/Tokyo"]);
    await page.goto(base + "?tool=epoch-matrix&ts=1&unit=s&tz=Not/AZone,UTC");
    await page.waitForSelector("#v9-ep-out table");
    assert.deepEqual(await page.locator("#v9-ep-chips li span").allInnerTexts(), ["UTC"], "bad zone in a deep link is dropped");
  });

  /* ---------- SQL ---------- */
  await check("sql: beautify, options, minify, placeholders, comments, XSS-inert, warnings", async () => {
    await openTool(page, "sql-formatter");
    await page.fill("#v9-sql-in", "select a,b from t where x=:id and y in ('<img src=x onerror=window.__xss=1>',?) order by a -- done\n;");
    await waitFor(page, () => document.querySelector("#v9-sql-out").value.includes("ORDER BY"));
    const o1 = await page.inputValue("#v9-sql-out");
    assert.equal(o1, ["SELECT", "  a,", "  b", "FROM t", "WHERE x = :id", "  AND y IN ('<img src=x onerror=window.__xss=1>', ?)", "ORDER BY a; -- done"].join("\n"));
    assert.equal(await page.evaluate(() => window.__xss), undefined, "no script execution from SQL text");
    await page.selectOption("#v9-sql-case", "lower"); await waitFor(page, () => document.querySelector("#v9-sql-out").value.startsWith("select"));
    await page.selectOption("#v9-sql-indent", "tab"); await waitFor(page, () => document.querySelector("#v9-sql-out").value.includes("\n\ta,"));
    await page.selectOption("#v9-sql-mode", "minify");
    await waitFor(page, () => !document.querySelector("#v9-sql-out").value.includes("\n"));
    const m = await page.inputValue("#v9-sql-out"); assert.ok(m.startsWith("select a,b from t where x=:id") && !m.includes("-- done"), m);
    await page.check("#v9-sql-keepc"); await waitFor(page, () => document.querySelector("#v9-sql-out").value.includes("-- done"));
    await page.fill("#v9-sql-in", "select 'oops, (a from t"); await waitFor(page, () => document.querySelector("#v9-sql-warn li"));
    assert.match(await page.locator("#v9-sql-warn").innerText(), /Unterminated string/);
    await page.click("#v9-sql-example"); await page.selectOption("#v9-sql-mode", "format");
    await waitFor(page, () => /left join/.test(document.querySelector("#v9-sql-out").value));
    await page.click("#v9-sql-swap"); assert.ok((await page.inputValue("#v9-sql-in")).includes("left join"));
    await page.click("#v9-sql-clear"); assert.equal(await page.inputValue("#v9-sql-out"), "");
  });
  await check("sql: copy, download .sql and URL/storage stay free of the query", async () => {
    await openTool(page, "sql-formatter");
    const secret = "select password_hash_SENTINEL_9f3 from vault"; await page.fill("#v9-sql-in", secret);
    await waitFor(page, () => document.querySelector("#v9-sql-out").value.includes("FROM vault"));
    await page.click("#v9-sql-copy"); await expectStatus(page, /Copied|Clipboard unavailable/);
    if (engine === "chromium") assert.ok((await page.evaluate(() => navigator.clipboard.readText())).includes("FROM vault"));
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#v9-sql-dl")]);
    assert.equal(dl.suggestedFilename(), "query.sql");
    const text = fs.readFileSync(await dl.path(), "utf8"); assert.ok(text.includes("password_hash_SENTINEL_9f3"));
    assert.ok(!page.url().includes("SENTINEL"));
    const stored = await page.evaluate(() => JSON.stringify([localStorage, sessionStorage, document.cookie]));
    assert.ok(!stored.includes("SENTINEL"), "SQL must not be written to browser storage");
  });

  /* ---------- SHA-256 ---------- */
  await check("sha256: known vector, empty file, expected-hash match / mismatch / invalid / sha256sum lines", async () => {
    await openTool(page, "file-sha256");
    await page.setInputFiles("#v9-sha-file", [ABC, EMPTY]);
    await waitFor(page, () => document.querySelectorAll("#v9-sha-list .v9a-hash").length === 2 && [...document.querySelectorAll("#v9-sha-list .v9a-hash")].every((e) => e.textContent.length === 64));
    const hashes = await page.locator("#v9-sha-list .v9a-hash").allInnerTexts();
    assert.deepEqual(hashes, [ABC_HASH, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"]);
    await page.fill("#v9-sha-expected", ABC_HASH.toUpperCase());
    assert.match(await page.locator("#v9-sha-list .v9a-verdict").first().innerText(), /Match/);
    await page.fill("#v9-sha-expected", "0".repeat(64)); assert.match(await page.locator("#v9-sha-list .v9a-verdict").first().innerText(), /MISMATCH/);
    await page.fill("#v9-sha-expected", "12345"); assert.match(await page.locator("#v9-sha-list .v9a-verdict").first().innerText(), /not a 64-character/);
    await page.fill("#v9-sha-expected", ABC_HASH + "  abc.txt\n" + "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  empty.bin");
    assert.deepEqual(await page.locator("#v9-sha-list .v9a-verdict").allInnerTexts(), ["Match: the file's SHA-256 equals the expected value.", "Match: the file's SHA-256 equals the expected value."]);
    await page.click("#v9-sha-copy"); await expectStatus(page, /Copied|Clipboard unavailable/);
    if (engine === "chromium") assert.equal(await page.evaluate(() => navigator.clipboard.readText()), ABC_HASH + "  abc.txt\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  empty.bin");
  });
  await check(`sha256: ${BIG_MIB} MiB file hashes correctly with flat JS memory, progress and speed shown`, async () => {
    const [big, want] = sparseFile("big.bin", BIG_MIB * 1048576 + 777);
    await openTool(page, "file-sha256"); await page.click("#v9-sha-clear");
    const rss0 = browserRssMiB();
    await page.setInputFiles("#v9-sha-file", big);
    await waitFor(page, () => { const p = document.querySelector("#v9-sha-list progress"); return p && p.value > 5; });
    let peak = rss0;
    const sampler = setInterval(() => { peak = Math.max(peak, browserRssMiB()); }, 250);
    await waitFor(page, () => document.querySelector("#v9-sha-list .v9a-hash").textContent.length === 64, undefined, 600000);
    clearInterval(sampler);
    assert.equal(await page.locator("#v9-sha-list .v9a-hash").innerText(), want);
    assert.match(await page.locator("#v9-sha-list .v9a-muted").nth(1).innerText(), /Done in/);
    { const growth = peak - rss0; console.log(`     browser resident-memory growth while hashing ${BIG_MIB} MiB: ${growth.toFixed(0)} MiB (file is ${BIG_MIB} MiB)`); assert.ok(growth < BIG_MIB * 0.5 + 60, "browser memory grew " + growth.toFixed(0) + " MiB for a " + BIG_MIB + " MiB file"); }
    fs.rmSync(big, { force: true });
  });
  await check("sha256: cancel stops promptly, marks the file cancelled, and the page stays usable", async () => {
    const [big] = sparseFile("cancel.bin", 1536 * 1048576);
    await openTool(page, "file-sha256");
    await page.setInputFiles("#v9-sha-file", big);
    await waitFor(page, () => { const p = document.querySelector("#v9-sha-list progress"); return p && p.value > 3; });
    await page.click("#v9-sha-cancel");
    await waitFor(page, () => /Cancelled/.test(document.querySelector("#v9-sha-list .v9a-muted:nth-of-type(2), #v9-sha-list div.v9a-muted").textContent), undefined, 15000);
    assert.equal(await page.locator("#v9-sha-list .v9a-hash").innerText(), "");
    await page.click("#v9-sha-clear"); await page.setInputFiles("#v9-sha-file", ABC);
    await waitFor(page, () => document.querySelector("#v9-sha-list .v9a-hash").textContent.length === 64);
    fs.rmSync(big, { force: true });
  });
  if (HUGE_MIB) await check(`sha256: ${HUGE_MIB} MiB (>4 GiB) file completes and matches node's SHA-256`, async () => {
    const [huge, want] = sparseFile("huge.bin", HUGE_MIB * 1048576 + 4321);
    await openTool(page, "file-sha256"); await page.click("#v9-sha-clear");
    const rss0 = browserRssMiB(); let peak = rss0;
    await page.setInputFiles("#v9-sha-file", huge);
    const sampler = setInterval(() => { peak = Math.max(peak, browserRssMiB()); }, 1000);
    await waitFor(page, () => document.querySelector("#v9-sha-list .v9a-hash").textContent.length === 64, undefined, 1500000);
    clearInterval(sampler);
    assert.equal(await page.locator("#v9-sha-list .v9a-hash").innerText(), want);
    { const growth = peak - rss0; console.log(`     ${HUGE_MIB} MiB: ${await page.locator("#v9-sha-list .v9a-muted").nth(1).innerText()}; browser resident-memory growth ${growth.toFixed(0)} MiB`); assert.ok(growth < 400, "browser memory grew " + growth.toFixed(0) + " MiB for a " + HUGE_MIB + " MiB file"); }
    fs.rmSync(huge, { force: true });
  });

  /* ---------- Epoch matrix ---------- */
  await check("epoch: nanosecond precision, zone offsets, DST, add/remove zones, validation", async () => {
    await openTool(page, "epoch-matrix");
    await page.fill("#v9-ep-in", "1700000000123456789"); await page.selectOption("#v9-ep-unit", "ns");
    await waitFor(page, () => document.querySelector("#v9-ep-out .v9a-lead"));
    assert.match(await page.locator("#v9-ep-out .v9a-lead").innerText(), /2023-11-14T22:13:20\.123456789Z/);
    const row = (z) => page.locator(`#v9-ep-out tbody tr:has(th:text-is("${z}"))`).first();
    assert.match(await row("America/New_York").innerText(), /2023-11-14 17:13:20\s+UTC-05:00\s+EST\s+standard\s+same day/);
    assert.match(await row("Asia/Tokyo").innerText(), /2023-11-15 07:13:20\s+UTC\+09:00.*\+1 d/);
    await page.fill("#v9-ep-in", "1721044800"); await page.selectOption("#v9-ep-unit", "s");
    await waitFor(page, () => /EDT/.test(document.querySelector("#v9-ep-out").innerText));
    assert.match(await row("America/New_York").innerText(), /UTC-04:00\s+EDT\s+DST/);
    await page.fill("#v9-ep-add", "Australia/Sydney"); await page.press("#v9-ep-add", "Enter");
    await waitFor(page, () => document.querySelector("#v9-ep-out").innerText.includes("Australia/Sydney"));
    assert.match(await row("Australia/Sydney").innerText(), /UTC\+10:00.*standard/);
    await page.fill("#v9-ep-add", "Mars/Base"); await page.click("#v9-ep-addbtn"); await expectStatus(page, /Unknown time zone/);
    await page.click('button[aria-label="Remove Australia/Sydney"]');
    await waitFor(page, () => !document.querySelector("#v9-ep-out").innerText.includes("Australia/Sydney"));
    await page.fill("#v9-ep-in", "not a time"); await waitFor(page, () => document.querySelector("#v9-ep-out .v9a-bad"));
    assert.match(await page.locator("#v9-ep-out .v9a-bad").innerText(), /Unrecognised format/);
    await page.fill("#v9-ep-in", "1e9"); await waitFor(page, () => /exponent|digits/.test(document.querySelector("#v9-ep-out").innerText));
  });
  await check("epoch: date text, DST gap warning, auto unit guess, difference, formats, URL sync and share link", async () => {
    await openTool(page, "epoch-matrix");
    await page.selectOption("#v9-ep-read", "America/New_York"); await page.fill("#v9-ep-in", "2024-03-10 02:30:00");
    await waitFor(page, () => document.querySelector("#v9-ep-out .v9a-warnline"));
    assert.match(await page.locator("#v9-ep-out .v9a-warnline").innerText(), /does not exist in America\/New_York/);
    await page.selectOption("#v9-ep-read", "UTC"); await page.selectOption("#v9-ep-unit", "auto"); await page.fill("#v9-ep-in", "1700000000123");
    await waitFor(page, () => /unit guessed/.test(document.querySelector("#v9-ep-out .v9a-lead").innerText));
    await page.fill("#v9-ep-cmp", "1700003600123"); await waitFor(page, () => document.querySelector("#v9-ep-out .v9a-cmp"));
    assert.match(await page.locator("#v9-ep-out .v9a-cmp").innerText(), /1h later/);
    assert.match(await page.locator('#v9-ep-out tr:has(th:text-is("Windows FILETIME"))').innerText(), /133444736001230000/);
    assert.ok(page.url().includes("ts=1700000000123") && page.url().includes("tool=epoch-matrix"), "URL carries the non-sensitive epoch state: " + page.url());
    await page.click("#v9-ep-link"); await expectStatus(page, /Copied|Clipboard unavailable/);
    if (engine === "chromium") assert.match(await page.evaluate(() => navigator.clipboard.readText()), /\?tool=epoch-matrix&ts=1700000000123&unit=auto&tz=/);
    await page.click("#v9-ep-out [data-copy]"); await expectStatus(page, /Copied|Clipboard unavailable/);
    await page.evaluate(() => closeTool()); assert.ok(!/ts=/.test(page.url()), "closing the tool removes its URL state");
  });
  await check("epoch: bulk log lines (ISO, CLF, epoch, no timestamp) with deltas and formula-safe TSV copy", async () => {
    await openTool(page, "epoch-matrix"); await page.click("#v9-ep-tab-batch");
    await page.fill("#v9-ep-lines", ["2024-05-01T10:00:00.250Z INFO start", '127.0.0.1 - - [01/May/2024:10:00:02 +0000] "GET /"', "ts=1714557605250 level=warn", "no timestamp here", "=2024-13-45T00:00:00Z weird"].join("\n"));
    await waitFor(page, () => document.querySelectorAll("#v9-ep-out tbody tr").length === 5);
    const rows = await page.locator("#v9-ep-out tbody tr").allInnerTexts();
    assert.match(rows[0], /2024-05-01T10:00:00\.250000000Z/); assert.match(rows[1], /2024-05-01T10:00:02\.000000000Z[\s\S]*1s 750ms/);
    assert.match(rows[2], /2024-05-01T10:00:05\.250000000Z[\s\S]*3s 250ms/); assert.match(rows[3], /No timestamp found/); assert.match(rows[4], /does not exist|Unrecognised/);
    await page.click("#v9-ep-bcopy"); await expectStatus(page, /Copied|Clipboard unavailable/);
  });

  /* ---------- OG simulator ---------- */
  await check("og: sample renders X, LinkedIn and Slack approximations; truncation, lint, tags, XSS-inert", async () => {
    await openTool(page, "og-simulator"); await page.click("#v9-og-sample");
    assert.equal(await page.locator(".v9a-prev").count(), 3);
    assert.deepEqual(await page.locator(".v9a-cap strong").allInnerTexts(), ["X (Twitter)", "LinkedIn", "Slack"]);
    assert.equal(await page.locator(".v9a-badge").count(), 3);
    assert.match(await page.locator(".v9a-card-x .v9a-title").innerText(), /^Ship faster with GoVibeTool/);
    assert.equal(await page.locator(".v9a-card-linkedin .v9a-dom").innerText(), "example.com");
    assert.equal(await page.locator(".v9a-card-slack .v9a-site").innerText(), "GoVibeTool");
    assert.match(await page.locator("#v9-og-lint").innerText(), /No image/);
    await page.fill("#v9-og-title", '<img src=x onerror="window.__xss=1"> ' + "long title ".repeat(12));
    await waitFor(page, () => document.querySelector(".v9a-card-x .v9a-title").textContent.endsWith("…"));
    assert.ok((await page.locator(".v9a-card-x .v9a-title").innerText()).startsWith("<img src=x"), "shown as literal text");
    assert.equal(await page.locator(".v9a-previews img").count(), 0); assert.equal(await page.evaluate(() => window.__xss), undefined);
    assert.match(await page.locator(".v9a-prev").first().innerText(), /title is cut here/);
    const tags = await page.inputValue("#v9-og-tags"); assert.ok(tags.includes('<meta property="og:title" content="&lt;img src=x onerror=&quot;window.__xss=1&quot;&gt;')); assert.ok(!tags.includes("<img"));
    await page.fill("#v9-og-image", "/relative.png"); await waitFor(page, () => /absolute/.test(document.querySelector("#v9-og-lint").innerText));
    await page.selectOption("#v9-og-theme", "dark"); assert.ok(await page.locator("#v9-og-previews.dark").count());
    await page.selectOption("#v9-og-card", "summary"); assert.ok(await page.locator(".v9a-card-x.small").count());
    await page.click("#v9-og-copy"); await expectStatus(page, /Copied|Clipboard unavailable/);
  });
  await check("og: import pasted <head>, fields populate, relative image flagged", async () => {
    await openTool(page, "og-simulator");
    await page.locator("summary", { hasText: "Import" }).click();
    await page.fill("#v9-og-html", '<title>Fallback</title><meta property="og:title" content="Imported &amp; ready"><meta property="og:description" content="Desc here"><meta property="og:image" content="/img.png"><meta name="twitter:card" content="summary_large_image"><link rel="canonical" href="https://www.site.test/p">');
    await page.click("#v9-og-import");
    assert.equal(await page.inputValue("#v9-og-title"), "Imported & ready"); assert.equal(await page.inputValue("#v9-og-url"), "https://www.site.test/p"); assert.equal(await page.inputValue("#v9-og-card"), "summary_large_image");
    assert.match(await page.locator("#v9-og-lint").innerText(), /absolute/);
    await page.fill("#v9-og-html", "<p>no tags</p>"); await page.click("#v9-og-import"); await expectStatus(page, /No meta tags/);
  });
  await check("og: local image preview stays on-device, PNG export works for every platform", async () => {
    A.external.length = 0;
    await openTool(page, "og-simulator"); await page.click("#v9-og-sample");
    await page.setInputFiles("#v9-og-file", CARD);
    await waitFor(page, () => document.querySelectorAll(".v9a-previews img").length === 3 && [...document.querySelectorAll(".v9a-previews img")].every((i) => i.naturalWidth > 0));
    for (const p of ["x", "linkedin", "slack"]) {
      const [dl] = await Promise.all([page.waitForEvent("download"), page.click(`[data-export="${p}"]`)]);
      assert.equal(dl.suggestedFilename(), `social-card-${p}.png`);
      const buf = fs.readFileSync(await dl.path()); assert.equal(buf.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
      const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20); assert.equal(w, p === "slack" ? 1000 : 1200); assert.ok(h > 300, p + " height " + h);
      if (p === "x") fs.copyFileSync(await dl.path(), path.join(out, "export-x.png"));
    }
    assert.deepEqual(A.external, [], "no third-party requests");
  });
  await check("og: remote image is requested only after the explicit opt-in; blocked export explains itself", async () => {
    const reqs = [];
    const p2 = await open(); p2.page.on("request", (r) => { if (r.url().startsWith("https://img.example.test")) reqs.push(r.url()); });
    await p2.page.goto(base + "?tool=og-simulator"); await p2.page.waitForSelector("#v9-og-title");
    await p2.page.click("#v9-og-sample"); await p2.page.fill("#v9-og-image", "https://img.example.test/card.png");
    await p2.page.waitForTimeout(600); assert.deepEqual(reqs, [], "typing a URL must not contact the host");
    assert.equal(await p2.page.locator(".v9a-previews img").count(), 0);
    assert.match(await p2.page.locator(".v9a-card-x .v9a-ph").innerText(), /not loaded/);
    await p2.page.check("#v9-og-loadurl");
    await waitFor(p2.page, () => document.querySelectorAll(".v9a-previews img, .v9a-ph").length >= 3);
    await p2.page.waitForTimeout(800); assert.ok(reqs.length >= 1, "opt-in loads the image");
    await p2.page.click('[data-export="x"]'); await waitFor(p2.page, () => /Export unavailable|Downloaded/.test(document.querySelector("#v9-status").textContent));
    await expectStatus(p2.page, /Export unavailable/);
    await p2.ctx.close();
  });

  /* ---------- accessibility basics, layout, console, privacy, offline ---------- */
  await check("a11y: every control in every tool is labelled; workspace is focusable; no document-level horizontal scroll", async () => {
    for (const [id] of TOOL_CASES) {
      await openTool(page, id);
      const unlabeled = await page.evaluate(() => [...document.querySelectorAll("#workspace input, #workspace select, #workspace textarea, #workspace progress")].filter((el) => {
        if (el.type === "hidden") return false;
        const labelled = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.closest("label");
        return !labelled;
      }).map((el) => el.id || el.tagName));
      assert.deepEqual(unlabeled, [], id + " has unlabelled controls");
      const buttons = await page.evaluate(() => [...document.querySelectorAll("#workspace button")].filter((b) => !(b.textContent.trim() || b.getAttribute("aria-label"))).length);
      assert.equal(buttons, 0, id + " has unnamed buttons");
      assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), "workspace");
    }
  });
  await check("layout: all four tools fit a 375px phone without page-level horizontal scroll", async () => {
    const M = await open({ w: 375, h: 800 });
    await M.page.goto(base); await M.page.evaluate(async () => { await navigator.serviceWorker.ready; });
    for (const [id, marker] of [["sql-formatter", "#v9-sql-in"], ["file-sha256", "#v9-sha-file"], ["epoch-matrix", "#v9-ep-in"], ["og-simulator", "#v9-og-title"]]) {
      await openTool(M.page, id); await M.page.waitForSelector(marker);
      if (id === "epoch-matrix") { await M.page.fill("#v9-ep-in", "1700000000123456789"); await M.page.selectOption("#v9-ep-unit", "ns"); await M.page.waitForSelector("#v9-ep-out table"); }
      if (id === "og-simulator") await M.page.click("#v9-og-sample");
      if (id === "sql-formatter") await M.page.click("#v9-sql-example");
      assert.ok((await overflow(M.page)) <= 1, id + " overflows by " + (await overflow(M.page)) + "px");
    }
    await M.page.screenshot({ path: path.join(out, "mobile-og.png") });
    assert.deepEqual(M.errs, []); await M.ctx.close();
  });
  await check("desktop screenshots captured for review", async () => {
    for (const [id, prep] of [["sql-formatter", async () => page.click("#v9-sql-example")], ["epoch-matrix", async () => { await page.fill("#v9-ep-in", "1700000000123456789"); await page.selectOption("#v9-ep-unit", "ns"); await page.waitForSelector("#v9-ep-out table"); }], ["og-simulator", async () => { await page.click("#v9-og-sample"); await page.setInputFiles("#v9-og-file", CARD); }], ["file-sha256", async () => { await page.setInputFiles("#v9-sha-file", ABC); await page.waitForFunction(() => document.querySelector("#v9-sha-list .v9a-hash").textContent.length === 64); }]]) {
      await openTool(page, id); await prep(); await page.waitForTimeout(300);
      await page.locator("#workspace").screenshot({ path: path.join(out, "desktop-" + id + ".png") });
    }
  });
  await check("privacy: after using every tool, no request left this origin and no input reached storage or the URL", async () => {
    assert.deepEqual(A.external, [], "external requests");
    const dump = await page.evaluate(() => JSON.stringify({ l: Object.entries(localStorage), s: Object.entries(sessionStorage), c: document.cookie, u: location.href }));
    for (const s of ["SENTINEL", "abc.txt", "big.bin", "select password", "Imported & ready", "ts=1700000000123456789"]) assert.ok(!dump.includes(s), "found " + s + " in storage/URL");
  });
  await check("offline: with the network cut, every tool still loads from the service-worker cache and converts", async () => {
    const O = await open();
    await O.page.goto(base); await O.page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await O.page.reload({ waitUntil: "load" });
    await O.page.waitForFunction(() => navigator.serviceWorker.controller);
    await O.ctx.setOffline(true);
    await O.page.goto(base + "?tool=sql-formatter"); await O.page.waitForSelector("#v9-sql-in");
    await O.page.fill("#v9-sql-in", "select 1"); await waitFor(O.page, () => document.querySelector("#v9-sql-out").value === "SELECT 1");
    await O.page.goto(base + "?tool=epoch-matrix&ts=0&unit=s&tz=UTC"); await O.page.waitForSelector("#v9-ep-out table");
    assert.match(await O.page.locator("#v9-ep-out .v9a-lead").innerText(), /1970-01-01T00:00:00\.000000000Z/);
    await O.page.goto(base + "?tool=file-sha256"); await O.page.setInputFiles("#v9-sha-file", ABC);
    await waitFor(O.page, () => document.querySelector("#v9-sha-list .v9a-hash").textContent.length === 64);
    assert.equal(await O.page.locator("#v9-sha-list .v9a-hash").innerText(), ABC_HASH);
    await O.page.goto(base + "?tool=og-simulator"); await O.page.click("#v9-og-sample"); assert.equal(await O.page.locator(".v9a-prev").count(), 3);
    assert.deepEqual(O.errs, []); await O.ctx.close();
  });
  await check("console: no page errors across the whole run", async () => { assert.deepEqual(A.errs, []); });
  await A.ctx.close();
} finally {
  clearTimeout(watchdog);
  await browser.close(); await srv.stop();
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.writeFileSync(path.join(out, "results.json"), JSON.stringify({ engine, root: path.relative(repo, root) || ".", checks }, null, 2));
}
const failed = checks.filter((c) => !c.ok);
console.log(`\n${engine}: ${checks.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
