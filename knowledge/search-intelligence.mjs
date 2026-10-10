// Knowledge search intelligence layer. Pure: no network, no model, no storage, no tracking.
//
// It wraps the existing lexical engine (search-core.mjs, unmodified in behaviour) and, optionally, the opt-in hybrid
// engine. The core stays authoritative for evidence; this layer adds
//   - question understanding: framing, intent, level, comparison and sequence questions
//   - rewrites: abbreviations, typos, run-together words (always reported, never silent)
//   - stem-aware name coverage, so "serving"/"serve" and "GPUs"/"gpu" count as the same word
//   - comparison-page handling, topic clusters for broad subjects, and a narrow-anchor confidence gate
//   - verified tool recommendations (tool-map.json) and typed related guides (relations.json)
// Every extra file is optional: when one is missing or malformed the layer degrades to the behaviour it had before.
import { searchKnowledge, normalize, suppressAmbiguousTop } from "./search-core.mjs";

export const INTELLIGENCE_VERSION = 1;

// ---- tuning constants (calibrated on tests/data/search-relevance-dataset.json; see SEARCH-INTELLIGENCE-NOTES.md) ----
export const TUNING = {
  anchorCoverage: 0.85,     // share (IDF weighted) of a title/question/alias that the query must contain to anchor a page
  fullNameBonus: 22,        // bonus when the whole name is contained
  nearNameBonus: 16,        // bonus when most of the name is contained
  comparisonPenalty: 10,    // a "X vs Y" page is demoted when nobody asked for a comparison
  comparisonBonus: 12,      // and promoted when the query names both sides
  overrideMargin: 3,        // a different page must beat the core's answer by this much to replace it
  distinctiveWeight: 2.2,   // a stem lighter than this (IDF) is generic: model, llm, learn, work ...
  narrowMinTerms: 2,        // narrow-anchor gate applies to queries with at least this many informative words
  weakMinOverlap: 0.2       // closest pages need at least this much weighted overlap with the query
};

const FILLER = new Set(("what whats how why which who when where does do did can could should would will is are was were be been " +
  "the a an and or of to in on at by for with from into about as it its this that these those i me my we our you your they their there here " +
  "please tell explain show give need want like get got some any more much many also than so if not no someone somebody something anything " +
  "good best better great nice really very just using use used way ways").split(" "));

const SHORT_OK = new Set(["ai", "ml", "rl", "dl", "nn", "ui", "js", "go", "rag", "mcp", "llm", "api", "sql", "gpu", "cnn", "rnn", "gan", "vae", "vit", "moe", "ssm", "cot", "orm", "jwt", "oidc", "peft", "ppo", "dqn", "hf", "env"]);
const US_KEEP = new Set(["status", "focus", "corpus", "bonus", "campus", "virus", "census", "cactus", "bias", "chorus"]);

// ---- text helpers ------------------------------------------------------------------------------------------------
export function stem(word) {
  let w = String(word);
  if (w.length <= 3) return w;
  w = w.replace(/isation$/, "ization");
  if (/ies$/.test(w) && w.length > 4) w = w.slice(0, -3) + "y";
  else if (/sses$/.test(w)) w = w.slice(0, -2);
  else if (/ss$/.test(w) || US_KEEP.has(w)) { /* keep */ }
  else if (/s$/.test(w)) w = w.slice(0, -1);
  if (w.length > 5 && /ing$/.test(w)) w = w.slice(0, -3);
  else if (w.length > 5 && /ed$/.test(w)) w = w.slice(0, -2);
  if (w.length > 3 && /([^aeiou])\1$/.test(w) && !/(ll|ss|zz)$/.test(w)) w = w.slice(0, -1);
  if (w.length > 3 && /e$/.test(w)) w = w.slice(0, -1);
  return w;
}

function wordsOf(text, stop) {
  const out = [];
  for (const token of normalize(text).split(" ")) {
    if (!token || stop.has(token)) continue;
    if (token.length < 3 && !SHORT_OK.has(token)) continue;
    out.push(token);
  }
  return out;
}

const stemsOf = (text, stop) => [...new Set(wordsOf(text, stop).map(stem))];

function hasPhrase(query, phrase) {
  const p = normalize(phrase);
  return Boolean(p) && (" " + query + " ").includes(" " + p + " ");
}

// Optimal string alignment distance (adjacent swaps cost 1), bounded.
function osa(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2 = new Array(b.length + 1);
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j += 1) prev2[j] = prev[j];
    prev = cur;
  }
  return prev[b.length];
}

// ---- resources built once per index/lexicon/extras ---------------------------------------------------------------
const CACHE = new WeakMap();

export function loadExtras(readJson) {
  const extras = {};
  for (const [key, file] of [["understanding", "query-understanding.json"], ["toolMap", "tool-map.json"], ["relations", "relations.json"]]) {
    try { extras[key] = readJson(file); } catch { extras[key] = null; }
  }
  return extras;
}

