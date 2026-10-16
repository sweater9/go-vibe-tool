/* Consolidated studio engines, entirely local; no storage or network. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GVTStudios = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";
  const aliases = {
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
  };
  const canonical = {
    url: "link-fingerprint",
    qr: "qr-studio",
    privacy: "pii-secret-redactor",
  };
  const titles = {
    url: "URL & Link Studio",
    qr: "QR Studio v2",
    privacy: "PII & Secret Redactor",
  };
  const bounded = (s) => {
    s = String(s ?? "");
    if (s.length > 100000) throw Error("Maximum 100,000 characters.");
    return s;
  };
  function parseUrl(s) {
    const u = new URL(bounded(s).trim());
    if (!/^https?:$/.test(u.protocol))
      throw Error("Only HTTP and HTTPS links are supported.");
    return u;
  }
  const trackers = new Set([
    "fbclid",
    "gclid",
    "dclid",
    "msclkid",
    "yclid",
    "mc_cid",
    "mc_eid",
    "igshid",
    "ref_src",
    "_hsenc",
    "_hsmi",
  ]);
  function inspectUrl(s) {
    const u = parseUrl(s),
      clean = new URL(u.href),
      removed = [],
      signals = [];
    for (const k of new Set(clean.searchParams.keys()))
      if (/^utm_/i.test(k) || trackers.has(k.toLowerCase())) {
        removed.push(k);
        clean.searchParams.delete(k);
      }
    if (u.username || u.password) signals.push("Credentials embedded in URL");
    if (u.hostname.split(".").some((p) => p.startsWith("xn--")))
      signals.push("Punycode / internationalized hostname");
    if (/[^\x00-\x7f]/.test(s))
      signals.push("Non-ASCII characters in supplied URL");
    if (u.protocol === "http:") signals.push("Unencrypted HTTP");
    if (/^(bit\.ly|t\.co|tinyurl\.com|ow\.ly|buff\.ly)$/i.test(u.hostname))
      signals.push("Short-link signal; redirect not followed");
    return {
      scheme: u.protocol,
      host: u.hostname,
      port: u.port,
      path: u.pathname,
      query: [...u.searchParams],
      clean: clean.href,
      removed,
      fingerprint: u.origin + u.pathname,
      signals,
      sensitive:
        !!(u.username || u.password) ||
        [...u.searchParams.keys()].some((k) =>
          /token|secret|password|api.?key/i.test(k),
        ),
    };
  }
  function utmUrl(s, values) {
    const u = parseUrl(s);
    for (const [k, v] of Object.entries(values)) {
      if (!["source", "medium", "campaign"].includes(k))
        throw Error("Unsupported UTM field.");
      if (String(v).trim()) u.searchParams.set("utm_" + k, String(v).trim());
    }
    return u.href;
  }
  function freelance(d) {
    const keys = [
      "target",
      "overhead",
      "hours",
      "weeks",
      "utilization",
      "tax",
      "margin",
      "quoteHours",
    ];
    const v = {};
    for (const k of keys) {
      if (d[k] === null || d[k] === undefined || String(d[k]).trim() === "")
        throw Error(
          "Enter every numeric assumption, using 0 where appropriate.",
        );
      v[k] = Number(d[k]);
      if (!Number.isFinite(v[k])) throw Error("Enter finite numbers.");
    }
    if (
      v.target < 0 ||
      v.overhead < 0 ||
      v.quoteHours < 0 ||
      v.hours <= 0 ||
      v.hours > 168 ||
      v.weeks <= 0 ||
      v.weeks > 52 ||
      v.utilization <= 0 ||
      v.utilization > 100 ||
      v.tax < 0 ||
      v.tax >= 95 ||
      v.margin < 0 ||
      v.margin >= 95
    )
      throw Error(
        "Enter valid nonnegative amounts and realistic hours, weeks, utilization, tax and margin.",
      );
    const billable = (v.hours * v.weeks * v.utilization) / 100,
      revenue = v.target / (1 - v.tax / 100) + v.overhead,
      base = revenue / billable,
      rate = base / (1 - v.margin / 100);
    const quote = rate * v.quoteHours;
    if (billable <= 0 || ![billable, revenue, base, rate, quote].every(Number.isFinite))
      throw Error("These assumptions exceed the supported calculation range.");
    return { billable, revenue, base, rate, quote };
  }
  function effective(d) {
    for (const k of ["revenue", "costs", "billable", "unpaid"])
      if (d[k] === null || d[k] === undefined || String(d[k]).trim() === "" || !Number.isFinite(Number(d[k])) || Number(d[k]) < 0)
        throw Error("Enter nonnegative project amounts and hours.");
    const total = Number(d.billable) + Number(d.unpaid);
    if (!Number.isFinite(total) || (total && !Number.isFinite((Number(d.revenue) - Number(d.costs)) / total)))
      throw Error("These project inputs exceed the supported calculation range.");
    return {
      net: Number(d.revenue) - Number(d.costs),
      rate: total ? (Number(d.revenue) - Number(d.costs)) / total : null,
      utilization: total ? (Number(d.billable) / total) * 100 : null,
    };
  }
  function validatePayload(s, type = "text") {
    s = bounded(s);
    if (!s.trim()) return { ok: false, message: "Enter text or a URL." };
    if (type === "url" || /^https?:/i.test(s.trim())) {
      try {
        parseUrl(s);
        return { ok: true, message: "Valid HTTP(S) URL payload." };
      } catch (e) {
        return {
          ok: true,
          warning: true,
          message:
            "Warning: malformed URL; the supplied value can still be encoded as plain text. " +
            e.message,
        };
      }
    }
    return { ok: true, message: "Plain-text payload (valid for QR)." };
  }
  const patterns = [
    [
      "JWT",
      "secrets",
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    ],
    ["Bearer token", "secrets", /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi],
    [
      "API key",
      "secrets",
      /\b(?:api[_-]?key|access[_-]?token|secret|password|token)\s*[:=]\s*["']?[^\s"'\n,;]{6,}["']?/gi,
    ],
    ["Email", "email", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi],
    ["IPv4", "ip", /\b(?:\d{1,3}\.){3}\d{1,3}\b/g],
    ["Phone", "phone", /(?<!\w)(?:\+?\d[\d ()-]{7,}\d)(?!\w)/g],
    [
      "Connection string",
      "connection",
      /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s"'<>]+/gi,
    ],
  ];
  function redact(
    s,
    {
      audit = false,
      mode = "replace",
      categories = ["email", "phone", "secrets", "ip", "connection"],
    } = {},
  ) {
    s = bounded(s);
    if (!["replace", "mask", "remove"].includes(mode))
      throw Error("Unsupported redaction mode.");
    let output = s;
    const findings = [];
    for (const [label, category, re] of patterns) {
      if (!categories.includes(category)) continue;
      output = output.replace(re, (m) => {
        findings.push(label);
        return mode === "remove"
          ? ""
          : mode === "mask"
            ? "•".repeat(Math.min(Math.max(m.length, 4), 24))
            : "[" + label.toUpperCase().replace(/ /g, "_") + "_REDACTED]";
      });
    }
    return {
      output: audit ? s : output,
      preview: audit ? null : output,
      findings,
    };
  }
  return {
    aliases,
    canonical,
    titles,
    inspectUrl,
    utmUrl,
    freelance,
    effective,
    validatePayload,
    redact,
  };
});
