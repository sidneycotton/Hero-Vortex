# Hero Vortex Architecture

## Data
- `cards.json` — single source of truth for card definitions.

## Rules
- `engine.js` — gameplay mechanics and effect execution.

## Core application
- `app.js` — bootstrap, shared globals, and card database loading.
- `js/core/game-state.js` — units, state primitives, declaration helpers, and shared game-state helpers.
- `js/core/game-flow.js` — declarations, bot decisions, combat resolution, turn progression, and win conditions.

## UI
- `js/ui/render.js` — rendering helpers, card markup, declaration UI, combat board, and visual combat effects.
- `js/ui/deckbuilder-screen.js` — deck selection and initial-deployment screens.

## Feature systems
- `deckbuilder.js` — deckbuilder support system.
- `combat-presentation.js` — combat presentation enhancements.
- `audio.js` — synthesized music and sound effects.

## Styling
- `style.css` — application-wide styling and responsive/mobile rules.

## Architectural rule
Each file should have one clear reason to change. Card data belongs in `cards.json`; rules belong in `engine.js`; application flow belongs in `core/`; UI belongs in `ui/`.
