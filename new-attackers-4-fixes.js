// ===================== MECÂNICAS DO LOTE 4 =====================
(() => {
  const getUnits=()=>typeof allUnitsAll==='function'?allUnitsAll():[];
  const alive=u=>u&&!u.dead&&u.life>0;
  const enemies=u=>getUnits().filter(x=>alive(x)&&x.owner!==u.owner);
  const allies=u=>getUnits().filter(x=>alive(x)&&x.owner===u.owner);
  const damage=(u,n,ctx)=>{if(typeof Engine!=='undefined'&&Engine.applyDamage)Engine.applyDamage(u,Math.max(0,n),ctx?.log||window.logMsg,ctx?.caster);};
  const heal=(u,n)=>{if(!u)return;u.life=Math.min(u.maxLife??u.life+n,u.life+n);u.wasHealedThisTurn=true;};
  const st=(u,name,value=1,duration=1)=>{u.statuses ||= []; const q=u.statuses.find(s=>s.status===name); if(q){q.value=value;q.duration=duration}else u.statuses.push({status:name,value,duration});};
  function poisonTick(unit, abilitySpeed, ctx){
    const stacks=(unit.statuses||[]).find(s=>s.status==='poison');
    if(stacks?.value>0){damage(unit,abilitySpeed,ctx); stacks.value--; if(stacks.value<=0)unit.statuses=unit.statuses.filter(s=>s!==stacks);}
  }
  function boot(){
    if(typeof CARD_DB==='undefined'||typeof Engine==='undefined')return setTimeout(boot,100);
    const old=Engine.runEffects;
    Engine.runEffects=function(effects,ctx,log){
      const rest=[];
      for(const e of effects||[]){
        const c=ctx.caster;
        if(e.type==='kyrielBonusIfAllyDamaged'){
          const hit=allies(c).some(a=>a.wasDamagedThisTurn); if(hit){const t=ctx.chosenTarget||enemies(c)[0];if(t)damage(t,6,ctx)} continue;
        }
        if(e.type==='kyrielFastestOnly'){st(c,'kyrielEnemyFastestOnly',1,2);continue;}
        if(e.type==='kyrielPulse'){
          const hit=allies(c).some(a=>a.wasDamagedThisTurn); for(const t of enemies(c))damage(t,4,ctx); for(const a of allies(c))heal(a,4); if(hit){for(const t of enemies(c))damage(t,4,ctx);for(const a of allies(c))heal(a,4)} continue;
        }
        if(e.type==='gusRepeatByLife'){
          const n=Math.max(0,Math.floor(c.life));for(let i=0;i<n;i++)for(const t of enemies(c))damage(t,Math.max(1,1*(c.gusDamageMultiplier||1)),ctx);continue;
        }
        if(e.type==='deadricAttack'){
          const t=ctx.chosenTarget||enemies(c)[0];if(t){let n=e.base; n+=allies(c).filter(a=>a.wasDamagedThisTurn).length*e.bonusPerDamagedAlly;damage(t,n,ctx)}continue;
        }
        if(e.type==='deadricSpeedAttack'){
          const t=ctx.chosenTarget||enemies(c)[0];const v=t?.lastOriginalAbilitySpeed||0;if(t){damage(t,v,ctx);t.nextAbilitySpeed=v}continue;
        }
        if(e.type==='gavinDouble'){
          const t=ctx.chosenTarget||enemies(c)[0];const a=allies(c)[0];if(t)damage(t,4,ctx);if(a)heal(a,4);if(t)damage(t,8,ctx);if(a)heal(a,8);continue;
        }
        if(e.type==='gavinSlow'){
          const t=ctx.chosenTarget||enemies(c)[0];if(t){damage(t,2,ctx);st(t,'slow',2,1);st(t,'gavinSlowTrigger',1,1)}continue;
        }
        if(e.type==='rotPoisonAttack'){
          const t=ctx.chosenTarget||enemies(c)[0];if(t){const p=(t.statuses||[]).find(s=>s.status==='poison')?.value||0;damage(t,15,ctx);for(const x of enemies(c).filter(x=>x!==t))damage(x,p*3,ctx)}continue;
        }
        if(e.type==='rotCreatedChoice'){
          const ally=getUnits().find(x=>x.owner===c.owner&&alive(x)&&x.isToken);const foe=getUnits().find(x=>x.owner!==c.owner&&alive(x)&&x.isToken);if(foe)damage(foe,10,ctx);else if(ally){ally.life=0;ally.dead=true}continue;
        }
        rest.push(e);
      }
      if(rest.length)old(rest,ctx,log);
    };
    // Veneno: sempre que uma carta envenenada usa uma habilidade, recebe dano igual à velocidade ORIGINAL daquela habilidade.
    if(!window.__hvPoisonHook){
      window.__hvPoisonHook=true;
      const original=window.executeAbility;
      if(typeof original==='function')window.executeAbility=function(caster,idx,target){
        const ab=caster?.abilities?.[idx];const speed=ab?.speed||0;poisonTick(caster,speed,{caster,log:window.logMsg});return original(caster,idx,target);
      };
    }
    // Passiva de Gus: revive até 4 vezes, dobrando vida máxima e dano.
    const oldDamage=Engine.applyDamage;
    Engine.applyDamage=function(unit,amount,log,source){
      const before=unit?.life;const r=oldDamage(unit,amount,log,source);
      if(unit&&before>0&&unit.life<=0&&unit.cardId==='gus'&&(unit.gusRevives||0)<4){
        unit.gusRevives=(unit.gusRevives||0)+1;unit.maxLife*=2;unit.life=unit.maxLife;unit.gusDamageMultiplier=(unit.gusDamageMultiplier||1)*2;unit.dead=false;
      }
      return r;
    };
  }
  boot();
})();
