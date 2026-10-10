const C = 'concept';
const K = 'comparison';
export const pages = [
{
slug: 'what-is-json', title: 'JSON Fundamentals for API Work', kind: C, group: 'Building',
question: 'What is JSON and how is it used in APIs?',
summary: 'JSON is a text format for structured data — objects, arrays, strings, numbers, booleans and null — used by almost every modern HTTP API and by model tool arguments.',
short: 'JSON is the **common data text format** for APIs: nested objects and arrays you can parse in any language. AI APIs and tool calls lean on it heavily.',
aliases: ['what is JSON', 'JSON fundamentals', 'JSON for APIs', 'JSON objects arrays', 'learn JSON'],
keywords: ['JSON', 'API', 'objects', 'arrays', 'parsing'],
related: ['json-validation', 'rest-apis', 'what-is-an-api', 'function-calling', 'python-data-for-ai'],
sections: [
['What is it?', `**JSON** (JavaScript Object Notation) is a language-independent text format. It supports objects (\`{}\`), arrays (\`[]\`), strings, numbers, booleans and \`null\`. Web APIs request and respond with JSON bodies; many LLM tool calls pass JSON arguments ([[function-calling]]).`],
['Why it matters', `If you cannot read JSON, you cannot debug model APIs, RAG metadata or browser \`fetch\` calls. Almost every AI integration tutorial assumes JSON literacy.`],
['How to do it', `Rules of thumb:

- Keys are strings in double quotes.
- No trailing commas; no comments in standard JSON.
- Parse with a real parser (\`JSON.parse\`, \`json.loads\`) — never with fragile regex.
- UTF-8 encoding is the norm.
- Pretty-print for humans; minify on the wire if you want.

Map JSON to typed structures in [[typescript-api-client-types|TypeScript]] or dicts/lists in [[python-data-for-ai|Python]], then [[json-validation|validate]].`],
['Example', `\`\`\`json
{
  "model": "your-model-id",
  "messages": [
    {"role": "user", "content": "Hello"}
  ],
  "temperature": 0.2
}
\`\`\`

A response might nest the answer under \`choices[0].message.content\` — path depends on the provider.`],
['When to use it', `Use JSON for APIs, config that is data-not-code, and tool arguments. Use CSV for flat tables shared with spreadsheets; use databases for concurrent writes ([[databases-for-ai-apps]]).`],
['Practical notes', `JSON appears in config files, HTTP bodies, log lines and LLM tool arguments. Learn to spot invalid documents quickly: smart quotes from word processors, unescaped newlines inside strings, and 'NaN'/'Infinity' which are not valid JSON numbers. Use a formatter while developing, but keep parsers strict in production. When models generate JSON, ask for schema-constrained output if your provider supports it, then still validate ([[json-validation]]). Binary data does not belong in JSON without Base64, and huge Base64 blobs punish context windows. Prefer separate file storage for large artifacts and store only references in JSON metadata. Work through one real request end to end, write down the failure modes you observed, and add a regression test so the next change does not silently drop validation, auth, or logging. Prefer boring, reviewable code over a clever abstraction until the second or third product needs the same pattern. Work through one real request end to end, write down the failure modes you observed, and add a regression test so the next change does not silently drop validation, auth, or logging. Prefer boring, reviewable code over a clever abstraction until the second or third product needs the same pattern. Work through one real request end to end, write down the failure modes you observed, and add a regression test so the next change does not silently drop validation, auth, or logging. Prefer boring, reviewable code over a clever abstraction until the second or third product needs the same pattern. Work through one real request end to end, write down the failure modes you observed, and add a regression test so the next change does not silently drop validation, auth, or logging. Prefer boring, reviewable code over a clever abstraction until the second or third product needs the same pattern.`],
['Common mistakes', `- Single quotes (invalid in standard JSON).
- Trailing commas from copy-pasted JS objects.
- Treating a string that *looks* like JSON as already parsed.`],
]
},

{
slug: 'json-validation', title: 'How to Validate JSON', kind: C, group: 'Building',
question: 'How do I validate JSON before I trust it?',
summary: 'Validate JSON by parsing it safely, then checking required fields, types and allowed values — ideally with a schema. Reject unexpected shapes before they reach your model or database.',
short: 'To validate JSON: **parse, then enforce schema (required fields and types)**. Invalid data should fail closed before tools or prompts use it.',
aliases: ['How do I validate JSON?', 'JSON validation', 'validate JSON schema', 'check JSON fields', 'JSON schema validation'],
keywords: ['JSON', 'validation', 'schema', 'required fields', 'types'],
related: ['what-is-json', 'typescript-api-client-types', 'python-data-for-ai', 'function-calling', 'rest-apis'],
sections: [
['What is it?', `**JSON validation** means verifying that a document is syntactically valid JSON *and* that it matches the shape your program expects. Syntax alone is not enough: \`{"ok": true}\` parses but may be useless if you needed an \`id\` string.`],
['Why it matters', `AI systems emit and consume JSON constantly — API bodies, tool arguments, structured output. Unvalidated data causes security bugs (SQL/command injection via arguments) and confusing model failures. Validation belongs at trust boundaries.`],
['How to do it', `1. Parse with the language's JSON library; on failure, return 400.
2. Confirm the root type (object vs array).
3. Check **required fields** exist.
4. Check **types** (string/number/boolean/array/object) and ranges (min/max, enum).
5. Optionally enforce a JSON Schema with a validator library.
6. Strip unknown fields if your policy is deny-by-default.
7. Only then pass data to databases, shells or model prompts.

For TypeScript clients, combine types with runtime checks ([[typescript-api-client-types]]). For Python pipelines, validate after \`json.load\` ([[python-data-for-ai]]).`],
['Example', `\`\`\`js
function assertChatBody(data) {
  if (!data || typeof data !== "object") throw new Error("body must be object");
  if (typeof data.message !== "string" || !data.message.trim()) {
    throw new Error("message required string");
  }
  if (data.temperature !== undefined) {
    if (typeof data.temperature !== "number" || data.temperature < 0 || data.temperature > 2) {
      throw new Error("temperature out of range");
    }
  }
  return { message: data.message.trim(), temperature: data.temperature };
}
\`\`\`

Schema-based validators scale better once many endpoints share definitions.`],
['When to use it', `Validate every external JSON input: browser requests, model tool arguments, webhook bodies, files uploaded as \`.json\`. Skip only for throwaway local experiments.`],
['Practical notes', `Schema strategies: start with hand-written asserts for two or three fields; graduate to JSON Schema when multiple services share contracts. Version your schemas ('chat.request.v1') so old clients fail clearly. Validate again after the model returns structured output — models can omit required keys or invent enums. For tool arguments, validation failures should return a readable tool error so the model can retry, not a stack trace. Property tests can generate random invalid payloads to ensure your API stays fail-closed. Do not rely on a browser JSON formatter alone; server-side validation is mandatory even if a client tool helped you inspect a payload while debugging.`],
['Common mistakes', `- Using \`JSON.parse\` and assuming the shape is right.
- Validating only in the UI and not on the server.
- Allowing huge payloads without size limits.
- Trusting model-produced JSON without a schema (models can omit fields).`],
]
},

{
slug: 'what-is-an-api', title: 'What is an API?', kind: C, group: 'Building',
question: 'What is an API in practice?',
summary: 'An API is how one program asks another program to do work or return data — commonly over HTTP with JSON. Model providers expose APIs; your app exposes APIs to your own UI.',
short: 'An API is a **defined way for software to call software**. In web AI apps that usually means HTTP requests and JSON responses.',
aliases: ['what is an API', 'API explained', 'application programming interface', 'API practically'],
keywords: ['API', 'HTTP', 'JSON', 'client', 'server'],
related: ['rest-apis', 'api-authentication', 'what-is-json', 'mcp-vs-api', 'calling-ai-apis-with-python'],
sections: [
['What is it?', `An **API** (application programming interface) is a contract: inputs, outputs and rules that let one program use another. On the web, that often means sending an HTTP request to a URL and receiving JSON ([[rest-apis]], [[what-is-json]]). A "model API" is just an API specialised for generating tokens or embeddings.`],
['Why it matters', `AI products are API sandwiches: browser → your API → model API → maybe Gmail API. Clarity about each boundary keeps secrets and permissions in the right place ([[api-authentication]]).`],
['How to do it', `When you design an API:

1. Name resources and actions clearly.
2. Document request and response JSON.
3. Pick auth ([[api-authentication]]).
4. Define error codes and messages.
5. Version when breaking changes appear.

When you consume an API: read auth docs, use timeouts, validate responses, handle rate limits.`],
['Example', `Your UI calls \`POST /api/chat\` with \`{ "message": "…" }\`. Your server calls the vendor chat API. Both are APIs; only the server knows the vendor key. [[mcp-vs-api|MCP]] may wrap APIs for agent discovery, but the underlying service is still an API.`],
['When to use it', `Expose an API whenever another program (your frontend, a partner, an agent tool host) needs stable programmatic access. Use a UI-only flow for purely human tasks.`],
['Practical notes', `APIs can be public, partner-only or private to your frontend. Each level needs different auth and abuse controls. Good docs include example requests, error bodies and rate limits. For AI systems, your API is also what agent tools call — so stability and clear errors matter twice. Avoid breaking JSON field names casually; add fields additively. If you must break, version the path ('/v1', '/v2'). Remember that MCP servers and SDKs usually sit on top of APIs rather than replacing them ([[mcp-vs-api]]). When learning, call a simple public JSON API with curl, then recreate the call in [[calling-ai-apis-with-python|Python]] or [[calling-ai-apis-with-javascript|JavaScript]]. Work through one real request end to end, write down the failure modes you observed, and add a regression test so the next change does not silently drop validation, auth, or logging. Prefer boring, reviewable code over a clever abstraction until the second or third product needs the same pattern. Work through one real request end to end, write down the failure modes you observed, and add a regression test so the next change does not silently drop validation, auth, or logging. Prefer boring, reviewable code over a clever abstraction until the second or third product needs the same pattern. Work through one real request end to end, write down the failure modes you observed, and add a regression test so the next change does not silently drop validation, auth, or logging. Prefer boring, reviewable code over a clever abstraction until the second or third product needs the same pattern.`],
['Common mistakes', `- Calling everything an API when you mean "the website form".
- No error contract — clients cannot recover.
- Equating MCP with "not an API" ([[mcp-vs-api]]).`],
]
},

{
slug: 'rest-apis', title: 'REST APIs for Application Development', kind: C, group: 'Building',
question: 'What is a REST API and how do I use one?',
summary: 'REST APIs expose resources over HTTP using methods like GET, POST, PUT and DELETE, usually with JSON bodies and status codes that tell you whether the call worked.',
short: 'REST is a common HTTP style: **resources, methods, status codes, JSON bodies**. Model and SaaS APIs you call from agents often follow it.',
aliases: ['REST APIs', 'what is REST', 'REST HTTP JSON', 'GET POST API', 'REST resources'],
keywords: ['REST', 'HTTP', 'GET', 'POST', 'status codes', 'JSON'],
related: ['what-is-an-api', 'api-authentication', 'what-is-json', 'json-validation', 'mcp-vs-api'],
sections: [
['What is it?', `**REST** is a widely used way to design HTTP APIs. You identify **resources** with URLs (\`/v1/conversations/123\`), use **methods** to read or change them, send/receive **JSON**, and rely on **status codes** (200, 201, 400, 401, 404, 429, 500). Many AI vendor endpoints are REST-like even when they also offer streaming.`],
['Why it matters', `Agent tools and backends spend their lives calling REST APIs. Understanding methods and status codes prevents treating every failure as "the model broke".`],
['How to do it', `1. Read the OpenAPI/docs for paths and schemas.
2. Authenticate as documented ([[api-authentication]]).
3. Prefer idempotent GET/PUT patterns where the API offers them.
4. Check status codes before parsing bodies as success.
5. Honour \`Retry-After\` on 429 when present.
6. Validate JSON ([[json-validation]]).

When wrapping REST for agents, expose task-level tools rather than one tool per endpoint ([[mcp-vs-api]], [[agent-tools]]).`],
['Example', `\`\`\`http
POST /v1/chat/completions HTTP/1.1
Host: api.example.com
Authorization: Bearer <token>
Content-Type: application/json

{"model":"your-model-id","messages":[{"role":"user","content":"Hi"}]}
\`\`\`

Non-2xx responses should be handled as errors even if the body contains JSON.`],
['When to use it', `Use REST (or REST-like HTTP) for app backends and SaaS integrations. Consider GraphQL/gRPC when your stack already standardises on them — the auth and validation lessons still apply.`],
['Practical notes', `Design tips for your own REST AI backend: use nouns for resources ('/conversations', '/messages'), keep actions that do not fit CRUD as carefully named POSTs ('/conversations/{id}/cancel-stream'), and return problem-details or a small error object consistently. Pagination should be explicit for message history. Idempotency headers help when clients retry after network failures. For agent tools wrapping third-party REST, translate HTTP errors into short strings the model can act on ("not found", "forbidden", "rate limited") without dumping HTML error pages into the context window. See [[api-authentication]] for keys and OAuth and [[json-validation]] for bodies. Work through one real request end to end, write down the failure modes you observed, and add a regression test so the next change does not silently drop validation, auth, or logging. Prefer boring, reviewable code over a clever abstraction until the second or third product needs the same pattern. Work through one real request end to end, write down the failure modes you observed, and add a regression test so the next change does not silently drop validation, auth, or logging. Prefer boring, reviewable code over a clever abstraction until the second or third product needs the same pattern. Work through one real request end to end, write down the failure modes you observed, and add a regression test so the next change does not silently drop validation, auth, or logging. Prefer boring, reviewable code over a clever abstraction until the second or third product needs the same pattern. Work through one real request end to end, write down the failure modes you observed, and add a regression test so the next change does not silently drop validation, auth, or logging. Prefer boring, reviewable code over a clever abstraction until the second or third product needs the same pattern.`],
['Common mistakes', `- Ignoring status codes because "there was a body".
- Caching authenticated GET responses incorrectly.
- Mapping every REST endpoint 1:1 to an agent tool.`],
]
},

{
slug: 'api-authentication', title: 'API Authentication: Keys, Sessions and OAuth', kind: C, group: 'Building',
question: 'How should APIs authenticate clients?',
summary: 'Choose API keys for server-to-server access, session cookies for browser users, and OAuth when acting on a user\'s behalf at another provider. Always keep secrets on the server.',
short: 'Pick auth by situation: **API keys** for servers, **sessions** for your logged-in users, **OAuth** for delegated access — and never embed secrets in the browser.',
aliases: ['API authentication', 'API keys vs OAuth', 'where to store API secrets', 'Bearer token API'],
keywords: ['API key', 'OAuth', 'session', 'Bearer', 'secrets'],
related: ['oauth-for-ai-agents', 'what-is-an-api', 'rest-apis', 'ai-privacy-and-security', 'javascript-for-ai'],
sections: [
['What is it?', `**Authentication** proves who is calling an API; **authorisation** decides what they may do. Common web patterns:

- **API keys / bearer tokens** — secret strings your server sends to a vendor.
- **Session cookies** — browser users logged into *your* app.
- **OAuth access tokens** — delegated access to a third-party account ([[oauth-for-ai-agents]]).`],
['Why it matters', `AI features are expensive and privileged. A leaked model key burns money; a leaked Google refresh token leaks mail. Putting secrets in front-end code is the most common failure ([[javascript-for-ai]]).`],
['How to do it', `1. Model vendor key → environment variable on the server only.
2. End-user calls your \`/api/*\` → require your session/JWT; then your server uses the vendor key.
3. User's Gmail → OAuth; store refresh tokens encrypted ([[gmail-for-ai-agents]]).
4. Rotate keys; scope them; never commit \`.env\`.
5. Prefer short-lived access tokens where providers offer them.`],
['Example', `Browser sends \`Cookie: session=…\` to your API. Your API checks the session, then sends \`Authorization: Bearer sk-…\` to the model vendor. The browser never sees \`sk-…\`.`],
['When to use it', `Always authenticate AI proxy routes. Public unauthenticated demo endpoints need strict rate limits and abuse plans if you must run them at all.`],
['Practical notes', `Rotation and least privilege close the loop. Issue separate keys per environment (dev/stage/prod) and per service. Prefer keys that can be limited by IP or by allowed models if the vendor supports it. For user sessions, set cookie flags ('HttpOnly', 'Secure', 'SameSite') appropriately. For OAuth, practice revoking tokens when employees leave. Security reviews should ask where every secret lives and who can read it. If a key leaks in a chat log, rotate first and investigate second. This topic connects directly to [[oauth-for-ai-agents]] for delegated access and [[ai-privacy-and-security]] for data handling once calls succeed. Work through one real request end to end, write down the failure modes you observed, and add a regression test so the next change does not silently drop validation, auth, or logging. Prefer boring, reviewable code over a clever abstraction until the second or third product needs the same pattern. Work through one real request end to end, write down the failure modes you observed, and add a regression test so the next change does not silently drop validation, auth, or logging. Prefer boring, reviewable code over a clever abstraction until the second or third product needs the same pattern. Work through one real request end to end, write down the failure modes you observed, and add a regression test so the next change does not silently drop validation, auth, or logging. Prefer boring, reviewable code over a clever abstraction until the second or third product needs the same pattern. Work through one real request end to end, write down the failure modes you observed, and add a regression test so the next change does not silently drop validation, auth, or logging. Prefer boring, reviewable code over a clever abstraction until the second or third product needs the same pattern.`],
['Common mistakes', `- \`VITE_OPENAI_KEY\` in client bundles.
- Long-lived keys shared across all environments.
- Logging full headers including Authorization.`],
]
}
];
