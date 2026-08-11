# Hero Vortex JavaScript architecture

`app.js` is the bootstrap and shared runtime entrypoint.

`core/` contains state and turn/phase flow.

`ui/` contains rendering and player-facing setup screens.

Root feature modules remain separate when they represent complete systems.

Hero Vortex intentionally uses regular script loading for compatibility with the existing global API.
