import { el, select, button, mountLab, fmt, reduceMotion, slider } from '../shared/kit.js';
import { SCENARIOS, createServer, request, advanceClock, statusClass } from './api-scenarios.js';

const STEPS = {
  catalog: [
    { text: 'Fetch page 2 of the books (page=2).', check: s => s.history.some(h => h.url.includes('page=2') && h.status === 200) },
    { text: 'Use cursor pagination: send a request with limit, then follow next_cursor.', check: s => s.history.filter(h => h.url.includes('cursor=') && h.status === 200).length >= 2 },
    { text: 'Filter by genre=fantasy and sort newest first (sort=-year).', check: s => s.history.some(h => h.url.includes('genre=fantasy') && h.url.includes('sort=-year') && h.status === 200) },
    { text: 'Cause a 400 error on purpose by asking for per_page=500.', check: s => s.history.some(h => h.status === 400) },
  ],
  auth: [
    { text: 'Call /profile without a token and read the 401.', check: s => s.history.some(h => h.url.startsWith('/profile') && h.status === 401) },
    { text: 'POST /login with the demo credentials to get a token.', check: s => s.history.some(h => h.url.startsWith('/login') && h.status === 200) },
    { text: 'Call /profile with Authorization: Bearer <token> (200), then /admin/stats for a 403.', check: s => s.history.some(h => h.url.startsWith('/profile') && h.status === 200) && s.history.some(h => h.url.startsWith('/admin') && h.status === 403) },
    { text: 'Advance the clock 61 seconds so the token expires, then see token_expired.', check: s => s.history.some(h => h.status === 401 && h.error === 'token_expired') },
    { text: 'Use POST /refresh with your refresh_token to continue.', check: s => s.history.some(h => h.url.startsWith('/refresh') && h.status === 200) },
  ],
  resilience: [
    { text: 'Call /flaky until it succeeds (two 503s first).', check: s => s.history.some(h => h.url.startsWith('/flaky') && h.status === 200) },
    { text: 'Trigger a 429 on /limited, then advance the clock 10 s and succeed again.', check: s => { const i = s.history.findIndex(h => h.status === 429); return i >= 0 && s.history.slice(i).some(h => h.url.startsWith('/limited') && h.status === 200); } },
    { text: 'Set the timeout to 1000 ms and call /slow to see a client timeout.', check: s => s.history.some(h => h.timedOut) },
  ],
  crud: [
    { text: 'Create a to-do with POST /todos (201 Created).', check: s => s.history.some(h => h.method === 'POST' && h.status === 201) },
    { text: 'Send a too-short title to see the 422 validation errors.', check: s => s.history.some(h => h.status === 422) },
    { text: 'Update a to-do with PATCH and then delete it (204).', check: s => s.history.some(h => h.method === 'PATCH' && h.status === 200) && s.history.some(h => h.method === 'DELETE' && h.status === 204) },
    { text: 'Request a to-do that does not exist (404).', check: s => s.history.some(h => h.status === 404) },
  ],
};
const EXPLAIN = {
  catalog: '<p>Large lists are returned in <b>pages</b>. <b>Page-based</b> (page + per_page) is easy to jump around; <b>cursor-based</b> uses an opaque bookmark and stays correct when data changes. Filters narrow results; sort orders them. Bad parameters should return a clear <code>400</code>.</p>',
  auth: '<p><b>Authentication</b> proves who you are; <b>authorization</b> decides what you may do (401 vs 403). A short-lived <b>access token</b> is sent in the <code>Authorization: Bearer</code> header; when it expires, a longer-lived <b>refresh token</b> gets a new one without asking for the password again. API keys identify an application.</p>',
  resilience: '<p>Networks fail. <b>5xx</b> errors and timeouts are often temporary, so clients <b>retry with back-off</b>. A <b>429</b> says “slow down” and often includes <code>Retry-After</code>. Always set a client timeout so one slow call cannot freeze your app.</p>',
  crud: '<p>REST maps actions to methods: <b>POST</b> creates (201 + Location), <b>GET</b> reads, <b>PATCH</b> updates part, <b>DELETE</b> removes (204, no body). <b>415</b> = wrong content type, <b>422</b> = valid JSON but invalid data, <b>409</b> = conflicts with existing data.</p>',
};

const pretty = d => d === null || d === undefined ? '(no body)' : JSON.stringify(d, null, 2);

