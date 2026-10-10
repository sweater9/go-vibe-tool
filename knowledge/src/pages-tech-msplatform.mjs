const C = 'concept';
const K = 'comparison';
export const pages = [
{
slug: "power-platform", title: "Power Platform Basics", kind: C, group: "Microsoft 365",
question: "What is the Power Platform and when should developers use it?",
summary: "Power Platform is Microsoft's low-code family: Power Apps for UI, Power Automate for workflows, Power BI for reports, and Dataverse for data, sitting beside Microsoft 365 and Azure rather than replacing them.",
short: `**Power Platform** is Microsoft's low-code layer: **Power Apps**, **Power Automate**, **Power BI** and **Dataverse**. Use it for tenant workflow; use [[sharepoint-framework|SPFx]] or [[azure-fundamentals|Azure]] when you need real software engineering.`,
aliases: ["Power Platform", "what is Power Platform", "Power Apps", "Power Automate", "Power BI", "Dataverse", "Microsoft Dataverse", "low-code Microsoft"],
keywords: ["Power Platform", "Power Apps", "Power Automate", "Power BI", "Dataverse", "connector", "flow", "low-code"],
related: ["microsoft-365", "sharepoint", "microsoft-graph", "azure-fundamentals", "sharepoint-framework"],
sections: [
["What it is", `**Power Platform** is a family of Microsoft products aimed at building business apps with less traditional code. **Power Apps** makes forms and simple applications, either canvas apps (you place controls) or model-driven apps (the UI follows the data model). **Power Automate** runs flows: triggers and actions such as "when a file is created, post a message". **Power BI** models and visualises data. **Dataverse** is the platform's own relational store, with tables, relationships and security roles. Connectors link these pieces to [[sharepoint|SharePoint]], Outlook, SQL and hundreds of other systems.

It lives next to [[microsoft-365|Microsoft 365]] and [[azure-fundamentals|Azure]]. It is not SPFx, and it is not a general programming language.`],
["Why and when it is used", `Use Power Platform when the owners of a process can help build it, the audience is inside one tenant, and the logic is "form in, approval, row in a table, email out". A leave request, a facilities checklist, or a flow that copies SharePoint metadata into a team channel are good fits.

Prefer ordinary code ([[typescript]], [[csharp]], a web framework) when you need custom UX, heavy domain logic, automated tests, or a product you ship to many customers. Prefer [[sharepoint-framework|SPFx]] when the UI must be a web part on a SharePoint page. Prefer Azure Functions or another API when the work is a service other systems call. Low-code and code can meet: a flow calls your HTTP endpoint, or a canvas app embeds nothing and your app reads Dataverse through its API.`],
["How it works", `A maker signs in to the tenant. An environment (Default, or a dedicated Dev/Test/Prod) holds apps, flows and Dataverse tables. A canvas app's screens call connectors. A connector action runs as a connection: the user's credentials or a service account. Power Automate triggers on a schedule, a button, a Graph-backed event such as a new list item, or an HTTP request. Dataverse enforces security roles on rows. Solutions package apps and tables so you can move them between environments. Admins use the Power Platform admin center to control environments, connectors and data loss prevention policies that block, for example, a flow copying tenant files to a personal consumer service.`],
["Technologies and dependencies", `You depend on the tenant's licences (some connectors and Dataverse capacity are not in the cheapest seats), on Entra ID users, and on the connectors your data-loss-prevention policy allows. SharePoint lists are a common back end for simple apps; Dataverse is the better back end when you need relationships and row security. On-premises data needs a gateway. Custom logic can be a connector to an API you host on Azure. ALM for serious work uses solutions and source control, not only editing in production in the browser.`],
["How to get started", `1. Open make.powerapps.com in a dev tenant, not production.
2. Build a canvas app with one SharePoint list: a form that creates an item and a gallery that lists items.
3. Add a flow that sends a message when the item is created. Use a test account.
4. Look at the environment and the connections page so you see whose identity the flow uses.
5. Read what your licence includes before you design around premium connectors or Dataverse.
6. If the app grows past a few screens and you cannot explain the logic, stop and sketch it as a normal service. That is a successful outcome, not a failure of the prototype.`],
["Cautions and trade-offs", `Low-code spreads faster than review. Flows with broad connections can exfiltrate data if a connector policy is loose. Apps edited directly in production have no pull request. Premium-connector cost surprises teams who prototyped on a trial. SharePoint-backed apps hit list limits. Dataverse is powerful and is also another database to govern.

Do not hide secrets in flow definitions. Do not use a personal account as the connection for a company process; that flow dies when the person leaves. Treat Power Platform as production software once people rely on it: environments, owners, and a way to export the solution. And do not tell developers that Power Apps replaces [[react]] or SPFx. It solves a different class of problem.`],
]
},
{
slug: "microsoft-entra-id", title: "Microsoft Entra ID", kind: C, group: "Microsoft 365",
question: "What is Microsoft Entra ID?",
summary: "Microsoft Entra ID is Microsoft's cloud identity service, formerly Azure Active Directory. It signs users in, issues tokens, and holds the app registrations that Microsoft Graph, Azure and your own apps trust.",
short: `**Entra ID** (formerly **Azure AD**) is the identity directory behind Microsoft 365 and much of Azure. Apps register there, users sign in, and tokens carry [[oauth|OAuth]] scopes. It is not the same thing as Windows Active Directory on a private network, though the two can sync.`,
aliases: ["Microsoft Entra ID", "Entra ID", "Entra", "Azure AD", "Azure Active Directory", "AAD", "what is Entra ID", "Entra app registration", "Azure AD app registration"],
keywords: ["Entra ID", "Azure AD", "app registration", "tenant", "conditional access", "OAuth", "OIDC", "groups"],
related: ["oauth", "openid-connect", "microsoft-graph", "microsoft-365", "azure-fundamentals", "authentication-vs-authorization", "json-web-tokens"],
sections: [
["What it is", `**Microsoft Entra ID** is Microsoft's cloud directory and token service. The short name people use is **Entra**. The previous name, still everywhere in screens and libraries, is **Azure Active Directory** or **Azure AD** (AAD). A tenant holds users, groups and **app registrations**. When someone signs in to [[microsoft-365|Microsoft 365]], Azure, or your app, Entra ID is usually the system that checks the password or the authenticator and issues tokens.

It is not "Active Directory" in the old sense of domain controllers on a company LAN, although Entra Connect can synchronise those on-premises accounts into the cloud directory. It is also not an authorisation engine for every row in your database. Entra tells you who the caller is and which scopes or roles were granted. Your app still decides what that identity may do to your data.`],
["Why and when it is used", `Use Entra ID when users already have work accounts, when you call [[microsoft-graph|Microsoft Graph]], or when you want conditional access (device compliance, MFA) applied to your app without building it yourself. App registrations are how a daemon, a web app or a single-page app gets a client id and, for confidential clients, a credential.

Use a different identity provider if your product's users are consumers with no Microsoft work account and you do not want to require one. You can still federate. Do not build a private password database for employees who already exist in Entra. That creates a second set of credentials security cannot revoke in one place.`],
["How it works", `An application registration defines the client id, redirect URIs, and the API permissions or exposed scopes. An enterprise application (a service principal) is that app inside a specific tenant, which is what admins consent to. Users authenticate with [[openid-connect|OpenID Connect]]; APIs are called with [[oauth|OAuth 2.0]] access tokens, usually [[json-web-tokens|JWTs]]. Delegated permissions need a user. Application permissions need admin consent and have no user.

Conditional access policies sit in front of sign-in: they can require MFA, a compliant device, or a named location. Guest users are identities from other tenants invited into yours. Groups from Entra are the right way to assign people to an app role, rather than hard-coding email addresses.`],
["Technologies and dependencies", `Libraries: Microsoft Authentication Library (MSAL) for JavaScript, .NET, Python and Java. Protocols: OIDC for login, OAuth 2.0 for access tokens, Graph for directory queries if you must list users. Key material should be a certificate for production confidential clients. Client secrets work for learning and leak more easily. Redirect URIs must match exactly, including the port on localhost.

Your API, if you have one, should be registered as an exposed API with scopes (\`access_as_user\`) so tokens for your API are not confused with tokens for Graph. Validate issuer, audience and expiry. Do not accept any JWT a browser sends you.`],
["How to get started", `1. In the Entra admin center, open App registrations and create a registration. Record the application (client) id and directory (tenant) id.
2. Add a redirect URI for your local app.
3. Add a client secret only if this is a confidential server app. Prefer a certificate when you leave the lab.
4. Under API permissions add \`User.Read\` (Graph) and grant admin consent if you are the admin of a dev tenant.
5. Use MSAL's auth-code sample for your language. Sign in. Decode the access token (audience and scopes) in a debugger, not in production logs.
6. Call Graph \`/me\`. Then, separately, protect one route of your own API and require a token whose audience is your API.

Name the app after the product and the environment (\`contoso-invoices-dev\`). A tenant full of "test-app-final2" registrations is how secrets get forgotten.`],
["Cautions and trade-offs", `Secrets in git are a common Entra incident. Rotate them and use a store meant for secrets. Multi-tenant apps (any Microsoft work account) are a product decision: you must handle consent, tenant id on every row, and admin revocation. Single-tenant apps are safer for internal tools.

Azure AD and Entra ID are the same control plane under two labels. Docs and field names (\`aad\`) will not all say Entra. Do not create a second directory "to be safe" without knowing which tenant holds the users. Conditional access can break a daemon that has no user to satisfy MFA; service principals need the right exclusions or they will fail at 2 a.m. Finally, group membership in the token can be incomplete when groups are numerous; look up membership in Graph if your authorisation depends on it, and cache carefully.`],
]
},
{
slug: "teams-development", title: "Microsoft Teams Development", kind: C, group: "Microsoft 365",
question: "How do I build an app for Microsoft Teams?",
summary: "Teams apps are packages of tabs, bots, message extensions and connectors that run inside Microsoft Teams and usually call Microsoft Graph. They are not SPFx web parts, though a tab can host a web app or an SPFx part.",
short: `A **Teams app** is a manifest plus one or more capabilities: **tabs**, **bots**, message extensions or connectors. Identity is [[microsoft-entra-id|Entra ID]]; data is usually [[microsoft-graph|Graph]]. SharePoint UI inside Teams is a different tool: [[sharepoint-framework|SPFx]].`,
aliases: ["Teams development", "Microsoft Teams app", "Teams bot", "Teams tab", "build a Teams app", "Teams manifest", "Teams toolkit", "develop for Microsoft Teams"],
keywords: ["Teams", "bot", "tab", "manifest", "Graph", "Bot Framework", "adaptive card", "sideload"],
related: ["microsoft-graph", "microsoft-365", "microsoft-entra-id", "sharepoint-framework", "azure-fundamentals", "oauth"],
sections: [
["What it is", `Microsoft Teams development means packaging software that appears inside the Teams client. A **tab** is a web page hosted in a channel, a chat, or a personal app. A **bot** converses with users and can post proactive messages. A **message extension** lets people search your system or act on a message. Connectors and incoming webhooks post into a channel. The package is a manifest (JSON) plus icons, sideloaded in a dev tenant or published through the admin center.

This is not the same as building a [[sharepoint-framework|SharePoint Framework]] web part, although a SharePoint page can be shown as a Teams tab and an SPFx part can be exposed to Teams. It is also not "a bot" in the generic chatbot sense until you connect the Bot Framework endpoint and a Microsoft identity.`],
["Why and when it is used", `Build a Teams app when the work already happens in a channel: approving a request without leaving the conversation, finding a customer record from the compose box, or pinning a dashboard beside the files. People adopt tools that show up where the conversation is.

Build a normal web app instead when the audience is outside the tenant or the UI does not fit a narrow tab. Use [[power-platform|Power Automate]] when a flow and an adaptive card are enough. Use SPFx when the primary surface is a SharePoint intranet page and Teams is only a secondary view.`],
["How it works", `The manifest declares the app id, the scopes (personal, team, group chat) and the capabilities. A tab points at an HTTPS URL you host; Teams loads it in an iframe-like web view and can pass context such as the team and channel ids. Your page should authenticate with Entra ID (Teams SSO) rather than asking for a separate password. A bot exposes a messaging endpoint. Azure Bot Service routes activities to that endpoint. You reply with text or adaptive cards, which are JSON UIs Teams renders.

Data about teams, channels and files comes from [[microsoft-graph|Graph]] (\`/teams\`, \`/channels\`, \`/chats\`). The bot's own conversation is not a substitute for Graph permissions. Installing the app in a team requires permission to add apps, which admins can lock down.`],
["Technologies and dependencies", `Typical pieces: the Teams app manifest schema, Teams Toolkit or the Developer Portal to scaffold, a host for the tab (Azure App Service, or any HTTPS host), Entra app registration, Graph permissions, and for bots the Bot Framework SDK plus an Azure Bot registration. Adaptive Cards are the UI language for messages. SPFx enters only if the tab content is a SharePoint web part. Node and TypeScript are the common tab stack; bots can be [[csharp|C#]] or [[nodejs|Node]].`],
["How to get started", `1. Use a developer tenant where sideloading is allowed.
2. Create a tab-only app first. A static page that reads Teams context and shows the channel name proves the manifest, the host and SSO before you add a bot.
3. Register the Entra app the toolkit creates. Confirm the redirect and the client id match the manifest.
4. Call Graph \`GET /me\` with the SSO token flow Teams documents. If consent fails, fix consent before writing features.
5. Add one useful action. Then consider a bot only if conversation is actually the interface.
6. Package the app and upload it in Teams (Manage apps) as a custom app. Install it in a test team. Ask a second user to open it.

Keep the manifest's id stable. Changing it creates a second app and orphans the first install.`],
["Cautions and trade-offs", `Tabs are small and embedded. A desktop website crammed into a tab is a bad Teams app. Bots that talk too much get muted. Application permissions for a bot that "needs to read every channel" will fail security review; design around the team where the app is installed.

SSO tokens have an audience you must get right (often an exchange from the Teams token to a Graph token). Do not log them. Webhook URLs for incoming connectors are secrets: anyone who has the URL can post to the channel. Admins can block custom apps entirely, so an enterprise rollout is an admin conversation, not only a manifest. Finally, do not store the system of record only inside chat messages. Write business data to your database or to Dataverse and post a card that links to it.`],
]
},
{
slug: "azure-fundamentals", title: "Azure Fundamentals for Application Developers", kind: C, group: "Cloud",
question: "What is Microsoft Azure and which services matter for an app?",
summary: "Azure is Microsoft's cloud for compute, data, identity integration and AI hosting. Application teams usually start with App Service or containers, a database, storage, Key Vault and Entra ID, not with every service in the catalog.",
short: `**Azure** is Microsoft's cloud platform: compute, databases, storage, functions and managed AI endpoints. Identity for those apps is usually [[microsoft-entra-id|Entra ID]]. It is not the same product as [[microsoft-365|Microsoft 365]].`,
aliases: ["What is Azure?", "Microsoft Azure", "Azure fundamentals", "Azure for developers", "Azure App Service", "Azure Functions", "when to use Azure", "Azure vs Microsoft 365"],
keywords: ["Azure", "App Service", "Functions", "Key Vault", "Storage", "Azure SQL", "region", "resource group", "IAM"],
related: ["microsoft-entra-id", "microsoft-365", "aws-fundamentals", "gcp-fundamentals", "docker", "environment-variables", "postgresql"],
sections: [
["What it is", `**Microsoft Azure** is a public cloud: you rent compute, storage, databases, networking and higher-level APIs instead of buying servers. Resources sit in a subscription, inside **resource groups**, in a **region** (a geographic cluster of data centres). An App Service plan runs a web app. Azure Functions runs small pieces of code on demand. Azure Storage holds blobs and queues. Azure SQL and PostgreSQL flexible server are managed databases. Key Vault holds secrets and keys. Entra ID, covered separately, is the identity layer most Azure apps use.

Azure is not [[microsoft-365|Microsoft 365]]. M365 is mail, files and Teams. Azure is where you host the system you are building. They connect when your Azure app calls [[microsoft-graph|Graph]] or when a company uses the same [[microsoft-entra-id|Entra ID]] tenant for both.`],
["Why and when it is used", `Choose Azure when the organisation already standardises on Microsoft identity, when you want Microsoft-managed databases and certificates close to M365, or when you are calling Azure OpenAI or other Azure AI services under the same contract. It is a reasonable default for a company that already pays for Microsoft and has admins who know the portal.

It is not automatically better than [[aws-fundamentals|AWS]] or [[gcp-fundamentals|Google Cloud]] for a startup with no Microsoft footprint. Pick the cloud your team can operate. Do not start by enabling twenty services. A small app needs a place to run, a database, a secret store and logs.`],
["How it works", `You authenticate with Entra ID. Role-based access control (RBAC) grants roles such as Contributor on a resource group, which is separate from your application's user login. The control plane (creating a database) is Azure Resource Manager. The data plane (querying that database) uses the database's own connection string and firewall. Confusing those two planes causes "I am Owner on the subscription but the app cannot log in to SQL".

Deployments should be described as infrastructure as code (Bicep or Terraform) so a second environment is not a click-path nobody remembers. Configuration comes from app settings, which appear to the process as [[environment-variables|environment variables]]. Secrets should be references to Key Vault, not values pasted into the portal and forgotten. Outbound calls to Graph or to a model API leave your app and need the right network rules. Private endpoints exist when the database must not face the public internet; they add complexity you should add deliberately.`],
["Technologies and dependencies", `For a typical web or AI backend: App Service or Container Apps, a managed PostgreSQL or SQL database, Storage if you keep files, Key Vault, Application Insights for logs, and an Entra app registration if users sign in. Azure OpenAI is a model-hosting service with its own endpoint and key or Entra credential; it is optional, not the definition of Azure. The Azure CLI (\`az\`) and the portal are how humans operate. [[docker|Containers]] are one way to package the app so local and cloud match. [[cicd|CI]] should deploy the same artifact you tested.`],
["How to get started", `1. Create a dev subscription or a resource group you are allowed to spend in. Set a budget alert.
2. Install the Azure CLI and sign in with \`az login\`.
3. Deploy a tiny web app (App Service or Container Apps) that reads a setting \`MESSAGE\` and returns it. Prove configuration before you prove features.
4. Put a connection string in Key Vault and reference it. Do not commit it.
5. Add a managed database only when you have data. Open the firewall to your IP for learning, then close it.
6. Look at Application Insights or Log Analytics for one failed request so you know where stdout went.
7. Delete the resource group when the experiment ends. Abandoned Azure resources are how learning becomes an invoice.`],
["Cautions and trade-offs", `The portal makes it easy to create resources nobody can rebuild. Click-built production is a risk. Regions and SKUs affect both latency to your users and price; a GPU SKU left running is a surprise bill. "Contributor on the subscription" is too much access for an application identity. Use a managed identity for the app to read Key Vault instead of embedding a secret.

Azure's service names overlap (several ways to run containers, several databases). Standardise on one path for your team. Free tiers sleep or throttle and are not a performance test. Compliance features (regions, private networking, customer-managed keys) are real work; do not promise them because the checkbox exists. And do not put Microsoft 365 tenant data into an Azure storage account without a retention and access story. Hosting the app in Azure does not make that copy compliant.`],
]
},
];
