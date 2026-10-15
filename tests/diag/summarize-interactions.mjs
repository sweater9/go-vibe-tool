/* Test-only CI helper: condense Studio interaction recordings for checks that failed.
   Usage: node tests/diag/summarize-interactions.mjs <artifact-dir> */
import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2];
const lines = [];
const readJson = file => { try { return JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); } catch { return null; } };
const results = readJson('results.json');
const failed = (results?.results || []).filter(r => !r.ok);
if (!failed.length) { console.log('no failed checks in ' + dir); process.exit(0); }
const short = value => value ? [value.id, value.buttonId, value.studio].filter(Boolean).join('/') || value.tag : '-';
for (const width of [375, 1280]) {
  const log = readJson(`interactions-${width}.json`);
  const mine = failed.filter(f => f.label.startsWith(String(width)));
  if (!mine.length) continue;
  lines.push(`== ${width}px failures: ${mine.map(f => f.label + ' :: ' + String(f.error).split('\n')[0].slice(0, 160)).join(' | ')}`);
  if (!log) { lines.push('no interaction log'); continue; }
  lines.push(`events=${log.events.length} dropped=${log.droppedEvents} collectionError=${log.collectionError}`);
  for (const f of mine) {
    const events = log.events.filter(e => e.check === f.label || (e.type === 'test-step' && e.label === f.label));
    lines.push(`-- ${f.label} (${events.length} events)`);
    for (const e of events.slice(-40)) {
      if (e.type === 'test-step') { lines.push(`   step ${e.status}`); continue; }
      lines.push(`   #${e.sequence} ${e.type} t=${Math.round(e.time)} target=${short(e.target)} hit=${short(e.hit)} xy=${e.x ?? '-'},${e.y ?? '-'} tab=${e.selectedTab} ws=${e.workspaceActive} rs=${e.readyState}${e.control ? ' control=' + e.control : ''}${e.result ? ' result=' + JSON.stringify(String(e.result).slice(0, 40)) : ''}`);
    }
  }
}
console.log(lines.join('\n'));
