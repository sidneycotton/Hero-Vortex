/* Hero Vortex — deliberate combat choreography. */
(() => {
  // Keep the animation durations intact; shorten only the breathing room between steps.
  const ACTION_CUE_MS=650, PRE_ACTION_MS=600, STEP_MS=900, GAP_MS=500;
  const iconName={damage:'sword',heal:'heart',shield:'shield',status:'target',buff:'spark',summon:'spark',field:'spark',taunt:'target',sacrifice:'sword',revive:'heart',move:'target',delayed:'spark'};
  const labels={damage:'ATAQUE',heal:'CURA',shield:'ESCUDO',status:'STATUS',buff:'BUFF',summon:'INVOCAR',sacrifice:'SACRIFÍCIO',field:'CAMPO',taunt:'PROVOCAÇÃO',revive:'REVIVER',move:'MOVER',delayed:'EFEITO'};
  const kindOf=e=>{if(!e)return'buff';if(['dealDamage','conditionalDamage','conditionalRepeat'].includes(e.type))return'damage';if(['heal','conditionalHeal','spendCounterToHeal','conditionalLifesteal'].includes(e.type))return'heal';if(e.type==='applyShield')return'shieldaa';if(e.type==='applyStatus')return'status';if(['gainCounter','buffMaxLife','conditionalBuff'].includes(e.type))return'buff';if(e.type==='createToken')return'summon';if(e.type==='sacrificeToken')return'sacrifice';if(e.type==='applyFieldEffect')return'field';if(e.type==='taunt')return'taunt';if(e.type==='reviveCopy')return'revive';if(e.type==='moveNow')return'move';if(e.type==='delayedEffect')return'delayed';return'buff'};
  const sound=k=>window.HVAudio?.play({damage:'impact',heal:'heal',shield:'shield',status:'status',buff:'buff',summon:'summon',field:'field',taunt:'buff',sacrifice:'sacrifice',revive:'revive',move:'tap',delayed:'status'}[k]||'buff');
  const el=uid=>document.querySelector(`.unit-card[data-uid="${uid}"]`);
  const point=uid=>{const e=el(uid);if(!e)return null;const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}};
  const layer=()=>{let l=document.getElementById('hvFxLayer');if(!l){l=document.createElement('div');l.id='hvFxLayer';Object.assign(l.style,{position:'fixed',inset:'0',pointerEvents:'none',zIndex:'100000'});document.body.appendChild(l)}return l};
  const svg=k=>typeof window.svgIcon==='function'?window.svgIcon(iconName[k]||'spark'):'';
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const animationDone=a=>a?.finished?.catch(()=>{})||Promise.resolve();
  const rand=(a,b)=>a+Math.random()*(b-a);

  // ---- screen shake on the whole battle stage, intensity-scaled ----
  function screenShake(intensity=1){
    const stage=document.querySelector('.hv-battle-stage');if(!stage)return;
    stage.classList.remove('hv-stage-shake');void stage.offsetWidth;
    stage.style.setProperty('--hv-shake-mag',`${Math.round(6*intensity)}px`);
    stage.classList.add('hv-stage-shake');
    setTimeout(()=>stage.classList.remove('hv-stage-shake'),420);
  }

  // ---- floating numeric feedback (damage/heal/shield values) ----
  // Appended to the fixed FX layer (not inside the card) so it isn't clipped
  // by the card's overflow:hidden as it rises.
  function floatNumber(uid,text,kind='damage'){
    const p=point(uid);if(!p)return;
    const n=document.createElement('div');
    n.className=`hv-float-number hv-float-${kind}`;
    n.textContent=text;
    n.style.left=`${p.x}px`;
    n.style.top=`${p.y-p.h*.18}px`;
    layer().appendChild(n);
    setTimeout(()=>n.remove(),1450);
  }

  // ---- ambient particle burst at a point ----
  function particleBurst(x,y,kind='damage',count=10){
    const l=layer();
    const colorClass=`hv-particle-${kind}`;
    for(let i=0;i<count;i++){
      const p=document.createElement('div');
      p.className=`hv-particle ${colorClass}`;
      const angle=(Math.PI*2*i)/count+rand(-.35,.35);
      const dist=rand(34,86);
      const dx=Math.cos(angle)*dist, dy=Math.sin(angle)*dist;
      const size=rand(4,9);
      p.style.left=`${x}px`;p.style.top=`${y}px`;
      p.style.width=p.style.height=`${size}px`;
      l.appendChild(p);
      const a=p.animate([
        {transform:'translate(-50%,-50%) scale(0)',opacity:0},
        {transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.18},
        {transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.3)`,opacity:0}
      ],{duration:rand(650,950),easing:'cubic-bezier(.16,.8,.2,1)',fill:'forwards'});
      a.finished.catch(()=>{}).then(()=>p.remove());
    }
  }

  // ---- lingering trail segment behind a moving glyph ----
  function trailSpark(x,y,kind){
    const l=layer();
    const t=document.createElement('div');
    t.className=`hv-trail-spark hv-trail-${kind}`;
    t.style.left=`${x}px`;t.style.top=`${y}px`;
    l.appendChild(t);
    const a=t.animate([{opacity:.85,transform:'translate(-50%,-50%) scale(1)'},{opacity:0,transform:'translate(-50%,-50%) scale(.15)'}],{duration:480,easing:'ease-out',fill:'forwards'});
    a.finished.catch(()=>{}).then(()=>t.remove());
  }

  function actionCue(uid,k){const e=el(uid);if(!e)return Promise.resolve();e.querySelector('.hv-action-cue')?.remove();const cue=document.createElement('div');cue.className=`hv-action-cue hv-action-${k}`;cue.innerHTML=`<span>${svg(k)}</span><b>${labels[k]||'AÇÃO'}</b>`;e.appendChild(cue);return wait(ACTION_CUE_MS).then(()=>cue.remove());}
  function glyph(x,y,k,cls='',life=1900){const g=document.createElement('div');g.className=`hv-combat-glyph hv-combat-${k} ${cls}`;g.style.left=`${x}px`;g.style.top=`${y}px`;g.innerHTML=svg(k);layer().appendChild(g);setTimeout(()=>g.remove(),life);return g;}
  function targetIds(effect,diff){if(diff.targetUid)return[diff.targetUid];const groups=['allEnemies','allEnemiesFieldAndHand','allAllies','allAlliesIncludingHand','enemyDefensor','enemyAtacante','enemySuporte','allyAtacante','allyDefensor'];if(groups.includes(effect?.target))return Object.keys(diff.after||{}).filter(uid=>diff.after[uid]&&!diff.after[uid].dead);if(effect?.target==='self')return[diff.casterUid];if(effect?.target==='lastTarget')return diff.targetUid?[diff.targetUid]:[];return[]}

  function lifeDelta(diff,uid){
    const before=diff.before?.[uid],after=diff.after?.[uid];
    if(!before||!after)return null;
    const life=(after.life??0)-(before.life??0);
    const shield=(after.shield?.value??0)-(before.shield?.value??0);
    return{life,shield};
  }

  async function singleStrike(casterUid,targetUid,diff){
    const s=point(casterUid),t=point(targetUid),source=el(casterUid);if(!s||!t||!source)return;
    const previousStyle=source.getAttribute('style')||'',previousZ=source.style.zIndex;
    source.style.position='relative';source.style.zIndex='100050';source.style.willChange='transform';

    // brief anticipation: wind-up before the lunge, sells weight
    const windup=source.animate([
      {transform:'translate3d(0,0,0) scale(1) rotate(0deg)'},
      {transform:`translate3d(${(s.x-t.x)*.05}px,${(s.y-t.y)*.03}px,0) scale(1.04) rotate(${t.x>=s.x?-3:3}deg)`}
    ],{duration:220,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
    await animationDone(windup);
    sound('damage');

    const dx=t.x-s.x, dy=t.y-s.y;
    const animation=source.animate([
      {transform:`translate3d(${dx*.02}px,${dy*.02}px,0) scale(1.04)`,opacity:.98},
      {transform:`translate3d(${dx*.42}px,${dy*.42}px,0) scale(1.05) rotate(${t.x>=s.x?2:-2}deg)`,opacity:1,offset:.3},
      {transform:`translate3d(${dx*.72}px,${dy*.72}px,0) scale(1.08) rotate(${t.x>=s.x?4:-4}deg)`,opacity:1,offset:.5},
      {transform:`translate3d(${dx}px,${dy}px,0) scale(.94) rotate(${t.x>=s.x?7:-7}deg)`,opacity:1,offset:.68},
      {transform:`translate3d(${dx*.35}px,${dy*.35}px,0)`,opacity:.94,offset:.82},
      {transform:'translate3d(0,0,0) scale(1) rotate(0deg)',opacity:1}
    ],{duration:1650,easing:'cubic-bezier(.2,.76,.16,1)',fill:'forwards'});

    const sword=glyph(s.x,s.y,'damage','hv-sword-projectile',1600);
    const swordAnimation=sword.animate([
      {transform:'translate(-50%,-50%) scale(.2) rotate(-35deg)',opacity:0},
      {transform:`translate(${dx*.5}px,${dy*.5}px) scale(1) rotate(5deg)`,opacity:1,offset:.45},
      {transform:`translate(${dx}px,${dy}px) scale(1.3) rotate(35deg)`,opacity:1,offset:.78},
      {transform:`translate(${dx}px,${dy}px) scale(.5) rotate(60deg)`,opacity:0}
    ],{duration:1250,easing:'cubic-bezier(.18,.8,.15,1)',fill:'forwards'});

    // motion trail: sparks dropped along the projectile's path
    let trailTicks=0;
    const trailTimer=setInterval(()=>{
      trailTicks++;
      const p=trailTicks/9;
      if(p>1){clearInterval(trailTimer);return}
      trailSpark(s.x+dx*p,s.y+dy*p,'damage');
    },1250/9);

    await Promise.all([animationDone(animation),animationDone(swordAnimation)]);
    clearInterval(trailTimer);

    const target=el(targetUid);
    target?.classList.remove('hv-impact-shake');void target?.offsetWidth;target?.classList.add('hv-impact-shake');
    glyph(t.x,t.y,'damage','hv-impact-flare',1500);
    particleBurst(t.x,t.y,'damage',12);
    screenShake(1);

    const delta=diff&&diff.after&&diff.before?lifeDelta(diff,targetUid):null;
    if(delta&&delta.shield<0)floatNumber(targetUid,`-${Math.abs(delta.shield)}`,'shield');
    if(delta&&delta.life<0)floatNumber(targetUid,`-${Math.abs(delta.life)}`,'damage');

    source.setAttribute('style',previousStyle);if(!previousStyle)source.removeAttribute('style');else source.style.zIndex=previousZ;
  }

  async function areaDamage(casterUid,targets,diff){
    const s=point(casterUid);if(!s)return;
    sound('damage');
    glyph(s.x,s.y,'damage','hv-area-core',1900);
    particleBurst(s.x,s.y,'damage',16);
    screenShake(1.3);
    await wait(750);
    for(let i=0;i<targets.length;i++){
      const t=point(targets[i]);if(!t)continue;
      const e=el(targets[i]);
      e?.classList.remove('hv-impact-shake');void e?.offsetWidth;e?.classList.add('hv-impact-shake');
      glyph(t.x,t.y,'damage','hv-impact-flare',1400);
      particleBurst(t.x,t.y,'damage',8);
      const delta=diff?lifeDelta(diff,targets[i]):null;
      if(delta&&delta.shield<0)floatNumber(targets[i],`-${Math.abs(delta.shield)}`,'shield');
      if(delta&&delta.life<0)floatNumber(targets[i],`-${Math.abs(delta.life)}`,'damage');
      if(i<targets.length-1)await wait(380)
    }
  }

  async function travel(k,casterUid,targetUid){
    const s=point(casterUid),t=point(targetUid);if(!s||!t)return;
    const dx=t.x-s.x, dy=t.y-s.y;
    const g=glyph(s.x,s.y,k,'hv-travel',1800);
    let trailTicks=0;
    const trailTimer=setInterval(()=>{
      trailTicks++;const p=trailTicks/8;if(p>1){clearInterval(trailTimer);return}
      trailSpark(s.x+dx*p,s.y+dy*p-Math.sin(p*Math.PI)*30,k);
    },1500/8);
    const a=g.animate([
      {transform:'translate(-50%,-50%) scale(.2)',opacity:0},
      {transform:`translate(${dx*.45}px,${dy*.45-40}px) scale(1.1) rotate(180deg)`,opacity:1,offset:.42},
      {transform:`translate(${dx}px,${dy}px) scale(1.25) rotate(340deg)`,opacity:1,offset:.82},
      {transform:`translate(${dx}px,${dy-24}px) scale(.6) rotate(360deg)`,opacity:0}
    ],{duration:1500,easing:'cubic-bezier(.18,.8,.15,1)',fill:'forwards'});
    await animationDone(a);
    clearInterval(trailTimer);
    g.remove();
  }

  async function animateEffect(effect,diff){
    const k=kindOf(effect),targets=targetIds(effect,diff);sound(k);
    if(k==='damage'){
      const area=['allEnemies','allEnemiesFieldAndHand','enemyDefensor','enemyAtacante','enemySuporte'].includes(effect?.target)||targets.length>1;
      return area?areaDamage(diff.casterUid,targets,diff):(targets[0]?singleStrike(diff.casterUid,targets[0],diff):undefined);
    }
    if(k==='heal'||k==='buff'){
      for(let i=0;i<targets.length;i++){
        const uid=targets[i];await travel(k,diff.casterUid,uid);
        const p=point(uid);
        if(p){
          glyph(p.x,p.y,k,'hv-target-burst',1600);
          particleBurst(p.x,p.y,k,9);
          const e=el(uid);const pulseClass=k==='heal'?'hv-heal-pulse':'hv-buff-pulse';e?.classList.remove(pulseClass);void e?.offsetWidth;e?.classList.add(pulseClass);
          if(k==='heal'){const delta=lifeDelta(diff,uid);if(delta&&delta.life>0)floatNumber(uid,`+${delta.life}`,'heal')}
        }
        if(i<targets.length-1)await wait(420)
      }
      return;
    }
    if(k==='shield'){
      for(let i=0;i<targets.length;i++){
        const t=point(targets[i]);
        if(t){
          const e=el(targets[i]);e?.classList.remove('hv-shield-pulse');void e?.offsetWidth;e?.classList.add('hv-shield-pulse');
          glyph(t.x,t.y,k,'hv-shield-dome',1600);
          particleBurst(t.x,t.y,'shield',10);
          const delta=lifeDelta(diff,targets[i]);
          if(delta&&delta.shield>0)floatNumber(targets[i],`+${delta.shield}`,'shield');
        }
        if(i<targets.length-1)await wait(380)
      }
      return;
    }
    if(k==='status'){for(let i=0;i<targets.length;i++){const t=point(targets[i]);if(t){const e=el(targets[i]);e?.classList.remove('hv-status-pulse');void e?.offsetWidth;e?.classList.add('hv-status-pulse');glyph(t.x,t.y,k,'hv-status-rune',1600);particleBurst(t.x,t.y,'status',7)}if(i<targets.length-1)await wait(400)}return}
    if(k==='summon'){const ids=Object.keys(diff.after||{}).filter(uid=>!(diff.before||{})[uid]);for(let i=0;i<ids.length;i++){await wait(500);const t=point(ids[i]);if(t){glyph(t.x,t.y,k,'hv-summon-burst',1900);particleBurst(t.x,t.y,'summon',14);el(ids[i])?.classList.add('hv-summon-enter')}if(i<ids.length-1)await wait(500)}return}
    if(k==='sacrifice'){const source=point(diff.casterUid),ids=Object.keys(diff.before||{}).filter(uid=>!(diff.after||{})[uid]);for(let i=0;i<ids.length;i++){const t=point(ids[i]);if(source&&t){glyph(t.x,t.y,k,'hv-sacrifice-burst',1700);glyph(source.x,source.y,k,'hv-sacrifice-core',1700);particleBurst(t.x,t.y,'sacrifice',10)}if(i<ids.length-1)await wait(450)}return}
    if(k==='revive'){for(let i=0;i<targets.length;i++){const t=point(targets[i]);if(t){glyph(t.x,t.y,k,'hv-revive-rune',2100);particleBurst(t.x,t.y,'revive',14);el(targets[i])?.classList.add('hv-revive-enter')}if(i<targets.length-1)await wait(420)}return}
    if(k==='field'){const s=document.querySelector('.hv-battle-stage')?.getBoundingClientRect();if(s){glyph(s.left+s.width/2,s.top+s.height/2,k,'hv-field-weather',2300);document.querySelector('.hv-battle-stage')?.classList.add('hv-field-wave')}return}
    if(k==='taunt'){for(let i=0;i<targets.length;i++){const t=point(targets[i]);if(t){el(targets[i])?.classList.add('hv-taunt-shake');glyph(t.x,t.y,k,'hv-taunt-mark',1500);particleBurst(t.x,t.y,'taunt',6)}if(i<targets.length-1)await wait(400)}return}
    if(k==='move'){for(let i=0;i<targets.length;i++){const t=point(targets[i]);if(t)glyph(t.x,t.y,k,'hv-move-arrow',1500);if(i<targets.length-1)await wait(400)}return}
    if(k==='delayed'){const s=point(diff.casterUid);if(s)glyph(s.x,s.y,k,'hv-delayed-rune',1700)}
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

  window.playCombatSequence=playCombatSequence;

  // game-flow.js is now the sole owner of resolution sequencing. These flags
  // prevent the legacy rules-fixes wrapper from installing a second scheduler.
  window.__hvPresentationWrapped=true;
  window.__hvAutoResolveWrapped=true;

  window.HVCombatDiagnostics={locate(uid){return point(uid)},preview(uid,targetUid,kind='damage'){if(kind==='damage'&&uid&&targetUid)singleStrike(uid,targetUid);else{const p=point(uid);if(p)glyph(p.x,p.y,kind,'hv-combat-diagnostic')}},describe(){return{playCombatSequence:typeof window.playCombatSequence==='function',cards:document.querySelectorAll('.unit-card[data-uid]').length,fxLayer:!!document.getElementById('hvFxLayer')}}};
})();
