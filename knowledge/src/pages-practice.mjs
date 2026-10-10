const C = 'concept';
export const pages = [
{
slug: 'python-for-ai', title: 'Python for AI: When and How to Use It', kind: C, group: 'Python',
question: 'When should I use Python for AI work?',
summary: 'Python is the most common language for calling models, preparing data, running small RAG pipelines and evaluating answers. Use it when you want clear scripts and a rich library ecosystem; keep secrets and long-running work on a machine you control.',
short: 'Python is a strong default for **calling model APIs, shaping data, and running retrieval or evaluation scripts**. It is not magic: treat it like any server-side language — keep API keys out of source, validate inputs, and prefer small scripts you can rerun.',
aliases: ['python for AI', 'python for ai overview', 'when to use python for AI', 'AI with python', 'python AI scripting', 'python for LLMs', 'python machine learning basics for apps'],
keywords: ['python', 'scripting', 'stdlib', 'HTTP', 'RAG', 'evaluation', 'API key', 'venv'],
related: ['rag-with-python', 'calling-ai-apis-with-python', 'python-data-for-ai', 'python-ai-libraries', 'rag', 'ai-evaluation'],
sections: [
['What is it?', `**Python for AI** here means using Python as the glue around models: send a prompt, parse a response, load documents, chunk and embed text, store results, and score quality. It is the language most tutorials and research examples use, so you will find many examples — and you must still understand what each step does.

Python sits beside the model, not inside it. The model is usually reached over HTTP (a hosted API) or through a local runtime. Your script owns authentication, timeouts, retries, logging and the decision of what to do with the answer.`],
['Why it matters', `Teams choose Python for AI work because:

- the standard library already covers files, JSON, CSV and subprocesses;
- HTTP clients and data libraries are widely documented;
- small scripts are easy to share and re-run in CI for [[ai-evaluation|evaluation]];
- the same language can grow from a notebook into a thin service.

Knowing *when* Python is the right place matters as much as knowing syntax. Browser UI work often belongs in [[javascript-for-ai|JavaScript]] or [[react-ai-interfaces|React]]; keeping API keys on a server may mean [[nodejs-for-ai|Node]] or Python equally well.`],
['How to do it', `A practical workflow:

1. Create a virtual environment so dependencies stay isolated.
2. Put the model API key in an environment variable — never in the repo.
3. Start with one script that calls the model and prints the text ([[calling-ai-apis-with-python]]).
4. Add file I/O when you need documents or datasets ([[python-data-for-ai]]).
5. Only then introduce embeddings, a store and retrieval ([[rag-with-python]]).
6. Measure answers on a fixed question set ([[ai-evaluation]]).

Prefer the standard library until a clear need appears. Reach for an HTTP client when you call APIs, a data library when tables get large, and an agent or orchestration helper only when a simple loop is no longer enough ([[python-ai-libraries]], [[choosing-an-agent-framework]]).`],
['Example', `A minimal shape (illustrative — provider URLs and field names vary):

\`\`\`python
import os, json, urllib.request

def ask(prompt: str) -> str:
    key = os.environ["MODEL_API_KEY"]
    body = json.dumps({
        "model": "your-model-id",
        "messages": [{"role": "user", "content": prompt}],
    }).encode()
    req = urllib.request.Request(
        "https://api.example.com/v1/chat",
        data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.load(resp)
    return data["choices"][0]["message"]["content"]

print(ask("Summarise this in one sentence: ..."))
\`\`\`

This is enough to prove connectivity before you add retrieval or tools.`],
['When to use it', `Use Python when you are building scripts, batch jobs, evaluation harnesses, data prep, or a small backend that talks to a model. Prefer another stack when your team already owns a Node service and the work is mostly HTTP glue, or when the only surface is a browser UI that must not hold secrets.

Skip heavy frameworks until you have a working direct-API path and a reason the framework would reduce risk or duplication ([[framework-vs-direct-api]]).`],
['Common mistakes', `- Hard-coding API keys in notebooks that later get committed.
- Pasting entire PDFs into the prompt instead of [[chunking|chunking]] and retrieving ([[rag]]).
- Treating a one-off notebook as production without timeouts, logging or tests.
- Installing every popular AI package "just in case" instead of choosing roles deliberately ([[python-ai-libraries]]).
- Expecting Python alone to stop [[ai-hallucinations|hallucinations]] — grounding and checks still matter.`],
]
},

{
slug: 'rag-with-python', title: 'Building RAG with Python', kind: C, group: 'Python',
question: 'How do I build RAG with Python?',
summary: 'Build retrieval-augmented generation in Python by loading documents, chunking them, embedding chunks, storing vectors, retrieving neighbours for a question, stuffing them into a prompt, and checking the answer.',
short: 'A Python RAG path is: **load → chunk → embed → store → retrieve → prompt → check**. Keep each step a function you can test. You do not need a paid vendor for the outline; swap in whichever embedding and chat APIs you already use.',
aliases: ['How do I build RAG with Python?', 'build RAG with Python', 'RAG with Python', 'python RAG tutorial', 'retrieval augmented generation python', 'rag pipeline python', 'implement RAG in python'],
keywords: ['python', 'RAG', 'chunking', 'embeddings', 'vector store', 'retrieval', 'prompt', 'urllib'],
related: ['python-for-ai', 'calling-ai-apis-with-python', 'python-data-for-ai', 'rag', 'embeddings', 'chunking', 'vector-databases', 'ai-evaluation'],
sections: [
['What is it?', `[[rag|RAG]] (retrieval-augmented generation) means: find relevant passages from *your* material, put them in the prompt, then ask the model to answer using that material. In Python you own every step as ordinary code — file reads, string splits, HTTP calls, and a place to keep vectors.

This page is a task guide, not a product ranking. Library names below describe *roles* (HTTP client, embedding helper, vector store). Use the standard library where it is enough; add a package when a role becomes painful.`],
['Why it matters', `Without retrieval, the model answers from parameters alone and may invent citations. With RAG you can:

- answer questions about private docs;
- update knowledge by re-indexing files instead of re-training;
- show which passages supported an answer.

Python is a common place to prototype this because scripts are easy to rerun while you tune [[chunking]] and prompts.`],
['How to do it', `1. **Load** documents (UTF-8 text, or extract text from PDFs/HTML with a dedicated library).
2. **Chunk** into overlapping passages sized for your embedding model ([[chunking]]).
3. **Embed** each chunk with an embedding API or local model ([[embeddings]]).
4. **Store** vectors with metadata (source path, offsets). Start with a JSON file or in-memory list; move to [[vector-databases|a vector store]] or [[postgresql-for-ai-apps|PostgreSQL]] when scale demands it.
5. **Retrieve** the top-k chunks for a new question (same embedding model).
6. **Stuff the prompt** with those chunks and a clear instruction: answer only from the passages; say when the answer is missing.
7. **Check** the answer against the passages ([[how-to-reduce-hallucinations]], [[ai-evaluation]]).

Keep the chat API call separate from retrieval so you can test each part ([[calling-ai-apis-with-python]]).`],
['Example', `Sketch of the pipeline (placeholders for provider-specific fields):

\`\`\`python
import json, math

def chunk_text(text, size=500, overlap=50):
    chunks, i = [], 0
    while i < len(text):
        chunks.append(text[i:i+size])
        i += max(1, size - overlap)
    return chunks

def cosine(a, b):
    dot = sum(x*y for x, y in zip(a, b))
    na = math.sqrt(sum(x*x for x in a)); nb = math.sqrt(sum(y*y for y in b))
    return dot / (na * nb + 1e-9)

# embed(text) -> list[float]   # call your embedding HTTP API
# chat(prompt) -> str          # call your chat HTTP API

docs = chunk_text(open("handbook.txt", encoding="utf-8").read())
store = [{"text": c, "vec": embed(c)} for c in docs]

q = "How do we reset MFA?"
qv = embed(q)
top = sorted(store, key=lambda r: cosine(qv, r["vec"]), reverse=True)[:4]
context = "\\n---\\n".join(r["text"] for r in top)
prompt = (
    "Answer only using the passages. If missing, say you do not know.\\n\\n"
    f"Passages:\\n{context}\\n\\nQuestion: {q}"
)
print(chat(prompt))
\`\`\`

Replace \`embed\` and \`chat\` with thin wrappers around your provider. Persist \`store\` with [[python-data-for-ai|JSON]] when the corpus grows past a toy example.`],
['When to use it', `Build RAG in Python when documents change faster than you can fine-tune, when answers must cite sources, or when you are evaluating retrieval quality offline. Prefer a hosted search product only after a local script proves the idea.

If the corpus is tiny and always fits in the [[context-windows|context window]], pasting the whole file may be simpler than retrieval — measure before you invest.`],
['Common mistakes', `- Chunks that are too large (diluted meaning) or too small (no context).
- Embedding with one model and querying with another.
- Stuffing retrieved text without telling the model to stick to it.
- Skipping an evaluation set of real questions ([[ai-evaluation]]).
- Putting API keys in the script body ([[calling-ai-apis-with-python]]).`],
]
},

{
slug: 'calling-ai-apis-with-python', title: 'Calling AI and Model APIs with Python', kind: C, group: 'Python',
question: 'How do I call a model API from Python?',
summary: 'Call a model from Python with an HTTP request: read the API key from the environment, set a timeout, send a JSON body, handle errors, and pull the text out of the response.',
short: 'Treat the model like any HTTPS API: **key from the environment, JSON body, timeout, check status, parse the text field**. Never hard-code secrets. Keep provider-specific field names in one small function.',
aliases: ['calling AI APIs with Python', 'call model API python', 'openai python without SDK', 'python HTTP chat completion', 'python requests LLM', 'how to call an LLM from python'],
keywords: ['python', 'HTTP', 'API key', 'timeout', 'JSON', 'urllib', 'error handling'],
related: ['python-for-ai', 'rag-with-python', 'python-data-for-ai', 'what-is-an-api', 'api-authentication', 'rest-apis'],
sections: [
['What is it?', `Most hosted models expose a **chat or completions HTTP endpoint**. Your Python program sends JSON (model id, messages, optional parameters) and receives JSON containing generated text. Official SDKs are optional wrappers; understanding the raw request helps you debug any language or library.`],
['Why it matters', `A reliable call is the foundation for RAG, agents and evals. If keys leak, timeouts hang workers, or errors are ignored, every higher layer fails. Learning one thin client also makes it obvious what a framework is doing for you ([[framework-vs-direct-api]]).`],
['How to do it', `1. Create an API key in the provider console; store it as \`MODEL_API_KEY\` (or the name they document).
2. Build a JSON body with the model id and a \`messages\` array (system + user roles as required).
3. Send \`POST\` with \`Authorization: Bearer …\` and \`Content-Type: application/json\`.
4. Set a **timeout** (tens of seconds is common for chat).
5. If the status is not 2xx, read the error body and raise or retry with backoff for transient codes.
6. Parse JSON and read the assistant text from the documented path (often \`choices[0].message.content\` — confirm for your provider).
7. Log latency and token usage fields when present, without logging full prompts that contain secrets.

Use the standard library (\`urllib\`) or an HTTP client library — both are fine. Prefer environment variables over \`.env\` files committed to git ([[api-authentication]]).`],
['Example', `\`\`\`python
import os, json, urllib.error, urllib.request

URL = "https://api.example.com/v1/chat/completions"

def chat(messages, model="your-model-id", timeout=60):
    key = os.environ.get("MODEL_API_KEY")
    if not key:
        raise RuntimeError("Set MODEL_API_KEY in the environment")
    payload = json.dumps({"model": model, "messages": messages}).encode()
    req = urllib.request.Request(
        URL, data=payload, method="POST",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.load(resp)
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")
        raise RuntimeError(f"Model API {e.code}: {detail}") from e
    return data["choices"][0]["message"]["content"]

text = chat([
    {"role": "system", "content": "Reply in one short paragraph."},
    {"role": "user", "content": "What is a context window?"},
])
print(text)
\`\`\`

Adjust URL and JSON paths to your provider. For streaming, see the ideas on [[streaming-ai-responses]] and implement the provider's event format carefully.`],
['When to use it', `Use a direct Python HTTP call for scripts, prototypes, CI evals and small services. Add an official SDK when you need typed helpers and the team agrees on that dependency. Move secret handling behind your own backend if a browser or mobile app is involved ([[javascript-for-ai]]).`],
['Common mistakes', `- Hard-coding keys in source or notebooks.
- No timeout — hung requests pile up.
- Swallowing non-2xx responses and treating empty text as success.
- Logging raw requests that include customer data ([[ai-privacy-and-security]]).
- Mixing embedding endpoints with chat endpoints by accident.`],
]
},

{
slug: 'python-data-for-ai', title: 'JSON and CSV Handling for AI Work in Python', kind: C, group: 'Python',
question: 'How do I handle JSON and CSV data for AI pipelines in Python?',
summary: 'Read JSON and CSV files in Python, validate the shape you expect, send clean records to a model or embedding API, and save outputs in a format the next step can load.',
short: 'For AI data prep in Python: **load → validate shape → transform → call the model → save**. Prefer UTF-8 text, explicit schemas, and small pure functions you can unit test.',
aliases: ['python JSON for AI', 'python CSV for AI', 'JSON CSV data handling AI', 'prepare data for LLM python', 'read csv for embeddings python'],
keywords: ['python', 'JSON', 'CSV', 'validation', 'pandas', 'stdlib', 'utf-8'],
related: ['python-for-ai', 'what-is-json', 'json-validation', 'rag-with-python', 'calling-ai-apis-with-python', 'python-ai-libraries'],
sections: [
['What is it?', `AI pipelines spend as much time on **files and tables** as on prompts. You load examples, documents metadata, evaluation scores or model outputs. JSON is the usual interchange with APIs ([[what-is-json]]); CSV is common for spreadsheets and labelled eval sets. Python's standard library can do both; larger tables may justify a data library ([[python-ai-libraries]]).`],
['Why it matters', `Models and embedding APIs are picky about types and encoding. A missing field, a number stored as a string, or a broken UTF-8 file produces confusing failures far from the model. Validating early saves money and debugging time ([[json-validation]]).`],
['How to do it', `1. Decide the **record shape** (required keys and types) before writing loaders.
2. Read with encoding \`utf-8\` (and handle BOM if files come from spreadsheets).
3. Validate: required fields present, types correct, lists not accidentally strings.
4. Normalise text (strip, consistent newlines) before embedding or prompting.
5. Send only the fields the model needs — drop internal ids from the prompt if unused.
6. Write outputs as JSON Lines or CSV with a header row so eval scripts can reload them.
7. Keep raw and processed data separate so you can re-run transforms.`],
['Example', `\`\`\`python
import csv, json
from pathlib import Path

def load_json_records(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("expected a JSON array of objects")
    for i, row in enumerate(data):
        if not isinstance(row, dict) or "question" not in row or "answer" not in row:
            raise ValueError(f"row {i} missing question/answer")
    return data

def load_csv_records(path):
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for i, row in enumerate(rows):
        if not row.get("id") or not row.get("text"):
            raise ValueError(f"csv row {i} needs id and text")
    return rows

def save_jsonl(path, rows):
    with open(path, "w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\\n")
\`\`\`

Use these records as the inputs to [[rag-with-python|RAG]] indexing or [[ai-evaluation|evaluation]] loops.`],
['When to use it', `Use structured file handling whenever you batch-embed documents, build golden question sets, or store model outputs for comparison. Prefer databases ([[databases-for-ai-apps]]) when many writers need concurrency and transactions.`],
['Practical notes', `Keep a clear directory layout: 'raw/' for untouched exports, 'clean/' for validated records, and 'runs/' for timestamped model outputs. When a third-party CSV uses different column names, map them in one place rather than sprinkling renames through the embedding script. For evaluation, prefer JSONL so each line is one case you can stream. If a model returns almost-JSON, repair it in a dedicated function and log failures instead of silently dropping rows. Document the expected schema in a short README next to the data folder so the next person (or future you) knows which fields are required before calling an expensive embedding endpoint.`],
['Common mistakes', `- Assuming CSV numbers are ints — they arrive as strings until you cast.
- Nested JSON dumped into a single CSV cell without an escape plan.
- Writing model output as invalid JSON because you concatenated strings ([[json-validation]]).
- Committing files that contain personal data ([[ai-privacy-and-security]]).`],
]
},

{
slug: 'python-ai-libraries', title: 'Python AI Libraries: What to Use When', kind: C, group: 'Python',
question: 'Which Python libraries should I use for AI applications?',
summary: 'Choose Python libraries by role: standard library and an HTTP client for API calls, a data library for tables, an embeddings or vector helper for retrieval, and an agent framework only when orchestration outgrows a simple loop.',
short: 'Match the **role**, not the hype: stdlib/HTTP for calls, data tools for tables, embedding/vector helpers for RAG, frameworks for complex tool loops. Start thin; add a layer when pain is real.',
aliases: ['python AI libraries', 'python LLM libraries', 'when to use langchain python', 'python httpx openai', 'python AI stack choices'],
keywords: ['python', 'libraries', 'HTTP client', 'embeddings', 'vector', 'framework', 'stdlib'],
related: ['python-for-ai', 'rag-with-python', 'calling-ai-apis-with-python', 'choosing-an-agent-framework', 'framework-vs-direct-api', 'what-is-an-ai-framework'],
sections: [
['What is it?', `The Python ecosystem offers many AI-related packages. This page is a **decision guide by job-to-be-done**, not a ranked leaderboard. Names you see in articles (HTTP clients, official provider SDKs, LangChain, LlamaIndex, NumPy/pandas, vector helpers) illustrate categories. Prefer one clear tool per role.`],
['Why it matters', `Installing everything creates version conflicts and hides what your program actually does. A thin stack is easier to secure, evaluate and replace. Understanding roles also clarifies when a [[what-is-an-ai-framework|framework]] helps versus when [[framework-vs-direct-api|direct API]] calls are enough.`],
['How to do it', `Map your need to a role:

1. **Standard library** — files, JSON, CSV, \`urllib\`, argparse, logging. Enough for many scripts ([[python-data-for-ai]], [[calling-ai-apis-with-python]]).
2. **HTTP client** — use when you want connection pooling, clearer timeouts or session helpers (\`urllib\` remains valid).
3. **Provider SDK** — optional convenience around one vendor's API; keep business logic outside it.
4. **Data library** — tables, joins, group-bys on larger CSV/Parquet sets.
5. **Embeddings / vector helper** — batch embedding, local similarity, or talking to a [[vector-databases|vector database]].
6. **Agent / orchestration framework** — tool registries, multi-step graphs, multi-agent wiring. Choose only after a hand-written loop hurts ([[choosing-an-agent-framework]]).

Write a one-page ADR (architecture decision record) when you add a heavy dependency.`],
['Example', `| Job | Lean choice | Heavier choice when needed |
|---|---|---|
| Call chat API | stdlib \`urllib\` + JSON | Official SDK |
| Eval CSV of questions | \`csv\` module | pandas / Polars |
| Toy RAG over 200 files | lists + cosine in pure Python | Vector DB client |
| Many tools + retries + tracing | Your own loop first | Orchestration framework |

A team might start with stdlib HTTP for chat and JSONL for eval scores, then add a vector database client when retrieval latency requires an index — without adopting an agent framework yet.`],
['When to use it', `Revisit library choices when onboarding cost rises, when cold-start scripts need twenty imports to print one completion, or when you cannot explain which package owns retries and which owns prompts.`],
['Practical notes', `When you evaluate a new package, write a twenty-line spike that performs your real job — one chat call, one embed, one retrieve — and measure latency and failure modes. Prefer libraries that let you swap the underlying HTTP client so tests can mock the network. Be wary of packages that download large models on import. Pin versions in 'requirements.txt' or a lockfile once a spike succeeds. If two libraries both claim to "do agents", pick one and delete the other from the environment; overlapping abstractions make tool permission bugs harder to see. Revisit the thin-stack choice every time you add a new production dependency.`],
['Common mistakes', `- Adding an agent framework on day one for a single prompt.
- Depending on two frameworks that both wrap the same API.
- Letting a notebook install packages globally instead of a venv.
- Treating a framework tutorial as a security model — you still validate tools ([[agent-tools]]).`],
]
},

{
slug: 'javascript-for-ai', title: 'JavaScript for AI Applications', kind: C, group: 'JavaScript',
question: 'How do I use JavaScript for AI applications?',
summary: 'Use JavaScript for AI UIs in the browser and for server-side calls in Node. Never put model API keys in front-end code; call your own backend, which holds the secret and talks to the model.',
short: 'In JavaScript AI apps, **the browser owns the UI; the server owns the secret**. Call model APIs from Node (or another backend), not from client-side bundles.',
aliases: ['javascript for AI', 'javascript for AI applications', 'JS LLM app', 'browser AI API key', 'AI app with javascript'],
keywords: ['javascript', 'browser', 'node', 'API key', 'fetch', 'frontend', 'backend'],
related: ['typescript-for-ai', 'calling-ai-apis-with-javascript', 'nodejs-for-ai', 'react-ai-interfaces', 'api-authentication', 'streaming-ai-responses'],
sections: [
['What is it?', `JavaScript runs in two important places for AI products: the **browser** (UI) and **Node.js** (server). The same language can implement a chat form and the route that proxies to a model. The critical rule is separation of trust: anything shipped to the browser is public.`],
['Why it matters', `Many demos call a model API directly from the browser with a key in the bundle. That key will leak. Production AI apps use JavaScript on the client for UX and JavaScript (or another language) on the server for [[calling-ai-apis-with-javascript|model calls]], [[api-authentication|authentication]] and logging.`],
['How to do it', `1. Build the chat UI with HTML/JS or [[react-ai-interfaces|React]].
2. From the browser, \`fetch\` **your** backend route (same origin or controlled CORS), not the model vendor.
3. On the server ([[nodejs-for-ai]]), read \`process.env.MODEL_API_KEY\`, call the vendor, return text or a [[streaming-ai-responses|stream]].
4. Authenticate the end user before spending tokens.
5. Treat model output as untrusted HTML — escape before inserting into the DOM ([[prompt-injection]] risks if you render Markdown carelessly).`],
['Example', `Browser (no vendor key):

\`\`\`js
const res = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: userText }),
});
if (!res.ok) throw new Error("chat failed");
const data = await res.json();
appendAssistant(data.text);
\`\`\`

Server route holds the key and calls the model (see [[calling-ai-apis-with-javascript]] and [[nodejs-for-ai]]).`],
['When to use it', `Choose JavaScript when your product UI is web-based or your team already runs Node services. Prefer Python for heavy data science batch jobs if that is the team skill set ([[python-for-ai]]) — both can coexist.`],
['Practical notes', `Structure the repo so 'web/' never imports server secret modules. Share only TypeScript types or JSON schemas across the boundary. Add a simple health route that does not call the model so load balancers stay cheap. For local development, run the UI and API on known ports and proxy '/api' to Node to avoid CORS distractions. Log request ids on the server and echo them to the client error banner so users can report failures. Remember that browser extensions and XSS can read anything in page memory — another reason the vendor key must never appear in JavaScript shipped to the browser. When you add file uploads for RAG, scan and size-limit on the server before any model sees the bytes.`],
['Common mistakes', `- Embedding API keys in Vite/Webpack bundles.
- Calling the model from the browser "temporarily" and shipping it.
- Rendering raw model HTML without sanitisation.
- Skipping auth on the proxy route so anyone can burn your quota.`],
]
},

{
slug: 'typescript-for-ai', title: 'TypeScript for AI Applications', kind: C, group: 'JavaScript',
question: 'Why use TypeScript for AI applications?',
summary: 'TypeScript adds types to JavaScript so request and response shapes for model APIs and your own backend stay consistent, catching many integration bugs before runtime.',
short: 'TypeScript helps AI apps by **typing the messages you send, the JSON you parse, and the errors you handle**. It does not replace validation of untrusted model output.',
aliases: ['typescript for AI', 'typescript for AI applications', 'typed LLM client', 'TS AI backend'],
keywords: ['typescript', 'types', 'API client', 'validation', 'javascript'],
related: ['typescript-api-client-types', 'javascript-for-ai', 'calling-ai-apis-with-javascript', 'json-validation', 'nodejs-for-ai'],
sections: [
['What is it?', `TypeScript is JavaScript with a type system. For AI applications that means describing chat messages, tool-call payloads, streaming events and your database rows as types or interfaces. The compiler flags mismatches when a field is renamed or optional when you assumed it required.`],
['Why it matters', `Model APIs and tool schemas evolve. Without types, typos in \`choices[0].message.content\` fail at runtime in production. With types — especially shared types between [[react-ai-interfaces|React]] and [[nodejs-for-ai|Node]] — the UI and API stay aligned. Pair types with [[json-validation|runtime validation]] for data from the model or network.`],
['How to do it', `1. Model your **domain** types: \`ChatMessage\`, \`ChatRequest\`, \`ChatSuccess\`, \`ChatError\`.
2. Keep vendor-specific response types in an adapter module ([[typescript-api-client-types]]).
3. Validate JSON at the trust boundary (HTTP body) before casting.
4. Prefer \`unknown\` + narrow over \`any\` for model output.
5. Generate or hand-write types for tool arguments you accept from the model.`],
['Example', `\`\`\`ts
type Role = "system" | "user" | "assistant";
export type ChatMessage = { role: Role; content: string };

export type ChatRequest = {
  messages: ChatMessage[];
  stream?: boolean;
};

export type ChatSuccess = { text: string; model: string };
export type ChatError = { error: string; code: "unauthorized" | "upstream" | "bad_request" };
\`\`\`

The React client imports \`ChatRequest\`; the Node route validates the body matches before calling the vendor.`],
['When to use it', `Use TypeScript when more than one file talks to the model or when multiple developers touch the client contract. Plain JavaScript remains fine for tiny scripts.`],
['Practical notes', `Adopt a single 'types/' folder for message and tool shapes used by both UI and API. Enable 'strict' in 'tsconfig' early; turning it on later is painful. Prefer discriminated unions for model/tool events ('{type:'token'} | {type:'done'} | {type:'error'}') so switch statements stay exhaustive. When a vendor SDK ships its own types, wrap them — do not leak SDK classes into React components. Runtime validation still matters: TypeScript disappears at runtime, and model JSON can violate the types you hoped for. Pair this page with [[typescript-api-client-types]] when you implement the actual client module, and with [[json-validation]] for boundary checks. Work through one real request end to end, write down the failure modes you observed, and add a regression test so the next change does not silently drop validation, auth, or logging. Prefer boring, reviewable code over a clever abstraction until the second or third product needs the same pattern. Work through one real request end to end, write down the failure modes you observed, and add a regression test so the next change does not silently drop validation, auth, or logging. Prefer boring, reviewable code over a clever abstraction until the second or third product needs the same pattern.`],
['Common mistakes', `- Asserting \`as ChatSuccess\` without parsing.
- Typing only the happy path and ignoring error unions.
- Duplicating slightly different message types in UI and server.`],
]
},

{
slug: 'typescript-api-client-types', title: 'TypeScript Types for an API Client', kind: C, group: 'JavaScript',
question: 'How do I write TypeScript types for an API client?',
summary: 'Define TypeScript types for the request body, success response and error response of each API call, then implement a client function that returns a typed result and handles non-2xx cases.',
short: 'For a typed API client: **one type for the request, one for success, one for errors**, plus a function that parses JSON safely. That is what "TypeScript types for an API client" means in practice.',
aliases: ['TypeScript types for an API client', 'typescript API client types', 'typed fetch client', 'typescript request response types', 'API client typescript'],
keywords: ['typescript', 'API client', 'fetch', 'request', 'response', 'error', 'generics'],
related: ['typescript-for-ai', 'calling-ai-apis-with-javascript', 'what-is-an-api', 'rest-apis', 'json-validation', 'api-authentication'],
sections: [
['What is it?', `An **API client** is the module your app uses to call HTTP endpoints. In TypeScript you describe three shapes per endpoint: what you send, what success looks like, and what failure looks like. The compiler then checks every call site. This applies to your own \`/api/chat\` route and to vendor model APIs wrapped behind it.`],
['Why it matters', `AI features often chain several JSON payloads (chat, embeddings, tools). Untyped \`fetch\` + \`any\` hides breakages until a user hits them. Explicit types document the contract for [[react-chatbot-state|UI state]] and make refactors safer.`],
['How to do it', `1. Write \`Request\`, \`Success\`, and \`ErrorBody\` types for the endpoint.
2. Implement \`async function call(...): Promise<Success>\` that:
   - JSON.stringify the request;
   - checks \`res.ok\`;
   - parses JSON as \`unknown\`;
   - validates required fields ([[json-validation]]);
   - throws a typed error or returns a Result union.
3. Export a narrow public surface; keep vendor quirks private.
4. Optionally use generics for shared \`apiPost<TReq, TRes>()\`.
5. Never put API keys in the client module if it ships to the browser ([[javascript-for-ai]]).`],
['Example', `\`\`\`ts
export type CreateChatRequest = {
  messages: { role: "user" | "assistant" | "system"; content: string }[];
};

export type CreateChatResponse = {
  id: string;
  text: string;
};

export type ApiError = {
  error: string;
  status: number;
};

export async function createChat(body: CreateChatRequest): Promise<CreateChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data && typeof data === "object" && "error" in data)
      ? String((data as { error: unknown }).error)
      : res.statusText;
    const e: ApiError = { error: err, status: res.status };
    throw e;
  }
  if (!data || typeof data !== "object" || !("text" in data) || !("id" in data)) {
    throw { error: "invalid response", status: res.status } satisfies ApiError;
  }
  const { id, text } = data as { id: unknown; text: unknown };
  if (typeof id !== "string" || typeof text !== "string") {
    throw { error: "invalid response fields", status: res.status } satisfies ApiError;
  }
  return { id, text };
}
\`\`\`

This is the pattern to reuse for embeddings or tool proxy routes.`],
['When to use it', `Add typed clients as soon as two components call the same endpoint, or when you wrap a third-party model API on the server ([[calling-ai-apis-with-javascript]]).`],
['Common mistakes', `- Returning \`Promise<any>\`.
- Trusting \`res.json()\` without checking shape.
- Sharing one mega-type across unrelated endpoints.
- Putting secrets in a "client" that is imported by React.`],
]
},

{
slug: 'calling-ai-apis-with-javascript', title: 'Calling AI Services from JavaScript and TypeScript', kind: C, group: 'JavaScript',
question: 'How do I call AI services from JavaScript or TypeScript?',
summary: 'From Node (or another server), call the model vendor with fetch, an API key from the environment, timeouts and careful JSON parsing. Expose only your own authenticated route to browsers.',
short: 'Call AI services **from the server** with `fetch`, env-based keys and error handling; let browsers call your backend only.',
aliases: ['calling AI APIs with javascript', 'call OpenAI from node', 'fetch LLM typescript', 'javascript model API call', 'typescript chat completions'],
keywords: ['javascript', 'typescript', 'fetch', 'node', 'API', 'timeout'],
related: ['javascript-for-ai', 'typescript-for-ai', 'nodejs-for-ai', 'typescript-api-client-types', 'streaming-ai-responses', 'api-authentication'],
sections: [
['What is it?', `JavaScript and TypeScript call model APIs the same way they call any [[rest-apis|REST]] service: HTTPS + JSON. The recommended place is a **server runtime** such as [[nodejs-for-ai|Node.js]], not a public web page.`],
['Why it matters', `Correct HTTP handling determines reliability: timeouts, non-2xx bodies, and schema drift. Getting this right once lets [[react-ai-interfaces|React UIs]] and batch jobs share a single module.`],
['How to do it', `1. Store the vendor key in the environment.
2. Use \`fetch\` (Node 18+) or an HTTP library with an explicit timeout/AbortSignal.
3. Send the provider's required headers and JSON body.
4. On failure, capture status + body for logs (redact secrets).
5. Parse success JSON and extract the assistant text.
6. Optional: expose \`POST /api/chat\` that authenticates the user then runs this function.`],
['Example', `\`\`\`js
import { setTimeout as delay } from "node:timers/promises";

export async function chat(messages, { timeoutMs = 60000 } = {}) {
  const key = process.env.MODEL_API_KEY;
  if (!key) throw new Error("MODEL_API_KEY missing");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.example.com/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: \`Bearer \${key}\`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "your-model-id", messages }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(\`upstream \${res.status}: \${JSON.stringify(data)}\`);
    return data.choices[0].message.content;
  } finally {
    clearTimeout(t);
  }
}
\`\`\`

For streaming responses, see [[streaming-ai-responses]] and [[streaming-ai-with-nodejs]].`],
['When to use it', `Use this pattern for production web apps, Slack bots and server workers. Use Python instead if the rest of the pipeline is already Python ([[calling-ai-apis-with-python]]).`],
['Practical notes', `Production tips: cap concurrent upstream calls per user, map vendor rate-limit responses to HTTP 429 for your clients, and include a stable 'request_id' in logs. Prefer idempotency keys if you create side-effecting tool calls downstream. Keep provider-specific quirks (field names, error codes) inside one adapter file so the rest of the app speaks your own schema. If you need embeddings and chat, use two clearly named functions rather than a generic 'callAI' that mixes endpoints. Test the adapter with recorded fixtures so CI does not need live keys. For browser clients, only expose your adapter through authenticated routes described in [[nodejs-for-ai]]. Work through one real request end to end, write down the failure modes you observed, and add a regression test so the next change does not silently drop validation, auth, or logging. Prefer boring, reviewable code over a clever abstraction until the second or third product needs the same pattern. Work through one real request end to end, write down the failure modes you observed, and add a regression test so the next change does not silently drop validation, auth, or logging. Prefer boring, reviewable code over a clever abstraction until the second or third product needs the same pattern.`],
['Common mistakes', `- Browser-side vendor calls with exposed keys.
- No AbortController — hung fetches.
- Assuming \`choices\` always exists.
- Retrying non-idempotent requests blindly without caps.`],
]
},

{
slug: 'streaming-ai-responses', title: 'Streaming AI Responses for Chat UIs', kind: C, group: 'JavaScript',
question: 'What is streaming for AI chat responses and how does a client read it?',
summary: 'Streaming delivers model tokens as they are generated (often SSE or chunked HTTP) so the UI can show text immediately. The client reads the byte stream, parses events, and appends text until the stream ends.',
short: 'Streaming means **reading partial model output over HTTP** (SSE or chunked transfers) and updating the UI token by token instead of waiting for the full answer.',
aliases: ['streaming AI responses', 'SSE LLM', 'stream chat tokens', 'readable stream AI', 'how streaming chat works'],
keywords: ['streaming', 'SSE', 'chunked', 'ReadableStream', 'chat UI', 'tokens'],
related: ['streaming-ai-with-nodejs', 'react-chatbot-state', 'react-ai-interfaces', 'calling-ai-apis-with-javascript', 'tokens'],
sections: [
['What is it?', `Without streaming, the server waits until the model finishes, then returns one JSON blob. With **streaming**, the model emits [[tokens]] gradually; the HTTP response stays open while chunks arrive. Common transports are **Server-Sent Events (SSE)** or raw chunked text. Chat UIs feel faster because users see the first words sooner.`],
['Why it matters', `Long answers can take many seconds. Streaming improves perceived latency and lets users cancel mid-flight. It also changes error handling: failures can occur after partial text was already shown.`],
['How to do it', `Client responsibilities:

1. \`fetch\` your backend with \`Accept\` headers your API documents (often SSE).
2. Obtain a \`ReadableStream\` from \`response.body\`.
3. Decode bytes to text; split on event boundaries.
4. Parse each event's data field; append token text to the assistant message in state ([[react-chatbot-state]]).
5. Stop on a documented done event or when the stream closes.
6. Handle abort (user clicks stop) via \`AbortController\`.

Server-side Node details live on [[streaming-ai-with-nodejs]]. Keep vendor protocols behind your backend so the browser speaks one stable format.`],
['Example', `Illustrative browser loop over SSE-like lines:

\`\`\`js
async function readChatStream(res, onToken) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\\n");
    buf = parts.pop() || "";
    for (const line of parts) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return;
      const json = JSON.parse(payload);
      if (json.token) onToken(json.token);
    }
  }
}
\`\`\`

Exact event shapes vary — adapt to your backend contract.`],
['When to use it', `Stream when answers are long or latency-sensitive. Skip streaming for short classifications, embeddings, or batch jobs where one JSON result is simpler.`],
['Practical notes', `UX details matter as much as the protocol. Show a cursor or shimmer while the first token has not arrived; switch to appending text once streaming starts. If the user sends a second message while streaming, either queue or finish the first stream — define the rule and stick to it. Scroll behaviour should follow new tokens unless the user scrolled up to read earlier context. On mobile networks, expect chunk delays and timeouts; surface a reconnect or retry without duplicating the assistant message. Keep your public event schema small ('token', 'done', 'error') even if the vendor sends richer events, so [[react-chatbot-state]] stays simple.`],
['Common mistakes', `- Parsing incomplete JSON across chunk boundaries without a buffer.
- Updating React state on every token without batching, causing jank.
- Forgetting to cancel the upstream vendor request when the user aborts.
- Exposing the vendor stream format directly to the browser (tight coupling).`],
]
}
];
