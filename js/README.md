# Hero Vortex JavaScript architecture

`js/app.js` is the application bootstrap and shared runtime entrypoint.

`js/core/` contains game rules, state, and turn/phase flow.

`js/ui/` contains rendering and player-facing setup screens.

`js/systems/` contains complete independent systems such as audio, deckbuilding support, and combat presentation.

All JavaScript belongs under `js/`; the folder name communicates responsibility without relying on patch/fix filenames.
