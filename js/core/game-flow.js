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
