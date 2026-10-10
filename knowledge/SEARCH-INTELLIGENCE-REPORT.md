# Knowledge search intelligence: relevance report

Run: `node tests/knowledge-search-relevance.mjs`. Dataset: `tests/data/search-relevance-dataset.json` (303 queries; methodology is in the file header).

**Before** is the unmodified lexical engine (`knowledge/search-core.mjs`). **After** is `searchIntelligent` over the same committed index and lexicon. The solid-match threshold (`minSolidScore`) was not changed. Semantic search stays opt-in and was not used for these numbers.

## Headline

| Metric | Before | After | Change |
| --- | --- | --- | --- |
| Queries passing every check | 72.9% | 100% | +27.1% |
| Confident answers that are correct (225 queries) | 80% | 100% | +20% |
| Out-of-scope / ambiguous queries kept weak (38 queries) | 92.1% | 100% | +7.9% |
| Wrong confident answers (count, lower is better) | 12 | 0 | -12 |
| Tool recommendation recall (25 queries) | 20% | 100% | +80% |
| Unexpected tool recommendations (count) | 0 | 0 | +0 |
| Mean reciprocal rank of the first right guide | 0.861 | 0.978 | +0.1 |

Protected queries (passed before): 221. Regressions among them: 0.

## By category

| Category | Queries | Before pass | After pass |
| --- | --- | --- | --- |
| broad | 8 | 3 | 8 |
| definition | 101 | 97 | 101 |
| beginner | 10 | 4 | 10 |
| howto | 33 | 21 | 33 |
| abbreviation | 16 | 11 | 16 |
| typo | 18 | 4 | 18 |
| comparison | 27 | 26 | 27 |
| synonym | 3 | 3 | 3 |
| troubleshooting | 10 | 7 | 10 |
| advanced | 4 | 2 | 4 |
| tool | 23 | 4 | 23 |
| natural | 9 | 4 | 9 |
| offtopic | 12 | 12 | 12 |
| ambiguous | 24 | 21 | 24 |
| sequence | 5 | 2 | 5 |

## Latency (Node v26.8.2, warm, single process, 303 queries)

| Engine | p50 | p95 |
| --- | --- | --- |
| Before (lexical core) | 2.77 ms | 3.93 ms |
| After (intelligence layer) | 5.84 ms | 12.08 ms |

## Queries fixed

