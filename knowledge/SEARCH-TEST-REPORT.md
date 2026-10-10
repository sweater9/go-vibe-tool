# Knowledge search test report

Run: `node tests/knowledge-search.mjs`

Judgements are against the guides that actually exist. A related page is not marked pass when the corpus does not answer the question. The solid-match threshold was not lowered to hide those gaps.

Queries: 49
Pass: 48
Weak: 1
Miss: 0

| Label | Area | Query | Top | Score | Tool | Gap |
| --- | --- | --- | --- | --- | --- | --- |
| pass | AI fundamentals | What is AI? | what-is-ai | 58 | — | — |
| pass | AI fundamentals | What is machine learning versus AI? | what-is-ai | 52 | — | — |
| pass | AI fundamentals | What is generative AI? | generative-ai | 66 | — | — |
| pass | LLMs | What is an LLM? | large-language-models | 27 | — | — |
| pass | LLMs | How do LLMs generate text? | large-language-models | 38 | — | — |
| pass | LLMs | What is a token? | tokens | 41 | — | — |
| pass | LLMs | What is a transformer and attention? | transformers | 67 | — | — |
| pass | prompting | How do I write better prompts? | prompt-engineering | 71 | ai-prompt-builder | — |
| pass | prompting | What is a system prompt? | system-prompts | 85 | — | — |
| pass | prompting | Why are my prompts giving bad answers? | common-prompting-mistakes | 65 | — | — |
| pass | hallucinations | Why is my LLM hallucinating? | ai-hallucinations | 52 | — | — |
| pass | hallucinations | How do I reduce hallucinations? | how-to-reduce-hallucinations | 83 | — | — |
| pass | hallucinations | How do I check claims against the source text? | how-to-reduce-hallucinations | 22 | fact-anchor-checker | — |
| pass | RAG | What is RAG? | rag | 50 | — | — |
| pass | RAG | let AI answer questions from my documents | rag | 52 | — | — |
| pass | RAG | How should I chunk documents for retrieval? | chunking | 89 | — | — |
| pass | embeddings | What are embeddings? | embeddings | 63 | — | — |
| pass | embeddings | What is cosine similarity? | embeddings | 32 | — | — |
| pass | vector databases | When do I need a vector database? | vector-database-vs-traditional-database | 87 | — | — |
| pass | vector databases | vector database vs SQL | vector-database-vs-traditional-database | 106 | — | — |
| pass | vector databases | What database should I use for embeddings? | embeddings | 46 | — | — |
| pass | agents | What are AI agents? | ai-agents | 80 | — | — |
| pass | agents | What is the difference between an agent and a chatbot? | ai-agent-vs-chatbot | 109 | — | — |
| pass | agents | How do agents call tools? | agent-tools | 58 | — | — |
| pass | agent memory | How do I give an AI agent memory? | agent-memory | 80 | — | — |
| pass | agent memory | AI keeps forgetting previous conversation | agent-memory | 78 | — | — |
| pass | MCP | What is MCP? | mcp | 51 | — | — |
| pass | MCP | How is MCP different from an API? | mcp-vs-api | 94 | — | — |
| pass | function calling | What is function calling? | function-calling | 72 | — | — |
| pass | function calling | function calling vs MCP | function-calling-vs-mcp | 157 | — | — |
| pass | local AI | How do I run an LLM locally? | local-ai | 64 | — | — |
| pass | local AI | Should I run AI locally or in the cloud? | local-ai-vs-cloud-ai | 93 | — | — |
| pass | frameworks | Which framework can I use for an AI agent? | choosing-an-agent-framework | 80 | — | — |
| pass | frameworks | Should I use RAG or fine-tuning? | rag-vs-fine-tuning | 126 | — | — |
| pass | Python | How do I build RAG with Python? | rag-with-python | 79 | — | — |
| pass | JavaScript/TypeScript | TypeScript types for an API client | typescript-api-client-types | 112 | — | — |
| pass | JavaScript/TypeScript | React state for a chatbot | react-chatbot-state | 76 | — | — |
| pass | APIs | Node.js streaming responses from an API | streaming-ai-with-nodejs | 79 | — | — |
| pass | databases | How do I use PostgreSQL with my app? | postgresql-for-ai-apps | 65 | — | — |
| pass | AI security | What is prompt injection? | prompt-injection | 88 | — | — |
| pass | AI security | How do I stop a jailbreak? | prompt-injection | 41 | — | — |
| pass | AI security | Is it safe to paste customer data into an AI tool? | ai-privacy-and-security | 97 | — | — |
| pass | AI security | How do I redact secrets before pasting a prompt? | ai-privacy-and-security | 52 | pii-secret-redactor | — |
| pass | task | How can an AI agent access Gmail? | gmail-for-ai-agents | 83 | — | — |
| pass | task | How do I evaluate a RAG system? | rag-evaluation | 102 | — | — |
| pass | task | Design a multi-agent workflow with roles and handoffs | agentic-workflows | 66 | agentic-workflow-generator | — |
| weak | task | Compare two prompt versions | system-prompts | 25 | prompt-diff | — |
| pass | task | How do I validate JSON? | json-validation | 52 | json-formatter | — |
| pass | task | Can I fine-tune instead of prompting? | rag-vs-fine-tuning | 56 | — | — |

