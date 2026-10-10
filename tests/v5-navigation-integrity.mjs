import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('Running V5 Navigation, Link Integrity, and Artifact Verification tests...');

const NEW_PAGES = [
  'labs/index.html',
  'labs/workflow/index.html',
  'labs/api-playground/index.html',
  'play/index.html',
  'play/daily/index.html',
  'play/word-logic/index.html'
];

// 1. Verify existence and content structure of all V5 pages
for (const relPath of NEW_PAGES) {
  assert.ok(fs.existsSync(relPath), `Page must exist: ${relPath}`);
  const html = fs.readFileSync(relPath, 'utf8');

  // Basic HTML5 integrity
  assert.ok(html.includes('<!doctype html>'), `${relPath} must have doctype`);
  assert.ok(html.includes('<meta name="viewport"'), `${relPath} must have viewport meta`);
  assert.ok(html.includes('<title>'), `${relPath} must have page title`);
  assert.ok(html.includes('<meta name="description"'), `${relPath} must have meta description`);
  assert.ok(html.includes('rel="canonical"'), `${relPath} must declare canonical link`);
  assert.ok(html.includes('rel="stylesheet"'), `${relPath} must link styles`);

  // Four-pillar navigation presence
  assert.ok(html.includes('>Tools<'), `${relPath} must contain Tools nav link`);
  assert.ok(html.includes('>Learn<'), `${relPath} must contain Learn nav link`);
  assert.ok(html.includes('>Labs<'), `${relPath} must contain Labs nav link`);
  assert.ok(html.includes('>Play<'), `${relPath} must contain Play nav link`);

  // Footer & Branding
  assert.ok(html.includes('Intelli</span>Tools'), `${relPath} must contain IntelliTools brand`);
  assert.ok(html.includes('privacy.html'), `${relPath} must reference privacy policy`);
  assert.ok(html.includes('terms.html'), `${relPath} must reference terms`);
}
console.log(`✓ All ${NEW_PAGES.length} V5 pages exist with semantic markup, canonical metadata, and 4-pillar navigation`);

// 2. Link integrity verification
// Verify that hrefs in new pages resolve locally to real files
for (const pagePath of NEW_PAGES) {
  const html = fs.readFileSync(pagePath, 'utf8');
  const dir = path.dirname(pagePath);
  const hrefMatches = [...html.matchAll(/href="([^"#:]+)"/g)].map(m => m[1]);

  for (const href of hrefMatches) {
    if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('http') || href.startsWith('#')) continue;
    const cleanHref = href.split('?')[0].split('#')[0];
    let target = path.resolve(dir, cleanHref || '.');
    if (!fs.existsSync(target) && fs.existsSync(path.join(target, 'index.html'))) {
      target = path.join(target, 'index.html');
    }
    assert.ok(fs.existsSync(target), `Link "${href}" (cleaned: "${cleanHref}") in "${pagePath}" resolves to non-existent target "${target}"`);
  }
}
console.log('✓ All internal hyperlinks in V5 pages resolve cleanly to existing files');

// 3. Sitemap Verification
const sitemap = fs.readFileSync('sitemap.xml', 'utf8');
const EXPECTED_SITEMAP_URLS = [
  'https://intellitools.online/labs/',
  'https://intellitools.online/labs/workflow/',
  'https://intellitools.online/labs/api-playground/',
  'https://intellitools.online/play/',
  'https://intellitools.online/play/daily/',
  'https://intellitools.online/play/word-logic/'
];

for (const url of EXPECTED_SITEMAP_URLS) {
  assert.ok(sitemap.includes(url), `Sitemap missing V5 route: ${url}`);
}
console.log('✓ All 6 new V5 routes are indexed in sitemap.xml');

// 4. Service Worker Cache Verification
const sw = fs.readFileSync('sw.js', 'utf8');
for (const page of NEW_PAGES) {
  assert.ok(sw.includes(`./${page}`), `Service worker cache missing: ./${page}`);
}
assert.ok(sw.includes('./v5.css'), 'Service worker missing v5.css');
console.log('✓ Service Worker sw.js caches all new V5 routes and stylesheets');

console.log('ALL V5 Navigation & Link Integrity tests passed successfully!\n');
