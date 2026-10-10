const C = 'concept';
const K = 'comparison';
export const pages = [
{
slug: 'react-ai-interfaces', title: 'Building AI Interfaces with React', kind: C, group: 'Interfaces',
question: 'How do I build an AI chat interface in React?',
summary: 'Build a React chat UI with a message list, an input box, loading and error states, and calls to your backend — never with a model API key in the client bundle.',
short: 'A React AI interface is a **message list + composer + loading/error states** talking to your own API. Keep secrets on the server; keep UI state explicit.',
aliases: ['building AI interfaces with React', 'React AI chat UI', 'React chatbot UI', 'AI chat interface React', 'React LLM frontend'],
keywords: ['react', 'chat UI', 'messages', 'loading', 'error', 'fetch'],
related: ['react-chatbot-state', 'javascript-for-ai', 'streaming-ai-responses', 'nodejs-for-ai', 'typescript-for-ai'],
sections: [
['What is it?', `An AI chat interface in React is an ordinary web UI: it renders conversation turns, accepts user input, and displays assistant replies. The model lives behind your backend. You do not need a specific meta-framework (Next.js, Remix, etc.) to learn the pattern — a single-page React app calling \`fetch\` is enough to start.`],
['Why it matters', `Users judge AI products by the interface: clear pending states, readable errors, and interruptible streams. A solid UI also makes it obvious when the API key must not be in the browser ([[javascript-for-ai]]).`],
['How to do it', `1. Layout: scrollable message list, composer (textarea + send), optional stop button.
2. State: messages array and pending flag ([[react-chatbot-state]]).
3. On submit: append the user message, set pending, \`POST\` to \`/api/chat\`.
4. On success: append assistant message; on failure: show an error banner and keep the draft.
5. Escape or sanitise any Markdown HTML before \`dangerouslySetInnerHTML\`.
6. Add streaming later ([[streaming-ai-responses]]) once the non-stream path works.
7. Disable the send button while pending; allow Escape/Stop to abort.`],
['Example', `\`\`\`jsx
function ChatApp() {
  const [messages, setMessages] = React.useState([]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [draft, setDraft] = React.useState("");

  async function send() {
    const text = draft.trim();
    if (!text || pending) return;
    setDraft(""); setError(null); setPending(true);
    setMessages(m => [...m, { role: "user", content: text }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      setMessages(m => [...m, { role: "assistant", content: data.text }]);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <ul>{messages.map((m, i) => <li key={i}><strong>{m.role}:</strong> {m.content}</li>)}</ul>
      {pending && <p>Thinking…</p>}
      {error && <p role="alert">{error}</p>}
      <textarea value={draft} onChange={e => setDraft(e.target.value)} />
      <button disabled={pending} onClick={send}>Send</button>
    </div>
  );
}
\`\`\``],
['When to use it', `Use React when your product already has a React design system or you need rich client state. Plain HTML is fine for internal tools. Pair with [[nodejs-for-ai|Node]] or another backend for secrets.`],
['Practical notes', `Accessibility and polish separate a demo from a product. The composer should be a labelled field; errors should use 'role="alert"'. Support Enter to send and Shift+Enter for newline if that matches your users. Provide a clear empty state that suggests example questions from your domain. Persist draft text if the user refreshes mid-composition. When rendering assistant Markdown, use a sanitiser and open links in a new tab with 'rel="noopener noreferrer"'. Measure time-to-first-token and total response time; the UI is the right place to display a subtle timer for power users. Keep styling consistent with the rest of IntelliTools-like products: readable contrast, large tap targets on mobile, and no reliance on hover-only controls.`],
['Common mistakes', `- Putting the model API key in Vite env vars prefixed for the client.
- No loading state — users double-submit.
- Replacing the whole message list instead of appending.
- Rendering untrusted Markdown as raw HTML.`],
]
},

{
slug: 'react-chatbot-state', title: 'Chatbot State and Conversation UI in React', kind: C, group: 'Interfaces',
question: 'How should I manage React state for a chatbot?',
summary: 'Model chatbot state as a messages array with roles, a pending flag, and optional streaming buffers. Keep the API key off the client and treat each turn as append-only history you send to your backend.',
short: 'React state for a chatbot is mainly a **messages array** (who said what), **pending**, and **error** — not a place to store API secrets.',
aliases: ['React state for a chatbot', 'chatbot state React', 'conversation UI state', 'messages array React chat', 'React chat history state'],
keywords: ['react', 'state', 'messages', 'pending', 'conversation', 'useState'],
related: ['react-ai-interfaces', 'streaming-ai-responses', 'agent-memory', 'context-windows', 'javascript-for-ai'],
sections: [
['What is it?', `**Chatbot state** is the data that makes the UI coherent across turns: the ordered list of messages, whether a reply is in flight, any partial streamed text, and errors. React holds that state in component state or a small store. The model itself is stateless; your UI and server re-send history as needed ([[agent-memory]], [[context-windows]]).`],
['Why it matters', `Bugs in state show up as duplicated messages, lost drafts, or spinners that never clear. Clear state also clarifies security: tokens and API keys never belong in \`useState\` on the client.`],
['How to do it', `Recommended fields:

- \`messages: { id, role: 'user'|'assistant'|'system', content }[]\`
- \`pending: boolean\`
- \`error: string | null\`
- \`draft: string\` for the composer
- optional \`streamingId\` / partial content while streaming

Patterns:

1. Append user message optimistically, then append assistant on success.
2. On failure, keep the user message, set \`error\`, clear \`pending\`.
3. When talking to your API, send only the history slice you intend (trim for [[context-windows|context]] limits on the server).
4. Do not store \`MODEL_API_KEY\` in React state or \`localStorage\`.
5. For streaming, update the last assistant message's content as tokens arrive ([[streaming-ai-responses]]).`],
['Example', `\`\`\`js
const initial = { messages: [], pending: false, error: null, draft: "" };

function reducer(state, action) {
  switch (action.type) {
    case "draft": return { ...state, draft: action.value };
    case "send":
      return {
        ...state,
        draft: "",
        pending: true,
        error: null,
        messages: [...state.messages, { id: action.id, role: "user", content: action.text }],
      };
    case "receive":
      return {
        ...state,
        pending: false,
        messages: [...state.messages, { id: action.id, role: "assistant", content: action.text }],
      };
    case "fail":
      return { ...state, pending: false, error: action.error };
    default: return state;
  }
}
\`\`\`

Wire the reducer to the UI in [[react-ai-interfaces]].`],
['When to use it', `Use an explicit messages array as soon as you have more than one turn. Lift state if multiple components (sidebar history, main thread) need the same conversation.`],
['Practical notes', `As conversations grow, consider pagination or virtualised lists so thousands of DOM nodes do not appear at once. Store a client-generated 'id' on each message so streaming updates can target the correct row. If you support editing a past user message and regenerating, treat that as a branch: either truncate following messages or keep an alternate thread id. Separate "display history" from "model history" when the server strips tool traces the user should not see. Persist conversations to your backend ([[databases-for-ai-apps]]) keyed by user, and reload them into the same state shape on refresh. Never stash OAuth tokens or vendor keys beside the messages array in 'localStorage'.`],
['Common mistakes', `- Mutating the messages array in place so React skips re-renders.
- Putting the API key in context "for convenience".
- Sending the entire unbounded history forever without server-side trimming.
- Losing the draft when an error occurs.`],
]
},

{
slug: 'nodejs-for-ai', title: 'Node.js for AI Applications', kind: C, group: 'Interfaces',
question: 'How do I use Node.js for AI applications?',
summary: 'Use Node.js as the server that holds API keys, authenticates users, calls the model vendor, and exposes a thin route your React (or other) client can call.',
short: 'Node.js is a solid **server-side home for AI calls**: keep secrets in the environment, expose `/api/chat`, and let the browser talk only to you.',
aliases: ['Node.js for AI', 'Node.js for AI applications', 'node AI backend', 'express LLM proxy', 'server side AI javascript'],
keywords: ['node', 'nodejs', 'server', 'API key', 'proxy', 'express'],
related: ['javascript-for-ai', 'calling-ai-apis-with-javascript', 'streaming-ai-with-nodejs', 'react-ai-interfaces', 'api-authentication'],
sections: [
['What is it?', `[[javascript-for-ai|JavaScript]] on the server — **Node.js** — is where many AI web apps place vendor credentials, rate limits and logging. The browser calls your Node route; Node calls the model. That split is the core architecture.`],
['Why it matters', `If the browser held the vendor key, anyone could steal it. Node (or another backend) also gives you one place to enforce auth, trim history, and attach tools ([[agent-tools]]).`],
['How to do it', `1. Create a small HTTP server (built-in \`node:http\`, Express, Fastify, etc.).
2. Read \`MODEL_API_KEY\` from the environment at process start.
3. Add \`POST /api/chat\` that:
   - authenticates the session;
   - validates JSON body;
   - calls the vendor ([[calling-ai-apis-with-javascript]]);
   - returns \`{ text }\` or streams ([[streaming-ai-with-nodejs]]).
4. Set request timeouts and limit body size.
5. Log metrics without storing raw sensitive prompts unless policy allows ([[ai-privacy-and-security]]).`],
['Example', `\`\`\`js
import http from "node:http";
import { chat } from "./model.js"; // wraps vendor fetch

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/chat") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { res.writeHead(400); res.end('{"error":"bad json"}'); return; }
    try {
      const text = await chat([{ role: "user", content: String(body.message || "") }]);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ text }));
    } catch (e) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "upstream_failed" }));
    }
    return;
  }
  res.writeHead(404); res.end();
});
server.listen(3000);
\`\`\``],
['When to use it', `Use Node when your UI is JavaScript/React and you want one language across client and server. Use Python for the model proxy if the rest of your ML stack is Python — the pattern is the same.`],
['Practical notes', `Operational basics: run Node behind a reverse proxy that terminates TLS, set 'NODE_ENV=production', and limit body size (for example 1mb) unless you accept uploads elsewhere. Use a process manager that restarts on crash. Separate config for model base URL and model id so you can switch providers without code edits. Add a kill switch environment flag that returns a friendly "AI temporarily unavailable" without calling the vendor. When attaching tools, execute them in the same request lifecycle with hard timeouts. Prefer structured logs (JSON) with user id hashes rather than raw emails. This service is also where you enforce org quotas before spending tokens.`],
['Common mistakes', `- Committing \`.env\` with live keys.
- Open CORS to \`*\` on authenticated AI routes.
- No upstream timeout.
- Trusting \`body.message\` length without limits (cost attacks).`],
]
},

{
slug: 'streaming-ai-with-nodejs', title: 'Streaming AI Responses with Node.js', kind: C, group: 'Interfaces',
question: 'How do I stream AI responses with Node.js from an API?',
summary: 'In Node.js, call the vendor streaming endpoint, then forward chunks to the browser as SSE or chunked HTTP while handling backpressure, aborts and errors.',
short: 'Node.js streaming from an API means **piping vendor tokens through your server** to the client as SSE/chunked data, with cancel support.',
aliases: ['Node.js streaming responses from an API', 'Node.js streaming responses', 'stream LLM from node', 'SSE proxy node AI', 'node stream openai'],
keywords: ['node', 'streaming', 'SSE', 'proxy', 'AbortController', 'chunked'],
related: ['streaming-ai-responses', 'nodejs-for-ai', 'calling-ai-apis-with-javascript', 'react-chatbot-state'],
sections: [
['What is it?', `Vendors often return **streamed** completions. Your Node process is the middle layer: it authenticates the user, opens the vendor stream with the secret key, and writes events to the browser. This page focuses on the server side; client parsing is in [[streaming-ai-responses]].`],
['Why it matters', `Without a server proxy, the browser would need the vendor key. With a proxy, you can enforce auth, hide provider formats, and cancel upstream work when the client disconnects — essential for cost control.`],
['How to do it', `1. Client opens \`GET\` or \`POST\` to your \`/api/chat/stream\`.
2. Node validates the user and body.
3. Node \`fetch\`es the vendor with \`stream: true\` (field names vary).
4. Set response headers for SSE (\`Content-Type: text/event-stream\`, \`Cache-Control: no-cache\`).
5. For each upstream chunk, parse provider events, extract text deltas, \`write\` \`data: …\\n\\n\` to the client.
6. On client close (\`req.on('close')\`), abort the upstream fetch.
7. On upstream error after headers were sent, write an error event and end.`],
['Example', `\`\`\`js
export async function streamChat(req, res, messages) {
  const key = process.env.MODEL_API_KEY;
  const upstream = await fetch("https://api.example.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${key}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "your-model-id", messages, stream: true }),
  });
  if (!upstream.ok || !upstream.body) {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "upstream" }));
    return;
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const reader = upstream.body.getReader();
  const dec = new TextDecoder();
  req.on("close", () => reader.cancel().catch(() => {}));
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    // simplify: forward decoded text; real code parses provider SSE
    const chunk = dec.decode(value, { stream: true });
    res.write(\`data: \${JSON.stringify({ raw: chunk })}\\n\\n\`);
  }
  res.write("data: [DONE]\\n\\n");
  res.end();
}
\`\`\`

Production code should parse provider events and emit a stable \`{ token }\` schema for [[react-chatbot-state|React]].`],
['When to use it', `Stream from Node when the UI needs token-by-token updates. For batch jobs and evals, non-streaming JSON is simpler.`],
['Practical notes', `Watch for proxy buffering: some reverse proxies buffer SSE until a flush threshold — configure them to disable buffering on the stream route. Send a comment heartbeat (': ping') every 15–30 seconds if connections traverse idle timeouts. Normalize vendor quirks (different delta field names) before writing to the client. If the vendor supports cancellation via DELETE or by closing the body, wire that to the Node 'close' event. Backpressure: if 'res.write' returns false, pause the upstream reader until 'drain'. Record metrics for time-to-first-token and bytes streamed. Keep non-stream JSON available on a sibling route for clients and tests that do not need SSE.`],
['Common mistakes', `- Forgetting to abort upstream on client disconnect.
- Buffering the entire vendor stream before writing (defeats streaming).
- Mixing compressed responses without handling byte boundaries.
- Leaking vendor error bodies that contain internal details.`],
]
},
];
