// =============================================================
// ============ DATA-DRIVEN UNIT DEFINITIONS ====================
// =============================================================
// Two ability formats are supported:
//  1) LEGACY:  { type:'attack'|'heal'|'shield', power, targetType }
//     -> auto-upgraded into a single-step effects[] at load time.
//  2) MODERN:  { effects:[ {verb:...}, ... ], targetType }
//     -> used directly. This is how "unique mechanic" cards are built.
//
// role: 'defender' | 'attacker' | 'support' — determines fixed slot
// (left / middle / right). Every team is exactly one of each.

const ROLE_SLOT = { defender: 0, attacker: 1, support: 2 };

// Finds a living enemy unit by role (defender/attacker/support) relative to
// the acting unit's own team. Generic helper — any future card that targets
// "the enemy X" (not just Daxen-Ciris) can reuse this instead of duplicating
// the pool/slot lookup.
function findEnemyByRole(ctx, role) {
  const pool = ctx.actor.team === 'player' ? ctx.enemyUnits : ctx.playerUnits;
  return pool.find(u => u.slotIndex === ROLE_SLOT[role] && u.alive) || null;
}

// Picks the lowest-speed (fastest-resolving) living ability from a unit's
// kit. Ties broken by kit order. Generic — reusable by any future
// "steal/copy the fastest ability" mechanic. Sub-abilities (unit.subAbilities)
// are never candidates — they're only reachable via their own useAbilityOn
// step, never as a freestanding pick.
function fastestAbilityOf(unit) {
  if (!unit || !unit.abilities || !unit.abilities.length) return null;
  const usable = unit.abilities.filter(a => !a.passive);
  if (!usable.length) return null;
  return usable.reduce((best, a) => (a.speed < best.speed ? a : best), usable[0]);
}

// =============================================================
// GLOBAL COOLDOWN SYSTEM
// =============================================================
// Any ability can declare `cooldown: N` (integer rounds). After it's used,
// the unit can't select/use that ability again until N full rounds have
// passed. Tracked per-unit as unit.cooldowns = { abilityId: roundsLeft }.
// Ticked down once per round in resolution.js (tickCooldowns). Checked by
// the ability-selection UI (index.html) and by the AI (index.html) so a
// unit on cooldown never queues that ability again.
function isOnCooldown(unit, ability) {
  return !!(unit.cooldowns && unit.cooldowns[ability.id] > 0);
}

// Generic runtime-conditional-ability gate for CAMPAIGN_DESIGN.md §6.3's
// "Discurso de Campanha" (only usable while the Shadow boss's Approval
// Rating is low). Reads `ability.approvalGated` (plain data on the
// ability def — see js/units/dario_shadow.js) and `unit._approvalRating`
// (a plain number stamped onto the unit by js/campaign/dario-shadow-
// boss.js's phase-tracking hook — no-op/undefined outside that fight,
// same guarded-additive pattern the rest of the campaign layer uses).
// Same category of check as isOnCooldown above, just keyed off a
// campaign-only tracked value instead of a per-unit cooldown counter —
// kept generic (reads any `approvalGated` field, not hardcoded to this
// one ability) so a future card/boss with a similar "gated by an
// external tracked number" mechanic can reuse the same shape.
function isApprovalGated(unit, ability) {
  const gate = ability.approvalGated;
  if (!gate) return false;
  const rating = typeof unit._approvalRating === 'number' ? unit._approvalRating : 50;
  return gate.direction === 'atOrBelow' ? rating > gate.threshold : rating < gate.threshold;
}

function startCooldown(unit, ability) {
  if (!ability.cooldown) return;
  if (!unit.cooldowns) unit.cooldowns = {};
  unit.cooldowns[ability.id] = ability.cooldown;
}

// Ticks every unit's active cooldowns down by 1 at end of round, called
// alongside tickRoundEndStatuses in resolution.js.
function tickCooldowns(unit) {
  if (!unit.cooldowns) return;
  for (const id of Object.keys(unit.cooldowns)) {
    unit.cooldowns[id] = Math.max(0, unit.cooldowns[id] - 1);
    if (unit.cooldowns[id] === 0) delete unit.cooldowns[id];
  }
}

// Reads the current form value of a unit's reactiveForm status by status
// id, or null if it doesn't hold one. Generic helper — reusable by any
// future ability branching on a reactiveForm status, not just Dário's.
function currentForm(unit, statusId) {
  const s = unit.statuses && unit.statuses.find(s => s.id === statusId);
  return s ? s.data.form : null;
}

function upgradeLegacyAbility(ability) {
  if (ability.effects) return ability; // already modern
  const step = {};
  if (ability.type === 'attack') {
    step.verb = 'damage'; step.target = 'target'; step.amount = ability.power;
  } else if (ability.type === 'heal') {
    step.verb = 'heal'; step.target = 'target'; step.amount = ability.power;
  } else if (ability.type === 'shield') {
    step.verb = 'shield'; step.target = 'target'; step.amount = ability.power;
  }
  return { ...ability, effects: [step] };
}

function upgradeUnitDef(def) {
  return {
    ...def,
    abilities: def.abilities.map(upgradeLegacyAbility),
    subAbilities: (def.subAbilities || []).map(upgradeLegacyAbility)
  };
}

// =============================================================
// EXISTING ROSTER (legacy format, auto-upgraded, unchanged behavior)
// =============================================================

const LEGACY_UNIT_DEFS = {};

// =============================================================
// ROSTER — Ajax (defender), Yvrel (attacker), Mariana (support), plus any
// other team: "player" heroes. Built with the modern effects[] pipeline to
// express their unique mechanics without any engine-side special-casing.
// =============================================================

const MODERN_UNIT_DEFS = {};
