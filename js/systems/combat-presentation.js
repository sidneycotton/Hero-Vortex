/* Hero Vortex — deliberate combat choreography. */
(() => {
  const ACTION_CUE_MS = 900;
  const PRE_ACTION_MS = 1100;
  const STEP_MS = 3200;
  const GAP_MS = 1100;

  const iconName={damage:'sword',heal:'heart',shield:'shield',status:'target',buff:'spark',summon:'spark',field:'spark',taunt:'target',sacrifice:'sword',revive:'heart',move:'target',delayed:'spark'};
  const kindOf=e=>{if(!e)return'buff';if(['dealDamage','conditionalDamage','conditionalRepeat'].includes(e.type))return'damage';if(['heal','conditionalHeal','spendCounterToHeal','conditionalLifesteal'].includes(e.type))return'heal';if(e.type==='applyShield')return'shield';if(e.type==='applyStatus')return'status';if(['gainCounter','buffMaxLife','conditionalBuff'].includes(e.type))return'buff';if(e.type==='createToken')return'summon';if(e.type==='sacrificeToken')return'sacrifice';if(e.type==='applyFieldEffect')return'field';if(e.type==='taunt')return'taunt';if(e.type==='reviveCopy')return'revive';if(e.type==='moveNow')return'move';if(e.type==='delayedEffect')return'delayed';return'buff'};
  const sound=k=>window.HVAudio?.play({damage:'impact',heal:'heal',shield:'shield',status:'status',buff:'buff',summon:'summon',field:'field',taunt:'buff',sacrifice:'sacrifice',revive:'revive',move:'tap',delayed:'status'}[k]||'buff');
  const el=uid=>document.querySelector(`.unit-card[data-uid="${uid}"]`);
  const point=uid=>{const e=el(uid);if(!e)return null;const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}};
  const layer=()=>{let l=document.getElementById('hvFxLayer');if(!l){l=document.createElement('div');l.id='hvFxLayer';Object.assign(l.style,{position:'fixed',inset:'0',pointerEvents:'none',zIndex:'100000'});document.body.appendChild(l)}return l};
  const svg=k=>typeof window.svgIcon==='function'?window.svgIcon(iconName[k]||'spark'):'';
  const labels={damage:'ATAQUE',heal:'CURA',shield:'ESCUDO',status:'STATUS',buff:'BUFF',summon:'INVOCAR',sacrifice:'SACRIFÍCIO',field:'CAMPO',taunt:'PROVOCAÇÃO',revive:'REVIVER',move:'MOVER',delayed:'EFEITO'};

  function actionCue(uid,k){const e=el(uid);if(!e)return;e.querySelector('.hv-action-cue')?.remove();const cue=document.createElement('div');cue.className=`hv-action-cue hv-action-${k}`;cue.innerHTML=`<span>${svg(k)}</span><b>${labels[k]||'AÇÃO'}</b>`;e.appendChild(cue);setTimeout(()=>cue.remove(),ACTION_CUE_MS)}
  function glyph(x,y,k,cls='',life=1900){const g=document.createElement('div');g.className=`hv-combat-glyph hv-combat-${k} ${cls}`;g.style.left=`${x}px`;g.style.top=`${y}px`;g.innerHTML=svg(k);layer().appendChild(g);setTimeout(()=>g.remove(),life);return g}
  function targetIds(effect,diff){if(diff.targetUid)return[diff.targetUid];const groups=['allEnemies','allEnemiesFieldAndHand','allAllies','allAlliesIncludingHand','enemyDefensor','enemyAtacante','enemySuporte','allyAtacante','allyDefensor'];if(groups.includes(effect?.target))return Object.keys(diff.after||{}).filter(uid=>diff.after[uid]&&!diff.after[uid].dead);if(effect?.target==='self')return[diff.casterUid];if(effect?.target==='lastTarget')return diff.targetUid?[diff.targetUid]:[];return[]}

  function singleStrike(casterUid,targetUid){
    const s=point(casterUid),t=point(targetUid);if(!s||!t)return;
    const source=el(casterUid);if(!source)return;
    const previousStyle=source.getAttribute('style')||'';
    const previousZ=source.style.zIndex;
    source.style.position='relative';source.style.zIndex='100050';source.style.willChange='transform';sound('damage');
    const animation=source.animate([
      {transform:'translate3d(0,0,0) scale(1)',opacity:.98},
      {transform:`translate3d(${(t.x-s.x)*.42}px,${(t.y-s.y)*.42}px,0) scale(1.03) rotate(${t.x>=s.x?2:-2}deg)`,opacity:1,offset:.3},
      {transform:`translate3d(${(t.x-s.x)*.72}px,${(t.y-s.y)*.72}px,0) scale(1.06) rotate(${t.x>=s.x?4:-4}deg)`,opacity:1,offset:.5},
      {transform:`translate3d(${t.x-s.x}px,${t.y-s.y}px,0) scale(.96) rotate(${t.x>=s.x?7:-7}deg)`,opacity:1,offset:.68},
      {transform:`translate3d(${(t.x-s.x)*.35}px,${(t.y-s.y)*.35}px,0)`,opacity:.94,offset:.82},
      {transform:'translate3d(0,0,0) scale(1)',opacity:1}
    ],{duration:1800,easing:'cubic-bezier(.2,.76,.16,1)',fill:'forwards'});
    animation.finished.then(()=>{source.setAttribute('style',previousStyle);if(!previousStyle)source.removeAttribute('style');else source.style.zIndex=previousZ}).catch(()=>{source.setAttribute('style',previousStyle);if(!previousStyle)source.removeAttribute('style');else source.style.zIndex=previousZ});
    const sword=glyph(s.x,s.y,'damage','hv-sword-projectile',1700);
    sword.animate([{transform:'translate(-50%,-50%) scale(.2) rotate(-35deg)',opacity:0},{transform:`translate(${(t.x-s.x)*.5}px,${(t.y-s.y)*.5}px) scale(1) rotate(5deg)`,opacity:1,offset:.45},{transform:`translate(${t.x-s.x}px,${t.y-s.y}px) scale(1.25) rotate(35deg)`,opacity:1,offset:.78},{transform:`translate(${t.x-s.x}px,${t.y-s.y}px) scale(.55) rotate(60deg)`,opacity:0}],{duration:1350,easing:'cubic-bezier(.18,.8,.15,1)',fill:'forwards'});
    setTimeout(()=>{const target=el(targetUid);target?.classList.remove('hv-impact-shake');void target?.offsetWidth;target?.classList.add('hv-impact-shake');glyph(t.x,t.y,'damage','hv-impact-flare',1500)},1150)
  }
  function areaDamage(casterUid,targets){const s=point(casterUid);if(!s)return;sound('damage');glyph(s.x,s.y,'damage','hv-area-core',1900);targets.forEach((uid,i)=>{const t=point(uid);if(!t)return;setTimeout(()=>{const e=el(uid);e?.classList.remove('hv-impact-shake');void e?.offsetWidth;e?.classList.add('hv-impact-shake');glyph(t.x,t.y,'damage','hv-impact-flare',1400)},750+i*420)})}
  function travel(k,casterUid,targetUid){const s=point(casterUid),t=point(targetUid);if(!s||!t)return;const g=glyph(s.x,s.y,k,'hv-travel',1800);g.animate([{transform:'translate(-50%,-50%) scale(.2)',opacity:0},{transform:`translate(${(t.x-s.x)*.45}px,${(t.y-s.y)*.45}px) scale(1.05)`,opacity:1,offset:.42},{transform:`translate(${t.x-s.x}px,${t.y-s.y}px) scale(1.2)`,opacity:1,offset:.82},{transform:`translate(${t.x-s.x}px,${t.y-s.y-24}px) scale(.65)`,opacity:0}],{duration:1500,easing:'cubic-bezier(.18,.8,.15,1)',fill:'forwards'}).finished.then(()=>g.remove()).catch(()=>g.remove())}
  function animateEffect(effect,diff,delay){const k=kindOf(effect),targets=targetIds(effect,diff);setTimeout(()=>{sound(k);if(k==='damage'){const area=['allEnemies','allEnemiesFieldAndHand','enemyDefensor','enemyAtacante','enemySuporte'].includes(effect?.target)||targets.length>1;area?areaDamage(diff.casterUid,targets):targets[0]&&singleStrike(diff.casterUid,targets[0])}else if(k==='heal'||k==='buff')targets.forEach((uid,i)=>setTimeout(()=>{travel(k,diff.casterUid,uid);const p=point(uid);if(p)glyph(p.x,p.y,k,'hv-target-burst',1600)},i*420));else if(k==='shield')targets.forEach((uid,i)=>setTimeout(()=>{const t=point(uid);if(t){el(uid)?.classList.remove('hv-shield-pulse');void el(uid)?.offsetWidth;el(uid)?.classList.add('hv-shield-pulse');glyph(t.x,t.y,k,'hv-shield-dome',1600)}},i*380));else if(k==='status')targets.forEach((uid,i)=>setTimeout(()=>{const t=point(uid);if(t){el(uid)?.classList.remove('hv-status-pulse');void el(uid)?.offsetWidth;el(uid)?.classList.add('hv-status-pulse');glyph(t.x,t.y,k,'hv-status-rune',1600)}},i*400));else if(k==='summon'){const ids=Object.keys(diff.after||{}).filter(uid=>!(diff.before||{})[uid]);ids.forEach((uid,i)=>setTimeout(()=>{const t=point(uid);if(t){glyph(t.x,t.y,k,'hv-summon-burst',1900);el(uid)?.classList.add('hv-summon-enter')}},500+i*500))}else if(k==='sacrifice'){const source=point(diff.casterUid),ids=Object.keys(diff.before||{}).filter(uid=>!(diff.after||{})[uid]);ids.forEach((uid,i)=>{const t=point(uid);if(!source||!t)return;setTimeout(()=>{glyph(t.x,t.y,k,'hv-sacrifice-burst',1700);glyph(source.x,source.y,k,'hv-sacrifice-core',1700)},i*450)})}else if(k==='revive')targets.forEach((uid,i)=>setTimeout(()=>{const t=point(uid);if(t){glyph(t.x,t.y,k,'hv-revive-rune',2100);el(uid)?.classList.add('hv-revive-enter')}},i*420));else if(k==='field'){const s=document.querySelector('.hv-battle-stage')?.getBoundingClientRect();if(s){glyph(s.left+s.width/2,s.top+s.height/2,k,'hv-field-weather',2300);document.querySelector('.hv-battle-stage')?.classList.add('hv-field-wave')}}else if(k==='taunt')targets.forEach((uid,i)=>setTimeout(()=>{const t=point(uid);if(t){el(uid)?.classList.add('hv-taunt-shake');glyph(t.x,t.y,k,'hv-taunt-mark',1500)}},i*400));else if(k==='move')targets.forEach((uid,i)=>setTimeout(()=>{const t=point(uid);if(t)glyph(t.x,t.y,k,'hv-move-arrow',1500)},i*400));else if(k==='delayed'){const s=point(diff.casterUid);if(s)glyph(s.x,s.y,k,'hv-delayed-rune',1700)}},delay)}

  // The resolver used to re-render after ~1s, while combat presentation was still running.
  // Keep the rendered battlefield stable for the full presentation and prevent the next
  // resolution step from starting until the current visual sequence has completed.
  let queuedRender=false;
  const originalRender=window.render;
  if(typeof originalRender==='function'){
    window.render=function(){
      if(window.HVCombatBusy){queuedRender=true;return;}
      return originalRender.apply(this,arguments);
    };
  }

  function playCombatSequence(diff){
    if(!diff)return 0;
    const caster=getUnit(diff.casterUid),ability=CARD_DB[caster?.cardId]?.abilities?.[diff.abilityIdx];
    if(!caster||!ability)return 0;
    const first=kindOf(ability.effects?.[0]);
    actionCue(caster.uid,first);
    let delay=ACTION_CUE_MS+PRE_ACTION_MS;
    for(const effect of ability.effects||[]){animateEffect(effect,diff,delay);delay+=STEP_MS}
    const total=delay+GAP_MS;
    window.HVCombatBusy=true;
    queuedRender=false;
    setTimeout(()=>{
      window.HVCombatBusy=false;
      if(queuedRender){queuedRender=false;window.render?.();}
    },total);
    return total;
  }

  window.playCombatSequence=playCombatSequence;
  window.HVCombatDiagnostics={locate(uid){return point(uid)},preview(uid,targetUid,kind='damage'){if(kind==='damage'&&uid&&targetUid)singleStrike(uid,targetUid);else{const p=point(uid);if(p)glyph(p.x,p.y,kind,'hv-combat-diagnostic')}},describe(){return{playCombatSequence:typeof window.playCombatSequence==='function',cards:document.querySelectorAll('.unit-card[data-uid]').length,fxLayer:!!document.getElementById('hvFxLayer')}}};
})();
