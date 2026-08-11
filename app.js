// ===================== ESTADO DO JOGO =====================

let CARD_DB = {};
let state = null;

const ROLES = ['defensor', 'atacante', 'suporte'];

function makeUnit(cardId, ownerIdx) {
  const def = CARD_DB[cardId];
  return {
    uid: crypto.randomUUID(),
    cardId,
    name: def.name,
    role: def.role,
    maxLife: def.life,
    life: def.life,
    dead: false,
    shield: null,
    statuses: [],
    counters: {},
    isToken: !!def.isToken,
    owner: ownerIdx,
    healedThisTurn: false,
    cooldowns: {},
  };
}

// slots[role] = { active: unit|null, bench: [cardId,...] } — bench = reservas ainda não jogadas
function buildDeck(pickByRole, ownerIdx) {
  const slots = {};
  for (const role of ROLES) {
    const ids = pickByRole[role]; // array de 2 cardIds
    const active = makeUnit(ids[0], ownerIdx);
    slots[role] = { active, bench: [ids[1]] };
  }
  return slots;
}

function initGame(p1Picks, p2Picks, vsBot) {
  state = {
    turn: 1,
    vsBot,
    players: [
      { name: 'Jogador 1', slots: buildDeck(p1Picks, 0), extraUnits: [], fieldEffects: {} },
      { name: vsBot ? 'Bot' : 'Jogador 2', slots: buildDeck(p2Picks, 1), extraUnits: [], fieldEffects: {} },
    ],
    log: [],
    phase: 'declare',
    declaring: 0,
    declarations: { 0: {}, 1: {} },
    pendingUnit: null,
    pendingQueue: [],
    resolutionQueue: [],
    resolutionIdx: 0,
    winner: null,
  };
  logMsg(`Partida iniciada! Fase de declaração — Turno ${state.turn}.`);
  startDeclarePhaseForPlayer(0);
}

function logMsg(msg) {
  state.log.unshift(msg);
  if (state.log.length > 80) state.log.pop();
}

function allUnitsOf(playerIdx) {
  const p = state.players[playerIdx];
  const list = [];
  for (const role of ROLES) if (p.slots[role].active) list.push(p.slots[role].active);
  list.push(...p.extraUnits.filter(u => !u.dead));
  return list;
}

function allUnitsAll() {
  return [...allUnitsOf(0), ...allUnitsOf(1)];
}

function getUnit(uid) {
  return allUnitsAll().find(u => u.uid === uid) || null;
}

function ownerOf(unit) { return state.players[unit.owner]; }
function enemyPlayerOf(unit) { return state.players[1 - unit.owner]; }
function enemyTeamOf(unit) { return allUnitsOf(1 - unit.owner); }
function allyTeamOf(unit) { return allUnitsOf(unit.owner); }

function availableAbilities(unit) {
  const def = CARD_DB[unit.cardId];
  return def.abilities
    .map((ab, idx) => ({ ab, idx }))
    .filter(({ idx }) => !(unit.cooldowns[idx] > 0));
}

// ===================== FASE DE DECLARAÇÃO =====================

function startDeclarePhaseForPlayer(playerIdx) {
  state.phase = 'declare';
  state.declaring = playerIdx;
  state.declarations[playerIdx] = {};
  const units = allUnitsOf(playerIdx).filter(u => !u.dead);
  state.pendingQueue = units.map(u => u.uid);
  state.pendingUnit = null;
  advanceDeclareQueue();
}

function advanceDeclareQueue() {
  if (state.pendingQueue.length === 0) {
    finishDeclareForPlayer(state.declaring);
    return;
  }
  const uid = state.pendingQueue[0];
  const unit = getUnit(uid);
  if (!unit || unit.dead) {
    state.pendingQueue.shift();
    advanceDeclareQueue();
    return;
  }
  const avail = availableAbilities(unit);
  if (avail.length === 0) {
    logMsg(`${unit.name} está com tudo em recarga e passa a vez.`);
    state.declarations[state.declaring][uid] = null;
    state.pendingQueue.shift();
    advanceDeclareQueue();
    return;
  }
  state.pendingUnit = uid;
  render();
}

function playerChooseAbility(abilityIdx) {
  const uid = state.pendingUnit;
  const unit = getUnit(uid);
  const def = CARD_DB[unit.cardId];
  const ability = def.abilities[abilityIdx];
  const needsTarget = ability.effects.some(e =>
    ['chooseAlly', 'chooseEnemy', 'chooseAllyNotMovedYet'].includes(e.target)
  );
  if (needsTarget) {
    state.choosingTargetFor = { uid, abilityIdx };
    renderTargetOverlay();
  } else {
    commitDeclaration(uid, abilityIdx, null);
  }
}

function playerChooseTarget(targetUid) {
  const { uid, abilityIdx } = state.choosingTargetFor;
  state.choosingTargetFor = null;
  closeTargetOverlay();
  commitDeclaration(uid, abilityIdx, targetUid);
}

function cancelTargeting() {
  state.choosingTargetFor = null;
  closeTargetOverlay();
  render();
}

function closeTargetOverlay() {
  const el = document.getElementById('hvTargetOverlay');
  if (el) el.remove();
}

