# Technology Knowledge QA

Run: `node tests/knowledge-tech-qa.mjs`

A query passes only when the top solid guide is one that actually answers it. Related-but-incomplete winners are weak. Anything else is a miss. Ranking thresholds were not lowered.

Queries: 282
Pass: 265
Weak: 9
Miss: 8

## SPFx acceptance
- PASS — SPFx → sharepoint-framework (140)
- PASS — What is SPFx? → sharepoint-framework (138)
- PASS — SharePoint Framework → sharepoint-framework (106)
- PASS — How do I build an SPFx web part? → build-spfx-web-part (168)
- PASS — Does SPFx use React? → sharepoint-framework (128)
- PASS — SPFx TypeScript → sharepoint-framework (128)

## False positives
- yo @microsoft/generator-sharepoint → sharepoint (72) expected build-spfx-web-part
- Stripe or GitHub needs to notify my server when something happens → github (53) expected webhooks
- How do I build a low-code approval flow in Microsoft 365? → microsoft-365 (96) expected power-platform
- refresh token → tokens (41) expected oauth
- Should the model key be in the React app? → react (54) expected api-keys or frontend-and-backend

## Inappropriate IntelliTools recommendations
- How do I validate JSON before trusting a model tool call? recommended json-formatter

## Misses and weak matches
- WEAK [SPFx] gulp serve SPFx → sharepoint-framework (144)
- MISS [SPFx] yo @microsoft/generator-sharepoint → sharepoint (72)
- WEAK [Microsoft] Azure vs Microsoft 365 → microsoft-365 (96)
- WEAK [Languages] Go vs Rust → rust (46)
- WEAK [Web] where should API keys live → api-keys (90)
- WEAK [Data] MySQL vs PostgreSQL → postgresql (66)
- WEAK [Data] SQLite vs PostgreSQL → postgresql (61)
- WEAK [Data] SQL vs ORM → sql (50)
- WEAK [Architecture] I need a custom dashboard on a SharePoint intranet → sharepoint (73)
- MISS [Architecture] Stripe or GitHub needs to notify my server when something happens → github (53)
- MISS [Architecture] How do I build a low-code approval flow in Microsoft 365? → microsoft-365 (96)
- WEAK [Architecture] I need types in a large JavaScript codebase → javascript (55)
- MISS [AI ecosystem] query engine for documents → chunking (19)
- MISS [Devops] branch protection → github (18)
- MISS [Security] refresh token → tokens (41)
- MISS [Architecture] Should the model key be in the React app? → react (54)
- MISS [Gaps] How do I operate Kubernetes? → (none) (0)

## Remaining gaps
- Kubernetes operations (pods, deployments, ingress) are not a guide. Containers and CI are covered; cluster operations are not.
- Provider-specific console click-paths and current SKU prices are intentionally omitted.
- A dedicated prompt-diff guide still does not exist; Prompt Diff remains the tool for comparing prompt text, and that case stays weak in the original search suite.

