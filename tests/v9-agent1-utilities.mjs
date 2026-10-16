/* V9 lane 1 unit tests: epoch/time engine, SQL formatter, incremental SHA-256, Open Graph engine, and static wiring. No network. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const G = Object.assign({}, require("../v9-utilities-core.js"), require("../v9-sql-engine.js"), require("../v9-sha256.js"), require("../v9-social-card.js"));

/* ================= Epoch & time ================= */
test("epoch: every unit, exact nanoseconds, no float rounding", () => {
  assert.equal(G.epoch("1700000000123456789", "ns").isoPrecise, "2023-11-14T22:13:20.123456789Z");
  assert.equal(G.epoch("1700000000123456", "us").isoPrecise, "2023-11-14T22:13:20.123456000Z");
  assert.equal(G.epoch("1700000000123", "ms").iso, "2023-11-14T22:13:20.123Z");
  assert.equal(G.epoch("1700000000", "s").iso, "2023-11-14T22:13:20.000Z");
  // 2^53+1 cannot be represented by Number; the engine must keep the last digit
  const e = G.epoch("9007199254740993", "us");
  assert.equal(e.units.us, "9007199254740993");
  assert.equal(e.nanoseconds, "9007199254740993000");
});
test("epoch: negative values floor towards the past, never truncate towards zero", () => {
  assert.equal(G.epoch("-1", "us").isoPrecise, "1969-12-31T23:59:59.999999000Z");
  assert.equal(G.epoch("-1", "ms").iso, "1969-12-31T23:59:59.999Z");
  assert.equal(G.epoch("-1.5", "s").isoPrecise, "1969-12-31T23:59:58.500000000Z");
  assert.equal(G.epoch("-1", "ns").units.ms, "-1");
});
test("epoch: decimal fractions are exact and flagged when finer than a nanosecond", () => {
  const e = G.epoch("1700000000.123456789", "s");
  assert.equal(e.isoPrecise, "2023-11-14T22:13:20.123456789Z");
  assert.equal(e.truncated, false);
  assert.equal(G.epoch("1.0000000019", "s").truncated, true);
});
test("epoch: auto unit detection is a labelled guess by magnitude", () => {
  assert.equal(G.epoch("1700000000", "auto").unit, "s");
  assert.equal(G.epoch("1700000000000", "auto").unit, "ms");
  assert.equal(G.epoch("1700000000000000", "auto").unit, "us");
  assert.equal(G.epoch("1700000000000000000", "auto").unit, "ns");
  assert.equal(G.epoch("1700000000", "auto").unitGuessed, true);
  assert.equal(G.epoch("1700000000", "s").unitGuessed, false);
});
test("epoch: rejects garbage, exponent notation, overflow, bad units and bad zones", () => {
  for (const bad of ["", "abc", "1e9", "1.5.2", "0x10", "--1", "9".repeat(80)]) assert.throws(() => G.epoch(bad, "s"), undefined, bad);
  assert.throws(() => G.epoch("9999999999999999999999999", "s"), /range/);
  assert.throws(() => G.epoch("1", "minutes"), /unit/);
  assert.throws(() => G.epoch("1", "s", ["Mars/Olympus"]), /Unknown time zone/);
  assert.throws(() => G.epoch("1", "s", Array.from({ length: 25 }, () => "UTC")), /at most 24/);
});
test("epoch: zone offsets, abbreviations and DST flags follow the date", () => {
  const winter = G.epoch("1705320000", "s", ["America/New_York", "Australia/Sydney", "Asia/Kolkata", "UTC"]);
  const summer = G.epoch("1721044800", "s", ["America/New_York", "Australia/Sydney"]);
  assert.equal(winter.zones[0].offset, "-05:00"); assert.equal(winter.zones[0].dst, false); assert.equal(winter.zones[0].abbr, "EST");
  assert.equal(summer.zones[0].offset, "-04:00"); assert.equal(summer.zones[0].dst, true); assert.equal(summer.zones[0].abbr, "EDT");
  assert.equal(winter.zones[1].offset, "+11:00"); assert.equal(winter.zones[1].dst, true);   // southern hemisphere summer
  assert.equal(summer.zones[1].offset, "+10:00"); assert.equal(summer.zones[1].dst, false);
  assert.equal(winter.zones[2].offset, "+05:30");
  assert.equal(winter.zones[3].offset, "+00:00"); assert.equal(winter.zones[3].dst, false);
  assert.match(winter.zones[0].rfc3339, /-05:00$/);
  assert.match(G.epoch("0", "s", ["Asia/Dubai"]).zones[0].value, /04:00/);   // legacy contract
});
test("epoch: day delta compares calendar days against the first zone", () => {
  const e = G.epoch("1700000000", "s", ["America/Los_Angeles", "Asia/Tokyo"]);   // 22:13 UTC
  assert.equal(e.zones[0].dayDelta, 0); assert.equal(e.zones[1].dayDelta, 1);
});
test("epoch: common log and interchange formats are exact", () => {
  const f = G.epoch("0", "s").formats;
  assert.equal(f["Unix seconds"], "0"); assert.equal(f["ISO 8601 (UTC)"], "1970-01-01T00:00:00.000000000Z");
  assert.equal(f["Windows FILETIME"], "116444736000000000"); assert.equal(f[".NET ticks"], "621355968000000000");
  assert.equal(f["Chrome/WebKit time (µs since 1601)"], "11644473600000000");
  assert.equal(f["Excel / Sheets serial (UTC)"], "25569.000000000");
  assert.equal(f["RFC 2822 (UTC)"], "Thu, 01 Jan 1970 00:00:00 +0000"); assert.equal(f["HTTP date (UTC)"], "Thu, 01 Jan 1970 00:00:00 GMT");
  assert.equal(f["Apache/Nginx CLF (UTC)"], "[01/Jan/1970:00:00:00 +0000]"); assert.equal(f["Syslog (UTC, no year)"], "Jan  1 00:00:00");
});
test("parseInstant: ISO 8601 with offset, Z, fractional digits and date-only", () => {
  assert.equal(G.isoPrecise(G.parseInstant("2023-11-14T22:13:20.123456789Z").ns), "2023-11-14T22:13:20.123456789Z");
  assert.equal(G.isoPrecise(G.parseInstant("2024-03-31T01:30:00+01:00").ns), "2024-03-31T00:30:00.000000000Z");
  assert.equal(G.isoPrecise(G.parseInstant("2023-11-14 22:13:20,5 -0530").ns), "2023-11-15T03:43:20.500000000Z");
  assert.equal(G.isoPrecise(G.parseInstant("2020-02-29").ns), "2020-02-29T00:00:00.000000000Z");
});
test("parseInstant: wall-clock time without an offset uses the chosen zone and reports DST gaps and overlaps", () => {
  const ok = G.parseInstant("2024-07-01 12:00:00", { zone: "America/New_York" });
  assert.equal(G.isoPrecise(ok.ns), "2024-07-01T16:00:00.000000000Z"); assert.equal(ok.status, "ok");
  const gap = G.parseInstant("2024-03-10 02:30:00", { zone: "America/New_York" });
  assert.equal(gap.status, "gap"); assert.match(gap.note, /does not exist/); assert.equal(G.isoPrecise(gap.ns), "2024-03-10T07:30:00.000000000Z");
  const dup = G.parseInstant("2024-10-27 02:30:00", { zone: "Europe/Berlin" });
  assert.equal(dup.status, "ambiguous"); assert.match(dup.note, /twice/); assert.equal(G.isoPrecise(dup.ns), "2024-10-27T00:30:00.000000000Z");
});
test("parseInstant: Apache CLF, RFC 2822, HTTP date, epoch strings", () => {
  assert.equal(G.isoPrecise(G.parseInstant("[10/Oct/2000:13:55:36 -0700]").ns), "2000-10-10T20:55:36.000000000Z");
  assert.equal(G.isoPrecise(G.parseInstant("Tue, 14 Nov 2023 22:13:20 GMT").ns), "2023-11-14T22:13:20.000000000Z");
  assert.equal(G.isoPrecise(G.parseInstant("14 Nov 2023 17:13 EST").ns), "2023-11-14T22:13:00.000000000Z");
  assert.equal(G.parseInstant("1700000000123").kind.startsWith("epoch ms"), true);
});
test("parseInstant: rejects impossible dates and unknown formats (no Date.parse fallback)", () => {
  for (const bad of ["2023-02-30", "2023-13-01", "2023-01-01T25:00:00", "yesterday", "Nov 14", "12/31/2023", ""]) assert.throws(() => G.parseInstant(bad), undefined, bad);
});
test("findInLine extracts the first timestamp from a log line", () => {
  assert.equal(G.findInLine('127.0.0.1 - - [10/Oct/2000:13:55:36 -0700] "GET /"'), "10/Oct/2000:13:55:36 -0700");
  assert.equal(G.findInLine("2024-05-01T10:00:00.250Z ERROR boom"), "2024-05-01T10:00:00.250Z");
  assert.equal(G.findInLine("ts=1700000000123 level=info"), "1700000000123");
  assert.equal(G.findInLine("pid 12345 started"), null);
});
test("diff gives an exact signed breakdown", () => {
  const a = G.parseInstant("2024-01-01T00:00:00Z").ns, b = G.parseInstant("2024-01-02T01:01:01.001Z").ns;
  const d = G.diff(a, b); assert.equal(d.text, "1d 1h 1m 1s 1ms"); assert.equal(d.direction, "later");
  assert.equal(G.diff(b, a).text, "-1d 1h 1m 1s 1ms"); assert.equal(G.diff(a, a).direction, "same");
});
test("zoneList includes UTC and the local zone resolves", () => {
  const z = G.zoneList(); assert.ok(z.includes("UTC")); assert.ok(z.length > 20); assert.doesNotThrow(() => G.epoch("0", "s", [G.localZone()]));
});