function renderTargetOverlay() {
  closeTargetOverlay();
  const { uid, abilityIdx } = state.choosingTargetFor;
  const caster = getUnit(uid);
  const def = CARD_DB[caster.cardId];
  const ability = def.abilities[abilityIdx];
  const wantsEnemy = ability.effects.some(e => e.target === 'chooseEnemy');
  const wantsAlly = ability.effects.some(e => e.target === 'chooseAlly' || e.target === 'chooseAllyNotMovedYet');
  const wantsUnmoved = ability.effects.some(e => e.target === 'chooseAllyNotMovedYet');

  let pool = wantsEnemy ? enemyTeamOf(caster) : allyTeamOf(caster);
  pool = pool.filter(u => !u.dead);
  if (wantsUnmoved) {
    const decl = state.declarations[state.declaring] || {};
    pool = pool.filter(u => decl[u.uid] === undefined);
  }

  const overlay = document.createElement('div');
  overlay.className = 'hv-target-overlay';
  overlay.id = 'hvTargetOverlay';
  overlay.innerHTML = `
    <div class="hv-target-header">
      <div class="hv-target-title">${caster.name} — escolha o alvo</div>
      <div class="hv-target-sub">${ability.text}</div>
    </div>
    <div class="hv-target-grid">
      ${pool.map(u => `
        <div class="hv-target-option ${wantsAlly ? 'hv-ally-target' : ''}" data-uid="${u.uid}" tabindex="0" role="button">
          <div class="hv-target-role">${ROLE_ICON[u.role] || ''}</div>
          <div class="hv-target-name">${u.name}</div>
          <div class="hv-target-life">❤️ ${Math.max(0,u.life)} / ${u.maxLife}${u.shield ? ` 🛡️${u.shield.value}` : ''}</div>
          <div class="hv-target-lifebar"><div class="hv-target-lifebar-fill" style="width:${Math.max(0,(u.life/u.maxLife)*100)}%"></div></div>
        </div>
      `).join('')}
    </div>
    <button class="btn-secondary hv-target-cancel" id="hvTargetCancelBtn">Cancelar</button>
  `;
  document.body.appendChild(overlay);

  overlay.querySelectorAll('.hv-target-option').forEach((el, i) => {
    el.style.animationDelay = (i * 0.05) + 's';
    el.onclick = () => playerChooseTarget(el.dataset.uid);
    el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') playerChooseTarget(el.dataset.uid); };
  });
  document.getElementById('hvTargetCancelBtn').onclick = cancelTargeting;
}

function commitDeclaration(uid, abilityIdx, targetUid) {
  state.declarations[state.declaring][uid] = { abilityIdx, targetUid };
  state.pendingQueue.shift();
  state.pendingUnit = null;
  advanceDeclareQueue();
}

function finishDeclareForPlayer(playerIdx) {
  if (playerIdx === 0 && !state.vsBot) {
    showPassDeviceScreen(1);
    return;
  }
  if (playerIdx === 0 && state.vsBot) {
    declareBot(1);
    beginResolution();
    return;
  }
  beginResolution();
}

function showPassDeviceScreen(nextPlayerIdx) {
  state.phase = 'pass-device';
  state.nextDeclarer = nextPlayerIdx;
  render();
}

function confirmPassDevice() {
  startDeclarePhaseForPlayer(state.nextDeclarer);
}

// ===================== BOT SIMPLES =====================

function declareBot(playerIdx) {
  state.declarations[playerIdx] = {};
  const units = allUnitsOf(playerIdx).filter(u => !u.dead);
  for (const unit of units) {
    const avail = availableAbilities(unit);
    if (avail.length === 0) {
      state.declarations[playerIdx][unit.uid] = null;
      continue;
    }
    const { ab, idx } = avail[Math.floor(Math.random() * avail.length)];
    const needsTarget = ab.effects.some(e => ['chooseAlly', 'chooseEnemy', 'chooseAllyNotMovedYet'].includes(e.target));
    let targetUid = null;
    if (needsTarget) {
      const isEnemyTarget = ab.effects.some(e => e.target === 'chooseEnemy');
      const pool = isEnemyTarget
        ? enemyTeamOf(unit).filter(u => !u.dead)
        : allyTeamOf(unit).filter(u => !u.dead);
      if (pool.length) {
        pool.sort((a, b) => a.life - b.life);
        targetUid = pool[0].uid;
      }
    }
    state.declarations[playerIdx][unit.uid] = { abilityIdx: idx, targetUid };
  }
  logMsg(`${state.players[playerIdx].name} declarou suas ações.`);
}

// ===================== FASE DE RESOLUÇÃO =====================

function beginResolution() {
  state.phase = 'resolve';
  const queue = [];
  for (let p = 0; p < 2; p++) {
    for (const [uid, decl] of Object.entries(state.declarations[p])) {
      if (!decl) continue;
      const unit = getUnit(uid);
      if (!unit || unit.dead) continue;
      const def = CARD_DB[unit.cardId];
      const ability = def.abilities[decl.abilityIdx];
      queue.push({ uid, abilityIdx: decl.abilityIdx, targetUid: decl.targetUid, speed: ability.speed, life: unit.life });
    }
  }
  queue.sort((a, b) => (a.speed - b.speed) || (a.life - b.life));
  state.resolutionQueue = queue;
  state.resolutionIdx = 0;
  logMsg(`— Resolvendo turno ${state.turn} —`);
  beginAutoResolution();
}

