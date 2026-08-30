// =============================================================
// ============ RESOLUTION PHASE (v2) ============================
// =============================================================
// Extends the original speed-sort resolver to support:
//  - untargetable status: a queued action whose target is currently
//    untargetable gets retargeted (same rules as a dead target).
//  - moveLast status: units with this status are pushed to the end
//    of the speed order (after the normal sort), regardless of ability speed.
//  - forceImmediateAction: when this verb appears in a resolved action's
//    effects, the target unit's OWN queued action (if not yet resolved)
//    is spliced out of its later position and executed right now, in place
//    of a "sub-step" inside the current action's animation beat.
//  - Bleed (and any future roundEnd-tick status) ticks once at the end
//    of the round, after all queued/forced actions have resolved.

// =============================================================
// ============ ORDER STRIP UI (moved here from the old inline
// ============ beginResolutionPhase block it originally lived in)
// =============================================================

const orderStripEl = document.getElementById('order-strip');

function renderOrderStrip(allActions, activeIndex) {
  orderStripEl.innerHTML = '';
  orderStripEl.classList.add('show');
  allActions.forEach((a, i) => {
    const chip = document.createElement('div');
    chip.className = 'order-chip ' + a.actor.team + (i === activeIndex ? ' active' : '') + (i < activeIndex ? ' done' : '');
    chip.textContent = `⚡${a.ability.speed} ${a.actor.displayName}`;
    orderStripEl.appendChild(chip);
  });
}

function hideOrderStrip() {
  orderStripEl.classList.remove('show');
}

async function beginResolutionPhaseV2() {
  if (phase !== 'planning' || gameOver || !allPlanned()) return;
  // try/finally so SeededRNG.end() (see below) always runs no matter which
  // of the function's several early `return`s (checkGameOver() checks) is
  // hit — otherwise a PVP match could leave Math.random permanently
  // patched to the deterministic per-round RNG.
  try {
    await beginResolutionPhaseV2Inner();
  } finally {
    SeededRNG.end();
    window.PVP_ROUND_SEED = null;
  }
}

