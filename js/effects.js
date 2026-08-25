// =============================================================
// ============ EFFECT / STATUS FRAMEWORK =========================
// =============================================================
// Goal: most new "unique" cards should be expressible as DATA using
// these verbs, without touching engine code. Each ability has an
// `effects` array of effect-steps. CombatEngine.resolve() walks the
// array in order, building a flat list of EffectResults. Each verb
// is a pure function: (ctx) -> EffectResult[] (does not mutate state
// directly except via ctx helpers, so resolve/apply stay separable
// the same way the old attack/heal/shield split did).
//
// ctx shape passed to every verb:
// {
//   actor, target,           // the acting unit and the CURRENT resolved target
//   originalTarget,          // target as originally queued (before any redirect)
//   ability,                 // the ability definition being resolved
//   allUnits, playerUnits, enemyUnits,
//   round,                   // round counter
//   history                  // { actor -> [abilityId,...] } this-battle ability history
// }
//
// An EffectResult is one of:
//   { verb:'damage', target, amount, ignoresShield }
//   { verb:'heal', target, amount }
//   { verb:'shield', target, amount }
//   { verb:'applyStatus', target, status }
//   { verb:'removeStatus', target, statusId }
//   { verb:'gainCounter', target, counter, amount }
//   { verb:'spendCounters', target, counter, amount }  // amount = 'all' or number
//   { verb:'forceImmediateAction', target }
//   { verb:'useAbilityOn', actor, ability, target }    // secondary sub-cast
//   { verb:'note', text }                              // free-text log line, no numeric effect
//   { verb:'summon', team, defId, tag, summonedBy }    // marker: orchestrator instantiates a new Unit
//   { verb:'sacrificeAlly', target, found }            // marker: orchestrator removes target from its roster
//   { verb:'heal', target, amount }  (one per living ally) // from healAllAllies
//
// STATUS OBJECTS
// A status is { id, name, kind, data, tickTiming, cleanseOn } where:
//   kind: 'bleed' | 'untargetable' | 'moveLast' | custom string
//   tickTiming: 'roundEnd' | null  (when its onTick fires, if any)
//   cleanseOn: 'anyHeal' | null    (auto-removed when that trigger occurs)
//   data: free-form payload (e.g. { damagePerTick: 5 })
// Statuses live in unit.statuses = [ {...}, ... ].

const StatusLib = {
  bleed(damagePerTick = 5) {
    return {
      id: 'bleed', name: 'Sangrando', kind: 'bleed',
      data: { damagePerTick },
      tickTiming: 'roundEnd',
      cleanseOn: 'anyHeal',
      stacking: false // re-applying refreshes rather than stacks, unless a card says otherwise
    };
  },
  untargetable(duration = 'thisRound') {
    return { id: 'untargetable', name: 'Intocável', kind: 'untargetable', data: {}, duration };
  },
  moveLast(duration = 'thisRound') {
    return { id: 'moveLast', name: 'Move por Último', kind: 'moveLast', data: {}, duration };
  }
};

// --- helpers -----------------------------------------------------

function hasStatus(unit, statusId) {
  return !!(unit.statuses && unit.statuses.find(s => s.id === statusId));
}

function applyStatusToUnit(unit, status) {
  if (!unit.statuses) unit.statuses = [];
  const existing = unit.statuses.find(s => s.id === status.id);
  if (existing) {
    // refresh (overwrite data/duration) rather than duplicate
    Object.assign(existing, status);
  } else {
    unit.statuses.push({ ...status });
  }
}

function removeStatusFromUnit(unit, statusId) {
  if (!unit.statuses) return;
  unit.statuses = unit.statuses.filter(s => s.id !== statusId);
}

function cleanseOn(unit, trigger) {
  if (!unit.statuses || unit.statuses.length === 0) return;
  unit.statuses = unit.statuses.filter(s => s.cleanseOn !== trigger);
}

// Called once per unit at end of round (before statuses with duration:'thisRound' expire)
function tickRoundEndStatuses(unit) {
  const results = [];
  if (!unit.statuses) return results;
  for (const s of unit.statuses) {
    if (s.tickTiming === 'roundEnd' && s.kind === 'bleed' && unit.alive) {
      results.push({ verb: 'damage', target: unit, amount: s.data.damagePerTick, ignoresShield: true, source: 'bleed' });
    }
  }
  return results;
}

// Clears statuses whose duration was scoped to "thisRound"
function expireRoundScopedStatuses(unit) {
  if (!unit.statuses) return;
  unit.statuses = unit.statuses.filter(s => s.duration !== 'thisRound');
}

// =============================================================
// ============ EFFECT VERB IMPLEMENTATIONS =====================
// =============================================================
// Each verb function receives (step, ctx) and returns EffectResult[].
// step = one entry from ability.effects (the raw data-defined step).