/* ================= SQL ================= */
const CORPUS = [
  "select a,b from t where x=1 and y=2 order by a desc limit 5",
  "SELECT u.id, COUNT(*) AS n FROM users u LEFT JOIN orders o ON o.uid=u.id AND o.s<>'x' WHERE u.a BETWEEN 1 AND 10 AND (u.b='p' OR u.c IS NOT NULL) GROUP BY u.id HAVING COUNT(*)>1",
  "with a as (select 1 as x), b as (select x from a) select * from b join a using (x)",
  "insert into t(a,b) values (1,'x;y'),(2,'it''s') on conflict (a) do update set b=excluded.b returning *",
  "update t set a=a+1,b=:b where id=@id and c=$1 and d=? and e=%s and f=%(name)s and g={{ ref }}",
  "delete from t where id in (select id from u where z>now()-interval '1 day')",
  "select case when a>1 then 'x' when a<0 then 'y' else 'z' end, -1, a - -b, x::int, arr[1], t.*, count(*) over (partition by a order by b desc) from t",
  "select 'a--b', \"Weird Col\", `bt`, [br] from t -- trailing comment\n/* block ; comment */ where 1=1;select 2;;",
  "create table t (id int primary key, name varchar(20) not null default 'x', created timestamp default now())",
  "select * from a union all select * from b union select * from c except select * from d",
  "select /*+ index(t i) */ distinct on (a) a, b from t order by 1 nulls last offset 5 rows fetch next 3 rows only",
  "select first, key, value, name, offset_col from my_table where first = 1",
  "SELECT E'a\\'b', $$dollar ; -- quoted$$, $tag$x$tag$ FROM t",
];
const sig = (s, d) => JSON.stringify(G.sqlFingerprint(s, d));
test("sql: tokenizer reproduces its input exactly for every dialect", () => {
  for (const d of Object.keys(G.SQL_DIALECTS)) for (const s of CORPUS) assert.equal(G.sqlTokenize(s, d).tokens.map((t) => t.v).join(""), s, d + ": " + s);
});
test("sql: beautify and minify keep every significant token (strings, identifiers, placeholders, operators)", () => {
  for (const d of Object.keys(G.SQL_DIALECTS)) for (const s of CORPUS) {
    assert.equal(sig(G.sqlFormat(s, { dialect: d }).output, d), sig(s, d), "format " + d + ": " + s);
    assert.equal(sig(G.sqlMinify(s, { dialect: d }).output, d), sig(s, d), "minify " + d + ": " + s);
  }
});
test("sql: formatting is idempotent and minify is stable", () => {
  for (const s of CORPUS) {
    const once = G.sqlFormat(s, { dialect: "postgresql" }).output, twice = G.sqlFormat(once, { dialect: "postgresql" }).output;
    assert.equal(twice, once, "idempotent: " + s);
    const m = G.sqlMinify(s, { dialect: "postgresql" }).output;
    assert.equal(G.sqlMinify(m, { dialect: "postgresql" }).output, m, "minify stable: " + s);
  }
});
test("sql: golden layout for a typical query", () => {
  const out = G.sqlFormat("select u.id,u.name, count(*) as n from users u left join orders o on o.user_id=u.id and o.status<>'x' where u.active=1 and (u.role='a' or u.role='b') group by u.id,u.name having count(*)>2 order by n desc limit 10;").output;
  assert.equal(out, ["SELECT", "  u.id,", "  u.name,", "  count(*) AS n", "FROM users u", "LEFT JOIN orders o", "  ON o.user_id = u.id", "  AND o.status <> 'x'", "WHERE u.active = 1", "  AND (u.role = 'a' OR u.role = 'b')", "GROUP BY", "  u.id,", "  u.name", "HAVING count(*) > 2", "ORDER BY n DESC", "LIMIT 10;"].join("\n"));
});
test("sql: nested subqueries, CTEs, CASE and BETWEEN", () => {
  const out = G.sqlFormat("with r as (select * from t where d between 1 and 2) select (select max(x) from z where z.id=r.id) mx, case when a then b end c from r").output;
  assert.equal(out, ["WITH r AS (", "  SELECT *", "  FROM t", "  WHERE d BETWEEN 1 AND 2", ")", "SELECT", "  (", "    SELECT max(x)", "    FROM z", "    WHERE z.id = r.id", "  ) mx,", "  CASE WHEN a THEN b END c", "FROM r"].join("\n"));
});
test("sql: string literals, quoted identifiers and comment look-alikes are never altered", () => {
  const s = "select 'a -- b ; /* c */ ''d''', \"x -- y\", `z;` from t where n like '%;--%'";
  const o = G.sqlFormat(s, { dialect: "mysql" }).output;
  for (const lit of ["'a -- b ; /* c */ ''d'''", '"x -- y"', "`z;`", "'%;--%'"]) assert.ok(o.includes(lit), lit);
  assert.equal(o.split("\n").filter((l) => l.includes(";")).length >= 1, true);
});
test("sql: comments survive beautify; minify drops them unless asked, but always keeps hints", () => {
  const s = "select a, -- first\n b /* mid */ from t -- end\n/* hint */ where x=1";
  const f = G.sqlFormat(s).output;
  for (const c of ["-- first", "/* mid */", "-- end", "/* hint */"]) assert.ok(f.includes(c), c);
  assert.ok(/a, -- first/.test(f), "trailing comment stays with its item");
  assert.equal(G.sqlMinify(s).output, "select a,b from t where x=1");
  const kept = G.sqlMinify(s, { keepComments: true }).output;
  assert.ok(kept.includes("-- first\n") && kept.includes("-- end\n"), "line comments end with a newline when kept");
  assert.equal(G.sqlMinify("select /*+ index(t i) */ a from t -- x").output, "select /*+ index(t i) */ a from t");
  assert.equal(G.sqlMinify("select a from t where x=1 -- tail").output, "select a from t where x=1");
});
test("sql: minify never merges tokens into a different token", () => {
  assert.equal(G.sqlMinify("select a - -b, c / *d, 1 .5 from t").output.includes("--"), false);
  assert.equal(G.sqlMinify("select 1 as a from t where x<>-1").output, "select 1 as a from t where x<> -1");
  assert.equal(G.sqlMinify("select\n\ta  ,\n  b\nfrom\tt").output, "select a,b from t");
});
test("sql: dialect-specific lexing", () => {
  assert.equal(G.sqlTokenize("select 1 # c\nfrom t", "mysql").tokens.filter((t) => t.t === "lc").length, 1);
  assert.equal(G.sqlTokenize("select 1 # c\nfrom t", "postgresql").tokens.filter((t) => t.t === "lc").length, 0);
  assert.equal(G.sqlTokenize("select [my col] from t", "sqlserver").tokens.filter((t) => t.t === "qid").length, 1);
  assert.equal(G.sqlTokenize("select $q$it's ; here$q$", "postgresql").tokens.filter((t) => t.t === "str").length, 1);
  assert.equal(G.sqlTokenize("select 'a\\'b' x", "mysql").tokens.filter((t) => t.t === "str").length, 1);
  assert.equal(G.sqlTokenize("select 'a\\' x", "standard").tokens.filter((t) => t.t === "str").length, 1);   // backslash is literal in standard SQL
  assert.equal(G.sqlTokenize("/* a /* b */ c */ select 1", "postgresql").tokens.filter((t) => t.t === "bc").length, 1);
  assert.equal(G.sqlTokenize("select a::int, b::text", "postgresql").tokens.filter((t) => t.v === "::").length, 2);
});
test("sql: placeholders are tokens, not operators", () => {
  const ph = (s, d) => G.sqlTokenize(s, d).tokens.filter((t) => t.t === "param").map((t) => t.v);
  assert.deepEqual(ph("a=? and b=$1 and c=:n and d=@v and e=%s and f=%(k)s and g={{ x }} and h=@@rowcount"), ["?", "$1", ":n", "@v", "%s", "%(k)s", "{{ x }}", "@@rowcount"]);
});
test("sql: keyword case modes only touch reserved words", () => {
  const s = "Select first, key from my_table Where first = 1 and Key = 2";
  const up = G.sqlFormat(s, { keywordCase: "upper" }).output, lo = G.sqlFormat(s, { keywordCase: "lower" }).output, pr = G.sqlFormat("Select a From T", { keywordCase: "preserve" }).output;
  assert.ok(/SELECT[\s\S]*FROM my_table[\s\S]*WHERE first = 1\s+AND Key = 2/.test(up), up);
  assert.ok(up.includes("first") && up.includes("Key"), "identifiers keep their case");
  assert.ok(lo.startsWith("select") && lo.includes("from my_table"));
  assert.equal(pr, "Select a\nFrom T");
});
test("sql: indent, comma and width options", () => {
  const s = "select aaaaaaaaaa, bbbbbbbbbb from t where a in (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30)";
  assert.ok(G.sqlFormat(s, { indent: "tab" }).output.includes("\n\taaaaaaaaaa,"));
  assert.ok(G.sqlFormat(s, { indent: 4 }).output.includes("\n    aaaaaaaaaa,"));
  assert.ok(G.sqlFormat(s, { commaStyle: "leading" }).output.includes("\n  , bbbbbbbbbb"));
  const narrow = G.sqlFormat(s, { maxLine: 40 }).output, wide = G.sqlFormat(s, { maxLine: 240 }).output;
  assert.ok(narrow.split("\n").length > wide.split("\n").length, "narrow width wraps the IN list");
});
test("sql: multiple statements, blank-line option, empty input", () => {
  assert.equal(G.sqlFormat("select 1;select 2;").output, "SELECT 1;\n\nSELECT 2;");
  assert.equal(G.sqlFormat("select 1;select 2;", { blankLines: false }).output, "SELECT 1;\nSELECT 2;");
  assert.equal(G.sqlFormat("").output, ""); assert.equal(G.sqlFormat("   \n ").output, "");
});
test("sql: bad input produces warnings, never an exception, and never drops text", () => {
  const a = G.sqlFormat("select 'unterminated, (a from t"); assert.ok(a.warnings.length >= 1); assert.ok(G.sqlFormat("select (a, (b from t").warnings.some((w) => /Unbalanced/.test(w))); assert.ok(a.output.includes("'unterminated, "));
  const b = G.sqlFormat("select a) from t"); assert.ok(b.warnings.some((w) => /Unmatched/.test(w))); assert.ok(b.output.includes(")"));
  const c = G.sqlFormat("select /* open"); assert.ok(c.warnings.some((w) => /comment/.test(w)));
  assert.throws(() => G.sqlFormat("x".repeat(2000001)), /larger/); assert.throws(() => G.sqlMinify("x".repeat(2000001)), /larger/);
  assert.doesNotThrow(() => G.sqlFormat("\u0000\u0007 select \ud800 from §§ t"));
});
test("sql: randomised fragments keep their token fingerprint through format and minify", () => {
  let seed = 12345; const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const frags = ["select", "from", "where", "and", "or", "(", ")", ",", "a", "b.c", "'str;--'", "\"Q id\"", "1", "2.5", "=", "<>", "+", "-", "*", "/", "::", "?", ":p", "case", "when", "then", "else", "end", "join", "on", "group by", "order by", "limit", "union all", "-- c\n", "/* c */", "between", "in", "not", "null", "as", "x", ";"];
  for (let i = 0; i < 400; i++) {
    const s = Array.from({ length: 3 + rnd(25) }, () => frags[rnd(frags.length)]).join(rnd(2) ? " " : "\n");
    const fr = G.sqlFormat(s, { dialect: "postgresql" });
    assert.equal(fr.fallback, false, "layout fell back for: " + JSON.stringify(s));
    assert.equal(sig(fr.output, "postgresql"), sig(s, "postgresql"), "format: " + JSON.stringify(s));
    assert.equal(sig(G.sqlMinify(s, { dialect: "postgresql" }).output, "postgresql"), sig(s, "postgresql"), "minify: " + JSON.stringify(s));
  }
});
test("sql: a line comment can never swallow a following comma, semicolon or keyword", () => {
  for (const s of ["select a -- c\n, b from t", "select a from t -- c\n;", "select a from t where x=1 -- c\n; select 2", "select case when a -- c\n then b end from t", "select f(a -- c\n) from t", "with x as (select 1 -- c\n) select * from x", "select a, -- one\n b -- two\n from t -- three"]) {
    const r = G.sqlFormat(s); assert.equal(r.fallback, false, s); assert.equal(sig(r.output), sig(s), s);
    for (const line of r.output.split("\n")) { const i = line.indexOf("--"); if (i >= 0) assert.ok(!/[;,]/.test(line.slice(i)) || /--[^;,]*[;,]/.test(s), "token after comment in: " + line); }
  }
  const r = G.sqlFormat("select a from t where x=1 -- c\n;"); assert.ok(r.output.includes("x = 1;") && r.output.trim().endsWith("-- c"), r.output);
});
test("sql: the safety net returns the original text, flagged, if a layout rule ever changed the tokens", () => {
  assert.equal(G.sqlFormat("select 1").fallback, false);
});
test("sql: 1 MB of statements formats in a reasonable time", () => {
  const one = "select a,b,c from t where x=1 and y in (1,2,3) order by a;\n"; const big = one.repeat(Math.floor(1000000 / one.length));
  const t0 = Date.now(); const r = G.sqlFormat(big); assert.ok(r.statements > 10000); assert.ok(Date.now() - t0 < 15000, "took " + (Date.now() - t0) + " ms");
});