const HV_STEP_DELAY = 1550; // ms entre ações na fila de resolução automática

function snapshotUnits() {
  const map = {};
  for (const u of allUnitsAll()) {
    map[u.uid] = { life: u.life, shieldValue: u.shield ? u.shield.value : 0, dead: u.dead };
  }
  return map;
}

function autoResolveStep() {
  if (!state || state.phase !== 'resolve') return;
  if (state.resolutionIdx >= state.resolutionQueue.length) {
    setTimeout(() => { if (state && state.phase === 'resolve') finishResolutionPhase(); }, 500);
    return;
  }
  const item = state.resolutionQueue[state.resolutionIdx];
  state.resolutionIdx++;
  const caster = getUnit(item.uid);
  if (!caster || caster.dead) {
    render();
    setTimeout(autoResolveStep, 250);
    return;
  }

  const before = snapshotUnits();
  const target = item.targetUid ? getUnit(item.targetUid) : null;

  state.hvActiveCast = { casterUid: caster.uid, text: CARD_DB[caster.cardId].abilities[item.abilityIdx].text, casterName: caster.name };
  render();

  const preexistingDead = new Set(allUnitsAll().filter(u => u.dead).map(u => u.uid));

  setTimeout(() => {
    executeAbility(caster, item.abilityIdx, item.targetUid);
    checkDeaths();
    checkWinner();
    const after = snapshotUnits();
    state.hvDiff = { before, after, casterUid: caster.uid, newlyDead: allUnitsAll().filter(u => u.dead && !preexistingDead.has(u.uid)).map(u => u.uid) };
    render();

    setTimeout(() => {
      state.hvActiveCast = null;
      state.hvDiff = null;
      if (state.winner !== null) {
        finishResolutionPhase();
        return;
      }
      render();
      setTimeout(autoResolveStep, 220);
    }, HV_STEP_DELAY - 500);
  }, 550);
}

function beginAutoResolution() {
  state.hvActiveCast = null;
  state.hvDiff = null;
  render();
  setTimeout(autoResolveStep, 500);
}

function executeAbility(caster, abilityIdx, targetUid) {
  const def = CARD_DB[caster.cardId];
  const ability = def.abilities[abilityIdx];
  const chosenTarget = targetUid ? getUnit(targetUid) : null;

  const allyTeam = allyTeamOf(caster);
  const enemyTeam = enemyTeamOf(caster);

  const ctx = {
    caster,
    chosenTarget,
    allyTeam,
    enemyTeam,
    enemyField: enemyTeam,
    enemyHand: [],
    lastTarget: chosenTarget,
    onCreateToken: (tokenId) => {
      const tok = makeUnit(tokenId, caster.owner);
      tok.justSpawned = true;
      ownerOf(caster).extraUnits.push(tok);
      logMsg(`${ownerOf(caster).name} cria uma ${CARD_DB[tokenId].name}.`);
    },
    onSacrificeToken: (tokenId, log) => {
      const list = ownerOf(caster).extraUnits;
      const idx = list.findIndex(u => u.cardId === tokenId && !u.dead);
      if (idx >= 0) {
        list[idx].dead = true;
        list[idx].life = 0;
        log(`${list[idx].name} é destruída como custo da habilidade.`);
      } else {
        log(`Nenhuma Máquina de Guerra disponível para sacrificar!`);
      }
    },
    onFieldEffect: (effect, duration, log) => {
      ownerOf(caster).fieldEffects[effect] = duration;
      log(`Efeito de campo "${effect}" ativado por ${duration} turno(s).`);
    },
    onDelayedEffect: (eff, log) => {
      log(`Efeito atrasado agendado (resolver em ${eff.delay} turno(s) — acompanhe o log).`);
    },
    onReviveCopy: (cardId, life, log) => {
      const list = ownerOf(caster).extraUnits;
      const dead = list.find(u => u.cardId === cardId && u.dead);
      if (dead) {
        dead.dead = false;
        dead.life = life;
        log(`${dead.name} retorna à vida com ${life} de vida!`);
      } else {
        log(`Nenhuma cópia morta de ${CARD_DB[cardId].name} para reviver.`);
      }
    },
  };

  logMsg(`⚡ ${caster.name} (vel. ${ability.speed}): ${ability.text}`);
  Engine.runEffects(ability.effects, ctx, logMsg);

  if (ability.cooldown && ability.cooldown > 0) {
    caster.cooldowns[abilityIdx] = ability.cooldown + 1;
  }
}

