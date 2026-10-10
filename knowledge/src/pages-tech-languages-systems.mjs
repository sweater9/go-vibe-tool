const C = 'concept';
const K = 'comparison';
export const pages = [
{
slug: "go-language", title: "The Go Programming Language", kind: C, group: "Languages",
question: "What is the Go programming language?",
summary: "Go (Golang) is a small, statically typed language designed for simple concurrent services and single-binary deployments. Teams pick it for APIs, CLIs and infrastructure tools when they want fast builds and boring code.",
short: `**Go** (also called **Golang**) is a small typed language that compiles to one binary. It shines for network services and tools. It is not a scripting language and not a UI kit.`,
aliases: ["What is Golang?", "Golang", "Go language", "Go programming language", "what is the Go language", "learn Go", "when to use Go", "Go vs Rust"],
keywords: ["Go", "Golang", "goroutine", "module", "static binary", "concurrency", "net/http"],
related: ["rust", "python", "java", "docker", "csharp", "sql"],
sections: [
["What it is", `**Go**, which people also call **Golang** so search engines can find it, is a statically typed language from Google. The syntax is small on purpose. You compile to a native binary with the garbage collector included, which is why deploying a service is often "copy the file". Goroutines are cheap concurrent functions. Channels are one way they communicate. The standard library includes a solid HTTP server and client, which is why a lot of cloud tooling is written in Go.

This page says "Go language" and "Golang" so the short word "go" is not the whole identity. The language is not a drop-in for [[python|Python]] scripts, and it is not [[rust|Rust]]: Go accepts a garbage collector in exchange for simpler code.`],
["Why and when it is used", `Choose Go for network services, sidecars, CLIs, and infrastructure controllers where a static binary and predictable builds matter. Choose it when you want many I/O-bound tasks in one process without a heavy framework. Kubernetes and Docker's ecosystems are full of Go, so examples are easy to find.

Do not choose it for a browser UI, a notebook-heavy data exploration, or a team that needs the last 5% of CPU and memory control (Rust or a tuned JVM may fit better). Do not choose it because generics were missing and you heard it was "too simple"; modern Go has generics, and the simplicity is still the point. A Python team with one API and no operational pain should not rewrite into Go for sport.`],
["How it works", `\`go build\` produces a binary. Modules (\`go.mod\`) declare dependencies and versions; the toolchain downloads them. There is no separate virtual environment. Formatting is \`gofmt\`, and you do not argue about it. Errors are values returned alongside results, not exceptions you throw. That style is verbose and explicit. \`context.Context\` carries deadlines and cancellation through API calls; ignoring it is how goroutines leak.

The race detector and tests (\`go test\`) are part of the default toolchain, which is a quiet advantage. Interfaces are satisfied implicitly: if a type has the methods, it fits. That makes small interfaces natural and giant ones a design smell.`],
["Technologies and dependencies", `The official Go toolchain, a module-aware project, and usually nothing else to start. For HTTP services the standard library is enough until you measure a need for a router. Database drivers talk to [[sql|SQL]]. [[docker|Containers]] often use a multi-stage build so the runtime image does not contain the compiler. [[environment-variables|Environment variables]] configure the binary. You do not need a JVM or a system Python on the server.`],
["How to get started", `1. Install Go from the official distribution and check \`go version\`.
2. Create a module: \`go mod init example.com/you/app\`.
3. Write a program that serves \`GET /health\` and reads a port from the environment.
4. Run \`go test\` with one table-driven test of a pure function.
5. Run \`gofmt\` (or \`go fmt\`) before you commit.
6. Build with \`go build\` and run the binary on a clean folder so you know it is not secretly using your source tree.

Keep \`go.sum\` in version control. Vendoring is optional and usually unnecessary. If a tutorial tells you to ignore errors with \`_\`, it is teaching you a demo, not a service.`],
["Cautions and trade-offs", `Goroutines are easy to start and easy to leak. Every goroutine needs a way to finish, usually a context cancel. Sharing memory without a lock or a channel will race; run the race detector in CI. The standard library's JSON handling is strict about exported fields (capital letters). Unexported fields silently disappear from JSON and confuse newcomers.

Error wrapping (\`fmt.Errorf\` with \`%w\`) matters once you have layers. A single \`err.Error()\` string compared in an \`if\` is brittle. Go will not stop you from building a distributed system badly. It only makes the process model simple. And resist a framework that hides \`net/http\` until you have a real cross-cutting need. The language's advantage is that you can still see the server.`],
]
},
{
slug: "rust", title: "Rust", kind: C, group: "Languages",
question: "What is Rust and when is it worth the learning cost?",
summary: "Rust is a systems language with ownership and borrowing instead of a garbage collector. It prevents many memory bugs at compile time. Teams use it for performance-critical tools, WASM, and services where correctness matters more than a short compile.",
short: `**Rust** is a systems language that enforces memory safety at compile time through **ownership**. Use it when C-like control is worth a stricter compiler. For ordinary CRUD APIs, [[go-language|Go]], [[java|Java]] or [[python|Python]] are often enough.`,
aliases: ["What is Rust?", "Rust language", "Rust programming", "learn Rust", "ownership borrowing", "Rust vs Go", "when to use Rust"],
keywords: ["Rust", "ownership", "borrow checker", "cargo", "memory safety", "WASM", "crate"],
related: ["go-language", "python", "java", "docker", "typescript"],
sections: [
["What it is", `**Rust** is a statically typed systems language. Its distinctive idea is **ownership**: each value has an owner, and the compiler tracks who may read or change it. When the owner goes out of scope, the value is freed. There is no garbage collector in the usual runtime, and there is no manual \`free\` in safe code. The **borrow checker** rejects programs that would use memory after it was freed or change it through two writers at once. The cost is compile errors that feel personal until the model clicks.

Rust is used for CLI tools, browsers' components, embedded work, WebAssembly, and some network services. It is not a scripting language. Cargo is the build tool and package manager; a library is a **crate**.`],
["Why and when it is used", `Choose Rust when memory safety bugs are unacceptable and a garbage collector is the wrong trade (a library other languages will embed, a tight loop, a parser that must not surprise you). Choose it when you want one toolchain that can target native code and WASM. Choose it for a new component beside a slower language: a Python service can call a Rust extension for the hot part.

Do not choose Rust for a CRUD form, a one-off script, or a team that needs to ship a simple API this month and has never seen the borrow checker. [[go-language|Go]] or [[java|Java]] will get you there with less ritual. Rewriting a working service in Rust "for performance" without a profile is a hobby, not a plan.`],
["How it works", `You declare ownership by how you pass values. A move transfers ownership. A borrow (\`&T\` or \`&mut T\`) lends it. Lifetimes describe how long a borrow lasts; the compiler often infers them. \`Result\` and \`Option\` replace exceptions and null for ordinary failures. You handle them or propagate them with \`?\`. Unsafe blocks exist for code the compiler cannot prove, and they are a small, reviewed surface, not the default style.

Cargo downloads crates, runs tests, and builds release binaries with optimisations. Compile times are the tax. Incremental builds help; clean release builds of large projects do not feel like Go. The reward is a class of bugs that do not survive until production.`],
["Technologies and dependencies", `\`rustup\` installs the toolchain so you can pin a stable version. Cargo and crates.io supply libraries. For HTTP, the ecosystem has mature async runtimes (Tokio is the common one) and web frameworks on top. Async Rust is a second learning curve; do not start there. [[docker|Containers]] need a build image with the toolchain and a slim runtime image. You rarely need a system-wide runtime the way Python does.`],
["How to get started", `1. Install rustup and the stable toolchain. \`cargo new\` a binary project.
2. Write a function that reads a file into a \`String\` and returns \`Result\`. Propagate errors with \`?\`. Do not unwrap everything.
3. Intentionally keep a reference to a local and read the compiler error until it makes sense. That error is the lesson.
4. Add a unit test. \`cargo test\`.
5. Only after that, look at a web framework or WASM. Add Tokio when you have a concurrent I/O problem, not before.
6. Use \`clippy\` once the program is real. Fix the warnings you understand; do not silence the linter on day one.

The book *The Rust Programming Language* is the standard free text. Random snippets that \`unwrap\` in production style will teach you to crash.`],
["Cautions and trade-offs", `The learning curve is the main cost. Teams that adopt Rust for everything write less product while they fight the compiler. Adopt it at a boundary. Async, macros and lifetime-heavy libraries stack the difficulty. Prefer boring, owned data (\`String\`, \`Vec\`) until you must optimise.

Unsafe and \`unwrap\` on library errors are how Rust programs still crash. Treat \`unwrap\` in a server as a bug unless the invariant is local and obvious. Supply-chain risk is the same as any crate ecosystem: review what you add. Compile times can hurt CI if you structure the crate graph badly. And do not sell Rust as "faster than Go" in the abstract. It can be, when the problem is CPU and allocations. Many services are limited by a database, and the database does not care which language waited on it.`],
]
},
{
slug: "sql", title: "SQL", kind: C, group: "Data",
question: "What is SQL and how do I use it well?",
summary: "SQL is the language of relational databases: you declare tables and ask questions with SELECT, JOIN, and WHERE. ORMs can generate SQL, but you still need to read it to understand performance and correctness.",
short: `**SQL** is how you query relational databases such as [[postgresql|PostgreSQL]], [[mysql|MySQL]] and [[sqlite|SQLite]]. Learn SELECT, JOIN and indexes before you trust an ORM like [[prisma-and-orms|Prisma]] to hide them.`,
aliases: ["What is SQL?", "SQL language", "learn SQL", "structured query language", "SELECT JOIN", "how does SQL work", "SQL basics"],
keywords: ["SQL", "SELECT", "JOIN", "index", "transaction", "relational", "query"],
related: ["postgresql", "mysql", "sqlite", "prisma-and-orms", "sql-vs-nosql", "databases-for-ai-apps"],
sections: [
["What it is", `**SQL** (Structured Query Language) is the standard language for relational databases. You define tables with columns and types, insert rows, and ask questions. A **SELECT** names the columns you want, the tables they come from, and the conditions. A **JOIN** combines rows from two tables using a key, such as a user id. **WHERE** filters. **GROUP BY** aggregates. **INSERT**, **UPDATE** and **DELETE** change data. The database, not your for-loop, is supposed to do the filtering.

SQL is a language, not a product. [[postgresql|PostgreSQL]], [[mysql|MySQL]] and [[sqlite|SQLite]] all speak SQL with dialects that differ in types, functions and autoincrement. [[sql-vs-nosql]] covers when a relational model is the wrong tool. This page is the language you will still need on the days the model is right.`],
["Why and when it is used", `Use SQL whenever the data has relationships and you want constraints: a user has many orders, an order has a total, a foreign key must exist. Reporting, billing, and application state fit. You also use SQL inside AI products more than tutorials admit: chat history, users, and document metadata belong in tables even if embeddings live in a vector index.

Do not pull an entire table into Python to filter it. Do not build a join in application memory that the database can do with an index. Do use a non-SQL store when the data is a document you always load whole, a cache, or a vector neighbourhood. Even then, the system of record is often still SQL.`],
["How it works", `The database parses your statement, plans how to run it, and executes that plan. An **index** is a structure that lets it find matching rows without reading every row. Without an index, a filter on a large table becomes a sequential scan. **Transactions** group statements so they all commit or all roll back. Isolation levels decide what concurrent transactions can see. You do not need to memorise every level on day one; you do need to know that two requests can update the same row and that a transaction is how you keep an account balance honest.

**NULL** means unknown, and it does not equal NULL. Predicates with NULL surprise everyone once. Parameters (\`$1\`, \`?\`) are how you pass user input. Concatenating a user's string into SQL is SQL injection.`],
["Technologies and dependencies", `A database engine, a client (\`psql\`, a GUI, or a driver in your language), and a schema you wrote down. [[prisma-and-orms|ORMs]] generate SQL and migrations. [[postgresql-for-ai-apps]] shows Postgres beside an AI app. Permissions in the database (a user that cannot drop tables) are part of the design. Migrations belong in version control next to the code that expects the new column.`],
["How to get started", `1. Install SQLite or Postgres locally. Create two tables: \`users\` and \`orders\` with a foreign key.
2. Insert a few rows by hand. Select them. Join them. Filter by a user.
3. Add an index on the column you filter and look at the plan (\`EXPLAIN\`). You are not optimising yet; you are seeing that a plan exists.
4. Run two updates in a transaction and roll it back. Confirm the data did not change.
5. From your application, issue the same join with parameters, not string concatenation.
6. When an ORM enters the project, print the SQL it generated for the one query you already understand.

If you cannot write the join by hand, you cannot review the ORM. Spend the afternoon on SQL before you spend a week on the ORM's API.`],
["Cautions and trade-offs", `SELECT * in application code breaks when a column is added and a mapper shifts. Name columns. Unbounded queries without LIMIT will eventually hurt. N+1 queries (one query for the parent, one per child) are the ORM classic; a join or a batched IN list fixes them.

Migrations that lock a big table can take the product down. Learn what your engine locks. Dialects differ: do not paste MySQL tutorials into Postgres and assume types match. Finally, SQL will not model every problem. Hierarchies, graphs and full-text search can be done and can also be the moment to add a specialised tool. Use SQL for the relationships it is good at, and be explicit when you step outside it.`],
]
},
{
slug: "html-and-css", title: "HTML and CSS", kind: C, group: "Web",
question: "What are HTML and CSS?",
summary: "HTML is the structure of a web page. CSS is how that structure looks. JavaScript changes behaviour. You need the first two even when a framework such as React writes them for you.",
short: `**HTML** marks up content. **CSS** lays it out and styles it. [[javascript|JavaScript]] adds behaviour. Frameworks such as [[react|React]] still produce HTML and CSS; they do not replace them.`,
aliases: ["What is HTML?", "What is CSS?", "HTML and CSS", "learn HTML", "learn CSS", "HTML vs CSS", "semantic HTML", "CSS layout"],
keywords: ["HTML", "CSS", "semantic", "flexbox", "accessibility", "DOM", "browser"],
related: ["javascript", "react", "frontend-and-backend", "nextjs", "websockets"],
sections: [
["What it is", `**HTML** (HyperText Markup Language) describes the structure of a document: headings, paragraphs, links, forms, buttons, images. The browser parses tags into the DOM, a tree scripts can change. **CSS** (Cascading Style Sheets) describes presentation: colour, type, spacing, and layout. You attach styles with selectors that match elements. The cascade decides which rule wins when several match. **JavaScript** is a third layer, behaviour, covered on its own page.

Frameworks do not make this obsolete. [[react|React]] components render HTML. CSS modules, Tailwind, or plain stylesheets are still CSS. If you cannot read the elements panel in a browser, you cannot debug a layout, no matter which framework emitted it.`],
["Why and when it is used", `Every web UI ends as HTML and CSS in a browser, including AI chat panels and admin tools. Use semantic HTML (a \`button\` for a button, a \`label\` for an input, headings in order) because accessibility tools and keyboard users depend on it. Use CSS for layout rather than nested tables or JavaScript measuring pixels.

You do not need to memorize every property. You do need the box model, normal flow, and one layout method (flexbox is enough to start; grid when the page is two-dimensional). Skip pixel-perfect recreations of a native app until the document is solid. A page that works without your fancy font is a page that works.`],
["How it works", `The browser downloads HTML, builds the DOM, applies CSS to produce a layout tree, and paints. Later changes from JavaScript cause style and layout recalculation. Expensive style changes in a loop make a page jank. The **box model** means every element is content plus padding, border and margin. \`box-sizing: border-box\` makes width include padding, which is what most people expect. Specificity decides which rule wins: an id beats a class, a class beats an element, and inline styles beat almost everything. \`!important\` is a trap you use when you already lost.

Media queries adapt layout to the viewport. A form submits with a real \`form\` and \`button\` even if JavaScript later intercepts it. If the script fails, the HTML should still make sense.`],
["Technologies and dependencies", `A browser and a text editor are enough to start. [[javascript|JavaScript]] comes next for behaviour. [[react|React]] or [[nextjs|Next.js]] are optional frameworks. Devtools in the browser are the main instrument: inspect an element, see which rule won, toggle a property. Accessibility is not a library. It is headings, labels, contrast, and focus states. A reset or a small set of base styles is fine; a 200-kilobyte CSS framework you do not understand is a delay.`],
["How to get started", `1. Write \`index.html\` with a heading, a paragraph, a link and a form with a labelled input and a submit button. Open it in a browser. Do not install a bundler.
2. Add a stylesheet. Use flexbox to put the form in a column with a gap. Resize the window.
3. In devtools, change a colour and a margin live. Then copy the change back to the file.
4. Add a focus style so keyboard users can see where they are. Tab through the form.
5. Only then add JavaScript, or a framework, to enhance the form.
6. Check contrast and that the button is a \`button\`, not a clickable \`div\`.

If a tutorial's first step is a CLI that scaffolds fifty files, do this page's step 1 anyway. You need to see the document the browser sees.`],
["Cautions and trade-offs", `Div soup (everything is a \`div\` with a click handler) breaks accessibility and search. Absolute positioning everything breaks when text wraps or the language is longer than English. Fixed pixel layouts break on phones. \`z-index\` wars mean the stacking context was never designed.

CSS-in-JS and utility frameworks are fine when the team agrees. They are not an excuse to ship unused styles or to ignore the cascade. Animating layout properties (\`width\`, \`top\`) is slower than animating transform and opacity. And do not hide critical content behind a script that fetches it if the content could have been HTML. The document is the product. The script should improve it, not be the only way it exists.`],
]
},
];
