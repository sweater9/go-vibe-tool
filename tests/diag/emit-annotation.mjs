/* Test-only CI helper: print a GitHub Actions workflow-command annotation from a file.
   Annotations are the one CI output readable through the REST API (check-runs/<id>/annotations).
   Usage: node tests/diag/emit-annotation.mjs <notice|warning|error> <title> <file> */
import fs from 'node:fs';
const [level, title, file] = process.argv.slice(2);
if (!['notice', 'warning', 'error'].includes(level) || !title || !file) { console.error('usage: emit-annotation.mjs <notice|warning|error> <title> <file>'); process.exit(2); }
let text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '(no file: ' + file + ')';
if (text.length > 60000) text = text.slice(0, 60000) + '\n…[truncated]';
const esc = value => value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const escProp = value => esc(value).replace(/:/g, '%3A').replace(/,/g, '%2C');
console.log(`::${level} title=${escProp(title)}::${esc(text)}`);
