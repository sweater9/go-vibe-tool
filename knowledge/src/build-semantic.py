#!/usr/bin/env python3
"""Build-time only. Produces knowledge/semantic-index.json: a compact static semantic index.

Needs numpy and a copy of the wink-embeddings-sg-100d npm package (GloVe-derived, PDDL/MIT):
  python3 knowledge/src/build-semantic.py /path/to/wink-embeddings-sg-100d.json [--dim 64] [--vocab 20000]
The browser never sees the embedding model: only a pruned word-vector table plus per-page unit vectors.
No page text derived from any test query is used; every vector comes from Knowledge page content.
"""
import json, re, sys, base64, html, math, argparse, pathlib
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("glove")
ap.add_argument("--dim", type=int, default=100)
ap.add_argument("--vocab", type=int, default=20000)
ap.add_argument("--adapt", type=float, default=0.9, help="blend of corpus-context vector into corpus words (0=pure GloVe)")
ap.add_argument("--out", default=None)
a = ap.parse_args()

root = pathlib.Path(__file__).resolve().parents[2]
kn = root / "knowledge"
G = json.load(open(a.glove))
gwords = G["words"]; gdim = G["dimensions"]; prec = G["precision"]
vec = G["vectors"]
arr = np.array([vec[w][:gdim] for w in gwords], dtype=np.float32)
print("glove", arr.shape, file=sys.stderr)
# scale: wink stores rounded integers at given precision
if np.abs(arr).max() > 50: arr = arr / (10 ** prec)
widx = {w: i for i, w in enumerate(gwords)}

TOK = re.compile(r"[a-z0-9]+")
def toks(s): return TOK.findall(s.lower())

index = json.load(open(kn / "search-index.json"))
pages = index["pages"]
glossby = {}
for g in index.get("glossary", []):
    for pid in g.get("pages", []):
        glossby.setdefault(pid, []).append(f'{g["term"]} {g.get("aka","")} {g["definition"]}')

def strip(h):
    h = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", h, flags=re.S)
    h = re.sub(r"<[^>]+>", " ", h)
    return re.sub(r"\s+", " ", html.unescape(h)).strip()

units = []  # (page_idx, kind, text)
for pi, p in enumerate(pages):
    f = kn / f'{p["id"]}.html'
    ident = " ".join([p["title"]] * 2 + [p.get("question", "")] + p.get("aliases", []) + p.get("keywords", []))
    units.append((pi, "ident", ident))
    h = f.read_text(encoding="utf8") if f.exists() else ""
    m = re.search(r'<p class="kn-lede">(.*?)</p>', h, flags=re.S); lede = strip(m.group(1)) if m else ""
    m = re.search(r'<p class="kn-quick">(.*?)</p>', h, flags=re.S); quick = strip(m.group(1)) if m else ""
    units.append((pi, "summary", " ".join([p.get("summary", ""), lede, quick] + glossby.get(p["id"], []))))
    for sec in re.findall(r"<section id=\"[^\"]+\">(.*?)</section>", h, flags=re.S):
        t = strip(sec)
        if len(t.split()) >= 12: units.append((pi, "sec", t[:1500]))

# vocabulary: top-N frequent glove words (alnum) + corpus words that glove knows or not
corp_tokens = set()
for u in units: corp_tokens.update(toks(u[2]))
keep = []
for i, w in enumerate(gwords):
    if len(keep) >= a.vocab: break
    if TOK.fullmatch(w): keep.append(i)
keepset = set(keep)
for t in sorted(corp_tokens):
    if t in widx and widx[t] not in keepset: keep.append(widx[t]); keepset.add(widx[t])
words = [gwords[i] for i in keep]
V = arr[keep].copy()
V /= (np.linalg.norm(V, axis=1, keepdims=True) + 1e-9)
rank = np.array([i for i in keep], dtype=np.float64)
# SIF weight from rank-based Zipf probability
p = 1.0 / ((rank + 10) * math.log(len(gwords) + 10) )
SIFa = 1e-3
wts = SIFa / (SIFa + p)

wi = {w: i for i, w in enumerate(words)}
def embed_tokens(ts, vecs, wvec, extra=None):
    acc = np.zeros(vecs.shape[1], dtype=np.float32); n = 0
    for t in ts:
        i = wi.get(t)
        if i is None: continue
        acc += wvec[i] * vecs[i]; n += wvec[i]
    return acc / n if n else acc

