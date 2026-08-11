// ===================== MECÂNICAS DOS SUPORTES 1 =====================
(() => {
const units=()=>typeof allUnitsAll==='function'?allUnitsAll():[];
const alive=u=>u&&!u.dead&&u.life>0;
const foes=u=>units().filter(x=>alive(x)&&x.owner!==u.owner);
const friends=u=>units().filter(x=>alive(x)&&x.owner===u.owner);
const dmg=(u,n,c)=>{if(!u)return;if(typeof Engine!=='undefined'&&Engine.applyDamage)Engine.applyDamage(u,Math.max(0,n),c?.log||window.logMsg,c?.caster)};
const heal=(u,n)=>{if(!u)return;u.life=Math.min(u.maxLife??u.life+n,u.life+n);u.wasHealedThisTurn=true};
const status=(u,name,value=1,duration=1)=>{u.statuses ||= [];const s=u.statuses.find(x=>x.status===name);if(s){s.value=value;s.duration=duration}else u.statuses.push({status:name,value,duration})};
const getStatus=(u,name)=>u?.statuses?.find(s=>s.status===name);
function boot(){
 if(typeof CARD_DB==='undefined'||typeof Engine==='undefined')return setTimeout(boot,100);
 const old=Engine.runEffects;
 Engine.runEffects=function(effects,ctx,log){const rest=[];for(const e of effects||[]){const c=ctx.caster;
  if(e.type==='andressaHealShield'){const a=ctx.chosenTarget||friends(c)[0];if(a){heal(a,5);a.shield=(a.shield||{value:0}).value+5;if(c.partnerUid===a.uid){heal(c,5);c.shield=(c.shield||{value:0}).value+5}}continue}
  if(e.type==='andressaGuard'){c.shield=(c.shield||{value:0}).value+10;status(c,'andressaShieldConversion',1,2);continue}
  if(e.type==='donnaPlague'){const t=ctx.chosenTarget||foes(c)[0];if(t)status(t,'plague',e.value,9999);continue}
  if(e.type==='donnaPlagueAll'){for(const t of foes(c))status(t,'plague',(getStatus(t,'plague')?.value||0)+e.value,9999);continue}
  if(e.type==='donnaCleanPlague'){const t=ctx.chosenTarget||foes(c)[0];if(t){const p=getStatus(t,'plague');if(p)p.value=Math.max(0,p.value-3)}for(const a of friends(c))a.life=Math.min(a.maxLife??a.life+10,a.life+10);continue}
  if(e.type==='neonHealHaste'){for(const a of friends(c)){heal(a,4);status(a,'speedBoost',3,1)}continue}
  if(e.type==='neonAttackEcho'){status(c,'neonAttackEcho',1,2);continue}
  if(e.type==='neonEndTurnAttacks'){status(c,'neonEndTurnAttacks',1,2);continue}
  if(e.type==='vanessaAllyAttack'){const a=friends(c).find(x=>x!==c);if(a){const f=foes(c);if(f[0])dmg(f[0],6,{caster:a,log});dmg(c,3,{caster:a,log});for(const t of f.slice(1))dmg(t,6,{caster:a,log})}continue}
  if(e.type==='vanessaTaunt'){status(c,'tauntAttacker',1,1);status(c,'vanessaHealOnDamage',1,1);continue}
  if(e.type==='romuloTripleAttack'){const t=ctx.chosenTarget||foes(c)[0];if(t){for(const a of [c,...friends(c).filter(x=>x.role==='atacante'||x.role==='defensor')])dmg(t,3,{caster:a,log})}continue}
  if(e.type==='romuloBuffAttack'){for(const a of friends(c)){dmg(a,3,{caster:c,log});status(a,'romuloNextAttack',3,2)}continue}
  if(e.type==='romuloHeal'){for(const a of friends(c)){heal(a,6);if(a.wasDamagedLastTurn)heal(a,6)}continue}
  if(e.type==='darioAttack'){const t=ctx.chosenTarget||foes(c)[0];if(t){dmg(t,c.form==='sombra'?14:7,{caster:c,log});if(c.form==='senador')heal(friends(c)[0],7)}continue}
  if(e.type==='darioShield'){const a=ctx.chosenTarget||friends(c)[0];if(a){if(c.form==='senador')a.shield=(a.shield||{value:0}).value*2;else if(c.form==='sombra'){const f=foes(c)[0];if(f){a.shield=(a.shield||{value:0}).value+(f.shield?.value||0);f.shield={value:0}}}else a.shield=(a.shield||{value:0}).value+5}continue}
  if(e.type==='zeevDecayShield'){const t=ctx.chosenTarget||friends(c)[0];if(t){t.shield=(t.shield||{value:0}).value+8;status(t,'decay',4,99);status(t,'zeevDecayHeal',1,99)}continue}
  if(e.type==='zeevAccelerateDecay'){const t=ctx.chosenTarget||foes(c)[0];const d=getStatus(t,'decay');if(d)d.value+=2;continue}
  if(e.type==='brendaNoCreate'){status(c,'noCreate',1,1);continue}
  if(e.type==='brendaTeamShield'){for(const a of friends(c))a.shield=(a.shield||{value:0}).value+7;continue}
  if(e.type==='brendaAttack'){const t=ctx.chosenTarget||foes(c)[0];if(t)dmg(t,1+(c.brendaBonus||0),{caster:c,log});continue}
  if(e.type==='brendaShieldDamage'){const a=ctx.chosenTarget||friends(c)[0];if(a){a.shield=(a.shield||{value:0}).value+15;dmg(a,5,{caster:c,log})}continue}
  if(e.type==='jairoPeace'){status(c,'noDamageNextTurn',1,2);for(const a of friends(c))heal(a,5);continue}
  if(e.type==='jairoMaxLife'){const t=ctx.chosenTarget||foes(c)[0];if(t){t.maxLife=Math.max(0,(t.maxLife||t.life)-8);t.life=Math.min(t.life,t.maxLife)}continue}
  if(e.type==='jairoUntouchedHeal'){const n=foes(c).filter(t=>!t.wasDamagedThisTurn).length;if(n){const a=ctx.chosenTarget||friends(c)[0];heal(a,6*n)}continue}
  if(e.type==='baraoToxina'){status(c,'toxinaActive',1,1);const targets=ctx.chosenTargets?.length?ctx.chosenTargets:ctx.chosenTarget?[ctx.chosenTarget]:foes(c);for(const t of targets){if(t)status(t,'toxina',c.toxinaPower||6,1)}continue}
  if(e.type==='baraoImprovedToxina'){c.toxinaPower=12;status(c,'toxinaImproved',1,99);continue}
  rest.push(e);
 }if(rest.length)old(rest,ctx,log)};
 // Parceria da Andressa: escolhe o primeiro aliado elegível ao ser jogada; o dano recebido converte metade em cura.
 const od=Engine.applyDamage;Engine.applyDamage=function(unit,amount,log,source){const r=od(unit,amount,log,source);if(unit?.cardId==='andressa'&&unit.partnerUid){const p=units().find(x=>x.uid===unit.partnerUid);if(p&&amount>0)heal(p,Math.floor(amount/2))}return r};
 // Praga: dano no final do turno igual aos contadores, sem consumir os contadores.
 window.__hvPlagueTick=()=>{for(const u of units()){const p=getStatus(u,'plague');if(p?.value>0)dmg(u,p.value,{caster:null,log:window.logMsg})}};
 // Decaimento de Ze'ev em aliados cura em vez de causar dano.
 window.__hvZeevDecayTick=()=>{for(const u of units()){const d=getStatus(u,'decay');if(d?.value>0&&getStatus(u,'zeevDecayHeal')){heal(u,d.value);d.value=Math.max(0,d.value-1)}}};
 // Forma do Dário.
 const oh=Engine.runEffects;
 if(!window.__hvDarioDamageHook){window.__hvDarioDamageHook=true;const orig=Engine.applyDamage;Engine.applyDamage=function(unit,amount,log,source){if(unit?.cardId==='dario'&&source?.owner===unit.owner)unit.form='sombra';const r=orig(unit,amount,log,source);return r}}
}
boot();
})();
