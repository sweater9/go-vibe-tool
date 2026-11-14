/* Generated tool landing pages: in sync with config/tool-pages.mjs, complete, and safe for ads/privacy gating. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PAGES, GROUPS } from '../config/tool-pages.mjs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const catalogue = ['tools.js', 'v2-tools.js', 'v21-tools.js', 'v8-developer-tools.js', 'v9-agent1-tools.js'].map(read).join('\n');
const retired = ['password', 'url-inspector', 'tracking-check', 'qr-payload'];

test('generated pages are up to date with their source', () => {
  execFileSync(process.execPath, ['scripts/build-tool-pages.mjs', '--check'], { cwd: new URL('../', import.meta.url), stdio: 'pipe' });
});

test('every page maps to a live catalogue tool and has complete content', () => {
  const sitemap = read('sitemap.xml');
  for (const p of PAGES) {
    assert.match(catalogue, new RegExp(`\\[\\s*"${p.id}"\\s*,`), `unknown tool id: ${p.id}`);
    assert.ok(!retired.includes(p.id), `retired tool id: ${p.id}`);
    assert.ok(GROUPS.includes(p.group), `unknown group: ${p.slug}`);
    assert.equal(p.uses.length, 3, p.slug); assert.equal(p.steps.length, 3, p.slug); assert.equal(p.faq.length, 2, p.slug);
    const html = read(`tools/${p.slug}.html`);
    for (const marker of ['WHAT IT DOES', 'HOW TO USE IT', 'GOOD TO KNOW', 'RELATED TOOLS', 'rel="canonical"', '"FAQPage"', '"SoftwareApplication"', 'ca-pub-6129942955275199', `?tool=${p.id}#tools`]) assert.ok(html.includes(marker), `${p.slug}: ${marker}`);
    assert.equal((html.match(/<h1>/g) || []).length, 1, p.slug);
    assert.doesNotMatch(html, /adsbygoogle/, p.slug);
    for (const m of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)) JSON.parse(m[1]);
    for (const m of html.matchAll(/href="([a-z0-9-]+\.html)"/g)) assert.ok(existsSync(new URL('../tools/' + m[1], import.meta.url)), `${p.slug} links to missing ${m[1]}`);
    assert.ok(sitemap.includes(`<loc>https://govibetool.com/tools/${p.slug}.html</loc>`), `sitemap: ${p.slug}`);
    const desc = html.match(/<meta name="description" content="([^"]*)"/)[1];
    assert.ok(desc.length <= 200, `${p.slug}: description too long (${desc.length})`);
  }
});

test('tools directory lists every tool page', () => {
  const index = read('tools/index.html');
  for (const p of PAGES) assert.ok(index.includes(`href="${p.slug}.html"`), p.slug);
  for (const m of index.matchAll(/href="([a-z0-9-]+\.html)"/g)) assert.ok(existsSync(new URL('../tools/' + m[1], import.meta.url)), m[1]);
  assert.ok(read('sitemap.xml').includes('<loc>https://govibetool.com/tools/</loc>'));
});

test('hand-written tool pages carry FAQ structured data and link to the directory; homepage links to it too', () => {
  for (const slug of ['ai-prompt-builder', 'prompt-improver', 'pii-secret-redactor', 'password-generator', 'private-pdf-tools', 'image-compressor', 'invoice-generator', 'curl-token-stripper', 'fact-anchor-checker', 'markdown-text-studio', 'qr-code-studio']) {
    const html = read(`tools/${slug}.html`);
    assert.ok(html.includes('"FAQPage"'), slug);
    assert.ok(html.includes('<a href="./">All tools</a>'), slug);
    for (const m of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)) JSON.parse(m[1]);
  }
  assert.match(read('index.html'), /<footer>[^]*<a href="tools\/">All tools A–Z<\/a>[^]*<\/footer>/);
});

test('About page names the operator, is shipped, in the sitemap and linked from the homepage', () => {
  const about = read('about.html');
  for (const marker of ['Who runs this site', 'support@govibetool.com', '"Organization"', 'rel="canonical" href="https://govibetool.com/about.html"', 'Advertising is not enabled today']) assert.ok(about.includes(marker), marker);
  assert.doesNotMatch(about, /adsbygoogle/);
  assert.ok(read('scripts/site-manifest.mjs').includes("'about.html'"));
  assert.ok(read('sitemap.xml').includes('<loc>https://govibetool.com/about.html</loc>'));
  assert.match(read('index.html'), /<footer>[^]*<a href="about\.html">About GoVibeTool<\/a>[^]*<\/footer>/);
});
