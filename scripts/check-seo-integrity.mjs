#!/usr/bin/env node
/**
 * Source-only SEO integrity checks. Does not request live URLs or mutate files.
 * Run: node scripts/check-seo-integrity.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sitemap = readFileSync(resolve(root, 'sitemap.xml'), 'utf8');
const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
const errors = [];
const seen = new Set();
const origin = 'https://govibetool.com';

if (!locations.length) errors.push('Sitemap has no URL locations');
for (const location of locations) {
  if (seen.has(location)) errors.push('Duplicate sitemap URL: ' + location);
  seen.add(location);
  let url;
  try { url = new URL(location); }
  catch { errors.push('Invalid URL: ' + location); continue; }
  if (url.origin !== origin || url.search || url.hash) {
    errors.push('Non-canonical sitemap URL: ' + location);
    continue;
  }
  const pathname = decodeURIComponent(url.pathname);
  if (pathname.includes('..') || pathname.includes('\\')) {
    errors.push('Unsafe path: ' + location);
    continue;
  }
  const local = resolve(root, pathname.slice(1) + (pathname.endsWith('/') ? 'index.html' : ''));
  if (!local.startsWith(root + sep) || !existsSync(local)) {
    errors.push('Missing source file: ' + location);
    continue;
  }
  if (!local.endsWith('.html')) continue;
  const html = readFileSync(local, 'utf8');
  const canonical = html.match(/<link\b(?=[^>]*\brel=["']canonical["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>/i)?.[1]
    ?? html.match(/<link\b(?=[^>]*\bhref=["']([^"']+)["'])(?=[^>]*\brel=["']canonical["'])[^>]*>/i)?.[1];
  if (!canonical) errors.push('Missing canonical: ' + location);
  else if (canonical !== location) errors.push('Canonical mismatch: ' + location + ' -> ' + canonical);
  if (/<meta\b(?=[^>]*\bname=["']robots["'])(?=[^>]*\bcontent=["'][^"']*noindex)/i.test(html)) {
    errors.push('Noindex page in sitemap: ' + location);
  }
}
console.log('SEO source check:', locations.length, 'sitemap URLs;', errors.length, 'issue(s)');
for (const error of errors) console.error(' -', error);
if (errors.length) process.exitCode = 1;
