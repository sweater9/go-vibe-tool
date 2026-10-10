# IntelliTools V5: Labs & Play Integration & Release Specification

## 1. Feature Inventory

### Pillar 1: IntelliTools Labs (`/labs/`)
- **Labs Hub (`/labs/index.html`)**:
  - Interactive laboratory discovery catalog.
  - Clear architectural distinction between Labs (exploratory sandboxes), Tools (single-purpose utilities), and Learn (conceptual guides).
  - Navigation breadcrumbs, responsive grid, trust & privacy assurances.

- **Lab 1: Visual Workflow Lab (`/labs/workflow/`)**:
  - Visual workflow canvas with pan/scroll support and SVG cubic bezier connection curves.
  - Node types: `Start Node` (event trigger), `Action Node` (processing operation), `Condition Node` (binary decision rule with labeled `True`/`False` output ports), `End Node` (terminal outcome).
  - Node Inspector: Live editing of step titles, descriptions, action types, parameter keys, operators, and target comparison values.
  - Connection Pipeline: Port-to-port wiring (`out` -> `in`), single-click connection removal, cycle guards.
  - Validation Engine: Verifies Start/End node presence, detects orphan or disconnected nodes, checks condition branch coverage, warns on unreachable nodes.
  - Deterministic Simulator: Step-by-step local execution stepper, glowing active node token highlighting, live variable context inspector, detailed chronological execution trace log.
  - Built-in Sample Workflows:
    1. *Customer Support Ticket Triage*
    2. *Inbound Lead Qualification & Routing*
    3. *Document Privacy & Redaction Pipeline*
  - Data Portability & Safety: Local auto-save (`localStorage["it_workflow_current"]`), JSON export file download, JSON import validation with strict 500 KB DoS guard, canvas reset.
  - Zero code execution: 100% declarative rule evaluation without `eval()` or `new Function()`.