function buildResources(index, lexicon, extras) {
  const stop = new Set([...(lexicon.stopwords || []), ...FILLER]);
  const pages = index.pages || [];
  const N = Math.max(1, pages.length);
  const byId = new Map(pages.map((p) => [p.id, p]));
  const df = new Map();
  const vocab = new Set();
  const surface = new Map();
  const fields = new Map();
  const nameAll = new Map();
  const allStems = new Map();

  const addSurface = (text) => {
    for (const token of normalize(text).split(" ")) {
      if (token.length >= 4 && !stop.has(token) && !/\d/.test(token)) surface.set(token, (surface.get(token) || 0) + 1);
    }
  };
  const addVocab = (text) => { for (const s of stemsOf(text, new Set())) vocab.add(s); };

  for (const p of pages) {
    const list = [];
    const push = (kind, text) => {
      const s = stemsOf(text, stop);
      if (s.length) list.push({ kind, s });
    };
    push("title", p.title);
    push("question", p.question);
    for (const alias of p.aliases || []) push("alias", alias);
    push("id", String(p.id).replace(/-/g, " "));
    fields.set(p.id, list);
    const names = new Set();
    for (const f of list) for (const s of f.s) names.add(s);
    nameAll.set(p.id, names);
    for (const s of names) df.set(s, (df.get(s) || 0) + 1);
    const all = new Set(names);
    for (const text of [p.summary, (p.keywords || []).join(" "), (p.headings || []).join(" ")]) for (const s of stemsOf(text, stop)) all.add(s);
    allStems.set(p.id, all);
    for (const text of [p.title, p.question, p.summary, ...(p.aliases || []), ...(p.keywords || []), ...(p.headings || []), String(p.id).replace(/-/g, " ")]) { addVocab(text); addSurface(text); }
  }
  for (const entry of index.glossary || []) { addVocab(entry.term); addVocab(entry.aka); addSurface(entry.term); addSurface(entry.aka); }
  for (const [key, list] of Object.entries(lexicon.synonyms || {})) { addVocab(key); addSurface(key); for (const x of list) { addVocab(x); addSurface(x); } }
  for (const concept of lexicon.concepts || []) for (const t of concept.terms || []) { addVocab(t); addSurface(t); }
  for (const intent of lexicon.intents || []) for (const t of intent.phrases || []) addVocab(t);
  for (const tool of lexicon.tools || []) addVocab(tool.name);
  for (const word of stop) vocab.add(stem(word));

  const weight = (s) => (df.has(s) ? Math.log(1 + N / df.get(s)) : 3.2);

  // extras (all optional)
  const u = extras && extras.understanding;
  const abbreviations = new Map();
  if (u && u.abbreviations) for (const [k, v] of Object.entries(u.abbreviations)) if (v && v.to) abbreviations.set(k, v);
  const hubs = [];
  if (u && Array.isArray(u.hubs)) {
    for (const hub of u.hubs) {
      if (!byId.has(hub.lead)) continue;
      hubs.push({ ...hub, guides: (hub.guides || []).filter((id) => byId.has(id)), termStems: (hub.terms || []).map((t) => new Set(stemsOf(t, stop))) });
    }
  }
  const ambiguous = new Map();
  if (u && u.ambiguous) for (const [k, v] of Object.entries(u.ambiguous)) ambiguous.set(stem(normalize(k)), { term: k, options: (v.options || []).filter((o) => byId.has(o.page)) });

  const extraIntents = [];
  if (u && Array.isArray(u.intents)) {
    for (const item of u.intents) {
      const pagesList = (item.pages || []).filter((x) => byId.has(x.id));
      if (!item.id || !pagesList.length) continue;
      extraIntents.push({
        id: "x-" + item.id,
        phrases: (item.phrases || []).map(normalize).filter(Boolean),
        requires: new Set((item.requiresAny || []).map((w) => normalize(w))),
        pages: pagesList
      });
    }
  }
  const tools = compileTools(extras && extras.toolMap, stop, extras && extras.toolMapOptions);
  const relations = extras && extras.relations && extras.relations.pages ? extras.relations.pages : null;

  return { stop, pages, byId, fields, nameAll, allStems, vocab, surface, weight, abbreviations, hubs, ambiguous, extraIntents, tools, relations, lexicon, index };
}

function compileTools(map, stop, options) {
  if (!map || !Array.isArray(map.tools)) return null;
  const out = [];
  const valid = options && options.validIds ? new Set(options.validIds) : null;
  for (const tool of map.tools) {
    if (!tool || typeof tool.id !== "string" || !tool.name || !tool.url || !tool.reason) continue;
    // a route of the form ?tool=<id> must open the tool it names
    const routed = /[?&]tool=([a-z0-9-]+)/.exec(String(tool.url));
    if (routed && routed[1] !== tool.id) continue;
    if (valid && !valid.has(tool.id)) continue;
    // callers that can see the real catalogue (tests, build steps) pass it so unknown and Compliance tools are dropped
    const real = options && options.catalogue ? options.catalogue[tool.id] : null;
    if (options && options.catalogue && (!real || real.category === "Compliance & AML")) continue;
    const compileTerm = (term) => (/\s/.test(term) ? { phrase: normalize(term) } : { stem: stem(normalize(term)) });
    const rules = (tool.intents || []).map((rule) => rule.map((group) => group.map(compileTerm)));
    out.push({
      tool,
      phrases: (tool.phrases || []).map(normalize).filter(Boolean),
      rules,
      not: new Set((tool.not || []).map((t) => stem(normalize(t)))),
      topics: new Set(tool.topics || [])
    });
  }
  return { tools: out, max: Number(map.maxTools) || 2 };
}

