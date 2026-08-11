// ===================== AJUSTES DE INTEGRAÇÃO DOS NOVOS DEFENSORES =====================
(() => {
  const alive = u => !!u && !u.dead && u.life > 0;
  const enemiesOf = u => allUnitsOf(1 - u.owner).filter(alive);
  const alliesOf = u => allUnitsOf(u.owner).filter(alive);
  const hasStatus = (u, s) => !!u?.statuses?.some(x => x.status === s);
  const addStatus = (u, status, value = 1, duration = 1) => {
    if (!u) return;
    u.statuses ||= [];
    const old = u.statuses.find(s => s.status === status);
    if (old) { old.value = value; old.duration = duration; }
    else u.statuses.push({ status, value, duration });
  };
  const firstEnemy = u => enemiesOf(u)[0] || null;

  function boot() {
    if (typeof CARD_DB === 'undefined' || !Object.keys(CARD_DB).length || typeof Engine === 'undefined') return setTimeout(boot, 100);

    // Arborzilla precisa de alvo para o ataque principal.
    if (CARD_DB.arborzilla?.abilities?.[0]?.effects?.[0]) CARD_DB.arborzilla.abilities[0].effects[0].target = 'chooseEnemy';

    // Benício: o bônus de ataque também impede Provocação até o fim do próximo turno.
    const oldRun = Engine.runEffects;
    Engine.runEffects = function(effects, ctx, log) {
      const patched = [];
      for (const eff of effects || []) {
        if (eff.type === 'applyStatus' && eff.status === 'benicioNextAttack') {
          const target = Engine.resolveTargets(eff.target, ctx)[0];
          if (target) addStatus(target, 'benicioUntaggable', 1, 2);
        }
        patched.push(eff);
      }
      oldRun(patched, ctx, log);
    };

    // Rahdan: rouba vida real do atacante, cura Rahdan e reduz dano dos inimigos afetados.
    const oldRun2 = Engine.runEffects;
    Engine.runEffects = function(effects, ctx, log) {
      const remaining = [];
      for (const eff of effects || []) {
        if (eff.type === 'rahdanDrainEnemies') {
          const foes = enemiesOf(ctx.caster);
          const rahdans = alliesOf(ctx.caster).filter(u => u.cardId === 'rahdan');
          for (let i = 0; i < foes.length; i++) {
            const amount = i === 0 ? 4 : 2;
            foes[i].life = Math.max(0, foes[i].life - amount);
            addStatus(foes[i], 'enemyDamageReduction', 2, 1);
            for (const r of rahdans) { if (alive(ctx.caster)) ctx.caster.life = Math.max(0, ctx.caster.life - 2); if (alive(r)) { const before=r.life; r.life=Math.min(r.maxLife,r.life+2); if(r.life>before) r.healedThisTurn=true; } }
          }
          log(`${ctx.caster.name} rouba vida dos inimigos e prepara redução de dano.`);
        } else remaining.push(eff);
      }
      if (remaining.length) oldRun2(remaining, ctx, log);
    };

    // Redução de 2 do Rahdan funciona em qualquer dano que os inimigos causem.
    const oldDamage = Engine.applyDamage;
    Engine.applyDamage = function(unit, amount, log, source = null) {
      if (source && source.owner !== unit.owner && hasStatus(source, 'enemyDamageReduction')) amount = Math.max(0, amount - 2);
      if (source && source.owner !== unit.owner && hasStatus(unit, 'enemyDamageReduction')) amount = Math.max(0, amount - 2);
      return oldDamage(unit, amount, log, source);
    };

    // Porteiro: enquanto um aliado estiver provocado por ele, ataques desse aliado acertam o Porteiro.
    const oldRun3 = Engine.runEffects;
    Engine.runEffects = function(effects, ctx, log) {
      const forceTarget = ctx.caster?.statuses?.find(s => s.status === 'tauntedBy' && getUnit(s.value)?.owner === ctx.caster.owner);
      if (forceTarget) {
        const forced = getUnit(forceTarget.value);
        const rest = [];
        for (const eff of effects || []) {
          if (eff.type === 'dealDamage' && forced) {
            const amount = Number(eff.base) || 0;
            Engine.applyDamage(forced, amount, log, ctx.caster);
          } else rest.push(eff);
        }
        if (rest.length) oldRun3(rest, ctx, log);
        return;
      }
      oldRun3(effects, ctx, log);
    };

    // Varghul: a cópia de provocação morre depois da primeira Habilidade inimiga realmente usada.
    const oldExecute = window.executeAbility;
    if (typeof oldExecute === 'function' && !window.__hvMoreFixExecute) {
      window.__hvMoreFixExecute = true;
      window.executeAbility = function(caster, abilityIdx, targetUid) {
        const result = oldExecute(caster, abilityIdx, targetUid);
        for (const copy of allUnitsOf(1 - caster.owner).filter(u => alive(u) && u.cardId === 'varghul' && hasStatus(u, 'varghulDieAfterEnemy'))) {
          copy.life = 0; copy.dead = true; logMsg(`${copy.name} cumpre sua missão e morre.`);
        }
        return result;
      };
    }

    // Usa os hooks completos de dano nas habilidades especiais que anteriormente bypassavam Engine.applyDamage.
    const oldRun4 = Engine.runEffects;
    Engine.runEffects = function(effects, ctx, log) {
      const remaining = [];
      for (const eff of effects || []) {
        if (eff.type === 'zengrathMaxLifeDamage') {
          const t = ctx.chosenTarget || firstEnemy(ctx.caster); if (t) Engine.applyDamage(t, Math.ceil(ctx.caster.maxLife * 0.10), log, ctx.caster);
          continue;
        }
        if (eff.type === 'zengrathMassAttack') {
          const foes = enemiesOf(ctx.caster); for (const f of foes) Engine.applyDamage(f, 2, log, ctx.caster); ctx.caster.maxLife += foes.length * 2; ctx.caster.life += foes.length * 2; log(`${ctx.caster.name} ganha +${foes.length * 2} de vida máxima.`); continue;
        }
        if (eff.type === 'predadorAttack') {
          const t = ctx.chosenTarget || firstEnemy(ctx.caster); if (t) Engine.applyDamage(t, allUnitsAll().filter(u => alive(u) && u.cardId === 'predador_labirinto').length >= 15 ? 2 : 1, log, ctx.caster); continue;
        }
        if (eff.type === 'arborzillaAttack') {
          const t = ctx.chosenTarget || firstEnemy(ctx.caster); if (!t) continue;
          const bonus = Number(ctx.caster.arborzillaBonus || 0);
          const next = ctx.caster.statuses?.find(s => s.status === 'benicioNextAttack');
          const attackDamage = 5 + bonus + (next ? Number(next.value) || 0 : 0);
          if (next) ctx.caster.statuses = ctx.caster.statuses.filter(s => s !== next);
          const before = t.life + (t.shield?.value || 0); Engine.applyDamage(t, attackDamage, log, ctx.caster);
          const created = enemiesOf(ctx.caster).find(e => e.uid !== t.uid && (e.isToken || state.players[e.owner].extraUnits.includes(e)));
          if (created) Engine.applyDamage(created, attackDamage, log, ctx.caster);
          if (!t.dead && before > 0 && t.life <= 0) { ctx.caster.arborzillaBonus = bonus + 1; log(`${ctx.caster.name} melhora permanentemente sua Habilidade em +1.`); }
          const oldShield = ctx.caster.shield?.value || 0; ctx.caster.shield = ctx.caster.shield || {value:0,duration:1}; ctx.caster.shield.value = oldShield + 5; ctx.caster.shield.duration = 1;
          continue;
        }
        remaining.push(eff);
      }
      if (remaining.length) oldRun4(remaining, ctx, log);
    };

    // Boi usa a habilidade absorvida com a velocidade/cooldown da cópia quando possível.
    const oldAvailable = window.availableAbilities;
    if (typeof oldAvailable === 'function' && !window.__hvBoiAvailable) {
      window.__hvBoiAvailable = true;
      window.availableAbilities = function(unit) {
        const result = oldAvailable(unit);
        if (unit?.cardId === 'boi' && unit.boiAbsorbed) {
          const first = result.find(x => x.idx === 0);
          if (first) first.ab = unit.boiAbsorbed;
        }
        return result;
      };
    }
  }
  boot();
})();
