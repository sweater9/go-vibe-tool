const C = 'concept';
const K = 'comparison';
export const pages = [
{
slug: "redis", title: "Redis", kind: C, group: "Data",
question: "What is Redis and when should an application use it?",
summary: "Redis is an in-memory data store for keys with a few rich values: strings, lists, sets, sorted sets, and expirations. Applications use it for cache, rate limits, short-lived sessions and queues, not as the only copy of data they cannot lose.",
short: `**Redis** keeps **keys in memory** with fast reads and expirations. Use it for cache, rate limits and short-lived coordination. Keep the system of record in [[postgresql|PostgreSQL]] or another durable database.`,
aliases: ["What is Redis?", "Redis", "Redis cache", "when to use Redis", "Redis vs database", "rate limit Redis", "Redis queue"],
keywords: ["Redis", "cache", "key value", "TTL", "rate limit", "memory", "pub/sub"],
related: ["postgresql", "mongodb", "sql-vs-nosql", "environment-variables", "docker"],
sections: [
["What it is", `**Redis** is a data store that keeps structures in memory and serves them over a simple protocol. The basic object is a **key** with a value: a string, a list, a set, a hash, a sorted set. Keys can expire (a TTL). The speed comes from memory and a model that avoids complex queries. Persistence to disk exists (snapshots and an append-only file) and is configurable. You should decide explicitly whether a restart may lose data.

Redis is not a relational database and not a document database for your system of record. It is a sharp tool beside [[postgresql|PostgreSQL]] or similar. People also use it as a makeshift queue and as a pub/sub bus. Those uses work best when losing or duplicating a message is something you have thought about.`],
["Why and when it is used", `Use Redis when a value is derived and can be recomputed: a cache of a rendered page fragment, a session that can be re-authenticated, a rate-limit counter, a feature flag snapshot. Use it for coordination: a lock with an expiry so two workers do not run the same job, a short-lived token. Use sorted sets for leaderboards or "next items by timestamp" if the data fits in memory.

Do not use Redis as the only store of orders or user profiles unless you have configured persistence, backups and a restore drill and you accept the operational model. If you cannot rebuild the data from the system of record, it does not belong only in Redis. Do not use it because every architecture diagram had a box labelled cache.`],
["How it works", `Clients send commands (\`GET\`, \`SET\`, \`INCR\`, \`EXPIRE\`). A single command is atomic. Several commands are not, unless you use a transaction or a Lua script. The classic rate limiter is \`INCR\` on a key with an expiry: the value is the count in the window. If the process crashes and you had no persistence, the counters reset, which for rate limits is often fine.

Eviction policy decides what happens when memory is full: refuse writes, or drop keys. A cache should be allowed to drop keys. A store of jobs might not. Pub/sub delivers messages to current subscribers and does not keep them; if you need a queue that survives a consumer restart, look at streams or a real queue, and know the delivery guarantees. Redis Cluster shards keys across nodes; keys that must be updated together need the same slot, which is a design constraint.`],
["Technologies and dependencies", `A Redis server or a managed equivalent, a client library, and a memory budget. [[docker|Docker]] is fine for local use. The application should have timeouts on every command so a stuck Redis does not stall every request forever. [[environment-variables]] hold the URL and the password. Production Redis should not be open to the internet without authentication and a private network. Name keys with a prefix (\`app:ratelimit:user:123\`) so a shared instance is debuggable.`],
["How to get started", `1. Run Redis locally. Set a key with a 30-second TTL and read it. Wait and read again.
2. Implement a tiny rate limit: increment a key per user id per minute. Return a fake 429 when it passes 5. Call it in a loop.
3. Restart Redis and see the key disappear if you did not turn persistence on. Decide if that is acceptable.
4. Add a timeout in the client. Stop Redis and confirm the app fails fast rather than hanging.
5. Only then cache something expensive. Measure hit rate. A cache you never hit is complexity.
6. Document which data is safe to lose.

If the next idea is "store the shopping cart only in Redis" and the cart is revenue, write down the persistence and backup plan before you ship.`],
["Cautions and trade-offs", `Memory is the capacity plan. A key per user with a large JSON value will exhaust RAM and then eviction will delete something you needed. Name TTLs deliberately; a cache without expiry is a leak.

\`KEYS *\` on a production instance can stall it. Use \`SCAN\`. Shared Redis with no key prefix and no ACL means one app deletes another's keys. Managed Redis with a tiny memory cap and an aggressive eviction policy will make a cache look "randomly empty". And a distributed lock in Redis is subtler than a blog post. If the lock expires while the worker is still running, two workers proceed. Use locks for coordination you can tolerate being wrong, or study the failure mode before you use them for money.`],
]
},
{
slug: "prisma-and-orms", title: "ORMs and Prisma", kind: C, group: "Data",
question: "What is an ORM and when should I use Prisma?",
summary: "An ORM maps database rows to objects in your language. Prisma is a popular TypeScript ORM that generates a client from a schema file. ORMs speed ordinary queries and can hide the SQL that explains a slow page.",
short: `An **ORM** turns rows into objects. **Prisma** is a TypeScript ORM with a schema and a generated client. Use it for ordinary CRUD. Read the [[sql|SQL]] it emits when a page is slow. The database is still [[postgresql|Postgres]], [[mysql|MySQL]] or [[sqlite|SQLite]].`,
aliases: ["What is an ORM?", "ORM", "Prisma", "Prisma ORM", "what is Prisma", "SQL vs ORM", "when to use Prisma", "object relational mapper"],
keywords: ["ORM", "Prisma", "schema", "migration", "TypeScript", "SQL", "N+1"],
related: ["sql", "postgresql", "mysql", "sqlite", "typescript", "sql-vs-nosql"],
sections: [
["What it is", `An **object-relational mapper (ORM)** is a library that lets you work with database rows as objects or functions in your programming language. You describe models. The library generates [[sql|SQL]] and maps results back. **Prisma** is a specific ORM popular in [[typescript|TypeScript]]: you write a \`schema.prisma\` file, it generates a typed client, and you call \`prisma.user.findMany(...)\` instead of writing SQL strings. Migrations can be generated from schema changes.

Other ORMs (SQLAlchemy, Entity Framework, Hibernate, Drizzle, Django's ORM) do the same job with different tastes. This page uses Prisma as the concrete example and the lessons apply to the category. The database underneath is still [[postgresql|PostgreSQL]], [[mysql|MySQL]] or [[sqlite|SQLite]].`],
["Why and when it is used", `Use an ORM when most of your queries are ordinary: find a row by id, list a user's items, insert a record, update a column. The generated types catch mistakes and new teammates move faster. Use Prisma in particular when the stack is TypeScript and you want one schema file as the source of truth.

Drop to SQL, or to the ORM's escape hatch, when the query is a report, a bulk update, or anything you have to [[sql|explain]]. Do not use an ORM because you do not want to learn SQL. You will still debug SQL. Do not let the ORM own a query you cannot read.`],
["How it works", `Prisma's schema declares models and relations. \`prisma migrate\` produces SQL migrations you should commit and review. The generated client exposes methods per model. A relation can be loaded with the parent (\`include\`), which is convenient and is how people accidentally load enormous graphs. The N+1 problem appears when you list parents and then query children in a loop. The fix is to include or to query in batch, then confirm with logs that you issued a few SQL statements, not a few hundred.

Transactions exist (\`$transaction\`) and matter when two writes must succeed together. Types end at the database: a constraint failure arrives as a runtime error you should map to a user-facing message, not a stack trace.`],
["Technologies and dependencies", `Node, TypeScript, the Prisma packages, and a database URL in [[environment-variables|the environment]]. Migrations need a shadow database or equivalent rights in CI. Generated client code should be produced in CI or committed according to one team policy, not "sometimes". [[sql]] knowledge remains a dependency even though it is not an npm package.`],
["How to get started", `1. Create a Postgres or SQLite database. Point \`DATABASE_URL\` at it.
2. Define one model with an id and one required field. Migrate. Look at the SQL file Prisma wrote.
3. Insert and read a row from a script using the generated client.
4. Add a second model with a relation. Write a list query and log the SQL. Make sure it is not N+1.
5. Add a unique constraint and handle the error when you insert a duplicate.
6. Put the migration in pull-request review the same way you review code.

If you cannot read the migration, do not merge it. A generated \`DROP TABLE\` is still a drop.`],
["Cautions and trade-offs", `ORMs encourage chatty queries and hidden sorts. Turn SQL logging on in development. Prisma's abstraction does not cover every database feature; a partial index or a database function may need raw SQL. That is fine. Mixing raw SQL and the client in a transaction requires care so you are on the same connection.

Schema drift happens when someone edits the database by hand. Migrations are the source of truth, or they are not; pick one. And an ORM is a poor place to hide multi-tenant rules. A \`where\` clause you forget in one method leaks rows. Centralise the tenant filter. Finally, do not upgrade Prisma, the database and the schema in one change. You will not know which one broke the query.`],
]
},
{
slug: "choosing-a-vector-store", title: "Choosing a Vector Store", kind: C, group: "Data",
question: "Which vector database should I use?",
summary: "Choose a vector store by how you already run data: pgvector inside PostgreSQL, a dedicated vector database, or an in-process library for small sets. The retrieval quality depends more on chunking and embeddings than on the brand.",
short: `Start with **pgvector** if [[postgresql|Postgres]] is already your database and the corpus is moderate. Choose a dedicated [[vector-databases|vector database]] when scale, filtering or operations outgrow that. The definition of vector search is the existing vector database guide, not this page.`,
aliases: ["which vector database", "Pinecone vs pgvector", "Qdrant vs Weaviate", "Chroma vector store", "which vector store", "pgvector or Pinecone", "choose a vector database"],
keywords: ["pgvector", "Pinecone", "Qdrant", "Weaviate", "Chroma", "vector store", "ANN"],
related: ["vector-databases", "vector-database-vs-traditional-database", "embeddings", "postgresql", "rag", "chunking"],
sections: [
["What it is", `A vector store keeps [[embeddings|embeddings]] and returns the nearest ones to a query. The idea is explained in [[vector-databases]]. This page is the choice between places to put them: an extension inside [[postgresql|PostgreSQL]] (**pgvector**), a dedicated product (Pinecone, Qdrant, Weaviate, Milvus and others), or an in-process library (Chroma or FAISS in a single service). The brand does not fix a bad chunking strategy. [[chunking]] and the embedding model decide whether the right paragraph is even in the candidate list.`],
["Why and when it is used", `Use pgvector when Postgres is already the system of record, the corpus is not huge, and you want one backup, one permission story and SQL filters beside the vector. Use a dedicated vector database when you need independent scaling, specialised filtering and hybrid search at a size where Postgres is struggling, or when the vendor's managed service is the operational path your team will actually run. Use an in-process index for prototypes, tests and small single-node tools.

Do not adopt a separate database for a few thousand chunks. Do not put production retrieval in an in-memory demo that forgets data on restart. [[vector-database-vs-traditional-database]] covers the "do I need one at all" question; this page assumes you do need nearest-neighbour search.`],
["How it works", `You store an id, a vector, and metadata (tenant, source, timestamp). A query embeds the question and asks for the nearest K ids, preferably with a metadata filter applied in the engine, not after you fetched a thousand neighbours and threw them away. Indexes (HNSW and others) trade recall for speed. You must measure recall on your data: an index that misses the right chunk is a fast wrong answer.

Updates and deletes matter if documents change. Some systems are awkward about updating a vector in place. Plan for re-embedding when you change the embedding model; vectors from two models are not comparable. Multi-tenant isolation is a filter you test with two tenants, not a promise on the marketing page.`],
["Technologies and dependencies", `An embedding API or local embedding model, the store itself, and a job that chunks and writes. [[rag]] is the application pattern. [[postgresql-for-ai-apps]] shows the Postgres path. Dedicated stores have their own clients and their own cloud bills. Your [[sql|SQL]] database usually remains the source of document metadata even if vectors live elsewhere. Keep the document id stable so you can delete vectors when the source row is deleted.`],
["How to get started", `1. Take a corpus you can read end to end in an afternoon.
2. If you already run Postgres, add pgvector, store vectors for that corpus, and filter by a metadata column.
3. Write twenty questions and score whether the correct chunk is in the top five. Change chunking before you change products.
4. Note latency and index build time.
5. Only if Postgres cannot meet the measured need, prototype one dedicated store with the same questions. Compare recall, not slogans.
6. Automate re-index and delete. A store that only grows is a bug.

Keep the evaluation set. You will need it when a vendor changes a default index.`],
["Cautions and trade-offs", `Managed vector databases are another region your text is copied into. Read the data policy before you upload confidential corpora. In-process libraries inside a web dyno vanish or diverge when you run two copies. pgvector on an undersized Postgres can hurt the transactional workload; isolate workloads if retrieval traffic is heavy.

Vendor lock-in shows up in metadata filter syntax and in how you export vectors. Keep the source chunks in your own object storage or database so you can leave. And do not expect the store to know truth. It returns similar text. [[rag]] still requires the model and your evaluation to handle "the answer is not in the corpus".`],
]
},
{
slug: "sql-vs-nosql", title: "SQL versus NoSQL", kind: K, group: "Comparisons",
question: "Should I use SQL or NoSQL?",
summary: "SQL databases store related rows with constraints. NoSQL is a loose label for documents, key-value stores and others. Choose based on access patterns and the invariants you need, not on which word sounds newer.",
short: `Use **SQL** when you need relationships and constraints ([[postgresql|Postgres]], [[mysql|MySQL]]). Use a **document** store ([[mongodb|MongoDB]]) or **key-value** store ([[redis|Redis]]) when that shape matches the access. NoSQL is not one product.`,
aliases: ["SQL vs NoSQL", "SQL versus NoSQL", "NoSQL vs SQL", "should I use NoSQL", "relational vs document", "when to use NoSQL", "SQL or MongoDB"],
keywords: ["SQL", "NoSQL", "relational", "document", "schema", "constraints"],
related: ["sql", "postgresql", "mongodb", "redis", "sqlite", "databases-for-ai-apps"],
sections: [
["What it is", `**SQL** here means a relational database: tables, [[sql|SQL]], transactions and constraints, such as [[postgresql|PostgreSQL]] or [[mysql|MySQL]]. **NoSQL** is not a single technology. It was a slogan for systems that rejected that model: [[mongodb|document databases]], [[redis|key-value stores]], wide-column stores, search engines. Lumping them together hides the choice. This page separates "I need constraints and joins" from "I need a specific non-relational shape".`],
["Why and when it is used", `Choose relational SQL when entities refer to each other and incorrect references are bugs: accounts, orders, permissions, inventory. Choose documents when you load and store a self-contained blob with fields that vary. Choose a key-value store for cache and counters, not for the ledger. Choose a search engine for full-text ranking. Choose a vector index for similarity, beside a system of record, not instead of one.

Most applications should start relational. Add another store when an access pattern hurts and you can name it. Starting with three NoSQL products and no invariants is how data drifts.`],
["How it works", `In a relational design you normalise: a user row, an order row with a user id, a foreign key so the order cannot point at nobody. Queries join. Transactions keep a transfer consistent. In a document design you embed the parts you always load together, and you accept duplication if the same fact appears in two documents. Updates must fix every copy. In a key-value design you invent the key and you do not get a rich query language; if you need one, you picked the wrong tool.

"Schemaless" still has a schema. It lives in the application, inconsistently, unless you enforce it. Relational schemas live in the database, which is stricter and sometimes less convenient.`],
["Technologies and dependencies", `One primary database your team can operate, backups, and migrations. [[prisma-and-orms|ORMs]] sit on relational engines and some document engines. [[sql-vs-nosql]] is a decision you write down. [[databases-for-ai-apps]] discusses this in the AI-app setting. The extra stores (Redis, a vector index) are dependencies you add later with a reason.`],
["How to get started", `1. Write the three most important operations (create X, list Y by user, update Z safely).
2. Sketch a relational schema and the SQL. Note any operation that is awkward.
3. If an operation is awkward only because you have not learned JOIN, learn JOIN. That is not a NoSQL requirement.
4. If an operation is awkward because the payload is a large varying document, sketch that one collection as documents and keep the rest relational if you can.
5. Pick one primary store for the first release.
6. Revisit when you have measurements, not when a new teammate prefers a different logo.

Draw the invariants ("an order total equals its lines") and where they are enforced. If the answer is "the application remembers", the application will forget.`],
["Cautions and trade-offs", `NoSQL is not faster by definition. A missing index is slow everywhere. Relational is not always consistent with your needs if you turn the isolation down and then assume banking semantics. Multi-store architectures fail in the gap: the document updated, the search index did not, the cache is old. Each extra store needs a sync story.

Vendors will sell a single platform that claims to be all models. Convenience is real and so is lock-in. Prefer a boring primary database. And ignore architecture arguments that treat SQL as legacy. The relational model is still the best fit for a large fraction of business data, which is why the NoSQL products keep adding transactions and SQL-like queries.`],
]
},
];
