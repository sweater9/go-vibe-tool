const C = 'concept';
const K = 'comparison';
export const pages = [
{
slug: "sharepoint", title: "What is SharePoint?", kind: C, group: "Microsoft 365",
question: "What is SharePoint and when do teams use it?",
summary: "SharePoint is Microsoft's platform for team sites, document libraries, pages and intranet content inside Microsoft 365. Custom UI on modern pages is built with the SharePoint Framework, not classic farm solutions.",
short: `**SharePoint** stores and presents an organisation's pages, lists and files inside Microsoft 365. Modern custom web parts are built with [[sharepoint-framework|SPFx]], and data often comes from [[microsoft-graph|Microsoft Graph]].`,
aliases: ["What is SharePoint?", "SharePoint", "SharePoint Online", "SPO", "SharePoint site", "SharePoint document library", "SharePoint intranet", "modern SharePoint"],
keywords: ["SharePoint", "SharePoint Online", "document library", "list", "intranet", "web part", "site", "Microsoft 365"],
related: ["sharepoint-framework", "build-spfx-web-part", "microsoft-365", "microsoft-graph", "microsoft-entra-id", "teams-development"],
sections: [
["What it is", `SharePoint is a Microsoft 365 service for storing files, structuring lists of data, and publishing intranet pages. A **site** is the container: it has owners, members, pages, document libraries and lists. A library is a folder-like store with version history, metadata columns and permissions. A list is a table of items with columns you define. Modern pages are made of **web parts**, the rectangular components that show news, lists, files or custom UI.

SharePoint Online (often called SPO) is the cloud service in [[microsoft-365|Microsoft 365]]. SharePoint Server is the older self-hosted product. Most new work targets SharePoint Online. The address of a site looks like \`https://contoso.sharepoint.com/sites/finance\`. That URL is the home for both human browsing and many APIs.`],
["Why and when it is used", `Teams use SharePoint when more than one person must work on the same files with permissions, version history and a page that explains the work. Typical cases are a department intranet, a project site, a controlled document library, and the file storage behind a Microsoft Team. Teams files actually live in a SharePoint library; the Teams tab is a view on top.

Choose SharePoint when the content should stay inside the Microsoft 365 tenant, inherit [[microsoft-entra-id|Entra ID]] identities, and be governable by the same admins who run Exchange and Teams. Do not choose it as a general-purpose application database. High-volume transactional data belongs in a database such as [[postgresql|PostgreSQL]] or [[azure-fundamentals|Azure]] data services. SharePoint lists are fine for thousands of business rows, not for millions of events per day.`],
["How it works", `A user signs in with an Entra ID account. SharePoint checks the token, then evaluates permissions on the site, library, folder or item. Modern pages are client-rendered: the browser loads the page, then loads web parts. Out-of-the-box web parts cover text, images, lists and news. Custom web parts are built with the [[sharepoint-framework|SharePoint Framework]] and deployed as a package to the tenant **app catalog**.

Behind the page, content is addressable by REST and by [[microsoft-graph|Microsoft Graph]]. Graph is the cross-product API (sites, drives, lists, mail, calendar). SharePoint also has its own REST endpoints under \`/_api\`. Files are stored in drives; each library is a drive. Versioning keeps prior bytes so a bad save can be restored. Search crawls sites so people can find pages and documents without knowing the URL.`],
["Technologies and dependencies", `SharePoint depends on **Entra ID** for users and groups, on the Microsoft 365 tenant for licensing, and on the app catalog if you deploy custom SPFx solutions. Branding and web parts depend on SPFx, TypeScript and usually React. Automation often uses [[power-platform|Power Platform]] (Power Automate flows on libraries) or Graph calls from your own service.

Permissions are not the same thing as Azure RBAC. A site owner, a library role and an Entra group assignment are different layers. Breaking inheritance on a folder is powerful and easy to make unauditable. External sharing uses guest accounts or share links, which is an identity decision as much as a SharePoint decision. If a web part calls Graph, an administrator must approve the API permission in the SharePoint admin center.`],
["How to get started", `1. Sign in to a Microsoft 365 tenant that includes SharePoint. A developer tenant from the Microsoft 365 Developer Program is enough to learn.
2. Create a team site. Add a document library and one list with a few columns so you can see metadata versus folders.
3. Edit the home page and add standard web parts. Publish the page.
4. Note the site URL, the library name and how permissions change when you share with a person versus a group.
5. When you need UI that the built-in web parts cannot provide, move to [[build-spfx-web-part|building an SPFx web part]] rather than injecting script into a classic page.
6. Read Graph's sites and drives APIs before you write an integration. Prefer Graph for new code; keep \`/_api\` for gaps Graph does not cover yet.

Start with one real library and a written permission model. A site per project, a group per role, and as little broken inheritance as you can live with.`],
["Cautions and trade-offs", `SharePoint is a content platform with an API, not a low-latency application backend. Lists have throttling thresholds; unique permissions explode complexity; classic solutions and script editors are the wrong place for new UI. Customisation should go through SPFx so it survives modern pages and tenant administration.

Search is eventually consistent. A file you just uploaded may not be findable for a short time. Sync clients (OneDrive sync of a library) create offline copies that can conflict. Large migrations fail when filenames contain illegal characters or paths exceed length limits. Governance matters: without site lifecycle rules, tenants fill with abandoned project sites that still hold sensitive files. Treat external sharing as a security setting and review it, and do not store secrets or raw credentials in a library even if permissions look tight.`],
]
},
{
slug: "sharepoint-framework", title: "SharePoint Framework (SPFx)", kind: C, group: "Microsoft 365",
question: "What is SPFx?",
summary: "SPFx is the SharePoint Framework: Microsoft's TypeScript toolchain for client-side SharePoint web parts and extensions. The default UI library is React, and projects are TypeScript-first.",
short: `**SPFx means SharePoint Framework.** It builds client-side web parts and extensions that run on modern SharePoint pages. The usual stack is **TypeScript and React**. Step-by-step packaging is in [[build-spfx-web-part]].`,
aliases: ["Does SPFx use React?", "SPFx TypeScript", "What is SPFx?", "SharePoint Framework", "SPFx React", "is SPFx TypeScript", "SPFx explained", "sharepoint framwork", "Sharepoint Framework", "SPFx", "SharePoint client-side development", "SPFx web part framework"],
keywords: ["SPFx", "SharePoint Framework", "TypeScript", "React", "web part", "extension", "Yeoman", "gulp", "Workbench"],
related: ["build-spfx-web-part", "sharepoint", "microsoft-graph", "microsoft-365", "typescript", "react", "teams-development"],
sections: [
["What it is", `**SPFx** is the short name for the **SharePoint Framework**, Microsoft's model for building custom pieces of SharePoint that run in the browser. An SPFx solution can contain web parts (components people place on a page) and extensions (headers, footers, field customisers, command sets). The code is packaged, uploaded to the tenant app catalog, and loaded by modern SharePoint pages. It replaces unsupported patterns such as script-editor injection and old full-trust farm solutions.

People ask "What is SPFx?" because the acronym hides the product name. Expanding it matters: SPFx is not a separate cloud, not Power Apps, and not a general Node server. It is a client-side framework hosted by SharePoint.`],
["Why and when it is used", `Use SPFx when a SharePoint page needs behaviour the built-in web parts do not offer: a custom dashboard, a branded list view, a button that files a request, or an extension that changes how a column is displayed. It is the supported route for intranet customisation that must be deployed and governed by tenant admins.

Do not use SPFx for a public marketing site, a mobile app, or a backend API. Those belong in ordinary web stacks ([[react]], [[nextjs]]) or [[azure-fundamentals|Azure]]. Do not use it when a list form plus [[power-platform|Power Apps]] is enough. SPFx pays off when you need real front-end code, source control, and a package your admins can approve or remove.`],
["How it works", `The toolchain scaffolds a Node project. You implement a web part class and, in the React template, a React component. SharePoint gives the part a **context** object: the current site, the page, an \`spHttpClient\` for SharePoint REST, and a way to call [[microsoft-graph|Microsoft Graph]] once permissions are granted. At build time the toolchain bundles TypeScript into JavaScript assets. \`heft start\` (SPFx v1.22+; \`gulp serve\` on the legacy gulp toolchain) opens the hosted workbench so you can see the part without uploading a package every edit.

**Does SPFx use React?** Yes for the default and best-documented path. The generator asks which framework to use; React is the standard choice and Microsoft's own samples assume it. Other frameworks are possible, but you leave the paved road. There is also a no-framework option for tiny parts. If the question is whether React knowledge transfers, the answer is yes: components, props and state work as they do in other React apps, with SharePoint context added.

**SPFx TypeScript:** projects are TypeScript-first. Manifests, the web part class, props and React components are \`.ts\` and \`.tsx\` files. You are not required to be a TypeScript expert on day one, but the compiler is part of the build and loose \`any\` everywhere will hurt. Types for SPFx packages come from Microsoft's npm packages (\`@microsoft/sp-*\`).`],
["Technologies and dependencies", `An SPFx version locks a **Node.js** version range. Using a newer Node than that SPFx release supports is a classic failure. The scaffold uses Yeoman (\`yo @microsoft/sharepoint\` from the \`@microsoft/generator-sharepoint\` package) and npm; from SPFx v1.22 new projects build with the Heft-based toolchain (Rush Stack Heft + webpack), while v1.0–v1.21.1 projects use the legacy gulp-based toolchain. Typical dependencies are TypeScript, React and React DOM, plus Fluent UI for controls that look like Microsoft 365. The package is an \`.sppkg\` file deployed to the app catalog.

Runtime dependencies are SharePoint Online (or a supported SharePoint Server for older SPFx versions), [[microsoft-entra-id|Entra ID]] sign-in, and optionally Graph permissions approved by an admin. The bundle runs in the user's browser, so it cannot read server-side secrets. Calling a private API means a separate backend that performs its own auth; do not hide production keys in the SPFx bundle.`],
["How to get started", `Install a Node.js version your chosen SPFx generator supports, then install the generator and the build CLI for your toolchain (Heft for SPFx v1.22+, Gulp CLI for older versions). Run the generator, pick SharePoint Online, a web part, and React. Trust the developer certificate when the workbench asks. Change the React component's render output, save, and refresh the workbench.

Read the manifest: it declares the part's id, alias and properties. Properties the author can edit in the property pane should be typed. When the part needs list data, call SharePoint REST or Graph with the context client rather than inventing a second login. The full path from scaffold to app-catalog install is [[build-spfx-web-part|how to build an SPFx web part]]. Keep the SPFx version, Node version and generator version written down in the repo README so the next person can build the package.`],
["Cautions and trade-offs", `SPFx versions move slowly and are not interchangeable. A sample from the latest generator may not compile on an older tenant baseline. Upgrade on purpose; do not mix major versions inside one solution casually.

The code runs as the current user. It cannot bypass SharePoint permissions. That is a feature: a web part should not become a backdoor. It also means a part that needs broader access must call a backend, and that backend must enforce its own checks.

Bundles grow quickly if you import a large component library carelessly. Test in the workbench and on a real modern page; they are not identical. Tenant app-catalog deployment needs an admin. API permission requests for Graph sit unapproved until an admin consents. Finally, SPFx is not a place for business logic you cannot explain: if the part writes to a list, validate inputs and expect throttling when everyone on the intranet clicks at once.`],
]
},
{
slug: "build-spfx-web-part", title: "How to Build an SPFx Web Part", kind: C, group: "Microsoft 365",
question: "How do I build an SPFx web part?",
summary: "Build an SPFx web part by scaffolding a React and TypeScript project with the SharePoint generator, coding against the web part context, serving the workbench, then packaging an .sppkg for the app catalog.",
short: `To build an SPFx web part: match Node to your SPFx version, scaffold with the SharePoint Yeoman generator (**React + TypeScript**), implement the component, run it on the workbench (\`heft start\` on SPFx v1.22+, \`gulp serve\` on older toolchains), then ship an \`.sppkg\` to the app catalog. Background: [[sharepoint-framework|what SPFx is]].`,
aliases: ["How do I build an SPFx web part?", "build an SPFx web part", "SPFx web part tutorial", "create SPFx web part", "scaffold SPFx React web part", "gulp serve SPFx", "package SPFx solution", "sppkg app catalog", "yo @microsoft/generator-sharepoint"],
keywords: ["SPFx", "web part", "Yeoman", "gulp serve", "sppkg", "app catalog", "React", "TypeScript", "workbench"],
related: ["sharepoint-framework", "sharepoint", "microsoft-graph", "typescript", "react", "nodejs", "microsoft-365"],
sections: [
["What it is", `Building an SPFx web part means creating a SharePoint Framework project whose output is a component an author can drop on a modern [[sharepoint|SharePoint]] page. The part is TypeScript, usually React, bundled by the SPFx toolchain and installed from a \`.sppkg\` package. This page is the practical sequence. For what the framework is, and for the direct answers "Does SPFx use React?" and "Is SPFx TypeScript?", read [[sharepoint-framework]].`],
["Why and when it is used", `Follow this path when you are ready to put custom UI on a SharePoint page: a filtered view of a list, a small form, or a card that calls [[microsoft-graph|Microsoft Graph]]. Skip it for a one-off edit a built-in web part already covers. Also skip it if you do not have a tenant where you can upload a package; the local workbench is only half the story.`],
["How it works", `The generator writes a solution with \`config/\`, \`src/webparts/<name>/\`, a manifest, localisation strings and a React component. The web part class wires the property pane and renders the React element, passing \`this.context\` and the current properties. SharePoint loads that class when the page renders the part. During development the workbench loads your bundle from localhost. In production SharePoint loads the bundle from the app catalog's deployed assets.

A minimal data call uses \`this.context.spHttpClient.get(listUrl, SPHttpClient.configurations.v1)\` or the Graph client. You parse JSON, keep it in React state, and render. Errors from permissions or throttling should show in the part, not only in the console.`],
["Technologies and dependencies", `You need a supported **Node.js** for that SPFx release, npm, the Yeoman SharePoint generator (\`@microsoft/generator-sharepoint\`), the build CLI for your toolchain (Heft — \`@rushstack/heft\` — for SPFx v1.22+; Gulp CLI for v1.0–v1.21.1), a Microsoft 365 tenant with an app catalog, and a code editor. React and TypeScript come in as project dependencies when you pick the React template. Fluent UI is optional but matches Microsoft 365 visuals. If the part calls Graph, an admin must approve the requested permissions. Your own developer certificate is required for HTTPS on the local workbench.`],
["How to get started", `1. Check the SPFx version you will use and install a Node.js release it supports. Version mismatch is the most common first-day failure.
2. Install tooling. For SPFx v1.22+ (Heft toolchain): \`npm install @rushstack/heft yo @microsoft/generator-sharepoint --global\`. For v1.21.1 and earlier, including SharePoint Server on-premises, follow the legacy gulp-based guide (\`npm install -g yo gulp-cli @microsoft/generator-sharepoint\`). Pin a generator version if your team standardises one.
3. Create a folder and run \`yo @microsoft/sharepoint\`. Choose SharePoint Online (or the latest target), a WebPart, a name, and the **React** framework.
4. Trust the developer certificate: \`heft trust-dev-cert\` on SPFx v1.22+ (after \`npm install\`), \`gulp trust-dev-cert\` on the legacy toolchain.
5. Run \`heft start\` (or \`gulp serve\` on the legacy toolchain). Open the hosted workbench URL the console prints. Add your web part to the page.
6. Edit \`src/webparts/<name>/components/<Name>.tsx\`. Start by rendering the site title from context so you know the part is wired. Then add one real behaviour, such as reading the titles of items in a list on the current web.
7. Define properties in the manifest and property pane only for values an author should change (list title, row count). Do not put secrets there.
8. When it works on the workbench, add the same part to a real modern page in your dev site.
9. Package: \`heft build --production\` then \`heft package-solution --production\` on SPFx v1.22+ (legacy toolchain: \`gulp bundle --ship\` and \`gulp package-solution --ship\`). Upload the \`.sppkg\` from \`sharepoint/solution\` to the tenant app catalog. Deploy it. If the package requests API permissions, approve them in the SharePoint admin API access page.
10. Add the web part on a page as a user who is not you. If it fails, the bug is usually permissions, not React.

Commit \`package-lock.json\`. Write the Node and SPFx versions in the README. The next build should be repeatable.`],
["Cautions and trade-offs", `Do not upgrade Node globally "to latest" on a machine that builds SPFx; keep a version manager. Do not ship a debug build that still loads assets from localhost (the \`heft start\` / \`gulp serve\` workbench setup). Do not store API keys in the bundle; anyone can read it. Property bag values are not secret either.

Test the packaged solution, not only the workbench. The workbench does not prove app-catalog deployment, CDN paths or admin consent. Respect list view thresholds: requesting every row with no filter will fail in real libraries. Handle loading and error states so a slow Graph call does not look like a blank web part. And keep the solution small. If you are building a full application with routing, accounts and its own database, SPFx should be a thin host or you should build that application elsewhere and link to it.`],
]
},
{
slug: "microsoft-365", title: "Microsoft 365 for Developers", kind: C, group: "Microsoft 365",
question: "What is Microsoft 365 and what does M365 include?",
summary: "Microsoft 365 (M365) is the cloud suite that includes SharePoint, Exchange, Teams and the identity boundary in Entra ID. Developers extend it with Graph, SPFx and Teams apps rather than scraping the web UI.",
short: `**Microsoft 365 (M365)** is the tenant that holds mail, files, sites and Teams. Build against [[microsoft-graph|Graph]] and [[sharepoint-framework|SPFx]], and sign users in with [[microsoft-entra-id|Entra ID]].`,
aliases: ["What is Microsoft 365?", "Microsoft 365", "M365", "Office 365", "O365", "Microsoft 365 developer", "what is M365", "Office 365 vs Microsoft 365"],
keywords: ["Microsoft 365", "M365", "Office 365", "tenant", "Exchange", "Teams", "SharePoint", "Graph"],
related: ["sharepoint", "sharepoint-framework", "microsoft-graph", "microsoft-entra-id", "teams-development", "power-platform", "azure-fundamentals"],
sections: [
["What it is", `**Microsoft 365**, often shortened to **M365**, is Microsoft's subscription suite for work: Outlook and Exchange for mail, [[sharepoint|SharePoint]] and OneDrive for files, Teams for chat and meetings, plus Office apps and admin portals. **Office 365** (O365) is the older name. You will still see it in docs, URLs and licence names. For a developer they are the same tenant story: a directory of users, a set of licensed services, and APIs in front of those services.

M365 is not the same product as [[azure-fundamentals|Azure]]. Azure is infrastructure and platform services (compute, storage, functions). M365 is the end-user productivity cloud. They meet at identity: both can use [[microsoft-entra-id|Microsoft Entra ID]], and an app can live in Azure while reading mail or files through [[microsoft-graph|Microsoft Graph]].`],
["Why and when it is used", `You care about M365 when the data your app needs already lives there: a user's files, a team's channel, a SharePoint list, a calendar. Building inside the tenant means you inherit sign-in, compliance boundaries and the admin's ability to turn your app off. That is the right trade when you are extending how a company already works.

Use a plain web app on Azure or another host when the product is not about a customer's tenant data. Do not scrape outlook.office.com or sharepoint.com HTML. Those pages change, break automation, and violate the point of Graph. Prefer Graph for data, [[sharepoint-framework|SPFx]] for SharePoint UI, and the Teams SDK for tabs and bots inside Teams.`],
["How it works", `An organisation gets a tenant, for example \`contoso.onmicrosoft.com\`, and licences that turn services on. Users and groups live in Entra ID. Each service stores its own content but Graph exposes a single REST surface: \`/users\`, \`/groups\`, \`/sites\`, \`/drives\`, \`/me/messages\`, \`/teams\`. An app registration holds the client's id. Permissions are either delegated (the app acts as a signed-in user) or application (the app acts as itself, which admins treat as high privilege).

Admins control consent. A permission in your code does nothing until consent exists. Developer tenants from the Microsoft 365 Developer Program give you a sandbox with sample users so you are not experimenting in production.`],
["Technologies and dependencies", `Plan on Entra ID app registrations, Graph, and the service you actually touch (SharePoint, Teams, Exchange, Planner). SPFx packages deploy through the SharePoint app catalog. Teams apps deploy through Teams admin or sideloading in a dev tenant. [[power-platform|Power Platform]] is the low-code neighbour: Power Automate and Power Apps sit on the same tenant data but are not a substitute for Graph when you need a real service.

SDKs exist for .NET, JavaScript and Python (\`@microsoft/microsoft-graph-client\` and others). Raw HTTP is fine and often clearer. Tokens are OAuth 2.0 access tokens; do not invent a different login for each workload.`],
["How to get started", `1. Join a developer tenant or use a sandbox your admin assigns.
2. In Entra ID, register an application. Note the application (client) id and the tenant id.
3. Add the delegated Graph permission you actually need, such as \`User.Read\` first, not \`Mail.ReadWrite\` on day one.
4. Sign in with the auth-code flow and call \`GET https://graph.microsoft.com/v1.0/me\`.
5. Open SharePoint and Teams in the same tenant so you can see the objects your next calls will use.
6. Only then add files, mail or sites. Read the permission docs for the exact scope. Application permissions require admin consent and a daemon design, not a user login.

Keep production tenants and dev tenants apart. Sample data packs are useful; real customer mail is not a test fixture.`],
["Cautions and trade-offs", `Graph throttles. Batch and delta queries exist because looping every user every minute will be blocked. Permissions are sharp: application \`Mail.Read\` is tenant-wide mail, which most apps do not need. Prefer delegated scopes and least privilege.

Names drift. Office 365, Microsoft 365, and product SKUs do not line up one-to-one with APIs. Licence a feature before you debug a 404. Some admin settings (conditional access, tenant restrictions) will block your dev flow until an admin exempts the app. Finally, M365 data residency and retention are legal questions. Copying a tenant's files into your own database creates a second copy you must secure and delete. Store identifiers and fetch content when you need it, unless you have a written reason to cache.`],
]
},
{
slug: "microsoft-graph", title: "Microsoft Graph API", kind: C, group: "Microsoft 365",
question: "What is the Microsoft Graph API and how do I call it?",
summary: "Microsoft Graph is the REST API for Microsoft 365: users, groups, mail, files, sites, calendars and Teams. You call https://graph.microsoft.com with an Entra ID access token and the scopes an admin has consented.",
short: `**Microsoft Graph** is the one REST API in front of Microsoft 365 data. Call \`graph.microsoft.com\` with an [[microsoft-entra-id|Entra ID]] token. It is not a replacement for [[sharepoint-framework|SPFx]] UI, and it is not Azure Resource Manager.`,
aliases: ["Microsoft Graph", "Graph API", "Microsoft Graph API", "what is Microsoft Graph", "call Microsoft Graph", "graph.microsoft.com", "MS Graph", "Microsoft Graph REST"],
keywords: ["Microsoft Graph", "Graph API", "REST", "Entra ID", "scopes", "delegated", "application permissions", "delta query"],
related: ["microsoft-365", "microsoft-entra-id", "sharepoint", "teams-development", "oauth", "api-keys", "azure-fundamentals"],
sections: [
["What it is", `**Microsoft Graph** is a single REST API at \`https://graph.microsoft.com\` that fronts many [[microsoft-365|Microsoft 365]] services. Instead of a different base URL for mail, files and directory objects, you call one host with a version prefix (\`/v1.0\` or \`/beta\`) and a resource path. \`/me\` is the signed-in user. \`/users/{id}/messages\` is mail. \`/sites/{id}/drives\` is [[sharepoint|SharePoint]] or OneDrive file storage. \`/teams\` is Teams.

Graph is an API, not a UI framework. SharePoint web parts are still [[sharepoint-framework|SPFx]]. Provisioning virtual machines is Azure Resource Manager, not Graph. Mixing those up leads people to hunt for a Graph endpoint that does not exist.`],
["Why and when it is used", `Use Graph when your application must read or change tenant data on behalf of a user or, more rarely, as a background service. Examples: list the files in the user's OneDrive, post a channel message, read a calendar to propose meeting times, or sync group membership into your own app.

Do not use Graph as a private database for data Microsoft does not own. Your orders, game state or embeddings belong in your database. Do not screen-scrape the Microsoft 365 portals. And do not call Graph from a browser with a long-lived secret. Public clients use delegated auth; secrets stay on a server.`],
["How it works", `You register an app in [[microsoft-entra-id|Entra ID]]. The user (or an admin) consents to **scopes** such as \`Files.Read\` or \`Mail.Read\`. Your app obtains an OAuth 2.0 access token whose audience is Graph, then sends \`Authorization: Bearer <token>\`. Graph evaluates the token, the consented scopes, and the user's own permissions on the mailbox or site. A manager cannot read a colleague's mail just because the app has \`Mail.Read\` delegated; delegated access is the intersection of the scope and what that user can already do.

Application permissions are different: the app itself is granted access, often tenant-wide, with no signed-in user. That fits daemons and is dangerous if over-scoped. Responses are JSON. Large lists use \`@odata.nextLink\`. Changes over time use **delta** queries so you do not re-download everything. Throttling returns \`429\` with a \`Retry-After\` hint.`],
["Technologies and dependencies", `Graph depends on Entra ID tokens ([[oauth]], often with [[openid-connect|OpenID Connect]] for sign-in). SDKs exist, but the HTTP contract is the stable thing to understand: GET to read, POST to create, PATCH to update, DELETE to remove. Prefer \`/v1.0\` for production. \`/beta\` changes and can break.

From SPFx, use the provided Graph client rather than prompting the user for a second login. From a [[nodejs|Node]] or [[python|Python]] service, use a confidential client with a certificate, not a password sitting in source. [[teams-development|Teams apps]] often call Graph for the data behind a tab or bot.`],
["How to get started", `1. Register an app and add delegated \`User.Read\`.
2. Complete an auth-code login and store the access token only in memory on the server (or use a library that refreshes it).
3. \`GET https://graph.microsoft.com/v1.0/me\` and print the display name.
4. Use Graph Explorer (a Microsoft web tool) to try the next call while signed into the same tenant. It shows the exact permission a call needs.
5. Add one real resource: \`GET /me/drive/root/children\` or a site you know.
6. Handle \`401\` (token), \`403\` (consent or user rights) and \`429\` (throttle) as different bugs.
7. Check paging. If you ignore \`@odata.nextLink\` you will silently process a partial list.

Write down the scopes you request next to the feature that needs them. Removing a scope later is a migration; adding tenant-wide application permissions "just to try" is how apps get blocked by security review.`],
["Cautions and trade-offs", `Graph is broad, so it is easy to ask for \`*.ReadWrite.All\` and ship it. Reviewers should reject that. Beta endpoints are tempting because a field exists only there; wrap them and expect breakage. Delta tokens expire and must be renewed. Some SharePoint operations still live on SharePoint REST (\`/_api\`) rather than Graph; check before you build a design that assumes Graph parity.

Tokens are not API keys. They expire in about an hour and are scoped. Caching a bearer token in a browser localStorage for a confidential app is a leak. Log request ids when you call support, but do not log the token or the full body of a mailbox. Respect tenant boundaries: a multi-tenant app must store data per tenant and assume an admin will revoke consent.`],
]
},
];
