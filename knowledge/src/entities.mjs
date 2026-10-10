// Aggregates V3 entity modules; build.mjs imports { entityPages, ontology, entityErrors }.
import { validateEntities, toPage, toOntologyRecord, ENTITY_TYPES, FRESHNESS, AUTHORED } from './entity-model.mjs';
import { entities as e1 } from './entities-reasoning.mjs';
const modules = [e1];
for (const name of ['entities-ml.mjs', 'entities-llm.mjs', 'entities-agents.mjs', 'entities-eval-infra.mjs', 'entities-safety-science.mjs', 'entities-final-expansion.mjs', 'entities-final-expansion-models.mjs']) {
  try { modules.push((await import('./' + name)).entities); } catch (err) { if (err.code !== 'ERR_MODULE_NOT_FOUND') throw err; }
}
export const entities = modules.flat();

export function buildEntities(existingPages) {
  const existing = new Set(existingPages.map(p => p.slug));
  const errors = validateEntities(entities, existing);
  const all = new Set([...existing, ...entities.map(e => e.id)]);
  const titles = new Map([...existingPages.map(p => [p.slug, p.title]), ...entities.map(e => [e.id, e.name])]);
  const entityPages = entities.filter(e => !e.overlay).map(e => toPage(e, all));
  const aliasPatches = Object.fromEntries(entities.filter(e => e.overlay).map(e => [e.id, { aliases: [...(e.aliases || []), ...(e.acronyms || [])], keywords: [...(e.keywords || []), ...(e.tech || []).map(t => t.toLowerCase())] }]));
  const ontology = {
    schema_version: '3.0.0', authored: AUTHORED,
    provenance: 'Authored from the V3 topic specification. NOT a conversion of the V2 ontology document, which was not available. Most entries were authored without live source checks. Entries whose verification.status is key-claims-checked carry a source_check block listing the claims compared with primary sources, those sources, the check date and what could not be verified; no entry is marked verified and verification_date is null throughout.',
    entity_types: ENTITY_TYPES, freshness_classes: FRESHNESS,
    domains: [...new Set(entities.map(e => e.group))],
    entities: entities.map(e => toOntologyRecord(e, all, titles))
  };
  return { entityPages, ontology, errors, aliasPatches };
}
