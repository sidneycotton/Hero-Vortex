/* Effect-specific combat presentation. Loaded after app.js and the base combat audio layer. */
(() => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  function iconFor(kind) {
    const icons={damage:'sword',heal:'heart',shield:'shield',status:'target',buff:'spark',summon:'spark',field:'spark',taunt:'target',sacrifice:'sword',revive:'heart'};
    return typeof window.svgIcon==='function' ? svgIcon(icons[kind]||'spark') : '';
  }

  function effectClass(effect) {
    if(!effect) return 'buff';
    if(effect.type==='dealDamage'||effect.type==='conditionalDamage'||effect.type==='conditionalRepeat')return 'damage';
    if(effect.type==='heal'||effect.type==='conditionalHeal'||effect.type==='spendCounterToHeal'||effect.type==='conditionalLifesteal')return 'heal';
    if(effect.type==='applyShield')return 'shield';
    if(effect.type==='applyStatus')return 'status';
    if(effect.type==='createToken')return 'summon';
    if(effect.type==='applyFieldEffect')return 'field';
    if(effect.type==='taunt')return 'taunt';
    if(effect.type==='sacrificeToken')return 'sacrifice';
    if(effect.type==='reviveCopy')return 'revive';
    return 'buff';
  }

  function playSound(kind){
    const map={damage:'impact',heal:'heal',shield:'shield',status:'status',buff:'buff',summon:'summon',field:'field',taunt:'taunt',sacrifice:'sacrifice',revive:'revive'};
    window.HVAudio?.play(map[kind]||'buff');
  }

  function pulse(el,kind){
    if(!el)return;
    el.classList.remove('hv-fx-'+kind);
    void el.offsetWidth;
    el.classList.add('hv-fx-'+kind);
    const glyph=document.createElement('div');
    glyph.className='hv-type-glyph hv-type-glyph-'+kind;
    glyph.innerHTML=iconFor(kind);
    el.appendChild(glyph);
    setTimeout(()=>{glyph.remove();el.classList.remove('hv-fx-'+kind);},900);
  }

  function stageBurst(kind){
    const stage=document.querySelector('.hv-battle-stage');
    if(!stage)return;
    const burst=document.createElement('div');
    burst.className='hv-stage-burst hv-stage-burst-'+kind;
    burst.innerHTML=iconFor(kind);
    stage.appendChild(burst);
    setTimeout(()=>burst.remove(),1100);
  }

  function newUnits(diff){
    return Object.keys(diff.after||{}).filter(uid=>!(diff.before||{})[uid]);
  }

  function revivedUnits(diff){
    return Object.keys(diff.after||{}).filter(uid=>{
      const b=diff.before?.[uid],a=diff.after?.[uid];
      return b && a && b.dead && !a.dead;
    });
  }

  function removedUnits(diff){
    return Object.keys(diff.before||{}).filter(uid=>!(diff.after||{})[uid]);
  }

  const basePlay=window.playCombatSequence;
  if(typeof basePlay!=='function')return;

  window.playCombatSequence=function enhancedCombatSequence(diff){
    basePlay(diff);
    if(!diff)return;
    const caster=document.querySelector(`.unit-card[data-uid="${diff.casterUid}"]`);
    const ability=CARD_DB[getUnit(diff.casterUid)?.cardId]?.abilities?.[diff.abilityIdx];
    if(!ability)return;

    // Keep the original attack/impact animation, then layer a distinct identity
    // on non-damage effects so the player can read the result at a glance.
    const effects=ability.effects||[];
    let offset=120;
    for(const effect of effects){
      const kind=effectClass(effect);
      const targets=[];
      const targetUid=diff.targetUid;
      if(targetUid)targets.push(targetUid);
      if(effect.target==='allEnemies'||effect.target==='allAllies'||effect.target==='allAlliesIncludingHand'){
        for(const uid of Object.keys(diff.after||{}))if(!targets.includes(uid))targets.push(uid);
      }
      if(kind==='damage' && (effect.type==='dealDamage'||effect.type==='conditionalDamage')){
        // Physical damage is already represented by the card strike.
        continue;
      }
      setTimeout(()=>{
        playSound(kind);
        if(kind==='field'){stageBurst(kind);return;}
        if(kind==='summon'){
          newUnits(diff).forEach(uid=>pulse(document.querySelector(`.unit-card[data-uid="${uid}"]`),'summon'));
          if(!newUnits(diff).length)stageBurst(kind);
          return;
        }
        if(kind==='revive'){
          const ids=revivedUnits(diff);ids.forEach(uid=>pulse(document.querySelector(`.unit-card[data-uid="${uid}"]`),'revive'));
          if(!ids.length&&caster)pulse(caster,'revive');
          return;
        }
        if(kind==='sacrifice'){
          const ids=removedUnits(diff);ids.forEach(uid=>pulse(document.querySelector(`.unit-card[data-uid="${uid}"]`),'sacrifice'));
          if(!ids.length&&caster)pulse(caster,'sacrifice');
          return;
        }
        const valid=targets.filter(uid=>diff.after?.[uid]);
        if(valid.length)valid.forEach(uid=>pulse(document.querySelector(`.unit-card[data-uid="${uid}"]`),kind));
        else if(caster)pulse(caster,kind);
      },offset);
      offset+=115;
    }
  };
})();
