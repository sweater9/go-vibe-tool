import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
const c = createRequire(import.meta.url)("../studios-core.js");
test("legacy aliases match real IDs; Percentage Change is independent", () => {
  assert.equal(c.aliases["link-fingerprint"], "url");
  assert.equal(c.aliases["hourly-rate"], "freelance");
  assert.equal(c.aliases["percentage-change"], undefined);
  for (const id of [
    "url-cleaner",
    "url-inspector",
    "utm-builder",
    "tracking-check",
    "qr-payload",
    "qr-studio",
    "metadata",
    "pii-secret-redactor",
  ])
    assert.ok(c.aliases[id]);
});
test("URL studio keeps all legitimate parameters and inspects trackers without visiting destination", () => {
  const r = c.inspectUrl(
    "https://example.com/a?utm_source=x&ref=keep&x=1&x=2#part",
  );
  assert.equal(r.clean, "https://example.com/a?ref=keep&x=1&x=2#part");
  assert.equal(r.query.length, 4);
  assert.deepEqual(r.removed, ["utm_source"]);
  assert.equal(r.path, "/a");
  assert.equal(r.fingerprint, "https://example.com/a");
  assert.throws(() => c.inspectUrl("javascript:alert(1)"));
  assert.throws(() => c.inspectUrl("not a URL"));
  assert.ok(
    c
      .inspectUrl("http://bit.ly/a")
      .signals.some((s) => s.includes("Short-link")),
  );
  assert.ok(c.inspectUrl("https://user:pass@example.com").sensitive);
  assert.ok(c.inspectUrl("https://example.com?token=abc").sensitive);
});
test("effective rates reject blank inputs and arithmetic overflow without rejecting zero hours", () => {
  const project = { revenue: 5000, costs: 500, billable: 40, unpaid: 10 };
  for (const key of Object.keys(project))
    for (const value of [null, undefined, " ", Infinity, -1])
      assert.throws(() => c.effective({ ...project, [key]: value }));
  assert.throws(() => c.effective({ ...project, billable: 1e308, unpaid: 1e308 }));
  assert.throws(() => c.effective({ ...project, revenue: 1e308, billable: 1e-300, unpaid: 0 }));
  assert.equal(c.effective({ ...project, billable: 0, unpaid: 0 }).rate, null);
  assert.equal(c.effective({ ...project, revenue: 0 }).rate, -10);
});
test("UTM builder encodes values and preserves unrelated query pairs", () => {
  const url = c.utmUrl("https://example.com?x=1&x=2", {
    source: "a b",
    medium: "email",
    campaign: "✓",
  });
  assert.equal(new URL(url).searchParams.get("utm_source"), "a b");
  assert.deepEqual(new URL(url).searchParams.getAll("x"), ["1", "2"]);
  assert.throws(() => c.utmUrl("ftp://example.com", { source: "a" }));
});
test("freelance quote math, finite inputs and zero utilization errors", () => {
  const d = {
    target: 100000,
    overhead: 15000,
    hours: 40,
    weeks: 46,
    utilization: 65,
    tax: 0,
    margin: 15,
    quoteHours: 20,
  };
  const r = c.freelance(d);
  assert.equal(r.billable, 1196);
  assert.equal(r.quote, r.rate * 20);
  assert.ok(Math.abs(r.rate - 115000 / 1196 / 0.85) < 1e-10);
  for (const change of [
    { hours: 0 },
    { utilization: 0 },
    { margin: 95 },
    { tax: -1 },
    { target: "" },
    { target: "Infinity" },
    { target: "   " },
    { target: 1e308, overhead: 1e308 },
    { hours: 1e-300, weeks: 1e-300 },
    { target: 1e308, quoteHours: 1e308 },
  ])
    assert.throws(() => c.freelance({ ...d, ...change }));
  assert.equal(
    c.effective({ revenue: 5000, costs: 500, billable: 40, unpaid: 10 }).rate,
    90,
  );
  assert.equal(
    c.effective({ revenue: 5000, costs: 500, billable: 0, unpaid: 0 }).rate,
    null,
  );
});
test("QR validation permits plain text and warns on malformed URL without blocking encoding", () => {
  assert.ok(c.validatePayload("hello ✓").ok);
  assert.ok(c.validatePayload("https://example.com").ok);
  assert.ok(c.validatePayload("https://%").warning);
  assert.ok(c.validatePayload("https://%").ok);
  assert.equal(c.validatePayload(" ").ok, false);
});
test("PII retains all legacy pattern families and selected masks, audit and remove modes", () => {
  const source =
    "jane@example.com +971 50 123 4567 192.168.1.1 Bearer abcdefghi eyJabcd.abc.def api_key=abcdefghi postgres://user:pass@db.example/database";
  const r = c.redact(source);
  for (const label of [
    "Email",
    "Phone",
    "IPv4",
    "Bearer token",
    "JWT",
    "API key",
    "Connection string",
  ])
    assert.ok(r.findings.includes(label), label);
  assert.ok(!r.output.includes("jane@example.com"));
  assert.equal(c.redact(source, { audit: true }).output, source);
  assert.equal(c.redact(source, { audit: true }).preview, null);
  assert.equal(
    c.redact("jane@example.com", { categories: ["phone"] }).output,
    "jane@example.com",
  );
  assert.equal(c.redact("jane@example.com", { mode: "remove" }).output, "");
  assert.ok(
    c.redact("jane@example.com", { mode: "mask" }).output.includes("•"),
  );
  assert.throws(() => c.redact("x".repeat(100001)));
});
test("studio assets are shipped and completely precached, including AVIF on first offline use", () => {
  const sw = fs.readFileSync("sw.js", "utf8");
  for (const p of [
    "studios.html",
    "studios-core.js",
    "studios.js",
    "studios-routing.js",
    "studios.css",
    "tools/file-media/fm-avif-worker.js",
    "vendor/avif/avif_enc.js",
    "vendor/avif/avif_enc.wasm",
  ])
    assert.ok(sw.includes("./" + p), p);
  assert.ok(fs.statSync("vendor/avif/avif_enc.wasm").size > 1000000);
});
test("automatic hosting guards fail closed without touching existing dist", () => {
  const file = "dist/index.html",
    created = !fs.existsSync(file);
  if (created) {
    fs.mkdirSync("dist", { recursive: true });
    fs.writeFileSync(file, "sentinel-no-deployment");
  }
  const before = fs.readFileSync(file);
  for (const marker of [
    { WORKERS_CI: "1" },
    { CF_PAGES: "1" },
    { RENDER: "true" },
    { RENDER_GIT_COMMIT: "fake" },
  ]) {
    const r = spawnSync(process.execPath, ["scripts/build-static.mjs"], {
      env: { ...process.env, ...marker },
      encoding: "utf8",
    });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /INTEGRATION_NO_DEPLOY/);
    assert.deepEqual(fs.readFileSync(file), before);
  }
  if (created) fs.unlinkSync(file);
});
