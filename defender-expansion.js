// ===================== MECÂNICAS DOS NOVOS DEFENSORES =====================
(() => {
  const originalRunEffects = Engine.runEffects;
  let resolvingRedirect = false;
  let resolvingMoldar = false;
  let initialized = false;

  const alive = u => u && !u.dead && u.life > 0;
  const enemiesOf = u => allUnitsOf(1 - u.owner).filter(alive);
  const alliesOf = u => allUnitsOf(u.owner).filter(alive);
  const firstEnemy = u => enemiesOf(u).sort((a,b) => Engine.getCurrentLife(a) - Engine.getCurrentLife(b))[0] || null;
  const firstAlly = u => alliesOf(u).find(a => a.uid !== u.uid) || null;

  function ensureStateFields(u) {
    if (!u.counters) u.counters = {};
    if (!u.statuses) u.statuses = [];
  }
  function addStatus(u, status, value, duration) {
    ensureStateFields(u);
    const old = u.statuses.find(s => s.status === status);
    if (old) { old.value = value; old.duration = duration; }
    else u.statuses.push({ status, value, duration });
  }
  function removeStatus(u, status) { u.statuses = (u.statuses || []).filter(s => s.status !== status); }

  function damageAmount(eff) { return Number(eff.base) || 0; }

  function chooseTargetForAbility(caster, ability) {
    if (ability.effects.some(e => e.target === 'chooseEnemy' || e.target === 'lastTarget')) return firstEnemy(caster)?.uid || null;
    if (ability.effects.some(e => e.target === 'chooseAlly' || e.target === 'chooseAllyNotMovedYet')) return firstAlly(caster)?.uid || caster.uid;
    return null;
  }

  function useFastestEnemyAbility(caster, role, log) {
    const candidates = enemiesOf(caster).filter(u => u.role === role).sort((a,b) => {
      const aa = CARD_DB[a.cardId]?.abilities || [], bb = CARD_DB[b.cardId]?.abilities || [];
      const as = aa.length ? Math.min(...aa.map(x => x.speed)) : 999;
      const bs = bb.length ? Math.min(...bb.map(x => x.speed)) : 999;
      return as - bs;
    });
    const candidate = candidates[0];
    if (!candidate) { log(`Nenhum ${roleLabel(role).toLowerCase()} inimigo disponível para copiar.`); return; }
    const choices = (CARD_DB[candidate.cardId]?.abilities || []).map((ab, idx) => ({ab,idx})).filter(x => !(candidate.cooldowns[x.idx] > 0));
    if (!choices.length) { log(`${candidate.name} não tem Habilidades disponíveis.`); return; }
    choices.sort((a,b) => a.ab.speed - b.ab.speed);
    const chosen = choices[0];
    log(`${caster.name} usa a Habilidade mais rápida de ${candidate.name}.`);
    if (typeof executeAbility === 'function') executeAbility(candidate, chosen.idx, chooseTargetForAbility(candidate, chosen.ab));
  }

  function applyDamageWithHooks(target, amount, source, log) {
    if (!alive(target) || amount <= 0) return 0;
    ensureStateFields(target);
    if (source && source.owner !== target.owner && target.statuses.some(s => s.status === 'draakProtected')) {
      log(`${target.name} está protegido pela transformação de Draak.`);
      return 0;
    }

    const lizReflect = target.statuses.find(s => s.status === 'lizReflect');
    if (lizReflect && source && source.owner !== target.owner) amount += Number(lizReflect.value) || 0;

    const lizReduction = target.statuses.find(s => s.status === 'lizReduction');
    if (lizReduction && source && source.owner !== target.owner) {
      const reduced = amount - (Number(lizReduction.value) || 0);
      if (reduced <= 0) {
        Engine.applyHeal(target, Math.abs(reduced), log);
        return 0;
      }
      amount = reduced;
    }

    const redirect = target.statuses.find(s => s.status === 'lizRedirect' && s.targetUid);
    if (redirect && source && source.owner !== target.owner && !resolvingRedirect) {
      const ally = getUnit(redirect.targetUid);
      if (alive(ally)) {
        const redirected = Math.ceil(amount / 2);
        const ownDamage = amount - redirected;
        resolvingRedirect = true;
        if (redirected > 0) {
          const redirectedDealt = Engine.applyDamage(ally, redirected, log);
          if (redirectedDealt > 0) afterDamage(ally, redirectedDealt, source, log);
        }
        resolvingRedirect = false;
        const dealt = ownDamage > 0 ? Engine.applyDamage(target, ownDamage, log) : 0;
        if (dealt > 0) afterDamage(target, dealt, source, log);
        return dealt + redirected;
      }
    }

    const dealt = Engine.applyDamage(target, amount, log);
    if (dealt > 0) afterDamage(target, dealt, source, log);
    return dealt;
  }

  function afterDamage(target, dealt, source, log) {
    if (!target || dealt <= 0) return;
    ensureStateFields(target);
    target.damagedThisTurn = (target.damagedThisTurn || 0) + 1;

    if (target.cardId === 'uragi' && !target.dead) {
      target.counters.furia = (target.counters.furia || 0) + 1;
      log(`${target.name} ganha 1 Contador de Fúria (${target.counters.furia}).`);
    }

    const reflect = target.statuses.find(s => s.status === 'lizReflect');
    if (target.cardId === 'liz' && reflect && source && source.owner !== target.owner && !resolvingRedirect) {
      const enemy = firstEnemy(target);
      if (enemy) {
        log(`${target.name} revida com ${dealt} de dano.`);
        resolvingRedirect = true;
        const reflected = Engine.applyDamage(enemy, dealt, log);
        if (reflected > 0) afterDamage(enemy, reflected, target, log);
        resolvingRedirect = false;
      }
    }

    for (const moldar of allUnitsOf(target.owner).filter(u => alive(u) && u.cardId === 'moldar' && u.statuses.some(s => s.status === 'moldarRevenge'))) {
      if (moldar.uid === target.uid || resolvingMoldar) continue;
      const enemy = firstEnemy(moldar);
      if (enemy) {
        resolvingMoldar = true;
        log(`${moldar.name} revida!`);
        const reflected = Engine.applyDamage(enemy, 6, log);
        if (reflected > 0) afterDamage(enemy, reflected, moldar, log);
        resolvingMoldar = false;
      }
    }
  }

  function runCustomEffect(eff, ctx, log) {
    const caster = ctx.caster;
    ensureStateFields(caster);

    if (eff.type === 'useFastestEnemyAbility') { useFastestEnemyAbility(caster, eff.role, log); return true; }

    if (eff.type === 'healPerDamageTaken') {
      const times = Number(caster.damagedThisTurn || 0);
      if (times > 0) Engine.applyHeal(caster, (Number(eff.value) || 0) * times, log);
      else log(`${caster.name} não foi danificado neste turno.`);
      return true;
    }

    if (eff.type === 'armMoldarRevenge') {
      log(`${caster.name} mantém a reação armada até agir.`);
      return true;
    }

    if (eff.type === 'uragiFuryAttack') {
      const foes = enemiesOf(caster);
      if (!foes.length) return true;
      const first = ctx.chosenTarget && ctx.chosenTarget.owner !== caster.owner ? ctx.chosenTarget : foes[0];
      const second = foes.find(x => x.uid !== first.uid) || first;
      applyDamageWithHooks(first, 6, caster, log);
      applyDamageWithHooks(second, 3, caster, log);
      const fury = Number(caster.counters.furia || 0);
      if (fury >= 3 && alive(caster)) {
        caster.counters.furia = fury - 3;
        log(`${caster.name} consome 3 de Fúria e repete a habilidade.`);
        const again = enemiesOf(caster);
        if (again.length) {
          const a = again[0], b = again.find(x => x.uid !== a.uid) || a;
          applyDamageWithHooks(a, 6, caster, log);
          applyDamageWithHooks(b, 3, caster, log);
        }
      }
      return true;
    }

    if (eff.type === 'copyVentroxAbilityNextTurn') {
      const target = ctx.lastTarget || ctx.chosenTarget;
      if (alive(target)) {
        const ventroxAbility = CARD_DB[caster.cardId]?.abilities?.find(a => a.text?.startsWith('Eu causo 7 de dano'));
        if (ventroxAbility) target.ventroxCopy = { untilTurn: state.turn + 1, effects: JSON.parse(JSON.stringify(ventroxAbility.effects)), text: ventroxAbility.text, speed: ventroxAbility.speed };
        log(`${target.name} terá sua Habilidade do próximo turno transformada em uma cópia de ${caster.name}.`);
      }
      return true;
    }

    if (eff.type === 'chooseVentroxDefense') { showVentroxChoice(caster); return true; }
    return false;
  }

  function showVentroxChoice(caster) {
    const old = document.getElementById('hvVentroxChoice'); if (old) old.remove();
    const box = document.createElement('div'); box.id = 'hvVentroxChoice';
    box.innerHTML = `<div class="hv-def-choice-card"><div class="hv-def-choice-title">Ventrox — escolha uma defesa</div><button data-choice="life">♥ +7 VIDA</button><button data-choice="shield">◈ ESCUDO 14</button></div>`;
    document.body.appendChild(box);
    let chosen = false;
    const apply = kind => {
      if (chosen || !alive(caster)) return;
      chosen = true; box.remove();
      if (kind === 'life') { caster.maxLife += 7; caster.life += 7; logMsg(`${caster.name} ganha +7 de vida máxima.`); }
      else { caster.shield = { value: 14, duration: 1 }; logMsg(`${caster.name} ganha um Escudo de 14.`); }
      render();
    };
    box.querySelector('[data-choice="life"]').onclick = () => apply('life');
    box.querySelector('[data-choice="shield"]').onclick = () => apply('shield');
    setTimeout(() => { if (!chosen) apply('shield'); }, 3500);
  }

  function promptLizRedirect(liz) {
    const allies = alliesOf(liz).filter(a => a.uid !== liz.uid);
    if (!allies.length) return;
    const old = document.getElementById('hvLizChoice'); if (old) old.remove();
    const box = document.createElement('div'); box.id = 'hvLizChoice';
    box.innerHTML = `<div class="hv-def-choice-card"><div class="hv-def-choice-title">Liz — escolha quem recebe metade do seu dano</div>${allies.map(a => `<button data-uid="${a.uid}">${a.name}</button>`).join('')}</div>`;
    document.body.appendChild(box);
    const choose = uid => { const target = getUnit(uid); if (target && alive(target)) { addStatus(liz, 'lizRedirect', uid, 1); logMsg(`${liz.name} escolheu ${target.name} para receber metade do dano.`); } box.remove(); };
    box.querySelectorAll('button').forEach(b => b.onclick = () => choose(b.dataset.uid));
    setTimeout(() => { if (document.getElementById('hvLizChoice')) choose(allies[0].uid); }, 3500);
  }

  function turnMaintenance() {
    if (!state) return;
    const turn = state.turn;
    const firstRun = !turnMaintenance.lastTurn;
    if (!firstRun && turnMaintenance.lastTurn === turn) return;
    turnMaintenance.lastTurn = turn;

    for (const u of allUnitsAll()) {
      ensureStateFields(u);
      u.damagedThisTurn = 0;
      removeStatus(u, 'moldarRevenge');
      if (u.ventroxCopy && u.ventroxCopy.untilTurn < turn) delete u.ventroxCopy;
      if (u.cardId === 'moldar' && alive(u)) addStatus(u, 'moldarRevenge', 1, 1);
    }
    for (const liz of allUnitsAll().filter(u => alive(u) && u.cardId === 'liz')) promptLizRedirect(liz);
  }

  const wrappedRunEffects = function(effects, ctx, log) {
    if (!effects || !effects.length) return;
    const caster = ctx.caster;
    const chosen = ctx.chosenTarget;

    if (chosen && chosen.statuses?.some(s => s.status === 'daxenNullifyNext') && chosen.owner !== caster.owner) {
      chosen.statuses = chosen.statuses.filter(s => s.status !== 'daxenNullifyNext');
      log(`${chosen.name} anula a primeira Habilidade que o alveja.`);
      return;
    }

    if (chosen && chosen.statuses?.some(s => s.status === 'draakProtected') && chosen.owner !== caster.owner) {
      log(`${chosen.name} não pode ser alvejado durante a proteção de Draak.`);
      return;
    }

    const taunter = enemiesOf(caster).find(u => u.cardId === 'uragi' && u.statuses.some(s => s.status === 'uragiTauntAll'));
    const effectiveCtx = taunter ? { ...ctx, chosenTarget: taunter, lastTarget: taunter } : ctx;

    if (caster.ventroxCopy && caster.ventroxCopy.untilTurn === state.turn) {
      const copied = caster.ventroxCopy.effects;
      delete caster.ventroxCopy;
      log(`${caster.name} usa a Habilidade copiada de Ventrox.`);
      return wrappedRunEffects(copied, effectiveCtx, log);
    }

    // Moldar deixa de revidar exatamente quando chega sua própria ação.
    if (caster.cardId === 'moldar') removeStatus(caster, 'moldarRevenge');

    for (const eff of effects) {
      if (runCustomEffect(eff, effectiveCtx, log)) continue;
      if (eff.type === 'dealDamage') {
        const targets = Engine.resolveTargets(eff.target, effectiveCtx);
        const amount = damageAmount(eff);
        for (const target of targets) {
          if (target && target.owner !== caster.owner && target.statuses?.some(s => s.status === 'draakProtected')) {
            log(`${target.name} está protegido pela transformação de Draak.`);
            continue;
          }
          const dealt = applyDamageWithHooks(target, amount, caster, log);
          effectiveCtx.lastTarget = target;
          if (dealt > 0 && target.cardId === 'liz') target.lastHealAmount = dealt;
        }
        continue;
      }
      originalRunEffects([eff], effectiveCtx, log);
    }
  };

  Engine.runEffects = wrappedRunEffects;

  function boot() {
    if (initialized) return;
    if (typeof state === 'undefined') return setTimeout(boot, 100);
    initialized = true;
    setInterval(turnMaintenance, 100);
  }
  boot();
})();
