/* GoVibeTool V8 developer/design engines. No network, evaluation or storage. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GVTDeveloper = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";
  const limit = (value, max, name) => {
    if (String(value).length > max)
      throw new Error(name + " is too large (maximum " + max + " characters).");
    return String(value);
  };
  function shellWords(source) {
    const s = limit(source, 100000, "cURL command"),
      words = [];
    let buf = "",
      quote = "",
      started = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (quote) {
        if (quote === '\"' && (c === "$" || c === "`"))
          throw Error(
            "Shell expansion and substitutions are unsupported; use literal values.",
          );
        if (c === quote) {
          quote = "";
          continue;
        }
        if (c === "\\" && quote === '"') {
          const n = s[++i];
          if (n === undefined) throw Error("Trailing escape.");
          if (n === "\n") continue;
          buf += ['"', "\\", "$", "`"].includes(n) ? n : "\\" + n;
          continue;
        }
        buf += c;
        continue;
      }
      if (c === '"' || c === "'") {
        quote = c;
        started = true;
        continue;
      }
      if (c === "\\") {
        const n = s[++i];
        if (n === undefined) throw Error("Trailing escape.");
        if (n === "\r" && s[i + 1] === "\n") {
          i++;
          continue;
        }
        if (n !== "\n") {
          buf += n;
          started = true;
        }
        continue;
      }
      if (/\s/.test(c)) {
        if (started) {
          words.push(buf);
          buf = "";
          started = false;
        }
        continue;
      }
      if (/[;|&<>`]/.test(c) || c === "$")
        throw Error(
          "Shell operators, expansion and substitutions are not supported. Paste one literal cURL command.",
        );
      buf += c;
      started = true;
    }
    if (quote) throw Error("Unclosed " + quote + " quote.");
    if (started) words.push(buf);
    return words;
  }
  const encodeData = (s) =>
    encodeURIComponent(s).replace(
      /[!'()*]/g,
      (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
    );
  function base64UTF8(s) {
    const bytes = new TextEncoder().encode(s);
    let b = "";
    bytes.forEach((v) => (b += String.fromCharCode(v)));
    return typeof btoa === "function"
      ? btoa(b)
      : Buffer.from(bytes).toString("base64");
  }
  function parseCurl(source) {
    const words = shellWords(source);
    if (!words.length || !/^curl(?:\.exe)?$/i.test(words.shift()))
      throw Error("Start with curl followed by a URL and options.");
    let method = "",
      url = "",
      user = "",
      hasUser = false,
      bodyParts = [],
      headers = [],
      warnings = [],
      blocked = false;
    const takes = new Set([
      "-X",
      "--request",
      "-H",
      "--header",
      "-d",
      "--data",
      "--data-raw",
      "--data-binary",
      "--data-urlencode",
      "-u",
      "--user",
      "--url",
    ]);
    for (let i = 0; i < words.length; i++) {
      let flag = words[i],
        value = null;
      const eq = flag.indexOf("=");
      if (flag.startsWith("--") && eq > 0) {
        value = flag.slice(eq + 1);
        flag = flag.slice(0, eq);
      }
      if (/^-[XHdu].+/.test(flag) && !flag.startsWith("--")) {
        value = flag.slice(2);
        flag = flag.slice(0, 2);
      }
      if (takes.has(flag)) {
        if (value === null) {
          if (i + 1 >= words.length) throw Error("Missing value for " + flag);
          value = words[++i];
        }
        if (flag === "-X" || flag === "--request") {
          if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(value))
            throw Error("Invalid HTTP method.");
          method = value;
        } else if (flag === "--url") {
          if (url) {
            warnings.push("Multiple URLs are unsupported.");
            blocked = true;
          }
          url = value;
        } else if (flag === "-H" || flag === "--header") {
          const p = value.indexOf(":");
          if (
            p < 1 ||
            !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(value.slice(0, p)) ||
            /[\r\n]/.test(value)
          )
            throw Error("Headers need a name: value without line breaks.");
          headers.push([value.slice(0, p).trim(), value.slice(p + 1).trim()]);
        } else if (flag === "-u" || flag === "--user") {
          user = value;
          hasUser = true;
        } else {
          if (flag !== "--data-raw" && value.startsWith("@")) {
            warnings.push(
              flag +
                " file/stdin references cannot be read; replace with literal data.",
            );
            blocked = true;
          }
          if (flag === "--data-urlencode") {
            if (
              value.includes("@") &&
              (!value.includes("=") || value.indexOf("@") < value.indexOf("="))
            ) {
              warnings.push(
                "File references for --data-urlencode are unsupported.",
              );
              blocked = true;
            }
            const p = value.indexOf("=");
            value =
              p < 0
                ? encodeData(value)
                : p === 0
                  ? encodeData(value.slice(1))
                  : value.slice(0, p) + "=" + encodeData(value.slice(p + 1));
          } else if (flag === "-d" || flag === "--data")
            value = value.replace(/[\r\n]/g, "");
          bodyParts.push(value);
        }
      } else if (flag.startsWith("-")) {
        warnings.push(
          "Unsupported flag: " + flag + ". No equivalent is generated.",
        );
        blocked = true;
      } else {
        if (url) {
          warnings.push("Multiple URLs or unsupported positional arguments.");
          blocked = true;
        } else url = flag;
      }
    }
    if (!url) throw Error("Provide an HTTP or HTTPS URL.");
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw Error("Enter a complete URL, including https://.");
    }
    if (!/^https?:$/.test(parsed.protocol))
      throw Error("Only HTTP and HTTPS requests are supported.");
    if (parsed.username || parsed.password) {
      if (!hasUser) {
        user =
          decodeURIComponent(parsed.username) +
          ":" +
          decodeURIComponent(parsed.password);
        hasUser = true;
      }
      parsed.username = "";
      parsed.password = "";
      url = parsed.href;
    }
    if (hasUser) {
      if (!user.includes(":")) {
        warnings.push(
          "-u without a password requires an interactive prompt; use user:password.",
        );
        blocked = true;
      }
      if (headers.some((h) => h[0].toLowerCase() === "authorization"))
        warnings.push(
          "Explicit Authorization header takes precedence over -u credentials.",
        );
      else headers.push(["Authorization", "Basic " + base64UTF8(user)]);
    }
    const body = bodyParts.length ? bodyParts.join("&") : null;
    method = method || (body !== null ? "POST" : "GET");
    if (
      body !== null &&
      !headers.some((h) => h[0].toLowerCase() === "content-type")
    )
      headers.push(["Content-Type", "application/x-www-form-urlencoded"]);
    const names = headers.map((h) => h[0].toLowerCase());
    if (new Set(names).size !== names.length)
      warnings.push(
        "Repeated header names: Python and axios combine values with commas. Go and PHP preserve separate header lines; review protocol semantics.",
      );
    if (
      headers.some((h) =>
        /^(cookie|host|content-length|connection|origin|referer|accept-encoding|accept-charset|access-control-request-headers|access-control-request-method|date|dnt|expect|permissions-policy|te|trailer|transfer-encoding|upgrade|via|keep-alive|user-agent|proxy-.*|sec-.*)$/i.test(
          h[0],
        ),
      )
    )
      warnings.push(
        "Browser fetch/axios cannot preserve browser-forbidden headers such as Cookie or Host. Use a server-side snippet.",
      );
    const sensitive =
      hasUser ||
      headers.some((h) =>
        /authorization|cookie|api.?key|token|secret|password|credential/i.test(
          h[0],
        ),
      ) ||
      (body !== null &&
        /password|secret|token|api.?key|credential/i.test(body)) ||
      [...parsed.searchParams.keys()].some((k) =>
        /token|secret|password|api.?key|auth/i.test(k),
      );
    if (/^(GET|HEAD)$/i.test(method) && body !== null)
      warnings.push(
        "Browser fetch forbids a body with GET/HEAD; use another generated language or change the request.",
      );
    return { url, method, headers, body, sensitive, warnings, blocked };
  }
  const q = JSON.stringify,
    py = (s) => q(s),
    php = (s) =>
      "'" + String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
  function snippets(r) {
    if (r.blocked)
      throw Error(
        "Resolve unsupported flags or file references before generating code.",
      );
    const combined = {};
    for (const [k, v] of r.headers) {
      const existing = Object.keys(combined).find(
        (x) => x.toLowerCase() === k.toLowerCase(),
      );
      if (existing) combined[existing] += ", " + v;
      else combined[k] = v;
    }
    const h = q(combined),
      body = r.body === null ? "" : `,\n  body: ${q(r.body)}`;
    const forbidden = r.headers.some((h) =>
      /^(cookie|host|content-length|connection|origin|referer|accept-encoding|accept-charset|access-control-request-headers|access-control-request-method|date|dnt|expect|permissions-policy|te|trailer|transfer-encoding|upgrade|via|keep-alive|user-agent|proxy-.*|sec-.*)$/i.test(
        h[0],
      ),
    );
    const out = {};
    out.fetch = /^(CONNECT|TRACE|TRACK)$/i.test(r.method)
      ? "// Cannot generate browser fetch: this HTTP method is forbidden by browsers. Use a server-side snippet."
      : forbidden
        ? "// Cannot generate browser fetch: this request contains browser-forbidden headers. Use Python, Go or PHP."
        : /^(GET|HEAD)$/i.test(r.method) && r.body !== null
          ? "// Cannot generate fetch: browsers forbid GET/HEAD request bodies."
          : `const response = await fetch(${q(r.url)}, {\n  method: ${q(r.method)},\n  headers: ${q(r.headers)}${body}\n});\nconsole.log(await response.text());`;
    out.axios = `import axios from 'axios';\n\nconst response = await axios({\n  url: ${q(r.url)},\n  method: ${q(r.method)},\n  headers: ${h}${r.body === null ? "" : ",\n  data: " + q(r.body) + ",\n  transformRequest: [(data) => data]"}\n});\nconsole.log(response.data);`;
    for (const lib of ["requests", "httpx"])
      out[lib] =
        `import ${lib}\n\nresponse = ${lib}.request(\n    ${py(r.method)},\n    ${py(r.url)},\n    headers=${h}${r.body === null ? "" : ",\n    " + (lib === "httpx" ? "content" : "data") + "=" + py(r.body) + '.encode("utf-8")'}\n)\nprint(response.text)`;
    out.go = `package main\n\nimport (\n  "fmt"\n  "io"\n  "net/http"${r.body === null ? "" : '\n  "strings"'}${r.headers.some(([k]) => k.toLowerCase() === "content-length") ? '\n  "strconv"' : ""}\n)\n\nfunc main() {\n  req, err := http.NewRequest(${q(r.method)}, ${q(r.url)}, ${r.body === null ? "nil" : "strings.NewReader(" + q(r.body) + ")"})\n  if err != nil { panic(err) }\n${r.headers.map(([k, v]) => (k.toLowerCase() === "host" ? "  req.Host = " + q(v) : k.toLowerCase() === "content-length" ? "  req.ContentLength, err = strconv.ParseInt(" + q(v) + ", 10, 64)\n  if err != nil { panic(err) }" : "  req.Header.Add(" + q(k) + ", " + q(v) + ")")).join("\n")}\n  res, err := http.DefaultClient.Do(req)\n  if err != nil { panic(err) }\n  defer res.Body.Close()\n  data, err := io.ReadAll(res.Body)\n  if err != nil { panic(err) }\n  fmt.Println(string(data))\n}`;
    out.php = `<?php\n$ch = curl_init(${php(r.url)});\ncurl_setopt_array($ch, [\n  CURLOPT_CUSTOMREQUEST => ${php(r.method)},\n  CURLOPT_RETURNTRANSFER => true,\n  CURLOPT_HTTPHEADER => [${r.headers.map(([k, v]) => php(k + ": " + v)).join(", ")}]${r.body === null ? "" : ",\n  CURLOPT_POSTFIELDS => " + php(r.body)}\n]);\n$result = curl_exec($ch);\nif ($result === false) { throw new RuntimeException(curl_error($ch)); }\ncurl_close($ch);\necho $result;`;
    if (Object.keys(combined).length !== r.headers.length)
      for (const lang of ["requests", "httpx", "axios"])
        out[lang] =
          (lang === "axios" ? "// " : "# ") +
          "Repeated header values are combined with comma separators; review server semantics.\n" +
          out[lang];
    return out;
  }
  const algorithms = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];
  const hex = (bytes) =>
    Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  async function hash(text, algorithm = "SHA-256", key = null) {
    if (!algorithms.includes(algorithm))
      throw Error("Unsupported SHA algorithm.");
    if (!globalThis.crypto?.subtle)
      throw Error("Web Crypto requires HTTPS or localhost.");
    const data = new TextEncoder().encode(limit(text, 1000000, "Input"));
    let result;
    if (key !== null) {
      const k = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(limit(key, 1000000, "Key")),
        { name: "HMAC", hash: algorithm },
        false,
        ["sign"],
      );
      result = await crypto.subtle.sign("HMAC", k, data);
    } else result = await crypto.subtle.digest(algorithm, data);
    return hex(new Uint8Array(result));
  }
  function randomToken(bytes = 32) {
    if (!Number.isInteger(bytes) || bytes < 1 || bytes > 4096)
      throw Error("Byte length must be an integer from 1 to 4096.");
    if (!globalThis.crypto?.getRandomValues)
      throw Error("Secure random generation is unavailable.");
    return hex(crypto.getRandomValues(new Uint8Array(bytes)));
  }
  function uuids(count = 1) {
    if (![1, 10, 100].includes(count))
      throw Error("Choose a batch of 1, 10 or 100.");
    return Array.from({ length: count }, () => {
      const a = crypto.getRandomValues(new Uint8Array(16));
      a[6] = (a[6] & 15) | 64;
      a[8] = (a[8] & 63) | 128;
      const h = hex(a);
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    });
  }
  const patterns = {
    email: {
      pattern: "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}",
      sample: "Contact hello@example.com or support@example.org",
      note: "Simplified ASCII email finder; not a complete RFC 5322 validator.",
    },
    RFC3339: {
      pattern:
        "\\b\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})\\b",
      sample: "2026-10-13T09:26:00Z 2026-10-13T13:26:00+04:00",
      note: "Simplified RFC3339 syntax finder; calendar dates, ranges and leap seconds are not validated.",
    },
    IPv4: {
      pattern:
        "\\b(?:(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)\\b",
      sample: "192.168.1.1 255.255.255.255 999.1.2.3",
      note: "IPv4 dotted decimal finder; surrounding context may require anchors.",
    },
    IPv6: {
      pattern:
        "(?<![0-9A-Fa-f:])(?:[0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}(?![0-9A-Fa-f:])",
      sample: "2001:0db8:0000:0000:0000:0000:0000:0001 ::1",
      note: "Simplified full eight-group IPv6 only; compressed, mixed IPv4 and zone identifiers are not covered.",
    },
    slug: {
      pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
      sample: "browser-first-tools",
      note: "Lowercase ASCII slug convention; not a universal URL standard.",
    },
    semver: {
      pattern:
        "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\\+([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?$",
      sample: "1.2.3-beta.1+build.42",
      note: "Semantic Versioning 2.0.0 syntax. Use without m for whole-input validation.",
    },
  };
  function regexMatches(pattern, text, flags = "g") {
    limit(pattern, 2000, "Pattern");
    limit(text, 100000, "Test text");
    if (!/^[gims]*$/.test(flags) || new Set(flags).size !== flags.length)
      throw Error("Use unique flags g, i, m and s.");
    const re = new RegExp(pattern, flags + "d"),
      matches = [];
    let m,
      cells = 0,
      chars = 0;
    const reason =
      "Result limit reached: 1,000 matches, 4,000 capture values or 1,000,000 result characters.";
    while ((m = re.exec(text)) !== null) {
      if (m.length > 101) throw Error("Maximum 100 capture groups.");
      cells += m.length + Object.keys(m.groups || {}).length;
      chars +=
        Array.from(m).reduce((s, v) => s + (v?.length || 0), 0) +
        Object.values(m.groups || {}).reduce((s, v) => s + (v?.length || 0), 0);
      if (cells > 4000 || chars > 1000000)
        return { matches, truncated: true, reason };
      matches.push({
        text: m[0],
        index: m.index,
        end: m.index + m[0].length,
        groups: Array.from(m)
          .slice(1)
          .map((v) => (v === undefined ? null : v)),
        named: m.groups || {},
        indices: m.indices.map((v) => v || null),
        namedIndices: m.indices.groups || {},
      });
      if (matches.length >= 1000) return { matches, truncated: true, reason };
      if (!re.global) break;
      if (m[0] === "") re.lastIndex++;
    }
    return { matches, truncated: false };
  }
  /* Tailwind CSS 3.4 default configuration; exact utilities + supported arbitrary values. */
  const utilities = {
    block: "display: block",
    inline: "display: inline",
    "inline-block": "display: inline-block",
    flex: "display: flex",
    "inline-flex": "display: inline-flex",
    grid: "display: grid",
    hidden: "display: none",
    "flex-row": "flex-direction: row",
    "flex-col": "flex-direction: column",
    "flex-wrap": "flex-wrap: wrap",
    "flex-nowrap": "flex-wrap: nowrap",
    "items-center": "align-items: center",
    "items-start": "align-items: flex-start",
    "items-end": "align-items: flex-end",
    "items-stretch": "align-items: stretch",
    "justify-center": "justify-content: center",
    "justify-between": "justify-content: space-between",
    "justify-start": "justify-content: flex-start",
    "justify-end": "justify-content: flex-end",
    "flex-1": "flex: 1 1 0%",
    "flex-auto": "flex: 1 1 auto",
    grow: "flex-grow: 1",
    "grow-0": "flex-grow: 0",
    shrink: "flex-shrink: 1",
    "shrink-0": "flex-shrink: 0",
    "font-normal": "font-weight: 400",
    "font-medium": "font-weight: 500",
    "font-semibold": "font-weight: 600",
    "font-bold": "font-weight: 700",
    italic: "font-style: italic",
    "not-italic": "font-style: normal",
    "text-left": "text-align: left",
    "text-center": "text-align: center",
    "text-right": "text-align: right",
    underline: "text-decoration-line: underline",
    "no-underline": "text-decoration-line: none",
    uppercase: "text-transform: uppercase",
    lowercase: "text-transform: lowercase",
    capitalize: "text-transform: capitalize",
    border: "border-width: 1px",
    "border-0": "border-width: 0px",
    "border-2": "border-width: 2px",
    "border-4": "border-width: 4px",
    "border-solid": "border-style: solid",
    "border-dashed": "border-style: dashed",
    "rounded-none": "border-radius: 0px",
    rounded: "border-radius: 0.25rem",
    "rounded-md": "border-radius: 0.375rem",
    "rounded-lg": "border-radius: 0.5rem",
    "rounded-xl": "border-radius: 0.75rem",
    "rounded-2xl": "border-radius: 1rem",
    "rounded-full": "border-radius: 9999px",
    "shadow-none": "box-shadow: none",
    shadow:
      "box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
    "shadow-md":
      "box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  };
  const prefixes = {
    p: ["padding"],
    px: ["padding-left", "padding-right"],
    py: ["padding-top", "padding-bottom"],
    pt: ["padding-top"],
    pr: ["padding-right"],
    pb: ["padding-bottom"],
    pl: ["padding-left"],
    m: ["margin"],
    mx: ["margin-left", "margin-right"],
    my: ["margin-top", "margin-bottom"],
    mt: ["margin-top"],
    mr: ["margin-right"],
    mb: ["margin-bottom"],
    ml: ["margin-left"],
    gap: ["gap"],
    "gap-x": ["column-gap"],
    "gap-y": ["row-gap"],
    w: ["width"],
    h: ["height"],
    "min-w": ["min-width"],
    "max-w": ["max-width"],
    "min-h": ["min-height"],
    "max-h": ["max-height"],
    bg: ["background-color"],
    border: ["border-color"],
    rounded: ["border-radius"],
    shadow: ["box-shadow"],
    leading: ["line-height"],
    tracking: ["letter-spacing"],
    opacity: ["opacity"],
    "grid-cols": ["grid-template-columns"],
    "grid-rows": ["grid-template-rows"],
    "backdrop-blur": ["backdrop-filter"],
  };
  const spacing = {
    0: "0px",
    px: "1px",
    0.5: "0.125rem",
    1: "0.25rem",
    1.5: "0.375rem",
    2: "0.5rem",
    2.5: "0.625rem",
    3: "0.75rem",
    3.5: "0.875rem",
    4: "1rem",
    5: "1.25rem",
    6: "1.5rem",
    7: "1.75rem",
    8: "2rem",
    9: "2.25rem",
    10: "2.5rem",
    11: "2.75rem",
    12: "3rem",
    14: "3.5rem",
    16: "4rem",
    20: "5rem",
    24: "6rem",
    28: "7rem",
    32: "8rem",
    36: "9rem",
    40: "10rem",
    44: "11rem",
    48: "12rem",
    52: "13rem",
    56: "14rem",
    60: "15rem",
    64: "16rem",
    72: "18rem",
    80: "20rem",
    96: "24rem",
  };
  for (const [prefix, props] of Object.entries(prefixes)) {
    if (/^(?:[pm][xytbrl]?|gap(?:-[xy])?|w|h|min-[wh]|max-[wh])$/.test(prefix))
      for (const [k, v] of Object.entries(spacing))
        utilities[prefix + "-" + k] = props.map((p) => p + ": " + v).join("; ");
  }
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    utilities["grid-cols-" + n] =
      "grid-template-columns: repeat(" + n + ", minmax(0, 1fr))";
  for (const [name, color] of Object.entries({
    white: "#ffffff",
    black: "#000000",
    transparent: "transparent",
    "slate-50": "#f8fafc",
    "slate-100": "#f1f5f9",
    "slate-500": "#64748b",
    "slate-900": "#0f172a",
    "gray-100": "#f3f4f6",
    "gray-500": "#6b7280",
    "gray-900": "#111827",
    "red-500": "#ef4444",
    "blue-500": "#3b82f6",
    "blue-600": "#2563eb",
    "green-500": "#22c55e",
    "violet-500": "#8b5cf6",
  }))
    for (const [prefix, p] of [
      ["bg", "background-color"],
      ["text", "color"],
      ["border", "border-color"],
    ])
      utilities[prefix + "-" + name] = p + ": " + color;
  for (const [k, v] of Object.entries({
    xs: ["0.75rem", "1rem"],
    sm: ["0.875rem", "1.25rem"],
    base: ["1rem", "1.5rem"],
    lg: ["1.125rem", "1.75rem"],
    xl: ["1.25rem", "1.75rem"],
    "2xl": ["1.5rem", "2rem"],
    "3xl": ["1.875rem", "2.25rem"],
  }))
    utilities["text-" + k] = "font-size: " + v[0] + "; line-height: " + v[1];
  for (const [k, v] of Object.entries({
    none: "1",
    tight: "1.25",
    snug: "1.375",
    normal: "1.5",
    relaxed: "1.625",
    loose: "2",
  }))
    utilities["leading-" + k] = "line-height: " + v;
  for (const prop of ["width", "height", "min-width", "min-height"]) {
    const p = Object.keys(prefixes).find((k) => prefixes[k][0] === prop);
    utilities[p + "-full"] = prop + ": 100%";
    utilities[p + "-auto"] = prop + ": auto";
  }
  function splitTop(s, separator) {
    let parts = [],
      buf = "",
      depth = 0,
      quote = "",
      escape = false;
    for (const c of s) {
      if (escape) {
        buf += c;
        escape = false;
        continue;
      }
      if (c === "\\") {
        buf += c;
        escape = true;
        continue;
      }
      if (quote) {
        buf += c;
        if (c === quote) quote = "";
        continue;
      }
      if (c === '"' || c === "'") {
        quote = c;
        buf += c;
        continue;
      }
      if (c === "(" || c === "[") depth++;
      if (c === ")" || c === "]") depth--;
      if (depth < 0) throw Error("Unbalanced delimiters.");
      if (depth === 0 && separator(c)) {
        if (buf.trim()) parts.push(buf.trim());
        buf = "";
      } else buf += c;
    }
    if (depth || quote || escape)
      throw Error("Unclosed delimiter, quote or escape.");
    if (buf.trim()) parts.push(buf.trim());
    return parts;
  }
  function declarations(css) {
    limit(css, 50000, "CSS");
    if (/[{}]/.test(css))
      throw Error("Paste declarations only, without selectors or braces.");
    if (/\/\*/.test(css)) throw Error("Remove CSS comments before converting.");
    return splitTop(css, (c) => c === ";").map((s) => {
      const p = s.indexOf(":");
      if (p < 1) throw Error("Expected property: value; for " + s);
      return [s.slice(0, p).trim().toLowerCase(), s.slice(p + 1).trim()];
    });
  }
  const arbitraryProps = {
    ...Object.fromEntries(
      Object.entries(prefixes)
        .filter(([, p]) => p.length === 1)
        .map(([k, p]) => [p[0], k]),
    ),
    color: "text",
    "font-size": "text",
    "font-family": "font",
    "font-weight": "font",
    "border-width": "border",
    "border-style": null,
    "grid-template-columns": "grid-cols",
    "grid-template-rows": "grid-rows",
    "backdrop-filter": null,
  };
  function encodeArbitrary(v) {
    if (/[\[\]{};!\n\r]/.test(v)) return null;
    return v.replace(/\\/g, "\\\\").replace(/_/g, "\\_").replace(/ /g, "_");
  }
  function decodeArbitrary(v) {
    return v.replace(/\\_|_|\\\\/g, (m) =>
      m === "\\_" ? "_" : m === "_" ? " " : "\\",
    );
  }
  function affected(prop) {
    if (prop === "padding" || prop === "margin")
      return ["top", "right", "bottom", "left"].map(
        (side) => prop + "-" + side,
      );
    if (
      prop === "border-width" ||
      prop === "border-color" ||
      prop === "border-style"
    )
      return ["top", "right", "bottom", "left"].map(
        (side) => "border-" + side + "-" + prop.split("-")[1],
      );
    return [prop];
  }
  function conflicts(rows) {
    const owners = new Map(),
      out = new Set();
    rows.forEach(([p], i) =>
      affected(p).forEach((prop) => {
        if (owners.has(prop)) {
          out.add(i);
          out.add(owners.get(prop));
        } else owners.set(prop, i);
      }),
    );
    return out;
  }
  function cssToTailwind(css) {
    const rows = declarations(css),
      warnings = [],
      residual = [],
      classes = [],
      overlap = conflicts(rows);
    for (const [index, [prop, value]] of rows.entries()) {
      if (!value) throw Error("Empty value for " + prop);
      if (overlap.has(index)) {
        residual.push(prop + ": " + value + ";");
        warnings.push(
          "Preserved conflicting CSS: " +
            prop +
            "; Tailwind utility order may change the cascade.",
        );
        continue;
      }
      const exact = Object.entries(utilities).find(
        ([, d]) => d === prop + ": " + value,
      );
      if (exact) {
        classes.push(exact[0]);
        continue;
      }
      const prefix = arbitraryProps[prop],
        encoded = encodeArbitrary(value);
      if (prefix && encoded) {
        let type =
          prop === "color"
            ? "color:"
            : prop === "font-size"
              ? "length:"
              : prop === "font-family"
                ? "family-name:"
                : prop === "font-weight"
                  ? "number:"
                  : prop === "border-width"
                    ? "length:"
                    : "";
        classes.push(prefix + "-[" + type + encoded + "]");
      } else {
        residual.push(prop + ": " + value + ";");
        warnings.push(
          "Preserved CSS: " +
            prop +
            " cannot be safely represented by this converter.",
        );
      }
    }
    return {
      output: classes.join(" "),
      residual: residual.join("\n"),
      warnings,
    };
  }
  function tailwindToCss(input) {
    limit(input, 50000, "Classes");
    const rows = [],
      warnings = [],
      residual = [];
    for (const token of splitTop(input, (c) => /\s/.test(c))) {
      if (utilities[token]) {
        rows.push(utilities[token]);
        continue;
      }
      const m = token.match(/^([a-z-]+)-\[(.+)\]$/);
      let properties = m && prefixes[m[1]],
        value = m && decodeArbitrary(m[2]);
      if (m && m[1] === "text") {
        if (value.startsWith("length:")) {
          properties = ["font-size"];
          value = value.slice(7);
        } else if (value.startsWith("color:")) {
          properties = ["color"];
          value = value.slice(6);
        } else if (/^#|^rgb\(|^hsl\(/.test(value)) properties = ["color"];
      }
      if (m && m[1] === "font") {
        if (value.startsWith("family-name:")) {
          properties = ["font-family"];
          value = value.slice(12);
        } else if (value.startsWith("number:")) {
          properties = ["font-weight"];
          value = value.slice(7);
        }
      }
      if (m && m[1] === "border" && value.startsWith("length:")) {
        properties = ["border-width"];
        value = value.slice(7);
      }
      if (
        properties &&
        value &&
        encodeArbitrary(value) !== null &&
        !/^backdrop-blur$/.test(m[1])
      )
        rows.push(properties.map((p) => p + ": " + value).join("; "));
      else {
        residual.push(token);
        warnings.push("Unsupported utility or variant preserved: " + token);
      }
    }
    const collision = conflicts(rows.flatMap((s) => declarations(s)));
    if (collision.size)
      warnings.push(
        "Overlapping utilities: output follows input token order; Tailwind uses generated stylesheet order. Review conflicting declarations.",
      );
    return {
      output: rows.map((s) => s + ";").join("\n"),
      residual: residual.join(" "),
      warnings,
    };
  }
  function shadowCss(layers, glass) {
    if (!Array.isArray(layers) || layers.length < 1 || layers.length > 5)
      throw Error("Use 1–5 shadow layers.");
    const number = (v, min, max) => {
      v = Number(v);
      if (!Number.isFinite(v) || v < min || v > max)
        throw Error("Control value is out of range.");
      return v;
    };
    const rgb = (color) => {
      if (!/^#[0-9a-f]{6}$/i.test(color))
        throw Error("Use a six-digit hex color.");
      return [1, 3, 5]
        .map((i) => parseInt(color.slice(i, i + 2), 16))
        .join(", ");
    };
    const shadow = layers
      .map(
        (l) =>
          `${l.inset ? "inset " : ""}${number(l.x, -100, 100)}px ${number(l.y, -100, 100)}px ${number(l.blur, 0, 100)}px ${number(l.spread, -100, 100)}px rgba(${rgb(l.color)}, ${number(l.opacity, 0, 1)})`,
      )
      .join(", ");
    const rows = ["box-shadow: " + shadow + ";"];
    if (glass?.enabled) {
      rows.push(
        "background-color: rgba(" +
          rgb(glass.color) +
          ", " +
          number(glass.opacity, 0, 1) +
          ");",
        "backdrop-filter: blur(" +
          number(glass.blur, 0, 60) +
          "px) saturate(" +
          number(glass.saturation, 0, 200) +
          "%);",
        "-webkit-backdrop-filter: blur(" +
          glass.blur +
          "px) saturate(" +
          glass.saturation +
          "%);",
        "border: " +
          number(glass.border, 0, 10) +
          "px solid rgba(255, 255, 255, " +
          number(glass.borderOpacity, 0, 1) +
          ");",
      );
    }
    const tw = ["shadow-[" + encodeArbitrary(shadow) + "]"];
    if (glass?.enabled) {
      tw.push(
        "bg-[" +
          encodeArbitrary(
            "rgba(" + rgb(glass.color) + ", " + glass.opacity + ")",
          ) +
          "]",
        "[backdrop-filter:" +
          encodeArbitrary(
            "blur(" + glass.blur + "px) saturate(" + glass.saturation + "%)",
          ) +
          "]",
        "[-webkit-backdrop-filter:" +
          encodeArbitrary(
            "blur(" + glass.blur + "px) saturate(" + glass.saturation + "%)",
          ) +
          "]",
        "[border:" +
          encodeArbitrary(
            glass.border +
              "px solid rgba(255, 255, 255, " +
              glass.borderOpacity +
              ")",
          ) +
          "]",
      );
    }
    return { css: rows.join("\n"), tailwind: tw.join(" ") };
  }
  return {
    shellWords,
    parseCurl,
    snippets,
    algorithms,
    hash,
    randomToken,
    uuids,
    patterns,
    regexMatches,
    cssToTailwind,
    tailwindToCss,
    shadowCss,
    utilities,
  };
});
