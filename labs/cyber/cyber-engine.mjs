/* GoVibeTool Cybersecurity Lab — engine. Educational demonstrations only; runs entirely in the browser with WebCrypto.
   Nothing here protects real data and no password or text is ever sent anywhere. */
const subtle = () => globalThis.crypto.subtle;
const enc = new TextEncoder(), dec = new TextDecoder();
export const toHex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
export const fromHex = hex => new Uint8Array((hex.match(/../g) || []).map(h => parseInt(h, 16)));

export async function sha256Hex(text) { return toHex(await subtle().digest('SHA-256', enc.encode(text))); }
/** Number of differing bits between two equal-length hex strings. */
export function bitDifference(a, b) { let n = 0; for (let i = 0; i < a.length; i++) { let x = parseInt(a[i], 16) ^ parseInt(b[i], 16); while (x) { n += x & 1; x >>= 1; } } return n; }
export const hexBits = hex => [...hex].flatMap(c => { const v = parseInt(c, 16); return [8, 4, 2, 1].map(m => (v & m ? 1 : 0)); });

/* ---- classical ciphers (insecure by design) ---- */
const A = 'abcdefghijklmnopqrstuvwxyz';
export function caesar(text, shift) { const s = ((shift % 26) + 26) % 26; return [...text].map(ch => { const i = A.indexOf(ch.toLowerCase()); if (i < 0) return ch; const o = A[(i + s) % 26]; return ch === ch.toUpperCase() ? o.toUpperCase() : o; }).join(''); }
export function vigenere(text, key, decrypt = false) { const k = key.toLowerCase().replace(/[^a-z]/g, ''); if (!k) return text; let j = 0; return [...text].map(ch => { const i = A.indexOf(ch.toLowerCase()); if (i < 0) return ch; const sh = A.indexOf(k[j++ % k.length]) * (decrypt ? -1 : 1); const o = A[(((i + sh) % 26) + 26) % 26]; return ch === ch.toUpperCase() ? o.toUpperCase() : o; }).join(''); }
export const ENGLISH_FREQ = [8.17, 1.49, 2.78, 4.25, 12.7, 2.23, 2.02, 6.09, 6.97, 0.15, 0.77, 4.03, 2.41, 6.75, 7.51, 1.93, 0.1, 5.99, 6.33, 9.06, 2.76, 0.98, 2.36, 0.15, 1.97, 0.07];
export function letterFrequency(text) { const c = Array(26).fill(0); let n = 0; for (const ch of text.toLowerCase()) { const i = A.indexOf(ch); if (i >= 0) { c[i]++; n++; } } return c.map(x => (n ? 100 * x / n : 0)); }
/** Brute-force every shift and rank by chi-squared distance to English letter frequencies. */
export function crackCaesar(cipher) { let best = { shift: 0, score: Infinity }; for (let s = 0; s < 26; s++) { const f = letterFrequency(caesar(cipher, -s)); const chi = f.reduce((a, x, i) => a + (x - ENGLISH_FREQ[i]) ** 2 / ENGLISH_FREQ[i], 0); if (chi < best.score) best = { shift: s, score: chi }; } return { shift: best.shift, plaintext: caesar(cipher, -best.shift), confidence: best.score }; }

/* ---- AES-GCM with a passphrase (PBKDF2-SHA256) ---- */
export const PBKDF2_ITERATIONS = 100000;
async function deriveKey(pass, salt, iterations) { const base = await subtle().importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']); return subtle().deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); }
export async function aesEncrypt(plain, pass, { iterations = PBKDF2_ITERATIONS, salt, iv } = {}) {
  salt = salt || crypto.getRandomValues(new Uint8Array(16)); iv = iv || crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, await deriveKey(pass, salt, iterations), enc.encode(plain));
  return { saltHex: toHex(salt), ivHex: toHex(iv), ctHex: toHex(ct), iterations };
}
/** Returns {ok:true, text} or {ok:false, reason}. Wrong passphrase and tampering are indistinguishable by design (authenticated encryption). */
export async function aesDecrypt(pkg, pass) {
  try { const pt = await subtle().decrypt({ name: 'AES-GCM', iv: fromHex(pkg.ivHex) }, await deriveKey(pass, fromHex(pkg.saltHex), pkg.iterations), fromHex(pkg.ctHex)); return { ok: true, text: dec.decode(pt) }; }
  catch { return { ok: false, reason: 'Authentication failed: wrong passphrase or modified data.' }; }
}
export const flipBit = (hex, index = 0) => { const b = fromHex(hex); b[index % b.length] ^= 1; return toHex(b); };

