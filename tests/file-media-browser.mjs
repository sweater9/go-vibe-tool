/* Browser tests for the V8 file & media tools: SVG Sanitizer & Optimizer, Image Metadata Stripper, WebP/AVIF Batch Compressor,
   Markdown Table <-> CSV/Sheets Converter, plus category integrity, accessibility, mobile layout and offline behaviour.
   node tests/file-media-browser.mjs [chromium|firefox|webkit]   env: PLAYWRIGHT_PACKAGE, SITE_ROOT (e.g. dist), FM_ARTIFACTS */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as F from './helpers/file-media-fixtures.mjs';
const require = createRequire(import.meta.url);
const I = require('../tools/file-media/fm-image.js');
const pw = await import(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const engine = process.argv[2] || 'chromium';
const repo = fileURLToPath(new URL('../', import.meta.url));
const root = process.env.SITE_ROOT ? path.resolve(process.env.SITE_ROOT) + '/' : repo;
const artifacts = process.env.FM_ARTIFACTS || `artifacts/file-media-${engine}`;
await fs.mkdir(artifacts, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain' };
const server = http.createServer(async (req, res) => {
  try {
    let f = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!f.startsWith(path.resolve(root))) throw 0;
    if ((await fs.stat(f)).isDirectory()) f = path.join(f, 'index.html');
    const b = await fs.readFile(f); res.setHeader('Content-Type', TYPES[path.extname(f)] || 'application/octet-stream'); res.end(b);
  } catch { res.statusCode = 404; res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`, origin = new URL(base).origin;
const browser = await pw[engine].launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });

let passed = 0; const failures = [];
async function check(name, fn) {
  try { await fn(); passed++; console.log('PASS', name); }
  catch (e) { failures.push(`${name}: ${String(e.message).split('\n')[0]}`); console.log('FAIL', name, '::', String(e.message).slice(0, 1200)); }
}

/* Ad hosts are the site's own AdSense tag (unmodified, ignored); any OTHER third-party request made while using a tool is a failure. */
const AD_HOST = /(googlesyndication|doubleclick|googleadservices|adtrafficquality|adsbygoogle|(^|\.)google\.com$|^csi\.gstatic\.com$)/;
const isAd = u => AD_HOST.test(u.hostname) || /pagead/i.test(u.href);
async function open({ w = 1280, h = 900, touch = false, init = null, perms = false, noSW = false } = {}) {
  // noSW: with a service worker active, requests for cached/precached files are answered by the worker and network blocking cannot be simulated reliably
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, acceptDownloads: true, ...(noSW ? { serviceWorkers: 'block' } : {}) });
  // clipboard permissions exist only in Chromium; other engines are checked through the on-page status messages and the textarea contents
  if (perms && engine === 'chromium') await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage(); page.setDefaultTimeout(20000);
  const errs = [], external = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message + ' @ ' + String(e.stack || '').split('\n').slice(0, 3).join(' | ').slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error' && !/pagead|googlesyndication|Failed to load resource|ERR_TUNNEL|ERR_INTERNET|ERR_NAME|ERR_FAILED|ERR_BLOCKED/.test(m.text())) errs.push('console: ' + m.text()); });
  page.on('request', r => { let u; try { u = new URL(r.url()); } catch { return; } if (/^https?:$/.test(u.protocol) && u.origin !== origin && !isAd(u) && !external.includes(u.href)) external.push(u.href); });
  await ctx.route('**/*', route => { const u = new URL(route.request().url()); return u.origin === origin || u.protocol === 'blob:' || u.protocol === 'data:' ? route.continue() : route.abort(); });
  return { ctx, page, errs, external };
}
async function openTool(page, id) {
  await page.goto(base + '?tool=' + id);
  await page.waitForSelector('#fmRoot[data-ready]');
  await page.waitForLoadState('networkidle').catch(() => {}); // let the site's own service-worker registration and (blocked) ad tag settle before the next navigation
}
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const bytesOf = async dl => new Uint8Array(await fs.readFile(await dl.path()));
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* images generated by the browser's own canvas encoders, then dressed up with real metadata in Node */
async function genImage(page, { w, h, type = 'image/jpeg', draw, q = 0.92 }) {
  const b64 = await page.evaluate(async ({ w, h, type, draw, q }) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    new Function('x', 'w', 'h', draw)(x, w, h);
    const blob = await new Promise(r => c.toBlob(r, type, q)); if (!blob || blob.type !== type) return null;
    return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
  }, { w, h, type, draw, q });
  return b64 ? F.fromB64(b64) : null;
}
const REDBLUE = 'x.fillStyle="#e00";x.fillRect(0,0,w/2,h);x.fillStyle="#00e";x.fillRect(w/2,0,w/2,h);';
const NOISE = 'let s=7;for(let i=0;i<w*h/16;i++){s=(s*1103515245+12345)&0x7fffffff;x.fillStyle="rgb("+(s&255)+","+((s>>8)&255)+","+((s>>16)&255)+")";x.fillRect((i*17)%w,Math.floor(i*17/w)*4%h,4,4)};x.fillStyle="#fff";x.fillRect(0,0,w/3,h/3);';
const upload = (page, files) => page.setInputFiles('#fmRoot input[type=file]', files);
const asFile = (name, mimeType, bytes) => ({ name, mimeType, buffer: Buffer.from(bytes) });
async function pixel(page, bytes, mime, x, y) {
  return page.evaluate(async ({ b64, mime, x, y }) => {
    const img = new Image(); img.src = 'data:' + mime + ';base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    return { w: img.naturalWidth, h: img.naturalHeight, px: Array.from(ctx.getImageData(x, y, 1, 1).data) };
  }, { b64: F.b64(bytes), mime, x, y });
}
function unzip(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength); let e = b.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = [];
  for (let i = 0; i < n; i++) { const crc = dv.getUint32(p + 16, true), size = dv.getUint32(p + 24, true), nl = dv.getUint16(p + 28, true), off = dv.getUint32(p + 42, true); const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nl)); const lnl = dv.getUint16(off + 26, true); const data = b.subarray(off + 30 + lnl, off + 30 + lnl + size); assert.equal(I.crc32(data), crc, 'zip crc ' + name); out.push({ name, data }); p += 46 + nl; }
  return out;
}
const txt = b => new TextDecoder('latin1').decode(b);

/* =========================================================================================================
   Categories, registration, search
   ========================================================================================================= */
const NEW = { 'svg-sanitizer': 'developer', 'image-metadata-stripper': 'privacy-security', 'image-batch-compressor': 'images-design', 'table-converter': 'files-pdf' };
await check('categories: exactly nine top-level categories; every listed tool (old and new) belongs to at least one', async () => {
  const { ctx, page } = await open();
  await page.goto(base); await page.waitForSelector('.cat-tile');
  const tiles = await page.locator('.cat-tile').evaluateAll(a => a.map(x => x.dataset.cat));
  assert.equal(tiles.length, 9, 'tiles: ' + tiles.join(','));
  assert.deepEqual([...tiles].sort(), ['ai-prompts', 'business-finance', 'developer', 'files-pdf', 'images-design', 'links-web', 'privacy-security', 'productivity', 'writing-text']);
  const listed = await page.evaluate(() => tools.filter(isListed).map(t => t[0]));
  const seen = new Set();
  for (const c of tiles) {
    await page.goto(base + '?category=' + c); await page.waitForSelector('#categoryTools .toolcard');
    (await page.locator('#categoryTools .toolcard').evaluateAll(a => a.map(x => x.dataset.tool))).forEach(id => seen.add(id));
  }
  const orphans = listed.filter(id => !seen.has(id)); assert.deepEqual(orphans, [], 'tools without a category: ' + orphans);
  for (const id of Object.keys(NEW)) assert.ok(listed.includes(id), id + ' listed');
  await ctx.close();
});
await check('categories: each new tool shows in exactly its mapped category, counts on the tiles match, no new category was added', async () => {
  const { ctx, page } = await open();
  await page.goto(base); await page.waitForSelector('.cat-tile');
  const counts = {};
  for (const c of await page.locator('.cat-tile').evaluateAll(a => a.map(x => x.dataset.cat))) {
    await page.goto(base + '?category=' + c); await page.waitForSelector('#categoryTools .toolcard');
    const ids = await page.locator('#categoryTools .toolcard').evaluateAll(a => a.map(x => x.dataset.tool)); counts[c] = ids;
    for (const [tool, cat] of Object.entries(NEW)) assert.equal(ids.includes(tool), c === cat, `${tool} in ${c}`);
  }
  await page.goto(base); await page.waitForSelector('.cat-tile');
  for (const [c, ids] of Object.entries(counts)) {
    const label = await page.locator(`.cat-tile[data-cat="${c}"] small`).innerText();
    assert.equal(label, ids.length + (ids.length === 1 ? ' tool' : ' tools'), c);
  }
  await ctx.close();
});
await check('search finds each new tool by its everyday words', async () => {
  const { ctx, page } = await open();
  await page.goto(base); await page.waitForSelector('.cat-tile');
  const want = [['exif', 'image-metadata-stripper'], ['strip location from photo', 'image-metadata-stripper'], ['svg', 'svg-sanitizer'], ['sanitize svg', 'svg-sanitizer'], ['avif', 'image-batch-compressor'], ['webp compress', 'image-batch-compressor'], ['csv markdown', 'table-converter'], ['google sheets', 'table-converter']];
  for (const [q, id] of want) {
    await page.fill('#toolSearch', q); await page.waitForSelector('#toolCatalog .toolcard');
    const ids = await page.locator('#toolCatalog .toolcard').evaluateAll(a => a.map(x => x.dataset.tool));
    assert.ok(ids.includes(id), `"${q}" -> ${ids.slice(0, 8)}`);
  }
  await ctx.close();
});
await check('each tool opens from the catalogue, from ?tool= and from its category page; Close works', async () => {
  const { ctx, page, errs } = await open();
  for (const [id, cat] of Object.entries(NEW)) {
    await page.goto(base + '?category=' + cat); await page.waitForSelector(`#categoryTools [data-open="${id}"]`);
    await page.click(`#categoryTools [data-open="${id}"]`); await page.waitForSelector('#fmRoot[data-ready]');
    assert.equal(await page.getAttribute('#fmRoot', 'data-tool'), id);
    await page.click('#workspace .workspace-head .btn'); assert.equal(await page.evaluate(() => document.querySelector('#workspace').classList.contains('active')), false);
    await page.waitForLoadState('networkidle').catch(() => {});
  }
  assert.deepEqual(errs, []); await ctx.close();
});

/* =========================================================================================================
   D. SVG Sanitizer & Optimizer
   ========================================================================================================= */
const P = 'parent.__pwned=';
const EV = 'https://evil.example/';
const CORPUS = [
  { name: 'script element', svg: `<svg xmlns="http://www.w3.org/2000/svg"><script>${P}1</script><rect width="5" height="5"/></svg>`, control: true },
  { name: 'onload on root', svg: `<svg xmlns="http://www.w3.org/2000/svg" onload="${P}2"><rect width="5" height="5"/></svg>`, control: true },
  { name: 'event handlers (mixed case, many events)', svg: `<svg xmlns="http://www.w3.org/2000/svg"><rect width="5" height="5" onClick="${P}3" ONMOUSEOVER="${P}4" onfocus="${P}5" onbegin="${P}6"/></svg>` },
  { name: 'javascript: href', svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><a xlink:href="javascript:${P}7"><text>x</text></a></svg>` },
  { name: 'javascript: href with tab/newline/control obfuscation', svg: `<svg xmlns="http://www.w3.org/2000/svg"><a href="jav&#x09;ascr&#x0A;ipt:${P}8"><text>x</text></a><a href="&#106;avascript:${P}9"><text>y</text></a><a href="&#x20;&#x09;JaVaScRiPt&#x3A;${P}10"><text>z</text></a></svg>` },
  { name: 'vbscript and data:text/html hrefs', svg: `<svg xmlns="http://www.w3.org/2000/svg"><a href="vbscript:msgbox(1)"><text>x</text></a><a href="data:text/html,&lt;script&gt;${P}11&lt;/script&gt;"><text>y</text></a></svg>` },
  { name: 'foreignObject with HTML script and iframe', svg: `<svg xmlns="http://www.w3.org/2000/svg"><foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml"><script>${P}12</script><iframe src="${EV}f"></iframe><img src="${EV}p.png" onerror="${P}13"/></div></foreignObject></svg>` },
  { name: 'XHTML elements outside foreignObject', svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:h="http://www.w3.org/1999/xhtml"><h:script>${P}14</h:script><h:img src="${EV}x.png"/></svg>` },
  { name: 'prefixed SVG-namespace script', svg: `<svg:svg xmlns:svg="http://www.w3.org/2000/svg"><svg:script>${P}15</svg:script></svg:svg>` },
  { name: 'external <use> and data:svg <use>', svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use href="${EV}x.svg#a"/><use xlink:href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cscript%3E${P}16%3C/script%3E%3C/svg%3E#a"/></svg>` },
  { name: 'animate/set that retarget href or handlers', svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:q="http://www.w3.org/1999/xlink"><a href="#"><text>x</text><animate attributeName="href" values="javascript:${P}17"/><set attributeName="xlink:href" to="javascript:${P}18"/><set attributeName="q:href" to="javascript:${P}19"/></a><rect width="5" height="5"><set attributeName="onmouseover" to="${P}20" begin="0s"/><animate attributeName="style" values="background:url(${EV}s)"/></rect></svg>` },
  { name: 'style element with @import, url(), expression(), behavior, escapes', svg: `<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(${EV}a.css); rect{fill:red;background:url(${EV}b.png)} circle{width:expression(${P}21);behavior:url(x.htc);-moz-binding:url(${EV}x.xml#y)} g{fill:u\\72l(${EV}c)} @font-face{src:url(${EV}f.woff)}</style><rect width="5" height="5"/></svg>` },
  { name: 'style element CDATA that tries to break out', svg: `<svg xmlns="http://www.w3.org/2000/svg"><style><![CDATA[ rect{fill:blue} </style><script>${P}22</script><style> ]]></style><rect width="5" height="5"/></svg>` },
  { name: 'style attribute and presentation attributes with external urls', svg: `<svg xmlns="http://www.w3.org/2000/svg"><rect width="5" height="5" style="fill:url(${EV}a);cursor:url(${EV}c.cur),auto" fill="url(${EV}b#x)" filter="url(${EV}f.svg#blur)" clip-path="url('${EV}c')"/></svg>` },
  { name: 'external image (tracking pixel) and feImage', svg: `<svg xmlns="http://www.w3.org/2000/svg"><image href="${EV}pixel.gif" width="1" height="1"/><filter id="f"><feImage href="${EV}fx.png"/></filter></svg>` },
  { name: 'data:image/svg+xml image carrying a script', svg: `<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" onload="${P}23"/>`).toString('base64')}" width="5" height="5"/></svg>` },
  { name: 'processing instruction stylesheet', svg: `<?xml version="1.0"?><?xml-stylesheet href="${EV}s.css" type="text/css"?><svg xmlns="http://www.w3.org/2000/svg"><rect width="5" height="5"/></svg>` },
  { name: 'unknown / editor namespaced content', svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns:evil="${EV}ns" evil:onload="${P}24" sodipodi:docname="secret-name.svg"><sodipodi:namedview pagecolor="#fff"/><evil:payload>${P}25</evil:payload><rect width="5" height="5"/></svg>` },
  { name: 'listener/handler elements and a bogus attribute', svg: `<svg xmlns="http://www.w3.org/2000/svg"><handler type="application/ecmascript">${P}26</handler><listener event="click" handler="#h"/><rect width="5" height="5" bogus-attr="${P}27" data-ok="kept"/></svg>` },
  { name: 'uppercase / odd-case element names', svg: `<svg xmlns="http://www.w3.org/2000/svg"><SCRIPT>${P}28</SCRIPT><Script>${P}29</Script><rect width="5" height="5"/></svg>` },
  { name: 'text content that merely mentions script', svg: `<svg xmlns="http://www.w3.org/2000/svg"><text x="1" y="9">alert(1) and &lt;script&gt; are just words</text></svg>`, benignText: true }
];
const FORBIDDEN = /(<script|javascript:|vbscript:|\bon[a-z]+\s*=|foreignobject|<iframe|evil\.example|__pwned|@import|expression\s*\(|behavior|-moz-binding|xml-stylesheet|<handler|<listener|data:text\/html|data:image\/svg)/i;

async function runCorpus(page, svg, opts = {}) { return page.evaluate(async ({ svg, opts }) => { const r = await GVTSvg.process(svg, opts); return { ok: r.ok, error: r.error, out: r.optimized, san: r.sanitized, verified: r.verified, removed: r.removed, warnings: r.warnings, problems: r.ok ? GVTSvg.verifyClean(r.optimized, opts) : null }; }, { svg, opts }); }
async function execute(page, svgText, how) {
  // load the SVG the way an attacker's target would: as a standalone document (iframe) and inlined into HTML; report whether anything ran
  return page.evaluate(async ({ svgText, how }) => {
    window.__pwned = 0; const frame = document.createElement('iframe'); frame.style.cssText = 'width:50px;height:50px';
    if (how === 'iframe') { frame.src = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' })); document.body.appendChild(frame); }
    else { const d = document.createElement('div'); d.id = 'inl'; d.innerHTML = svgText.replace(/^<\?xml[^>]*>/, ''); document.body.appendChild(d); }
    await new Promise(r => setTimeout(r, 600));
    const el = document.querySelector('#inl svg'); if (el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); el.querySelectorAll('*').forEach(n => ['click', 'mouseover', 'focus'].forEach(t => n.dispatchEvent(new Event(t, { bubbles: true })))); await new Promise(r => setTimeout(r, 100)); }
    const out = window.__pwned; frame.remove(); document.querySelector('#inl')?.remove(); return out;
  }, { svgText, how });
}

await check('SVG harness self-check: the unsanitised script/onload payloads DO run when loaded as a standalone document (so a clean result is meaningful)', async () => {
  const { ctx, page } = await open(); await openTool(page, 'svg-sanitizer');
  for (const c of CORPUS.filter(x => x.control)) assert.ok(await execute(page, c.svg, 'iframe') > 0, 'control payload did not execute: ' + c.name);
  await ctx.close();
});
await check('SVG security corpus: every malicious sample is neutralised (structure, text, verifier, and nothing runs or loads when embedded)', async () => {
  const { ctx, page, errs, external } = await open(); await openTool(page, 'svg-sanitizer');
  const log = [];
  for (const c of CORPUS) {
    const r = await runCorpus(page, c.svg);
    assert.equal(r.ok, true, `${c.name}: ${r.error}`);
    assert.deepEqual(r.problems, [], `${c.name}: verifier problems`);
    assert.doesNotMatch(r.out, FORBIDDEN, `${c.name}: forbidden content survived:\n${r.out}`);
    assert.doesNotMatch(r.san, FORBIDDEN, `${c.name}: forbidden content survived sanitising:\n${r.san}`);
    assert.equal(r.verified, true, c.name);
    for (const how of ['iframe', 'inline']) assert.equal(await execute(page, r.out, how), 0, `${c.name}: code ran when ${how}`);
    if (!c.benignText) assert.ok(r.removed.length > 0, `${c.name}: nothing was reported as removed`);
    log.push(c.name);
  }
  assert.equal(log.length, CORPUS.length);
  assert.deepEqual(external, [], 'sanitising or embedding made third-party requests: ' + external.join(', '));
  assert.deepEqual(errs, []);
  await ctx.close();
});
await check('SVG: attacker-controlled output of the sanitiser is stable (sanitising twice changes nothing) and benign text/data attributes are kept', async () => {
  const { ctx, page } = await open(); await openTool(page, 'svg-sanitizer');
  for (const c of CORPUS) {
    const a = await runCorpus(page, c.svg, { optimize: false }); const b = await runCorpus(page, a.out, { optimize: false });
    assert.equal(b.out, a.out, c.name + ': not idempotent');
  }
  const kept = await runCorpus(page, CORPUS.find(c => c.benignText).svg, { optimize: false }); assert.match(kept.out, /alert\(1\) and &lt;script&gt; are just words/);
  const data = await runCorpus(page, CORPUS.find(c => /bogus/.test(c.svg)).svg, { optimize: false }); assert.match(data.out, /data-ok="kept"/); assert.doesNotMatch(data.out, /bogus-attr/);
  await ctx.close();
});
await check('SVG: strict XML errors, entity bombs, wrong root, huge or deeply nested input are refused with a clear message', async () => {
  const { ctx, page } = await open(); await openTool(page, 'svg-sanitizer');
  const cases = [
    ['<svg xmlns="http://www.w3.org/2000/svg"><rect></svg>', /not well-formed/],
    ['<svg xmlns="http://www.w3.org/2000/svg">&nbsp;</svg>', /not well-formed/],
    ['<!DOCTYPE svg [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">]><svg xmlns="http://www.w3.org/2000/svg"><text>&b;</text></svg>', /entities/],
    ['<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg"><text>&x;</text></svg>', /entities/],
    ['<html xmlns="http://www.w3.org/1999/xhtml"><body/></html>', /root element/],
    ['<svg><rect/></svg>', /root element/],
    ['   ', /Paste or drop/],
    ['<svg xmlns="http://www.w3.org/2000/svg">' + '<g>'.repeat(300) + '</g>'.repeat(300) + '</svg>', /nested more than/],
    ['<svg xmlns="http://www.w3.org/2000/svg">' + '<rect/>'.repeat(60000) + '</svg>', /more than .* nodes/],
    ['<svg xmlns="http://www.w3.org/2000/svg"><text>' + 'x'.repeat(6 * 1024 * 1024) + '</text></svg>', /larger than/]
  ];
  for (const [svg, re] of cases) { const r = await runCorpus(page, svg); assert.equal(r.ok, false, svg.slice(0, 60)); assert.match(r.error, re, svg.slice(0, 60)); }
  const err = await runCorpus(page, '<svg xmlns="http://www.w3.org/2000/svg"><rect></svg>'); assert.match(err.error, /line \d+|near/i);
  await ctx.close();
});
const BENIGN = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="160" height="120" viewBox="0 0 160 120">
  <title>Fidelity test</title><metadata>editor stuff</metadata><!-- c -->
  <defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5500"/><stop offset="1" stop-color="#0044ff"/></linearGradient>
    <radialGradient id="g2"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#000000" stop-opacity=".5"/></radialGradient>
    <clipPath id="cp"><circle cx="110" cy="40" r="28"/></clipPath><filter id="blur"><feGaussianBlur stdDeviation="2"/></filter>
    <pattern id="pt" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#0a0"/></pattern><symbol id="sym" viewBox="0 0 10 10"><path d="M0 0L10 5L0 10Z" fill="#c0c"/></symbol>
    <style>.big{font:bold 14px sans-serif;fill:#102030}</style></defs>
  <rect id="a" x="4" y="4" width="70" height="50" rx="8" fill="url(#g1)" stroke="#000" stroke-width="2.000"/>
  <rect id="a" x="84" y="4" width="70" height="50" fill="url(#g2)" clip-path="url(#cp)"/>
  <circle cx="40" cy="90" r="22" fill="url(#pt)" filter="url(#blur)"/>
  <use href="#sym" x="90" y="70" width="30" height="30"/><use xlink:href="#sym" x="125" y="70" width="30" height="30"/>
  <text class="big" x="6" y="116" inkscape:label="t">Hello &amp; welcome</text>
  <path d="M 10.000 60.000 C 30.0000 70.0000 50.00000 50.00000 70.000 62.000" fill="none" stroke="#333" stroke-linecap="round"/>
</svg>`;
async function render(page, svg) { return page.evaluate(async ({ svg }) => { const img = new Image(); img.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); await img.decode(); const c = document.createElement('canvas'); c.width = 160; c.height = 120; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 160, 120); x.drawImage(img, 0, 0, 160, 120); return Array.from(x.getImageData(0, 0, 160, 120).data); }, { svg }); }
async function pixelDiff(a, b) { let max = 0, bad = 0; for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (d > max) max = d; if (d > 24) bad++; } return { max, bad }; }
await check('SVG fidelity: a rich legitimate SVG renders the same after sanitising and after optimising; duplicate ids are fixed without breaking references; SVGO shrinks it', async () => {
  const { ctx, page } = await open(); await openTool(page, 'svg-sanitizer');
  const orig = await render(page, BENIGN);
  const san = await runCorpus(page, BENIGN, { optimize: false }), opt = await runCorpus(page, BENIGN, {});
  assert.equal(san.ok && opt.ok, true, san.error || opt.error);
  for (const [name, r] of [['sanitised', san], ['optimised', opt]]) { const d = await pixelDiff(orig, await render(page, r.out)); assert.ok(d.bad < 40, `${name} render differs: ${JSON.stringify(d)}`); }
  assert.ok(opt.out.length < BENIGN.length * 0.85, `optimised ${opt.out.length} vs ${BENIGN.length}`);
  assert.doesNotMatch(opt.out, /inkscape|metadata|editor stuff|<!--/);
  const ids = [...san.out.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]); assert.equal(new Set(ids).size, ids.length, 'ids are unique: ' + ids);
  assert.ok(san.warnings.some(w => /duplicate id/.test(w)));
  assert.match(san.out, /url\(#g1\)/); assert.match(san.out, /url\(#cp\)/); assert.match(san.out, /href="#sym"/);
  const noMin = await runCorpus(page, BENIGN, { minifyIds: false, prefixIds: 'pfx' }); assert.match(noMin.out, /id="pfx__/);
  assert.equal((await pixelDiff(orig, await render(page, noMin.out))).bad < 40, true);
  await ctx.close();
});
await check('SVG UI: paste text, paste into box, drop and pick a file; results, size table, safe previews, copy and download', async () => {
  const { ctx, page, errs, external } = await open({ perms: true }); await openTool(page, 'svg-sanitizer');
  // drop zone via file chooser (keyboard)
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.focus('.fm-drop').then(() => page.keyboard.press('Enter'))]);
  await chooser.setFiles(asFile('evil logo.svg', 'image/svg+xml', new TextEncoder().encode(CORPUS[1].svg)));
  await page.waitForSelector('#svgVerified:not(:empty)');
  assert.doesNotMatch(await page.inputValue('#svgOutput'), /onload/);
  assert.match(await page.locator('#svgReport').innerText(), /event handler/);
  // real paste event with text
  // (the event is a plain Event carrying a real DataTransfer: Firefox ignores clipboardData/dataTransfer in the ClipboardEvent/DragEvent constructors, our handlers read the same properties)
  await page.evaluate(svg => { const dt = new DataTransfer(); dt.setData('text/plain', svg); const ev = new Event('paste', { bubbles: true, cancelable: true }); Object.defineProperty(ev, 'clipboardData', { value: dt }); document.querySelector('#fmRoot .fm-drop').dispatchEvent(ev); }, CORPUS[0].svg);
  await page.waitForFunction(() => /<script>/.test(document.querySelector('#svgInput')?.value || '') && /<script> — /.test(document.querySelector('#svgReport')?.innerText || ''));
  assert.match(await page.inputValue('#svgInput'), /<script>/); assert.doesNotMatch(await page.inputValue('#svgOutput'), /script/);
  // drop a file onto the zone
  await page.evaluate(svg => { const dt = new DataTransfer(); dt.items.add(new File([svg], 'dropped.svg', { type: 'image/svg+xml' })); const ev = new Event('drop', { bubbles: true, cancelable: true }); Object.defineProperty(ev, 'dataTransfer', { value: dt }); document.querySelector('#fmRoot .fm-drop').dispatchEvent(ev); }, BENIGN);
  await page.waitForFunction(() => /Fidelity/.test(document.querySelector('#svgOutput')?.value || ''));
  const rows = await page.locator('#svgSizes tbody tr').count(); assert.equal(rows, 3);
  await page.waitForFunction(() => [...document.querySelectorAll('#svgSizes [data-gz]')].every(c => c.textContent !== '…'));
  const imgs = await page.locator('#svgPreviews img').evaluateAll(a => a.map(i => i.src.split(':')[0])); assert.deepEqual(imgs, ['blob', 'blob']);
  assert.equal(await page.locator('#svgPreviews iframe, #svgPreviews svg, #svgPreviews object, #svgPreviews embed').count(), 0, 'previews are plain images only');
  assert.ok(await page.locator('#svgPreviews img').first().evaluate(i => i.naturalWidth > 0), 'preview rendered');
  // download == textarea; copy
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#svgDownload')]);
  assert.equal(new TextDecoder().decode(await bytesOf(dl)), await page.inputValue('#svgOutput')); assert.match(dl.suggestedFilename(), /\.min\.svg$/);
  await page.click('#svgCopy'); await page.waitForFunction(() => /Copied|Copy failed/.test(document.querySelector('#fmRoot .fm-status')?.textContent || ''));
  if (engine === 'chromium') assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await page.inputValue('#svgOutput'));
  // pasting into the code box itself (native text paste path)
  await page.focus('#svgInput'); await page.fill('#svgInput', ''); await page.keyboard.insertText(CORPUS[1].svg);
  await page.waitForFunction(() => /onload/.test(document.querySelector('#svgInput').value) && /event handler/.test(document.querySelector('#svgReport')?.innerText || ''));
  assert.doesNotMatch(await page.inputValue('#svgOutput'), /onload/);
  // errors are announced
  await page.fill('#svgInput', '<svg><oops'); await page.waitForSelector('#svgReport [role=alert]'); assert.match(await page.locator('#svgReport [role=alert]').innerText(), /not well-formed/);
  assert.equal(await page.inputValue('#svgOutput'), '');
  assert.deepEqual(external, []); assert.deepEqual(errs, []); await ctx.close();
});
await check('SVG UI: the unsafe example is flagged in the UI and the page never executes it', async () => {
  const { ctx, page, errs } = await open(); await openTool(page, 'svg-sanitizer');
  const dialogs = []; page.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
  await page.click('#svgExample'); await page.waitForSelector('#svgVerified:not(:empty)');
  const rep = await page.locator('#svgReport').innerText(); for (const w of ['script', 'event handler', 'foreignObject', 'javascript']) assert.match(rep, new RegExp(w, 'i'));
  await sleep(500); assert.deepEqual(dialogs, []); assert.deepEqual(errs, []);
  assert.doesNotMatch(await page.inputValue('#svgOutput'), FORBIDDEN);
  await ctx.close();
});

/* =========================================================================================================
   G. Image Metadata & EXIF Stripper
   ========================================================================================================= */
const FULL_META = [F.exifSegment({ orientation: 1, gps: true }), F.xmpSegment(), F.iptcSegment(), F.iccSegment(), F.commentSegment()];
const SECRETS = ['FixtureCam', 'Privacy-1', 'GVT-test', 'Jane Fixture', 'secret location', 'Photoshop 3.0', 'fake-profile-bytes-for-testing', 'http://ns.adobe.com/xap', 'Exif\0\0'];
async function strip(page, fileSpec, { format, quality } = {}) {
  if (format) await page.selectOption('#stripFormat', format);
  await upload(page, fileSpec);
  await page.waitForSelector('#stripList .fm-item[data-state="done"], #stripList .fm-item[data-state="error"]');
}
await check('Stripper: JPEG with EXIF+GPS, IPTC, XMP, ICC and comment -> the downloaded file has none of them (verified on the real bytes)', async () => {
  const { ctx, page, errs, external } = await open(); await openTool(page, 'image-metadata-stripper');
  const base0 = await genImage(page, { w: 64, h: 48, draw: REDBLUE }); assert.ok(base0, 'browser can encode JPEG');
  const dirty = F.injectJpeg(base0, FULL_META);
  const before = I.scanMetadata(dirty); assert.deepEqual([...new Set(before.found.map(f => f.kind))].sort(), ['COMMENT', 'EXIF', 'ICC', 'IPTC', 'XMP']); assert.equal(before.gps, true);
  assert.ok(SECRETS.every(s => txt(dirty).includes(s)), 'fixture really contains the secrets');
  await strip(page, asFile('holiday.jpg', 'image/jpeg', dirty));
  const card = page.locator('#stripList .fm-item');
  assert.equal(await card.getAttribute('data-state'), 'done');
  assert.deepEqual([...new Set((await card.getAttribute('data-meta-before')).split(','))].sort(), ['COMMENT', 'EXIF', 'ICC', 'IPTC', 'XMP']);
  assert.equal(await card.getAttribute('data-meta-after'), 'none');
  const body = await card.innerText(); assert.match(body, /GPS location/); assert.match(body, /Checked the exported file: no EXIF/);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-dl]')]);
  const out = await bytesOf(dl); assert.match(dl.suggestedFilename(), /^holiday-clean\.jpg$/);
  assert.equal(I.sniffFormat(out), 'jpeg'); const after = I.scanMetadata(out);
  assert.deepEqual(I.personalFindings(after), [], 'structural scan of the real output'); assert.deepEqual(after.signatures, [], 'raw signature scan of the real output');
  const iccOut = I.iccOf(after); if (iccOut) assert.equal(iccOut.standard, true, 'any colour profile left in the output is a standard one: ' + iccOut.detail);
  for (const s of SECRETS) assert.ok(!txt(out).includes(s), 'secret survived: ' + s);
  const px = await pixel(page, out, 'image/jpeg', 8, 24); assert.deepEqual([px.w, px.h], [64, 48]); assert.ok(px.px[0] > 150 && px.px[2] < 100, 'left half still red: ' + px.px);
  assert.deepEqual(external, []); assert.deepEqual(errs, []); await ctx.close();
});
await check('Stripper: PNG with tEXt, iTXt(XMP), eXIf and tIME chunks -> clean PNG', async () => {
  const { ctx, page } = await open(); await openTool(page, 'image-metadata-stripper');
  const png = await genImage(page, { w: 40, h: 30, type: 'image/png', draw: REDBLUE });
  const dirty = F.injectPng(png, [F.pngText('Author', 'Jane Fixture'), F.pngText('Comment', 'secret location'), F.pngXmp(), F.pngExif({ gps: true }), F.pngTime()]);
  assert.deepEqual(I.scanMetadata(dirty).found.map(f => f.kind).sort(), ['EXIF', 'TEXT', 'TEXT', 'TIME', 'XMP']);
  await strip(page, asFile('scan.png', 'image/png', dirty), { format: 'image/png' });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-dl]')]); const out = await bytesOf(dl);
  assert.equal(I.sniffFormat(out), 'png'); assert.deepEqual(I.personalFindings(I.scanMetadata(out)), []); assert.deepEqual(I.scanMetadata(out).signatures, []);
  for (const s of ['Jane Fixture', 'secret location', 'adobe', 'tIME', 'tEXt', 'eXIf']) assert.ok(!txt(out).includes(s), s);
  await ctx.close();
});
await check('Stripper: EXIF orientation is applied to the pixels (6 = rotate 90° clockwise) and no orientation tag is written', async () => {
  const { ctx, page } = await open(); await openTool(page, 'image-metadata-stripper');
  const base0 = await genImage(page, { w: 40, h: 20, draw: REDBLUE });
  for (const [ori, w, h, topRed] of [[6, 20, 40, true], [8, 20, 40, false], [3, 40, 20, null], [1, 40, 20, null]]) {
    const dirty = F.injectJpeg(base0, [F.exifSegment({ orientation: ori, gps: false })]);
    await page.click('#stripClear').catch(() => {}); await strip(page, asFile(`o${ori}.jpg`, 'image/jpeg', dirty));
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-dl]')]); const out = await bytesOf(dl);
    assert.equal(I.scanMetadata(out).orientation, null, 'no orientation tag in output');
    const p1 = await pixel(page, out, 'image/jpeg', Math.floor(w / 2), 2), p2 = await pixel(page, out, 'image/jpeg', Math.floor(w / 2), h - 3);
    assert.deepEqual([p1.w, p1.h], [w, h], `orientation ${ori} output size`);
    if (topRed !== null) { const top = topRed ? p1 : p2, bottom = topRed ? p2 : p1; assert.ok(top.px[0] > 150 && top.px[2] < 100, `ori ${ori}: expected red at the ${topRed ? 'top' : 'bottom'}: ${top.px}`); assert.ok(bottom.px[2] > 150 && bottom.px[0] < 100, `ori ${ori}: expected blue opposite: ${bottom.px}`); }
    if (ori === 3) { const l = await pixel(page, out, 'image/jpeg', 2, 10), r = await pixel(page, out, 'image/jpeg', 37, 10); assert.ok(l.px[2] > 150 && r.px[0] > 150, 'rotated 180°: blue now on the left'); }
  }
  await ctx.close();
});
await check('Stripper: output format and quality options, transparent PNG -> JPEG is flattened onto white with a notice, JPEG quality changes size', async () => {
  const { ctx, page } = await open(); await openTool(page, 'image-metadata-stripper');
  const png = await genImage(page, { w: 32, h: 32, type: 'image/png', draw: 'x.clearRect(0,0,w,h);x.fillStyle="#0a0";x.fillRect(16,16,16,16);' });
  await strip(page, asFile('transparent.png', 'image/png', png), { format: 'image/jpeg' });
  assert.match(await page.locator('#stripList .fm-item').innerText(), /filled with white/);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-dl]')]); const out = await bytesOf(dl);
  const px = await pixel(page, out, 'image/jpeg', 4, 4); assert.ok(px.px[0] > 235 && px.px[1] > 235 && px.px[2] > 235, 'transparent corner became white: ' + px.px);
  await page.selectOption('#stripFormat', 'image/png'); await page.waitForSelector('#stripList .fm-item[data-state="done"]');
  await page.waitForFunction(() => /→ PNG$/.test(document.querySelector('#stripList .fm-meta')?.textContent || ''));
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('[data-dl]')]); const out2 = await bytesOf(dl2); assert.equal(I.sniffFormat(out2), 'png');
  assert.equal(await page.locator('#stripQuality').isDisabled(), true);
  const noise = await genImage(page, { w: 300, h: 200, draw: NOISE });
  await page.selectOption('#stripFormat', 'image/jpeg'); await page.click('#stripClear');
  await page.fill('#stripQuality', '95'); await strip(page, asFile('n.jpg', 'image/jpeg', noise));
  const hi = Number(await page.locator('#stripList .fm-item').getAttribute('data-out-bytes'));
  await page.click('#stripClear'); await page.evaluate(() => { const q = document.querySelector('#stripQuality'); q.value = '50'; q.dispatchEvent(new Event('input', { bubbles: true })); });
  await strip(page, asFile('n.jpg', 'image/jpeg', noise)); const lo = Number(await page.locator('#stripList .fm-item').getAttribute('data-out-bytes'));
  assert.ok(lo < hi, `quality 50 (${lo}) should be smaller than 95 (${hi})`);
  await ctx.close();
});
await check('Stripper: unsupported and broken inputs get clear messages; other files in the batch still work', async () => {
  const { ctx, page, errs } = await open(); await openTool(page, 'image-metadata-stripper');
  const good = await genImage(page, { w: 20, h: 20, draw: REDBLUE });
  await upload(page, [asFile('logo.svg', 'image/svg+xml', new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')), asFile('notes.txt', 'text/plain', new TextEncoder().encode('hello')), asFile('fake.jpg', 'image/jpeg', Uint8Array.from({ length: 300 }, (_, i) => i * 31 & 255)), asFile('ok.jpg', 'image/jpeg', good)]);
  await page.waitForFunction(() => document.querySelectorAll('#stripList .fm-item[data-state="done"], #stripList .fm-item[data-state="error"]').length === 4);
  const states = await page.locator('#stripList .fm-item').evaluateAll(a => a.map(x => [x.getAttribute('aria-label'), x.dataset.state, x.innerText]));
  const by = Object.fromEntries(states.map(([n, s, t]) => [n, { s, t }]));
  assert.equal(by['logo.svg'].s, 'error'); assert.match(by['logo.svg'].t, /SVG Sanitizer/);
  assert.equal(by['notes.txt'].s, 'error'); assert.match(by['notes.txt'].t, /does not look like an image|cannot decode/i);
  assert.equal(by['fake.jpg'].s, 'error'); assert.match(by['fake.jpg'].t, /cannot decode/i);
  assert.equal(by['ok.jpg'].s, 'done');
  assert.ok(await page.locator('#stripList .fm-item [role=alert]').count() >= 3, 'errors are role=alert');
  await ctx.close();
});
await check('Stripper: the pixel-size guard refuses oversized images before allocating a canvas', async () => {
  const { ctx, page } = await open(); await openTool(page, 'image-metadata-stripper');
  const good = await genImage(page, { w: 50, h: 40, draw: REDBLUE });
  await page.evaluate(() => { GVTImage.limits.maxPixels = 1000; });
  await strip(page, asFile('big.jpg', 'image/jpeg', good));
  assert.equal(await page.locator('#stripList .fm-item').getAttribute('data-state'), 'error'); assert.match(await page.locator('#stripList .fm-item').innerText(), /megapixels.*larger than/);
  await ctx.close();
});
await check('Stripper: animated GIF warns about the first frame only; several files can be exported together as a ZIP of clean images', async () => {
  const { ctx, page } = await open(); await openTool(page, 'image-metadata-stripper');
  const frame = [0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x44, 1, 0];
  const gif = Uint8Array.from([...new TextEncoder().encode('GIF89a'), 1, 0, 1, 0, 0x80, 0, 0, 255, 0, 0, 0, 0, 255, 0x21, 0xfe, 5, ...new TextEncoder().encode('hello'), 0, ...frame, ...frame, 0x3b]);
  const a = F.injectJpeg(await genImage(page, { w: 30, h: 30, draw: REDBLUE }), FULL_META), b = F.injectPng(await genImage(page, { w: 30, h: 30, type: 'image/png', draw: REDBLUE }), [F.pngText('Author', 'Jane Fixture')]);
  await upload(page, [asFile('a.jpg', 'image/jpeg', a), asFile('b.png', 'image/png', b), asFile('anim.gif', 'image/gif', gif)]);
  await page.waitForFunction(() => document.querySelectorAll('#stripList .fm-item[data-state="done"], #stripList .fm-item[data-state="error"]').length === 3);
  const gifCard = page.locator('#stripList .fm-item[aria-label="anim.gif"]'); assert.equal(await gifCard.getAttribute('data-state'), 'done'); assert.match(await gifCard.innerText(), /only the first frame/);
  assert.equal(await gifCard.getAttribute('data-meta-before'), 'COMMENT');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#stripZip')]); const files = unzip(await bytesOf(dl));
  assert.deepEqual(files.map(f => f.name).sort(), ['a-clean.jpg', 'anim-clean.jpg', 'b-clean.jpg']);
  for (const f of files) { assert.deepEqual(I.personalFindings(I.scanMetadata(f.data)), [], f.name); assert.ok(!txt(f.data).includes('Jane Fixture'), f.name); }
  await ctx.close();
});

/* =========================================================================================================
   H. WebP / AVIF Batch Image Compressor
   ========================================================================================================= */
async function compress(page, files, { format, quality, maxW, maxH, skip } = {}) {
  await page.waitForFunction(() => document.querySelector('#cmpCaps')?.dataset.caps);
  if (format) await page.selectOption('#cmpFormat', format);
  if (quality != null) await page.evaluate(q => { const e = document.querySelector('#cmpQuality'); e.value = q; e.dispatchEvent(new Event('input', { bubbles: true })); }, String(quality));
  if (maxW || maxH) { await page.check('#cmpResize'); if (maxW) await page.fill('#cmpMaxW', String(maxW)); if (maxH) await page.fill('#cmpMaxH', String(maxH)); }
  if (skip != null) await (skip ? page.check('#cmpSkip') : page.uncheck('#cmpSkip'));
  await upload(page, files);
  await page.click('#cmpGo');
  await page.waitForFunction(n => document.querySelectorAll('#cmpList .fm-item[data-state="done"], #cmpList .fm-item[data-state="error"]').length === n && !document.querySelector('#cmpList .fm-item[data-state="working"]') && document.querySelector('#cmpGo') && !document.querySelector('#cmpGo').disabled, Array.isArray(files) ? files.length : 1, { timeout: 90000 });
}
const itemInfo = (page, i = 0) => page.locator('#cmpList .fm-item').nth(i).evaluate(e => ({ name: e.getAttribute('aria-label'), state: e.dataset.state, orig: Number(e.dataset.originalBytes), out: Number(e.dataset.outputBytes), type: e.dataset.outputType, kept: e.dataset.kept, text: e.innerText }));
async function downloadOf(page, i = 0) { const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#cmpList [data-dl]').nth(i).click()]); return { bytes: await bytesOf(dl), name: dl.suggestedFilename() }; }

await check('Compressor: runtime encoder detection lists what this browser can really encode', async () => {
  const { ctx, page } = await open(); await openTool(page, 'image-batch-compressor');
  await page.waitForFunction(() => document.querySelector('#cmpCaps')?.dataset.caps);
  const caps = (await page.getAttribute('#cmpCaps', 'data-caps')).split(','); assert.ok(caps.includes('JPEG') && caps.includes('PNG'), caps.join());
  const real = await page.evaluate(async () => { const e = await GVTImage.detectEncoders(); const c = document.createElement('canvas'); c.width = c.height = 4; const out = {}; for (const m of ['image/webp', 'image/avif']) out[m] = await new Promise(r => c.toBlob(b => r(!!b && b.type === m), m)); return { e, out }; });
  assert.equal(real.e['image/webp'], real.out['image/webp'], 'WebP detection matches a real encode attempt');
  assert.equal(real.e.avifNative, real.out['image/avif'], 'native AVIF detection matches a real encode attempt');
  assert.equal(caps.includes('WebP'), real.e['image/webp']); assert.equal(caps.includes('AVIF'), real.e['image/avif']);
  console.log(`  ${engine}: WebP native=${real.e['image/webp']}, AVIF native=${real.e.avifNative}, AVIF wasm=${real.e.avifWasm}`);
  await ctx.close();
});
await check('Compressor: WebP output is real WebP (or an explained fallback), smaller than the source, with per-file savings that match the bytes', async () => {
  const { ctx, page, errs, external } = await open(); await openTool(page, 'image-batch-compressor');
  await page.waitForFunction(() => document.querySelector('#cmpCaps')?.dataset.caps);
  const hasWebp = (await page.getAttribute('#cmpCaps', 'data-caps')).includes('WebP');
  const png = await genImage(page, { w: 640, h: 480, type: 'image/png', draw: NOISE });
  await compress(page, asFile('photo.png', 'image/png', png), { format: 'image/webp', quality: 60 });
  const it = await itemInfo(page); assert.equal(it.state, 'done'); assert.equal(it.orig, png.length);
  const { bytes, name } = await downloadOf(page); assert.equal(bytes.length, it.out);
  if (hasWebp) { assert.equal(I.sniffFormat(bytes), 'webp'); assert.equal(name, 'photo.webp'); assert.equal(it.type, 'image/webp'); assert.ok(it.out < it.orig, `${it.out} < ${it.orig}`); }
  else { assert.equal(I.sniffFormat(bytes), 'jpeg'); assert.match(it.text, /WebP is not supported by this browser/); }
  const pct = Math.round((1 - it.out / it.orig) * 1000) / 10; assert.ok(it.text.includes(pct.toFixed(1) + '% smaller') || it.kept === '1', it.text);
  assert.deepEqual(I.personalFindings(I.scanMetadata(bytes)), []);
  assert.match(await page.locator('#cmpTotal').innerText(), /1 file: .* → .* \(.*smaller/);
  assert.deepEqual(external, []); assert.deepEqual(errs, []); await ctx.close();
});
await check('Compressor: AVIF output is a real AVIF file (native encoder or the bundled WebAssembly encoder), decodable where the browser can decode AVIF', async () => {
  const { ctx, page, errs } = await open(); await openTool(page, 'image-batch-compressor');
  await page.waitForFunction(() => document.querySelector('#cmpCaps')?.dataset.caps);
  const caps = await page.evaluate(() => GVTImage.detectEncoders());
  const img = await genImage(page, { w: 320, h: 240, type: 'image/png', draw: NOISE });
  await compress(page, asFile('pic.png', 'image/png', img), { format: 'image/avif', quality: 50 });
  const it = await itemInfo(page); assert.equal(it.state, 'done', it.text);
  const { bytes, name } = await downloadOf(page);
  if (caps['image/avif']) {
    assert.equal(I.sniffFormat(bytes), 'avif', 'bytes are AVIF: ' + txt(bytes.subarray(0, 16))); assert.equal(name, 'pic.avif'); assert.equal(it.type, 'image/avif'); assert.ok(it.out < it.orig, `${it.out} < ${it.orig}`);
    const dec = await page.evaluate(async b64 => { const i = new Image(); i.src = 'data:image/avif;base64,' + b64; try { await i.decode(); return [i.naturalWidth, i.naturalHeight]; } catch { return null; } }, F.b64(bytes));
    if (dec) assert.deepEqual(dec, [320, 240]); else console.log(`  ${engine}: this browser cannot DECODE AVIF, so only the file structure was verified`);
    assert.deepEqual(I.scanMetadata(bytes).signatures, []);
  } else { assert.match(it.text, /AVIF is not supported by this browser/); }
  assert.deepEqual(errs, []); await ctx.close();
});
await check('Compressor: quality slider changes size; resize caps dimensions and never enlarges', async () => {
  const { ctx, page } = await open(); await openTool(page, 'image-batch-compressor');
  const jpg = await genImage(page, { w: 400, h: 300, draw: NOISE, q: 0.95 });
  await compress(page, asFile('n.jpg', 'image/jpeg', jpg), { format: 'image/jpeg', quality: 90, skip: false }); const hi = (await itemInfo(page)).out;
  await page.click('#cmpClear'); await compress(page, asFile('n.jpg', 'image/jpeg', jpg), { quality: 20, skip: false }); const lo = (await itemInfo(page)).out;
  assert.ok(lo < hi, `q20 ${lo} < q90 ${hi}`);
  await page.click('#cmpClear'); await compress(page, asFile('n.jpg', 'image/jpeg', jpg), { maxW: 100, skip: false });
  let d = await downloadOf(page); let px = await pixel(page, d.bytes, 'image/jpeg', 0, 0); assert.deepEqual([px.w, px.h], [100, 75]);
  await page.click('#cmpClear'); await compress(page, asFile('n.jpg', 'image/jpeg', jpg), { maxW: 1000, maxH: 90, skip: false });
  d = await downloadOf(page); px = await pixel(page, d.bytes, 'image/jpeg', 0, 0); assert.deepEqual([px.w, px.h], [120, 90], 'bounded by height; aspect kept');
  await page.fill('#cmpMaxW', '5000'); await page.fill('#cmpMaxH', '5000'); await page.click('#cmpClear'); await compress(page, asFile('n.jpg', 'image/jpeg', jpg), { skip: false });
  d = await downloadOf(page); px = await pixel(page, d.bytes, 'image/jpeg', 0, 0); assert.deepEqual([px.w, px.h], [400, 300], 'not enlarged');
  await ctx.close();
});
await check('Compressor: batch of several files, one bad file does not stop the rest, ZIP export contains the compressed files with unique names, totals are right', async () => {
  const { ctx, page } = await open(); await openTool(page, 'image-batch-compressor');
  const a = await genImage(page, { w: 200, h: 150, type: 'image/png', draw: NOISE }), b = await genImage(page, { w: 160, h: 160, draw: NOISE }), c = F.injectJpeg(await genImage(page, { w: 120, h: 90, draw: NOISE }), FULL_META);
  await compress(page, [asFile('one.png', 'image/png', a), asFile('one.jpg', 'image/jpeg', b), asFile('broken.png', 'image/png', Uint8Array.from({ length: 500 }, (_, i) => i & 255)), asFile('three.jpg', 'image/jpeg', c)], { format: 'image/jpeg', quality: 70, skip: false });
  const infos = []; for (let i = 0; i < 4; i++) infos.push(await itemInfo(page, i));
  assert.deepEqual(infos.map(x => x.state), ['done', 'done', 'error', 'done']); assert.match(infos[2].text, /cannot decode/i);
  const total = await page.locator('#cmpTotal').innerText(); const ok = infos.filter(x => x.state === 'done'); assert.match(total, /3 files/); assert.match(total, /1 failed/);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#cmpZip')]); const files = unzip(await bytesOf(dl));
  assert.deepEqual(files.map(f => f.name), ['one.jpg', 'one (2).jpg', 'three.jpg']);
  files.forEach((f, i) => { assert.equal(I.sniffFormat(f.data), 'jpeg'); assert.equal(f.data.length, ok[i].out); assert.deepEqual(I.personalFindings(I.scanMetadata(f.data)), [], f.name + ' has no metadata'); });
  await ctx.close();
});
await check('Compressor: "keep original if larger" keeps the file and says so; unticked it exports the larger result', async () => {
  const { ctx, page } = await open(); await openTool(page, 'image-batch-compressor');
  const tiny = await genImage(page, { w: 8, h: 8, type: 'image/png', draw: 'x.fillStyle="#123";x.fillRect(0,0,w,h)' });
  await compress(page, asFile('tiny.png', 'image/png', tiny), { format: 'image/png', skip: true });
  let it = await itemInfo(page); assert.equal(it.kept, '1'); assert.match(it.text, /original file is kept/); assert.equal(it.out, tiny.length);
  await page.click('#cmpClear'); const noise = await genImage(page, { w: 64, h: 64, type: 'image/png', draw: NOISE });
  await compress(page, asFile('n.png', 'image/png', noise), { format: 'image/jpeg', quality: 100, skip: false }); it = await itemInfo(page); assert.equal(it.kept, '0'); assert.equal(it.type, 'image/jpeg');
  await ctx.close();
});
await check('Compressor: fallback messaging when a format is unavailable (simulated Safari-style canvas without WebP, and no WebAssembly for AVIF)', async () => {
  const init = () => {
    const orig = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (cb, type, q) { if (type === 'image/webp' || type === 'image/avif') return orig.call(this, cb, 'image/png'); return orig.call(this, cb, type, q); };
    Object.defineProperty(window, 'WebAssembly', { value: undefined, configurable: true });
  };
  const { ctx, page } = await open({ init }); await openTool(page, 'image-batch-compressor');
  await page.waitForFunction(() => document.querySelector('#cmpCaps')?.dataset.caps);
  assert.equal((await page.getAttribute('#cmpCaps', 'data-caps')), 'JPEG,PNG');
  assert.match(await page.locator('#cmpCaps').innerText(), /AVIF encoding is not available here, and WebP is not available either, so JPEG is used/);
  const png = await genImage(page, { w: 100, h: 80, type: 'image/png', draw: NOISE });
  await compress(page, asFile('f.png', 'image/png', png), { format: 'image/webp', skip: false }); let it = await itemInfo(page);
  assert.equal(it.type, 'image/jpeg'); assert.match(it.text, /WebP is not supported by this browser, so JPEG was used instead/);
  await page.click('#cmpClear'); await compress(page, asFile('f.png', 'image/png', png), { format: 'image/avif', skip: false }); it = await itemInfo(page);
  assert.equal(it.type, 'image/jpeg'); assert.match(it.text, /AVIF is not supported by this browser, so JPEG was used instead/);
  assert.match(it.text, /Transparent areas were filled with white/);
  await ctx.close();
});
await check('Compressor: AVIF encoder failure (simulated blocked wasm) falls back to WebP/JPEG with an explanation and the batch continues', async () => {
  const { ctx, page } = await open({ noSW: true }); await openTool(page, 'image-batch-compressor');
  await page.waitForFunction(() => document.querySelector('#cmpCaps')?.dataset.caps);
  const caps = await page.evaluate(() => GVTImage.detectEncoders()); if (!caps.avifWasm) { console.log('  (this browser has no wasm AVIF path; skipped)'); await ctx.close(); return; }
  await ctx.route('**/vendor/avif/avif_enc.*', r => r.abort());
  const png = await genImage(page, { w: 60, h: 50, type: 'image/png', draw: NOISE });
  await compress(page, [asFile('a.png', 'image/png', png), asFile('b.png', 'image/png', png)], { format: 'image/avif', skip: false });
  for (const i of [0, 1]) { const it = await itemInfo(page, i); assert.equal(it.state, 'done', it.text); assert.match(it.text, /AVIF encoding failed/); assert.ok(['image/webp', 'image/jpeg'].includes(it.type)); }
  await ctx.close();
});
await check('Compressor: many files at once complete sequentially without errors (memory-friendly), Stop button appears only while running', async () => {
  const { ctx, page, errs } = await open(); await openTool(page, 'image-batch-compressor');
  const img = await genImage(page, { w: 240, h: 180, draw: NOISE }); const files = Array.from({ length: 12 }, (_, i) => asFile(`img-${i}.jpg`, 'image/jpeg', img));
  assert.equal(await page.locator('#cmpStop').isVisible(), false);
  await page.waitForFunction(() => document.querySelector('#cmpCaps')?.dataset.caps); await upload(page, files); await page.click('#cmpGo');
  await page.waitForSelector('#cmpStop', { state: 'visible', timeout: 5000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelectorAll('#cmpList .fm-item[data-state="done"]').length === 12, null, { timeout: 90000 });
  assert.equal(await page.locator('#cmpStop').isVisible(), false); assert.deepEqual(errs, []);
  await ctx.close();
});

/* =========================================================================================================
   I. Markdown Table <-> CSV / Google Sheets
   ========================================================================================================= */
await check('Table UI: examples convert both ways, preview renders, alignment is honoured, summary is correct', async () => {
  const { ctx, page, errs } = await open(); await openTool(page, 'table-converter');
  await page.click('#tblExCsv'); await page.waitForSelector('#tblSummary');
  assert.match(await page.inputValue('#tblOutput'), /^\| Product +\| Notes +\| Price +\|\n\| -+ \| -+ \| -+ \|/); assert.match(await page.inputValue('#tblOutput'), /Says "hello"/); assert.match(await page.inputValue('#tblOutput'), /Two lines:<br>second line/);
  assert.match(await page.locator('#tblSummary').innerText(), /4 rows × 3 columns · input read as CSV/);
  assert.equal(await page.locator('#tblPreview tbody tr').count(), 3);
  await page.click('#tblExMd'); await page.waitForFunction(() => /markdown/i.test(document.querySelector('#tblSummary')?.textContent || ''));
  const csv = await page.inputValue('#tblOutput'); assert.equal(csv, 'Item,Qty,Price\nApples,3,1.20\nPears | ripe,10,0.80\n"Plums\n(sweet)",2,2.00');
  const aligns = await page.locator('#tblPreview th').evaluateAll(a => a.map(x => x.style.textAlign)); assert.deepEqual(aligns, ['left', 'center', 'right']);
  await page.selectOption('#tblTo', 'tsv'); assert.equal(await page.inputValue('#tblOutput'), 'Item\tQty\tPrice\nApples\t3\t1.20\nPears | ripe\t10\t0.80\n"Plums\n(sweet)"\t2\t2.00');
  assert.deepEqual(errs, []); await ctx.close();
});
await check('Table UI: tab-delimited Google Sheets / Excel clipboard text -> Markdown, and Markdown -> tab text for pasting back; round trip is lossless', async () => {
  const { ctx, page } = await open({ perms: true }); await openTool(page, 'table-converter');
  const sheet = 'City\tNote\tPop\nParis\t"has ""quotes"", commas"\t2161000\nRome\t"two\nlines"\t2873000';
  await page.fill('#tblInput', sheet); await page.waitForSelector('#tblSummary'); assert.match(await page.locator('#tblSummary').innerText(), /tab-delimited/);
  const md = await page.inputValue('#tblOutput'); assert.match(md, /has "quotes", commas/); assert.match(md, /two<br>lines/);
  await page.selectOption('#tblAlign', 'auto'); assert.match((await page.inputValue('#tblOutput')).split('\n')[1], /-: \|$/);
  await page.click('#tblSwap'); await page.selectOption('#tblTo', 'tsv'); assert.equal(await page.inputValue('#tblOutput'), sheet);
  // copy for Sheets copies tab-delimited text regardless of the chosen output format
  await page.selectOption('#tblTo', 'markdown'); await page.click('#tblCopySheets'); await page.waitForFunction(() => /Copied for Google Sheets|Copy failed/.test(document.querySelector('#fmRoot .fm-status')?.textContent || ''));
  if (engine === 'chromium') assert.equal(await page.evaluate(() => navigator.clipboard.readText()), sheet);
  await page.click('#tblCopy'); await page.waitForFunction(() => /^Copied\.|Copy failed/.test(document.querySelector('#fmRoot .fm-status')?.textContent || ''));
  if (engine === 'chromium') assert.match(await page.evaluate(() => navigator.clipboard.readText()), /^\| City/);
  await ctx.close();
});
await check('Table UI: warnings (limitations, formula injection), formula protection, header/padding options, BOM download, bad input messages', async () => {
  const { ctx, page } = await open(); await openTool(page, 'table-converter');
  await page.fill('#tblInput', 'a,b\n=HYPERLINK("http://x"),2\n-5,@x'); await page.selectOption('#tblTo', 'csv'); await page.waitForSelector('#tblSummary');
  assert.match(await page.locator('#tblWarn').innerText(), /2 cells start with = \+ - or @/);
  await page.check('#tblProtect'); assert.match(await page.inputValue('#tblOutput'), /'=HYPERLINK/); assert.match(await page.locator('#tblWarn').innerText(), /leading apostrophe/);
  await page.selectOption('#tblTo', 'markdown'); await page.uncheck('#tblHeader'); assert.match(await page.inputValue('#tblOutput'), /^\| Column 1 /);
  await page.uncheck('#tblPad'); assert.match(await page.inputValue('#tblOutput'), /^\| Column 1 \| Column 2 \|\n\| --- \| --- \|/);
  await page.fill('#tblInput', 'a|b'); await page.selectOption('#tblFrom', 'markdown'); await page.waitForSelector('#tblWarn [role=alert]'); assert.match(await page.locator('#tblWarn').innerText(), /No Markdown table found/);
  await page.selectOption('#tblFrom', 'auto'); await page.fill('#tblInput', 'x,y\n1,é'); await page.selectOption('#tblTo', 'csv'); await page.check('#tblBom');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#tblDownload')]); const b = await bytesOf(dl); assert.deepEqual([...b.slice(0, 3)], [0xef, 0xbb, 0xbf]); assert.equal(dl.suggestedFilename(), 'table.csv');
  assert.match(await page.locator('details summary').innerText(), /Markdown table limitations/);
  assert.match(await page.locator('details').textContent(), /line breaks inside a cell are written as <br>/i);
  await ctx.close();
});
await check('Table UI: cell contents are shown as text (HTML in a cell cannot inject elements) and large tables stay responsive', async () => {
  const { ctx, page, errs } = await open(); await openTool(page, 'table-converter');
  const dialogs = []; page.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
  await page.fill('#tblInput', 'h1,h2\n"<img src=x onerror=alert(1)>","<script>alert(2)</script>"\n"<b>bold</b>",plain'); await page.waitForSelector('#tblSummary');
  assert.equal(await page.locator('#tblPreview img, #tblPreview script, #tblPreview b').count(), 0); assert.match(await page.locator('#tblPreview td').first().innerText(), /<img src=x onerror=alert\(1\)>/);
  const rows = Array.from({ length: 5000 }, (_, i) => `r${i},"v ${i}, x",${i}`).join('\n');
  const t0 = Date.now(); await page.evaluate(v => { const e = document.querySelector('#tblInput'); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, 'a,b,c\n' + rows); await page.waitForFunction(() => /5001 rows/.test(document.querySelector('#tblSummary')?.textContent || '')); assert.ok(Date.now() - t0 < 8000, 'slow: ' + (Date.now() - t0));
  assert.equal(await page.locator('#tblPreview tbody tr').count(), 99); assert.match(await page.locator('#tblSummary').innerText(), /first 100 rows/);
  assert.equal((await page.inputValue('#tblOutput')).split('\n').length, 5002);
  await sleep(300); assert.deepEqual(dialogs, []); assert.deepEqual(errs, []); await ctx.close();
});

/* =========================================================================================================
   Accessibility, layout, privacy, offline
   ========================================================================================================= */
await check('accessibility: every control has an accessible name, errors use role=alert, status regions are live, drop zones are keyboard-operable', async () => {
  const { ctx, page } = await open();
  for (const id of Object.keys(NEW)) {
    await openTool(page, id);
    const bad = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('#fmRoot input:not([type=file]), #fmRoot select, #fmRoot textarea, #fmRoot button').forEach(e => {
        const name = e.getAttribute('aria-label') || (e.labels && [...e.labels].map(l => l.textContent).join('').trim()) || (e.tagName === 'BUTTON' && e.textContent.trim()) || e.getAttribute('aria-labelledby');
        if (!name) out.push(e.outerHTML.slice(0, 100));
      });
      return out;
    });
    assert.deepEqual(bad, [], id + ' unnamed controls');
    assert.ok(await page.locator('#fmRoot [role=status][aria-live=polite]').count() >= 1, id + ' live status region');
    const dz = page.locator('#fmRoot .fm-drop'); if (await dz.count()) { assert.equal(await dz.first().getAttribute('role'), 'button'); assert.equal(await dz.first().getAttribute('tabindex'), '0'); assert.ok((await dz.first().getAttribute('aria-label')).length > 5); }
  }
  await ctx.close();
});
for (const [label, w, h, touch] of [['mobile 375px', 375, 812, true], ['tablet 768px', 768, 900, false], ['desktop 1280px', 1280, 900, false]]) {
  await check(`layout ${label}: no horizontal overflow in any tool, with results showing; tap targets are at least 44px on touch`, async () => {
    const { ctx, page } = await open({ w, h, touch });
    await openTool(page, 'svg-sanitizer'); await page.click('#svgExample'); await page.waitForSelector('#svgVerified:not(:empty)'); assert.ok(await overflow(page) <= 0, 'svg overflow ' + await overflow(page));
    await openTool(page, 'table-converter'); await page.click('#tblExCsv'); await page.waitForSelector('#tblSummary'); assert.ok(await overflow(page) <= 0, 'table overflow ' + await overflow(page));
    await openTool(page, 'image-metadata-stripper'); const jp = F.injectJpeg(await genImage(page, { w: 300, h: 200, draw: REDBLUE }), FULL_META);
    await strip(page, asFile('wide-name-for-overflow-testing-with-a-very-long-file-name-0123456789.jpg', 'image/jpeg', jp)); assert.ok(await overflow(page) <= 0, 'stripper overflow ' + await overflow(page));
    await openTool(page, 'image-batch-compressor'); const jp2 = await genImage(page, { w: 300, h: 200, draw: NOISE });
    await compress(page, asFile('wide-name-for-overflow-testing-with-a-very-long-file-name-0123456789.jpg', 'image/jpeg', jp2), { skip: false }); assert.ok(await overflow(page) <= 0, 'compressor overflow ' + await overflow(page));
    if (touch) {
      const small = await page.evaluate(() => [...document.querySelectorAll('#fmRoot button, #fmRoot select, #fmRoot input:not([type=file]):not([type=checkbox]):not([type=range]), #fmRoot .fm-drop')].filter(e => e.offsetParent).map(e => [e.id || e.className || e.tagName, Math.round(e.getBoundingClientRect().height)]).filter(([, hgt]) => hgt < 44));
      assert.deepEqual(small, [], 'controls under 44px high');
    }
    await page.screenshot({ path: path.join(artifacts, `${label.replace(/\W+/g, '-')}.png`), fullPage: true });
    await ctx.close();
  });
}
await check('privacy: using all four tools sends no data anywhere (only same-origin and blob requests; no third-party except the site\'s own ad tag)', async () => {
  const { ctx, page, external } = await open();
  const seen = [];
  page.on('request', r => { const u = new URL(r.url()); if (u.origin !== origin && !/^(blob|data):$/.test(u.protocol) && !isAd(u)) seen.push(r.method() + ' ' + r.url()); });
  page.on('request', r => { if (r.method() !== 'GET' && new URL(r.url()).origin === origin) seen.push('non-GET to site: ' + r.method() + ' ' + r.url()); });
  await openTool(page, 'svg-sanitizer'); await page.click('#svgExample'); await page.waitForSelector('#svgVerified:not(:empty)');
  await openTool(page, 'table-converter'); await page.click('#tblExCsv'); await page.waitForSelector('#tblSummary');
  await openTool(page, 'image-metadata-stripper'); await strip(page, asFile('p.jpg', 'image/jpeg', F.injectJpeg(await genImage(page, { w: 30, h: 30, draw: REDBLUE }), FULL_META)));
  await openTool(page, 'image-batch-compressor'); await compress(page, asFile('q.jpg', 'image/jpeg', await genImage(page, { w: 90, h: 90, draw: NOISE })), { format: 'image/avif', skip: false });
  assert.deepEqual(seen, []); assert.deepEqual(external, []); await ctx.close();
});
await check('offline: after one online visit every tool still loads and works with the network off (SVGO, table, strip, WebP and AVIF)', async () => {
  const { ctx, page, errs } = await open();
  await page.goto(base); await page.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise(r => { navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }); setTimeout(r, 4000); }); });
  await page.waitForFunction(async () => (await (await caches.keys()).length) > 0 && (await (await caches.open((await caches.keys())[0])).keys()).length > 50);
  // online run of AVIF so that its (non-precached) wasm is cached at runtime
  await openTool(page, 'image-batch-compressor'); const online = await genImage(page, { w: 64, h: 64, type: 'image/png', draw: NOISE });
  await compress(page, asFile('warm.png', 'image/png', online), { format: 'image/avif', skip: false }); const warm = await itemInfo(page);
  const caps = await page.evaluate(() => GVTImage.detectEncoders());
  // go offline by stopping the server: the page can then only be served by the service worker's cache (Firefox refuses to navigate at all with setOffline)
  server.closeAllConnections?.(); await new Promise(r => server.close(r));
  const openOffline = async id => { await page.goto(base); await page.waitForSelector('.cat-tile'); await page.evaluate(t => openTool(t), id); await page.waitForSelector(`#fmRoot[data-tool="${id}"][data-ready]`); };
  await openOffline('svg-sanitizer');
  await page.click('#svgExample'); await page.waitForSelector('#svgVerified:not(:empty)'); assert.match(await page.locator('#svgSizes').innerText(), /SVGO 4\./, 'SVGO available offline'); assert.doesNotMatch(await page.inputValue('#svgOutput'), /script/);
  await openOffline('table-converter'); await page.click('#tblExCsv'); await page.waitForSelector('#tblSummary');
  await openOffline('image-metadata-stripper');
  await strip(page, asFile('o.jpg', 'image/jpeg', F.injectJpeg(online.length ? await genImage(page, { w: 30, h: 30, draw: REDBLUE }) : new Uint8Array(), FULL_META)));
  assert.equal(await page.locator('#stripList .fm-item').getAttribute('data-meta-after'), 'none');
  await openOffline('image-batch-compressor');
  const png = await genImage(page, { w: 64, h: 64, type: 'image/png', draw: NOISE });
  await compress(page, asFile('off.png', 'image/png', png), { format: 'image/webp', skip: false }); assert.equal((await itemInfo(page)).state, 'done');
  if (caps['image/avif'] && warm.type === 'image/avif') { await page.click('#cmpClear'); await compress(page, asFile('off2.png', 'image/png', png), { format: 'image/avif', skip: false }); const it = await itemInfo(page); assert.equal(it.type, 'image/avif', 'AVIF works offline after the encoder was cached: ' + it.text); }
  assert.deepEqual(errs.filter(e => !/Failed to fetch|NetworkError|net::|Load failed/i.test(e)), []);
  await ctx.close();
});

console.log(`\n${engine}: ${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log('\nFAILURES:\n' + failures.map(f => ' - ' + f).join('\n')); }
await browser.close(); try { server.close(); } catch { /* already stopped by the offline test */ }
process.exit(failures.length ? 1 : 0);
