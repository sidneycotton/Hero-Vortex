// =============================================================
// ============ SECTION 8: SIMPLE AI ==============================
// =============================================================
// Uses the exact same CombatEngine + AnimationEngine pipeline as
// the player. The AI only decides WHO/WHAT/WHOM, then submits an
// action through submitAction(), same as clicking buttons does.

const AI = {
  // Legacy whole-team decision (kept for reference/compatibility) — picks one actor+ability+target.
  decide(aiUnits, enemyUnits) {
    const livingActors = aiUnits.filter(u => u.alive);
    if (livingActors.length === 0) return null;
    for (const actor of livingActors) {
      const d = this.decideForActor(actor, aiUnits, enemyUnits);
      if (d) return d;
    }
    return null;
  },

  // Speed-based combat plans every actor individually, since all actions
  // for both sides are committed up front before any of them resolve.
  // This is the version used by the resolution phase (Section 10).
  decideForActor(actor, aiUnits, enemyUnits) {
    if (!actor.alive) return null;
    const livingTargets = enemyUnits.filter(u => u.alive);
    if (livingTargets.length === 0) return null;

    const damagedAllies = aiUnits.filter(u => u.alive && u.hp < u.maxHP * 0.6);
    const candidates = [];

    for (const ability of actor.abilities) {
      if (ability.passive) continue;
      if (isOnCooldown(actor, ability)) continue;
      if (isApprovalGated(actor, ability)) continue;
      const flavor = primaryEffectType(ability);
      const dmgStep = ability.effects.find(e => e.verb === 'damage' && (e.target === 'target' || !e.target));
      const abilityPower = dmgStep ? (typeof dmgStep.amount === 'function' ? 0 : dmgStep.amount) : 0;

      // Generic handling for any ability that needs a primary target PLUS a
      // second target chosen via `promptsSecondTarget` (e.g. Babawibby's
      // "Destrua uma Máquina de Guerra": primary target = the ally to
      // sacrifice, secondTarget = the enemy who takes the resulting
      // damage). Detected off the `promptsSecondTarget` field rather than
      // this specific ability id, so any future ability with the same
      // shape gets AI support for free. The primary-target pool follows
      // `ability.targetType`/`targetFilter` exactly like the player's own
      // targeting UI does, and the second target always comes from the
      // opposing side of whoever is using the ability (never hardcoded to
      // "enemyUnits" — actor.team already reflects which side is casting).
      if (ability.promptsSecondTarget) {
        const primaryPool = (ability.targetType === 'ally' ? aiUnits : enemyUnits)
          .filter(u => u.alive && (!ability.targetFilter || ability.targetFilter(u)));
        if (primaryPool.length === 0) continue; // nothing valid to sacrifice/use as primary target right now

        const secondPool = ability.promptsSecondTarget === 'ally' ? aiUnits : enemyUnits;
        const livingSecondPool = secondPool.filter(u => u.alive);
        if (livingSecondPool.length === 0) continue;

        const primaryTarget = primaryPool[Math.floor(Math.random() * primaryPool.length)];
        // Prefer the lowest-HP option on the second-target side. (The
        // "can this score a kill" weighting used in the plain attack
        // branch below relies on reading a fixed `amount` off a
        // target:'target' damage step; abilities in this shape route
        // their damage at ctx.secondTarget instead, so that amount isn't
        // knowable generically here — lowest-HP is the sane fallback.)
        const secondTarget = livingSecondPool.reduce((a, b) => (a.hp < b.hp ? a : b));

        candidates.push({ actor, ability, target: primaryTarget, secondTarget, weight: 2 });
        continue;
      }

      if (flavor === "heal" && damagedAllies.length > 0) {
        const healTarget = damagedAllies.reduce((a, b) => (a.hp / a.maxHP) < (b.hp / b.maxHP) ? a : b);
        candidates.push({ actor, ability, target: healTarget, weight: 3 });
      } else if (flavor === "shield") {
        const unshielded = aiUnits.filter(u => u.alive && u.shield < 5);
        if (unshielded.length > 0) {
          const shieldTarget = unshielded[Math.floor(Math.random() * unshielded.length)];
          candidates.push({ actor, ability, target: shieldTarget, weight: 1.5 });
        }
      } else if (flavor === "attack") {
        for (const target of livingTargets) {
          let weight = 1;
          if (abilityPower > 0 && target.hp <= abilityPower) weight += 2.5; // can score a kill
          if (target.hp / target.maxHP < 0.35) weight += 1.5;
          candidates.push({ actor, ability, target, weight });
        }
      } else {
        // Any other flavor (e.g. a pure utility ability): just try it on a random enemy so it isn't dead weight.
        candidates.push({ actor, ability, target: livingTargets[Math.floor(Math.random() * livingTargets.length)], weight: 0.5 });
      }
    }

    if (candidates.length === 0) {
      // Fall back to any attack-flavored ability against a random living target
      const atk = actor.abilities.find(a => !a.passive && primaryEffectType(a) === 'attack' && !isOnCooldown(actor, a));
      if (atk) return { actor, ability: atk, target: livingTargets[Math.floor(Math.random() * livingTargets.length)] };
      return null;
    }

    const totalWeight = candidates.reduce((s, c) => s + c.weight, 0);
    let r = Math.random() * totalWeight;
    for (const c of candidates) {
      r -= c.weight;
      if (r <= 0) return c;
    }
    return candidates[candidates.length - 1];
  }
};

