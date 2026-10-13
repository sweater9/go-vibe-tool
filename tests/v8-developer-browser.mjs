/* Actual Chromium/Firefox/WebKit QA; local static server, no live deployments. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
const pw = await import(process.env.PLAYWRIGHT_PACKAGE || "playwright");
const engine = process.argv[2] || "chromium",
  root = path.resolve(process.env.SITE_ROOT || "."),
  out = process.env.DEV_QA_ARTIFACTS || `artifacts/developer-${engine}`;
await fs.mkdir(out, { recursive: true });
const server = http.createServer(async (req, res) => {
  try {
    let file = path.resolve(
      root,
      "." + decodeURIComponent(new URL(req.url, "http://x").pathname),
    );
    if (!file.startsWith(root + path.sep) && file !== root) throw Error("path");
    if ((await fs.stat(file)).isDirectory())
      file = path.join(file, "index.html");
    let data = await fs.readFile(file);
    res
      .writeHead(200, {
        "Content-Type":
          {
            ".html": "text/html",
            ".js": "application/javascript",
            ".mjs": "application/javascript",
            ".css": "text/css",
            ".json": "application/json",
            ".svg": "image/svg+xml",
            ".webmanifest": "application/manifest+json",
          }[path.extname(file)] || "application/octet-stream",
      })
      .end(data);
  } catch {
    res.writeHead(404).end("Not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port,
  base = `http://127.0.0.1:${port}/`;
let browser;
const checks = [];
const watchdog = setTimeout(async () => {
  checks.push({
    label: "Suite watchdog",
    ok: false,
    error: "Browser setup or execution exceeded 180 seconds.",
  });
  await fs.writeFile(
    path.join(out, "results.json"),
    JSON.stringify({ engine, checks }, null, 2),
  );
  process.exit(1);
}, 180000);
async function check(label, fn) {
  try {
    await fn();
    checks.push({ label, ok: true });
    console.log("PASS", label);
  } catch (e) {
    checks.push({ label, ok: false, error: e.message });
    console.error("FAIL", label, e.message);
  }
}
try {
  browser = await pw[engine].launch({ headless: true });
  for (const width of [375, 1280]) {
    const ctx = await browser.newContext({
      viewport: { width, height: 900 },
      acceptDownloads: true,
    });
    await ctx.grantPermissions(
      engine === "chromium" ? ["clipboard-read", "clipboard-write"] : [],
    );
    const page = await ctx.newPage();
    page.setDefaultTimeout(10000);
    const errors = [],
      requests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (!r.url().startsWith(base) && !r.url().startsWith("blob:"))
        requests.push(r.url());
    });
    await ctx.route(/https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await page.goto(base);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller)
        await new Promise((r) =>
          navigator.serviceWorker.addEventListener("controllerchange", r, {
            once: true,
          }),
        );
    });
    const open = (id) => page.evaluate((id) => openTool(id), id);
    await check(
      `${width} nine categories, correct counts, search and all five tools reachable`,
      async () => {
        assert.equal(await page.locator(".cat-tile").count(), 9);
        const total = await page.evaluate(() => tools.filter(isListed).length);
        const sum = await page
          .locator(".cat-tile small")
          .evaluateAll((ns) =>
            ns.reduce((s, n) => s + parseInt(n.textContent), 0),
          );
        assert.equal(sum, total);
        for (const [id, q, category] of [
          ["curl-snippets", "Multi-Language", "developer"],
          ["key-hash", "Universal Key", "privacy-security"],
          ["regex-playground", "Regex Visualizer", "developer"],
          ["tailwind-css", "Tailwind", "images-design"],
          ["shadow-glass", "Glassmorphism", "images-design"],
        ]) {
          await page.fill("#toolSearch", q);
          assert.equal(
            await page.locator(`#toolCatalog [data-open="${id}"]`).count(),
            1,
          );
          await page.goto(base + "?category=" + category);
          assert.equal(
            await page.locator(`#categoryTools [data-open="${id}"]`).count(),
            1,
          );
          await page.locator(`#categoryTools [data-open="${id}"]`).click();
          await page.waitForSelector("#dev-output");
          assert.equal(
            await page.locator("#workspace").getAttribute("data-dev-tool"),
            id,
          );
          await page.goto(base);
        }
      },
    );
    await check(
      `${width} cURL six generators, copy credential warning, rejection and literal XSS`,
      async () => {
        await open("curl-snippets");
        for (const lang of [
          "fetch",
          "axios",
          "requests",
          "httpx",
          "go",
          "php",
        ]) {
          await page.selectOption("#dev-language", lang);
          assert.match(
            await page.inputValue("#dev-output"),
            /api\.example\.com/,
          );
          assert.match(await page.inputValue("#dev-output"), /Authorization/);
        }
        let warning = false;
        page.once("dialog", async (d) => {
          warning = /credentials|secrets|authorization/i.test(d.message());
          await d.dismiss();
        });
        await page.click("#dev-copy");
        assert.ok(warning);
        assert.match(
          await page.locator("#dev-status").innerText(),
          /cancelled/,
        );
        await page.fill("#dev-input", "curl https://example.com --compressed");
        await page.click("#dev-run");
        assert.match(
          await page.locator("#dev-warning").innerText(),
          /Unsupported/,
        );
        assert.equal(await page.inputValue("#dev-output"), "");
        await page.fill(
          "#dev-input",
          `curl 'https://example.com' --data-raw '<img src=x onerror="window.__xss=1">'`,
        );
        await page.click("#dev-run");
        assert.match(await page.inputValue("#dev-output"), /onerror/);
        assert.equal(await page.evaluate(() => window.__xss), undefined);
        await page.fill("#dev-input", "curl https://example.com; whoami");
        await page.click("#dev-run");
        assert.equal(await page.inputValue("#dev-output"), "");
      },
    );
    await check(
      `${width} native hash/HMAC, UUID batch, token bounds, export and secret clearing`,
      async () => {
        await open("key-hash");
        await page.fill("#dev-input", "abc");
        await page.click("#dev-run");
        await page.waitForFunction(
          () => document.getElementById("dev-output").value.length === 64,
        );
        assert.equal(
          await page.inputValue("#dev-output"),
          "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
        );
        await page.selectOption("#dev-mode", "hmac");
        await page.fill("#dev-key", "secret");
        await page.click("#dev-run");
        await page.waitForFunction(
          () => document.getElementById("dev-output").value.length === 64,
        );
        assert.equal(
          await page.inputValue("#dev-output"),
          "9946dad4e00e913fc8be8e5d3f7e110a4a9e832f83fb09c345285d78638d8a0e",
        );
        await page.selectOption("#dev-algorithm", "SHA-1");
        await page.click("#dev-run");
        await page.waitForFunction(
          () => document.getElementById("dev-output").value.length === 40,
        );
        assert.match(await page.locator("#dev-warning").innerText(), /legacy/);
        await page.selectOption("#dev-mode", "uuid");
        await page.selectOption("#dev-batch", "100");
        await page.click("#dev-run");
        assert.equal(
          (await page.inputValue("#dev-output")).split("\n").length,
          100,
        );
        const download = page.waitForEvent("download");
        await page.click("#dev-export");
        assert.match((await download).suggestedFilename(), /key-hash\.txt$/);
        await page.selectOption("#dev-mode", "token");
        await page.fill("#dev-bytes", "0");
        await page.click("#dev-run");
        assert.match(
          await page.locator("#dev-warning").innerText(),
          /1 to 4096/,
        );
        await page.fill("#dev-bytes", "32");
        await page.click("#dev-run");
        assert.match(await page.inputValue("#dev-output"), /^[a-f0-9]{64}$/);
        await page.selectOption("#dev-mode", "api");
        await page.click("#dev-run");
        assert.match(
          await page.inputValue("#dev-output"),
          /^gvt_[a-f0-9]{64}$/,
        );
        await page.click("#dev-clear");
        assert.equal(await page.inputValue("#dev-key"), "");
        assert.equal(await page.inputValue("#dev-output"), "");
      },
    );
    await check(
      `${width} regex captures, zero-width, invalid patterns, ReDoS timeout and recovery`,
      async () => {
        await open("regex-playground");
        await page.waitForFunction(() =>
          document.getElementById("dev-output").value.startsWith("["),
        );
        assert.match(
          await page.locator("#dev-matches").innerText(),
          /Named word/,
        );
        assert.ok(
          await page.locator("#dev-highlight .dev-inline-capture").count(),
        );
        await page.fill("#dev-pattern", "(?=a)");
        await page.fill("#dev-input", "aaa");
        await page.waitForFunction(() =>
          document
            .getElementById("dev-status")
            .textContent.startsWith("3 matches"),
        );
        assert.equal(await page.locator("#dev-highlight mark").count(), 3);
        await page.fill("#dev-pattern", "[");
        await page.waitForFunction(() =>
          document.getElementById("dev-status").textContent.includes("Invalid"),
        );
        assert.equal(await page.inputValue("#dev-output"), "");
        await page.fill("#dev-pattern", "(a+)+$");
        await page.fill("#dev-input", "a".repeat(50000) + "!");
        await page.waitForFunction(() =>
          document
            .getElementById("dev-warning")
            .textContent.includes("timed out"),
        );
        assert.equal(await page.evaluate(() => 1 + 1), 2);
        await page.fill("#dev-pattern", "a+");
        await page.fill("#dev-input", "aaa");
        await page.waitForFunction(() =>
          document
            .getElementById("dev-status")
            .textContent.startsWith("1 matches"),
        );
        for (const preset of [
          "email",
          "RFC3339",
          "IPv4",
          "IPv6",
          "slug",
          "semver",
        ]) {
          await page.selectOption("#dev-pattern-preset", preset);
          await page.waitForFunction(() =>
            document.getElementById("dev-output").value.startsWith("["),
          );
          assert.ok(JSON.parse(await page.inputValue("#dev-output")).length);
          assert.ok(
            (await page.locator("#dev-preset-note").innerText()).length,
          );
        }
        await page.selectOption("#dev-pattern-preset", "custom");
        await page.fill("#dev-pattern", ".+");
        await page.fill("#dev-input", '<svg onload="window.__regexXss=1">');
        await page.waitForFunction(() =>
          document
            .getElementById("dev-status")
            .textContent.startsWith("1 matches"),
        );
        assert.equal(await page.evaluate(() => window.__regexXss), undefined);
      },
    );
    await check(
      `${width} two-way CSS conversion, examples, editing and preserved properties`,
      async () => {
        await open("tailwind-css");
        assert.match(await page.inputValue("#dev-output"), /flex p-4/);
        assert.match(await page.inputValue("#dev-residual"), /scroll-behavior/);
        await page.selectOption("#dev-direction", "tw");
        await page.click("#dev-example");
        assert.match(await page.inputValue("#dev-output"), /display: flex/);
        assert.match(await page.inputValue("#dev-residual"), /hover:/);
        await page.fill("#dev-output", "color: red;");
        assert.equal(await page.inputValue("#dev-output"), "color: red;");
        await page.selectOption("#dev-direction", "css");
        await page.fill(
          "#dev-input",
          "width: calc(100% - 1rem); unknown-property: x;",
        );
        await page.click("#dev-run");
        assert.match(
          await page.inputValue("#dev-output"),
          /w-\[calc\(100%_-_1rem\)\]/,
        );
        assert.match(
          await page.inputValue("#dev-residual"),
          /unknown-property/,
        );
      },
    );
    await check(
      `${width} multilayer shadow, glass controls, presets, reset and arbitrary values`,
      async () => {
        await open("shadow-glass");
        await page.click("#dev-add");
        assert.equal(await page.locator(".dev-layer").count(), 2);
        await page.locator("#dev-layer-0-x").fill("20");
        await page.locator("#dev-layer-0-x").dispatchEvent("input");
        assert.match(await page.inputValue("#dev-output"), /20px/);
        await page.selectOption("#dev-preset", "neon");
        assert.equal(await page.locator(".dev-layer").count(), 2);
        assert.match(await page.inputValue("#dev-output"), /139, 92, 246/);
        await page.selectOption("#dev-format", "tailwind");
        assert.match(await page.inputValue("#dev-output"), /shadow-\[/);
        assert.match(
          await page.inputValue("#dev-output"),
          /\[backdrop-filter:/,
        );
        await page.click("#dev-reset");
        assert.equal(await page.locator(".dev-layer").count(), 1);
        assert.equal(await page.inputValue("#dev-layer-0-x"), "0");
      },
    );
    await check(
      `${width} responsive layout and labelled keyboard controls for every tool`,
      async () => {
        for (const id of [
          "curl-snippets",
          "key-hash",
          "regex-playground",
          "tailwind-css",
          "shadow-glass",
        ]) {
          await open(id);
          assert.ok(
            await page.evaluate(
              () =>
                document.documentElement.scrollWidth <=
                document.documentElement.clientWidth,
            ),
            "horizontal overflow: " + id,
          );
          assert.equal(
            await page
              .locator(
                "#workspace input:not([type=checkbox]),#workspace textarea,#workspace select",
              )
              .evaluateAll(
                (ns) =>
                  ns.filter(
                    (n) => !document.querySelector(`label[for="${n.id}"]`),
                  ).length,
              ),
            0,
          );
          await page.locator("#dev-copy").focus();
          assert.equal(
            await page.evaluate(() => document.activeElement.id),
            "dev-copy",
          );
          await page.screenshot({
            path: path.join(out, `${width}-${id}.png`),
            fullPage: true,
          });
        }
      },
    );
    await check(
      `${width} no secret persistence, external requests or JavaScript errors`,
      async () => {
        assert.deepEqual(errors, []);
        assert.deepEqual(requests, []);
        const stored = await page.evaluate(() =>
          JSON.stringify({ ...localStorage, ...sessionStorage }),
        );
        assert.ok(
          !stored.includes("EXAMPLE_TOKEN") &&
            !stored.includes("secret") &&
            !stored.includes("<svg"),
        );
      },
    );
    await check(
      `${width} offline with origin stopped: all five tools and worker execute from cache`,
      async () => {
        await page.waitForFunction(
          () => navigator.serviceWorker.controller !== null,
        );
        await page.waitForFunction(
          async () => !!(await caches.match(location.href)),
        );
        await ctx.unrouteAll({ behavior: "wait" });
        const stopped = new Promise((r) => server.close(r));
        server.closeAllConnections();
        await stopped;
        try {
          await page.reload({ waitUntil: "domcontentloaded" });
          await page.waitForSelector(".cat-tile");
          assert.equal(await page.locator(".cat-tile").count(), 9);
          await open("curl-snippets");
          assert.match(await page.inputValue("#dev-output"), /fetch/);
          await open("key-hash");
          await page.click("#dev-run");
          await page.waitForFunction(
            () => document.getElementById("dev-output").value.length === 64,
          );
          await open("regex-playground");
          await page.waitForFunction(() =>
            document.getElementById("dev-output").value.startsWith("["),
          );
          await open("tailwind-css");
          assert.match(await page.inputValue("#dev-output"), /flex/);
          await open("shadow-glass");
          assert.match(await page.inputValue("#dev-output"), /box-shadow/);
        } finally {
          await new Promise((r) => server.listen(port, "127.0.0.1", r));
        }
      },
    );
    await ctx.close();
  }
} catch (e) {
  checks.push({
    label: "Browser setup or fatal execution",
    ok: false,
    error: e.stack,
  });
  console.error(e.stack);
} finally {
  clearTimeout(watchdog);
  if (browser) await browser.close();
  await new Promise((r) => server.close(r));
  await fs.writeFile(
    path.join(out, "results.json"),
    JSON.stringify({ engine, checks }, null, 2),
  );
}
if (checks.some((c) => !c.ok)) process.exitCode = 1;
