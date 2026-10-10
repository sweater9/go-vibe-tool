// Production information-architecture checks: homepage link to /knowledge/, root sitemap integration, offline documentation.
// No network, no browser.
import { readFileSync, readdirSync } from "node:fs";
const R = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const failures = [];
const need = (ok, msg) => { if (!ok) failures.push(msg); };

// 1. Homepage: visible Knowledge links (header nav for wide screens, footer for every width); existing links preserved.
const home = R("index.html");
need(/<div class="navlinks">[^]*?<a href="knowledge\/">Knowledge<\/a>[^]*?<\/div>/.test(home), "homepage header nav needs a Knowledge link");
need(/<footer>[^]*<a href="knowledge\/">Knowledge<\/a>[^]*<\/footer>/.test(home), "homepage footer needs a Knowledge link (the header nav is hidden below 900px)");
for (const href of ['href="#tools"', 'href="learn/"', 'href="#labs"', 'href="#play"', 'href="#about"', 'href="privacy.html"', 'href="terms.html"', 'href="contact.html"']) need(home.includes(href), "existing homepage link lost: " + href);
need(readFileSync(new URL("../knowledge/index.html", import.meta.url), "utf8").length > 0, "knowledge index missing");

// 2. Root sitemap: valid structure, one generated Knowledge block, exactly the canonical pages, no redirect stubs, no duplicates.
const xml = R("sitemap.xml");
need(/^<\?xml version="1.0" encoding="UTF-8"\?>\s*<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/.test(xml) && /<\/urlset>\s*$/.test(xml), "sitemap.xml must be a urlset document");
const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) || [];
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
need(urlBlocks.length === locs.length, "every <url> needs exactly one <loc>");
need((xml.match(/<url>/g) || []).length === (xml.match(/<\/url>/g) || []).length, "unbalanced <url> tags");
need(new Set(locs).size === locs.length, "duplicate URLs in sitemap.xml");
need((xml.match(/knowledge:start/g) || []).length === 1 && (xml.match(/knowledge:end/g) || []).length === 1, "exactly one generated knowledge block expected");
const pages = JSON.parse(R("knowledge/search-index.json")).pages.map((p) => p.id);
const expected = ["index", "glossary", ...pages].map((id) => "https://intellitools.online/knowledge/" + id + ".html");
const kn = locs.filter((l) => l.startsWith("https://intellitools.online/knowledge/"));
need(kn.length === expected.length && expected.every((u) => kn.includes(u)), "sitemap Knowledge URLs must equal index + glossary + all indexed pages (" + kn.length + " vs " + expected.length + ")");
need(!locs.some((l) => l.includes("hugging-face-transformers")), "redirect stub must not be in the sitemap");
need(kn.every((l) => readdirSync(new URL("../knowledge/", import.meta.url)).includes(l.split("/").pop())), "every sitemap Knowledge URL must exist as a file");
need(R("knowledge/sitemap-fragment.xml").split("\n").filter((l) => l.startsWith("<url>")).length === kn.length, "fragment and root sitemap must list the same number of URLs");
for (const keep of ["https://intellitools.online/", "https://intellitools.online/privacy.html", "https://intellitools.online/terms.html", "https://intellitools.online/contact.html", "https://intellitools.online/tools/ai-prompt-builder.html"]) need(locs.includes(keep), "existing sitemap URL lost: " + keep);

// 3. Offline limitation is documented and Knowledge is not advertised as offline-capable.
const readme = R("knowledge/README.md");
need(/## Offline behaviour \(limitation/.test(readme) && /not.{0,20}offline-first/i.test(readme), "README must document the offline limitation");
const kHome = R("knowledge/index.html");
need(!/work(s)? offline|offline[- ](first|mode|support|ready)|available offline/i.test(kHome), "Knowledge index must not advertise offline support");

if (failures.length) { console.error("FAILURES (" + failures.length + "):\n" + failures.join("\n")); process.exit(1); }
console.log("integration checks passed: " + kn.length + " Knowledge URLs in sitemap.xml, homepage links present, offline limitation documented");
