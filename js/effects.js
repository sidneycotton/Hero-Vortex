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
  // Generic "shield the next incoming ability" status: the next ability that
  // TARGETS this unit (any actor, any verb) is fully cancelled — its whole
  // effects[] chain never applies — and the status is then consumed. Checked
  // centrally in combat-engine.js (applyOne) so any future card can reuse it
  // by just applying this status, no engine special-casing per-card.
  nullifyNext(duration = 'thisRound') {
    return { id: 'nullifyNext', name: 'Anular Próxima', kind: 'nullifyNext', data: {}, duration };
  },
  moveLast(duration = 'thisRound') {
    return { id: 'moveLast', name: 'Move por Último', kind: 'moveLast', data: {}, duration };
  },
  // Generic ability-speed offset for the unit's NEXT round of queued
  // actions. Positive delta = lower resulting speed number = acts sooner
  // (this engine's speed sort is ascending, per units.js). Uses
  // duration:'nextRound' (not 'thisRound') because the round-end cleanup
  // that runs right after this ability resolves would otherwise wipe the
  // status before the round it's actually meant to affect ever starts its
  // own speed sort — see expireRoundScopedStatuses/expireNextRoundStatuses
  // in effects.js. Reusable by any future tempo-manipulation card, not
  // Amelia-specific.
  speedMod(delta, duration = 'nextRound') {
    return { id: 'speedMod', name: delta >= 0 ? 'Acelerado' : 'Desacelerado', kind: 'speedMod', data: { delta }, duration };
  },

  // Generic STACKING self-status: each re-cast while active adds +1 stack
  // instead of just refreshing. `data.stacks` starts at 1 and increments on
  // every re-application (see applyStatusToUnit's stacking branch below).
  // `data.bonusPerStack` is free-form payload a card can read however it
  // likes (e.g. "extra uses granted to the next OTHER ability"). Consumed
  // by whichever ability step reads it and then removes it — this status
  // itself has no built-in expiry/consumption logic, keeping it reusable
  // for any future "stacks that boost my next move" mechanic, not just
  // Sirius's Reescrever.
  stackingBuff(id, name, bonusPerStack = {}) {
    return {
      id, name, kind: 'stackingBuff',
      data: { stacks: 1, bonusPerStack },
      stacking: true
    };
  },

  // Generic TEMPORARY ROLE-TAG status: overrides how a unit is treated for
  // role-based lookups (findEnemyByRole, targeting, etc.) for the rest of
  // the round only. `data.tag` is the temporary role string
  // ('attacker'/'defender'/'support'). Reusable by any future "swap roles/
  // disguise" mechanic, not just Sirius's Troca de Destino.
  tempRoleTag(tag, duration = 'thisRound') {
    return { id: 'tempRoleTag', name: 'Papel Trocado', kind: 'tempRoleTag', data: { tag }, duration };
  },

  // Generic TEAM-WIDE "this turn" ability-damage-bonus status. Any `damage`
  // effect step whose actor is on the tagged team gets +data.amount extra
  // damage added at resolution time (see EffectVerbs.damage below).
  // duration:'thisRound' expires it automatically like other round-scoped
  // statuses. Reusable by any future team-wide damage-buff card.
  teamDamageBonus(amount, duration = 'thisRound') {
    return { id: 'teamDamageBonus', name: 'Poder Ampliado', kind: 'teamDamageBonus', data: { amount }, duration };
  },

  // Generic "standing guard" status: while active, whenever ANY living
  // ally of the holder takes damage, the holder retaliates for a flat
  // amount against one enemy. It is NOT time-limited — it is only removed
  // by the guard-break check in resolution.js the moment the holder's OWN
  // queued action this round uses an ability that is neither the one that
  // granted the guard nor its declared `exemptAbilityId` (typically the
  // holder's own "skip/do nothing" ability, which the guard is meant to
  // persist through). Reusable by any future "I'll hold this until I
  // actually act" card, not just Moldar's Vigília Solar.
  guardAllies(retaliateAmount, grantedByAbilityId, exemptAbilityId = null) {
    return {
      id: 'guardAllies', name: 'Vigília Solar', kind: 'guardAllies',
      data: { retaliateAmount, grantedByAbilityId, exemptAbilityId }
    };
  },

  // Generic "act right after me" passive marker: no built-in behavior of
  // its own — the actual "deal X damage to all enemies" payoff is read/
  // consumed generically in resolution.js's main loop (see the
  // "gavinFollowup passive trigger" block there), the same pattern
  // guardAllies uses for its own reactive check. Permanent (no duration) —
  // granted once at spawn via the passive-ability spawn hook. Reusable by
  // any future "when an ally acts right after mine" passive, not just
  // Gavin's Presença Ameaçadora.
  gavinFollowup(amount = 2) {
    return { id: 'gavinFollowup', name: 'Presença Ameaçadora', kind: 'gavinFollowup', data: { amount } };
  },

  // Generic "Slow" status: no built-in behavior of its own beyond being a
  // taggable, stacking-duration marker — the actual "when a Slow enemy
  // attacks, do X" payoff is read/consumed by whichever card grants it
  // (see Gavin's Golpe Gelado, checked in resolution.js's main loop the
  // same way guardAllies/moveLast are). `data.turns` counts down by 1 at
  // the end of each round the unit is still alive (ticked alongside the
  // other roundEnd-timing statuses) and the status is removed once it
  // hits 0. Reusable by any future "impose a lingering debuff that pays
  // off when the target eventually acts" card, not just Gavin's.
  // `grantedBy` + `abilityId` let a generic "when a Slowed unit attacks,
  // its granter re-casts a copy of the granting ability" check (see
  // Gavin's Golpe Gelado, read in resolution.js's main loop) find who to
  // re-cast for and which ability to re-cast, without hardcoding Gavin's
  // id anywhere in the engine — any future card that grants slow() with
  // its own `grantedBy`/`abilityId` gets the same payoff for free.
  //
  // "Lento X" makes the unit's ability effectively X SLOWER for the rest
  // of THIS round (a higher speed number resolves later, since the round
  // sort is ascending). Kept as its OWN status id (not reusing speedMod)
  // because speedMod already means something distinct — a buff/debuff that
  // carries into NEXT round (see Amelia's Fluxo do Tempo) — and the two
  // need to stack independently rather than overwrite each other.
  // effectiveSpeed() in resolution.js reads both this and speedMod and
  // sums their offsets. duration:'thisRound' so it's cleared at the normal
  // end-of-round status expiry alongside untargetable/moveLast — no custom
  // tick needed. Because the round's speed order is only sorted ONCE up
  // front, applying this mid-round requires re-splicing the target's
  // still-queued action to its new position — handled generically in
  // resolution.js right after the applyStatus step resolves (see "Handle
  // slow" alongside the existing moveLast-splice handling there).
  slow(amount = 2, grantedBy = null, abilityId = null) {
    return {
      id: 'slow', name: 'Lento', kind: 'slow',
      data: { amount, grantedBy, abilityId },
      duration: 'thisRound'
    };
  },

  // Generic "marked" status: no built-in behavior of its own — just a
  // taggable marker any card can apply/read/consume. Carmelita Marquese's
  // kit is the first user (mark an ally, later trigger everyone marked,
  // later heal everyone marked), but it's reusable by any future
  // "set up now, pay off later" support card.
  marqueseMark() {
    return { id: 'marquese_mark', name: 'Marca de Marquese', kind: 'marker', data: {} };
  },

  // Generic REACTIVE TWO-FORM status: starts at `initialForm` and flips to
  // `healForm` whenever the holder is healed by an ally, or to `damageForm`
  // whenever the holder is damaged by an ally — checked generically in
  // combat-engine.js's apply() right after any heal/damage actually
  // connects (see the "reactive form flip" block there). `data.form` is the
  // current form id, read by any ability step that wants to branch on it
  // (see Dário's abilities using `ctx.actor.statuses` to check
  // `data.form`). Not time-limited, no duration — this is a permanent trait
  // of the unit, not a temporary buff. Reusable by any future "my identity
  // shifts based on how my allies treat me" card, not just Dário's kit.
  reactiveForm(id, initialForm, healForm, damageForm) {
    return {
      id, name: 'Forma Reativa', kind: 'reactiveForm',
      data: { form: initialForm, healForm, damageForm }
    };
  },

  // Generic "Provocar" (taunt) status: applied to a TARGET unit, naming
  // `provokerId`/`provoker` as who provoked it. While active, any ability
  // whose effects target this unit gets its target REDIRECTED to the
  // provoker instead — checked centrally in combat-engine.js's resolve()
  // (see resolveTarget's provoke redirect) so any future card that grants
  // provoke() gets the same payoff for free, no per-card engine code.
  // "Todas as partes alvejadas" (every targeted part) is honored by
  // redirecting at the resolveTarget layer, which every effect step
  // (damage/heal/shield/applyStatus/etc.) already funnels through.
  // duration:'thisRound' — a provoke lasts for the round it was granted in
  // unless a card explicitly re-applies it (e.g. O Porteiro's H3, used
  // every round it wants to keep tanking).
  provoke(provoker, duration = 'thisRound') {
    return { id: 'provoke', name: 'Provocado', kind: 'provoke', data: { provoker }, duration };
  },

  // Generic "punish being ignored" marker: applied to the ACTOR (not the
  // target) right after it hits someone. If the holder takes no damage
  // from anyone before this round ends, a round-end tick (see
  // tickRoundEndStatuses below) deals `data.followupAmount` more damage to
  // `data.originalTarget` and fires the holder's `data.tauntLine`. Getting
  // hit at any point this round (tracked via `data.wasHit`, flipped by the
  // damage-tracking hook registered below) cancels the followup — the
  // status is still cleared at round end either way, since it's
  // duration:'thisRound'. Reusable by any future "acts again if ignored"
  // card, not just O Porteiro's H1.
  punishIfIgnored(originalTarget, followupAmount, tauntLine, shoutLine) {
    return {
      id: 'punishIfIgnored', name: 'Se Não For Atacado...', kind: 'punishIfIgnored',
      data: { originalTarget, followupAmount, wasHit: false, tauntLine, shoutLine },
      duration: 'thisRound'
    };
  },

  // Generic "damage that lands on me from protecting `protectedAlly` heals
  // me instead" status. Pairs with StatusLib.provoke: when the holder
  // grants provoke() to an ally, any enemy effect that gets redirected
  // onto the holder because of that provoke would normally just damage
  // him — this status flips those specific redirected hits into heals
  // instead (see combat-engine.js's applyOne damage branch, which checks
  // for this status + provoke's own redirect marker together). Only
  // applies to damage the holder takes AS A RESULT of the redirect (i.e.
  // damage whose original target, before redirect, was `protectedAlly`),
  // not to damage aimed at the holder directly. Reusable by any future
  // "my protection heals me" card, not just O Porteiro's Provocar.
  redirectDamageAsHeal(protectedAlly, duration = 'thisRound') {
    return { id: 'redirectDamageAsHeal', name: 'Prote\u00e7\u00e3o Reconfortante', kind: 'redirectDamageAsHeal', data: { protectedAlly }, duration };
  }
};

