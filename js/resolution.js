// =============================================================
// ============ RESOLUTION PHASE (v2) ============================
// =============================================================
// Extends the original speed-sort resolver to support:
//  - untargetable status: a queued action whose target is currently
//    untargetable gets retargeted (same rules as a dead target).
//  - moveLast status: units with this status are pushed to the end
//    of the speed order (after the normal sort), regardless of ability speed.
//  - forceImmediateAction: when this verb appears in a resolved action's
//    effects, the target unit's OWN queued action (if not yet resolved) is spliced out of its later position and executed right now, in place
//    of a "sub-step" inside the current action's animation beat.
//  - Bleed (and any future roundEnd-tick status) ticks once at the end
//    of the round, after all queued/forced actions have resolved.

// Ajax 3D runtime is loaded explicitly by index.html immediately after the
// main inline game script. That guarantees the runtime patches the real
// BESPOKE_BUILDERS registry before the player can create a Unit.

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
  phase = 'resolving';
  setCameraOrbitEnabled(false); // ease/snap back to the home framing as battle starts
  inputLocked = true;
  selectedUnit = null; selectedAbility = null;
  renderPartyRow(); renderAbilityRow(); renderTargetRings();
  setTurnIndicator('resolving');

  const round = (window._roundCounter = (window._roundCounter || 0) + 1);

  const enemyPlan = [];
  const livingEnemies = enemyUnits.filter(u => u.alive);
  for (const actor of livingEnemies) {
    const decision = AI.decideForActor(actor, enemyUnits, playerUnits);
    if (decision) enemyPlan.push(decision);
  }

  let allActions = [...playerPlan, ...enemyPlan]
    .map(a => ({ ...a, tiebreak: Math.random(), resolved: false }))
    .sort((a, b) => (a.ability.speed - b.ability.speed) || (a.tiebreak - b.tiebreak));

  // moveLast: units carrying that status act after everyone else this round,
  // preserving relative order among themselves.
  allActions = [
    ...allActions.filter(a => !hasStatus(a.actor, 'moveLast')),
    ...allActions.filter(a => hasStatus(a.actor, 'moveLast'))
  ];

  addLogLine(`— Round begins (${allActions.length} actions queued) —`, 'info');

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

    updateStatus(`⚡${action.ability.speed} — ${action.actor.displayName} uses ${action.ability.name}...`);
    CombatEngine.recordHistory(action.actor, action.ability.id);
    const result = await AnimationEngine.play({ actor: action.actor, ability: action.ability, target, playerUnits, enemyUnits, round, echo: action.echo, secondTarget: action.secondTarget });
    action.resolved = true;

    if (checkGameOver()) return;

    const forced = (result.applied || []).filter(a => a.verb === 'forceImmediateAction');
    for (const f of forced) {
      const forcedUnit = f.target;
      const idx = allActions.findIndex((a, ai) => ai > i && a.actor === forcedUnit && !a.resolved);
      if (idx !== -1) {
        const [forcedAction] = allActions.splice(idx, 1);
        allActions.splice(i + 1, 0, forcedAction);
        addLogLine(`${forcedUnit.displayName} age imediatamente!`, 'info');
      }
    }

    const summons = (result.applied || []).filter(a => a.verb === 'summon');
    for (const s of summons) {
      summonUnitFor(s.team, s.defId, s.tag, s.summonedBy);
    }

    const sacrifices = (result.applied || []).filter(a => a.verb === 'sacrificeAlly' && a.found);
    for (const s of sacrifices) {
      const sacrificedUnit = s.target;
      allActions = allActions.filter((a, ai) => !(ai > i && a.actor === sacrificedUnit));
      removeUnitFromRoster(sacrificedUnit);
    }

    refreshAllUnitUI();
    await new Promise(r => setTimeout(r, 120));
    i++;
  }

  hideOrderStrip();

  const allLiving = [...playerUnits, ...enemyUnits].filter(u => u.alive);
  for (const u of allLiving) {
    const tickResults = tickRoundEndStatuses(u);
    for (const er of tickResults) {
      const applied = CombatEngine.applyOne(er, { actor: u, ability: { name: 'Sangramento' }, target: u });
      if (applied.actualDamage > 0) {
        addLogLine(`${u.displayName} sofre ${applied.actualDamage} de Sangramento.`, 'hit');
        renderFloatingNumbers({ type: 'attack', target: u, actualDamage: applied.actualDamage });
      }
      if (applied.killed) { u.alive = false; await u.animations.dead(); }
    }
  }
  if (checkGameOver()) return;

  [...playerUnits, ...enemyUnits].forEach(expireRoundScopedStatuses);

  playerPlan = [];
  echoSubMode = null;
  phase = 'planning';
  setCameraOrbitEnabled(true);
  inputLocked = false;
  setTurnIndicator('planning');
  updateStatus("Choose an ability for each of your units");
  refreshAllUnitUI();
}

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