/* ---- passwords ---- */
export const COMMON_PASSWORDS = '123456 password 12345678 qwerty 123456789 12345 1234 111111 1234567 dragon 123123 baseball abc123 football monkey letmein shadow master 666666 qwertyuiop 123321 mustang 1234567890 michael 654321 superman 1qaz2wsx 7777777 121212 000000 qazwsx 123qwe killer trustno1 jordan jennifer zxcvbnm asdfgh hunter buster soccer harley batman andrew tigger sunshine iloveyou 2000 charlie robert thomas hockey ranger daniel starwars klaster 112233 george computer michelle jessica pepper 1111 zxcvbn 555555 11111111 131313 freedom 777777 pass maggie 159753 aaaaaa ginger princess joshua cheese amanda summer love ashley nicole chelsea biteme matthew access yankees 987654321 dallas austin thunder taylor matrix welcome admin password1 password123 letmein1 qwerty123 welcome1 p@ssw0rd'.split(' ');
const SEQ = ['abcdefghijklmnopqrstuvwxyz', 'qwertyuiopasdfghjklzxcvbnm', '0123456789'];
export function charsetSize(pw) { let n = 0; if (/[a-z]/.test(pw)) n += 26; if (/[A-Z]/.test(pw)) n += 26; if (/[0-9]/.test(pw)) n += 10; if (/[^a-zA-Z0-9]/.test(pw)) n += 33; return n; }
export function passwordAnalysis(pw) {
  const lower = pw.toLowerCase(), rank = COMMON_PASSWORDS.indexOf(lower), common = rank >= 0;
  const naive = pw.length ? pw.length * Math.log2(Math.max(2, charsetSize(pw))) : 0;
  const repeated = /(.)\1{2,}/.test(pw), seq = pw.length >= 4 && SEQ.some(s => { for (let i = 0; i + 4 <= lower.length; i++) { const part = lower.slice(i, i + 4); if (s.includes(part) || [...s].reverse().join('').includes(part)) return true; } return false; });
  let bits = naive; if (common) bits = Math.min(bits, Math.log2(rank + 2)); else { if (repeated) bits *= 0.75; if (seq) bits *= 0.75; }
  const label = bits < 28 ? 'Very weak' : bits < 36 ? 'Weak' : bits < 60 ? 'Fair' : bits < 80 ? 'Strong' : 'Very strong';
  return { bits, naiveBits: naive, common, rank, repeated, sequence: seq, label, length: pw.length, classes: [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter(r => r.test(pw)).length };
}
/** Average time to find a password with `bits` of entropy: half the search space at `guessesPerSecond`. */
export const crackSeconds = (bits, guessesPerSecond) => Math.pow(2, Math.max(0, bits - 1)) / guessesPerSecond;
export function humanTime(sec) {
  if (sec < 1) return 'instantly'; const u = [['year', 31557600], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
  if (sec >= 31557600 * 1e9) return 'billions of years'; if (sec >= 31557600 * 1e6) return 'millions of years'; if (sec >= 31557600 * 1e3) return 'thousands of years';
  for (const [name, s] of u) if (sec >= s) { const n = Math.floor(sec / s); return `${n.toLocaleString('en-US')} ${name}${n === 1 ? '' : 's'}`; } return 'instantly';
}
export const ATTACKERS = [{ id: 'online', label: 'Online guessing (throttled, ~10 per second)', rate: 10 }, { id: 'slow', label: 'Stolen database, slow hash (~10,000/s)', rate: 1e4 }, { id: 'fast', label: 'Stolen database, fast hash on GPUs (~10 billion/s)', rate: 1e10 }];
export const passphraseBits = (words, listSize) => words * Math.log2(listSize);
export function makePassphrase(rand, words, list) { return Array.from({ length: words }, () => list[Math.floor(rand() * list.length)]).join('-'); }

/* ---- authentication storage ---- */
export async function makeRecord(pw, mode, rand = Math.random) {
  if (mode === 'plain') return { mode, stored: pw };
  if (mode === 'sha') return { mode, stored: await sha256Hex(pw) };
  const salt = toHex(Uint8Array.from({ length: 8 }, () => Math.floor(rand() * 256))), iters = 2000; let h = salt + pw; for (let i = 0; i < iters; i++) h = await sha256Hex(h);
  return { mode: 'salted', salt, iterations: iters, stored: h };
}
export async function checkPassword(rec, pw) { return rec.mode === 'plain' ? rec.stored === pw : rec.mode === 'sha' ? rec.stored === await sha256Hex(pw) : rec.stored === (await makeRecord.hashSalted(rec.salt, pw, rec.iterations)); }
makeRecord.hashSalted = async (salt, pw, iterations) => { let h = salt + pw; for (let i = 0; i < iterations; i++) h = await sha256Hex(h); return h; };
/** What an attacker with a stolen database gets from a dictionary. Returns {cracked:[{user,password}], hashes:number}. */
export async function attackDatabase(db, dictionary) {
  const cracked = []; let hashes = 0; let table = null;
  for (const u of db) {
    const r = u.record;
    if (r.mode === 'plain') { cracked.push({ user: u.user, password: r.stored, how: 'read directly' }); continue; }
    if (r.mode === 'sha') { if (!table) { table = new Map(); for (const w of dictionary) { table.set(await sha256Hex(w), w); hashes++; } } if (table.has(r.stored)) cracked.push({ user: u.user, password: table.get(r.stored), how: 'precomputed table lookup' }); continue; }
    for (const w of dictionary) { hashes += r.iterations; if (await makeRecord.hashSalted(r.salt, w, r.iterations) === r.stored) { cracked.push({ user: u.user, password: w, how: 'per-user brute force' }); break; } }
  }
  return { cracked, hashes };
}
/** Lockout model: after `maxFails` failures wait `base * 2^(fails - maxFails)` seconds (capped). */
export function lockoutDelay(fails, maxFails = 5, base = 30, cap = 86400) { return fails < maxFails ? 0 : Math.min(cap, base * Math.pow(2, fails - maxFails)); }
export function onlineAttackSeconds(guesses, perSecond, throttled) { return throttled ? guesses / perSecond * 1 : guesses / perSecond; }

/* ---- phishing awareness heuristics ---- */
export const KNOWN_SITES = ['paypal.com', 'google.com', 'apple.com', 'microsoft.com', 'amazon.com', 'netflix.com', 'facebook.com', 'github.com', 'dropbox.com', 'linkedin.com'];
export function levenshtein(a, b) { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; }
export function analyseUrl(input) {
  const f = []; let url; const raw = input.trim();
  try { url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : 'https://' + raw); } catch { return { score: 0, valid: false, findings: [{ id: 'invalid', weight: 0, text: 'That does not look like a web address.' }] }; }
  const host = url.hostname.toLowerCase(), labels = host.split('.'), reg = labels.slice(-2).join('.');
  if (url.protocol === 'http:') f.push({ id: 'http', weight: 15, text: 'Uses plain http (no encryption). Legitimate login pages use https.' });
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) f.push({ id: 'ip', weight: 35, text: 'The address is a raw IP number instead of a name.' });
  if (url.username || raw.includes('@')) f.push({ id: 'at', weight: 30, text: 'Contains “@” — everything before it is ignored by the browser, a classic disguise.' });
  if (host.includes('xn--')) f.push({ id: 'puny', weight: 35, text: 'Uses punycode (xn--), which can hide look-alike foreign characters.' });
  if (labels.length >= 5) f.push({ id: 'subs', weight: 15, text: 'Many subdomains can bury the real domain at the end.' });
  if ((host.match(/-/g) || []).length >= 3) f.push({ id: 'hyphens', weight: 10, text: 'Lots of hyphens is common in throw-away phishing domains.' });
  if (/\.(zip|top|xyz|click|work|support|country)$/.test(host)) f.push({ id: 'tld', weight: 10, text: 'Uses a top-level domain often seen in abuse reports (not proof by itself).' });
  const name = labels.length >= 2 ? labels[labels.length - 2] : host;
  for (const k of KNOWN_SITES) { const kn = k.split('.')[0]; if (reg !== k) { if (name.split('-').some(part => part !== kn && levenshtein(part, kn) <= 2 && part.length >= 4)) { f.push({ id: 'lookalike', weight: 40, text: `“${reg}” is a near-copy of ${k}.` }); break; } if (host.includes(kn) && !host.endsWith('.' + k)) { f.push({ id: 'brandinhost', weight: 30, text: `Mentions “${kn}” but the real domain is ${reg}.` }); break; } } }
  if (/(login|verify|secure|account|update|confirm|wallet)/.test(url.pathname + url.search) && f.length) f.push({ id: 'words', weight: 5, text: 'Account-related words in the path add to the suspicion.' });
  const score = Math.min(100, f.reduce((a, x) => a + x.weight, 0));
  return { score, valid: true, host, registeredDomain: reg, findings: f, verdict: score >= 50 ? 'High risk' : score >= 20 ? 'Be careful' : 'No obvious red flags' };
}
export function analyseMessage(text) {
  const t = text.toLowerCase(), f = [];
  const add = (id, weight, msg) => f.push({ id, weight, text: msg });
  if (/(urgent|immediately|within 24 hours|final notice|act now|suspended|will be closed|last warning)/.test(t)) add('urgency', 25, 'Creates urgency or fear to rush you.');
  if (/(password|ssn|social security|card number|pin\b|verify your account|confirm your identity|login details)/.test(t)) add('creds', 30, 'Asks for sensitive details or a login.');
  if (/(gift card|wire transfer|bitcoin|crypto wallet|western union)/.test(t)) add('payment', 30, 'Asks for hard-to-reverse payment methods.');
  if (/(dear customer|dear user|dear sir|valued member)/.test(t)) add('generic', 10, 'Generic greeting instead of your name.');
  if (/(you have won|prize|lottery|free gift|claim your reward)/.test(t)) add('prize', 25, 'Too-good-to-be-true reward.');
  if (/(click (here|the link)|open the attachment|download the (file|invoice))/.test(t)) add('click', 15, 'Pushes you to click a link or open an attachment.');
  const urls = text.match(/https?:\/\/[^\s)]+|\b[a-z0-9.-]+\.(?:com|net|org|io|xyz|top|click)\b[^\s)]*/gi) || [];
  for (const u of urls) { const a = analyseUrl(u); if (a.valid && a.score >= 20) { add('url', Math.min(40, a.score), `Link ${u} looks suspicious: ${a.findings[0].text}`); break; } }
  const score = Math.min(100, f.reduce((a, x) => a + x.weight, 0));
  return { score, findings: f, verdict: score >= 50 ? 'High risk' : score >= 20 ? 'Be careful' : 'No obvious red flags' };
}
export const QUIZ = [
  { id: 'q1', kind: 'url', content: 'https://accounts.google.com/signin', phish: false, why: 'The registered domain is google.com and the connection is https. The sub-domain “accounts” is normal.' },
  { id: 'q2', kind: 'url', content: 'http://paypa1-secure-login.com/verify', phish: true, why: 'paypa1 uses the digit 1 instead of the letter l, the site is plain http, and the word secure in the name is a lure.' },
  { id: 'q3', kind: 'email', content: 'Subject: Final notice — your account will be closed within 24 hours. Dear customer, verify your account password now: http://bank-update.xyz/login', phish: true, why: 'Urgency, a generic greeting, a request for your password and an odd link are all red flags. Go to the bank site yourself instead.' },
  { id: 'q4', kind: 'email', content: 'Hi Sam, the team lunch is moved to 1 pm on Friday. See you in the usual room. — Priya', phish: false, why: 'A personal, specific message with no link, no pressure and no request for sensitive data.' },
  { id: 'q5', kind: 'url', content: 'https://github.com@evil.example.net/login', phish: true, why: 'Everything before the @ is ignored. The browser would actually visit evil.example.net.' },
  { id: 'q6', kind: 'email', content: 'You have won a free gift! Click here to claim your reward. Pay a small delivery fee with a gift card.', phish: true, why: 'Unexpected prize plus a request for hard-to-trace payment (gift cards) is a standard scam.' },
];
