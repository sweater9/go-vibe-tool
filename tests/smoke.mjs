import { readFileSync, existsSync } from "node:fs";

const html = readFileSync("index.html", "utf8");
const tools = readFileSync("tools.js", "utf8");
const v2 = readFileSync("v2-tools.js", "utf8");
const sw = readFileSync("sw.js", "utf8");
const v21 = readFileSync("v21-tools.js", "utf8");
const discovery = readFileSync("discovery.js", "utf8");
const expectedTools = [
  "ai-prompt-builder", "pii-secret-redactor", "curl-code-sanitizer", "fact-anchor-checker",
  "invoice-studio", "image-studio", "color-studio", "converter-studio",
  "habit-journal", "focus-timer", "writing-studio", "password-studio",
  "pdf-studio", "signature-studio", "qr-studio", "budget-studio"
];
const requiredFiles = [
  "index.html", "tools.js", "v2-tools.js", "v2.css", "manifest.webmanifest",
  "assets/icon.svg", "v21-tools.js", "discovery.js", "learn/index.html", "vendor/pdf-lib.min.js", "vendor/qrcode.min.js",
  "vendor/jsqr.min.js", "sw.js", "CNAME", "THIRD_PARTY_NOTICES.md"
];

const growthPages = [
  "tools/ai-prompt-builder.html","tools/pii-secret-redactor.html","tools/private-pdf-tools.html","tools/invoice-generator.html","tools/image-compressor.html",
  "tools/curl-token-stripper.html","tools/fact-anchor-checker.html","tools/qr-code-studio.html","tools/password-generator.html","tools/markdown-text-studio.html"
];
const v21Expected=["agentic-workflow-generator","link-fingerprint","oauth-jwt-decoder","cookie-impact-estimator","sql-mock-builder","env-diff","table-formatter","cron-humanizer","prompt-diff","keyword-balancer","email-preview","hourly-rate","saas-economics","expense-splitter"];
const failures = [];
for (const id of v21Expected) if (!v21.includes(`["${id}"`)) failures.push(`Missing V2.1 tool: ${id}`);
for (const marker of ["function runV21","function v21Template","failure_policy"]) if (!v21.includes(marker)) failures.push(`V2.1 implementation missing: ${marker}`);
for (const file of ["robots.txt","sitemap.xml",...growthPages]) if (!existsSync(file)) failures.push(`Missing growth file: ${file}`);
const sitemap = readFileSync("sitemap.xml","utf8");
for (const file of growthPages) {
  const page = readFileSync(file,"utf8");
  if (!page.includes('rel="canonical"') || !page.includes('application/ld+json') || !page.includes("ca-pub-6129942955275199")) failures.push(`SEO metadata missing: ${file}`);
  if (!sitemap.includes(`https://intellitools.online/${file}`)) failures.push(`Sitemap missing: ${file}`);
}
if (!readFileSync("robots.txt","utf8").includes("https://intellitools.online/sitemap.xml")) failures.push("robots.txt sitemap directive missing");
for (const file of ["tools/ai-prompt-builder.html","tools/pii-secret-redactor.html","tools/private-pdf-tools.html","tools/invoice-generator.html","tools/image-compressor.html","tools/curl-token-stripper.html","tools/fact-anchor-checker.html","tools/qr-code-studio.html","tools/password-generator.html","tools/markdown-text-studio.html"]) {
  const page = readFileSync(file,"utf8");
  for (const marker of ["WHAT IT DOES","HOW TO USE IT","GOOD TO KNOW","RELATED TOOLS"]) if (!page.includes(marker)) failures.push(`Growth V2 content missing: ${file} / ${marker}`);
  if (!page.includes("Use ") || !page.includes("Continue the workflow.")) failures.push(`Growth V2 CTA missing: ${file}`);
}
for (const marker of ["knowledgeEntries","function scoreIntent","function intentResults","Learn","Lab"]) if (!discovery.includes(marker)) failures.push(`Discovery foundation missing: ${marker}`);
for (const marker of ["Tools. Learn. Labs. Play.","learn/","id=\"labs\"","id=\"play\""]) if (!html.includes(marker)) failures.push(`Product pillar missing: ${marker}`);
const learnPage=readFileSync("learn/index.html","utf8");
for (const marker of ["Python","JavaScript","React","Node.js","SQL","Regex","Git & GitHub","APIs & OAuth"]) if (!learnPage.includes(marker)) failures.push(`Learn hub missing: ${marker}`);
for (const marker of ["const growthPages=","const relatedTools=","function relatedToolMarkup","function shareToolMarkup"]) if (!v2.includes(marker)) failures.push(`Growth loop missing: ${marker}`);
for (const file of requiredFiles) if (!existsSync(file)) failures.push(`Missing file: ${file}`);
for (const id of expectedTools) {
  const source = id === "ai-prompt-builder" ? tools : v2;
  if (!source.includes(`["${id}"`)) failures.push(`Missing tool: ${id}`);
}
for (const script of ["vendor/pdf-lib.min.js", "vendor/qrcode.min.js", "vendor/jsqr.min.js", "tools.js", "v2-tools.js", "v21-tools.js"]) {
  if (!html.includes(`src="${script}"`)) failures.push(`index.html does not load ${script}`);
}
for (const asset of ["index.html", "v2.css", "tools.js", "v2-tools.js", "v21-tools.js", "discovery.js", "learn/index.html", "manifest.webmanifest"]) {
  if (!sw.includes(`./${asset}`)) failures.push(`Offline cache is missing ${asset}`);
}
if (!html.includes("IntelliTools") || html.includes("IntelliTools.online") || !html.includes("Less switching.") || !html.includes("Version 5 release candidate")) failures.push("current IntelliTools product identity is missing or stale");
if (!html.includes("Your Data.<br>Your Browser.<br><em>Your Control.</em>") || !html.includes("Our tools also work without an internet connection, and no account is required.")) failures.push("privacy-first homepage hero is missing or changed");
if (!html.includes("ca-pub-6129942955275199")) failures.push("AdSense publisher script is missing");
if (!html.includes("privacy.html") || !html.includes("terms.html") || !html.includes("contact.html")) failures.push("legal/footer links are missing");
if (!v2.includes("function redactSensitiveText") || !v2.includes("function sanitizeCurlText") || !v2.includes("function factAnchorCheck")) failures.push("new V2 safety/evidence logic is missing");
for (const marker of ["discoveryShelf","DISCOVERY_RECENT_KEY","DISCOVERY_FAV_KEY","function rememberTool","function toggleFavorite","e.metaKey||e.ctrlKey"]) {
  const source = marker === "discoveryShelf" ? html : v2;
  if (!source.includes(marker)) failures.push(`Discovery feature missing: ${marker}`);
}
for (const marker of ["Array.isArray(value)","window.addEventListener(\"storage\"","intellitools-v2-7","freshFirst"]) {
  const source = marker.startsWith("intellitools") || marker === "freshFirst" ? sw : v2;
  if (!source.includes(marker)) failures.push(`Favourites persistence hardening missing: ${marker}`);
}
if (readFileSync("CNAME", "utf8").trim() !== "intellitools.online") failures.push("CNAME does not match intellitools.online");

