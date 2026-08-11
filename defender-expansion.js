// ===================== MECÂNICAS DOS NOVOS DEFENSORES =====================
// Este arquivo é carregado depois de app.js para poder integrar efeitos que o
// motor base ainda não conhece sem duplicar o fluxo de resolução.
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

  function damageAmount(eff) {
    let amount = Number(eff.base) || 0;
    if (eff.scaling && eff.scaling.perUnit) amount += eff.scaling.perUnit * 0;
    return amount;
  }

  function chooseTargetForAbility(caster, ability) {
    if (ability.effects.some(e => e.target === 'chooseEnemy' || e.target === 'lastTarget')) return firstEnemy(caster)?.uid || null;
    if (ability.effects.some(e => e.target === 'chooseAlly' || e.target === 'chooseAllyNotMovedYet')) return firstAlly(caster)?.uid || caster.uid;
    return null;
  }

  function useFastestEnemyAbility(caster, role, log) {
    const candidate = enemiesOf(caster).filter(u => u.role === role).sort((a,b) => {
      const aa = CARD_DB[a.cardId]?.abilities || [], bb = CARD_DB[b.cardId]?.abilities || [];
      const as = aa.length ? Math.min(...aa.map(x => x.speed)) : 999;
      const bs = bb.length ? Math.min(...bb.map(x => x.speed)) : 999;
      return as - bs;
    })[0];
    if (!candidate) { log(`Nenhum ${roleLabel(role).toLowerCase()} inimigo disponível para copiar.`); return; }
    const abilities = CARD_DB[candidate.cardId]?.abilities || [];
    const choices = abilities.map((ab, idx) => ({ ab, idx })).filter(x => !(candidate.cooldowns[x.idx] > 0));
    if (!choices.length) { log(`${candidate.name} não tem Habilidades disponíveis.`); return; }
    choices.sort((a,b) => a.ab.speed - b.ab.speed);
    const chosen = choices[0];
    const targetUid = chooseTargetForAbility(candidate, chosen.ab);
    log(`${caster.name} usa a Habilidade mais rápida de ${candidate.name}.`);
    if (typeof executeAbility === 'function') executeAbility(candidate, chosen.idx, targetUid);
  }

  function applyDamageWithHooks(target, amount, source, log) {
    if (!alive(target) || amount <= 0) return 0;
    ensureStateFields(target);

    // Liz: a redução de 5 vem antes do redirecionamento. Dano abaixo de 5 vira cura.
    const lizReduction = target.statuses.find(s => s.status === 'lizReduction');
    if (lizReduction && source && source.owner !== target.owner) {
      const reduced = amount - (Number(lizReduction.value) || 0);
      if (reduced <= 0) {
        Engine.applyHeal(target, Math.abs(reduced), log);
        return 0;
      }
      amount = reduced;
    }

    // Kalany: redução de ataque inimigo já é aplicada pelo engine base.
    // Liz: metade do dano é redirecionada para o aliado escolhido.
    const redirect = target.statuses.find(s => s.status === 'lizRedirect' && s.targetUid);
    if (redirect && source && source.owner !== target.owner && !resolvingRedirect) {
      const ally = getUnit(redirect.targetUid);
      if (alive(ally)) {
        const redirected = Math.ceil(amount / 2);
        const ownDamage = amount - redirected;
        resolvingRedirect = true;
        if (redirected > 0) Engine.applyDamage(ally, redirected, log);
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

    // Uragi: Fúria ao ser danificado.
    if (target.cardId === 'uragi' && !target.dead) {
      target.counters.furia = (target.counters.furia || 0) + 1;
      log(`${target.name} ganha 1 Contador de Fúria (${target.counters.furia}).`);
    }

    // Liz: reflete o dano que efetivamente passou pela sua defesa.
    const reflect = target.statuses.find(s => s.status === 'lizReflect');
    if (target.cardId === 'liz' && reflect && source && source.owner !== target.owner && !resolvingRedirect) {
      const enemy = firstEnemy(target);
      if (enemy) {
        log(`${target.name} revida com ${dealt} de dano.`);
        resolvingRedirect = true;
        Engine.applyDamage(enemy, dealt, log);
        resolvingRedirect = false;
      }
    }

    // Moldar reage uma vez por dano sofrido por qualquer outro aliado antes de agir.
    for (const moldar of allUnitsOf(target.owner).filter(u => alive(u) && u.cardId === 'moldar' && u.statuses.some(s => s.status === 'moldarRevenge'))) {
      if (moldar.uid === target.uid || resolvingMoldar) continue;
      const enemy = firstEnemy(moldar);
      if (enemy) {
        resolvingMoldar = true;
        log(`${moldar.name} revida!`);
        Engine.applyDamage(enemy, 6, log);
        resolvingMoldar = false;
      }
    }
  }

  function runCustomEffect(eff, ctx, log) {
    const caster = ctx.caster;
    ensureStateFields(caster);

    if (eff.type === 'useFastestEnemyAbility') {
      useFastestEnemyAbility(caster, eff.role, log);
      return true;
    }

    if (eff.type === 'healPerDamageTaken') {
      const times = Number(caster.damagedThisTurn || 0);
      if (times > 0) Engine.applyHeal(caster, (Number(eff.value) || 0) * times, log);
      else log(`${caster.name} não foi danificado neste turno.`);
      return true;
    }

    if (eff.type === 'armMoldarRevenge') {
      addStatus(caster, 'moldarRevenge', 1, 1);
      caster.damagedThisTurn = caster.damagedThisTurn || 0;
      log(`${caster.name} ficará pronto para revidar até agir.`);
      return true;
    }

    if (eff.type === 'uragiFuryAttack') {
      const foes = enemiesOf(caster);
      if (!foes.length) return true;
      const first = ctx.chosenTarget && ctx.chosenTarget.owner !== caster.owner ? ctx.chosenTarget : foes[0];
      const second = foes.find(x => x.uid !== first.uid) || first;
      Engine.applyDamage(first, 6, log);
      if (second && second.uid !== first.uid) Engine.applyDamage(second, 3, log);
      else if (second) Engine.applyDamage(second, 3, log);
      const fury = Number(caster.counters.furia || 0);
      if (fury >= 3 && alive(caster)) {
        caster.counters.furia = fury - 3;
        log(`${caster.name} consome 3 de Fúria e repete a habilidade.`);
        const foesAgain = enemiesOf(caster);
        if (foesAgain.length) {
          const a = foesAgain[0], b = foesAgain.find(x => x.uid !== a.uid) || a;
          Engine.applyDamage(a, 6, log);
          Engine.applyDamage(b, 3, log);
        }
      }
      return true;
    }

    if (eff.type === 'copyVentroxAbilityNextTurn') {
      const target = ctx.lastTarget || ctx.chosenTarget;
      if (alive(target)) {
        addStatus(target, 'ventroxCopy', 1, 1);
        const ventroxAbility = CARD_DB[caster.cardId]?.abilities?.find(a => a.text?.startsWith('Eu causo 7 de dano'));
        if (ventroxAbility) target.ventroxCopy = { untilTurn: state.turn + 1, effects: JSON.parse(JSON.stringify(ventroxAbility.effects)), text: ventroxAbility.text, speed: ventroxAbility.speed };
        log(`${target.name} terá sua próxima Habilidade transformada em uma cópia de ${caster.name}.`);
      }
      return true;
    }

    if (eff.type === 'chooseVentroxDefense') {
      showVentroxChoice(caster);
      return true;
    }

    return false;
  }

  function showVentroxChoice(caster) {
    const old = document.getElementById('hvVentroxChoice');
    if (old) old.remove();
    const box = document.createElement('div');
    box.id = 'hvVentroxChoice';
    box.innerHTML = `<div class="hv-def-choice-card"><div class="hv-def-choice-title">Ventrox — escolha uma defesa</div><button data-choice="life">♥ +7 VIDA</button><button data-choice="shield">◈ ESCUDO 14</button></div>`;
    document.body.appendChild(box);
    let chosen = false;
    const apply = kind => {
      if (chosen || !alive(caster)) return;
      chosen = true; box.remove();
      if (kind === 'life') { caster.life = Math.min(caster.maxLife + 7, caster.life + 7); caster.maxLife += 7; logMsg(`${caster.name} ganha +7 de vida máxima.`); }
      else { caster.shield = { value: 14, duration: 1 }; logMsg(`${caster.name} ganha um Escudo de 14.`); }
      render();
    };
    box.querySelector('[data-choice="life"]').onclick = () => apply('life');
    box.querySelector('[data-choice="shield"]').onclick = () => apply('shield');
    setTimeout(() => { if (!chosen) apply('shield'); }, 3500);
  }

  function turnMaintenance() {
    if (!state) return;
    const turn = state.turn;
    if (!turnMaintenance.lastTurn) turnMaintenance.lastTurn = turn;
    if (turnMaintenance.lastTurn === turn) return;
    turnMaintenance.lastTurn = turn;

    for (const u of allUnitsAll()) {
      ensureStateFields(u);
      u.damagedThisTurn = 0;
      removeStatus(u, 'moldarRevenge');
      if (u.ventroxCopy && u.ventroxCopy.untilTurn < turn) delete u.ventroxCopy;
    }

    // Liz escolhe um aliado. Para manter o fluxo rápido, a escolha é feita por um pequeno overlay;
    // se não houver outro aliado, o efeito fica sem alvo.
    for (const liz of allUnitsAll().filter(u => alive(u) && u.cardId === 'liz')) promptLizRedirect(liz);
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

  const wrappedRunEffects = function(effects, ctx, log) {
    if (!effects || !effects.length) return;
    const caster = ctx.caster;

    // Daxen: a primeira habilidade inimiga que o alvejar no próximo turno é anulada.
    const chosen = ctx.chosenTarget;
    if (chosen && chosen.statuses?.some(s => s.status === 'daxenNullifyNext') && chosen.owner !== caster.owner) {
      chosen.statuses = chosen.statuses.filter(s => s.status !== 'daxenNullifyNext');
      log(`${chosen.name} anula a primeira Habilidade que o alveja.`);
      return;
    }

    // Uragi força os efeitos de alvo inimigo a usarem Uragi durante o turno.
    const taunter = enemiesOf(caster).find(u => u.cardId === 'uragi' && u.statuses.some(s => s.status === 'uragiTauntAll'));
    const effectiveCtx = taunter ? { ...ctx, chosenTarget: taunter, lastTarget: taunter } : ctx;

    // Ventrox: no próximo turno, a habilidade do alvo é substituída pela cópia armazenada.
    if (caster.ventroxCopy && caster.ventroxCopy.untilTurn === state.turn) {
      const copied = caster.ventroxCopy.effects;
      delete caster.ventroxCopy;
      log(`${caster.name} usa a Habilidade copiada de Ventrox.`);
      return wrappedRunEffects(copied, effectiveCtx, log);
    }

    for (const eff of effects) {
      if (runCustomEffect(eff, effectiveCtx, log)) continue;

      if (eff.type === 'dealDamage') {
        let targets = Engine.resolveTargets(eff.target, effectiveCtx);
        let amount = damageAmount(eff);
        for (const target of targets) {
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
