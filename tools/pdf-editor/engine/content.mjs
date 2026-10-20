/* Content-stream interpreter for the text-editing engine.
   Walks a page's content stream with the graphics/text state that matters for text and records, for every show operator,
   its byte range, the font/size/colour in force and the text matrices. It deliberately ignores everything that does not
   influence where text is drawn (paths, images, clipping), but it keeps every operation in `ops` so callers can verify
   that nothing unexpected sits between two text fragments. No PDF structure is needed here: fonts are supplied through
   the `fonts` callback so the module is testable on raw bytes. */
import { tokenize } from '../textedit.mjs';

export const IDENT = Object.freeze([1, 0, 0, 1, 0, 0]);
export const mul = (m, n) => [m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3], m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3], m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]];
export const translate = (tx, ty) => [1, 0, 0, 1, tx, ty];
export const applyPt = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

const COLOR_SET = new Set(['g', 'rg', 'k', 'sc', 'scn', 'cs']);
const STROKE_COLOR = new Set(['G', 'RG', 'K', 'SC', 'SCN', 'CS']);
const POSITIONING = new Set(['Td', 'TD', 'Tm', 'T*', "'", '"']);
const latin1 = (bytes, s, e) => { let out = ''; for (let i = s; i < e; i++) out += String.fromCharCode(bytes[i]); return out; };

/* Group tokens into operations: {op, args, s, e, raw}. Arrays and dictionaries become single composite arguments. */
export function operations(bytes) {
  const toks = tokenize(bytes), ops = []; let args = [];
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.t === 'op') { const s = args.length ? args[0].s : t.s; ops.push({ op: t.v, args, s, e: t.e, raw: latin1(bytes, s, t.e) }); args = []; continue; }
    if (t.t === '[') {
      let depth = 1, j = k + 1; const items = [];
      while (j < toks.length && depth) { const u = toks[j]; if (u.t === '[') depth++; else if (u.t === ']') { depth--; if (!depth) break; } if (depth) items.push(u); j++; }
      args.push({ t: 'array', items, s: t.s, e: toks[Math.min(j, toks.length - 1)].e }); k = j; continue;
    }
    if (t.t === '<<') {
      let depth = 1, j = k + 1; while (j < toks.length && depth) { if (toks[j].t === '<<') depth++; else if (toks[j].t === '>>') depth--; j++; }
      args.push({ t: 'dict', s: t.s, e: toks[j - 1].e }); k = j - 1; continue;
    }
    args.push(t);
  }
  return ops;
}

const num = a => (a && a.t === 'num') ? a.v : 0;
const cloneGs = g => ({ ...g, ctm: g.ctm.slice() });