const EffectVerbs = {
  damage(step, ctx) {
    const amount = resolveAmount(step.amount, ctx);
    return [{ verb: 'damage', target: resolveTarget(step.target, ctx), amount, ignoresShield: !!step.ignoresShield }];
  },

  heal(step, ctx) {
    const amount = resolveAmount(step.amount, ctx);
    return [{ verb: 'heal', target: resolveTarget(step.target, ctx), amount }];
  },

  // Heals every currently-living unit on the actor's own team by the same
  // flat amount. Generic (not Babawibby-specific) — any support card that
  // wants a team-wide heal can use this instead of one heal step per ally.
  healAllAllies(step, ctx) {
    const amount = resolveAmount(step.amount, ctx);
    const allies = (ctx.actor.team === 'player' ? ctx.playerUnits : ctx.enemyUnits).filter(u => u.alive);
    return allies.map(ally => ({ verb: 'heal', target: ally, amount }));
  },

  shield(step, ctx) {
    const amount = resolveAmount(step.amount, ctx);
    return [{ verb: 'shield', target: resolveTarget(step.target, ctx), amount }];
  },

  applyStatus(step, ctx) {
    const status = typeof step.status === 'function' ? step.status(ctx) : step.status;
    return [{ verb: 'applyStatus', target: resolveTarget(step.target, ctx), status }];
  },

  removeStatus(step, ctx) {
    return [{ verb: 'removeStatus', target: resolveTarget(step.target, ctx), statusId: step.statusId }];
  },

  gainCounter(step, ctx) {
    const amount = resolveAmount(step.amount, ctx);
    return [{ verb: 'gainCounter', target: resolveTarget(step.target, ctx), counter: step.counter, amount }];
  },

  spendCounters(step, ctx) {
    return [{ verb: 'spendCounters', target: resolveTarget(step.target, ctx), counter: step.counter, amount: step.amount || 'all', into: step.into }];
  },

  forceImmediateAction(step, ctx) {
    return [{ verb: 'forceImmediateAction', target: resolveTarget(step.target, ctx) }];
  },

  useAbilityOn(step, ctx) {
    // picks an ability from the actor's kit per the selector, then re-enters
    // the pipeline for that ability against a (possibly different) target.
    // If the queued action carried a player-made choice (ctx.echoChoice —
    // set when the plan entry has an `echo: {ability, target}` field, e.g.
    // from Yvrel's Golpe Eco prompt flow), that choice wins. Otherwise fall
    // back to step.select/step.target (random pick — used by AI-controlled
    // units, which don't go through the UI prompt).
    const chosenAbility = (ctx.echoChoice && ctx.echoChoice.ability) || step.select(ctx);
    if (!chosenAbility) return [];
    const chosenTarget = (ctx.echoChoice && ctx.echoChoice.target) || resolveTarget(step.target, ctx);
    return [{ verb: 'useAbilityOn', actor: ctx.actor, ability: chosenAbility, target: chosenTarget }];
  },

  // Repeats the ENTIRE preceding effect chain (or a named sub-chain) against
  // the same target, if `when(ctx)` is true. Used for Ajax's chain ability.
  repeatIf(step, ctx) {
    if (!step.when(ctx)) return [];
    const subResults = runEffectChain(step.effects, ctx);
    return subResults;
  },

  note(step, ctx) {
    return [{ verb: 'note', text: typeof step.text === 'function' ? step.text(ctx) : step.text }];
  },

  // Summons a new unit onto the actor's team, built from a UNIT_DEFS entry.
  // Actual roster/array mutation (pushing into playerUnits/enemyUnits, giving
  // it a battle slot, building its model) happens in the resolution-phase
  // orchestrator (resolution.js), same pattern as forceImmediateAction — this
  // verb just emits a marker EffectResult naming which def to summon and for
  // which team, plus an optional tag so a later sacrificeAlly step can find it.
  summon(step, ctx) {
    return [{ verb: 'summon', team: ctx.actor.team, defId: step.defId, tag: step.tag || null, summonedBy: ctx.actor }];
  },

  // Sacrifices one living allied unit (selected via `select(ctx)`, typically
  // filtered by the same `tag` a summon step used) to power this ability.
  // Like summon, the roster mutation (removing the unit) is handled by the
  // orchestrator; this verb just marks WHICH unit is being sacrificed. Any
  // later effect steps in the same ability (e.g. a damage step) still run
  // normally regardless of whether a valid sacrifice target was found — the
  // step includes `found` so the orchestrator/UI can no-op the rest of the
  // ability's flavor if nothing was available to sacrifice, if desired.
  sacrificeAlly(step, ctx) {
    const candidates = ctx.playerUnits && ctx.actor.team === 'player'
      ? ctx.playerUnits.filter(u => u.alive && (!step.tag || u.summonTag === step.tag))
      : ctx.enemyUnits.filter(u => u.alive && (!step.tag || u.summonTag === step.tag));
    const chosen = step.select ? step.select(candidates, ctx) : candidates[0];
    return [{ verb: 'sacrificeAlly', target: chosen || null, found: !!chosen }];
  }
};

function resolveAmount(amount, ctx) {
  return typeof amount === 'function' ? amount(ctx) : amount;
}

function resolveTarget(targetSpec, ctx) {
  if (!targetSpec || targetSpec === 'target') return ctx.target;
  if (targetSpec === 'self' || targetSpec === 'actor') return ctx.actor;
  if (typeof targetSpec === 'function') return targetSpec(ctx);
  return ctx.target;
}

// Runs a full effects[] array (ability.effects) against ctx, returns flat EffectResult[].
function runEffectChain(effectSteps, ctx) {
  const out = [];
  for (const step of effectSteps) {
    const verbFn = EffectVerbs[step.verb];
    if (!verbFn) { console.warn('Unknown effect verb:', step.verb); continue; }
    out.push(...verbFn(step, ctx));
  }
  return out;
}
