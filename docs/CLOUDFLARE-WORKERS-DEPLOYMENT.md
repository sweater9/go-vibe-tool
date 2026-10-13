# Cloudflare Workers deployment (GoVibeTool V8)

Status: repository side is complete and tested. **Nothing has been deployed by these changes.** PR #11 stays draft and unmerged; `main`, production, DNS, custom domains, AdSense, IntelliTools and the Mahjong backend are untouched.

There are two separate failures, with two separate causes.

## Failure A — 129 MiB asset (fixed in the repository)

With no Wrangler config, `wrangler deploy` auto-detected a static site and uploaded the repository root, which by then contained `node_modules/workerd/bin/workerd` (129 MiB; limit 25 MiB), plus tests, docs and server code. The build now writes a clean `dist/` from an explicit allowlist and `wrangler.jsonc` points `assets.directory` at `./dist`.

| File | Purpose |
| --- | --- |
| `wrangler.jsonc` | Worker `go-vibe-tool` (the dashboard project). Assets only: `./dist`, `404-page`, `auto-trailing-slash`. |
| `wrangler.preview.jsonc` | Worker `go-vibe-tool-v8-preview` (isolated preview). Same assets; no routes, custom domains, zones or bindings. |
| `scripts/build-static.mjs`, `site-manifest.mjs` | `npm run build`: allowlist copy into `dist/`, then verification. Node built-ins only. |
| `scripts/verify-dist.mjs` | `npm run verify:dist`: 25 MiB / 20,000-file limits, forbidden paths, reference closure, service-worker precache, sitemap. |
| `scripts/serve-dist.mjs` | `npm run preview`: local server with Cloudflare-style routing. |
| `sw.js` | Stores plain (non-redirected) responses, so offline navigation works behind Cloudflare's `/x/index.html` -> `/x/` redirect. Cache `govibetool-v8-5`. |

Output today: 378 files, about 8.7 MiB, largest file about 1.3 MiB.

## Failure B — `npm error Missing script: "build"`

### Confirmed evidence

| Fact | How it was checked |
| --- | --- |
| The `build` script was introduced in commit `e9c4c66` (21:58 UTC on 12 Oct) and exists only on `feature/v8-discovery-navigation`. | `git log -S` on `package.json` |
| `origin/main` (tip `479afb2`, 11 Oct) has **no** `build` script, no `wrangler.jsonc` and no `scripts/` directory. | `git show origin/main:package.json`, `git ls-tree` |
| `e9c4c66` is contained only in `origin/feature/v8-discovery-navigation`, never in `main`. | `git branch -r --contains` |
| The branch head contains the script and `wrangler.jsonc` with `"directory": "./dist"`; nothing later removed them. | `git show origin/feature/v8-discovery-navigation:...` |
| The first `go-vibe-tool` Worker was created at 21:39 UTC, **before** any commit with a build script existed; the Worker was recreated at 22:15 UTC. | Cloudflare Workers list (read-only) vs commit times |
| The Cloudflare tooling available here exposes Worker metadata only. It does **not** expose build logs, build triggers or the commit a build checked out. | Cloudflare MCP: list/get Worker only |

### Conclusion

Any build of a revision without `e9c4c66` fails with exactly this error, because `npm run build` has nothing to run. `main` is such a revision, and failed deployments associated with `main` were reported. Dashboard settings showing the feature branch do not prove that a given build used it: a manual or retried deployment re-runs the commit it was created for.

### Hypotheses that cannot be confirmed from the repository

1. The project's Git connection builds `main` (the repository default) for some or all deployments, regardless of the "production branch" label.
2. A manual "Deploy"/"Retry build" re-ran an old commit from before 21:58 UTC.
3. A build ran before the push of `e9c4c66` completed (timing).

### How to settle it in 30 seconds

Open the failed build in Cloudflare -> Workers & Pages -> `go-vibe-tool` -> Deployments / Builds -> the failed entry. The first lines of the log name the branch and the commit that was checked out. If it is `main`, or a SHA that is not `e9c4c66` or later, the cause is confirmed. Do not retry stale builds; create a new build from a new commit.

### Make the dashboard project safe

`go-vibe-tool` is a Worker the dashboard creates and may serve on a `workers.dev` URL. Pointing its production branch at the V8 branch makes every push to that branch deploy the V8 code as that Worker. For an isolated preview, prefer one of these:

