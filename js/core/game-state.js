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

// Vida efetiva para REGRAS: vida real + escudo atual.
// A interface mostra vida e escudo separadamente.
function getCurrentLife(unit) {
  if (!unit) return 0;
  return Math.max(0, (Number(unit.life) || 0) + (unit.shield ? (Number(unit.shield.value) || 0) : 0));
}

function triggerUnitPlayed(unit) {
  if (!unit || unit.dead) return;
  if (unit.cardId === 'kanth') {
    const owner = ownerOf(unit);
    for (let i = 0; i < 2; i++) {
      const copy = makeUnit('kanth', unit.owner);
      copy.justSpawned = true;
      owner.extraUnits.push(copy);
    }
    logMsg(`${unit.name} entra em campo e cria duas cópias de Kanth.`);
  }
}

function buildDeck(pickByRole, ownerIdx, initialChoices = {}) {
  const slots = {};
  for (const role of ROLES) {
    const ids = pickByRole[role];
    const selectedId = initialChoices[role];
    const active = makeUnit(selectedId, ownerIdx);
    const bench = ids.filter(id => id !== selectedId);
    slots[role] = { active, bench };
  }
  return slots;
}

function initGame(p1Picks, p2Picks, vsBot, initialChoices) {
  state = {
    turn: 1,
    vsBot,
    players: [
      { name: 'Jogador 1', slots: buildDeck(p1Picks, 0, initialChoices[0]), extraUnits: [], fieldEffects: {} },
      { name: vsBot ? 'Bot' : 'Jogador 2', slots: buildDeck(p2Picks, 1, initialChoices[1]), extraUnits: [], fieldEffects: {} },
    ],
    log: [], phase: 'declare', declaring: 0, declarations: { 0: {}, 1: {} },
    pendingUnit: null, pendingQueue: [], resolutionQueue: [], resolutionIdx: 0, winner: null,
  };
  for (const p of state.players) for (const role of ROLES) triggerUnitPlayed(p.slots[role].active);
  logMsg(`Partida iniciada! Fase de declaração — Turno ${state.turn}.`);
  startDeclarePhaseForPlayer(0);
}

function logMsg(msg) {
  state.log.unshift(msg);
  if (state.log.length > 80) state.log.pop();
}
function allUnitsOf(playerIdx) {
  const p = state.players[playerIdx], list = [];
  for (const role of ROLES) if (p.slots[role].active) list.push(p.slots[role].active);
  list.push(...p.extraUnits.filter(u => !u.dead));
  return list;
}
function allUnitsAll() { return [...allUnitsOf(0), ...allUnitsOf(1)]; }
function getUnit(uid) { return allUnitsAll().find(u => u.uid === uid) || null; }
function ownerOf(unit) { return state.players[unit.owner]; }
function enemyPlayerOf(unit) { return state.players[1 - unit.owner]; }
function enemyTeamOf(unit) { return allUnitsOf(1 - unit.owner); }
function allyTeamOf(unit) { return allUnitsOf(unit.owner); }
function availableAbilities(unit) {
  const def = CARD_DB[unit.cardId];
  return def.abilities.map((ab, idx) => ({ ab, idx })).filter(({ idx }) => !(unit.cooldowns[idx] > 0));
}
