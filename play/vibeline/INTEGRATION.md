# Vibeline — integration staging

Status: DEVELOPMENT ONLY. Do not merge or deploy while Mahjong Solitaire PR #40 remains under review.

## Input asset
User-supplied `vibeline-package.zip` contains a standalone `vibeline/index.html`, `PROMPT.md`, and `README.md`. Preserve the single-file dependency-free implementation; external Google Fonts are optional progressive enhancement, not a game dependency.

## Integration target
- Publish game at `/play/vibeline/` as a static HTML page.
- Add Play directory and discovery entries after standalone QA.
- Avoid changing `/play/mahjong-solitaire/`, multiplayer routes, release pin, or deployment workflow.

## Acceptance gates
- Deterministic generation levels 1–200: valid Hamiltonian path, checkpoints ordered, no wall or reverse-arrow violations.
- Drag, pointer capture, touch, keyboard, cutback, drag-undo, hint, win, persistence, clipboard fallback, share URLs.
- 320/375/390/400/460px and desktop; system light/dark and reduced motion.
- Production build includes Vibeline and continues to exclude four-player Mahjong.
- Run repository Quality, V9 integration, cross-browser and isolation tests.

## Release control
Draft PR first; no automatic production deploy. Coordinate with PR #40 before updating any pinned release SHA.
