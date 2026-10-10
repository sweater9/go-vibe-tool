// V3 Knowledge entity model: validation + conversion into the page shape consumed by build.mjs,
// plus the ontology record written to knowledge/ontology-v3.json.
// Nothing here is a conversion of any external "V2" document; content is authored from the topic specification.

export const ENTITY_TYPES = ['concept', 'protocol', 'language', 'framework', 'library', 'model', 'runtime', 'database', 'platform', 'technique', 'benchmark', 'standard', 'regulation'];
export const FRESHNESS = {
  stable: 'Core ideas that change slowly (maths, classic algorithms). Re-review yearly.',
  evolving: 'Established techniques whose best practice shifts as research and tooling move. Re-review every 6 months.',
  volatile: 'Products, versions, protocols, benchmarks, leaderboards, regulations and dates. Verify against the primary source before relying on specifics; re-review every 3 months.'
};
export const AUTHORED = '2026-10-06';
export const TOOLS_PAGE_LEVEL = new Set(['ai-prompt-builder', 'fact-anchor-checker', 'pii-secret-redactor']);

// Compact authoring helper. Fields mirror the required entity attributes.
export function E(id, name, entity_type, group, f) {
  return { id, name, entity_type, group, ...f };
}

const REQUIRED = ['plain', 'technical', 'aliases', 'intents', 'questions', 'pre', 'rel', 'vs', 'tech', 'patterns', 'fails', 'fix', 'guide', 'sources', 'fresh', 'summary', 'short'];

export function validateEntities(entities, existingSlugs) {
  const errors = [];
  const ids = new Set(entities.map(e => e.id));
  if (ids.size !== entities.length) errors.push('duplicate entity ids');
  for (const e of entities) {
    const at = e.id + ': ';
    if (e.overlay) { if (!existingSlugs.has(e.id)) errors.push(at + 'overlay entity must name an existing page slug'); } else if (existingSlugs.has(e.id)) errors.push(at + 'collides with an existing page slug (set overlay:true to enrich it)');
    if (!ENTITY_TYPES.includes(e.entity_type)) errors.push(at + 'bad entity_type ' + e.entity_type);
    for (const k of REQUIRED) if (e[k] === undefined || e[k] === null || (Array.isArray(e[k]) && !e[k].length && !['pre', 'vs', 'tech'].includes(k))) errors.push(at + 'missing ' + k);
    if (!FRESHNESS[e.fresh]) errors.push(at + 'bad freshness ' + e.fresh);
    if ((e.questions || []).length < 3) errors.push(at + 'needs >= 3 natural-language questions');
    if ((e.intents || []).length < 2) errors.push(at + 'needs >= 2 user intents');
    if (!(e.sources || []).length) errors.push(at + 'no canonical sources');
    for (const s of e.sources || []) if (!Array.isArray(s) || s.length < 2) errors.push(at + 'source must be [title, locator|null]');
    if (e.fresh === 'volatile' && !(e.tsc || []).length) errors.push(at + 'volatile entity must list time-sensitive claims (tsc)');
    for (const list of ['pre', 'rel']) for (const r of e[list] || []) if (!ids.has(r) && !existingSlugs.has(r)) errors.push(at + list + ' ref does not resolve: ' + r);
    for (const v of e.vs || []) {
      if (!Array.isArray(v) || v.length !== 2) { errors.push(at + 'vs entries must be [ref, difference]'); continue; }
      if (/^[a-z0-9-]+$/.test(v[0]) && !ids.has(v[0]) && !existingSlugs.has(v[0])) errors.push(at + 'vs ref does not resolve: ' + v[0]);
    }
    if (e.checked) {
      const c = e.checked;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date || '')) errors.push(at + 'checked.date must be YYYY-MM-DD');
      if (!Array.isArray(c.sources) || !c.sources.length || c.sources.some(x => !Array.isArray(x) || x.length !== 2 || !/^https:\/\//.test(x[1]))) errors.push(at + 'checked.sources must be [title, https URL] pairs');
      if (!Array.isArray(c.claims) || !c.claims.length) errors.push(at + 'checked.claims must list what was checked');
      if (!Array.isArray(c.unverified)) errors.push(at + 'checked.unverified must be an array (empty only if nothing was left unchecked)');
    }
    if (e.tool && !TOOLS_PAGE_LEVEL.has(e.tool.id)) errors.push(at + 'unsupported page-level tool ' + e.tool.id);
    if (e.tool_note_only && !e.tool_note_only.id) errors.push(at + 'bad tool_note_only');
  }
  const get = id => entities.find(x => x.id === id);
  // Explicit modelling rules from the brief.
  const dpo = get('dpo');
  if (dpo) {
    if (dpo.parent !== 'preference-optimization') errors.push('dpo must have parent preference-optimization');
    if (dpo.group !== 'Safety, Alignment & Governance') errors.push('dpo must be filed under Safety, Alignment & Governance, not RL');
  }
  const rlGroup = entities.filter(e => e.group === 'ML, Deep Learning & RL');
  if (rlGroup.some(e => e.id === 'dpo')) errors.push('dpo must not be in the ML/DL/RL group');
  for (const e of entities) if (JSON.stringify(e).toLowerCase().match(/"verified":\s*true/)) errors.push(e.id + ': nothing may be marked verified');
  return errors;
}