function resourcesFor(index, lexicon, extras) {
  const e = extras || {};
  let entry = CACHE.get(index);
  if (entry && entry.lexicon === lexicon && entry.extras === e) return entry.res;
  const res = buildResources(index, lexicon, e);
  CACHE.set(index, { lexicon, extras: e, res });
  return res;
}

// ---- question understanding --------------------------------------------------------------------------------------
const BEGINNER = [/\bexplain(?:ed)? (?:it )?like (?:i am|im|i m) (?:5|five)\b/g, /\blike (?:i am|im|i m) (?:5|five)\b/g, /\bfor (?:absolute )?(?:beginners?|dummies|newbies?)\b/g, /\b(?:absolute )?beginners?\b/g, /\bfor dummies\b/g, /\bbasics?\b/g, /\b(?:an? )?(?:intro|introduction)(?: to)?\b/g, /\b101\b/g, /\bgetting started(?: with)?\b/g, /\bfrom scratch\b/g, /\beli5\b/g, /\b(?:explained )?(?:simply|in simple terms)\b/g, /\bsimple\b/g];
const ADVANCED = [/\badvanced\b/g, /\bin[- ]depth\b/g, /\bdeep dive(?: into| on)?\b/g, /\bunder the hood\b/g, /\binternals?\b/g, /\bexpert\b/g, /\bat scale\b/g, /\bproduction[- ]grade\b/g];

const COMPARE = [
  /^(?:what is |whats )?(?:the )?differences? between (.+?) and (.+)$/,
  /^compare (.+?) (?:and|with|to|against|vs|versus) (.+)$/,
  /^(.+?) (?:vs|versus|v) (.+)$/,
  /^(.+?) compared (?:to|with) (.+)$/,
  /^(?:is |are )?(.+?) better than (.+)$/,
  /^(?:should i use |which is better |which should i use |whats better |which is best )(.+?) or (.+)$/
];
const SEQ_BEFORE = [
  /^(?:what )?(?:should|do|must|need to) (?:i|we)(?: need to)? (?:know|learn|study|read|understand)(?: first)? before (?:learning |studying |reading |using |starting |trying )?(.+)$/,
  /^(?:what )?(?:are the )?(?:prerequisites?|prereqs?|requirements?|background) (?:for|to learn|to understand|before|of) (?:learning |studying )?(.+)$/,
  /^(?:before|prerequisites? )(?:learning |studying |reading |using )?(.+)$/
];
const SEQ_AFTER = [
  /^(?:what )?(?:should|do|can) (?:i|we) (?:learn|study|read|do|go|move on)(?: next)? after (?:learning |studying |reading |using )?(.+)$/,
  /^(?:what to learn|what comes|whats next|next steps?|learn next|where next|where to go|what next) (?:after|from|following) (?:learning |studying )?(.+)$/,
  /^next steps? after (.+)$/,
  /^after (?:learning |studying )?(.+?)(?: what next| whats next)?$/
];
const TROUBLE = /\b(?:not working|doesnt work|does not work|isnt working|wont|keeps?|stuck|error|errors|fails?|failing|failed|wrong|ignores?|ignoring|problem|problems|issue|issues|slow|crash|crashes|bug|buggy|broken|why (?:is|are|does|do|did|has|have))\b/;
const HOWTO_LEAD = /^(?:how (?:do|can|could|should|would|to|does|did) (?:i |we |you )?(?:to )?|how i |what is the (?:best|easiest|fastest|simplest|right|proper|quickest) way to |whats the (?:best|easiest|fastest|simplest|right|proper|quickest) way to |best way to |ways to |steps to |tips for |help me (?:to )?|i want to |i need to |id like to |im trying to |trying to )/;
const DEFINITION_LEAD = /^(?:what (?:is|are|was|were) (?:an? |the )?|whats (?:an? |the )?|define |definition of |meaning of |tell me about |overview of |introduction to )/;
const LEARN_LEAD = /^(?:learn(?: about)?|study|get started with|getting started with|start with) /;
const EXPLAIN_LEAD = /^(?:(?:can|could|would) you (?:please )?)?(?:explain|describe|walk me through|teach me)(?: how| why)?(?: to)? /;

