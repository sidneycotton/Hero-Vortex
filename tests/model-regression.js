#!/usr/bin/env node
// Headless model-regression check (architecture-upgrades.md item #5).
//
// Runs validateUnitModel() (js/models.js) against every character
// registered in BESPOKE_BUILDERS, using a fake THREE stub (fake_three.js)
// instead of a real WebGL context — no browser needed. Also runs
// checkGlowFamilyCollisions() to flag any two characters sharing a glow
// hex.
//
// This used to be a one-off Node script rewritten from scratch each
// session (see architecture-upgrades.md item #5) — it's now committed so
// nothing stops a future character addition from silently breaking an
// existing one.
//
// Usage: node tests/model-regression.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { THREE } = require('./fake_three.js');

// js/models.js and js/units.js are plain (non-module) scripts, loaded via
// <script> tags in index.html and relying on shared globals (THREE,
// TOON_GRADIENT, UNIT_DEFS, etc.) rather than require/import. Run them in
// a vm context with those globals pre-seeded, same as the browser's
// <script> load order does, instead of trying to modularize them just for
// this test.
const sandbox = {
  THREE,
  TOON_GRADIENT: { isFakeGradientTexture: true }, // models.js only ever passes this through as gradientMap; the fake material stub never inspects it.
  console,
  Math,
  Object,
  Array,
  Number,
  String,
};
vm.createContext(sandbox);

