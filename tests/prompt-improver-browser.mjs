/** AI Prompt Improver in a real browser: node tests/prompt-improver-browser.mjs [chromium|firefox|webkit] */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pw = await import(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const engine = process.argv[2] || 'chromium';
const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain' };

// Serve the checkout without the external ad script so the test never leaves localhost.
const server = http.createServer(async (req, res) => {
  try {
    let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (file !== path.resolve(root) && !file.startsWith(root)) { res.writeHead(403).end(); return; }
    if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
    let body = await fs.readFile(file);
    if (file.endsWith('.html')) body = Buffer.from(body.toString().replace(/<script async src="https:\/\/pagead2\.googlesyndication\.com[^>]*><\/script>/g, ''));
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end('Not found'); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await pw[engine].launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
const results = [];
const issues = [];
async function check(name, fn) {
  try { await fn(); results.push(name); console.log('PASS ' + name); }
  catch (e) { issues.push(`${name}: ${e.message}`); console.log('FAIL ' + name + ' — ' + e.message); }
}

async function newPage(width = 1280, height = 900) {
  const context = await browser.newContext({ viewport: { width, height } });
  if (engine === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  const page = await context.newPage();
  page.on('pageerror', (e) => issues.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') issues.push(`console: ${m.text()}`); });
  return page;
}
async function openTool(page) {
  await page.goto(`${base}/?tool=prompt-improver`, { waitUntil: 'domcontentloaded' });
  await page.locator('#piInput').waitFor();
}
// Wait for the debounced re-render that follows typing, not for a stale one.
async function type(page, text) {
  await page.evaluate(() => {
    window.__piObs?.disconnect();
    window.__piRenders = 0;
    window.__piObs = new MutationObserver(() => { window.__piRenders++; });
    window.__piObs.observe(document.getElementById('piResults'), { childList: true, subtree: true });
  });
  await page.locator('#piInput').fill(text);
  await page.waitForFunction(() => window.__piRenders > 0);
  await page.locator('.pi-score').waitFor();
}

const VAGUE = 'write a blog post about productivity and make it good';

const page = await newPage();

await check('catalogue counts the new tool', async () => {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.locator('#toolCatalog .toolcard').first().waitFor();
  const listed = await page.evaluate(() => tools.filter(isListed).length);
  assert.ok(listed >= 50);
  assert.equal(await page.locator('#activeCount').innerText(), String(listed));
  assert.equal(await page.locator('#toolCatalog .toolcard').count(), listed);
  assert.equal(await page.locator('#toolCatalog .toolcard', { hasText: 'AI Prompt Improver' }).count(), 1);
});

await check('deep link opens the workspace with an empty state', async () => {
  await openTool(page);
  assert.match(await page.locator('#workspace h2').innerText(), /AI Prompt Improver/);
  assert.match(await page.locator('#piResults').innerText(), /results appear here/i);
});

await check('textarea is labelled and results are announced politely', async () => {
  assert.equal(await page.getByLabel('Your rough prompt').count(), 1);
  assert.equal(await page.locator('#piResults').getAttribute('aria-live'), 'polite');
});

await check('a vague prompt gets a low score, nine checks and an improved prompt', async () => {
  await type(page, VAGUE);
  const score = Number(await page.locator('.pi-score-num strong').innerText());
  assert.ok(score < 40, `score ${score}`);
  assert.equal(await page.locator('.pi-label').innerText(), 'Needs work');
  assert.equal(await page.locator('.pi-check').count(), 9);
  assert.equal(await page.locator('.pi-meter').getAttribute('aria-valuenow'), String(score));
  assert.equal(await page.locator('.pi-meter').getAttribute('role'), 'meter');
  assert.ok((await page.locator('.pi-chip').allInnerTexts()).includes('good'));
  const improved = await page.locator('#piImproved').innerText();
  assert.ok(improved.includes(VAGUE) && improved.includes('['));
});

await check('failing checks are listed before passing ones', async () => {
  const statuses = await page.locator('.pi-check').evaluateAll((els) => els.map((e) => e.dataset.status));
  const order = { fail: 0, warn: 1, pass: 2 };
  for (let i = 1; i < statuses.length; i++) assert.ok(order[statuses[i - 1]] <= order[statuses[i]], statuses.join());
});

await check('copy button copies the improved prompt', async () => {
  await page.locator('[data-pi-copy]').click();
  await page.waitForFunction(() => document.getElementById('piCopyMsg')?.textContent);
  const msg = await page.locator('#piCopyMsg').innerText();
  if (engine === 'chromium') {
    assert.match(msg, /Copied/);
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await page.locator('#piImproved').innerText());
  } else assert.ok(msg.length > 0);
});

await check('a strong prompt is left alone', async () => {
  await type(page, 'You are a senior product marketer. Write a 300-word launch email for our new budgeting app, aimed at freelancers who struggle with irregular income. Use a friendly, confident tone. Must include one customer quote placeholder and a clear call to action. Format as: subject line, preview text, then body in short paragraphs. Avoid jargon. For example, open with a relatable problem.');
  assert.equal(await page.locator('.pi-label').innerText(), 'Strong');
  assert.equal(await page.locator('#piImproved').count(), 0);
  assert.match(await page.locator('#piResults').innerText(), /nothing to add/i);
});

await check('task type override is applied', async () => {
  await type(page, 'Tell me about my day');
  await page.locator('#piType').selectOption('coding');
  await page.waitForFunction(() => /Coding/.test(document.querySelector('.pi-meta')?.textContent || ''));
});

await check('example button fills the example prompt', async () => {
  await page.locator('#piType').selectOption('auto');
  await page.locator('#piExample').click();
  assert.equal(await page.locator('#piInput').inputValue(), VAGUE);
  await page.locator('.pi-score').waitFor();
});

await check('user text is escaped, never executed', async () => {
  await type(page, '<img src=x onerror="window.__pwned=1"><script>window.__pwned=1</script> write a poem');
  assert.equal(await page.locator('#piResults img').count(), 0);
  assert.equal(await page.locator('#piResults script').count(), 0);
  assert.equal(await page.evaluate(() => window.__pwned), undefined);
  assert.ok((await page.locator('#piImproved').innerText()).includes('<img src=x'));
});

await check('sensitive data is flagged, masked, and links to the redactor', async () => {
  await type(page, 'Summarize this: contact jane.doe@example.com about key sk-abc123def456ghi789jkl012');
  const flag = page.locator('.pi-flag[data-type="sensitive"]');
  await flag.waitFor();
  const text = await flag.innerText();
  assert.ok(!text.includes('jane.doe@example.com') && !text.includes('sk-abc123def456ghi789jkl012'), 'flag leaked the value');
  await flag.locator('[data-open-tool="pii-secret-redactor"]').click();
  await page.waitForFunction(() => /PII/.test(document.querySelector('#workspace h2')?.textContent || ''));
});

await check('draft persists across reloads and Clear removes it', async () => {
  await openTool(page);
  await type(page, VAGUE);
  await page.waitForTimeout(400);
  await openTool(page);
  assert.equal(await page.locator('#piInput').inputValue(), VAGUE);
  await page.locator('#piClear').click();
  assert.equal(await page.locator('#piInput').inputValue(), '');
  assert.equal(await page.evaluate(() => localStorage.getItem('govibetool.prompt-improver')), null);
  await openTool(page);
  assert.equal(await page.locator('#piInput').inputValue(), '');
});

await check('Close hides the workspace', async () => {
  await page.locator('#workspace .workspace-head button', { hasText: 'Close' }).click();
  assert.equal(await page.locator('#workspace.active').count(), 0);
});

await check('standalone page links into the tool', async () => {
  await page.goto(`${base}/tools/prompt-improver.html`, { waitUntil: 'domcontentloaded' });
  assert.match(await page.locator('h1').innerText(), /AI Prompt Improver/);
  assert.match(await page.locator('link[rel="canonical"]').getAttribute('href'), /govibetool\.com\/tools\/prompt-improver\.html$/);
  await page.locator('a.btn', { hasText: 'Use AI Prompt Improver' }).click();
  await page.locator('#piInput').waitFor();
});

const mobile = await newPage(375, 800);
await check('no horizontal overflow on a phone, even with a very long unbroken token', async () => {
  await openTool(mobile);
  await type(mobile, 'a'.repeat(600) + ' write something good');
  const w = await mobile.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  assert.ok(w.sw <= w.cw + 1, `scrollWidth ${w.sw} > ${w.cw}`);
});

await browser.close();
server.close();
console.log(JSON.stringify({ engine, checks: results.length, issues }, null, 2));
if (issues.length) process.exitCode = 1;