const list = a => a.map(x => '- ' + x).join('\n');
const link = (ref, names) => (names.has(ref) ? '[[' + ref + ']]' : ref);

export function toPage(e, allSlugs, titleOf) {
  const L = ref => (allSlugs.has(ref) ? '[[' + ref + ']]' : ref);
  const sec = [];
  const aka = [...new Set([...(e.aliases || []), ...(e.acronyms || [])])].slice(0, 8);
  sec.push(['What is it?', e.plain + (aka.length ? '\n\n**Also known as:** ' + aka.join(', ') + '.' : '')]);
  sec.push(['Technical definition', e.technical + '\n\n**Entity type:** ' + e.entity_type + (e.parent ? ' · **Parent concept:** ' + L(e.parent) : '') + ' · **Freshness class:** ' + e.fresh + '.']);
  if (e.when) sec.push(['When should I use it?', e.when]);
  if (e.pre.length || e.rel.length) {
    let t = '';
    if (e.pre.length) t += '**Understand these first:** ' + e.pre.map(L).join(', ') + '.\n\n';
    if (e.rel.length) t += '**Related concepts:** ' + e.rel.map(L).join(', ') + '.';
    sec.push(['Prerequisites and related concepts', t.trim()]);
  }
  sec.push(['Implementation patterns', list(e.patterns)]);
  if (e.tech.length) sec.push(['Technologies and frameworks', 'Commonly associated: ' + e.tech.join(', ') + '. Names are examples of what exists, not recommendations, and projects change quickly.']);
  sec.push(['Practical guide', e.guide.map((g, i) => (i + 1) + '. ' + g).join('\n')]);
  sec.push(['Common failure modes', list(e.fails)]);
  sec.push(['Troubleshooting', list(e.fix.map(([s, r]) => '**' + s + '** — ' + r))]);
  if (e.vs.length) sec.push(['Contrasted with', list(e.vs.map(([r, d]) => '**' + L(r) + '** — ' + d))]);
  const ck = e.checked;
  let ver = ck
    ? '**Status: key claims checked on ' + ck.date + ' against the primary sources listed below; everything else is not independently verified.** The claims under "Checked against primary sources" were compared with the linked pages on that date. Pages change, so re-check anything time-sensitive before relying on it.\n\n'
    : '**Status: not independently verified.** This entry was authored on ' + AUTHORED + ' from general technical knowledge, without live checking of the sources below. Treat every source as a lead to confirm (identifier, title, authorship, current version) before publication or citation.\n\n';
  if (ck) {
    ver += '**Checked against primary sources (' + ck.date + '):**\n' + list(ck.claims) + '\n\n';
    ver += '**Primary sources consulted:**\n' + list(ck.sources.map(([t, u]) => '[' + t + '](' + u + ')')) + '\n\n';
    ver += ck.unverified.length ? '**Not independently verified:**\n' + list(ck.unverified) + '\n\n' : '';
  }
  ver += '**Freshness class:** ' + e.fresh + ' — ' + FRESHNESS[e.fresh] + '\n\n';
  if (e.tsc && e.tsc.length) ver += '**Time-sensitive claims to verify before relying on them:**\n' + list(e.tsc) + '\n\n';
  ver += (ck ? '**Further reading and canonical sources (not all checked):**\n' : '**Canonical sources (unverified leads):**\n') + list(e.sources.map(([t, loc]) => t + (loc ? ' — ' + loc : ' — locator to be identified')));
  sec.push(['Questions this page answers', list(e.questions) + '\n\n**Typical goals:** ' + e.intents.join('; ') + '.']);
  sec.push(['Sources and verification', ver]);
  const page = {
    slug: e.id, title: e.name, kind: e.page_kind || 'concept', group: e.group,
    question: e.questions[0], summary: e.summary, short: e.short,
    aliases: [...new Set([...(e.aliases || []), ...(e.acronyms || []), ...e.questions.slice(1).map(q => q.replace(/\?+$/, ''))])],
    keywords: [...new Set([...(e.keywords || []), ...(e.tech || []).map(s => s.toLowerCase())])],
    related: [...new Set([...(e.rel || []), ...(e.pre || [])])].filter(r => allSlugs.has(r)),
    sections: sec,
    entity: { entity_type: e.entity_type, freshness: e.fresh, verification_status: ck ? 'key-claims-checked' : 'needs-verification', checked_date: ck ? ck.date : null, parent: e.parent || null }
  };
  if (e.tool) page.tool = e.tool;
  return page;
}

