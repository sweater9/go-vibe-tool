#!/usr/bin/env node
/* Builds the clean static output for Cloudflare Workers static assets: dist/.
   Only an explicit allowlist of website files is copied. No dependencies, no network. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT_FILES, ROOT_FILE_PATTERN, SITE_DIRS, EXCLUDE_DIR_NAMES, EXCLUDE_FILE_PATTERNS, isTestTwin, ASSETS_IGNORE } from './site-manifest.mjs';
import { verifyDist } from './verify-dist.mjs';

// This acceptance candidate must never become a Git-triggered host deployment.
// Reject automatic hosting builds before touching dist; GitHub/local QA remain enabled.
if (process.env.WORKERS_CI === '1' || process.env.CF_PAGES === '1' ||
    process.env.RENDER === 'true' || process.env.RENDER_GIT_COMMIT) {
  console.error('INTEGRATION_NO_DEPLOY: automatic Cloudflare/Render build rejected. This branch is for QA acceptance only.');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
const copied = []; const skipped = [];

const exists = rel => fs.existsSync(path.join(root, rel));
function copyFile(rel) { const dest = path.join(out, rel); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(path.join(root, rel), dest); copied.push(rel); }
function walk(relDir) {
  for (const ent of fs.readdirSync(path.join(root, relDir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = path.posix.join(relDir, ent.name);
    if (ent.isSymbolicLink()) { skipped.push(rel + ' (symlink)'); continue; }
    if (ent.isDirectory()) { if (EXCLUDE_DIR_NAMES.has(ent.name)) { skipped.push(rel + '/'); continue; } walk(rel); continue; }
    if (EXCLUDE_FILE_PATTERNS.some(p => p.test(ent.name)) || isTestTwin(rel, exists)) { skipped.push(rel); continue; }
    copyFile(rel);
  }
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of ROOT_FILES) { if (!exists(f)) throw new Error(`Required site file is missing: ${f}`); copyFile(f); }
for (const ent of fs.readdirSync(root, { withFileTypes: true })) if (ent.isFile() && ROOT_FILE_PATTERN.test(ent.name) && !ROOT_FILES.includes(ent.name)) copyFile(ent.name);
for (const d of SITE_DIRS) { if (!exists(d)) throw new Error(`Required site directory is missing: ${d}/`); walk(d); }
fs.writeFileSync(path.join(out, '.assetsignore'), ASSETS_IGNORE);

const report = verifyDist(out, { root });
console.log(`dist/ built: ${copied.length} files, ${(report.totalBytes / 1048576).toFixed(2)} MiB total, largest ${(report.largest.bytes / 1024).toFixed(0)} KiB (${report.largest.file}).`);
console.log(`Skipped ${skipped.length} non-site entries inside site folders (build sources, markdown, test twins).`);
if (!report.ok) { console.error('dist verification FAILED:\n - ' + report.errors.join('\n - ')); process.exit(1); }
console.log('dist verification passed: size limits, forbidden paths, reference closure, service-worker precache, sitemap.');