## Worked well
- What is AI? → what-is-ai
- What is machine learning versus AI? → what-is-ai
- What is generative AI? → generative-ai
- What is an LLM? → large-language-models
- How do LLMs generate text? → large-language-models
- What is a token? → tokens
- What is a transformer and attention? → transformers
- How do I write better prompts? → prompt-engineering (tool: ai-prompt-builder)
- What is a system prompt? → system-prompts
- Why are my prompts giving bad answers? → common-prompting-mistakes
- Why is my LLM hallucinating? → ai-hallucinations
- How do I reduce hallucinations? → how-to-reduce-hallucinations
- How do I check claims against the source text? → how-to-reduce-hallucinations (tool: fact-anchor-checker)
- What is RAG? → rag
- let AI answer questions from my documents → rag
- How should I chunk documents for retrieval? → chunking
- What are embeddings? → embeddings
- What is cosine similarity? → embeddings
- When do I need a vector database? → vector-database-vs-traditional-database
- vector database vs SQL → vector-database-vs-traditional-database
- What database should I use for embeddings? → embeddings
- What are AI agents? → ai-agents
- What is the difference between an agent and a chatbot? → ai-agent-vs-chatbot
- How do agents call tools? → agent-tools
- How do I give an AI agent memory? → agent-memory
- AI keeps forgetting previous conversation → agent-memory
- What is MCP? → mcp
- How is MCP different from an API? → mcp-vs-api
- What is function calling? → function-calling
- function calling vs MCP → function-calling-vs-mcp
- How do I run an LLM locally? → local-ai
- Should I run AI locally or in the cloud? → local-ai-vs-cloud-ai
- Which framework can I use for an AI agent? → choosing-an-agent-framework
- Should I use RAG or fine-tuning? → rag-vs-fine-tuning
- How do I build RAG with Python? → rag-with-python
- TypeScript types for an API client → typescript-api-client-types
- React state for a chatbot → react-chatbot-state
- Node.js streaming responses from an API → streaming-ai-with-nodejs
- How do I use PostgreSQL with my app? → postgresql-for-ai-apps
- What is prompt injection? → prompt-injection
- How do I stop a jailbreak? → prompt-injection
- Is it safe to paste customer data into an AI tool? → ai-privacy-and-security
- How do I redact secrets before pasting a prompt? → ai-privacy-and-security (tool: pii-secret-redactor)
- How can an AI agent access Gmail? → gmail-for-ai-agents
- How do I evaluate a RAG system? → rag-evaluation
- Design a multi-agent workflow with roles and handoffs → agentic-workflows (tool: agentic-workflow-generator)
- How do I validate JSON? → json-validation (tool: json-formatter)
- Can I fine-tune instead of prompting? → rag-vs-fine-tuning

## Insufficient Knowledge coverage
- Compare two prompt versions — No guide about diffing prompts. Prompt Diff is the matching tool. Top signal: system-prompts (25). Tool: prompt-diff.

## Routing checks
These are the behaviour checks, not a lowered score cutoff. A failure exits non-zero.

All routing checks matched the expected page, tool and gap.
