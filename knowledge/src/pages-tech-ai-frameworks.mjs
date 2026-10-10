const C = 'concept';
const K = 'comparison';
export const pages = [
{
slug: "rag-frameworks", title: "RAG Frameworks", kind: C, group: "AI ecosystem",
question: "What is a RAG framework and do I need one?",
summary: "A RAG framework packages document loading, chunking, embeddings, retrieval and prompting. LlamaIndex and LangChain are the usual examples. Use one for speed; drop to plain code when you need to see every step.",
short: `A **RAG framework** bundles loaders, chunking, embeddings and a prompt so a model can answer from your files. [[llamaindex|LlamaIndex]] and [[langchain|LangChain]] are common. The idea itself is [[rag]]; the framework is optional plumbing.`,
aliases: ["RAG framework", "RAG frameworks", "what is a RAG framework", "do I need a RAG framework", "RAG library", "framework for RAG", "LlamaIndex or LangChain for RAG"],
keywords: ["RAG", "framework", "LlamaIndex", "LangChain", "chunking", "retriever", "evaluation"],
related: ["rag", "llamaindex", "langchain", "chunking", "embeddings", "vector-databases", "rag-with-python", "choosing-an-agent-framework"],
sections: [
["What it is", `A **RAG framework** is a library that implements the moving parts of [[rag|retrieval-augmented generation]]: reading files, [[chunking|splitting]] them, calling an [[embeddings|embedding]] model, storing vectors, retrieving neighbours, and stuffing them into a prompt. [[llamaindex|LlamaIndex]] and [[langchain|LangChain]] are the names developers meet first. Others exist, including smaller libraries and vendor "assistants" products that hide the index entirely.

The framework is not the technique. You can build RAG with a database, an HTTP client and a prompt, which is what [[rag-with-python]] walks through. The framework is an accelerator and an opinion. It chooses defaults for splitter size, metadata and how the prompt is phrased. Those defaults are not neutral.`],
["Why and when it is used", `Use a framework when you are exploring a corpus and want loaders for messy formats tonight, or when your team would rather configure than write a vector-store client. Use plain code when the corpus is one format, the prompt must be reviewed line by line, or you have been burned by a major version upgrade. Use a managed retrieval product when you explicitly want to outsource indexing and can accept its data policy.

Do not adopt two frameworks at once. The overlap is confusing and the dependency tree is heavy. Do not adopt one before you can explain RAG without it. If you cannot say what a chunk is, the framework will only hide your confusion.`],
["How it works", `You configure an embedding model and a chat model, point a loader at a folder, and call an index or ingest function. The library chunks text, embeds it, and writes a store. A query function embeds the question, retrieves chunks, and calls the chat model with a prompt the library built. Some frameworks add rerankers, citation helpers and agent routers. Each extra stage is another model call with its own latency and failure.

What you should demand from any of them: a way to print the retrieved text, a way to persist the index, a way to filter by tenant, and a way to pin versions. If those are hard, the framework is a demo tool, not a production dependency.`],
["Technologies and dependencies", `Python or JavaScript, keys for the models you call, and a store (in-memory, [[postgresql|Postgres]] with pgvector, or a dedicated [[vector-databases|vector database]]). PDF parsing may need native libraries. Observability is your job: the framework's trace product is optional and may send document text off-box. [[choosing-an-agent-framework]] discusses the neighbouring decision when the system also calls tools.`],
["How to get started", `1. Implement the smallest RAG path you can explain, even if it is the framework's quickstart.
2. Freeze ten questions and the paragraphs that should be retrieved.
3. Turn on whatever "show sources" debug the library has. Score retrieval separately from the final answer.
4. Change chunk size once and re-run the ten. Keep the better setting.
5. Restart the process and prove the index survived.
6. Read the prompt template in the library source or docs and delete instructions you do not want.

If you cannot find the prompt, you do not control the product. Switch to your own template and call the model directly, using the framework only as a retriever if it still earns its place.`],
["Cautions and trade-offs", `Frameworks churn. Tutorials lie by omission when APIs move. Loaders drop content silently (scanned PDFs with no text, spreadsheets, headers). Default prompts tell the model to answer even when context is empty, which manufactures hallucinations. Multi-tenant bugs happen when a global index mixes customers.

A framework will not choose your chunking for legal documents versus chat logs. It will not know that "the policy" means last quarter's PDF, not the draft. Put that in metadata and filters. Evaluate retrieval hit-rate. And resist "agentic RAG" until the fixed pipeline is measurably good. An agent that searches again is not a fix for a bad index.`],
]
},
{
slug: "ai-sdks", title: "AI SDKs", kind: C, group: "AI ecosystem",
question: "What is an AI SDK and how is it different from a model API?",
summary: "An AI SDK is a library that calls a model API for you: authentication, types, streaming and retries. The Vercel AI SDK, official provider SDKs and similar toolkits are convenience layers. Your architecture is still the HTTP contract and your own wrapper.",
short: `An **AI SDK** is client code for a [[model-apis|model API]]: auth, streaming, types. Official SDKs track one vendor. Multi-provider kits (for example the Vercel AI SDK) track several. You still own prompts, evaluation and where the key lives.`,
aliases: ["AI SDK", "AI SDKs", "what is an AI SDK", "Vercel AI SDK", "OpenAI SDK", "provider SDK", "LLM SDK", "SDK vs API for AI"],
keywords: ["SDK", "Vercel AI SDK", "OpenAI SDK", "streaming", "TypeScript", "Python", "client library"],
related: ["model-apis", "calling-ai-apis-with-javascript", "calling-ai-apis-with-python", "langchain", "typescript", "nextjs", "api-keys"],
sections: [
["What it is", `An **AI SDK** is a software development kit: functions in [[python|Python]], [[typescript|TypeScript]] or another language that call a [[model-apis|model API]] so you do not hand-build every HTTP request. An official SDK (the OpenAI SDK, Google's Gen AI SDK, Anthropic's SDK, Azure's client) tracks one provider's features: chat, tools, streaming, file uploads. A **multi-provider SDK** tries to offer one interface across vendors. The **Vercel AI SDK** is a well-known TypeScript example aimed at streaming UI, especially with [[nextjs|Next.js]] and [[react|React]].

The SDK is not the service. If the provider is down, the SDK cannot invent a completion. If you need a feature the SDK has not wrapped, you either wait, send raw HTTP, or misuse an escape hatch.`],
["Why and when it is used", `Use an official SDK when you are committed to one provider and want types, auth helpers and streaming that match the docs. Use a multi-provider SDK when you genuinely swap models and can live with the lowest common denominator, plus occasional provider-specific options. Use raw HTTP when you want the smallest dependency, when you are debugging a weird error, or when you are teaching yourself what the wire looks like ([[calling-ai-apis-with-python]], [[calling-ai-apis-with-javascript]]).

Do not add an SDK, a framework and a second wrapper that all retry the same call. Pick one place that owns the request.`],
["How it works", `You construct a client with a key from the environment. You call a method such as \`chat.completions.create\` or the SDK's equivalent, passing messages and options. The library serialises JSON, sets \`Authorization\`, and decodes the response into objects. Streaming methods return an iterator or a web stream. Some UI kits then pipe that stream into a React hook so tokens render as they arrive. Tool helpers validate arguments against a schema you provide.

Retries, timeouts and error types differ by SDK. Read those defaults. A library that retries a non-idempotent "charge the card" tool call is dangerous. Your code should still check the model's output. Types in TypeScript describe the happy path the SDK knows, not the truth of a free-text field.`],
["Technologies and dependencies", `The language runtime, the SDK package pinned in your lockfile, and network access to the provider. UI streaming in the Vercel AI SDK depends on the framework adapter you choose (Next.js route handlers are the common demo). Keys stay in [[environment-variables|environment variables]] on the server. [[langchain|LangChain]] is a higher-level framework that may use SDKs or HTTP underneath; you do not need both for a single call. [[api-keys|API keys]] and cloud IAM are the actual credentials; the SDK only carries them.`],
["How to get started", `1. Call the API once with curl or a few lines of HTTP so you have seen the JSON.
2. Install the official SDK. Repeat the same call. Diff the request if the SDK lets you log it.
3. Set a timeout explicitly if the SDK's default is vague.
4. Add streaming only after the non-streaming path stores a correct final answer in your database. Streaming is a transport optimisation, not the data model.
5. If you adopt a UI kit, keep the model call on the server. The browser should receive tokens, not the secret.
6. Pin the SDK version. Provider SDKs ship often and rename methods.

Write an interface your app uses (\`complete(prompt) -> text\`) and implement it with the SDK. Tests use a fake implementation. That interface is the seam that lets you leave the SDK later.`],
["Cautions and trade-offs", `SDKs lag and they also leap. A major bump can break compilation across the app if you passed SDK types into every function. Keep the SDK at the edge. Multi-provider kits hide parameters that matter (which safety setting, which region). Inspect what is actually sent.

Never import a server SDK into a client component. Bundlers will inline the key if you reference \`process.env\` carelessly in the wrong file. Some "AI UI" helpers assume a single-user demo and have no auth on the route. Add auth before you add personality. And do not confuse SDK convenience with evaluation. A typed stream of a wrong answer is still wrong.`],
]
},
];
