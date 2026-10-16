import { el, slider, select, button, bars, mountLab, fmt, clamp, rng } from '../shared/kit.js';
import * as X from './cyber-engine.js';

const controls = parent => { const c = el('div', { class: 'lk-controls' }); parent.append(c); return c; };
const field = (parent, id, label, tag = 'input', attrs = {}) => { const i = el(tag, { id, ...attrs }); parent.append(el('div', { class: 'lk-field' }, el('label', { for: id }, label), i)); return i; };
const mono = (parent, text = '') => { const m = el('div', { class: 'lk-mono', 'aria-live': 'off' }, text); parent.append(m); return m; };
const readout = (parent, items) => { const box = el('div', { class: 'lk-readout' }); const map = {}; for (const [k, label] of items) { const v = el('strong', {}, '—'); map[k] = v; box.append(el('div', { class: 'lk-stat' }, el('small', {}, label), v)); } parent.append(box); return (k, v) => { map[k].textContent = v; }; };
const bar = (box, label, value, max, text) => box.append(el('div', { class: 'lk-bar' }, el('span', {}, label), el('i', { style: `width:${clamp(value / max, 0, 1) * 100}%` }), el('span', {}, text)));
const WORDS = 'amber anchor apple arrow aspen badge bamboo basil beacon birch breeze bridge cactus candle canyon cedar cherry cliff clover cobalt comet coral crater daisy delta dune eagle ember falcon fern fjord flint forest galaxy garnet glacier harbor hazel heron iris island jade jungle kettle lantern lemon lotus maple meadow mint moss nectar oasis olive orbit otter pearl pebble pine plume quartz raven reef river saffron sage sailor shadow silver spruce storm sunset thistle tulip valley velvet willow zephyr'.split(' ');

// ===== 1. Hashing & avalanche =====
function hashExp(stage, ctx) {
  const ctl = controls(stage), input = field(ctl, 'h-text', 'Message to hash', 'input', { type: 'text', value: 'hello world', autocomplete: 'off', spellcheck: 'false' });
  const out = mono(stage), out2 = mono(stage); const set = readout(stage, [['bits', 'Bits that changed'], ['pct', 'Share changed']]);
  const grid = el('div', { class: 'lk-bitgrid', role: 'img', 'aria-label': 'Bit comparison grid' }); stage.append(grid);
  const row = el('div', { class: 'lk-row' }); stage.append(row);
  let state = { hashed: false, flipped: false, pct: 0, same: false }, last = null;
  async function run(flip) {
    const a = input.value; const b = flip ? (a.length ? a.slice(0, -1) + String.fromCharCode(a.charCodeAt(a.length - 1) ^ 1) : 'a') : a;
    const [h1, h2] = [await X.sha256Hex(a), await X.sha256Hex(b)]; out.textContent = 'SHA-256(original) = ' + h1; out2.textContent = 'SHA-256(' + (flip ? 'one bit changed' : 'same text') + ') = ' + h2;
    const d = X.bitDifference(h1, h2), pct = d / 256 * 100; set('bits', `${d} of 256`); set('pct', fmt(pct, 1) + '%');
    const b1 = X.hexBits(h1), b2 = X.hexBits(h2); grid.replaceChildren(...b1.map((v, i) => el('i', { class: v !== b2[i] ? 'diff' : '' })));
    grid.setAttribute('aria-label', `${d} of 256 hash bits differ (${fmt(pct, 1)} percent).`);
    state = { hashed: true, flipped: flip, pct, same: !flip, len: h1.length, deterministic: !flip && h1 === h2 }; last = state; ctx.report({ ...state, hashedTwice: true }); ctx.announce(`${d} of 256 bits changed.`);
  }
  button(row, 'Hash the message', () => run(false)); button(row, 'Change one bit and compare', () => run(true), 'ghost');
  const ex = el('div', { class: 'lk-row' }); stage.append(ex);
  select(ex, { id: 'h-ex', label: 'Examples', options: [{ value: '', label: 'Choose an example…' }, { value: 'hello world', label: 'hello world' }, { value: 'Hello world', label: 'Hello world (capital H)' }, { value: 'The quick brown fox jumps over the lazy dog', label: 'Pangram' }, { value: '', label: 'Empty text' }], value: '', onChange: v => { input.value = v; run(false); } });
  input.addEventListener('input', () => { run(false); });
  run(false);
  return { reset: () => { input.value = 'hello world'; run(false); } };
}
const hashSteps = [
  { text: 'Hash a message and note the 64-character result (256 bits).', check: s => s.hashed && s.len === 64 },
  { text: 'Change just one bit — about half of the output bits flip (the avalanche effect).', check: s => s.flipped && s.pct > 35 && s.pct < 65 },
];