async function beginResolutionPhaseV2Inner() {
  phase = 'resolving';
  setCameraOrbitEnabled(false); // ease/snap back to the home framing as battle starts
  inputLocked = true;
  selectedUnit = null; selectedAbility = null;
  renderPartyRow(); renderAbilityRow(); renderTargetRings();
  setTurnIndicator('resolving');

  const round = (window._roundCounter = (window._roundCounter || 0) + 1);

  // Reset per-round "has acted" tracking (read by damageAllActedThisRound)
  // and per-round "times damaged" tracking (read by gainMaxHP's repeat
  // count, e.g. Moldar's Moldar Solar — generic, reusable by any future
  // card that scales off how much punishment its owner took this round).
  [...playerUnits, ...enemyUnits].forEach(u => { u._actedThisRound = false; u._timesDamagedThisRound = 0; });

  // In LAN PVP, the "enemy" side is a human on the other end of the
  // network connection, not the AI — js/net/pvp.js sets this hook to
  // supply that player's already-received plan (translated to point at
  // THIS client's own enemyUnits instances) instead of calling AI.
  // Untouched (stays null) in Vs. AI mode, so behavior there is identical
  // to before.
  const enemyPlan = window.PVP_ENEMY_PLAN_PROVIDER
    ? window.PVP_ENEMY_PLAN_PROVIDER(enemyUnits, playerUnits)
    : [];
  if (!window.PVP_ENEMY_PLAN_PROVIDER) {
    const livingEnemies = enemyUnits.filter(u => u.alive);
    for (const actor of livingEnemies) {
      const decision = AI.decideForActor(actor, enemyUnits, playerUnits);
      if (decision) enemyPlan.push(decision);
    }
  }

  // LAN PVP determinism: both clients must sort/tiebreak/randomly-target
  // identically this round. js/net/pvp.js seeds SeededRNG before calling
  // beginResolutionPhaseV2 in PVP mode; this is a no-op in Vs. AI mode.
  const pvpSeed = window.PVP_ROUND_SEED;
  if (pvpSeed !== undefined && pvpSeed !== null) SeededRNG.begin(pvpSeed);

  let allActions = [...playerPlan, ...enemyPlan]
    .map(a => ({ ...a, tiebreak: Math.random(), resolved: false }))
    .sort((a, b) => (effectiveSpeed(a) - effectiveSpeed(b)) || (a.tiebreak - b.tiebreak));

  // moveLast: partitions anyone who ALREADY holds this status at the very
  // start of the round (e.g. it survived from an edge case) to the back.
  // In the normal case this is a no-op — nobody has moveLast yet here,
  // since it's granted mid-round by an ability (Yvrel's Golpe Atrasador);
  // the actual reordering for that case happens live in the action loop
  // below, right after the status is applied.
  allActions = [
    ...allActions.filter(a => !hasStatus(a.actor, 'moveLast')),
    ...allActions.filter(a => hasStatus(a.actor, 'moveLast'))
  ];

  addLogLine(`— Round begins (${allActions.length} actions queued) —`, 'info');

  // Tracks the most recently RESOLVED action (actor + which ability), read
  // by Gavin's passive (gavinFollowup) check below — generic enough that
  // any future "when an ally acts right after mine" passive can reuse it,
  // not just Gavin's.
  let lastResolvedAction = null;

  let i = 0;
  while (i < allActions.length) {
    const action = allActions[i];
    renderOrderStrip(allActions, i);

    if (action.resolved || !action.actor.alive) { i++; continue; }

    let target = action.target;
    if (!target.alive || hasStatus(target, 'untargetable')) {
      target = retargetIfDead(action, /*excludeUntargetable*/ true);
      if (!target) {
        addLogLine(`${action.actor.displayName}'s ${action.ability.name} had no valid target and fizzled.`, 'info');
        action.resolved = true; i++; continue;
      }
    }

    const bonusFires = await consumeStackingBuffOnNextAbility(action, round);
    if (bonusFires > 0) {
      addLogLine(`${action.actor.displayName}'s ${action.ability.name} fires ${bonusFires}x extra from Reescrever!`, 'info');
      refreshAllUnitUI();
    }

    updateStatus(`⚡${action.ability.speed} — ${action.actor.displayName} uses ${action.ability.name}...`);

    // Generic guardAllies break check: if the acting unit holds a
    // guardAllies status and is about to use an ability that is neither
    // the one that granted the guard NOR its declared "exempt" ability
    // (the skip/no-op that the guard is meant to persist through), the
    // guard ends now, before this action resolves. E.g. Moldar's Vigília
    // Solar stays active through re-using itself AND through his skip
    // ("Paciência") — it only breaks the moment he acts with his OTHER
    // ability (Moldar Solar). Generic — reusable by any future "holds
    // until a real action is taken" status, not guardAllies-specific.
    const existingGuard = action.actor.statuses && action.actor.statuses.find(s => s.id === 'guardAllies');
    if (existingGuard
      && existingGuard.data.grantedByAbilityId !== action.ability.id
      && existingGuard.data.exemptAbilityId !== action.ability.id) {
      removeStatusFromUnit(action.actor, 'guardAllies');
    }

    CombatEngine.recordHistory(action.actor, action.ability.id);
    startCooldown(action.actor, action.ability);
    const result = await AnimationEngine.play({ actor: action.actor, ability: action.ability, target, playerUnits, enemyUnits, round, echo: action.echo, secondTarget: action.secondTarget });
    action.resolved = true;
    action.actor._actedThisRound = true;

    if (checkGameOver()) return;

    // All the reactive mechanics that used to be individual `if` blocks
    // here (gavinFollowup, Slow-attack-copy, forceImmediateAction,
    // summon, sacrificeAlly, swapRoleWithAlly, primeNextAbilityFromStacks)
    // are now registered hooks — see the "REACTIVE MECHANIC HOOKS"
    // section of effects.js. A new reactive card registers its own hook
    // there instead of adding another block here.
    const hookCtx = { i, allActions, result, round, playerUnits, enemyUnits, lastResolvedAction };
    await runActionResolvedHooks(action, hookCtx);
    lastResolvedAction = action;
    if (checkGameOver()) return;

    // moveLast/slow also used to be `if` blocks here, keyed off specific
    // applyStatus results — now dispatched generically by status id via
    // registerStatusAppliedHook (see effects.js), the same way
    // tickRoundEndStatuses already dispatches on status kind.
    const appliedStatuses = (result.applied || []).filter(a => a.verb === 'applyStatus' && a.status);
    for (const applied of appliedStatuses) {
      await runStatusAppliedHooks(applied, hookCtx);
    }

    refreshAllUnitUI();
    await new Promise(r => setTimeout(r, 120));
    i++;
  }

  hideOrderStrip();

  // --- Round-end status ticks (Bleed, punishIfIgnored, etc.) ---
  const allLiving = [...playerUnits, ...enemyUnits].filter(u => u.alive);
  for (const u of allLiving) {
    const tickResults = tickRoundEndStatuses(u);
    for (const er of tickResults) {
      if (er.verb === 'speechBubble') {
        spawnSpeechBubble(er.who, er.text, { cls: er.cls || '' });
        continue;
      }
      const applied = CombatEngine.applyOne(er, { actor: u, ability: { name: 'Sangramento' }, target: er.target });
      if (applied.actualDamage > 0) {
        const label = er.source === 'punishIfIgnored' ? `${u.displayName}'s followup` : 'Sangramento';
        addLogLine(`${er.target.displayName} sofre ${applied.actualDamage} de ${label}.`, 'hit');
        renderFloatingNumbers({ applied: [applied] });
      }
      if (applied.killed) { er.target.alive = false; await er.target.animations.dead(); }
    }
  }
  if (checkGameOver()) return;

  // Expire round-scoped statuses (untargetable, moveLast) for next round.
  [...playerUnits, ...enemyUnits].forEach(expireRoundScopedStatuses);
  // Tick down active ability cooldowns (global Cooldown system).
  [...playerUnits, ...enemyUnits].forEach(tickCooldowns);
  // Undo any temporary slotIndex swaps (Troca de Destino, etc.) now that
  // the round tempRoleTag statuses above have already expired.
  revertTempRoleSwaps([...playerUnits, ...enemyUnits]);

  // Death -> forced hand replacement (see handoff.md's deck/hand/
  // battlefield plan). Player side first, then enemy — sequential per
  // empty slot within each side via resolveForcedReplacements' own loop,
  // so simultaneous deaths still read as separate, legible banners.
  await resolveForcedReplacements(playerUnits, playerHand, "player", "Your");
  await resolveForcedReplacements(enemyUnits, enemyHand, "enemy", "Enemy");
  // A side can be fully out (empty field + empty hand) only after this
  // pass, even if it looked defeated mid-round — re-check here too, not
  // just after the round's action loop and status ticks above.
  if (checkGameOver()) return;

  playerPlan = [];
  multiStepMode = null;
  phase = 'planning';
  setCameraOrbitEnabled(true);
  inputLocked = false;
  setTurnIndicator('planning');
  updateStatus("Choose an ability for each of your units");
  refreshAllUnitUI();
}

