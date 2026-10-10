const C = 'concept';
const K = 'comparison';
export const pages = [
{
slug: "python", title: "Python", kind: C, group: "Languages",
question: "What is Python and when should I use it?",
summary: "Python is a readable general-purpose language with a huge library ecosystem. It dominates data work, scripting and many AI prototypes, and it is a solid choice for backends when raw latency is not the main constraint.",
short: `**Python** is a general-purpose language favoured for scripts, data and AI glue. Use it to automate, to call [[model-apis|model APIs]], and to build services. For AI-specific call patterns see [[python-for-ai]].`,
aliases: ["What is Python?", "Python language", "Python programming", "learn Python", "when to use Python", "Python for beginners", "PY programming language"],
keywords: ["Python", "pip", "venv", "interpreter", "scripting", "typing", "package"],
related: ["python-for-ai", "calling-ai-apis-with-python", "javascript", "typescript", "go-language", "package-managers", "environment-variables"],
sections: [
["What it is", `**Python** is a dynamically typed programming language whose code is meant to be read. Indentation defines blocks. You run a program with the \`python\` interpreter, either as a script or inside a REPL. The standard library covers files, JSON, HTTP dates, subprocesses and more, which is why Python is a default language for automation. Third-party packages install with **pip** into an environment so one project does not break another.

Python is not only a data-science language, even though that reputation is earned. It is also a scripting language, a backend language (Django, FastAPI, Flask) and the most common teaching language. It is not JavaScript, which runs in browsers, and it is not a faster systems language like [[go-language|Go]] or [[rust|Rust]]. For calling models specifically, [[python-for-ai]] is the narrower guide; this page is the language itself.`],
["Why and when it is used", `Choose Python when the bottleneck is developer time, when you need libraries for data, ML or admin APIs, or when the team already thinks in Python. A CLI that renames files, a FastAPI service that wraps a database, and a notebook that checks a dataset are all natural. Choose something else when you need predictable low latency in a tiny process, a browser UI (use [[javascript|JavaScript]]), or a single static binary you can drop on a server with no runtime (Go often wins that argument).

Python is a fine language for production if you pin dependencies, test, and run it like any other service. The failure mode is a laptop full of global packages and a server that cannot reproduce them.`],
["How it works", `CPython, the usual interpreter, compiles a file to bytecode and executes it. Types are checked at run time unless you add type hints and a checker such as mypy or pyright. Those hints do not make it a compiled language; they catch mistakes before you run. A **virtual environment** (\`venv\`) gives the project its own site-packages. A lockfile (pip-tools, Poetry, uv, or PDM) records exact versions. Imports look on \`sys.path\`. The famous "it works on my machine" bug is usually an import path or a missing environment, not a mystery in the syntax.

Concurrency: threads help with network waits because of the I/O model, but CPU-bound Python threads are limited by the GIL in CPython. Processes, native extensions, or another language cover heavy CPU. Async (\`asyncio\`) is the right tool for many concurrent HTTP calls, including several model requests, and a footgun if you mix it with blocking libraries.`],
["Technologies and dependencies", `You need a Python version your team agrees on (a current 3.x, not an ancient system Python). pip or uv installs packages from PyPI. Virtual environments are mandatory on any shared machine. Web work adds a framework and an ASGI/WSGI server. Data work adds libraries that may ship native wheels; if a wheel does not exist for your platform, installation tries to compile and fails without a compiler. [[environment-variables|Environment variables]] hold configuration. Tests usually use pytest. Formatting and linting (ruff is a common fast choice) keep reviews on the logic.`],
["How to get started", `1. Install a current Python from python.org or your OS package manager, not a random copy inside an IDE you cannot find later.
2. In a project folder run \`python -m venv .venv\` and activate it. \`python -m pip install --upgrade pip\`.
3. Write \`hello.py\` that reads a path from the command line and prints the line count. Run it with \`python hello.py\`.
4. Add a \`requirements.txt\` or a lockfile the first time you install anything. Commit that file, not \`.venv\`.
5. Put secrets in the environment, never in the script.
6. When the script becomes a service, pick one framework and one process model. Do not import Flask, FastAPI and Django "just in case".

If \`python\` on your PATH is version 2 or an OS-owned 3.6, fix PATH before you install packages into it. Breaking the system Python breaks the OS tools that use it.`],
["Cautions and trade-offs", `Dynamic typing plus a large function is how None sneaks through. Add types on boundaries (API payloads, database rows) even if the middle stays loose. Mutable default arguments (\`def f(items=[])\`) are a classic bug. Bare \`except:\` hides failures.

Package trust matters. Typosquatting on PyPI is real; read the name you install. Pin versions for anything you deploy. Notebooks are not production entry points; export the logic into a module you can test. And do not treat Python's speed myths as either "always too slow" or "fast enough for everything". Measure the one hot loop. Often the fix is a better query or a batch API, not a rewrite in Rust.`],
]
},
{
slug: "javascript", title: "JavaScript", kind: C, group: "Languages",
question: "What is JavaScript?",
summary: "JavaScript is the language of web browsers and, with Node.js, a server language too. It is dynamically typed, event-driven, and the base that TypeScript compiles to. JS is the everyday abbreviation.",
short: `**JavaScript (JS)** runs in the browser and on the server with [[nodejs|Node.js]]. Use [[typescript|TypeScript]] when you want types. AI-specific UI notes live in [[javascript-for-ai]]; this page is the language.`,
aliases: ["What is JavaScript?", "JavaScript language", "JS", "Javascript", "ECMAScript", "learn JavaScript", "what is JS", "JS programming"],
keywords: ["JavaScript", "JS", "browser", "DOM", "Node", "event loop", "npm", "ECMAScript"],
related: ["typescript", "nodejs", "react", "html-and-css", "python", "package-managers", "javascript-for-ai"],
sections: [
["What it is", `**JavaScript**, abbreviated **JS**, is the programming language browsers run. A page can use it to react to clicks, change the DOM (the document tree), and call HTTP APIs. The language is also used on servers and in tools via [[nodejs|Node.js]], but the browser is why it exists. The standard is **ECMAScript**. People say ES6 or ES2015 for the version that added \`let\`, \`const\`, arrow functions, promises and classes; everything modern assumes at least that.

JavaScript is not Java. The names are historical marketing, not a family relationship. It is not [[typescript|TypeScript]] either. TypeScript is a typed layer that compiles or strips down to JavaScript. If you are building an AI feature in the browser, [[javascript-for-ai]] covers the application concerns; this page is the language those apps are written in.`],
["Why and when it is used", `Use JavaScript when the code must run in a browser: interfaces, design tools, offline-capable pages. Use it on the server with Node when the team wants one language on both sides, or when the workload is I/O (APIs, streams, websockets). Use TypeScript instead of plain JS for anything you must maintain, which is most application code. Plain JS is still right for a tiny script, a bookmarklet, or learning the actual runtime behaviour without a compiler in the way.

Do not use JavaScript to do heavy numeric work in the browser if a server or a specialised library should own it. Do not sprinkle jQuery-era patterns into a new React codebase out of nostalgia.`],
["How it works", `JavaScript is single-threaded in the usual browser and Node model. An **event loop** runs your code, then runs callbacks and promise reactions when I/O completes. That is why a long \`for\` loop freezes a page: nothing else can paint until it finishes. **Promises** and \`async\`/\`await\` are how you wait for a network call without blocking the loop incorrectly. \`await\` still occupies the function; it does not make the CPU parallel.

Values have types; variables do not, until you add TypeScript. Objects are bags of properties. Arrays are objects. Equality is a trap: \`==\` coerces types, \`===\` does not. \`this\` depends on how a function is called. Modules (\`import\`/\`export\`) are the modern structure; older scripts used globals. In the browser, modules need a server or a bundler context, not always \`file://\`. [[package-managers|npm]] installs libraries into \`node_modules\`.`],
["Technologies and dependencies", `A browser, or Node, and a package manager. For UI, [[html-and-css|HTML and CSS]] are the other two legs. [[react|React]] is a library on top of JS, not a separate language. A bundler (Vite is a common default now) turns modules into files the browser can cache. ESLint catches footguns. The DOM and \`fetch\` are web platform APIs, not part of the language core, which is why the same JS on Node needs a fetch polyfill only on older versions and has no \`document\`.`],
["How to get started", `1. In a browser devtools console, type small expressions: strings, arrays, \`map\`, a function. You are learning the language, not a framework.
2. Make a folder with \`index.html\` that loads \`main.js\` as a module. Handle one button click and update one element.
3. Add \`fetch\` to a public test API and render the JSON. Watch the network panel.
4. Initialise npm and install nothing until you need it.
5. When the file grows past a screen, move to [[typescript|TypeScript]] or be very disciplined with JSDoc. Do not wait until the bugs are mysterious.
6. Read an error stack from top to bottom. The first line in your file is the one to fix.

Avoid tutorials that start by installing five tools before you have seen a variable. The language is the part that transfers.`],
["Cautions and trade-offs", `Implicit globals, forgotten \`await\`, and mutating objects you passed to another function cause most early bugs. \`null\` and \`undefined\` are both "empty" and not the same. Numbers are IEEE floats; money should not be a casual \`0.1 + 0.2\`.

Dependency trees are deep. Commit the lockfile and audit what a package's install script can do. Client-side JS is visible to the user; never put a secret in it. Framework churn is real, but it is not an excuse to ignore the language. When a React bug confuses you, reproduce the logic in a plain function. If it fails there, it was never React.`],
]
},
{
slug: "typescript", title: "TypeScript", kind: C, group: "Languages",
question: "What is TypeScript?",
summary: "TypeScript (TS) is JavaScript with a static type system. It compiles to plain JavaScript, catches a class of bugs in the editor, and is the default for SPFx, large React apps and many Node services.",
short: `**TypeScript (TS)** is typed **JavaScript**. The compiler erases types and emits JS that [[nodejs|Node]] or the browser runs. SPFx projects are TypeScript-first; see [[sharepoint-framework]]. Application-level AI notes are in [[typescript-for-ai]].`,
aliases: ["What is TypeScript?", "TypeScript language", "TS", "Typescript", "TS programming", "what is TS", "TypeScript vs JavaScript", "learn TypeScript"],
keywords: ["TypeScript", "TS", "types", "compiler", "interface", "generic", "JavaScript", "strict"],
related: ["javascript", "nodejs", "react", "sharepoint-framework", "typescript-for-ai", "typescript-api-client-types", "python"],
sections: [
["What it is", `**TypeScript**, abbreviated **TS**, is a language from Microsoft that adds static types to [[javascript|JavaScript]]. You write \`.ts\` or \`.tsx\` files. The compiler, \`tsc\`, checks types and emits ordinary JavaScript. Browsers and [[nodejs|Node.js]] never run TypeScript itself. They run the emitted JS, or a tool such as Vite strips the types while bundling. If the types are wrong and you force the compile, the JS can still be wrong. Types are a check, not a sandbox.

This is the language behind [[sharepoint-framework|SPFx]] projects and behind most serious [[react|React]] codebases. [[typescript-for-ai]] talks about using it in AI applications. [[typescript-api-client-types]] shows how to type an API client. This page is the language decision itself.`],
["Why and when it is used", `Use TypeScript when more than one person will touch the code, when the data has a shape (API responses, SPFx props, database rows), or when you want the editor to tell you that you renamed a field in only one place. The cost is a compile step and the discipline to not silence errors with \`any\`.

Plain JavaScript is enough for a tiny script. A gradual migration (allow JS files, add types at the edges) is often better than a big-bang rewrite. Do not adopt TypeScript and then turn \`strict\` off and cast everything to \`any\`. You paid the complexity and declined the benefit.`],
["How it works", `Types describe values: \`string\`, \`number\`, objects, unions (\`string | null\`), and generics that abstract over a type. The compiler uses **structural typing**: if two types have the same fields, they are compatible, even if their names differ. \`interface\` and \`type\` are both ways to name a shape. Strict null checks force you to handle \`undefined\` before you read a property. That one setting removes a whole class of production crashes.

At the boundary with the outside world (JSON from \`fetch\`, form input), the type system believes whatever you assert unless you parse. A type assertion (\`as User\`) is you telling the compiler to trust you. It is not validation. Pair it with a runtime check ([[json-validation]]) for data that crosses a process. Configuring \`tsconfig.json\` (\`strict\`, target, module) is part of the program, not paperwork.`],
["Technologies and dependencies", `Node or another JS runtime to execute output, the \`typescript\` package, and usually a bundler that understands TS. ESLint with the type-aware rules is worth it. Frameworks ship their own types (\`@types/...\` when the library is plain JS). SPFx pins a TypeScript version; forcing a newer compiler because a blog said so breaks the scaffold. [[package-managers|npm]] installs all of this. Your tests run the JS behaviour; they do not replace the typecheck. Run both in CI.`],
["How to get started", `1. Install Node, then \`npm install typescript\` in a project, not a global compiler you forget about.
2. Run \`npx tsc --init\` and turn \`strict\` on before you have a thousand files.
3. Type a function that takes a user object and returns a display name. Intentionally pass a number and read the error.
4. Fetch JSON and write a function \`parseUser(data: unknown): User\` that checks the fields. Feel the difference between \`unknown\` and \`any\`.
5. Add the typecheck to the same command you already run before commit.
6. When a third-party type is wrong, patch it locally with a declaration merge or a thin wrapper. Do not \`any\` the entire module.

Read error messages from the first line. TypeScript errors pile up; the first mismatch is usually the real one.`],
["Cautions and trade-offs", `Types drift from runtime. A renamed API field will not throw at compile time if you typed the response by hand and then used a cast. Generate types from a schema or validate at runtime. \`any\` is contagious: one \`any\` parameter turns the return type into a shrug. \`enum\` compiles to real JS objects and surprises people who expected erasure; unions of string literals are often simpler.

Compile times grow with project size. Project references help later; they are not day-one work. SPFx and other scaffolds choose compiler versions for you; respect that. Finally, TypeScript will not design your module boundaries. A single \`types.ts\` of 2,000 lines is a design problem the compiler is happy to check forever.`],
]
},
{
slug: "java", title: "Java", kind: C, group: "Languages",
question: "What is Java and when is it the right language?",
summary: "Java is a statically typed, object-oriented language that runs on the JVM. Enterprises use it for long-lived services, Android's older stacks, and anywhere a stable toolchain and explicit types matter more than a short script.",
short: `**Java** is a typed language on the **JVM**, common for large services and existing enterprise systems. It is not JavaScript. Reach for it when the organisation already runs the JVM; do not rewrite a small script into Java for fashion.`,
aliases: ["What is Java?", "Java language", "Java programming", "JVM language", "learn Java", "Java vs JavaScript", "when to use Java"],
keywords: ["Java", "JVM", "JDK", "Maven", "Gradle", "Spring", "static types", "bytecode"],
related: ["javascript", "csharp", "go-language", "python", "sql", "docker"],
sections: [
["What it is", `**Java** is a statically typed, class-based language from the 1990s that still runs a large share of business backends. You compile \`.java\` source to bytecode, and a **JVM** (Java Virtual Machine) runs that bytecode. The promise was portability: the same artifact on any system with a JVM. Modern Java (current long-term releases) has improved the language a lot: records, pattern matching, better collections, a module system you may never need, and a garbage collector you mostly leave alone.

Java is not [[javascript|JavaScript]]. It is not a scripting language you edit and rerun in one keystroke, though the feedback loop is much shorter than it was twenty years ago. Kotlin and Scala also run on the JVM and interoperate with Java libraries. This page stays with Java itself.`],
["Why and when it is used", `Choose Java when you are extending a system already written in it, when you need the JVM's operations story (mature profilers, well-known deployment), or when a large team wants explicit types and a culture of interfaces. Spring Boot is the usual way teams stand up an HTTP service. Android's traditional app model was Java; Kotlin is now the default for new Android UI, but Java knowledge still transfers.

Do not choose Java for a five-line file rename, a browser UI, or a one-off data plot. [[python|Python]] or a shell will finish first. Do not start a new small service in Java only because a job advert mentioned it, if your team ships faster in Go or C#. Do choose it deliberately when hiring, libraries (banking, enterprise SSO, older SOAP) and existing services are already JVM-shaped.`],
["How it works", `You install a **JDK** (compiler and libraries), not only a JRE. Source lives in packages that match folders. \`javac\` or, more realistically, Maven or Gradle compiles. The entry point is a \`main\` method. Types are declared. Null is still a problem; newer type systems and annotations help but do not remove it. Memory is garbage-collected. Threads are the classic concurrency tool; virtual threads in new JDKs make "a thread per request" less frightening.

Build tools download dependencies from Maven Central into a local cache. A **fat jar** or a container image is what you deploy. The app boots, opens a port, and talks to a database with JDBC or an ORM such as Hibernate. [[sql|SQL]] still matters; the ORM does not replace knowing what query ran.`],
["Technologies and dependencies", `A current LTS JDK your platform team agrees on, Maven or Gradle, and usually Spring Boot for HTTP. JUnit runs tests. [[docker|Docker]] is the normal way to ship a known JDK. Logging (SLF4J with a backend) is not optional in a service. [[environment-variables|Environment variables]] or a config server supply settings. If you call [[model-apis|model APIs]], an HTTP client and a JSON library (Jackson) are enough; you do not need a special JVM to do that.`],
["How to get started", `1. Install an LTS JDK and \`java -version\` to confirm it is the one you think.
2. Generate a Maven or Gradle project (Spring Initializr is fine if you want HTTP immediately; a bare project is better if you are learning the language).
3. Write a class with \`main\` that parses a small JSON string and prints a field. Feel the ceremony and the type errors.
4. Add one unit test. Run it from the build tool, not from a green arrow you cannot reproduce.
5. If you start Spring, add one GET route and one configuration value from the environment.
6. Stop before you add five starters you saw in a tutorial.

Read a stack trace from the top "Caused by". Java traces are long because frameworks wrap exceptions. The cause is the point.`],
["Cautions and trade-offs", `Ceremony is real. A simple value becomes a class, a builder and a mapper if you imitate every pattern. Records and plain types are allowed. Null and checked exceptions frustrate people coming from Kotlin or Python; handle them at boundaries rather than declaring \`throws Exception\` on every method.

Old tutorials use Java 8 syntax and obsolete libraries. Check the JDK version. Classpath hell is mostly a build-tool problem now; still, two versions of the same library will waste an afternoon. Reflection-heavy frameworks hide the control flow. When a bean is "not found", the failure is configuration, not the JVM. And do not containerise a JDK image that is a gigabyte of unused GUI libraries. Use a current runtime image and a normal build.`],
]
},
{
slug: "csharp", title: "C#", kind: C, group: "Languages",
question: "What is C# and when do teams choose it?",
summary: "C# is Microsoft's typed language on .NET. Teams use it for Windows services, cross-platform web APIs, Unity games, and Azure backends. It is a strong default when the stack is already Microsoft.",
short: `**C#** (C sharp) is the main language of **.NET**. Use it for APIs, workers and Microsoft-heavy systems, including many [[azure-fundamentals|Azure]] services. It is not C or C++, and it is not required for [[sharepoint-framework|SPFx]], which is TypeScript.`,
aliases: ["What is C#?", "C# language", "C sharp", "csharp", "CSharp", ".NET language", "what is csharp", "learn C#", "C# vs Java"],
keywords: ["C#", "csharp", ".NET", "ASP.NET", "NuGet", "CLR", "Azure", "async"],
related: ["java", "typescript", "azure-fundamentals", "microsoft-entra-id", "sql", "go-language"],
sections: [
["What it is", `**C#** ("C sharp") is a statically typed language designed by Microsoft, running on **.NET**. You compile to IL (intermediate language) and the runtime executes it, historically on Windows and now cross-platform on .NET Core and its successors, just called .NET. ASP.NET Core is the web stack. NuGet is the package feed. The language feels closer to [[java|Java]] than to C or C++: garbage collection, classes, a large standard library, and a team that keeps adding features (records, pattern matching, nullable reference types, async/await).

C# is not [[sharepoint-framework|SPFx]]. SharePoint web parts are TypeScript. C# shows up in Microsoft ecosystems as APIs, background workers, desktop tools, game scripts in Unity, and older SharePoint server-side code you should not copy into a new Online tenant.`],
["Why and when it is used", `Choose C# when the team and the cloud are already Microsoft: [[azure-fundamentals|Azure]] SDKs are idiomatic in C#, identity samples assume it, and hiring in that ecosystem is straightforward. It is a good language for a long-lived API that needs types and a boring deployment. Choose it for Unity if you are making that kind of game.

A small script, a browser UI, or a Python data notebook are the wrong reasons to start a .NET solution. A team that knows Go or Node should not rewrite into C# for an Azure logo. The Azure SDK exists in other languages. Choose C# because the people and the existing code benefit, not because the portal's sample dropdown landed there.`],
["How it works", `You install an SDK, create a project (\`dotnet new\`), and edit \`.cs\` files. \`dotnet build\` compiles. \`dotnet run\` starts an app. Projects reference NuGet packages via a manifest that should be locked down in CI. Nullable reference types, when enabled, make \`null\` a compiler concern similar in spirit to TypeScript's strict nulls. \`async\`/\`await\` is the normal way to do HTTP and database I/O. LINQ is a fluent way to transform collections and, carefully, to query databases; the careful part is knowing when a LINQ expression became a giant SQL statement.

ASP.NET Core maps routes to functions, uses dependency injection, and reads configuration from [[environment-variables|environment variables]], JSON files and command-line arguments layered together. Entity Framework can map objects to [[sql|SQL]]. You should still read the SQL.`],
["Technologies and dependencies", `The .NET SDK matching your LTS choice, a code editor, and NuGet. For web APIs, ASP.NET Core. For Azure, the Azure SDK packages you actually call, plus [[microsoft-entra-id|Entra ID]] libraries if users sign in. Tests use xUnit or NUnit. [[docker|Containers]] based on the official runtime images are the usual deploy unit. You do not need Windows to build modern .NET, which surprises people who last saw the stack in 2010.`],
["How to get started", `1. Install the .NET SDK and run \`dotnet --version\`.
2. \`dotnet new console -n Sample\` and print a value parsed from JSON using the built-in serialiser.
3. Enable nullable reference types if the template did not, and fix the warnings instead of suppressing them.
4. If you need HTTP, \`dotnet new webapi\` and one endpoint that reads configuration.
5. Add a test project and one test that does not need the network.
6. Call a [[model-apis|model API]] only after the key loads from the environment and never appears in a log.

The \`dotnet\` tool is the build. Random clicks in an IDE that invoke a different SDK version are how a teammate gets "works here".`],
["Cautions and trade-offs", `Nullable warnings ignored in bulk become noise forever. Turn them on at the start. Async methods that block on \`.Result\` deadlock or starve the thread pool; await all the way up. Entity Framework will let you load half the database by accident; profile queries.

Package versions across a solution drift. Centralise them when the solution grows, not on day one. .NET version upgrades are usually smooth and still deserve a test pass. And remember the SharePoint trap: a blog that tells you to deploy a C# farm solution is describing the old server product. For Microsoft 365 sites, the supported UI extension model is SPFx, while C# remains a fine language for the separate service that SPFx calls.`],
]
},
];
