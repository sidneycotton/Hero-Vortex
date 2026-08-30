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
      effectResults,
      // Stashed so apply() can find guardAllies-holding allies of a damaged
      // unit without needing its own ctxExtra param — generic plumbing for
      // any future reactive/trigger status, not guardAllies-specific.
      playerUnits: ctxExtra.playerUnits || [], enemyUnits: ctxExtra.enemyUnits || []
    };
  },

  // Apply the effect results. Called at the animation's impact event.
  // Returns the same result object, annotated with actualDamage/actualHeal/etc.
  // for the primary effect (for floating text / log backward-compat), plus
  // a full `applied` list for anything that wants the granular breakdown.
  apply(result) {
    // Generic "nullify the next ability that targets me" check. Consumes the
    // status and skips the ENTIRE effect chain (whole-ability cancel) if the
    // ability's primary target is holding an active nullifyNext status.
    // Reusable by any future card — see StatusLib.nullifyNext in effects.js.
    const t = result.target;
    if (t && t.alive && hasStatus(t, 'nullifyNext')) {
      removeStatusFromUnit(t, 'nullifyNext');
      result.applied = [];
      result.nullified = true;
      return result;
    }
    const applied = [];
    for (const er of result.effectResults) {
      applied.push(this.applyOne(er, result));
    }
    result.applied = applied;

    // Generic reactive-form flip: for every heal or damage result that
    // actually connected AND was dealt/cast by a living ally of the
    // target (not self, not an enemy), check the target for an active
    // reactiveForm status and flip its data.form accordingly. Heals read
    // `dealtBy` isn't tracked on heal results today, so — matching the
    // card text "quando um aliado me curar/danificar" — this uses the
    // acting unit of the WHOLE ability (result.actor) as the source,
    // which is correct for every ability shape in the game (a unit only
    // ever heals/damages via its own actor). Reusable by any future
    // "identity shifts based on how allies treat me" card, not just
    // Dário's kit.
    const formSource = result.actor;
    if (formSource && formSource.alive) {
      for (const a of applied) {
        if (a.verb !== 'heal' && a.verb !== 'damage') continue;
        const target = a.target;
        if (!target || !target.alive) continue;
        if (formSource === target) continue; // self-inflicted doesn't count as "an ally"
        if (formSource.team !== target.team) continue; // must be an ALLY, not an enemy
        if (a.verb === 'heal' && (!a.actualHeal || a.actualHeal <= 0)) continue;
        if (a.verb === 'damage' && (!a.actualDamage || a.actualDamage <= 0)) continue;
        const form = target.statuses && target.statuses.find(s => s.kind === 'reactiveForm');
        if (!form) continue;
        const newForm = a.verb === 'heal' ? form.data.healForm : form.data.damageForm;
        if (newForm === form.data.form) continue;
        form.data.form = newForm;
        // Dual-model characters (currently just Dário) need their visible
        // half swapped when the form actually changes. Generic units
        // without refreshForm() (everyone else) simply don't have the
        // method, so this is a no-op for them.
        if (typeof target.refreshForm === 'function') target.refreshForm(newForm);
      }
    }

    // Generic guardAllies retaliation trigger: for every damage result that
    // actually connected AND has a real attacker (dealtBy — bleed ticks and
    // other sourceless damage have no dealtBy and are skipped), check every
    // OTHER living unit on the damaged unit's own team for an active
    // guardAllies status and have it strike back specifically at the unit
    // that dealt the damage (not a random enemy) — this is what makes the
    // status safe against two mirrored guardAllies holders retaliating into
    // an infinite loop against each other: each retaliation targets the
    // ORIGINAL attacker, whose own retaliation (if it fires) targets back
    // the guardian, not a new random party, so the chain is naturally
    // bounded by the same 1-hit-per-real-attack rule below. Reusable by any
    // future "punish whoever hurt my allies" card, not just Moldar's
    // Vigília Solar.
    const allUnits = [...(result.playerUnits || []), ...(result.enemyUnits || [])];
    for (const a of applied) {
      if (a.verb !== 'damage' || !a.actualDamage || a.actualDamage <= 0) continue;
      if (a.isRetaliation) continue; // a retaliation hit never itself triggers further retaliation
      const victim = a.target;
      const attacker = a.dealtBy;
      if (!victim || !attacker || !attacker.alive) continue;
      const teammates = allUnits.filter(u => u !== victim && u.team === victim.team && u.alive);
      for (const guardian of teammates) {
        const guard = guardian.statuses && guardian.statuses.find(s => s.id === 'guardAllies');
        if (!guard) continue;
        const retaliateResult = this.applyOne(
          { verb: 'damage', target: attacker, amount: guard.data.retaliateAmount },
          result
        );
        result.applied.push({ ...retaliateResult, isRetaliation: true, retaliator: guardian });
      }
    }

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
      // "Ao invés de me danificar, o dano dele me cura neste turno": if
      // this hit only landed on `t` because it was redirected from a
      // provoked ally `t` is protecting (er.redirectedFrom), and `t` is
      // holding a matching redirectDamageAsHeal status for that exact
      // ally, heal instead of damaging. Direct hits on `t` (no redirect)
      // are unaffected — this only converts protection damage.
      const healInstead = t.statuses && t.statuses.find(s =>
        s.id === 'redirectDamageAsHeal' && er.redirectedFrom && s.data.protectedAlly === er.redirectedFrom);
      if (healInstead) {
        const before = t.hp;
        t.hp = Math.min(t.maxHP, t.hp + er.amount);
        return { verb: 'heal', target: t, amount: er.amount, actualHeal: t.hp - before, convertedFromDamage: true };
      }
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
      // Track "times damaged this round" generically (reset each round in
      // resolution.js) — read by gainMaxHP's repeat count, e.g. Moldar's
      // Moldar Solar. Only counts damage that actually connected (dmg > 0),
      // so a fully-shielded hit doesn't count as "damaged".
      if (dmg > 0) t._timesDamagedThisRound = (t._timesDamagedThisRound || 0) + 1;
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
    if (er.verb === 'stealShield') {
      if (!t || !t.alive) return { ...er, actualStolen: 0 };
      const stolen = er.amount === 'all' ? t.shield : Math.min(t.shield, er.amount);
      t.shield -= stolen;
      if (er.to && er.to.alive) er.to.shield += stolen;
      return { ...er, actualStolen: stolen };
    }
    if (er.verb === 'gainMaxHP') {
      if (!t || !t.alive) return { ...er, actualGain: 0 };
      t.maxHP += er.amount;
      if (er.healToFull === false) {
        // explicit opt-out (e.g. Sirius's Troca de Destino): raise the
        // ceiling only, current HP unchanged
      } else {
        t.hp = t.maxHP;
      }
      return { ...er, actualGain: er.amount };
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
    if (er.verb === 'purify') {
      if (!t || !t.alive) return { ...er, hadStatuses: false, hadCounters: false };
      const { hadStatuses, hadCounters } = purifyUnit(t);
      return { ...er, hadStatuses, hadCounters };
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
    if (er.verb === 'speechBubble') {
      // Purely cosmetic marker — no state mutation. The actual DOM popup
      // is spawned by renderFloatingNumbers (animation-engine.js), same
      // split as damage/heal (state here, visuals there).
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
