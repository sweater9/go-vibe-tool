const C = 'concept';
const K = 'comparison';
export const pages = [
{
slug: "graphql", title: "GraphQL", kind: C, group: "Web",
question: "What is GraphQL and how is it different from REST?",
summary: "GraphQL is an API style where the client sends a query that names the fields it wants, and the server resolves them against a schema. It reduces over-fetching and adds a different set of caching, auth and performance problems than REST.",
short: `**GraphQL** is a query language for APIs: the client asks for specific fields, the server has a schema. Compare with [[rest-apis|REST]] before you adopt it. It is not [[microsoft-graph|Microsoft Graph]], which is a REST API that happens to have Graph in the name.`,
aliases: ["What is GraphQL?", "GraphQL API", "Graph QL", "GraphQL vs REST", "when to use GraphQL", "GraphQL schema", "learn GraphQL"],
keywords: ["GraphQL", "schema", "resolver", "query", "mutation", "overfetch", "REST"],
related: ["rest-apis", "rest-vs-graphql", "frontend-and-backend", "api-authentication", "typescript"],
sections: [
["What it is", `**GraphQL** is a specification for an API where the client sends a **query** describing the shape of data it wants, and the server returns JSON in that shape. The server publishes a **schema**: types, fields, and how they relate. **Resolvers** are functions that know how to load each field. A **mutation** changes data. A query only reads.

The name collides with [[microsoft-graph|Microsoft Graph]], which is not GraphQL. Microsoft Graph is a REST API. If someone says "call the Graph", ask which one. This page is GraphQL the query language. The comparison with resource-oriented HTTP is [[rest-vs-graphql]] and [[rest-apis]].`],
["Why and when it is used", `GraphQL helps when many clients need different slices of the same graph (a mobile screen wants three fields, a desktop screen wants thirty) and you would otherwise build a pile of one-off REST endpoints. It also gives you a schema you can generate types from ([[typescript|TypeScript]] clients).

Skip it when the API is a handful of resources, when HTTP caching of GET responses matters, or when the team does not want to operate resolvers, query-cost limits and a schema process. A clear REST API is not a failure. Adopting GraphQL to look modern, then implementing each query as a pass-through to the same REST service with no design, adds a layer and no leverage.`],
["How it works", `One endpoint, often \`POST /graphql\`, receives the query text and variables. The server validates the query against the schema, plans the resolvers, and executes them. Because the client chooses fields, a naive resolver that hits the database per field creates the **N+1** problem: loading a list of authors and then each author's books in separate queries. DataLoader-style batching exists to fix that and must be used deliberately.

Authorisation is per field or per object, not once per URL, because one query can touch many types. A field you forget to protect is a data leak even if the "endpoint" requires login. Errors can be partial: some fields return data and others return an error array. Clients must handle that. Mutations should still be explicit business actions, not a generic "update anything".`],
["Technologies and dependencies", `A server library in your language, a schema file or code-first schema, and a client. Caching at the HTTP layer is weaker than REST GET caching; clients use normalised caches instead. [[frontend-and-backend]] still applies: resolvers run on the server. [[api-authentication]] still applies: the query is not self-authenticating. Observability must log operation names, not only "POST /graphql", or every request looks the same.`],
["How to get started", `1. Design three types on paper (User, Document, Comment) and the questions a screen actually asks. Do not expose your database tables one-for-one without thinking.
2. Implement a read-only schema with one resolver you can trace.
3. Send a query that asks for only two fields. Confirm the response omits the rest.
4. Add auth and a test where a user cannot read another user's document through a nested field.
5. Add batching before you add more relations. Measure the queries.
6. Add a mutation for one action, with input validation.

If step 2 already feels like overhead next to a single REST call, stop and ship REST. You can add GraphQL when there is a second client with a different shape.`],
["Cautions and trade-offs", `Unbounded query depth and breadth are a denial-of-service: a client can ask for a huge nested graph. Limit depth, complexity or both. Introspection in production reveals the whole API; some teams turn it off, others accept it because the schema is not secret but the data is.

Schema changes are a compatibility problem. Removing a field breaks clients you do not ship yourself. Deprecate first. Resolvers that hide slow downstream calls make one GraphQL request fan out into hundreds of internal calls. And do not confuse a schema with authorisation. A field in the schema is a field someone will query the day you forget the check.`],
]
},
{
slug: "websockets", title: "WebSockets", kind: C, group: "Web",
question: "What are WebSockets and when should I use them?",
summary: "WebSockets are a persistent two-way connection between a client and a server, used for live updates. They are more machinery than HTTP request and response. Many AI chat UIs only need server-sent events, not a full socket.",
short: `A **WebSocket** is a long-lived two-way connection. Use it for truly interactive streams (collaboration, games, live dashboards). For one-way model tokens, server-sent events are often simpler than a socket. See [[streaming-ai-responses]].`,
aliases: ["What are WebSockets?", "WebSocket", "websockets vs HTTP", "when to use WebSockets", "ws protocol", "WebSocket vs SSE", "real-time connection"],
keywords: ["WebSocket", "SSE", "real-time", "connection", "upgrade", "heartbeat", "streaming"],
related: ["rest-apis", "streaming-ai-responses", "frontend-and-backend", "nodejs", "express", "graphql"],
sections: [
["What it is", `A **WebSocket** starts as an HTTP request that asks to upgrade the connection. If the server agrees, the same TCP connection stays open and both sides can send messages at any time. Messages are frames of text or bytes, not HTTP requests with status codes. The URL scheme is \`ws\` or \`wss\` (the TLS version, which you want anywhere real).

This is different from a normal [[rest-apis|REST]] call, which opens, responds and finishes. It is also different from **server-sent events** (SSE), which is a one-way stream from server to browser over ordinary HTTP. [[streaming-ai-responses]] is usually that one-way pattern: the model produces tokens, the user does not send a second stream on the same socket.`],
["Why and when it is used", `Use WebSockets when both sides must push without waiting for the other to ask: a collaborative editor, a multiplayer position update, a trading screen, a chat where typing indicators and new messages arrive while the user is also sending. Use SSE or chunked HTTP when the server is streaming a response to one request, which covers most "token streaming" AI UIs. Use polling when updates are rare and you want the simplest operations story.

Do not open a WebSocket because a tutorial did. A socket is a long-lived resource. It needs heartbeats, reconnects, authentication that survives reconnect, and a plan for what happens when you run two server instances.`],
["How it works", `The browser calls \`new WebSocket(url)\`. The server accepts the upgrade and keeps the socket in memory, often in a map from user id to connection. Messages you define are application protocol: JSON text such as \`{ "type": "join", "room": "1" }\`. The server must validate them. There is no framework-level schema unless you add one. If the network drops, the browser does not magically resume; you write reconnect and you decide which messages were missed (a sequence number, or a refresh from [[rest-apis|HTTP]]).

Load balancers must allow upgraded connections and idle timeouts longer than your heartbeat interval. Sticky sessions or a shared pub/sub (one socket server publishes, all instances subscribe) are how a message reaches a user who is connected to a different instance. Without that, user A on server 1 will not hear user B on server 2.`],
["Technologies and dependencies", `A server that can hold many open connections ([[nodejs|Node]] is comfortable here; so are Go and others), TLS termination that understands upgrades, and an auth scheme. Cookies on the upgrade request are common. A token in the query string leaks into logs; prefer cookies or a short-lived ticket. [[frontend-and-backend]] still applies. [[graphql]] has a subscription transport that may use WebSockets; you do not need GraphQL to use sockets.`],
["How to get started", `1. Decide whether you truly need two-way push. If the server only streams one response, implement SSE first.
2. If you still need sockets, add a \`wss\` endpoint that accepts a connection, sends one hello message, and echoes a ping.
3. Authenticate the upgrade. Reject missing users before you store the socket.
4. Define three message types and ignore unknown ones safely.
5. Kill the network in devtools and implement reconnect with backoff.
6. Run two server processes and see a message fail to cross. Then add a pub/sub or accept a single instance explicitly.

Write the application protocol down. A socket without a schema becomes an undocumented mess within a month.`],
["Cautions and trade-offs", `Open connections consume memory. A million idle sockets is an architecture, not a default. Heartbeats that are too slow look like hangs; too fast waste batteries. Browsers limit sockets per host.

Security: a WebSocket is a cross-site channel. Check \`Origin\` on the upgrade. Do not trust a user id inside the first message without a credential. Broadcast bugs leak one tenant's events to another. And reconnect storms after a deploy can take the API down if every client retries at the same second. Jitter the backoff. Finally, do not push secrets or full documents over the socket when a notification ("document changed") and a normal HTTP fetch would do.`],
]
},
{
slug: "rest-vs-graphql", title: "REST versus GraphQL", kind: K, group: "Comparisons",
question: "Should I use REST or GraphQL?",
summary: "REST exposes resources over HTTP verbs and status codes. GraphQL exposes a schema and lets the client name fields. REST is the default for most services. GraphQL pays off when many clients need different shapes of the same data.",
short: `Prefer **REST** when resources and HTTP caching match the product. Prefer **GraphQL** when clients need many different slices of one graph and you will invest in schema, auth and query limits. They are not ranks of seniority.`,
aliases: ["REST vs GraphQL", "REST versus GraphQL", "GraphQL or REST", "should I use GraphQL", "REST or GraphQL for my API", "difference between REST and GraphQL"],
keywords: ["REST", "GraphQL", "API design", "overfetching", "caching", "schema"],
related: ["rest-apis", "graphql", "what-is-an-api", "frontend-and-backend", "api-authentication"],
sections: [
["What it is", `This comparison is about two ways to shape an HTTP API. **REST**, described in [[rest-apis]], treats things as resources with URLs. Clients use verbs: GET to read, POST to create, and so on. Status codes say what happened. **GraphQL**, described in [[graphql]], usually exposes one endpoint. Clients send a query that names the fields they need. The server follows a schema.

Neither is "more modern" in a way that matters to your users. Both can be well or badly designed. [[what-is-an-api]] is the general idea underneath both.`],
["Why and when it is used", `Choose REST when the domain is resources you can name, when you want intermediaries to cache GET requests, when file upload and HTTP semantics matter, and when the team thinks in routes. Choose GraphQL when a screen's data is a graph, when mobile and web disagree on fields, and when you will staff the extra concerns (per-field auth, query cost, schema evolution).

Many products use REST for public or partner APIs and a specialised endpoint for a picky UI. That is allowed. Using both without a reason means two auth stacks and two logs.`],
["How it works", `In REST, over-fetching means a \`GET /users/1\` returns forty fields the list view does not need. You fix it with a slimmer representation, a query parameter, or a second endpoint. Under-fetching means the client calls three URLs to paint one screen. You fix it with a composite endpoint or by accepting the extra calls.

In GraphQL, the client avoids those two problems by asking for exactly the fields. The server may do more work, not less, because resolvers fan out. HTTP caches rarely key on a POST body, so you cache inside the application. Errors in REST are status codes the whole request shares. Errors in GraphQL can be partial. Your client code must match the style you picked, not a mixture you invent per screen.`],
["Technologies and dependencies", `REST needs discipline around nouns, status codes and versioning. GraphQL needs a server library, a schema process and a client cache. Both need [[api-authentication]], rate limits and logging. [[frontend-and-backend]] ownership does not change. Code generation from an OpenAPI document and code generation from a GraphQL schema are both ways to keep [[typescript|TypeScript]] honest.`],
["How to get started", `1. List the screens and the data each shows.
2. If they line up with a few resources, sketch REST URLs and implement one.
3. If one screen needs a tree of optional fields and you already feel the endpoint multiplying, sketch a GraphQL query for that screen only.
4. Compare the operational questions: how will you cache, how will you authorise, how will you log.
5. Pick one for the next three months. Revisit with evidence, not with fashion.
6. Document the choice where new teammates will see it.

A proof of concept that returns hard-coded data is enough to feel the client difference. Do not migrate a production API to settle a debate.`],
["Cautions and trade-offs", `REST APIs rot into RPC-over-POST (\`POST /doThing\`) when people ignore resources. GraphQL APIs rot into a mirror of the database with no auth on nested fields. Both failures are design, not destiny.

GraphQL hides cost inside one HTTP 200. A slow field does not look like a slow endpoint in naive dashboards. REST hides waste in clients that over-fetch. Measure the actual pain. And do not rewrite a stable REST integration into GraphQL for a single consumer you control. You can change that consumer. Save GraphQL for the case where you cannot.`],
]
},
];
