#!/usr/bin/env node
/* Generates one crawlable landing page per catalogue tool (tools/<slug>.html), the tools directory page
   (tools/index.html) and the matching sitemap entries, from config/tool-pages.mjs.
   Pages follow the hand-written Growth V2 layout (WHAT IT DOES / HOW TO USE IT / GOOD TO KNOW / RELATED TOOLS).
   No dependencies, no network. Usage: node scripts/build-tool-pages.mjs [--check] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES, GROUPS } from '../config/tool-pages.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const ORIGIN = 'https://govibetool.com';
const LASTMOD = '2026-11-14';
const ADS_META = '<meta name="google-adsense-account" content="ca-pub-6129942955275199">';
const PRIVACY_FAQ = ['Where is my data processed?', 'In your browser, on your device. This tool has no server-side component, so what you enter is not uploaded by GoVibeTool, and no account is needed.'];

/* Hand-written pages that already exist; listed so the directory page and related links cover every tool page. */
export const HAND_WRITTEN = [
  { slug: 'ai-prompt-builder', name: 'AI Prompt Builder', group: 'Productivity', desc: 'Structure role, context, instructions, constraints and output requirements.' },
  { slug: 'prompt-improver', name: 'Prompt Improver', group: 'Productivity', desc: 'Improve a draft prompt with clearer structure and instructions.' },
  { slug: 'pii-secret-redactor', name: 'PII & Secret Redactor', group: 'Privacy & Security', desc: 'Detect and redact common sensitive data from prompts, logs and text before sharing.' },
  { slug: 'password-generator', name: 'Password & Passphrase Studio', group: 'Privacy & Security', desc: 'Generate customizable passwords or memorable passphrases and check strength locally.' },
  { slug: 'private-pdf-tools', name: 'Private PDF Tools', group: 'PDF Tools', desc: 'Merge, split, rotate or optimize PDFs without uploading sensitive documents.' },
  { slug: 'image-compressor', name: 'Image Compressor & Converter', group: 'Images & Design', desc: 'Resize, convert and compress images in a focused browser-based workspace.' },
  { slug: 'invoice-generator', name: 'Invoice & Receipt Studio', group: 'Business & Finance', desc: 'Create professional invoices or receipts with tax, logo, currency, live preview and export.' },
  { slug: 'curl-token-stripper', name: 'cURL → Code & Token Stripper', group: 'Developer', desc: 'Strip common credentials from cURL requests and create a safer JavaScript fetch example.' },
  { slug: 'fact-anchor-checker', name: 'Fact Anchor Checker', group: 'Writing & Text', desc: 'Compare claims against supplied evidence and flag what is supported, partial or not found.' },
  { slug: 'markdown-text-studio', name: 'Markdown & Text Studio', group: 'Writing & Text', desc: 'Write and preview Markdown, clean text, change case, count words and compare drafts.' },
  { slug: 'qr-code-studio', name: 'QR Studio', group: 'Links & Web', desc: 'Generate QR codes for URLs, text, Wi-Fi and contacts, or read one from an image or camera.' },
];

const E = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const J = o => JSON.stringify(o).replace(/</g, '\\u003c');
const head = ({ title, desc, url, jsonld, css = '../v2.css', assets = '../assets' }) =>
  `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${E(title)}</title><meta name="description" content="${E(desc)}"><link rel="canonical" href="${url}"><meta property="og:type" content="website"><meta property="og:site_name" content="GoVibeTool"><meta property="og:title" content="${E(title)}"><meta property="og:description" content="${E(desc)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${ORIGIN}/assets/og-image.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${E(title)}"><meta name="twitter:description" content="${E(desc)}"><meta name="twitter:image" content="${ORIGIN}/assets/og-image.png"><link rel="icon" href="${assets}/icon.svg" type="image/svg+xml"><link rel="stylesheet" href="${css}">${jsonld.map(j => `<script type="application/ld+json">${J(j)}</script>`).join('')}${ADS_META}</head>\n`;
const header = `<body><header><div class="wrap"><nav aria-label="Main navigation"><a class="brand" href="../index.html"><img class="brand-mark" src="../assets/logo-mark.svg" width="28" height="28" alt=""><span>GoVibe</span>Tool</a><div class="navlinks"><a href="./">All tools</a><a href="../index.html#about">About</a></div></nav></div></header><main>\n`;
const footer = `</main><footer><div class="wrap"><strong>GoVibeTool</strong><p>Private tools. Smart learning. Good vibes.</p><a href="./">All tools</a> · <a href="../about.html">About</a> · <a href="../privacy.html">Privacy</a> · <a href="../terms.html">Terms</a> · <a href="../contact.html">Contact</a></div></footer></body></html>\n`;

function related(page) {
  const all = [...PAGES, ...HAND_WRITTEN].filter(p => p.group === page.group && p.slug !== page.slug);
  const i = PAGES.filter(p => p.group === page.group).indexOf(page);
  return [all[i % all.length], all[(i + 1) % all.length]].filter((p, n, a) => p && a.indexOf(p) === n);
}

