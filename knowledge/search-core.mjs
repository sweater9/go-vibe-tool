// Pure Knowledge Search. No network, no model. Node tests and the browser both import this.
// Pass the parsed search-index.json and search-lexicon.json.

const KEEP = new Set(["ai", "rag", "mcp", "llm", "api", "sql", "js", "ui"]);

// Pure, so results are cached: every query re-normalizes the same page titles, summaries and keywords.
const NORMALIZE_CACHE = new Map();
const NORMALIZE_CACHE_MAX = 20000;

export function normalize(value) {
  const input = String(value || "");
  const hit = NORMALIZE_CACHE.get(input);
  if (hit !== undefined) return hit;
  const out = input
    .toLowerCase()
    .replace(/[\u2019']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  if (NORMALIZE_CACHE.size >= NORMALIZE_CACHE_MAX) NORMALIZE_CACHE.clear();
  NORMALIZE_CACHE.set(input, out);
  return out;
}

function tokensOf(value, stop) {
  return normalize(value)
    .split(" ")
    .filter((t) => t && !stop.has(t) && (t.length >= 3 || KEEP.has(t)));
}

function expand(list, synonyms) {
  const out = new Set(list);
  for (const token of list) {
    if (!Object.hasOwn(synonyms, token)) continue;
    const extra = synonyms[token];
    if (!Array.isArray(extra)) continue;
    for (const phrase of extra) {
      for (const part of normalize(phrase).split(" ")) if (part) out.add(part);
    }
  }
  return out;
}

function hasPhrase(query, phrase) {
  const p = normalize(phrase);
  if (!p) return false;
  return (" " + query + " ").includes(" " + p + " ");
}

function overlap(queryTokens, text, stop) {
  if (!text) return 0;
  const seen = new Set();
  let n = 0;
  for (const token of tokensOf(text, stop)) {
    if (queryTokens.has(token) && !seen.has(token)) {
      seen.add(token);
      n += 1;
    }
  }
  return n;
}

function pageTechnologies(lexicon, pageId) {
  return (lexicon.pageTechnologies && lexicon.pageTechnologies[pageId]) || [];
}

function mentionedTechnologies(lexicon, query) {
  const found = [];
  for (const item of lexicon.queryTechnologies || []) {
    if ((item.match || []).some((phrase) => hasPhrase(query, phrase))) {
      found.push({ name: item.name, kind: item.kind || "mentioned in your question" });
    }
  }
  return found;
}

// Guard overloaded technology names only when the query contains clear everyday-language context.
// This is deliberately narrow: technical context wins, so legitimate developer queries keep ranking normally.
const AMBIGUOUS_CONTEXT = {
  transformers: { everyday: ["toy", "toys", "kids", "birthday", "robot"], technical: ["ai", "model", "models", "attention", "llm", "nlp", "machine learning", "neural"] },
  python: { everyday: ["pet", "snake", "mice", "reptile", "feed", "eat"], technical: ["code", "coding", "programming", "script", "pip", "django", "flask", "ai", "rag", "api"] },
  docker: { everyday: ["clothing", "clothes", "brand", "pants", "shoes"], technical: ["container", "containers", "image", "compose", "kubernetes", "devops", "deploy"] },
  rust: { everyday: ["bicycle", "chain", "corrosion", "remove rust"], technical: ["ownership", "borrowing", "cargo", "compiler", "programming", "code"] },
  java: { everyday: ["coffee", "beans", "espresso"], technical: ["spring", "api", "jdk", "jvm", "programming", "code"] },
  tokens: { everyday: ["arcade", "collection", "coin"], technical: ["llm", "ai", "model", "context", "limit", "limits", "api", "tokenization"] },
  react: { everyday: ["message", "politely", "emotion", "respond", "reaction"], technical: ["javascript", "typescript", "component", "state", "hook", "jsx", "frontend", "app", "chatbot"] }
};

export function suppressAmbiguousTop(row, query) {
  if (!row) return false;
  const rule = AMBIGUOUS_CONTEXT[row.page.id];
  if (!rule) return false;
  if (rule.technical.some((phrase) => hasPhrase(query, phrase))) return false;
  return rule.everyday.some((phrase) => hasPhrase(query, phrase));
}

function matchingGaps(lexicon, query) {
  return (lexicon.coverageGaps || []).filter((gap) =>
    (gap.phrases || []).some((phrase) => hasPhrase(query, phrase))
  );
}

function matchingTools(lexicon, query, gaps) {
  if (gaps.some((gap) => gap.suppressTools)) return [];
  const tools = [];
  for (const tool of lexicon.tools || []) {
    const hit = (tool.when || []).find((phrase) => hasPhrase(query, phrase));
    if (!hit) continue;
    tools.push({
      id: tool.id,
      name: tool.name,
      url: tool.url,
      reason: tool.reason,
      matched: hit
    });
  }
  return tools.slice(0, 2);
}

export function searchKnowledge(index, lexicon, rawQuery) {
  const stop = new Set(lexicon.stopwords || []);
  const query = normalize(rawQuery);
  const baseTokens = tokensOf(query, stop);
  const queryTokens = expand(baseTokens, lexicon.synonyms || {});
  const minSolid = Number(lexicon.minSolidScore) || 20;
  const pages = index.pages || [];
  const byId = new Map(pages.map((page) => [page.id, page]));

  const intentHits = [];
  const boosts = new Map();
  function addBoost(pageId, amount, why) {
    if (!byId.has(pageId) || !amount) return;
    const current = boosts.get(pageId) || { score: 0, why: [] };
    current.score += amount;
    if (why && current.why.length < 4) current.why.push(why);
    boosts.set(pageId, current);
  }

  for (const intent of lexicon.intents || []) {
    const phrase = (intent.phrases || []).find((item) => hasPhrase(query, item));
    if (!phrase) continue;
    intentHits.push(intent.id);
    for (const target of intent.pages || []) addBoost(target.id, target.boost, "intent:" + intent.id);
  }

  for (const concept of lexicon.concepts || []) {
    const term = (concept.terms || []).find((item) => hasPhrase(query, item));
    if (!term) continue;
    for (const target of concept.pages || []) addBoost(target.id, target.boost, "concept:" + concept.id);
  }

  for (const entry of index.glossary || []) {
    const names = [entry.term, entry.aka].filter(Boolean);
    if (!names.some((name) => hasPhrase(query, name))) continue;
    const termWords = normalize(entry.term).split(" ").filter((word) => word && !stop.has(word));
    const glossaryLabel = (termWords.length >= 2 || KEEP.has(normalize(entry.term))) ? "glossary:" : "gloss:";
    for (const pageId of entry.pages || []) addBoost(pageId, lexicon.glossaryBoost || 6, glossaryLabel + entry.term);
  }

  const ranked = pages.map((page) => {
    let score = 0;
    const notes = [];
    const titleHit = overlap(queryTokens, page.title, stop);
    const questionHit = overlap(queryTokens, page.question, stop);
    const summaryHit = Math.min(4, overlap(queryTokens, page.summary, stop));
    const keywordHit = overlap(queryTokens, (page.keywords || []).join(" "), stop);
    score += titleHit * 6 + questionHit * 4 + summaryHit * 1 + keywordHit * 4;
    if (hasPhrase(query, page.title)) {
      // An exact comparison title must outrank a broad concept-intent boost.
      score += normalize(page.title) === query && /\b(?:vs|versus)\b/.test(query) ? 42 : 14;
      notes.push("title");
    }
    if (hasPhrase(query, page.question)) {
      score += 12;
      notes.push("question");
    }
    for (const alias of page.aliases || []) {
      const norm = normalize(alias);
      if (!norm) continue;
      if (hasPhrase(query, norm)) {
        score += 16 + Math.min(8, norm.split(" ").length);
        notes.push("alias");
        break;
      }
      const aliasTokens = tokensOf(norm, stop);
      if (query.split(" ").length >= 3 && hasPhrase(norm, query)) {
        score += 14;
        notes.push("alias");
        break;
      }
      const shared = aliasTokens.filter((token) => queryTokens.has(token)).length;
      if (shared) score += Math.min(8, shared * 2);
    }
    const idHit = tokensOf(page.id.replace(/-/g, " "), stop).filter((token) => queryTokens.has(token)).length;
    score += idHit * 5;
    const boost = boosts.get(page.id);
    if (boost) {
      score += Math.min(lexicon.maxIntentBoost || 42, boost.score);
      notes.push(...boost.why);
    }
    return { page, score, notes };
  }).filter((row) => row.score > 0).sort((a, b) => b.score - a.score || (boosts.get(b.page.id)?.score || 0) - (boosts.get(a.page.id)?.score || 0) || a.page.title.localeCompare(b.page.title));

  const gaps = query ? matchingGaps(lexicon, query) : [];
  const anchored = (row) => row.notes.some((note) => note === "title" || note === "question" || note === "alias" || note.startsWith("intent:") || note.startsWith("concept:") || note.startsWith("glossary:"));
  let top = ranked.find((row) => anchored(row) && row.score >= minSolid) || null;
  const topical = (row) => row && row.notes.some((note) => note.startsWith("intent:") || note.startsWith("concept:"));
  if (top && gaps.some((gap) => gap.demoteWithoutTopic) && !topical(top)) top = null;
  if (suppressAmbiguousTop(top, query)) top = null;
  const solid = Boolean(top);
  const tools = matchingTools(lexicon, query, gaps);

  let need = [];
  if (solid) {
    const seen = new Set();
    for (const item of [...pageTechnologies(lexicon, top.page.id), ...mentionedTechnologies(lexicon, query)]) {
      const key = item.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      need.push(item);
    }
  }

  const learnMore = [];
  if (solid) {
    const related = new Set(top.page.related || []);
    const signal = (row) => row.notes.some((note) => note.startsWith("intent:") || note.startsWith("concept:") || note.startsWith("glossary:") || note === "alias");
    const pool = ranked.filter((row) => row.page.id !== top.page.id && (related.has(row.page.id) || signal(row) || (anchored(row) && row.score >= top.score * 0.62)));
    const ordered = [
      ...pool.filter((row) => related.has(row.page.id)),
      ...pool.filter((row) => !related.has(row.page.id))
    ];
    const seen = new Set();
    for (const row of ordered) {
      if (seen.has(row.page.id)) continue;
      seen.add(row.page.id);
      learnMore.push(row);
      if (learnMore.length === 5) break;
    }
  }

  const weak = solid ? [] : ranked.slice(0, 4);

  return {
    query: rawQuery,
    normalized: query,
    solid,
    minSolid,
    gap: gaps[0] || null,
    gaps,
    answer: solid ? top : null,
    need,
    learnMore,
    tools,
    weak,
    ranked: ranked.slice(0, 8),
    rankedAll: ranked,
    intentHits
  };
}