function checkDeaths() {
  for (const p of state.players) {
    for (const role of ROLES) {
      const slot = p.slots[role];
      if (slot.active && slot.active.life <= 0 && !slot.active.replaced) {
        slot.active.dead = true;
        slot.active.replaced = true; // marca que este cadáver já foi processado (não substitui de novo)
        logMsg(`${slot.active.name} foi derrotado!`);
        if (slot.bench.length > 0) {
          const nextId = slot.bench.shift();
          slot.active = makeUnit(nextId, state.players.indexOf(p));
          slot.active.justSpawned = true;
          logMsg(`${p.name} coloca ${slot.active.name} em campo!`);
        } else {
          slot.active = null;
          logMsg(`${p.name} não tem mais reservas para ${roleLabel(role)} — slot vazio.`);
        }
      }
    }
    for (const u of p.extraUnits) {
      if (!u.dead && u.life <= 0) {
        u.dead = true;
        logMsg(`${u.name} foi destruída!`);
      }
    }
  }
}

function checkWinner() {
  for (let i = 0; i < 2; i++) {
    const p = state.players[i];
    const allEmpty = ROLES.every(role => !p.slots[role].active);
    if (allEmpty) {
      state.winner = 1 - i;
      logMsg(`🏆 ${state.players[state.winner].name} venceu a partida!`);
    }
  }
}

function finishResolutionPhase() {
  for (const p of state.players) {
    for (const [effect, duration] of Object.entries(p.fieldEffects)) {
      const idx = state.players.indexOf(p);
      if (effect === 'chuva') {
        for (const u of allUnitsOf(idx).filter(u => !u.dead)) Engine.applyHeal(u, 10, logMsg);
      }
      if (effect === 'tempestade_de_areia') {
        for (const u of allUnitsOf(1 - idx).filter(u => !u.dead)) Engine.applyDamage(u, 10, logMsg);
      }
      p.fieldEffects[effect] = duration - 1;
      if (p.fieldEffects[effect] <= 0) delete p.fieldEffects[effect];
    }
  }

  for (const u of allUnitsAll()) {
    if (u.dead) continue;
    const bleed = u.statuses.find(s => s.status === 'sangramento');
    if (bleed) Engine.applyDamage(u, bleed.value, logMsg);
    u.healedThisTurn = false;
    u.statuses = u.statuses.filter(s => {
      if (s.duration === -1) return true;
      s.duration -= 1;
      return s.duration > 0;
    });
    if (u.shield) {
      u.shield.duration -= 1;
      if (u.shield.duration <= 0) {
        logMsg(`O Escudo de ${u.name} expira.`);
        u.shield = null;
      }
    }
    for (const k of Object.keys(u.cooldowns)) {
      if (u.cooldowns[k] > 0) u.cooldowns[k] -= 1;
    }
  }

  checkDeaths();
  checkWinner();

  if (state.winner !== null) {
    state.phase = 'gameover';
    render();
    return;
  }

  state.turn += 1;
  logMsg(`— Fim do turno. Iniciando Turno ${state.turn} —`);
  showTurnFlash(`TURNO ${state.turn}`, () => startDeclarePhaseForPlayer(0));
}

function showTurnFlash(text, onDone) {
  const flash = document.createElement('div');
  flash.className = 'hv-turn-flash';
  flash.innerHTML = `<div class="hv-turn-flash-text">${text}</div>`;
  document.body.appendChild(flash);
  setTimeout(() => { flash.remove(); onDone(); }, 1150);
}

// ===================== RENDER =====================

function roleLabel(role) {
  return { defensor: 'Defensor', atacante: 'Atacante', suporte: 'Suporte', token: 'Construto' }[role] || role;
}

function statusLabel(s) {
  const labels = {
    damageCap: `Limite de Dano (${s.value})`,
    sangramento: `Sangrando (${s.value}/turno)`,
    silenced: `Silenciado`,
    nextSingleTargetDamageBoost: `+${s.value} próx. dano único`,
    damageBoost: `+${s.value} dano`,
  };
  return labels[s.status] || s.status;
}

const ROLE_ICON = { defensor: '🛡️', atacante: '⚔️', suporte: '✨', token: '⚙️' };

