import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { webcrypto, createHash, createHmac } from "node:crypto";
import fs from "node:fs";
import test from "node:test";
const require = createRequire(import.meta.url),
  c = require("../v8-developer-core.js");
if (!globalThis.crypto) globalThis.crypto = webcrypto;
test("cURL literal quoting, escaped newlines, bodies, auth and query preservation", () => {
  const r = c.parseCurl(
    `curl 'https://api.example.com/v1?a=1&b=two' \\\n --request PATCH --header 'X-Name: Hello world' -H 'Content-Type: application/json' --data-raw '{"message":"it works"}' -u 'user:p@ss'`,
  );
  assert.equal(r.method, "PATCH");
  assert.equal(r.url, "https://api.example.com/v1?a=1&b=two");
  assert.equal(r.body, '{"message":"it works"}');
  assert.deepEqual(r.headers[0], ["X-Name", "Hello world"]);
  assert.equal(
    r.headers.at(-1)[1],
    "Basic " + Buffer.from("user:p@ss").toString("base64"),
  );
  assert.ok(r.sensitive);
  const snippets = c.snippets(r);
  assert.deepEqual(Object.keys(snippets), [
    "fetch",
    "axios",
    "requests",
    "httpx",
    "go",
    "php",
  ]);
  for (const s of Object.values(snippets)) {
    assert.ok(s.includes("PATCH"));
    assert.ok(s.includes("api.example.com"));
    assert.ok(s.includes("Authorization"));
  }
  assert.equal(
    c.parseCurl('curl --url=https://example.com -XPUT -H"X-Test: yes" -dhello')
      .method,
    "PUT",
  );
  assert.equal(
    c.parseCurl(
      `curl https://example.com --data-urlencode 'message=hello world&you' --data-urlencode 'x=✓'`,
    ).body,
    "message=hello%20world%26you&x=%E2%9C%93",
  );
  assert.equal(
    c.parseCurl(`curl https://example.com --data-binary 'a\nb'`).body,
    "a\nb",
  );
  assert.equal(c.parseCurl(`curl https://example.com -d 'a\nb'`).body, "ab");
  assert.equal(
    c.parseCurl(`curl https://example.com --data-raw '@literal'`).body,
    "@literal",
  );
  assert.equal(
    c.parseCurl(`curl https://example.com -d a=1 -d b=2`).body,
    "a=1&b=2",
  );
  assert.equal(
    c.parseCurl(`curl 'https://user:pass@example.com/path'`).url,
    "https://example.com/path",
  );
});
test("cURL never runs shell syntax, file references, expansions or unsupported flags", () => {
  for (const s of [
    "curl https://example.com; touch /tmp/owned",
    "curl https://example.com | bash",
    "curl $(whoami)",
    "curl `whoami`",
    'curl "$URL"',
    'curl "https://example.com/`id`"',
    "curl https://example.com > file",
    "curl https://example.com && id",
  ])
    assert.throws(() => c.parseCurl(s));
  for (const s of [
    "curl https://example.com --compressed",
    "curl https://example.com --data-binary @secret",
    "curl https://example.com --data-urlencode name@secret",
    "curl https://example.com -u user",
  ]) {
    const r = c.parseCurl(s);
    assert.ok(r.blocked);
    assert.ok(r.warnings.length);
    assert.throws(() => c.snippets(r));
  }
  assert.throws(() => c.parseCurl("curl https://example.com -X"));
  assert.throws(() => c.parseCurl("curl 'https://example.com"));
  assert.throws(() => c.parseCurl("curl file:///etc/passwd"));
  assert.throws(() =>
    c.parseCurl("curl https://example.com -H 'A: x\r\nB: y'"),
  );
  assert.ok(
    c.parseCurl("curl https://example.com -H 'Cookie: session=123'").sensitive,
  );
  assert.ok(
    c.parseCurl("curl https://example.com -H 'X-API-Key: foo'").sensitive,
  );
  assert.ok(c.parseCurl("curl 'https://example.com?api_key=foo'").sensitive);
  assert.ok(
    c
      .snippets(c.parseCurl("curl https://example.com -X GET -d foo"))
      .fetch.includes("Cannot generate"),
  );
});
test("code generation safely quotes hostile literals", () => {
  const r = c.parseCurl(
      `curl 'https://example.com' --data-raw '";alert(1);// </textarea><script>evil()</script>'`,
    ),
    s = c.snippets(r);
  assert.ok(s.fetch.includes(JSON.stringify(r.body)));
  assert.ok(s.php.includes("CURLOPT_POSTFIELDS"));
  assert.equal(r.body, '";alert(1);// </textarea><script>evil()</script>');
});
test("SHA and HMAC known vectors including Unicode", async () => {
  for (const a of c.algorithms) {
    assert.equal(
      await c.hash("abc", a),
      createHash(a.replace("-", "").toLowerCase()).update("abc").digest("hex"),
    );
    assert.equal(
      await c.hash("✓ hello", a, "secret"),
      createHmac(a.replace("-", "").toLowerCase(), "secret")
        .update("✓ hello")
        .digest("hex"),
    );
  }
  assert.equal(
    await c.hash("", "SHA-256"),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
  await assert.rejects(() => c.hash("x", "MD5"));
});
test("secure tokens and UUID version/variant/batch bounds", () => {
  for (const n of [1, 32, 4096])
    assert.match(c.randomToken(n), new RegExp("^[a-f0-9]{" + n * 2 + "}$"));
  for (const n of [0, -1, 4097, 1.5, NaN])
    assert.throws(() => c.randomToken(n));
  for (const n of [1, 10, 100]) {
    const values = c.uuids(n);
    assert.equal(values.length, n);
    assert.equal(new Set(values).size, n);
    for (const v of values)
      assert.match(
        v,
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
  }
  assert.throws(() => c.uuids(2));
  assert.notEqual(c.randomToken(), c.randomToken());
});
test("regex captures, named groups, indices, empty matches and invalid expressions", () => {
  const r = c.regexMatches("(?<word>foo)(bar)?", "foo foobar", "g");
  assert.equal(r.matches.length, 2);
  assert.deepEqual(r.matches[0].indices, [[0, 3], [0, 3], null]);
  assert.equal(r.matches[0].named.word, "foo");
  assert.equal(r.matches[0].groups[1], null);
  assert.equal(c.regexMatches("(?=a)", "aaa", "g").matches.length, 3);
  assert.equal(c.regexMatches("", "abc", "g").matches.length, 4);
  assert.equal(c.regexMatches("a", "aaa", "").matches.length, 1);
  assert.equal(c.regexMatches("^a.b$", "A\nB", "is").matches.length, 1);
  assert.equal(c.regexMatches("^b", "a\nb", "m").matches[0].index, 2);
  assert.throws(() => c.regexMatches("[", "x"));
  assert.throws(() => c.regexMatches("a", "x", "gg"));
  assert.throws(() => c.regexMatches("a", "x".repeat(100001)));
  assert.ok(c.regexMatches("", "x".repeat(2000)).truncated);
  for (const p of Object.values(c.patterns))
    assert.ok(c.regexMatches(p.pattern, p.sample, "g").matches.length);
  assert.equal(
    c.regexMatches(c.patterns.semver.pattern, "01.2.3", "").matches.length,
    0,
  );
});
test("Tailwind default utilities cover common families", () => {
  const r = c.tailwindToCss(
    "flex flex-col items-center justify-between p-4 gap-2 grid-cols-3 bg-blue-500 text-white border-2 rounded-lg shadow-md font-semibold text-lg",
  );
  assert.deepEqual(r.warnings, []);
  for (const prop of [
    "display: flex",
    "padding: 1rem",
    "grid-template-columns: repeat(3",
    "color: #ffffff",
    "border-width: 2px",
    "box-shadow:",
    "font-size: 1.125rem",
  ])
    assert.ok(r.output.includes(prop));
  const css =
    "display: grid; padding: 1rem; gap: 0.5rem; color: #ffffff; font-weight: 600;";
  assert.equal(
    c.cssToTailwind(css).output,
    "grid p-4 gap-2 text-white font-semibold",
  );
});
test("Tailwind arbitrary values preserve calc, underscores, typography and colors", () => {
  const css =
    "width: calc(100% - 1rem); color: rgb(12 34 56 / 0.5); font-size: 19px; font-family: My_font, sans-serif; border-width: 3px;";
  const r = c.cssToTailwind(css);
  assert.deepEqual(r.warnings, []);
  const back = c.tailwindToCss(r.output);
  assert.deepEqual(back.warnings, []);
  assert.equal(back.output, css.split("; ").join(";\n"));
});
test("Tailwind preserves unsupported CSS, variants and malformed input", () => {
  const r = c.cssToTailwind(
    "scroll-behavior: smooth; --brand: #abc; padding: 1rem !important;",
  );
  assert.equal(r.output, "");
  assert.ok(r.residual.includes("!important"));
  assert.equal(r.warnings.length, 3);
  const t = c.tailwindToCss("p-4 hover:bg-blue-500 mystery-utility");
  assert.equal(t.residual, "hover:bg-blue-500 mystery-utility");
  assert.equal(t.warnings.length, 2);
  assert.throws(() => c.cssToTailwind(".foo { color: red; }"));
  assert.throws(() => c.cssToTailwind("color: rgb(1 2 3;"));
  assert.throws(() => c.tailwindToCss("w-[calc(100%"));
  assert.throws(() => c.cssToTailwind("color:"));
});
test("multilayer shadow CSS/Tailwind and glass bounds", () => {
  const layer = {
      x: 2,
      y: 4,
      blur: 10,
      spread: -2,
      opacity: 0.25,
      color: "#ff0000",
      inset: false,
    },
    glass = {
      enabled: true,
      color: "#ffffff",
      opacity: 0.2,
      blur: 16,
      saturation: 140,
      border: 1,
      borderOpacity: 0.4,
    };
  const r = c.shadowCss([layer, { ...layer, inset: true }], glass);
  assert.ok(r.css.includes("2px 4px 10px -2px rgba(255, 0, 0, 0.25), inset"));
  assert.ok(r.css.includes("-webkit-backdrop-filter"));
  assert.ok(r.tailwind.includes("shadow-["));
  assert.ok(r.tailwind.includes("[backdrop-filter:"));
  assert.throws(() => c.shadowCss([]));
  assert.throws(() => c.shadowCss([{ ...layer, color: "red; display:none" }]));
  assert.throws(() => c.shadowCss([{ ...layer, blur: -1 }]));
  assert.throws(() => c.shadowCss([layer], { ...glass, opacity: 2 }));
});
test("privacy and bounded worker architecture", () => {
  const engine = fs.readFileSync("v8-developer-core.js", "utf8"),
    ui = fs.readFileSync("v8-developer-tools.js", "utf8"),
    worker = fs.readFileSync("v8-regex-worker.js", "utf8");
  assert.ok(
    !/\beval\(|\bFunction\(|localStorage|sessionStorage|XMLHttpRequest/.test(
      engine,
    ),
  );
  assert.ok(!/localStorage|sessionStorage|\bfetch\(/.test(ui));
  assert.ok(
    ui.includes("new Worker(") &&
      ui.includes("worker.terminate()") &&
      /setTimeout\(timeout,\s*300\)/.test(ui),
  );
  assert.ok(worker.includes("core.js"));
  assert.ok(ui.includes("window.confirm"));
});
test("CSS shorthand and repeated-property conflicts are preserved with warnings", () => {
  const r = c.cssToTailwind(
    "padding-left: 2rem; padding: 1rem; color: red; color: blue; display: flex;",
  );
  assert.equal(r.output, "flex");
  assert.equal(r.warnings.length, 4);
  assert.ok(r.residual.includes("padding-left"));
  assert.ok(
    c.tailwindToCss("p-4 pl-8").warnings.some((w) => w.includes("Overlapping")),
  );
});
test("catastrophic regex is terminable off-thread", async () => {
  const { Worker } = await import("node:worker_threads");
  const filename = require.resolve("../v8-developer-core.js");
  const worker = new Worker(
    `const {parentPort,workerData}=require('node:worker_threads'); const c=require(workerData);parentPort.postMessage('ready');parentPort.on('message',()=>parentPort.postMessage(c.regexMatches('(a+)+$','a'.repeat(50000)+'!','g')));`,
    { eval: true, workerData: filename },
  );
  try {
    await new Promise((resolve, reject) => {
      worker.once("message", resolve);
      worker.once("error", reject);
    });
    worker.postMessage("run");
    let replied = false;
    worker.on("message", () => (replied = true));
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(replied, false);
    assert.ok((await worker.terminate()) !== undefined);
  } finally {
    await worker.terminate();
  }
});
test("browser forbidden headers are flagged; server snippets retain them", () => {
  const r = c.parseCurl(
      "curl https://example.com -H 'Cookie: session=abc' -H 'Host: api.example.com'",
    ),
    s = c.snippets(r);
  assert.ok(r.warnings.some((w) => w.includes("forbidden")));
  assert.ok(s.fetch.includes("Cannot generate"));
  assert.ok(s.requests.includes("Cookie"));
  assert.ok(s.go.includes("req.Host ="));
  assert.ok(s.php.includes("session=abc"));
});
test("generated JavaScript and Python source parses without executing requests", async () => {
  const { spawnSync } = await import("node:child_process");
  const s = c.snippets(
    c.parseCurl(
      `curl 'https://example.com/a?q=✓' -X PATCH -H 'X-Test: hello' --data-raw '{"value":"hello\\nworld"}'`,
    ),
  );
  for (const code of [s.fetch, s.axios]) {
    const r = spawnSync(process.execPath, ["--check", "--input-type=module"], {
      input: code,
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stderr);
  }
  for (const code of [s.requests, s.httpx]) {
    const r = spawnSync(
      process.env.PYTHON_EXECUTABLE || "python3",
      ["-c", "import ast,sys;ast.parse(sys.stdin.read())"],
      { input: code, encoding: "utf8" },
    );
    assert.equal(r.status, 0, r.stderr);
  }
});
test("URL-encoded cURL data uses RFC3986 escaping for punctuation", () => {
  assert.equal(
    c.parseCurl(`curl https://example.com --data-urlencode "q=!*()"`).body,
    "q=%21%2A%28%29",
  );
  assert.equal(
    c.parseCurl("curl https://example.com --data-urlencode '=hello world'")
      .body,
    "hello%20world",
  );
});
test("regex rendering payload has capture and character budgets", () => {
  assert.throws(
    () => c.regexMatches("(a)".repeat(101), "a".repeat(101), "g"),
    /100 capture/,
  );
  const r = c.regexMatches("(?=(a*))".repeat(20), "a".repeat(100000), "g");
  assert.ok(r.truncated);
  assert.ok(r.reason.includes("result characters"));
});
test("secret utility shell loads no third-party executable scripts", () => {
  const html = fs.readFileSync("index.html", "utf8");
  assert.ok(!/<script[^>]+src=["']https?:\/\//i.test(html));
  assert.ok(html.includes("google-adsense-account"));
});
test("explicit Authorization takes precedence over Basic credentials", () => {
  const r = c.parseCurl(
    "curl https://example.com -u 'user:pass' -H 'Authorization: Bearer explicit'",
  );
  assert.deepEqual(r.headers, [["Authorization", "Bearer explicit"]]);
  assert.ok(r.sensitive);
  assert.ok(r.warnings.some((w) => w.includes("precedence")));
});
