import { PATHS, LEVELS, LEVEL_DETAILS, TOPIC_GOALS, recommendPath } from './learning-paths.mjs';
import { createProgressStore, pathProgress, validChoice, STORAGE_KEY } from './learning-progress.mjs';
const form = document.querySelector('#kn-search-form');
const params = new URLSearchParams(location.search);
const slug = location.pathname.split('/').pop().replace(/\.html$/, '');
const explicit = { topic: params.get('learn'), level: params.get('level') };
// Ordinary article visits do not imply progress or completion.
if (form || (validChoice(explicit.topic, explicit.level) && PATHS[explicit.topic][explicit.level].includes(slug))) init();
function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text != null) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function link(text, href, className) { const el = node('a', text, className); el.href = href; return el; }
function guideHref(id, topic, level) { return `${id}.html?${new URLSearchParams({ learn: topic, level })}`; }
async function init() {
  const host = form ? form.parentElement : document.querySelector('.kn-head .kn-wrap');
  if (!host) return;
  const panel = node('section', null, 'kn-learning');
  panel.id = 'kn-v4-learning'; panel.setAttribute('aria-labelledby', 'kn-learning-title');
  const heading = node('h2', 'Choose your learning path'); heading.id = 'kn-learning-title';
  const status = node('p', 'Loading learning guides…', 'kn-learning-status');
  status.setAttribute('role', 'status');
  panel.append(heading, status);
  if (form) document.querySelector('#kn-search-results').insertAdjacentElement('afterend', panel); else host.append(panel);
  let index;
  try {
    const response = await fetch('search-index.json');
    if (!response.ok) throw new Error('HTTP error');
    index = await response.json();
    if (!Array.isArray(index.pages)) throw new Error('Invalid index');
  } catch {
    status.textContent = 'Learning guides could not be loaded. Refresh the page to try again. You can still read the guides below.';
    return;
  }
  let storage;
  try { storage = window.localStorage; } catch { storage = { getItem() { throw new Error('Unavailable'); }, setItem() { throw new Error('Unavailable'); } }; }
  const store = createProgressStore(storage);
  let choice = validChoice(explicit.topic, explicit.level) ? explicit : store.state.selected || { topic: Object.keys(PATHS)[0], level: LEVELS[0] };
  store.update(choice.topic, choice.level, form ? {} : { visit: slug });
  const controls = node('div', null, 'kn-learning-controls');
  function select(label, values, selected) {
    const wrap = node('label', label), input = node('select');
    input.setAttribute('aria-label', label);
    for (const value of values) { const option = node('option', value[0].toUpperCase() + value.slice(1)); option.value = value; input.append(option); }
    input.value = selected; wrap.append(input); controls.append(wrap); return input;
  }
  const topic = select('Learning subject', Object.keys(PATHS), choice.topic);
  const level = select('Learning difficulty', LEVELS, choice.level);
  const content = node('div', null, 'kn-learning-content');
  const privacy = node('p', null, 'kn-learning-privacy');
  panel.append(controls, content, privacy);
  if (!form) controls.remove();
  let resetPending = false;
  function save(action) { store.update(choice.topic, choice.level, action); render(); }
  function render() {
    const { topic: subject, level: difficulty } = choice;
    const pages = recommendPath(subject, difficulty, index.pages);
    content.replaceChildren();
    heading.textContent = form ? 'Choose your learning path' : `${subject} · ${difficulty[0].toUpperCase() + difficulty.slice(1)}`;
    privacy.textContent = store.persistent ? 'Progress is saved only in this browser. No account or tracking. Clearing site data removes it; it does not sync across devices.' : 'Browser storage is unavailable. Progress works here until this page closes, but will not be saved.';
    // Suppress competing navigation only after all curriculum guides are available.
    if (!form) document.querySelectorAll('.kn-path').forEach(nav => { nav.hidden = pages.length === PATHS[subject][difficulty].length; });
    if (pages.length !== PATHS[subject][difficulty].length) { status.textContent = 'This path has unavailable guides. Choose another subject or level.'; return; }
    const progress = pathProgress(store.state, subject, difficulty);
    status.textContent = `${progress.completed.length} of ${progress.total} guides completed${progress.resume ? '' : ' · Path complete!'}`;
    const meter = node('progress'); meter.max = progress.total; meter.value = progress.completed.length; meter.setAttribute('aria-label', 'Learning path completion');
    content.append(node('p', TOPIC_GOALS[subject], 'kn-learning-goal'), node('p', LEVEL_DETAILS[difficulty]), meter);
    const actions = node('div', null, 'kn-learning-actions');
    if (form) {
      if (progress.resume) actions.append(link(progress.last || progress.completed.length ? 'Resume learning' : 'Start learning', guideHref(progress.resume, subject, difficulty), 'btn'));
      else actions.append(link('Review from the start', guideHref(pages[0].id, subject, difficulty), 'btn'));
      const list = node('ol', null, 'kn-learning-steps');
      for (const page of pages) {
        const item = node('li');
        item.append(link(page.title, guideHref(page.id, subject, difficulty)), node('span', progress.completed.includes(page.id) ? 'Completed' : 'Not completed', 'kn-learning-badge'));
        list.append(item);
      }
      content.append(actions, list);
    } else {
      const position = pages.findIndex(page => page.id === slug);
      content.append(node('p', `Step ${position + 1} of ${pages.length}`, 'kn-learning-step'));
      const complete = node('button', progress.completed.includes(slug) ? 'Mark as incomplete' : 'Mark guide complete', 'btn');
      complete.type = 'button'; complete.setAttribute('aria-pressed', String(progress.completed.includes(slug)));
      complete.addEventListener('click', () => { save({ toggle: slug }); content.querySelector('button').focus(); });
      actions.append(complete);
      if (position > 0) actions.append(link('Previous guide', guideHref(pages[position - 1].id, subject, difficulty)));
      if (position < pages.length - 1) actions.append(link('Next guide', guideHref(pages[position + 1].id, subject, difficulty)));
      else if (progress.resume) actions.append(link('Continue unfinished guides', guideHref(progress.resume, subject, difficulty)));
      actions.append(link('Back to learning path', `index.html?${new URLSearchParams({ learn: subject, level: difficulty })}#kn-v4-learning`));
      content.append(actions);
    }
    if (progress.completed.length || progress.last) {
      const reset = node('button', resetPending ? 'Confirm reset of this path' : 'Reset this path', 'kn-learning-reset'); reset.type = 'button';
      reset.addEventListener('click', () => {
        if (!resetPending) { resetPending = true; render(); content.querySelector('.kn-learning-reset').focus(); }
        else { resetPending = false; save({ reset: true }); topic.isConnected ? topic.focus() : content.querySelector('.btn').focus(); }
      });
      content.append(reset);
      if (resetPending) { const cancel = node('button', 'Cancel reset', 'kn-learning-reset'); cancel.type = 'button'; cancel.addEventListener('click', () => { resetPending = false; render(); content.querySelector('.kn-learning-reset').focus(); }); content.append(cancel); }
    }
  }
  function change() {
    choice = { topic: topic.value, level: level.value }; resetPending = false;
    store.update(choice.topic, choice.level);
    // Preserve the search query and semantic flag when sharing a selected path.
    const url = new URL(location.href); url.searchParams.set('learn', choice.topic); url.searchParams.set('level', choice.level); history.replaceState(null, '', url);
    render();
  }
  topic.addEventListener('change', change); level.addEventListener('change', change);
  window.addEventListener('storage', event => { if (event.key === STORAGE_KEY || event.key === null) { store.refresh(); resetPending = false; render(); } });
  render();
}
