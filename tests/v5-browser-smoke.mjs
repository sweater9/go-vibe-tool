/**
 * IntelliTools V5 — Browser Smoke & UI QA Test Suite
 * Designed for Playwright execution across Chromium, Firefox, and WebKit.
 * Tests desktop (1280px) and mobile (375px) viewports for Labs & Play pages.
 */

import fs from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';

const base = process.env.BASE_URL || 'https://intellitools.online';
const pagesToTest = [
  { path: '/labs/', name: 'labs-hub' },
  { path: '/labs/workflow/', name: 'labs-workflow' },
  { path: '/labs/api-playground/', name: 'labs-api' },
  { path: '/play/', name: 'play-hub' },
  { path: '/play/daily/', name: 'play-daily' },
  { path: '/play/word-logic/', name: 'play-wordlogic' }
];

async function run() {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch (err) {
    console.log('[Browser QA] Playwright package is not installed in this execution environment.');
    console.log('[Browser QA] Environmental notice: CI workflow (.github/workflows/production-browser-smoke.yml) handles browser testing with Playwright.');
    return;
  }

  const { chromium, firefox, webkit } = playwright;
  const browsers = { chromium, firefox, webkit };
  const engine = process.argv[2] || 'chromium';

  if (!browsers[engine]) {
    throw new Error('Unknown browser engine: ' + engine);
  }

  if (!existsSync('artifacts')) {
    mkdirSync('artifacts', { recursive: true });
  }

  console.log(`Launching ${engine} headless browser...`);
  const browser = await browsers[engine].launch({ headless: true });
  const issues = [];
  const results = [];

  try {
    for (const viewport of [{ width: 1280, height: 900, mode: 'desktop' }, { width: 375, height: 812, mode: 'mobile' }]) {
      for (const item of pagesToTest) {
        const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
        const targetUrl = new URL(item.path, base).href;

        page.on('pageerror', e => issues.push(`${engine} ${viewport.width}px JS error on ${item.name}: ${e.message}`));
        page.on('console', m => {
          if (m.type() === 'error') issues.push(`${engine} ${viewport.width}px Console error on ${item.name}: ${m.text()}`);
        });

        try {
          const resp = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          if (!resp?.ok()) {
            issues.push(`HTTP ${resp?.status()} on ${targetUrl}`);
          }

          // Check horizontal overflow
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
          if (overflow) {
            issues.push(`${engine} ${viewport.width}px horizontal overflow on ${item.name}`);
          }

          // Functional check per page
          if (item.name === 'labs-workflow') {
            await page.waitForSelector('#canvasViewport', { timeout: 5000 });
            await page.click('#btnStepSim').catch(() => {});
          } else if (item.name === 'labs-api') {
            await page.waitForSelector('#btnSendRequest', { timeout: 5000 });
            // Security regression check: ensure malformed JSON containing HTML payload is never executed or parsed as DOM elements
            await page.evaluate(() => {
              const textarea = document.getElementById('bodyTextarea');
              if (textarea) {
                textarea.value = '{"malicious": <img src="x" onerror="window.__xss_fired=true">}';
                textarea.dispatchEvent(new Event('input'));
              }
            });
            const xssFired = await page.evaluate(() => window.__xss_fired);
            if (xssFired) {
              issues.push(`${engine} ${viewport.width}px XSS vulnerability detected in API Playground JSON validation`);
            }
            const imgCount = await page.evaluate(() => document.querySelectorAll('#jsonValidationStatus img').length);
            if (imgCount > 0) {
              issues.push(`${engine} ${viewport.width}px Unsanitized <img> element rendered in JSON validation status`);
            }
          } else if (item.name === 'play-daily') {
            await page.waitForSelector('#quizContainer', { timeout: 5000 });
          } else if (item.name === 'play-wordlogic') {
            await page.waitForSelector('#slotsContainer', { timeout: 5000 });
          }

          await page.screenshot({ path: `artifacts/v5-${engine}-${viewport.width}-${item.name}.png`, fullPage: false });
          results.push({ page: item.name, width: viewport.width, status: 'pass' });
        } catch (e) {
          issues.push(`${engine} ${viewport.width}px error testing ${item.name}: ${e.message}`);
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
    await fs.writeFile(`artifacts/v5-browser-${engine}.json`, JSON.stringify({ results, issues }, null, 2));
  }

  console.log(`[Browser QA Summary] Engine: ${engine}, Tested: ${results.length}, Issues: ${issues.length}`);
  if (issues.length) {
    console.error(issues.join('\n'));
    process.exitCode = 1;
  }
}

run();