- **Recommended:** disconnect or pause automatic Git builds for `go-vibe-tool` (Settings -> Builds), and deploy previews only with the GitHub Actions workflow below.
- If you keep Workers Builds, set the branch to `feature/v8-discovery-navigation`, build command `npm run build`, deploy command `npx wrangler deploy`, root directory `/`, then push one new commit and confirm in the build log that the checked-out SHA matches. `main` will keep failing until PR #11 is merged; do not merge it only to satisfy a build.

## The isolated preview workflow (recommended)

`.github/workflows/cloudflare-v8-preview.yml`, **Cloudflare V8 Preview (isolated Worker)**.

| Property | Behaviour |
| --- | --- |
| Trigger | `workflow_dispatch` only (plus a path-filtered push that runs build/verify/tests with deploy OFF, solely so GitHub registers the workflow; it can never deploy). |
| Branch guard | Fails immediately unless started on `refs/heads/feature/v8-discovery-navigation`. Never builds or deploys `main`. |
| Commit pinning | Checks out `github.sha`, asserts `git rev-parse HEAD` equals it, writes branch, commit and tree to the run summary. |
| Missing-script guard | Fails with a clear message if `package.json` lacks `build` or `verify:dist` at that commit. |
| Node / dependencies | Node 22. The site has no dependencies; if any are ever added the workflow requires a lockfile and runs `npm ci`. Wrangler is pinned (`4.149.0`) and installed `--no-save`. |
| Verification | `npm run build`, `npm run verify:dist`, `npm test`, then Chromium, Firefox and WebKit: `tests/dist-browser.mjs` plus the V8, Play, Labs, maintenance, prompt-improver and tool-fix suites against `dist/` (`SITE_ROOT=dist`), including offline. |
| Artifact | The verified `dist/` is uploaded with a SHA-256 manifest; the deploy job downloads it, re-checks the manifest and deploys **those bytes** (no rebuild). |
| Deploy | Only when you tick **deploy**; uses `wrangler.preview.jsonc` (Worker `go-vibe-tool-v8-preview`). |
| Safety preflight | `scripts/cf-preflight.mjs` (read-only): refuses protected/production Worker names, requires the `-preview` suffix, refuses a preview Worker that has custom domains. |
| Post-deploy proof | `scripts/verify-live-assets.mjs` fetches every file from the preview URL and compares SHA-256 with `dist/`; then live browser checks. The run summary records the exact commit and the preview URL. |
| Secrets | Read only from the GitHub Environment `cloudflare-v8-preview`; never printed; none stored in the repository. |

### One-time setup you must do (needs your Cloudflare and GitHub accounts)

1. **Create an API token** (Cloudflare dashboard -> Manage account -> Account API tokens -> Create token -> Custom token):
   - Permission: **Account -> Workers Scripts -> Edit** (this allows creating and updating Workers; creating a brand-new Worker needs product-level access).
   - Account resources: include only your account.
   - Add **no** Zone permissions. Without zone permissions the token cannot create routes, custom domains or DNS records, which keeps the preview isolated.
   - Do not use the broad "Edit Cloudflare Workers" template, which includes zone permissions.
2. Copy your **Account ID** (dashboard -> Workers & Pages overview, or the account home page).
3. In GitHub: repository **Settings -> Environments -> New environment** named `cloudflare-v8-preview`. Optionally add yourself as a required reviewer so each deployment needs your approval.
4. In that environment add two **environment secrets**: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
5. Open the **Actions** tab -> **Cloudflare V8 Preview (isolated Worker)** -> **Run workflow** on branch `feature/v8-discovery-navigation`. First run with **deploy unticked** (build, verify and test only), then run again with **deploy** ticked.
6. Read the run summary for the deployed commit and the `workers.dev` preview URL. The URL is `https://go-vibe-tool-v8-preview.<your-account-subdomain>.workers.dev`.

If the secrets are missing the deploy job stops with a clear error before touching Cloudflare.

## Mahjong

The Mahjong **frontend** (`/play/mahjong/`) ships in `dist/` and loads. `play/mahjong/config.js` leaves the API URL empty on every non-localhost hostname, so no backend is contacted. `multiplayer/` (including `multiplayer/cloudflare/`) is excluded from `dist/` and never deployed by this workflow. A separate Mahjong backend preview, if wanted, needs its own reviewed procedure.

## Local checks

```bash
npm run build && npm run verify:dist
npm run preview            # http://127.0.0.1:8080, Cloudflare-style routing
npm run test:dist:browser  # rebuilds dist and tests it in a browser, including offline
```

## Not changed

`main`, production hosting, custom domains and DNS, AdSense (`ads.txt` and markup are copied byte for byte), IntelliTools, repository visibility, paid services, the Mahjong backend, and the Cloudflare dashboard settings.