// ===== 2. Encryption =====
function cipherExp(stage, ctx) {
  const ctl = controls(stage), msg = field(ctl, 'e-msg', 'Secret message', 'textarea', { rows: 3 }); msg.value = 'Meet me at the library at noon';
  const kind = select(ctl, { id: 'e-kind', label: 'Method', options: [{ value: 'caesar', label: 'Caesar shift (ancient, trivially breakable)' }, { value: 'vig', label: 'Vigenère (older, still breakable)' }, { value: 'aes', label: 'AES-GCM with a passphrase (modern)' }], value: 'caesar', onChange: () => compute() });
  const shift = slider(ctl, { id: 'e-shift', label: 'Caesar shift', min: 1, max: 25, value: 3, format: v => fmt(v, 0), onInput: () => compute() });
  const key = field(ctl, 'e-key', 'Key / passphrase', 'input', { type: 'text', value: 'lemon', autocomplete: 'off', spellcheck: 'false' });
  const cipherOut = mono(stage), note = el('p', { class: 'lk-hint', role: 'status' }); stage.append(note);
  const freq = bars(stage, { label: 'Letter frequency of the ciphertext' }); const row = el('div', { class: 'lk-row' }); stage.append(row);
  let pkg = null, st = { method: 'caesar', cracked: false, tampered: false, wrongRejected: false, aesDone: false };
  const draw = text => { freq.replaceChildren(); const f = X.letterFrequency(text); const top = f.map((v, i) => [String.fromCharCode(97 + i), v]).sort((a, b) => b[1] - a[1]).slice(0, 6); for (const [l, v] of top) bar(freq, l.toUpperCase(), v, Math.max(0.2, top[0][1]), fmt(v * 100, 1) + '%'); freq.setAttribute('aria-label', 'Most common letters in the ciphertext: ' + top.map(t => t[0]).join(', ')); };
  async function compute() {
    const k = kind.get(); shift.el.hidden = k !== 'caesar'; st.method = k; note.textContent = '';
    if (k === 'caesar') { const c = X.caesar(msg.value, shift.get()); cipherOut.textContent = c; draw(c); }
    else if (k === 'vig') { const c = X.vigenere(msg.value, key.value); cipherOut.textContent = c; draw(c); }
    else { pkg = await X.aesEncrypt(msg.value, key.value || ' ', { iterations: 20000 }); cipherOut.textContent = `salt ${pkg.saltHex}\niv ${pkg.ivHex}\nciphertext+tag ${pkg.ctHex}`; draw(pkg.ctHex.replace(/[0-9]/g, '')); st.aesDone = true; note.textContent = 'AES-GCM output looks random: no letter pattern to exploit. Try the buttons below.'; }
    ctx.report({ ...st });
  }
  button(row, 'Crack it without the key', () => {
    if (kind.get() !== 'caesar') { note.textContent = 'Frequency analysis cracks Caesar easily. Switch to “Caesar shift” to try it; Vigenère needs more work and AES-GCM resists it.'; return; }
    const c = X.caesar(msg.value, shift.get()), r = X.crackCaesar(c); note.textContent = `Frequency analysis guessed shift ${r.shift}: “${X.caesar(c, -r.shift)}”. Only 25 possibilities — no key needed.`; st.cracked = true; ctx.report({ ...st }); ctx.announce('Caesar cipher cracked by trying all shifts.'); }, 'ghost');
  button(row, 'Tamper with 1 bit & decrypt', async () => { if (kind.get() !== 'aes') { note.textContent = 'Switch to AES-GCM to see authenticated encryption detect tampering.'; return; } const bad = { ...pkg, ctHex: X.flipBit(pkg.ctHex, 2) }; const r = await X.aesDecrypt(bad, key.value || ' '); note.textContent = r.ok ? 'Unexpectedly decrypted.' : '✗ ' + r.reason; st.tampered = !r.ok; ctx.report({ ...st }); });
  button(row, 'Decrypt with wrong passphrase', async () => { if (kind.get() !== 'aes') { note.textContent = 'Switch to AES-GCM first.'; return; } const r = await X.aesDecrypt(pkg, (key.value || ' ') + 'x'); note.textContent = r.ok ? 'Unexpectedly decrypted.' : '✗ ' + r.reason; st.wrongRejected = !r.ok; ctx.report({ ...st }); });
  button(row, 'Decrypt correctly', async () => { if (kind.get() !== 'aes') { note.textContent = 'Switch to AES-GCM first.'; return; } const r = await X.aesDecrypt(pkg, key.value || ' '); note.textContent = r.ok ? '✓ Decrypted: ' + r.text : '✗ ' + r.reason; });
  [msg, key].forEach(i => i.addEventListener('input', () => compute())); compute();
  return { reset: () => { msg.value = 'Meet me at the library at noon'; key.value = 'lemon'; kind.set('caesar'); shift.set(3); st = { method: 'caesar', cracked: false, tampered: false, wrongRejected: false, aesDone: false }; compute(); } };
}
const cipherSteps = [
  { text: 'Encrypt with a Caesar shift, then crack it without the key.', check: s => s.cracked },
  { text: 'Switch to AES-GCM and encrypt with a passphrase.', check: s => s.aesDone },
  { text: 'Tamper with one bit — the decryption is rejected.', check: s => s.tampered },
  { text: 'Decrypt with the wrong passphrase — it is also rejected.', check: s => s.wrongRejected },
];

