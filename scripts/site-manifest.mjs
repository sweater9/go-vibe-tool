/* Single source of truth for what ships to Cloudflare Workers static assets. */
export const MAX_ASSET_BYTES = 25 * 1024 * 1024; // Workers static assets: 25 MiB per file
export const MAX_ASSET_FILES = 20000;             // Workers static assets: files per Worker version (free plan)

// Root-level files that are part of the website.
export const ROOT_FILES = ['index.html', '404.html', 'contact.html', 'privacy.html', 'terms.html', 'ads.txt', 'robots.txt', 'sitemap.xml', 'manifest.webmanifest', 'sw.js'];
export const ROOT_FILE_PATTERN = /^[A-Za-z0-9._-]+\.(js|css)$/; // root scripts and stylesheets (tools.js, v2.css, ...)

// Top-level directories that are part of the website. Everything else (node_modules, tests, docs, qa, multiplayer,
// artifacts, scripts, .git, .github, ...) is never copied.
export const SITE_DIRS = ['assets', 'vendor', 'tools', 'learn', 'knowledge', 'labs', 'play'];

// Never shipped, even inside a site directory.
export const EXCLUDE_DIR_NAMES = new Set(['node_modules', '.git', 'src', 'spec', 'tests', 'test', 'docs', 'artifacts', '__pycache__']);
export const EXCLUDE_FILE_PATTERNS = [/\.md$/i, /\.py$/i, /\.map$/i, /\.log$/i, /\.tmp$/i, /^\.DS_Store$/, /^sitemap-fragment\.xml$/];

// Directories forbidden anywhere in the output (verified after build).
export const FORBIDDEN_TOP_LEVEL = ['node_modules', '.git', '.github', 'tests', 'docs', 'qa', 'multiplayer', 'artifacts', 'scripts', 'dist'];
export const FORBIDDEN_ROOT_FILES = ['CNAME', 'package.json', 'package-lock.json', 'wrangler.jsonc', 'wrangler.toml', 'wrangler.json', '.assetsignore'];

/** Node-only twins of browser files (e.g. engine.mjs next to engine.js) exist for unit tests; the browser uses the .js file. */
export const isTestTwin = (relPath, exists) => relPath.endsWith('.mjs') && exists(relPath.replace(/\.mjs$/, '.js'));

export const ASSETS_IGNORE = ['# Safety net: wrangler never uploads these even if they appear in the asset directory.', '**/node_modules', '**/.git', '**/.DS_Store', '*.map', '*.md', ''].join('\n');
