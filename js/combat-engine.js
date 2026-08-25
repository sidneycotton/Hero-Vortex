// =============================================================
// ============ COMBAT ENGINE (v2 — effect-pipeline based) =====
// =============================================================
// Same contract as before: resolve() computes outcomes WITHOUT
// mutating state, apply() mutates state at the animation's impact
// event. The difference is resolve() now walks ability.effects
// through the EffectVerbs pipeline instead of a hardcoded
// attack/heal/shield switch. Legacy abilities that still use
// {type:'attack'|'heal'|'shield', power} are auto-upgraded to a
// single-step effects[] at load time (see units.js loader), so old
// content keeps working unchanged.

const CombatEngine = {
  // actorHistory: Map<unit, string[]> of ability ids used this battle, oldest->newest.
  actorHistory: new Map(),

  recordHistory(actor, abilityId) {
    if (!this.actorHistory.has(actor)) this.actorHistory.set(actor, []);
    this.actorHistory.get(actor).push(abilityId);
  },
  lastAbilityId(actor) {
    const h = this.actorHistory.get(actor);
    return h && h.length ? h[h.length - 1] : null;
  },

  // Resolve numeric outcome of an ability WITHOUT applying it.
  // Returns { actor, ability, target, type, effectResults: [...] }
  resolve(actor, ability, target, ctxExtra = {}) {
    const ctx = {
      actor, target, originalTarget: target, ability,
      allUnits: [...(ctxExtra.playerUnits || []), ...(ctxExtra.enemyUnits || [])],
      playerUnits: ctxExtra.playerUnits || [],
      enemyUnits: ctxExtra.enemyUnits || [],
      round: ctxExtra.round || 0,
      echoChoice: ctxExtra.echoChoice || null, // player-made {ability,target} for useAbilityOn steps, if any
      secondTarget: ctxExtra.secondTarget || null // player-made second target, e.g. Babawibby's sacrifice-then-damage flow
    };
    const effectResults = runEffectChain(ability.effects, ctx);
    // Legacy top-level fields kept for anything still reading result.type etc.
    const primary = effectResults.find(r => r.verb === 'damage' || r.verb === 'heal' || r.verb === 'shield');
    return {
      actor, ability, target,
      type: primary ? primary.verb : (effectResults[0] && effectResults[0].verb) || 'none',
      effectResults
    };
  },

  // Apply the effect results. Called at the animation's impact event.
  // Returns the same result object, annotated with actualDamage/actualHeal/etc.
  // for the primary effect (for floating text / log backward-compat), plus
  // a full `applied` list for anything that wants the granular breakdown.
  apply(result) {
    const applied = [];
    for (const er of result.effectResults) {
      applied.push(this.applyOne(er, result));
    }
    result.applied = applied;

    // Backward-compat convenience fields (floating text / log reads these)
    const dmg = applied.find(a => a.verb === 'damage');
    const heal = applied.find(a => a.verb === 'heal');
    const shield = applied.find(a => a.verb === 'shield');
    if (dmg) { result.actualDamage = dmg.actualDamage; result.absorbedByShield = dmg.absorbedByShield; result.killed = dmg.killed; }
    if (heal) { result.actualHeal = heal.actualHeal; }
    if (shield) { result.shieldAmount = shield.amount; }

    return result;
  },

  applyOne(er, result) {
    const t = er.target;
    if (er.verb === 'damage') {
      if (!t || !t.alive) return { ...er, actualDamage: 0 };
      let dmg = er.amount;
      let absorbed = 0;
      if (!er.ignoresShield && t.shield > 0) {
        absorbed = Math.min(t.shield, dmg);
        t.shield -= absorbed;
        dmg -= absorbed;
      }
      t.hp = Math.max(0, t.hp - dmg);
      const killed = t.hp <= 0 && t.alive;
      if (killed) t.alive = false;
      return { ...er, actualDamage: dmg, absorbedByShield: absorbed, killed };
    }
    if (er.verb === 'heal') {
      if (!t || !t.alive) return { ...er, actualHeal: 0 };
      const before = t.hp;
      t.hp = Math.min(t.maxHP, t.hp + er.amount);
      cleanseOn(t, 'anyHeal'); // e.g. clears Bleed
      return { ...er, actualHeal: t.hp - before };
    }
    if (er.verb === 'shield') {
      if (!t || !t.alive) return er;
      t.shield += er.amount;
      return er;
    }
    if (er.verb === 'applyStatus') {
      if (!t || !t.alive) return er;
      applyStatusToUnit(t, er.status);
      return er;
    }
    if (er.verb === 'removeStatus') {
      if (!t) return er;
      removeStatusFromUnit(t, er.statusId);
      return er;
    }
    if (er.verb === 'gainCounter') {
      if (!t) return er;
      if (!t.counters) t.counters = {};
      t.counters[er.counter] = (t.counters[er.counter] || 0) + er.amount;
      return { ...er, newTotal: t.counters[er.counter] };
    }
    if (er.verb === 'spendCounters') {
      if (!t || !t.counters) return { ...er, spent: 0 };
      const have = t.counters[er.counter] || 0;
      const spend = er.amount === 'all' ? have : Math.min(have, er.amount);
      t.counters[er.counter] = have - spend;
      return { ...er, spent: spend };
    }
    if (er.verb === 'forceImmediateAction') {
      // Actual queue manipulation happens in the resolution-phase orchestrator
      // (it needs access to the round's action list), so this is just a marker
      // the orchestrator watches for. No direct state mutation here.
      return er;
    }
    if (er.verb === 'useAbilityOn') {
      // Sub-cast: resolve + apply immediately, nested.
      const subResult = CombatEngine.resolve(er.actor, er.ability, er.target);
      CombatEngine.apply(subResult);
      return { ...er, subResult };
    }
    if (er.verb === 'note') {
      return er;
    }
    if (er.verb === 'summon' || er.verb === 'sacrificeAlly') {
      // Roster mutation (creating/removing a Unit + its 3D model, giving it
      // a battle slot) needs access to playerUnits/enemyUnits and the scene,
      // neither of which combat-engine.js touches. The resolution-phase
      // orchestrator watches result.applied for these markers and performs
      // the actual mutation there (see resolution.js), same pattern as
      // forceImmediateAction above.
      return er;
    }
    return er;
  },

  teamAlive(units) { return units.filter(u => u.alive); },
  isTeamDefeated(units) { return units.every(u => !u.alive); }
};
