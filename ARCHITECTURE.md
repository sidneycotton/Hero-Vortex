# Hero Vortex Architecture

## Data
- `cards.json` — single source of truth for card definitions.

## Core
- `js/app.js` — application bootstrap, shared globals, and card database loading.
- `js/core/engine.js` — gameplay mechanics and effect execution.
- `js/core/game-state.js` — units and shared game-state helpers.
- `js/core/game-flow.js` — declarations, bot decisions, combat resolution, turn progression, and win conditions.

## UI
- `js/ui/render.js` — rendering helpers, card markup, declaration UI, combat board, and visual combat effects.
- `js/ui/deckbuilder-screen.js` — deck selection and initial-deployment screens.

## Systems
- `js/systems/deckbuilder.js` — deckbuilder support system.
- `js/systems/combat-presentation.js` — combat presentation enhancements.
- `js/systems/audio.js` — synthesized music and sound effects.

## Styling
- `style.css` — application-wide styling and responsive/mobile rules.

## Architectural rule
All JavaScript lives under `js/`. Card data belongs in `cards.json`; gameplay rules belong in `js/core/engine.js`; application flow belongs in `js/core/`; UI belongs in `js/ui/`; independent systems belong in `js/systems/`.