- machine learning → supervised-learning — was: only 0/3 required topic guides visible
- what is machine learning → supervised-learning — was: only 0/3 required topic guides visible
- machine learning for beginners → supervised-learning — was: only 0/3 required topic guides visible
- how does machine learning work → supervised-learning — was: only 0/3 required topic guides visible
- types of machine learning → supervised-learning — was: only 0/3 required topic guides visible
- machine learning basics explained simply → supervised-learning — was: only 0/3 required topic guides visible
- ml → supervised-learning — was: no confident answer
- ml basics → supervised-learning — was: no confident answer
- machien learning → supervised-learning — was: no confident answer
- why does the model forget the start of a long document → closest pages — was: none of context-windows in the first 6 guides
- how do transformers work for beginners → transformers — was: no confident answer
- how do I write a good prompt → prompt-engineering (tools: ai-prompt-builder) — was: no confident answer
- advanced prompting techniques → prompt-engineering — was: no confident answer
- how do I compare two versions of a prompt → closest pages (tools: prompt-diff) — was: missing tool: prompt-diff
- promt engineering → prompt-engineering — was: no confident answer
- why does AI make things up → ai-hallucinations — was: no confident answer
- my chatbot makes things up → ai-hallucinations — was: no confident answer
- halucination → ai-hallucinations — was: no confident answer
- is it safe to put customer data into ChatGPT → ai-privacy-and-security — was: no confident answer
- how do I remove personal data from text before sending it to an AI → ai-privacy-and-security (tools: pii-secret-redactor) — was: no confident answer
- redact api keys from logs → api-keys (tools: pii-secret-redactor) — was: missing tool: pii-secret-redactor
- how do AI systems become biased → ai-bias-and-fairness — was: no confident answer
- retreival augmented generation → rag — was: no confident answer
- embeding models → embeddings — was: no confident answer
- vecotr database → vector-databases — was: no confident answer
- fine tunning → fine-tuning — was: no confident answer
- build rag with python → rag-with-python — was: wrong confident answer: rag
- what is an AI agent → ai-agents — was: wrong confident answer: ai-agent-vs-chatbot
- agentic workflw → agentic-workflows — was: no confident answer
- how do I run agent generated code safely → code-execution-sandboxing — was: no confident answer
- can an AI agent read my gmail → gmail-for-ai-agents — was: wrong confident answer: ai-agent-vs-chatbot
- langchian → langchain — was: no confident answer
- how can I reduce my LLM API costs → llm-cost-optimization — was: wrong confident answer: model-apis
- what are GPUs used for in AI → gpus-and-ai-accelerators — was: no confident answer
- how do I serve a model for inference → model-serving-and-inference — was: no confident answer
- best python libraries for machine learning → python-ai-libraries — was: wrong confident answer: python
- call the openai api from python → calling-ai-apis-with-python — was: wrong confident answer: python
- call an LLM API with javascript → calling-ai-apis-with-javascript — was: wrong confident answer: javascript
- how do I stream AI responses to the browser → streaming-ai-responses — was: no confident answer
- typscript → typescript — was: no confident answer
- decode a jwt token and read its claims → json-web-tokens (tools: oauth-jwt-decoder) — was: missing tool: oauth-jwt-decoder
- compare two .env files for missing keys → environment-variables (tools: env-diff) — was: missing tool: env-diff
- pretty print a json file → closest pages (tools: json-formatter) — was: missing tool: json-formatter
- strip the auth token from a curl command → closest pages (tools: curl-code-sanitizer) — was: wrong confident answer: tokens
- generate a create table statement and mock data → closest pages (tools: sql-mock-builder) — was: missing tool: sql-mock-builder
- which database should I use for my AI app → databases-for-ai-apps — was: no confident answer
- AWS basics for beginners → aws-fundamentals — was: no confident answer
- compress an image → closest pages (tools: image-studio) — was: missing tool: image-studio
- resize an image for the web → closest pages (tools: image-studio) — was: missing tool: image-studio
- convert png to webp → closest pages (tools: image-studio) — was: missing tool: image-studio
- make a favicon from my logo → closest pages (tools: image-studio) — was: missing tool: image-studio
- merge pdf files → closest pages (tools: pdf-studio) — was: missing tool: pdf-studio
- split a pdf into separate pages → closest pages (tools: pdf-studio) — was: missing tool: pdf-studio
- reduce the file size of a pdf → closest pages (tools: pdf-studio) — was: missing tool: pdf-studio
- rotate pages in a pdf → closest pages (tools: pdf-studio) — was: missing tool: pdf-studio
- decode a base64 string → closest pages (tools: base64) — was: missing tool: base64
- convert a unix timestamp to a date → closest pages (tools: timestamp) — was: missing tool: timestamp
- explain this cron expression → closest pages (tools: cron-humanizer) — was: missing tool: cron-humanizer
- how does diffusion image generation work → diffusion-models — was: no confident answer
- how should I react when someone is rude to me → closest pages — was: false confident answer: react
- token of appreciation gift ideas → closest pages — was: false confident answer: tokens
- embedding a youtube video in my website → closest pages — was: false confident answer: embeddings
- dl → deep-learning — was: no confident answer
- cnn → convolutional-neural-networks — was: no confident answer
- gpu → gpus-and-ai-accelerators — was: no confident answer
- neural netwrok → neural-networks — was: no confident answer
- reinforcment learning → reinforcement-learning — was: no confident answer
- pyhton for ai → python-for-ai — was: no confident answer
- javscript → javascript — was: no confident answer
- how do I learn machine learning from scratch → supervised-learning — was: only 0/3 required topic guides visible
- how do I fine-tune a model cheaply → fine-tuning — was: no confident answer
- how do I know if my AI app is working well → ai-evaluation — was: no confident answer
- benchmarks vs task evals → llm-benchmarks-vs-task-evals — was: wrong confident answer: benchmarks-and-leaderboards
- databases → databases-for-ai-apps — was: only 2/3 required topic guides visible
- cloud computing → aws-fundamentals — was: only 1/2 required topic guides visible
- authentication → authentication-vs-authorization — was: only 2/3 required topic guides visible
- agent frameworks → agent-frameworks-compared — was: no confident answer
- learn ai → what-is-ai — was: none of what-is-ai in the first 6 guides
- advanced RAG techniques → rag — was: learn-more lacks agentic-rag/graph-rag/hybrid-search-and-reranking/rag-evaluation
- prerequisites for lora fine-tuning → lora-and-peft — was: learn-more lacks fine-tuning/neural-networks
- what to learn after rag → rag — was: learn-more lacks rag-evaluation/hybrid-search-and-reranking/agentic-rag/graph-rag
- next steps after prompt engineering → prompt-engineering — was: learn-more lacks chain-of-thought/structured-outputs/context-engineering/agent-tools

## Still failing

None.

## Checks

All checks passed: no regressions among protected queries, no rise in wrong confident answers, no unexpected tool recommendations, improvement floors met.
