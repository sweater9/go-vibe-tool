// Pure API over knowledge/relations.json, shared by search and by learning paths (no DOM, no network).
//   const rel = createRelations(JSON.parse(json));
//   rel.prerequisites("lora-and-peft")        -> ["fine-tuning", "neural-networks"]
//   rel.nextSteps("rag")                      -> guides that build on RAG
//   rel.related("rag", ["pre", "next"])       -> typed list [{ id, relation }]
//   rel.learningOrder("agentic-rag")          -> prerequisites first (depth-first, de-duplicated), ending with the guide
// Every method tolerates unknown ids and a missing file (it returns empty lists), so callers never need a guard.

export const RELATIONS = ["pre", "next", "cmp", "app", "rel"];
export const RELATION_LABELS = { pre: "prerequisite", next: "next step", cmp: "compare", app: "practical", rel: "related" };

export function createRelations(data) {
  const pages = (data && data.pages) || {};
  const entry = (id) => pages[id] || { pre: [], next: [], cmp: [], app: [], rel: [] };
  const list = (id, kind) => (entry(id)[kind] || []).filter((x) => x !== id && pages[x]);

  function learningOrder(id, limit = 12) {
    const out = [];
    const seen = new Set();
    const visit = (node, depth) => {
      if (seen.has(node) || depth > 6) return;
      seen.add(node);
      for (const pre of list(node, "pre")) visit(pre, depth + 1);
      out.push(node);
    };
    if (pages[id]) visit(id, 0);
    return out.slice(-limit);
  }

  return {
    has: (id) => Boolean(pages[id]),
    prerequisites: (id) => list(id, "pre"),
    nextSteps: (id) => list(id, "next"),
    comparisons: (id) => list(id, "cmp"),
    practical: (id) => list(id, "app"),
    related(id, kinds = RELATIONS) {
      const out = [];
      const seen = new Set([id]);
      for (const kind of kinds) for (const other of list(id, kind)) if (!seen.has(other)) { seen.add(other); out.push({ id: other, relation: kind, label: RELATION_LABELS[kind] }); }
      return out;
    },
    learningOrder
  };
}
