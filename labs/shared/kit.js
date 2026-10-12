/* GoVibeTool Labs — shared kit: experiment shell (tabs, guided steps, progress), controls, canvas helpers.
   Vanilla ES module, no dependencies. Everything runs locally; progress is stored in localStorage only. */
export const $ = (s, r = document) => r.querySelector(s);
export const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
};
export const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export { rng } from './rng.js';
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const fmt = (n, d = 2) => Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 }) : '—';
export const money = n => (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 });

let liveEl;
export function announce(msg) {
  liveEl = liveEl || document.getElementById('labLive');
  if (!liveEl) return; liveEl.textContent = ''; setTimeout(() => { liveEl.textContent = msg; }, 20);
}

/** Labelled slider with a live numeric readout. Returns {el, get, set}. */
export function slider(parent, { id, label, min, max, step = 1, value, unit = '', format = v => fmt(v, 2), onInput }) {
  const out = el('output', { for: id, class: 'lk-out' });
  const input = el('input', { type: 'range', id, min, max, step, value, 'aria-valuetext': '' });
  const upd = () => { out.textContent = format(+input.value) + unit; input.setAttribute('aria-valuetext', out.textContent); };
  input.addEventListener('input', () => { upd(); onInput && onInput(+input.value); });
  const box = el('div', { class: 'lk-field' }, el('label', { for: id }, label), el('div', { class: 'lk-range' }, input, out));
  parent.append(box); upd();
  return { el: box, input, get: () => +input.value, set: v => { input.value = v; upd(); } };
}
export function select(parent, { id, label, options, value, onChange }) {
  const s = el('select', { id }, options.map(o => el('option', { value: o.value }, o.label)));
  if (value != null) s.value = value;
  s.addEventListener('change', () => onChange && onChange(s.value));
  parent.append(el('div', { class: 'lk-field' }, el('label', { for: id }, label), s));
  return { el: s, get: () => s.value, set: v => { s.value = v; } };
}
export function button(parent, label, onClick, cls = '') {
  const b = el('button', { type: 'button', class: 'lk-btn ' + cls }, label); b.addEventListener('click', onClick); parent.append(b); return b;
}
export function number(parent, { id, label, min, max, step = 1, value, onInput }) {
  const i = el('input', { type: 'number', id, min, max, step, value, inputmode: 'decimal' });
  i.addEventListener('input', () => { if (i.value !== '' && !Number.isNaN(+i.value)) onInput && onInput(+i.value); });
  parent.append(el('div', { class: 'lk-field' }, el('label', { for: id }, label), i));
  return { el: i, get: () => +i.value, set: v => { i.value = v; } };
}

/** Responsive canvas with devicePixelRatio scaling. draw(ctx,w,h) is called on every redraw()/resize. */
export function canvas(parent, { aspect = 0.6, label, maxH = 480 }) {
  const c = el('canvas', { class: 'lk-canvas', role: 'img', 'aria-label': label || 'Simulation view' });
  const wrap = el('div', { class: 'lk-canvas-wrap' }, c); parent.append(wrap);
  const api = { c, wrap, draw: null, w: 0, h: 0, setLabel(t) { c.setAttribute('aria-label', t); } };
  const fit = () => {
    const w = Math.max(240, wrap.clientWidth), h = Math.min(maxH, Math.round(w * aspect)), d = Math.min(2, devicePixelRatio || 1);
    c.width = Math.round(w * d); c.height = Math.round(h * d); c.style.height = h + 'px'; api.w = w; api.h = h;
    const ctx = c.getContext('2d'); ctx.setTransform(d, 0, 0, d, 0, 0); api.redraw();
  };
  api.redraw = () => { const ctx = c.getContext('2d'); ctx.clearRect(0, 0, api.w, api.h); api.draw && api.draw(ctx, api.w, api.h); };
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => fit()).observe(wrap); else addEventListener('resize', fit);
  requestAnimationFrame(fit);
  return api;
}
export function bars(parent, { label }) { const d = el('div', { class: 'lk-bars', role: 'img', 'aria-label': label }); parent.append(d); return d; }

