/* Hero Vortex combat presentation: the game-flow owns resolution; this module owns what the player sees. */
(() => {
  const css = `
    .hv-battle-screen{position:relative;overflow:hidden}
    .hv-battle-screen .hv-battle-log{display:none!important}
    .hv-battle-screen .hv-cast-banner{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);z-index:80;width:min(720px,calc(100% - 32px));display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:center;padding:13px 18px;border:1px solid rgba(218,184,101,.28);border-radius:16px;background:rgba(12,16,23,.92);box-shadow:0 18px 55px rgba(0,0,0,.5),0 0 30px rgba(218,184,101,.08);backdrop-filter:blur(16px);animation:hvCastIn .25s ease-out both}
    .hv-cast-name{font:700 .72rem/1 var(--font-accent);letter-spacing:.12em;text-transform:uppercase;color:#e0c77e;white-space:nowrap}
    .hv-cast-text{font:600 1rem/1.3 var(--font-body);color:#f3f5f8}
    .hv-cast-banner::before{content:'AÇÃO';position:absolute;left:14px;top:-8px;padding:3px 7px;border-radius:6px;background:#0c1017;border:1px solid rgba(218,184,101,.25);font:700 .55rem/1 var(--font-accent);letter-spacing:.14em;color:#8e98a8}
    @keyframes hvCastIn{from{opacity:0;transform:translate(-50%,10px) scale(.98)}to{opacity:1;transform:translate(-50%,0) scale(1)}}
    .hv-battle-screen .unit-card{position:relative;overflow:visible}
    .hv-type-glyph{position:absolute;left:50%;top:50%;width:42px;height:42px;display:grid;place-items:center;z-index:90;pointer-events:none;transform:translate(-50%,-50%) scale(.35);opacity:0;animation:hvGlyph .72s cubic-bezier(.2,.85,.2,1) both;filter:drop-shadow(0 8px 14px rgba(0,0,0,.55))}
    .hv-type-glyph svg{width:30px;height:30px;display:block}
    .hv-type-glyph-damage{filter:drop-shadow(0 0 10px rgba(255,100,90,.7))}.hv-type-glyph-heal{filter:drop-shadow(0 0 10px rgba(90,235,150,.7))}.hv-type-glyph-shield{filter:drop-shadow(0 0 10px rgba(90,175,255,.75))}.hv-type-glyph-status{filter:drop-shadow(0 0 10px rgba(185,120,255,.7))}.hv-type-glyph-buff{filter:drop-shadow(0 0 10px rgba(245,205,105,.7))}
    @keyframes hvGlyph{0%{opacity:0;transform:translate(-50%,-50%) scale(.3) rotate(-12deg)}22%{opacity:1;transform:translate(-50%,-65%) scale(1.12) rotate(3deg)}68%{opacity:1;transform:translate(-50%,-92%) scale(1)}100%{opacity:0;transform:translate(-50%,-135%) scale(.8)}}
    .hv-battle-screen .hv-fx-heal{animation:hvHeal .7s ease-out}.hv-battle-screen .hv-fx-shield{animation:hvShield .75s ease-out}.hv-battle-screen .hv-fx-status{animation:hvStatus .65s ease-out}.hv-battle-screen .hv-fx-buff{animation:hvBuff .65s ease-out}.hv-battle-screen .hv-fx-summon{animation:hvBuff .65s ease-out}.hv-battle-screen .hv-fx-revive{animation:hvBuff .8s ease-out}
    @keyframes hvHeal{35%{box-shadow:0 0 0 7px rgba(90,240,140,.18),0 0 30px rgba(90,240,140,.35)}}@keyframes hvShield{35%{box-shadow:inset 0 0 28px rgba(90,175,255,.2),0 0 28px rgba(90,175,255,.4)}}@keyframes hvStatus{30%{filter:saturate(1.4) brightness(1.15)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}@keyframes hvBuff{40%{transform:scale(1.035)}70%{transform:scale(.99)}}
    .hv-stage-burst{position:absolute;left:50%;top:50%;width:90px;height:90px;display:grid;place-items:center;z-index:70;pointer-events:none;transform:translate(-50%,-50%) scale(.35);opacity:0;border-radius:50%;border:1px solid rgba(218,184,101,.4);background:radial-gradient(circle,rgba(218,184,101,.18),transparent 70%);animation:hvBurst .9s ease-out both}.hv-stage-burst svg{width:40px;height:40px}@keyframes hvBurst{25%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.5)}}
    @media(max-width:650px){.hv-battle-screen .hv-cast-banner{bottom:10px;width:calc(100% - 18px);grid-template-columns:1fr;gap:4px;padding:11px 13px}.hv-cast-text{font-size:.9rem}.hv-type-glyph{width:34px;height:34px}.hv-type-glyph svg{width:25px;height:25px}}
  `;
  const st=document.createElement('style');st.id='hv-combat-presentation-css';st.textContent=css;document.head.appendChild(st);

  const iconFor=k=>{const i={damage:'sword',heal:'heart',shield:'shield',status:'target',buff:'spark',summon:'spark',field:'spark',taunt:'target',sacrifice:'sword',revive:'heart'};return typeof window.svgIcon==='function'?window.svgIcon(i[k]||'spark'):''};
  const effectKind=e=>{if(!e)return'buff';if(['dealDamage','conditionalDamage','conditionalRepeat'].includes(e.type))return'damage';if(['heal','conditionalHeal','spendCounterToHeal','conditionalLifesteal'].includes(e.type))return'heal';if(e.type==='applyShield')return'shield';if(e.type==='applyStatus')return'status';if(e.type==='createToken')return'summon';if(e.type==='applyFieldEffect')return'field';if(e.type==='taunt')return'taunt';if(e.type==='sacrificeToken')return'sacrifice';if(e.type==='reviveCopy')return'revive';return'buff'};
  const sound=k=>window.HVAudio?.play({damage:'impact',heal:'heal',shield:'shield',status:'status',buff:'buff',summon:'summon',field:'field',taunt:'buff',sacrifice:'impact',revive:'heal'}[k]||'buff');
  const pulse=(el,k)=>{if(!el)return;el.classList.remove('hv-fx-'+k);void el.offsetWidth;el.classList.add('hv-fx-'+k);const g=document.createElement('div');g.className='hv-type-glyph hv-type-glyph-'+k;g.innerHTML=iconFor(k);el.appendChild(g);setTimeout(()=>{g.remove();el.classList.remove('hv-fx-'+k)},850)};
  const added=d=>Object.keys(d.after||{}).filter(u=>!(d.before||{})[u]);
  const revived=d=>Object.keys(d.after||{}).filter(u=>d.before?.[u]?.dead&&!d.after[u].dead);
  const removed=d=>Object.keys(d.before||{}).filter(u=>!(d.after||{})[u]);

  /* This is the actual playback entry point. game-flow calls it after each effect resolves. */
  window.playCombatSequence=function(diff){
    if(!diff)return;
    const caster=document.querySelector(`.unit-card[data-uid="${diff.casterUid}"]`);
    const casterUnit=typeof getUnit==='function'?getUnit(diff.casterUid):null;
    const ability=casterUnit&&window.CARD_DB?CARD_DB[casterUnit.cardId]?.abilities?.[diff.abilityIdx]:null;
    if(!ability)return;
    let delay=80;
    for(const e of ability.effects||[]){
      const k=effectKind(e);const targets=[];
      if(diff.targetUid)targets.push(diff.targetUid);
      if(['allEnemies','allAllies','allAlliesIncludingHand'].includes(e.target))Object.keys(diff.after||{}).forEach(uid=>{if(!targets.includes(uid))targets.push(uid)});
      if(k==='damage'&&['dealDamage','conditionalDamage'].includes(e.type)){
        const valid=targets.filter(uid=>diff.after?.[uid]);
        setTimeout(()=>{sound('damage');valid.forEach(uid=>pulse(document.querySelector(`.unit-card[data-uid="${uid}"]`),'damage'));if(!valid.length)pulse(caster,'damage')},delay);delay+=150;continue;
      }
      setTimeout(()=>{
        sound(k);
        if(k==='field'){const s=document.querySelector('.hv-battle-stage');if(s){const b=document.createElement('div');b.className='hv-stage-burst';b.innerHTML=iconFor(k);s.appendChild(b);setTimeout(()=>b.remove(),950)}return}
        if(k==='summon'){added(diff).forEach(uid=>pulse(document.querySelector(`.unit-card[data-uid="${uid}"]`),k));if(!added(diff).length)pulse(caster,k);return}
        if(k==='revive'){revived(diff).forEach(uid=>pulse(document.querySelector(`.unit-card[data-uid="${uid}"]`),k));if(!revived(diff).length)pulse(caster,k);return}
        if(k==='sacrifice'){removed(diff).forEach(uid=>pulse(document.querySelector(`.unit-card[data-uid="${uid}"]`),k));if(!removed(diff).length)pulse(caster,k);return}
        const valid=targets.filter(uid=>diff.after?.[uid]);valid.length?valid.forEach(uid=>pulse(document.querySelector(`.unit-card[data-uid="${uid}"]`),k)):pulse(caster,k);
      },delay);delay+=120;
    }
  };
})();