export function toOntologyRecord(e, allSlugs, titles = new Map()) {
  const clean = x => (typeof x === 'string' ? x.replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (_, sl, lb) => lb || titles.get(sl) || sl).replace(/\*\*/g, '').replace(/`/g, '').replace(/\n+/g, ' ') : x);
  const cl = a => (a || []).map(clean);
  return {
    id: e.id, canonical_name: e.name, entity_type: e.entity_type, domain: e.group, parent: e.parent || null,
    page_kind: e.overlay ? 'existing-page-overlay' : (e.page_kind || 'concept'), url: 'knowledge/' + e.id + '.html',
    plain_english_definition: clean(e.plain), technical_definition: clean(e.technical),
    aliases: e.aliases || [], acronyms: e.acronyms || [],
    user_intents: e.intents, natural_language_questions: e.questions,
    prerequisites: e.pre, related_concepts: e.rel,
    contrasted_with: e.vs.map(([ref, difference]) => ({ ref, difference: clean(difference), resolves_to_page: allSlugs.has(ref) })),
    technologies_frameworks: e.tech, implementation_patterns: cl(e.patterns), common_failure_modes: cl(e.fails),
    troubleshooting: e.fix.map(([symptom, remedy]) => ({ symptom: clean(symptom), remedy: clean(remedy) })), practical_guide: cl(e.guide),
    when_to_use: clean(e.when) || null,
    canonical_sources: e.sources.map(([title, locator]) => ({ title, locator: locator || null, verified: false })),
    verification: e.checked
      ? { verified: false, verification_date: null, authored_date: AUTHORED, status: 'key-claims-checked', basis: 'key claims compared with the primary sources in source_check on the date given; the entry as a whole is not independently verified', source_check: { date: e.checked.date, claims_checked: e.checked.claims, sources: e.checked.sources.map(([title, url]) => ({ title, url })), not_independently_verified: e.checked.unverified } }
      : { verified: false, verification_date: null, authored_date: AUTHORED, status: 'needs-verification', basis: 'authored from topic specification and general knowledge; no live source check performed' },
    freshness_class: e.fresh, time_sensitive_claims_to_verify: cl(e.tsc),
    intellitools_mappings: [
      ...(e.tool ? [{ tool_id: e.tool.id, surface: 'page-block', why: e.tool.note.replace(/\*\*/g, '') }] : []),
      ...(e.tool_note_only ? [{ tool_id: e.tool_note_only.id, surface: 'ontology-only', why: e.tool_note_only.why }] : [])
    ]
  };
}