/* ================= SHA-256 ================= */
test("sha256: NIST vectors", () => {
  assert.equal(G.sha256Text(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(G.sha256Text("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(G.sha256Text("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"), "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
  const h = new G.Sha256(), block = new Uint8Array(1000).fill(97);
  for (let i = 0; i < 1000; i++) h.update(block);
  assert.equal(h.digest(), "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0");
});
test("sha256: matches node:crypto at every padding boundary and any split", () => {
  for (const n of [0, 1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 121, 127, 128, 129, 1000, 65537]) {
    const b = crypto.randomBytes(n);
    assert.equal(G.sha256Hex(b), crypto.createHash("sha256").update(b).digest("hex"), "len " + n);
    const h = new G.Sha256(); let i = 0; while (i < n) { const step = 1 + Math.floor(Math.random() * 97); h.update(b.subarray(i, i + step)); i += step; }
    assert.equal(h.digest(), crypto.createHash("sha256").update(b).digest("hex"), "split len " + n);
  }
});
test("sha256: finalised hashes refuse more input; reset restores a fresh state", () => {
  const h = new G.Sha256().update(new Uint8Array([97, 98, 99])); h.digest();
  assert.throws(() => h.update(new Uint8Array(1)), /finalised/); assert.throws(() => h.digest(), /finalised/);
  assert.equal(h.reset().digest(), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});
test("hashBlob: real Blob, chunk sizes, progress is monotonic and ends at 100%", async () => {
  const data = crypto.randomBytes(3 * 1024 * 1024 + 123), want = crypto.createHash("sha256").update(data).digest("hex");
  for (const chunkSize of [65536, 1000003, 4 * 1024 * 1024]) {
    const seen = [];
    const r = await G.hashBlob(new Blob([data]), { chunkSize, onProgress: (p) => seen.push(p.loaded) });
    assert.equal(r.hex, want); assert.equal(r.bytes, data.length);
    assert.equal(seen[0], 0); assert.equal(seen.at(-1), data.length); assert.deepEqual(seen, [...seen].sort((a, b) => a - b));
  }
  assert.equal((await G.hashBlob(new Blob([]))).hex, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});
test("hashBlob: cancellation rejects with AbortError and stops reading", async () => {
  let reads = 0;
  const blob = { size: 100 * 1048576, slice: (a, b) => ({ arrayBuffer: async () => { reads++; return new ArrayBuffer(b - a); } }) };
  const ac = new AbortController();
  await assert.rejects(G.hashBlob(blob, { chunkSize: 1048576, signal: ac.signal, onProgress: (p) => { if (p.loaded >= 3 * 1048576) ac.abort(); } }), (e) => e.name === "AbortError");
  assert.ok(reads <= 5, "stopped promptly after abort, read " + reads);
  const pre = new AbortController(); pre.abort();
  await assert.rejects(G.hashBlob(blob, { signal: pre.signal }), (e) => e.name === "AbortError");
});
test("hashBlob: a file that shrinks or cannot be read completely is an error, not a wrong hash", async () => {
  const blob = { size: 2097152, slice: (a, b) => ({ arrayBuffer: async () => new ArrayBuffer(Math.max(0, b - a - 10)) }) };
  await assert.rejects(G.hashBlob(blob, { chunkSize: 1048576 }), /could not be read completely/);
  const failing = { size: 10, slice: () => ({ arrayBuffer: async () => { throw Error("NotReadableError"); } }) };
  await assert.rejects(G.hashBlob(failing), /NotReadableError/);
});
/* A virtual Blob that fabricates deterministic bytes on demand, so multi-GB inputs can be tested without disk. */
function virtualBlob(size, filler = 0x5a) { return { size, slice: (a, b) => ({ arrayBuffer: async () => new Uint8Array(b - a).fill(filler).buffer }) }; }
async function bigHash(bytes, label) {
  const chunk = 4 * 1048576, ref = crypto.createHash("sha256"), fill = Buffer.alloc(chunk, 0x5a);
  for (let left = bytes; left > 0; left -= chunk) ref.update(left >= chunk ? fill : fill.subarray(0, left));
  const want = ref.digest("hex");
  global.gc && global.gc();
  const base = process.memoryUsage(); let peak = 0;
  const r = await G.hashBlob(virtualBlob(bytes), { chunkSize: chunk, onProgress: () => { const m = process.memoryUsage(); peak = Math.max(peak, m.heapUsed + m.arrayBuffers); } });
  assert.equal(r.hex, want, label + " hash");
  const grew = peak - (base.heapUsed + base.arrayBuffers);
  assert.ok(grew < 160 * 1048576, label + ": memory grew by " + (grew / 1048576).toFixed(0) + " MiB; must stay bounded by slice size, not file size");
  return { ms: r.ms, grewMiB: Math.round(grew / 1048576) };
}
test("hashBlob: 640 MiB (crosses the 2^32-bit length boundary) stays memory-bounded", async () => {
  const out = await bigHash(640 * 1048576, "640MiB"); console.log("  640 MiB: " + out.ms.toFixed(0) + " ms, peak growth " + out.grewMiB + " MiB");
});
test("hashBlob: multi-GB (V9_BIG_GIB, default skipped) stays memory-bounded and correct", { skip: !process.env.V9_BIG_GIB }, async () => {
  const gib = Number(process.env.V9_BIG_GIB), out = await bigHash(Math.round(gib * 1073741824) + 12345, gib + "GiB");
  console.log("  " + gib + " GiB (+12345 bytes): " + (out.ms / 1000).toFixed(1) + " s, peak growth " + out.grewMiB + " MiB");
});
test("checksum text parsing and comparison", () => {
  const h = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
  assert.deepEqual(G.parseChecksums(h.toUpperCase()), [{ hash: h, name: "" }]);
  assert.deepEqual(G.parseChecksums("sha256:" + h), [{ hash: h, name: "" }]);
  assert.deepEqual(G.parseChecksums("# c\n" + h + "  dir/a.iso\n" + h + " *b.iso"), [{ hash: h, name: "dir/a.iso" }, { hash: h, name: "b.iso" }]);
  assert.deepEqual(G.parseChecksums("SHA256 (x.bin) = " + h), [{ hash: h, name: "x.bin" }]);
  assert.equal(G.parseChecksums("not a hash").length, 0);
  assert.equal(G.compareChecksum(h, " " + h + " ").state, "match");
  assert.equal(G.compareChecksum(h, "0".repeat(64)).state, "mismatch");
  assert.equal(G.compareChecksum(h, "abc").state, "invalid");
  assert.match(G.compareChecksum(h, "0".repeat(64) + "  a.iso", "a.iso").message, /a\.iso/);
  assert.equal(G.formatSha256Sum([{ hex: h, name: "a.bin" }]), h + "  a.bin");
});

/* ================= Social card ================= */
test("og: parseMetaHtml reads og/twitter tags, decodes entities, ignores comments, falls back to <title>/canonical", () => {
  const r = G.parseMetaHtml(`<title>Fallback &amp; co</title><meta property="og:title" content='Hi "there"'><meta name=twitter:card content=summary><!-- <meta property="og:url" content="https://bad.example"> --><meta property="og:image" content="https://x.test/a.png"><link rel="canonical" href="https://www.x.test/p">`);
  assert.equal(r.fields.title, 'Hi "there"'); assert.equal(r.fields.twitterCard, "summary"); assert.equal(r.fields.url, "https://www.x.test/p"); assert.equal(r.fields.image, "https://x.test/a.png");
  assert.equal(G.parseMetaHtml("<title>Only &lt;title&gt;</title>").fields.title, "Only <title>");
  assert.throws(() => G.parseMetaHtml("x".repeat(300001)), /larger/);
});
test("og: pasted HTML is treated as text (script tags and handlers are inert)", () => {
  const r = G.parseMetaHtml(`<script>alert(1)</script><meta property="og:title" content="<img src=x onerror=alert(1)>">`);
  assert.equal(r.fields.title, "<img src=x onerror=alert(1)>");
});
test("og: generated tags escape hostile values", () => {
  const out = G.buildMetaTags({ title: '"><script>alert(1)</script>', description: "a & b", image: "https://x.test/?a=1&b=2", url: "https://x.test" });
  assert.ok(!out.includes("<script>")); assert.ok(out.includes("&quot;&gt;&lt;script&gt;")); assert.ok(out.includes("a &amp; b")); assert.ok(out.includes("a=1&amp;b=2"));
  assert.ok(out.includes('<meta name="twitter:card" content="summary_large_image">'));
  assert.ok(G.buildMetaTags({ title: "t" }).includes('content="summary"'));
});
test("og: image URL classification blocks scripts and flags relative paths", () => {
  assert.equal(G.classifyImageUrl("https://a.test/x.png").kind, "https"); assert.equal(G.classifyImageUrl("http://a.test/x.png").kind, "http");
  assert.equal(G.classifyImageUrl("javascript:alert(1)").kind, "blocked"); assert.equal(G.classifyImageUrl("data:text/html;base64,AAAA").kind, "blocked");
  assert.equal(G.classifyImageUrl("data:image/png;base64,AAAA").kind, "data"); assert.equal(G.classifyImageUrl("/rel.png").kind, "relative"); assert.equal(G.classifyImageUrl("").kind, "none");
});
test("og: truncation, hostnames and per-platform layout", () => {
  assert.equal(G.truncate("short", 10).truncated, false);
  const t = G.truncate("word ".repeat(40), 30); assert.ok(t.truncated && t.text.length <= 30 && t.text.endsWith("…"));
  assert.equal(G.hostOf("https://www.Example.com/a"), "example.com"); assert.equal(G.hostOf("ftp://x"), ""); assert.equal(G.hostOf("nope"), "");
  const f = { title: "T".repeat(150), description: "d ".repeat(200), url: "https://www.example.com/p", image: "https://example.com/i.png", twitterCard: "summary" };
  const x = G.socialLayout("x", f), li = G.socialLayout("linkedin", f), sl = G.socialLayout("slack", f);
  assert.ok(x.titleTruncated && x.descriptionTruncated && x.small); assert.deepEqual(x.aspect, [1, 1]); assert.equal(li.description, ""); assert.equal(sl.siteName, "example.com"); assert.equal(G.socialLayout("x", { ...f, twitterCard: "" }).card, "summary_large_image");
  assert.throws(() => G.socialLayout("myspace", f), /Unknown platform/);
});
test("og: lint reports missing and risky values", () => {
  const codes = (f) => G.socialLint(f).map((i) => i.level + ":" + i.field);
  assert.ok(codes({}).includes("error:title")); assert.ok(codes({ title: "A decent page title", image: "/x.png" }).includes("error:image"));
  assert.ok(codes({ title: "A decent page title", url: "ftp://x" }).includes("error:url")); assert.ok(codes({ title: "A decent page title", image: "http://x.test/a.png" }).includes("warn:image"));
  assert.ok(codes({ title: "A decent page title", twitterCard: "weird" }).includes("error:twitterCard")); assert.ok(codes({ title: "x".repeat(90) }).includes("warn:title"));
  assert.deepEqual(G.socialLint({ title: "A decent page title for sharing", description: "A short description.", url: "https://x.test", image: "https://x.test/i.png", imageAlt: "alt" }), []);
});
test("og: wrapLines respects width and line limit with an ellipsis", () => {
  const measure = (s) => s.length * 10;
  assert.deepEqual(G.wrapLines(measure, "aaa bbb ccc ddd", 70, 3), ["aaa bbb", "ccc ddd"]);
  const l = G.wrapLines(measure, "one two three four five six seven", 70, 2); assert.equal(l.length, 2); assert.ok(l[1].endsWith("…")); assert.ok(l.every((x) => measure(x) <= 70));
});

/* ================= Static wiring & privacy ================= */
const read = (f) => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
const FILES = ["v9-utilities-core.js", "v9-sql-engine.js", "v9-sha256.js", "v9-social-card.js", "v9-agent1-tools.js"];
test("wiring: scripts are loaded before discovery and routing, the stylesheet is linked, everything is precached", () => {
  const html = read("index.html"), sw = read("sw.js");
  const order = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]), at = (f) => order.indexOf(f);
  for (const f of FILES) { assert.ok(at(f) >= 0, f + " loaded"); assert.ok(at(f) > at("tools.js") && at(f) < at("studios-routing.js") && at(f) < at("v8-discovery.js"), f + " order"); assert.ok(sw.includes('"./' + f + '"'), f + " precached"); assert.ok(fs.existsSync(f)); }
  assert.ok(at("v9-agent1-tools.js") > Math.max(...["v9-utilities-core.js", "v9-sql-engine.js", "v9-sha256.js", "v9-social-card.js"].map(at)), "UI loads after engines");
  assert.ok(html.includes('href="v9-agent1.css"') && sw.includes('"./v9-agent1.css"'));
});
test("catalogue: four new tools, unique ids, only existing categories; still exactly nine top-level categories", () => {
  const ui = read("v9-agent1-tools.js"), rows = [...ui.matchAll(/^\s*\["([a-z0-9-]+)", "([^"]+)", "([^"]+)", "([^"]+)"\],?$/gm)];
  assert.deepEqual(rows.map((r) => r[1]), ["sql-formatter", "file-sha256", "epoch-matrix", "og-simulator"]);
  const existing = new Set(); for (const f of ["tools.js", "v2-tools.js", "v21-tools.js", "v6-tools.js", "v8-developer-tools.js"]) for (const m of read(f).matchAll(/\[\s*"([a-z0-9-]+)",\s*"([^"]+)",/g)) existing.add(m[1] + "|" + m[2]);
  const ids = new Set([...existing].map((e) => e.split("|")[0])), cats = new Set([...existing].map((e) => e.split("|")[1]));
  for (const r of rows) { assert.ok(!ids.has(r[1]), r[1] + " is unique"); assert.ok(cats.has(r[2]), r[2] + " is an existing catalogue category"); }
  const v8 = read("v8-discovery.js");
  assert.equal([...v8.matchAll(/\{id:"[a-z-]+",label:/g)].length, 9);
  assert.deepEqual(rows.map((r) => r[2]), ["Developer", "Privacy & Safety", "Developer", "Links & Web"]);
});
test("privacy: lane-1 code makes no network calls and writes nothing to browser storage or cookies", () => {
  for (const f of FILES) {
    const src = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const bad of [/\bfetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /EventSource/, /\bimportScripts\b/, /localStorage/, /sessionStorage/, /indexedDB/, /document\.cookie/, /navigator\.serviceWorker/, /new\s+Worker\s*\(/])
      assert.ok(!bad.test(src), f + " must not use " + bad);
  }
});
test("privacy: the OG tool only ever loads an image the user explicitly opted into, and never builds HTML from user text", () => {
  const ui = read("v9-agent1-tools.js");
  assert.ok(/imageSrc\s*=\s*\(model\)\s*=>\s*\{[\s\S]*?\$\("v9-og-loadurl"\)\.checked/.test(ui), "URL image gated by the opt-in checkbox");
  const ogSection = ui.slice(ui.indexOf("function bindOg"), ui.indexOf("/* ---------- wiring"));
  assert.ok(!/innerHTML\s*=/.test(ogSection), "OG previews use textContent/DOM nodes only");
});
