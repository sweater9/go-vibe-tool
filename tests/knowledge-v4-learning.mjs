import assert from "node:assert/strict";
import { PATHS, LEVELS, recommendPath } from "../knowledge/learning-paths.mjs";
import fs from "node:fs";
const index=JSON.parse(fs.readFileSync(new URL("../knowledge/search-index.json",import.meta.url),"utf8"));
for (const [topic, levels] of Object.entries(PATHS)) {
  for (const level of LEVELS) {
    assert.ok(levels[level]?.length>=3, topic+" "+level+" must have >=3 guides");
    const result=recommendPath(topic,level,index.pages);
    assert.equal(result.length,levels[level].length,topic+" "+level+" has missing guide IDs");
    assert.equal(new Set(result.map(p=>p.id)).size,result.length);
  }
}
assert.deepEqual(recommendPath("unknown","beginner",index.pages),[]);
assert.deepEqual(recommendPath("AI fundamentals","unknown",index.pages),[]);
console.log("V4 learning path recommendations: PASS");

const { emptyState, sanitizeState, updateProgress, pathProgress, pathKey, createProgressStore, STORAGE_KEY } = await import('../knowledge/learning-progress.mjs');
const topic = 'AI fundamentals', level = 'beginner';
let state = emptyState();
assert.equal(pathProgress(state, topic, level).resume, 'what-is-ai');
state = updateProgress(state, topic, level, { visit: 'generative-ai' });
assert.equal(pathProgress(state, topic, level).resume, 'generative-ai');
assert.deepEqual(pathProgress(state, topic, level).completed, [], 'visiting never marks complete');
state = updateProgress(state, topic, level, { toggle: 'generative-ai' });
assert.equal(pathProgress(state, topic, level).resume, 'what-is-ai', 'resume first unfinished after last completed');
state = updateProgress(state, topic, level, { toggle: 'generative-ai' });
assert.deepEqual(pathProgress(state, topic, level).completed, [], 'completion is reversible');
for (const step of PATHS[topic][level]) state = updateProgress(state, topic, level, { toggle: step });
assert.equal(pathProgress(state, topic, level).resume, null);
state = updateProgress(state, 'Build AI agents', 'advanced', { toggle: 'rag' });
state = updateProgress(state, topic, level, { reset: true });
assert.deepEqual(pathProgress(state, topic, level).completed, []);
assert.deepEqual(pathProgress(state, 'Build AI agents', 'advanced').completed, ['rag'], 'reset preserves other paths');
assert.deepEqual(updateProgress(state, '__proto__', 'beginner', { toggle: 'what-is-ai' }), state);
assert.deepEqual(sanitizeState({ version: 99, selected: { topic, level } }), emptyState());
const cleaned = sanitizeState({ version: 1, selected: { topic: '__proto__', level }, paths: { [pathKey(topic, level)]: { completed: ['what-is-ai', 'what-is-ai', 'nope'], last: '../privacy' } } });
assert.equal(cleaned.selected, null);
assert.deepEqual(cleaned.paths[pathKey(topic, level)], { completed: ['what-is-ai'], last: null });
let value = '{broken';
const storage = { getItem: () => value, setItem: (key, next) => { assert.equal(key, STORAGE_KEY); value = next; } };
const store = createProgressStore(storage);
assert.deepEqual(store.state, emptyState(), 'malformed storage recovers');
store.update(topic, level, { visit: 'tokens', toggle: 'what-is-ai' });
assert.deepEqual(pathProgress(createProgressStore(storage).state, topic, level).completed, ['what-is-ai'], 'new store restores progress');
assert.equal(pathProgress(store.state, topic, level).last, null, 'out-of-path visit ignored');
const blocked = createProgressStore({ getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); } });
blocked.update(topic, level, { toggle: 'what-is-ai' });
assert.equal(blocked.persistent, false);
assert.deepEqual(pathProgress(blocked.state, topic, level).completed, ['what-is-ai']);
const full = createProgressStore({ getItem: () => null, setItem() { throw Error('quota'); } });
full.update(topic, level, { toggle: 'what-is-ai' });
full.update(topic, level, { toggle: 'generative-ai' });
assert.equal(full.persistent, false);
assert.equal(pathProgress(full.state, topic, level).completed.length, 2, 'quota failure retains memory progress');
console.log('V4 progress: persistence, resume, reversible completion, path isolation, reset, corrupt/blocked/full storage PASS');

let unreadable = false, changingValue = null;
const changing = createProgressStore({ getItem() { if (unreadable) throw Error('read denied'); return changingValue; }, setItem(key, next) { changingValue = next; } });
changing.update(topic, level, { toggle: 'what-is-ai' });
unreadable = true;
changing.update(topic, level, { toggle: 'generative-ai' });
assert.equal(changing.persistent, false);
assert.deepEqual(pathProgress(changing.state, topic, level).completed, ['what-is-ai', 'generative-ai'], 'post-initialization read denial preserves memory progress');
console.log('V4 post-initialization storage denial: PASS');
