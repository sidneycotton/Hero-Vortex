// =============================================================
// BATTLEFIELDS — registry + random picker
// =============================================================
// Each js/battlefields/<name>.js file registers a builder function
// into BATTLEFIELD_BUILDERS[key]. A builder has the signature:
//
//   (scene, renderer) => { playerLight: THREE.Light, enemyLight: THREE.Light }
//
// It's responsible for adding ALL scenery to `scene` — ground, sky,
// background props, ambient/key lighting, and the two team-tinted
// rim lights — and must return those two rim lights so js/scene.js
// can keep using them by name elsewhere (e.g. combat effects).
//
// This file just picks one builder at random per match and runs it.
// Load order in index.html: this file (and each battlefield file)
// must load BEFORE js/scene.js, since scene.js calls
// buildBattlefield() at its own top level.

const BATTLEFIELD_BUILDERS = {};

function buildBattlefield(scene, renderer) {
  const keys = Object.keys(BATTLEFIELD_BUILDERS);
  // Dev/testing hook: main-menu.js's "Choose Battlefield" popup (Vs. AI
  // flow only) can set window.FORCED_BATTLEFIELD to a specific key so
  // testers don't have to keep restarting matches to see a given arena.
  // Cleared after one use so it doesn't silently stick across matches.
  let key = window.FORCED_BATTLEFIELD;
  if (key && BATTLEFIELD_BUILDERS[key]) {
    window.FORCED_BATTLEFIELD = null;
  } else {
    key = keys[Math.floor(Math.random() * keys.length)];
  }
  const builder = BATTLEFIELD_BUILDERS[key];

  // Track everything this builder adds directly to `scene` (lights,
  // ground, props, sky...) so a later rebuild (js/planning-ui.js's
  // initGame, called once per match) can remove exactly this batch
  // before building the next one. Without this, re-running
  // buildBattlefield() at match start would just pile a second
  // battlefield's meshes on top of the first instead of replacing it.
  const before = new Set(scene.children);
  const refs = builder(scene, renderer);
  const added = scene.children.filter(c => !before.has(c));
  scene.userData.battlefieldObjects = added;
  scene.userData.battlefieldKey = key; // handy for debugging / UI later
  return refs;
}

// Removes the current battlefield's meshes/lights (tracked above) and
// builds a new one in their place. Called once per match by
// js/planning-ui.js's initGame — NOT at page load, since at page-load
// time the player hasn't reached the "Choose Battlefield" popup yet
// (see main-menu.js) and any FORCED_BATTLEFIELD choice would be set
// too late to matter otherwise.
function rebuildBattlefield(scene, renderer) {
  (scene.userData.battlefieldObjects || []).forEach(obj => scene.remove(obj));
  return buildBattlefield(scene, renderer);
}
