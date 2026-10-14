/* Focused service-worker tests (no browser): a fake Cache API and controllable network/online state drive the real sw.js in a VM.
   Covers the Firefox "ServiceWorker intercepted the request and encountered an unexpected error" fix and guards offline support. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ORIGIN = 'https://govibetool.com';
const source = fs.readFileSync(process.env.SW_FILE || 'sw.js', 'utf8');
let passed = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); passed++; console.log('PASS', name); } catch (e) { failed++; console.error('FAIL', name, '::', e.message); } };

/* Minimal Cache API: keys are absolute URLs; match() accepts a Request-like object or a string. */
function makeCaches() {
  const stores = new Map();
  const keyOf = k => new URL(typeof k === 'string' ? k : k.url, ORIGIN + '/').href;
  const open = async name => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    return { put: async (k, r) => { store.set(keyOf(k), r); }, match: async k => store.get(keyOf(k)) && store.get(keyOf(k)).clone(), keys: async () => [...store.keys()].map(url => ({ url })) };
  };
  return {
    stores, open,
    match: async k => { for (const s of stores.values()) if (s.has(keyOf(k))) return s.get(keyOf(k)).clone(); },
    keys: async () => [...stores.keys()],
    delete: async n => stores.delete(n),
  };
}

function boot({ online = true, network = () => { throw new Error('offline'); }, caches = makeCaches(), cachesOverride } = {}) {
  const handlers = {}, state = { claimed: false, skipped: false, fetches: [], inFlight: 0, maxInFlight: 0 };
  const sandbox = {
    self: { addEventListener: (n, h) => (handlers[n] = h), navigator: { onLine: online }, clients: { claim: async () => { state.claimed = true; } }, skipWaiting: async () => { state.skipped = true; } },
    location: { origin: ORIGIN }, URL, Response, Promise,
    fetch: async req => {
      const url = typeof req === 'string' ? new URL(req, ORIGIN + '/').href : req.url;
      state.fetches.push(url); state.inFlight++; state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
      try { await new Promise(r => setTimeout(r, 1)); return await network(url, req); } finally { state.inFlight--; }
    },
    caches: cachesOverride || caches,
  };
  sandbox.self.skipWaiting = async () => { state.skipped = true; };
  vm.runInNewContext(source, sandbox);
  const request = (path, mode = 'cors') => ({ url: new URL(path, ORIGIN).href, method: 'GET', mode });
  async function dispatch(path, mode) {
    let promise; const waits = [];
    handlers.fetch({ request: request(path, mode), respondWith: p => { promise = p; }, waitUntil: p => waits.push(p) });
    const response = promise ? await promise : undefined;
    await Promise.allSettled(waits);
    return response;
  }
  const lifecycle = async name => { let p; handlers[name]({ waitUntil: x => { p = x; } }); return p; };
  return { sandbox, handlers, state, caches, dispatch, install: () => lifecycle('install'), activate: () => lifecycle('activate'), request, setOnline: v => { sandbox.self.navigator.onLine = v; } };
}
const ok = (body, type = 'text/plain') => new Response(body, { status: 200, headers: { 'Content-Type': type } });
const ASSETS = vm.runInNewContext('[' + source.match(/const ASSETS=\[([\s\S]*?)\];/)[1] + ']');
const assetUrl = a => new URL(a, ORIGIN + '/').href;

await test('cross-origin requests and non-GET requests are never intercepted', async () => {
  const sw = boot();
  assert.equal(await sw.dispatch('https://example.com/ad.js'), undefined);
  let called = false;
  sw.handlers.fetch({ request: { url: ORIGIN + '/x.js', method: 'POST', mode: 'cors' }, respondWith: () => { called = true; }, waitUntil() {} });
  assert.equal(called, false);
});

await test('browser-chrome icons are left to the browser while online (no interception, nothing for Firefox to cancel)', async () => {
  const sw = boot({ online: true });
  for (const p of ['/assets/icon.svg', '/assets/apple-touch-icon.png', '/assets/icon-192.png', '/assets/icon-512.png'])
    assert.equal(await sw.dispatch(p), undefined, p + ' must not be intercepted online');
});

await test('page images are still intercepted online (logo-mark.svg keeps its offline path)', async () => {
  const sw = boot({ online: true, network: () => ok('<svg/>', 'image/svg+xml') });
  const r = await sw.dispatch('/assets/logo-mark.svg');
  assert.ok(r instanceof Response && r.status === 200);
});

await test('offline: the same icons are answered from the cache', async () => {
  const sw = boot({ online: false });
  const cache = await sw.caches.open('x'); await cache.put(assetUrl('./assets/icon.svg'), ok('<svg id=cached/>', 'image/svg+xml'));
  const r = await sw.dispatch('/assets/icon.svg');
  assert.ok(r, 'icon request must be intercepted while offline'); assert.equal(await r.text(), '<svg id=cached/>');
});

await test('offline: a missing icon is a clean network error, never HTML', async () => {
  const sw = boot({ online: false });
  assert.equal((await sw.dispatch('/assets/apple-touch-icon.png')).type, 'error');
});

await test('offline: cached scripts and styles are served when the network is gone', async () => {
  const sw = boot();
  const cache = await sw.caches.open('x');
  await cache.put(assetUrl('./v8.css'), ok('body{}', 'text/css')); await cache.put(assetUrl('./tools.js'), ok('window.cached=1', 'application/javascript'));
  assert.equal(await (await sw.dispatch('/v8.css')).text(), 'body{}');
  assert.equal(await (await sw.dispatch('/tools.js')).text(), 'window.cached=1');
});

