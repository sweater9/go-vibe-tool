/* GoVibeTool Labs — API scenarios. A stateful, fully local, deterministic mock "server" for teaching HTTP concepts.
   Nothing here talks to a network. Time is virtual (advance the clock to expire tokens or rate limits). */
import { rng } from '../shared/rng.mjs';

const GENRES = ['fantasy', 'science', 'history', 'mystery'];
const WORDS = ['Lantern', 'Orchard', 'Compass', 'Harbor', 'Atlas', 'Ember', 'Paper', 'Signal', 'Meadow', 'Cipher', 'Voyage', 'Mosaic'];
export const BOOKS = Array.from({ length: 23 }, (_, i) => ({ id: i + 1, title: `${WORDS[i % WORDS.length]} ${['of Dawn', 'Rising', 'Letters', 'Stories'][Math.floor(i / WORDS.length) + (i % 4) % 2]}`.trim() + ` ${i + 1}`, genre: GENRES[i % GENRES.length], year: 1990 + ((i * 7) % 34), pages: 120 + ((i * 53) % 400) }));

export const SCENARIOS = {
  catalog: { title: 'Pagination & filtering', baseLatency: 80, intro: 'A fictional book catalogue with 23 books. Learn page-based and cursor-based pagination, filters and sorting.',
    endpoints: [['GET', '/books?page=1&per_page=5', 'Page-based pagination'], ['GET', '/books?cursor=&limit=5', 'Cursor-based pagination (use next_cursor)'], ['GET', '/books?genre=fantasy&sort=-year', 'Filter and sort (prefix - for descending)'], ['GET', '/books/7', 'One book'], ['GET', '/books/999', 'Missing book → 404'], ['GET', '/books?per_page=500', 'Invalid parameter → 400']] },
  auth: { title: 'Authentication', baseLatency: 120, intro: 'Log in, receive a token, call protected endpoints, then watch the token expire and refresh it. Demo credentials: demo / demo-pass. API key: demo-key-123.',
    endpoints: [['POST', '/login', 'Exchange credentials for a token', { username: 'demo', password: 'demo-pass' }], ['GET', '/profile', 'Needs Authorization: Bearer <token>'], ['GET', '/admin/stats', 'Needs an admin scope → 403 for the demo user'], ['GET', '/public-data', 'Needs X-API-Key: demo-key-123'], ['POST', '/refresh', 'Swap refresh_token for a new access_token', { refresh_token: '<paste refresh_token>' }]] },
  resilience: { title: 'Errors, retries & rate limits', baseLatency: 150, intro: 'Real networks fail. Practise retries, back-off, rate limits and client timeouts.',
    endpoints: [['GET', '/flaky', 'Fails twice with 503, then succeeds (retry!)'], ['GET', '/limited', 'Allows 5 calls per 10 virtual seconds, then 429 + Retry-After'], ['GET', '/slow', 'Takes 3 seconds — set a short timeout to see a client timeout'], ['GET', '/status/500', 'Force any status code (e.g. 404, 418, 500)']] },
  crud: { title: 'Create, read, update, delete', baseLatency: 60, intro: 'A to-do list API with validation. See 201, 204, 404, 409, 415 and 422 in action.',
    endpoints: [['GET', '/todos', 'List to-dos'], ['POST', '/todos', 'Create (needs Content-Type: application/json)', { title: 'Learn about APIs' }], ['GET', '/todos/1', 'Read one'], ['PATCH', '/todos/1', 'Update fields', { done: true }], ['DELETE', '/todos/1', 'Delete → 204 No Content'], ['POST', '/todos', 'Validation error: title too short', { title: 'x' }]] },
};

