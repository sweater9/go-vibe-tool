import { PATHS, LEVELS } from './learning-paths.mjs';
export const STORAGE_KEY = 'intellitools.knowledge.learning.v4';
export const validChoice = (topic, level) => Object.hasOwn(PATHS, topic) && LEVELS.includes(level);
export const pathKey = (topic, level) => JSON.stringify([topic, level]);
export const emptyState = () => ({ version: 1, selected: null, paths: {} });
export function sanitizeState(raw) {
  const state = emptyState();
  if (!raw || raw.version !== 1) return state;
  if (validChoice(raw.selected?.topic, raw.selected?.level)) state.selected = { topic: raw.selected.topic, level: raw.selected.level };
  for (const topic of Object.keys(PATHS)) for (const level of LEVELS) {
    const key = pathKey(topic, level), saved = raw.paths?.[key], steps = PATHS[topic][level];
    if (!saved || typeof saved !== 'object') continue;
    state.paths[key] = {
      completed: Array.isArray(saved.completed) ? [...new Set(saved.completed.filter(id => steps.includes(id)))] : [],
      last: steps.includes(saved.last) ? saved.last : null
    };
  }
  return state;
}
export function pathProgress(state, topic, level) {
  if (!validChoice(topic, level)) return { completed: [], last: null, total: 0, resume: null };
  const steps = PATHS[topic][level], saved = state.paths[pathKey(topic, level)] || {};
  const completed = steps.filter(id => saved.completed?.includes(id));
  const resume = steps.includes(saved.last) && !completed.includes(saved.last) ? saved.last : steps.find(id => !completed.includes(id)) || null;
  return { completed, last: saved.last || null, total: steps.length, resume };
}
export function updateProgress(state, topic, level, { visit, toggle, reset = false } = {}) {
  const next = sanitizeState(state);
  if (!validChoice(topic, level)) return next;
  next.selected = { topic, level };
  const key = pathKey(topic, level), progress = pathProgress(next, topic, level);
  const saved = { completed: [...progress.completed], last: progress.last };
  if (reset) { saved.completed = []; saved.last = null; }
  if (PATHS[topic][level].includes(visit)) saved.last = visit;
  if (PATHS[topic][level].includes(toggle)) saved.completed = saved.completed.includes(toggle) ? saved.completed.filter(id => id !== toggle) : [...saved.completed, toggle];
  next.paths[key] = saved;
  return next;
}
// Storage may be blocked or full. Continue in memory and disclose that it will not persist.
export function createProgressStore(storage) {
  let state = emptyState(), persistent = true;
  function read() {
    let raw;
    try { raw = storage.getItem(STORAGE_KEY); }
    catch { persistent = false; return state; }
    try { state = sanitizeState(JSON.parse(raw || 'null')); }
    catch { state = emptyState(); }
    return state;
  }
  read();
  return {
    get state() { return state; }, get persistent() { return persistent; },
    refresh() { if (persistent) read(); return state; },
    update(topic, level, action) {
      // Read current data before writing to preserve progress on other paths/tabs.
      if (persistent) read();
      state = updateProgress(state, topic, level, action);
      if (persistent) {
        try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { persistent = false; }
      }
      return state;
    }
  };
}