function stripLevels(text) {
  let level = null;
  let out = text;
  for (const re of ADVANCED) if (re.test(out)) { level = "advanced"; out = out.replace(re, " "); }
  for (const re of BEGINNER) if (re.test(out)) { level = level || "beginner"; out = out.replace(re, " "); }
  return { text: out.replace(/\s+/g, " ").trim(), level };
}

export function analyzeQuery(rawQuery) {
  const normalized = normalize(rawQuery);
  const lv = stripLevels(normalized);
  let work = lv.text;
  const out = { raw: rawQuery, normalized, core: normalized, intent: "general", level: lv.level, comparison: null, sequence: null };
  if (!work) return out;

  for (const re of COMPARE) {
    const m = work.match(re);
    if (m) {
      out.comparison = { a: m[1].trim(), b: m[2].trim() };
      out.intent = "comparison";
      out.core = (m[1] + " " + m[2]).trim();
      return out;
    }
  }
  for (const [kind, list] of [["before", SEQ_BEFORE], ["after", SEQ_AFTER]]) {
    for (const re of list) {
      const m = work.match(re);
      if (m && m[1].trim()) {
        out.sequence = { kind, topic: m[1].trim() };
        out.intent = "sequence";
        out.core = m[1].trim();
        return out;
      }
    }
  }
  if (TROUBLE.test(work)) out.intent = "troubleshooting";
  if (HOWTO_LEAD.test(work)) {
    work = work.replace(HOWTO_LEAD, "");
    if (out.intent === "general") out.intent = "howto";
    work = work.replace(/^(?:i |we |you )/, "");
  } else if (DEFINITION_LEAD.test(work)) {
    work = work.replace(DEFINITION_LEAD, "");
    out.intent = "definition";
  } else if (EXPLAIN_LEAD.test(work)) {
    work = work.replace(EXPLAIN_LEAD, "");
    out.intent = "explain";
  }
  const how = lv.text.match(/^how (?:does|do|did) (.+?) work(?:s)?$/);
  if (how) { work = how[1]; out.intent = "explain"; }
  const learn = work.match(LEARN_LEAD);
  if (learn && work.length > learn[0].length) {
    work = work.slice(learn[0].length);
    out.level = out.level || "beginner";
    if (out.intent === "general") out.intent = "howto";
  }
  work = work.replace(/\b(?:explained|tutorial|guide|guides|tips|examples?|step by step|walkthrough)\b/g, " ").replace(/\s+/g, " ").trim();
  out.core = work || normalized;
  return out;
}

// Typos, run-together words and abbreviations. Returns { text, corrections } or null when nothing changed.
function rewriteTokens(res, text) {
  const tokens = normalize(text).split(" ").filter(Boolean);
  const present = new Set(tokens);
  const out = [];
  const corrections = [];
  for (const token of tokens) {
    const abbr = res.abbreviations.get(token);
    if (abbr && !abbr.to.split(" ").every((w) => present.has(w))) {
      out.push(abbr.to);
      corrections.push({ from: token, to: abbr.to, kind: "abbreviation" });
      continue;
    }
    if (token.length >= 5 && !/\d/.test(token) && !res.stop.has(token) && !res.surface.has(token)) {
      const fix = correctToken(res, token);
      if (fix) {
        out.push(fix.to);
        corrections.push({ from: token, to: fix.to, kind: fix.kind });
        continue;
      }
    }
    out.push(token);
  }
  if (!corrections.length) return null;
  return { text: out.join(" "), corrections };
}

function correctToken(res, token) {
  const maxD = token.length >= 9 ? 2 : 1;
  let best = null;
  let bestD = maxD + 1;
  let tie = false;
  for (const [word, count] of res.surface) {
    if (Math.abs(word.length - token.length) > maxD) continue;
    if (word[0] !== token[0] && !(word[1] === token[0] && word[0] === token[1])) continue;
    const d = osa(token, word, maxD);
    if (d > maxD) continue;
    if (d < bestD) { best = { word, count }; bestD = d; tie = false; }
    else if (d === bestD && best && word !== best.word) {
      if (count > best.count * 2) best = { word, count };
      else if (count * 2 >= best.count) tie = true;
    }
  }
  if (best && !tie) return { to: best.word, kind: "typo" };
  if (!best) {
    for (let i = 3; i <= token.length - 3; i += 1) {
      const left = token.slice(0, i);
      const right = token.slice(i);
      if (res.surface.has(left) && res.surface.has(right)) return { to: left + " " + right, kind: "split" };
    }
  }
  return null;
}

// ---- scoring helpers ---------------------------------------------------------------------------------------------
function nameCoverage(res, page, Q) {
  let best = { cov: 0, matched: 0, distinct: 0, kind: "" };
  for (const f of res.fields.get(page.id) || []) {
    let num = 0;
    let den = 0;
    let m = 0;
    let distinct = 0;
    for (const s of f.s) {
      const w = res.weight(s);
      den += w;
      if (Q.set.has(s)) { num += w; m += 1; if (w >= TUNING.distinctiveWeight) distinct += 1; }
    }
    if (!den) continue;
    if (f.s.length === 1 && !(Q.list.length === 1 && m === 1)) continue; // a lone shared word is not a name match
    const cov = num / den;
    // Two generic words (learn + ai) never name a page; the query must be the name, or share two distinctive words with it.
    const exact = cov >= 0.99 && m === Q.list.length;
    if (!(distinct >= 2 || exact)) continue;
    if (cov > best.cov || (cov === best.cov && m > best.matched)) best = { cov, matched: m, distinct, kind: f.kind };
  }
  return best;
}

