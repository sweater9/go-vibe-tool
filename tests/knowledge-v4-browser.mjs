import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PATHS, LEVELS } from '../knowledge/learning-paths.mjs';
const { chromium, firefox, webkit } = await import(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const engine = process.argv[2] || 'chromium';
assert.ok(['chromium', 'firefox', 'webkit'].includes(engine));
const base = process.env.KNOWLEDGE_BASE_URL || 'http://127.0.0.1:8000';
const artifacts = process.env.KNOWLEDGE_ARTIFACTS || '/tmp/intellitools-v4-artifacts';
await fs.mkdir(artifacts, { recursive: true });
const browser = await ({ chromium, firefox, webkit })[engine].launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
const results = [], errors = [];
async function check(name, run) { await run(); results.push(name); console.log('PASS', name); }
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
const panel = page.locator('#kn-v4-learning');
const ready = () => panel.getByRole('status').filter({ hasText: /guides completed/ }).waitFor();
const home = async (query = '') => { await page.goto(base + '/knowledge/' + query); await ready(); };
try {
 await check('all nine paths have ordered valid guides at every level', async () => {
  await home();
  for (const [topic, levels] of Object.entries(PATHS)) for (const level of LEVELS) {
   await panel.getByLabel('Learning subject').selectOption(topic);
   await panel.getByLabel('Learning difficulty').selectOption(level);
   const hrefs = await panel.locator('ol a').evaluateAll(links => links.map(link => new URL(link.href).pathname.split('/').pop().replace('.html','')));
   assert.deepEqual(hrefs, levels[level]);
   assert.equal(await panel.locator('progress').getAttribute('max'), '4');
  }
 });
 await check('search result titles are visible without scrolling at 1280x800 and 375x800', async () => {
  for (const width of [1280, 375]) {
   await page.setViewportSize({ width, height: 800 });
   await home();
   assert.equal(await page.evaluate(() => scrollY), 0);
   await page.locator('#kn-q').fill('what is rag');
   await page.keyboard.press('Enter');
   await page.locator('#kn-search-results .kn-read').waitFor();
   const title = await page.locator('#kn-search-results h2').first().boundingBox();
   assert.ok(title && title.y >= 0 && title.y + title.height <= 800, `first result title below viewport at ${width}px`);
   assert.equal(await page.evaluate(() => scrollY), 0, 'submitting must not require scrolling');
   assert.equal(await page.evaluate(() => Boolean(document.querySelector('#kn-search-results').compareDocumentPosition(document.querySelector('#kn-v4-learning')) & Node.DOCUMENT_POSITION_FOLLOWING)), true, 'learning panel follows the results');
  }
  await page.setViewportSize({width:1280,height:900});
 });
 await check('search stays usable and path selection preserves q/semantic parameters', async () => {
  await home('?q=What%20is%20an%20LLM%3F&semantic=1');
  await page.locator('#kn-search-results .kn-read').waitFor();
  await panel.getByLabel('Learning subject').selectOption('AI fundamentals');
  await panel.getByLabel('Learning difficulty').selectOption('beginner');
  const url = new URL(page.url()); assert.equal(url.searchParams.get('q'), 'What is an LLM?'); assert.equal(url.searchParams.get('semantic'), '1');
  assert.match(await page.locator('#kn-search-results').innerText(), /Large Language Model/);
 });
 await check('visit, explicit completion, next/previous, resume and reload persistence', async () => {
  await panel.getByRole('link', { name: 'Start learning', exact: true }).click(); await ready();
  assert.match(await panel.innerText(), /0 of 4 guides completed/);
  assert.equal(await page.locator('.kn-path:visible').count(), 0);
  await panel.getByRole('button', { name: 'Mark guide complete', exact: true }).click();
  assert.match(await panel.innerText(), /1 of 4 guides completed/);
  await panel.getByRole('link', { name: 'Next guide', exact: true }).click(); await ready();
  assert.match(page.url(), /generative-ai/);
  assert.match(await panel.innerText(), /Step 2 of 4/);
  await panel.getByRole('link', { name: 'Previous guide', exact: true }).click(); await ready();
  assert.match(page.url(), /what-is-ai/);
  await panel.getByRole('link', { name: 'Back to learning path' }).click(); await ready();
  assert.match(await panel.getByRole('link', { name: 'Resume learning' }).getAttribute('href'), /generative-ai/);
  await page.reload(); await ready(); assert.match(await panel.innerText(), /1 of 4 guides completed/);
  await panel.getByRole('link', { name: 'Resume learning' }).click(); await ready();
  await panel.getByRole('button', { name: 'Mark guide complete', exact: true }).click();
  await panel.getByRole('button', { name: 'Mark as incomplete', exact: true }).click();
  assert.match(await panel.innerText(), /1 of 4 guides completed/);
 });
 await check('new browser page restores selection/progress and tabs synchronize', async () => {
  const tab = await context.newPage(); await tab.goto(base + '/knowledge/');
  await tab.locator('#kn-v4-learning').getByRole('status').filter({hasText:/1 of 4/}).waitFor();
  assert.equal(await tab.getByLabel('Learning subject').inputValue(), 'AI fundamentals');
  await panel.getByRole('button', { name: 'Mark guide complete', exact: true }).click();
  await tab.locator('#kn-v4-learning').getByRole('status').filter({hasText:/2 of 4/}).waitFor();
  await tab.close();
 });
 await check('path reset requires confirmation; cancel preserves progress; reset is isolated', async () => {
  await home();
  await panel.getByRole('button', { name: 'Reset this path', exact: true }).click();
  await panel.getByRole('button', { name: 'Cancel reset' }).click();
  assert.match(await panel.innerText(), /2 of 4 guides completed/);
  await panel.getByLabel('Learning difficulty').selectOption('advanced');
  await panel.getByRole('link', { name: 'Start learning' }).click(); await ready();
  await panel.getByRole('button', { name: 'Mark guide complete', exact: true }).click();
  await home();
  await panel.getByLabel('Learning difficulty').selectOption('beginner');
  await panel.getByRole('button', { name: 'Reset this path', exact: true }).click();
  await panel.getByRole('button', { name: 'Confirm reset of this path' }).click();
  assert.match(await panel.innerText(), /0 of 4 guides completed/);
  await panel.getByLabel('Learning difficulty').selectOption('advanced');
  assert.match(await panel.innerText(), /1 of 4 guides completed/);
 });
 await check('all steps completed provides review and no misleading resume', async () => {
  await home('?learn=AI+fundamentals&level=intermediate');
  await panel.getByRole('link', { name: 'Start learning' }).click(); await ready();
  for (let i=0;i<4;i++) {
   await panel.getByRole('button', {name:'Mark guide complete',exact:true}).click();
   if (i<3) { await panel.getByRole('link',{name:'Next guide',exact:true}).click(); await ready(); }
  }
  assert.match(await panel.innerText(), /Path complete!/);
  await panel.getByRole('link',{name:'Back to learning path'}).click(); await ready();
  assert.equal(await panel.getByRole('link',{name:'Resume learning'}).count(),0);
  await panel.getByRole('link',{name:'Review from the start'}).waitFor();
 });
 await check('desktop/mobile screenshots and no horizontal overflow at 320, 375, 768, 1280px', async () => {
  await home('?learn=Build+AI+agents&level=beginner');
  for (const width of [320,375,768,1280]) {
   await page.setViewportSize({width,height:900});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1), false, `overflow at ${width}px`);
   await panel.screenshot({style:'header{visibility:hidden!important}',path:`${artifacts}/${engine}-learning-${width}.png`});
  }
  await panel.getByRole('link',{name:'Start learning'}).click(); await ready();
  await page.setViewportSize({width:375,height:900});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await panel.screenshot({style:'header{visibility:hidden!important}',path:`${artifacts}/${engine}-article-375.png`});
 });
 await check('keyboard completion keeps focus and announces progress', async () => {
  const button = panel.getByRole('button', {name:'Mark guide complete',exact:true});
  await button.focus(); await page.keyboard.press('Enter');
  assert.equal(await panel.getByRole('button',{name:'Mark as incomplete',exact:true}).evaluate(el=>el===document.activeElement),true);
  assert.match(await panel.getByRole('status').innerText(),/1 of 4/);
 });
 if (process.env.AXE_PACKAGE) await check('learning panel has no automated accessibility violations', async () => {
  const { default: AxeBuilder } = await import(process.env.AXE_PACKAGE);
  const report = await new AxeBuilder({page}).include('#kn-v4-learning').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  await fs.writeFile(`${artifacts}/${engine}-accessibility.json`, JSON.stringify(report,null,2));
  assert.deepEqual(report.violations.map(v=>({id:v.id,description:v.description,nodes:v.nodes.map(n=>n.target)})),[]);
 });
 await check('invalid URL context never activates article controls', async () => {
  await page.goto(base+'/knowledge/large-language-models.html?learn=__proto__&level=beginner');
  assert.equal(await panel.count(),0); assert.ok(await page.locator('.kn-path:visible').count()>0);
 });
 await check('blocked storage discloses fallback and retains in-page progress', async () => {
  const blocked = await browser.newContext();
  await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('blocked');}}));
  const p=await blocked.newPage();
  await p.goto(base+'/knowledge/what-is-ai.html?learn=AI+fundamentals&level=beginner');
  await p.getByRole('button',{name:'Mark guide complete',exact:true}).click();
  assert.match(await p.locator('#kn-v4-learning').innerText(),/1 of 4 guides completed/);
  assert.match(await p.locator('#kn-v4-learning').innerText(),/will not be saved/);
  await blocked.close();
 });
 await check('corrupt storage recovers and learning asset failure remains readable', async () => {
  const c=await browser.newContext(); await c.addInitScript(()=>localStorage.setItem('intellitools.knowledge.learning.v4','invalid JSON'));
  const p=await c.newPage(); await p.goto(base+'/knowledge/');
  await p.locator('#kn-v4-learning').getByRole('status').filter({hasText:/0 of 4/}).waitFor();
  await p.route('**/search-index.json',route=>route.fulfill({status:503,body:'unavailable'}));
  await p.goto(base+'/knowledge/large-language-models.html?learn=AI+fundamentals&level=beginner');
  await p.locator('#kn-v4-learning').getByRole('status').filter({hasText:/could not be loaded/}).waitFor();
  assert.ok(await p.locator('.kn-article').isVisible()); assert.ok(await p.locator('.kn-path:visible').count()>0);
  await c.close();
 });
 await check('partial index preserves article navigation fallback', async () => {
  const c=await browser.newContext(); const p=await c.newPage();
  await p.route('**/search-index.json',async route=>{
   const response=await route.fetch(); const index=await response.json();
   index.pages=index.pages.filter(page=>page.id!=='what-is-ai');
   await route.fulfill({response,json:index});
  });
  await p.goto(base+'/knowledge/large-language-models.html?learn=AI+fundamentals&level=beginner');
  await p.locator('#kn-v4-learning').getByRole('status').filter({hasText:/unavailable guides/}).waitFor();
  assert.ok(await p.locator('.kn-path:visible').count()>0);
  assert.equal(await p.getByRole('button',{name:'Mark guide complete',exact:true}).count(),0);
  await c.close();
 });
 await check('without JavaScript guides and legacy paths remain usable', async () => {
  const c=await browser.newContext({javaScriptEnabled:false}); const p=await c.newPage();
  await p.goto(base+'/knowledge/'); assert.ok(await p.locator('.kn-pathcard a').count()>0);
  await p.goto(base+'/knowledge/what-is-ai.html'); assert.ok(await p.locator('.kn-article').isVisible()); await c.close();
 });
 assert.deepEqual(errors, [], 'unexpected browser JavaScript errors');
} finally {
 await fs.writeFile(`${artifacts}/${engine}-results.json`,JSON.stringify({engine,passed:results.length,checks:results,errors},null,2));
 await browser.close();
}
console.log(`${engine}: ${results.length} browser scenarios passed`);
