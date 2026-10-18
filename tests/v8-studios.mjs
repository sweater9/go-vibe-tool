import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
const c = createRequire(import.meta.url)("../studios-core.js");
test("route table covers exactly the URL, QR and Privacy studios; Percentage Change is independent", () => {
  const studios = ["privacy", "qr", "url"];
  assert.deepEqual([...new Set(Object.values(c.aliases))].sort(), studios);
  assert.deepEqual(Object.keys(c.titles).sort(), studios);
  assert.deepEqual(Object.keys(c.canonical).sort(), studios);
  // Each studio's canonical tool ID routes back to that same studio.
  for (const [studio, id] of Object.entries(c.canonical))
    assert.equal(c.aliases[id], studio, `${id} routes to ${studio}`);
  for (const [id, studio] of Object.entries({
    "url-cleaner": "url",
    "url-inspector": "url",
    "utm-builder": "url",
    "tracking-check": "url",
    "link-fingerprint": "url",
    "link-fingerprint-inspector": "url",
    "qr-payload": "qr",
    "qr-studio": "qr",
    metadata: "privacy",
    "pii-secret-redactor": "privacy",
  }))
    assert.equal(c.aliases[id], studio, id);
  assert.equal(c.aliases["percentage-change"], undefined);
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
test("URL studio removes trackers case-insensitively, keeps unrelated pairs and the fragment, and reports risk signals", () => {
  const r = c.inspectUrl(
    "https://Example.com/p?UTM_Source=a&gclid=1&MSCLKID=2&mc_eid=3&keep=1&utm_medium=m#frag",
  );
  assert.equal(r.clean, "https://example.com/p?keep=1#frag");
  assert.deepEqual(r.removed, ["UTM_Source", "gclid", "MSCLKID", "mc_eid", "utm_medium"]);
  assert.equal(r.query.length, 6);
  assert.equal(r.fingerprint, "https://example.com/p");
  assert.deepEqual(c.inspectUrl("http://user:pw@xn--e1afmkfd.example/").signals, [
    "Credentials embedded in URL",
    "Punycode / internationalized hostname",
    "Unencrypted HTTP",
  ]);
  assert.deepEqual(c.inspectUrl("https://t.co/abc").signals, [
    "Short-link signal; redirect not followed",
  ]);
  assert.deepEqual(c.inspectUrl("https://bücher.example/").signals, [
    "Punycode / internationalized hostname",
    "Non-ASCII characters in supplied URL",
  ]);
  assert.equal(c.inspectUrl("https://example.com/?next=/x").sensitive, false);
  assert.equal(c.inspectUrl("https://example.com/?api_key=1").sensitive, true);
  assert.equal(c.inspectUrl("https://example.com/?Password=1").sensitive, true);
});
test("URL studio rejects non-HTTP(S), malformed and oversized input", () => {
  for (const bad of ["ftp://example.com", "mailto:a@b.co", "javascript:alert(1)", "//example.com", "", " "])
    assert.throws(() => c.inspectUrl(bad), bad);
  assert.throws(
    () => c.inspectUrl("https://example.com/?" + "a".repeat(100000)),
    /Maximum 100,000 characters/,
  );
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
test("UTM builder overwrites existing utm values in place, skips blanks, keeps the fragment and rejects unsupported fields", () => {
  assert.equal(
    c.utmUrl("https://example.com/p?utm_source=old&x=1#frag", {
      source: "new",
      medium: " ",
      campaign: "c d",
    }),
    "https://example.com/p?utm_source=new&x=1&utm_campaign=c+d#frag",
  );
  assert.equal(c.utmUrl("https://example.com/", {}), "https://example.com/");
  assert.throws(() => c.utmUrl("https://example.com", { content: "x" }), /Unsupported UTM field/);
});
test("QR validation checks URL-typed and http(s)-looking payloads, treats other text as plain, and enforces limits", () => {
  const typedUrl = c.validatePayload("hello", "url");
  assert.ok(typedUrl.ok && typedUrl.warning);
  assert.match(typedUrl.message, /^Warning: malformed URL/);
  assert.equal(c.validatePayload("HTTPS://EXAMPLE.COM").message, "Valid HTTP(S) URL payload.");
  assert.equal(c.validatePayload("ftp://example.com").message, "Plain-text payload (valid for QR).");
  assert.equal(c.validatePayload("WIFI:T:WPA;S:x;P:y;;").message, "Plain-text payload (valid for QR).");
  assert.deepEqual(c.validatePayload("   "), { ok: false, message: "Enter text or a URL." });
  assert.throws(() => c.validatePayload("x".repeat(100001)), /Maximum 100,000 characters/);
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
test("PII categories are independent; audit reports findings without changing text; replacement is idempotent", () => {
  const source = "mail jane@example.com ip 10.0.0.1 phone +1 415 555 0100 api_key=abcdefghi";
  for (const [category, label] of Object.entries({
    email: "Email",
    phone: "Phone",
    secrets: "API key",
    ip: "IPv4",
  })) {
    const r = c.redact(source, { categories: [category] });
    assert.deepEqual(r.findings, [label], category);
    assert.notEqual(r.output, source, category);
  }
  for (const categories of [["connection"], []]) {
    const r = c.redact(source, { categories });
    assert.deepEqual(r.findings, []);
    assert.equal(r.output, source);
  }
  assert.deepEqual(c.redact("jane@example.com", { audit: true }), {
    output: "jane@example.com",
    preview: null,
    findings: ["Email"],
  });
  const once = c.redact(source).output;
  assert.deepEqual(c.redact(once).findings, []);
  assert.equal(c.redact(once).output, once);
  assert.equal(c.redact("jane@example.com jane@example.com").output, "[EMAIL_REDACTED] [EMAIL_REDACTED]");
  assert.deepEqual(c.redact("jane@example.com jane@example.com").findings, ["Email", "Email"]);
  assert.equal(c.redact("a@b.co", { mode: "mask" }).output, "•".repeat(6));
  assert.equal(c.redact("x".repeat(30) + "@example.com", { mode: "mask" }).output, "•".repeat(24));
  assert.throws(() => c.redact("x", { mode: "shred" }), /Unsupported redaction mode/);
  assert.deepEqual(c.redact(""), { output: "", preview: "", findings: [] });
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
test("authorized hosting builds retain static asset safeguards", () => {
  const script = fs.readFileSync("scripts/build-static.mjs", "utf8");
  assert.doesNotMatch(script, /INTEGRATION_NO_DEPLOY/);
  const manifest = fs.readFileSync("scripts/site-manifest.mjs", "utf8");
  assert.ok(manifest.includes("UNRELEASED_SITE_PATHS = ['play/mahjong']"));
  const r = spawnSync(process.execPath, ["scripts/build-static.mjs"], {
    env: { ...process.env, WORKERS_CI: "1" },
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.ok(fs.existsSync("dist/index.html"));
  assert.ok(!fs.existsSync("dist/play/mahjong/index.html"));
});
