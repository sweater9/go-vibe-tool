// Static generator for IntelliTools Knowledge. Run: node knowledge/src/build.mjs
// Reads content modules, validates every cross-link, writes HTML + search-index.json + search-lexicon.json + sitemap fragment.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pages as p1 } from './pages-foundations.mjs';
import { pages as p2 } from './pages-rag.mjs';
import { pages as p3 } from './pages-agents.mjs';
import { pages as p4 } from './pages-compare.mjs';
import { pages as p5 } from './pages-practice.mjs';
import { pages as p6 } from './pages-building.mjs';
import { pages as p7 } from './pages-technology.mjs';
import { glossary as glossaryCore } from './glossary.mjs';
import { glossary as glossaryTech } from './glossary-technology.mjs';
import { glossary as glossaryAiV3 } from './glossary-ai-v3.mjs';
import { paths, tools } from './meta.mjs';
import { buildEntities } from './entities.mjs';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://intellitools.online/knowledge/';
const corePages = [...p1, ...p2, ...p3, ...p4, ...p5, ...p6, ...p7];
const ent = buildEntities(corePages);
for (const [slug, patch] of Object.entries(ent.aliasPatches)) {
  const target = corePages.find(p => p.slug === slug);
  if (target) { target.aliases = [...new Set([...(target.aliases || []), ...patch.aliases])]; target.keywords = [...new Set([...(target.keywords || []), ...patch.keywords])]; }
}
const pages = [...corePages, ...ent.entityPages];
const glossary = [...glossaryCore, ...glossaryTech, ...glossaryAiV3];
const bySlug = new Map(pages.map(p => [p.slug, p]));
const errors = [...ent.errors];
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '\x26quot;');

function inline(s) {
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
  s = esc(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])\*([^\*\s][^*]*)\*/g, '$1<em>$2</em>');
  s = s.replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (_, slug, label) => {
    const t = bySlug.get(slug);
    if (!t) { errors.push('broken link [[' + slug + ']]'); return slug; }
    return '<a href="' + slug + '.html">' + (label || t.title) + '</a>';
  });
  s = s.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => '<code>' + esc(codes[i]) + '</code>');
}

