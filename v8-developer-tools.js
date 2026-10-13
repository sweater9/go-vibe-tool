/* Agent 1 isolated V8 workspace extension. Inputs/outputs stay in memory. */
(function () {
  "use strict";
  const core = window.GVTDeveloper;
  const newTools = [
    [
      "curl-snippets",
      "Developer",
      "cURL to Multi-Language Snippets",
      "Parse cURL locally into JavaScript fetch, axios, Python requests, httpx, Go and PHP code.",
    ],
    [
      "key-hash",
      "Privacy & Safety",
      "Universal Key & Hash Tool",
      "SHA hashes, HMAC, secure UUID v4 batches, random hex tokens and API keys with Web Crypto.",
    ],
    [
      "regex-playground",
      "Developer",
      "Regex Visualizer & Playground",
      "Test regular expressions safely in a bounded worker with matches, indices and capture groups.",
    ],
    [
      "tailwind-css",
      "Images & Design",
      "Tailwind CSS ⇄ Raw CSS Converter",
      "Convert common Tailwind CSS 3.4 utilities and raw CSS declarations, preserving unsupported input.",
    ],
    [
      "shadow-glass",
      "Images & Design",
      "Box-Shadow & Glassmorphism Canvas",
      "Design multilayer CSS shadows and glass effects with live preview and copyable CSS or Tailwind.",
    ],
  ];
  tools.push(...newTools);
  const ids = new Set(newTools.map((t) => t[0])),
    previousOpen = openTool,
    previousClose = closeTool;
  let dispose = () => {},
    output = "",
    sensitive = false,
    revision = 0;
  const E = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const field = (id, label, value = "", type = "text", extra = "") =>
    `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="${type}" value="${E(value)}" ${extra}></div>`;
  const area = (id, label, value = "", rows = 7, extra = "") =>
    `<div class="field"><label for="${id}">${label}</label><textarea id="${id}" rows="${rows}" spellcheck="false" ${extra}>${E(value)}</textarea></div>`;
  const select = (id, label, options) =>
    `<div class="field"><label for="${id}">${label}</label><select id="${id}">${options.map(([v, t]) => `<option value="${v}">${E(t)}</option>`).join("")}</select></div>`;
  const button = (id, label) =>
    `<button type="button" class="btn alt" id="${id}">${label}</button>`;
  const common = () =>
    `<div class="actions">${button("dev-copy", "Copy output")}${button("dev-export", "Export .txt")}${button("dev-clear", "Clear inputs & output")}</div><p id="dev-status" role="status" aria-live="polite"></p>`;
  const node = (id) => document.getElementById(id),
    status = (s) => {
      if (node("dev-status")) node("dev-status").textContent = s;
    };
  function show(text) {
    output = text;
    node("dev-output").value = text;
  }
  function warning(items) {
    node("dev-warning").textContent = items.join("\n");
  }
  async function copy() {
    if (!output) return status("Generate an output first.");
    if (
      sensitive &&
      !window.confirm(
        "This output contains authorization headers, cookies or credentials. Copying may expose secrets to your clipboard and other apps. Copy anyway?",
      )
    )
      return status("Copy cancelled.");
    try {
      await navigator.clipboard.writeText(output);
      status("Copied.");
    } catch {
      node("dev-output").focus();
      node("dev-output").select();
      status("Clipboard unavailable. Select and copy the output manually.");
    }
  }
  function exportOutput() {
    if (!output) return status("Generate an output first.");
    if (
      sensitive &&
      !window.confirm(
        "This output contains secrets. Export an unencrypted text file?",
      )
    )
      return status("Export cancelled.");
    const url = URL.createObjectURL(
        new Blob([output], { type: "text/plain;charset=utf-8" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = "govibetool-" + node("workspace").dataset.devTool + ".txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status("Exported.");
  }
  const curlSample = `curl 'https://api.example.com/items?limit=10&sort=name' \\\n  -X POST -H 'Content-Type: application/json' \\\n  -H 'Authorization: Bearer EXAMPLE_TOKEN' \\\n  --data-raw '{"name":"Hello world","active":true}'`;
  function curlUI() {
    return `<p class="note">Conversion only: pasted commands are never executed and requests are never sent. Shell expansion and file reads are unsupported.</p>${area("dev-input", "cURL command", curlSample, 8)}${select(
      "dev-language",
      "Output language",
      [
        ["fetch", "JavaScript — fetch"],
        ["axios", "JavaScript — axios"],
        ["requests", "Python — requests"],
        ["httpx", "Python — httpx"],
        ["go", "Go — net/http"],
        ["php", "PHP — curl_exec"],
      ],
    )}<div class="actions">${button("dev-run", "Generate snippets")}${button("dev-example", "Load example")}</div><p id="dev-warning" class="dev-warning" role="status"></p>${area("dev-output", "Generated code", "", 12, "readonly")}${common()}`;
  }
  function bindCurl() {
    const run = () => {
      output = "";
      sensitive = false;
      node("dev-output").value = "";
      try {
        if (!node("dev-input").value.trim())
          return warning(["Paste a literal cURL command to begin."]);
        const r = core.parseCurl(node("dev-input").value);
        warning(r.warnings);
        if (r.blocked)
          return status(
            "Generation blocked. Resolve unsupported options above.",
          );
        sensitive = r.sensitive;
        show(core.snippets(r)[node("dev-language").value]);
        status(
          sensitive
            ? "Contains credentials: review before copying or exporting."
            : "Generated locally.",
        );
      } catch (e) {
        warning([e.message]);
        status("Unable to generate code.");
      }
    };
    node("dev-run").onclick = run;
    node("dev-language").onchange = run;
    node("dev-example").onclick = () => {
      node("dev-input").value = curlSample;
      run();
    };
    node("dev-input").oninput = () => {
      show("");
      sensitive = false;
      status("Input changed. Generate new snippets.");
    };
    run();
  }
  function hashUI() {
    return `<p class="note">Native Web Crypto and crypto.getRandomValues(). Secrets are never transmitted or saved. SHA-1 is legacy/insecure for modern security use. Fast hashes are unsuitable for password storage; use a dedicated password hashing scheme.</p>${select(
      "dev-mode",
      "Operation",
      [
        ["hash", "Text hash"],
        ["hmac", "HMAC"],
        ["uuid", "UUID v4 batch"],
        ["token", "Random hex token"],
        ["api", "API key (gvt_ + secure hex)"],
      ],
    )}<div id="dev-hash-fields">${area("dev-input", "Text (UTF-8)", "hello", 4)}${select(
      "dev-algorithm",
      "SHA algorithm",
      core.algorithms.map((a) => [
        a,
        a === "SHA-1" ? a + " — legacy/insecure" : a,
      ]),
    )}<div id="dev-hmac-field" hidden>${field("dev-key", "HMAC secret key (UTF-8)", "", "password", 'autocomplete="off"')}</div></div><div id="dev-uuid-field" hidden>${select(
      "dev-batch",
      "UUID batch size",
      [
        ["1", "1 UUID"],
        ["10", "10 UUIDs"],
        ["100", "100 UUIDs"],
      ],
    )}</div><div id="dev-token-field" hidden>${field("dev-bytes", "Secure random byte length", 32, "number", 'min="1" max="4096" step="1"')}</div>${button("dev-run", "Generate")}<p id="dev-warning" class="dev-warning" role="status"></p>${area("dev-output", "Output", "", 8, "readonly")}${common()}`;
  }
  function bindHash() {
    node("dev-algorithm").value = "SHA-256";
    const invalidate = () => {
      revision++;
      show("");
      status("Input changed. Generate a new output.");
    };
    node("dev-mode").onchange = () => {
      const mode = node("dev-mode").value;
      node("dev-hash-fields").hidden = !["hash", "hmac"].includes(mode);
      node("dev-hmac-field").hidden = mode !== "hmac";
      node("dev-uuid-field").hidden = mode !== "uuid";
      node("dev-token-field").hidden = !["token", "api"].includes(mode);
      invalidate();
    };
    for (const id of [
      "dev-input",
      "dev-key",
      "dev-algorithm",
      "dev-bytes",
      "dev-batch",
    ])
      node(id).oninput = invalidate;
    node("dev-run").onclick = async () => {
      const ticket = ++revision;
      show("");
      status("Generating locally…");
      try {
        const mode = node("dev-mode").value;
        let value;
        if (mode === "hash" || mode === "hmac") {
          if (mode === "hmac" && !node("dev-key").value)
            throw Error("Enter a non-empty HMAC key.");
          value = await core.hash(
            node("dev-input").value,
            node("dev-algorithm").value,
            mode === "hmac" ? node("dev-key").value : null,
          );
        } else if (mode === "uuid")
          value = core.uuids(Number(node("dev-batch").value)).join("\n");
        else
          value =
            (mode === "api" ? "gvt_" : "") +
            core.randomToken(Number(node("dev-bytes").value));
        if (ticket !== revision) return;
        show(value);
        sensitive = ["token", "api"].includes(mode);
        warning(
          node("dev-algorithm").value === "SHA-1" &&
            ["hash", "hmac"].includes(mode)
            ? ["SHA-1 is legacy/insecure for modern security use."]
            : [],
        );
        status("Generated locally.");
      } catch (e) {
        if (ticket === revision) {
          warning([e.message]);
          status("Generation failed.");
        }
      }
    };
  }
  function regexUI() {
    return `<p class="note">Patterns execute in a dedicated worker with a 300 ms execution limit after startup (3 s startup limit). Maximum 100,000 text characters, 2,000 pattern characters and 1,000 matches. Capture detail and output size are also bounded. A timeout is a safety limit, not a verdict about the pattern.</p>${select("dev-pattern-preset", "Reusable pattern", [["custom", "Custom"], ...Object.keys(core.patterns).map((p) => [p, p])])}<p id="dev-preset-note" class="note"></p>${field("dev-pattern", "Regular expression (without / delimiters)", "(?<word>\\w+)")}<fieldset class="dev-flags"><legend>Flags</legend>${["g", "i", "m", "s"].map((f) => `<label><input type="checkbox" data-flag="${f}" ${f === "g" ? "checked" : ""}> ${f}</label>`).join("")}</fieldset>${area("dev-input", "Test text", "Hello browser tools. Hello regex!", 6)}<p id="dev-warning" class="dev-warning" role="status"></p><div class="dev-highlight" id="dev-highlight" aria-label="Highlighted regex matches"></div><div id="dev-matches"></div>${area("dev-output", "Match details (JSON)", "", 8, "readonly")}${common()}`;
  }
  function bindRegex() {
    let worker = null,
      timer = null,
      debounce = null,
      sequence = 0;
    const cancel = () => {
      if (worker) worker.terminate();
      worker = null;
      clearTimeout(timer);
    };
    dispose = () => {
      sequence++;
      cancel();
      clearTimeout(debounce);
    };
    const render = (r) => {
      node("dev-highlight").replaceChildren();
      node("dev-matches").replaceChildren();
      let cursor = 0;
      const text = node("dev-input").value;
      for (const m of r.matches) {
        if (m.index > cursor)
          node("dev-highlight").append(
            document.createTextNode(text.slice(cursor, m.index)),
          );
        const mark = document.createElement("mark");
        if (!m.text) mark.textContent = "│";
        else {
          const captures = m.indices
              .slice(1)
              .map((range, i) => ({ range, i }))
              .filter(
                (c) => c.range && c.range[0] < m.end && c.range[1] > m.index,
              ),
            cuts = [
              ...new Set([
                m.index,
                m.end,
                ...captures.flatMap((c) => [
                  Math.max(m.index, c.range[0]),
                  Math.min(m.end, c.range[1]),
                ]),
              ]),
            ].sort((a, b) => a - b);
          for (let i = 0; i < cuts.length - 1; i++) {
            const a = cuts[i],
              b = cuts[i + 1],
              active = captures.filter(
                (c) => c.range[0] <= a && c.range[1] >= b,
              ),
              piece = document.createElement("span");
            piece.textContent = text.slice(a, b);
            if (active.length) {
              piece.className =
                "dev-inline-capture dev-group-" + (active.at(-1).i % 3);
              piece.title = active
                .map((c) => "Capture group " + (c.i + 1))
                .join(", ");
            }
            mark.append(piece);
          }
        }
        mark.title = (m.text ? "Match" : "Zero-width match") + " at " + m.index;
        node("dev-highlight").append(mark);
        cursor = m.end;
        const row = document.createElement("p");
        row.className = "dev-match";
        const heading = document.createElement("strong");
        heading.textContent = `[${m.index}, ${m.end}) ${m.text ? "Match" : "Zero-width match"}`;
        row.append(heading);
        m.groups.forEach((g, i) => {
          const span = document.createElement("span");
          span.className = "dev-capture";
          span.textContent = `Group ${i + 1}: ${g === null ? "unmatched" : JSON.stringify(g)} @ ${m.indices[i + 1] ? m.indices[i + 1].join("–") : "—"}`;
          row.append(span);
        });
        for (const [name, g] of Object.entries(m.named)) {
          const span = document.createElement("span");
          span.className = "dev-capture";
          span.textContent = `Named ${name}: ${JSON.stringify(g)}`;
          row.append(span);
        }
        node("dev-matches").append(row);
      }
      node("dev-highlight").append(document.createTextNode(text.slice(cursor)));
      show(JSON.stringify(r.matches, null, 2));
      status(
        r.matches.length +
          " matches" +
          (r.truncated ? " — " + r.reason : "") +
          ".",
      );
    };
    const run = () => {
      cancel();
      const token = ++sequence;
      show("");
      node("dev-highlight").replaceChildren();
      node("dev-matches").replaceChildren();
      warning([]);
      status("Matching in isolated worker…");
      const data = {
        pattern: node("dev-pattern").value,
        text: node("dev-input").value,
        flags: [...document.querySelectorAll("[data-flag]:checked")]
          .map((n) => n.dataset.flag)
          .join(""),
      };
      if (data.pattern.length > 2000 || data.text.length > 100000) {
        warning(["Pattern or text exceeds the documented size limit."]);
        return status("Input too large.");
      }
      try {
        worker = new Worker("v8-regex-worker.js");
        const timeout = () => {
          cancel();
          warning([
            "Regex execution timed out. Simplify the expression or reduce the test text.",
          ]);
          status("Worker terminated; the interface remains responsive.");
        };
        timer = setTimeout(timeout, 3000);
        worker.onmessage = (e) => {
          if (token !== sequence) return;
          if (e.data.ready) {
            clearTimeout(timer);
            timer = setTimeout(timeout, 300);
            worker.postMessage(data);
            return;
          }
          cancel();
          if (!e.data.ok) {
            warning([e.data.error]);
            status("Invalid expression.");
          } else render(e.data);
        };
        worker.onerror = () => {
          cancel();
          warning([
            "Regex worker could not load. Reload this page once online to cache the worker.",
          ]);
          status("Matching unavailable.");
        };
      } catch (e) {
        warning([e.message]);
        status("Workers are required for safe matching.");
      }
    };
    const schedule = () => {
      cancel();
      sequence++;
      show("");
      clearTimeout(debounce);
      debounce = setTimeout(run, 180);
    };
    node("dev-pattern").oninput = schedule;
    node("dev-input").oninput = schedule;
    document
      .querySelectorAll("[data-flag]")
      .forEach((n) => (n.onchange = schedule));
    node("dev-pattern-preset").onchange = () => {
      const p = core.patterns[node("dev-pattern-preset").value];
      if (p) {
        node("dev-pattern").value = p.pattern;
        node("dev-input").value = p.sample;
        node("dev-preset-note").textContent = p.note;
      } else node("dev-preset-note").textContent = "";
      run();
    };
    run();
  }
  const cssExample =
    "display: flex;\npadding: 1rem;\ngap: 0.5rem;\nbackground-color: #3b82f6;\ncolor: #ffffff;\nborder-radius: 0.5rem;\nfont-weight: 600;\nscroll-behavior: smooth;";
  function tailwindUI() {
    return `<p class="note">Targets Tailwind CSS 3.4 with its default theme. Paste CSS declarations only. Supports common spacing, display, flex, grid, colors, borders, shadows and typography. Arbitrary values are used where valid; unsupported CSS or utility tokens are preserved below. Custom themes, variants, plugins and !important are not translated. Tailwind Preflight supplies reset defaults such as border-style.</p>${select(
      "dev-direction",
      "Conversion direction",
      [
        ["css", "CSS → Tailwind"],
        ["tw", "Tailwind → CSS"],
      ],
    )}${area("dev-input", "Editable input", cssExample, 9)}<div class="actions">${button("dev-run", "Convert")}${button("dev-example", "Load example")}</div><p id="dev-warning" class="dev-warning" role="status"></p>${area("dev-output", "Converted output", "", 8)}${area("dev-residual", "Preserved unsupported input", "", 4, "readonly")}${button("dev-copy-residual", "Copy preserved input")}${common()}`;
  }
  function bindTailwind() {
    const run = () => {
      try {
        const r = (
          node("dev-direction").value === "css"
            ? core.cssToTailwind
            : core.tailwindToCss
        )(node("dev-input").value);
        show(r.output);
        node("dev-residual").value = r.residual;
        warning(r.warnings);
        status(
          r.output
            ? "Converted locally. Review preserved input."
            : "Enter supported input to convert.",
        );
      } catch (e) {
        show("");
        node("dev-residual").value = node("dev-input").value;
        warning([e.message]);
        status("Unable to convert. Original input preserved.");
      }
    };
    node("dev-run").onclick = run;
    node("dev-input").oninput = () => {
      show("");
      node("dev-residual").value = "";
      status("Input changed. Convert again.");
    };
    node("dev-output").oninput = () => {
      output = node("dev-output").value;
    };
    node("dev-copy-residual").onclick = async () => {
      try {
        await navigator.clipboard.writeText(node("dev-residual").value);
        status("Preserved input copied.");
      } catch {
        status("Select preserved input to copy manually.");
      }
    };
    node("dev-example").onclick = () => {
      node("dev-input").value =
        node("dev-direction").value === "css"
          ? cssExample
          : "flex p-4 gap-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600";
      run();
    };
    node("dev-direction").onchange = () => {
      show("");
      node("dev-residual").value = "";
      status("Direction changed. Enter input or load an example.");
    };
    run();
  }
  const initialLayer = () => ({
    x: 0,
    y: 12,
    blur: 30,
    spread: -6,
    opacity: 0.22,
    color: "#0f172a",
    inset: false,
  });
  const initialGlass = () => ({
    enabled: true,
    color: "#ffffff",
    opacity: 0.2,
    blur: 16,
    saturation: 140,
    border: 1,
    borderOpacity: 0.4,
  });
  function range(id, label, v, min, max, step = 1) {
    return `<div class="field"><label for="${id}">${label} <output for="${id}" id="${id}-value">${v}</output></label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${v}"></div>`;
  }
  function shadowUI() {
    return `<p class="note">Design 1–5 shadow layers. Preview effects depend on browser backdrop-filter support. Output uses standard CSS and valid Tailwind 3.4 arbitrary values.</p>${select(
      "dev-preset",
      "Preset",
      [
        ["soft", "Soft glass"],
        ["card", "Raised card"],
        ["neon", "Neon glow"],
        ["inset", "Inset panel"],
      ],
    )}<div class="dev-canvas"><div id="dev-preview" class="dev-preview"><strong>GoVibeTool</strong><span>Your CSS canvas</span></div></div><div class="grid2"><section><h3>Shadow layers</h3><div id="dev-layers"></div><div class="actions">${button("dev-add", "Add layer")}${button("dev-remove", "Remove last layer")}</div></section><section><h3>Glassmorphism</h3><label class="dev-check"><input id="dev-glass-enabled" type="checkbox" checked> Enable glass effect</label>${field("dev-glass-color", "Glass background", "#ffffff", "color")}${range("dev-glass-opacity", "Background opacity", 0.2, 0, 1, 0.01)}${range("dev-glass-blur", "Backdrop blur (px)", 16, 0, 60)}${range("dev-glass-saturation", "Saturation (%)", 140, 0, 200)}${range("dev-glass-border", "Border width (px)", 1, 0, 10, 0.1)}${range("dev-glass-borderOpacity", "Border opacity", 0.4, 0, 1, 0.01)}</section></div>${select(
      "dev-format",
      "Output format",
      [
        ["css", "Standard CSS"],
        ["tailwind", "Tailwind 3.4 arbitrary values"],
      ],
    )}${button("dev-reset", "Reset")}<p id="dev-warning" class="dev-warning" role="status"></p>${area("dev-output", "Generated style", "", 7, "readonly")}${common()}`;
  }
  function bindShadow() {
    let layers = [initialLayer()],
      glass = initialGlass();
    const drawLayers = () => {
      node("dev-layers").innerHTML = layers
        .map(
          (l, i) =>
            `<fieldset class="dev-layer"><legend>Layer ${i + 1}</legend>${range("dev-layer-" + i + "-x", "Horizontal offset (px)", l.x, -100, 100)}${range("dev-layer-" + i + "-y", "Vertical offset (px)", l.y, -100, 100)}${range("dev-layer-" + i + "-blur", "Blur (px)", l.blur, 0, 100)}${range("dev-layer-" + i + "-spread", "Spread (px)", l.spread, -100, 100)}${range("dev-layer-" + i + "-opacity", "Opacity", l.opacity, 0, 1, 0.01)}${field("dev-layer-" + i + "-color", "Shadow color", l.color, "color")}<label class="dev-check"><input id="dev-layer-${i}-inset" type="checkbox" ${l.inset ? "checked" : ""}> Inset</label></fieldset>`,
        )
        .join("");
      node("dev-add").disabled = layers.length >= 5;
      node("dev-remove").disabled = layers.length <= 1;
    };
    const syncGlass = () => {
      for (const [key, value] of Object.entries(glass)) {
        const el = node("dev-glass-" + key);
        if (key === "enabled") el.checked = value;
        else el.value = value;
      }
    };
    const run = () => {
      layers = layers.map((l, i) =>
        Object.fromEntries(
          Object.keys(l).map((k) => {
            const el = node("dev-layer-" + i + "-" + k);
            return [
              k,
              k === "inset"
                ? el.checked
                : k === "color"
                  ? el.value
                  : Number(el.value),
            ];
          }),
        ),
      );
      for (const key of Object.keys(glass)) {
        const el = node("dev-glass-" + key);
        glass[key] =
          key === "enabled"
            ? el.checked
            : key === "color"
              ? el.value
              : Number(el.value);
      }
      document
        .querySelectorAll('#workspace input[type="range"]')
        .forEach((el) => {
          node(el.id + "-value").textContent = el.value;
        });
      try {
        const r = core.shadowCss(layers, glass);
        node("dev-preview").style.cssText = r.css;
        node("dev-preview").style.color =
          node("dev-preset").value === "neon" ? "#ffffff" : "#0f172a";
        show(r[node("dev-format").value]);
        status("Style updated locally.");
      } catch (e) {
        warning([e.message]);
      }
    };
    node("workspace").addEventListener("input", run);
    node("dev-format").onchange = run;
    node("dev-add").onclick = () => {
      if (layers.length < 5) layers.push(initialLayer());
      drawLayers();
      run();
    };
    node("dev-remove").onclick = () => {
      if (layers.length > 1) layers.pop();
      drawLayers();
      run();
    };
    node("dev-reset").onclick = () => {
      layers = [initialLayer()];
      glass = initialGlass();
      node("dev-preset").value = "soft";
      syncGlass();
      drawLayers();
      run();
    };
    node("dev-preset").onchange = () => {
      const p = node("dev-preset").value;
      glass = initialGlass();
      layers = [initialLayer()];
      if (p === "card") {
        glass.enabled = false;
        layers = [
          { ...initialLayer(), y: 4, blur: 6, spread: -1, opacity: 0.1 },
          { ...initialLayer(), y: 2, blur: 4, spread: -2, opacity: 0.1 },
        ];
      }
      if (p === "neon") {
        glass.color = "#0f172a";
        glass.opacity = 0.75;
        layers = [
          {
            ...initialLayer(),
            color: "#8b5cf6",
            y: 0,
            blur: 30,
            spread: 5,
            opacity: 0.65,
          },
          {
            ...initialLayer(),
            color: "#38bdf8",
            y: 0,
            blur: 60,
            spread: 10,
            opacity: 0.3,
          },
        ];
      }
      if (p === "inset") {
        glass.enabled = false;
        layers = [
          {
            ...initialLayer(),
            x: 0,
            y: 2,
            blur: 6,
            spread: 0,
            inset: true,
            opacity: 0.3,
          },
        ];
      }
      syncGlass();
      drawLayers();
      run();
    };
    drawLayers();
    run();
    dispose = () => {
      node("workspace").removeEventListener("input", run);
    };
  }
  openTool = function (id) {
    dispose();
    dispose = () => {};
    revision++;
    output = "";
    sensitive = false;
    if (!ids.has(id)) {
      delete node("workspace").dataset.devTool;
      return previousOpen(id);
    }
    previousClose();
    rememberTool(id);
    const t = newTools.find((t) => t[0] === id),
      w = node("workspace");
    w.dataset.devTool = id;
    const ui = {
      "curl-snippets": curlUI,
      "key-hash": hashUI,
      "regex-playground": regexUI,
      "tailwind-css": tailwindUI,
      "shadow-glass": shadowUI,
    };
    w.innerHTML = shell(t, `<div class="dev-tool">${ui[id]()}</div>`);
    w.classList.add("active");
    ({
      "curl-snippets": bindCurl,
      "key-hash": bindHash,
      "regex-playground": bindRegex,
      "tailwind-css": bindTailwind,
      "shadow-glass": bindShadow,
    })[id]();
    node("dev-copy").onclick = copy;
    node("dev-export").onclick = exportOutput;
    node("dev-clear").onclick = () => {
      if (id === "regex-playground") dispose();
      revision++;
      output = "";
      sensitive = false;
      w.querySelectorAll(
        'textarea,input[type="text"],input[type="password"]',
      ).forEach((el) => (el.value = ""));
      w.querySelector("#dev-highlight")?.replaceChildren();
      w.querySelector("#dev-matches")?.replaceChildren();
      warning([]);
      status("Inputs and output cleared.");
    };
    w.focus({ preventScroll: true });
    w.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  closeTool = function () {
    dispose();
    dispose = () => {};
    revision++;
    output = "";
    sensitive = false;
    const w = node("workspace");
    if (ids.has(w.dataset.devTool)) {
      w.replaceChildren();
      delete w.dataset.devTool;
    }
    return previousClose();
  };
  renderCatalog();
  renderDiscoveryShelf();
})();
