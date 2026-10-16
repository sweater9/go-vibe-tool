/* Browser tests for GoVibeTool Labs (hub, six labs, keyboard, persistence, offline, privacy).
   node tests/labs-browser.mjs [chromium|firefox|webkit]   env: LABS_BASE_URL (test a deployed site; skips offline checks), PLAYWRIGHT_PACKAGE, LABS_ARTIFACTS */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const pw = await import(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const engine = process.argv[2] || 'chromium';
const live = !!process.env.LABS_BASE_URL;
const dir = process.env.LABS_ARTIFACTS || `artifacts/labs-${engine}`;
await fs.mkdir(dir, { recursive: true });
const root = process.env.SITE_ROOT ? path.resolve(process.env.SITE_ROOT) + '/' : fileURLToPath(new URL('../', import.meta.url)); // SITE_ROOT=dist runs the suite against the built output
let server, base, serverPort = 0; const sockets = new Set();
if (live) base = process.env.LABS_BASE_URL.replace(/\/?$/, '/');
else {
  server = http.createServer(async (req, res) => {
    try {
      let f = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!f.startsWith(root.replace(/\/$/, ''))) { res.writeHead(403).end(); return; }
      if ((await fs.stat(f)).isDirectory()) f = path.join(f, 'index.html');
      let b = await fs.readFile(f);
      if (f.endsWith('.html')) b = Buffer.from(b.toString().replace(/<script async src="https:\/\/pagead2[^>]*><\/script>/g, ''));
      const t = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
      res.writeHead(200, { 'Content-Type': t[path.extname(f)] || 'application/octet-stream' }).end(b);
    } catch { res.writeHead(404).end('nf'); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); server.on('connection', s => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  serverPort = server.address().port; base = `http://127.0.0.1:${serverPort}/`;
}
const stopServer = () => new Promise(r => { server.close(() => r()); for (const s of sockets) s.destroy(); });
const startServer = () => new Promise(r => server.listen(serverPort, '127.0.0.1', r));
const browser = await pw[engine].launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
let passed = 0; const failures = [];
async function check(name, fn) { try { await fn(); passed++; console.log('PASS', name); } catch (e) { failures.push(`${name}: ${e.message.split('\n')[0]} @${((e.stack || '').split('\n').find(l => l.includes('play-games-browser')) || '').trim().replace(/.*play-games-browser\.mjs/, 'line')}`); console.log('FAIL', name, '—', e.message.split('\n').slice(0, 3).join(' | ')); } }
async function ctxFor({ w, h, touch = false, reduced = false, init = [] }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  for (const s of init) await ctx.addInitScript(s);
  await ctx.tracing.start({ screenshots: true, snapshots: true });
  const page = await ctx.newPage(); page.setDefaultTimeout(15000);
  const errs = []; page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/pagead|googlesyndication|favicon/.test(m.text())) errs.push('console: ' + m.text()); });
  return { ctx, page, errs };
}
async function closeCtx(c, failed) { await c.ctx.tracing.stop(failed ? { path: `${dir}/trace-${Date.now()}.zip` } : undefined); await c.ctx.close(); }
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const setLS = (p, k, v) => p.evaluate(([k, v]) => localStorage.setItem(k, v), [k, v]);
const getLS = (p, k) => p.evaluate(k => localStorage.getItem(k), k);

const LABS = [['workflow', 'Visual Workflow Lab'], ['api-playground', 'API & JSON Playground'], ['ai', 'AI & Machine Learning Lab'], ['cyber', 'Cybersecurity Lab'], ['science', 'Science & Physics Lab'], ['finance', 'Finance & Market Simulation Lab']];
const KIT_LABS = { ai: ['classifier', 'neural', 'text', 'embeddings'], cyber: ['hashing', 'encryption', 'passwords', 'authentication', 'threats'], science: ['projectile', 'orbit', 'pendulum', 'probability'], finance: ['compounding', 'diversification', 'risk', 'market'] };
const settle = p => p.waitForSelector('.lk-tab[aria-selected="true"]');
const stat = (p, panel, i = 0) => p.locator(`#panel-${panel} .lk-stat strong`).nth(i).innerText();
const setRange = (p, sel, v) => p.locator(sel).evaluate((e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, v);
try {
  for (const [label, w, h, touch] of [['desktop', 1280, 900, false], ['mobile', 390, 844, true]]) {
    await check(`${label}: Labs hub shows six labs with working links`, async () => {
      const c = await ctxFor({ w, h, touch }); const p = c.page; await p.goto(base + 'labs/', { waitUntil: 'networkidle' });
      assert.match(await p.locator('.hero-stats span').first().innerText(), /6\s*Live Labs/i);
      const hrefs = await p.locator('.v5-card a.btn').evaluateAll(a => a.map(x => x.getAttribute('href'))); assert.deepEqual(hrefs, ['workflow/', 'api-playground/', 'ai/', 'cyber/', 'science/', 'finance/']);
      assert.equal(await overflow(p), 0); assert.deepEqual(c.errs, []); await closeCtx(c);
    });
    for (const [slug, title] of LABS) await check(`${label}: ${slug} loads, no errors, no horizontal overflow`, async () => {
      const c = await ctxFor({ w, h, touch }); const p = c.page; await p.goto(base + `labs/${slug}/`, { waitUntil: 'networkidle' });
      assert.match(await p.locator('h1').innerText(), new RegExp(title.replace(/[&]/g, '.')));
      if (KIT_LABS[slug]) { await settle(p); assert.ok(await p.locator('.lk-real:visible').count() >= 1, 'simulation notice visible'); assert.match(await p.locator('.lk-banner').first().innerText(), /simulation|teaching|model|educational/i); }
      assert.equal(await overflow(p), 0); assert.deepEqual(c.errs, []); await closeCtx(c);
    });
  }
  // keyboard: arrow keys move between tabs, selection follows, panel changes
  for (const slug of Object.keys(KIT_LABS)) await check(`keyboard: ${slug} tabs work with arrow keys`, async () => {
    const c = await ctxFor({ w: 1280, h: 900 }); const p = c.page; await p.goto(base + `labs/${slug}/`, { waitUntil: 'networkidle' }); await settle(p);
    const ids = KIT_LABS[slug]; await p.locator(`#tab-${ids[0]}`).focus(); await p.keyboard.press('ArrowRight');
    assert.equal(await p.locator(`#tab-${ids[1]}`).getAttribute('aria-selected'), 'true'); assert.ok(await p.locator(`#panel-${ids[1]}`).isVisible()); assert.ok(!(await p.locator(`#panel-${ids[0]}`).isVisible()));
    await p.keyboard.press('End'); assert.equal(await p.locator(`#tab-${ids.at(-1)}`).getAttribute('aria-selected'), 'true'); await p.keyboard.press('Home'); assert.equal(await p.locator(`#tab-${ids[0]}`).getAttribute('aria-selected'), 'true');
    await closeCtx(c);
  });
  // immediate feedback + guided progress + persistence + reset
  await check('science: moving a slider updates readouts immediately; guided step ticks and persists', async () => {
    const c = await ctxFor({ w: 1280, h: 900 }); const p = c.page; await p.goto(base + 'labs/science/#projectile', { waitUntil: 'networkidle' }); await settle(p);
    const before = await stat(p, 'projectile', 0); await setRange(p, '#pj-v', 50); const after = await stat(p, 'projectile', 0); assert.notEqual(before, after);
    assert.match(await p.locator('#labOverall').innerText(), /0 of/); await p.locator('#panel-projectile button:has-text("Launch")').click(); await p.waitForFunction(() => /[1-9] of/.test(document.getElementById('labOverall').textContent));
    await p.reload({ waitUntil: 'networkidle' }); await settle(p); assert.match(await p.locator('#labOverall').innerText(), /[1-9] of/, 'progress survives reload');
    await p.locator('button:has-text("Clear my guided progress")').first().click(); assert.match(await p.locator('#labOverall').innerText(), /0 of/);
    await closeCtx(c);
  });
  await check('finance: compounding responds to the sliders', async () => {
    const c = await ctxFor({ w: 1280, h: 900 }); const p = c.page; await p.goto(base + 'labs/finance/#compounding', { waitUntil: 'networkidle' }); await settle(p);
    const sliders = p.locator('#panel-compounding input[type=range]'); assert.ok(await sliders.count() >= 2); const before = await stat(p, 'compounding', 0);
    await sliders.nth(1).evaluate(e => { e.value = e.max; e.dispatchEvent(new Event('input', { bubbles: true })); }); assert.notEqual(await stat(p, 'compounding', 0), before); assert.deepEqual(c.errs, []); await closeCtx(c);
  });
  await check('cyber: one-bit change flips about half the hash and ticks the guided step', async () => {
    const c = await ctxFor({ w: 1280, h: 900 }); const p = c.page; await p.goto(base + 'labs/cyber/#hashing', { waitUntil: 'networkidle' }); await settle(p);
    await p.locator('#panel-hashing button:has-text("Change one bit")').click(); await p.waitForFunction(() => !/^0 of/.test(document.querySelector('#panel-hashing .lk-stat strong').textContent));
    const bits = parseInt((await stat(p, 'hashing', 0)), 10); assert.ok(bits > 90 && bits < 166, 'bits changed ' + bits); await p.waitForFunction(() => /[1-9] of/.test(document.getElementById('labOverall').textContent)); await closeCtx(c);
  });
  await check('cyber: AES-GCM rejects tampering and a wrong passphrase', async () => {
    const c = await ctxFor({ w: 1280, h: 900 }); const p = c.page; await p.goto(base + 'labs/cyber/#encryption', { waitUntil: 'networkidle' }); await settle(p);
    await p.selectOption('#e-kind', 'aes'); await p.waitForFunction(() => /ciphertext/.test(document.querySelector('#panel-encryption .lk-mono').textContent));
    await p.locator('#panel-encryption button:has-text("Tamper")').click(); await p.waitForFunction(() => /Authentication failed/.test(document.querySelector('#panel-encryption [role=status]').textContent));
    await p.locator('#panel-encryption button:has-text("Decrypt correctly")').click(); await p.waitForFunction(() => /Decrypted: Meet me/.test(document.querySelector('#panel-encryption [role=status]').textContent)); await closeCtx(c);
  });
  await check('ai: training the neural network raises accuracy and keeps a deterministic result', async () => {
    const c = await ctxFor({ w: 1280, h: 900 }); const p = c.page; await p.goto(base + 'labs/ai/#neural', { waitUntil: 'networkidle' }); await settle(p);
    const acc0 = parseInt(await stat(p, 'neural', 2), 10); await p.locator('#panel-neural button:has-text("Train 200 epochs")').click(); const acc1 = parseInt(await stat(p, 'neural', 2), 10); assert.equal(await stat(p, 'neural', 0), '200'); assert.ok(acc1 >= 90 && acc1 > acc0, `${acc0} -> ${acc1}`);
    await p.locator('#panel-neural button:has-text("Re-initialise")').click(); await p.locator('#panel-neural button:has-text("Train 200 epochs")').click(); assert.ok(parseInt(await stat(p, 'neural', 2), 10) >= 85); await closeCtx(c);
  });
  await check('ai: spam filter classifies and can be taught', async () => {
    const c = await ctxFor({ w: 1280, h: 900 }); const p = c.page; await p.goto(base + 'labs/ai/#text', { waitUntil: 'networkidle' }); await settle(p);
    assert.match(await p.locator('#panel-text .lk-verdict').innerText(), /Spam/); await p.fill('#x-txt', 'Lunch meeting on Friday'); assert.match(await p.locator('#panel-text .lk-verdict').innerText(), /Not spam/);
    const n0 = await stat(p, 'text', 1); await p.locator('#panel-text button:has-text("IS spam")').click(); assert.equal(Number(await stat(p, 'text', 1)), Number(n0) + 1); await closeCtx(c);
  });
  await check('workflow: loop template runs to the expected total, breakpoint pauses, back steps, keyboard connect', async () => {
    const c = await ctxFor({ w: 1400, h: 1000 }); const p = c.page; await p.goto(base + 'labs/workflow/', { waitUntil: 'networkidle' });
    await p.selectOption('#sampleSelect', 'loopCounter'); await p.click('#btnRunAllSim'); assert.match(await p.locator('#simContextContainer').innerText(), /"total": 10/);
    await p.click('#btnResetSim'); await p.locator('.wf-node[data-id="t_add"]').click(); await p.check('#nodeBreakpoint'); await p.click('#btnRunBreakSim'); assert.match(await p.locator('#simStatus').innerText(), /total = total \+ i/);
    await p.click('#btnBackSim'); assert.match(await p.locator('#simStatus').innerText(), /Step \d/); await p.click('#btnAddLoop'); await p.selectOption('#conn-body', 't_end'); await p.selectOption('#conn-done', 't_end');
    assert.equal(await p.evaluate(() => window.workflowApp.workflow.nodes.filter(n => n.type === 'loop').length), 2); await p.click('#btnUndo'); await p.click('#btnUndo'); await p.click('#btnUndo');
    assert.match(await p.locator('#wfGuideCount').innerText(), /[1-9] of 6/i); assert.deepEqual(c.errs, []); await closeCtx(c);
  });
  await check('workflow: arrow keys move a focused step; export downloads versioned JSON', async () => {
    const c = await ctxFor({ w: 1400, h: 1000 }); const p = c.page; await p.goto(base + 'labs/workflow/', { waitUntil: 'networkidle' }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'networkidle' });
    const x0 = await p.evaluate(() => window.workflowApp.workflow.nodes[0].x); await p.locator('.wf-node').first().focus(); await p.keyboard.press('ArrowRight'); assert.equal(await p.evaluate(() => window.workflowApp.workflow.nodes[0].x), x0 + 10);
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#btnExportJson')]); const txt = await fs.readFile(await dl.path(), 'utf8'); assert.equal(JSON.parse(txt).format, 'govibetool-workflow'); await closeCtx(c);
  });
  await check('api: scenario requests return realistic statuses and guided steps tick', async () => {
    const c = await ctxFor({ w: 1280, h: 900, reduced: true }); const p = c.page; await p.goto(base + 'labs/api-playground/#catalog', { waitUntil: 'networkidle' }); await settle(p);
    const send = async panel => { await p.locator(`#panel-${panel} button:has-text("Send request")`).click(); };
    await p.fill('#sc-catalog-u', '/books?page=2&per_page=5'); await send('catalog'); await p.waitForFunction(() => /200 OK/.test(document.querySelector('#panel-catalog [role=status].lk-hint').textContent));
    await p.fill('#sc-catalog-u', '/books?per_page=500'); await send('catalog'); await p.waitForFunction(() => /400 Bad Request/.test(document.querySelector('#panel-catalog [role=status].lk-hint').textContent));
    await p.locator('#tab-resilience').click(); await p.fill('#sc-resilience-u', '/slow'); await p.fill('#sc-resilience-t', '1000'); await send('resilience'); await p.waitForFunction(() => /Client timeout/.test(document.querySelector('#panel-resilience [role=status].lk-hint').textContent));
    assert.match(await p.locator('#labOverall').innerText(), /[2-9] of/); assert.deepEqual(c.errs, []); await closeCtx(c);
  });
  await check('mobile: touch device can use a lab (tap tabs, buttons)', async () => {
    const c = await ctxFor({ w: 390, h: 844, touch: true }); const p = c.page; await p.goto(base + 'labs/ai/', { waitUntil: 'networkidle' }); await settle(p);
    await p.locator('#tab-neural').tap(); await p.locator('#panel-neural button:has-text("Train 10 epochs")').tap(); assert.equal(await stat(p, 'neural', 0), '10'); assert.equal(await overflow(p), 0); await closeCtx(c);
  });
  if (!live) await check('offline: labs hub and labs load from the service-worker cache', async () => {
    const c = await ctxFor({ w: 390, h: 844, touch: true }); const p = c.page; await p.goto(base + 'labs/cyber/', { waitUntil: 'networkidle' });
    await p.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise(r => { navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }); setTimeout(r, 8000); }); });
    await p.waitForFunction(async () => { const need = ['/labs/index.html', '/labs/shared/kit.js', '/labs/ai/ai-app.js', '/labs/cyber/cyber-engine.js', '/labs/science/index.html', '/labs/finance/finance-engine.js', '/labs/api-playground/scenario-app.js', '/labs/workflow/workflow-engine.js']; for (const n of await caches.keys()) { const k = (await (await caches.open(n)).keys()).map(r => new URL(r.url).pathname); if (need.every(x => k.includes(x))) return true; } return false; }, null, { timeout: 20000 });
    await stopServer();
    try {
      await p.goto(base + 'labs/', { waitUntil: 'domcontentloaded' }); assert.equal(await p.locator('.v5-card').count(), 6);
      for (const [slug, tab] of [['ai', 'classifier'], ['cyber', 'hashing'], ['science', 'projectile'], ['finance', 'compounding']]) { await p.goto(base + `labs/${slug}/`, { waitUntil: 'domcontentloaded' }); await p.waitForSelector(`#panel-${tab}`); await p.locator(`#panel-${tab} .lk-btn`).first().click(); }
      await p.goto(base + 'labs/workflow/', { waitUntil: 'domcontentloaded' }); await p.selectOption('#sampleSelect', 'loopCounter'); await p.click('#btnRunAllSim'); assert.match(await p.locator('#simContextContainer').innerText(), /"total": 10/);
    } finally { await startServer(); }
    await closeCtx(c);
  });
  await check('privacy: labs make no third-party requests', async () => {
    const c = await ctxFor({ w: 1280, h: 900 }); const p = c.page; const external = []; const origin = new URL(base).origin;
    p.on('request', r => { const u = new URL(r.url()); if (u.origin !== origin && /^https?:/.test(r.url()) && !/pagead|googlesyndication/.test(r.url())) external.push(r.url()); });
    for (const [slug] of LABS) await p.goto(base + `labs/${slug}/`, { waitUntil: 'networkidle' }); assert.deepEqual(external, []); await closeCtx(c);
  });
} finally { await browser.close(); if (server) server.close(); }
console.log(`${engine}${live ? ' (live)' : ''}: ${passed} passed, ${failures.length} failed`);
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