function unitCardHTML(u, opts = {}) {
  const { selectable, showAbilities, abilitiesLocked } = opts;
  const def = CARD_DB[u.cardId] || {};

  const deadClass = u.dead ? 'unit-dead' : '';
  const selClass = selectable ? 'unit-selectable' : '';
  const spawnClass = u.justSpawned ? 'hv-spawned' : '';

  if (u.justSpawned) u.justSpawned = false;

  const pct = Math.max(
    0,
    Math.min(100, (u.life / u.maxLife) * 100)
  );

  // Current shield
  const shieldValue = u.shield
    ? Math.max(0, Number(u.shield.value) || 0)
    : 0;

  const shieldDuration = u.shield
    ? Math.max(0, Number(u.shield.duration) || 0)
    : 0;

  // Passive ability from cards.json
  const passiveText =
    typeof def.passive === 'string'
      ? def.passive.trim()
      : '';

  return `
    <div
      class="unit-card ${deadClass} ${selClass} ${spawnClass}"
      data-uid="${u.uid}"
      onclick="handleUnitClick('${u.uid}')"
    >

      <div
        class="hv-float-layer"
        data-float-for="${u.uid}"
      ></div>

      <div class="unit-header-line">

        <span
          class="unit-heart"
          title="Vida"
        >
          ❤️
          <span class="unit-heart-value">
            ${Math.max(0, u.life)}
          </span>
        </span>

        <span
          class="unit-role-icon role-${u.role}"
          title="${roleLabel(u.role)}"
        >
          ${ROLE_ICON[u.role] || ''}
        </span>

        <span class="unit-name">
          ${u.name}
        </span>

      </div>

      <div class="unit-lifebar">
        <div
          class="unit-lifebar-fill"
          style="width:${pct}%"
        ></div>
      </div>

      <div class="unit-maxlife-sub">
        ${Math.max(0, u.life)} / ${u.maxLife}
      </div>

      ${
        shieldValue > 0
          ? `
            <div
              class="unit-shield-panel"
              title="Escudo atual"
            >
              <span class="unit-shield-icon">
                🛡️
              </span>

              <span class="unit-shield-label">
                ESCUDO
              </span>

              <strong class="unit-shield-value">
                ${shieldValue}
              </strong>

              ${
                shieldDuration > 0
                  ? `
                    <span class="unit-shield-duration">
                      ${shieldDuration}
                      turno${shieldDuration === 1 ? '' : 's'}
                    </span>
                  `
                  : ''
              }
            </div>
          `
          : ''
      }

      ${
        passiveText
          ? `
            <div class="unit-passive-panel">

              <div class="unit-passive-title">
                ✦ PASSIVA
              </div>

              <div class="unit-passive-text">
                ${passiveText}
              </div>

            </div>
          `
          : ''
      }

      ${
        u.statuses.length
          ? `
            <div class="unit-statuses">
              ${u.statuses
                .map(
                  s =>
                    `<span class="status-chip">
                      ${statusLabel(s)}
                    </span>`
                )
                .join('')}
            </div>
          `
          : ''
      }

      ${
        Object.keys(u.counters).length
          ? `
            <div class="unit-counters">
              ${Object.entries(u.counters)
                .map(
                  ([k, v]) =>
                    `<span class="counter-chip">
                      ${k}: ${v}
                    </span>`
                )
                .join('')}
            </div>
          `
          : ''
      }

      ${
        u.dead
          ? '<div class="unit-fallen">💀 Derrotado</div>'
          : (
              showAbilities
                ? abilitiesHTML(u, {
                    locked: abilitiesLocked
                  })
                : ''
            )
      }

    </div>
  `;
}

function abilitiesHTML(u, opts = {}) {
  const def = CARD_DB[u.cardId];
  const isPending = state.pendingUnit === u.uid;
  const locked = !!opts.locked;
  return `<div class="unit-abilities">
    ${def.abilities.map((ab, i) => {
      const onCd = u.cooldowns[i] > 0;
      const disabled = locked || !isPending || onCd;
      return `<button class="ability-btn ${locked ? 'ability-btn-locked' : ''}" ${disabled ? 'disabled' : ''} onclick="event.stopPropagation(); ${locked ? '' : `playerChooseAbility(${i})`}">
        <span class="ability-cost">${ab.speed}</span>
        <span class="ability-text">${ab.text}</span>
        ${onCd ? `<span class="ability-cd">⏳${u.cooldowns[i]}</span>` : (ab.cooldown ? `<span class="ability-cd-max">⏳${ab.cooldown}</span>` : '')}
      </button>`;
    }).join('')}
  </div>`;
}

function handleUnitClick(uid) {
  // Alvos agora são escolhidos pelo overlay dedicado (renderTargetOverlay).
}

function render() {
  const app = document.getElementById('app');
  if (!state) return;
  if (state.phase === 'pass-device') { renderPassDevice(); return; }
  if (state.phase === 'declare') { renderDeclarePhase(); return; }
  if (state.phase === 'resolve') { renderResolvePhase(); return; }
  if (state.phase === 'gameover') { renderGameOver(); return; }
}