function md(src) {
  const lines = src.trim().split('\n'); const out = []; let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    if (l.startsWith('```')) {
      const buf = []; i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      i++; out.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>'); continue;
    }
    if (l.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++].trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
      const head = rows[0], body = rows.slice(2);
      out.push('<div class="kn-table"><table><thead><tr>' + head.map(c => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' +
        body.map(r => '<tr>' + r.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>'); continue;
    }
    if (/^- /.test(l) || /^\d+\. /.test(l)) {
      const ordered = /^\d+\. /.test(l); const items = [];
      while (i < lines.length && (ordered ? /^\d+\. /.test(lines[i]) : /^- /.test(lines[i]))) items.push(inline(lines[i++].replace(/^(- |\d+\. )/, '')));
      const tag = ordered ? 'ol' : 'ul'; out.push('<' + tag + '>' + items.map(x => '<li>' + x + '</li>').join('') + '</' + tag + '>'); continue;
    }
    if (l.startsWith('> ')) { const buf = []; while (i < lines.length && lines[i].startsWith('> ')) buf.push(lines[i++].slice(2)); out.push('<blockquote>' + inline(buf.join(' ')) + '</blockquote>'); continue; }
    const buf = []; while (i < lines.length && lines[i].trim() && !/^(```|\||- |\d+\. |> )/.test(lines[i])) buf.push(lines[i++]);
    out.push('<p>' + inline(buf.join(' ')) + '</p>');
  }
  return out.join('\n');
}

const plain = s => s.replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (_, sl, lb) => lb || bySlug.get(sl)?.title || sl).replace(/[`*]/g, '').replace(/```[\s\S]*?```/g, ' ');
const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const header = `<header><div class="wrap"><nav aria-label="Main navigation"><a class="brand" href="../index.html"><span>Intelli</span>Tools</a><div class="navlinks"><a href="../index.html#tools">All tools</a><a href="index.html">Knowledge</a><a href="../index.html#about">About</a></div></nav></div></header>`;
const footer = `<footer><div class="wrap"><div class="footer-bottom"><span>© IntelliTools. Free, browser-based tools.</span><span><a href="index.html">Knowledge</a> · <a href="glossary.html">AI Glossary</a> · <a href="../privacy.html">Privacy</a> · <a href="../terms.html">Terms</a></span></div></div></footer>`;

function shell({ title, desc, file, body, ld }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} | IntelliTools Knowledge</title><meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${file}"><meta property="og:type" content="article"><meta property="og:site_name" content="IntelliTools"><meta property="og:title" content="${esc(title)} | IntelliTools Knowledge"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${SITE}${file}">
<meta name="twitter:card" content="summary"><link rel="icon" href="../assets/icon.svg" type="image/svg+xml"><link rel="stylesheet" href="../v2.css"><link rel="stylesheet" href="knowledge.css"><link rel="stylesheet" href="learning.css">
<script type="application/ld+json">${JSON.stringify(ld)}</script></head>
<body>${header}
${body}
${footer}<script type="module" src="learning-ui.mjs"></script></body></html>`;
}

const pathsFor = slug => paths.filter(p => p.steps.includes(slug));

function articlePage(p) {
  const secs = p.sections.map(([h, m]) => ({ h, id: slugify(h), html: md(m) }));
  const toc = secs.map(s => `<a href="#${s.id}">${esc(s.h)}</a>`).join('');
  const rel = (p.related || []).map(s => {
    const t = bySlug.get(s); if (!t) { errors.push(p.slug + ': related missing ' + s); return ''; }
    return `<a class="kn-card" href="${s}.html"><span class="kn-kind">${t.kind === 'comparison' ? 'Comparison' : 'Concept'}</span><strong>${esc(t.title)}</strong><small>${esc(t.summary)}</small></a>`;
  }).join('');
  const pn = pathsFor(p.slug).map(pa => {
    const i = pa.steps.indexOf(p.slug); const prev = pa.steps[i - 1], next = pa.steps[i + 1];
    return `<div class="kn-path"><div class="kn-path-title">Learning path: ${esc(pa.title)} <span>(step ${i + 1} of ${pa.steps.length})</span></div><div class="kn-path-nav">${
      prev ? `<a href="${prev}.html">← ${esc(bySlug.get(prev).title)}</a>` : '<span></span>'}${next ? `<a href="${next}.html">${esc(bySlug.get(next).title)} →</a>` : '<span></span>'}</div></div>`;
  }).join('');
  let toolBlock = '';
  if (p.tool) {
    const t = tools[p.tool.id]; if (!t) errors.push(p.slug + ': unknown tool ' + p.tool.id);
    toolBlock = `<section class="kn-tool" id="try-it-with-intellitools"><h2>Try it with IntelliTools</h2>${md(p.tool.note)}<p><a class="btn" href="../tools/${p.tool.id}.html">Open ${esc(t.name)}</a></p><p class="kn-small">${esc(t.privacy)}</p></section>`;
  }
  const body = `<main><section class="kn-head"><div class="wrap kn-wrap"><nav class="kn-crumb" aria-label="Breadcrumb"><a href="index.html">Knowledge</a> › <span>${p.kind === 'comparison' ? 'Comparisons' : esc(p.group)}</span></nav>
<span class="eyebrow">${p.kind === 'comparison' ? 'COMPARISON' : 'EXPLAINER'}</span><h1>${esc(p.title)}</h1>${p.entity ? `<p class="kn-meta"><span>${esc(p.entity.entity_type)}</span><span>freshness: ${esc(p.entity.freshness)}</span><span>${p.entity.checked_date ? 'key claims checked ' + esc(p.entity.checked_date) : 'sources not yet verified'}</span></p>` : ''}<p class="kn-lede">${inline(p.summary)}</p>
<p class="kn-quick"><strong>Short answer:</strong> ${inline(p.short)}</p></div></section>
<div class="wrap kn-wrap kn-layout"><article class="kn-article">${secs.map(s => `<section id="${s.id}"><h2>${esc(s.h)}</h2>${s.html}</section>`).join('\n')}${toolBlock}
${rel ? `<section id="related-concepts"><h2>Related concepts</h2><div class="kn-cards">${rel}</div></section>` : ''}${pn}</article>
<aside class="kn-toc" aria-label="On this page"><strong>On this page</strong>${toc}${p.tool ? '<a href="#try-it-with-intellitools">Try it with IntelliTools</a>' : ''}${rel ? '<a href="#related-concepts">Related concepts</a>' : ''}<a class="kn-glossary-link" href="glossary.html">AI Glossary A–Z</a></aside></div></main>`;
  const ld = { '@context': 'https://schema.org', '@type': 'Article', headline: p.title, description: p.summary.replace(/\[\[[^\]]+\]\]/g, m => plain(m)), url: SITE + p.slug + '.html', publisher: { '@type': 'Organization', name: 'IntelliTools' }, inLanguage: 'en' };
  return shell({ title: p.title, desc: plain(p.summary), file: p.slug + '.html', body, ld });
}

function glossaryPage() {
  const sorted = [...glossary].sort((a, b) => a.term.localeCompare(b.term));
  const letters = [...new Set(sorted.map(g => g.term[0].toUpperCase()))];
  let cur = '', html = '';
  for (const g of sorted) {
    const L = g.term[0].toUpperCase();
    if (L !== cur) { cur = L; html += `<h2 class="kn-letter" id="letter-${L}">${L}</h2>`; }
    const links = (g.pages || []).map(s => { const t = bySlug.get(s); if (!t) { errors.push('glossary ' + g.term + ' missing page ' + s); return ''; } return `<a href="${s}.html">${esc(t.title)}</a>`; }).filter(Boolean);
    const see = (g.see || []).map(t => { const f = glossary.find(x => x.term === t || x.term.startsWith(t + ' (')); if (!f) { errors.push('glossary ' + g.term + ' see missing ' + t); return ''; } return `<a href="#${slugify(f.term)}">${esc(t)}</a>`; }).filter(Boolean);
    html += `<div class="kn-term" id="${slugify(g.term)}"><dt>${esc(g.term)}${g.aka ? ` <span class="kn-aka">(${esc(g.aka)})</span>` : ''}</dt><dd>${inline(g.def)}${links.length ? `<div class="kn-term-links">Learn more: ${links.join(' · ')}</div>` : ''}${see.length ? `<div class="kn-term-links">See also: ${see.join(' · ')}</div>` : ''}</dd></div>`;
  }
  const body = `<main><section class="kn-head"><div class="wrap kn-wrap"><nav class="kn-crumb"><a href="index.html">Knowledge</a> › <span>Glossary</span></nav><span class="eyebrow">REFERENCE</span><h1>AI Glossary A–Z</h1><p class="kn-lede">Clear definitions of ${glossary.length} AI terms, with a link to the full explanation where one exists.</p>
<div class="kn-letters">${letters.map(l => `<a href="#letter-${l}">${l}</a>`).join('')}</div></div></section>
<div class="wrap kn-wrap"><dl class="kn-glossary">${html}</dl></div></main>`;
  const ld = { '@context': 'https://schema.org', '@type': 'DefinedTermSet', name: 'AI Glossary A–Z', url: SITE + 'glossary.html', hasDefinedTerm: sorted.map(g => ({ '@type': 'DefinedTerm', name: g.term, description: plain(g.def) })) };
  return shell({ title: 'AI Glossary A–Z', desc: `Definitions of ${glossary.length} AI terms, including tokens, embeddings, RAG, agents, MCP, and hallucination.`, file: 'glossary.html', body, ld });
}

function indexPage() {
  const groups = [...new Set(pages.filter(p => p.kind !== 'comparison').map(p => p.group))];
  const card = t => `<a class="kn-card" href="${t.slug}.html"><span class="kn-kind">${t.kind === 'comparison' ? 'Comparison' : 'Concept'}</span><strong>${esc(t.title)}</strong><small>${esc(plain(t.summary))}</small></a>`;
  const sec = g => `<section class="kn-group"><h2>${esc(g)}</h2><div class="kn-cards">${pages.filter(p => p.group === g && p.kind !== 'comparison').map(card).join('')}</div></section>`;
  const body = `<main><section class="kn-head"><div class="wrap kn-wrap"><span class="eyebrow">INTELLITOOLS KNOWLEDGE</span><h1>Explore Artificial Intelligence</h1><p class="kn-lede">Explore modern artificial intelligence through free, clear, and accessible guides that explain complex AI concepts in simple, practical language.</p>
<form class="kn-ask" id="kn-search-form" role="search" action="index.html">
<label for="kn-q">What do you want to know or build?</label>
<div class="kn-ask-row">
<input id="kn-q" name="q" type="search" placeholder="What do you want to know or build?" autocomplete="off" enterkeyhint="search" aria-describedby="kn-ask-note">
<button class="btn" type="submit">Search</button>
</div>
<p id="kn-ask-note" class="kn-ask-note">Search runs in your browser using files loaded from this site.</p>
</form>
<div id="kn-search-status" class="kn-sr" aria-live="polite"></div>
<div id="kn-search-results" class="kn-results"></div>
</div></section>
<div class="wrap kn-wrap"><section class="kn-group"><h2>Learning paths</h2><div class="kn-cards">${paths.map(pa => `<div class="kn-card kn-pathcard"><strong>${esc(pa.title)}</strong><small>${esc(pa.blurb)}</small><ol>${pa.steps.map(s => `<li><a href="${s}.html">${esc(bySlug.get(s).title)}</a></li>`).join('')}</ol></div>`).join('')}</div></section>
${groups.map(sec).join('')}
<section class="kn-group"><h2>Comparisons</h2><div class="kn-cards">${pages.filter(p => p.kind === 'comparison').map(card).join('')}</div></section>
<section class="kn-group"><h2>Reference</h2><div class="kn-cards"><a class="kn-card" href="glossary.html"><span class="kn-kind">Glossary</span><strong>AI Glossary A–Z</strong><small>${glossary.length} terms defined in plain English.</small></a></div></section></div></main>`;
  const ld = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'IntelliTools Knowledge', url: SITE, inLanguage: 'en' };
  return shell({ title: 'Knowledge: Artificial Intelligence Guides', desc: 'Explore free, accessible guides to artificial intelligence, AI agents, language models, prompting, and AI security.', file: 'index.html', body, ld }).replace('</body>', '<script type="module" src="search.js"></script></body>');
}

// ---- validation ----
for (const p of pages) {
  for (const k of ['slug', 'title', 'kind', 'summary', 'short', 'sections']) if (!p[k]) errors.push((p.slug || '?') + ': missing ' + k);
  if (!p.aliases?.length) errors.push(p.slug + ': no aliases');
  const words = p.sections.map(s => s[1]).join(' ').split(/\s+/).length;
  if (words < 380) errors.push(p.slug + ': only ' + words + ' words');
}
if (new Set(pages.map(p => p.slug)).size !== pages.length) errors.push('duplicate slugs');
for (const pa of paths) for (const s of pa.steps) if (!bySlug.has(s)) errors.push('path ' + pa.title + ' missing ' + s);

for (const p of pages) fs.writeFileSync(path.join(OUT, p.slug + '.html'), articlePage(p));
// Legacy URLs that must keep working. Static hosting (GitHub Pages) has no server redirects, so each old URL is a small
// stub: meta refresh + canonical + script redirect. Add new entries here, never hand-edit the generated stub.
const REDIRECTS = { 'hugging-face-transformers': 'hugging-face' };
for (const [from, to] of Object.entries(REDIRECTS)) {
  if (!pages.some(p => p.slug === to)) errors.push('redirect target does not exist: ' + from + ' -> ' + to);
  if (pages.some(p => p.slug === from)) errors.push('redirect source collides with a real page: ' + from);
  const target = to + '.html', abs = 'https://intellitools.online/knowledge/' + target;
  fs.writeFileSync(path.join(OUT, from + '.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Moved: ${esc(titleOfSlug(to))} | IntelliTools Knowledge</title>
<meta http-equiv="refresh" content="0; url=${target}"><link rel="canonical" href="${abs}">
<script>location.replace(${JSON.stringify(target)} + location.search + location.hash);</script></head>
<body><p>This guide moved to <a href="${target}">${esc(titleOfSlug(to))}</a>.</p></body></html>
`);
}
function titleOfSlug(slug) { return (pages.find(p => p.slug === slug) || { title: slug }).title; }
fs.writeFileSync(path.join(OUT, 'glossary.html'), glossaryPage());
fs.writeFileSync(path.join(OUT, 'index.html'), indexPage());


function mergeLexicon() {
  const dir = path.join(OUT, 'src');
  const parts = ['lexicon-part-a.json', 'lexicon-part-b.json', 'lexicon-part-c.json', 'lexicon-part-d.json', 'lexicon-part-e.json'].map(name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')));
  const arrayKeys = new Set(['stopwords', 'intents', 'concepts', 'coverageGaps', 'tools', 'queryTechnologies']);
  const objectKeys = new Set(['synonyms', 'pageTechnologies']);
  const merged = {};
  for (const part of parts) {
    for (const [key, value] of Object.entries(part)) {
      if (arrayKeys.has(key)) merged[key] = (merged[key] || []).concat(value);
      else if (objectKeys.has(key)) merged[key] = { ...(merged[key] || {}), ...value };
      else merged[key] = value;
    }
  }
  const order = ['version', 'minSolidScore', 'maxIntentBoost', 'glossaryBoost', 'stopwords', 'synonyms', 'intents', 'concepts', 'coverageGaps', 'tools', 'queryTechnologies', 'pageTechnologies'];
  const ordered = {};
  for (const key of order) if (Object.prototype.hasOwnProperty.call(merged, key)) ordered[key] = merged[key];
  for (const key of Object.keys(merged)) if (!Object.prototype.hasOwnProperty.call(ordered, key)) ordered[key] = merged[key];
  if (!Array.isArray(ordered.tools) || ordered.tools.length !== 6) errors.push('lexicon tools must stay the existing 6 entries');
  return ordered;
}

const index = {
  version: 1,
  note: 'Static index for local Knowledge Search. relatedTools lists ONLY tools that genuinely address the topic; empty means show Knowledge results only.',
  pages: pages.map(p => ({
    id: p.slug, url: 'knowledge/' + p.slug + '.html', title: p.title, type: p.kind, group: p.group || 'Comparisons',
    question: p.question, summary: plain(p.summary), aliases: p.aliases, keywords: p.keywords || [],
    related: p.related || [], relatedTools: p.tool ? [{ id: p.tool.id, url: 'tools/' + p.tool.id + '.html', reason: plain(p.tool.note).slice(0, 220) }] : [],
    entity: p.entity || undefined, headings: p.sections.map(s => s[0]), words: p.sections.map(s => s[1]).join(' ').split(/\s+/).length
  })),
  glossary: glossary.map(g => ({ term: g.term, aka: g.aka || '', definition: plain(g.def), pages: g.pages || [], url: 'knowledge/glossary.html#' + slugify(g.term) })),
  paths
};
fs.writeFileSync(path.join(OUT, 'ontology-v3.json'), JSON.stringify(ent.ontology, null, 1) + '\n');
fs.writeFileSync(path.join(OUT, 'search-index.json'), JSON.stringify(index, null, 1));
fs.writeFileSync(path.join(OUT, 'search-lexicon.json'), JSON.stringify(mergeLexicon(), null, 2) + '\n');
const urls = ['index.html', 'glossary.html', ...pages.map(p => p.slug + '.html')];
fs.writeFileSync(path.join(OUT, 'sitemap-fragment.xml'), '<!-- Generated. The same URLs are written into the root sitemap.xml by this build (block between the knowledge:start and knowledge:end markers). -->\n' + urls.map(u => `<url><loc>${SITE}${u}</loc></url>`).join('\n') + '\n');

if (errors.length) { console.error('BUILD ERRORS:\n' + errors.join('\n')); process.exit(1); }

// Keep the root sitemap.xml in sync: a generated block of canonical Knowledge URLs (index, glossary, every article).
// Redirect stubs are never listed. The block is replaced on each build, so the result is repeatable and idempotent.
{
  const rootSitemap = path.join(OUT, '..', 'sitemap.xml');
  const START = '  <!-- knowledge:start (generated by knowledge/src/build.mjs; do not edit by hand) -->';
  const END = '  <!-- knowledge:end -->';
  let xml = fs.readFileSync(rootSitemap, 'utf8');
  xml = xml.replace(new RegExp('\\n?' + START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\n?'), '\n');
  const entries = urls.map(u => `  <url><loc>${SITE}${u}</loc><priority>${u === 'index.html' ? '0.8' : '0.6'}</priority></url>`);
  const block = START + '\n' + entries.join('\n') + '\n' + END + '\n';
  if (!xml.includes('</urlset>')) throw new Error('root sitemap.xml has no </urlset>');
  xml = xml.replace(/\n*<\/urlset>\s*$/, '\n' + block + '</urlset>\n');
  fs.writeFileSync(rootSitemap, xml);
}
console.log('Built ' + pages.length + ' articles, ' + glossary.length + ' glossary terms.');