const STATUS_TEXT = { 200: 'OK', 201: 'Created', 204: 'No Content', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed', 409: 'Conflict', 415: 'Unsupported Media Type', 418: "I'm a teapot", 422: 'Unprocessable Content', 429: 'Too Many Requests', 500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout' };

export function createServer(scenario, { seed = 1, speed = 1 } = {}) {
  if (!SCENARIOS[scenario]) throw new Error('Unknown scenario ' + scenario);
  return { scenario, seed, speed, now: 0, calls: 0, flakyCalls: 0, rateWindow: [], tokens: {}, refresh: {}, todos: [{ id: 1, title: 'Read the HTTP guide', done: false }, { id: 2, title: 'Send a first request', done: true }], nextTodo: 3 };
}
export const advanceClock = (server, seconds) => { server.now += Math.max(0, seconds); return server.now; };

const problem = (status, detail, extra = {}) => ({ status, headers: { 'content-type': 'application/problem+json' }, data: { title: STATUS_TEXT[status] || 'Error', status, detail, ...extra } });
const ok = (data, status = 200, headers = {}) => ({ status, headers: { 'content-type': 'application/json', ...headers }, data });

function parseUrl(raw) {
  const [path, query = ''] = String(raw || '/').split('?'); const params = {};
  for (const pair of query.split('&')) { if (!pair) continue; const [k, v = ''] = pair.split('='); try { params[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); } catch { params[k] = v; } }
  return { path: path.startsWith('/') ? path : '/' + path, params };
}
const lower = h => Object.fromEntries(Object.entries(h || {}).map(([k, v]) => [k.toLowerCase(), String(v)]));
const intParam = (v, d, min, max) => { if (v === undefined || v === '') return { v: d }; if (!/^\d+$/.test(v)) return { err: 'must be a whole number' }; const n = Number(v); if (n < min || n > max) return { err: `must be between ${min} and ${max}` }; return { v: n }; };
const b64 = s => typeof btoa === 'function' ? btoa(s) : Buffer.from(s).toString('base64');
const unb64 = s => typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString();

function catalog(req, u) {
  if (u.path === '/books') {
    if (req.method !== 'GET') return problem(405, 'Use GET on /books.', { allow: 'GET' });
    let items = BOOKS.slice(); const g = u.params.genre; if (g) { if (!GENRES.includes(g)) return problem(400, `genre must be one of ${GENRES.join(', ')}.`); items = items.filter(b => b.genre === g); }
    const sort = u.params.sort; if (sort) { const key = sort.replace(/^-/, ''); if (!['title', 'year', 'pages', 'id'].includes(key)) return problem(400, 'sort must be title, year, pages or id (prefix - for descending).'); const dir = sort.startsWith('-') ? -1 : 1; items.sort((a, b) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : a.id - b.id) * dir); }
    if ('cursor' in u.params || 'limit' in u.params) {
      const lim = intParam(u.params.limit, 5, 1, 20); if (lim.err) return problem(400, `limit ${lim.err}.`);
      let offset = 0; if (u.params.cursor) { try { const m = /^o:(\d+)$/.exec(unb64(u.params.cursor)); if (!m) throw 0; offset = Number(m[1]); } catch { return problem(400, 'cursor is not valid. Use the next_cursor value from a previous response.'); } }
      const slice = items.slice(offset, offset + lim.v), nextOffset = offset + lim.v;
      return ok({ data: slice, next_cursor: nextOffset < items.length ? b64('o:' + nextOffset) : null, has_more: nextOffset < items.length });
    }
    const per = intParam(u.params.per_page, 5, 1, 20), page = intParam(u.params.page, 1, 1, 10000); if (per.err) return problem(400, `per_page ${per.err}.`); if (page.err) return problem(400, `page ${page.err}.`);
    const total = items.length, pages = Math.max(1, Math.ceil(total / per.v)); if (page.v > pages) return problem(404, `Page ${page.v} does not exist; there are ${pages} pages.`, { total_pages: pages });
    const q = p => `/books?page=${p}&per_page=${per.v}${g ? '&genre=' + g : ''}${sort ? '&sort=' + sort : ''}`;
    return ok({ data: items.slice((page.v - 1) * per.v, page.v * per.v), meta: { page: page.v, per_page: per.v, total, total_pages: pages }, links: { prev: page.v > 1 ? q(page.v - 1) : null, next: page.v < pages ? q(page.v + 1) : null } }, 200, { 'x-total-count': String(total) });
  }
  const m = /^\/books\/(\d+)$/.exec(u.path); if (m) { if (req.method !== 'GET') return problem(405, 'Use GET.', { allow: 'GET' }); const b = BOOKS.find(x => x.id === Number(m[1])); return b ? ok(b) : problem(404, `No book with id ${m[1]}.`); }
  return null;
}

