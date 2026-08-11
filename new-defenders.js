// ===================== NOVOS DEFENSORES =====================
// Kalany é a carta de deck. Draak é a forma/token para a qual Kalany se transforma.

(() => {
  const KALANY = {
    id: 'kalany',
    name: 'Kalany, à Sombra da Morte',
    life: 50,
    role: 'defensor',
    passive: 'No começo de cada turno, coloque um Contador do Fim em mim. Quando eu tiver 5, me transforme em Dra\'ak.',
    deckDescription: 'Acumula Contadores do Fim a cada turno e, após cinco, se transforma em Draak, ficando muito mais resistente.',
    abilities: [
      {
        speed: 5,
        cooldown: 0,
        text: 'Cause 5 de dano em um inimigo. Me cure 5 de vida.',
        effects: [
          { type: 'dealDamage', base: 5, target: 'chooseEnemy' },
          { type: 'heal', base: 5, target: 'self' }
        ]
      },
      {
        speed: 3,
        cooldown: 0,
        text: 'Neste turno, inimigos causam 3 de dano a menos com seus ataques.',
        effects: [
          { type: 'applyStatus', status: 'enemyAttackDamageReduction', value: 3, duration: 1, target: 'self' }
        ]
      }
    ]
  };

  const DRAAK = {
    id: 'draak',
    name: 'Dra\'ak, a Sombra da Morte',
    life: 100,
    role: 'defensor',
    isToken: true,
    passive: 'Quando eu me Transformar, neste turno, outros aliados não podem ser danificados ou alvejados por inimigos.',
    abilities: [
      {
        speed: 4,
        cooldown: 0,
        text: 'Cause 20 de dano.',
        effects: [
          { type: 'dealDamage', base: 20, target: 'chooseEnemy' }
        ]
      }
    ]
  };

  function installCards() {
    if (typeof CARD_DB === 'undefined' || !CARD_DB || Object.keys(CARD_DB).length === 0) return false;
    CARD_DB.kalany = KALANY;
    // Draak fica fora do deckbuilder: só existe quando Kalany se transforma.
    if (typeof render === 'function') render();
    return true;
  }

  function isProtectedFrom(attacker, target) {
    return !!(attacker && target && attacker.owner !== target.owner &&
      target.statuses?.some(s => s.status === 'draakProtected'));
  }

  function installTargetProtection() {
    if (typeof enemyTeamOf !== 'function' || window.__hvDraakProtectionInstalled) return;
    const originalEnemyTeamOf = enemyTeamOf;
    window.__hvDraakProtectionInstalled = true;
    window.__hvOriginalEnemyTeamOf = originalEnemyTeamOf;
    window.enemyTeamOf = function(unit) {
      return originalEnemyTeamOf(unit).filter(target => !isProtectedFrom(unit, target));
    };

    if (typeof executeAbility === 'function') {
      const originalExecuteAbility = executeAbility;
      window.executeAbility = function(caster, abilityIdx, targetUid) {
        const target = targetUid ? getUnit(targetUid) : null;
        if (isProtectedFrom(caster, target)) targetUid = null;
        return originalExecuteAbility(caster, abilityIdx, targetUid);
      };
    }
  }

  function transformKalany(unit) {
    if (!unit || unit.dead || unit.cardId !== 'kalany') return;

    unit.cardId = 'draak';
    unit.name = DRAAK.name;
    unit.role = DRAAK.role;
    unit.maxLife = DRAAK.life;
    unit.life = DRAAK.life;
    unit.shield = null;
    unit.statuses = unit.statuses.filter(s => s.status !== 'kalanyEndCounter');
    unit.counters = {};
    unit.cooldowns = {};
    unit.isToken = true;
    unit.justSpawned = true;

    // Protege os outros aliados somente durante o turno da transformação.
    const allies = allyTeamOf(unit).filter(ally => ally.uid !== unit.uid && !ally.dead);
    for (const ally of allies) {
      ally.statuses.push({ status: 'draakProtected', value: 1, duration: 1 });
    }

    logMsg(`${unit.name} se transforma! Outros aliados ficam protegidos neste turno.`);
  }

  let lastTurn = null;
  function processTurnStart() {
    if (typeof state === 'undefined' || !state) return;
    if (lastTurn === null) {
      lastTurn = state.turn;
      return;
    }
    if (state.turn === lastTurn) return;
    lastTurn = state.turn;

    // Remove a proteção do turno anterior antes de aplicar a nova transformação.
    for (const unit of allUnitsAll()) {
      unit.statuses = unit.statuses.filter(s => s.status !== 'draakProtected');
    }

    for (const unit of allUnitsAll()) {
      if (unit.dead || unit.cardId !== 'kalany') continue;
      unit.counters.fim = (unit.counters.fim || 0) + 1;
      logMsg(`${unit.name} recebe ${unit.counters.fim}/5 Contadores do Fim.`);
      if (unit.counters.fim >= 5) transformKalany(unit);
    }
  }

  function boot() {
    if (installCards()) {
      installTargetProtection();
      setInterval(processTurnStart, 100);
    } else {
      setTimeout(boot, 100);
    }
  }

  boot();
})();
