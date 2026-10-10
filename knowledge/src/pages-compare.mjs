const K = 'comparison', G = 'Comparisons';
export const pages = [
{
slug: 'rag-vs-fine-tuning', title: 'RAG vs Fine-Tuning: Which Should You Use?', kind: K, group: G,
question: 'Should I use RAG or fine-tuning to customise an LLM?',
summary: 'RAG gives a model access to information at question time; fine-tuning changes the model\'s behaviour through additional training. They solve different problems and are often combined.',
short: 'Use **RAG when the model lacks knowledge** (private, large or changing information). Use **fine-tuning when it lacks consistent behaviour** (format, style, narrow task skill). Try prompting first; combine them when you need both.',
aliases: ['RAG vs fine tuning', 'RAG or fine-tuning', 'fine-tuning vs RAG', 'retrieval vs fine-tuning', 'how to customize LLM', 'should I fine-tune', 'RAG versus finetuning'],
keywords: ['knowledge', 'behaviour', 'cost', 'updates', 'citations', 'training data', 'prompting', 'customisation'],
related: ['rag', 'fine-tuning', 'prompt-engineering', 'ai-evaluation', 'ai-hallucinations', 'embeddings'],
sections: [
['At a glance', `| | RAG | Fine-tuning |
|---|---|---|
| Changes | The prompt (adds retrieved text) | The model's parameters |
| Best for | Missing or changing **knowledge** | Consistent **behaviour**, style, format, narrow skills |
| Updating information | Edit or re-index documents | Retrain (slow, hard to remove facts) |
| Citations / traceability | Natural: you know which passages were used | Difficult: knowledge is diffused in weights |
| Needs | Good documents, chunking, retrieval | Many high-quality examples, training pipeline |
| Typical failure | Wrong passage retrieved; model ignores it | Overfitting, forgotten abilities, stale facts |
| Per-request cost | Longer prompts (retrieved text) | Often shorter prompts; may allow a smaller model |

Neither is better in general. They answer different questions: *what does the model know right now?* versus *how does the model behave?*`],
['What is each?', `[[rag|RAG]] retrieves relevant passages from your data when a question arrives and includes them in the prompt, so the model answers from that material.

[[fine-tuning|Fine-tuning]] continues training a pre-trained model on your own input→output examples so it internalises a pattern: a house style, a strict output format, a classification scheme, a domain's way of reasoning.`],
['Key differences', `**Knowledge vs behaviour.** Fine-tuning is a poor way to reliably teach a model facts: it may absorb some, blur others, and you cannot easily update or remove them. RAG is a good fit for facts because the facts live in documents you control. Conversely, RAG is a weak way to enforce a style — you can show examples in the prompt, but a tuned model follows it more consistently and with a shorter prompt.

**Freshness.** Changing a policy in RAG means changing a document. In a fine-tuned model it means preparing new data and retraining.

**Traceability and access control.** With RAG you can show sources and restrict retrieval per user. With fine-tuning, anything in the training data is potentially retrievable by anyone who can use the model.

**Effort and cost.** RAG needs an indexing and retrieval pipeline, and every request pays for the retrieved tokens. Fine-tuning needs curated examples and training runs, but then may reduce prompt length per call. Costs depend on providers and scale; estimate with your own numbers.

**Failure modes.** RAG fails when retrieval misses or the model misuses the passage. Fine-tuning fails when data is inconsistent or too narrow. Both need evaluation ([[ai-evaluation]]).`],
['When to choose which', `Work through this order:

1. **Better prompting first.** Clear instructions, examples and structure fix a surprising number of issues ([[prompt-engineering]]).
2. **Is the problem missing information?** (private docs, recent events, a large knowledge base, need for citations) → **RAG**.
3. **Is the problem inconsistent behaviour?** (format drifts, tone off, narrow task with abundant labelled examples, prompts getting very long) → **fine-tuning**.
4. **Both?** → fine-tune for behaviour and use RAG for knowledge. Example: a model tuned to write answers in a strict support-reply format, fed with retrieved policy text.
5. **Small knowledge base?** Putting it directly in the prompt may beat both.`],
['Example scenarios', `- *"Answer questions about our 400-page handbook, with page references."* → RAG.
- *"Always output tickets as this 12-field JSON, in our classification scheme, from messy emails."* → prompting with examples first; fine-tune if reliability or cost requires it.
- *"Chatbot that knows this week's prices and speaks in our brand voice."* → RAG for prices, prompting or fine-tuning for voice.
- *"Make the model know who our new CEO is."* → RAG or a simple prompt fact, not fine-tuning.`],
['Common mistakes', `- Fine-tuning to add facts and expecting reliable recall.
- Building RAG when the real issue is output format.
- Comparing without a baseline and test set.
- Assuming either removes [[ai-hallucinations|hallucinations]].
- Ignoring maintenance: RAG indexes need refreshing; tuned models need re-evaluating when the base model changes.`]
]},

{
slug: 'ai-agent-vs-chatbot', title: 'AI Agent vs Chatbot vs Assistant: What\'s the Difference?', kind: K, group: G,
question: 'What is the difference between an AI agent, a chatbot and an AI assistant?',
summary: 'The terms overlap and are used loosely. The practical difference is how much the system can do on its own: converse, help with tasks on request, or pursue goals using tools in a loop.',
short: 'A **chatbot** converses, an **assistant** helps with tasks you direct (often using some tools), and an **agent** pursues a goal by choosing its own multi-step actions with tools. It is a spectrum of autonomy, not three sharp categories.',
aliases: ['agent vs chatbot', 'AI agent vs AI assistant', 'chatbot vs agent', 'difference between chatbot and agent', 'assistant vs agent', 'is ChatGPT an agent', 'copilot vs agent'],
keywords: ['autonomy', 'tools', 'loop', 'conversation', 'goal', 'actions', 'copilot', 'assistant'],
related: ['ai-agents', 'agent-tools', 'agentic-workflows', 'function-calling', 'multi-agent-systems', 'large-language-models'],
sections: [
['At a glance', `| | Chatbot | Assistant | Agent |
|---|---|---|---|
| Main job | Hold a conversation, answer questions | Help with tasks you request | Achieve a goal across multiple steps |
| Who decides the steps? | You, turn by turn | You, with the system executing | The system, within limits you set |
| Tools / actions | Usually none or few | Some (search, files, calendar), often one at a time | Many; used repeatedly in a loop |
| Autonomy | Low | Low to medium | Medium to high |
| State across turns | Conversation history | History plus some preferences | History, task state, memory |
| Main risk | Wrong or off-topic answers | Wrong answers; mis-used tool | Compounding errors; unintended actions |

Marketing uses these words interchangeably, so judge a product by what it *does* rather than what it is called.`],
['What is each?', `**Chatbot.** Software you talk to. Older chatbots followed scripts and decision trees; modern ones are powered by [[large-language-models|LLMs]]. Their output is words.

**Assistant.** A conversational system that also helps get things done on your instruction: drafting an email, searching a document, creating a calendar event. Typically you remain in the driver's seat — it does what you ask, often with confirmation.

**Agent.** A system that takes a goal and works out and carries out the steps itself, calling tools, checking results and adapting ([[ai-agents]]). You describe the destination, not the route.`],
['Key differences', `The difference is about **who controls the loop**.

- In a chatbot or assistant, control returns to you after each response.
- In an agent, the model keeps going — plan, act, observe, repeat — until it believes it is done or a limit is reached.

Consequences:

- **Reliability:** each autonomous step can go wrong, and mistakes compound.
- **Cost and latency:** agents make many model and tool calls.
- **Oversight:** agents need guardrails — step limits, scoped permissions, approvals, logs.
- **Security:** more tools plus more autonomy increases exposure to [[prompt-injection]].

The same product can sit at different points: an assistant that offers "go and do this for me" is switching into agent mode.`],
['When to choose which', `- **Chatbot** — FAQs, explanations, guidance where no action is needed.
- **Assistant** — drafting, summarising, lookups, structured help where you review and decide.
- **Agent** — multi-step tasks where the steps depend on what is discovered (debugging, research, investigation) and the actions are safe, reversible or approved.
- **Neither** — if the steps are fixed, use an [[agentic-workflows|agentic workflow]] or plain code. Autonomy you do not need is risk you do not need.`],
['Example', `"Why did last month's revenue dip?"

- Chatbot: explains common causes of revenue dips.
- Assistant: queries the revenue table when you tell it which one and shows you the numbers.
- Agent: decides to compare regions, notices one region dropped, pulls its orders, finds a payment-provider outage in the logs, and reports a sourced explanation — having chosen those steps itself, read-only.`],
['Common mistakes', `- Calling every LLM app an "agent".
- Choosing an agent because it sounds advanced.
- Giving an agent write access before it has earned trust through testing ([[ai-evaluation]]).
- Forgetting that a chatbot with retrieval ([[rag]]) is still not an agent — it is still a single-pass answer.`]
]},

{
slug: 'mcp-vs-api', title: 'MCP vs API: What\'s the Difference?', kind: K, group: G,
question: 'How is MCP different from a regular API?',
summary: 'An API is an interface to one service for programmers. MCP is a standard protocol for AI applications to discover and use capabilities, and MCP servers often wrap APIs.',
short: 'They are **different layers, not competitors**. An API exposes a service to developers. An MCP server typically wraps one or more APIs and presents them in a standard, self-describing form that AI applications can discover and call.',
aliases: ['MCP vs API', 'MCP versus REST', 'MCP or API', 'is MCP an API', 'does MCP replace APIs', 'MCP vs REST API', 'Model Context Protocol vs API'],
keywords: ['REST', 'protocol', 'discovery', 'integration', 'wrapper', 'JSON-RPC', 'tools', 'standardisation', 'OpenAPI'],
related: ['mcp', 'mcp-servers-and-clients', 'function-calling-vs-mcp', 'agent-tools', 'function-calling', 'ai-agents'],
sections: [
['At a glance', `| | Regular API (e.g. REST) | MCP |
|---|---|---|
| Audience | Developers writing code | AI applications (and the models inside them) |
| Defines | Endpoints and data for one service | A common protocol for tools, resources, prompts across services |
| Discovery | Docs or a spec (e.g. OpenAPI) read by a developer | Built in: clients ask the server what it offers |
| Integration effort | Custom code per service and per application | Write a server once; any compatible client can use it |
| Relationship | Underlying capability | Often a layer *over* APIs |
| Typical consumer decisions | Programmer chooses calls | Model chooses tools, host/user approves |

Saying "MCP vs API" is a little like asking "USB vs a keyboard": one is the standard connection, the other is the thing you connect.`],
['What is each?', `An **API** (application programming interface) is how software talks to a service: send a request to an endpoint, get a response. REST, GraphQL and gRPC are common styles. APIs are designed for developers who read documentation and write code against them.

**MCP** ([[mcp]]) is a protocol that lets AI applications connect to external capabilities uniformly. An [[mcp-servers-and-clients|MCP server]] exposes *tools*, *resources* and *prompts* with machine-readable descriptions, so a model can see what is available and how to call it.`],
['Key differences', `**Who is the consumer?** APIs assume a programmer who decides in advance which endpoint to call. MCP assumes a *model* will decide at run time, so tool descriptions, schemas and results are written for it.

**Granularity.** A REST API may have hundreds of endpoints shaped around a data model. A good MCP server exposes a small number of task-oriented tools ("find a customer's open invoices") because too many low-level tools confuse models and waste context.

**Statefulness.** MCP sessions begin with a handshake where both sides declare capabilities; typical REST calls are stateless requests.

**Discovery.** With an API, a developer reads docs. With MCP, the client calls \`tools/list\` and learns the tools programmatically.

**Security.** An API key protects the API. With MCP you additionally need to think about which tools the model may invoke, user consent in the host, and untrusted content in tool results ([[prompt-injection]]).`],
['When to choose which', `- **You are building a service for developers** → publish an API. Optionally add an MCP server that wraps it for AI clients.
- **You want your service usable from many AI apps** → an MCP server is worth building.
- **You are building one AI application with a few internal functions** → direct [[function-calling]] against your own code or API is probably simpler ([[function-calling-vs-mcp]]).
- **You are consuming a third-party capability in an AI app** → look for an existing, trusted MCP server before writing a custom integration, but review what it can access.`],
['Example', `A project-management SaaS has a REST API with endpoints for projects, tasks, comments and users. Its MCP server offers four tools: \`search_tasks\`, \`create_task\`, \`add_comment\`, \`list_my_work\`. Each tool internally calls several REST endpoints, applies the signed-in user's permissions, and returns a compact summary. The REST API still exists for everything else; MCP is a tailored AI-facing front door.`],
['Common mistakes', `- Believing MCP makes APIs obsolete.
- Auto-generating one MCP tool per API endpoint, which floods the model with choices.
- Forgetting that the MCP server still needs authentication and authorisation against the underlying API.
- Treating MCP as inherently secure; it standardises access, it does not decide what *should* be accessible.`]
]},

{
slug: 'vector-database-vs-traditional-database', title: 'Vector Database vs Traditional Database', kind: K, group: G,
question: 'When do I need a vector database instead of SQL or another traditional database?',
summary: 'Traditional databases answer exact, structured questions; vector databases answer "most similar" questions over embeddings. Many systems need both, and some databases do both.',
short: 'Use a **traditional database for exact, structured, transactional data** and a **vector index for "find things similar in meaning"**. For small scale or if you already run PostgreSQL, a vector extension may be enough.',
aliases: ['vector database vs SQL', 'vector DB vs relational database', 'vector search vs keyword search', 'do I need a vector database', 'pgvector vs vector database', 'semantic search vs SQL', 'vector database vs traditional database'],
keywords: ['SQL', 'relational', 'embeddings', 'similarity search', 'exact match', 'ACID', 'hybrid search', 'full-text search', 'pgvector', 'indexes'],
related: ['vector-databases', 'embeddings', 'rag', 'chunking', 'ai-evaluation'],
sections: [
['At a glance', `| | Traditional (relational/document) database | Vector database / vector index |
|---|---|---|
| Question it answers | "Which rows match these conditions?" | "Which items are most similar to this?" |
| Data | Structured fields: numbers, text, dates, IDs | Embedding vectors plus metadata |
| Matching | Exact or range (\`WHERE price < 20\`), keyword | Nearest neighbours by distance/similarity |
| Result | Precise: a row either matches or not | Ranked: closest k, with scores |
| Strengths | Transactions, integrity, joins, reporting | Semantic search, recommendations, RAG retrieval |
| Weak at | Finding by meaning | Exact lookups, joins, strict consistency (varies by product) |
| Index | B-tree, hash, inverted index | ANN indexes such as HNSW or IVF |

Product lines are blurring: several relational and search databases now support vector columns and similarity queries, and many vector databases support metadata filters.`],
['What is each?', `A **traditional database** stores structured records and answers precise queries with guarantees such as transactions and integrity constraints. Think PostgreSQL, MySQL, SQLite, MongoDB. Text search engines add keyword relevance (words, stemming, ranking).

A **[[vector-databases|vector database]]** stores [[embeddings]] and finds the nearest ones to a query vector, usually via approximate indexes so it stays fast at scale.`],
['Key differences', `**Exact vs fuzzy.** If you need the order with ID 10492, a traditional database is perfect and a vector search is the wrong tool. If a user types "something warm for a rainy hike", only similarity over embeddings will connect that to "waterproof insulated jacket".

**Correctness model.** A SQL query returns exactly the matching rows. ANN vector search returns *approximately* the closest items; you tune the speed/recall trade-off.

**What gets compared.** SQL compares values you defined (columns). Vector search compares learned representations whose quality depends on the embedding model and on how content was [[chunking|chunked]].

**Operations.** Traditional databases offer decades of tooling for backup, migration, access control and transactions. Newer vector systems vary in maturity; check the features you require.

**Hybrid is common.** Real search often combines keyword matching (for exact terms like SKU codes), vector similarity (for meaning), and metadata filters (for permissions and dates).`],
['When to choose which', `- **Records, transactions, reporting, exact lookup** → traditional database.
- **Semantic search or RAG over a small corpus** (thousands to low hundreds of thousands of chunks) → start with what you have: an in-memory array, SQLite or PostgreSQL with a vector extension.
- **Large-scale, low-latency, frequently updated semantic search** → a dedicated vector database or a search engine with strong vector support is worth evaluating.
- **Need both** → keep the source of truth in your traditional database and store embeddings alongside it (same database, or a synchronised index).`],
['Example', `An online store keeps products, stock and orders in PostgreSQL. To add "search by description", it adds an embedding column (via an extension) for each product, and a query that filters \`in_stock = true\` and \`price < 100\` first, then orders by vector similarity to the query. One database, both kinds of question. If the catalogue later grows to hundreds of millions of items with demanding latency needs, a specialised service might make sense — a decision to make with measurements, not in advance.`],
['Common mistakes', `- Adding a vector database for data that a plain query answers.
- Replacing keyword search entirely, then losing exact-match behaviour for codes and names.
- Treating similarity scores as probabilities or truth.
- Duplicating data without a sync strategy, so the vector index drifts from the source of truth.
- Not measuring retrieval quality ([[ai-evaluation]]).`]
]},

{
slug: 'local-ai-vs-cloud-ai', title: 'Local AI vs Cloud AI: Privacy, Cost, Capability', kind: K, group: G,
question: 'Should I run AI locally or use a cloud AI service?',
summary: 'Local AI keeps data on your device and avoids per-use fees but is limited by your hardware; cloud AI gives access to the most capable models with no setup but means sending data to a provider.',
short: 'Choose **local** when data must stay on your device, you need offline use or fixed costs, and a smaller model is enough. Choose **cloud** when you need top capability, large context or scale with minimal setup. Many teams use both.',
aliases: ['local vs cloud AI', 'local LLM vs ChatGPT', 'on-device vs cloud AI', 'self-hosted vs API', 'private AI vs cloud AI', 'should I run LLM locally', 'open weights vs hosted models'],
keywords: ['privacy', 'cost', 'latency', 'hardware', 'capability', 'offline', 'compliance', 'scalability', 'maintenance'],
related: ['local-ai', 'ai-privacy-and-security', 'large-language-models', 'fine-tuning', 'ai-evaluation'],
sections: [
['At a glance', `| | Local AI | Cloud AI |
|---|---|---|
| Where it runs | Your laptop, workstation or server | Provider's data centres |
| Data leaves your environment? | No (if configured that way) | Yes, to the provider (under its terms) |
| Model capability | Typically smaller open-weights models; varies widely | Access to the provider's most capable models |
| Cost model | Hardware + electricity + your time | Usually pay per use or subscription |
| Setup & maintenance | You manage models, updates, hardware | Provider manages |
| Scale | Limited by your hardware | Elastic |
| Offline | Yes | No |
| Customisation | Full control (weights, fine-tuning, settings) | Limited to what the provider offers |

Exact capability gaps and prices change quickly; evaluate current options on your own tasks rather than relying on a general claim.`],
['What is each?', `**[[local-ai|Local AI]]** runs a model on hardware you control, using open-weights models and a runtime. After the download, it can work offline.

**Cloud AI** means calling a hosted model through a website or API. The provider operates the hardware and models; you send input and receive output.`],
['Key differences', `**Privacy and control.** Local processing avoids sending content to a third party, which can simplify compliance for sensitive data. With cloud services, check retention, training-use, human-review and regional terms for your specific plan ([[ai-privacy-and-security]]). Neither is automatically safe: local setups still need device security and trustworthy model sources.

**Capability.** The most capable models are commonly offered as hosted services. Local models can be excellent for focused tasks (summarising, classification, extraction, drafting) and are improving, but may struggle on the hardest reasoning or very long contexts. Test on your task.

**Cost.** Cloud costs scale with usage and are easy to start. Local costs are front-loaded (hardware) and fixed afterward; they pay off with steady heavy use, but not for occasional use.

**Speed and reliability.** Local latency depends on your hardware; cloud latency depends on network and load. Local works with no connection and is immune to provider outages or deprecations.

**Effort.** Cloud is the fastest way to start. Local requires learning about model sizes, quantisation and memory limits.`],
['When to choose which', `Choose **local** for: confidential or regulated material, offline environments, steady high-volume simple tasks, experimentation, and when you want to control the model version.

Choose **cloud** for: hardest tasks, large contexts, rapid prototyping, bursts of load, low maintenance.

**Hybrid** works well: route sensitive or routine requests to a local model and escalate complex, non-sensitive ones to a cloud model; or redact sensitive details before cloud use.`],
['Example', `A law firm wants to summarise client documents. Policy forbids sending them to external services, so they run a local model on a workstation with a capable GPU, and attorneys review every summary. For non-confidential public research, staff may use a cloud assistant. The decision is driven by data classification, not by which model is "best".`],
['Common mistakes', `- Equating local with accurate; it also [[ai-hallucinations|hallucinates]].
- Ignoring hardware limits, then abandoning local after a slow first try.
- Assuming cloud means "insecure" or local means "secure" without reading terms or hardening setups.
- Comparing costs without counting your own time and hardware.
- Not re-evaluating as models and prices change.`]
]},

{
slug: 'function-calling-vs-mcp', title: 'Function Calling vs MCP', kind: K, group: G,
question: 'What is the difference between function calling and MCP?',
summary: 'Function calling is a model-API feature for requesting structured calls to functions you define. MCP is a protocol for packaging, sharing and discovering tools across AI applications. They work together.',
short: '**Function calling** is how a model *asks* for a tool to be run (model ↔ your app). **MCP** is how an AI app *finds and connects to* tools hosted elsewhere (app ↔ tool servers). An MCP-enabled app typically uses function calling under the hood to let the model use MCP tools.',
aliases: ['function calling vs MCP', 'tool calling vs MCP', 'MCP or function calling', 'difference between MCP and tool use', 'MCP vs tool calling', 'do I need MCP'],
keywords: ['tool use', 'protocol', 'schema', 'discovery', 'integration', 'interoperability', 'client', 'server', 'JSON-RPC'],
related: ['function-calling', 'mcp', 'agent-tools', 'mcp-servers-and-clients', 'mcp-vs-api', 'ai-agents'],
sections: [
['At a glance', `| | Function calling | MCP |
|---|---|---|
| What it is | A feature of a model API | An open protocol between AI apps and tool servers |
| Connects | Model ⇄ your application code | AI application (client) ⇄ tool/data server |
| Where tools are defined | In your request, in your code | In an MCP server, discovered at run time |
| Reuse across apps | You re-implement per app or provider | One server works with any compatible client |
| Beyond tools | Tools only | Tools, resources, prompts, and more |
| Who runs the tool | Your code | The MCP server (which may be local or remote) |
| Standardised? | Pattern is similar, formats differ by provider | Yes, defined by a published specification |

They sit at **different layers**, so the question is usually not "which" but "do I need the second layer?"`],
['What is each?', `[[function-calling|Function calling]]: you list functions (name, description, JSON Schema) in a model request; the model may reply with a structured call; your code executes it and returns the result.

[[mcp|MCP]]: a protocol where an [[mcp-servers-and-clients|MCP server]] exposes tools (plus resources and prompts) and a client in the AI application lists and calls them over a standard transport.`],
['Key differences', `Think of a request's journey with MCP in the picture:

1. The host connects to MCP servers and **lists** their tools.
2. The host passes those tool definitions to the model **using the model API's function-calling feature**.
3. The model returns a function call.
4. The host forwards it to the right MCP server as a \`tools/call\` request.
5. The result flows back to the model.

So MCP does not replace function calling; it standardises *where the tools come from and how the application reaches them*.

Other differences:

- **Coupling.** Function-calling tools are typically in the same codebase as your app; MCP tools can live in independent, separately maintained servers.
- **Distribution.** MCP makes it practical to share a tool as a package or service for many clients.
- **Overhead.** MCP adds a protocol layer, process or network hop, and security review of each server. For a handful of in-app functions, that is unnecessary.`],
['When to choose which', `- **One app, a few custom functions, full control** → function calling alone.
- **You want your integration usable in many AI apps** → build an MCP server.
- **You want ready-made integrations** (files, repos, databases, SaaS) → use MCP servers you trust.
- **You need only structured output**, no external action → function calling (or a structured-output feature) is enough.
- **You are building an agent platform** that third parties extend → MCP is a natural fit.`],
['Example', `A team builds an internal helpdesk bot. Version 1 defines two functions in its backend (\`get_ticket\`, \`add_note\`) and uses function calling directly — about a day of work, no extra infrastructure. Later, the same capabilities are requested inside the company's IDE assistant and chat client. They wrap the ticket system once as an MCP server; all three clients now use it. The helpdesk bot may still call it through the same MCP connection, or keep its direct functions; the model API call is still function calling either way.`],
['Common mistakes', `- Treating them as mutually exclusive.
- Adopting MCP for a tiny single-app project.
- Assuming an MCP tool is safer than a local function; its code and descriptions come from elsewhere and need review ([[prompt-injection]]).
- Exposing too many tools from one server.
- Forgetting that either way, **your application** must validate arguments and enforce permissions.`]
]}
];