function renderPassDevice() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="pass-screen">
      <h1 class="game-title">Passe o dispositivo</h1>
      <p class="setup-sub">É a vez de <strong>${state.players[state.nextDeclarer].name}</strong> declarar suas ações em segredo.</p>
      <button class="btn-primary" onclick="confirmPassDevice()">Estou pronto — mostrar minhas cartas</button>
    </div>
  `;
}

function renderDeclarePhase() {
  const app = document.getElementById('app');
  const playerIdx = state.declaring;
  const p = state.players[playerIdx];
  const targeting = !!state.choosingTargetFor;

  function rowFor(u) {
    const declared = state.declarations[playerIdx][u.uid];
    const targetInfo = declared && declared.targetUid ? ` → alvo: ${getUnit(declared.targetUid)?.name || '?'}` : '';
    const declaredLabel = declared !== undefined
      ? (declared ? `<span class="declared-tag">✔ Declarado${targetInfo}</span>` : `<span class="declared-tag pass">passou (cooldown)</span>`)
      : '';
    const selectableForTargeting = targeting && isValidTargetForCurrentSelection(u);
    return `<div class="declare-row">${declaredLabel}${unitCardHTML(u, { showAbilities: true, selectable: selectableForTargeting })}</div>`;
  }

  const rows = ROLES.map(role => {
    const slot = p.slots[role];
    if (!slot.active) return `<div class="slot-empty">${roleLabel(role)}: slot vazio</div>`;
    return rowFor(slot.active);
  }).join('');

  const extraRows = p.extraUnits.filter(u => !u.dead).map(rowFor).join('');

  // Time inimigo — visível sempre, e clicável como alvo quando estamos escolhendo um alvo de dano
  const enemyIdx = 1 - playerIdx;
  const enemy = state.players[enemyIdx];
  const enemyUnitHTML = (u) => {
    const selectableForTargeting = targeting && isValidTargetForCurrentSelection(u);
    return unitCardHTML(u, { showAbilities: true, abilitiesLocked: true, selectable: selectableForTargeting });
  };
  const enemyRows = ROLES.map(role => {
    const slot = enemy.slots[role];
    if (!slot.active) return `<div class="slot-empty">${roleLabel(role)}: slot vazio</div>`;
    return enemyUnitHTML(slot.active);
  }).join('');
  const enemyExtraRows = enemy.extraUnits.filter(u => !u.dead).map(enemyUnitHTML).join('');

  app.innerHTML = `
    <div class="topbar">
      <div class="turn-indicator">Turno ${state.turn} — <strong>${p.name}</strong> declarando ações ${targeting ? '<span class="selecting-hint">— escolha um alvo</span>' : ''}</div>
      ${targeting ? `<button class="btn-secondary" onclick="cancelTargeting()">Cancelar alvo</button>` : ''}
    </div>
    <p class="declare-hint">Escolha 1 habilidade para cada carta em campo. As habilidades resolvem em ordem de velocidade (menor primeiro) quando ambos jogadores terminarem.</p>
    <div class="declare-list">
      ${rows}
      ${extraRows}
    </div>
    <div class="enemy-zone-label">Time de ${enemy.name}</div>
    <div class="unit-row enemy-declare-row">
      ${enemyRows}
      ${enemyExtraRows}
    </div>
  `;
}

function isValidTargetForCurrentSelection(unit) {
  if (!state.choosingTargetFor) return false;
  const { uid, abilityIdx } = state.choosingTargetFor;
  const caster = getUnit(uid);
  const def = CARD_DB[caster.cardId];
  const ability = def.abilities[abilityIdx];
  const wantsEnemy = ability.effects.some(e => e.target === 'chooseEnemy');
  const wantsAlly = ability.effects.some(e => e.target === 'chooseAlly' || e.target === 'chooseAllyNotMovedYet');
  const isEnemyOfCaster = unit.owner !== caster.owner;
  if (wantsEnemy) return isEnemyOfCaster;
  if (wantsAlly) return !isEnemyOfCaster;
  return false;
}

function renderResolvePhase() {
  const app = document.getElementById('app');
  const p0 = state.players[0], p1 = state.players[1];
  const done = state.resolutionIdx >= state.resolutionQueue.length;

  const queueHTML = state.resolutionQueue.map((item, i) => {
    const unit = getUnit(item.uid);
    const resolved = i < state.resolutionIdx;
    const current = i === state.resolutionIdx;
    return `<div class="queue-item ${resolved ? 'queue-resolved' : ''} ${current ? 'queue-current' : ''}">
      <span class="queue-speed">vel. ${item.speed}</span>
      <span class="queue-name">${unit ? unit.name : '???'}</span>
      ${resolved ? '✔' : ''}
    </div>`;
  }).join('');

  const cast = state.hvActiveCast;
  const bannerHTML = cast ? `
    <div class="hv-cast-banner">
      <div class="hv-cast-name">⚡ ${cast.casterName}</div>
      <div class="hv-cast-text">${cast.text}</div>
    </div>
  ` : '';

  app.innerHTML = `
    <div class="topbar">
      <div class="turn-indicator">Turno ${state.turn} — Resolvendo fila de ações${done ? ' — concluído' : ''}</div>
    </div>

    ${bannerHTML}

    <div class="queue-panel">
      <div class="log-title">Fila de Resolução (ordem de velocidade)</div>
      ${queueHTML}
    </div>

    <div class="board">
      <div class="player-zone">
        <div class="zone-title">${p0.name} ${activeFieldEffects(p0)}</div>
        <div class="unit-row">
          ${ROLES.map(role => p0.slots[role].active ? unitCardHTML(p0.slots[role].active, {}) : `<div class="slot-empty">${roleLabel(role)} vazio</div>`).join('')}
          ${p0.extraUnits.filter(u => !u.dead).map(u => unitCardHTML(u, {})).join('')}
        </div>
      </div>
      <div class="vs-divider"><span>VS</span></div>
      <div class="player-zone">
        <div class="zone-title">${p1.name} ${activeFieldEffects(p1)}</div>
        <div class="unit-row">
          ${ROLES.map(role => p1.slots[role].active ? unitCardHTML(p1.slots[role].active, {}) : `<div class="slot-empty">${roleLabel(role)} vazio</div>`).join('')}
          ${p1.extraUnits.filter(u => !u.dead).map(u => unitCardHTML(u, {})).join('')}
        </div>
      </div>
    </div>

    <div class="log-panel">
      <div class="log-title">Registro de Batalha</div>
      <div class="log-entries">
        ${state.log.map(l => `<div class="log-entry">${l}</div>`).join('')}
      </div>
    </div>
  `;

  applyCombatAnimations();
}

function applyCombatAnimations() {
  if (state.hvActiveCast) {
    const el = document.querySelector(`.unit-card[data-uid="${state.hvActiveCast.casterUid}"]`);
    if (el) el.classList.add('hv-caster');
  }
  const diff = state.hvDiff;
  if (!diff) return;
  for (const uid of Object.keys(diff.after)) {
    const b = diff.before[uid], a = diff.after[uid];
    if (!b) continue;
    const el = document.querySelector(`.unit-card[data-uid="${uid}"]`);
    const floatLayer = document.querySelector(`.hv-float-layer[data-float-for="${uid}"]`);
    const lifeDelta = a.life - b.life;
    const shieldDelta = a.shieldValue - b.shieldValue;

    if (diff.newlyDead.includes(uid) && el) {
      el.classList.add('hv-just-died');
    } else if (lifeDelta < 0 && el) {
      el.classList.add('hv-target-hit');
      spawnFloatNum(floatLayer, `-${Math.abs(lifeDelta)}`, 'dmg');
    } else if (lifeDelta > 0 && el) {
      el.classList.add('hv-target-heal');
      spawnFloatNum(floatLayer, `+${lifeDelta}`, 'heal');
    } else if (shieldDelta > 0 && el) {
      spawnFloatNum(floatLayer, `+${shieldDelta} 🛡️`, 'shield');
    }
  }
}

function spawnFloatNum(layer, text, cls) {
  if (!layer) return;
  const span = document.createElement('span');
  span.className = `hv-float-num ${cls}`;
  span.textContent = text;
  layer.appendChild(span);
  setTimeout(() => span.remove(), 1000);
}

function renderGameOver() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="pass-screen">
      <h1 class="game-title">Fim de Jogo</h1>
      <p class="setup-sub">🏆 ${state.players[state.winner].name} venceu a partida!</p>
      <button class="btn-primary" onclick="location.reload()">Nova Partida</button>
    </div>
    <div class="log-panel">
      <div class="log-title">Registro de Batalha</div>
      <div class="log-entries">${state.log.map(l => `<div class="log-entry">${l}</div>`).join('')}</div>
    </div>
  `;
}

