/* V8 combined-integration acceptance (Chromium / Firefox / WebKit).
   Serves a built dist (SITE_ROOT, default ./dist; falls back to the repo root) over a local static server.
   Covers: nine categories, all nine new utilities, the four studios, legacy IDs and deep links,
   favourites / recents, search, keyboard use, desktop + mobile layout and offline loading. No network is required. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
const pw = await import(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const engine = process.argv[2] || 'chromium';
const rootDir = path.resolve(process.env.SITE_ROOT || ((await fs.stat('dist').catch(() => null)) ? 'dist' : '.'));
const out = process.env.V8_INTEGRATION_ARTIFACTS || `artifacts/v8-integration-${engine}`;
await fs.mkdir(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.png': 'image/png', '.txt': 'text/plain' };
let online = true;
const server = http.createServer(async (req, res) => {
  try {
    let f = path.resolve(rootDir, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!f.startsWith(rootDir)) throw Error('path');
    if ((await fs.stat(f)).isDirectory()) f = path.join(f, 'index.html');
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }).end(await fs.readFile(f));
  } catch { res.writeHead(404).end('Not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port=server.address().port;const sockets=new Set();server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
const stopOrigin=()=>new Promise(resolve=>{server.close(resolve);for(const socket of sockets)socket.destroy();});
const startOrigin=()=>new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
const base = `http://127.0.0.1:${port}/`;
const results = []; let browser;
const watchdog = setTimeout(() => { console.error('FAIL watchdog: suite exceeded 240 s'); process.exit(1); }, 240000);
async function check(label, fn) {
  try { await fn(); results.push({ label, ok: true }); console.log('PASS', label); }
  catch (e) { results.push({ label, ok: false, error: e.message }); console.error('FAIL', label, '::', JSON.stringify(String(e.message)).slice(0, 1500), '## RECENT', JSON.stringify(diagLog.filter(x => !/SWDIAG|ERR/.test(x)).slice(-14))); }
}
const NEW_TOOLS = { 'curl-snippets': /cURL/i, 'key-hash': /hash|token|uuid/i, 'regex-playground': /regex/i, 'tailwind-css': /tailwind/i, 'shadow-glass': /shadow|glass/i, 'svg-sanitizer': /svg/i, 'image-metadata-stripper': /metadata|exif/i, 'image-batch-compressor': /compress/i, 'table-converter': /table|markdown/i };
const NINE = ['ai-prompts', 'productivity', 'files-pdf', 'images-design', 'privacy-security', 'developer', 'business-finance', 'writing-text', 'links-web'];
const ready = p => p.waitForFunction(() => typeof openTool === 'function' && typeof tools !== 'undefined' && document.querySelector('.cat-tile'));
const swReady = p => p.evaluate(async () => { if (!('serviceWorker' in navigator)) return; await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise(r => { navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }); setTimeout(r, 8000); }); });
const diagLog = [];
function watch(page, errs) {
  page.on('load', () => diagLog.push(Date.now() + ' LOAD ' + page.url().replace(/^https?:\/\/[^/]+/, '')));
  page.on('domcontentloaded', () => diagLog.push(Date.now() + ' DCL ' + page.url().replace(/^https?:\/\/[^/]+/, '')));
  page.on('framenavigated', f => { if (f === page.mainFrame()) diagLog.push(Date.now() + ' NAV ' + f.url().replace(/^https?:\/\/[^/]+/, '')); });
  page.on('console', m => { const x = m.text(); if (/^SWDIAG/.test(x)) diagLog.push(Date.now() + ' ' + x.slice(0, 170)); else if (m.type() === 'error') diagLog.push(Date.now() + ' ERR ' + x.slice(0, 120)); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR|Failed to load resource|googlesyndication|pagead|adsbygoogle/.test(m.text())) errs.push('console: ' + m.text()); });
}
async function blockAds(ctx) { await ctx.route(/googlesyndication|pagead|gstatic\.com|doubleclick/, r => r.abort()); }

try {
  browser = await pw[engine].launch({ headless: true });
  for (const [label, width, height, mobile] of [['desktop', 1280, 900, false], ['mobile', 375, 740, true]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: mobile, isMobile: mobile && engine !== 'firefox' });
    await blockAds(ctx);
    const page = await ctx.newPage(); page.setDefaultTimeout(15000);
    const errs = []; watch(page, errs);
    await page.goto(base); await ready(page); await swReady(page);
    const tag = s => `${label} ${s}`;

    await check(tag('exactly nine top-level categories, all expected IDs, no extra category'), async () => {
      const ids = await page.locator('.cat-tile').evaluateAll(e => e.map(x => x.dataset.cat));
      assert.deepEqual(ids, NINE);
      assert.equal(await page.locator('[data-cat]').evaluateAll(e => new Set(e.map(x => x.dataset.cat)).size), 9);
    });
    await check(tag('catalogue: all nine new utilities exist, are listed, and every listed tool is in exactly one category'), async () => {
      const r = await page.evaluate(ids => ({ missing: ids.filter(id => !tools.some(t => t[0] === id)), unlisted: ids.filter(id => { const t = tools.find(x => x[0] === id); return t && !isListed(t); }), unique: new Set(tools.map(t => t[0])).size === tools.length }), Object.keys(NEW_TOOLS));
      assert.deepEqual(r.missing, []); assert.deepEqual(r.unlisted, []); assert.ok(r.unique, 'duplicate tool IDs');
      let total = 0;
      for (const id of NINE) { await page.goto(base + '?category=' + id); await page.waitForSelector('#categoryTools .toolcard'); total += await page.locator('#categoryTools .toolcard').count(); }
      assert.equal(total, await page.evaluate(() => tools.filter(isListed).length), 'category totals equal listed tools');
      await page.goto(base); await ready(page);
    });
    for (const [id, heading] of Object.entries(NEW_TOOLS)) {
      await check(tag(`deep link ?tool=${id} opens the utility`), async () => {
        const before = errs.length;
        await page.goto(base + '?tool=' + id); await ready(page);
        await page.waitForSelector('#workspace h2', { state: 'visible' });
        assert.match(await page.locator('#workspace h2').first().innerText(), heading);
        assert.equal(errs.length, before, errs.slice(before).join(' | '));
      });
    }
    await check(tag('new utilities are found by search'), async () => {
      await page.goto(base); await ready(page);
      for (const [q, id] of [['svg sanitizer', 'svg-sanitizer'], ['strip exif', 'image-metadata-stripper'], ['avif', 'image-batch-compressor'], ['markdown table', 'table-converter'], ['regex', 'regex-playground'], ['tailwind', 'tailwind-css'], ['curl to fetch', 'curl-snippets'], ['sha256', 'key-hash'], ['box shadow', 'shadow-glass']]) {
        await page.fill('#toolSearch', q);
        await page.waitForFunction(() => document.querySelectorAll('#toolCatalog .toolcard').length > 0);
        const ids = await page.locator('#toolCatalog .toolcard').evaluateAll(e => e.map(x => x.dataset.tool));
        assert.ok(ids.includes(id), `search "${q}" should find ${id}, got ${ids.slice(0, 6)}`);
      }
      await page.fill('#toolSearch', '');
    });

    /* Studios and legacy IDs */
    const routed = { 'url-cleaner': 'url', 'url-inspector': 'url', 'utm-builder': 'url', 'tracking-check': 'url', 'link-fingerprint': 'url', 'hourly-rate': 'freelance', 'qr-payload': 'qr', metadata: 'privacy' };
    for (const [id, studio] of Object.entries(routed)) {
      await check(tag(`legacy deep link ?tool=${id} lands on the ${studio} studio`), async () => {
        await page.goto(base + '?tool=' + id);
        await page.waitForSelector('#studioRoot');
        assert.equal(new URL(page.url()).searchParams.get('studio'), studio);
        assert.equal(await page.locator(`[data-studio="${studio}"]`).getAttribute('aria-selected'), 'true');
        assert.ok(await page.locator('#studio-' + studio).isVisible());
      });
    }
    for (const [id, re] of [['qr-studio', /QR/i], ['pii-secret-redactor', /PII/i], ['percentage-change', /percent/i]]) {
      await check(tag(`?tool=${id} keeps opening its own full tool (not diverted to a studio)`), async () => {
        await page.goto(base + '?tool=' + id); await ready(page);
        await page.waitForSelector('#workspace h2', { state: 'visible' });
        assert.match(await page.locator('#workspace h2').first().innerText(), re);
        assert.ok(!page.url().includes('studios.html'));
      });
    }
    await check(tag('Prompt Improver "Open PII & Secret Redactor" link still opens the redactor (regression)'), async () => {
      await page.goto(base + '?tool=prompt-improver'); await ready(page);
      await page.waitForSelector('#workspace textarea');
      await page.locator('#workspace textarea').first().fill('Summarize this: contact jane.doe@example.com about key sk-abc123def456ghi789jkl012');
      const btn = page.locator('[data-open-tool="pii-secret-redactor"]');
      await btn.waitFor(); await btn.click();
      await page.waitForFunction(() => /PII/.test(document.querySelector('#workspace h2')?.textContent || ''));
      assert.ok(!page.url().includes('studios.html'));
    });
    await check(tag('studios page has a link on the home footer and returns home'), async () => {
      await page.goto(base); await ready(page);
      await page.locator('footer a[href="studios.html"]').click();
      await page.waitForSelector('#studioRoot');
      await page.locator('a[href="./"]').first().click();
      await page.waitForURL(u => !u.pathname.endsWith('studios.html'));
    });

    await page.goto(base + 'studios.html'); await page.waitForSelector('#studio-url');
    await check(tag('URL & Link Studio: inspects, strips tracking parameters, builds UTM, rejects bad input'), async () => {
      await page.fill('#urlInput', 'https://example.com/a/b?utm_source=x&fbclid=1&keep=2');
      await page.click('#urlAnalyze');
      const t = await page.locator('#urlResult').innerText();
      assert.match(t, /Host: example\.com/); assert.match(t, /Removed trackers: utm_source, fbclid/); assert.match(t, /Clean URL: https:\/\/example\.com\/a\/b\?keep=2/); assert.match(t, /not a safety verdict/);
      await page.locator('#studio-url details summary').click(); await page.fill('#utmSource', 'news'); await page.fill('#utmMedium', 'email'); await page.fill('#utmCampaign', 'launch'); await page.click('#urlUtm');
      assert.match(await page.locator('#urlResult').innerText(), /utm_source=news.*utm_medium=email.*utm_campaign=launch/s);
      await page.fill('#urlInput', 'javascript:alert(1)'); await page.click('#urlAnalyze');
      assert.match(await page.locator('#urlResult').innerText(), /Invalid URL/);
      await page.fill('#urlInput', 'http://user:pw@xn--e1afmkfd.example/'); await page.click('#urlAnalyze');
      const w = await page.locator('#urlResult').innerText(); assert.match(w, /Credentials embedded/); assert.match(w, /Punycode/); assert.match(w, /Unencrypted HTTP/);
    });
    await check(tag('Freelance calculator: correct arithmetic and input validation'), async () => {
      await page.click('[data-studio="freelance"]');
      await page.fill('#target', '100000'); await page.fill('#overhead', '15000'); await page.fill('#hours', '40'); await page.fill('#weeks', '46'); await page.fill('#utilization', '65'); await page.fill('#tax', '0'); await page.fill('#margin', '15'); await page.fill('#quoteHours', '20');
      await page.click('#calcRate');
      const t = await page.locator('#rateResult').innerText();
      const info = JSON.stringify(await page.evaluate(() => ({ url: location.href, ready: document.readyState, controlled: !!navigator.serviceWorker?.controller, values: ['target', 'overhead', 'hours', 'weeks', 'utilization', 'tax', 'margin', 'quoteHours'].map(id => document.getElementById(id)?.value), result: document.getElementById('rateResult')?.textContent })));
      assert.match(t, /Estimated billable hours\/year: 1196\.0/, 'freelance result was ' + JSON.stringify(t) + ' state ' + info); assert.match(t, /Break-even hourly rate: 96\.15/); assert.match(t, /Suggested hourly rate: 113\.12/); assert.match(t, /Quote: 2262\./);
      await page.fill('#utilization', '0'); await page.click('#calcRate');
      assert.match(await page.locator('#rateResult').innerText(), /between|positive|valid/i);
      await page.click('#calcEffective');
      assert.match(await page.locator('#effectiveResult').innerText(), /90\.00/);
      await page.goto(base+'?tool=percentage-change');await ready(page);
      await page.fill('#old', '0');await page.fill('#newv', '5');await page.evaluate(()=>pct());
      assert.match(await page.locator('#out').innerText(), /not defined when the starting value is zero/);
      await page.fill('#old', '100');await page.fill('#newv', '120');await page.evaluate(()=>pct());
      assert.match(await page.locator('#out').innerText(), /20\.00%/);
      await page.goto(base+'studios.html?studio=qr');

    });
    await check(tag('QR Studio v2: plain text valid, malformed URL warned, QR rendered'), async () => {
      await page.click('[data-studio="qr"]');
      await page.selectOption('#qrType','text'); await page.fill('#qrText', 'hello world'); await page.dispatchEvent('#qrText', 'input');
      assert.match(await page.locator('#qrValidation').innerText(), /Plain-text payload/);
      await page.fill('#qrText', 'https://'); await page.dispatchEvent('#qrText', 'input');
      assert.match(await page.locator('#qrValidation').innerText(), /Warning/);
      await page.fill('#qrText', 'https://example.com/ok'); await page.evaluate(()=>generateQR());
      await page.waitForSelector('#qrOutput canvas, #qrOutput img');
      assert.match(await page.locator('#qrValidation').innerText(), /Valid HTTP/);
    });
    await check(tag('PII & Secret Redactor studio: audit leaves text, redact masks, categories respected'), async () => {
      await page.click('[data-studio="privacy"]');
      await page.fill('#redactInput', 'mail jane@example.com call +1 415 555 0100 password=hunter2hunter2');
      await page.selectOption('#piiMode', 'audit'); await page.evaluate(()=>runRedactor());
      let t = await page.locator('#studio-privacy').innerText();
      assert.match(t, /Email: 1/); assert.match(t, /Audit Only/); assert.ok(!/REDACTED/.test(t));
      await page.selectOption('#piiMode', 'redact'); await page.uncheck('[data-pii=phone]'); await page.evaluate(()=>runRedactor());
      t = await page.locator('#studio-privacy').innerText();
      assert.match(t, /\[EMAIL_REDACTED\]/); assert.match(t, /\[API_KEY_REDACTED\]/); assert.ok(t.includes('415 555 0100'), 'unchecked category must stay');
      assert.ok(!t.includes('hunter2hunter2'));
    });
    await check(tag('studios: tabs are keyboard operable and expose correct ARIA state'), async () => {
      await page.goto(base + 'studios.html'); await page.waitForSelector('#studio-url');
      await page.locator('[data-studio="url"]').focus();
      await page.keyboard.press('ArrowRight'); assert.equal(await page.evaluate(() => document.activeElement.dataset.studio), 'freelance');
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('[data-studio="freelance"]').getAttribute('aria-selected'), 'true');
      assert.equal(await page.locator('[data-studio="url"]').getAttribute('aria-selected'), 'false');
      assert.ok(await page.locator('#studio-freelance').isVisible() && !(await page.locator('#studio-url').isVisible()));
      const roles = await page.evaluate(() => ({ tablist: !!document.querySelector('[role=tablist]'), tabs: document.querySelectorAll('[role=tab]').length, panels: document.querySelectorAll('[role=tabpanel]').length }));
      assert.deepEqual(roles, { tablist: true, tabs: 4, panels: 4 });
      const unlabeled = await page.evaluate(() => [...document.querySelectorAll('input,textarea,select')].filter(e => !document.querySelector(`label[for="${e.id}"]`) && !e.closest('label') && !e.getAttribute('aria-label')).map(e => e.id));
      assert.deepEqual(unlabeled, []);
    });
    await check(tag('no horizontal overflow on home, a category, a new utility and studios'), async () => {
      for (const u of ['', '?category=developer', '?tool=table-converter', 'studios.html', 'studios.html?studio=freelance']) {
        await page.goto(base + u); await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(250);
        const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(o <= 0, `overflow ${o}px at ${u || '/'}`);
      }
    });

    /* Favourites + recents keep working for old, new and studio-routed IDs */
    await check(tag('favourites and recently used survive reload for legacy, new and studio IDs'), async () => {
      await page.goto(base); await ready(page);
      await page.evaluate(() => { localStorage.setItem('it.discovery.favorites', JSON.stringify(['url-cleaner', 'regex-playground', 'hourly-rate', 'svg-sanitizer'])); localStorage.setItem('it.discovery.recent', JSON.stringify(['table-converter', 'qr-studio', 'json-formatter'])); });
      await page.reload(); await ready(page);
      const shelf = await page.locator('#discoveryShelf').innerText();
      for (const name of ['URL Cleaner', 'Regex', 'Effective Hourly Rate', 'SVG']) assert.ok(shelf.includes(name), 'favourites shelf missing ' + name);
      assert.ok(/Recent/i.test(shelf));
      assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('it.discovery.favorites'))).sort(), ['hourly-rate', 'regex-playground', 'svg-sanitizer', 'url-cleaner']);
    });
    await check(tag('no uncaught page errors during home, category and tool navigation'), async () => {
      assert.deepEqual(errs, [], `Uncaught browser errors: ${JSON.stringify(errs)} ## TIMELINE ${diagLog.slice(-70).join(' | ')}`);
    });
    await ctx.close();
  }

  /* Keyboard accessibility on the home page + offline, desktop context */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'allow' });
    await blockAds(ctx);
    const page = await ctx.newPage(); page.setDefaultTimeout(20000);
    await page.goto(base); await ready(page);
    await check('keyboard: skip link, category tile and tool card are reachable and operable', async () => {
      await page.keyboard.press('Tab');
      assert.match(await page.evaluate(() => document.activeElement.className + ' ' + document.activeElement.textContent), /skip/i);
      const tile = page.locator('.cat-tile[data-cat="developer"]'); await tile.focus(); await page.keyboard.press('Enter');
      await page.waitForSelector('#categoryTools .toolcard'); assert.match(page.url(), /category=developer/);
      const card = page.locator('#categoryTools .tool-open, #categoryTools .toolcard button, #categoryTools .toolcard a').first(); await card.focus(); await page.keyboard.press('Enter');
      await page.waitForSelector('#workspace h2', { state: 'visible' });
      await page.keyboard.press('Escape');
    });
    await swReady(page);
    await check('offline: service worker serves home, studios, a developer tool and a file & media tool', async () => {
      await page.goto(base + 'studios.html'); await page.waitForSelector('#studio-url'); await swReady(page);
      await page.goto(base + '?tool=table-converter'); await ready(page);
      const cached = await page.evaluate(async () => { const keys = await caches.keys(); const out = []; for (const k of keys) out.push(...(await (await caches.open(k)).keys()).map(r => new URL(r.url).pathname)); return out; });
      for (const p of ['/studios.html', '/studios.js', '/v8-developer-tools.js', '/tools/file-media/file-media-tools.js', '/index.html']) assert.ok(cached.includes(p), 'not cached: ' + p);
      await stopOrigin();
      try {
        await page.goto(base + 'studios.html?studio=qr'); await page.waitForSelector('#studio-qr', { state: 'visible' });
        await page.selectOption('#qrType','text');await page.fill('#qrText', 'offline text'); await page.evaluate(()=>generateQR()); await page.waitForSelector('#qrOutput canvas, #qrOutput img');
        await page.goto(base + '?tool=regex-playground'); await ready(page);
        assert.match(await page.locator('#workspace h2').first().innerText(), /regex/i);
        await page.goto(base + '?tool=svg-sanitizer'); await ready(page);
        assert.match(await page.locator('#workspace h2').first().innerText(), /svg/i);
        await page.goto(base + '?tool=url-cleaner'); await page.waitForSelector('#studioRoot'); await page.waitForSelector('#studio-url');
      } finally { await startOrigin(); }
    });
    await ctx.close();
  }
} catch (e) {
  results.push({ label: 'Suite setup', ok: false, error: String(e.stack || e) }); console.error('FAIL suite', e.stack || e);
} finally {
  clearTimeout(watchdog);
  if (browser) await browser.close();
  server.close();
  await fs.writeFile(path.join(out, 'results.json'), JSON.stringify({ engine, results }, null, 2));
}
const failed = results.filter(r => !r.ok);
console.log(`\n${engine}: ${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
