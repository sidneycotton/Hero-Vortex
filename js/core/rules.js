// ===================== REGRAS DO JOGO =====================
// Mecânicas complementares que não pertencem ao banco declarativo de cartas,
// mas fazem parte das regras permanentes do motor.
(() => {
  if (window.__hvCoreRulesInstalled) return;
  window.__hvCoreRulesInstalled = true;

  const ensureTurnState = () => {
    if (!window.state) return;
    state.delayedEffects ||= [];
    state.hvForcedActions ||= new Set();
    state.hvSkipResolution ||= new Set();
    state.hvActedThisTurn ||= new Set();
    for (const p of state.players || []) {
      p.handMaxLifeBonus ||= {};
      p.handLifeGainThisTurn ||= {};
    }
  };

  const handIds = playerIdx => {
    const player = state?.players?.[playerIdx];
    if (!player?.slots) return [];
    const ids = [];
    for (const role of (window.ROLES || [])) ids.push(...(player.slots[role]?.bench || []));
    return ids;
  };

  const handCount = playerIdx => handIds(playerIdx).length;

  const chooseFastestAbility = unit => {
    if (!unit || unit.dead) return null;
    const avail = availableAbilities(unit);
    if (!avail.length) return null;
    return avail.reduce((best, current) => !best || current.ab.speed < best.ab.speed ? current : best, null);
  };

  const chooseTargetForAbility = (unit, ability) => {
    if (!ability) return null;
    const effects = ability.effects || [];
    const enemy = enemyTeamOf(unit).filter(u => !u.dead);
    const ally = allyTeamOf(unit).filter(u => !u.dead);
    const byLife = (a, b) => Engine.getCurrentLife(a) - Engine.getCurrentLife(b);
    if (effects.some(e => e.target === 'chooseEnemy')) return enemy.sort(byLife)[0]?.uid || null;
    if (effects.some(e => e.target === 'chooseAllyNotMovedYet')) return ally.filter(u => !state.hvActedThisTurn?.has(u.uid)).sort(byLife)[0]?.uid || null;
    if (effects.some(e => e.target === 'chooseAlly')) return ally.sort(byLife)[0]?.uid || null;
    if (effects.some(e => e.target === 'enemyDefensor')) return enemy.find(u => u.role === 'defensor')?.uid || null;
    if (effects.some(e => e.target === 'enemyAtacante')) return enemy.find(u => u.role === 'atacante')?.uid || null;
    if (effects.some(e => e.target === 'enemySuporte')) return enemy.find(u => u.role === 'suporte')?.uid || null;
    return null;
  };

  function triggerAbilityNow(unit, abilityIdx, targetUid, skipQueued = false) {
    ensureTurnState();
    if (!unit || unit.dead) return false;
    if (state.hvActedThisTurn.has(unit.uid) && skipQueued) return false;
    if (skipQueued) state.hvSkipResolution.add(unit.uid);
    state.hvForcedActions.add(unit.uid);
    window.executeAbility(unit, abilityIdx, targetUid);
    return true;
  }

  const forceDeclaredMove = unit => {
    ensureTurnState();
    if (!unit || unit.dead || state.hvActedThisTurn.has(unit.uid)) return false;
    const declaration = state.declarations?.[unit.owner]?.[unit.uid];
    if (declaration) return triggerAbilityNow(unit, declaration.abilityIdx, declaration.targetUid, true);
    const fastest = chooseFastestAbility(unit);
    if (!fastest) return false;
    return triggerAbilityNow(unit, fastest.idx, chooseTargetForAbility(unit, fastest.ab), true);
  };

  const useFastestAbility = unit => {
    ensureTurnState();
    if (!unit || unit.dead) return false;
    const fastest = chooseFastestAbility(unit);
    if (!fastest) return false;
    return triggerAbilityNow(unit, fastest.idx, chooseTargetForAbility(unit, fastest.ab), true);
  };

  // Estado complementar criado quando uma unidade entra no jogo.
  if (typeof window.makeUnit === 'function' && !window.__hvMakeUnitRulesWrapped) {
    const nativeMakeUnit = window.makeUnit;
    window.__hvMakeUnitRulesWrapped = true;
    window.makeUnit = function(cardId, ownerIdx) {
      const unit = nativeMakeUnit(cardId, ownerIdx);
      const bonus = Number(state?.players?.[ownerIdx]?.handMaxLifeBonus?.[cardId] || 0);
      const handGain = Number(state?.players?.[ownerIdx]?.handLifeGainThisTurn?.[cardId] || 0);
      if (bonus) {
        unit.maxLife += bonus;
        unit.life += bonus;
      }
      unit.lifeGainThisTurn = handGain;
      unit.damageTakenThisTurn = 0;
      unit.threshold40Triggered = false;
      unit.threshold20Triggered = false;
      return unit;
    };
  }

  if (typeof window.initGame === 'function' && !window.__hvInitGameRulesWrapped) {
    const nativeInitGame = window.initGame;
    window.__hvInitGameRulesWrapped = true;
    window.initGame = function(...args) {
      const result = nativeInitGame(...args);
      ensureTurnState();
      for (const p of state.players) {
        p.handMaxLifeBonus ||= {};
        p.handLifeGainThisTurn ||= {};
      }
      return result;
    };
  }

  if (typeof window.availableAbilities === 'function' && !window.__hvAvailableRulesWrapped) {
    const nativeAvailable = window.availableAbilities;
    window.__hvAvailableRulesWrapped = true;
    window.availableAbilities = function(unit) {
      if (unit?.statuses?.some(s => s.status === 'silenced')) return [];
      return nativeAvailable(unit);
    };
  }

  if (!window.__hvHealRulesWrapped) {
    const nativeHeal = Engine.applyHeal;
    window.__hvHealRulesWrapped = true;
    Engine.applyHeal = function(unit, amount, log, source = window.__hvEffectSource || null) {
      if (!unit || unit.dead) return 0;
      const before = unit.life;
      const result = nativeHeal(unit, amount, log);
      const healed = Math.max(0, unit.life - before);
      unit.healedThisTurn = true;
      if (unit.statuses?.some(s => s.status === 'sangramento')) {
        unit.statuses = unit.statuses.filter(s => s.status !== 'sangramento');
        log(`${unit.name} recebe cura e deixa de Sangrar.`);
      }
      if (!(source?.cardId === 'grath' && unit.cardId === 'grath')) {
        unit.lifeGainThisTurn = (unit.lifeGainThisTurn || 0) + healed;
      }
      unit.lastHealAmount = healed;
      return result ?? healed;
    };
  }

  if (!window.__hvDamageRulesWrapped) {
    const nativeDamage = Engine.applyDamage;
    window.__hvDamageRulesWrapped = true;
    Engine.applyDamage = function(unit, amount, log, source = null) {
      if (unit?.__hvExactDamage !== undefined) {
        const exact = Math.max(0, Number(unit.__hvExactDamage) || 0);
        delete unit.__hvExactDamage;
        if (!unit.dead) {
          let remaining = exact;
          if (unit.shield && unit.shield.value > 0) {
            const absorbed = Math.min(unit.shield.value, remaining);
            unit.shield.value -= absorbed;
            remaining -= absorbed;
            log(`${unit.name} absorve ${absorbed} de dano com o Escudo.`);
            if (unit.shield.value <= 0) unit.shield = null;
          }
          unit.life -= remaining;
          if (unit.life < 0) unit.life = 0;
          if (unit.life === 0) unit.dead = true;
          if (remaining > 0) log(`${unit.name} sofre ${remaining} de dano. (Vida: ${unit.life}/${unit.maxLife})`);
          unit.damageTakenThisTurn = (unit.damageTakenThisTurn || 0) + exact;
          return exact;
        }
        return 0;
      }

      const cap = unit?.statuses?.find(s => s.status === 'damageCap' && (!s.startTurn || state.turn >= s.startTurn));
      const originalStatuses = unit?.statuses;
      if (unit?.statuses && cap === undefined && unit.statuses.some(s => s.status === 'damageCap' && s.startTurn && state.turn < s.startTurn)) {
        unit.statuses = unit.statuses.filter(s => !(s.status === 'damageCap' && s.startTurn && state.turn < s.startTurn));
        const dealt = Engine.applyDamage(unit, amount, log, source);
        unit.statuses = originalStatuses;
        return dealt;
      }

      let finalAmount = Number(amount) || 0;
      if (source && unit && source.statuses?.length) {
        const boost = source.statuses.filter(s => s.status === 'damageBoost').reduce((sum, s) => sum + (Number(s.value) || 0), 0);
        if (boost > 0) finalAmount += boost;
      }
      const beforeLife = unit?.life ?? 0;
      const dealt = nativeDamage(unit, finalAmount, log, source);
      if (unit && dealt > 0) {
        unit.damageTakenThisTurn = (unit.damageTakenThisTurn || 0) + dealt;
        if (unit.cardId === 'mularna' && !unit.dead) {
          if (!unit.threshold40Triggered && beforeLife > 40 && unit.life <= 40) {
            unit.threshold40Triggered = true;
            unit.shield = { value: 20, duration: 2 };
            log(`${unit.name} alcança 40 de Vida e ganha um Escudo de 20.`);
          }
          if (!unit.threshold20Triggered && beforeLife > 20 && unit.life <= 20) {
            unit.threshold20Triggered = true;
            unit.shield = { value: 20, duration: 2 };
            log(`${unit.name} alcança 20 de Vida e ganha um Escudo de 20.`);
          }
        }
      }
      return dealt;
    };
  }

  if (!window.__hvRunEffectsRulesWrapped) {
    const nativeRunEffects = Engine.runEffects;
    window.__hvRunEffectsRulesWrapped = true;
    Engine.runEffects = function(effects, ctx, log) {
      ensureTurnState();
      for (const originalEffect of effects || []) {
        const eff = originalEffect && typeof originalEffect === 'object' ? { ...originalEffect } : originalEffect;
        if (!eff) continue;

        if (eff.type === 'buffMaxLife' && eff.target === 'allAlliesIncludingHand') {
          window.__hvEffectSource = ctx.caster;
          nativeRunEffects([{ ...eff, target: 'allAllies' }], ctx, log);
          window.__hvEffectSource = null;
          const player = state.players[ctx.caster.owner];
          player.handMaxLifeBonus ||= {};
          player.handLifeGainThisTurn ||= {};
          for (const cardId of handIds(ctx.caster.owner)) {
            const value = Number(eff.value || 0);
            player.handMaxLifeBonus[cardId] = (player.handMaxLifeBonus[cardId] || 0) + value;
            player.handLifeGainThisTurn[cardId] = (player.handLifeGainThisTurn[cardId] || 0) + value;
            log(`${CARD_DB[cardId]?.name || cardId}, ainda na mão, ganha +${value} de Vida máxima.`);
          }
          continue;
        }

        if (eff.type === 'dealDamage' && eff.scaling?.count === 'allEnemiesFieldAndHand') {
          const opponent = 1 - ctx.caster.owner;
          const fieldCount = (ctx.enemyField || ctx.enemyTeam || []).filter(u => !u.dead).length;
          const handBonus = handCount(opponent);
          const adjusted = {
            ...eff,
            base: Number(eff.base || 0) + Number(eff.scaling.perUnit || 0) * (fieldCount + handBonus),
            scaling: null,
          };
          window.__hvEffectSource = ctx.caster;
          nativeRunEffects([adjusted], ctx, log);
          window.__hvEffectSource = null;
          ctx.__hvRepeatableDamage = adjusted;
          continue;
        }

        if (eff.type === 'dealDamage' || eff.type === 'conditionalDamage') {
          if (eff.type === 'dealDamage' && ctx.caster?.cardId === 'grath' && eff.target === 'chooseEnemy') {
            ctx.__grathInitialTargetLife = ctx.chosenTarget ? Engine.getCurrentLife(ctx.chosenTarget) : null;
          }
          window.__hvEffectSource = ctx.caster;
          nativeRunEffects([eff], ctx, log);
          window.__hvEffectSource = null;
          ctx.__hvRepeatableDamage = { ...eff };
          continue;
        }

        if (eff.type === 'conditionalRepeat') {
          if (eff.condition && Engine.checkCondition(eff.condition, ctx) && ctx.__hvRepeatableDamage) {
            window.__hvEffectSource = ctx.caster;
            nativeRunEffects([ctx.__hvRepeatableDamage], ctx, log);
            window.__hvEffectSource = null;
          }
          continue;
        }

        if (eff.type === 'conditionalDamage' && ctx.caster?.cardId === 'grath' && eff.condition === 'targetLifeGTE:100') {
          if (Number(ctx.__grathInitialTargetLife || 0) >= 100) {
            window.__hvEffectSource = ctx.caster;
            nativeRunEffects([eff], ctx, log);
            window.__hvEffectSource = null;
          }
          continue;
        }

        if (eff.type === 'conditionalLifesteal') {
          const target = ctx.lastTarget;
          const gained = Number(target?.lifeGainThisTurn || 0);
          if (target && gained > 0 && !(ctx.caster.cardId === 'grath' && target.cardId === 'grath')) {
            Engine.applyHeal(ctx.caster, gained, log, ctx.caster);
          }
          continue;
        }

        if (eff.type === 'moveNow') {
          for (const target of Engine.resolveTargets(eff.target, ctx).filter(Boolean)) {
            if (forceDeclaredMove(target)) log(`${target.name} se move imediatamente!`);
          }
          continue;
        }

        if (eff.type === 'conditionalTrigger' && eff.trigger === 'useCheapestAbility') {
          const targets = Engine.resolveTargets(eff.target || eff.buff?.target || 'allyAtacante', ctx).filter(Boolean);
          for (const target of targets) {
            if (useFastestAbility(target)) log(`${ctx.caster.name} faz ${target.name} usar sua Habilidade mais rápida imediatamente.`);
          }
          continue;
        }

        if (eff.type === 'taunt') {
          for (const target of Engine.resolveTargets(eff.target, ctx).filter(Boolean)) {
            target.statuses = target.statuses.filter(s => s.status !== 'tauntedBy');
            target.statuses.push({ status: 'tauntedBy', value: ctx.caster.uid, duration: 1 });
            log(`${ctx.caster.name} Provoca ${target.name}.`);
          }
          continue;
        }

        if (eff.type === 'delayedEffect') {
          state.delayedEffects ||= [];
          state.delayedEffects.push({
            dueTurn: state.turn + Math.max(1, Number(eff.delay) || 1),
            sourceUid: ctx.caster.uid,
            targetUid: null,
            effects: JSON.parse(JSON.stringify(eff.effects || [])),
          });
          log(`Efeito atrasado de ${ctx.caster.name} agendado para o final do Turno ${state.turn + Math.max(1, Number(eff.delay) || 1)}.`);
          continue;
        }

        window.__hvEffectSource = ctx.caster;
        nativeRunEffects([eff], ctx, log);
        window.__hvEffectSource = null;
      }
    };
  }

  if (typeof window.executeAbility === 'function' && !window.__hvExecuteRulesWrapped) {
    const nativeExecute = window.executeAbility;
    window.__hvExecuteRulesWrapped = true;
    window.executeAbility = function(caster, abilityIdx, targetUid) {
      ensureTurnState();
      const result = nativeExecute(caster, abilityIdx, targetUid);
      if (caster?.uid) state.hvActedThisTurn.add(caster.uid);
      return result;
    };
  }

  function resolveDelayedEffectsForTurn(turn) {
    ensureTurnState();
    const due = state.delayedEffects.filter(e => e.dueTurn === turn);
    state.delayedEffects = state.delayedEffects.filter(e => e.dueTurn !== turn);
    for (const job of due) {
      const caster = getUnit(job.sourceUid);
      if (!caster || caster.dead) continue;
      const currentTarget = enemyTeamOf(caster).find(u => !u.dead) || null;
      const ctx = {
        caster,
        chosenTarget: currentTarget,
        allyTeam: allyTeamOf(caster),
        enemyTeam: enemyTeamOf(caster),
        enemyField: enemyTeamOf(caster),
        enemyHand: handIds(caster.owner ^ 1).map(cardId => ({ cardId, role: CARD_DB[cardId]?.role, dead: false })),
        lastTarget: currentTarget,
        onCreateToken: tokenId => { const tok = makeUnit(tokenId, caster.owner); tok.justSpawned = true; ownerOf(caster).extraUnits.push(tok); },
        onSacrificeToken: (tokenId, log) => {
          const list = ownerOf(caster).extraUnits;
          const idx = list.findIndex(u => u.cardId === tokenId && !u.dead);
          if (idx >= 0) { list[idx].dead = true; list[idx].life = 0; log(`${list[idx].name} é destruída como custo da habilidade.`); }
        },
        onFieldEffect: (effect, duration, log) => { ownerOf(caster).fieldEffects[effect] = duration; log(`Efeito de campo "${effect}" ativado por ${duration} turno(s).`); },
        onDelayedEffect: (eff) => { state.delayedEffects.push({ dueTurn: state.turn + Math.max(1, Number(eff.delay) || 1), sourceUid: caster.uid, targetUid: null, effects: JSON.parse(JSON.stringify(eff.effects || [])) }); },
        onReviveCopy: (cardId, life, log) => {
          const dead = ownerOf(caster).extraUnits.find(u => u.cardId === cardId && u.dead);
          if (dead) { dead.dead = false; dead.life = life; log(`${dead.name} retorna à vida com ${life} de vida!`); }
        }
      };
      if (!currentTarget) continue;
      logMsg(`⏳ Efeito atrasado de ${caster.name} resolve agora.`);
      Engine.runEffects(job.effects, ctx, logMsg);
      checkDeaths();
      checkWinner();
    }
  }

  if (typeof window.finishResolutionPhase === 'function' && !window.__hvFinishRulesWrapped) {
    window.__hvFinishRulesWrapped = true;
    const nativeFinishResolutionPhase = window.finishResolutionPhase;
    window.finishResolutionPhase = function() {
      ensureTurnState();
      const endingTurn = state.turn;
      resolveDelayedEffectsForTurn(endingTurn);

      for (const p of state.players) {
        for (const [effect, duration] of Object.entries(p.fieldEffects)) {
          const idx = state.players.indexOf(p);
          if (effect === 'chuva') for (const u of allUnitsOf(idx).filter(u => !u.dead)) Engine.applyHeal(u, 10, logMsg);
          if (effect === 'tempestade_de_areia') for (const u of allUnitsOf(1 - idx).filter(u => !u.dead)) Engine.applyDamage(u, 10, logMsg);
          p.fieldEffects[effect] = duration - 1;
          if (p.fieldEffects[effect] <= 0) delete p.fieldEffects[effect];
        }
      }

      for (const u of allUnitsAll()) {
        if (!u.dead) {
          const bleed = u.statuses.find(s => s.status === 'sangramento');
          if (bleed) {
            u.__hvExactDamage = Number(bleed.value) || 0;
            Engine.applyDamage(u, bleed.value, logMsg);
          }
        }

        if (u.statuses) {
          u.statuses = u.statuses.filter(s => {
            if (s.duration === -1) return true;
            s.duration -= 1;
            return s.duration > 0;
          });
        }

        if (u.shield) {
          const remaining = u.shield.value;
          u.shield.duration -= 1;
          if (u.shield.duration <= 0) {
            u.shield = null;
            logMsg(`O Escudo de ${u.name} expira.`);
            if (u.cardId === 'rankorr' && remaining > 0) {
              logMsg(`O Escudo de ${u.name} explode e causa ${remaining} de dano a todos os inimigos!`);
              for (const enemy of enemyTeamOf(u).filter(e => !e.dead)) Engine.applyDamage(enemy, remaining, logMsg, u);
            }
          }
        }

        if (u.dead) continue;
        for (const k of Object.keys(u.cooldowns)) if (u.cooldowns[k] > 0) u.cooldowns[k]--;
      }

      // O rules.js mantém apenas a manutenção das regras; o game-flow continua
      // responsável pelo encerramento/avanço da fase.
      checkDeaths();
      checkWinner();
      if (state.winner !== null) {
        state.phase = 'gameover';
        render();
        return;
      }

      for (const u of allUnitsAll()) {
        u.healedThisTurn = false;
        u.lifeGainThisTurn = 0;
        u.damageTakenThisTurn = 0;
      }
      for (const p of state.players) p.handLifeGainThisTurn = {};

      state.hvActedThisTurn = new Set();
      state.hvForcedActions = new Set();
      state.hvSkipResolution = new Set();

      nativeFinishResolutionPhase();
    };
  }

  const normalizeNiraDuration = () => {
    const effect = window.CARD_DB?.nira?.abilities?.[0]?.effects?.find(e => e.type === 'applyStatus' && e.status === 'damageCap');
    if (effect) effect.duration = 2;
  };

  const markNiraCapStart = () => {
    if (window.__hvNiraCapStartRulesWrapped) return;
    window.__hvNiraCapStartRulesWrapped = true;
    const nativeRun = Engine.runEffects;
    Engine.runEffects = function(effects, ctx, log) {
      for (const eff of effects || []) {
        if (eff?.type === 'applyStatus' && eff.status === 'damageCap') eff.startTurn = state.turn + 1;
      }
      return nativeRun(effects, ctx, log);
    };
  };

  normalizeNiraDuration();
  ensureTurnState();
  markNiraCapStart();
})();
