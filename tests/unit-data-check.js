#!/usr/bin/env node
// Headless ability-data sanity check (architecture-upgrades.md item #5).
//
// Confirms every ability/sub-ability across the whole roster has a valid
// shape and that its select()/target() functions resolve without
// throwing against a realistic (but synthetic) battle context — no
// browser, no real Unit/scene/animation machinery needed, since this only
// exercises the pure-data side (units.js + effects.js's EffectVerbs/
// resolveTarget/resolveAmount/runEffectChain), not rendering.
//
// This used to be a one-off Node script rewritten from scratch each
// session (see architecture-upgrades.md item #5) — it's now committed so
// a future ability edit that breaks a select()/target() function (or
// references an EffectVerbs verb that doesn't exist) fails loudly here
// instead of silently only surfacing as a runtime bug mid-battle.
//
// Usage: node tests/unit-data-check.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = { console, Math, Object, Array, Number, String, JSON };
vm.createContext(sandbox);

function loadScript(relPaths, exportNames) {
  const paths = Array.isArray(relPaths) ? relPaths : [relPaths];
  const code = paths.map(p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8')).join('\n');
  const exposer = exportNames.map(n => `globalThis.${n} = typeof ${n} !== 'undefined' ? ${n} : undefined;`).join('\n');
  new vm.Script(code + '\n' + exposer, { filename: paths[paths.length - 1] }).runInContext(sandbox);
}

const UNIT_CHARACTER_FILES = ['ajax','yvrel','mariana','babawibby','daxen_ciris','amelia','maquina_de_guerra','moldar','sirius','carmelita_marquese','gavin','dario','porteiro'];

loadScript(
  ['js/units/core.js', ...UNIT_CHARACTER_FILES.map(id => `js/units/${id}.js`), 'js/units/campaign_enemies.js', 'js/units/dario_shadow.js', 'js/units/index.js'],
  ['UNIT_DEFS', 'findEnemyByRole', 'fastestAbilityOf', 'ROLE_SLOT']
);
loadScript('js/effects.js', ['EffectVerbs', 'resolveTarget', 'resolveAmount', 'runEffectChain', 'StatusLib']);
loadScript('js/combat-engine.js', ['CombatEngine']); // echostrike's select() calls CombatEngine.lastAbilityId directly

const { UNIT_DEFS, EffectVerbs, runEffectChain, findEnemyByRole, fastestAbilityOf, ROLE_SLOT } = sandbox;

let failed = false;
const fail = (msg) => { failed = true; console.log(`❌ ${msg}`); };
const warn = (msg) => console.log(`⚠️  ${msg}`);
const pass = (msg) => console.log(`✅ ${msg}`);

// ---- Synthetic battle roster ----------------------------------------
// Plain-object fake units carrying only the fields ability code actually
// reads (see grep across units.js: team, slotIndex, alive, hp, shield,
// statuses, counters, summonTag, abilities, subAbilities) — NOT real
// Unit instances, which need scene/animation machinery this check
// doesn't exercise.
function fakeUnit(def, team, slotIndex) {
  return {
    defId: def.id,
    displayName: def.displayName || def.id,
    team,
    slotIndex,
    abilities: def.abilities,
    subAbilities: def.subAbilities || [],
    hp: (def.stats && def.stats.maxHP) || 20,
    maxHP: (def.stats && def.stats.maxHP) || 20,
    shield: 0,
    statuses: [],
    counters: {},
    alive: true,
    summonTag: def.summonTag,
  };
}

const allDefs = Object.values(UNIT_DEFS);
// One small full-roster battle: every UNIT_DEFS entry gets a slot on one
// side or the other (round-robin), so findEnemyByRole/role-based lookups
// always have something to find, and every ability's select()/target()
// gets exercised against a realistic multi-unit ctx instead of a
// too-small roster that fizzles every optional branch trivially.
const playerUnits = [];
const enemyUnits = [];
allDefs.forEach((def, i) => {
  const slot = ROLE_SLOT[def.role] !== undefined ? ROLE_SLOT[def.role] : i;
  const target = i % 2 === 0 ? playerUnits : enemyUnits;
  target.push(fakeUnit(def, i % 2 === 0 ? 'player' : 'enemy', slot));
});

console.log(`Checking ${allDefs.length} unit defs across ${playerUnits.length + enemyUnits.length} synthetic units...\n`);

function checkAbilityShape(def, ability, kind) {
  const label = `${def.id}.${ability.id || '(no id)'} [${kind}]`;

  if (!ability.id) fail(`${label} — missing id`);
  if (!ability.name) fail(`${label} — missing name`);
  if (!ability.passive) {
    if (typeof ability.speed !== 'number') fail(`${label} — missing numeric speed`);
    if (!ability.targetType && !ability.promptsMirror) warn(`${label} — no targetType (defaults to "enemy" at select-time; confirm that's intended)`);
  }
  if (!Array.isArray(ability.effects)) {
    fail(`${label} — effects is not an array (did upgradeLegacyAbility run, or is this def malformed?)`);
    return;
  }
  if (ability.effects.length === 0 && !ability.passive) {
    // Legitimate for a genuine "do nothing" ability (e.g. Moldar's
    // Paciência) — just note it so a reviewer double-checks intent,
    // don't fail the build over it.
    warn(`${label} — effects[] is empty (fine if this is intentionally a no-op ability, e.g. Moldar's Paciência)`);
  }

  function checkSteps(steps, depth) {
    steps.forEach((step, idx) => {
      const stepLabel = `${label} effects[${idx}]${depth ? ` (nested x${depth})` : ''}`;
      if (!step.verb) { fail(`${stepLabel} — no verb`); return; }
      if (!EffectVerbs[step.verb]) { fail(`${stepLabel} — verb "${step.verb}" not found in EffectVerbs`); return; }
      // repeatIf/conditional steps nest their own effects[] — recurse so
      // a broken verb inside a conditional branch isn't missed just
      // because the top-level runEffectChain smoke test below doesn't
      // always take that branch.
      if (Array.isArray(step.effects)) checkSteps(step.effects, depth + 1);
    });
  }
  checkSteps(ability.effects, 0);
}

// ---- Pass 1: static shape check (every ability/sub-ability, every def) ----
allDefs.forEach(def => {
  if (!def.id) { fail(`a UNIT_DEFS entry is missing an id`); return; }
  if (!Array.isArray(def.abilities) || def.abilities.length === 0) {
    fail(`${def.id} — no abilities[]`);
  } else {
    def.abilities.forEach(a => checkAbilityShape(def, a, 'ability'));
  }
  (def.subAbilities || []).forEach(a => checkAbilityShape(def, a, 'sub-ability'));
});

// ---- Pass 2: live smoke test ----------------------------------------
// Actually RUN runEffectChain for every non-passive ability/sub-ability
// against a synthetic ctx, for every unit of that def's kind present in
// the roster (both a player-side and an enemy-side copy where possible,
// since some select()/target() functions branch on ctx.actor.team). This
// is what catches a select()/target() function that throws — a shape
// check alone can't see inside an arbitrary function body.
function runOne(def, ability, actor, allUnits) {
  const opponents = actor.team === 'player' ? enemyUnits : playerUnits;
  const target = opponents.find(u => u.alive) || actor;
  const ctx = {
    actor, target, originalTarget: target, ability,
    allUnits, playerUnits, enemyUnits, round: 1,
    echoChoice: null, secondTarget: null,
  };
  try {
    runEffectChain(ability.effects, ctx);
    return true;
  } catch (e) {
    fail(`${def.id}.${ability.id} — runEffectChain threw: ${e.message}`);
    return false;
  }
}

let smokeTested = 0;
allDefs.forEach(def => {
  const asPlayer = playerUnits.find(u => u.defId === def.id);
  const asEnemy = enemyUnits.find(u => u.defId === def.id);
  const allUnits = [...playerUnits, ...enemyUnits];
  [...def.abilities, ...(def.subAbilities || [])].forEach(ability => {
    if (ability.passive) return; // passives only ever run once at spawn (see Unit constructor) — nothing to smoke-test here.
    [asPlayer, asEnemy].filter(Boolean).forEach(actor => {
      if (runOne(def, ability, actor, allUnits)) smokeTested++;
    });
  });
});

console.log(`\nRan ${smokeTested} live ability smoke tests.`);

// ---- Pass 3: role-lookup helpers used by mirror/role-targeting abilities ----
// findEnemyByRole/fastestAbilityOf are shared generic helpers (see
// units.js) that several abilities' select()/target() functions call
// directly — sanity-check them in isolation too, since Pass 2 only
// exercises them indirectly through whichever ability happens to use them.
['defender', 'attacker', 'support'].forEach(role => {
  const ctx = { actor: playerUnits[0], playerUnits, enemyUnits };
  try {
    const found = findEnemyByRole(ctx, role);
    if (found) {
      const fastest = fastestAbilityOf(found);
      if (!fastest) fail(`fastestAbilityOf(${found.defId}) returned nothing for a unit with a live kit`);
    }
  } catch (e) {
    fail(`findEnemyByRole/fastestAbilityOf for role "${role}" threw: ${e.message}`);
  }
});
pass('role-lookup helpers (findEnemyByRole / fastestAbilityOf) run without throwing');

console.log('\n' + (failed ? '❌ unit-data-check: FAILURES ABOVE' : '✅ unit-data-check: all checks passed'));
process.exit(failed ? 1 : 0);
