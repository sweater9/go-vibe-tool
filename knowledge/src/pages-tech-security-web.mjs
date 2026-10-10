const C = 'concept';
const K = 'comparison';
export const pages = [
{
slug: "authentication-vs-authorization", title: "Authentication versus Authorization", kind: C, group: "Security",
question: "What is the difference between authentication and authorization?",
summary: "Authentication answers who is calling. Authorization answers what they may do. A valid login is not permission to read every row. Check both, on the server, for every action that matters.",
short: `**Authentication** is who you are. **Authorization** is what you may do. A session, an [[openid-connect|OIDC]] login or an [[api-keys|API key]] answers the first. A check in your server answers the second. Hiding a button is not authorization.`,
aliases: ["authentication vs authorization", "authn vs authz", "what is authentication", "what is authorization", "difference between authentication and authorization", "login vs permission", "auth vs authz"],
keywords: ["authentication", "authorization", "authn", "authz", "permission", "session", "policy"],
related: ["oauth", "openid-connect", "api-keys", "json-web-tokens", "frontend-and-backend", "api-authentication"],
sections: [
["What it is", `**Authentication** (authn) establishes identity. A password and a second factor, a passkey, an [[openid-connect|OIDC]] ID token, or an [[api-keys|API key]] are different ways to answer "who is this caller?" After that, your app usually creates a session so the next request is not a full login. **Authorization** (authz) decides "may this identity do this action to this object?" Examples: only the author may edit the document; only an admin may refund; only a member of the tenant may see the tenant's files.

The words are similar and the bugs are not. Logging in is not the same as being allowed. The short forms **authn** and **authz** exist so people can say which one they mean in a design review.`],
["Why and when it is used", `Every multi-user system needs both. Authentication without authorization is how any logged-in user reads every other user's data by changing an id in the URL. Authorization without authentication is a policy with nobody to apply it to, except for truly public resources. Single-user local tools can skip both.

Do the authorization check on the server ([[frontend-and-backend]]). The UI can hide buttons so people are not offered actions that will fail. If the UI is the only check, an ordinary HTTP call bypasses it. Do not build a permission matrix so abstract that nobody can say what a new endpoint should require. Start with ownership and a small set of roles.`],
["How it works", `A request arrives. Middleware authenticates it: valid session cookie, valid bearer token, valid API key. It attaches an identity (user id, tenant id, client id) or rejects with 401. The handler then authorises: load the object, compare its owner or tenant to the identity, or ask a policy. Failure is 403. 401 means "I do not know you". 403 means "I know you and the answer is no". Mixing them up confuses clients and sometimes leaks whether an id exists; pick a policy deliberately for private objects.

Roles (\`admin\`, \`member\`) are coarse. Ownership (\`created_by\`) is specific. Attributes ("department matches the record") are another step. Put the check in one place per resource so a new endpoint cannot forget it. Tests should include a second user who must be denied. [[oauth]] scopes are a form of authorization for an API, and they still are not your row-level rules.`],
["Technologies and dependencies", `A session or token mechanism ([[json-web-tokens]], cookies), a user store, and policy in code or in a dedicated engine if the rules are genuinely complex. [[microsoft-entra-id]] groups can feed roles. They should not be copied into every service in an ad hoc way without a refresh story. [[api-authentication]] covers credentials at the door. This page is the distinction after the door opens.`],
["How to get started", `1. For one resource (a note), require a session. Return 401 if there is none.
2. Store \`owner_id\` on the note. On read and delete, require \`owner_id\` to match the session user. Return 403 otherwise.
3. Write a test that user A cannot read user B's note by guessing the id.
4. Add an admin role that may read all notes, and a test for it. Do not implement admin as "skip all checks" sprinkled in handlers.
5. Hide the delete button in the UI only after the server test exists.
6. Log denials with the user id and the object id, not with the object's private contents.

When you add a new route, the code review question is "where is the authz check?" If the answer is "the user is logged in", that is not an answer.`],
["Cautions and trade-offs", `Checking authentication in a middleware and assuming authorization happened is the recurring outage-of-privacy. IDOR bugs (insecure direct object references) are this page in incident form. Multi-tenant apps must include tenant id in the check, not only user id; the same user id in two tenants is two people or one person with two contexts.

Role checks that trust a role string from the client are authentication theatre. The role comes from your database or from a validated token you issued. And do not leak secrets through error text ("denied, but the document title is ..."). Finally, background jobs have identity too. A worker that uses a god credential and a user-supplied id without a check will export the wrong tenant's data the first time a queue message is wrong.`],
]
},
{
slug: "cors", title: "CORS", kind: C, group: "Security",
question: "What is CORS and why does the browser block my API?",
summary: "CORS is a browser rule for cross-origin requests. The server must opt in with response headers. It is not authentication, and it is not a barrier to non-browser clients. Fix it by allowing the origins you intend, not by reflecting every origin with credentials.",
short: `**CORS** (Cross-Origin Resource Sharing) is how a browser asks a server whether a page from another origin may read a response. Configure the origins you own. CORS is not [[authentication-vs-authorization|authentication]], and tools like curl ignore it.`,
aliases: ["What is CORS?", "CORS error", "Cross-Origin Resource Sharing", "Access-Control-Allow-Origin", "why is my API blocked by CORS", "CORS preflight", "fix CORS"],
keywords: ["CORS", "origin", "preflight", "Access-Control-Allow-Origin", "browser", "credentials"],
related: ["rest-apis", "express", "frontend-and-backend", "authentication-vs-authorization", "websockets"],
sections: [
["What it is", `**CORS** (Cross-Origin Resource Sharing) is a browser mechanism. A web page served from one **origin** (scheme, host and port together) that calls an API on another origin is making a cross-origin request. Browsers allow some of these and, for others, first ask the server whether it opts in. The server opts in with headers such as \`Access-Control-Allow-Origin\`. If the header is missing or does not match, the browser hides the response from your JavaScript and shows a CORS error. The request often still reached the server.

CORS is not a server firewall. [[authentication-vs-authorization]] is a different problem. curl, mobile apps and other servers do not enforce CORS. If your security depends on CORS, you have no security against any client that is not a browser.`],
["Why and when it is used", `You meet CORS when the [[frontend-and-backend]] are on different origins: \`localhost:5173\` calling \`localhost:3000\`, or \`app.example.com\` calling \`api.example.com\`. Same origin (the page and the API share scheme, host and port) does not need CORS for ordinary requests. You configure CORS so the browser will let your front end read the response.

Do not "fix" CORS by allowing \`*\` and credentials. Browsers reject that combination, and a reflection of any origin with credentials lets any website call your API as the user if the user has a cookie. Allow a list of origins you control. Do not disable CORS in the browser as a development habit; you will not notice the production misconfiguration.`],
["How it works", `A **simple** request (some GETs and POSTs with simple headers) is sent, and the browser exposes the response to JavaScript only if the allow-origin header matches. A **preflight** is an \`OPTIONS\` request sent first when you use methods or headers the browser considers non-simple, such as \`PUT\` or \`Authorization\` or a JSON content type in many cases. The server must answer the preflight with the allowed methods, headers and origin. If it does not, the real request never runs. That is why a route that works in curl fails from the browser, and why the failure mentions OPTIONS.

\`Access-Control-Allow-Credentials: true\` is required if you send cookies. Then the origin must be explicit, not \`*\`. The server should vary the allow-origin header by the request's \`Origin\` only when that origin is on the allow-list. Echoing the request origin blindly is the bug.`],
["Technologies and dependencies", `The browser, your API ([[express]] middleware or the equivalent), and a correct list of front-end origins per environment. Production and localhost are different origins. [[rest-apis]] error handling should still return JSON your code can read once CORS allows it. [[websockets]] have a related origin check on the upgrade, but they do not use these headers the same way.`],
["How to get started", `1. Decide the front-end origin (for example \`http://localhost:5173\` in dev and \`https://app.example.com\` in prod).
2. Configure the API to allow only that origin, the methods you use, and the headers you send (\`Authorization\`, \`Content-Type\`).
3. From the browser, make the call. If it fails, read the console: it usually says which header was missing.
4. Repeat with credentials if you use cookies. Set allow-credentials and an explicit origin.
5. Call the same URL with curl and notice that it works even when the browser does not. Remember that for the security review.
6. Add the production origin when you deploy. Do not leave \`*\` in production because dev was easy.

Handle \`OPTIONS\` in the same auth-free way your middleware expects. A preflight that requires a bearer token will fail because the preflight does not send one.`],
["Cautions and trade-offs", `Allowing every origin is fine for a truly public read API with no cookies and no secrets in the response. It is wrong for anything user-specific. Putting secrets in a response and allowing every origin lets any site read them if it can induce the user's browser to call you with credentials.

CORS errors are also caused by the server crashing before it adds headers, or by a proxy stripping headers. Look at the actual response in the network panel. And do not spend a day on CORS when the status code is 401. Fix authentication, then let the browser see the error by configuring CORS on the error response too. A 401 without CORS headers looks like a CORS bug and is not.`],
]
},
{
slug: "webhooks", title: "Webhooks", kind: C, group: "Security",
question: "What is a webhook and how do I handle one safely?",
summary: "A webhook is an HTTP callback: another system POSTs to your URL when something happens. You must authenticate the sender, respond quickly, and process the event idempotently. A public URL with no signature check is an unauthenticated API.",
short: `A **webhook** is an inbound HTTP request from another service when an event happens. Verify a **signature**, answer fast, and make handling idempotent. It is not a trusted message just because it claims to be from Stripe, GitHub or a model provider.`,
aliases: ["What is a webhook?", "webhooks", "webhook signature", "HTTP callback", "how webhooks work", "verify webhook", "webhook vs API"],
keywords: ["webhook", "signature", "idempotency", "POST", "event", "retry"],
related: ["rest-apis", "api-keys", "authentication-vs-authorization", "express", "cicd", "github"],
sections: [
["What it is", `A **webhook** is a way for one system to notify yours by sending an HTTP request, usually a POST with a JSON body, to a URL you registered. Instead of you polling "any new orders?" every minute, the provider calls you when an order appears. [[github|GitHub]], payment providers, chat platforms and many [[model-apis|model]] vendors use this pattern. The request is still just HTTP. Nothing about the word webhook makes the body true.

It is the reverse of the usual API call. Normally your server is the client. With a webhook, your server is the receiver and must be reachable from the internet, or from a tunnel during development.`],
["Why and when it is used", `Use a webhook when you need to react to an event in another system and polling would be slow or wasteful: a payment succeeded, a pull request opened, a file finished processing. Use polling when the provider has no webhook, when you are behind a firewall you cannot open, or when a short delay is fine and simpler.

Do not point a webhook at a URL that runs arbitrary actions without checking who sent it. Anyone who learns the URL can POST. Security through an unguessable path is weak once the URL leaks into logs. Prefer a signature.`],
["How it works", `You register a URL and a secret in the provider's settings. When an event happens, the provider POSTs the payload and a signature header, typically an HMAC of the raw body with the secret. Your handler reads the **raw** bytes, computes the HMAC, and compares in constant time. If it matches, you enqueue the work and return 2xx quickly. If it does not, you return 401 and do nothing. Providers retry on failure, so your handler must be **idempotent**: the same event id delivered twice must not charge twice or create two records. Store the event id you have already processed.

Timeouts are tight. Do not call a slow model or a slow third party before you acknowledge. Acknowledge, then process on a queue. If you process first and the process crashes after the side effect but before you answer, the retry will do the side effect again unless you recorded the event id.`],
["Technologies and dependencies", `A public HTTPS endpoint ([[express]] or any framework), the provider's signing secret in [[environment-variables]] or a secret manager, and a store of seen event ids. [[api-keys]] are a related secret but a signature is tied to the body, which a bare bearer key on a webhook is not always. [[authentication-vs-authorization]] applies: the signature authenticates the sender; your code still decides what the event is allowed to change. [[cicd]] should not log the secret when you set it.`],
["How to get started", `1. Read the provider's signing documentation. Note the header name and whether the signed payload includes a timestamp.
2. Expose a local server through their recommended tunnel or a test event in staging. Do not use production data on day one.
3. Log the event id and type only. Verify the signature and reject a tampered body in a test.
4. Record the event id and return 200. Process the work after that, or in a background worker.
5. Send the same event twice and prove you do not duplicate the side effect.
6. Rotate the signing secret once so you know how.

Reject requests with an old timestamp if the provider signs one. That limits replay of a captured body.`],
["Cautions and trade-offs", `Parsing JSON before you verify, then verifying a re-serialised body, breaks signatures because key order and spacing changed. Verify the raw bytes. Returning 200 on a signature failure to "stop retries" hides attacks. Return a client error for bad signatures and 200 only when the event is accepted or safely ignored.

Webhooks fan out. A bug that creates a document per retry will create many. A handler that assumes the event's account id is yours, without checking, will apply another tenant's event if the provider ever misroutes or if you share an endpoint unwisely. Bind events to the tenant that installed the integration. Finally, a webhook is an availability dependency in the other direction: if your endpoint is down, the provider's retries eventually stop. Know the retry window and have a way to backfill, or you will silently miss a payment or a permission change.`],
]
},
];