function anchorStemCount(res, page, Q, notes) {
  const set = new Set(res.nameAll.get(page.id));
  const lexicon = res.lexicon;
  for (const note of notes) {
    const [kind, id] = note.split(":");
    const list = kind === "concept" ? lexicon.concepts : kind === "intent" ? [...(lexicon.intents || []), ...res.extraIntents] : null;
    const found = list && list.find((x) => x.id === id);
    if (!found) continue;
    for (const phrase of found.terms || found.phrases || []) for (const s of stemsOf(phrase, res.stop)) set.add(s);
  }
  return Q.list.filter((s) => set.has(s)).length;
}

function narrowAnchor(res, page, Q, notes) {
  if (Q.list.length < TUNING.narrowMinTerms) return false;
  if (notes.some((n) => n.startsWith("intent:x-"))) return false; // a curated intent phrase is an authored anchor
  if (anchorStemCount(res, page, Q, notes) > 1) return false;
  const explained = res.allStems.get(page.id);
  let foreign = 0;
  let unexplained = 0;
  for (const s of Q.list) {
    if (!res.vocab.has(s)) foreign += 1;
    if (!explained.has(s)) unexplained += 1;
  }
  return foreign >= 1 || unexplained >= 2;
}

const isAnchorNote = (n) => n === "title" || n === "question" || n === "alias" || n === "stem-name" || n === "compare" || n.startsWith("intent:") || n.startsWith("concept:") || n.startsWith("glossary:");

function technologiesFor(lexicon, pageId, query) {
  const found = [];
  const seen = new Set();
  const add = (item) => { const key = item.name.toLowerCase(); if (!seen.has(key)) { seen.add(key); found.push(item); } };
  for (const item of (lexicon.pageTechnologies && lexicon.pageTechnologies[pageId]) || []) add(item);
  for (const item of lexicon.queryTechnologies || []) {
    if ((item.match || []).some((phrase) => hasPhrase(query, phrase))) add({ name: item.name, kind: item.kind || "mentioned in your question" });
  }
  return found;
}

// ---- tools -------------------------------------------------------------------------------------------------------
function recommendTools(res, analysis, effectiveText, Q, top, solid, gaps) {
  if (!res.tools) return null; // caller falls back to the core's own tool list
  if (gaps.some((gap) => gap.suppressTools)) return [];
  const query = normalize(effectiveText);
  const raw = analysis.normalized;
  const blocked = analysis.intent === "definition" || analysis.intent === "explain" || analysis.intent === "comparison" || analysis.intent === "sequence";
  const queryStems = new Set([...Q.list, ...wordsOf(raw, new Set()).map(stem)]);
  const picked = [];
  const seen = new Set();
  const push = (entry, matched, why) => {
    if (seen.has(entry.tool.id)) return;
    seen.add(entry.tool.id);
    picked.push({ id: entry.tool.id, name: entry.tool.name, url: entry.tool.url, reason: entry.tool.reason, matched, why: why || entry.tool.reason });
  };
  for (const entry of res.tools.tools) {
    const phrase = entry.phrases.find((p) => hasPhrase(query, p) || hasPhrase(raw, p));
    if (phrase) { push(entry, phrase); continue; }
    if (blocked || !entry.rules.length) continue;
    if ([...entry.not].some((s) => queryStems.has(s))) continue;
    for (const rule of entry.rules) {
      const ok = rule.every((group) => group.some((term) => (term.phrase ? hasPhrase(raw, term.phrase) || hasPhrase(query, term.phrase) : queryStems.has(term.stem))));
      if (ok) { push(entry, "task match"); break; }
    }
  }
  const topicIntent = analysis.intent === "howto";
  if (solid && topicIntent && picked.length < res.tools.max) {
    for (const entry of res.tools.tools) {
      if (entry.topics.has(top.page.id)) push(entry, "guide topic", entry.tool.topicWhy);
    }
  }
  return picked.slice(0, res.tools.max);
}

