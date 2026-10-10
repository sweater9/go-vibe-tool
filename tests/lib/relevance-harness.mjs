// Engine-agnostic relevance harness for Knowledge search. Pure: no network, no browser.
// An "engine" is (query) => raw result in the shape produced by searchKnowledge / searchIntelligent.
import { readFileSync } from "node:fs";

export const VISIBLE = 6; // answer + up to five further guides, matching what the page actually shows

const readJson = (rel) => JSON.parse(readFileSync(new URL("../../" + rel, import.meta.url), "utf8"));
export const loadDataset = () => readJson("tests/data/search-relevance-dataset.json");
export const loadAssets = () => ({
  index: readJson("knowledge/search-index.json"),
  lexicon: readJson("knowledge/search-lexicon.json")
});

// What a visitor can actually see, in order: the answer, any topic cluster, learn-more links, closest pages.
export function normalizeResult(raw) {
  const ids = [];
  const push = (id) => { if (id && !ids.includes(id)) ids.push(id); };
  if (raw.solid && raw.answer) push(raw.answer.page.id);
  for (const row of raw.cluster?.pages || []) push(row.page.id);
  for (const row of raw.learnMore || []) push(row.page.id);
  if (!raw.solid) for (const row of raw.weak || []) push(row.page.id);
  return {
    solid: Boolean(raw.solid),
    answerId: raw.solid && raw.answer ? raw.answer.page.id : null,
    visible: ids,
    learnMoreIds: (raw.learnMore || []).map((row) => row.page.id),
    tools: (raw.tools || []).map((tool) => tool.id),
    rewrite: raw.rewrite ? raw.rewrite.kind : null,
    gap: raw.gap ? raw.gap.id : null
  };
}

export function evaluateEntry(entry, res) {
  const failures = [];
  const answers = entry.a || [];
  const top = res.visible.slice(0, VISIBLE);
  if (entry.conf === "confident") {
    if (!res.solid) failures.push("no confident answer");
    else if (!answers.includes(res.answerId)) failures.push("wrong confident answer: " + res.answerId);
  } else if (entry.conf === "weak") {
    if (res.solid) failures.push("false confident answer: " + res.answerId);
  } else if (res.solid && answers.length && !answers.includes(res.answerId)) {
    failures.push("wrong confident answer: " + res.answerId);
  }
  if (entry.n && !entry.n.some((id) => top.includes(id))) failures.push("none of " + entry.n.join("/") + " in the first " + VISIBLE + " guides");
  if (entry.cover) {
    const got = entry.cover.ids.filter((id) => top.includes(id)).length;
    if (got < entry.cover.min) failures.push("only " + got + "/" + entry.cover.min + " required topic guides visible");
  }
  const want = entry.t || [];
  const allowed = new Set([...want, ...(entry.ta || [])]);
  for (const id of want) if (!res.tools.includes(id)) failures.push("missing tool: " + id);
  for (const id of res.tools) if (!allowed.has(id)) failures.push("unexpected tool: " + id);
  if (entry.lm && !entry.lm.some((id) => res.learnMoreIds.includes(id))) failures.push("learn-more lacks " + entry.lm.join("/"));
  return failures;
}

export function runDataset(entries, engine) {
  return entries.map((entry) => {
    const res = normalizeResult(engine(entry.q));
    const failures = evaluateEntry(entry, res);
    return { entry, res, failures, pass: failures.length === 0 };
  });
}

function reciprocalRank(entry, res) {
  const targets = new Set([...(entry.a || []), ...(entry.n || [])]);
  if (!targets.size) return null;
  const at = res.visible.findIndex((id) => targets.has(id));
  return at === -1 ? 0 : 1 / (at + 1);
}

export function summarize(rows) {
  const by = (fn) => rows.filter(fn);
  const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : null);
  const confident = by((r) => r.entry.conf === "confident");
  const weak = by((r) => r.entry.conf === "weak");
  const wrongConfident = by((r) => r.res.solid && ((r.entry.conf === "weak") || ((r.entry.a || []).length && !r.entry.a.includes(r.res.answerId))));
  const toolCases = by((r) => (r.entry.t || []).length);
  const toolFalsePositives = rows.reduce((n, r) => {
    const allowed = new Set([...(r.entry.t || []), ...(r.entry.ta || [])]);
    return n + r.res.tools.filter((id) => !allowed.has(id)).length;
  }, 0);
  const rrs = rows.map((r) => reciprocalRank(r.entry, r.res)).filter((x) => x !== null);
  const categories = {};
  for (const r of rows) {
    const c = (categories[r.entry.c] ||= { total: 0, pass: 0 });
    c.total += 1;
    if (r.pass) c.pass += 1;
  }
  return {
    total: rows.length,
    pass: by((r) => r.pass).length,
    passRate: pct(by((r) => r.pass).length, rows.length),
    confidentAccuracy: pct(confident.filter((r) => r.res.solid && r.entry.a.includes(r.res.answerId)).length, confident.length),
    confidentTotal: confident.length,
    weakCorrect: pct(weak.filter((r) => !r.res.solid).length, weak.length),
    weakTotal: weak.length,
    wrongConfident: wrongConfident.length,
    wrongConfidentQueries: wrongConfident.map((r) => r.entry.q),
    toolRecall: pct(toolCases.filter((r) => r.entry.t.every((id) => r.res.tools.includes(id))).length, toolCases.length),
    toolCases: toolCases.length,
    toolFalsePositives,
    mrr: rrs.length ? Math.round((1000 * rrs.reduce((a, b) => a + b, 0)) / rrs.length) / 1000 : null,
    categories
  };
}

export function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}
