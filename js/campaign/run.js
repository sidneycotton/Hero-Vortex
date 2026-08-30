// =============================================================
// ============ CAMPAIGN RUN STATE ================================
// =============================================================
// Owns the single CampaignRun object for a "President Dário" campaign
// playthrough, plus initCampaignBattle() — the one genuinely new trick
// this mode needs: reusing the SAME live Unit instances across every
// node instead of calling initGame() (which always builds fresh Units
// at full HP). Everything else (resolution, AI, animation) is the
// existing engine, untouched. See CAMPAIGN_DESIGN.md §5.
//
// This module doesn't decide what happens on any given node type (see
// js/campaign/nodes.js) or generate the map (see js/campaign/map.js) —
// it only owns run state + the battle-entry trick + the campaign's own
// win/loss check (permadeath is NOT the same rule as Vs. AI/PVP's
// hand-based isSideOut(), see §5.4).

const Campaign = (() => {
  let run = null; // the live CampaignRun, or null when no campaign is active

  // ---- CampaignRun shape (CAMPAIGN_DESIGN.md §5.1) -----------------------
  function createRun(seed, party) {
    return {
      seed,
      party,             // [Unit, Unit, Unit] — same instances all run long
      deadUnits: [],     // Units removed from `party` on death; Revival Station reads this
      inventory: [],     // unequipped items held in reserve
      gold: 0,
      mapGraph: null,    // set by Campaign.Map once map generation runs
      currentNodeId: null,
      visitedNodeIds: new Set(),
      actProgress: { actIndex: 0 },
    };
  }

  function isActive() {
    return run !== null;
  }

  function getRun() {
    return run;
  }

  // Called once, right after the player's 3-unit draft confirms (reuses
  // TeamSelect same as Vs. AI — see js/campaign/nodes.js's entry point).
  // `draftedIds` is { defender: id, attacker: id, support: id }, exactly
  // the shape a 1-pick-per-role TeamSelect confirm produces.
  function startRun(draftedIds, seed = Date.now()) {
    const party = Object.entries(draftedIds).map(([role, id]) =>
      new Unit(UNIT_DEFS[id], ROLE_SLOT[role], "player")
    );
    run = createRun(seed, party);
    return run;
  }

  function endRun() {
    run = null;
  }

  // ---- Battle entry: the persistence trick (CAMPAIGN_DESIGN.md §5.1) ----
  // Does NOT call initGame(). Reuses each living party Unit exactly as
  // its HP/shield/statuses/counters/cooldowns were left by the previous
  // node, just re-homes it to a fresh battlefield slot/position and makes
  // sure its model is actually in the scene (a Unit removed from the
  // scene at the end of the last node — see endCampaignBattle below —
  // still exists as a live object; only its Object3D was detached).
  //
  // enemyRoster: array of unit ids to spawn as team:"enemy" for this node
  // (a hand-authored per-node list — see js/campaign/nodes.js — NOT
  // pickRandomEnemyDeck(), which draws from the player-draftable pool).
  function initCampaignBattle(enemyRoster) {
    if (!run) throw new Error("initCampaignBattle called with no active CampaignRun");

    // Clear whatever's currently in the battle arrays/scene from the last
    // node (mirrors initGame's own first line) — but only remove models
    // that aren't about to be reused as a surviving party member.
    [...playerUnits, ...enemyUnits].forEach(u => scene.remove(u.model));

    // Re-home each living party member into a fresh player slot, in the
    // original role order the run started with. A dead unit (moved to
    // deadUnits already — see onUnitDied below) simply leaves that slot
    // empty; nothing auto-refills it mid-run (permadeath, §5.4).
    playerUnits = run.party.map((unit, idx) => {
      unit.slotIndex = idx;
      unit.homePosition = SLOT_POSITIONS["player"][idx].clone();
      unit.model.position.copy(unit.homePosition);
      unit.model.rotation.y = Math.PI;
      scene.add(unit.model);
      return unit;
    });

    // No "hand" concept in campaign (§4) — playerHand/enemyHand stay
    // empty so isSideOut()-style hand fallback logic (Vs. AI/PVP only)
    // never accidentally kicks in if some shared code path reads it.
    playerHand = [];
    enemyHand = [];

    enemyUnits = enemyRoster.map((id, idx) =>
      new Unit(UNIT_DEFS[id], ROLE_SLOT_ORDER[idx] !== undefined ? ROLE_SLOT_ORDER[idx] : idx, "enemy")
    );

    // Step 7's Approval Rating hook module (js/campaign/dario-shadow-
    // boss.js) is a no-op the instant enemyUnits doesn't contain the
    // boss — safe to call unconditionally on every node transition, same
    // guarded-additive pattern as the rest of this file. Also clears any
    // stale boss state left over from a previous node (onBattleStart
    // resets it to null when the boss isn't present).
    if (typeof DarioShadowBoss !== 'undefined') {
      DarioShadowBoss.onBattleStart(enemyUnits);
      DarioShadowBoss.renderApprovalBar();
    }

    // Fire every equipped item's onBattleStart (js/campaign/items.js) now
    // that both rosters are live — e.g. "inflict bleed on all enemies" or
    // "gain shield" items that should trigger fresh every fight, not just
    // once on equip. Enemies never have equipped items (Items.poolFor only
    // ever offers/equips onto run.party), so this only needs to run for
    // the player side, but is written enemy-agnostic in case that ever
    // changes.
    if (typeof Items !== 'undefined') {
      Items.triggerAllBattleStart(playerUnits);
      Items.triggerAllBattleStart(enemyUnits);
    }

    selectedUnit = null;
    selectedAbility = null;
    multiStepMode = null;
    inputLocked = false;
    gameOver = false;
    phase = 'planning';
    setCameraOrbitEnabled(true);
    playerPlan = [];
    logPanel.innerHTML = '';
    overlay.classList.remove('show');
    setTurnIndicator('planning');
    buildLabelLayer();
    renderPartyRow();
    renderAbilityRow();
    updateStatus("Choose an ability for each of your units");
  }

  // Slot index per array position for a hand-authored enemy roster —
  // just [0,1,2] in the normal 3-enemy case, matching ROLE_SLOT's own
  // defender/attacker/support -> 0/1/2 mapping used elsewhere.
  const ROLE_SLOT_ORDER = [0, 1, 2];

  // ---- Campaign-specific game-over check (CAMPAIGN_DESIGN.md §5.4) ------
  // NOT the same rule as Vs. AI/PVP's isSideOut(): campaign has no per-role
  // hand to fall back on. A run only ends in defeat if every party slot is
  // simultaneously empty of both a living unit on the field AND an
  // available bench member (offered via Character Pick nodes — tracked in
  // run.bench, added lazily the first time a Character Pick is taken).
  function checkCampaignGameOver() {
    if (!run) return false;
    const anyPartyAlive = playerUnits.some(u => u.alive);
    const benchAvailable = (run.bench || []).length > 0;
    if (!anyPartyAlive && !benchAvailable) return 'defeat';
    if (CombatEngine.isTeamDefeated(enemyUnits)) return 'victory';
    return false;
  }

  // Called by the campaign's own resolution-hook wiring (js/campaign/
  // nodes.js) whenever a party unit's hp hits 0 during a campaign battle.
  // Moves it from `run.party` to `run.deadUnits` so a Revival Station has
  // something to work with, WITHOUT removing it from playerUnits/scene
  // immediately — combat-engine's own death handling (dead animation,
  // isTeamDefeated checks, etc.) still needs it there for the rest of
  // that battle, same as any other unit death.
  function onPartyUnitDied(unit) {
    if (!run) return;
    const idx = run.party.indexOf(unit);
    if (idx !== -1) {
      run.party.splice(idx, 1);
      run.deadUnits.push(unit);
    }
  }

  return {
    createRun, isActive, getRun, startRun, endRun,
    initCampaignBattle, checkCampaignGameOver, onPartyUnitDied,
  };
})();

