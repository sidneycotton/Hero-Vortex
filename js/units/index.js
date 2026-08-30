
const UNIT_DEFS = {};
for (const [id, def] of Object.entries(LEGACY_UNIT_DEFS)) UNIT_DEFS[id] = upgradeUnitDef(def);
for (const [id, def] of Object.entries(MODERN_UNIT_DEFS)) UNIT_DEFS[id] = upgradeUnitDef(def);
// Campaign-exclusive enemies (team: "enemy_only") — registered into the
// same UNIT_DEFS lookup Unit()/new Unit(UNIT_DEFS[id], ...) reads from,
// but their team value already excludes them from every
// def.team === "player" filter below and in team-select.js, so they can
// never be drafted or drawn as a Vs. AI/PVP enemy.
for (const [id, def] of Object.entries(CAMPAIGN_UNIT_DEFS)) UNIT_DEFS[id] = upgradeUnitDef(def);

// Player roster now Ajax(defender) / Yvrel(attacker) / Mariana(support),
// in fixed slot order [defender, attacker, support] = [left, middle, right].
const PLAYER_ORDER = ["ajax", "yvrel", "mariana"];

// Enemy teams are no longer a fixed roster. Each battle, the enemy side
// draws one random unit per role (defender/attacker/support) from the same
// pool of team: "player" heroes used for the player's own draft, excluding
// summon-only units (see TeamSelect.SUMMON_ONLY_UNIT_IDS in
// js/team-select.js — those only ever appear via the `summon` verb
// mid-battle, so they can't be drawn as a starting roster slot for either
// side). Returns an array of 3 unit ids in [defender, attacker, support]
// order, matching the shape ENEMY_ORDER used to have.
function pickRandomEnemyOrder() {
  // Mirrors TeamSelect.SUMMON_ONLY_UNIT_IDS (js/team-select.js). Kept as its
  // own literal rather than reading TeamSelect at call time: js/units.js
  // loads before js/team-select.js (see <script> order in index.html), and
  // pickRandomEnemyOrder() should not depend on load-order timing to stay
  // correct. If a future summon-only unit is added, add its id to BOTH
  // lists.
  const summonOnly = new Set(["maquina_de_guerra"]);
  const roles = ["defender", "attacker", "support"];
  return roles.map(role => {
    const candidates = Object.values(UNIT_DEFS).filter(def =>
      def.team === "player" && def.role === role && !summonOnly.has(def.id)
    );
    if (!candidates.length) {
      throw new Error(`No team:"player" unit available for role "${role}" to draft as an enemy.`);
    }
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    return pick.id;
  });
}

// Enemy equivalent of a player's team-select deck: draws up to 2 random
// unit ids per role from the same player-eligible pool (excluding
// summon-only units), returned in the same { defender: [id,id],
// attacker: [id,id], support: [id,id] } shape TeamSelect.open's onConfirm
// now produces for the player. Written generically against however many
// candidates actually exist per role (currently exactly 2 each) rather
// than assuming a fixed count, so it keeps working if the roster grows.
// pickRandomEnemyOrder() above is kept for now as the older, single-pick
// version some paths may still reference; this is the new deck-shaped
// entry point for the starter-choice flow.
function pickRandomEnemyDeck() {
  const summonOnly = new Set(["maquina_de_guerra"]);
  const roles = ["defender", "attacker", "support"];
  const deck = {};
  roles.forEach(role => {
    const candidates = Object.values(UNIT_DEFS).filter(def =>
      def.team === "player" && def.role === role && !summonOnly.has(def.id)
    );
    if (!candidates.length) {
      throw new Error(`No team:"player" unit available for role "${role}" to draft as an enemy.`);
    }
    // Shuffle and take up to 2 (or fewer if the pool is smaller).
    const shuffled = candidates.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    deck[role] = shuffled.slice(0, 2).map(def => def.id);
  });
  return deck;
}