for (const file of ["assets/product-hunt-thumbnail.svg","docs/PRODUCT-HUNT-ASSET-CAPTURE.md","docs/ACQUISITION-LAUNCH-PLAN.md"]) {
  if (!existsSync(file)) failures.push(`Launch asset missing: ${file}`);
}
const launchThumb = readFileSync("assets/product-hunt-thumbnail.svg","utf8");
if (!launchThumb.includes('width="240"') || !launchThumb.includes('height="240"') || !launchThumb.includes("IntelliTools")) failures.push("Product Hunt thumbnail source is invalid");
const launchGuide = readFileSync("docs/PRODUCT-HUNT-ASSET-CAPTURE.md","utf8");
for (const phrase of ["Homepage discovery","AI Prompt Builder","PII & Secret Redactor","Private PDF Tools","Image Studio","Return workflow","Demo recording"]) if (!launchGuide.includes(phrase)) failures.push(`Launch capture guide missing: ${phrase}`);

if (v2.includes('document.\\naddEventListener') || v2.includes('document.\\\\naddEventListener')) failures.push("Literal escaped newline disabled the runtime count refresh");

if (failures.length) {
  console.error(failures.join("\\n"));
  process.exit(1);
}
console.log(`Smoke checks passed: ${expectedTools.length} v2 workspaces, ${requiredFiles.length} required files.`);