// ---- related guides ----------------------------------------------------------------------------------------------
function typedLearnMore(res, top, baseLearn, analysis, rankedRows, sideIds) {
  const id = top.page.id;
  const rel = res.relations && res.relations[id];
  const rowFor = (pid, relation, why) => {
    const page = res.byId.get(pid);
    return page && pid !== id ? { page, score: 0, notes: ["related"], relation, why } : null;
  };
  const picks = [];
  const used = new Set([id]);
  const take = (row) => { if (row && !used.has(row.page.id)) { used.add(row.page.id); picks.push(row); } };
  const label = { pre: "prerequisite", next: "next step", cmp: "compare", app: "practical", rel: "related" };
  const fromRel = (key, n) => { for (const pid of ((rel && rel[key]) || []).slice(0, n)) take(rowFor(pid, label[key])); };
  for (const sid of sideIds || []) take(rowFor(sid, "compare"));
  const baseRows = (baseLearn || []).map((row) => ({ ...row, relation: relationOf(rel, row.page.id) }));
  const level = analysis.level;
  if (analysis.sequence && analysis.sequence.kind === "before") { fromRel("pre", 4); fromRel("rel", 1); }
  else if (analysis.sequence && analysis.sequence.kind === "after") { fromRel("next", 4); fromRel("app", 1); }
  else if (level === "beginner") { fromRel("pre", 2); for (const r of baseRows.slice(0, 2)) take(r); fromRel("next", 1); fromRel("app", 1); }
  else if (level === "advanced") { fromRel("next", 2); fromRel("cmp", 1); for (const r of baseRows.slice(0, 2)) take(r); fromRel("app", 1); fromRel("pre", 1); }
  else { for (const r of baseRows.slice(0, 5)) take(r); fromRel("cmp", 1); fromRel("next", 1); fromRel("app", 1); }
  for (const r of baseRows) take(r);
  fromRel("rel", 3);
  for (const row of rankedRows) if (picks.length < 5 && row.page.id !== id && used.has(row.page.id) === false && row.notes.some(isAnchorNote)) take({ ...row, relation: relationOf(rel, row.page.id) });
  return picks.slice(0, 5);
}

function relationOf(rel, pid) {
  if (!rel) return "related";
  if ((rel.pre || []).includes(pid)) return "prerequisite";
  if ((rel.cmp || []).includes(pid)) return "compare";
  if ((rel.next || []).includes(pid)) return "next step";
  if ((rel.app || []).includes(pid)) return "practical";
  return "related";
}

