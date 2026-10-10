const C = 'concept';
const K = 'comparison';
export const pages = [
{
slug: "hugging-face", title: "Hugging Face for Builders", kind: C, group: "AI ecosystem",
question: "What is Hugging Face and when do I use it?",
summary: "Hugging Face is the common hub for open model weights, datasets and libraries such as transformers and the Hub. Teams use it to find models, download weights, and sometimes to host inference, then decide what must run in their own environment.",
short: `**Hugging Face (HF)** is where many open models and datasets are published, plus libraries that load them. It does not replace a [[model-apis|model API]] or a [[local-llm-runtimes|local runtime]] by itself; it is the catalog and the tooling around weights.`,
aliases: ["Hugging Face", "HF", "huggingface", "what is Hugging Face", "Hugging Face Hub", "transformers library", "Hugging Face models", "HF hub"],
keywords: ["Hugging Face", "Hub", "transformers", "datasets", "model card", "open weights", "token", "inference endpoint"],
related: ["local-llm-runtimes", "model-apis", "fine-tuning", "local-ai", "langchain", "ai-sdks", "python"],
sections: [
["What it is", `**Hugging Face** (people say **HF**) is a company and a website, the Hub, where machine-learning models, datasets and demos are published. For developers it is also a set of libraries. The \`transformers\` library loads many neural models with a similar Python API. \`datasets\` downloads and streams training data. \`tokenizers\` and various \`diffusers\` or training libraries sit beside them. A **model card** on the Hub describes what a model is for, how it was trained, its licence, and often its limits.

Hugging Face is not a single model. It is not "the open source GPT". It hosts thousands of models of very different quality. It is also not the same thing as calling a hosted [[model-apis|chat API]] from a vendor, although Hugging Face offers hosted inference endpoints you can pay for.`],
["Why and when it is used", `Use the Hub when you need an open-weights model, a baseline to fine-tune, a dataset, or a tokenizer that matches a model family. Use the libraries when you want to run or adapt those models in [[python|Python]] rather than only call a black-box API. Use a hosted endpoint when you want that model without operating GPUs yourself.

Do not use a random Hub model in production because it topped a weekend benchmark. Read the licence (some weights are research-only or restrict commercial use), the language coverage, and the safety limitations. Do not confuse a demo Space with a service you can depend on. If your product needs a support contract, uptime, and data-processing terms, a commercial [[model-apis|model API]] or your own deployment on [[azure-fundamentals|Azure]], [[aws-fundamentals|AWS]] or [[gcp-fundamentals|GCP]] may fit better than a public demo.`],
["How it works", `You find a repository id such as an organisation and model name. The client library downloads files (weights, tokenizer config, a generation config) and caches them. Loading a model constructs the network and reads the weights. Inference then runs locally if you have the hardware, or on a rented GPU. Gated models require you to accept terms on the website and authenticate with a token before download.

The Hub is git-like storage plus a website. Uploading a model is a push of large files, which is why Git LFS or the Hub's own upload tools are involved. Inference widgets on the model page are a convenience, not your production path. Fine-tuning workflows often start from a Hub checkpoint and publish the result as a new model repo. That does not change the need to evaluate the model on your own tasks.`],
["Technologies and dependencies", `Most Hub libraries assume Python. PyTorch is the common tensor framework; some models support other backends. A recent GPU helps; CPU is possible for small models and painful for large ones. The \`huggingface_hub\` package handles login and download. A user access token is a secret: it can read gated repos and, if you grant write, push to your account. [[local-llm-runtimes|Local runtimes]] such as llama.cpp often consume weights that originated on the Hub but were converted to GGUF. [[langchain|LangChain]] and other frameworks can call Hub models, which is optional glue, not a requirement.`],
["How to get started", `1. Create an account. Generate a read token and store it outside the repo.
2. Pick one small text model with a clear licence and a model card you actually read.
3. In a virtual environment, install \`transformers\` and the framework the card names.
4. Run the card's minimal load-and-generate snippet on a sentence you choose, not only the marketing example.
5. Note disk use, memory and latency on your machine. That number, not the parameter count headline, tells you if local use is realistic.
6. Only then look at datasets or fine-tuning. Fine-tuning a model you have not evaluated is how you spend a week optimising the wrong thing.

If download fails on a gated model, accept the licence on the website while logged in as the same user as the token. If memory explodes, you picked a model too large for the machine; switch to a smaller checkpoint rather than closing every other program and hoping.`],
["Cautions and trade-offs", `Weights are large and licences differ file by file. A famous model name may hide a community fine-tune with no evaluation. Pickle-based files can execute code on load; prefer safetensors and libraries that do not unpickle untrusted objects. Tokens in notebooks get leaked when the notebook is shared.

The Hub is a distribution channel. You are still responsible for what the model says in your product, for privacy of prompts you send to a hosted endpoint, and for whether the data you upload as a dataset was legal to share. Pin library versions. Model repos can be updated under the same name; for production, pin a revision hash so a quiet upstream change does not alter behaviour overnight.`],
]
},
{
slug: "langchain", title: "LangChain, Practically", kind: C, group: "AI ecosystem",
question: "What is LangChain and when should I use it?",
summary: "LangChain is a Python and JavaScript framework that wires prompts, models, tools and retrieval into chains or agents. It speeds prototypes and adds abstraction; simple apps are often clearer calling a model API directly.",
short: `**LangChain** is a framework for composing model calls, tools and [[rag|retrieval]]. Use it when the orchestration is real. Prefer a direct [[model-apis|model API]] when you only need one prompt and a parsed answer. See also [[llamaindex]] and [[choosing-an-agent-framework]].`,
aliases: ["LangChain", "what is LangChain", "LangChain Python", "LangChain.js", "LCEL", "when to use LangChain", "LangChain vs direct API", "LangChain agents"],
keywords: ["LangChain", "chain", "agent", "retriever", "LCEL", "Python", "JavaScript", "tools"],
related: ["llamaindex", "rag-frameworks", "ai-sdks", "model-apis", "choosing-an-agent-framework", "framework-vs-direct-api", "rag", "python"],
sections: [
["What it is", `**LangChain** is an open-source framework, in Python and JavaScript, for building applications that call language models. It gives you interfaces for chat models, prompt templates, output parsers, tools, retrievers and simple agents. **LCEL** (LangChain Expression Language) is its way of composing those pieces as a pipeline: prompt, model, parser, with streaming and tracing hooks. A retriever can sit on [[vector-databases|vector search]] so the chain does [[rag|retrieval-augmented generation]]. An agent loop lets the model choose tools.

LangChain is not a model. It does not host weights. It is not [[llamaindex|LlamaIndex]], which focuses more narrowly on indexing and retrieving your data. It is not required to call a model. The official [[ai-sdks|SDKs]] from model vendors already send a chat request.`],
["Why and when it is used", `Use LangChain when you are assembling several steps you expect to change: swap the model, add a retriever, add a tool, stream tokens to a UI, and you want one abstraction across vendors. It is also a common teaching vocabulary, so examples online assume it.

Skip it when the task is one prompt, one response, and a JSON parse. A direct HTTP call or the vendor SDK is shorter, easier to debug, and has fewer version surprises. Skip it when your team cannot name the dependency versions. LangChain's packages have moved quickly; a tutorial from last year may target an API that no longer exists. Read [[framework-vs-direct-api]] and [[choosing-an-agent-framework]] before you adopt it as the spine of a product.`],
["How it works", `You construct a chat model object with a model name and a key the library reads from the environment. A prompt template fills user and system text. The model returns a message. A parser extracts JSON or a schema. A retriever, given a question, returns documents you stuffed into a vector store earlier. A chain connects these so the documents land in the prompt. An agent instead shows the model a list of tools and loops until the model stops calling them or you hit a limit.

Tracing (LangSmith is the hosted option; there are alternatives) records each step. Without tracing, a chain that "answered wrong" is opaque: you cannot see whether retrieval or the final prompt failed. The framework's value is that composition. The cost is that stack traces cross your code and the library's, and defaults may retry or add hidden prompts.`],
["Technologies and dependencies", `Python 3 or Node, the \`langchain\` packages you actually import (core versus community integrations are split), a model provider key, and optionally a vector store. Community packages wrap many SaaS tools. Each wrapper is only as maintained as its authors. Pydantic or Zod often sits under the output parsers. Your application still owns auth, storage and the user interface. [[rag-frameworks|RAG frameworks]] overlap here: LangChain can build RAG, and so can LlamaIndex, and so can a hundred lines of your own code.`],
["How to get started", `1. Write the direct API call first for the exact prompt you care about. Save the JSON you sent and the text you got back.
2. Recreate that one call with LangChain's chat model and a prompt template. The outputs should match closely. If they do not, the framework is adding words you did not intend.
3. Add one retriever only if the answer must come from your documents. Inspect the retrieved chunks in logs before you judge the model's writing.
4. Pin package versions. Read the changelog note for the major version you installed.
5. Add tracing before you add an agent. Agents multiply calls and failures.
6. Delete the framework if step 2 was the whole product. That is allowed.

Keep the vendor SDK available. The day LangChain lags a provider feature you need (a new tool-calling field, a batch API), you will want a direct path.`],
["Cautions and trade-offs", `Abstractions leak. Time spent learning chain syntax is not spent on evaluation data. Agents look autonomous and are hard to test; prefer a fixed chain when the steps are known. Hidden retries can multiply cost. Logging prompts may store customer text in a tracing SaaS you have not reviewed.

Security: a tool the model can call is a capability. A "shell tool" from an example is not a joke in production. Treat retrieved text as untrusted ([[prompt-injection]]). Do not let a tutorial's \`load_tools\` equivalent become your permission model. Finally, "we use LangChain" is not an architecture. Say which model, which retrieval, which tools, and what you evaluate.`],
]
},
{
slug: "llamaindex", title: "LlamaIndex for Retrieval", kind: C, group: "AI ecosystem",
question: "What is LlamaIndex and how is it different from LangChain?",
summary: "LlamaIndex is a framework focused on loading data, building indexes and retrieving context for language models. It overlaps LangChain on RAG, with more emphasis on document indices and less on being a general agent toolkit.",
short: `**LlamaIndex** (once GPT Index) loads documents, indexes them, and retrieves context for a model. Reach for it when the problem is **search over your data**. Reach for [[langchain|LangChain]] when the problem is general orchestration. Neither replaces an evaluation set.`,
aliases: ["LlamaIndex", "Llama Index", "llama index", "what is LlamaIndex", "GPT Index", "LlamaIndex vs LangChain", "LlamaIndex RAG"],
keywords: ["LlamaIndex", "index", "retriever", "documents", "RAG", "query engine", "Python"],
related: ["langchain", "rag-frameworks", "rag", "embeddings", "vector-databases", "chunking", "choosing-an-agent-framework"],
sections: [
["What it is", `**LlamaIndex** is a data framework for applications that answer from private documents. You connect **loaders** (PDF, web, Notion, databases), split text into nodes, embed those nodes, and store them in an index. A query engine retrieves relevant nodes and sends them to a model. That is [[rag|retrieval-augmented generation]] with a particular API shape. The project was originally known as GPT Index; the name changed, the role did not.

It is not a chat product and not a model host. It overlaps [[langchain|LangChain]], which can also build RAG, but LlamaIndex spends more of its API on indices, node parsing and query engines, while LangChain spends more on generic chains, tools and agents. Many teams use one, not both.`],
["Why and when it is used", `Choose LlamaIndex when the centre of the product is "ask questions of this corpus": a policy library, a wiki, a set of PDFs. The loaders and the index abstractions save you from writing glue on day one. Choose a direct implementation (your own chunker, your own [[vector-databases|vector store]] client, your own prompt) when you want every token of the prompt under your review and the corpus is simple. Choose LangChain or a plain agent loop when tool calling, not retrieval, is the main complexity.

Do not choose it because a diagram showed more boxes. Every box is a behaviour you must test: bad splits, missed tables, embeddings that do not match your language, and a model that ignores the context.`],
["How it works", `Documents enter through a reader and become **nodes**, chunks with metadata (source file, page, title). An embedding model turns each node into a vector. The index, often a vector index, stores those vectors. At query time the question is embedded, nearest nodes are fetched, optionally reranked, and written into a prompt. The model answers. Citations are only real if you pass source metadata through and require the answer to use it; the framework does not guarantee truth.

Advanced indices (lists of summaries, hierarchical chunks, knowledge graphs) try to handle corpora where a single vector lookup is not enough. They add calls and failure modes. Start with a vector index and a serious [[chunking|chunking]] scheme. Metadata filters (product, tenant, date) matter as much as the embedding model if you serve more than one customer.`],
["Technologies and dependencies", `Python is the primary library; a TypeScript port exists but the Python docs are the reference most examples use. You need an embedding model and a chat model, either via API keys or local weights. Storage can be the default in-memory index (fine for a demo, gone when the process exits) or a real vector store. Loaders may need extra system packages for PDF parsing. [[rag-frameworks|Other RAG frameworks]] and plain SQL with [[postgresql|pgvector]] are alternatives once you outgrow the defaults.`],
["How to get started", `1. Take ten documents you know well, not a dump of ten thousand.
2. Ingest them, query them, and write down ten questions whose answers you can check by hand.
3. Print the retrieved nodes for each question before you read the model's prose. If the right paragraph is missing, fix chunking or metadata. Do not tune the prompt yet.
4. Add tenant or source metadata and a filter. Re-run the ten questions.
5. Persist the index. Restart the process and confirm the index is still there.
6. Only then consider a second index type or an agent on top.

Keep the evaluation questions in the repo. A framework upgrade that silently changes splitter defaults will show up there and nowhere else.`],
["Cautions and trade-offs", `Loaders are convenient and uneven. A PDF loader that drops tables will make a financial FAQ look "grounded" while missing the numbers. In-memory indices in production restart empty. Query engines hide the prompt; read it. Automatic "routing" across tools can retrieve nothing and still answer from the model's memory, which is a hallucination with extra steps.

LlamaIndex and LangChain both change APIs between major versions. Pin them. Do not send confidential documents to a hosted parsing service without reading where bytes go. And do not describe the system as "we use LlamaIndex" to a customer. Say what you index, how fresh it is, and what happens when retrieval misses.`],
]
},
{
slug: "model-apis", title: "Model APIs for Applications", kind: C, group: "AI ecosystem",
question: "What is a model API and how should I call one?",
summary: "A model API is an HTTP service that accepts messages and returns generated text or tool calls. You choose a model, send a prompt with authentication, handle tokens and errors, and keep the vendor SDK or raw HTTP behind a small interface you own.",
short: `A **model API** is HTTP: messages in, text or tool calls out, billed per token. Call it from your server, not from a leaked browser key. [[ai-sdks|SDKs]] help; they are not the architecture. For open weights on your own machine see [[local-llm-runtimes]].`,
aliases: ["model API", "model APIs", "LLM API", "chat completions API", "what is a model API", "OpenAI compatible API", "inference API", "how do I call an LLM API"],
keywords: ["model API", "chat completions", "tokens", "temperature", "SDK", "HTTP", "tool calling", "rate limit"],
related: ["ai-sdks", "calling-ai-apis-with-python", "calling-ai-apis-with-javascript", "local-llm-runtimes", "function-calling", "api-keys", "langchain"],
sections: [
["What it is", `A **model API** is a network service that runs a model for you. The usual shape, popularised by chat completions, is a POST with a model name, a list of messages (system, user, assistant), and parameters such as temperature and a max token limit. The response contains generated text, a finish reason, and usage counts. Variants add [[function-calling|tool calling]], image inputs, or streaming events. Many vendors now expose an "OpenAI-compatible" path so the same client can change the base URL.

The API is not the model. The same brand name can point at several snapshots. It is not an agent. It does not remember your user between requests unless you send the history. Hosted APIs differ from [[local-llm-runtimes|local runtimes]], which serve a similar HTTP shape on a machine you control.`],
["Why and when it is used", `Use a hosted model API when you want quality and speed without operating GPUs, when traffic is spiky, or when you are still finding the product. Use a local or privately hosted model when data cannot leave your network, when unit cost at steady volume beats the token price, or when you need a fixed snapshot for reproducibility.

Do not call a model API from a mobile or browser build with a secret key embedded. Do not send regulated data until the contract and region are acceptable. Do not build your whole product as one giant prompt if a database query would answer the question. The API is a component.`],
["How it works", `Your server authenticates, usually with an [[api-keys|API key]] or a cloud IAM token, and sends JSON. The provider checks quota, runs the model, and returns JSON or a stream of server-sent events. Input and output are both metered as tokens. A context-window error means you sent more than the model accepts. A 429 means you are over the rate limit. A 500 is theirs; a timeout might be a long generation you should retry idempotently.

Tool calling returns a structured request instead of user-facing text. Your code runs the tool and sends another request with the tool result. Streaming changes the client (you read chunks) but not the security model. Idempotency keys, where the provider supports them, matter if a retry would double-charge an action in your database. The model call itself is not a transaction.`],
["Technologies and dependencies", `Any language that can send HTTPS works. [[python|Python]] and [[javascript|JavaScript]] have the most examples. Vendor [[ai-sdks|SDKs]] handle retries and types. A thin wrapper of your own should hide the vendor so a test can return canned text. You depend on the provider's status page, their data-retention setting, and the specific model id. [[environment-variables|Environment variables]] are the right place for keys. [[langchain|LangChain]] and similar frameworks sit on top and are optional.`],
["How to get started", `1. Create a key with a spend limit. Put it in an environment variable on a server, not in the front-end repo.
2. Send one hard-coded prompt with a small max token value. Print the raw JSON.
3. Add a timeout. The default HTTP timeout in some stacks is infinite.
4. Log the model id, latency and token usage. Do not log the full prompt if it contains customer data; log a length and a request id.
5. Try a failure on purpose: an oversized prompt, a bad key. Map those errors to messages a user can understand.
6. If you need structured output, validate it ([[json-validation]]) before it touches your database.
7. Write two tests with recorded responses so your CI does not call the live model for every commit.

When you add a second provider, wrap both behind one function your application calls. Do not sprinkle vendor types through the UI.`],
["Cautions and trade-offs", `Model ids change. Pin a snapshot if the vendor offers one, and re-evaluate when you move. Temperature and sampling changes make tests flake if you expect exact strings; assert on structure and facts, not on one poetic paragraph. Streaming breaks naive "read the body" code.

Keys leak through client apps, logs and screenshots. Rotate them. Regional endpoints exist for a reason; sending EU personal data to an arbitrary region is a compliance bug. Retries without backoff amplify outages. And a cheaper model that fails your evaluation is not cheaper once humans fix the output. Keep a small offline set of prompts and expected facts, and run it when you change model or prompt.`],
]
},
{
slug: "local-llm-runtimes", title: "Local LLM Runtimes", kind: C, group: "AI ecosystem",
question: "What are Ollama, llama.cpp and vLLM?",
summary: "Local LLM runtimes such as Ollama, llama.cpp and vLLM load open weights on hardware you control and often expose an HTTP API. They trade operational work and hardware limits for privacy and a predictable machine.",
short: `**Ollama**, **llama.cpp** and **vLLM** are runtimes that serve open-weight models. Ollama and llama.cpp fit machines you sit next to; vLLM targets multi-user GPU servers. The privacy trade-offs of running locally are covered in [[local-ai]].`,
aliases: ["Ollama", "what is Ollama", "llama.cpp", "llamacpp", "vLLM", "what is vLLM", "local LLM runtime", "GGUF", "serve a local model", "Ollama vs vLLM"],
keywords: ["Ollama", "llama.cpp", "vLLM", "GGUF", "localhost", "open weights", "GPU", "quantisation"],
related: ["local-ai", "local-ai-vs-cloud-ai", "hugging-face", "model-apis", "docker", "python"],
sections: [
["What it is", `A **local LLM runtime** is the program that loads model weights and runs inference on hardware you control. **llama.cpp** is a widely used C++ engine that runs quantised models efficiently, including on CPUs and Apple silicon, using formats such as **GGUF**. **Ollama** wraps that style of engine in a desktop-friendly installer and a local HTTP API: you \`pull\` a model and call \`localhost\`. **vLLM** is a server engine aimed at GPUs and many concurrent requests, with techniques that raise throughput on a shared machine.

These are not the models themselves. Weights still come from somewhere, often [[hugging-face|Hugging Face]], under that model's licence. They are also not automatically private in every configuration: a runtime bound to a public network interface is a remote API you forgot you published.`],
["Why and when it is used", `Use Ollama or llama.cpp when a developer or a small team wants an assistant or a prototype on a workstation, or when prompts must not leave the building and the model fits in memory. Use vLLM (or a similar server stack) when you are hosting an open model for many users and GPU utilisation matters. Use a hosted [[model-apis|model API]] when you do not want to operate GPUs and the data policy allows it. The broader decision is [[local-ai-vs-cloud-ai]].

Do not expect a 7-billion-parameter local model to match a frontier hosted model on hard reasoning. Do not pick a runtime because a blog said it was fastest without measuring your batch size and your latency budget.`],
["How it works", `The runtime maps weight tensors into memory, quantised or not, and generates tokens one after another (or in a batch, on servers). A quantised GGUF file is smaller and slightly less accurate than a full-precision checkpoint. Context length consumes memory too: a long prompt can fail to load even if the model "fits". Ollama's HTTP API imitates a simple chat API so application code looks like a [[model-apis|model API]] call with a different base URL. vLLM serves an OpenAI-compatible endpoint in many deployments, which lets you keep one client and switch base URLs. Neither compatibility shim implements every vendor feature (tools, vision, batch discounts).

GPU memory is the hard constraint. If it does not fit, the process crashes or spills to RAM and becomes slow. Concurrent users multiply the memory needed for the attention cache, not just the weights.`],
["Technologies and dependencies", `A machine with enough RAM or GPU memory, a model file you are licensed to run, and the runtime's install method (binary, installer, or [[docker|container]]). Python clients are common. NVIDIA GPUs dominate server examples; Apple silicon uses a different path that llama.cpp and Ollama already special-case. Tokenizer files must match the weights. [[environment-variables|Environment variables]] configure the listen address and any preload list. Your application should still have a timeout and a health check; a local process can wedge.`],
["How to get started", `1. Check free memory. Pick a small instruction-tuned model whose quantised size is well under that number.
2. Install Ollama or build llama.cpp from its current instructions. Pull or download one model.
3. Ask it a question you know the answer to, in a terminal. Then call the local HTTP port from [[python|Python]] or curl. Confirm the port is bound to localhost (\`127.0.0.1\`), not \`0.0.0.0\`.
4. Time a response. If it is too slow, try a smaller quantisation or a smaller model before you rewrite your app.
5. Point a thin wrapper in your app at that base URL behind a config flag so tests can use a fake.
6. For a shared server, read vLLM's documentation for the GPU you actually have. Do not expose it to the internet without authentication.

Write down the exact model digest you pulled. "Latest" will change next week and your notes will not match the answers.`],
["Cautions and trade-offs", `Local does not mean correct, safe, or legal. The model can be wrong. The licence can forbid your use case. A helpful installer script can enable a tunnel you did not intend. Ollama and similar tools may check for updates or phone home depending on settings; read that if you are in a locked-down network.

Quantisation hurts some tasks more than others (math, names, formatting). Evaluate; do not assume. vLLM on a shared GPU needs operations skills: drivers, CUDA versions, and a restart story. llama.cpp flags are powerful and easy to copy from a gist that does not match your file. Finally, do not bake a huge model into a git repo. Use the runtime's pull or your artifact store, and keep the repo light.`],
]
},
];