function loadScript(relPaths, exportNames) {
  // Accepts either a single path or an ordered array of paths (for the
  // per-character file split -- js/units/*.js, js/models/*.js -- which
  // must be concatenated in load order, same as their <script> tags in
  // index.html, since each file relies on globals/objects a prior file
  // in the sequence declared).
  const paths = Array.isArray(relPaths) ? relPaths : [relPaths];
  const code = paths.map(p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8')).join('\n');
  // Top-level `const`/`function` in these files land in the vm's own
  // lexical scope, not as enumerable properties on the sandbox object
  // (that's only guaranteed for `var`/implicit globals) -- so explicitly
  // re-expose the names this test needs via `globalThis.x = x;` appended
  // to the run. Matches how these files behave as real <script> tags
  // (where top-level `const` also isn't on `window`, incidentally -- but
  // there every OTHER script tag can still see it via shared scope, which
  // vm.Script per-call can't replicate without this).
  const exposer = exportNames.map(n => `globalThis.${n} = typeof ${n} !== 'undefined' ? ${n} : undefined;`).join('\n');
  new vm.Script(code + '\n' + exposer, { filename: paths[paths.length - 1] }).runInContext(sandbox);
}

const UNIT_CHARACTER_FILES = ['ajax','yvrel','mariana','babawibby','daxen_ciris','amelia','maquina_de_guerra','moldar','sirius','carmelita_marquese','gavin','dario','porteiro'];
const MODEL_CHARACTER_FILES = ['ajax','yvrel','gavin','daxen_ciris','mariana','amelia','moldar','babawibby','maquina_de_guerra','sirius','carmelita_marquese','dario','porteiro','dario_shadow','election_mob'];

loadScript(
  ['js/units/core.js', ...UNIT_CHARACTER_FILES.map(id => `js/units/${id}.js`), 'js/units/campaign_enemies.js', 'js/units/dario_shadow.js', 'js/units/index.js'],
  ['UNIT_DEFS', 'findEnemyByRole', 'fastestAbilityOf']
);
loadScript(
  ['js/models/core.js', ...MODEL_CHARACTER_FILES.map(id => `js/models/${id}.js`), 'js/models/index.js'],
  ['BESPOKE_BUILDERS', 'validateUnitModel', 'checkGlowFamilyCollisions', 'GLOW_FAMILIES']
);

const { BESPOKE_BUILDERS, validateUnitModel, checkGlowFamilyCollisions, GLOW_FAMILIES } = sandbox;
const { UNIT_DEFS } = sandbox;

let failed = false;

console.log(`Checking ${Object.keys(BESPOKE_BUILDERS).length} bespoke builders...\n`);

for (const shapeId of Object.keys(BESPOKE_BUILDERS)) {
  // Find a unit def using this shape (there should be exactly one bespoke
  // character per shape key, but don't assume — just take the first).
  const def = Object.values(UNIT_DEFS).find(d => d.shape === shapeId);
  if (!def) {
    console.log(`⚠️  SKIP  ${shapeId} — registered in BESPOKE_BUILDERS but no UNIT_DEFS entry uses shape:"${shapeId}"`);
    continue;
  }

  const result = validateUnitModel(def);
  const label = `${def.id} (shape: ${shapeId})`;

  if (result.ok) {
    console.log(`✅ PASS  ${label} — ${result.meshCount} meshes`);
    if (result.warnings.length) {
      result.warnings.forEach(w => console.log(`   ⚠️  ${w}`));
    }
  } else {
    failed = true;
    console.log(`❌ FAIL  ${label}`);
    result.errors.forEach(e => console.log(`   - ${e}`));
    result.warnings.forEach(w => console.log(`   ⚠️  ${w}`));
  }
}

// election_mob (js/models/election_mob.js) is one shape covering multiple
// visually-distinct archetypes via `mobId` (js/units/campaign_enemies.js) —
// the per-shape loop above only ever checks the FIRST UNIT_DEFS entry it
// finds for a given shape, so it silently only covers whichever mobId that
// entry happens to use. Explicitly re-validate every OTHER mobId in actual
// use so a future archetype-specific bug (e.g. a hound-branch regression
// that a humanoid-branch def would never exercise) doesn't slip through.
console.log('\nChecking election_mob archetype variants...');
const electionMobDefs = Object.values(UNIT_DEFS).filter(d => d.shape === 'election_mob');
const seenMobIds = new Set();
for (const def of electionMobDefs) {
  const mobId = def.mobId || 'staffer';
  if (seenMobIds.has(mobId)) continue; // already covered by an earlier def with the same mobId
  seenMobIds.add(mobId);
  const result = validateUnitModel(def);
  const label = `${def.id} (mobId: ${mobId})`;
  if (result.ok) {
    console.log(`✅ PASS  ${label} — ${result.meshCount} meshes`);
    if (result.warnings.length) result.warnings.forEach(w => console.log(`   ⚠️  ${w}`));
  } else {
    failed = true;
    console.log(`❌ FAIL  ${label}`);
    result.errors.forEach(e => console.log(`   - ${e}`));
    result.warnings.forEach(w => console.log(`   ⚠️  ${w}`));
  }
}

// election_mob also supports several archetypes no CAMPAIGN_UNIT_DEFS
// entry uses yet (the hound/beast quadruped branch, plus elite_fixer/
// elite_riot/elite_spin/elite_donor — content not wired into any roster
// yet, see CAMPAIGN_DESIGN.md). Validate those too, against synthetic
// defs, so an archetype-specific bug can't sit undetected until the day
// someone actually authors a UNIT_DEFS entry for it.
console.log('\nChecking election_mob archetypes not yet used by any UNIT_DEFS entry...');
const UNUSED_ELECTION_MOB_ARCHETYPES = ['hound_scout', 'elite_hound_enforcer', 'beast_propaganda', 'elite_fixer', 'elite_riot', 'elite_spin', 'elite_donor'];
for (const mobId of UNUSED_ELECTION_MOB_ARCHETYPES) {
  if (seenMobIds.has(mobId)) continue; // a real UNIT_DEFS entry has since started using this — already covered above
  const syntheticDef = { id: `synthetic_${mobId}`, shape: 'election_mob', mobId, color: 0x333333, accentColor: 0x999999 };
  const result = validateUnitModel(syntheticDef);
  const label = `${mobId} (synthetic, not yet used by any UNIT_DEFS entry)`;
  if (result.ok) {
    console.log(`✅ PASS  ${label} — ${result.meshCount} meshes`);
    if (result.warnings.length) result.warnings.forEach(w => console.log(`   ⚠️  ${w}`));
  } else {
    failed = true;
    console.log(`❌ FAIL  ${label}`);
    result.errors.forEach(e => console.log(`   - ${e}`));
    result.warnings.forEach(w => console.log(`   ⚠️  ${w}`));
  }
}

console.log('\nChecking glow-family collisions...');
const collisions = checkGlowFamilyCollisions();
if (collisions.length === 0) {
  console.log(`✅ PASS  no two characters share a glow hex (${Object.keys(GLOW_FAMILIES).length} registered)`);
} else {
  failed = true;
  collisions.forEach(c => {
    console.log(`❌ FAIL  glow collision on 0x${c.hex.toString(16)}: ${c.characters.join(', ')}`);
  });
}

console.log('\n' + (failed ? '❌ model-regression: FAILURES ABOVE' : '✅ model-regression: all checks passed'));
process.exit(failed ? 1 : 0);
