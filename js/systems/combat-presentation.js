/* Hero Vortex — fast, physical combat choreography. */
(() => {
  // Quick and dry: short cue, short beat between effects, short gap after.
  const ACTION_CUE_MS=280, PRE_ACTION_MS=140, STEP_MS=260, GAP_MS=160;
  const labels={damage:'ATAQUE',heal:'CURA',shield:'ESCUDO',status:'STATUS',buff:'BUFF',summon:'INVOCAR',sacrifice:'SACRIFÍCIO',field:'CAMPO',taunt:'PROVOCAÇÃO',revive:'REVIVER',move:'MOVER',delayed:'EFEITO'};
  const kindOf=e=>{if(!e)return'buff';if(['dealDamage','conditionalDamage','conditionalRepeat'].includes(e.type))return'damage';if(['heal','conditionalHeal','spendCounterToHeal','conditionalLifesteal'].includes(e.type))return'heal';if(e.type==='applyShield')return'shield';if(e.type==='applyStatus')return'status';if(['gainCounter','buffMaxLife','conditionalBuff'].includes(e.type))return'buff';if(e.type==='createToken')return'summon';if(e.type==='sacrificeToken')return'sacrifice';if(e.type==='applyFieldEffect')return'field';if(e.type==='taunt')return'taunt';if(e.type==='reviveCopy')return'revive';if(e.type==='moveNow')return'move';if(e.type==='delayedEffect')return'delayed';return'buff'};
  const sound=k=>window.HVAudio?.play({damage:'impact',heal:'heal',shield:'shield',status:'status',buff:'buff',summon:'summon',field:'field',taunt:'buff',sacrifice:'sacrifice',revive:'revive',move:'tap',delayed:'status'}[k]||'buff');
  const el=uid=>document.querySelector(`.unit-card[data-uid="${uid}"]`);
  const point=uid=>{const e=el(uid);if(!e)return null;const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}};
  const layer=()=>{let l=document.getElementById('hvFxLayer');if(!l){l=document.createElement('div');l.id='hvFxLayer';Object.assign(l.style,{position:'fixed',inset:'0',pointerEvents:'none',zIndex:'100000'});document.body.appendChild(l)}return l};
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const animationDone=a=>a?.finished?.catch(()=>{})||Promise.resolve();
  const rand=(a,b)=>a+Math.random()*(b-a);

  // ---- screen shake on the whole battle stage, intensity-scaled ----
  function screenShake(intensity=1){
    const stage=document.querySelector('.hv-battle-stage');if(!stage)return;
    stage.classList.remove('hv-shake-mild','hv-shake-hard');void stage.offsetWidth;
    stage.classList.add(intensity>=1.15?'hv-shake-hard':'hv-shake-mild');
    setTimeout(()=>stage.classList.remove('hv-shake-mild','hv-shake-hard'),350);
  }

  // ---- flash a card's own border/inset glow — no floating glyph ----
  function flashCard(uid,kind){
    const e=el(uid);if(!e)return;
    const cls=`hv-flash-${kind}`;
    e.classList.remove(cls);void e.offsetWidth;e.classList.add(cls);
    setTimeout(()=>e.classList.remove(cls),450);
  }

  // ---- terse impact shake on a struck card ----
  function jolt(uid){
    const e=el(uid);if(!e)return;
    e.classList.remove('hv-jolt');void e.offsetWidth;e.classList.add('hv-jolt');
    setTimeout(()=>e.classList.remove('hv-jolt'),250);
  }

  // ---- small, dark, terse floating number — no neon glow ----
  function floatNumber(uid,text,kind='damage'){
    const e=el(uid);if(!e)return;
    const host=e.querySelector('.hv-float-layer')||e;
    const n=document.createElement('div');
    n.className=`hv-float-text hv-float-${kind}`;
    n.textContent=text;
    host.appendChild(n);
    setTimeout(()=>n.remove(),900);
  }

  // ---- quick particle burst (7 embers, short life, like a death-burst) ----
  function burst(x,y,kind='damage',count=7){
    const l=layer();
    for(let i=0;i<count;i++){
      const p=document.createElement('span');
      p.className=`hv-ember hv-ember-${kind}`;
      const ang=(i/count)*360+rand(-15,15);
      const dist=rand(20,42);
      p.style.left=`${x}px`;p.style.top=`${y}px`;
      p.style.setProperty('--ang',`${ang}deg`);
      p.style.setProperty('--dist',`${dist}px`);
      p.style.animationDelay=`${rand(0,40)}ms`;
      l.appendChild(p);
      setTimeout(()=>p.remove(),650);
    }
  }

  function targetIds(effect,diff){if(diff.targetUid)return[diff.targetUid];const groups=['allEnemies','allEnemiesFieldAndHand','allAllies','allAlliesIncludingHand','enemyDefensor','enemyAtacante','enemySuporte','allyAtacante','allyDefensor'];if(groups.includes(effect?.target))return Object.keys(diff.after||{}).filter(uid=>diff.after[uid]&&!diff.after[uid].dead);if(effect?.target==='self')return[diff.casterUid];if(effect?.target==='lastTarget')return diff.targetUid?[diff.targetUid]:[];return[]}

  function lifeDelta(diff,uid){
    const before=diff.before?.[uid],after=diff.after?.[uid];
    if(!before||!after)return null;
    const life=(after.life??0)-(before.life??0);
    const shield=(after.shield?.value??0)-(before.shield?.value??0);
    return{life,shield};
  }

  function reportDelta(diff,uid){
    const delta=diff?lifeDelta(diff,uid):null;
    if(!delta)return;
    if(delta.shield<0)floatNumber(uid,`-${Math.abs(delta.shield)}`,'shield');
    if(delta.life<0)floatNumber(uid,`-${Math.abs(delta.life)}`,'damage');
    if(delta.life>0)floatNumber(uid,`+${delta.life}`,'heal');
    if(delta.shield>0)floatNumber(uid,`+${delta.shield}`,'shield-gain');
  }

  // ---- a card lunges into its target and snaps back — quick, no arc, no rotation flourish ----
  async function singleStrike(casterUid,targetUid,diff){
    const s=point(casterUid),t=point(targetUid),source=el(casterUid);if(!s||!t||!source)return;
    const previousStyle=source.getAttribute('style')||'',previousZ=source.style.zIndex;
    source.style.position='relative';source.style.zIndex='100050';source.style.willChange='transform';

    const dx=t.x-s.x, dy=t.y-s.y;
    sound('damage');
    const lunge=source.animate([
      {transform:'translate3d(0,0,0) scale(1)'},
      {transform:`translate3d(${dx*.78}px,${dy*.78}px,0) scale(1.03)`,offset:.55,easing:'cubic-bezier(.5,0,.75,0)'},
      {transform:`translate3d(${dx*.9}px,${dy*.9}px,0) scale(.98)`,offset:.68},
      {transform:'translate3d(0,0,0) scale(1)',offset:1}
    ],{duration:340,easing:'cubic-bezier(.2,.8,.3,1)',fill:'forwards'});

    // impact lands right as the card reaches the target, not after the return
    setTimeout(()=>{
      jolt(targetUid);
      flashCard(targetUid,'damage');
      burst(t.x,t.y,'damage',8);
      screenShake(1);
      reportDelta(diff,targetUid);
    },190);

    await animationDone(lunge);
    source.setAttribute('style',previousStyle);if(!previousStyle)source.removeAttribute('style');else source.style.zIndex=previousZ;
  }

  async function areaDamage(casterUid,targets,diff){
    const s=point(casterUid);if(!s)return;
    sound('damage');
    flashCard(casterUid,'damage');
    burst(s.x,s.y,'damage',10);
    screenShake(1.25);
    await wait(140);
    for(let i=0;i<targets.length;i++){
      const t=point(targets[i]);if(!t)continue;
      jolt(targets[i]);
      flashCard(targets[i],'damage');
      burst(t.x,t.y,'damage',6);
      reportDelta(diff,targets[i]);
      if(i<targets.length-1)await wait(90)
    }
  }

  async function animateEffect(effect,diff){
    const k=kindOf(effect),targets=targetIds(effect,diff);sound(k);
    if(k==='damage'){
      const area=['allEnemies','allEnemiesFieldAndHand','enemyDefensor','enemyAtacante','enemySuporte'].includes(effect?.target)||targets.length>1;
      return area?areaDamage(diff.casterUid,targets,diff):(targets[0]?singleStrike(diff.casterUid,targets[0],diff):undefined);
    }
    if(k==='heal'||k==='buff'){
      const cls=k==='heal'?'heal':'buff';
      for(let i=0;i<targets.length;i++){
        const uid=targets[i],p=point(uid);
        if(p){flashCard(uid,cls);burst(p.x,p.y,cls,6);reportDelta(diff,uid)}
        if(i<targets.length-1)await wait(90)
      }
      return;
    }
    if(k==='shield'){
      for(let i=0;i<targets.length;i++){
        const t=point(targets[i]);
        if(t){flashCard(targets[i],'shield');burst(t.x,t.y,'shield',6);reportDelta(diff,targets[i])}
        if(i<targets.length-1)await wait(90)
      }
      return;
    }
    if(k==='status'){for(let i=0;i<targets.length;i++){const t=point(targets[i]);if(t){flashCard(targets[i],'status');jolt(targets[i]);burst(t.x,t.y,'status',5)}if(i<targets.length-1)await wait(90)}return}
    if(k==='summon'){const ids=Object.keys(diff.after||{}).filter(uid=>!(diff.before||{})[uid]);for(let i=0;i<ids.length;i++){const t=point(ids[i]);if(t){el(ids[i])?.classList.add('hv-summon-enter');burst(t.x,t.y,'summon',9)}if(i<ids.length-1)await wait(110)}return}
    if(k==='sacrifice'){const source=point(diff.casterUid),ids=Object.keys(diff.before||{}).filter(uid=>!(diff.after||{})[uid]);for(let i=0;i<ids.length;i++){const t=point(ids[i]);if(source&&t){burst(t.x,t.y,'sacrifice',8);flashCard(diff.casterUid,'sacrifice')}if(i<ids.length-1)await wait(110)}return}
    if(k==='revive'){for(let i=0;i<targets.length;i++){const t=point(targets[i]);if(t){el(targets[i])?.classList.add('hv-revive-enter');burst(t.x,t.y,'revive',9)}if(i<targets.length-1)await wait(110)}return}
    if(k==='field'){document.querySelector('.hv-battle-stage')?.classList.add('hv-field-wave');setTimeout(()=>document.querySelector('.hv-battle-stage')?.classList.remove('hv-field-wave'),700);return}
    if(k==='taunt'){for(let i=0;i<targets.length;i++){const t=point(targets[i]);if(t){el(targets[i])?.classList.add('hv-taunt-shake');setTimeout(()=>el(targets[i])?.classList.remove('hv-taunt-shake'),450);flashCard(targets[i],'taunt')}if(i<targets.length-1)await wait(90)}return}
    if(k==='move'){for(let i=0;i<targets.length;i++){flashCard(targets[i],'move');if(i<targets.length-1)await wait(90)}return}
    if(k==='delayed'){flashCard(diff.casterUid,'delayed')}
  }

  let queuedRender=false;
  const originalRender=window.render;
  if(typeof originalRender==='function')window.render=function(){if(window.HVCombatBusy){queuedRender=true;return;}return originalRender.apply(this,arguments)};

  async function playCombatSequence(diff){
    if(!diff)return;
    const caster=getUnit(diff.casterUid),ability=CARD_DB[caster?.cardId]?.abilities?.[diff.abilityIdx];
    if(!caster||!ability)throw new Error(`Combat presentation: caster/ability inválido (${diff?.casterUid}/${diff?.abilityIdx}).`);
    const run=(async()=>{
      await actionCue(caster.uid,kindOf(ability.effects?.[0]));
      await wait(PRE_ACTION_MS);
      for(const effect of ability.effects||[]){await animateEffect(effect,diff);await wait(STEP_MS)}
      await wait(GAP_MS);
    })();
    window.HVCombatBusy=true;
    window.HVCombatPromise=run;
    try{return await run}
    finally{
      window.HVCombatBusy=false;
      window.HVCombatPromise=null;
      if(queuedRender){queuedRender=false;window.render?.()}
    }
  }

  function actionCue(uid,k){
    const e=el(uid);if(!e)return Promise.resolve();
    e.querySelector('.hv-action-cue')?.remove();
    const cue=document.createElement('div');
    cue.className=`hv-action-cue hv-action-${k}`;
    cue.innerHTML=`<b>${labels[k]||'AÇÃO'}</b>`;
    e.appendChild(cue);
    return wait(ACTION_CUE_MS).then(()=>cue.remove());
  }

  window.playCombatSequence=playCombatSequence;

  // game-flow.js is now the sole owner of resolution sequencing. These flags
  // prevent the legacy rules-fixes wrapper from installing a second scheduler.
  window.__hvPresentationWrapped=true;
  window.__hvAutoResolveWrapped=true;

  window.HVCombatDiagnostics={locate(uid){return point(uid)},preview(uid,targetUid,kind='damage'){if(kind==='damage'&&uid&&targetUid)singleStrike(uid,targetUid);else{const p=point(uid);if(p)burst(p.x,p.y,kind,7)}},describe(){return{playCombatSequence:typeof window.playCombatSequence==='function',cards:document.querySelectorAll('.unit-card[data-uid]').length,fxLayer:!!document.getElementById('hvFxLayer')}}};
})();
