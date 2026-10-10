const C = 'concept';
const K = 'comparison';
export const pages = [
{
slug: "oauth", title: "OAuth 2.0", kind: C, group: "Security",
question: "What is OAuth and when do I use it?",
summary: "OAuth 2.0 is a protocol for granting a client limited access to an API without sharing the user's password. It is how sign-in buttons and Microsoft Graph access tokens usually start. It is not itself a login profile; OpenID Connect adds identity on top.",
short: `**OAuth 2.0** lets an app call an API with a token the user (or an admin) consented to, instead of a password. Login identity is [[openid-connect|OpenID Connect]]. Tokens are often [[json-web-tokens|JWTs]]. For agents, see [[oauth-for-ai-agents]].`,
aliases: ["What is OAuth?", "OAuth", "OAuth 2.0", "OAuth2", "authorization code flow", "what is OAuth2", "delegated access", "OAuth vs API key"],
keywords: ["OAuth", "access token", "refresh token", "authorization code", "scope", "consent", "PKCE"],
related: ["openid-connect", "json-web-tokens", "api-keys", "authentication-vs-authorization", "microsoft-entra-id", "api-authentication", "oauth-for-ai-agents"],
sections: [
["What it is", `**OAuth 2.0** is an authorisation framework. A **client** (your app) wants to call a **resource server** (an API) on behalf of a **resource owner** (a person) or as itself. An **authorisation server** issues an **access token** after the owner consents. The client sends that token to the API. The owner's password, if there is one, is typed into the authorisation server, not into your app.

OAuth is not a complete login system. It does not by itself say the token subject is a specific person. [[openid-connect|OpenID Connect]] adds an identity layer on top. People still say "OAuth login" for that combination. [[oauth-for-ai-agents]] is the narrower case of agents holding tokens. [[api-keys]] are a different, simpler credential. [[api-authentication]] compares them for ordinary APIs.`],
["Why and when it is used", `Use OAuth when a user must grant your app access to their account on someone else's API: mail, files, a calendar, [[microsoft-graph|Microsoft Graph]]. Use the client-credentials variant when a program acts as itself with no user, and treat that as a high privilege. Use an API key only when the API's threat model is "anyone with the key is the app" and there is no per-user consent.

Do not invent a flow that asks the user to paste their password into your form so you can log into another site. That is credential sharing, and it breaks the moment the other site adds multifactor authentication. Do not use the obsolete implicit flow for new apps.`],
["How it works", `The common user-facing flow is **authorisation code with PKCE**. Your app sends the user to the authorisation server with a client id, the scopes it wants, a redirect URI, and a PKCE challenge. The user signs in and consents. The server redirects back with a short-lived code. Your app exchanges the code, plus the PKCE verifier, for an access token and usually a **refresh token**. The access token goes to the API in a header (\`Authorization: Bearer ...\`) and expires in minutes or hours. The refresh token gets a new access token without another login, and should be stored like a password.

**Scopes** name what was granted (\`Files.Read\`, not "everything"). The API must check them. A token without the scope, or a token for a different API, is a 401 or 403, not a prompt to log in harder. Confidential clients (a server) can hold a client secret. Public clients (a mobile app or a single-page app) cannot keep a secret, which is why PKCE exists.`],
["Technologies and dependencies", `An authorisation server ( [[microsoft-entra-id|Entra ID]], Google, or your own), a client library that implements the flow rather than a hand-rolled redirect if you can help it, and secure storage for refresh tokens. [[json-web-tokens|JWTs]] are a common token format but OAuth does not require them; opaque tokens that the API introspects are valid. HTTPS is mandatory. Redirect URIs must match exactly.`],
["How to get started", `1. Register a client. Set one localhost redirect URI.
2. Use a library's auth-code + PKCE example. Do not copy a gist that puts the token in the URL fragment and calls it done.
3. Request one read scope. Complete login. Print the scopes you received, not the token, in any log.
4. Call the API with the access token. Then wait until it expires or force expiry and use the refresh token.
5. Revoke the grant in the provider's UI and confirm the next call fails.
6. Store refresh tokens encrypted at rest, tied to your user id, and delete them on disconnect.

If the provider's documentation and your library disagree, trust the current provider docs and a recent library version, not a 2014 blog.`],
["Cautions and trade-offs", `Tokens in localStorage are easy for any script on the page to steal. Prefer a secure, httpOnly cookie session of your own, and keep the provider's tokens on the server. Redirect URI wildcards are a phishing hole. Over-broad scopes train users to click consent blindly and train admins to reject your app.

Refresh tokens live a long time. Theft of a refresh token is theft of access until revocation. Rotate them when the provider supports it. Never log tokens. And do not confuse OAuth with authorisation inside your own database. The token says the provider allowed this client to call that API. Your app still decides which of your rows the user may touch ([[authentication-vs-authorization]]).`],
]
},
{
slug: "openid-connect", title: "OpenID Connect", kind: C, group: "Security",
question: "What is OpenID Connect and how is it different from OAuth?",
summary: "OpenID Connect (OIDC) is a thin identity layer on OAuth 2.0. It gives your app an ID token that says who signed in. OAuth alone gives an access token for an API. Most sign-in-with buttons are OIDC.",
short: `**OpenID Connect (OIDC)** is login on top of [[oauth|OAuth 2.0]]. The **ID token** says who the user is. The access token calls an API. Validate the ID token's issuer, audience and signature. Do not use an access token as proof of identity.`,
aliases: ["What is OpenID Connect?", "OpenID Connect", "OIDC", "what is OIDC", "OIDC vs OAuth", "ID token", "sign in with OIDC", "OpenID"],
keywords: ["OIDC", "OpenID Connect", "ID token", "OAuth", "issuer", "audience", "discovery"],
related: ["oauth", "json-web-tokens", "authentication-vs-authorization", "microsoft-entra-id", "api-keys"],
sections: [
["What it is", `**OpenID Connect (OIDC)** is an identity protocol built on [[oauth|OAuth 2.0]]. Where OAuth says "this client may call an API with these scopes", OIDC says "this human authenticated, and here is an identifier". The extra artifact is an **ID token**, a [[json-web-tokens|JWT]] with claims such as the subject (\`sub\`), the issuer, the audience (your client id), and an expiry. Optional claims include email and name. You should treat those as profile hints and still key your own user row by the issuer plus \`sub\`, not by email, because email can change.

People mix the names up. People say they use OAuth to sign users in usually means OIDC. They say they use OAuth to read a calendar means OAuth access tokens. You often do both in one redirect.`],
["Why and when it is used", `Use OIDC when users should sign in with an identity provider you do not want to replace: a company directory ([[microsoft-entra-id|Entra ID]]), Google, or any provider with a discovery document. You get multifactor and account recovery from them. Use it for a workforce app and for consumer "sign in with" if that matches the product.

Do not use OIDC as the permission system for every row in your database. It authenticates. Your session and your authorisation rules take over after that. Do not build a password store for employees who already have a directory. Do not accept an ID token from a provider you did not ask for.`],
["How it works", `You register a client and request the \`openid\` scope (and usually \`profile\` or \`email\`). The flow is the OAuth authorisation-code flow. The token response includes an ID token and, if you asked for APIs, an access token. You **validate** the ID token: signature against the provider's published keys, issuer, audience, expiry, and nonce if you sent one. Discovery (\`/.well-known/openid-configuration\`) tells you the URLs and key set so you do not hard-code them carelessly, though you should still pin the issuer you expect.

Then you create your own session (a cookie). The ID token is proof for that moment, not a session you replay for a week. Access tokens go to APIs and are not a substitute for the ID token. They may be JWTs or opaque, and their audience is the API, not your login client.`],
["Technologies and dependencies", `A provider, a current OIDC client library, and HTTPS. [[json-web-tokens]] explains the token shape. [[authentication-vs-authorization]] is the split you must keep. [[microsoft-entra-id]] is a common provider in the Microsoft stack. Your user table stores the provider's subject. [[api-keys]] are unrelated to user login.`],
["How to get started", `1. Pick one provider and register a client with a localhost redirect.
2. Use a library's OIDC example, not a JWT decode with verification turned off.
3. Sign in. Log the \`sub\` and issuer. Create a row in your database keyed by those, not by email alone.
4. Set a session cookie. Call a page as that user. Sign out and confirm the cookie is gone.
5. Tamper with a copied ID token (change a character) and confirm you reject it.
6. Add a second provider only when the first path is solid. Linking accounts by unverified email is a takeover bug.

Read the library's default clock skew and nonce behaviour. "It works" with verification disabled is not a login.`],
["Cautions and trade-offs", `The classic bug is decoding a JWT without checking the signature, or checking the signature but not the audience, so a token for another app is accepted. Another is trusting the email claim from a provider that does not verify email. Another is using the access token as the user id.

Do not log ID tokens. They are bearer credentials for the login moment and they contain personal data. Session fixation and redirect handling are still your job; the protocol does not secure a sloppy cookie. And OIDC does not mean every user is equal. After login, authorisation (roles, tenant, ownership) is an application decision the identity provider only partially knows.`],
]
},
{
slug: "json-web-tokens", title: "JSON Web Tokens", kind: C, group: "Security",
question: "What is a JWT and how do I validate one?",
summary: "A JWT is a signed JSON payload used as a token. Anyone can read the payload. Only a valid signature, the right issuer and the right audience make it trustworthy. Decoding is not validation.",
short: `A **JWT** is a signed token with JSON claims. **Decode** to inspect it. **Validate** the signature, issuer, audience and expiry before you trust it. It is a format used by [[oauth|OAuth]] and [[openid-connect|OIDC]], not a complete security design.`,
aliases: ["What is a JWT?", "JWT", "JSON Web Token", "JSON web tokens", "how to validate a JWT", "bearer token JWT", "decode JWT"],
keywords: ["JWT", "signature", "claims", "issuer", "audience", "expiry", "bearer"],
related: ["oauth", "openid-connect", "authentication-vs-authorization", "api-keys", "microsoft-entra-id"],
sections: [
["What it is", `A **JSON Web Token (JWT)** is a compact string with three parts separated by dots: a header, a payload, and a signature. The first two are base64url-encoded JSON. The payload holds **claims** such as subject (\`sub\`), expiry (\`exp\`), issuer (\`iss\`) and audience (\`aud\`). The signature is produced with a key so the receiver can detect tampering. JWTs are commonly used as OAuth access tokens and as [[openid-connect|OIDC]] ID tokens. Not every access token is a JWT. Not every JWT is a good idea.

The payload is not encrypted in the usual signed JWT (JWS). Anyone who has the string can read the claims. "I put a secret in the JWT" means you published the secret. Encryption (JWE) exists and is a separate, rarer choice.`],
["Why and when it is used", `Use a JWT when a standard provider issues one and your libraries know how to validate it, or when you need a token a service can check without a database lookup and you accept that you cannot easily revoke it before expiry. Use opaque session ids stored on the server when you want instant logout and revocation to be trivial. Many apps do both: a JWT from the identity provider, then a server session for the app.

Do not use a JWT as a place to stash the user's entire profile, their permissions for every product, and a copy of their email password. Do not invent a JWT scheme to avoid learning sessions if your only client is a first-party website. Cookies exist.`],
["How it works", `The issuer signs the header and payload with a private key (asymmetric, typical for OIDC) or a shared secret (symmetric, typical for tokens you issue yourself). The verifier checks the signature with the public key or the shared secret, then checks claims. **Expiry** rejects old tokens. **Issuer** rejects tokens from another authority. **Audience** rejects tokens minted for a different API. A nonce or a token id can stop replays in specific flows. If you skip any of these, you are not validating.

Libraries matter. A hand-rolled base64 decode that trusts the header's \`alg\` field is the historic "none" algorithm bug and the "switch to HMAC with the public key" bug. Pin allowed algorithms. Fetch signing keys from the provider's key set and cache them. Do not accept a key embedded in the token.`],
["Technologies and dependencies", `A maintained JWT library in your language, the issuer's keys, and a clock that is roughly correct. [[oauth]] and [[openid-connect]] are the protocols that usually mint the tokens you should accept. [[authentication-vs-authorization]] reminds you that a valid token is not a yes to every action. [[api-keys]] are a different string with no claims structure.`],
["How to get started", `1. Take an ID token from a real login in a dev tenant. Paste it into a local debugger that does not upload it, or decode the payload offline. Read \`iss\`, \`aud\`, \`exp\`, \`sub\`.
2. Validate it with a library configured for that issuer and your client id as the audience. It should succeed.
3. Flip one character in the payload and confirm validation fails.
4. Change the expected audience and confirm validation fails.
5. If you issue your own tokens, use an asymmetric key, a short expiry, a specific audience per API, and a library. Store the private key as a secret, not in the repo.
6. Decide how logout works. If you cannot revoke, keep the lifetime short.

Never send a real token to a public "decode JWT" website. Those sites do not need to see your credentials, and some keep what you paste.`],
["Cautions and trade-offs", `Long-lived JWTs are bearer secrets. Theft equals access until expiry. Put only non-sensitive claims in them because they are readable and they end up in logs if you are careless. Authorization decisions that must change immediately (disabled user, removed admin) fit poorly in a token that lives for a day unless you add a revocation check, which removes the "stateless" benefit.

Do not accept the \`none\` algorithm. Do not confuse decoding with validation in code review. And do not use a JWT to avoid CSRF thinking: if you store it in a cookie, you still need cookie protections; if you store it in localStorage, any XSS can read it. The format is not the security model.`],
]
},
{
slug: "api-keys", title: "API Keys", kind: C, group: "Security",
question: "What is an API key and how should I store one?",
summary: "An API key is a secret string that identifies a caller to an API. It is simple and blunt: anyone who has it is the caller. Keep keys on the server, scope them, rotate them, and do not ship them in a browser or a mobile binary.",
short: `An **API key** is a **secret string** an API accepts instead of a user login. Store it in [[environment-variables|environment variables]] or a secret manager on the server. A key in a frontend bundle is public. User login is [[oauth|OAuth]] or sessions, not a shared key.`,
aliases: ["What is an API key?", "API key", "API keys", "where to store an API key", "API key vs OAuth", "secret key API", "rotate API key"],
keywords: ["API key", "secret", "rotation", "bearer", "environment", "leak"],
related: ["environment-variables", "oauth", "api-authentication", "frontend-and-backend", "model-apis", "authentication-vs-authorization"],
sections: [
["What it is", `An **API key** is a secret value the client sends, often in a header (\`Authorization: Bearer ...\` or \`x-api-key\`), so the server can recognise the caller. There is usually no user and no consent screen. Possession of the key is the whole authentication. Providers use keys for server-to-server calls, including [[model-apis|model APIs]], payment APIs and email APIs. Some keys are split into a public identifier and a secret; the public half is still not something to be careless with if it can spend money.

A key is not a [[json-web-tokens|JWT]] with claims, though some products issue JWTs and call them keys. A key is not [[oauth|OAuth]]. OAuth is how a user delegates access. [[api-authentication]] discusses choosing among these for an API you design. This page is how to handle keys you hold.`],
["Why and when it is used", `Use an API key when the API represents your application, not an end user: your server calls a model, a maps service, or a mail API. The key lives on the server. Use OAuth or your own session when the caller is a person and their rights differ. Use neither in the browser. A "public" key that can only call a restricted endpoint (some payment or map widgets) is a deliberate exception and still needs domain restrictions.

Do not create one global key for every developer, every environment and every customer. A leak then becomes a total leak, and you cannot tell who called.`],
["How it works", `The server stores a hash of the key or stores it in a vault and compares. The client reads the key from configuration at startup and sends it over HTTPS. Logs must not record it. A good provider lets you create several keys, name them (\`prod-web\`, \`dev-alice\`), set a spend or IP limit, and revoke one without revoking the others. Rotation means creating a new key, deploying it, confirming traffic moved, then deleting the old one. Overlap is fine. Downtime because you deleted first is not.

If you design an API that uses keys, show the secret once, store only a hash, and attribute every call to the key id in metrics. Rate-limit per key. A key in a query string will leak via access logs and \`Referer\` headers. Put it in a header.`],
["Technologies and dependencies", `[[environment-variables]] or a secret manager, HTTPS, and a deploy path that can change the value without a code change ([[cicd]] if you have it). [[frontend-and-backend]] is the boundary. [[github]] secret scanning and similar tools catch keys committed by accident; they do not replace not committing them. [[authentication-vs-authorization]] still applies after the key is accepted: a key may identify the app, and the app may still be forbidden from an action.`],
["How to get started", `1. Create a key in the provider's console with the smallest permission and a spend cap if one exists.
2. Put it in a local environment variable. Add the name, not the value, to \`.env.example\`.
3. Read it in server code. Call the API. Confirm the value does not appear in your log line.
4. Search the repo for the key string. If it is there, rotate immediately, do not only delete the file.
5. Create a second key for production. Do not share the dev key with production.
6. Write down who can create keys and how you will notice a bill spike.

If a framework exposes environment variables to the client when their name starts with a public prefix, do not put the key in a variable with that prefix.`],
["Cautions and trade-offs", `Keys in mobile apps and SPFx bundles can be extracted. Anything that ships to the user is public. Proxy those calls through your server. Keys in screenshots, tickets and chat logs are compromised; rotate.

A single key for a multi-tenant product means one customer can exhaust the quota for all. Issue per-tenant credentials or enforce your own limits in front. And a key does not expire unless the provider or you rotate it. Treat rotation as a feature you practise, not a disaster procedure you have never run. When a laptop is lost or a CI log might have printed the environment, rotate first and investigate second.`],
]
},
];
