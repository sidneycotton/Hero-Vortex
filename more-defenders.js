// ===================== MAIS DEFENSORES =====================
// Cartas 100% declarativas + hooks das mecânicas especiais.
(() => {
  const MORE = [
    {
      id: 'benicio', name: 'Benício, Herói em Treinamento', life: 81, role: 'defensor',
      deckDescription: 'Protege aliados recém-criados, acelera habilidades que geram unidades e prepara contra-ataques de emergência.',
      passive: 'Sempre que você criar um aliado, conceda 5 de Escudo a ele. Habilidades aliadas que criam aliados, aceleram em 2.',
      abilities: [
        { speed: 1, cooldown: 0, text: 'Escolha um aliado, o próximo ataque dele causa 5 de dano a mais. Ele não pode ser provocado até o final do próximo turno.', effects: [{ type: 'applyStatus', status: 'benicioNextAttack', value: 5, duration: 2, target: 'chooseAlly' }] },
        { speed: 2, cooldown: 0, text: 'Neste turno, se um aliado for tomar 15 de dano, ele ataca imediatamente primeiro. Se ele já tiver agido, ele ganha um Escudo de 10 de vida invés.', effects: [{ type: 'armBenicioEmergency' }] }
      ]
    },
    {
      id: 'rahdan', name: 'Rahdan, Rei das Almas', life: 81, role: 'defensor',
      deckDescription: 'Rouba vida dos aliados para fortalecer seus ataques e converte a própria vida em um grande Escudo.',
      passive: 'Quando um aliado for atacar um inimigo, eu roubo 2 de vida do aliado e aumento o dano do ataque em 4.',
      abilities: [
        { speed: 4, cooldown: 0, text: 'Roube 4 de vida de um inimigo e 2 dos outros. Eles causam 2 de dano a menos neste turno.', effects: [{ type: 'rahdanDrainEnemies' }] },
        { speed: 1, cooldown: 0, text: 'Cause 8 de dano em mim. Me dê um escudo com 16 de vida.', effects: [{ type: 'dealDamage', base: 8, target: 'self' }, { type: 'applyShield', value: 16, duration: 1, target: 'self' }] }
      ]
    },
    {
      id: 'zengrath', name: 'Zengrath, Ódio Encarnado', life: 70, role: 'defensor',
      deckDescription: 'Fica mais resistente conforme o jogo acumula mortes e transforma sua vida máxima em dano.',
      passive: 'Quando eu for Jogado, eu ganho +2 de vida máxima para cada unidade que já morreu neste jogo.',
      abilities: [
        { speed: 9, cooldown: 0, text: 'Cause dano igual a 10% da minha vida máxima em um inimigo. (Arredondado para cima.)', effects: [{ type: 'zengrathMaxLifeDamage', target: 'chooseEnemy' }] },
        { speed: 2, cooldown: 0, text: 'Cause 2 de dano em todos os inimigos. Eu ganho +2 de vida máxima para cada inimigo atingido.', effects: [{ type: 'zengrathMassAttack' }] }
      ]
    },
    {
      id: 'predador_labirinto', name: 'O Predador do Labirinto', life: 60, role: 'defensor',
      deckDescription: 'Multiplica sua presença toda vez que é danificado e fica mais perigoso ao atingir o limite de cópias.',
      passive: 'Quando eu for danificado, crie uma cópia idêntica a mim. (Até um máximo de 15 podem existir ao mesmo tempo.)',
      abilities: [
        { speed: 6, cooldown: 0, text: 'Cause 1 de dano em um inimigo. Se 15 cópias existem, cause 1 de dano a mais.', effects: [{ type: 'predadorAttack' }] },
        { speed: 2, cooldown: 0, text: 'Conceda 1 de Escudo para todos os aliados neste turno. Se 15 cópias existem, conceda 1 a mais.', effects: [{ type: 'predadorShield' }] }
      ]
    },
    {
      id: 'arborzilla', name: 'Arborzilla, Forte para Carvalho', life: 86, role: 'defensor',
      deckDescription: 'Bate em inimigos criados, cresce ao conseguir abates e converte efeitos purificados em pressão ofensiva.',
      passive: 'Quando eu atacar um inimigo, ataque também um inimigo que foi criado.',
      abilities: [
        { speed: 4, cooldown: 0, text: 'Cause 5 de dano em um inimigo e ganhe 5 de Escudo neste turno. Se essa Habilidade matou um inimigo, melhore ela em 1 permanentemente.', effects: [{ type: 'arborzillaAttack' }] },
        { speed: 7, cooldown: 0, text: 'Purifique um aliado. Coloque os efeitos removidos dele em um inimigo.', effects: [{ type: 'purifyTransfer', target: 'chooseAlly' }] }
      ]
    },
    {
      id: 'porteiro', name: 'O Porteiro', life: 84, role: 'defensor',
      deckDescription: 'Provoca aliados, converte golpes em cura e pune quem ignora sua provocação.',
      passive: null,
      abilities: [
        { speed: 5, cooldown: 0, text: 'Eu causo 8 de dano em um inimigo. Se ele não me atacar neste turno, cause mais 8. Bom dia.', effects: [{ type: 'porteiroMark', target: 'chooseEnemy' }, { type: 'dealDamage', base: 8, target: 'chooseEnemy' }] },
        { speed: 2, cooldown: 0, text: 'Purifique uma unidade.', effects: [{ type: 'purify', target: 'chooseAlly' }] },
        { speed: 3, cooldown: 1, text: 'Eu Provoco um aliado. Ao invés de me danificar, o dano dele me cura neste turno.', effects: [{ type: 'porteiroTauntAlly', target: 'chooseAlly' }] }
      ]
    },
    {
      id: 'varghul', name: 'Varghul, Ressurreto Insano', life: 84, role: 'defensor',
      deckDescription: 'Transforma mortes de aliados em dano e cria cópias descartáveis para atacar ou provocar inimigos.',
      passive: 'Quando um aliado morrer, cause 6 de dano em um inimigo.',
      abilities: [
        { speed: 4, cooldown: 0, text: 'Crie uma cópia minha. Ela ataca um inimigo causando 6 de dano e depois morre.', effects: [{ type: 'varghulStrikeCopy', target: 'chooseEnemy' }] },
        { speed: 1, cooldown: 0, text: 'Crie uma Cópia minha. Ela Provoca um Inimigo e morre após a Habilidade do inimigo ser usada.', effects: [{ type: 'varghulTauntCopy', target: 'chooseEnemy' }] }
      ]
    },
    {
      id: 'cm9', name: 'CM-9, O Sistema de Segurança', life: 88, role: 'defensor',
      deckDescription: 'Recompensa ações mais rápidas, transforma dano recente em Escudo e entra em alerta para retaliar.',
      passive: null,
      abilities: [
        { speed: 2, cooldown: 0, text: 'Neste turno, sempre que um aliado utilizar uma habilidade antes do inimigo da mesma classe, cause 10 de dano no inimigo.', effects: [{ type: 'armCM9Strike' }] },
        { speed: 2, cooldown: 2, text: 'Me dê um escudo com vida igual a quantidade de vida que eu perdi desde o último turno.', effects: [{ type: 'cm9Shield' }] },
        { speed: 3, cooldown: 1, text: 'Eu entro em alerta neste turno. Quando eu for danificado, cause 2 de dano em todos os inimigos e aumente esse dano em 1.', effects: [{ type: 'armCM9Alert' }] }
      ]
    },
    {
      id: 'boi', name: 'Boi, o Saparrudo', life: 86, role: 'defensor',
      deckDescription: 'Absorve uma habilidade inimiga enquanto está na mão e pode reutilizá-la como seu próprio golpe.',
      passive: 'Uma vez por jogo, enquanto eu estiver na sua mão, você pode me revelar. Se você fizer isso, eu absorvo uma Habilidade inimiga. (Cancele todos os Efeitos dela.)',
      abilities: [
        { speed: 0, cooldown: 0, icon: 'frog', text: 'Essa Habilidade se Torna a Habilidade Absorvida.', effects: [{ type: 'boiUseAbsorbed' }] },
        { speed: 4, cooldown: 0, text: 'Eu ganho X de Escudo e causo X de Dano em um inimigo. Onde X é o dobro da quantidade de turnos em que eu estou no campo.', effects: [{ type: 'boiScalingAttack', target: 'chooseEnemy' }] }
      ]
    },
    {
      id: 'zeth', name: 'Zeth, Túmulo Vivo', life: 99, role: 'defensor',
      deckDescription: 'Aplica Decaimento crescente e usa um Escudo para espalhar o efeito no fim do turno.',
      passive: null,
      abilities: [
        { speed: 1, cooldown: 0, text: 'Cause 9 de dano em mim.', effects: [{ type: 'dealDamage', base: 9, target: 'self' }] },
        { speed: 6, cooldown: 2, text: 'Coloque Decaimento 4 no inimigo.', effects: [{ type: 'applyDecay', value: 4, target: 'chooseEnemy' }] },
        { speed: 1, cooldown: 2, text: 'Eu ganho um escudo de 18 de vida. No final do turno, se eu tiver esse escudo, aplique Decaimento 3 em todos os inimigos.', effects: [{ type: 'zethShieldDecay' }] }
      ]
    }
  ];

  // Adiciona/substitui as cartas no mesmo pipeline usado por new-defenders.js.
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function(...args) {
    const response = await nativeFetch(...args);
    const url = String(args[0]?.url || args[0] || '');
    if (!url.includes('cards.json')) return response;
    const data = await response.clone().json();
    if (Array.isArray(data.cards)) {
      for (const card of MORE) {
        const idx = data.cards.findIndex(existing => existing.id === card.id);
        if (idx >= 0) data.cards[idx] = card; else data.cards.push(card);
      }
    }
    return new Response(JSON.stringify(data), { status: response.status, statusText: response.statusText, headers: response.headers });
  };

  const alive = u => !!u && !u.dead && u.life > 0;
  const enemiesOf = u => allUnitsOf(1 - u.owner).filter(alive);
  const alliesOf = u => allUnitsOf(u.owner).filter(alive);
  const allKnown = () => state ? state.players.flatMap(p => [
    ...ROLES.map(r => p.slots[r]?.active).filter(Boolean),
    ...p.extraUnits
  ]) : [];
  const enemyOfRole = (u, role) => enemiesOf(u).filter(x => x.role === role);
  const firstEnemy = u => enemiesOf(u)[0] || null;
  const addStatus = (u, status, value = 1, duration = 1) => {
    if (!u) return;
    u.statuses ||= [];
    const old = u.statuses.find(s => s.status === status);
    if (old) { old.value = value; old.duration = duration; }
    else u.statuses.push({ status, value, duration });
  };
  const removeStatus = (u, status) => { if (u) u.statuses = (u.statuses || []).filter(s => s.status !== status); };
  const hasStatus = (u, status) => !!u?.statuses?.some(s => s.status === status);
  const addShield = (u, amount, duration = 1) => {
    if (!u || amount <= 0) return;
    if (u.shield && u.shield.value > 0) {
      u.shield.value += amount;
      u.shield.duration = Math.max(Number(u.shield.duration) || 0, duration);
    } else u.shield = { value: amount, duration };
  };
  const healDirect = (u, amount, log) => {
    if (!alive(u) || amount <= 0) return 0;
    const before = u.life; u.life = Math.min(u.maxLife, u.life + amount); const healed = u.life - before;
    if (healed) { u.healedThisTurn = true; log(`${u.name} recupera ${healed} de vida.`); }
    return healed;
  };
  const hurtDirect = (u, amount) => { if (!u || u.dead) return; u.life = Math.max(0, u.life - Math.max(0, amount)); if (u.life === 0) u.dead = true; };

  function hasBenicio(ownerIdx) { return allUnitsOf(ownerIdx).some(u => alive(u) && u.cardId === 'benicio'); }
  function createdCount() { return allUnitsAll().filter(u => alive(u) && (u.isToken || state.players[u.owner].extraUnits.includes(u))).length; }
  function totalPredadores() { return allUnitsAll().filter(u => alive(u) && u.cardId === 'predador_labirinto').length; }

  // Benício: qualquer unidade criada enquanto ele está em campo recebe +5 Escudo.
  const originalMakeUnit = window.makeUnit;
  if (typeof originalMakeUnit === 'function' && !window.__hvMoreMakeUnit) {
    window.__hvMoreMakeUnit = true;
    window.makeUnit = function(cardId, ownerIdx) {
      const unit = originalMakeUnit(cardId, ownerIdx);
      const p = state?.players?.[ownerIdx];
      if (p?.boiAbsorbed && cardId === 'boi') unit.boiAbsorbed = JSON.parse(JSON.stringify(p.boiAbsorbed));
      if (cardId !== 'benicio' && hasBenicio(ownerIdx)) addShield(unit, 5, 1);
      return unit;
    };
  }

  // Cartas que criam unidades ficam 2 de velocidade mais rápidas com Benício ativo.
  const originalBeginResolution = window.beginResolution;
  if (typeof originalBeginResolution === 'function' && !window.__hvMoreSpeedHook) {
    window.__hvMoreSpeedHook = true;
    window.beginResolution = function() {
      const restores = [];
      for (const p of state.players) {
        if (!hasBenicio(state.players.indexOf(p))) continue;
        for (const id of Object.keys(CARD_DB)) {
          const card = CARD_DB[id];
          if (!card?.abilities) continue;
          for (const ab of card.abilities) {
            if ((ab.effects || []).some(e => ['createToken', 'varghulStrikeCopy', 'varghulTauntCopy', 'boiUseAbsorbed'].includes(e.type))) {
              restores.push([ab, ab.speed]); ab.speed = Math.max(0, ab.speed - 2);
            }
          }
        }
      }
      try { return originalBeginResolution(); } finally { for (const [ab, speed] of restores) ab.speed = speed; }
    };
  }

  // Marca unidades que realmente agiram, útil para Benício/CM-9.
  const originalExecuteAbility = window.executeAbility;
  if (typeof originalExecuteAbility === 'function' && !window.__hvMoreExecuteHook) {
    window.__hvMoreExecuteHook = true;
    window.executeAbility = function(caster, abilityIdx, targetUid) {
      caster.actedThisTurn = true;
      const ability = caster.boiAbsorbed && caster.cardId === 'boi' && abilityIdx === 0 ? caster.boiAbsorbed : CARD_DB[caster.cardId]?.abilities?.[abilityIdx];
      const beforeTargets = ability ? (ability.effects || []).flatMap(e => e.target ? Engine.resolveTargets(e.target, { caster, chosenTarget: targetUid ? getUnit(targetUid) : null, allyTeam: allyTeamOf(caster), enemyTeam: enemyTeamOf(caster), lastTarget: targetUid ? getUnit(targetUid) : null }) : []) : [];
      const result = originalExecuteAbility(caster, abilityIdx, targetUid);
      if (ability?.effects?.some(e => e.type === 'dealDamage' || e.type === 'uragiFuryAttack' || e.type === 'predadorAttack' || e.type === 'arborzillaAttack' || e.type === 'rahdanDrainEnemies')) {
        for (const t of beforeTargets) if (t?.cardId === 'porteiro') t.attackedThisTurn = true;
      }
      // CM-9: se o aliado resolveu antes do inimigo da mesma classe, dispara 10.
      const cm9s = allUnitsOf(caster.owner).filter(u => alive(u) && u.cardId === 'cm9' && hasStatus(u, 'cm9Strike'));
      const currentIndex = Math.max(0, (state.resolutionIdx || 1) - 1);
      for (const cm9 of cm9s) {
        const foe = enemyOfRole(caster, caster.role).find(e => state.resolutionQueue.findIndex(q => q.uid === e.uid) > currentIndex);
        if (foe) Engine.applyDamage(foe, 10, logMsg, cm9);
      }
      // Cópias de Varghul que esperam uma habilidade inimiga morrem após a resolução.
      if (caster.owner === 0 || caster.owner === 1) {
        for (const copy of allUnitsOf(caster.owner).filter(u => alive(u) && u.cardId === 'varghul' && hasStatus(u, 'varghulDieAfterEnemy'))) {
          if (caster.owner !== copy.owner) { copy.life = 0; copy.dead = true; }
        }
      }
      return result;
    };
  }

  // Purificação, Decaimento e efeitos especiais.
  const previousRunEffects = Engine.runEffects;
  const originalApplyDamage = Engine.applyDamage;
  let resolvingEmergency = false;
  let resolvingAlert = false;
  let resolvingPredator = false;

  Engine.applyDamage = function(unit, amount, log, source = null) {
    if (!unit || unit.dead || amount <= 0) return 0;

    // O Porteiro converte dano de um aliado provocado em cura neste turno.
    if (source && source.owner === unit.owner && hasStatus(unit, 'porteiroHealDamage')) {
      healDirect(unit, amount, log);
      return 0;
    }

    // Benício: 15+ de dano aciona o aliado antes do golpe; se ele já agiu, ganha Escudo.
    if (source && source.owner !== unit.owner && amount >= 15 && !resolvingEmergency) {
      const benicios = allUnitsOf(unit.owner).filter(u => alive(u) && hasStatus(u, 'benicioEmergency'));
      for (const benicio of benicios) {
        resolvingEmergency = true;
        if (unit.actedThisTurn) addShield(unit, 10, 1);
        else {
          const decl = state.declarations[unit.owner]?.[unit.uid];
          if (decl && decl.abilityIdx != null) {
            logMsg(`${unit.name} ataca imediatamente antes de receber o golpe de 15+ de dano.`);
            window.executeAbility(unit, decl.abilityIdx, decl.targetUid || null);
          }
        }
        resolvingEmergency = false;
      }
    }

    const dealt = originalApplyDamage(unit, amount, log, source);

    // Predador cria uma cópia mesmo se o golpe que o danificou o derrotou.
    if (dealt > 0 && unit.cardId === 'predador_labirinto' && !resolvingPredator && totalPredadores() < 15) {
      resolvingPredator = true;
      const copy = window.makeUnit('predador_labirinto', unit.owner);
      copy.justSpawned = true;
      ownerOf(unit).extraUnits.push(copy);
      logMsg(`${unit.name} cria uma cópia do Predador do Labirinto.`);
      resolvingPredator = false;
    }

    // CM-9 em alerta: cada dano recebido dispara a rajada atual e aumenta 1.
    if (dealt > 0 && unit.cardId === 'cm9' && hasStatus(unit, 'cm9Alert') && !resolvingAlert) {
      resolvingAlert = true;
      const alert = unit.statuses.find(s => s.status === 'cm9Alert');
      const dmg = Number(alert.value) || 2;
      for (const enemy of enemiesOf(unit)) originalApplyDamage(enemy, dmg, log, unit);
      alert.value = dmg + 1;
      resolvingAlert = false;
    }
    return dealt;
  };

  function purify(unit, log) {
    if (!unit) return [];
    const removed = (unit.statuses || []).map(s => ({ ...s }));
    unit.statuses = [];
    if (removed.length) log(`${unit.name} é purificado.`);
    return removed;
  }

  function runMoreEffect(eff, ctx, log) {
    const caster = ctx.caster;
    if (eff.type === 'armBenicioEmergency') { addStatus(caster, 'benicioEmergency', 1, 1); return true; }
    if (eff.type === 'armCM9Strike') { addStatus(caster, 'cm9Strike', 1, 1); return true; }
    if (eff.type === 'armCM9Alert') { addStatus(caster, 'cm9Alert', 2, 1); return true; }
    if (eff.type === 'cm9Shield') {
      const lost = Math.max(0, (caster.lifeAtTurnStart ?? caster.life) - caster.life);
      caster.shield = lost > 0 ? { value: lost, duration: 1 } : null;
      log(`${caster.name} ganha ${lost} de Escudo com base na vida perdida desde o último turno.`);
      return true;
    }
    if (eff.type === 'applyDecay') {
      for (const t of Engine.resolveTargets(eff.target, ctx)) { addStatus(t, 'decaimento', eff.value, -1); log(`${t.name} recebe Decaimento ${eff.value}.`); }
      return true;
    }
    if (eff.type === 'zethShieldDecay') {
      caster.shield = { value: 18, duration: 1 }; addStatus(caster, 'zethShieldDecay', 1, 1); log(`${caster.name} ganha um Escudo de 18.`); return true;
    }
    if (eff.type === 'purify') { for (const t of Engine.resolveTargets(eff.target, ctx)) purify(t, log); return true; }
    if (eff.type === 'purifyTransfer') {
      const targets = Engine.resolveTargets(eff.target, ctx), ally = targets[0];
      const removed = purify(ally, log); const enemy = enemiesOf(caster)[0];
      if (enemy && removed.length) { for (const s of removed) enemy.statuses.push(s); log(`${enemy.name} recebe os efeitos purificados.`); }
      return true;
    }
    if (eff.type === 'rahdanDrainEnemies') {
      const foes = enemiesOf(caster); if (!foes.length) return true;
      for (let i = 0; i < foes.length; i++) {
        const amount = i === 0 ? 4 : 2;
        hurtDirect(foes[i], amount); foes[i].statuses ||= []; addStatus(foes[i], 'enemyDamageReduction', 2, 1);
      }
      return true;
    }
    if (eff.type === 'zengrathMaxLifeDamage') {
      const target = ctx.chosenTarget; if (target) { const amount = Math.ceil(caster.maxLife * 0.10); originalApplyDamage(target, amount, log, caster); ctx.lastTarget = target; } return true;
    }
    if (eff.type === 'zengrathMassAttack') {
      const foes = enemiesOf(caster); for (const foe of foes) originalApplyDamage(foe, 2, log, caster); caster.maxLife += foes.length * 2; caster.life += foes.length * 2; log(`${caster.name} ganha +${foes.length * 2} de vida máxima.`); return true;
    }
    if (eff.type === 'predadorAttack') {
      const amount = totalPredadores() >= 15 ? 2 : 1; const target = ctx.chosenTarget || firstEnemy(caster); if (target) originalApplyDamage(target, amount, log, caster); return true;
    }
    if (eff.type === 'predadorShield') {
      const amount = totalPredadores() >= 15 ? 2 : 1; for (const ally of alliesOf(caster)) addShield(ally, amount, 1); return true;
    }
    if (eff.type === 'arborzillaAttack') {
      const bonus = Number(caster.arborzillaBonus || 0); const target = ctx.chosenTarget || firstEnemy(caster); if (!target) return true;
      const before = target.life + (target.shield?.value || 0); originalApplyDamage(target, 5 + bonus, log, caster); const after = target.life + (target.shield?.value || 0);
      const created = enemiesOf(caster).find(e => e.uid !== target.uid && (e.isToken || state.players[e.owner].extraUnits.includes(e)));
      if (created) originalApplyDamage(created, 5 + bonus, log, caster);
      if (before > 0 && target.dead) { caster.arborzillaBonus = bonus + 1; log(`${caster.name} melhora permanentemente sua Habilidade em +1.`); }
      addShield(caster, 5, 1); return true;
    }
    if (eff.type === 'porteiroMark') { const t = ctx.chosenTarget; if (t) addStatus(t, 'porteiroMarked', caster.uid, 1); return true; }
    if (eff.type === 'porteiroTauntAlly') {
      const t = ctx.chosenTarget; if (!t) return true;
      addStatus(t, 'tauntedBy', caster.uid, 1); addStatus(caster, 'porteiroHealDamage', 1, 1); return true;
    }
    if (eff.type === 'varghulStrikeCopy') {
      const copy = window.makeUnit('varghul', caster.owner); copy.isToken = true; copy.justSpawned = true; ownerOf(caster).extraUnits.push(copy);
      const target = ctx.chosenTarget || firstEnemy(caster); if (target) originalApplyDamage(target, 6, log, copy); copy.life = 0; copy.dead = true; log(`${copy.name} cumpre o ataque e morre.`); return true;
    }
    if (eff.type === 'varghulTauntCopy') {
      const copy = window.makeUnit('varghul', caster.owner); copy.isToken = true; copy.justSpawned = true; ownerOf(caster).extraUnits.push(copy);
      const target = ctx.chosenTarget || firstEnemy(caster); if (target) { addStatus(target, 'tauntedBy', copy.uid, 1); addStatus(copy, 'varghulDieAfterEnemy', target.uid, 1); } return true;
    }
    if (eff.type === 'boiScalingAttack') {
      const turns = Math.max(1, Number(caster.turnsOnField || 1)); const x = turns * 2; addShield(caster, x, 1); const target = ctx.chosenTarget || firstEnemy(caster); if (target) originalApplyDamage(target, x, log, caster); return true;
    }
    if (eff.type === 'boiUseAbsorbed') {
      if (!caster.boiAbsorbed) { log(`${caster.name} ainda não absorveu uma Habilidade.`); return true; }
      const copied = JSON.parse(JSON.stringify(caster.boiAbsorbed)); previousRunEffects(copied.effects || [], ctx, log); caster.cooldowns[0] = (Number(copied.cooldown) || 0) + 1; return true;
    }
    return false;
  }

  // Dano de ataques, Fúria, etc. recebe os bônus passivos dos Defensores novos.
  const wrappedRunEffects = function(effects, ctx, log) {
    const caster = ctx.caster;
    const rewritten = [];
    for (const original of effects || []) {
      if (original.type === 'taunt') {
        const targets = Engine.resolveTargets(original.target, ctx);
        for (const t of targets) {
          if (hasStatus(t, 'benicioUntaggable')) { log(`${t.name} não pode ser Provocado neste momento.`); continue; }
          addStatus(t, 'tauntedBy', caster.uid, 1); log(`${caster.name} Provoca ${t.name}.`);
        }
        continue;
      }
      if (original.type === 'dealDamage') {
        const eff = { ...original };
        let bonus = 0;
        if (caster.statuses?.some(s => s.status === 'benicioNextAttack')) { bonus += Number(caster.statuses.find(s => s.status === 'benicioNextAttack').value) || 0; removeStatus(caster, 'benicioNextAttack'); }
        if (caster.cardId === 'arborzilla') bonus += Number(caster.arborzillaBonus || 0);
        if (enemiesOf(caster).some(e => hasStatus(e, 'tauntedBy') && e.statuses.find(s => s.status === 'tauntedBy')?.value === caster.uid) && eff.target === 'chooseEnemy') {
          const forced = enemiesOf(caster).find(e => hasStatus(e, 'tauntedBy') && e.statuses.find(s => s.status === 'tauntedBy')?.value === caster.uid);
          if (forced) { ctx.chosenTarget = forced; eff.target = 'chooseEnemy'; }
        }
        // Rahdan rouba 2 de vida do atacante e adiciona +4 por alvo inimigo.
        const foes = eff.target === 'self' ? [] : (eff.target ? Engine.resolveTargets(eff.target, ctx) : []);
        const enemyTargets = foes.filter(t => t && t.owner !== caster.owner);
        const rahdans = alliesOf(caster).filter(u => u.cardId === 'rahdan' && u.uid !== caster.uid);
        if (enemyTargets.length && rahdans.length) {
          for (const rahdan of rahdans) { hurtDirect(caster, 2); healDirect(rahdan, 2, log); }
          bonus += 4 * rahdans.length;
        }
        eff.base = (Number(eff.base) || 0) + bonus;
        rewritten.push(eff);
        continue;
      }
      rewritten.push(original);
    }
    // Executa a parte genérica através dos hooks anteriores.
    previousRunEffects(rewritten, ctx, log);
    for (const eff of rewritten) {
      if (runMoreEffect(eff, ctx, log)) continue;
    }
  };

  // Para efeitos customizados, runMoreEffect precisa acontecer antes do wrapper anterior.
  Engine.runEffects = function(effects, ctx, log) {
    const remaining = [];
    for (const eff of effects || []) {
      if (runMoreEffect(eff, ctx, log)) continue;
      remaining.push(eff);
    }
    if (remaining.length) wrappedRunEffects(remaining, ctx, log);
  };

  // Zengrath recebe o bônus ao ser jogado; Benício protege criações; Varghul reage a mortes.
  const originalTriggerPlayed = window.triggerUnitPlayed;
  if (typeof originalTriggerPlayed === 'function' && !window.__hvMorePlayedHook) {
    window.__hvMorePlayedHook = true;
    window.triggerUnitPlayed = function(unit) {
      const result = originalTriggerPlayed(unit);
      if (unit?.cardId === 'zengrath' && alive(unit)) {
        const deaths = Number(state.totalDeaths || 0); unit.maxLife += deaths * 2; unit.life += deaths * 2; logMsg(`${unit.name} ganha +${deaths * 2} de vida máxima pelas mortes acumuladas.`);
      }
      return result;
    };
  }

  const originalCheckDeaths = window.checkDeaths;
  let resolvingDeathPassive = false;
  if (typeof originalCheckDeaths === 'function' && !window.__hvMoreDeathHook) {
    window.__hvMoreDeathHook = true;
    window.checkDeaths = function() {
      const dying = allUnitsAll().filter(u => !u.dead && u.life <= 0);
      const result = originalCheckDeaths();
      if (!state) return result;
      state.totalDeaths ||= 0;
      for (const d of dying) {
        state.totalDeaths++;
        if (!resolvingDeathPassive) {
          const vars = state.players[d.owner].slots.defensor?.active;
          for (const v of allUnitsOf(d.owner).filter(u => alive(u) && u.cardId === 'varghul')) {
            const target = firstEnemy(v); if (!target) continue;
            resolvingDeathPassive = true; originalApplyDamage(target, 6, logMsg, v); resolvingDeathPassive = false;
          }
        }
      }
      return result;
    };
  }

  // Começo/fim de turno das mecânicas novas.
  let lastTurn = null;
  const turnTimer = setInterval(() => {
    if (!state) return;
    if (lastTurn === null) { lastTurn = state.turn; for (const u of allKnown()) u.lifeAtTurnStart = u.life; return; }
    if (state.turn === lastTurn) return;
    lastTurn = state.turn;
    for (const u of allKnown()) {
      u.lifeAtTurnStart = u.life;
      u.actedThisTurn = false;
      u.attackedThisTurn = false;
      u.turnsOnField = (u.turnsOnField || 0) + 1;
      if (u.statuses) {
        const decay = u.statuses.find(s => s.status === 'decaimento');
        if (decay && alive(u)) {
          const amount = Number(decay.value) || 0;
          if (amount > 0) { originalApplyDamage(u, amount, logMsg, null); decay.value = amount - 1; }
          if (decay.value <= 0) removeStatus(u, 'decaimento');
        }
      }
      // Decaimento 4 => 4,3,2,1 em turnos sucessivos.
      if (u.statuses) u.statuses = u.statuses.filter(s => s.status !== 'benicioEmergency' && s.status !== 'cm9Strike' && s.status !== 'cm9Alert');
    }
  }, 100);

  const originalFinishResolution = window.finishResolutionPhase;
  if (typeof originalFinishResolution === 'function' && !window.__hvMoreFinishHook) {
    window.__hvMoreFinishHook = true;
    window.finishResolutionPhase = function() {
      // O Porteiro: se o alvo marcado não o atacou neste turno, recebe o segundo golpe.
      for (const porteiro of allUnitsAll().filter(u => alive(u) && u.cardId === 'porteiro')) {
        for (const target of allUnitsOf(1 - porteiro.owner).filter(u => alive(u) && hasStatus(u, 'porteiroMarked') && u.statuses.find(s => s.status === 'porteiroMarked')?.value === porteiro.uid)) {
          if (!target.attackedThisTurn) originalApplyDamage(target, 8, logMsg, porteiro);
        }
      }
      // Zeth: se o Escudo de 18 ainda existe no fim do turno, aplica Decaimento 3 em todos.
      for (const zeth of allUnitsAll().filter(u => alive(u) && u.cardId === 'zeth' && hasStatus(u, 'zethShieldDecay'))) {
        if (zeth.shield && zeth.shield.value > 0) for (const enemy of enemiesOf(zeth)) addStatus(enemy, 'decaimento', 3, -1);
      }
      return originalFinishResolution();
    };
  }

  // Taunt impede a habilidade de escolher outro inimigo quando o alvo provocado pertence ao atacante.
  const originalPlayerChooseAbility = window.playerChooseAbility;
  if (typeof originalPlayerChooseAbility === 'function' && !window.__hvMoreBoiTargetHook) {
    window.__hvMoreBoiTargetHook = true;
    window.playerChooseAbility = function(abilityIdx) {
      const unit = state?.pendingUnit ? getUnit(state.pendingUnit) : null;
      if (unit?.cardId === 'boi' && abilityIdx === 0 && unit.boiAbsorbed) {
        const old = CARD_DB.boi.abilities[0]; CARD_DB.boi.abilities[0] = unit.boiAbsorbed;
        try { return originalPlayerChooseAbility(0); } finally { CARD_DB.boi.abilities[0] = old; }
      }
      return originalPlayerChooseAbility(abilityIdx);
    };
  }

  // Boi: botão de revelar enquanto a carta está na reserva (a "mão" do deckbuilder de batalha).
  window.revealBoi = function(playerIdx) {
    if (!state || state.players[playerIdx].boiRevealed) return;
    const p = state.players[playerIdx];
    if (!ROLES.some(r => p.slots[r].bench.includes('boi'))) return;
    const enemy = state.players[1 - playerIdx];
    const choices = [];
    for (const role of ROLES) {
      const u = enemy.slots[role].active;
      if (!u || u.dead) continue;
      for (let i = 0; i < (CARD_DB[u.cardId]?.abilities?.length || 0); i++) choices.push({ unit: u, idx: i, ability: CARD_DB[u.cardId].abilities[i] });
    }
    const box = document.createElement('div'); box.id = 'hvBoiChoice'; box.innerHTML = `<div class="hv-def-choice-card"><div class="hv-def-choice-title">Boi — escolha a Habilidade inimiga para absorver</div>${choices.map((c,i)=>`<button data-i="${i}">${c.unit.name} · ${c.ability.text}</button>`).join('')}</div>`; document.body.appendChild(box);
    box.querySelectorAll('button').forEach((b,i)=>b.onclick=()=>{const c=choices[i];p.boiRevealed=true;p.boiAbsorbed=JSON.parse(JSON.stringify(c.ability));box.remove();logMsg(`${p.name} revelou Boi e absorveu uma Habilidade de ${c.unit.name}.`);render();});
  };

  // Injeta o botão de Boi após cada render sem mexer no renderer principal.
  const domObserver = new MutationObserver(() => {
    if (!state || state.phase !== 'declare') return;
    const p = state.players[state.declaring];
    if (!p || p.boiRevealed || !ROLES.some(r => p.slots[r].bench.includes('boi'))) return;
    if (document.getElementById('hvRevealBoiBtn')) return;
    const top = document.querySelector('.topbar'); if (!top) return;
    const btn = document.createElement('button'); btn.id='hvRevealBoiBtn'; btn.className='btn-secondary'; btn.textContent='🐸 Revelar Boi'; btn.onclick=()=>revealBoi(state.declaring); top.appendChild(btn);
  });
  domObserver.observe(document.body, { childList: true, subtree: true });

  // Status label para Decaimento.
  if (typeof window.statusLabel === 'function' && !window.__hvMoreStatusLabel) {
    const oldStatusLabel = window.statusLabel;
    window.__hvMoreStatusLabel = true;
    window.statusLabel = function(s) { if (s?.status === 'decaimento') return `Decaimento (${s.value})`; return oldStatusLabel(s); };
  }

  // Espera o app carregar as cartas e inicializa defaults por unidade.
  function boot() {
    if (!state || !Object.keys(CARD_DB).length) return setTimeout(boot, 100);
    for (const u of allKnown()) { u.turnsOnField ||= 0; u.lifeAtTurnStart ??= u.life; }
  }
  boot();
})();