function toolPage(p) {
  const url = `${ORIGIN}/tools/${p.slug}.html`;
  const open = `../index.html?tool=${p.id}#tools`;
  const desc = `${p.desc} Free, no signup, runs in your browser.`;
  const faqs = [p.faq, PRIVACY_FAQ];
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: p.name, applicationCategory: 'WebApplication', operatingSystem: 'Any modern web browser', url, description: p.desc, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'GoVibeTool', item: ORIGIN + '/' }, { '@type': 'ListItem', position: 2, name: 'Tools', item: ORIGIN + '/tools/' }, { '@type': 'ListItem', position: 3, name: p.name, item: url }] },
  ];
  const card = (tag, h, body) => `<article class="toolcard">${tag ? `<span class="tag">${tag}</span>` : ''}<h3>${E(h)}</h3>${body ? `<p>${E(body)}</p>` : ''}</article>`;
  return head({ title: `${p.name} — Free Online Tool | GoVibeTool`, desc, url, jsonld }) + header +
    `<section class="hero"><div class="wrap"><span class="eyebrow">${E(p.group.toUpperCase())} · FREE ONLINE TOOL</span><h1>${E(p.name)}</h1><p>${E(p.desc)}</p><div class="actions"><a class="btn" href="${open}">Use ${E(p.name)} →</a><a class="btn alt" href="./">Browse all tools</a></div><div class="hero-stats"><span><strong>No</strong> account required</span><span><strong>Runs</strong> in your browser</span><span><strong>Free</strong> to use</span></div></div></section>\n` +
    `<section class="section"><div class="wrap"><span class="eyebrow">WHAT IT DOES</span><h2>${E(p.summary)}</h2><div class="tools">${p.uses.map((u, i) => card('USE ' + (i + 1), u)).join('')}</div></div></section>\n` +
    `<section class="section"><div class="wrap"><span class="eyebrow">HOW TO USE IT</span><h2>Three steps from input to result.</h2><div class="tools">${p.steps.map((s, i) => card('STEP ' + (i + 1), s)).join('')}</div><div class="actions"><a class="btn" href="${open}">Open the tool →</a></div></div></section>\n` +
    `<section class="section"><div class="wrap"><span class="eyebrow">GOOD TO KNOW</span><h2>Clear expectations before you use it.</h2><div class="tools">${faqs.map(([q, a]) => card('', q, a)).join('')}</div></div></section>\n` +
    `<section class="section"><div class="wrap"><span class="eyebrow">RELATED TOOLS</span><h2>Continue the workflow.</h2><div class="actions">${related(p).map(r => `<a class="btn alt" href="${r.slug}.html">${E(r.name)} →</a>`).join('')}<a class="btn alt" href="./">Explore all GoVibeTool →</a></div></div></section>` + footer;
}

function indexPage() {
  const url = `${ORIGIN}/tools/`;
  const all = [...PAGES, ...HAND_WRITTEN];
  const desc = `All ${all.length} free GoVibeTool browser tools in one list: links, text, productivity, developer, privacy, design and finance. No signup.`;
  const jsonld = [{ '@context': 'https://schema.org', '@type': 'ItemList', name: 'GoVibeTool tools', numberOfItems: all.length, itemListElement: all.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.name, url: `${ORIGIN}/tools/${p.slug}.html` })) }];
  const sections = GROUPS.map(g => {
    const items = all.filter(p => p.group === g).sort((a, b) => a.name.localeCompare(b.name));
    return `<section class="section" id="${g.toLowerCase().replace(/[^a-z]+/g, '-')}"><div class="wrap"><span class="eyebrow">${E(g.toUpperCase())}</span><h2>${E(g)} tools</h2><div class="tools">${items.map(p => `<article class="toolcard"><h3><a href="${p.slug}.html">${E(p.name)}</a></h3><p>${E(p.desc)}</p></article>`).join('')}</div></div></section>\n`;
  }).join('');
  return head({ title: 'All Free Online Tools | GoVibeTool', desc, url, jsonld }) + header +
    `<section class="hero"><div class="wrap"><span class="eyebrow">TOOL DIRECTORY</span><h1>All GoVibeTool tools</h1><p>${all.length} free tools that run in your browser. No account, no upload by the tool. Pick one to see what it does and open it.</p><div class="actions"><a class="btn" href="../index.html#tools">Search the tools →</a></div></div></section>\n` + sections + footer;
}

function sitemapWith(xml) {
  const want = ['tools/', ...PAGES.map(p => `tools/${p.slug}.html`)];
  const missing = want.filter(u => !xml.includes(`<loc>${ORIGIN}/${u}</loc>`));
  if (!missing.length) return xml;
  const lines = missing.map(u => `  <url><loc>${ORIGIN}/${u}</loc><lastmod>${LASTMOD}</lastmod><changefreq>monthly</changefreq><priority>${u === 'tools/' ? '0.9' : '0.8'}</priority></url>`).join('\n');
  const anchor = xml.lastIndexOf(`<loc>${ORIGIN}/tools/`);
  const at = xml.indexOf('\n', anchor) + 1;
  return xml.slice(0, at) + lines + '\n' + xml.slice(at);
}

const outputs = new Map(PAGES.map(p => [`tools/${p.slug}.html`, toolPage(p)]));
outputs.set('tools/index.html', indexPage());
outputs.set('sitemap.xml', sitemapWith(fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8')));

const slugs = [...PAGES, ...HAND_WRITTEN].map(p => p.slug);
if (new Set(slugs).size !== slugs.length) { console.error('Duplicate tool page slug'); process.exit(1); }
let stale = 0;
for (const [rel, content] of outputs) {
  const file = path.join(root, rel);
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (current === content) continue;
  if (check) { console.error('Out of date: ' + rel); stale++; } else fs.writeFileSync(file, content);
}
if (check && stale) { console.error('Run: node scripts/build-tool-pages.mjs'); process.exit(1); }
console.log(`${check ? 'Checked' : 'Wrote'} ${PAGES.length} tool pages, the tools directory and the sitemap.`);
