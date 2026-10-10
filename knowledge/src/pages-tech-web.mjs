const C = 'concept';
const K = 'comparison';
export const pages = [
{
slug: "react", title: "React", kind: C, group: "Web",
question: "What is React?",
summary: "React is a JavaScript library for building user interfaces out of components that render when state changes. It is the usual UI layer in SPFx and in many AI chat panels, but it is not a backend or a complete framework.",
short: `**React** builds UI as components in [[javascript|JavaScript]] or [[typescript|TypeScript]]. [[nextjs|Next.js]] adds routing and server rendering. SPFx's default UI is React; see [[sharepoint-framework]]. Chat-specific state is in [[react-chatbot-state]].`,
aliases: ["What is React?", "React.js", "ReactJS", "React library", "learn React", "React components", "does SPFx use React"],
keywords: ["React", "component", "state", "JSX", "hooks", "props", "virtual DOM"],
related: ["javascript", "typescript", "nextjs", "html-and-css", "react-ai-interfaces", "react-chatbot-state", "sharepoint-framework", "nodejs"],
sections: [
["What it is", `**React** is a library for building user interfaces, mostly in the browser. You write **components**, functions that return a description of UI (JSX, which looks like HTML inside [[javascript|JavaScript]] or [[typescript|TypeScript]]). When **state** changes, React renders again and updates the [[html-and-css|DOM]] to match. Props are inputs passed from a parent. Hooks such as \`useState\` and \`useEffect\` are how function components hold state and run side effects.

React is not a server, a router, or a data cache, though the ecosystem supplies those. [[nextjs|Next.js]] is a framework on top. [[react-ai-interfaces]] and [[react-chatbot-state]] cover AI chat UIs specifically. **Does SPFx use React?** The SharePoint generator's standard web part template does; details are in [[sharepoint-framework]]. This page is React itself, including outside Microsoft 365.`],
["Why and when it is used", `Use React when the interface has a lot of state that should stay consistent with the screen: dashboards, editors, chat transcripts, admin tools. Components force you to say what the UI is for a given state, which scales better than jQuery edits scattered across a file. Use it because hiring and examples are plentiful, when that is true for your team.

Do not use React for a static document. HTML is enough. Do not use it on the server as your database. Do not adopt it, a state library, a CSS framework and a data library on the same afternoon. A component and \`useState\` carry a surprising distance.`],
["How it works", `You declare state. An event handler calls a setter. React schedules a render, calls your component functions, diffs the result against the previous tree, and updates the DOM. The "virtual DOM" is that diffing strategy, not something you manipulate. Effects run after paint and are for synchronising with the outside world (a subscription, a manual DOM call). Fetching in an effect is common and easy to get wrong (race conditions, missing dependencies).

Data should often live in a parent or a small store and flow down as props. A global store for every field is how apps become impossible to trace. Keys on lists must be stable ids, not array indexes, if items are inserted or removed. Strict mode in development renders twice on purpose to surface impure renders.`],
["Technologies and dependencies", `[[nodejs|Node.js]] for the toolchain, React and React DOM packages, and a bundler (Vite is a sane default). JSX needs that toolchain. TypeScript is strongly recommended. Testing uses React Testing Library or a similar approach that clicks the UI rather than testing internal state. [[nextjs|Next.js]] if you need routes and server rendering. SPFx if the host is SharePoint. None of these replace [[html-and-css]].`],
["How to get started", `1. Scaffold with Vite's React TypeScript template, or a blank project you understand. Resist a meta-framework until you have rendered a list.
2. Build a component that shows a list of strings and a text field that appends one item. Lift state to the parent if a child needs to add.
3. Open React devtools and watch state change when you click.
4. Extract a child component that receives an item as a prop and does not own the list.
5. Add one \`useEffect\` that subscribes to something and cleans up. If you have no subscription, you do not need an effect.
6. Then look at [[react-chatbot-state]] if the UI is a transcript, or at Next.js if you need URLs.

Keep components pure: the same props and state should describe the same UI. Side effects belong in event handlers and carefully written effects.`],
["Cautions and trade-offs", `Stale closures in async handlers show old state. Use functional updates or a ref when that bites. Over-fetching in effects causes waterfalls. Derived values do not belong in state if you can compute them during render. \`useEffect\` is not \`componentDidMount\` you sprinkle everywhere.

React's render model confuses people who expect to "grab the div and change it". When you do touch the DOM directly, you fight React. SPFx hosts React inside a page you do not fully control; do not assume \`document.body\` is yours. Finally, React will not structure your data. A single context with fifty unrelated fields is a ball of mud the library will re-render faithfully.`],
]
},
{
slug: "nextjs", title: "Next.js", kind: C, group: "Web",
question: "What is Next.js and when should I use it?",
summary: "Next.js is a React framework that adds routing, server rendering, and server-side code next to the UI. Use it for full web apps. Use plain React when you only need a widget inside someone else's page.",
short: `**Next.js** is a framework around [[react|React]]: file-based routes, server and client components, and a place to run secrets on the server. It is a good home for an app that calls [[model-apis|model APIs]]. It is more than you need for a single SPFx web part.`,
aliases: ["What is Next.js?", "Next.js", "NextJS", "Next js", "when to use Next.js", "Next.js vs React", "Next.js app router"],
keywords: ["Next.js", "React", "app router", "server components", "routing", "Vercel", "SSR"],
related: ["react", "nodejs", "typescript", "javascript", "frontend-and-backend", "ai-sdks", "model-apis"],
sections: [
["What it is", `**Next.js** is a framework built around [[react|React]] and [[nodejs|Node.js]]. It gives you file-based routing, a production build, and a split between code that runs on the server and code that runs in the browser. The App Router model uses React Server Components: some components render only on the server, can read secrets and databases, and send the result to the client. Client components (\`"use client"\`) handle state and clicks. Route handlers are server endpoints living beside the UI.

Next.js is not React itself. You can use React without it (see [[react]]). It is also not required for [[sharepoint-framework|SPFx]]. It is one way to build a standalone web application, often deployed on Node or a host that supports its server runtime.`],
["Why and when it is used", `Choose Next.js when you are building a whole site or app: URLs, authenticated pages, a server that must hide [[api-keys|API keys]], and React on the screen. It fits an internal tool or a product UI that calls [[model-apis|model APIs]] without exposing the key. The [[ai-sdks|Vercel AI SDK]] examples assume this shape, which is convenience, not a requirement.

Choose plain React or Vite when you are shipping a widget, a design prototype, or an SPFx part. Choose a different server framework ([[express]], a Python API) when the UI is not React or the team does not want Node. Do not put a Next.js app inside a SharePoint page and also reimplement SharePoint. Decide where the product lives.`],
["How it works", `A route is a folder with a \`page\` file. The server renders it, fetching data directly if you wrote server code. Client components hydrate in the browser so clicks work. A mutation can be a server action or a call to a route handler. Environment variables that are not prefixed for the browser stay on the server. That is the feature you want for model keys. If you prefix a secret so the client bundle can see it, you published the secret.

Static rendering builds HTML ahead of time. Dynamic rendering runs per request. Pick dynamic when the page depends on the signed-in user. Caching in Next.js is powerful and has surprised teams who saw stale data. Know whether a fetch is cached before you debug "why is production wrong".`],
["Technologies and dependencies", `[[nodejs|Node.js]], React, and the Next.js package. [[typescript|TypeScript]] should be on. Deployment needs a Node-compatible host or the framework's own platform. A database or a model API is your choice. [[frontend-and-backend]] explains the split this framework is trying to make convenient. You still own auth: Next.js does not magically know your users.`],
["How to get started", `1. Create a TypeScript Next.js app with the official scaffold. Run it locally and see the default page.
2. Add a server-only route or page that reads a non-public environment variable and returns its length, not its value.
3. Add a client component with a button that calls that route and displays the answer.
4. Confirm in the browser network panel that the secret never appears in a downloaded JS file.
5. Add one real URL with a dynamic segment and load data for it on the server.
6. Turn on a production build (\`next build\`) before you celebrate. Dev mode hides issues.

Do not start by installing an authentication library, a CSS kit, an ORM and an AI SDK together. Get the server/client line bright first.`],
["Cautions and trade-offs", `The server/client boundary is the whole design. Importing a server module into a client component fails the build or, worse, leaks. Caching can serve one user's data to another if you cache a personalised fetch by accident. Treat cache keys as a security feature.

Next.js versions move. Pin them and read upgrade notes before you copy a blog that uses the old pages router and the new app router in one breath. Server components are not faster by magic if your database is slow. And a framework this large is the wrong tool for a four-file internal script. Use it when you want a product surface, and keep the domain logic in functions you can test without booting the framework.`],
]
},
{
slug: "nodejs", title: "Node.js", kind: C, group: "Web",
question: "What is Node.js?",
summary: "Node.js is a JavaScript runtime outside the browser, used for servers, tools and scripts. It is built on V8 and an event loop, and it is the usual host for Express, Next.js servers, and SPFx build tooling.",
short: `**Node.js** runs [[javascript|JavaScript]] on the server and in tools. **npm** installs packages. AI-oriented patterns are in [[nodejs-for-ai]]; this page is the runtime. SPFx's build also needs a specific Node version.`,
aliases: ["What is Node.js?", "Node.js", "NodeJS", "what is Node", "Node js runtime", "learn Node.js", "Node versus browser"],
keywords: ["Node.js", "npm", "event loop", "server", "JavaScript", "runtime", "nvm"],
related: ["javascript", "typescript", "express", "nextjs", "package-managers", "nodejs-for-ai", "streaming-ai-with-nodejs"],
sections: [
["What it is", `**Node.js** is a runtime that executes [[javascript|JavaScript]] outside a browser. It uses the V8 engine and a library called libuv to do file and network I/O on an event loop. There is no DOM and no \`window\`. There is a module system, a standard library for HTTP, files and processes, and access to [[package-managers|npm]]. People say "Node" for the runtime and "Node.js" when they want to be precise.

Node is why the same language can power a CLI, an [[express|Express]] API, a [[nextjs|Next.js]] server, and the SPFx build tools. [[nodejs-for-ai]] and [[streaming-ai-with-nodejs]] cover model calls. This page is the runtime decision and the mental model.`],
["Why and when it is used", `Use Node when the team writes JavaScript or TypeScript and needs a server or a build tool. It is a strong fit for HTTP APIs that mostly wait on databases and other APIs, which is most product backends. Use it when you want one language across a React UI and the API.

Do not use Node for heavy CPU work on the main thread; it will stall every request. Do not use it because a tutorial started there if your team is fluent in another stack and the problem is ordinary. A supported Node version is a hard requirement for [[sharepoint-framework|SPFx]] builds; "newest Node" is often wrong for that toolchain.`],
["How it works", `One process runs your script. The event loop handles callbacks and promises. Blocking the loop with a long synchronous computation blocks everyone. Native addons and worker threads exist for the rare CPU-heavy case. The module system loads files and caches them. Environment variables configure the process. A web server is a callback on a port: parse the request, do async work, write the response. If you forget to write the response, the request hangs until a timeout.

npm reads \`package.json\` and a lockfile and fills \`node_modules\`. The version of Node itself is not in that folder. Use a version manager or your platform's pinned runtime so production matches CI. [[typescript|TypeScript]] typechecks and emits JS, or a loader strips types; Node runs the JS.`],
["Technologies and dependencies", `A Node LTS release, npm (bundled with it), and your application code. [[express]] is a small HTTP layer you can add. Next.js includes its own server. Databases need a driver. Process managers or [[docker|containers]] keep it running in production. Logs go to stdout so the platform can collect them. [[environment-variables|Environment variables]] hold configuration and secrets.`],
["How to get started", `1. Install an LTS Node and run \`node -v\` and \`npm -v\`.
2. \`npm init\` a folder. Add \`"type": "module"\` if you want modern \`import\` syntax and accept that choice.
3. Write a script that reads a file and prints a line count using the \`fs\` promises API, not a sync call you copy from a gist.
4. Create an HTTP server with the standard library that returns "ok" on \`/health\`. Hit it with curl.
5. Add a dependency only when the standard library is genuinely painful. Commit the lockfile.
6. If this is for SPFx, stop and install the Node version that SPFx release documents, not the one you just used for the experiment.

Set \`engines\` in \`package.json\` to the major version you tested. A teammate on an ancient Node will get strange syntax errors otherwise.`],
["Cautions and trade-offs", `Uncaught promise rejections can crash modern Node. Handle them. \`process.env\` values are always strings or undefined; a missing variable should fail startup, not fail three requests later. Do not run Node as root in a container.

The npm ecosystem is huge and uneven. Pin versions, review install scripts for sensitive apps, and do not import a package for a one-line helper. Native modules break when you switch CPU architecture (a Mac laptop image on a Linux server). Rebuild in CI on the target platform. Finally, Node's single thread is a feature until a JSON.parse of a giant body stalls you. Limit payload sizes.`],
]
},
{
slug: "express", title: "Express", kind: C, group: "Web",
question: "What is Express.js?",
summary: "Express is a small Node.js library for HTTP servers: routes, middleware, and request and response objects. It is enough for many APIs. It does not include a database, auth, or a front end.",
short: `**Express** is a minimal [[nodejs|Node.js]] web framework: routes and middleware. Use it for a small HTTP API. Use [[nextjs|Next.js]] if the React app and the server should be one project. Put secrets in [[environment-variables|environment variables]], not in client code.`,
aliases: ["What is Express?", "Express.js", "ExpressJS", "Express framework", "learn Express", "Express middleware", "Node Express API"],
keywords: ["Express", "middleware", "route", "Node.js", "HTTP", "REST", "API"],
related: ["nodejs", "rest-apis", "javascript", "typescript", "frontend-and-backend", "api-keys", "cors"],
sections: [
["What it is", `**Express** is a widely used library for writing HTTP servers on [[nodejs|Node.js]]. You create an app, register **routes** (\`GET /health\`, \`POST /messages\`) and **middleware** (functions that run before your handler: logging, JSON parsing, auth). Handlers read \`req\` and write \`res\`. Express does not dictate your database, your file layout, or your front end. That smallness is the feature.

It is not [[nextjs|Next.js]], which is a React framework with opinions about rendering. It is not a Microsoft product. It is one of several Node HTTP libraries; it remains the one most examples still use. For REST habits that are larger than Express, see [[rest-apis]].`],
["Why and when it is used", `Use Express when you need a JSON API in Node and you want to see every layer. A backend for a [[react|React]] app, a webhook receiver, or a proxy that adds an [[api-keys|API key]] the browser must not hold are typical. Use it to learn HTTP before you adopt a bigger framework.

Prefer Next.js when you want React routes and server components in one system. Prefer Fastify or the plain \`node:http\` module if you have a reason (performance measurements, fewer dependencies). Do not use Express to serve a giant single-page app with a custom router you invented beside it. Let the front-end host or a simple static file server do that, and keep Express for the API if that split is clearer.`],
["How it works", `A request enters the middleware stack in order. Each function can end the response or call \`next()\`. Order matters: JSON body parsing must run before a handler reads \`req.body\`. A mistake is to register an async handler that throws, and to forget an error middleware. Express does not catch rejected promises unless you wrap them or use a version and pattern that does. Unhandled async errors become hung requests or crashes.

Routers group paths. \`express.static\` serves files; be careful not to serve your repo. Mounting a router at a prefix (\`/api\`) keeps the API separate from anything else. [[cors|CORS]] middleware is how a browser app on another origin is allowed to call you. It is not authentication.`],
["Technologies and dependencies", `Node, the \`express\` package, and usually a JSON parser that now ships with Express. [[typescript|TypeScript]] types (\`@types/express\`) if you are typed. A process manager or container to run it. [[environment-variables]] for the port and secrets. A reverse proxy (or the platform's router) terminates TLS in production. Your database driver is separate. [[frontend-and-backend]] describes this split.`],
["How to get started", `1. Create a Node project and install Express. Add a \`GET /health\` that returns JSON.
2. Add \`express.json()\` and a \`POST\` that validates a field and returns 400 if it is missing. Do not trust \`req.body\`.
3. Add an error-handling middleware with four arguments and a wrapper so async throws reach it. Test by throwing on purpose.
4. Read the port from the environment. Start the server and hit it with curl, not only a browser.
5. If a browser on another port will call it, add CORS for that origin only, not \`*\` with credentials.
6. Put authentication in middleware that runs before the route, not copied into every handler.

Log the method, path and status. Do not log bodies that contain secrets or personal data.`],
["Cautions and trade-offs", `Express is unopinionated, so every codebase invents a different folder layout. Pick one and stop. The ecosystem of middleware is old; some packages are unmaintained. Read what a middleware does before you put it in front of every request.

\`req.body\` is not validated because it parsed as JSON. Validate shape ([[json-validation]]). Path parameters are strings. A catch-all error handler that returns stack traces to clients leaks internals. And Express will not scale a blocking \`fs.readFileSync\` inside a handler. Keep the loop free, and keep the process stateless so a second instance can run beside it.`],
]
},
{
slug: "frontend-and-backend", title: "Frontend and Backend", kind: C, group: "Web",
question: "What is the difference between frontend and backend?",
summary: "The frontend is the interface running on the user's device. The backend is the server you control: data, secrets, and business rules. Browsers are not a safe place for secrets, which is why AI keys and database passwords stay on the backend.",
short: `The **frontend** is what runs on the user's device (HTML, CSS, [[react|React]]). The **backend** is your server ([[nodejs|Node]], [[python|Python]], a database). Keep [[api-keys|API keys]] and trust decisions on the backend.`,
aliases: ["frontend vs backend", "front end vs back end", "what is a backend", "what is a frontend", "client vs server", "frontend and backend architecture", "where should API keys live"],
keywords: ["frontend", "backend", "client", "server", "API", "secret", "architecture"],
related: ["react", "nodejs", "express", "rest-apis", "api-keys", "html-and-css", "nextjs"],
sections: [
["What it is", `The **frontend** is the part of a product the user touches. In a web app that means [[html-and-css|HTML and CSS]] plus [[javascript|JavaScript]], often via [[react|React]], running in a browser or a WebView. The **backend** is code you run on a machine you control: an [[express|Express]] or [[nextjs|Next.js]] server, a [[python|Python]] API, a database, a queue. The browser talks to the backend over HTTP ([[rest-apis]], sometimes [[graphql|GraphQL]] or [[websockets]]).

"Full stack" means one person works on both. It does not mean there is one process with no boundary. Even a Next.js app has a server side and a client side. The boundary is where trust changes.`],
["Why and when it is used", `Split frontend and backend so you can update the UI without exposing the database, and so you can have more than one client (web, mobile) on one API. Put anything secret or authoritative on the backend: [[api-keys|API keys]] for [[model-apis|model APIs]], database credentials, the decision of whether this user may see this row. The frontend can hold a short-lived session and the pixels.

A purely static frontend is fine for a brochure. A backend with no UI is fine for a job that runs on a schedule. Do not invent a backend for a page that never sends data. Do not put the database connection string in the frontend because it was faster.`],
["How it works", `The frontend renders state and sends requests: "create this draft", "stream a reply". The backend authenticates the caller, checks authorisation, reads or writes the database, calls other services, and returns JSON or a stream. The frontend then renders the result. Validation happens in both places: the UI for fast feedback, the server because the UI can be skipped. Anyone can send a request with curl.

Authentication answers who is calling. Authorisation answers what they may do ([[authentication-vs-authorization]]). A pretty frontend check that hides a button is not authorisation. The server must refuse the request. Sessions or tokens ([[json-web-tokens|JWTs]], cookies) are how the server recognises the same user on the next call.`],
["Technologies and dependencies", `A UI stack, an API stack, a database, and a way to develop them together (two ports on localhost, or one framework that hosts both). [[cors|CORS]] appears when the browser UI and the API have different origins. [[environment-variables]] configure the backend. The frontend build may receive a public API base URL, which is not a secret. [[cicd|CI]] should build and test both.`],
["How to get started", `1. Draw one user action: "save a note". Write the request and the response on paper.
2. Implement the backend route first. Call it with curl. Reject an unauthenticated call.
3. Implement the smallest UI that sends that request and shows success or the error string.
4. Move the model API key, if you have one, to the backend. The browser calls you; you call the model.
5. Add one authorisation rule (a user can only read their notes) and a test that uses two users.
6. Only then improve the visual design.

If you are alone, you can still keep the folders separate. Future you is a second developer.`],
["Cautions and trade-offs", `Trusting the client is the architectural bug. Prices, permissions and prompts that must stay private do not belong in frontend code. Shipping a "temporary" key in the bundle becomes an incident.

Over-splitting too early (a dozen microservices for one form) is the other failure. One backend process is a good start. Also beware of duplicating business rules only in the UI. When a mobile app appears, those rules vanish. Put them on the server. Finally, streaming AI responses are still this architecture: the backend holds the key and forwards tokens. The frontend is a view over a stream, not the place that owns the model.`],
]
},
];