/**
 * Experiment shell. experiments: [{id,title,summary,explain,real,build(panel, ctx)->{reset(),state()}, steps:[{text,check(state)}]}]
 * ctx.report(state) must be called by an experiment whenever its parameters/results change; the kit then evaluates guided steps.
 */
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('../../sw.js').catch(() => {}));
export function mountLab({ lab, root, experiments }) {
  const KEY = `it_labs_${lab}_progress`;
  let progress = store.get(KEY, {});
  const tabs = el('div', { class: 'lk-tabs', role: 'tablist', 'aria-label': 'Experiments' });
  const panels = el('div', { class: 'lk-panels' });
  root.append(tabs, panels);
  const instances = {};
  const overall = el('p', { class: 'lk-overall', id: 'labOverall' });
  root.insertBefore(overall, tabs);
  const refreshOverall = () => {
    const total = experiments.reduce((n, e) => n + e.steps.length, 0), done = experiments.reduce((n, e) => n + e.steps.filter((_, i) => (progress[e.id] || {})[i]).length, 0);
    overall.textContent = `Guided progress on this device: ${done} of ${total} steps completed.`;
  };
  experiments.forEach((ex, idx) => {
    const tab = el('button', { type: 'button', role: 'tab', id: `tab-${ex.id}`, 'aria-controls': `panel-${ex.id}`, 'aria-selected': 'false', tabindex: '-1', class: 'lk-tab' }, ex.title);
    const panel = el('section', { role: 'tabpanel', id: `panel-${ex.id}`, 'aria-labelledby': `tab-${ex.id}`, class: 'lk-panel', hidden: true });
    const head = el('div', { class: 'lk-head' }, el('h2', {}, ex.title), el('p', { class: 'lk-sum' }, ex.summary));
    const stage = el('div', { class: 'lk-stage' });
    const side = el('aside', { class: 'lk-side' });
    const stepsBox = el('div', { class: 'lk-steps' });
    const stepList = el('ol', {});
    ex.steps.forEach((s, i) => { const li = el('li', { class: (progress[ex.id] || {})[i] ? 'done' : '' }, el('span', { class: 'lk-check', 'aria-hidden': 'true' }, (progress[ex.id] || {})[i] ? '✓' : '○'), el('span', {}, s.text), el('span', { class: 'sr-only' }, (progress[ex.id] || {})[i] ? ' (completed)' : ' (not completed)')); stepList.append(li); });
    stepsBox.append(el('h3', {}, 'Guided experiment'), el('p', { class: 'lk-hint' }, 'Follow the steps, or ignore them and explore freely — steps tick off automatically.'), stepList);
    const explain = el('details', { class: 'lk-explain', open: idx === 0 }, el('summary', {}, 'What is happening?'), el('div', { html: ex.explain }));
    const real = el('p', { class: 'lk-real' }, el('b', {}, 'Simulation notice: '), ex.real);
    const actions = el('div', { class: 'lk-actions' });
    side.append(stepsBox, explain, real);
    panel.append(head, el('div', { class: 'lk-grid' }, stage, side), actions);
    panels.append(panel); tabs.append(tab);
    let touched = false; for (const ev of ['input', 'change', 'click', 'keydown', 'pointerdown']) panel.addEventListener(ev, () => { touched = true; }, true);
    const markSteps = state => {
      if (!touched) return; // guided steps only tick after the learner has actually interacted
      let changed = false; const p = progress[ex.id] = progress[ex.id] || {};
      ex.steps.forEach((s, i) => { if (!p[i]) { let ok = false; try { ok = !!s.check(state); } catch { ok = false; } if (ok) { p[i] = true; changed = true; const li = stepList.children[i]; li.className = 'done'; li.querySelector('.lk-check').textContent = '✓'; li.lastChild.textContent = ' (completed)'; announce(`Step completed: ${s.text}`); } } });
      if (changed) { store.set(KEY, progress); refreshOverall(); }
    };
    const ctx = { report: markSteps, stage, side, actions, announce };
    const inst = ex.build(stage, ctx) || {};
    instances[ex.id] = inst;
    button(actions, 'Reset experiment', () => { inst.reset && inst.reset(); announce('Experiment reset to its starting values.'); }, 'ghost');
    button(actions, 'Clear my guided progress', () => { progress[ex.id] = {}; store.set(KEY, progress); stepList.querySelectorAll('li').forEach(li => { li.className = ''; li.querySelector('.lk-check').textContent = '○'; li.lastChild.textContent = ' (not completed)'; }); refreshOverall(); }, 'ghost');
    tab.addEventListener('click', () => select_(ex.id));
    tab.addEventListener('keydown', e => {
      const i = experiments.findIndex(x => x.id === ex.id); let n = null;
      if (e.key === 'ArrowRight') n = (i + 1) % experiments.length; else if (e.key === 'ArrowLeft') n = (i - 1 + experiments.length) % experiments.length; else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = experiments.length - 1;
      if (n != null) { e.preventDefault(); select_(experiments[n].id); $(`#tab-${experiments[n].id}`).focus(); }
    });
  });
  function select_(id) {
    experiments.forEach(ex => { const on = ex.id === id; const t = $(`#tab-${ex.id}`); t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; $(`#panel-${ex.id}`).hidden = !on; });
    history.replaceState(null, '', '#' + id); store.set(`it_labs_${lab}_last`, id);
    const inst = instances[id]; inst && inst.show && inst.show();
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }
  addEventListener('hashchange', () => { const id = location.hash.slice(1); if (experiments.some(e => e.id === id)) select_(id); });
  refreshOverall();
  const start = experiments.find(e => e.id === location.hash.slice(1))?.id || store.get(`it_labs_${lab}_last`) || experiments[0].id;
  select_(experiments.some(e => e.id === start) ? start : experiments[0].id);
  return { select: select_, instances, progress: () => progress };
}
