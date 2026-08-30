#!/usr/bin/env node
// Headless campaign-item sanity check (CAMPAIGN_DESIGN.md §7 / build-order
// step 5). No browser, no real Unit/scene machinery — exercises Items'
// pure data + equip/unequip logic against small synthetic fake units, the
// same style as tests/unit-data-check.js.
//
// This exists specifically to catch the two bug classes items are prone
// to that a shape check alone would miss:
//  1. onUnequip not exactly reverting what onEquip did (a stat item that
//     leaves maxHP/hp permanently inflated after being swapped out).
//  2. An ability-swap item mutating the SHARED UNIT_DEFS abilities array
//     instead of a per-unit copy (js/campaign/items.js's
//     ensureOwnAbilitiesArray) — which would silently corrupt every other
//     unit built from that same def for the rest of the process.
//
// Usage: node tests/item-data-check.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = { console, Math, Object, Array, Number, String, JSON, Set };
vm.createContext(sandbox);

function loadScript(relPaths, exportNames) {
  const paths = Array.isArray(relPaths) ? relPaths : [relPaths];
  const code = paths.map(p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8')).join('\n');
  const exposer = exportNames.map(n => `globalThis.${n} = typeof ${n} !== 'undefined' ? ${n} : undefined;`).join('\n');
  new vm.Script(code + '\n' + exposer, { filename: paths[paths.length - 1] }).runInContext(sandbox);
}

const UNIT_CHARACTER_FILES = ['ajax','yvrel','mariana','babawibby','daxen_ciris','amelia','maquina_de_guerra','moldar','sirius','carmelita_marquese','gavin','dario','porteiro'];

loadScript(
  ['js/units/core.js', ...UNIT_CHARACTER_FILES.map(id => `js/units/${id}.js`), 'js/units/campaign_enemies.js', 'js/units/index.js'],
  ['UNIT_DEFS', 'currentForm']
);
loadScript('js/effects.js', ['EffectVerbs', 'StatusLib', 'applyStatusToUnit', 'removeStatusFromUnit', 'hasStatus']);
loadScript('js/campaign/items.js', ['Items']);

const { UNIT_DEFS, Items, EffectVerbs } = sandbox;

let failed = false;
const fail = (msg) => { failed = true; console.log(`❌ ${msg}`); };
const warn = (msg) => console.log(`⚠️  ${msg}`);
const pass = (msg) => console.log(`✅ ${msg}`);

// ---- Synthetic unit -----------------------------------------------------
// Only the fields Items/effects code actually reads: maxHP, hp, shield,
// statuses, abilities, alive. `abilities` is intentionally the SAME array
// reference the def itself holds (never sliced up front here) — that's
// exactly the real Unit constructor's behavior (js/planning-ui.js:
// `this.abilities = def.abilities`), and it's the condition
// ensureOwnAbilitiesArray is specifically there to guard against.
function fakeUnit(def) {
  return {
    defId: def.id,
    displayName: def.displayName || def.id,
    maxHP: (def.stats && def.stats.maxHP) || 20,
    hp: (def.stats && def.stats.maxHP) || 20,
    shield: 0,
    statuses: [],
    abilities: def.abilities,
    alive: true,
    equippedItem: null,
  };
}

console.log(`Checking ${Items.ITEM_POOL.length} campaign items...\n`);

// ---- Pass 1: shape check --------------------------------------------
const seenIds = new Set();
Items.ITEM_POOL.forEach(item => {
  const label = item.id || '(no id)';
  if (!item.id) fail(`an item is missing an id`);
  if (seenIds.has(item.id)) fail(`duplicate item id "${item.id}"`);
  seenIds.add(item.id);
  if (!item.name) fail(`${label} — missing name`);
  if (!item.desc) fail(`${label} — missing desc`);
  if (!['common', 'rare', 'boss'].includes(item.rarity)) fail(`${label} — invalid rarity "${item.rarity}"`);
  if (typeof item.price !== 'number') fail(`${label} — missing numeric price`);
  if (typeof item.onEquip !== 'function') fail(`${label} — missing onEquip`);
  if (typeof item.onUnequip !== 'function') fail(`${label} — missing onUnequip`);
  if (item.replacesAbilityId) {
    if (!item.replacementAbility) {
      fail(`${label} — has replacesAbilityId but no replacementAbility`);
    } else {
      const steps = item.replacementAbility.effects || [];
      steps.forEach((s, i) => {
        if (!EffectVerbs[s.verb]) fail(`${label}.replacementAbility.effects[${i}] — verb "${s.verb}" not found in EffectVerbs`);
      });
      const anyDefHasIt = Object.values(UNIT_DEFS).some(def => def.abilities.some(a => a.id === item.replacesAbilityId));
      if (!anyDefHasIt) fail(`${label} — replacesAbilityId "${item.replacesAbilityId}" doesn't match any real UNIT_DEFS ability`);
    }
  }
});
pass(`all ${Items.ITEM_POOL.length} items have valid shape, no duplicate ids`);

// ---- Pass 2: equip/unequip round-trips cleanly ------------------------
// For every item, equip it onto a fresh synthetic unit (Dário's own def
// for the one ability-swap item, an arbitrary other def for everything
// else), snapshot state, unequip, and confirm maxHP/hp/statuses/abilities
// all land back exactly where they started. Catches a stat item whose
// onUnequip doesn't exactly mirror onEquip, and (via the abilities-array
// identity check) the shared-array mutation bug class described up top.
const genericDef = UNIT_DEFS.ajax || Object.values(UNIT_DEFS)[0];
Items.ITEM_POOL.forEach(item => {
  const def = item.replacesAbilityId
    ? Object.values(UNIT_DEFS).find(d => d.abilities.some(a => a.id === item.replacesAbilityId))
    : genericDef;
  if (!def) { fail(`${item.id} — no def found to test against`); return; }

  const originalAbilitiesRef = def.abilities;
  const originalAbilitiesSnapshot = def.abilities.map(a => a.id);

  const unit = fakeUnit(def);
  const before = { maxHP: unit.maxHP, hp: unit.hp, shield: unit.shield, statusCount: unit.statuses.length };

  try {
    Items.equipItem(unit, item);
  } catch (e) {
    fail(`${item.id} — onEquip threw: ${e.message}`);
    return;
  }
  try {
    Items.unequipItem(unit);
  } catch (e) {
    fail(`${item.id} — onUnequip threw: ${e.message}`);
    return;
  }

  if (unit.maxHP !== before.maxHP) fail(`${item.id} — maxHP not restored after unequip (was ${before.maxHP}, now ${unit.maxHP})`);
  if (unit.hp > unit.maxHP) fail(`${item.id} — hp left above maxHP after unequip`);
  if (unit.statuses.length !== before.statusCount) fail(`${item.id} — statuses not fully cleaned up after unequip (had ${before.statusCount}, now ${unit.statuses.length})`);
  if (unit.equippedItem !== null) fail(`${item.id} — unit.equippedItem not cleared after unequip`);

  // The shared-array-mutation guard: def.abilities must be the exact same
  // reference, in the exact same order, after an equip+unequip cycle —
  // proving ensureOwnAbilitiesArray actually cloned onto the UNIT, not
  // mutated the def every future unit of this kind will also get built from.
  if (def.abilities !== originalAbilitiesRef) fail(`${item.id} — mutated def.abilities' array reference (should only ever touch a per-unit copy)`);
  const nowIds = def.abilities.map(a => a.id);
  if (JSON.stringify(nowIds) !== JSON.stringify(originalAbilitiesSnapshot)) fail(`${item.id} — left def.abilities' ability ids changed: ${JSON.stringify(nowIds)} vs original ${JSON.stringify(originalAbilitiesSnapshot)}`);
});
pass('every item equips and unequips cleanly, with no leftover state and no shared-def mutation');

// ---- Pass 3: re-equipping (swap while already holding an item) --------
// Equipping item B while item A is already equipped must auto-unequip A
// first (§7.1) — confirm the unit ends up in exactly item B's state, not
// some combination of both.
{
  const [a, b] = Items.ITEM_POOL.filter(i => !i.replacesAbilityId);
  if (a && b) {
    const unit = fakeUnit(genericDef);
    const baseline = unit.maxHP;
    Items.equipItem(unit, a);
    Items.equipItem(unit, b); // should cleanly unequip a first
    if (unit.equippedItem !== b) fail(`re-equip — unit.equippedItem is not the newly equipped item`);
    Items.unequipItem(unit);
    if (unit.maxHP !== baseline) fail(`re-equip — maxHP not back to baseline after unequipping the replacement (was ${baseline}, now ${unit.maxHP}); item A's effect may have leaked through`);
    pass('equipping over an existing item cleanly unequips the old one first');
  } else {
    warn('not enough non-ability-swap items to run the re-equip check');
  }
}

console.log('\n' + (failed ? '❌ item-data-check: FAILURES ABOVE' : '✅ item-data-check: all checks passed'));
process.exit(failed ? 1 : 0);