// ===== 3. Password security =====
function passwordExp(stage, ctx) {
  const ctl = controls(stage), pw = field(ctl, 'p-pw', 'Try a password (never type a real one)', 'input', { type: 'text', value: '', autocomplete: 'off', spellcheck: 'false', placeholder: 'e.g. Summer2024!' });
  const meter = el('div', { class: 'lk-meter', role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': 'Password strength' }, el('i')); stage.append(meter);
  const set = readout(stage, [['label', 'Rating'], ['bits', 'Entropy'], ['len', 'Length']]); const notes = el('ul', { class: 'lk-list' }); stage.append(notes); const times = bars(stage, { label: 'Estimated time to crack' });
  const row = el('div', { class: 'lk-row' }); stage.append(row);
  let words = 4, st = { typed: false, common: false, passphrase: false, strongBits: 0 }, seed = 1;
  function update(isGenerated) {
    const a = X.passwordAnalysis(pw.value); set('label', pw.value ? a.label : '—'); set('bits', pw.value ? fmt(a.bits, 0) + ' bits' : '—'); set('len', pw.value.length);
    meter.firstChild.style.width = clamp(a.bits / 90, 0, 1) * 100 + '%'; meter.setAttribute('aria-valuenow', Math.round(clamp(a.bits / 90, 0, 1) * 100)); meter.setAttribute('aria-valuetext', pw.value ? a.label : 'No password');
    notes.replaceChildren(...[a.common && 'This is on the list of the most common passwords — attackers try these first.', a.repeated && 'Repeated characters are predictable.', a.sequence && 'Keyboard or alphabet sequences are guessed early.', pw.value && a.length < 12 && 'Length matters most: aim for 12+ characters or a multi-word passphrase.'].filter(Boolean).map(t => el('li', {}, t)));
    times.replaceChildren(); for (const at of X.ATTACKERS) { const s = X.crackSeconds(a.bits, at.rate); bar(times, at.id === 'online' ? 'Online' : at.id === 'slow' ? 'Slow hash' : 'Fast hash', Math.log10(s + 1), 14, pw.value ? X.humanTime(s) : '—'); }
    st = { ...st, typed: st.typed || !!pw.value, common: st.common || (a.common && !isGenerated), passphrase: st.passphrase || (!!isGenerated && a.bits >= 60), strongBits: Math.max(st.strongBits, a.bits) };
    ctx.report({ ...st, current: a }); }
  pw.addEventListener('input', () => update(false));
  slider(row.parentNode, { id: 'p-words', label: 'Passphrase words', min: 3, max: 7, value: 4, format: v => fmt(v, 0), onInput: v => { words = v; } });
  button(row, 'Generate a random passphrase', () => { seed = (seed * 7919 + Date.now()) % 1e9; pw.value = X.makePassphrase(rng(seed), words, WORDS); update(true); ctx.announce('Generated a passphrase of ' + words + ' random words.'); });
  button(row, 'Try “password123”', () => { pw.value = 'password123'; update(false); }, 'ghost');
  el('span', {}); const p = el('p', { class: 'lk-hint' }, `The passphrase generator draws from a ${WORDS.length}-word list, so each word adds about ${fmt(Math.log2(WORDS.length), 1)} bits. Random choice matters: a phrase you invent yourself is much weaker.`); stage.append(p);
  update(false);
  return { reset: () => { pw.value = ''; st = { typed: false, common: false, passphrase: false, strongBits: 0 }; update(false); } };
}
const passwordSteps = [
  { text: 'Try “password123” and see why common passwords fall instantly.', check: s => s.common },
  { text: 'Generate a random passphrase of 5+ words and compare cracking times.', check: s => s.passphrase },
];

// ===== 4. Authentication & storage =====
const USERS = [['alice', 'sunshine'], ['bob', 'hunter2'], ['carol', 'sunshine'], ['dave', 'N7#vq!r2xLp9']];
const DICT = 'password 123456 qwerty letmein sunshine hunter2 dragon monkey welcome iloveyou'.split(' ');
function authExp(stage, ctx) {
  const ctl = controls(stage), mode = select(ctl, { id: 'a-mode', label: 'How the site stores passwords', options: [{ value: 'plain', label: 'Plain text (never do this)' }, { value: 'sha', label: 'Plain SHA-256 hash (no salt)' }, { value: 'salted', label: 'Salted, repeated hash (better)' }], value: 'plain', onChange: () => build() });
  const tableBox = el('div', { class: 'lk-scroll' }); stage.append(tableBox); const result = el('div', { 'aria-live': 'polite' }); const row = el('div', { class: 'lk-row' });
  const lock = bars(stage, { label: 'Account lockout delays' });
  let db = [], st = { attacked: {}, modes: {}, lockoutSeen: false }, rand = rng(7);
  async function build() {
    db = []; for (const [user, p] of USERS) db.push({ user, record: await X.makeRecord(p, mode.get(), rand) });
    const t = el('table', { class: 'lk-table' }, el('thead', {}, el('tr', {}, el('th', {}, 'User'), el('th', {}, 'Stored value (what a thief would see)'))), el('tbody', {}, db.map(u => el('tr', {}, el('td', {}, u.user), el('td', { class: 'lk-mono' }, (u.record.salt ? u.record.salt + ':' : '') + u.record.stored)))));
    tableBox.replaceChildren(t); result.replaceChildren(); }
  button(row, 'Simulate a stolen database', async () => {
    const m = mode.get(), r = await X.attackDatabase(db, DICT); st.attacked[m] = r.cracked.length; st.modes[m] = true;
    const ul = el('ul', { class: 'lk-list' }, r.cracked.map(c => el('li', {}, `${c.user}: “${c.password}” — ${c.how}`)));
    result.replaceChildren(el('p', {}, `Cracked ${r.cracked.length} of ${db.length} accounts using a ${DICT.length}-word dictionary (${r.hashes.toLocaleString('en-US')} hash computations).`), ul, el('p', { class: 'lk-hint' }, m === 'sha' ? 'Alice and Carol share a password, so their hashes are identical — a giveaway. One lookup table cracks both.' : m === 'salted' ? 'Each user has a different salt, so identical passwords look different and the work must be repeated per user. Dave’s long random password survives every mode.' : 'Nothing to crack — the passwords were stored as-is.'));
    ctx.report({ ...st, count: r.cracked.length, mode: m }); ctx.announce(`Cracked ${r.cracked.length} accounts.`); });
  button(row, 'Show lockout delays', () => { lock.replaceChildren(); for (let f = 3; f <= 10; f++) { const d = X.lockoutDelay(f); bar(lock, f + ' fails', Math.log10(d + 1), 5, d ? X.humanTime(d) : 'none'); } st.lockoutSeen = true; ctx.report({ ...st }); }, 'ghost');
  stage.append(row, result); build();
  return { reset: () => { mode.set('plain'); st = { attacked: {}, modes: {}, lockoutSeen: false }; lock.replaceChildren(); build(); } };
}
const authSteps = [
  { text: 'Run the stolen-database attack against plain-text storage — everything is exposed.', check: s => s.modes.plain },
  { text: 'Try plain SHA-256: shared passwords expose each other.', check: s => s.modes.sha },
  { text: 'Switch to salted hashing and attack again — fewer accounts fall.', check: s => s.modes.salted && s.attacked.salted < (s.attacked.sha ?? 99) },
  { text: 'Look at how lockout delays slow online guessing.', check: s => s.lockoutSeen },
];

// ===== 5. Threat awareness =====
function threatExp(stage, ctx) {
  const ctl = controls(stage), input = field(ctl, 't-in', 'Paste a web address or message to analyse', 'textarea', { rows: 3, spellcheck: 'false' });
  input.value = 'http://paypa1-secure-login.com/verify'; const out = el('div', { 'aria-live': 'polite' }); stage.append(out);
  const quiz = el('div', { class: 'lk-quiz' }); stage.append(el('h3', {}, 'Spot the scam'), quiz);
  let st = { analysed: false, answered: 0, correct: 0 };
  const analyse = () => { const v = input.value.trim(); const looksUrl = v && !/\s/.test(v); const r = looksUrl ? X.analyseUrl(v) : X.analyseMessage(v);
    out.replaceChildren(el('p', {}, el('strong', {}, `${r.verdict} — score ${r.score}/100`)), el('ul', { class: 'lk-list' }, (r.findings.length ? r.findings : [{ text: 'No obvious red flags found by these simple rules. That does not prove it is safe.' }]).map(f => el('li', {}, f.text))));
    st.analysed = true; ctx.report({ ...st, score: r.score }); };
  const row = el('div', { class: 'lk-row' }); stage.append(row, quiz); button(row, 'Analyse', analyse); button(row, 'Try a disguised link', () => { input.value = 'https://github.com@evil.example.net/login'; analyse(); }, 'ghost');
  let qi = 0;
  const showQ = () => { quiz.replaceChildren(); if (qi >= X.QUIZ.length) { quiz.append(el('p', {}, `Quiz finished: ${st.correct} of ${X.QUIZ.length} correct.`)); return; } const q = X.QUIZ[qi]; const fb = el('p', { role: 'status' });
    const ans = guess => { const ok = guess === q.phish; st.answered++; if (ok) st.correct++; fb.textContent = (ok ? '✓ Correct. ' : '✗ Not quite. ') + q.why; ctx.report({ ...st }); next.hidden = false; yes.disabled = no.disabled = true; };
    const yes = el('button', { type: 'button', class: 'lk-btn', onclick: () => ans(true) }, 'Phishing'), no = el('button', { type: 'button', class: 'lk-btn ghost', onclick: () => ans(false) }, 'Legitimate'), next = el('button', { type: 'button', class: 'lk-btn', hidden: true, onclick: () => { qi++; showQ(); } }, qi === X.QUIZ.length - 1 ? 'Finish' : 'Next');
    quiz.append(el('p', {}, el('b', {}, `Question ${qi + 1} of ${X.QUIZ.length}: `), q.kind === 'url' ? 'Is this link safe?' : 'Is this message safe?'), el('div', { class: 'lk-mono' }, q.content), el('div', { class: 'lk-row' }, yes, no, next), fb); };
  showQ(); analyse(); st.analysed = false;
  return { reset: () => { qi = 0; st = { analysed: false, answered: 0, correct: 0 }; input.value = 'http://paypa1-secure-login.com/verify'; showQ(); analyse(); st.analysed = false; } };
}
const threatSteps = [
  { text: 'Analyse the sample address and read the red flags.', check: s => s.analysed },
  { text: 'Answer 3 quiz questions.', check: s => s.answered >= 3 },
  { text: 'Get at least 4 quiz answers right.', check: s => s.correct >= 4 },
];

const experiments = [
  { id: 'hashing', title: 'Hashing & avalanche', summary: 'See how a one-bit change scrambles a SHA-256 fingerprint.',
    explain: '<p>A <b>hash</b> turns any input into a fixed-size fingerprint. It is one-way and deterministic. Changing a single input bit flips about half of the output bits — the <b>avalanche effect</b> — so similar inputs have unrelated hashes.</p><p>Hashes check integrity (downloads, files) and, with care, store passwords. They are not encryption: there is no key to get the text back.</p>',
    real: 'Uses your browser’s real SHA-256 locally. Nothing you type leaves the page.', build: hashExp, steps: hashSteps },
  { id: 'encryption', title: 'Encryption', summary: 'Break an ancient cipher, then see why modern authenticated encryption holds up.',
    explain: '<p>Caesar and Vigenère hide letters but keep language patterns, so <b>frequency analysis</b> breaks them. Modern <b>AES-GCM</b> turns data into random-looking bytes and adds an authentication tag, so any change or wrong key is rejected.</p><p>The passphrase is stretched into a key with PBKDF2 and a random salt.</p>',
    real: 'Educational demo using the browser’s WebCrypto locally (reduced PBKDF2 iterations for speed). Do not use this page to protect real secrets.', build: cipherExp, steps: cipherSteps },
  { id: 'passwords', title: 'Password security', summary: 'Compare weak passwords and random passphrases against different attackers.',
    explain: '<p>Strength is about how many guesses an attacker needs. Length and randomness add <b>bits of entropy</b>; each bit doubles the work. Common passwords are tried first, so they fall instantly regardless of symbols.</p><p>How fast an attacker guesses depends on where they attack: online services throttle, stolen databases protected with fast hashes do not.</p>',
    real: 'Estimates are simplified models, not guarantees. Never type a password you use anywhere real; nothing is stored or sent.', build: passwordExp, steps: passwordSteps },
  { id: 'authentication', title: 'Authentication & salting', summary: 'See what a database thief sees when passwords are stored badly or well.',
    explain: '<p>Sites should never store passwords in plain text. A plain hash hides the text but identical passwords produce identical hashes, and precomputed tables crack common ones in bulk. A per-user <b>salt</b> plus a deliberately slow, repeated hash forces the attacker to work per account.</p><p>Real systems use purpose-built algorithms (Argon2, scrypt, bcrypt).</p>',
    real: 'A fictional user table with made-up passwords and a tiny dictionary. This is a teaching model, not a real attack tool.', build: authExp, steps: authSteps },
  { id: 'threats', title: 'Threat awareness', summary: 'Learn the red flags of phishing links and scam messages, then test yourself.',
    explain: '<p>Phishing tricks you into trusting a fake. Check the <b>registered domain</b> (the part right before the first slash, ending in .com etc.), watch for look-alike spellings, urgency, and requests for passwords or hard-to-reverse payments.</p><p>When unsure, go to the site by typing the address yourself.</p>',
    real: 'Simple rule-based checks that miss many real attacks and may flag harmless items. Nothing is fetched; no link is opened.', build: threatExp, steps: threatSteps },
];
mountLab({ lab: 'cyber', root: document.getElementById('labRoot'), experiments });
