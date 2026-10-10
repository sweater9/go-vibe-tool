# IntelliTools V5: Labs & Play Architecture Specification

## 1. Executive Summary & Vision

IntelliTools V5 expands the platform from a two-pillar utility collection (Tools and Learn/Knowledge) into a unified four-pillar browser-based productivity and learning ecosystem:

1. **Tools** — Fast, focused, client-side everyday utilities (54+ active tools).
2. **Learn** — Practical programming guides, Knowledge base, and structured learning paths.
3. **Labs** — Interactive simulation sandboxes and visual learning-by-doing environments.
4. **Play** — Gamified knowledge challenges, daily puzzles, and cognitive skill training.

All new components strictly preserve IntelliTools' core architectural principles:
- **100% Client-Side / Browser-First**: Hosted as static assets on GitHub Pages (`https://intellitools.online`). No mandatory accounts, no backend databases, and no cloud server dependencies.
- **Zero-Trust Privacy**: User data, workflows, and puzzle attempts never leave the browser. All persistence relies on explicit `localStorage` / `sessionStorage` with easy reset controls.
- **Deterministic & Safe**: No execution of arbitrary user-provided code (`no eval`, `no new Function`). Strict validation on all imported schemas.
- **Accessible & Responsive**: WCAG 2.1 AA compliance, full keyboard accessibility, semantic HTML, and adaptive layouts tested across mobile (375px), tablet (768px), and desktop (1280px).

---

## 2. Platform Architecture & Route Map

```
/                           -> Tools Catalog & Discovery Homepage
/learn/                     -> Learn Hub (Programming & task guides)
/knowledge/                 -> Knowledge Base (Ontology, articles, learning paths)
/labs/                      -> Labs Hub (Experimentation & simulations catalog)
  /labs/workflow/           -> Lab 1: Visual Workflow Lab
  /labs/api-playground/     -> Lab 2: API & JSON Playground
/play/                      -> Play Hub (Games, challenges & puzzles catalog)
  /play/daily/              -> Game 1: Daily Knowledge Challenge
  /play/word-logic/         -> Game 2: Word & Logic Challenge
```

### Routing & Static Asset Strategy
- Clean directory-based URLs using `index.html` within each folder (`/labs/`, `/labs/workflow/`, `/labs/api-playground/`, `/play/`, `/play/daily/`, `/play/word-logic/`).
- Shared styling inherits and extends `v2.css` via an isolated, modular stylesheet `v5-labs-play.css`, ensuring zero regressions for Tools and Knowledge V4 while maintaining design continuity.
- Offline support powered by `sw.js`, registering all new routes and modules into the static cache.

---

## 3. Four-Pillar Navigation System

### Desktop & Mobile Navigation Hierarchy
The global header presents the four primary pillars clearly:
- **Branding**: `IntelliTools` with existing gradient accent.
- **Primary Links**:
  - `Tools` (`/` or `/#tools`)
  - `Learn` (`/learn/` & `/knowledge/`)
  - `Labs` (`/labs/`)
  - `Play` (`/play/`)
  - `About` (`/#about`)
- **Active State Indicator**: Each pillar page indicates its active state with an underline badge and `aria-current="page"`.
- **Search Shortcut**: Quick tool & content launcher (`Ctrl/Cmd + K` or `/`).
- **Responsive Drawer**: Mobile drawer menu preserving touch targets (>= 44px) and smooth transition.

---

## 4. Labs Architecture & Technical Design

### Lab 1: Visual Workflow Lab (`/labs/workflow/`)
#### Purpose
Enable users to conceptualize, design, inspect, and simulate automated workflows visually without writing code.

#### Visual Canvas Architecture
- SVG/HTML-based node-graph canvas supporting drag-and-drop, zoom, pan, and responsive touch panning.
- **Node Types**:
  1. `Start Node`: Workflow trigger (e.g., "New Customer Inquiry", "Form Submission", "Webhook Received", "Timer Schedule"). Exactly one active start node allowed per workflow.
  2. `Action Node`: Operation step (e.g., "Extract Fields", "Sanitize Data", "Send Email Notification", "Log to CRM", "Transform JSON"). Supports inputs, parameters, and expected outputs.
  3. `Condition Node`: Binary or multi-branch decision rule (e.g., "Is VIP Customer?", "Score >= 80", "Contains PII"). Evaluates contextual payload and branches into `True`/`False` or specific outcomes.
  4. `End Node`: Terminal outcome (e.g., "Complete & Archive", "Escalate to Human", "Reject & Notify").
- **Connection Pipeline**:
  - Explicit directed edges (`fromNodeId -> toNodeId`).
  - Condition nodes have labeled output ports (`true`, `false`).

#### Deterministic Simulation Engine
- **No Arbitrary Code**: Rules are evaluated via a safe, declarative AST / condition evaluator.
  - Operators: `equals`, `not_equals`, `greater_than`, `less_than`, `contains`, `is_empty`, `matches_regex`.
