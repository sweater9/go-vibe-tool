// Browser wrapper. Loads the local index and lexicon, then renders searchKnowledge.
import { searchKnowledge } from "./search-core.mjs";
// Experimental, opt-in only (?semantic=1). Default behaviour is unchanged lexical search.
const SEMANTIC = new URLSearchParams(location.search).get("semantic") === "1";
let semantic = null;
let searchHybrid = null;
// Search intelligence (additive): typo/abbreviation repair, topic clusters, tool and related-guide mapping.
// Loaded lazily; if any of it fails the page keeps using the plain lexical engine.
let intelligent = null;
let extras = null;

const form = document.querySelector("#kn-search-form");
const input = document.querySelector("#kn-q");
const status = document.querySelector("#kn-search-status");
const results = document.querySelector("#kn-search-results");
if (!form || !input || !results) throw new Error("Knowledge search markup missing");

let index = null;
let lexicon = null;
let timer = 0;
let loadFailed = false;
const LOAD_ERROR = "Search could not be loaded. Refresh the page and try again.";

// The status region is visually hidden, so a load failure is also shown in the results area.
function showLoadError() {
  results.replaceChildren(el("p", "kn-gap", LOAD_ERROR));
  status.textContent = LOAD_ERROR;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function pageHref(page) {
  return page.id + ".html";
}

function toolHref(url) {
  if (!url) return "../index.html";
  if (/^(https?:|\/|\.\.)/.test(url)) return url;
  return "../" + url;
}

function section(kicker, title) {
  const block = el("section", "kn-result-block");
  block.append(el("p", "kn-kicker", kicker));
  if (title) block.append(el("h2", null, title));
  return block;
}

function appendTools(found) {
  if (!found.tools || !found.tools.length) return;
  const tools = section("Use IntelliTools", null);
  for (const tool of found.tools) {
    const card = el("div", "kn-toolpick");
    const a = el("a");
    a.href = toolHref(tool.url);
    a.textContent = tool.name;
    card.append(a);
    card.append(el("p", null, tool.reason));
    tools.append(card);
  }
  results.append(tools);
}

function render(query) {
  try {
    renderResults(query);
  } catch {
    const message = "Search could not complete. Try another query or refresh the page.";
    results.replaceChildren(el("p", "kn-gap", message));
    status.textContent = message;
  }
}

function renderResults(query) {
  results.replaceChildren();
  if (!index || !lexicon) {
    if (loadFailed) showLoadError();
    else status.textContent = "Search is loading.";
    return;
  }
  const q = query.trim();
  if (!q) {
    status.textContent = "";
    return;
  }
  const hybrid = (text) => searchHybrid(index, lexicon, semantic, text, "gated", {
    // Release mode: semantics improves ranking / Closest pages only.
    // It must never create, withhold, or swap a confident lexical answer.
    vetoZ: -1e9,
    lexVetoCoverage: 0,
    ovZ: 1e9,
    contradictVeto: false,
    dTauZ: 1e9,
    limitedConfidence: true
  });
  const base = (text) => (semantic ? hybrid(text) : searchKnowledge(index, lexicon, text));
  let found;
  try {
    found = intelligent ? intelligent(index, lexicon, q, extras || {}, { engine: base }) : base(q);
  } catch {
    found = base(q); // the intelligence layer must never take search down
  }
  if (found.rewrite) {
    const note = el("p", "kn-rewrite");
    note.textContent = "Showing results for “" + found.rewrite.to + "” (you typed “" + found.rewrite.from + "”).";
    results.append(note);
  }
  if (found.gap) {
    const note = el("p", "kn-gap");
    note.textContent = found.gap.message;
    results.append(note);
  }
  if (!found.solid) {
    const block = section("Answer / guide", "No confident match found.");
    const p = el("p");
    p.textContent = found.disambiguation
      ? "“" + found.disambiguation.term + "” can mean several things. Pick the one you mean."
      : found.weak.length
        ? "The closest pages are listed below. They are not confident matches, so none is shown as the answer."
        : "No Knowledge guide matched this query.";
    block.append(p);
    results.append(block);
    if (found.weak.length) {
      const weak = section(found.disambiguation ? "Which one do you mean?" : "Closest pages", found.disambiguation ? null : "Weak matches");
      const list = el("ul", "kn-linklist");
      const labels = new Map((found.disambiguation ? found.disambiguation.options : []).map((o) => [o.page, o.label]));
      for (const row of found.weak) {
        const li = el("li");
        const a = el("a");
        a.href = pageHref(row.page);
        a.textContent = labels.get(row.page.id) || row.page.title;
        li.append(a);
        list.append(li);
      }
      weak.append(list);
      results.append(weak);
    }
    appendTools(found);
    status.textContent = "No solid guide for “" + q + "”." + (found.tools && found.tools.length ? " Tool suggested: " + found.tools.map((t) => t.name).join(", ") + "." : "");
    return;
  }

  const page = found.answer.page;
  const answer = section("Answer / guide", page.title);
  const summary = el("p", "kn-answer");
  summary.textContent = page.summary;
  answer.append(summary);
  if (page.headings && page.headings.length) {
    const cover = el("p", "kn-cover");
    cover.textContent = "This guide covers: " + page.headings.join(", ") + ".";
    answer.append(cover);
  }
  const more = el("p");
  const link = el("a", "kn-read");
  link.href = pageHref(page);
  link.textContent = "Read the guide";
  more.append(link);
  answer.append(more);
  results.append(answer);

  if (found.cluster && found.cluster.pages.length) {
    const cluster = section("Related guides", found.cluster.title);
    if (found.cluster.note) cluster.append(el("p", null, found.cluster.note));
    const list = el("ul", "kn-linklist");
    for (const row of found.cluster.pages) {
      const li = el("li");
      const a = el("a");
      a.href = pageHref(row.page);
      a.textContent = row.page.title;
      li.append(a);
      list.append(li);
    }
    cluster.append(list);
    results.append(cluster);
  }

  if (found.need.length) {
    const need = section("What you'll need", null);
    const list = el("ul", "kn-need");
    for (const item of found.need) {
      const li = el("li");
      li.append(el("strong", null, item.name));
      li.append(document.createTextNode(" "));
      li.append(el("span", null, item.kind));
      list.append(li);
    }
    need.append(list);
    results.append(need);
  }

  if (found.learnMore.length) {
    const learn = section("Learn more", null);
    const list = el("ul", "kn-linklist");
    for (const row of found.learnMore) {
      const li = el("li");
      const a = el("a");
      a.href = pageHref(row.page);
      a.textContent = row.page.title;
      const small = el("small");
      small.textContent = row.page.question || "";
      li.append(a, small);
      if (row.relation && row.relation !== "related") li.append(el("em", "kn-relation", " " + row.relation));
      list.append(li);
    }
    learn.append(list);
    results.append(learn);
  }

  appendTools(found);

  const extra = found.gap ? " A coverage note is shown." : "";
  const toolNote = found.tools.length ? " Tool suggested: " + found.tools.map((t) => t.name).join(", ") + "." : "";
  status.textContent = "Guide: " + page.title + "." + toolNote + extra;
}

async function load() {
  try {
    const [indexRes, lexiconRes] = await Promise.all([
      fetch("search-index.json"),
      fetch("search-lexicon.json")
    ]);
    if (!indexRes.ok || !lexiconRes.ok) throw new Error("HTTP error");
    index = await indexRes.json();
    lexicon = await lexiconRes.json();
  } catch {
    loadFailed = true;
    showLoadError();
    return;
  }
  loadIntelligence();
  if (SEMANTIC) {
    // Lazy: lexical search is usable immediately; the ~1 MB (gzipped) semantic index loads in the background.
    Promise.all([import("./hybrid-search.mjs"), import("./semantic-core.mjs"), fetch("semantic-index.json").then((r) => r.json())])
      .then(([h, c, raw]) => { searchHybrid = h.searchHybrid; semantic = c.loadSemantic(raw); if (input.value.trim()) render(input.value); })
      .catch(() => { semantic = null; });
  }
  const params = new URLSearchParams(location.search);
  const initial = params.get("q") || "";
  if (initial) {
    input.value = initial;
    render(initial);
  }
}

// Optional layer: a failure of any piece leaves plain lexical search in place and is not shown to the visitor.
async function loadIntelligence() {
  try {
    const files = ["query-understanding.json", "tool-map.json", "relations.json"];
    const [mod, ...raw] = await Promise.all([
      import("./search-intelligence.mjs"),
      ...files.map((f) => fetch(f).then((r) => (r.ok ? r.json() : null)).catch(() => null))
    ]);
    const byFile = Object.fromEntries(files.map((f, i) => [f, raw[i]]));
    extras = mod.loadExtras((rel) => byFile[rel] || null);
    intelligent = mod.searchIntelligent;
    if (input.value.trim()) render(input.value);
  } catch {
    intelligent = null;
  }
}

input.addEventListener("input", () => {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => render(input.value), 200);
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  window.clearTimeout(timer);
  const q = input.value.trim();
  const url = new URL(location.href);
  if (q) url.searchParams.set("q", q);
  else url.searchParams.delete("q");
  history.replaceState(null, "", url);
  render(q);
});

load();