// Generic "Purificar" verb support: a status counts as PURIFIABLE (i.e.
// something the unit "gained" rather than a static trait of the card) if
// it was applied via applyStatus/applyStatusToTeam during the battle. In
// this engine EVERY entry in unit.statuses is exactly that — nothing
// static about a card's own definition ever lives in unit.statuses, that
// data stays on the unit's def/abilities. So "purify" is simply: clear
// unit.statuses AND unit.counters (gained stacks like Sirius's Reescrever
// or Mariana's Golpe de Luz counters) entirely. Shield is intentionally
// left untouched — it isn't a status/counter and no card text described
// here calls it out. Kept as its own named function (not inlined into the
// verb below) so it's reusable anywhere else "strip everything gained"
// is needed.
function purifyUnit(unit) {
  const hadStatuses = !!(unit.statuses && unit.statuses.length);
  const hadCounters = !!(unit.counters && Object.keys(unit.counters).length);
  unit.statuses = [];
  unit.counters = {};
  return { hadStatuses, hadCounters };
}

// --- helpers -----------------------------------------------------

function hasStatus(unit, statusId) {
  return !!(unit.statuses && unit.statuses.find(s => s.id === statusId));
}

function applyStatusToUnit(unit, status) {
  if (!unit.statuses) unit.statuses = [];
  const existing = unit.statuses.find(s => s.id === status.id);
  if (existing) {
    if (status.stacking) {
      // True stacking: bump the running stack count instead of overwriting.
      // Re-casting a stackingBuff status accumulates data.stacks; anything
      // else about the status (name/kind) stays as first applied.
      existing.data = existing.data || {};
      existing.data.stacks = (existing.data.stacks || 1) + 1;
    } else {
      // refresh (overwrite data/duration) rather than duplicate
      Object.assign(existing, status);
    }
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
    // punishIfIgnored payoff: holder went the whole round without being
    // hit -> extra damage lands on the original target now, plus the
    // "shouted" speech line. `dealtBy: unit` so this still counts as a
    // normal attack for anything reading it (guardAllies retaliation,
    // reactiveForm flips, etc.) — it IS the holder acting, just delayed
    // to round-end.
    if (s.kind === 'punishIfIgnored' && unit.alive && !s.data.wasHit
      && s.data.originalTarget && s.data.originalTarget.alive) {
      results.push({ verb: 'damage', target: s.data.originalTarget, amount: s.data.followupAmount, dealtBy: unit, source: 'punishIfIgnored' });
      results.push({ verb: 'speechBubble', who: unit, text: s.data.shoutLine || '...', cls: 'shout' });
    }
  }
  return results;
}

