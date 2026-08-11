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

// ===================== FASE DE DECLARAÇÃO =====================
function startDeclarePhaseForPlayer(playerIdx) {
  state.phase = 'declare'; state.declaring = playerIdx; state.declarations[playerIdx] = {};
  const units = allUnitsOf(playerIdx).filter(u => !u.dead);
  state.pendingQueue = units.map(u => u.uid); state.pendingUnit = null; advanceDeclareQueue();
}
function advanceDeclareQueue() {
  if (!state.pendingQueue.length) { finishDeclareForPlayer(state.declaring); return; }
  const uid = state.pendingQueue[0], unit = getUnit(uid);
  if (!unit || unit.dead) { state.pendingQueue.shift(); advanceDeclareQueue(); return; }
  const avail = availableAbilities(unit);
  if (!avail.length) {
    logMsg(`${unit.name} está com tudo em recarga e passa a vez.`);
    state.declarations[state.declaring][uid] = null; state.pendingQueue.shift(); advanceDeclareQueue(); return;
  }
  state.pendingUnit = uid; render();
}
function playerChooseAbility(abilityIdx) {
  const uid = state.pendingUnit, unit = getUnit(uid), ability = CARD_DB[unit.cardId].abilities[abilityIdx];
  const needsTarget = ability.effects.some(e => ['chooseAlly', 'chooseEnemy', 'chooseAllyNotMovedYet'].includes(e.target));
  if (needsTarget) { state.choosingTargetFor = { uid, abilityIdx }; renderTargetOverlay(); }
  else commitDeclaration(uid, abilityIdx, null);
}
function playerChooseTarget(targetUid) {
  const { uid, abilityIdx } = state.choosingTargetFor; state.choosingTargetFor = null; closeTargetOverlay(); commitDeclaration(uid, abilityIdx, targetUid);
}
function cancelTargeting() { state.choosingTargetFor = null; closeTargetOverlay(); render(); }
function closeTargetOverlay() { document.getElementById('hvTargetOverlay')?.remove(); }
function renderTargetOverlay() {
  closeTargetOverlay();
  const { uid, abilityIdx } = state.choosingTargetFor, caster = getUnit(uid), ability = CARD_DB[caster.cardId].abilities[abilityIdx];
  const wantsEnemy = ability.effects.some(e => e.target === 'chooseEnemy');
  const wantsAlly = ability.effects.some(e => ['chooseAlly','chooseAllyNotMovedYet'].includes(e.target));
  const wantsUnmoved = ability.effects.some(e => e.target === 'chooseAllyNotMovedYet');
  let pool = (wantsEnemy ? enemyTeamOf(caster) : allyTeamOf(caster)).filter(u => !u.dead);
  if (wantsUnmoved) { const decl = state.declarations[state.declaring] || {}; pool = pool.filter(u => decl[u.uid] === undefined); }
  const overlay = document.createElement('div'); overlay.className = 'hv-target-overlay'; overlay.id = 'hvTargetOverlay';
  overlay.innerHTML = `
    <div class="hv-target-header"><div class="hv-target-title">${caster.name} — escolha o alvo</div><div class="hv-target-sub">${ability.text}</div></div>
    <div class="hv-target-grid">${pool.map(u => `
      <div class="hv-target-option ${wantsAlly ? 'hv-ally-target' : ''}" data-uid="${u.uid}" tabindex="0" role="button">
        <div class="hv-target-role">${roleIcon(u.role)}</div><div class="hv-target-name">${u.name}</div>
        <div class="hv-target-life">${svgIcon('heart')} ${Math.max(0,u.life)} / ${u.maxLife}${u.shield && u.shield.value > 0 ? ` · ${svgIcon('shield')} ${u.shield.value}` : ''}</div>
        <div class="hv-target-lifebar"><div class="hv-target-lifebar-fill" style="width:${Math.min(100,Math.max(0,(u.life/u.maxLife)*100))}%"></div></div>
      </div>`).join('')}</div>
    <button class="btn-secondary hv-target-cancel" id="hvTargetCancelBtn">Cancelar</button>`;
  document.body.appendChild(overlay);
  overlay.querySelectorAll('.hv-target-option').forEach((el,i)=>{el.style.animationDelay=(i*.05)+'s';el.onclick=()=>playerChooseTarget(el.dataset.uid);el.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')playerChooseTarget(el.dataset.uid)}});
  document.getElementById('hvTargetCancelBtn').onclick=cancelTargeting;
}
function commitDeclaration(uid, abilityIdx, targetUid) { state.declarations[state.declaring][uid]={abilityIdx,targetUid}; state.pendingQueue.shift(); state.pendingUnit=null; advanceDeclareQueue(); }
function finishDeclareForPlayer(playerIdx) {
  if (playerIdx===0 && !state.vsBot) { showPassDeviceScreen(1); return; }
  if (playerIdx===0 && state.vsBot) { declareBot(1); beginResolution(); return; }
  beginResolution();
}
function showPassDeviceScreen(nextPlayerIdx) { state.phase='pass-device'; state.nextDeclarer=nextPlayerIdx; render(); }
function confirmPassDevice() { startDeclarePhaseForPlayer(state.nextDeclarer); }

// ===================== BOT =====================
function declareBot(playerIdx) {
  state.declarations[playerIdx]={};
  for (const unit of allUnitsOf(playerIdx).filter(u=>!u.dead)) {
    const avail=availableAbilities(unit);
    if(!avail.length){state.declarations[playerIdx][unit.uid]=null;continue;}
    const {ab,idx}=avail[Math.floor(Math.random()*avail.length)];
    let targetUid=null;
    if(ab.effects.some(e=>['chooseAlly','chooseEnemy','chooseAllyNotMovedYet'].includes(e.target))){
      const enemy=ab.effects.some(e=>e.target==='chooseEnemy');
      const pool=(enemy?enemyTeamOf(unit):allyTeamOf(unit)).filter(u=>!u.dead);
      if(pool.length){pool.sort((a,b)=>getCurrentLife(a)-getCurrentLife(b));targetUid=pool[0].uid;}
    }
    state.declarations[playerIdx][unit.uid]={abilityIdx:idx,targetUid};
  }
  logMsg(`${state.players[playerIdx].name} declarou suas ações.`);
}

// ===================== RESOLUÇÃO =====================
function beginResolution() {
  state.phase='resolve'; const queue=[];
  for(let p=0;p<2;p++) for(const [uid,decl] of Object.entries(state.declarations[p])){
    if(!decl)continue; const unit=getUnit(uid); if(!unit||unit.dead)continue; const ability=CARD_DB[unit.cardId].abilities[decl.abilityIdx];
    queue.push({uid,abilityIdx:decl.abilityIdx,targetUid:decl.targetUid,speed:ability.speed,life:getCurrentLife(unit)});
  }
  queue.sort((a,b)=>(a.speed-b.speed)||(a.life-b.life)); state.resolutionQueue=queue; state.resolutionIdx=0;
  logMsg(`— Resolvendo turno ${state.turn} —`); beginAutoResolution();
}
const HV_STEP_DELAY=1550;
function snapshotUnits(){const map={};for(const u of allUnitsAll())map[u.uid]={life:u.life,shieldValue:u.shield?u.shield.value:0,dead:u.dead,statuses:u.statuses.map(s=>`${s.status}:${s.value??''}:${s.duration}`).sort(),counters:{...u.counters}};return map;}
function autoResolveStep(){
  if(!state||state.phase!=='resolve')return;
  if(state.resolutionIdx>=state.resolutionQueue.length){setTimeout(()=>{if(state&&state.phase==='resolve')finishResolutionPhase()},500);return;}
  const item=state.resolutionQueue[state.resolutionIdx++],caster=getUnit(item.uid);
  if(!caster||caster.dead){render();setTimeout(autoResolveStep,250);return;}
  const ability=CARD_DB[caster.cardId].abilities[item.abilityIdx],before=snapshotUnits(),sourceEl=document.querySelector(`.unit-card[data-uid="${caster.uid}"]`),geometry={source:null,targets:{}};
  if(sourceEl){const r=sourceEl.getBoundingClientRect();geometry.source={left:r.left,top:r.top,width:r.width,height:r.height};}
  for(const u of allUnitsAll()){const el=document.querySelector(`.unit-card[data-uid="${u.uid}"]`);if(el){const r=el.getBoundingClientRect();geometry.targets[u.uid]={x:r.left+r.width/2,y:r.top+r.height/2};}}
  state.hvActiveCast={casterUid:caster.uid,targetUid:item.targetUid,abilityIdx:item.abilityIdx,text:ability.text,casterName:caster.name}; render();
  const preexistingDead=new Set(allUnitsAll().filter(u=>u.dead).map(u=>u.uid));
  setTimeout(()=>{
    executeAbility(caster,item.abilityIdx,item.targetUid);checkDeaths();checkWinner();const after=snapshotUnits();
    state.hvDiff={before,after,casterUid:caster.uid,targetUid:item.targetUid,abilityIdx:item.abilityIdx,newlyDead:allUnitsAll().filter(u=>u.dead&&!preexistingDead.has(u.uid)).map(u=>u.uid),geometry};
    render();playCombatSequence(state.hvDiff);
    setTimeout(()=>{state.hvActiveCast=null;state.hvDiff=null;if(state.winner!==null){finishResolutionPhase();return;}render();setTimeout(autoResolveStep,220)},HV_STEP_DELAY-500);
  },550);
}
function beginAutoResolution(){state.hvActiveCast=null;state.hvDiff=null;render();setTimeout(autoResolveStep,500);}
function executeAbility(caster,abilityIdx,targetUid){
  const def=CARD_DB[caster.cardId],ability=def.abilities[abilityIdx],chosenTarget=targetUid?getUnit(targetUid):null,allyTeam=allyTeamOf(caster),enemyTeam=enemyTeamOf(caster);
  const ctx={caster,chosenTarget,allyTeam,enemyTeam,enemyField:enemyTeam,enemyHand:[],lastTarget:chosenTarget,
    onCreateToken:tokenId=>{const tok=makeUnit(tokenId,caster.owner);tok.justSpawned=true;ownerOf(caster).extraUnits.push(tok);logMsg(`${ownerOf(caster).name} cria uma ${CARD_DB[tokenId].name}.`);},
    onSacrificeToken:(tokenId,log)=>{const list=ownerOf(caster).extraUnits,idx=list.findIndex(u=>u.cardId===tokenId&&!u.dead);if(idx>=0){list[idx].dead=true;list[idx].life=0;log(`${list[idx].name} é destruída como custo da habilidade.`)}else log(`Nenhuma Máquina de Guerra disponível para sacrificar!`);},
    onFieldEffect:(effect,duration,log)=>{ownerOf(caster).fieldEffects[effect]=duration;log(`Efeito de campo "${effect}" ativado por ${duration} turno(s).`);},
    onDelayedEffect:(eff,log)=>log(`Efeito atrasado agendado (resolver em ${eff.delay} turno(s) — acompanhe o log).`),
    onReviveCopy:(cardId,life,log)=>{const list=ownerOf(caster).extraUnits,dead=list.find(u=>u.cardId===cardId&&u.dead);if(dead){dead.dead=false;dead.life=life;log(`${dead.name} retorna à vida com ${life} de vida!`)}else log(`Nenhuma cópia morta de ${CARD_DB[cardId].name} para reviver.`);}
  };
  logMsg(`⚡ ${caster.name} (vel. ${ability.speed}): ${ability.text}`);Engine.runEffects(ability.effects,ctx,logMsg);if(ability.cooldown&&ability.cooldown>0)caster.cooldowns[abilityIdx]=ability.cooldown+1;
}
function checkDeaths(){
  for(const p of state.players){
    for(const role of ROLES){const slot=p.slots[role];if(slot.active&&slot.active.life<=0&&!slot.active.replaced){slot.active.dead=true;slot.active.replaced=true;logMsg(`${slot.active.name} foi derrotado!`);if(slot.bench.length){const nextId=slot.bench.shift();slot.active=makeUnit(nextId,state.players.indexOf(p));slot.active.justSpawned=true;logMsg(`${p.name} coloca ${slot.active.name} em campo!`);triggerUnitPlayed(slot.active);}else{slot.active=null;logMsg(`${p.name} não tem mais reservas para ${roleLabel(role)} — slot vazio.`)}}}
    for(const u of p.extraUnits)if(!u.dead&&u.life<=0){u.dead=true;logMsg(`${u.name} foi destruída!`)}
  }
}
function checkWinner(){for(let i=0;i<2;i++){const p=state.players[i];if(ROLES.every(role=>!p.slots[role].active)){state.winner=1-i;logMsg(`🏆 ${state.players[state.winner].name} venceu a partida!`)}}}
function finishResolutionPhase(){
  for(const p of state.players){for(const [effect,duration] of Object.entries(p.fieldEffects)){const idx=state.players.indexOf(p);if(effect==='chuva')for(const u of allUnitsOf(idx).filter(u=>!u.dead))Engine.applyHeal(u,10,logMsg);if(effect==='tempestade_de_areia')for(const u of allUnitsOf(1-idx).filter(u=>!u.dead))Engine.applyDamage(u,10,logMsg);p.fieldEffects[effect]=duration-1;if(p.fieldEffects[effect]<=0)delete p.fieldEffects[effect];}}
  for(const u of allUnitsAll()){if(u.dead)continue;const bleed=u.statuses.find(s=>s.status==='sangramento');if(bleed)Engine.applyDamage(u,bleed.value,logMsg);u.healedThisTurn=false;u.statuses=u.statuses.filter(s=>{if(s.duration===-1)return true;s.duration-=1;return s.duration>0});if(u.shield){u.shield.duration-=1;if(u.shield.duration<=0){logMsg(`O Escudo de ${u.name} expira.`);u.shield=null}}for(const k of Object.keys(u.cooldowns))if(u.cooldowns[k]>0)u.cooldowns[k]--;}
  checkDeaths();checkWinner();if(state.winner!==null){state.phase='gameover';render();return;}state.turn++;logMsg(`— Fim do turno. Iniciando Turno ${state.turn} —`);showTurnFlash(`TURNO ${state.turn}`,()=>startDeclarePhaseForPlayer(0));
}
function showTurnFlash(text,onDone){const flash=document.createElement('div');flash.className='hv-turn-flash';flash.innerHTML=`<div class="hv-turn-flash-text">${text}</div>`;document.body.appendChild(flash);setTimeout(()=>{flash.remove();onDone()},1150);}

// ===================== RENDER =====================
function roleLabel(role){return {defensor:'Defensor',atacante:'Atacante',suporte:'Suporte',token:'Construto'}[role]||role;}
function statusLabel(s){return {damageCap:`Limite de Dano (${s.value})`,sangramento:`Sangrando (${s.value}/turno)`,silenced:'Silenciado',nextSingleTargetDamageBoost:`+${s.value} próx. dano único`,damageBoost:`+${s.value} dano`}[s.status]||s.status;}

function svgIcon(name,cls=''){
  const icons={
    defender:`<svg class="hv-svg-icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 6v5c0 4.7-2.8 8-7 10-4.2-2-7-5.3-7-10V6l7-3Z"/><path d="m8.2 12 2.3 2.3 5.3-5.1"/></svg>`,
    attack:`<svg class="hv-svg-icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 5.3-5.3M8.1 20H4v-4.1M13.1 4.2l6.7 6.7M15.3 3.7l5 5-2.1 2.1-5-5 2.1-2.1ZM10.1 8.9l5 5-2.4 2.4-5-5 2.4-2.4Z"/></svg>`,
    support:`<svg class="hv-svg-icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.2-7-10.1C5 6.6 7 5 9.4 5c1.2 0 2.1.5 2.6 1.5C12.5 5.5 13.4 5 14.6 5 17 5 19 6.6 19 9.9 19 15.8 12 20 12 20Z"/><path d="M12 8v5M9.5 10.5h5"/></svg>`,
    sword:`<svg class="hv-svg-icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 19 6.5-6.5M8.5 20H5v-3.5M13 4l7 7M15.5 3.5l5 5-2 2-5-5 2-2ZM10.2 8.8l5 5-2.4 2.4-5-5 2.4-2.4Z"/></svg>`,
    shield:`<svg class="hv-svg-icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 6v5c0 4.7-2.8 8-7 10-4.2-2-7-5.3-7-10V6l7-3Z"/><path d="M8.5 12h7M12 8.5v7"/></svg>`,
    heart:`<svg class="hv-svg-icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 8.5c0 5-8 10-8 10s-8-5-8-10C4 6 5.5 4.5 7.7 4.5c1.8 0 3.1 1 4.3 2.3 1.2-1.3 2.5-2.3 4.3-2.3C18.5 4.5 20 6 20 8.5Z"/></svg>`,
    target:`<svg class="hv-svg-icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>`,
    spark:`<svg class="hv-svg-icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 1.8 7.2L21 11l-7.2 1.8L12 20l-1.8-7.2L3 11l7.2-1.8L12 2Z"/></svg>`
  };return icons[name]||icons.spark;
}
function roleIcon(role){return role==='defensor'?svgIcon('defender'):role==='atacante'?svgIcon('attack'):svgIcon('support');}
function roleAccent(role){return role==='defensor'?'blue':role==='atacante'?'red':'green';}
const ROLE_ICON={defensor:svgIcon('defender'),atacante:svgIcon('attack'),suporte:svgIcon('support'),token:svgIcon('spark')};

function cardDetailHTML(id,selectedIds=[]){
  const c=CARD_DB[id];if(!c)return'';const selected=selectedIds.includes(id);
  const passive=c.passive?`<section class="hv-card-rule hv-card-passive"><div class="hv-rule-label">PASSIVA</div><div>${c.passive}</div></section>`:'';
  const abilities=c.abilities.map((ab,i)=>`<article class="hv-detail-ability"><div class="hv-detail-ability-top"><span class="hv-speed-badge">${ab.speed}</span><span class="hv-detail-ability-label">HABILIDADE ${i+1}</span>${ab.cooldown?`<span class="hv-detail-cooldown">RECARGA ${ab.cooldown}</span>`:'<span class="hv-detail-cooldown ready">PRONTA</span>'}</div><div class="hv-detail-ability-text">${ab.text}</div></article>`).join('');
  return `<div class="hv-card-detail ${selected?'is-selected':''}"><div class="hv-detail-crest ${roleAccent(c.role)}">${roleIcon(c.role)}</div><div class="hv-detail-heading"><div class="hv-detail-role">${roleLabel(c.role).toUpperCase()}</div><h2>${c.name}</h2><div class="hv-detail-stats"><span>${svgIcon('heart')} <b>${c.life}</b> VIDA</span><span>${svgIcon(c.role==='atacante'?'sword':c.role==='defensor'?'shield':'spark')} ${c.abilities.length} HABILIDADES</span></div></div>${passive}<section class="hv-card-rule"><div class="hv-rule-label">ARSENAL</div><div class="hv-detail-abilities">${abilities}</div></section><button class="hv-select-detail ${selected?'selected':''}" data-select-card="${id}">${selected?'✓ NO SEU DECK':'ESCOLHER CARTA'}</button></div>`;
}

function unitCardHTML(u,opts={}){
  const {selectable,showAbilities,abilitiesLocked}=opts,def=CARD_DB[u.cardId]||{},deadClass=u.dead?'unit-dead':'',selClass=selectable?'unit-selectable':'',spawnClass=u.justSpawned?'hv-spawned':'';if(u.justSpawned)u.justSpawned=false;
  const life=Math.max(0,Number(u.life)||0),pct=Math.max(0,Math.min(100,(life/u.maxLife)*100)),shieldValue=u.shield?Math.max(0,Number(u.shield.value)||0):0,shieldDuration=u.shield?Math.max(0,Number(u.shield.duration)||0):0,passiveText=typeof def.passive==='string'?def.passive.trim():'';
  return `<div class="unit-card ${deadClass} ${selClass} ${spawnClass}" data-uid="${u.uid}" data-role="${u.role}" onclick="handleUnitClick('${u.uid}')"><div class="hv-float-layer" data-float-for="${u.uid}"></div><div class="unit-card-frame"></div><div class="unit-header-line"><span class="unit-heart" title="Vida real">${svgIcon('heart')}<span class="unit-heart-value">${life}</span></span><span class="unit-role-icon role-${u.role}" title="${roleLabel(u.role)}">${ROLE_ICON[u.role]||''}</span><span class="unit-name">${u.name}</span></div><div class="unit-lifebar"><div class="unit-lifebar-fill" style="width:${pct}%"></div></div><div class="unit-maxlife-sub">${life} / ${u.maxLife}</div>${shieldValue>0?`<div class="unit-shield-panel" title="Escudo atual — separado da vida e não recuperado por cura"><span class="unit-shield-icon">${svgIcon('shield')}</span><span class="unit-shield-label">ESCUDO</span><strong class="unit-shield-value">${shieldValue}</strong>${shieldDuration>0?`<span class="unit-shield-duration">${shieldDuration} turno${shieldDuration===1?'':'s'}</span>`:''}</div>`:''}${passiveText?`<div class="unit-passive-panel"><div class="unit-passive-title">${svgIcon('spark')} PASSIVA</div><div class="unit-passive-text">${passiveText}</div></div>`:''}${u.statuses.length?`<div class="unit-statuses">${u.statuses.map(s=>`<span class="status-chip">${statusLabel(s)}</span>`).join('')}</div>`:''}${Object.keys(u.counters).length?`<div class="unit-counters">${Object.entries(u.counters).map(([k,v])=>`<span class="counter-chip">${k}: ${v}</span>`).join('')}</div>`:''}${u.dead?'<div class="unit-fallen">Derrotado</div>':(showAbilities?abilitiesHTML(u,{locked:abilitiesLocked}):'')}</div>`;
}
function abilitiesHTML(u,opts={}){const def=CARD_DB[u.cardId],isPending=state.pendingUnit===u.uid,locked=!!opts.locked;return `<div class="unit-abilities">${def.abilities.map((ab,i)=>{const onCd=u.cooldowns[i]>0,disabled=locked||!isPending||onCd;return `<button class="ability-btn ${locked?'ability-btn-locked':''}" ${disabled?'disabled':''} onclick="event.stopPropagation(); ${locked?'':`playerChooseAbility(${i})`}"><span class="ability-cost">${ab.speed}</span><span class="ability-text">${ab.text}</span>${onCd?`<span class="ability-cd">⏳${u.cooldowns[i]}</span>`:(ab.cooldown?`<span class="ability-cd-max">⏳${ab.cooldown}</span>`:'')}</button>`}).join('')}</div>`;}
function handleUnitClick(uid){}
function render(){const app=document.getElementById('app');if(!state)return;if(state.phase==='pass-device'){renderPassDevice();return;}if(state.phase==='declare'){renderDeclarePhase();return;}if(state.phase==='resolve'){renderResolvePhase();return;}if(state.phase==='gameover'){renderGameOver();return;}}
function renderPassDevice(){document.getElementById('app').innerHTML=`<div class="pass-screen"><h1 class="game-title">Passe o dispositivo</h1><p class="setup-sub">É a vez de <strong>${state.players[state.nextDeclarer].name}</strong> declarar suas ações em segredo.</p><button class="btn-primary" onclick="confirmPassDevice()">Estou pronto — mostrar minhas cartas</button></div>`;}
function renderDeclarePhase(){
  const app=document.getElementById('app'),playerIdx=state.declaring,p=state.players[playerIdx],targeting=!!state.choosingTargetFor;
  function rowFor(u){const declared=state.declarations[playerIdx][u.uid],targetInfo=declared&&declared.targetUid?` → alvo: ${getUnit(declared.targetUid)?.name||'?'}`:'',declaredLabel=declared!==undefined?(declared?`<span class="declared-tag">✓ Declarado${targetInfo}</span>`:`<span class="declared-tag pass">passou (cooldown)</span>`):'',selectableForTargeting=targeting&&isValidTargetForCurrentSelection(u);return `<div class="declare-row">${declaredLabel}${unitCardHTML(u,{showAbilities:true,selectable:selectableForTargeting})}</div>`;}
  const rows=ROLES.map(role=>{const slot=p.slots[role];return slot.active?rowFor(slot.active):`<div class="slot-empty">${roleLabel(role)}: slot vazio</div>`}).join(''),extraRows=p.extraUnits.filter(u=>!u.dead).map(rowFor).join(''),enemyIdx=1-playerIdx,enemy=state.players[enemyIdx];
  const enemyRows=ROLES.map(role=>{const slot=enemy.slots[role];return slot.active?unitCardHTML(slot.active,{showAbilities:true,abilitiesLocked:true,selectable:targeting&&isValidTargetForCurrentSelection(slot.active)}):`<div class="slot-empty">${roleLabel(role)}: slot vazio</div>`}).join(''),enemyExtraRows=enemy.extraUnits.filter(u=>!u.dead).map(u=>unitCardHTML(u,{showAbilities:true,abilitiesLocked:true,selectable:targeting&&isValidTargetForCurrentSelection(u)})).join('');
  app.innerHTML=`<div class="topbar"><div class="turn-indicator">Turno ${state.turn} — <strong>${p.name}</strong> declarando ações ${targeting?'<span class="selecting-hint">— escolha um alvo</span>':''}</div>${targeting?'<button class="btn-secondary" onclick="cancelTargeting()">Cancelar alvo</button>':''}</div><p class="declare-hint">Escolha 1 habilidade para cada carta em campo. As habilidades resolvem em ordem de velocidade quando ambos jogadores terminarem.</p><div class="declare-list">${rows}${extraRows}</div><div class="enemy-zone-label">Time de ${enemy.name}</div><div class="unit-row enemy-declare-row">${enemyRows}${enemyExtraRows}</div>`;
}
function isValidTargetForCurrentSelection(unit){if(!state.choosingTargetFor)return false;const {uid,abilityIdx}=state.choosingTargetFor,caster=getUnit(uid),ability=CARD_DB[caster.cardId].abilities[abilityIdx],wantsEnemy=ability.effects.some(e=>e.target==='chooseEnemy'),wantsAlly=ability.effects.some(e=>['chooseAlly','chooseAllyNotMovedYet'].includes(e.target));if(wantsEnemy)return unit.owner!==caster.owner;if(wantsAlly)return unit.owner===caster.owner;return false;}

function activeFieldEffects(p){const effs=Object.entries(p.fieldEffects);if(!effs.length)return'';return `<span class="field-effects">${effs.map(([k,v])=>`${fieldEffectLabel(k)} (${v})`).join(', ')}</span>`;}
function fieldEffectLabel(k){return {chuva:'Chuva',tempestade_de_areia:'Tempestade de Areia'}[k]||k;}

function renderResolvePhase(){
  const app=document.getElementById('app'),p0=state.players[0],p1=state.players[1],done=state.resolutionIdx>=state.resolutionQueue.length;
  const queueHTML=state.resolutionQueue.map((item,i)=>{const unit=getUnit(item.uid),resolved=i<state.resolutionIdx,current=i===state.resolutionIdx;return `<div class="queue-item ${resolved?'queue-resolved':''} ${current?'queue-current':''}"><span class="queue-speed">${item.speed}</span><span class="queue-name">${unit?unit.name:'???'}</span>${resolved?'✓':''}</div>`}).join('');
  const cast=state.hvActiveCast,bannerHTML=cast?`<div class="hv-cast-banner"><div class="hv-cast-name">${roleIcon(getUnit(cast.casterUid)?.role||'suporte')} ${cast.casterName}</div><div class="hv-cast-text">${cast.text}</div></div>`:'';
  const zoneHTML=(p,idx)=>`<section class="player-zone ${idx===0?'hv-player-top':'hv-player-bottom'}"><div class="zone-title"><span>${p.name}</span>${activeFieldEffects(p)}</div><div class="unit-row">${ROLES.map(role=>p.slots[role].active?unitCardHTML(p.slots[role].active,{}):`<div class="slot-empty">${roleLabel(role)} vazio</div>`).join('')}${p.extraUnits.filter(u=>!u.dead).map(u=>unitCardHTML(u,{})).join('')}</div></section>`;
  app.innerHTML=`<div class="hv-battle-screen"><header class="hv-battle-topbar"><div><span class="hv-battle-kicker">HERO VORTEX · TURNO ${state.turn}</span><strong>RESOLUÇÃO DE COMBATE</strong></div><div class="hv-battle-status">${done?'TODAS AS AÇÕES RESOLVIDAS':'AÇÃO EM ANDAMENTO'}</div></header>${bannerHTML}<div class="hv-queue-strip"><span class="hv-queue-label">FILA</span>${queueHTML}</div><main class="hv-battle-stage">${zoneHTML(p0,0)}<div class="hv-battle-midline"><span>VS</span></div>${zoneHTML(p1,1)}</main><aside class="hv-battle-log"><div class="log-title">REGISTRO</div><div class="log-entries">${state.log.slice(0,12).map(l=>`<div class="log-entry">${l}</div>`).join('')}</div></aside><div id="hvFxLayer" class="hv-fx-layer" aria-hidden="true"></div></div>`;
  if(state.hvActiveCast){document.querySelector(`.unit-card[data-uid="${state.hvActiveCast.casterUid}"]`)?.classList.add('hv-caster-ready');if(state.hvActiveCast.targetUid)document.querySelector(`.unit-card[data-uid="${state.hvActiveCast.targetUid}"]`)?.classList.add('hv-target-marked');}
}
function diffTargetIds(diff,kind){const ids=[];for(const uid of Object.keys(diff.after)){const b=diff.before[uid],a=diff.after[uid];if(!b||!a)continue;const beforeEffective=b.life+b.shieldValue,afterEffective=a.life+a.shieldValue;if(kind==='damage'&&(afterEffective<beforeEffective||(!b.dead&&a.dead)))ids.push(uid);if(kind==='heal'&&a.life>b.life)ids.push(uid);if(kind==='shield'&&a.shieldValue>b.shieldValue)ids.push(uid);if(kind==='status'&&a.statuses.join('|')!==b.statuses.join('|'))ids.push(uid);}return ids;}
function createMotionCard(casterUid,geometry){const caster=getUnit(casterUid),fx=document.getElementById('hvFxLayer');if(!fx||!geometry?.source)return null;const ghost=document.createElement('div');ghost.className='hv-motion-card';ghost.innerHTML=`<div class="hv-motion-icon">${roleIcon(caster?.role||'suporte')}</div><div>${caster?.name||'HERO'}</div>`;ghost.style.left=`${geometry.source.left}px`;ghost.style.top=`${geometry.source.top}px`;ghost.style.width=`${geometry.source.width}px`;ghost.style.height=`${geometry.source.height}px`;fx.appendChild(ghost);return ghost;}
function spawnImpact(x,y,kind='damage'){const fx=document.getElementById('hvFxLayer');if(!fx)return;const el=document.createElement('div');el.className=`hv-impact ${kind}`;el.style.left=`${x}px`;el.style.top=`${y}px`;el.innerHTML=kind==='damage'?svgIcon('sword'):kind==='heal'?svgIcon('heart'):kind==='shield'?svgIcon('shield'):svgIcon('spark');fx.appendChild(el);setTimeout(()=>el.remove(),850);}
function spawnEffectGlyph(targetEl,kind){if(!targetEl)return;const glyph=document.createElement('div');glyph.className=`hv-effect-glyph ${kind}`;glyph.innerHTML=kind==='heal'?svgIcon('heart'):kind==='shield'?svgIcon('shield'):kind==='status'?svgIcon('target'):svgIcon('spark');targetEl.appendChild(glyph);setTimeout(()=>glyph.remove(),900);}
function playPhysicalAttack(diff,targetUid,delay=0){const point=diff.geometry?.targets?.[targetUid];if(!point)return;setTimeout(()=>{const ghost=createMotionCard(diff.casterUid,diff.geometry);if(!ghost)return;const src=diff.geometry.source,dx=point.x-(src.left+src.width/2),dy=point.y-(src.top+src.height/2),dir=dx>=0?1:-1;const animation=ghost.animate([{transform:'translate3d(0,0,0) rotate(0deg) scale(1)',opacity:.15},{transform:`translate3d(${dx*.58}px,${dy*.58}px,0) rotate(${dir*3}deg) scale(1.04)`,opacity:1,offset:.42},{transform:`translate3d(${dx}px,${dy}px,0) rotate(${dir*6}deg) scale(.97)`,opacity:1,offset:.58},{transform:`translate3d(${dx*.34}px,${dy*.34}px,0) rotate(${dir*2}deg) scale(1)`,opacity:.9,offset:.72},{transform:'translate3d(0,0,0) rotate(0deg) scale(1)',opacity:0}],{duration:680,easing:'cubic-bezier(.22,.72,.15,1)',fill:'forwards'});animation.finished.then(()=>ghost.remove()).catch(()=>ghost.remove());setTimeout(()=>{spawnImpact(point.x,point.y,'damage');document.querySelector(`.unit-card[data-uid="${targetUid}"]`)?.classList.add('hv-hit-reaction')},385)},delay);}
function applyCombatAnimations(){}
function playCombatSequence(diff){
  if(!diff)return;const ability=CARD_DB[getUnit(diff.casterUid)?.cardId]?.abilities?.[diff.abilityIdx];if(!ability)return;const effectTypes=new Set(ability.effects.map(e=>e.type)),damageIds=diffTargetIds(diff,'damage'),healIds=diffTargetIds(diff,'heal'),shieldIds=diffTargetIds(diff,'shield'),statusIds=diffTargetIds(diff,'status');
  if(effectTypes.has('dealDamage')||damageIds.length)damageIds.forEach((uid,i)=>playPhysicalAttack(diff,uid,i*120));
  healIds.forEach((uid,i)=>setTimeout(()=>{const el=document.querySelector(`.unit-card[data-uid="${uid}"]`),b=diff.before[uid],a=diff.after[uid],layer=el?.querySelector(`.hv-float-layer[data-float-for="${uid}"]`);el?.classList.add('hv-heal-reaction');spawnEffectGlyph(el,'heal');spawnFloatNum(layer,`+${Math.max(0,a.life-b.life)}`,'heal')},i*100));
  shieldIds.forEach((uid,i)=>setTimeout(()=>{const el=document.querySelector(`.unit-card[data-uid="${uid}"]`),b=diff.before[uid],a=diff.after[uid],layer=el?.querySelector(`.hv-float-layer[data-float-for="${uid}"]`);el?.classList.add('hv-shield-reaction');spawnEffectGlyph(el,'shield');spawnFloatNum(layer,`+${Math.max(0,a.shieldValue-b.shieldValue)} 🛡`,'shield')},i*100));
  statusIds.forEach((uid,i)=>setTimeout(()=>{const el=document.querySelector(`.unit-card[data-uid="${uid}"]`);el?.classList.add('hv-status-reaction');spawnEffectGlyph(el,'status')},i*100));
  if(effectTypes.has('applyFieldEffect')){const stage=document.querySelector('.hv-battle-stage');if(stage){const pulse=document.createElement('div');pulse.className='hv-field-effect-pulse';pulse.innerHTML=svgIcon('spark');stage.appendChild(pulse);setTimeout(()=>pulse.remove(),1100);}}
  diff.newlyDead.forEach((uid,i)=>setTimeout(()=>document.querySelector(`.unit-card[data-uid="${uid}"]`)?.classList.add('hv-death-reaction'),i*90));
}
function spawnFloatNum(layer,text,cls){if(!layer)return;const span=document.createElement('span');span.className=`hv-float-num ${cls}`;span.textContent=text;layer.appendChild(span);setTimeout(()=>span.remove(),1000);}
function renderGameOver(){const app=document.getElementById('app');app.innerHTML=`<div class="pass-screen"><h1 class="game-title">Fim de Jogo</h1><p class="setup-sub">${state.players[state.winner].name} venceu a partida!</p><button class="btn-primary" onclick="location.reload()">Nova Partida</button></div><div class="log-panel"><div class="log-title">Registro de Batalha</div><div class="log-entries">${state.log.map(l=>`<div class="log-entry">${l}</div>`).join('')}</div></div>`;}

// ===================== DECKBUILDER =====================
function renderTeamSelect(){
  const app=document.getElementById('app'),idsByRole={defensor:[],atacante:[],suporte:[]};for(const[id,c]of Object.entries(CARD_DB))if(!c.isToken)idsByRole[c.role].push(id);
  let vsBot=true,p1Picks={defensor:[],atacante:[],suporte:[]},p2Picks={defensor:[],atacante:[],suporte:[]},showConfig=false,showInitialDeploy=false,activeRole='defensor',focusedId=null;
  let initialChoices=[{defensor:null,atacante:null,suporte:null},{defensor:null,atacante:null,suporte:null}];
  const roleOrder=['defensor','atacante','suporte'],roleSubtitles={defensor:'Absorva o impacto. Proteja o time. Controle o ritmo.',atacante:'Pressione os pontos fracos. Converta velocidade em dano.',suporte:'Mantenha o time vivo. Prepare as próximas jogadas.'};
  const totalPicks=p=>ROLES.reduce((sum,r)=>sum+p[r].length,0);
  function compactCardHTML(id){const c=CARD_DB[id],selected=p1Picks[activeRole].includes(id),focused=focusedId===id,full=p1Picks[activeRole].length>=2&&!selected;return `<button class="hv-deck-card ${selected?'is-selected':''} ${focused?'is-focused':''} ${full?'is-disabled':''}" data-deck-card="${id}" ${full?'disabled':''}><span class="hv-deck-card-corner">${selected?'01':'—'}</span><span class="hv-deck-card-icon ${roleAccent(activeRole)}">${roleIcon(activeRole)}</span><span class="hv-deck-card-name">${c.name}</span><span class="hv-deck-card-stat">${svgIcon('heart')} ${c.life} <em>VIDA</em></span><span class="hv-deck-card-rule">${c.passive||c.abilities[0]?.text||''}</span><span class="hv-deck-card-action">${selected?'SELECIONADA':'VER CARTA'}</span></button>`;}
  function drawSplash(){app.innerHTML=`<div class="hv-home"><div class="hv-emblem">${HV_EMBLEM_SVG}</div><h1 class="game-title">HERO <span class="game-title-accent">VORTEX</span></h1><p class="setup-sub">Monte seu deck, escolha seu trio e entre na arena.</p><div class="hv-primary-cta"><button class="btn-primary" id="hvEnterBtn">MONTAR DECK</button></div></div>`;document.getElementById('hvEnterBtn').onclick=()=>{showConfig=true;draw()};}
  function drawConfig(){const picks=p1Picks[activeRole],p1Ready=ROLES.every(r=>p1Picks[r].length===2),p2Ready=vsBot||ROLES.every(r=>p2Picks[r].length===2);if(!focusedId||!CARD_DB[focusedId]||CARD_DB[focusedId].role!==activeRole)focusedId=idsByRole[activeRole][0];app.innerHTML=`<div class="hv-deckbuilder"><header class="hv-deck-header"><button class="hv-back-link" id="hvBackBtn">← voltar</button><div class="hv-deck-kicker">CONSTRUÇÃO DE DECK · ${totalPicks(p1Picks)}/6</div><h1>ESCOLHA SEUS <span>HERÓIS</span></h1><p>Começamos pelos <strong>Defensores</strong>. Escolha 2 cartas em cada classe. Clique numa carta para abrir sua ficha completa.</p></header><nav class="hv-role-tabs">${roleOrder.map((role,idx)=>{const done=p1Picks[role].length===2,unlocked=idx===0||p1Picks[roleOrder[idx-1]].length===2;return `<button class="hv-role-tab ${activeRole===role?'active':''} ${done?'done':''} ${!unlocked?'locked':''}" data-role-tab="${role}" ${!unlocked?'disabled':''}><span class="hv-role-tab-icon">${roleIcon(role)}</span><span>${roleLabel(role)}</span><b>${p1Picks[role].length}/2</b></button>`}).join('')}</nav><div class="hv-deck-workbench"><section class="hv-deck-catalog"><div class="hv-section-kicker">${roleLabel(activeRole).toUpperCase()}</div><h2>${roleSubtitles[activeRole]}</h2><div class="hv-deck-grid">${idsByRole[activeRole].map(compactCardHTML).join('')}</div></section><aside class="hv-deck-inspector">${cardDetailHTML(focusedId,picks)}</aside></div><footer class="hv-deck-footer"><div class="hv-deck-progress">${roleOrder.map(role=>`<span class="${p1Picks[role].length===2?'complete':''}">${roleLabel(role)} <b>${p1Picks[role].length}/2</b></span>`).join('')}</div><button class="btn-primary hv-deck-next" id="hvDeckNext" ${p1Ready&&p2Ready?'':'disabled'}>${p1Ready&&p2Ready?'ESCOLHER TIME INICIAL':`COMPLETE ${roleLabel(roleOrder.find(r=>p1Picks[r].length<2)||'suporte')}`}</button></footer></div>`;
    document.getElementById('hvBackBtn').onclick=()=>{showConfig=false;draw()};document.querySelectorAll('[data-role-tab]').forEach(btn=>btn.onclick=()=>{activeRole=btn.dataset.roleTab;focusedId=idsByRole[activeRole][0];draw()});document.querySelectorAll('[data-deck-card]').forEach(btn=>btn.onclick=()=>{focusedId=btn.dataset.deckCard;draw()});document.querySelectorAll('[data-select-card]').forEach(btn=>btn.onclick=()=>toggleDeckPick(btn.dataset.selectCard));document.getElementById('hvDeckNext').onclick=()=>{if(!(p1Ready&&p2Ready))return;if(vsBot)for(const role of ROLES){const shuffled=[...idsByRole[role]].sort(()=>Math.random()-.5);p2Picks[role]=shuffled.slice(0,2)}initialChoices=[{defensor:null,atacante:null,suporte:null},{defensor:null,atacante:null,suporte:null}];showInitialDeploy=true;drawInitialDeploy()};
  }
  function toggleDeckPick(id){const picks=p1Picks[activeRole];if(picks.includes(id))p1Picks[activeRole]=picks.filter(x=>x!==id);else if(picks.length<2)picks.push(id);focusedId=id;draw();}
  function drawInitialDeploy(){const ready1=ROLES.every(r=>!!initialChoices[0][r]);if(vsBot)for(const role of ROLES)if(!initialChoices[1][role]){const ids=p2Picks[role];initialChoices[1][role]=ids[Math.floor(Math.random()*ids.length)]}const ready2=ROLES.every(r=>!!initialChoices[1][r]);const playerPanel=(playerIdx,picks)=>`<div class="hv-initial-panel"><div class="hv-initial-panel-head"><span>${playerIdx===0?'SEU TIME':'TIME INIMIGO'}</span><b>${playerIdx===0?'ESCOLHA QUEM COMEÇA':'SELEÇÃO AUTOMÁTICA'}</b></div><p>${playerIdx===0?'Uma carta de cada classe entra em campo. Isso conta como jogar a carta.':'O Bot escolhe uma carta de cada classe.'}</p>${ROLES.map(role=>`<div class="hv-initial-role"><div class="hv-initial-role-title">${roleIcon(role)} <span>${roleLabel(role)}</span></div><div class="hv-initial-options">${picks[role].map(id=>{const c=CARD_DB[id],selected=initialChoices[playerIdx][role]===id;return `<button class="hv-initial-card ${selected?'selected':''}" data-initial-player="${playerIdx}" data-initial-role="${role}" data-id="${id}"><span class="hv-initial-icon">${roleIcon(role)}</span><strong>${c.name}</strong><span>${c.life} VIDA</span>${c.passive?`<em>${c.passive}</em>`:''}</button>`}).join('')}</div></div>`).join('')}</div>`;app.innerHTML=`<div class="hv-deckbuilder hv-initial-builder"><header class="hv-deck-header"><button class="hv-back-link" id="hvDeployBackBtn">← voltar</button><div class="hv-deck-kicker">ÚLTIMA PREPARAÇÃO</div><h1>FORME O <span>TIME INICIAL</span></h1><p>Escolher uma carta aqui é o ato de <strong>jogá-la</strong>. As duas reservas restantes entram somente quando o slot for substituído.</p></header><div class="hv-initial-layout">${playerPanel(0,p1Picks)}${vsBot?'<div class="hv-bot-note"><div class="hv-bot-seal">BOT</div><strong>Oponente pronto.</strong><span>As escolhas dele já foram feitas.</span></div>':playerPanel(1,p2Picks)}</div><button class="btn-primary hv-deploy-start" id="deployStartBtn" ${ready1&&ready2?'':'disabled'}>ENTRAR NA ARENA</button></div>`;document.getElementById('hvDeployBackBtn').onclick=()=>{showInitialDeploy=false;drawConfig()};document.querySelectorAll('[data-initial-player]').forEach(btn=>btn.onclick=()=>{initialChoices[Number(btn.dataset.initialPlayer)][btn.dataset.initialRole]=btn.dataset.id;drawInitialDeploy()});document.getElementById('deployStartBtn').onclick=()=>{if(ready1&&ready2)initGame(p1Picks,p2Picks,vsBot,initialChoices)};}
  function draw(){if(showInitialDeploy)drawInitialDeploy();else if(showConfig)drawConfig();else drawSplash();} draw();
}

const HV_EMBLEM_SVG=`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="hvEmblemGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f0d48a"/><stop offset="100%" stop-color="#8a6a30"/></linearGradient></defs><polygon points="50,4 90,27 90,73 50,96 10,73 10,27" fill="none" stroke="url(#hvEmblemGold)" stroke-width="2.5"/><polygon points="50,20 74,34 74,66 50,80 26,66 26,34" fill="none" stroke="#c7c9d1" stroke-width="1.2" opacity=".6"/><circle cx="50" cy="50" r="7" fill="url(#hvEmblemGold)"/><line x1="50" y1="4" x2="50" y2="20" stroke="#c7c9d1" stroke-width="1" opacity=".5"/><line x1="90" y1="27" x2="74" y2="34" stroke="#c7c9d1" stroke-width="1" opacity=".5"/><line x1="90" y1="73" x2="74" y2="66" stroke="#c7c9d1" stroke-width="1" opacity=".5"/><line x1="50" y1="96" x2="50" y2="80" stroke="#c7c9d1" stroke-width="1" opacity=".5"/><line x1="10" y1="73" x2="26" y2="66" stroke="#c7c9d1" stroke-width="1" opacity=".5"/><line x1="10" y1="27" x2="26" y2="34" stroke="#c7c9d1" stroke-width="1" opacity=".5"/></svg>`;
async function boot(){const res=await fetch('cards.json');const data=await res.json();CARD_DB={};for(const c of data.cards)CARD_DB[c.id]=c;renderTeamSelect();}
boot();

/* ===== CONSOLIDATED: arena-start-fix.js ===== */
// Fix for the initial "ENTRAR NA ARENA" button.
// This deliberately uses the rendered initial-deploy screen instead of the
// deckbuilder's private closure state, so it remains reliable on mobile and
// after the UI has been redrawn.
(() => {
  const ROLES_FIX = ['defensor', 'atacante', 'suporte'];
  let starting = false;

  function selectedCard(player, role) {
    return document.querySelector(
      `[data-initial-player="${player}"][data-initial-role="${role}"].selected`
    )?.dataset.id || null;
  }

  function cardsForRole(role) {
    return Object.values(CARD_DB || {})
      .filter(c => c && !c.isToken && c.role === role)
      .map(c => c.id);
  }

  function makeBotDeck() {
    const result = { defensor: [], atacante: [], suporte: [] };
    for (const role of ROLES_FIX) {
      const pool = cardsForRole(role);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      result[role] = pool.slice(0, 2);
    }
    return result;
  }

  function startFromVisibleSelection(event) {
    const button = event.target.closest?.('#deployStartBtn');
    if (!button || starting) return;

    // We intentionally take over this click before the old closure handler.
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const p1Picks = { defensor: [], atacante: [], suporte: [] };
    const initialChoices = [
      { defensor: null, atacante: null, suporte: null },
      { defensor: null, atacante: null, suporte: null }
    ];

    for (const role of ROLES_FIX) {
      const selected = [...document.querySelectorAll(
        `[data-initial-player="0"][data-initial-role="${role}"]`
      )];
      p1Picks[role] = selected.map(el => el.dataset.id).filter(Boolean);
      initialChoices[0][role] = selected.find(el => el.classList.contains('selected'))?.dataset.id || null;
    }

    const valid = ROLES_FIX.every(role =>
      p1Picks[role].length === 2 && !!initialChoices[0][role]
    );
    if (!valid) return;

    const p2Picks = makeBotDeck();
    for (const role of ROLES_FIX) {
      initialChoices[1][role] = p2Picks[role][0];
    }

    starting = true;
    button.disabled = true;
    button.textContent = 'ENTRANDO...';

    try {
      if (typeof window.initGame !== 'function') {
        throw new Error('initGame não está disponível.');
      }
      window.initGame(p1Picks, p2Picks, true, initialChoices);
    } catch (error) {
      console.error('[Hero Vortex] Falha ao entrar na arena:', error);
      starting = false;
      button.disabled = false;
      button.textContent = 'ENTRAR NA ARENA';
      alert('Não foi possível iniciar a arena. Recarregue a página e tente novamente.');
    }
  }

  // Capture phase is important: the old inline/property handler is attached
  // directly to the button, so a normal bubbling listener can be too late.
  document.addEventListener('click', startFromVisibleSelection, true);
})();


/* ===== CONSOLIDATED: home-screen-fix.js ===== */
/* Main menu entrypoint: make the game start action explicit and mobile-friendly. */
(() => {
  function upgradeHome() {
    const btn = document.getElementById('hvEnterBtn');
    if (!btn || document.querySelector('.hv-main-play')) return;
    btn.classList.add('hv-main-play');
    btn.innerHTML = '<span aria-hidden="true">▶</span> JOGAR';
    btn.setAttribute('aria-label', 'Jogar Hero Vortex');
    btn.setAttribute('title', 'Jogar Hero Vortex');
  }
  const style = document.createElement('style');
  style.textContent = `
    .hv-main-play{min-width:min(320px,82vw);min-height:58px;font-size:1.08rem;letter-spacing:.14em;display:inline-flex;align-items:center;justify-content:center;gap:.7rem;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
    .hv-main-play span{font-size:.85em;filter:drop-shadow(0 0 5px rgba(240,212,138,.35))}
    .hv-main-play:active{transform:translateY(1px) scale(.985)}
  `;
  document.head.appendChild(style);
  const observer = new MutationObserver(upgradeHome);
  observer.observe(document.body, { childList:true, subtree:true });
  upgradeHome();
})();


/* ===== CONSOLIDATED: startup-fix.js ===== */
/* Hero Vortex startup guard.
   The main app can boot before the enhancement modules finish loading.
   If that race leaves #app empty, retry after every script has loaded. */
(() => {
  function retryHome() {
    const app = document.getElementById('app');
    if (!app || app.children.length) return;
    if (typeof renderTeamSelect !== 'function') return;
    try {
      renderTeamSelect();
    } catch (err) {
      console.error('[Hero Vortex] startup retry failed:', err);
      // Keep a usable entry screen instead of leaving a completely blank page.
      app.innerHTML = `
        <div class="hv-home">
          <div class="hv-emblem">${typeof HV_EMBLEM_SVG !== 'undefined' ? HV_EMBLEM_SVG : ''}</div>
          <h1 class="game-title">HERO <span class="game-title-accent">VORTEX</span></h1>
          <p class="setup-sub">Monte seu deck, escolha seu trio e entre na arena.</p>
          <div class="hv-primary-cta">
            <button class="btn-primary hv-main-play" id="hvEmergencyPlay">▶ JOGAR</button>
          </div>
        </div>`;
      document.getElementById('hvEmergencyPlay')?.addEventListener('click', () => {
        try { renderTeamSelect(); } catch (e) { console.error(e); }
      });
    }
  }
  window.addEventListener('load', () => setTimeout(retryHome, 0), { once: true });
  setTimeout(retryHome, 300);
})();