function scenarioExp(id) {
  return function build(stage, ctx) {
    const sc = SCENARIOS[id]; let server, history, speed = 1;
    const fresh = () => { server = createServer(id, { seed: 7, speed }); history = []; };
    fresh();
    stage.append(el('p', { class: 'lk-hint' }, sc.intro));
    const ep = el('div', { class: 'lk-row', role: 'group', 'aria-label': 'Example requests' }); stage.append(el('h3', {}, 'Example requests'), ep);
    const ctl = el('div', { class: 'lk-controls' }); stage.append(ctl);
    const m = select(ctl, { id: `sc-${id}-m`, label: 'Method', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(v => ({ value: v, label: v })), value: 'GET' });
    const url = el('input', { type: 'text', id: `sc-${id}-u`, value: sc.endpoints[0][1], spellcheck: 'false', autocomplete: 'off' }); ctl.append(el('div', { class: 'lk-field' }, el('label', { for: `sc-${id}-u` }, 'Path and query (relative to the mock server)'), url));
    const hdr = el('textarea', { id: `sc-${id}-h`, rows: 3, spellcheck: 'false' }); hdr.value = '{}'; ctl.append(el('div', { class: 'lk-field' }, el('label', { for: `sc-${id}-h` }, 'Headers (JSON object)'), hdr));
    const body = el('textarea', { id: `sc-${id}-b`, rows: 3, spellcheck: 'false' }); ctl.append(el('div', { class: 'lk-field' }, el('label', { for: `sc-${id}-b` }, 'Body (JSON, for POST/PUT/PATCH)'), body));
    const tmo = el('input', { type: 'number', id: `sc-${id}-t`, min: 0, step: 100, value: 0, inputmode: 'numeric' }); ctl.append(el('div', { class: 'lk-field' }, el('label', { for: `sc-${id}-t` }, 'Client timeout in ms (0 = none)'), tmo));
    const sp = slider(ctl, { id: `sc-${id}-s`, label: 'Network speed', min: 0.25, max: 4, step: 0.25, value: 1, format: v => v < 1 ? 'fast' : v === 1 ? 'normal' : 'slow ×' + fmt(v, 2).replace(/\.00$/, ''), onInput: v => { speed = v; server.speed = v; } });
    const row = el('div', { class: 'lk-row' }); stage.append(row);
    const status = el('p', { class: 'lk-hint', role: 'status' }, 'Send a request to see the response.'); const out = el('pre', { class: 'lk-mono', style: 'white-space:pre-wrap;max-height:320px;overflow:auto;', tabindex: '0', 'aria-label': 'Response' }, ''); const log = el('ol', { class: 'lk-list', 'aria-label': 'Request history' }); const clock = el('span', { class: 'lk-hint' }, 'Virtual clock: 0 s');
    let busy = false; let sent = null;
    const report = () => ctx.report({ history }), showClock = () => { clock.textContent = `Virtual clock: ${server.now} s`; };
    function renderLog() { log.replaceChildren(...history.slice(-8).reverse().map(h => el('li', {}, `${h.method} ${h.url} → ${h.status || 'timeout'} (${h.latencyMs} ms)`))); }
    function fill(method, u, desc, sample) { m.set(method); url.value = u; body.value = sample ? JSON.stringify(sample, null, 2) : ''; hdr.value = ['POST', 'PATCH', 'PUT'].includes(method) && id === 'crud' || (id === 'auth' && method === 'POST') ? '{"Content-Type": "application/json"}' : '{}'; status.textContent = desc; }
    sc.endpoints.forEach(([mm, u, d, sample]) => button(ep, `${mm} ${u.split('?')[0]}`, () => { fill(mm, u, d, sample); ctx.announce('Loaded example: ' + d); }, 'ghost'));
    function send() {
      if (busy) return; let headers = {}; try { headers = JSON.parse(hdr.value || '{}'); if (!headers || typeof headers !== 'object' || Array.isArray(headers)) throw new Error('not an object'); } catch (e) { status.textContent = 'Headers must be a JSON object, e.g. {"Authorization": "Bearer abc"}.'; return; }
      const req = { method: m.get(), url: url.value.trim(), headers, body: body.value, timeoutMs: Number(tmo.value) || 0 }; const res = request(server, req);
      busy = true; sendBtn.disabled = true; status.textContent = `Waiting for the mock server… (simulated ${res.latencyMs} ms)`;
      const finish = () => { busy = false; sendBtn.disabled = false; const entry = { method: req.method, url: req.url, status: res.status, latencyMs: res.latencyMs, timedOut: !!res.timedOut, error: res.data && res.data.error }; history.push(entry);
        status.textContent = res.status === 0 ? `Client timeout after ${res.latencyMs} ms` : `${res.status} ${res.statusText} — ${statusClass(res.status)} — ${res.latencyMs} ms`;
        out.textContent = `HTTP ${res.status} ${res.statusText}\n${Object.entries(res.headers || {}).map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${pretty(res.data)}`; renderLog(); showClock(); report(); ctx.announce(status.textContent); };
      const wait = reduceMotion() ? 0 : Math.min(900, res.latencyMs / 4); if (wait) setTimeout(finish, wait); else finish();
    }
    const sendBtn = button(row, 'Send request', send);
    button(row, 'Advance clock +30 s', () => { advanceClock(server, 30); showClock(); ctx.announce('Virtual clock advanced 30 seconds.'); }, 'ghost');
    button(row, 'Advance clock +61 s', () => { advanceClock(server, 61); showClock(); ctx.announce('Virtual clock advanced 61 seconds.'); }, 'ghost');
    button(row, 'Reset mock server', () => { fresh(); out.textContent = ''; status.textContent = 'Server reset: state, tokens and history cleared.'; renderLog(); showClock(); report(); }, 'ghost');
    stage.append(clock, status, out, el('h3', {}, 'Request history'), log);
    fill(...sc.endpoints[0].slice(0, 3), sc.endpoints[0][3]); status.textContent = 'Send a request to see the response.';
    return { reset: () => { fresh(); sp.set(1); speed = 1; tmo.value = 0; fill(...sc.endpoints[0].slice(0, 3), sc.endpoints[0][3]); out.textContent = ''; status.textContent = 'Send a request to see the response.'; renderLog(); showClock(); } };
  };
}

const experiments = Object.keys(SCENARIOS).map(id => ({
  id, title: SCENARIOS[id].title, summary: SCENARIOS[id].intro, explain: EXPLAIN[id],
  real: 'A fictional server that runs entirely in your browser with fake data and virtual time. No request leaves this page.',
  build: scenarioExp(id), steps: STEPS[id],
}));
mountLab({ lab: 'api', root: document.getElementById('labRoot'), experiments });
