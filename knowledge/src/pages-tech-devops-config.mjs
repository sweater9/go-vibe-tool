const C = 'concept';
const K = 'comparison';
export const pages = [
{
slug: "environment-variables", title: "Environment Variables", kind: C, group: "Developer infrastructure",
question: "What are environment variables and where should secrets live?",
summary: "Environment variables are named strings a process inherits from whoever started it. They are the standard way to configure an app per environment. Secrets can live there at runtime, but they must not live in git, images, or client bundles.",
short: `**Environment variables** configure a process per environment. Use them for ports, URLs and, at runtime, secrets injected by the platform. Do not commit \`.env\` files with real secrets. The browser is not an environment you control.`,
aliases: ["environment variables", "env vars", "what is an environment variable", ".env file", "12 factor config", "where to put API keys", "config vs secrets"],
keywords: ["environment variable", "dotenv", ".env", "secret", "config", "process env"],
related: ["api-keys", "docker", "cicd", "github", "frontend-and-backend", "nodejs", "python"],
sections: [
["What it is", `An **environment variable** is a name and a string in the environment of a process. Child processes inherit a copy. On a laptop you might set \`PORT=3000\` in a shell. In production the platform sets it when it starts the app. Code reads \`process.env.PORT\` in Node or \`os.environ\` in Python. A **\`.env\` file** is a convenience that a library loads into the environment during local development. The file is not magical and is not automatically present in production.

The twelve-factor idea is: configuration that changes between deploys (dev, staging, production) belongs in the environment, not in code branches. Secrets are configuration too, but they are configuration you must not scatter.`],
["Why and when it is used", `Use environment variables for the database URL, the listen port, the log level, the model name, and the base URL of an API. Use them so the same image runs in two environments. Use a secret manager (cloud secret stores, CI secret settings) to supply the sensitive ones at the start of the process.

Do not use environment variables for data that is not configuration, and do not use them as a database. Do not put secrets in a \`.env\` that is committed, in a Dockerfile \`ENV\` for a real key, or in a frontend build argument that gets baked into JavaScript. [[frontend-and-backend]] is why: the browser is the user's machine.`],
["How it works", `The parent process (your shell, systemd, a container runtime, a CI runner) passes a block of strings. The app reads them at startup. A missing variable should fail startup if the app cannot run without it. A default is appropriate for a port in local dev and dangerous for a "default" production password. \`.env\` loaders do not override variables already set, or they do, depending on the library; know which, or you will debug the wrong value.

Variables are strings. \`"false"\` is true in some boolean checks because a non-empty string is truthy. Parse deliberately. They are visible to the process and often to anything that can read \`/proc\` on the same host or inspect the orchestrator's pod spec. They are not encrypted at rest inside the process. A crash dump or a naive debug endpoint that prints the environment is a leak.`],
["Technologies and dependencies", `The runtime's environment API, a local \`.env\` that is gitignored, and the platform's config screen or secret store. [[docker]] can pass variables at \`run\` time. [[cicd]] injects them into deploy jobs and must mask them in logs. [[github]] Actions uses encrypted secrets. [[api-keys]] explains the kind of value that most often ends up here by mistake in a screenshot.`],
["How to get started", `1. List what differs between your laptop and production. Those names are your configuration.
2. Read them in one module that crashes with a clear message if a required name is missing. The rest of the app takes a config object, not scattered \`process.env\` reads.
3. Add \`.env\` to \`.gitignore\`. Add \`.env.example\` with empty values and comments so teammates know the names.
4. Set the real values in your shell or a local \`.env\` you do not commit. Run the app.
5. In CI, set them in the secret store. Print only whether a variable is present, never the value.
6. Rotate anything that was ever committed, even "just for a second".

If a framework prefixes variables with \`NEXT_PUBLIC_\` or similar, assume that prefix means "this will ship to the browser".`],
["Cautions and trade-offs", `\`.env\` files get pasted into chat. Treat chat as public. Multi-line secrets and quotes break naive parsers. A variable set in the systemd unit and a different one in the shell you used for debugging means you tested the wrong config.

Environment variables are a poor fit for values that change every minute or that are larger than a secret. They are also inherited by subprocesses. A library that shells out may leak them into a child that logs its environment. And do not invent your own crypto in a config file when the platform already has a secret store. The goal is one obvious place a new teammate looks, and a guarantee that place is not the git history.`],
]
},
{
slug: "package-managers", title: "Package Managers", kind: C, group: "Developer infrastructure",
question: "What is a package manager and why do lockfiles matter?",
summary: "A package manager installs libraries and records versions. npm, pip, Cargo and NuGet are examples. A lockfile pins the tree so tomorrow's install matches today's. Installing global packages at random is how machines drift.",
short: `A **package manager** installs libraries: **npm** for JavaScript, **pip** for Python, **Cargo** for Rust, **NuGet** for .NET. Commit the **lockfile**. Do not commit \`node_modules\` or trust an install script you have not thought about.`,
aliases: ["What is a package manager?", "package managers", "npm vs pip", "lockfile", "npm install", "what is npm", "dependency management"],
keywords: ["npm", "pip", "Cargo", "NuGet", "lockfile", "dependency", "semver"],
related: ["nodejs", "python", "javascript", "typescript", "git", "cicd", "github"],
sections: [
["What it is", `A **package manager** downloads libraries, puts them where the language can import them, and records which versions you asked for. **npm** (and compatible clients such as pnpm and Yarn) serves JavaScript. **pip**, plus tools like uv or Poetry, serves Python. **Cargo** serves Rust. **NuGet** serves .NET. **Maven** and **Gradle** serve the JVM. The ideas are the same even when the commands differ.

A **manifest** (\`package.json\`, \`requirements\` or \`pyproject.toml\`, \`Cargo.toml\`) states your direct dependencies, often as a version range. A **lockfile** records the exact tree that was resolved, including transitive dependencies you did not name. [[git|Git]] should store the manifest and the lockfile. It should not store \`node_modules\` or a virtualenv.`],
["Why and when it is used", `Use the package manager whenever you import code you did not write. Pinning is how [[cicd|CI]] and a teammate's laptop install the same bytes. Ranges (\`^1.2.0\`) let you take patches; the lockfile stops those ranges from moving silently between two installs.

Do not copy a library's source into your repo to "avoid dependencies" unless it is truly tiny and you will maintain it. Do not install everything globally. Global installs are convenient for CLIs and poisonous for libraries a project needs at a specific version. Do not run install scripts from untrusted packages on a machine that has production credentials.`],
["How it works", `The client asks a registry for metadata, solves versions against ranges, downloads archives, and checks integrity hashes. The lockfile stores those hashes. A later install uses the lockfile if you tell it to (\`npm ci\` rather than a loose install). Transitive dependencies are the ones your dependencies need. They are still code that runs. Semantic versioning is a social contract: a major bump may break you, and some authors get it wrong. Your tests are the real check.

Registries can be public or private. A private feed matters when the code is yours. Scopes and organisations in [[github|GitHub]] packages or a cloud artifact registry are how companies avoid publishing internal libraries to the world. Authentication to a private registry is a secret and belongs in the environment, not the repository.`],
["Technologies and dependencies", `The manager that matches the language, a lockfile committed to git, and CI that installs from the lockfile. [[nodejs]] ships with npm. Python needs a decision about venv plus pip, or a newer resolver, and then you stick to it. Mixing two Python installers in one project is how you get two copies and an import of the wrong one. Supply-chain tools (audit commands, pinned SHAs) are optional until the project matters, and then they are not optional.`],
["How to get started", `1. In a new project, let the official tool create the manifest. Do not hand-type a half file.
2. Add one dependency you actually import. Commit the manifest and the lockfile.
3. Delete the install directory and install again from the lockfile. The import should work.
4. In CI, use the clean install command (\`npm ci\` or the equivalent). Do not let CI resolve ranges afresh if the lockfile exists.
5. When you update, update on purpose, run tests, and commit the new lockfile in the same change.
6. Read the top of a dependency before you add it if it will run in production. A 40-dependency tree for a left-pad is a choice.

If two people are on different major versions of the language runtime, the package manager will not save you. Pin the runtime too ([[environment-variables]] and CI images).`],
["Cautions and trade-offs", `\`npm install\` on a developer laptop can update the lockfile. \`npm ci\` will not. Use the strict one in CI. Install scripts can run arbitrary code at install time. That is normal for native modules and abused by malware. Look at new dependencies with that in mind.

Typosquatting publishes a name one character off a popular package. Copy names carefully. Committing \`node_modules\` bloats the repo and still does not pin transitive integrity as well as a lockfile. And a green audit report is not a design. Remove dependencies you do not use. The smallest reliable set is the one you can update when the next advisory arrives.`],
]
},
{
slug: "aws-fundamentals", title: "AWS Fundamentals for Application Developers", kind: C, group: "Cloud",
question: "What is AWS and which services matter for an app?",
summary: "Amazon Web Services is a cloud platform: compute, storage, databases and managed APIs in regions and accounts. Most new apps need a place to run, a database, object storage, identity and logs, not the full catalog.",
short: `**AWS** is Amazon's cloud. Start with an account boundary, a region, compute (App Runner, ECS, or Lambda), a database, **S3** for files, and **IAM** for permissions. It is one of three common clouds, beside [[azure-fundamentals|Azure]] and [[gcp-fundamentals|GCP]].`,
aliases: ["What is AWS?", "Amazon Web Services", "AWS fundamentals", "AWS for developers", "what is IAM", "what is S3", "AWS vs Azure"],
keywords: ["AWS", "IAM", "S3", "EC2", "Lambda", "region", "account", "RDS"],
related: ["azure-fundamentals", "gcp-fundamentals", "docker", "containers", "environment-variables", "postgresql"],
sections: [
["What it is", `**Amazon Web Services (AWS)** is a public cloud: on-demand compute, storage, databases and higher-level APIs, billed largely by use. An **account** is the hard boundary for billing and, by default, for permissions. A **region** is a geography. Resources you create in one region are not automatically in another. **IAM** is the identity system for humans and for services. **EC2** is a virtual machine. **Lambda** runs a function. **ECS** and **App Runner** run [[containers|containers]]. **S3** stores objects (files). **RDS** runs managed relational databases including [[postgresql|PostgreSQL]].

You do not need all of these. AWS is not [[azure-fundamentals|Azure]] and not [[gcp-fundamentals|Google Cloud]], though the shapes rhyme: compute, data, identity, logs.`],
["Why and when it is used", `Choose AWS when the team or the company already standardised on it, when a service you need is strongest there, or when the hiring pool around you is AWS-shaped. It is a fine default and not a required one. A small app can also live on a single server. Cloud is a trade of operational control for someone else's data centres and a bill that tracks usage.

Do not start by enabling every service in a tutorial's architecture diagram. Do not put production in the same account as a personal experiment if you can avoid it. Account boundaries are the easiest isolation you will ever get.`],
["How it works", `You sign in as an IAM user or via single sign-on, then assume a role. Policies allow or deny actions on resources. The application should not run with your personal admin keys. Give it a role that can touch the one bucket and the one database it needs. The data plane is separate: S3 policies, database passwords or IAM authentication, security groups that control network access. A security group is a firewall, not an application login.

Infrastructure as code (CloudFormation, Terraform, CDK) records what you created. The console is a way to learn and a way to create snowflakes. Logs and metrics (CloudWatch is the common default) are how you see a failure after the process exits. Regions and availability zones matter when you promise resilience; one instance in one zone will go down with that zone.`],
["Technologies and dependencies", `An account with a budget alarm, the AWS CLI, and IAM that is not the root user. Root is for rare account tasks and should have MFA and no daily use. Compute of one kind, RDS or another database if you have data, S3 if you have files, and a secret store (SSM Parameter Store or Secrets Manager) instead of keys in git. [[docker]] if you ship containers. [[environment-variables]] come from the task definition or the platform, filled from the secret store.`],
["How to get started", `1. Create an account. Turn on MFA for root. Create an admin IAM user or SSO for yourself. Stop using root.
2. Set a budget alert before you create resources.
3. In one region, run a tiny container or function that returns the value of a configuration variable.
4. Create an S3 bucket with block-public-access left on. Upload a file. Read it from the app using a role, not a long-lived key on your laptop copied into production.
5. Delete the experiment or you will pay for it next month.
6. Write down the account id and region in the README. "It is in AWS" is not a location.

If a tutorial tells you to paste \`AWS_ACCESS_KEY_ID\` into a shell rc file and never rotate it, do not. Use a short-lived login.`],
["Cautions and trade-offs", `Public S3 buckets and open security groups are the classic incidents. Private by default. IAM wildcards (\`*\`) on production roles mean the app can do more than you think, including things that cost money.

Bills grow from idle load balancers, NAT gateways, unused elastic IPs and log retention you never set. Look at the bill. Multi-account setups (one account per environment) are worth it once a second environment exists. And do not treat AWS service names as an architecture. "We use Lambda, SQS, Dynamo, API Gateway and Step Functions" can be a small workflow or an unmaintainable mesh. Name the request path in one sentence before you add a service.`],
]
},
{
slug: "gcp-fundamentals", title: "Google Cloud Fundamentals for Application Developers", kind: C, group: "Cloud",
question: "What is Google Cloud and which services matter for an app?",
summary: "Google Cloud (GCP) is a public cloud organised into projects. Application teams usually need Cloud Run or another compute option, a database, Cloud Storage, IAM, and logs. BigQuery and Vertex are optional, not the starting point.",
short: `**Google Cloud (GCP)** groups resources into **projects**. **Cloud Run** runs containers, **Cloud Storage** holds objects, and **IAM** grants permissions. Compare with [[aws-fundamentals|AWS]] and [[azure-fundamentals|Azure]] by what your team can operate, not by slogans.`,
aliases: ["What is GCP?", "Google Cloud", "Google Cloud Platform", "GCP fundamentals", "Cloud Run", "GCP vs AWS", "what is Google Cloud"],
keywords: ["GCP", "Google Cloud", "project", "Cloud Run", "IAM", "Cloud Storage", "BigQuery"],
related: ["aws-fundamentals", "azure-fundamentals", "docker", "containers", "environment-variables", "postgresql"],
sections: [
["What it is", `**Google Cloud**, often called **GCP**, is Google's public cloud. Resources live in a **project**, and projects live in folders and organisations if a company has set that up. The project is the unit of billing and of enabling APIs. **IAM** grants roles to users and to service accounts. **Cloud Run** runs a [[containers|container]] as an HTTP service. **Compute Engine** is a virtual machine. **Cloud Storage** stores objects. **Cloud SQL** manages relational databases. **BigQuery** is an analytics warehouse, not your application's transactional database. **Vertex AI** is the umbrella for many of Google's hosted model and ML tools.

The shape matches [[aws-fundamentals|AWS]] and [[azure-fundamentals|Azure]]: identity, compute, data, logs. The names differ. Picking a cloud because one service is nicer is reasonable. Picking one because a diagram used its colours is not.`],
["Why and when it is used", `Choose GCP when the organisation already uses it, when Cloud Run's model fits a container you want on the internet quickly, or when your data and analytics path is already BigQuery. Choose it for a specific AI API only after you have read where prompts are processed and stored. A startup can be happy on GCP, AWS or Azure. The failure mode is using all three by accident because three teams each had a credit.

Do not enable a project per experiment and then lose them. Name projects. Attach billing alerts. A project with no owner is how a key survives a former employee.`],
["How it works", `You authenticate with a user account or a **service account**. Application code on Cloud Run should use the runtime service account, not a JSON key downloaded to a laptop and copied into the image. APIs are off until you enable them, which is surprising the first time a call returns that the API is disabled. Region matters for latency and for where data sits. Cloud Run scales copies of your container, including to zero if you allow it; cold starts are the trade. Environment variables and secrets (Secret Manager) configure the container at deploy time.

IAM roles are broad (\`Owner\`, \`Editor\`) or specific. Editor on a project is not a reasonable runtime identity. Logs go to Cloud Logging. If you do not look at them once during the prototype, you will not know how when production fails.`],
["Technologies and dependencies", `A project, billing with an alert, the \`gcloud\` CLI, and IAM that does not rely on a long-lived JSON key. A container if you use Cloud Run ([[docker]]). A database if you have state. [[environment-variables]] and Secret Manager for configuration. The same application can run elsewhere; do not import GCP client libraries into code that only needs a Postgres connection string.`],
["How to get started", `1. Create a project with a name you will recognise. Set a budget alert.
2. Install \`gcloud\`, log in, and set the project as the default so you do not create resources in the wrong place.
3. Deploy a small container to Cloud Run that returns a configuration value. Give it a service account with no extra roles.
4. Add a secret in Secret Manager and mount it. Confirm the value is not in the image.
5. Open the logs and find the request.
6. Delete the service when the experiment ends, or expect the bill for idle minimum instances if you set them.

Do not download a service-account key "because the tutorial did" if the runtime can use an attached identity. Keys leak.`],
["Cautions and trade-offs", `Project IAM is easy to make wider than the task. A key file committed once is a permanent credential until you revoke it. Public buckets and allUsers bindings on storage are the usual data leaks. Check them.

Cloud Run's simplicity hides a few sharp edges: request timeouts, body size limits, and concurrency (one container handling many requests) which will break an app that stores user state in a global variable. BigQuery is the wrong place for row-by-row transactional updates. And Google Cloud's product names change. Learn the idea (run a container, store an object, grant a role) so a rename does not erase your mental model. The same advice applies to every cloud on this site.`],
]
},
];