- **Step-by-step Local Stepper**:
  - Step forward, play, pause, and reset controls.
  - Visual token highlighting showing the currently executing node.
  - Execution trace showing state mutations, variable payloads, and path history.
- **Validation Suite**:
  - Checks for disconnected nodes, cycles without exit, missing start or end nodes, and unreachable steps.
- **Persistence & Serialization**:
  - Export workflow to JSON (`.json` file download or clipboard copy).
  - Import workflow from JSON with rigorous schema validation (rejecting malformed, circular, or oversized >500KB files).
  - Auto-save to `localStorage["it_workflow_current"]`.
  - Built-in sample presets:
    - *Lead Qualification & Routing*
    - *Customer Support Ticket Triage*
    - *Document Security & PII Redaction Pipeline*

---

### Lab 2: API & JSON Playground (`/labs/api-playground/`)
#### Purpose
Demystify HTTP APIs, REST requests, headers, status codes, and structured JSON data through an offline-first interactive laboratory.

#### Core Modules
1. **Interactive Request Builder**:
   - HTTP Methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`.
   - Path / Endpoint selector with pre-configured mock endpoints.
   - Header editor (Key-Value pairs with common presets like `Authorization`, `Content-Type: application/json`, `Accept`).
   - Request body editor with syntax highlighting, live linting, and character/byte count metrics.
2. **In-Browser Mock API Server**:
   - Zero network transmission by default. Emulates real REST responses deterministically in memory.
   - Mock Resources:
     - `/api/v1/users` (CRUD operations on user entities)
     - `/api/v1/posts` (Blog / article entities with filtering)
     - `/api/v1/products` (Catalog entities with stock & pricing)
     - `/api/v1/auth/token` (Mock JWT issuance with configurable expiration)
     - `/api/v1/health` (Service health status)
     - `/api/v1/echo` (Echoes back headers and payload for inspection)
   - Realistic latency simulation (slider: 0ms, 150ms, 500ms, 1200ms) to illustrate async UI states.
   - Status code customization: Simulate 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 404 Not Found, 500 Internal Error.
3. **JSON Analysis & Transformation Engine**:
   - Real-time JSON validation with precise line and column error indicators.
   - Format / Pretty-print (2 spaces, 4 spaces, tabs).
   - Minify / Compact.
   - Path query preview (JSONPath / Dot-notation inspector).
4. **History & Presets**:
   - Capped local history (last 25 requests) in `localStorage`.
   - One-click replay from history.
   - Import & export cURL commands and request collections in JSON.
   - Complete offline privacy guarantee: zero external transmission.

---

## 5. Play Architecture & Technical Design

### Game 1: Daily Knowledge Challenge (`/play/daily/`)
#### Purpose
Provide a stimulating, educational daily micro-challenge testing general knowledge, science, computing, geography, and logical deduction.

#### Mechanics & Rules
- **5 Questions Every Day**:
  - Deterministically selected based on the day's date (`YYYY-MM-DD`).
  - All users across the world see the exact same challenge on any given calendar date.
- **Curated Question Corpus**:
  - High-quality, verified questions across 5 core categories:
    1. *Science & Nature*
    2. *Computing & Technology*
    3. *World Geography & History*
    4. *Logic & Mathematics*
    5. *Everyday Digital Literacy & Web*
  - Unambiguous wording, validated correct answer, and informative explanatory takeaways.
- **Deterministic Daily PRNG**:
  - Seed generated using SHA-256 or linear congruential hashing of the UTC date string (`intellitools-daily-2026-10-10`).
  - Shuffles question selection without repetition across days.
- **Scoring & Streak Engine**:
  - Points awarded per question (100 base points + time bonus if enabled).
  - Streak tracking: `currentStreak`, `maxStreak`, `totalPlayed`, `perfectScores`.
  - Replay Protection:
    - Once completed for the day, results are locked in `localStorage["it_daily_completed_YYYY-MM-DD"]`.
    - User can review explanations and questions, but cannot re-submit for higher score.
    - Displays a live countdown to the next daily drop (midnight UTC).
- **Privacy-Preserving Share Card**:
  - Clean emoji summary grid for copying to clipboard (Wordle-style):
    ```
    IntelliTools Daily #42
    Score: 5/5 ⭐ (100%)
    🟩🟩🟩🟩🟩
    Play: https://intellitools.online/play/daily/
    ```
  - Zero personal identifiers or sensitive information included.

---

### Game 2: Word & Logic Challenge — "Logic Crypt" (`/play/word-logic/`)
#### Purpose
An interactive deductive reasoning puzzle that exercises lexical deduction, elimination grids, and pattern discovery.

#### Mechanics & Gameplay
- **Core Concept**:
  - The player is tasked with solving a mysterious encrypted code word or logic constraint sequence using deductive clues.
  - Three progressive difficulty tiers:
    - *Novice (4-letter cipher / 4 clues)*: Direct affirmative and negative constraints.
    - *Practitioner (5-letter cipher / 6 clues)*: Positional constraints, letter frequency, and relative ordering rules.
    - *Master (6-letter cipher / 8 clues)*: Complex compound conditions, cross-category elimination, and logic operators.
- **Interactive Deduction Board**:
  - Letter / Candidate selector with cross-off (elimination) markings.
  - Interactive clue tracker with checkmarks to cross out clues already accounted for.
  - Verification button with instant, clear feedback highlighting confirmed letters vs. misplaced or rejected letters.
- **Hint System**:
  - Up to 2 progressive hints per puzzle (revealing one confirmed letter or eliminating 3 dead letters).
  - Using hints applies a minor penalty to the final puzzle score.
- **Local Progress & Replayability**:
  - Generates fresh deterministic puzzle seeds or allows picking from daily / practice challenges.
  - Tracks completed puzzles, best times, and win rates in `localStorage`.

---

## 6. Cross-Pillar Integration & Synergy (Pillar Connectors)

IntelliTools V5 establishes bidirectional, contextual pathways connecting all four pillars without adding clutter:

1. **Learn ➔ Labs**:
   - Inside Learn API guides: "Experiment with live mock responses in the [API Playground](/labs/api-playground/)".
   - Inside AI & Automation guides: "Design and simulate workflow logic in the [Visual Workflow Lab](/labs/workflow/)".
2. **Labs ➔ Tools**:
   - Inside Visual Workflow Lab: "Need to redact secrets before deploying? Open [PII Redactor](/?tool=pii-secret-redactor)".
   - Inside API Playground: "Format complex JSON with [JSON Formatter](/?tool=json-formatter)".
3. **Play ➔ Learn & Knowledge**:
   - At the completion of the Daily Challenge or Logic Puzzle: contextual recommendation cards linking directly to relevant Knowledge guides matching the missed or solved questions.
4. **Tools ➔ Labs & Play**:
   - In the tool discovery shelf and intent router (`discovery.js`), matching queries surface Labs and Play activities alongside traditional utilities.

---

## 7. Security, Privacy & Compliance Specifications

| Area | Requirement | Architecture Enforcement |
| --- | --- | --- |
| **Code Execution** | No `eval()`, `new Function()`, or dynamic script injection | Declarative deterministic simulation engines for workflows and logic puzzles. |
| **Data Ingestion** | Untrusted JSON imports | Strict schema validation, recursive property limits, max payload size 500KB. |
| **Network Requests** | No arbitrary proxy or credential exfiltration | 100% in-browser mock HTTP engine. No outbound requests carrying user tokens. |
| **User Privacy** | No tracking of user content or quiz answers | Zero analytics capturing user payloads. Storage strictly in `localStorage`. |
| **Data Retention** | User data sovereignty | Clear "Reset All Data" option provided on every Labs and Play page. |

---

## 8. Accessibility & Performance Benchmarks

### Accessibility (WCAG 2.1 AA)
- Semantic HTML tags: `<main>`, `<nav>`, `<article>`, `<section>`, `<aside>`.
- Keyboard Traversal: Tab order covers all canvas actions, buttons, and puzzle inputs.
- Focus Indicators: `outline: 3px solid rgba(98,82,243,.45)` with `outline-offset: 3px`.
- High Contrast: Text contrast ratio >= 4.5:1 for normal text, >= 3:1 for large headings.
- Screen Readers: `aria-live="polite"` on simulation logs, score displays, and validation alerts.

### Performance
- Static assets minified and compressed.
- Zero external CDN dependencies (fonts, scripts, libraries run locally).
- Page size <= 120KB per HTML page; total bundle <= 300KB.
- First Contentful Paint (FCP) < 500ms on desktop, < 800ms on 4G mobile.

---

## 9. Automated Testing & Verification Framework

Automated test suites will be added under `tests/`:
1. `tests/labs-workflow.mjs`: Tests node creation, deletion, connection validation, cyclic detection, simulation engine, state machine, and JSON import/export.
2. `tests/labs-api-playground.mjs`: Tests mock server routing, status codes, headers, body formatting, JSON validation, and error detection.
3. `tests/play-daily.mjs`: Tests deterministic question selection, streak tracking, scoring math, replay protection, and share card formatting.
4. `tests/play-word-logic.mjs`: Tests puzzle generation, difficulty scaling, clue consistency, validation logic, and hint deductions.
5. `tests/v5-integration.mjs`: Tests four-pillar navigation consistency, link verification, service worker asset manifests, and sitemap integrity.
6. `npm test` integration: Automated gate ensuring all suites pass before release.
