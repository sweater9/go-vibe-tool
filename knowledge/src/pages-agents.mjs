const C = 'concept';
export const pages = [
{
slug: 'ai-agents', title: 'What are AI Agents?', kind: C, group: 'Agents & Tools',
question: 'What is an AI agent and how does it work?',
summary: 'An AI agent is a system in which a language model decides what to do next — calling tools, observing results and repeating — to pursue a goal with limited human direction.',
short: 'An AI agent is a **model running in a loop with tools**: it plans a step, acts (calls a tool), observes the result, and decides what to do next until the goal is met or it stops. More autonomy means more power and more risk.',
aliases: ['AI agent', 'AI agents', 'what is an agent', 'agentic AI', 'autonomous agent', 'LLM agent', 'how do AI agents work', 'agent loop', 'ReAct', 'tool-using AI'],
keywords: ['loop', 'planning', 'tools', 'observation', 'autonomy', 'goal', 'memory', 'orchestration', 'guardrails'],
related: ['ai-agent-vs-chatbot', 'agent-tools', 'function-calling', 'agent-memory', 'multi-agent-systems', 'agentic-workflows', 'mcp', 'ai-evaluation'],
sections: [
['What is it?', `Definitions vary, but a useful working one is: an **AI agent** is a system where a language model is given a **goal** and a set of **tools**, and it chooses its own sequence of actions to achieve the goal, using the results of each action to decide the next.

A plain model call turns one input into one output. An agent wraps the model in a **loop**, which makes it capable of multi-step tasks such as "find the cause of this failing test, fix it and run the tests again."`],
['Why does it matter?', `Many valuable tasks are not answerable in one step: researching a topic across sources, triaging tickets, updating records in several systems, debugging code. Agents extend what a model can *do*, not just what it can *say*. They also change the risk profile: an agent can take actions with side effects, so reliability, permissions and oversight become central ([[ai-privacy-and-security]], [[prompt-injection]]).`],
['How does it work?', `The core loop:

1. **Goal and context** — the system prompt, the user's request, and relevant [[agent-memory|memory]].
2. **Reason / plan** — the model decides the next step.
3. **Act** — it requests a tool call ([[function-calling]]); your code runs the tool ([[agent-tools]]).
4. **Observe** — the tool result is added to the context.
5. **Repeat or finish** — the model either calls another tool or returns a final answer.

\`\`\`js
// Minimal agent loop (pseudo-code)
const messages = [system, { role: "user", content: goal }];
for (let step = 0; step < MAX_STEPS; step++) {
  const reply = await llm.chat(messages, { tools });
  messages.push(reply);
  if (!reply.toolCalls) return reply.text;          // done
  for (const call of reply.toolCalls) {
    const result = await runTool(call.name, call.args);   // validate + execute
    messages.push({ role: "tool", id: call.id, content: result });
  }
}
throw new Error("Step limit reached");
\`\`\`

Notice the practical controls: a **step limit**, **validated tool execution**, and the growing message list, which consumes the [[context-windows|context window]].`],
['Example', `A coding agent is asked to fix a failing test. It lists files (tool), reads the test and source (tool), proposes an edit (tool), runs the test suite (tool), sees a new failure, adjusts, and re-runs until tests pass or it hits its step limit — then summarises what it changed. A human reviews the diff before merging. The review step is not optional decoration: it is how the system stays trustworthy.`],
['When should I use it?', `Use an agent when the path to the goal cannot be fixed in advance and the task benefits from adapting to intermediate results. If you can write the steps down in advance, a fixed [[agentic-workflows|workflow]] is usually cheaper, faster and more predictable. If you only need an answer, a single model call or a chat assistant is enough ([[ai-agent-vs-chatbot]]).`],
['Common mistakes', `- **Using an agent for a fixed process.** Added autonomy adds error and cost.
- **No step, time or cost limits.** Loops can run away.
- **Overly broad tool permissions** ([[agent-tools]]).
- **Letting errors compound.** One wrong early step can derail the rest; add checks between steps.
- **Evaluating only the final answer.** Also inspect tool choices and arguments ([[ai-evaluation]]).
- **No human approval for irreversible actions.**`]
]},

{
slug: 'agent-tools', title: 'Agent Tools: How AI Agents Take Actions', kind: C, group: 'Agents & Tools',
question: 'What are tools in AI agents and how are they designed?',
summary: 'Tools are functions or services a model can ask to be run — search, databases, calculators, APIs, file access — which turn a text generator into something that can act.',
short: 'A tool is a **described capability** (name, purpose, input schema) that a model can request; your code executes it and returns the result. Good tools are narrow, well-described, validated and permission-limited.',
aliases: ['tools', 'AI tools', 'agent tool use', 'tool use', 'LLM tools', 'tool calling', 'tool design', 'how AI agents use tools'],
keywords: ['function', 'API', 'schema', 'permissions', 'side effects', 'search tool', 'code execution', 'idempotent', 'validation'],
related: ['function-calling', 'mcp', 'ai-agents', 'prompt-injection', 'ai-privacy-and-security', 'function-calling-vs-mcp'],
sections: [
['What is it?', `On its own a language model can only produce text. A **tool** is something it can *ask your software to do*: search the web, query a database, read a file, run code, call a calendar API, send an email. Each tool is presented to the model as a short description — a name, what it does, and the arguments it takes — and the model decides when to use it.

The model never runs the tool. It emits a structured request; **your code** (or the platform) performs the action and returns the result for the model to read. The request format is described in [[function-calling]]; a standard way to package and share tools across applications is [[mcp]].`],
['Why does it matter?', `Tools address the model's built-in limits:

- **Stale knowledge** → search or retrieval tools.
- **Weak arithmetic and exact lookups** → calculators, databases.
- **Inability to act** → APIs that create tickets, send messages, update records.
- **Unverifiable claims** → tools that fetch the source so answers can cite it.

They are also where most agent *risk* lives, because tools are what turn model mistakes or manipulated instructions into real-world effects.`],
['How does it work?', `Each tool definition typically has:

- a **name** (\`search_orders\`),
- a **description** that tells the model when to use it,
- an **input schema** (usually JSON Schema) describing arguments and types.

At run time: the model sees the definitions, chooses a tool and arguments, your code **validates and executes**, and the result goes back into the context.

Design guidelines:

1. **Keep tools narrow and clear.** \`get_order_status(order_id)\` beats a generic \`run_sql(query)\`.
2. **Write descriptions for the model:** purpose, when to use, when not to, units and formats.
3. **Return concise, relevant results.** Huge outputs waste the [[context-windows|context window]] and distract the model. Return helpful error messages so it can recover.
4. **Validate every argument in code.** Never trust model-supplied values.
5. **Apply least privilege:** read-only where possible; scoped credentials; per-user authorisation checked in code.
6. **Separate safe from risky.** Reading is low risk; writing, deleting, paying and sending need confirmation.
7. **Make actions idempotent or reversible** when you can, so retries do not duplicate effects.
8. **Log calls** for audit and debugging.`],
['Example', `A tool definition (generic JSON-Schema style; exact wrapper fields vary by provider):

\`\`\`json
{
  "name": "get_order_status",
  "description": "Look up the shipping status of a customer's order by its ID. Use only when the user provides or confirms an order ID. Read-only.",
  "input_schema": {
    "type": "object",
    "properties": {
      "order_id": { "type": "string", "description": "Order ID such as ORD-10492" }
    },
    "required": ["order_id"]
  }
}
\`\`\`

The server-side handler checks that the logged-in user owns \`order_id\` before returning anything. That check lives in code, not in the prompt.`],
['When should I use it?', `Give a model a tool when the task needs fresh data, exact computation, or a real-world action — and when you can constrain it safely. If the model can already do the job from the prompt text, extra tools only add complexity. Start with the smallest useful toolset; each additional tool is more for the model to choose between, and more surface to secure.`],
['Common mistakes', `- **Too many overlapping tools,** causing wrong selection.
- **Vague descriptions.** The description is the model's only guide.
- **Trusting arguments** (SQL, file paths, URLs) without validation.
- **Over-privileged credentials.**
- **Returning raw, enormous payloads.**
- **Assuming tool output is trustworthy.** Content from tools can carry [[prompt-injection]].`]
]},

{
slug: 'function-calling', title: 'Function Calling (Tool Calling) Explained', kind: C, group: 'Agents & Tools',
question: 'What is function calling in LLMs and how does it work?',
summary: 'Function calling lets a model return a structured request to run a named function with arguments, so applications can connect models to code and data reliably.',
short: 'In function calling you describe functions to the model; instead of free text it can reply with a **structured call** — function name plus JSON arguments. Your code runs the function and sends back the result. The model never executes anything itself.',
aliases: ['function calling', 'tool calling', 'tool use API', 'LLM function calling', 'structured outputs', 'JSON mode', 'OpenAI function calling', 'how function calling works'],
keywords: ['JSON schema', 'arguments', 'tool call', 'tool result', 'structured output', 'validation', 'parallel tool calls', 'API'],
related: ['agent-tools', 'mcp', 'function-calling-vs-mcp', 'ai-agents', 'prompt-engineering', 'ai-hallucinations'],
sections: [
['What is it?', `**Function calling** (also called *tool calling* or *tool use*) is a feature of many model APIs. You send the model your request *and* a list of function definitions — name, description, and a JSON Schema for arguments. If the model decides a function is needed, its response contains a **structured call** instead of (or alongside) prose.

Terminology and exact field names differ between providers, but the pattern is the same everywhere. It is the mechanism that implements [[agent-tools|agent tools]].`],
['Why does it matter?', `Free-form text is hard for software to act on. Asking a model to "say the order number" and parsing the sentence is brittle. Function calling gives you:

- **Machine-readable output** — arguments that match a schema you defined.
- **A clean boundary** between what the model decides and what your code does.
- **A path to real capabilities** — databases, APIs, calculators — rather than guesses from memory.
- **Structured extraction**, even without any real function: define a "record_invoice" function and let the model fill its arguments from messy text.`],
['How does it work?', `The round trip:

1. **Request:** your messages + function definitions go to the model.
2. **Model decision:** it replies with a tool call, e.g. name \`get_weather\`, arguments \`{"city":"Lisbon"}\`.
3. **Your code:** parse, **validate**, authorise, and execute the real function.
4. **Return the result** to the model as a tool-result message.
5. **Final response:** the model uses the result to write the answer — or requests another call.

\`\`\`json
// 2) what the model returns (shape is illustrative; varies by provider)
{ "tool_call": { "id": "call_1", "name": "get_weather", "arguments": { "city": "Lisbon", "unit": "celsius" } } }

// 4) what you send back
{ "role": "tool", "tool_call_id": "call_1", "content": "{\\"temp_c\\": 21, \\"condition\\": \\"sunny\\"}" }
\`\`\`

Important points: the model produces *text that looks like a call* based on the schema — it can choose the wrong function, omit arguments, or invent values, so validate; some APIs can constrain output strictly to the schema, but that guarantees format, not correctness. Many APIs allow multiple calls in one turn.`],
['Example', `Task: "Book a table for 4 tomorrow at 7pm."

- Function: \`create_reservation(party_size:int, datetime:string, restaurant_id:string)\`.
- The model needs the restaurant and today's date. A good design lets it ask a follow-up question or call \`search_restaurants\` first, rather than guessing an ID.
- Your code checks the datetime is in the future and the party size is within limits, then calls the booking API and returns a confirmation or an error message the model can explain.`],
['When should I use it?', `Use function calling when an application must reliably act on or fetch data, or when you want structured output from unstructured text. If you only need a conversational answer, skip it. If you expect many tools shared across many apps, consider a standard like [[mcp]] (see [[function-calling-vs-mcp]]).`],
['Common mistakes', `- **Executing calls without validation or authorisation.**
- **Vague function descriptions,** leading to wrong tool choice.
- **Assuming a schema-valid call is a correct call.**
- **Not handling failure paths:** tool errors, timeouts, refusals to call.
- **Forgetting that tool definitions cost tokens** on every request ([[tokens]]).`]
]},

{
slug: 'agent-memory', title: 'Agent Memory: Short-Term, Long-Term and Beyond', kind: C, group: 'Agents & Tools',
question: 'How do AI agents remember things?',
summary: 'Models have no built-in memory between requests. Agent memory is whatever your system stores and re-inserts into the context: recent messages, summaries, facts and retrieved knowledge.',
short: 'LLMs are stateless, so "memory" is **engineering around the model**: keep recent messages (short-term), store durable facts or summaries outside the model (long-term), and retrieve only what is relevant into the [[context-windows|context window]] when needed.',
aliases: ['agent memory', 'AI memory', 'long-term memory', 'short-term memory', 'conversation memory', 'chatbot memory', 'persistent memory', 'LLM memory', 'memory for agents'],
keywords: ['state', 'summarisation', 'retrieval', 'user preferences', 'episodic', 'semantic memory', 'working memory', 'vector store', 'scratchpad'],
related: ['context-windows', 'rag', 'embeddings', 'ai-agents', 'ai-privacy-and-security', 'agentic-workflows'],
sections: [
['What is it?', `A language model does not remember your previous request. Each call only knows what is in the text sent with it ([[context-windows]]). So when an assistant seems to remember you, your application is **storing information and putting it back into the prompt**.

It is helpful to separate kinds of memory:

- **Working / short-term memory:** the current conversation and intermediate results inside the context window.
- **Long-term memory:** information persisted outside the model across sessions — user preferences, past decisions, facts learned.
- **Procedural memory:** instructions and learned ways of doing tasks, often stored as prompts or notes.
- **Knowledge memory:** documents and reference material, usually accessed through [[rag]].

These categories borrow words from psychology; they are design labels, not a claim that the model works like a brain.`],
['Why does it matter?', `Without memory, every session starts from scratch and long tasks overflow the window. With poor memory, an agent repeats mistakes, forgets constraints, or confidently acts on stale or wrong "remembered" facts. Memory also creates privacy duties: what you store about users must be disclosed, protected, correctable and deletable ([[ai-privacy-and-security]]).`],
['How does it work?', `Common techniques, usually combined:

1. **Sliding window:** keep the last N messages. Simple; older detail is lost.
2. **Summarisation:** periodically compress older turns into a short summary that stays in context.
3. **Extracted facts / notes:** have the system (or the model via a tool) write durable entries — "prefers metric units", "project deadline is 14 June" — into a store such as a database or file.
4. **Retrieval:** embed memories ([[embeddings]]) and fetch the few most relevant for the current request, rather than loading everything.
5. **Scratchpads / task state:** structured working notes for multi-step work — plan, completed steps, open questions.

Every approach has trade-offs: summaries lose detail and can embed errors; retrieved memories may be irrelevant; stored facts go stale. Good systems let memories carry timestamps and sources, allow correction, and give users visibility and control.`],
['Example', `A travel-planning agent keeps three things: (1) the current conversation; (2) a small JSON profile — \`{ "home_airport": "LIS", "dietary": "vegetarian" }\` — saved after the user confirms it; (3) a task note listing the itinerary decisions so far. On each turn the prompt includes the profile, the task note and only the recent messages. When the user says "use my usual airport", the agent can resolve it. When the user changes their mind, the profile is updated rather than appended to forever.`],
['When should I use it?', `Add the lightest memory that meets the need. A one-off Q&A needs none. A multi-turn assistant needs conversation handling. A personal assistant or long-running agent needs persistent facts and a way to retrieve them. Let users view and delete what is stored.`],
['Common mistakes', `- **Storing everything.** Noise crowds out signal and raises cost and risk.
- **Treating summaries as ground truth.**
- **No expiry or correction path** for outdated memories.
- **Cross-user leakage** from badly scoped stores.
- **Saving sensitive data** without a clear need or consent.
- **Confusing memory with RAG.** RAG retrieves from a document corpus; agent memory is state about the interaction and user — though the retrieval machinery can be shared.`]
]},

{
slug: 'multi-agent-systems', title: 'Multi-Agent Systems Explained', kind: C, group: 'Agents & Tools',
question: 'What are multi-agent systems and when are they worth it?',
summary: 'A multi-agent system uses several model-driven agents with distinct roles or contexts that coordinate — for example a planner, specialists and a reviewer — to complete a larger task.',
short: 'Multi-agent systems split work across **several agents with separate roles, instructions, tools or context**, coordinated by an orchestrator or by message passing. They can help with parallel or specialised work but add cost, complexity and failure modes.',
aliases: ['multi-agent', 'multi agent systems', 'agent orchestration', 'multiple agents', 'agent swarm', 'supervisor agent', 'sub-agents', 'subagents', 'agent collaboration', 'orchestrator worker'],
keywords: ['orchestrator', 'delegation', 'handoff', 'parallel', 'specialist', 'reviewer', 'communication', 'coordination', 'context isolation'],
related: ['ai-agents', 'agentic-workflows', 'agent-memory', 'agent-tools', 'ai-evaluation', 'ai-agent-vs-chatbot'],
sections: [
['What is it?', `Instead of one agent doing everything, a **multi-agent system** uses several. Each agent is typically a model call (or loop) with its own system prompt, tools and context window, and a narrower job. They cooperate through some coordination pattern.

Common patterns:

- **Orchestrator–workers:** a lead agent breaks a task into parts, delegates to worker agents, and combines results.
- **Pipeline:** each agent handles one stage and passes output onward (research → draft → edit).
- **Specialists with handoff:** a router sends the request to the agent best suited (billing, technical, legal).
- **Generator–reviewer:** one agent produces, another critiques against a checklist.
- **Parallel exploration:** several agents tackle independent sub-questions at once.`],
['Why does it matter?', `Reasons teams adopt the approach:

- **Context isolation.** Each agent sees only what it needs, keeping its [[context-windows|context window]] focused instead of cluttered with everything.
- **Specialisation.** Narrow prompts and tool sets are easier to write, test and secure.
- **Parallelism.** Independent subtasks can run simultaneously, saving elapsed time.
- **Independent review.** A separate checker may catch errors the producer missed (though it can share the same blind spots if built on the same model).`],
['How does it work?', `Coordination is the hard part. Design decisions include:

1. **Roles and boundaries** — what each agent is responsible for, and which tools it may use.
2. **Communication** — structured messages (JSON with defined fields) are more reliable than loose prose between agents.
3. **Control flow** — who decides the next step: a central orchestrator, fixed rules, or the agents themselves.
4. **Shared state** — what is passed along, what is stored ([[agent-memory]]), and how conflicts are resolved.
5. **Termination** — step limits, budgets and clear "done" criteria, to avoid agents talking in circles.
6. **Oversight** — logging every message and tool call for debugging, and human approval for risky actions.

Cost is multiplicative: several agents each using many tokens can consume far more than a single agent. Latency and error propagation also rise: a wrong claim from one agent can be treated as fact by the next.`],
['Example', `Research report workflow:

1. *Planner* splits the question into four sub-questions.
2. Four *researcher* agents each search and summarise one sub-question, returning claims with source URLs in a fixed JSON format.
3. A *writer* agent drafts from those findings only.
4. A *reviewer* agent checks each claim against the cited sources and flags unsupported ones.
5. A human approves the final document.

Compare with a fixed [[agentic-workflows|workflow]]: if the four sub-questions are always the same, a plain pipeline with no planner is simpler and more predictable.`],
['When should I use it?', `Start with a single agent or a deterministic workflow, and measure ([[ai-evaluation]]). Move to multiple agents when you hit a real limit: the context becomes too large or noisy, the task genuinely parallelises, or you need separated permissions. Do not add agents for the sake of architecture.`],
['Common mistakes', `- **Starting with multi-agent by default.**
- **Free-form chatter between agents,** which wastes tokens and drifts.
- **Unclear ownership,** so tasks are duplicated or dropped.
- **No budget or step limits.**
- **Assuming agent agreement means correctness** — agents built on the same model can share the same mistakes.
- **Not logging inter-agent messages,** making failures impossible to trace.`]
]},

{
slug: 'agentic-workflows', title: 'Agentic Workflows: Patterns for Reliable AI Automation', kind: C, group: 'Agents & Tools',
question: 'What is an agentic workflow and how is it different from an agent?',
summary: 'An agentic workflow orchestrates model calls and tools along a designed path — chaining, routing, parallelising, evaluating — giving more predictability than a fully autonomous agent.',
short: 'In an **agentic workflow** the developer defines the overall path (steps, branches, checks) and models fill in the steps. In an **agent** the model decides the path. Most successful production systems lean towards workflows and add autonomy only where needed.',
aliases: ['agentic workflow', 'agentic workflows', 'AI workflow', 'LLM workflow', 'prompt chaining', 'routing', 'orchestrator', 'workflow vs agent', 'AI automation patterns', 'evaluator optimizer'],
keywords: ['prompt chaining', 'routing', 'parallelisation', 'orchestration', 'evaluator', 'human in the loop', 'deterministic', 'pipeline', 'state machine'],
related: ['ai-agents', 'multi-agent-systems', 'function-calling', 'ai-evaluation', 'agent-memory', 'how-to-reduce-hallucinations'],
sections: [
['What is it?', `"Agentic" describes systems that use models to take multi-step, tool-using action. Within that, there is a spectrum:

- **Workflow:** code defines the sequence; the model performs bounded sub-tasks. Predictable and testable.
- **Agent:** the model chooses steps dynamically in a loop ([[ai-agents]]). Flexible but less predictable.

Real systems sit between these. An **agentic workflow** is a designed process in which model calls, tools, checks and sometimes humans are combined deliberately.`],
['Why does it matter?', `Reliability compounds. If each of five steps is 90% reliable, the whole chain succeeds only about 59% of the time (0.9⁵) — an illustration, not a measurement. Designing the path lets you place validation after risky steps, retry cheaply, use smaller models for easy steps, and test each stage separately. It also keeps cost and latency understandable.`],
['How does it work?', `Reusable patterns:

1. **Prompt chaining:** break a task into sequential model calls, optionally with programmatic checks ("gates") between them. *Outline → check the outline → draft each section → assemble.*
2. **Routing:** classify the input and send it down the right path or to the right prompt/model. *Billing question → billing prompt; bug report → triage prompt.*
3. **Parallelisation:** run independent calls at once — different sections, or several attempts and vote — then merge.
4. **Orchestrator–workers:** a model decides the sub-tasks at run time, workers execute them ([[multi-agent-systems]]).
5. **Evaluator–optimiser:** one call produces, another critiques against criteria, loop until acceptable or limit reached.
6. **Human-in-the-loop checkpoints:** approval before irreversible or high-stakes steps.
7. **Fallbacks:** when confidence is low or validation fails, escalate to a person or a safer default.

Implementation tips: keep state explicit (a JSON object passed between steps); validate each model output against a schema; log every step; set budgets (steps, tokens, time).`],
['Example', `Invoice processing:

1. *Extract* fields from the document with a model (schema-validated).
2. *Check* in code: totals add up, vendor exists, dates valid.
3. *Route:* if checks pass and amount is below a threshold → create a draft entry; otherwise → flag for human review with the reasons.
4. *Human approves* before posting.

The model handles the messy part (reading varied layouts); everything else is ordinary, testable code. There is no open-ended autonomy because the task does not need any.`],
['When should I use it?', `Default to the simplest thing that works: a single well-prompted call; then a workflow; then, only if the path truly cannot be predetermined, an agent. Choose workflows when the steps are known, accuracy and auditability matter, or cost must be controlled. Choose agents for open-ended problems where the number and order of steps depend on what is discovered.`],
['Common mistakes', `- **Jumping to full autonomy** when a fixed pipeline would do.
- **No validation gates,** so errors flow through to the end.
- **Opaque state,** making debugging impossible.
- **Unbounded retries and loops.**
- **Evaluating only end results,** not each step ([[ai-evaluation]]).
- **Skipping the human checkpoint** where the consequences justify one.`]
]},

{
slug: 'mcp', title: 'What is MCP (Model Context Protocol)?', kind: C, group: 'Agents & Tools',
question: 'What is the Model Context Protocol (MCP) and why does it matter?',
summary: 'MCP is an open protocol that standardises how AI applications connect to external tools, data sources and prompts, so one integration can work across many AI clients.',
short: 'MCP (Model Context Protocol) is an **open standard for connecting AI applications to tools and data**. An MCP *server* exposes capabilities; an MCP *client* inside an AI app discovers and uses them — a common "plug" instead of custom integrations for every pairing.',
aliases: ['MCP', 'Model Context Protocol', 'what is MCP', 'MCP protocol', 'MCP explained', 'Anthropic MCP', 'model context protocol servers', 'USB-C for AI'],
keywords: ['protocol', 'JSON-RPC', 'tools', 'resources', 'prompts', 'server', 'client', 'host', 'stdio', 'integration', 'standard', 'connector'],
related: ['mcp-servers-and-clients', 'mcp-authorization', 'mcp-vs-api', 'function-calling-vs-mcp', 'agent-tools', 'function-calling', 'ai-agents', 'ai-privacy-and-security'],
sections: [
['What is it?', `The **Model Context Protocol (MCP)** is an open protocol, introduced by Anthropic in late 2024, that defines a standard way for AI applications to connect to external systems: files, databases, SaaS apps, developer tools and more.

Before such a standard, connecting *M* AI applications to *N* tools meant building up to *M × N* custom integrations. With MCP, a tool provider builds one **server**, an AI application implements one **client**, and any compliant pair can work together. People often compare it to a universal connector: an analogy for the idea, not a literal description of the wiring.

Details of the specification evolve; always check the current specification and documentation at modelcontextprotocol.io before building.`],
['Why does it matter?', `- **Less glue code:** write the integration once, reuse it across compatible applications.
- **Discoverability:** a client can ask a server what it offers, instead of hard-coding it.
- **Ecosystem:** many ready-made servers exist for common systems, and you can build your own.
- **Clear separation:** the AI application handles the model and user experience; the server handles access to the underlying system.

It also concentrates security responsibility: a connected server can read data or act on your behalf, so what you connect — and what you approve — matters ([[ai-privacy-and-security]]).`],
['How does it work?', `Roles, in brief (full detail in [[mcp-servers-and-clients]]):

- **Host:** the AI application the user interacts with (a chat app, IDE assistant, agent).
- **Client:** a component inside the host that maintains a connection to one server.
- **Server:** a program exposing capabilities.

A server can offer three main kinds of capability:

- **Tools** — actions the model can invoke (like [[function-calling]] functions): "create issue", "run query".
- **Resources** — data the application can read, such as files or records, for context.
- **Prompts** — reusable prompt templates users can select.

Messages use **JSON-RPC 2.0**. Servers can run locally (the client launches them and talks over standard input/output) or remotely over HTTP. In specification revisions up to 2025-11-25, a connection begins with an initialisation handshake in which both sides declare what they support. Revision 2026-07-28 removed that handshake and protocol-level sessions: every request now carries the protocol version and client capabilities, and servers advertise theirs through a \`server/discover\` call. Which model your SDK implements depends on its version, so check ([[mcp-servers-and-clients]]). Either way, the client then lists and calls tools, reads resources and so on.

\`\`\`json
// Client asks a server what tools it has
{ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }

// Client calls one
{ "jsonrpc": "2.0", "id": 2, "method": "tools/call",
  "params": { "name": "search_issues", "arguments": { "query": "login bug" } } }
\`\`\`

(Simplified; consult the specification revision your SDK implements for the exact fields and the connection sequence. For protecting remote servers, see [[mcp-authorization]].)`],
['Example', `A developer connects their IDE assistant to a Git hosting MCP server and a database MCP server. The assistant can now list open issues, read a failing test, query a staging database (read-only credentials), and propose a fix — all through the same protocol. Swapping to a different MCP-compatible assistant later does not require rewriting those two integrations.`],
['When should I use it?', `MCP makes sense when you want tools reusable across applications, when you consume third-party integrations, or when building an ecosystem where many clients should reach your service. For a single application calling a couple of internal functions, plain [[function-calling]] may be simpler. See [[function-calling-vs-mcp]] and [[mcp-vs-api]].`],
['Common mistakes', `- **Thinking MCP replaces APIs.** MCP servers usually wrap APIs ([[mcp-vs-api]]).
- **Installing unvetted servers.** They run code and can reach your data.
- **Granting broad credentials** instead of least privilege.
- **Assuming MCP makes a model smarter.** It provides access, not capability.
- **Skipping approval prompts** for sensitive actions.
- **Treating server-provided text (tool descriptions, results) as trusted** ([[prompt-injection]]).`]
]},

{
slug: 'mcp-servers-and-clients', title: 'MCP Servers and Clients: Roles, Transports and Setup', kind: C, group: 'Agents & Tools',
question: 'What is the difference between an MCP server, an MCP client and an MCP host?',
summary: 'In MCP, a host application runs clients that each connect to a server; servers expose tools, resources and prompts over a transport such as stdio or HTTP.',
short: 'The **host** is the AI app, a **client** is the connection component inside it, and a **server** is the program that exposes tools, resources and prompts. Local servers typically use stdio; remote servers use HTTP.',
aliases: ['MCP server', 'MCP client', 'MCP host', 'MCP servers and clients', 'build an MCP server', 'MCP transport', 'stdio MCP', 'remote MCP server', 'MCP architecture', 'MCP tools resources prompts'],
keywords: ['stdio', 'streamable HTTP', 'SSE', 'initialize', 'capabilities', 'tools/list', 'tools/call', 'resources', 'prompts', 'sampling', 'SDK', 'authorization'],
related: ['mcp', 'mcp-authorization', 'mcp-vs-api', 'function-calling-vs-mcp', 'agent-tools', 'prompt-injection', 'ai-privacy-and-security'],
sections: [
['What is it?', `[[mcp|MCP]] has three roles:

- **Host** — the user-facing AI application: a desktop chat app, an IDE, a custom agent. It owns the conversation with the model and enforces user consent.
- **Client** — a connector inside the host. Each client maintains a one-to-one connection with a single server. A host with three servers runs three clients.
- **Server** — a program that exposes capabilities to clients: it might wrap a database, a file system, a SaaS API or a search service.

Servers advertise capabilities; clients and hosts decide how to present them to the model and user.`],
['Why does it matter?', `Knowing the roles tells you *where things run and who is responsible for what*. A local server runs on the user's machine with the user's permissions. A remote server runs on someone else's infrastructure and may need authentication. The host decides what the model may call and when to ask for approval. Mistakes about these boundaries are the usual source of security problems.`],
['How does it work?', `**Capabilities a server can expose**

- **Tools:** model-invoked actions with JSON-Schema inputs.
- **Resources:** readable data identified by URIs, typically chosen by the application or user to add context.
- **Prompts:** templates for common tasks, typically surfaced to users.

Clients may also offer features back to servers, such as asking the host's model to generate text (sampling), subject to user approval. Support varies by client, so check what your host implements.

**Transports** (how messages travel):

- **stdio:** the host launches the server as a local subprocess and exchanges JSON-RPC messages over standard input/output. Simple and common for local tools.
- **HTTP-based (Streamable HTTP):** the server runs as a web service; the client sends requests over HTTP and the server can stream responses. Suited to remote and shared servers, and the area where authorization requirements apply ([[mcp-authorization]]). Earlier versions of the spec used HTTP with Server-Sent Events; the specification has changed over time, so use the current docs.

**Lifecycle**

*Specification revisions up to 2025-11-25 (stateful):*

1. Client connects and sends an \`initialize\` request with its supported protocol version and capabilities.
2. Server replies with its own; the client confirms.
3. Client lists tools/resources/prompts and uses them during the session.
4. The connection closes when the host shuts down or the user disconnects.

*Revision 2026-07-28 (stateless):* the \`initialize\` handshake and protocol-level sessions (the \`Mcp-Session-Id\` header) were removed. Each request carries the protocol version and client capabilities in its metadata; servers must implement a \`server/discover\` call that advertises supported versions, capabilities and identity; and servers that need state across calls use explicit handles passed as ordinary tool arguments. The same revision replaced server-initiated requests such as sampling and elicitation with a multi round-trip pattern in which the server returns an "input required" result and the client retries with the answers. Check which revision your SDK and host implement before following a tutorial.

**Building a server:** official SDKs exist for several languages. You define tools (name, description, input schema, handler) and the SDK handles the protocol. The handler is ordinary code — which is where you validate input and enforce permissions.`],
['Example', `A typical local configuration, as used by several desktop clients (the exact file name and keys differ per host — this is illustrative only):

\`\`\`json
{
  "mcpServers": {
    "notes": {
      "command": "node",
      "args": ["./notes-server.js"],
      "env": { "NOTES_DIR": "/home/me/notes" }
    }
  }
}
\`\`\`

The host starts \`notes-server.js\`, performs the handshake, lists its tools (say \`search_notes\`, \`create_note\`), and offers them to the model. Limiting \`NOTES_DIR\` to one folder is least-privilege in practice.`],
['When should I use it?', `Build an MCP server when you want your service or data reachable from multiple AI clients. Use existing servers when a trusted, maintained one covers your need. Run local stdio servers for personal, on-device access; use remote servers for shared or hosted capabilities, with proper authentication.`],
['Common mistakes', `- **Running unreviewed servers** from the internet with broad file or network access.
- **Putting secrets in config files that are shared or committed.**
- **Exposing tools that are too powerful** (arbitrary shell, arbitrary SQL) instead of narrow ones.
- **Auto-approving every tool call.**
- **Assuming all clients support all features.**
- **Trusting tool descriptions and outputs as safe** — a malicious or compromised server can try to manipulate the model ([[prompt-injection]]).`]
]}
];