function activeFieldEffects(p) {
  const effs = Object.entries(p.fieldEffects);
  if (!effs.length) return '';
  return `<span class="field-effects">${effs.map(([k,v]) => `${fieldEffectLabel(k)} (${v})`).join(', ')}</span>`;
}

function fieldEffectLabel(k) {
  return { chuva: '🌧️ Chuva', tempestade_de_areia: '🏜️ Tempestade de Areia' }[k] || k;
}

// ===================== TELA DE SELEÇÃO DE EQUIPE =====================

function renderTeamSelect() {
  const app = document.getElementById('app');
  const idsByRole = { defensor: [], atacante: [], suporte: [] };
  for (const [id, c] of Object.entries(CARD_DB)) {
    if (c.isToken) continue;
    idsByRole[c.role].push(id);
  }

  let vsBot = true;
  let p1Picks = { defensor: [], atacante: [], suporte: [] };
  let p2Picks = { defensor: [], atacante: [], suporte: [] };
  let showConfig = false;

  function pickCardHTML(id, list) {
    const c = CARD_DB[id];
    const picked = list.includes(id);
    const full = list.length >= 2 && !picked;
    return `<div class="pick-card ${picked ? 'pick-selected' : ''} ${full ? 'pick-disabled' : ''}" data-id="${id}">
      <div class="pick-name">${c.name}</div>
      <div class="pick-meta">${c.life} vida</div>
    </div>`;
  }

  function totalPicks(picks) {
    return ROLES.reduce((sum, r) => sum + picks[r].length, 0);
  }

  function drawSplash() {
    app.innerHTML = `
      <div class="hv-home">
        <div class="hv-emblem">${HV_EMBLEM_SVG}</div>
        <h1 class="game-title">HERO <span class="game-title-accent">VORTEX</span></h1>
        <p class="setup-sub">Monte um time de três classes e domine a arena em duelos de velocidade e estratégia.</p>
        <div class="hv-vs-strip">
          <div class="hv-vs-card" title="Defensor">🛡️</div>
          <div class="hv-vs-glyph">VS</div>
          <div class="hv-vs-card" title="Atacante">⚔️</div>
          <div class="hv-vs-glyph">VS</div>
          <div class="hv-vs-card" title="Suporte">✨</div>
        </div>
        <div class="hv-primary-cta">
          <button class="btn-primary" id="hvEnterBtn">Montar Time</button>
        </div>
      </div>
    `;
    document.getElementById('hvEnterBtn').onclick = () => { showConfig = true; draw(); };
  }

  function drawConfig() {
    const p1Ready = ROLES.every(r => p1Picks[r].length === 2);
    const p2Ready = vsBot || ROLES.every(r => p2Picks[r].length === 2);

    app.innerHTML = `
      <div class="setup-screen hv-config-panel">
        <button class="hv-back-link" id="hvBackBtn">← voltar</button>
        <h1 class="game-title">HERO <span class="game-title-accent">VORTEX</span></h1>
        <p class="setup-sub">Cada jogador monta um baralho com 2 cartas de cada classe (Defensor, Atacante, Suporte). A primeira de cada classe entra em campo; a segunda fica de reserva.</p>

        <div class="mode-toggle">
          <button class="btn-secondary ${vsBot ? 'mode-active' : ''}" id="modeBotBtn">🤖 Jogar contra o Bot</button>
          <button class="btn-secondary ${!vsBot ? 'mode-active' : ''}" id="modePvpBtn">👥 2 Jogadores (mesmo dispositivo)</button>
        </div>

        <div class="setup-columns">
          <div class="setup-col">
            <h2>Jogador 1 (${totalPicks(p1Picks)}/6)</h2>
            ${ROLES.map(role => `
              <div class="role-block">
                <h3>${roleLabel(role)} (${p1Picks[role].length}/2)</h3>
                <div class="pick-grid" data-player="1" data-role="${role}">
                  ${idsByRole[role].map(id => pickCardHTML(id, p1Picks[role])).join('')}
                </div>
              </div>
            `).join('')}
          </div>
          <div class="setup-col" id="p2col" style="${vsBot ? 'opacity:0.4; pointer-events:none;' : ''}">
            <h2>${vsBot ? 'Bot (aleatório)' : `Jogador 2 (${totalPicks(p2Picks)}/6)`}</h2>
            ${vsBot ? '<p class="setup-sub">O bot vai montar o baralho dele sozinho.</p>' : ROLES.map(role => `
              <div class="role-block">
                <h3>${roleLabel(role)} (${p2Picks[role].length}/2)</h3>
                <div class="pick-grid" data-player="2" data-role="${role}">
                  ${idsByRole[role].map(id => pickCardHTML(id, p2Picks[role])).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        <button class="btn-primary btn-start" id="startBtn" ${(p1Ready && p2Ready) ? '' : 'disabled'}>Começar Partida</button>
      </div>
    `;

    document.getElementById('hvBackBtn').onclick = () => { showConfig = false; draw(); };
    document.getElementById('modeBotBtn').onclick = () => { vsBot = true; draw(); };
    document.getElementById('modePvpBtn').onclick = () => { vsBot = false; draw(); };

    document.querySelectorAll('.pick-grid').forEach(grid => {
      const playerNum = grid.dataset.player;
      const role = grid.dataset.role;
      const picks = playerNum === '1' ? p1Picks : p2Picks;
      grid.querySelectorAll('.pick-card').forEach((el, i) => {
        el.style.animationDelay = (i * 0.03) + 's';
        el.onclick = () => {
          const id = el.dataset.id;
          if (picks[role].includes(id)) {
            picks[role] = picks[role].filter(x => x !== id);
          } else if (picks[role].length < 2) {
            picks[role].push(id);
          }
          draw();
        };
      });
    });

    document.getElementById('startBtn').onclick = () => {
      if (vsBot) {
        for (const role of ROLES) {
          const shuffled = [...idsByRole[role]].sort(() => Math.random() - 0.5);
          p2Picks[role] = shuffled.slice(0, 2);
        }
      }
      initGame(p1Picks, p2Picks, vsBot);
    };
  }

  function draw() {
    if (showConfig) drawConfig(); else drawSplash();
  }

  draw();
}

const HV_EMBLEM_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="hvEmblemGold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f0d48a"/>
      <stop offset="100%" stop-color="#8a6a30"/>
    </linearGradient>
  </defs>
  <polygon points="50,4 90,27 90,73 50,96 10,73 10,27" fill="none" stroke="url(#hvEmblemGold)" stroke-width="2.5"/>
  <polygon points="50,20 74,34 74,66 50,80 26,66 26,34" fill="none" stroke="#c7c9d1" stroke-width="1.2" opacity="0.6"/>
  <circle cx="50" cy="50" r="7" fill="url(#hvEmblemGold)"/>
  <line x1="50" y1="4" x2="50" y2="20" stroke="#c7c9d1" stroke-width="1" opacity="0.5"/>
  <line x1="90" y1="27" x2="74" y2="34" stroke="#c7c9d1" stroke-width="1" opacity="0.5"/>
  <line x1="90" y1="73" x2="74" y2="66" stroke="#c7c9d1" stroke-width="1" opacity="0.5"/>
  <line x1="50" y1="96" x2="50" y2="80" stroke="#c7c9d1" stroke-width="1" opacity="0.5"/>
  <line x1="10" y1="73" x2="26" y2="66" stroke="#c7c9d1" stroke-width="1" opacity="0.5"/>
  <line x1="10" y1="27" x2="26" y2="34" stroke="#c7c9d1" stroke-width="1" opacity="0.5"/>
</svg>`;

// ===================== BOOT =====================

async function boot() {
  const res = await fetch('cards.json');
  const data = await res.json();
  CARD_DB = {};
  for (const c of data.cards) CARD_DB[c.id] = c;
  renderTeamSelect();
}

boot();