function auth(req, u, s) {
  const h = lower(req.headers), body = req.parsedBody;
  if (u.path === '/login') {
    if (req.method !== 'POST') return problem(405, 'Use POST.', { allow: 'POST' });
    if (!body || typeof body !== 'object') return problem(400, 'Send a JSON body with username and password.');
    if (body.username !== 'demo' || body.password !== 'demo-pass') return { ...problem(401, 'Wrong username or password.'), headers: { 'content-type': 'application/problem+json', 'www-authenticate': 'Bearer realm="demo"' } };
    const n = Object.keys(s.tokens).length + 1, access = `tok_demo_${n}`, refresh = `ref_demo_${n}`; s.tokens[access] = { issued: s.now, ttl: 60, scope: 'read' }; s.refresh[refresh] = access;
    return ok({ access_token: access, token_type: 'Bearer', expires_in: 60, refresh_token: refresh, scope: 'read' });
  }
  if (u.path === '/refresh') {
    if (req.method !== 'POST') return problem(405, 'Use POST.', { allow: 'POST' }); if (!body || !s.refresh[body.refresh_token]) return problem(401, 'Unknown refresh_token.');
    delete s.refresh[body.refresh_token]; const n = Object.keys(s.tokens).length + 1, access = `tok_demo_${n}`, refresh = `ref_demo_${n}`; s.tokens[access] = { issued: s.now, ttl: 60, scope: 'read' }; s.refresh[refresh] = access;
    return ok({ access_token: access, token_type: 'Bearer', expires_in: 60, refresh_token: refresh });
  }
  if (u.path === '/public-data') { if (h['x-api-key'] !== 'demo-key-123') return { ...problem(401, 'Missing or wrong X-API-Key header.'), headers: { 'content-type': 'application/problem+json', 'www-authenticate': 'ApiKey header="X-API-Key"' } }; return ok({ data: ['alpha', 'beta', 'gamma'], note: 'API keys identify an app, not a person.' }); }
  if (u.path === '/profile' || u.path === '/admin/stats') {
    const hdr = h.authorization || ''; if (!hdr) return { ...problem(401, 'No Authorization header. Log in first, then send Authorization: Bearer <access_token>.'), headers: { 'content-type': 'application/problem+json', 'www-authenticate': 'Bearer' } };
    const m = /^Bearer\s+(\S+)$/i.exec(hdr); if (!m) return problem(401, 'Authorization must look like “Bearer <token>”.');
    const t = s.tokens[m[1]]; if (!t) return { ...problem(401, 'Token not recognised.', { error: 'invalid_token' }), headers: { 'content-type': 'application/problem+json', 'www-authenticate': 'Bearer error="invalid_token"' } };
    if (s.now >= t.issued + t.ttl) return { ...problem(401, 'Token expired. Use your refresh_token on POST /refresh, or log in again.', { error: 'token_expired' }), headers: { 'content-type': 'application/problem+json', 'www-authenticate': 'Bearer error="invalid_token", error_description="expired"' } };
    if (u.path === '/admin/stats') return problem(403, 'You are signed in, but your token lacks the admin scope. 401 = who are you? 403 = you may not.', { required_scope: 'admin', your_scope: t.scope });
    return ok({ user: 'demo', scope: t.scope, expires_in: Math.max(0, Math.round(t.issued + t.ttl - s.now)) });
  }
  return null;
}

function resilience(req, u, s) {
  if (u.path === '/flaky') { s.flakyCalls++; if (s.flakyCalls <= 2) return { ...problem(503, `Temporary failure (attempt ${s.flakyCalls} of 3). Retry after a short wait.`), headers: { 'content-type': 'application/problem+json', 'retry-after': '1' } }; return ok({ message: `Succeeded on attempt ${s.flakyCalls}.` }); }
  if (u.path === '/limited') { s.rateWindow = s.rateWindow.filter(t => t > s.now - 10); const remaining = 5 - s.rateWindow.length; if (remaining <= 0) { const wait = Math.max(1, Math.ceil(s.rateWindow[0] + 10 - s.now)); return { ...problem(429, `Rate limit reached: 5 requests per 10 seconds. Try again in ${wait}s.`), headers: { 'content-type': 'application/problem+json', 'retry-after': String(wait), 'x-ratelimit-limit': '5', 'x-ratelimit-remaining': '0' } }; } s.rateWindow.push(s.now); return ok({ message: 'Allowed', used: s.rateWindow.length }, 200, { 'x-ratelimit-limit': '5', 'x-ratelimit-remaining': String(remaining - 1) }); }
  if (u.path === '/slow') return { ...ok({ message: 'Finally! That took a while.' }), extraLatency: 3000 };
  const m = /^\/status\/(\d{3})$/.exec(u.path); if (m) { const c = Number(m[1]); if (c < 200 || c > 599) return problem(400, 'Status must be 200–599.'); return c === 204 ? { status: 204, headers: {}, data: null } : { status: c, headers: { 'content-type': 'application/json' }, data: { requested: c, meaning: STATUS_TEXT[c] || 'No standard name in this demo' } }; }
  return null;
}

