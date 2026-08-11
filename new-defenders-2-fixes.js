// ===================== MECÂNICAS DOS NOVOS DEFENSORES II =====================
(() => {
  if (window.__hvDefenders2Fixes) return;
  window.__hvDefenders2Fixes = true;

  const addStatus = (u,status,value=1,duration=1) => {
    if (!u) return;
    u.statuses ||= [];
    const old=u.statuses.find(s=>s.status===status);
    if(old){old.value=value;old.duration=duration;} else u.statuses.push({status,value,duration});
  };
  const has = (u,status) => !!u?.statuses?.some(s=>s.status===status);
  const alive = u => !!u && !u.dead && u.life>0;
  const enemies = ctx => (ctx.enemyTeam||[]).filter(alive);
  const allies = ctx => (ctx.allyTeam||[]).filter(alive);
  const effective = u => typeof Engine.getCurrentLife==='function' ? Engine.getCurrentLife(u) : (u.life+(u.shield?.value||0));

  // Marca a unidade que acabou de usar uma habilidade. Isso alimenta Amelia e outras cartas que observam a ordem.
  const originalRun = Engine.runEffects;
  Engine.runEffects = function(effects,ctx,log){
    const custom=[];
    for(const e of (effects||[])){
      if(!e?.type?.startsWith('amelia') && !e?.type?.startsWith('anuben') && !e?.type?.startsWith('leticia') && !e?.type?.startsWith('lou') && !e?.type?.startsWith('sirius') && !e?.type?.startsWith('victor') && !e?.type?.startsWith('vitor') && !e?.type?.startsWith('yvrel') && !e?.type?.startsWith('bork')) custom.push(e);
    }
    const caster=ctx?.caster;
    if(caster) caster.actedThisTurn=true;

    for(const e of (effects||[])){
      if(!e?.type) continue;
      switch(e.type){
        case 'ameliaPunishActed':
          for(const u of enemies(ctx)) if(u.actedThisTurn) Engine.applyDamage(u,15,log,caster);
          break;
        case 'ameliaTempo':
          for(const u of allies(ctx)) if(u!==caster) addStatus(u,'speedNextTurn',5,1);
          for(const u of enemies(ctx)) addStatus(u,'speedNextTurn',3,1);
          log(`${caster.name} altera a velocidade do próximo turno.`);
          break;
        case 'anubenSoloTurn': addStatus(caster,'onlyCasterNextTurn',1,1); log(`${caster.name} controla o próximo turno.`); break;
        case 'anubenMark':
          for(const u of [ctx.chosenTarget].filter(alive)) addStatus(u,'anubenMark',1,99);
          log(`${ctx.chosenTarget?.name||'Alvo'} foi marcado pelo tempo.`);
          break;
        case 'leticiaMassAttack': {
          const healedLast=!!caster.healedLastTurn; const dmg=healedLast?8:18;
          for(const u of enemies(ctx)) Engine.applyDamage(u,dmg,log,caster);
          break;
        }
        case 'leticiaSingleAttack': {
          const dmg=caster.healedLastTurn?25:15;
          if(alive(ctx.chosenTarget)) Engine.applyDamage(ctx.chosenTarget,dmg,log,caster);
          break;
        }
        case 'louAttackHat': {
          const a=ctx.chosenTarget;
          const b=enemies(ctx).find(u=>u!==a);
          if(a) Engine.applyDamage(a,8,log,caster);
          if(b) Engine.applyDamage(b,6,log,caster);
          for(const u of [a,b].filter(Boolean)) if(has(u,'uglyHat')) addStatus(u,'cannotHeal',1,2);
          break;
        }
        case 'louAttackJeans': {
          const a=ctx.chosenTarget;
          const b=enemies(ctx).find(u=>u!==a);
          if(a) Engine.applyDamage(a,8,log,caster);
          if(b) Engine.applyDamage(b,6,log,caster);
          for(const u of [a,b].filter(Boolean)) if(has(u,'tackyJeans')) addStatus(u,'cooldownAll',1,1);
          break;
        }
        case 'siriusDoubleNext': addStatus(caster,'siriusDoubleNext',1,99); break;
        case 'siriusHeroBoost':
          for(const u of allies(ctx)) if(u!==caster && u.role!=='defensor') addStatus(u,'damageBoost',2,1);
          break;
        case 'siriusSwapDefender':
          addStatus(caster,'siriusSwapPending',1,1);
          caster.maxLife+=15; caster.life+=15;
          log(`${caster.name} recebe +15 de vida.`);
          break;
        case 'victorSoldierAttack': {
          const target=ctx.chosenTarget;
          if(!alive(target)) break;
          Engine.applyDamage(target,8,log,caster);
          const soldiers=allies(ctx).filter(u=>u.cardId==='soldado');
          for(const s of soldiers){
            if(!alive(target)) break;
            Engine.applyDamage(target,8+(s.soldierBonus||0),log,s);
          }
          break;
        }
        case 'victorSoldierBuff':
          for(const u of allies(ctx).filter(x=>x.cardId==='soldado')) u.soldierBonus=(u.soldierBonus||0)+2;
          addStatus(caster,'soldierBonusPermanent',2,9999);
          break;
        case 'vitorBloodDamage': {
          const n=caster.counters?.cristalSangue||0;
          const dmg=3*Math.pow(2,n);
          Engine.applyDamage(caster,dmg,log,caster);
          if(alive(ctx.chosenTarget)) Engine.applyDamage(ctx.chosenTarget,dmg,log,caster);
          break;
        }
        case 'vitorBloodShield': {
          const n=caster.counters?.cristalSangue||0;
          const amount=6+3*n;
          const t=ctx.chosenTarget;
          if(t){t.shield={value:amount,duration:2};log(`${t.name} ganha um Escudo de ${amount}.`);}
          break;
        }
        case 'yvrelUntargetable': if(ctx.lastTarget) addStatus(ctx.lastTarget,'untargetable',1,1); break;
        case 'yvrelLast': if(ctx.lastTarget) addStatus(ctx.lastTarget,'actLast',1,1); break;
        case 'yvrelCopyAbility':
          addStatus(caster,'yvrelCopyPending',1,1);
          // A habilidade é selecionada pelo fluxo de combate; guardamos o alvo aqui.
          caster.yvrelCopyTarget=ctx.chosenTarget;
          break;
        case 'borkDoubleHit': {
          const t=ctx.chosenTarget;
          if(t) { Engine.applyDamage(t,1,log,caster); if(alive(t)) Engine.applyDamage(t,1,log,caster); }
          break;
        }
        case 'borkShieldHit': {
          const t=ctx.chosenTarget;
          if(!t) break;
          const before=effective(t); Engine.applyDamage(t,7,log,caster); const dealt=Math.max(0,before-effective(t));
          if(dealt>0) caster.shield={value:dealt,duration:1};
          log(`${caster.name} ganha um Escudo de ${dealt}.`);
          break;
        }
      }
    }
    return originalRun(custom,ctx,log);
  };

  // Marca Anuben para explodir quando ele próprio causar dano nela.
  const originalDamage=Engine.applyDamage;
  Engine.applyDamage=function(target,amount,log,source){
    const dealt=originalDamage(target,amount,log,source);
    if(source?.cardId==='anuben' && has(target,'anubenMark') && dealt>0){
      target.statuses=target.statuses.filter(s=>s.status!=='anubenMark');
      if(alive(target)) originalDamage(target,15,log,source);
    }
    // Bork: dano extra baseado na vida atual do alvo depois do primeiro dano.
    if(source?.cardId==='bork' && !source.__borkProc && dealt>0 && alive(target)){
      source.__borkProc=true;
      const extra=Math.ceil(effective(target)*0.10);
      if(extra>0) originalDamage(target,extra,log,source);
      source.__borkProc=false;
    }
    return dealt;
  };

  // Passivas simples observadas sem alterar o motor principal.
  const passiveTick=()=>{
    try{
      if(!window.state?.players) return;
      for(const p of state.players){
        const units=[...Object.values(p.slots||{}).map(s=>s?.active).filter(Boolean),...(p.extraUnits||[])].filter(alive);
        for(const u of units){
          if(u.cardId==='lou' && !u.__louDressed){
            const enemyTeam=state.players[1-state.players.indexOf(p)];
            const enemies2=[...Object.values(enemyTeam?.slots||{}).map(s=>s?.active).filter(Boolean),...(enemyTeam?.extraUnits||[])].filter(alive);
            enemies2.forEach((e,i)=>addStatus(e,i%2?'tackyJeans':'uglyHat',1,9999));
            u.__louDressed=true;
          }
          if(u.cardId==='leticia' && window.__hvEndTurnTick){ /* reservado para o tick de fim de turno */ }
        }
      }
    }catch(_){ }
  };
  setInterval(passiveTick,500);
})();
