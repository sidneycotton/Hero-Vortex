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
      { speed: 5, cooldown: 0, text: 'Cause 5 de dano em um inimigo. Me cure 5 de vida.', effects: [
        { type: 'dealDamage', base: 5, target: 'chooseEnemy' },
        { type: 'heal', base: 5, target: 'self' }
      ]},
      { speed: 3, cooldown: 0, text: 'Neste turno, inimigos causam 3 de dano a menos com seus ataques.', effects: [
        { type: 'applyStatus', status: 'enemyAttackDamageReduction', value: 3, duration: 1, target: 'self' }
      ]}
    ]
  };

  const DRAAK = {
    id: 'draak', name: 'Dra\'ak, a Sombra da Morte', life: 100, role: 'defensor', isToken: true,
    passive: 'Quando eu me Transformar, neste turno, outros aliados não podem ser danificados ou alvejados por inimigos.',
    abilities: [{ speed: 4, cooldown: 0, text: 'Cause 20 de dano.', effects: [{ type: 'dealDamage', base: 20, target: 'chooseEnemy' }] }]
  };

  const DAXEN = {
    id: 'daxen_ciris', name: 'Daxen-Ciris', life: 85, role: 'defensor',
    deckDescription: 'Copia as habilidades mais rápidas dos Defensores e Atacantes inimigos e se protege de uma habilidade no turno seguinte.',
    passive: null,
    abilities: [
      { speed: 4, cooldown: 0, text: 'Eu ganho +7 de vida, use a Habilidade mais rápida do Defensor inimigo.', effects: [
        { type: 'heal', base: 7, target: 'self' }, { type: 'useFastestEnemyAbility', role: 'defensor' }
      ]},
      { speed: 4, cooldown: 0, text: 'Cause 7 de dano, use a Habilidade mais rápida do Atacante inimigo.', effects: [
        { type: 'dealDamage', base: 7, target: 'chooseEnemy' }, { type: 'useFastestEnemyAbility', role: 'atacante' }
      ]},
      { speed: 9, cooldown: 0, text: 'Eu ganho +14 de vida. No próximo turno, anule a primeira Habilidade que me alvejar.', effects: [
        { type: 'heal', base: 14, target: 'self' }, { type: 'applyStatus', status: 'daxenNullifyNext', value: 1, duration: 1, target: 'self' }
      ]}
    ]
  };

  const LIZ = {
    id: 'liz', name: 'Liz, Medrosa e Afrontosa', life: 70, role: 'defensor',
    deckDescription: 'Redireciona parte do dano para um aliado, provoca inimigos e pode refletir o dano recebido.',
    passive: 'No começo de cada turno, escolha um aliado, metade do dano que eu tomaria é redirecionado para ele.',
    abilities: [
      { speed: 2, cooldown: 0, text: 'Eu Provoco um inimigo. Dano que ele causar em mim neste turno é reduzido em 5. Dano negativo se torna Cura.', effects: [
        { type: 'taunt', target: 'chooseEnemy' }, { type: 'applyStatus', status: 'lizReduction', value: 5, duration: 1, target: 'self' }
      ]},
      { speed: 2, cooldown: 3, text: 'Nos próximos 2 turnos, dano causado em mim é aumentado em 5 e quando eu for danificada, cause o mesmo dano em um inimigo.', effects: [
        { type: 'applyStatus', status: 'lizReflect', value: 5, duration: 2, target: 'self' }
      ]}
    ]
  };

  const MOLDAR = {
    id: 'moldar', name: 'Moldar, Paciência Solar', life: 80, role: 'defensor',
    deckDescription: 'Converte os golpes recebidos em força e pune inimigos que ferem seus aliados antes de sua vez.',
    passive: null,
    abilities: [
      { speed: 9, cooldown: 0, text: 'Eu ganho +10 de vida. Repita para cada vez que eu fui danificado neste turno.', effects: [
        { type: 'healPerDamageTaken', value: 10, target: 'self' }
      ]},
      { speed: 0, cooldown: 0, text: 'Não faça nada. "Perder a paciência é perder a batalha..."', effects: [] },
      { speed: 7, cooldown: 0, text: 'Até eu agir, quando um aliado for danificado, eu revido causando 6 de dano em um inimigo.', effects: [
        { type: 'armMoldarRevenge' }
      ]}
    ]
  };

  const URAGI = {
    id: 'uragi', name: 'Uragi, Traidor Redimido', life: 90, role: 'defensor',
    deckDescription: 'Acumula Fúria ao ser ferido, repete sua habilidade ofensiva e pode atrair todos os alvos inimigos.',
    passive: 'Quando eu for danificado, coloque 1 contador da Fúria em mim.',
    abilities: [
      { speed: 3, cooldown: 0, text: 'Cause 6 de dano em um inimigo e 3 em outro. Consuma 3 contadores de Fúria para utilizar essa habilidade novamente neste turno.', effects: [
        { type: 'uragiFuryAttack' }
      ]},
      { speed: 1, cooldown: 1, text: 'Eu me torno o alvo de todas as habilidades inimigas neste turno.', effects: [
        { type: 'applyStatus', status: 'uragiTauntAll', value: 1, duration: 1, target: 'self' }
      ]}
    ]
  };

  const VENTROX = {
    id: 'ventrox', name: 'Ventrox, Virulento Temível', life: 88, role: 'defensor',
    deckDescription: 'Contamina a próxima habilidade de um inimigo, alterna entre vida e escudo e sacrifica sua própria vida para curar aliados.',
    passive: null,
    abilities: [
      { speed: 8, cooldown: 0, text: 'Eu causo 7 de dano em um inimigo. No próximo turno a Habilidade dele vira uma cópia dessa minha Habilidade.', effects: [
        { type: 'dealDamage', base: 7, target: 'chooseEnemy' }, { type: 'copyVentroxAbilityNextTurn', target: 'lastTarget' }
      ]},
      { speed: 1, cooldown: 0, text: 'Escolha um: Eu ganho +7 de vida. OU Eu ganho um escudo de 14 de vida neste turno.', effects: [
        { type: 'chooseVentroxDefense' }
      ]},
      { speed: 8, cooldown: 0, text: 'Me cause 14 de dano. Cure 14 de vida dos meus outros aliados.', effects: [
        { type: 'dealDamage', base: 14, target: 'self' }, { type: 'heal', base: 14, target: 'allAllies' }
      ]}
    ]
  };

  const ALL_NEW = [KALANY, DAXEN, LIZ, MOLDAR, URAGI, VENTROX];

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function(...args) {
    const response = await nativeFetch(...args);
    const url = String(args[0]?.url || args[0] || '');
    if (!url.includes('cards.json')) return response;
    const data = await response.clone().json();
    if (Array.isArray(data.cards)) {
      for (const card of [KALANY, ...ALL_NEW.filter(c => c.id !== 'kalany')]) {
        if (!data.cards.some(existing => existing.id === card.id)) data.cards.push(card);
      }
    }
    return new Response(JSON.stringify(data), { status: response.status, statusText: response.statusText, headers: response.headers });
  };

  function isProtectedFrom(attacker, target) {
    return !!(attacker && target && attacker.owner !== target.owner && target.statuses?.some(s => s.status === 'draakProtected'));
  }

  function installTargetProtection() {
    if (typeof enemyTeamOf !== 'function' || window.__hvDraakProtectionInstalled) return false;
    const originalEnemyTeamOf = enemyTeamOf;
    window.__hvDraakProtectionInstalled = true;
    window.__hvOriginalEnemyTeamOf = originalEnemyTeamOf;
    window.enemyTeamOf = function(unit) { return originalEnemyTeamOf(unit).filter(target => !isProtectedFrom(unit, target)); };
    return true;
  }

  function transformKalany(unit) {
    if (!unit || unit.dead || unit.cardId !== 'kalany') return;
    unit.cardId = 'draak'; unit.name = DRAAK.name; unit.role = DRAAK.role; unit.maxLife = DRAAK.life; unit.life = DRAAK.life;
    unit.shield = null; unit.statuses = unit.statuses.filter(s => s.status !== 'kalanyEndCounter'); unit.counters = {}; unit.cooldowns = {}; unit.isToken = true; unit.justSpawned = true;
    const allies = allyTeamOf(unit).filter(ally => ally.uid !== unit.uid && !ally.dead);
    for (const ally of allies) allies.push;
    for (const ally of allies) ally.statuses.push({ status: 'draakProtected', value: 1, duration: 1 });
    logMsg(`${unit.name} se transforma! Outros aliados ficam protegidos neste turno.`);
  }

  let lastTurn = null;
  function processTurnStart() {
    if (typeof state === 'undefined' || !state) return;
    if (lastTurn === null) { lastTurn = state.turn; return; }
    if (state.turn === lastTurn) return;
    lastTurn = state.turn;
    for (const unit of allUnitsAll()) {
      unit.statuses = unit.statuses.filter(s => s.status !== 'draakProtected');
      unit.healedThisTurn = false;
      unit.damagedThisTurn = 0;
    }
    for (const unit of allUnitsAll()) {
      if (unit.dead || unit.cardId !== 'kalany') continue;
      unit.counters.fim = (unit.counters.fim || 0) + 1;
      logMsg(`${unit.name} recebe ${unit.counters.fim}/5 Contadores do Fim.`);
      if (unit.counters.fim >= 5) transformKalany(unit);
    }
  }

  function boot() {
    if (typeof CARD_DB !== 'undefined' && Object.keys(CARD_DB).length > 0) {
      installTargetProtection(); setInterval(processTurnStart, 100);
    } else setTimeout(boot, 100);
  }
  boot();
})();