await test('offline: missing script/style/asset requests never receive the home page', async () => {
  const sw = boot();
  const cache = await sw.caches.open('x'); await cache.put(assetUrl('./index.html'), ok('<title>Home</title>', 'text/html'));
  for (const p of ['/missing.js', '/missing.css', '/missing.svg']) assert.equal((await sw.dispatch(p)).type, 'error', p);
});

await test('offline: navigations fall back to their own document, ignoring the query string, then to the home page', async () => {
  const sw = boot();
  const cache = await sw.caches.open('x');
  await cache.put(assetUrl('./index.html'), ok('HOME', 'text/html')); await cache.put(assetUrl('./studios.html'), ok('STUDIOS', 'text/html'));
  assert.equal(await (await sw.dispatch('/studios.html?studio=qr', 'navigate')).text(), 'STUDIOS');
  assert.equal(await (await sw.dispatch('/?tool=url-cleaner', 'navigate')).text(), 'HOME');
  assert.equal(await (await sw.dispatch('/labs/unknown', 'navigate')).text(), 'HOME');
});

await test('online: network wins for scripts/styles/documents and the offline copy is refreshed', async () => {
  const sw = boot({ network: url => ok('fresh:' + new URL(url).pathname) });
  const r = await sw.dispatch('/v8.css');
  assert.equal(await r.text(), 'fresh:/v8.css');
  assert.equal(await (await sw.caches.open('x')).match(ORIGIN + '/v8.css') ? 1 : 0, 0, 'sanity: separate fake cache name');
  assert.ok([...sw.caches.stores.values()].some(s => s.has(ORIGIN + '/v8.css')), 'runtime copy written to the cache');
});

await test('online: failed (non-OK) responses are returned as-is and never cached', async () => {
  const sw = boot({ network: () => new Response('nope', { status: 404 }) });
  const r = await sw.dispatch('/gone.js');
  assert.equal(r.status, 404);
  assert.ok(![...sw.caches.stores.values()].some(s => s.has(ORIGIN + '/gone.js')));
});

await test('respondWith never rejects: a failing Cache API falls back to the network', async () => {
  const broken = { match: async () => { throw new Error('cache storage unavailable'); }, open: async () => { throw new Error('cache storage unavailable'); }, keys: async () => [], delete: async () => true };
  const sw = boot({ cachesOverride: broken, network: url => ok('net:' + new URL(url).pathname) });
  for (const p of ['/v8.css', '/assets/logo-mark.svg']) assert.equal(await (await sw.dispatch(p)).text(), 'net:' + p);
});

await test('respondWith never rejects: failing Cache API and no network yields a network error, not a rejection', async () => {
  const broken = { match: async () => { throw new Error('boom'); }, open: async () => { throw new Error('boom'); }, keys: async () => [], delete: async () => true };
  const sw = boot({ cachesOverride: broken });
  assert.equal((await sw.dispatch('/anything.js')).type, 'error');
  assert.equal((await sw.dispatch('/offline/', 'navigate')).type, 'error');
});

await test('install precaches every listed asset with bounded concurrency and then skips waiting', async () => {
  const sw = boot({ network: url => ok('body:' + url) });
  await sw.install();
  assert.equal(sw.state.fetches.length, ASSETS.length, 'every asset fetched exactly once');
  const cached = [...sw.caches.stores.values()][0];
  for (const a of ASSETS) assert.ok(cached.has(assetUrl(a)), 'precached ' + a);
  assert.ok(sw.state.maxInFlight <= 6, 'concurrency ' + sw.state.maxInFlight + ' must stay bounded');
  assert.ok(sw.state.maxInFlight > 1, 'precaching still runs in parallel');
  assert.equal(sw.state.skipped, true);
});

await test('install fails (and the old worker stays) when any precached asset is not OK', async () => {
  const sw = boot({ network: url => (url.endsWith('/tools.js') ? new Response('', { status: 500 }) : ok('x')) });
  await assert.rejects(sw.install(), /precache failed/);
  assert.equal(sw.state.skipped, false);
});

await test('activate drops old caches, keeps the current one and claims clients', async () => {
  const sw = boot();
  await sw.caches.open('govibetool-old'); await sw.caches.open('govibetool-v2-7');
  const current = source.match(/const CACHE="([^"]+)"/)[1];
  await sw.caches.open(current);
  await sw.activate();
  assert.deepEqual([...sw.caches.stores.keys()], [current]);
  assert.equal(sw.state.claimed, true);
});

await test('every browser-chrome icon the page declares is exempt, and nothing broader (no script/style/page bypass)', async () => {
  const exempt = source.match(/const BROWSER_ICONS=\/(.+)\/;/)[1];
  assert.match(exempt, /icon\\\.svg/); assert.match(exempt, /apple-touch-icon\\\.png/);
  const re = new RegExp(exempt);
  for (const p of ['/v8.css', '/studios.css', '/tools.js', '/index.html', '/assets/logo-mark.svg', '/assets/icons/other.svg', '/x/assets/icon.svg.js']) assert.equal(re.test(p), false, p + ' must not be exempt');
  const html = fs.readFileSync('index.html', 'utf8');
  for (const m of html.matchAll(/<link[^>]+rel="(?:icon|apple-touch-icon)"[^>]+href="([^"]+)"/g)) assert.ok(re.test('/' + m[1]), 'declared icon ' + m[1] + ' is covered');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
