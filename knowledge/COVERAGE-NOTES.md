# Knowledge coverage expansion notes

## Branch

`feature/knowledge-coverage` (from `feature/knowledge-search`). Not merged. Not deployed.

## New pages

### Python
- `python-for-ai`
- `rag-with-python`
- `calling-ai-apis-with-python`
- `python-data-for-ai`
- `python-ai-libraries`

### JavaScript / TypeScript
- `javascript-for-ai`
- `typescript-for-ai`
- `typescript-api-client-types`
- `calling-ai-apis-with-javascript`
- `streaming-ai-responses`

### React / Node
- `react-ai-interfaces`
- `react-chatbot-state`
- `nodejs-for-ai`
- `streaming-ai-with-nodejs`

### Frameworks
- `what-is-an-ai-framework`
- `choosing-an-agent-framework`
- `framework-vs-direct-api`

### Databases
- `databases-for-ai-apps`
- `postgresql-for-ai-apps`

### Integrations
- `connecting-agents-to-apps`
- `gmail-for-ai-agents`
- `oauth-for-ai-agents`
- `integration-permissions`

### Building
- `what-is-json`
- `json-validation`
- `what-is-an-api`
- `rest-apis`
- `api-authentication`

## Existing pages expanded

- `vector-database-vs-traditional-database` — section “When an AI app needs each”; related links to new database pages
- `mcp-vs-api` — section “API vs MCP for integrations”; related links to integration pages
- `agent-tools` — section “Connecting to real apps”; related links
- `function-calling` — section “Integrations and validation”; related links
- `rag`, `embeddings`, `vector-databases`, `ai-agents` — related-array links to new practical pages

## Lexicon

### Intents added
- `choose-agent-framework`
- `rag-with-python`
- `typescript-api-client`
- `react-chatbot-state`
- `nodejs-streaming`
- `postgresql-app`
- `gmail-agent-access`
- `validate-json`

### Concepts added
- `concept-python`, `concept-typescript`, `concept-javascript`, `concept-react`, `concept-nodejs`
- `concept-postgresql`, `concept-oauth`, `concept-json`, `concept-rest`, `concept-streaming`

### Coverage gaps
- Removed: `no-agent-framework-catalog`, `no-language-tutorial`, `no-gmail-setup`, `no-app-database-tutorial`
- Narrowed remaining gap: `no-other-app-database-tutorial` (MySQL / MongoDB / SQLite / Prisma only)
- Ranking thresholds (`minSolidScore`, `maxIntentBoost`, `glossaryBoost`) unchanged
- `lexicon.tools` unchanged

## Formerly weak queries now covered

| Query | Top page |
| --- | --- |
| Which framework can I use for an AI agent? | choosing-an-agent-framework |
| How do I build RAG with Python? | rag-with-python |
| TypeScript types for an API client | typescript-api-client-types |
| React state for a chatbot | react-chatbot-state |
| Node.js streaming responses from an API | streaming-ai-with-nodejs |
| How do I use PostgreSQL with my app? | postgresql-for-ai-apps |
| How can an AI agent access Gmail? | gmail-for-ai-agents |
| How do I validate JSON? | json-validation |

## Remaining gaps

- “Compare two prompt versions” — no guide; `prompt-diff` tool match only
- MySQL / MongoDB / SQLite / Prisma application tutorials
- No forced IntelliTools tool blocks on new articles

## Tests

Run: `node knowledge/src/build.mjs` then `node tests/knowledge-search.mjs`

See `SEARCH-TEST-REPORT.md` for the latest counts.