// Applies any active speedMod status (next-round tempo buff/debuff) AND any
// active slow status (this-round-only debuff, e.g. Gavin's Golpe Gelado) on
// the acting unit as offsets to that action's ability speed for sort
// purposes only (does not mutate the ability definition itself). A
// positive `delta`/negative slow makes the unit act SOONER/LATER
// respectively (subtracted from speed, since this sort is ascending). The
// two stack independently (a unit could in principle be both Acelerado
// from a prior effect AND Lento from a fresh one). Generic — reusable by
// any future tempo-manipulation card, not just Amelia's/Gavin's.
function effectiveSpeed(action) {
  const statuses = action.actor.statuses || [];
  const speedModStatus = statuses.find(s => s.id === 'speedMod');
  const slowStatus = statuses.find(s => s.id === 'slow');
  const delta = (speedModStatus ? speedModStatus.data.delta : 0) - (slowStatus ? slowStatus.data.amount : 0);
  return action.ability.speed - delta;
}

// Generic "temporary role swap" application: called right after an action
// carrying a swapRoleWithAlly marker resolves (see the main loop above).
// Swaps slotIndex between the two units and tags both with tempRoleTag so
// role-based lookups (findEnemyByRole, UI slot rendering) read the new
// arrangement for the rest of the round, then records how to revert.
function applyTempRoleSwap(actorUnit, allyUnit, actorTag, allyTag) {
  const actorOldSlot = actorUnit.slotIndex;
  const allyOldSlot = allyUnit.slotIndex;
  actorUnit.slotIndex = allyOldSlot;
  allyUnit.slotIndex = actorOldSlot;
  applyStatusToUnit(actorUnit, StatusLib.tempRoleTag(actorTag));
  applyStatusToUnit(allyUnit, StatusLib.tempRoleTag(allyTag));
  actorUnit._pendingSlotRevert = actorOldSlot;
  allyUnit._pendingSlotRevert = allyOldSlot;
}