// Clears statuses whose duration was scoped to "thisRound", and "ages"
// any "nextRound"-scoped status into "thisRound" so it survives exactly
// one round-end cleanup (the one immediately after it was granted) and
// then gets cleared at the NEXT round-end — i.e. it's live for exactly
// the one round after the round it was cast in. Without this ageing step,
// a status meant to affect "next round" (e.g. Amelia's Fluxo do Tempo)
// would be wiped by this same function before next round's speed-sort
// ever got to read it.
function expireRoundScopedStatuses(unit) {
  if (!unit.statuses) return;
  unit.statuses = unit.statuses.filter(s => s.duration !== 'thisRound');
  unit.statuses.forEach(s => { if (s.duration === 'nextRound') s.duration = 'thisRound'; });
}

// =============================================================
// ============ EFFECT VERB IMPLEMENTATIONS =====================
// =============================================================
// Each verb function receives (step, ctx) and returns EffectResult[].
// step = one entry from ability.effects (the raw data-defined step).

const EffectVerbs = {
  damage(step, ctx) {
    const amount = resolveAmount(step.amount, ctx);
    const bonusStatus = ctx.actor.statuses && ctx.actor.statuses.find(s => s.id === 'teamDamageBonus');
    const bonus = bonusStatus ? bonusStatus.data.amount : 0;
    ctx._lastRedirectedFrom = null;
    const target = resolveTarget(step.target, ctx);
    return [{ verb: 'damage', target, amount: amount + bonus, ignoresShield: !!step.ignoresShield, dealtBy: ctx.actor, redirectedFrom: ctx._lastRedirectedFrom }];
  },

  heal(step, ctx) {
    const amount = resolveAmount(step.amount, ctx);
    return [{ verb: 'heal', target: resolveTarget(step.target, ctx), amount }];
  },

  // Deals damage to every living enemy who has ALREADY resolved an action
  // this round (tracked via unit._actedThisRound, set by the resolution-
  // phase orchestrator — see resolution.js). Generic "punish units that
  // already moved" verb — reusable by any future tempo/retribution card,
  // not Amelia-specific.
  damageAllActedThisRound(step, ctx) {
    const amount = resolveAmount(step.amount, ctx);
    const enemies = (ctx.actor.team === 'player' ? ctx.enemyUnits : ctx.playerUnits)
      .filter(u => u.alive && u._actedThisRound);
    return enemies.map(u => ({ verb: 'damage', target: u, amount, ignoresShield: !!step.ignoresShield, dealtBy: ctx.actor }));
  },

  // Deals flat damage to every currently-living enemy of the actor.
  // Generic AOE verb — reusable by any future "hits the whole enemy team"
  // card, not just Gavin's passive.
  damageAllEnemies(step, ctx) {
    const amount = resolveAmount(step.amount, ctx);
    const enemies = (ctx.actor.team === 'player' ? ctx.enemyUnits : ctx.playerUnits).filter(u => u.alive);
    return enemies.map(u => ({ verb: 'damage', target: u, amount, ignoresShield: !!step.ignoresShield, dealtBy: ctx.actor }));
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

  // Generic "steal shield" verb: removes up to `amount` shield points from
  // `target` and grants them to `to` (defaults to the actor). If `amount`
  // is omitted or 'all', steals everything the target currently has.
  // Reusable by any future "drain the enemy's protection" card, not just
  // Dário's Sombra form.
  stealShield(step, ctx) {
    const target = resolveTarget(step.target, ctx);
    const to = step.to ? resolveTarget(step.to, ctx) : ctx.actor;
    return [{ verb: 'stealShield', target, to, amount: step.amount === undefined ? 'all' : resolveAmount(step.amount, ctx) }];
  },

  // Generic "double the target's current shield" verb — adds shield equal
  // to what the target already has banked. Reusable by any future "amplify
  // existing protection" card, not just Dário's Senador form.
  doubleShield(step, ctx) {
    const target = resolveTarget(step.target, ctx);
    return [{ verb: 'shield', target, amount: (t => t ? t.shield : 0)(target) }];
  },

  // Permanently raises the target's max HP (and, unless step.healToFull
  // is explicitly false, its current HP by the same amount, keeping the
  // heal-to-full-of-new-max convention most "gain max HP" cards want).
  // `amount` is the PER-REPETITION amount; `repeatPerDamageTaken: true`
  // multiplies it by how many times the target was damaged THIS round
  // (unit._timesDamagedThisRound, tracked generically in combat-engine.js
  // / reset in resolution.js), with a minimum of 1 repetition so the base
  // amount always applies at least once. Generic — reusable by any future
  // "grows tougher under pressure" card (e.g. Moldar's Moldar Solar) or
  // plain permanent-stat-growth card (e.g. Sirius's Troca de Destino).
  gainMaxHP(step, ctx) {
    const perRep = resolveAmount(step.amount, ctx);
    const target = resolveTarget(step.target, ctx);
    let reps = 1;
    if (step.repeatPerDamageTaken && target) {
      reps = Math.max(1, target._timesDamagedThisRound || 0);
    }
    return [{ verb: 'gainMaxHP', target, amount: perRep * reps, reps, healToFull: step.healToFull !== false }];
  },

  // Consumes ALL stacks of a named stackingBuff status on the actor and
  // re-runs the actor's OWN next-resolved OTHER ability's effects[] chain
  // an extra `stacks` times against the same target/ctx it originally
  // resolved with. This step itself does nothing at the moment it fires —
  // it just marks intent (which status id to watch, which ability id(s) to
  // exclude) — the actual "run N extra times" happens the NEXT time this
  // actor's queued action resolves this round, handled generically in
  // resolution.js (see consumeStackingBuffOnNextAbility). Reusable by any
  // future "banked stacks empower my next move" card.
  primeNextAbilityFromStacks(step, ctx) {
    return [{ verb: 'primeNextAbilityFromStacks', target: ctx.actor, statusId: step.statusId, excludeAbilityIds: step.excludeAbilityIds || [ctx.ability.id] }];
  },

  // Marks the actor and a chosen ally to SWAP battlefield slots (and thus
  // slotIndex-based role identity) for the rest of this round only, via
  // matching tempRoleTag statuses on both units. The actual slotIndex swap
  // (and revert) is handled generically in resolution.js
  // (applyTempRoleSwap / revertTempRoleSwaps) so any future "trade places/
  // disguise" card can reuse this verb without new engine special-casing.
  swapRoleWithAlly(step, ctx) {
    const ally = resolveTarget(step.withTarget, ctx);
    if (!ally) return [];
    return [{ verb: 'swapRoleWithAlly', actor: ctx.actor, ally, actorTag: step.actorTag, allyTag: step.allyTag }];
  },

  applyStatus(step, ctx) {
    const status = typeof step.status === 'function' ? step.status(ctx) : step.status;
    return [{ verb: 'applyStatus', target: resolveTarget(step.target, ctx), status }];
  },

  // Applies a status to every living unit on one side of the battle
  // ('allies' or 'enemies', relative to the actor). Generic team-wide
  // status verb — reusable by any future card that buffs/debuffs a whole
  // side at once (e.g. Amelia's Fluxo do Tempo), not just a one-off.
  applyStatusToTeam(step, ctx) {
    const side = step.side === 'enemies'
      ? (ctx.actor.team === 'player' ? ctx.enemyUnits : ctx.playerUnits)
      : (ctx.actor.team === 'player' ? ctx.playerUnits : ctx.enemyUnits);
    let units = side.filter(u => u.alive);
    if (step.excludeSelf) units = units.filter(u => u !== ctx.actor);
    const status = typeof step.status === 'function' ? step.status(ctx) : step.status;
    return units.map(u => ({ verb: 'applyStatus', target: u, status: { ...status } }));
  },

  removeStatus(step, ctx) {
    return [{ verb: 'removeStatus', target: resolveTarget(step.target, ctx), statusId: step.statusId }];
  },

  // "Purifique uma unidade": removes every status AND every gained counter
  // from the target — anything the unit picked up during the battle
  // (Lento, Sangramento, buffs, Provocado, counters/stacks, etc.), leaving
  // its static card traits (stats, abilities) untouched. See purifyUnit()
  // above. Generic — reusable by any future "cleanse everything" card, not
  // just O Porteiro's H2.
  purify(step, ctx) {
    return [{ verb: 'purify', target: resolveTarget(step.target, ctx) }];
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

  // Generic "heal every living unit on one side who holds a given marker
  // status" verb. `side` follows the same 'allies'/'enemies' convention as
  // applyStatusToTeam (relative to the actor). Optionally strips the
  // marker afterward (default true). Reusable by any future "cash in a
  // status I planted earlier" payoff card, not just Carmelita's Restaurar
  // Marcados.
  healMarked(step, ctx) {
    const side = step.side === 'enemies'
      ? (ctx.actor.team === 'player' ? ctx.enemyUnits : ctx.playerUnits)
      : (ctx.actor.team === 'player' ? ctx.playerUnits : ctx.enemyUnits);
    const amount = resolveAmount(step.amount, ctx);
    const marked = side.filter(u => u.alive && hasStatus(u, step.markStatusId));
    const results = marked.map(u => ({ verb: 'heal', target: u, amount }));
    if (step.removeMarkAfter !== false) {
      for (const u of marked) results.push({ verb: 'removeStatus', target: u, statusId: step.markStatusId });
    }
    return results;
  },

  // Generic "make every ally holding a given marker status use one of
  // their OWN random abilities against a random valid target" verb.
  // For each living ally with `step.markStatusId` active: picks a random
  // ability from that ally's kit (respecting cooldown — skips abilities
  // currently on cooldown), picks a random living valid target for it
  // (respects the ability's own targetType: 'ally' targets a random living
  // ally of that unit's team, anything else targets a random living enemy),
  // then emits a useAbilityOn-style marker so combat-engine.js sub-casts it
  // immediately. If a marked ally has no usable (off-cooldown) ability, or
  // no valid target for the one picked, that ally is simply skipped.
  // Generic — reusable by any future "trigger everyone I've marked" card.
  useRandomAbilityOnMarked(step, ctx) {
    const results = [];
    const allies = (ctx.actor.team === 'player' ? ctx.playerUnits : ctx.enemyUnits)
      .filter(u => u.alive && hasStatus(u, step.markStatusId));
    for (const ally of allies) {
      const usable = (ally.abilities || []).filter(a => !isOnCooldown(ally, a));
      if (!usable.length) continue;
      const chosenAbility = usable[Math.floor(Math.random() * usable.length)];
      const targetType = chosenAbility.targetType || 'enemy';
      const pool = targetType === 'ally'
        ? (ally.team === 'player' ? ctx.playerUnits : ctx.enemyUnits)
        : (ally.team === 'player' ? ctx.enemyUnits : ctx.playerUnits);
      const livingPool = pool.filter(u => u.alive && (!chosenAbility.targetFilter || chosenAbility.targetFilter(u)));
      if (!livingPool.length) continue;
      const chosenTarget = livingPool[Math.floor(Math.random() * livingPool.length)];
      results.push({ verb: 'useAbilityOn', actor: ally, ability: chosenAbility, target: chosenTarget });
    }
    if (step.removeMarkAfter !== false) {
      for (const ally of allies) results.push({ verb: 'removeStatus', target: ally, statusId: step.markStatusId });
    }
    return results;
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

  // Generic flavor verb: pops a speech bubble above `who` (defaults to the
  // actor) with `text`. Purely cosmetic — no numeric effect, mirrors
  // `note`'s free-text-log role but for the 3D scene. Reusable by any
  // future card wanting a one-off speech line, not just O Porteiro's
  // "Bom dia".
  speechBubble(step, ctx) {
    const who = step.who ? resolveTarget(step.who, ctx) : ctx.actor;
    return [{ verb: 'speechBubble', who, text: typeof step.text === 'function' ? step.text(ctx) : step.text, cls: step.cls || '' }];
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
  let resolved;
  if (!targetSpec || targetSpec === 'target') resolved = ctx.target;
  else if (targetSpec === 'self' || targetSpec === 'actor') resolved = ctx.actor;
  else if (typeof targetSpec === 'function') resolved = targetSpec(ctx);
  else resolved = ctx.target;

  // Generic "Provocar" redirect: if the resolved target is holding a
  // provoke status AND the acting unit is an ENEMY of the provoker (a
  // provoked unit's own team never gets redirected — this only intercepts
  // attacks/effects coming FROM the opposing side), every targeted part of
  // this ability gets rerouted to the provoker instead. Checked here (the
  // single funnel every effect step's target passes through) so any
  // future card that grants StatusLib.provoke() gets this for free with
  // no per-card engine code. A provoker redirecting an effect onto itself
  // is a no-op (resolved === provoker) and simply falls through unchanged.
  // ctx._lastRedirectedFrom records the pre-redirect unit (per resolve
  // call) so the `damage` verb can tell applyOne "this hit landed on the
  // provoker BECAUSE of a redirect from X" — read by combat-engine.js's
  // redirectDamageAsHeal check.
  if (resolved && resolved.alive) {
    const provokeStatus = resolved.statuses && resolved.statuses.find(s => s.id === 'provoke');
    if (provokeStatus) {
      const provoker = provokeStatus.data.provoker;
      if (provoker && provoker.alive && provoker !== resolved && provoker.team !== ctx.actor.team) {
        ctx._lastRedirectedFrom = resolved;
        resolved = provoker;
      }
    }
  }
  return resolved;
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

// =============================================================
// ============ HOOK REGISTRY =====================================
// =============================================================
// Generic registration point for reactive mechanics, so a new reactive
// card is "register a hook function next to its status/passive
// definition" instead of "add another `if` block to resolution.js's
// main loop". Each hook function receives (event, ctx) and can:
//   - return nothing (no extra actions taken)
//   - return an array of extra EffectResults/markers it wants applied
//     (currently only onDamageDealt hooks do this)
//   - mutate ctx.allActions directly (splice/reorder), which is how
//     onActionResolved hooks implement forceImmediateAction/moveLast/
//     slow's queue-reordering (they need access to the live action
//     list, not just a return value)
//
// onActionResolved: (resolvedAction, ctx) => void
//   Fires once per resolved action, right after resolution.js's main
//   loop applies it (after refreshAllUnitUI would normally run for
//   that action). ctx = { i, allActions, result, round, playerUnits,
//   enemyUnits, lastResolvedAction }.
//
// onStatusApplied: (appliedResult, ctx) => void
//   Fires once per `applyStatus` EffectResult produced by the action
//   that just resolved, keyed by appliedResult.status.id. ctx is the
//   same shape as onActionResolved's.
const Hooks = {
  onActionResolved: [],
  onStatusApplied: {}, // keyed by status id -> array of handlers
};

function registerActionResolvedHook(fn) {
  Hooks.onActionResolved.push(fn);
}

function registerStatusAppliedHook(statusId, fn) {
  if (!Hooks.onStatusApplied[statusId]) Hooks.onStatusApplied[statusId] = [];
  Hooks.onStatusApplied[statusId].push(fn);
}

// Called by resolution.js's main loop right after each action resolves.
async function runActionResolvedHooks(resolvedAction, ctx) {
  for (const fn of Hooks.onActionResolved) {
    await fn(resolvedAction, ctx);
  }
}

// Called by resolution.js's main loop for every applyStatus EffectResult
// the just-resolved action produced.
async function runStatusAppliedHooks(appliedResult, ctx) {
  const handlers = Hooks.onStatusApplied[appliedResult.status.id];
  if (!handlers) return;
  for (const fn of handlers) {
    await fn(appliedResult, ctx);
  }
}

// =============================================================
// ============ REACTIVE MECHANIC HOOKS ===========================
// =============================================================
// The six reactive mechanics that used to be hand-written `if` blocks
// inside resolution.js's main loop, now registered here instead. Each
// one is the exact same logic that lived there — only the "how do I
// get called" part changed. New reactive cards register their own
// hook here (or wherever their status is defined) instead of editing
// the orchestration loop.

// guardAllies break-check: if the acting unit holds guardAllies and is
// about to use an ability that is neither the one that granted the
// guard NOR its declared exempt ability, the guard ends now, before
// this action resolves. Runs BEFORE the action resolves, so it hooks
// the action itself rather than its result — kept in resolution.js's
// loop (see the comment there) since it needs to run pre-resolve,
// which onActionResolved (post-resolve) can't do. Left documented here
// for discoverability alongside the other five.

// gavinFollowup: if the PREVIOUS resolved action this round was cast by
// a unit holding this passive marker, and the CURRENT action's actor is
// a living ally of that unit, deal the declared damage to every living
// enemy of the passive holder.
registerActionResolvedHook(async (action, ctx) => {
  const { lastResolvedAction, result, playerUnits, enemyUnits } = ctx;
  if (!lastResolvedAction || !lastResolvedAction.actor.alive) return;
  const holder = lastResolvedAction.actor;
  const followup = holder.statuses && holder.statuses.find(s => s.id === 'gavinFollowup');
  if (!followup || action.actor === holder || action.actor.team !== holder.team) return;
  const enemies = (holder.team === 'player' ? enemyUnits : playerUnits).filter(u => u.alive);
  for (const e of enemies) {
    const dmgResult = CombatEngine.applyOne({ verb: 'damage', target: e, amount: followup.data.amount, dealtBy: holder }, result);
    if (dmgResult.actualDamage > 0) {
      renderFloatingNumbers({ type: 'attack', target: e, actualDamage: dmgResult.actualDamage });
      if (dmgResult.killed) await e.animations.dead();
    }
  }
  addLogLine(`${holder.displayName}'s passive triggers off ${action.actor.displayName}'s ${action.ability.name}: ${followup.data.amount} damage to all enemies!`, 'hit');
  refreshAllUnitUI();
});

// Slow-attacker-triggers-a-copy: if the unit that just acted is holding
// a `slow` status AND the ability it just used is attack-flavored, the
// unit that granted the slow uses a fresh copy of the granting ability
// against a random living valid enemy target of its own.
registerActionResolvedHook(async (action, ctx) => {
  const { playerUnits, enemyUnits } = ctx;
  const slowStatus = action.actor.statuses && action.actor.statuses.find(s => s.kind === 'slow');
  if (!slowStatus || primaryEffectType(action.ability) !== 'attack') return;
  const granter = slowStatus.data.grantedBy;
  const grantingAbility = granter && granter.abilities.find(a => a.id === slowStatus.data.abilityId);
  if (!granter || !granter.alive || !grantingAbility) return;
  const enemyPool = (granter.team === 'player' ? enemyUnits : playerUnits).filter(u => u.alive);
  if (enemyPool.length === 0) return;
  const notYetActed = enemyPool.filter(u => !u._actedThisRound);
  const pool = notYetActed.length > 0 ? notYetActed : enemyPool;
  const copyTarget = pool[Math.floor(Math.random() * pool.length)];
  addLogLine(`${action.actor.displayName} está Lento e ataca — ${granter.displayName} usa uma cópia de ${grantingAbility.name}!`, 'info');
  const copyResult = CombatEngine.resolve(granter, grantingAbility, copyTarget, { playerUnits, enemyUnits, round: ctx.round });
  CombatEngine.apply(copyResult);
  refreshAllUnitUI();
});

// forceImmediateAction: splice the target's own still-queued action out
// of its later slot and run it right now, right after the action that
// triggered it.
registerActionResolvedHook((action, ctx) => {
  const { i, allActions, result } = ctx;
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
});

// summon: instantiate the requested def and add it to the battle's
// roster/scene right now.
registerActionResolvedHook((action, ctx) => {
  const summons = (ctx.result.applied || []).filter(a => a.verb === 'summon');
  for (const s of summons) {
    summonUnitFor(s.team, s.defId, s.tag, s.summonedBy);
  }
});

// sacrificeAlly: remove the chosen unit from its roster/scene right
// now, and drop any of its own still-queued action from the order.
registerActionResolvedHook((action, ctx) => {
  const { i, allActions } = ctx;
  const sacrifices = (ctx.result.applied || []).filter(a => a.verb === 'sacrificeAlly' && a.found);
  for (const s of sacrifices) {
    const sacrificedUnit = s.target;
    // Mutate the array in place (splice out matches) rather than
    // reassigning ctx.allActions — resolution.js's loop holds its own
    // `allActions` reference, and only in-place mutation on the same
    // array object is visible back there.
    for (let ai = allActions.length - 1; ai > i; ai--) {
      if (allActions[ai].actor === sacrificedUnit) allActions.splice(ai, 1);
    }
    removeUnitFromRoster(sacrificedUnit);
  }
});

// swapRoleWithAlly: mutate slotIndex + tag both units now, so any
// later-this-round targeting/UI reads the swapped arrangement.
registerActionResolvedHook((action, ctx) => {
  const roleSwaps = (ctx.result.applied || []).filter(a => a.verb === 'swapRoleWithAlly');
  for (const rs of roleSwaps) {
    applyTempRoleSwap(rs.actor, rs.ally, rs.actorTag, rs.allyTag);
    addLogLine(`${rs.actor.displayName} troca de posição com ${rs.ally.displayName}!`, 'info');
  }
});

// primeNextAbilityFromStacks: remember which status to consume and
// which ability ids to skip, read by consumeStackingBuffOnNextAbility
// the next time this actor's own queued action resolves.
registerActionResolvedHook((action, ctx) => {
  const primes = (ctx.result.applied || []).filter(a => a.verb === 'primeNextAbilityFromStacks');
  for (const p of primes) {
    p.target._primedStackBuff = { statusId: p.statusId, excludeAbilityIds: p.excludeAbilityIds };
  }
});

// moveLast (e.g. Yvrel's Golpe Atrasador): the applyStatus marker only
// stamps the status onto the target for bookkeeping/UI — the actual
// reordering happens here, right after it's applied, since the round's
// order was only sorted once up front.
registerStatusAppliedHook('moveLast', (applied, ctx) => {
  const { i, allActions } = ctx;
  const delayedUnit = applied.target;
  const idx = allActions.findIndex((a, ai) => ai > i && a.actor === delayedUnit && !a.resolved);
  if (idx !== -1) {
    const [delayedAction] = allActions.splice(idx, 1);
    allActions.push(delayedAction);
    addLogLine(`${delayedUnit.displayName} agora age por último!`, 'info');
  }
});

// slow (Gavin's Golpe Gelado): like moveLast above, the applyStatus
// marker only stamps the status onto the target — the actual
// reordering happens here. Re-sorts just the remaining unresolved tail
// rather than hardcoding "push to the very end", since a small slow
// amount might still leave the unit acting before some of what's left.
// moveLast-tagged actions stay pinned at the very end regardless.
registerStatusAppliedHook('slow', (applied, ctx) => {
  const { i, allActions } = ctx;
  const slowedUnit = applied.target;
  const idx = allActions.findIndex((a, ai) => ai > i && a.actor === slowedUnit && !a.resolved);
  if (idx === -1) return;
  const [slowedAction] = allActions.splice(idx, 1);
  const tailStart = i + 1;
  const tail = allActions.splice(tailStart);
  const moveLastTail = tail.filter(a => hasStatus(a.actor, 'moveLast'));
  const normalTail = tail.filter(a => !hasStatus(a.actor, 'moveLast'));
  const withSlowed = hasStatus(slowedUnit, 'moveLast')
    ? { normal: normalTail, moveLastGroup: [...moveLastTail, slowedAction] }
    : (() => {
        const merged = [...normalTail, slowedAction]
          .sort((a, b) => (effectiveSpeed(a) - effectiveSpeed(b)) || (a.tiebreak - b.tiebreak));
        return { normal: merged, moveLastGroup: moveLastTail };
      })();
  allActions.push(...withSlowed.normal, ...withSlowed.moveLastGroup);
  addLogLine(`${slowedUnit.displayName} fica Lento e agora age mais tarde!`, 'info');
});

// punishIfIgnored damage-tracking: if the just-resolved action dealt real
// damage (actualDamage > 0, real attacker via dealtBy) to a unit holding
// this status, flip data.wasHit so the round-end payoff (see
// tickRoundEndStatuses) is cancelled. Checked generically off
// ctx.result.applied the same way other hooks read it — reusable by any
// future holder of punishIfIgnored, not just O Porteiro.
registerActionResolvedHook((action, ctx) => {
  const hits = (ctx.result.applied || []).filter(a => a.verb === 'damage' && a.actualDamage > 0 && a.dealtBy);
  for (const hit of hits) {
    const victim = hit.target;
    if (!victim || !victim.statuses) continue;
    const marker = victim.statuses.find(s => s.id === 'punishIfIgnored');
    if (marker && !marker.data.wasHit) {
      marker.data.wasHit = true;
      marker.data.hitBy = hit.dealtBy;
      if (typeof spawnSpeechBubble === 'function' && hit.dealtBy.model) {
        spawnSpeechBubble(hit.dealtBy, marker.data.tauntLine || '...');
      }
    }
  }
});

// =============================================================
// ============ ABILITY FLAVOR HELPER ============================
// =============================================================
// Abilities no longer carry a single .type since they can mix multiple
// effect verbs (e.g. Ajax's Duelo is damage+damage, Mariana's Golpe de Luz
// is damage+gainCounter). This derives a primary "flavor" for anything that
// still needs one bucket to reason about: animation choreography choice
// and the simple AI's heuristics.
function primaryEffectType(ability) {
  const verbs = ability.effects.map(e => e.verb);
  if (verbs.includes('heal')) return 'heal';
  if (verbs.includes('shield')) return 'shield';
  if (verbs.includes('damage')) return 'attack';
  return verbs[0] || 'attack';
}