// ---- main --------------------------------------------------------------------------------------------------------
export function searchIntelligent(index, lexicon, rawQuery, extras = {}, opts = {}) {
  const engine = opts.engine || ((q) => searchKnowledge(index, lexicon, q));
  const res = resourcesFor(index, lexicon, extras);
  const analysis = analyzeQuery(rawQuery);
  const minSolid = Number(lexicon.minSolidScore) || 20;
  const T = { ...TUNING, ...(opts.tuning || {}) };

  // 1. variants: the question as asked, the question without its framing, and both with typos / abbreviations fixed
  const variants = [{ text: String(rawQuery || ""), kind: "raw" }];
  const seenText = new Set([analysis.normalized]);
  const addVariant = (text, kind, corrections) => {
    const key = normalize(text);
    if (!key || seenText.has(key)) return;
    seenText.add(key);
    variants.push({ text, kind, corrections });
  };
  if (analysis.core !== analysis.normalized) addVariant(analysis.core, "core");
  const fixedRaw = rewriteTokens(res, analysis.normalized);
  if (fixedRaw) addVariant(fixedRaw.text, "rewrite", fixedRaw.corrections);
  const fixedCore = analysis.core !== analysis.normalized ? rewriteTokens(res, analysis.core) : null;
  if (fixedCore) addVariant(fixedCore.text, "rewrite", fixedCore.corrections);

  const runs = variants.map((v) => ({ v, r: engine(v.text) }));
  let chosen = runs[0];
  if (!chosen.r.solid) {
    const solidRuns = runs.slice(1).filter((x) => x.r.solid);
    if (solidRuns.length) chosen = solidRuns.reduce((a, b) => (b.r.answer.score > a.r.answer.score ? b : a));
    else {
      const rewritten = runs.slice(1).reverse().find((x) => x.v.kind === "rewrite");
      const withSignal = rewritten && rewritten.r.rankedAll.length ? rewritten : null;
      if (withSignal && (!chosen.r.rankedAll.length || withSignal.r.rankedAll[0].score > chosen.r.rankedAll[0].score)) chosen = withSignal;
    }
  }
  // A misspelt word still reaches the core's answer through its other words; prefer the corrected variant so the
  // confidence gate judges the real question and the correction is reported.
  if (chosen.v.kind !== "rewrite") {
    const foreignWord = analysis.core.split(" ").some((w) => w.length >= 5 && !res.stop.has(w) && !res.surface.has(w) && !res.abbreviations.has(w));
    const fixed = foreignWord ? runs.filter((x) => x.v.kind === "rewrite" && x.r.solid) : [];
    if (fixed.length) chosen = fixed.reduce((a, b) => (b.r.answer.score > a.r.answer.score ? b : a));
  }
  const R = chosen.r;
  const effectiveText = chosen.v.text;
  const effectiveNorm = normalize(effectiveText);
  // The words that carry the question: the framing-free core of whichever variant answered.
  const effCore = chosen.v.kind === "rewrite" ? analyzeQuery(effectiveText).core : analysis.core;
  const Q = { list: stemsOf(effCore, res.stop) };
  Q.set = new Set(Q.list);

  // 2. second-stage scoring over every page
  const baseRows = new Map(R.rankedAll.map((row) => [row.page.id, row]));
  let sides = null;
  if (analysis.comparison) {
    sides = [analysis.comparison.a, analysis.comparison.b].map((text) => ({ text, stems: stemsOf(text, res.stop) }));
  }
  const extraBoost = new Map();
  if (res.extraIntents.length) {
    const tokens = new Set(effectiveNorm.split(" "));
    for (const item of res.extraIntents) {
      if (!item.phrases.some((ph) => hasPhrase(effectiveNorm, ph) || hasPhrase(analysis.normalized, ph))) continue;
      if (item.requires.size && ![...item.requires].some((w) => tokens.has(w))) continue;
      for (const target of item.pages) {
        const cur = extraBoost.get(target.id) || { score: 0, notes: [] };
        cur.score += target.boost || 30;
        cur.notes.push("intent:" + item.id);
        extraBoost.set(target.id, cur);
      }
    }
  }
  const rows = [];
  for (const page of res.pages) {
    const base = baseRows.get(page.id);
    const nc = Q.list.length ? nameCoverage(res, page, Q) : { cov: 0, matched: 0 };
    let bonus = 0;
    const notes = base ? [...base.notes] : [];
    if (nc.matched >= 1 && nc.cov >= T.anchorCoverage) {
      bonus += nc.cov >= 0.99 ? T.fullNameBonus : T.nearNameBonus;
      if (!notes.includes("stem-name")) notes.push("stem-name");
    }
    const eb = extraBoost.get(page.id);
    if (eb) { bonus += Math.min(eb.score, lexicon.maxIntentBoost || 56); notes.push(...eb.notes); }
    let penalty = 0;
    if (page.type === "comparison") {
      if (!analysis.comparison) penalty = T.comparisonPenalty;
      else if (sides && sides.every((side) => side.stems.length && side.stems.filter((s) => res.nameAll.get(page.id).has(s)).length / side.stems.length >= 0.6)) {
        bonus += T.comparisonBonus;
        notes.push("compare");
      }
    }
    const score = (base ? base.score : 0) + bonus - penalty;
    if (score > 0 || base) rows.push({ page, score, base: base ? base.score : 0, notes, nc });
  }
  rows.sort((a, b) => b.score - a.score || b.base - a.base || a.page.title.localeCompare(b.page.title));

  // 3. decide the confident answer
  const gaps = R.gaps || [];
  const ambiguityKey = Q.list.length === 1 ? Q.list[0] : "";
  const ambiguousBare = Boolean(ambiguityKey && res.ambiguous.has(ambiguityKey) && res.ambiguous.get(ambiguityKey).options.length > 1);
  const guard = (row) => !suppressAmbiguousTop(row, effectiveNorm) && !narrowAnchor(res, row.page, Q, row.notes);
  let top = null;
  let basis = "";
  if (gaps.length) {
    // a coverage-gap rule matched: the core's decision stands exactly as before
    if (R.solid) top = rows.find((row) => row.page.id === R.answer.page.id) || null;
    basis = top ? "lexical" : "";
  } else {
    const baseTop = R.solid ? rows.find((row) => row.page.id === R.answer.page.id) : null;
    const best = rows.find((row) => row.notes.some(isAnchorNote) && row.score >= minSolid && guard(row));
    if (baseTop) {
      // The core's answer stands unless the narrow-anchor gate vetoes it or a different guide clearly beats it.
      const baseOk = guard(baseTop);
      const beaten = best && best.page.id !== baseTop.page.id && (!baseOk || best.score >= baseTop.score + T.overrideMargin);
      top = beaten ? best : (baseOk ? baseTop : (best || null));
    } else top = ambiguousBare ? null : (best || null); // a bare ambiguous word is never promoted to a confident answer
    if (top) basis = R.solid && R.answer.page.id === top.page.id ? "lexical" : "stem-name";
  }

  // 4. broad subjects with no single guide: a topic cluster
  let hub = null;
  if (!gaps.length && analysis.intent !== "comparison" && analysis.intent !== "troubleshooting" && analysis.intent !== "sequence") {
    const hubCore = new Set(stemsOf(effCore, new Set([...res.stop, ...HUB_EXTRA])));
    for (const candidate of res.hubs) {
      if (candidate.termStems.some((terms) => terms.size && hubCore.size === terms.size && [...terms].every((s) => hubCore.has(s)))) { hub = candidate; break; }
    }
  }
  let cluster = null;
  if (hub) {
    const leadRow = rows.find((row) => row.page.id === hub.lead) || { page: res.byId.get(hub.lead), score: minSolid, base: 0, notes: [] };
    top = { ...leadRow, score: Math.max(leadRow.score, minSolid), notes: [...leadRow.notes, "hub:" + hub.id] };
    basis = "hub";
    const ids = [...hub.guides];
    if (analysis.level === "beginner" && hub.overview && !ids.includes(hub.overview)) ids.push(hub.overview);
    cluster = {
      id: hub.id,
      title: hub.title,
      note: hub.note || "",
      pages: ids.filter((id) => id !== hub.lead && res.byId.has(id)).map((id) => ({ page: res.byId.get(id), score: 0, notes: ["hub"] }))
    };
  }
  if (top && chosen.v.kind === "rewrite" && basis === "lexical") basis = "corrected";

  const solid = Boolean(top);

  // 5. tools
  const tools = recommendTools(res, analysis, effectiveText, Q, top, solid, gaps);

  // 6. comparison resolution
  let comparison = null;
  let sideIds = [];
  if (analysis.comparison) {
    const resolved = [analysis.comparison.a, analysis.comparison.b].map((text) => {
      const r = engine(text);
      return { text, page: r.solid ? r.answer.page.id : null };
    });
    comparison = { sides: resolved, page: top && top.page.type === "comparison" ? top.page.id : null };
    sideIds = resolved.map((s) => s.page).filter((pid) => pid && (!top || pid !== top.page.id));
  }

  // 7. related guides
  let learnMore = [];
  if (solid) {
    const baseLearn = R.solid && R.answer.page.id === top.page.id ? R.learnMore : rowsForRelated(res, top, rows);
    learnMore = typedLearnMore(res, top, baseLearn, analysis, rows, sideIds).filter((row) => !cluster || !cluster.pages.some((c) => c.page.id === row.page.id));
  }

  // 8. closest pages when nothing is confident
  let weak = [];
  let disambiguation = null;
  if (ambiguousBare) {
    const entry = res.ambiguous.get(ambiguityKey);
    disambiguation = { term: entry.term, options: entry.options.map((o) => ({ label: o.label, page: o.page })) };
  }
  if (!solid) {
    if (disambiguation) weak = disambiguation.options.slice(0, 4).map((o) => ({ page: res.byId.get(o.page), score: 0, notes: ["disambiguation"] }));
    else weak = closestPages(res, rows, Q);
    if (tools && tools.length && !weak.some((row) => row.notes.some(isAnchorNote))) weak = [];
  }

  const answer = top ? { page: top.page, score: top.score, notes: top.notes } : null;
  const need = solid ? (R.solid && R.answer.page.id === top.page.id ? R.need : technologiesFor(lexicon, top.page.id, effectiveNorm)) : [];
  const corrections = (chosen.v.corrections || []).filter((c) => c.kind);
  const rewrite = chosen.v.kind === "rewrite" && corrections.length
    ? { kind: [...new Set(corrections.map((c) => (c.kind === "abbreviation" ? "abbreviation" : "typo")))].sort().join("+"), from: String(rawQuery || "").trim(), to: effectiveText, corrections }
    : null;

  return {
    ...R,
    query: rawQuery,
    normalized: analysis.normalized,
    engine: "intelligence",
    analysis: { intent: analysis.intent, level: analysis.level, comparison: Boolean(analysis.comparison), sequence: analysis.sequence ? analysis.sequence.kind : null, core: analysis.core },
    rewrite,
    solid,
    answer,
    need,
    learnMore,
    tools: tools || R.tools,
    weak,
    ranked: rows.slice(0, 8),
    rankedAll: rows,
    cluster,
    hub: hub ? { id: hub.id, note: hub.note || "" } : null,
    comparison,
    disambiguation,
    confidence: { level: solid ? "confident" : "weak", basis: solid ? basis : "none" }
  };
}

