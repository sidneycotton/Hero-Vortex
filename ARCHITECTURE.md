# Hero Vortex Architecture

## Data
- `cards.json` — single source of truth for card definitions.

## Rules
- `js/core/engine.js` — gameplay mechanics and effect execution.

## Core application
- `js/app.js` — bootstrap, shared globals, and card database loading.
- `js/core/game-state.js` — units and shared game-state helpers.
- `js/core/game-flow.js` — declarations, bot decisions, combat resolution, turn progression, and win conditions.

## UI
- `js/ui/render.js` — rendering helpers, card markup, declaration UI, combat board, and visual combat effects.
- `js/ui/deckbuilder-screen.js` — deck selection and initial-deployment screens.

## Feature systems
- `js/systems/deckbuilder.js` — deckbuilder support system.
- `js/systems/combat-presentation.js` — combat presentation enhancements.
- `js/systems/audio.js` — synthesized music and sound effects.

## Styling
- `css/base.css` — existing visual foundation and component styling.
- `css/layout.css` — spacing, hierarchy, responsive composition, and artwork-ready layout rules.

## Architectural rules
- Card data belongs in `cards.json`.
- Game rules and mechanics belong in `js/core/engine.js`.
- Application flow belongs in `js/core/`.
- UI belongs in `js/ui/`.
- Independent feature systems belong in `js/systems/`.
- JavaScript belongs under `js/`; stylesheet code belongs under `css/`.
- Do not create `*-fix.js`, `*-patch.js`, or card-specific runtime files. Fix the owning module instead.