// Reverts any slotIndex swaps made by applyTempRoleSwap this round. Called
// alongside expireRoundScopedStatuses at round end (tempRoleTag itself
// already expires via duration:'thisRound' — this just undoes the actual
// slotIndex mutation, since that's plain unit state, not a status).
function revertTempRoleSwaps(units) {
  for (const u of units) {
    if (u._pendingSlotRevert !== undefined) {
      u.slotIndex = u._pendingSlotRevert;
      delete u._pendingSlotRevert;
    }
  }
}

// Generic "banked stacks empower my next OTHER ability" consumption. Called
// right before an actor's queued action resolves this round (see the main
// loop above): if that actor is holding a primed stackingBuff status AND
// this upcoming ability isn't in its exclude list, re-run the ability's
// own effects[] the stored number of EXTRA times (stacks) against the same
// target, then clear the priming + the stacks. Generic — any future
// "stacking self-buff that boosts my next move" card reuses this same
// consumption point instead of new per-card engine code.
async function consumeStackingBuffOnNextAbility(action, round) {
  const actor = action.actor;
  const primed = actor._primedStackBuff;
  if (!primed) return 0;
  if (primed.excludeAbilityIds.includes(action.ability.id)) return 0;
  const status = actor.statuses && actor.statuses.find(s => s.id === primed.statusId);
  const stacks = status ? (status.data.stacks || 0) : 0;
  delete actor._primedStackBuff;
  if (status) removeStatusFromUnit(actor, primed.statusId);
  if (!stacks) return 0;
  for (let n = 0; n < stacks; n++) {
    const subResult = CombatEngine.resolve(action.actor, action.ability, action.target, { playerUnits, enemyUnits, round });
    CombatEngine.apply(subResult);
  }
  return stacks;
}

// Extends the original retarget helper with an "exclude untargetable" option.
function retargetIfDead(action, excludeUntargetable = false) {
  const targetType = action.ability.targetType || 'enemy';
  const actorIsPlayer = action.actor.team === 'player';
  let pool;
  if (targetType === 'ally') {
    pool = actorIsPlayer ? playerUnits : enemyUnits;
  } else {
    pool = actorIsPlayer ? enemyUnits : playerUnits;
  }
  let living = pool.filter(u => u.alive);
  if (excludeUntargetable) living = living.filter(u => !hasStatus(u, 'untargetable'));
  if (action.ability.targetFilter) living = living.filter(u => action.ability.targetFilter(u));
  if (living.length === 0) return null;
  if (targetType === 'ally' && action.ability.effects.some(e => e.verb === 'heal')) {
    return living.reduce((a, b) => (a.hp / a.maxHP) < (b.hp / b.maxHP) ? a : b);
  }
  return living[Math.floor(Math.random() * living.length)];
}