# pass 1: unit vectors from glove words only
U1 = np.stack([embed_tokens(toks(u[2]), V, wts) for u in units])
# corpus context vectors for words (adapt) and OOV corpus terms
tf = {}
for ui, u in enumerate(units):
    w = 1.0 if u[1] != "sec" else 0.6
    if u[1] == "ident": w = 2.0
    for t in toks(u[2]): tf.setdefault(t, {}).setdefault(ui, 0); tf[t][ui] += w
Un = U1 / (np.linalg.norm(U1, axis=1, keepdims=True) + 1e-9)
newwords = []; newvecs = []; neww = []
ctx = {}
for t, d in tf.items():
    if len(t) < 2 and not t.isdigit(): continue
    v = sum(c * Un[ui] for ui, c in d.items())
    df_pages = len({units[ui][0] for ui in d})
    n = np.linalg.norm(v)
    if n > 0: ctx[t] = (v / n, df_pages)
for t, (cv, dfp) in ctx.items():
    if t in wi:
        if a.adapt > 0 and dfp >= 2:
            i = wi[t]; V[i] = (1 - a.adapt) * V[i] + a.adapt * cv; V[i] /= np.linalg.norm(V[i]) + 1e-9
    else:
        idf_w = 0.9 if dfp <= 6 else 0.5   # specialised terms are informative, spread terms less so
        newwords.append(t); newvecs.append(cv); neww.append(idf_w)
if newwords:
    words += newwords; V = np.vstack([V, np.stack(newvecs)]); wts = np.concatenate([wts, np.array(neww)])
wi = {w: i for i, w in enumerate(words)}
print("vocab", len(words), "of which corpus-only", len(newwords), file=sys.stderr)

# PCA reduce
mu = V.mean(0)
if a.dim < V.shape[1]:
    _, _, Vt = np.linalg.svd((V - mu)[::3], full_matrices=False)
    P = Vt[: a.dim].T
else:
    P = np.eye(V.shape[1], dtype=np.float32)
R = ((V - mu) @ P).astype(np.float32)
R /= (np.linalg.norm(R, axis=1, keepdims=True) + 1e-9)
U = np.stack([embed_tokens(toks(u[2]), R, wts) for u in units])
# common component removal (SIF)
_, _, vt = np.linalg.svd(U - 0, full_matrices=False)
pc = vt[0].astype(np.float32)
def rm(x): return x - (x @ pc)[..., None] * pc if x.ndim > 1 else x - (x @ pc) * pc
U = rm(U); U /= (np.linalg.norm(U, axis=1, keepdims=True) + 1e-9)

# which vocabulary words are really used by the Knowledge corpus (>= 2 pages): used as an in-domain coverage signal
import collections
pg_df = collections.Counter()
for pi in range(len(pages)):
    seen = set()
    for (upi, kind, text) in units:
        if upi == pi: seen.update(toks(text))
    for t in seen: pg_df[t] += 1
in_corpus = np.array([1 if pg_df.get(w, 0) >= 2 else 0 for w in words], dtype=np.uint8)

def q8(m, scale): return base64.b64encode(np.clip(np.round(m * scale), -127, 127).astype(np.int8).tobytes()).decode()
vscale = 127.0 / max(1e-9, float(np.abs(R).max()))
uscale = 127.0 / max(1e-9, float(np.abs(U).max()))
out = {
  "version": 1,
  "source": "GloVe 6B word vectors (Pennington et al.), PDDL 1.0, via wink-embeddings-sg-100d npm package (MIT); pruned and PCA-reduced at build time; page vectors derived only from Knowledge page text",
  "dim": int(R.shape[1]),
  "vscale": vscale, "uscale": uscale,
  "words": " ".join(words),
  "weights": base64.b64encode(np.round(wts * 255).astype(np.uint8).tobytes()).decode(),
  "wvecs": q8(R, vscale),
  "mu_proj": None,
  "pc": [round(float(x), 5) for x in pc],
  "pageIds": [p["id"] for p in pages],
  "unitPage": [u[0] for u in units],
  "unitKind": [{"ident": 0, "summary": 1, "sec": 2}[u[1]] for u in units],
  "uvecs": q8(U, uscale),
  "inCorpus": base64.b64encode(np.packbits(in_corpus).tobytes()).decode(),
}
dest = pathlib.Path(a.out) if a.out else kn / "semantic-index.json"
dest.write_text(json.dumps(out, separators=(",", ":")))
print("wrote", dest, dest.stat().st_size, "bytes; units", len(units), "dim", R.shape[1], file=sys.stderr)