/* fonts(name) -> {bytes: 1|2, width(code) (1000ths), usable} | null */
export function interpret(bytes, fonts) {
  const ops = operations(bytes), shows = []; const stack = [];
  let gs = { ctm: IDENT.slice(), font: null, size: 0, tc: 0, tw: 0, tz: 100, tl: 0, ts: 0, tr: 0, fill: '', fillCs: '' };
  let tm = IDENT.slice(), tlm = IDENT.slice(), bt = -1, inText = false, posIdx = -1, doCount = 0, lastShow = -1;
  for (let i = 0; i < ops.length; i++) {
    const o = ops[i], a = o.args;
    switch (o.op) {
      case 'q': stack.push(cloneGs(gs)); break;
      case 'Q': if (stack.length) gs = stack.pop(); break;
      case 'cm': if (a.length >= 6) gs.ctm = mul(a.slice(0, 6).map(num), gs.ctm); break;
      case 'BT': inText = true; bt++; tm = IDENT.slice(); tlm = IDENT.slice(); posIdx = -1; lastShow = -1; break;
      case 'ET': inText = false; break;
      case 'Tf': { const nm = a.find(x => x.t === 'name'); if (nm) gs.font = nm.v; const n = a.filter(x => x.t === 'num'); if (n.length) gs.size = n[n.length - 1].v; break; }
      case 'Tc': gs.tc = num(a[0]); break;
      case 'Tw': gs.tw = num(a[0]); break;
      case 'Tz': gs.tz = num(a[0]); break;
      case 'TL': gs.tl = num(a[0]); break;
      case 'Ts': gs.ts = num(a[0]); break;
      case 'Tr': gs.tr = num(a[0]); break;
      case 'Td': tlm = mul(translate(num(a[0]), num(a[1])), tlm); tm = tlm.slice(); posIdx = i; lastShow = -1; break;
      case 'TD': gs.tl = -num(a[1]); tlm = mul(translate(num(a[0]), num(a[1])), tlm); tm = tlm.slice(); posIdx = i; lastShow = -1; break;
      case 'Tm': if (a.length >= 6) { tlm = a.slice(0, 6).map(num); tm = tlm.slice(); } posIdx = i; lastShow = -1; break;
      case 'T*': tlm = mul(translate(0, -gs.tl), tlm); tm = tlm.slice(); posIdx = i; lastShow = -1; break;
      case 'Do': doCount++; break;
      case 'Tj': case 'TJ': case "'": case '"': {
        if (o.op === "'" || o.op === '"') { tlm = mul(translate(0, -gs.tl), tlm); tm = tlm.slice(); posIdx = i; lastShow = -1; }
        const items = [];
        if (o.op === 'TJ') { const arr = a.find(x => x.t === 'array'); if (arr) for (const it of arr.items) { if (it.t === 'str') items.push({ codes: it.v }); else if (it.t === 'num') items.push({ adj: it.v }); } }
        else { const st = [...a].reverse().find(x => x.t === 'str'); if (st) items.push({ codes: st.v }); }
        const font = gs.font ? fonts(gs.font) : null;
        const show = { opIndex: i, kind: o.op, s: o.s, e: o.e, bt, inText, font: gs.font, fontInfo: font, size: gs.size, tc: gs.tc, tw: gs.tw, tz: gs.tz, ts: gs.ts, tr: gs.tr, tl: gs.tl, fill: gs.fill, ctm: gs.ctm.slice(), tm0: tm.slice(), tlm: tlm.slice(), items, posIdx, chained: lastShow >= 0, prevShow: lastShow >= 0 ? shows.length - 1 : -1, unsupported: o.op === '"' };
        // advance the text matrix
        const th = gs.tz / 100; let adv = 0;
        for (const it of items) {
          if (it.adj !== undefined) { adv += -it.adj / 1000 * gs.size * th; continue; }
          const bpc = font ? font.bytes : 1;
          for (let k = 0; k + bpc <= it.codes.length; k += bpc) {
            const code = bpc === 2 ? (it.codes[k] << 8) | it.codes[k + 1] : it.codes[k];
            const w = font ? font.width(code) : 0;
            adv += (w / 1000 * gs.size + gs.tc + ((bpc === 1 && code === 32) ? gs.tw : 0)) * th;
          }
        }
        show.advance = adv; show.tmEnd = mul(translate(adv, 0), tm); tm = show.tmEnd.slice();
        shows.push(show); lastShow = shows.length - 1; break;
      }
      default:
        if (COLOR_SET.has(o.op)) {
          if (o.op === 'cs') { gs.fillCs = o.raw; gs.fill = o.raw; }
          else if (o.op === 'g' || o.op === 'rg' || o.op === 'k') { gs.fillCs = ''; gs.fill = o.raw; }
          else gs.fill = gs.fillCs ? gs.fillCs + '\n' + o.raw : o.raw; // sc/scn always re-select their colour space
        }
    }
  }
  return { ops, shows, doCount, content: bytes, isPositioning: op => POSITIONING.has(op), isStrokeColor: op => STROKE_COLOR.has(op) };
}
