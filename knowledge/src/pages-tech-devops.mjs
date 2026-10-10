const C = 'concept';
const K = 'comparison';
export const pages = [
{
slug: "git", title: "Git", kind: C, group: "Developer infrastructure",
question: "What is Git and how should a team use it?",
summary: "Git is a distributed version-control system. It records snapshots of a project so you can branch, review, and return to a known state. GitHub is a host for Git repositories, not the tool itself.",
short: `**Git** records changes to a project so you can branch and merge. **[[github|GitHub]]** hosts Git repositories. Commit small, write messages that say why, and do not commit secrets.`,
aliases: ["What is Git?", "Git version control", "learn Git", "Git basics", "Git commit branch merge", "Git vs GitHub", "how Git works"],
keywords: ["Git", "commit", "branch", "merge", "rebase", "repository", "history"],
related: ["github", "cicd", "environment-variables", "package-managers"],
sections: [
["What it is", `**Git** is a distributed version-control system. A **repository** is a folder whose history Git tracks. A **commit** is a snapshot with a message and a pointer to its parent. A **branch** is a movable name for a commit, so two lines of work can proceed. **Merge** joins them. You can work offline because the history is on your machine, then push to a remote that teammates share. [[github|GitHub]] is the most common host. GitLab and others speak the same Git protocol. The host is not Git.

If you only remember one thing: Git is the history of the files. The pull request is a host feature on top.`],
["Why and when it is used", `Use Git for any project you might regret losing or need to explain later, including solo work. Branches let a change be reviewed before it lands on the main line. Bisect and history help you find when a bug appeared. CI systems trigger on Git events ([[cicd]]).

Do not use Git as a backup for large binary assets, model weights, or databases. Those belong in artifact storage. Do not commit [[environment-variables|secrets]]. A secret in history is still in history after you delete the file in a later commit.`],
["How it works", `Git stores content-addressed objects. A commit points at a tree of files. Changing a file and committing creates a new commit; it does not edit the old one. That is why history rewrite (\`rebase\`, force-push) is a team decision: you are replacing commits other people may have. \`git status\` shows what is staged. The index (staging area) lets you commit part of your work. \`diff\` shows the change. Remotes are named URLs. \`push\` and \`pull\` synchronise. A merge commit joins two parents. A fast-forward just moves the branch pointer.

Conflicts happen when two commits edit the same lines. Git marks them. You edit the file to the result you actually want and commit. The conflict is not an error in Git. It is two truths that need a decision.`],
["Technologies and dependencies", `The Git CLI, an editor for commit messages, and a remote host if more than one machine is involved. GUIs are fine if you can still see the graph. \`.gitignore\` keeps build output and \`.env\` files out. Signing commits is optional and useful in some orgs. Your CI credentials are separate from your Git identity.`],
["How to get started", `1. \`git init\` a folder or clone a repository you may write to.
2. Set a user name and email for commits if they are unset. Make a tiny change. \`git add\` the file and \`git commit\`.
3. Create a branch, change the file again, and merge it back. Read the log as a graph (\`git log --oneline --graph\`).
4. Add a \`.gitignore\` for dependencies and \`.env\`. Confirm \`git status\` does not show secrets.
5. If you use a remote, push the branch and open a pull request rather than committing straight to main once more than one person is involved.
6. Practice recovering: create a commit, then look at it with \`git show\`. Know that \`git reset --hard\` throws away uncommitted work.

Read a tutorial that makes you use the CLI for a day even if you later prefer a GUI. The vocabulary is the CLI's vocabulary.`],
["Cautions and trade-offs", `Force-pushing shared branches deletes other people's commits. Do not do it on main. Rebase is pleasant on your own branch and hostile on a branch someone else has checked out. Large files make every clone slow forever.

Commit messages that say "fix" or "wip" waste the history. Say why. And do not solve a bad commit with a second commit that contains your \`.env\`. Remove the secret from history with the understanding that anyone who cloned it already has it, then rotate the credential. History rewrite does not rotate a key.`],
]
},
{
slug: "github", title: "GitHub", kind: C, group: "Developer infrastructure",
question: "What is GitHub and how is it different from Git?",
summary: "GitHub is a website and service that hosts Git repositories and adds pull requests, issues, actions and access control. Git is the tool. GitHub is one place teams push Git history and review it.",
short: `**GitHub** hosts **[[git|Git]]** repositories and adds pull requests, issues, and Actions for [[cicd|CI]]. It is not the version-control system itself. Your clone still works if the website is slow.`,
aliases: ["What is GitHub?", "GitHub", "Git Hub", "GitHub vs Git", "pull request", "GitHub Actions", "GitHub repository"],
keywords: ["GitHub", "pull request", "Actions", "issue", "repository", "code review", "remote"],
related: ["git", "cicd", "package-managers", "environment-variables"],
sections: [
["What it is", `**GitHub** is a hosted service for [[git|Git]] repositories, owned by Microsoft. A repository on GitHub is a remote your local Git can \`push\` to and \`fetch\` from. Around that remote, GitHub adds **pull requests** (a branch proposed for review), **issues**, code review comments, permissions, and **GitHub Actions** for automation. Those extras are not part of Git. GitLab, Bitbucket and a bare server you run yourself can host the same Git objects with different buttons.

When someone says "commit it to GitHub", they mean commit with Git and push to a GitHub remote. The commit happens locally first.`],
["Why and when it is used", `Use GitHub when your team already does, when you want hosted review and CI, or when you depend on open-source projects that live there. Pull requests are the usual gate before merging to the default branch. Actions run tests on those requests if you configure them ([[cicd]]).

You do not need GitHub to use Git. A single player can commit locally forever. You do need some remote if two computers must share history and you do not want to pass patches by hand. Choose the host your organisation trusts with the source code. Private repositories are still source code on someone else's computers; read the agreement if the code is sensitive.`],
["How it works", `You authenticate with SSH keys or a personal access token (or the \`gh\` CLI's login). HTTPS passwords for Git operations were removed; a token is not your GitHub password pasted into a URL. A pull request compares a branch to a base branch and shows the diff. Reviews can be required by branch protection: no merge until checks pass and a person approves. Actions workflows are YAML files in \`.github/workflows\`. They run on GitHub's runners or yours, with permissions you should narrow.

Issues and pull requests are not a project plan by themselves. They are a log of decisions if you write them that way. The default branch (often \`main\`) is what clones check out. Protect it.`],
["Technologies and dependencies", `A GitHub account, a repository with a clear owner, and Git locally. The \`gh\` CLI is optional and useful. Actions minutes and storage have limits. Secrets for CI live in the repository or organisation settings, not in the YAML. [[package-managers|Packages]] can be published to GitHub's registry; that is separate from source hosting. [[environment-variables]] on your laptop are still yours; Actions secrets are the CI equivalent.`],
["How to get started", `1. Create an empty private repository. Do not initialise it with a README if you already have a local repo you plan to push, or you will merge two unrelated histories.
2. Add the remote and push your default branch.
3. Branch, commit, push, and open a pull request. Merge it with the button only after you have seen the diff.
4. Add a workflow that runs your tests on pull requests. Start with one command.
5. Turn on branch protection for the default branch once the check is real.
6. Invite a second person with the least access they need, not admin out of habit.

If a token appears in a remote URL in an error message, revoke it and create a new one. URLs get copied into tickets.`],
["Cautions and trade-offs", `A public repository is public, including issues and commit history. Do not "temporarily" push secrets. Forks of public repos can receive pull requests that try to run malicious CI; do not expose secrets to workflows from forks.

Admin access is not a courtesy. It can delete the repository and change protections. Actions workflows can be a supply-chain risk if they run third-party actions you have not pinned to a commit SHA. Pin them when the pipeline matters. And GitHub being down does not delete your local clones. It does stop hosted CI and new clones. Keep the source of truth recoverable, and do not treat a single hosted issue tracker as the only record of why a change was made.`],
]
},
{
slug: "docker", title: "Docker", kind: C, group: "Developer infrastructure",
question: "What is Docker and when should I containerise an app?",
summary: "Docker is a tool for building and running containers: a packaged process with its filesystem. Use it to make local and production environments match. Do not use it to hide a broken build, and do not run everything as root.",
short: `**Docker** builds and runs **[[containers|containers]]** from a Dockerfile. Use it so the app runs with the same OS libraries everywhere. A container is not a virtual machine, and an image is not a backup of your database.`,
aliases: ["What is Docker?", "Docker", "Dockerfile", "docker compose", "how to containerise", "Docker image", "Docker vs VM"],
keywords: ["Docker", "Dockerfile", "image", "container", "compose", "registry"],
related: ["containers", "cicd", "nodejs", "python", "environment-variables", "github"],
sections: [
["What it is", `**Docker** is the most common tool for building and running [[containers|containers]]. A **Dockerfile** is a recipe: start from a base image, copy files, install dependencies, set a command. \`docker build\` produces an **image**. \`docker run\` starts a **container**, a process (plus its children) isolated with that image's filesystem. **Docker Compose** runs several containers together for local development: an app and a database, for example.

Docker is not the only container runtime. Podman and others exist. Kubernetes is an orchestrator that runs containers, often built by Docker or a compatible builder. This page is the developer tool. The concept of isolation is the containers page.`],
["Why and when it is used", `Use Docker when "works on my machine" is about system libraries, language versions, or a dependency you do not want to install globally. Use it so CI and production build the same image. Use Compose when local development needs Postgres and Redis beside the app.

Do not containerise a trivial script you run once. Do not treat a container as a security boundary against untrusted code you would not otherwise trust; it is isolation, not a magic sandbox, and misconfiguration is common. Do not put the database's only data inside a container's writable layer without a volume. When the container is removed, that layer can go with it.`],
["How it works", `Images are layers. Each Dockerfile instruction can create a layer, and unchanged layers are cached. Order the file so dependencies install before you copy source that changes every commit; otherwise every build reinstalls the world. The container shares the host's kernel. It does not boot a second operating system (that would be a virtual machine). Port mapping (\`-p 8080:8080\`) publishes a port. Environment variables configure the process. A volume mounts a host or named directory into the container so data outlives it.

The default user in many images is root. Your process then runs as root inside the container, which is a bigger blast radius if the app is compromised. Set a user. \`.dockerignore\` keeps secrets and \`node_modules\` out of the build context. A secret copied into an image layer remains in the layer even if a later instruction deletes the file.`],
["Technologies and dependencies", `Docker Engine or a compatible runtime, a Dockerfile, and a registry (GitHub Container Registry, ECR, Artifact Registry, Docker Hub) if you deploy elsewhere. [[cicd|CI]] should build and push. [[environment-variables]] or a secret manager supply configuration at run time, not at image-build time, for anything sensitive. Base images need updates; pin by digest when you need reproducibility, and still rebuild for patches.`],
["How to get started", `1. Install Docker. Run the hello-world image to prove the daemon works.
2. Write a Dockerfile for a tiny app that listens on a port. Use a small base image, not a desktop OS.
3. Build and run it. Map the port. Call the health endpoint.
4. Change source and rebuild. If the dependency layer reran, reorder the Dockerfile.
5. Add a \`.dockerignore\`. Confirm a \`.env\` file did not enter the image (\`docker history\` and a careful look, or a scan).
6. Add Compose only when you need a second process. Mount a volume for database files and restart to prove the data survives.

Tag images with the Git SHA you built, not only \`latest\`. \`latest\` is not a version.`],
["Cautions and trade-offs", `Images grow when you install build tools and leave them in the final stage. Multi-stage builds keep the compiler out of production. Running as root, mounting the Docker socket into a container, and using \`--privileged\` are decisions with security consequences, not defaults.

Registries are public unless you make them private. A pushed image with a secret is a leaked secret. Compose files that bake passwords into the YAML get committed. And containers do not remove the need to understand the process. If the app ignores \`SIGTERM\`, your deploys will cut requests. Handle shutdown. Docker is packaging and process isolation, not an architecture.`],
]
},
{
slug: "containers", title: "Containers", kind: C, group: "Developer infrastructure",
question: "What is a container and how is it different from a virtual machine?",
summary: "A container is a process, or a small group of processes, isolated with its own filesystem view, using the host kernel. A virtual machine emulates a whole computer and boots its own kernel. Containers are the usual way to ship a service.",
short: `A **container** packages a process and its filesystem so it runs the same way on different machines. It shares the host kernel. A **virtual machine** includes its own kernel. [[docker|Docker]] is the common tool for building containers, not the definition.`,
aliases: ["What is a container?", "containers vs virtual machines", "container vs VM", "OCI container", "what is containerisation", "Linux containers", "Docker vs VM", "docker versus a virtual machine"],
keywords: ["container", "namespace", "cgroup", "image", "VM", "OCI", "isolation"],
related: ["docker", "cicd", "azure-fundamentals", "aws-fundamentals", "gcp-fundamentals"],
sections: [
["What it is", `A **container** is an isolated process (often with child processes) that sees its own filesystem, its own network interface, and limits on CPU and memory. The filesystem comes from an **image**, a stack of layers built from a recipe. The host's kernel runs the process. There is no second operating system boot. The standards name you will see is **OCI** (the Open Container Initiative): images and runtimes that agree on a format so [[docker|Docker]] is not the only implementation.

A **virtual machine** emulates hardware and runs a guest kernel. It is heavier and a stronger boundary in some threat models. Containers start in milliseconds and pack more densely because they share the kernel. That sharing is the performance win and the security caveat.`],
["Why and when it is used", `Use containers when you want a repeatable deploy unit: the same image in CI, staging and production, with configuration injected outside the image. Use them when orchestrators (Kubernetes, Cloud Run, ECS, Container Apps) are how your platform runs services. Use a VM when you need a different kernel, a stronger isolation boundary, or a legacy OS the process cannot leave.

Do not containerise data as a substitute for backups. Do not assume a container escape is impossible. Do not run a dozen unrelated processes in one container; one service per container keeps restarts and logs sane.`],
["How it works", `Namespaces in Linux hide process ids, mounts and networks. Cgroups limit resources. The runtime (containerd, and Docker's use of it) unpacks the image and starts the process with those controls. The image does not include the kernel. A container that needs a GPU needs the host's drivers mounted in a specific way. Logging should be stdout and stderr so the platform collects them. A restart policy brings the process back; it does not fix a crash loop.

Orchestrators schedule containers onto machines, attach them to networks, and inject secrets at runtime. You can use containers without an orchestrator: one host, one runtime, a few processes. That is a valid production for a small system if you handle updates and disk.`],
["Technologies and dependencies", `A runtime, an image builder, and a registry. [[docker]] is the usual developer entry. The cloud pages ([[azure-fundamentals]], [[aws-fundamentals]], [[gcp-fundamentals]]) each have a way to run the resulting image. [[cicd]] builds it. Configuration is [[environment-variables]] or mounted files. Your application remains responsible for its own health check.`],
["How to get started", `1. Read a Dockerfile and name the process it will start. If you cannot name the process, the image is a junk drawer.
2. Build and run it locally. Limit its memory. Watch what happens when the limit hits.
3. Stop it with a normal stop and confirm the app handles the signal.
4. Push the image to a private registry and run it on a second machine. The second machine should not need your language toolchain.
5. Delete the container and confirm whether your data survived. If it should have, it needed a volume or an external database.
6. Only then look at an orchestrator.

If step 4 fails because the image assumed your laptop's CPU architecture, pin the platform. Apple silicon builds do not always run on AMD64 servers.`],
["Cautions and trade-offs", `Containers feel like VMs and are not. A kernel vulnerability is shared. A mis-set capability or a mounted docker socket gives the container control of the host. Root inside the container is still a risk. Read-only filesystems and a non-root user are reasonable defaults.

Image sprawl and unscanned base images accumulate CVEs. Rebuild regularly. And orchestration adds a distributed system. If you have one server, a simple runtime and a reverse proxy may be the whole platform. Do not adopt Kubernetes because a container tutorial's last chapter assumed it.`],
]
},
{
slug: "cicd", title: "CI and CD", kind: C, group: "Developer infrastructure",
question: "What is CI/CD?",
summary: "Continuous integration automatically builds and tests every change. Continuous delivery prepares a deployable artifact; continuous deployment ships it. The point is a repeatable pipeline, not a YAML file that nobody trusts.",
short: `**CI** builds and tests each change. **CD** delivers or deploys the artifact that passed. Start with one pipeline that runs tests on a pull request. Do not deploy from a laptop once more than one person can break production.`,
aliases: ["What is CI/CD?", "CI CD", "continuous integration", "continuous delivery", "continuous deployment", "CI pipeline", "what is CI"],
keywords: ["CI", "CD", "pipeline", "GitHub Actions", "test", "deploy", "artifact"],
related: ["github", "git", "docker", "environment-variables", "containers"],
sections: [
["What it is", `**Continuous integration (CI)** means every change is merged into a shared branch often and is built and tested automatically when it is proposed. **Continuous delivery** means the result of that pipeline is an artifact you can release at any time, with a human usually pressing the button. **Continuous deployment** means a green pipeline deploys itself. People say **CI/CD** for the whole idea and then argue about the second C. The useful distinction is: tests on every change, and a deploy path that is not "SSH in and pull".

The pipeline is code, often YAML in [[github|GitHub]] Actions, GitLab CI, or a cloud build service. It is not a person running \`npm test\` and then deploying from a laptop, even if that person is reliable.`],
["Why and when it is used", `Use CI as soon as two people, or one person on two days, can forget a step. A red build should mean "this change fails tests", not "the agent is out of disk". Use CD when production deploys have ever depended on someone's local Node version or a forgotten migration.

You do not need a complex pipeline for a static page. You do need one before you have a database migration and a secret and a second environment. Start smaller than the diagrams. One job that installs dependencies, runs tests, and fails the pull request is a real CI system.`],
["How it works", `A trigger (pull request, push to main, a tag) starts a clean runner. The runner checks out the commit, installs toolchains, and runs commands you listed. Caches speed installs and can also poison you if they never invalidate. Artifacts (a test report, a container image, a zip) are stored. A later job or a manual approval deploys that artifact. The deploy should use the image or package the tests already built, not rebuild from a different commit.

Secrets are injected as environment variables or files and must not be printed. Branch protections stop a merge when the check is red. Environments (staging, production) can require different approvals. A migration runs as a step you can identify, not as a side effect of app startup that two instances attempt at once.`],
["Technologies and dependencies", `A Git host, a CI service, and scripts that work non-interactively. [[docker|Containers]] are a common artifact. [[git]] is how the change arrives. [[environment-variables]] and the CI system's secret store configure deploy steps. Flaky tests are a dependency you must not ignore; a pipeline people rerun until it is green is not a signal.`],
["How to get started", `1. Pick the one command that means "tests passed" on a laptop. Make it non-interactive.
2. Add a workflow that runs it on pull requests using a clean checkout.
3. Require that check before merge.
4. Make the workflow build an artifact. Save it. Do not deploy yet.
5. Add a staging deploy of that same artifact, triggered manually.
6. When staging is boring, automate production with the approval you actually want.

Pin third-party actions and tool versions. A pipeline that installs "latest" will break on a Tuesday you did not choose.`],
["Cautions and trade-offs", `A green pipeline that skips tests is theatre. A pipeline that deploys a different commit than it tested is how "CI passed" and production is wrong. Long pipelines that take forty minutes train people to bypass them.

Secrets in logs, overly broad cloud credentials on the runner, and pull requests from forks that can read secrets are the security failures. Least privilege applies to CI identities. And do not confuse frequent deploys with careless ones. The point of CD is that deploy is small and reversible, which requires migrations that expand safely and a way to roll back the artifact. If you cannot roll back, you do not have continuous delivery. You have continuous hope.`],
]
},
];