- **Lab 2: API & JSON Playground (`/labs/api-playground/`)**:
  - Request Builder: Full HTTP method support (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`), custom URL bar, headers editor, body editor.
  - In-Browser Mock REST Server: Offline endpoints (`/api/v1/users`, `/api/v1/posts`, `/api/v1/products`, `/api/v1/auth/token`, `/api/v1/health`, `/api/v1/echo`).
  - Network Simulation: Latency selector (0ms, 150ms, 500ms, 1200ms) and intentional HTTP status override simulator (200, 201, 400, 401, 403, 404, 500).
  - JSON Linter & Formatter: Real-time syntax validation with line/column indicator, pretty-printer (2 spaces), single-line minifier.
  - Response Inspector: Status code badges, duration metrics, response body viewer with one-click clipboard copy, response headers inspector.
  - History & Presets: Preloaded request presets, last 25 requests cached in `localStorage["it_api_playground_history"]`, one-click request replay, request export/import as JSON.
  - Zero external proxying: Never transmits user data or credentials externally.

---

### Pillar 2: IntelliTools Play (`/play/`)
- **Play Hub (`/play/index.html`)**:
  - Cognitive challenge discovery catalog.
  - Distinguishes Play (gamified practice) from Learn (reference material).
  - Direct entry points to Daily Challenge and Logic Crypt.

- **Game 1: Daily Knowledge Challenge (`/play/daily/`)**:
  - 5 questions per day deterministically chosen via UTC date hash.
  - Curated, verified 50-question corpus across 5 distinct categories:
    1. *Science & Nature*
    2. *Technology & Computing*
    3. *Geography & World*
    4. *Logical Reasoning & Math*
    5. *Digital Literacy & Security*
  - Category balance: Exactly 1 question per category every single day.
  - Interactive multiple-choice answering with instant green/red visual validation.
  - Detailed educational answer explanations with verified takeaways.
  - Streak Engine: Tracks `currentStreak`, `maxStreak`, `totalPlayed`, and `accuracy` in `localStorage["it_daily_stats"]`.
  - Replay Prevention: Locks completed challenge for the calendar date, presents full question-by-question answer review, and shows live countdown timer to the next drop.
  - Privacy-Safe Share Card: Emoji grid copyable to clipboard with zero personal information.
  - Full keyboard support: Keys `1`–`4` or `A`–`D` to select, `Enter` to proceed.

- **Game 2: Word & Logic Challenge — Logic Crypt (`/play/word-logic/`)**:
  - Deductive reasoning and lexical puzzle game.
  - Three progressive difficulty tiers:
    - *Novice*: 4-letter crypts with positional and phonetic clues.
    - *Practitioner*: 5-letter crypts with compound structural clues.
    - *Master*: 6-letter crypts with complex relational constraints.
  - Interactive board with focused letter slots, backspace support, on-screen keyboard, and physical keyboard listeners.
  - Deduction Clue Checklist with interactive checkboxes.
  - Guess Feedback: Color-coded letter evaluation (`correct`, `misplaced`, `absent`) with eliminated keyboard key dimming.
  - Progressive Hint System: Hint 1 reveals a letter; Hint 2 eliminates 4 decoy letters (with scoring deduction).
  - Score & Attempt Tracking: Dynamic scoring based on difficulty, attempts, hints used, and elapsed seconds.
  - Completion celebration modal with score breakdown and puzzle switcher.

---

### Pillar 3: Four-Pillar Navigation & Cross-Pillar Connectors
- Global desktop and mobile header with unified navigation: `Tools`, `Learn`, `Knowledge`, `Labs`, `Play`, `About`.
- `discovery.js` intent router upgraded with Labs and Play entries.
- Contextual cross-links between Learn articles and Labs sandboxes.
- Contextual cross-links between Play challenge results and Knowledge guides.
- Updated `sitemap.xml` with all 6 new URLs.
- Updated `sw.js` Service Worker with offline caching of all V5 assets.

---

## 2. Setup Instructions

1. **Clone & Switch to Branch**:
   ```bash
   git checkout feature/v5-labs-play
   ```
2. **Prerequisites**:
   - Node.js >= 20 (Node 22 / 26 recommended)
   - Zero runtime `npm install` dependencies needed for core execution.
3. **Local Development Server**:
   Any static file server can serve the repository root:
   ```bash
   npx serve .
   # or
   python3 -m http.server 8000
   ```
   Open `http://localhost:8000` in any modern web browser.

---

## 3. Testing Instructions

Run the complete automated test suite:
```bash
npm test
```
This executes:
1. Syntax validation (`node --check`) for all scripts
2. Baseline smoke suite (`tests/smoke.mjs`)
3. Knowledge search and ontology tests (`tests/knowledge-*.mjs`)
4. Visual Workflow Lab test suite (`tests/labs-workflow.mjs`)
5. API & JSON Playground test suite (`tests/labs-api-playground.mjs`)
6. Daily Knowledge Challenge test suite (`tests/play-daily.mjs`)
7. Word & Logic Challenge test suite (`tests/play-word-logic.mjs`)
8. Navigation, Link Integrity, and Sitemap verification (`tests/v5-navigation-integrity.mjs`)

To run only the V5 test suites:
```bash
npm run test:v5
```

---

## 4. Security & Privacy Review

| Security Criterion | Audit Result | Mechanism |
| --- | --- | --- |
| **Arbitrary Code Execution** | PASS | Safe declarative condition & action evaluator in `workflow-engine.js`. No `eval()` or `Function()` calls. |
| **Input Sanitization & DoS** | PASS | Maximum file and payload size enforced at 500 KB across all imports. |
| **Network & Credential Safety** | PASS | 100% in-browser mock HTTP engine in `api-mock-engine.js`. Zero outbound network transmission of user headers or payloads. |
| **User Privacy & Telemetry** | PASS | Zero telemetry scripts. Streaks and workflows persist strictly in browser `localStorage`. |
| **Data Erasure & Sovereignty** | PASS | Dedicated "Reset Canvas" and "Clear History" options provided in UI. |

---

## 5. Browser Compatibility Report

| Browser | Desktop (1280px) | Mobile (375px) | Test Result |
| --- | --- | --- | --- |
| **Chromium** (Chrome, Edge, Brave) | Supported | Supported | Verified clean syntax, responsive layouts, SVG bezier rendering, CSS grid/flexbox. |
| **WebKit** (Safari, iOS Safari) | Supported | Supported | Standard CSS variables, standard touch event handling, standard flexbox/grid. |
| **Gecko** (Firefox) | Supported | Supported | Standard SVG pathing, standard ES modules, zero proprietary APIs. |

*Automated Browser Smoke Test*: `tests/v5-browser-smoke.mjs` is structured for Playwright runs in CI (`.github/workflows/production-browser-smoke.yml`).

---

## 6. Knowledge V4 Integration Considerations

- **Isolation**: Knowledge V4 is currently developed on branch `feature/knowledge-v4-learning` (PR #32).
- **Search Wrapper Compatibility**: Knowledge V4's search engine, indexing (`knowledge/src/build.mjs`), and ambiguity gates remain completely untouched.
- **Navigation Safety**: The four-pillar navigation changes in `index.html` and `learn/index.html` preserve all existing markers (`Tools. Learn. Labs. Play.`, `id="labs"`, `id="play"`, `learn/`, `href="#labs"`, `href="#play"`) required by Knowledge test assertions.
- **Merge Order**: V5 can be merged either before or after Knowledge V4 with zero merge conflicts in `knowledge/` content.

---

## 7. Release Candidate Checklist

- [x] Four-pillar navigation operational across all site sections.
- [x] Labs hub (`/labs/`) built with responsive layout and clear cards.
- [x] Visual Workflow Lab (`/labs/workflow/`) operational with 3 templates, simulation stepper, and JSON import/export.
- [x] API & JSON Playground (`/labs/api-playground/`) operational with mock server, JSON linter, presets, and history.
- [x] Play hub (`/play/`) built with game discovery and rules.
- [x] Daily Knowledge Challenge (`/play/daily/`) operational with 5 questions/day, streak tracking, replay protection, and share card.
- [x] Word & Logic Challenge (`/play/word-logic/`) operational with 3 difficulty tiers, hints, scoring, and letter deduction board.
- [x] Contextual cross-links connected between Learn, Tools, Labs, and Play.
- [x] `sitemap.xml` updated with all 6 new URLs.
- [x] `sw.js` Service Worker updated with offline caching of all V5 assets.
- [x] Complete automated test suite passing with 0 failures (`npm test`).
- [x] Comprehensive documentation provided in `docs/`.
