const C = 'concept';
const K = 'comparison';
export const pages = [
{
slug: "postgresql", title: "PostgreSQL, the Relational Database", kind: C, group: "Data",
question: "What is PostgreSQL?",
summary: "PostgreSQL (Postgres, often shortened to PG) is an open-source relational database. It stores tables with constraints, speaks SQL, and can add extensions such as pgvector. It is a strong default system of record for applications.",
short: `**PostgreSQL** (**Postgres**, **PG**) is a relational database: [[sql|SQL]], transactions, and extensions like pgvector. Using it beside an AI feature is covered in [[postgresql-for-ai-apps]]. The database itself is this page.`,
aliases: ["What is PostgreSQL?", "PostgreSQL", "Postgres", "PG", "what is Postgres", "Postgres database", "PostgreSQL vs MySQL", "what is PG"],
keywords: ["PostgreSQL", "Postgres", "PG", "SQL", "transaction", "pgvector", "index", "ACID"],
related: ["sql", "mysql", "sqlite", "postgresql-for-ai-apps", "prisma-and-orms", "vector-databases", "sql-vs-nosql"],
sections: [
["What it is", `**PostgreSQL**, usually called **Postgres** and sometimes **PG**, is an open-source relational database. You define tables, constraints and indexes. You query them with [[sql|SQL]]. Transactions are real: a group of writes commits together or not at all. It has been developed in the open for decades and is a default choice for new application databases, from small services to large ones.

Postgres is a specific engine, not a synonym for "SQL". [[mysql|MySQL]] and [[sqlite|SQLite]] are other engines. [[postgresql-for-ai-apps]] explains storing chats and optional embeddings next to a model. This page is the database you are choosing when someone asks what Postgres is.`],
["Why and when it is used", `Choose Postgres when you need a system of record: users, orders, documents, permissions, billing. Choose it when you want constraints the database enforces (foreign keys, unique emails, check constraints) rather than hoping every service remembers. Choose it when one box, or one managed instance, should hold the data and you want room to grow without a new product.

Add a specialised store beside it when you must: [[redis|Redis]] for ephemeral cache and rate limits, a [[vector-databases|vector database]] or the pgvector extension for similarity search, object storage for big blobs. Do not start with three databases because a diagram showed them. Start with Postgres until a measurement says a table is the wrong shape.`],
["How it works", `A server process accepts connections. Clients speak the Postgres protocol, usually through a driver that uses parameters (\`$1\`) rather than pasted strings. The planner chooses how to run each query. Indexes (B-tree by default, others when you know why) keep lookups from scanning the whole table. WAL (the write-ahead log) records changes so a crash can recover. VACUUM reclaims space from old row versions; autovacuum does this for you and still needs watching on very busy tables.

Roles and grants are the permission model. An application should connect as a role that cannot drop the database. Extensions add capabilities inside the same server. **pgvector** stores embedding vectors and indexes them. That does not replace a relational schema; it adds a column and an index. Managed services (cloud vendors' Postgres) handle backups and failover if you configure them. They do not write your indexes.`],
["Technologies and dependencies", `A Postgres server (local install, [[docker|container]], or a managed instance), a client such as \`psql\`, and a driver in your language. Migrations live in git. [[prisma-and-orms|Prisma]] and other ORMs can target Postgres. Connection pooling (PgBouncer or the platform's pooler) matters once many app instances open connections, because each connection is a process-like cost. [[environment-variables|Environment variables]] should hold the URL, not the source tree. [[sql-vs-nosql]] is the neighbouring decision.`],
["How to get started", `1. Run Postgres locally or in Docker. Create a database and a role with a password. Do not use the superuser in the app.
2. Create two related tables and a foreign key. Insert rows with \`psql\`.
3. Connect from your application with a parameterised query. Print the plan of the one query you will run most (\`EXPLAIN\`).
4. Add a migration tool so the next column is a file, not a click.
5. Take a backup and restore it once while the stakes are zero.
6. If you need embeddings later, read [[postgresql-for-ai-apps]] before you add pgvector. Often you do not need it on week one.

Write the major version down. Extensions and syntax differ across majors. Upgrade on purpose.`],
["Cautions and trade-offs", `A missing index is the usual outage, not the database "being down". Look at slow queries before you buy a larger machine. Long transactions block vacuum and bloat tables. An ORM that loads entire graphs will melt a healthy server.

Postgres is not a queue, a cache, or a search engine, though people stretch it into all three. Stretching works until it does not; know which you are doing. Logical replication and read replicas are operational commitments. And a managed "Postgres compatible" service is mostly Postgres until you hit the feature they omitted. Test the extension and the migration path you actually need, especially pgvector versions.`],
]
},
{
slug: "mysql", title: "MySQL", kind: C, group: "Data",
question: "What is MySQL and how does it differ from PostgreSQL?",
summary: "MySQL is a widely used open-source relational database, common in existing web stacks and managed as Aurora or Cloud SQL. It speaks SQL with its own dialect and defaults. Pick it to extend a MySQL estate; pick PostgreSQL for many new apps unless your platform is already MySQL.",
short: `**MySQL** is a relational database and a [[sql|SQL]] dialect, often managed by cloud vendors. Use it when the organisation is already on MySQL. For a new system of record, compare it honestly with [[postgresql|PostgreSQL]] rather than following a ten-year-old tutorial.`,
aliases: ["What is MySQL?", "MySQL", "My SQL", "MySQL database", "MySQL vs PostgreSQL", "MariaDB vs MySQL", "when to use MySQL"],
keywords: ["MySQL", "MariaDB", "InnoDB", "SQL", "index", "replication", "dialect"],
related: ["postgresql", "sql", "sqlite", "sql-vs-nosql", "prisma-and-orms", "databases-for-ai-apps"],
sections: [
["What it is", `**MySQL** is an open-source relational database now developed under Oracle's stewardship, with a large installed base in web applications. It stores tables and serves [[sql|SQL]]. The storage engine you actually want for transactions is **InnoDB**. **MariaDB** began as a fork and remains compatible for many workloads and different for others; do not assume every blog post applies to both.

Cloud products (Amazon Aurora MySQL, Google Cloud SQL, Azure Database for MySQL) host it so you do not patch the OS yourself. MySQL is not "the free database" as a category. [[postgresql|PostgreSQL]] and [[sqlite|SQLite]] are the other common answers. This page is how to decide and how not to get hurt by defaults.`],
["Why and when it is used", `Choose MySQL when the company already runs it, when a product you must use expects it, or when your platform team's golden path is a managed MySQL. The operational knowledge you already have is worth more than a feature list. Choose Postgres for many green-field systems if you have no installed base, especially if you want stricter SQL behaviour and extensions such as pgvector in the same engine. Either can run a serious application.

Do not choose a database because a shared host in 2012 included it. Do not run two of them "for different microservices" that share one team and one schema's worth of data.`],
["How it works", `A server accepts connections, authenticates a user, and runs SQL against InnoDB tables. Transactions and row locks are InnoDB features; the old MyISAM engine does not give you the transactional behaviour you assume. Indexes, query plans (\`EXPLAIN\`) and slow-query logs are how you diagnose performance. Replication copies changes to other servers for reads or failover. Dialects differ from Postgres: upsert syntax, quoting, autoincrement, and the way some modes silently truncate or coerce bad values.

That last point matters. In loose SQL modes, MySQL has historically accepted invalid dates or truncated strings with a warning instead of an error. Strict mode exists and you want it for new applications so bad data fails loudly. Check the mode; do not inherit a server someone configured to be "helpful" in 2009.`],
["Technologies and dependencies", `A MySQL 8.x (or current) server, a client, and a driver. Migrations in git. An ORM if you use one, pointed at the right dialect. Connection limits are easy to exhaust; use a pool. Backups (\`mysqldump\` for small databases, the platform's snapshots for real ones) need a restore drill. [[prisma-and-orms|Prisma]] supports MySQL as one provider. [[sql]] is still the language underneath.`],
["How to get started", `1. Install MySQL 8 or run the official container. Create a database and an application user with rights only on that database.
2. Confirm \`sql_mode\` includes strict settings. Insert an invalid value and watch it fail.
3. Create a table with a primary key, a unique column and a foreign key. InnoDB is required for the foreign key to mean what you think.
4. From your app, connect with parameters and a pool size you chose, not the driver's infinite default.
5. Run \`EXPLAIN\` on the main query. Add the obvious index.
6. If you are choosing between MySQL and Postgres and nobody in the team has operated either, prefer the one your cloud's tutorial and your hiring pool match, and document the choice.

Do not copy a Postgres schema in and hope. Types and autoincrement differ. Write the migration for the engine you run.`],
["Cautions and trade-offs", `Silent coercion is the historic footgun. Strict mode is step zero. Charset should be \`utf8mb4\` or you will corrupt emoji and some symbols; the old \`utf8\` in MySQL is not full Unicode. Time zones and \`DATETIME\` versus \`TIMESTAMP\` cause off-by-hours bugs.

MariaDB compatibility is not identity. An extension or a version-specific feature needs a test on the engine you will deploy. Managed MySQL that lags upstream will not have the blog post's feature. And as with any relational engine, the ORM is not the schema. Read the SQL, add indexes, and do not use the database user that has \`SUPER\` privileges as the application's login.`],
]
},
{
slug: "sqlite", title: "SQLite", kind: C, group: "Data",
question: "What is SQLite and when is a single file enough?",
summary: "SQLite is a relational database stored in one file inside your process. It is the right default for local tools, tests, mobile apps and modest servers. It is the wrong default for many writers across many application servers.",
short: `**SQLite** is [[sql|SQL]] in a **single file**, embedded in your process. Use it for local apps, tests and small services. Move to [[postgresql|PostgreSQL]] when you have many servers writing at once.`,
aliases: ["What is SQLite?", "SQLite", "sqlite3", "embedded database", "SQLite vs PostgreSQL", "when to use SQLite", "SQLite file database"],
keywords: ["SQLite", "embedded", "file", "SQL", "local", "WAL", "serverless database"],
related: ["sql", "postgresql", "mysql", "prisma-and-orms", "databases-for-ai-apps"],
sections: [
["What it is", `**SQLite** is a relational database engine that lives inside your application as a library, not as a separate server process. The database is a **file**. You link the library or use the \`sqlite3\` CLI, open the file, and run [[sql|SQL]]. There is no network protocol and no database user account in the usual sense. Whoever can read the file can read the data.

That design is why phones, browsers, test suites and desktop apps use it. It is also a respectable choice for a low-traffic server with one writer. It is not a toy dialect. The SQL is real, the transactions are real, and the limits are about concurrency and operations, not about whether JOIN works.`],
["Why and when it is used", `Use SQLite for local development, automated tests, a desktop tool, a CLI that needs structured storage, or a small internal app deployed as a single process. Use it when backups are "copy the file" and that is acceptable. Use it when you want zero administration.

Move to [[postgresql|PostgreSQL]] or [[mysql|MySQL]] when several application instances must write at the same time, when you need fine-grained network permissions, extensions you cannot compile in, or managed failover. Do not start on a server database for a prototype that is one process on one machine. Also do not pretend SQLite will be a multi-tenant SaaS backbone without reading its locking rules.`],
["How it works", `Your process calls into the library. A write takes a lock so other writes wait. Readers can proceed alongside a writer if you use WAL mode, which you should for anything concurrent. There is still one writer at a time. A network filesystem under the file is a classic way to corrupt it; put the file on a local disk. Transactions work. Foreign keys exist but must be enabled per connection (\`PRAGMA foreign_keys = ON\`), which surprises people coming from Postgres where they are always on.

Types are more flexible than Postgres. You can still declare types and constraints, and you should. The file grows and does not always shrink until you vacuum. Connections are cheap compared with a server database, but a pool of threads all writing will serialise.`],
["Technologies and dependencies", `The SQLite library, which is often already on the machine or embedded in your language runtime, and a file path in configuration. Drivers exist for every mainstream language. [[prisma-and-orms|Prisma]] and other ORMs support it for local work; beware of features they use that differ in production Postgres. Tests that run on SQLite and production that runs on Postgres will drift. Either accept the drift and keep tests honest about it, or run Postgres in CI.`],
["How to get started", `1. Install the \`sqlite3\` shell or use your language's standard library (Python's \`sqlite3\` is built in).
2. Create a file, a table with a primary key and a foreign key, and turn foreign keys on.
3. Insert and select from the shell, then from code, with parameters.
4. Enable WAL if more than one thread will touch the file.
5. Copy the file, open the copy, and confirm you have a backup. Then try that while a write is in progress and understand what you got.
6. Point tests at a temporary file or an in-memory database so they do not share state.

If the next step is "deploy two containers that share this file over a volume", stop. That is the design SQLite is bad at. One writer process, or a server database.`],
["Cautions and trade-offs", `The file's permissions are the security model. A world-readable database file is a dump of your users. Backup copies multiply that. In-memory databases vanish when the process exits, which is perfect for tests and disastrous for data you meant to keep.

ALTER TABLE is more limited than in Postgres. Migrations need a little more care. Concurrent writes from many servers will fail or queue. And ORMs that use database-specific types will pass locally and break in production if you only test SQLite. Use SQLite where its simplicity is the point, and switch engines when the deployment model changes, not after the first corruption incident.`],
]
},
{
slug: "mongodb", title: "MongoDB", kind: C, group: "Data",
question: "What is MongoDB and when is a document database right?",
summary: "MongoDB is a document database: you store JSON-like documents in collections and query them by fields. It fits data you mostly load as a whole document. It is a poor replacement for relational constraints you actually need.",
short: `**MongoDB** stores **documents** (JSON-like) in collections. Use it when a record is a self-contained document. If you need joins and constraints, use [[postgresql|PostgreSQL]] and read [[sql-vs-nosql]].`,
aliases: ["What is MongoDB?", "MongoDB", "Mongo", "document database", "MongoDB vs PostgreSQL", "when to use MongoDB", "NoSQL Mongo"],
keywords: ["MongoDB", "document", "collection", "BSON", "index", "NoSQL", "schema"],
related: ["sql-vs-nosql", "postgresql", "redis", "prisma-and-orms", "databases-for-ai-apps"],
sections: [
["What it is", `**MongoDB** is a document database. A **database** holds **collections**. A collection holds **documents**, which are JSON-like values stored as BSON (a binary format with a few extra types such as dates and object ids). You insert a document and later query by fields, including nested ones. There is no fixed table of columns, though you can and should enforce a **schema validation** so a missing email is an error rather than a surprise.

It is one kind of "NoSQL", a marketing word that hides differences. [[redis|Redis]] is not MongoDB. A [[vector-databases|vector database]] is not MongoDB. The comparison that matters for most apps is with a relational database, in [[sql-vs-nosql]].`],
["Why and when it is used", `Use MongoDB when the thing you store is a document you usually read and write as a whole: a content item with varying attributes, a product catalogue entry, an event payload you do not want to normalise into twenty tables. Use it when your team already operates it and the access pattern matches.

Do not use it because a tutorial hated JOIN. Relational databases do joins well. Do not use it as a bucket of unrelated blobs with no indexes and then be surprised that queries scan. If your data is highly relational (orders, invoices, inventory counts that must not drift), [[postgresql|PostgreSQL]] will push back in ways you want.`],
["How it works", `A client sends a query document: which fields must match, which fields to return, how to sort. Indexes on those fields keep it fast. Writes are to a primary. Replica sets copy data for failover. Sharding splits a collection across machines when one set of replicas is not enough; sharding is an operations project, not a configuration checkbox you flip on a Friday.

Transactions across documents exist and are slower and younger in people's mental models than a Postgres transaction. The comfortable Mongo pattern is to embed data that changes together in one document so one write is atomic. That embedding is the design. If you normalise everything into collections and join in the application, you rebuilt SQL without the constraints.`],
["Technologies and dependencies", `A MongoDB server or a managed cluster (Atlas is the vendor's cloud), a driver, and an index plan. ODM libraries (Mongoose is common in [[nodejs|Node]]) add structure and can also hide queries. [[prisma-and-orms|Prisma]] can target Mongo with limitations. Backups and a restore drill still exist. Schema validation rules belong in version control next to the app.`],
["How to get started", `1. Run Mongo locally or in Docker. Create a database and a user that is not the admin.
2. Insert three documents that share a shape and one that does not. Query them. Notice that the odd one still stored.
3. Add schema validation that rejects the odd shape. Insert again and watch it fail.
4. Create an index on the field you filter by. Explain the query.
5. From the application, use the driver with parameters, not string-built queries.
6. Write down whether you embed or reference related data, and why.

If you cannot explain the document boundary, you are not ready to pick embedding. Draw one document as it will look in production, including the arrays that might grow without limit.`],
["Cautions and trade-offs", `Unbounded arrays inside documents (a user document with every event ever) hit size limits and performance cliffs. Split those out. Indexes you forget are full scans, same as SQL. Case-sensitive field names mean \`Email\` and \`email\` are different bugs.

Managed clusters cost money when you leave them up. A local Docker container with no volume loses data. Security defaults have improved over the years and a database exposed to the internet with no auth is still a recurring incident; bind it to a private network. Finally, "schemaless" is not a requirement. Validate. The database will happily store your mistakes forever if you do not.`],
]
},
];
