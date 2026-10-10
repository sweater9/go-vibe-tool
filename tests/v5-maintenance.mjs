import assert from 'node:assert/strict';
import fs from 'node:fs';
const home=fs.readFileSync('index.html','utf8');
const approved=`<span class="eyebrow">PRIVATE BY DESIGN · INTELLITOOLS</span>
      <h1>Your Data.<br>Your Browser.<br><em>Your Control.</em></h1>
      <p>IntelliTools is designed with your privacy in mind. Our browser-based tools process your files and information directly on your device, giving you greater control over your data. Our tools also work without an internet connection, and no account is required.</p>
      <div class="hero-privacy-points" aria-label="IntelliTools privacy benefits"><span>✓ On-device processing</span><span>✓ Works offline</span><span>✓ No account required</span></div>`;
assert.ok(home.includes(approved),'approved privacy block must remain byte-for-byte unchanged');
assert.ok(!home.includes('</section>\\n'),'no literal section newline escape');
assert.match(home, /id="toolSearch" aria-label="Search tools by task or result"/);
console.log('V5 maintenance: approved privacy block, homepage escape, and search label PASS');
