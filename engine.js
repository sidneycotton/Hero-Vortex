// ===================== MOTOR DE EFEITOS =====================
// Interpreta os "effects" declarados no cards.json e aplica no estado do jogo.

const Engine = (() => {

  function clampLife(unit) {
    unit.life = Math.max(0, Math.min(unit.maxLife, unit.life));
    if (unit.life === 0) unit.dead = true;
  }

  function applyDamage(unit, amount, log) {
    if (!unit || unit.dead) return 0;
    let dmg = amount;

    // Cap de dano (Nira)
    const cap = unit.statuses.find(s => s.status === 'damageCap');
    if (cap) dmg = Math.min(dmg, cap.value);

    // Escudo absorve primeiro
    if (unit.shield && unit.shield.value > 0) {
      const absorbed = Math.min(unit.shield.value, dmg);
      unit.shield.value -= absorbed;
      dmg -= absorbed;
      log(`${unit.name} absorve ${absorbed} de dano com o Escudo.`);
      if (unit.shield.value <= 0) {
        unit.shield = null; // expira -> passiva de Rankorr trata separadamente
      }
    }

    unit.life -= dmg;
    clampLife(unit);
    if (dmg > 0) log(`${unit.name} sofre ${dmg} de dano. (Vida: ${Math.max(0,unit.life)}/${unit.maxLife})`);
    return dmg;
  }

  function applyHeal(unit, amount, log) {
    if (!unit || unit.dead) return;
    const before = unit.life;
    unit.life = Math.min(unit.maxLife, unit.life + amount);
    log(`${unit.name} recupera ${unit.life - before} de vida. (Vida: ${unit.life}/${unit.maxLife})`);
  }

  // Resolve um alvo simbólico em unidade(s) real(is)
  function resolveTargets(targetSpec, ctx) {
    const { caster, chosenTarget, enemyTeam, allyTeam, lastTarget } = ctx;
    switch (targetSpec) {
      case 'self': return [caster];
      case 'chooseAlly': return [chosenTarget];
      case 'chooseEnemy': return [chosenTarget];
      case 'chooseAllyNotMovedYet': return [chosenTarget];
      case 'allAllies': return allyTeam.filter(u => !u.dead);
      case 'allAlliesIncludingHand': return allyTeam.filter(u => !u.dead); // hand tratado à parte para buffMaxLife
      case 'allEnemies': return enemyTeam.filter(u => !u.dead);
      case 'lastTarget': return lastTarget ? [lastTarget] : [];
      case 'enemyDefensor': return enemyTeam.filter(u => u.role === 'defensor' && !u.dead);
      case 'enemyAtacante': return enemyTeam.filter(u => u.role === 'atacante' && !u.dead);
      case 'enemySuporte': return enemyTeam.filter(u => u.role === 'suporte' && !u.dead);
      case 'allyAtacante': return allyTeam.filter(u => u.role === 'atacante' && !u.dead);
      case 'allyDefensor': return allyTeam.filter(u => u.role === 'defensor' && !u.dead);
      case 'allEnemiesFieldAndHand': return enemyTeam; // contagem inclui mão (aprox: campo)
      default: return [];
    }
  }

  function countScalingUnits(scaling, ctx) {
    if (!scaling) return 0;
    if (scaling.count === 'allEnemiesFieldAndHand') {
      const { enemyField, enemyHand } = ctx;
      return (enemyField?.filter(u => !u.dead).length || 0) + (enemyHand?.length || 0);
    }
    return 0;
  }

  function checkCondition(cond, ctx) {
    const { caster, lastTarget } = ctx;
    if (!cond) return true;
    if (cond === 'selfHasShield') return !!(caster.shield && caster.shield.value > 0);
    if (cond === 'lastTargetKilled') return lastTarget && lastTarget.dead;
    if (cond === 'targetHealedThisTurn') return lastTarget && lastTarget.healedThisTurn;
    if (cond.startsWith('targetLifeGTE:')) {
      const n = Number(cond.split(':')[1]);
      return lastTarget && lastTarget.life >= n;
    }
    if (cond.startsWith('selfLifeLTE:')) {
      const n = Number(cond.split(':')[1]);
      return caster.life <= n;
    }
    if (cond.startsWith('targetHasStatus:')) {
      const st = cond.split(':')[1];
      return lastTarget && lastTarget.statuses.some(s => s.status === st);
    }
    return true;
  }

  // Executa uma lista de efeitos de uma habilidade
  function runEffects(effects, ctx, log) {
    for (const eff of effects) {
      runOneEffect(eff, ctx, log);
    }
  }

  function runOneEffect(eff, ctx, log) {
    switch (eff.type) {
      case 'dealDamage': {
        const targets = resolveTargets(eff.target, ctx);
        let amount = eff.base;
        if (eff.scaling) amount += (eff.scaling.perUnit * countScalingUnits(eff.scaling, ctx));
        // Kanth: bônus de "próximo dano em alvo único"
        for (const t of targets) {
          let finalAmount = amount;
          const boost = ctx.caster.statuses?.find(s => s.status === 'nextSingleTargetDamageBoost');
          if (boost && targets.length === 1) {
            finalAmount += boost.value;
            ctx.caster.statuses = ctx.caster.statuses.filter(s => s !== boost);
          }
          applyDamage(t, finalAmount, log);
          ctx.lastTarget = t;
        }
        break;
      }
      case 'heal': {
        const targets = resolveTargets(eff.target, ctx);
        for (const t of targets) {
          applyHeal(t, eff.base, log);
          t.healedThisTurn = true;
        }
        break;
      }
      case 'applyShield': {
        const targets = resolveTargets(eff.target, ctx);
        for (const t of targets) {
          t.shield = { value: eff.value, duration: eff.duration };
          log(`${t.name} ganha um Escudo de ${eff.value}.`);
        }
        break;
      }
      case 'applyStatus': {
        const targets = resolveTargets(eff.target, ctx);
        for (const t of targets) {
          t.statuses.push({ status: eff.status, value: eff.value, duration: eff.duration });
          log(`${t.name} recebe o status "${eff.status}".`);
        }
        break;
      }
      case 'gainCounter': {
        ctx.caster.counters[eff.counter] = (ctx.caster.counters[eff.counter] || 0) + eff.value;
        log(`${ctx.caster.name} ganha ${eff.value} contador(es) de ${eff.counter}. (Total: ${ctx.caster.counters[eff.counter]})`);
        break;
      }
      case 'spendCounterToHeal': {
        const amt = ctx.caster.counters[eff.counter] || 0;
        ctx.caster.counters[eff.counter] = 0;
        const targets = resolveTargets(eff.target, ctx);
        for (const t of targets) applyHeal(t, amt, log);
        break;
      }
      case 'moveNow': {
        const targets = resolveTargets(eff.target, ctx);
        for (const t of targets) log(`${t.name} se move imediatamente (ação especial, resolva manualmente na ordem de turno).`);
        break;
      }
      case 'buffMaxLife': {
        const targets = resolveTargets(eff.target, ctx);
        for (const t of targets) {
          t.maxLife += eff.value;
          t.life += eff.value;
          log(`${t.name} ganha +${eff.value} de vida máxima.`);
        }
        break;
      }
      case 'createToken': {
        ctx.onCreateToken?.(eff.tokenId);
        break;
      }
      case 'sacrificeToken': {
        ctx.onSacrificeToken?.(eff.tokenId, log);
        break;
      }
      case 'taunt': {
        const targets = resolveTargets(eff.target, ctx);
        for (const t of targets) log(`${ctx.caster.name} Provoca ${t.name}.`);
        break;
      }
      case 'conditionalBuff': {
        if (checkCondition(eff.condition, ctx)) {
          const targets = resolveTargets(eff.buff.target, ctx);
          for (const t of targets) {
            t.statuses.push({ status: 'damageBoost', value: eff.buff.value, duration: eff.buff.duration });
            log(`${t.name} recebe +${eff.buff.value} de dano neste turno.`);
          }
        }
        break;
      }
      case 'conditionalTrigger': {
        if (checkCondition(eff.condition, ctx)) {
          log(`Condição atendida: ${eff.trigger} (resolva manualmente).`);
        }
        break;
      }
      case 'conditionalDamage': {
        if (checkCondition(eff.condition, ctx)) {
          const targets = resolveTargets(eff.target, ctx);
          for (const t of targets) applyDamage(t, eff.base, log);
        }
        break;
      }
      case 'conditionalRepeat': {
        if (checkCondition(eff.condition, ctx)) {
          log(`Condição "${eff.condition}" atendida — repita a habilidade.`);
        }
        break;
      }
      case 'conditionalLifesteal': {
        if (checkCondition(eff.condition, ctx)) {
          const healed = ctx.lastTarget?.lastHealAmount || 0;
          applyHeal(ctx.caster, healed, log);
        }
        break;
      }
      case 'conditionalHeal': {
        if (checkCondition(eff.condition, ctx)) {
          const targets = resolveTargets(eff.target, ctx);
          for (const t of targets) {
            if (eff.value === 'full') { t.life = t.maxLife; log(`${t.name} é totalmente curado!`); }
          }
        }
        break;
      }
      case 'applyFieldEffect': {
        ctx.onFieldEffect?.(eff.effect, eff.duration, log);
        break;
      }
      case 'delayedEffect': {
        ctx.onDelayedEffect?.(eff, log);
        break;
      }
      case 'reviveCopy': {
        ctx.onReviveCopy?.(eff.cardId, eff.life, log);
        break;
      }
      default:
        log(`(Efeito "${eff.type}" precisa ser resolvido manualmente.)`);
    }
  }

  return { runEffects, applyDamage, applyHeal, resolveTargets, checkCondition };
})();
