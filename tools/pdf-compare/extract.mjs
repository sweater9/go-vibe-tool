/* PDF Compare — turns PDF.js text items into lines of text, and reports what could not be read. Pure functions (no PDF.js import). */

/** items: PDF.js getTextContent().items ({ str, transform, width, height, hasEOL }). Returns the page's text as lines in content order. */
export function itemsToLines(items) {
  const lines = []; let cur = '', lastY = null, lastEnd = null, lastH = 0;
  const flush = () => { const t = cur.replace(/[ \t]+/g, ' ').trim(); if (t) lines.push(t); cur = ''; };
  for (const it of items) {
    if (typeof it.str !== 'string' || !it.transform) continue;
    const x = it.transform[4], y = it.transform[5], h = Math.abs(it.height || it.transform[3] || 0) || lastH || 10;
    if (lastY !== null && Math.abs(y - lastY) > Math.max(2, 0.55 * Math.min(h, lastH || h))) { flush(); lastEnd = null; }
    else if (lastEnd !== null && it.str && x - lastEnd > 0.18 * h && !/\s$/.test(cur) && !/^\s/.test(it.str)) cur += ' ';
    cur += it.str; lastY = y; lastH = h; lastEnd = x + (it.width || 0);
    if (it.hasEOL) { flush(); lastY = null; lastEnd = null; }
  }
  flush(); return lines;
}

/** Health of the extracted text of one document. pagesText: string[] (page text, may be empty). */
export function assessText(pagesText) {
  const n = pagesText.length, empty = [], garbled = [];
  pagesText.forEach((t, i) => {
    const s = t.replace(/\s+/g, ''); if (s.length < 3) { empty.push(i + 1); return; }
    const bad = (s.match(/[�-]/g) || []).length; if (bad / s.length > 0.2) garbled.push(i + 1);
  });
  return { pages: n, emptyPages: empty, garbledPages: garbled, mostlyScanned: n > 0 && empty.length / n >= 0.5, noText: n > 0 && empty.length === n };
}

/** "1, 3-5, 9" style range list for messages. */
export function pageRanges(list) {
  const out = []; for (let i = 0; i < list.length;) { let j = i; while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++; out.push(j > i ? `${list[i]}–${list[j]}` : String(list[i])); i = j + 1; }
  return out.join(', ');
}
