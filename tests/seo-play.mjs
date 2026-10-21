/* Play section SEO regression: node tests/seo-play.mjs  (static, no browser). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(p, 'utf8');
const pages = { 'play/': 'play/index.html', 'play/2048/': 'play/2048/index.html', 'play/daily-word/': 'play/daily-word/index.html', 'play/word-logic/': 'play/word-logic/index.html', 'play/vibe-arcade/': 'play/vibe-arcade/index.html', 'play/taiwan-mahjong/': 'play/taiwan-mahjong/index.html' };
for (const [url, file] of Object.entries(pages)) {
  const h = read(file);
  const title = (h.match(/<title>([^<]+)<\/title>/) || [])[1];
  const desc = (h.match(/<meta name="description" content="([^"]+)"/) || [])[1];
  const canon = (h.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
  assert.ok(title && title.length >= 15 && title.length <= 90, `${file}: title length`);
  assert.ok(desc && desc.length >= 60 && desc.length <= 300, `${file}: description length`);
  assert.equal(canon, 'https://govibetool.com/' + url, `${file}: canonical`);
  assert.ok(!/Solitaire/i.test(desc + title), `${file}: stale Solitaire wording`);
}
const arcade = read('play/vibe-arcade/index.html');
const arcadeDesc = arcade.match(/<meta name="description" content="([^"]+)"/)[1];
for (const g of ['Vibeline', 'Twofold', 'Carve', 'Crown Grid', 'Loopcraft']) assert.ok(arcadeDesc.includes(g), 'Vibe Arcade description lists ' + g);
assert.ok(!/three original/i.test(arcadeDesc));
const daily = read('play/daily/index.html'); assert.match(daily, /noindex/, 'retired play/daily stub stays noindex');
const sm = read('sitemap.xml');
assert.ok(sm.includes('<loc>https://govibetool.com/play/taiwan-mahjong/</loc>'));
assert.ok(!/mahjong-solitaire/i.test(sm));
for (const m of sm.matchAll(/<loc>https:\/\/govibetool\.com\/(play\/[^<]*)<\/loc>/g)) assert.ok(fs.existsSync(m[1] + 'index.html'), 'sitemap page exists: ' + m[1]);
const disc = read('discovery.js');
assert.ok(!/solitaire/i.test(disc), 'discovery.js has no Solitaire entry');
assert.ok(disc.includes('href:"play/taiwan-mahjong/"'));
assert.ok(/Crown Grid/.test(disc) && !/Three original/.test(disc), 'Vibe Arcade discovery lists five games');
const playHtml = read('play/index.html');
assert.ok(!/mahjong-solitaire|Mahjong Solitaire/.test(playHtml));
for (const f of ['index.html', 'play/2048/index.html', 'play/daily-word/index.html', 'play/word-logic/index.html']) assert.ok(!/mahjong-solitaire|Mahjong Solitaire/.test(read(f)), f + ' still links Solitaire');
assert.match(read('_redirects'), /^\/play\/mahjong-solitaire\/\s+\/play\/taiwan-mahjong\/\s+301$/m);
console.log('seo-play ok');
