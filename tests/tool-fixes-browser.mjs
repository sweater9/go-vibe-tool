/** Regression checks for tool fixes: node tests/tool-fixes-browser.mjs [chromium|firefox|webkit] */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const pw = await import(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const engine = process.argv[2] || 'chromium';
const root = process.env.SITE_ROOT ? path.resolve(process.env.SITE_ROOT) + '/' : fileURLToPath(new URL('../', import.meta.url)); // SITE_ROOT=dist runs the suite against the built output
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  try {
    let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!file.startsWith(root.replace(/\/$/, ''))) { res.writeHead(403).end(); return; }
    if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
    let body = await fs.readFile(file);
    if (file.endsWith('.html')) body = Buffer.from(body.toString().replace(/<script async src="https:\/\/pagead2\.googlesyndication\.com[^>]*><\/script>/g, ''));
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end('Not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await pw[engine].launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let n = 0;
async function check(name, fn) { try { await fn(); n++; console.log('PASS ' + name); } catch (e) { errors.push(`${name}: ${e.message}`); console.log('FAIL ' + name + ' — ' + e.message); } }

await check('Decision Matrix scores comma-separated criteria without crashing', async () => {
  await page.goto(`${base}/?tool=decision-matrix`, { waitUntil: 'domcontentloaded' });
  await page.locator('#v').waitFor();
  await page.locator('#workspace button.btn', { hasText: /calculate|score|compare|run/i }).first().click();
  const out = await page.locator('#out .result').innerText();
  assert.match(out, /Option A: 8\.00/);
  assert.match(out, /Option B: 6\.63/);
  assert.match(out, /Criteria used: 2/);
});
await check('form controls in tools.js are labelled', async () => {
  for (const id of ['json-formatter', 'case-converter', 'text-compare', 'decision-matrix']) {
    await page.goto(`${base}/?tool=${id}`, { waitUntil: 'domcontentloaded' });
    await page.locator('#workspace textarea, #workspace input').first().waitFor();
    const bad = await page.evaluate(() => [...document.querySelectorAll('#workspace textarea, #workspace select, #workspace input')].filter((e) => !e.labels.length && !e.getAttribute('aria-label')).length);
    assert.equal(bad, 0, id);
  }
});
await browser.close(); server.close();
console.log(JSON.stringify({ engine, checks: n, errors }, null, 2));
if (errors.length) process.exitCode = 1;
