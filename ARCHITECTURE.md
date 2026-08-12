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
- `js/ui/render.js` — rendering helpers, card markup, combat board, and visual combat effects.
- `js/ui/declaration-flow.js` — focused one-card-at-a-time declaration interface and review flow.
- `js/ui/deckbuilder-screen.js` — deck selection and initial-deployment screens.

## Feature systems
- `js/systems/deckbuilder.js` — deckbuilder support system.
- `js/systems/combat-presentation.js` — combat presentation enhancements.
- `js/systems/audio.js` — synthesized music, sound effects, audio routing, and mute control.
- `js/systems/visual-fx.js` — ambient visual polish: ember particles, button ripple, 3D card tilt, screen-transition cues. Purely presentational, never touches game state.

## Styling
- `css/base.css` — design tokens (color/typography/radius/shadow variables), resets, buttons, ripple, page-transition keyframes.
- `css/layout.css` — home screen, deckbuilder shell, initial-deployment layout, responsive composition.
- `css/cards.css` — all card surfaces: deckbuilder catalog card, inspector/detail sheet, and the shared `.unit-card` used in declare/battle/target contexts.
- `css/declaration.css` — declaration-flow layout primitives (focused one-card view) plus the legacy multi-card declare board.
- `css/modern.css` — arena/resolve screen, target overlay, choice popups, mute control.
- `css/combat.css` — combat choreography (shake/flash/ember/float-text/action-cue). Class names are contracted with `js/systems/combat-presentation.js` — do not rename without updating both.
- `css/effects.css` — ambient ember-field and ripple/tilt support styles used by `js/systems/visual-fx.js`.

## Architectural rules
- Card data belongs in `cards.json`.
- Game rules and mechanics belong in `js/core/engine.js`.
- Application flow belongs in `js/core/`.
- UI belongs in `js/ui/`.
- Independent feature systems belong in `js/systems/`.
- JavaScript belongs under `js/`; stylesheet code belongs under `css/`.
- Do not create `*-fix.js`, `*-patch.js`, or card-specific runtime files. Fix the owning module instead.