// Guarded, additive hook (same low-risk pattern as PVP's integration —
// CAMPAIGN_DESIGN.md §8): a no-op whenever no campaign run is active, so
// Vs. AI / PVP battles are provably unaffected. Fires generically off any
// `damage` EffectResult that actually killed a unit — same signal
// resolution.js's own main loop reads (see `applied.killed`) — so it
// needs no special-casing per ability/verb.
registerActionResolvedHook((action, ctx) => {
  if (!Campaign.isActive()) return;
  const kills = (ctx.result.applied || []).filter(a => a.verb === 'damage' && a.killed);
  for (const k of kills) {
    if (k.target.team === 'player') Campaign.onPartyUnitDied(k.target);
  }
});

// ---- TEMPORARY dev entry point (removed once step 8 wires the real
// main-menu Campaign button to the full draft -> map flow) ----
// Lets steps 2/3 be tested in isolation: window.devStartCampaign() in
// the browser console drafts a fixed 3-hero party and drops straight
// into a freshly generated map.
window.devStartCampaign = function (seed) {
  const draft = { defender: "ajax", attacker: "yvrel", support: "mariana" };
  const run = Campaign.startRun(draft, seed || Date.now());
  run.mapGraph = CampaignMap.generate(run.seed);
  CampaignMap.show(run);
};