const HUB_EXTRA = new Set(["type", "types", "kind", "kinds", "overview", "topic", "topics", "area", "areas", "branch", "branches", "family", "category", "categories", "list", "main", "different", "subject", "subjects", "learn", "study", "start", "begin", "understand", "master", "teach"]);

function rowsForRelated(res, top, rows) {
  const related = new Set(top.page.related || []);
  const out = [];
  for (const id of top.page.related || []) { const page = res.byId.get(id); if (page) out.push({ page, score: 0, notes: ["related"] }); }
  for (const row of rows) if (row.page.id !== top.page.id && !related.has(row.page.id) && row.notes.some(isAnchorNote) && out.length < 5) out.push(row);
  return out.slice(0, 5);
}

function closestPages(res, rows, Q) {
  if (!Q.list.length) return [];
  const scored = [];
  for (const row of rows) {
    const explained = res.allStems.get(row.page.id);
    let num = 0;
    let den = 0;
    for (const s of Q.list) {
      const w = res.weight(s);
      den += w;
      if (explained.has(s)) num += w;
    }
    const overlap = den ? num / den : 0;
    if (overlap < TUNING.weakMinOverlap) continue;
    scored.push({ row, key: row.score * (0.5 + overlap) });
  }
  scored.sort((a, b) => b.key - a.key);
  return scored.slice(0, 4).map((x) => x.row);
}