function crud(req, u, s) {
  const h = lower(req.headers);
  if (u.path === '/todos') {
    if (req.method === 'GET') return ok({ data: s.todos, total: s.todos.length });
    if (req.method === 'POST') {
      if (!/application\/json/.test(h['content-type'] || '')) return problem(415, 'Send Content-Type: application/json.');
      if (!req.parsedBody || typeof req.parsedBody !== 'object') return problem(400, 'Body must be a JSON object.');
      const t = req.parsedBody.title, errors = []; if (typeof t !== 'string') errors.push({ field: 'title', message: 'is required and must be text' }); else if (t.trim().length < 3) errors.push({ field: 'title', message: 'must have at least 3 characters' });
      if (errors.length) return problem(422, 'The body is valid JSON but fails validation.', { errors });
      if (s.todos.some(x => x.title.toLowerCase() === t.trim().toLowerCase())) return problem(409, 'A to-do with that title already exists.');
      const todo = { id: s.nextTodo++, title: t.trim(), done: false }; s.todos.push(todo); return ok(todo, 201, { location: `/todos/${todo.id}` });
    }
    return problem(405, 'Use GET or POST.', { allow: 'GET, POST' });
  }
  const m = /^\/todos\/(\d+)$/.exec(u.path);
  if (m) {
    const id = Number(m[1]), i = s.todos.findIndex(x => x.id === id); if (i < 0) return problem(404, `No to-do with id ${id}.`);
    if (req.method === 'GET') return ok(s.todos[i]);
    if (req.method === 'DELETE') { s.todos.splice(i, 1); return { status: 204, headers: {}, data: null }; }
    if (req.method === 'PATCH' || req.method === 'PUT') {
      if (!/application\/json/.test(h['content-type'] || '')) return problem(415, 'Send Content-Type: application/json.'); const b = req.parsedBody; if (!b || typeof b !== 'object') return problem(400, 'Body must be a JSON object.');
      const errors = []; if ('title' in b && (typeof b.title !== 'string' || b.title.trim().length < 3)) errors.push({ field: 'title', message: 'must have at least 3 characters' }); if ('done' in b && typeof b.done !== 'boolean') errors.push({ field: 'done', message: 'must be true or false' }); if (errors.length) return problem(422, 'Validation failed.', { errors });
      if ('title' in b) s.todos[i].title = b.title.trim(); if ('done' in b) s.todos[i].done = b.done; return ok(s.todos[i]);
    }
    return problem(405, 'Use GET, PATCH, PUT or DELETE.', { allow: 'GET, PATCH, PUT, DELETE' });
  }
  return null;
}

const HANDLERS = { catalog, auth, resilience, crud };

/** req: {method,url,headers,body (string), timeoutMs}. Returns {status,statusText,headers,data,latencyMs,timedOut?}. */
export function request(server, req) {
  server.calls++; const method = String(req.method || 'GET').toUpperCase(), u = parseUrl(req.url), sc = SCENARIOS[server.scenario];
  const r = { ...req, method }; let bodyError = null;
  if (req.body && String(req.body).trim()) { try { r.parsedBody = JSON.parse(req.body); } catch (e) { bodyError = e.message; } }
  let res = bodyError && ['POST', 'PUT', 'PATCH'].includes(method) ? problem(400, 'Body is not valid JSON: ' + bodyError) : HANDLERS[server.scenario](r, u, server);
  if (!res) res = problem(404, `${method} ${u.path} does not exist in this scenario.`, { try: sc.endpoints.map(e => `${e[0]} ${e[1].split('?')[0]}`) });
  const jr = rng(server.seed * 1000 + server.calls)(), jitter = 0.7 + jr * 0.6, latencyMs = Math.round((sc.baseLatency * jitter + (res.extraLatency || 0)) * server.speed);
  delete res.extraLatency;
  if (req.timeoutMs && latencyMs > req.timeoutMs) return { status: 0, statusText: 'Client timeout', headers: {}, data: { error: `The client gave up after ${req.timeoutMs} ms; the server needed about ${latencyMs} ms.` }, latencyMs: req.timeoutMs, timedOut: true };
  return { ...res, statusText: STATUS_TEXT[res.status] || 'Status', latencyMs };
}

export const statusClass = s => s === 0 ? 'network' : s < 300 ? 'success' : s < 400 ? 'redirect' : s < 500 ? 'client error' : 'server error';
