/* PDF Editor Phase 3: pure, local-only document search.
 * Page text is supplied by the existing PDF.js extraction path.
 * This module does not fetch, persist, or modify document bytes. */
export function normalizeQuery(value) {
  return String(value ?? "").trim().toLocaleLowerCase();
}
export function indexPageText(items) {
  const runs = [];
  let text = "";
  for (const item of items || []) {
    const value = String(item?.str ?? "");
    if (!value) continue;
    const start = text.length;
    text += value;
    runs.push({ start, end: text.length, item });
    if (item.hasEOL) text += "\n";
    else if (!/\s$/.test(value)) text += " ";
  }
  return { text, runs };
}
export function searchPage(index, query, pageIndex, maxResults = 1000) {
  const needle = normalizeQuery(query);
  if (!needle || maxResults <= 0) return [];
  const haystack = String(index?.text ?? "").toLocaleLowerCase();
  const hits = [];
  let offset = 0;
  while (hits.length < maxResults) {
    const start = haystack.indexOf(needle, offset);
    if (start < 0) break;
    const end = start + needle.length;
    const runs = (index.runs || []).filter(run => run.start < end && run.end > start);
    if (runs.length) hits.push({ pageIndex, start, end, runs });
    offset = start + Math.max(needle.length, 1);
  }
  return hits;
}
export function searchDocument(pageIndexes, query, maxResults = 1000) {
  const results = [];
  for (let pageIndex = 0; pageIndex < pageIndexes.length; pageIndex++) {
    const remaining = maxResults - results.length;
    if (remaining <= 0) break;
    results.push(...searchPage(pageIndexes[pageIndex], query, pageIndex, remaining));
  }
  return results;
}
