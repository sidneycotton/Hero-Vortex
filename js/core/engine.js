// ===================== MOTOR DE EFEITOS =====================
// Interpreta os "effects" declarados no cards.json e aplica no estado do jogo.

const Engine = (() => {

  // Vida efetiva usada pelas REGRAS = vida real + escudo atual.
  // A interface NÃO usa esta soma: vida e escudo são exibidos separadamente.
  function getCurrentLife(unit) {
    if (!unit) return 0;
    return Math.max(0, (Number(unit.life) || 0) + (unit.shield ? (Number(unit.shield.value) || 0) : 0));
  }

  function clampLife(unit) {
    unit.life = Math.max(0, Math.min(unit.maxLife, unit.life));
    if (unit.life === 0) unit.dead = true;
  }

  function applyDamage(unit, amount, log, source = null) {
    if (!unit || unit.dead) return 0;
    let dmg = amount;

    const cap = unit.statuses.find(s => s.status === 'damageCap');
    if (cap) dmg = Math.min(dmg, cap.value);

    // Kalany: neste turno, dano causado por inimigos contra ela é reduzido em 3.
    if (source && source.owner !== unit.owner) {
      const reductions = unit.statuses
        .filter(s => s.status === 'enemyAttackDamageReduction')
        .reduce((sum, s) => sum + (Number(s.value) || 0), 0);
      if (reductions > 0) dmg = Math.max(0, dmg - reductions);
    }

    // Escudo absorve primeiro. Cura nunca recupera o escudo.
    if (unit.shield && unit.shield.value > 0) {
      const absorbed = Math.min(unit.shield.value, dmg);
      unit.shield.value -= absorbed;
      dmg -= absorbed;
      log(`${unit.name} absorve ${absorbed} de dano com o Escudo.`);
      if (unit.shield.value <= 0) {
        unit.shield = null;
      }
    }

    unit.life -= dmg;
    clampLife(unit);
    if (dmg > 0) {
      log(`${unit.name} sofre ${dmg} de dano. (Vida: ${Math.max(0, unit.life)}/${unit.maxLife})`);
    }
    return dmg;
  }

  function applyHeal(unit, amount, log) {
    if (!unit || unit.dead) return;
    // Cura afeta SOMENTE a vida real, nunca o escudo.
    const before = unit.life;
    unit.life = Math.min(unit.maxLife, unit.life + amount);
    const healed = unit.life - before;
    log(`${unit.name} recupera ${healed} de vida. (Vida: ${unit.life}/${unit.maxLife})`);
  }

  function resolveTargets(targetSpec, ctx) {
    const { caster, chosenTarget, enemyTeam, allyTeam, lastTarget } = ctx;
    switch (targetSpec) {
      case 'self': return [caster];
      case 'chooseAlly': return [chosenTarget];
      case 'chooseEnemy': return [chosenTarget];
      case 'chooseAllyNotMovedYet': return [chosenTarget];
      case 'allAllies': return allyTeam.filter(u => !u.dead);
      case 'allAlliesIncludingHand': return allyTeam.filter(u => !u.dead);
      case 'allEnemies': return enemyTeam.filter(u => !u.dead);
      case 'lastTarget': return lastTarget ? [lastTarget] : [];
      case 'enemyDefensor': return enemyTeam.filter(u => u.role === 'defensor' && !u.dead);
      case 'enemyAtacante': return enemyTeam.filter(u => u.role === 'atacante' && !u.dead);
      case 'enemySuporte': return enemyTeam.filter(u => u.role === 'suporte' && !u.dead);
      case 'allyAtacante': return allyTeam.filter(u => u.role === 'atacante' && !u.dead);
      case 'allyDefensor': return allyTeam.filter(u => u.role === 'defensor' && !u.dead);
      case 'allEnemiesFieldAndHand': return enemyTeam;
      default: return [];
    }
  }

  function countScalingUnits(scaling, ctx) {
    if (!scaling) return 0;
    if (scaling.count === 'allEnemiesFieldAndHand') {
      const { enemyField, enemyHand } = ctx;
      return (enemyField?.filter(u => !u.dead).length || 0) + (enemyHand?.length || 0);
    }
    return 0;
  }

  function checkCondition(cond, ctx) {
    const { caster, lastTarget } = ctx;
    if (!cond) return true;
    if (cond === 'selfHasShield') return !!(caster.shield && caster.shield.value > 0);
    if (cond === 'lastTargetKilled') return lastTarget && lastTarget.dead;
    if (cond === 'targetHealedThisTurn') return lastTarget && lastTarget.healedThisTurn;

    // Qualquer condição que diga "vida atual" usa vida + escudo.
    // Ex.: "Se a vida atual dele for 100 ou mais" => life + shield >= 100.
    if (cond.startsWith('targetLifeGTE:')) {
      const n = Number(cond.split(':')[1]);
      return lastTarget && getCurrentLife(lastTarget) >= n;
    }
    if (cond.startsWith('selfLifeLTE:')) {
      const n = Number(cond.split(':')[1]);
      return caster && getCurrentLife(caster) <= n;
    }
    if (cond.startsWith('targetHasStatus:')) {
      const st = cond.split(':')[1];
      return lastTarget && lastTarget.statuses.some(s => s.status === st);
    }
    return true;
  }

  function runEffects(effects, ctx, log) {
    for (const eff of effects) {
      runOneEffect(eff, ctx, log);
    }
  }

  function runOneEffect(eff, ctx, log) {
    switch (eff.type) {
      case 'dealDamage': {
        const targets = resolveTargets(eff.target, ctx);
        let amount = eff.base;
        if (eff.scaling) amount += (eff.scaling.perUnit * countScalingUnits(eff.scaling, ctx));
        for (const t of targets) {
          let finalAmount = amount;
          const boost = ctx.caster.statuses?.find(s => s.status === 'nextSingleTargetDamageBoost');
          if (boost && targets.length === 1) {
            finalAmount += boost.value;
            ctx.caster.statuses = ctx.caster.statuses.filter(s => s !== boost);
          }
          applyDamage(t, finalAmount, log, ctx.caster);
          ctx.lastTarget = t;
        }
        break;
      }
      case 'heal': {
        const targets = resolveTargets(eff.target, ctx);
        for (const t of targets) {
          applyHeal(t, eff.base, log);
          t.healedThisTurn = true;
        }
        break;
      }
      case 'applyShield': {
        const targets = resolveTargets(eff.target, ctx);
        for (const t of targets) {
          t.shield = { value: eff.value, duration: eff.duration };
          log(`${t.name} ganha um Escudo de ${eff.value}.`);
        }
        break;
      }
      case 'applyStatus': {
        const targets = resolveTargets(eff.target, ctx);
        for (const t of targets) {
          t.statuses.push({ status: eff.status, value: eff.value, duration: eff.duration });
          log(`${t.name} recebe o status "${eff.status}".`);
        }
        break;
      }
      case 'gainCounter': {
        ctx.caster.counters[eff.counter] = (ctx.caster.counters[eff.counter] || 0) + eff.value;
        log(`${ctx.caster.name} ganha ${eff.value} contador(es) de ${eff.counter}. (Total: ${ctx.caster.counters[eff.counter]})`);
        break;
      }
      case 'spendCounterToHeal': {
        const amt = ctx.caster.counters[eff.counter] || 0;
        ctx.caster.counters[eff.counter] = 0;
        const targets = resolveTargets(eff.target, ctx);
        for (const t of targets) applyHeal(t, amt, log);
        break;
      }
      case 'moveNow': {
        const targets = resolveTargets(eff.target, ctx);
        for (const t of targets) log(`${t.name} se move imediatamente (ação especial, resolva manualmente na ordem de turno).`);
        break;
      }
      case 'buffMaxLife': {
        const targets = resolveTargets(eff.target, ctx);
        for (const t of targets) {
          t.maxLife += eff.value;
          t.life += eff.value;
          log(`${t.name} ganha +${eff.value} de vida máxima.`);
        }
        break;
      }
      case 'createToken': {
        ctx.onCreateToken?.(eff.tokenId);
        break;
      }
      case 'sacrificeToken': {
        ctx.onSacrificeToken?.(eff.tokenId, log);
        break;
      }
      case 'taunt': {
        const targets = resolveTargets(eff.target, ctx);
        for (const t of targets) log(`${ctx.caster.name} Provoca ${t.name}.`);
        break;
      }
      case 'conditionalBuff': {
        if (checkCondition(eff.condition, ctx)) {
          const targets = resolveTargets(eff.buff.target, ctx);
          for (const t of targets) {
            t.statuses.push({ status: 'damageBoost', value: eff.buff.value, duration: eff.buff.duration });
            log(`${t.name} recebe +${eff.buff.value} de dano neste turno.`);
          }
        }
        break;
      }
      case 'conditionalTrigger': {
        if (checkCondition(eff.condition, ctx)) {
          log(`Condição atendida: ${eff.trigger} (resolva manualmente).`);
        }
        break;
      }
      case 'conditionalDamage': {
        if (checkCondition(eff.condition, ctx)) {
          const targets = resolveTargets(eff.target, ctx);
          for (const t of targets) applyDamage(t, eff.base, log, ctx.caster);
        }
        break;
      }
      case 'conditionalRepeat': {
        if (checkCondition(eff.condition, ctx)) {
          log(`Condição "${eff.condition}" atendida — repita a habilidade.`);
        }
        break;
      }
      case 'conditionalLifesteal': {
        if (checkCondition(eff.condition, ctx)) {
          const healed = ctx.lastTarget?.lastHealAmount || 0;
          applyHeal(ctx.caster, healed, log);
        }
        break;
      }
      case 'conditionalHeal': {
        if (checkCondition(eff.condition, ctx)) {
          const targets = resolveTargets(eff.target, ctx);
          for (const t of targets) {
            if (eff.value === 'full') {
              t.life = t.maxLife;
              log(`${t.name} é totalmente curado!`);
            }
          }
        }
        break;
      }
      case 'applyFieldEffect': {
        ctx.onFieldEffect?.(eff.effect, eff.duration, log);
        break;
      }
      case 'delayedEffect': {
        ctx.onDelayedEffect?.(eff, log);
        break;
      }
      case 'reviveCopy': {
        ctx.onReviveCopy?.(eff.cardId, eff.life, log);
        break;
      }
      default:
        log(`(Efeito "${eff.type}" precisa ser resolvido manualmente.)`);
    }
  }

  return { runEffects, applyDamage, applyHeal, resolveTargets, checkCondition, getCurrentLife };
})();


/* ===== CONSOLIDATED: new-defenders.js ===== */
// ===================== NOVOS DEFENSORES =====================
// Kalany é a carta de deck. Draak é a forma/token para a qual Kalany se transforma.

(() => {
  ;

  ;

  ;

  ;

  ;

  ;

  ;
  function isProtectedFrom(attacker, target) {
    return !!(attacker && target && attacker.owner !== target.owner && target.statuses?.some(s => s.status === 'draakProtected'));
  }

  function installTargetProtection() {
    if (typeof enemyTeamOf !== 'function' || window.__hvDraakProtectionInstalled) return false;
    const originalEnemyTeamOf = enemyTeamOf;
    window.__hvDraakProtectionInstalled = true;
    window.__hvOriginalEnemyTeamOf = originalEnemyTeamOf;
    window.enemyTeamOf = function(unit) { return originalEnemyTeamOf(unit).filter(target => !isProtectedFrom(unit, target)); };
    return true;
  }

  function transformKalany(unit) {
    if (!unit || unit.dead || unit.cardId !== 'kalany') return;
    unit.cardId = 'draak'; unit.name = (CARD_DB.draak?.name || "Dra'ak, a Sombra da Morte"); unit.role = (CARD_DB.draak?.role || "defensor"); unit.maxLife = (CARD_DB.draak?.life || 100); unit.life = (CARD_DB.draak?.life || 100);
    unit.shield = null; unit.statuses = unit.statuses.filter(s => s.status !== 'kalanyEndCounter'); unit.counters = {}; unit.cooldowns = {}; unit.isToken = true; unit.justSpawned = true;
    const allies = allyTeamOf(unit).filter(ally => ally.uid !== unit.uid && !ally.dead);
    for (const ally of allies) allies.push;
    for (const ally of allies) ally.statuses.push({ status: 'draakProtected', value: 1, duration: 1 });
    logMsg(`${unit.name} se transforma! Outros aliados ficam protegidos neste turno.`);
  }

  let lastTurn = null;
  function processTurnStart() {
    if (typeof state === 'undefined' || !state) return;
    if (lastTurn === null) { lastTurn = state.turn; return; }
    if (state.turn === lastTurn) return;
    lastTurn = state.turn;
    for (const unit of allUnitsAll()) {
      unit.statuses = unit.statuses.filter(s => s.status !== 'draakProtected');
      unit.healedThisTurn = false;
      unit.damagedThisTurn = 0;
    }
    for (const unit of allUnitsAll()) {
      if (unit.dead || unit.cardId !== 'kalany') continue;
      unit.counters.fim = (unit.counters.fim || 0) + 1;
      logMsg(`${unit.name} recebe ${unit.counters.fim}/5 Contadores do Fim.`);
      if (unit.counters.fim >= 5) transformKalany(unit);
    }
  }

  function boot() {
    if (typeof CARD_DB !== 'undefined' && Object.keys(CARD_DB).length > 0) {
      installTargetProtection(); setInterval(processTurnStart, 100);
    } else setTimeout(boot, 100);
  }
  boot();
})();

/* ===== CONSOLIDATED: more-defenders.js ===== */
// ===================== DEFENSORES AVANÇADOS =====================
// Dados das cartas, integração e manutenção em um único arquivo.
(() => {
  ;
  const alive=u=>!!u&&!u.dead&&u.life>0;
  const enemiesOf=u=>allUnitsOf(1-u.owner).filter(alive);
  const alliesOf=u=>allUnitsOf(u.owner).filter(alive);
  const hasStatus=(u,s)=>!!u?.statuses?.some(x=>x.status===s);
  const addStatus=(u,s,v=1,d=1)=>{if(!u)return;u.statuses ||= [];const old=u.statuses.find(x=>x.status===s);if(old){old.value=v;old.duration=d}else u.statuses.push({status:s,value:v,duration:d})};

  function boot(){if(typeof Engine==='undefined'||typeof CARD_DB==='undefined'||!Object.keys(CARD_DB).length)return setTimeout(boot,100);if(CARD_DB.arborzilla?.abilities?.[0]?.effects?.[0])CARD_DB.arborzilla.abilities[0].effects[0].target='chooseEnemy';
    const oldRun=Engine.runEffects;
    Engine.runEffects=function(effects,ctx,log){const remaining=[];for(const eff of effects||[]){if(eff.type==='applyStatus'&&eff.status==='benicioNextAttack'){const t=Engine.resolveTargets(eff.target,ctx)[0];if(t)addStatus(t,'benicioUntaggable',1,2)}else if(eff.type==='rahdanDrainEnemies'){const foes=enemiesOf(ctx.caster),rs=alliesOf(ctx.caster).filter(u=>u.cardId==='rahdan');foes.forEach((f,i)=>{f.life=Math.max(0,f.life-(i?2:4));addStatus(f,'enemyDamageReduction',2,1);rs.forEach(r=>{r.life=Math.min(r.maxLife,r.life+2);r.healedThisTurn=true})})}else if(eff.type==='zengrathMaxLifeDamage'){const t=ctx.chosenTarget||enemiesOf(ctx.caster)[0];if(t)Engine.applyDamage(t,Math.ceil(ctx.caster.maxLife*.1),log,ctx.caster)}else if(eff.type==='zengrathMassAttack'){const fs=enemiesOf(ctx.caster);fs.forEach(f=>Engine.applyDamage(f,2,log,ctx.caster));ctx.caster.maxLife+=fs.length*2;ctx.caster.life+=fs.length*2}else if(eff.type==='predadorAttack'){const t=ctx.chosenTarget||enemiesOf(ctx.caster)[0];if(t)Engine.applyDamage(t,allUnitsAll().filter(u=>alive(u)&&u.cardId==='predador_labirinto').length>=15?2:1,log,ctx.caster)}else if(eff.type==='arborzillaAttack'){const t=ctx.chosenTarget||enemiesOf(ctx.caster)[0];if(t){const b=Number(ctx.caster.arborzillaBonus||0),n=ctx.caster.statuses?.find(s=>s.status==='benicioNextAttack');const amount=5+b+(n?.value||0);if(n)ctx.caster.statuses=ctx.caster.statuses.filter(s=>s!==n);const before=t.life+(t.shield?.value||0);Engine.applyDamage(t,amount,log,ctx.caster);const created=enemiesOf(ctx.caster).find(x=>x.uid!==t.uid&&(x.isToken||state.players[x.owner].extraUnits.includes(x)));if(created)Engine.applyDamage(created,amount,log,ctx.caster);if(before>0&&t.life<=0)ctx.caster.arborzillaBonus=b+1;ctx.caster.shield=ctx.caster.shield||{value:0,duration:1};ctx.caster.shield.value+=5;ctx.caster.shield.duration=1}}else if(eff.type==='dealDamage'&&ctx.caster?.statuses?.some(s=>s.status==='tauntedBy')){const s=ctx.caster.statuses.find(x=>x.status==='tauntedBy'),t=getUnit(s.value);if(t)Engine.applyDamage(t,Number(eff.base)||0,log,ctx.caster);else remaining.push(eff)}else remaining.push(eff)}if(remaining.length)oldRun(remaining,ctx,log)};
    const oldDamage=Engine.applyDamage;Engine.applyDamage=function(unit,amount,log,source=null){if(source&&source.owner!==unit.owner&&hasStatus(unit,'enemyDamageReduction'))amount=Math.max(0,amount-2);return oldDamage(unit,amount,log,source)};
    const oldExecute=window.executeAbility;if(typeof oldExecute==='function'&&!window.__hvMoreFixExecute){window.__hvMoreFixExecute=true;window.executeAbility=function(caster,idx,target){const r=oldExecute(caster,idx,target);for(const copy of allUnitsOf(1-caster.owner).filter(u=>alive(u)&&u.cardId==='varghul'&&hasStatus(u,'varghulDieAfterEnemy'))){copy.life=0;copy.dead=true}return r}};
    const counted=new Set();setInterval(()=>{if(!state)return;state.totalDeaths ||= 0;for(const p of state.players)for(const unit of p.extraUnits||[]){if(!unit.dead||counted.has(unit.uid))continue;counted.add(unit.uid);state.totalDeaths++;for(const v of allUnitsOf(unit.owner).filter(u=>alive(u)&&u.cardId==='varghul')){const t=allUnitsOf(1-v.owner).find(alive);if(t)Engine.applyDamage(t,6,logMsg,v)}}},100);
  }
  boot();
})();

/* ===== CONSOLIDATED: new-defenders-2.js ===== */
// ===================== LOTE 2 DE ATACANTES =====================
// Amelia, Anuben, Letícia, Lou, Sirius, Victor Hans, Soldado, Vitor, Yvrel e Bork.
(() => {
;


if(window.__hvDefenders2Fixes)return;window.__hvDefenders2Fixes=true;
const addStatus=(u,status,value=1,duration=1)=>{if(!u)return;u.statuses ||= [];const old=u.statuses.find(s=>s.status===status);if(old){old.value=value;old.duration=duration}else u.statuses.push({status,value,duration})};
const has=(u,status)=>!!u?.statuses?.some(s=>s.status===status);const alive=u=>!!u&&!u.dead&&u.life>0;
const enemies=ctx=>(ctx.enemyTeam||[]).filter(alive);const allies=ctx=>(ctx.allyTeam||[]).filter(alive);
const effective=u=>typeof Engine.getCurrentLife==='function'?Engine.getCurrentLife(u):(u.life+(u.shield?.value||0));
function boot(){if(typeof Engine==='undefined')return setTimeout(boot,100);
const originalRun=Engine.runEffects;Engine.runEffects=function(effects,ctx,log){const custom=[];for(const e of(effects||[])){if(!e?.type?.startsWith('amelia')&&!e?.type?.startsWith('anuben')&&!e?.type?.startsWith('leticia')&&!e?.type?.startsWith('lou')&&!e?.type?.startsWith('sirius')&&!e?.type?.startsWith('victor')&&!e?.type?.startsWith('vitor')&&!e?.type?.startsWith('yvrel')&&!e?.type?.startsWith('bork'))custom.push(e)}const caster=ctx?.caster;if(caster)caster.actedThisTurn=true;for(const e of(effects||[])){if(!e?.type)continue;switch(e.type){
case'ameliaPunishActed':for(const u of enemies(ctx))if(u.actedThisTurn)Engine.applyDamage(u,15,log,caster);break;
case'ameliaTempo':for(const u of allies(ctx))if(u!==caster)addStatus(u,'speedNextTurn',5,1);for(const u of enemies(ctx))addStatus(u,'speedNextTurn',3,1);log(`${caster.name} altera a velocidade do próximo turno.`);break;
case'anubenSoloTurn':addStatus(caster,'onlyCasterNextTurn',1,1);log(`${caster.name} controla o próximo turno.`);break;
case'anubenMark':for(const u of[ctx.chosenTarget].filter(alive))addStatus(u,'anubenMark',1,99);log(`${ctx.chosenTarget?.name||'Alvo'} foi marcado pelo tempo.`);break;
case'leticiaMassAttack':{const dmg=caster.healedLastTurn?8:18;for(const u of enemies(ctx))Engine.applyDamage(u,dmg,log,caster);break}
case'leticiaSingleAttack':{const dmg=caster.healedLastTurn?25:15;if(alive(ctx.chosenTarget))Engine.applyDamage(ctx.chosenTarget,dmg,log,caster);break}
case'louAttackHat':{const a=ctx.chosenTarget,b=enemies(ctx).find(u=>u!==a);if(a)Engine.applyDamage(a,8,log,caster);if(b)Engine.applyDamage(b,6,log,caster);for(const u of[a,b].filter(Boolean))if(has(u,'uglyHat'))addStatus(u,'cannotHeal',1,2);break}
case'louAttackJeans':{const a=ctx.chosenTarget,b=enemies(ctx).find(u=>u!==a);if(a)Engine.applyDamage(a,8,log,caster);if(b)Engine.applyDamage(b,6,log,caster);for(const u of[a,b].filter(Boolean))if(has(u,'tackyJeans'))addStatus(u,'cooldownAll',1,1);break}
case'siriusDoubleNext':addStatus(caster,'siriusDoubleNext',1,99);break;
case'siriusHeroBoost':for(const u of allies(ctx))if(u!==caster&&u.role!=='defensor')addStatus(u,'damageBoost',2,1);break;
case'siriusSwapDefender':addStatus(caster,'siriusSwapPending',1,1);caster.maxLife+=15;caster.life+=15;log(`${caster.name} recebe +15 de vida.`);break;
case'victorSoldierAttack':{const target=ctx.chosenTarget;if(!alive(target))break;Engine.applyDamage(target,8,log,caster);for(const s of allies(ctx).filter(u=>u.cardId==='soldado')){if(!alive(target))break;Engine.applyDamage(target,8+(s.soldierBonus||0),log,s)}break}
case'victorSoldierBuff':for(const u of allies(ctx).filter(x=>x.cardId==='soldado'))u.soldierBonus=(u.soldierBonus||0)+2;addStatus(caster,'soldierBonusPermanent',2,9999);break;
case'vitorBloodDamage':{const n=caster.counters?.cristalSangue||0,dmg=3*Math.pow(2,n);Engine.applyDamage(caster,dmg,log,caster);if(alive(ctx.chosenTarget))Engine.applyDamage(ctx.chosenTarget,dmg,log,caster);break}
case'vitorBloodShield':{const n=caster.counters?.cristalSangue||0,amount=6+3*n,t=ctx.chosenTarget;if(t){t.shield={value:amount,duration:2};log(`${t.name} ganha um Escudo de ${amount}.`)}break}
case'yvrelUntargetable':if(ctx.lastTarget)addStatus(ctx.lastTarget,'untargetable',1,1);break;
case'yvrelLast':if(ctx.lastTarget)addStatus(ctx.lastTarget,'actLast',1,1);break;
case'yvrelCopyAbility':addStatus(caster,'yvrelCopyPending',1,1);caster.yvrelCopyTarget=ctx.chosenTarget;break;
case'borkDoubleHit':{const t=ctx.chosenTarget;if(t){Engine.applyDamage(t,1,log,caster);if(alive(t))Engine.applyDamage(t,1,log,caster)}break}
case'borkShieldHit':{const t=ctx.chosenTarget;if(!t)break;const before=effective(t);Engine.applyDamage(t,7,log,caster);const dealt=Math.max(0,before-effective(t));if(dealt>0)caster.shield={value:dealt,duration:1};log(`${caster.name} ganha um Escudo de ${dealt}.`);break}
}}return originalRun(custom,ctx,log)};
const originalDamage=Engine.applyDamage;Engine.applyDamage=function(target,amount,log,source){const dealt=originalDamage(target,amount,log,source);if(source?.cardId==='anuben'&&has(target,'anubenMark')&&dealt>0){target.statuses=target.statuses.filter(s=>s.status!=='anubenMark');if(alive(target))originalDamage(target,15,log,source)}if(source?.cardId==='bork'&&!source.__borkProc&&dealt>0&&alive(target)){source.__borkProc=true;const extra=Math.ceil(effective(target)*.10);if(extra>0)originalDamage(target,extra,log,source);source.__borkProc=false}return dealt};
const passiveTick=()=>{try{if(!window.state?.players)return;for(const p of state.players){const units=[...Object.values(p.slots||{}).map(s=>s?.active).filter(Boolean),...(p.extraUnits||[])].filter(alive);for(const u of units)if(u.cardId==='lou'&&!u.__louDressed){const enemyTeam=state.players[1-state.players.indexOf(p)];const es=[...Object.values(enemyTeam?.slots||{}).map(s=>s?.active).filter(Boolean),...(enemyTeam?.extraUnits||[])].filter(alive);es.forEach((e,i)=>addStatus(e,i%2?'tackyJeans':'uglyHat',1,9999));u.__louDressed=true}}}catch(_){}};setInterval(passiveTick,500)}boot();
})();

/* ===== CONSOLIDATED: new-attackers-4.js ===== */
// ===================== LOTE 4 DE ATACANTES =====================
(() => {
;

function boot(){if(typeof Engine==='undefined')return setTimeout(boot,100);const getUnits=()=>typeof allUnitsAll==='function'?allUnitsAll():[],alive=u=>u&&!u.dead&&u.life>0,enemies=u=>getUnits().filter(x=>alive(x)&&x.owner!==u.owner),allies=u=>getUnits().filter(x=>alive(x)&&x.owner===u.owner),damage=(u,n,ctx)=>{if(typeof Engine!=='undefined'&&Engine.applyDamage)Engine.applyDamage(u,Math.max(0,n),ctx?.log||window.logMsg,ctx?.caster)},heal=(u,n)=>{if(!u)return;u.life=Math.min(u.maxLife??u.life+n,u.life+n);u.wasHealedThisTurn=true},st=(u,name,value=1,duration=1)=>{u.statuses ||= [];const q=u.statuses.find(s=>s.status===name);if(q){q.value=value;q.duration=duration}else u.statuses.push({status:name,value,duration})};
const old=Engine.runEffects;Engine.runEffects=function(effects,ctx,log){const rest=[];for(const e of effects||[]){const c=ctx.caster;if(e.type==='kyrielBonusIfAllyDamaged'){if(allies(c).some(a=>a.wasDamagedThisTurn)){const t=ctx.chosenTarget||enemies(c)[0];if(t)damage(t,6,ctx)}continue}if(e.type==='kyrielFastestOnly'){st(c,'kyrielEnemyFastestOnly',1,2);continue}if(e.type==='kyrielPulse'){const hit=allies(c).some(a=>a.wasDamagedThisTurn);for(const t of enemies(c))damage(t,4,ctx);for(const a of allies(c))heal(a,4);if(hit){for(const t of enemies(c))damage(t,4,ctx);for(const a of allies(c))heal(a,4)}continue}if(e.type==='gusRepeatByLife'){for(let i=0;i<Math.max(0,Math.floor(c.life));i++)for(const t of enemies(c))damage(t,Math.max(1,c.gusDamageMultiplier||1),ctx);continue}if(e.type==='deadricAttack'){const t=ctx.chosenTarget||enemies(c)[0];if(t)damage(t,e.base+allies(c).filter(a=>a.wasDamagedThisTurn).length*e.bonusPerDamagedAlly,ctx);continue}if(e.type==='deadricSpeedAttack'){const t=ctx.chosenTarget||enemies(c)[0],v=t?.lastOriginalAbilitySpeed||0;if(t){damage(t,v,ctx);t.nextAbilitySpeed=v}continue}if(e.type==='gavinDouble'){const t=ctx.chosenTarget||enemies(c)[0],a=allies(c)[0];if(t)damage(t,4,ctx);if(a)heal(a,4);if(t)damage(t,8,ctx);if(a)heal(a,8);continue}if(e.type==='gavinSlow'){const t=ctx.chosenTarget||enemies(c)[0];if(t){damage(t,2,ctx);st(t,'slow',2,1);st(t,'gavinSlowTrigger',1,1)}continue}if(e.type==='rotPoisonAttack'){const t=ctx.chosenTarget||enemies(c)[0];if(t){const p=(t.statuses||[]).find(s=>s.status==='poison')?.value||0;damage(t,15,ctx);for(const x of enemies(c).filter(x=>x!==t))damage(x,p*3,ctx)}continue}if(e.type==='rotCreatedChoice'){const ally=getUnits().find(x=>x.owner===c.owner&&alive(x)&&x.isToken),foe=getUnits().find(x=>x.owner!==c.owner&&alive(x)&&x.isToken);if(foe)damage(foe,10,ctx);else if(ally){ally.life=0;ally.dead=true}continue}rest.push(e)}if(rest.length)old(rest,ctx,log)};
const oldDamage=Engine.applyDamage;Engine.applyDamage=function(unit,amount,log,source){const before=unit?.life,r=oldDamage(unit,amount,log,source);if(unit&&before>0&&unit.life<=0&&unit.cardId==='gus'&&(unit.gusRevives||0)<4){unit.gusRevives=(unit.gusRevives||0)+1;unit.maxLife*=2;unit.life=unit.maxLife;unit.gusDamageMultiplier=(unit.gusDamageMultiplier||1)*2;unit.dead=false}return r};
if(!window.__hvPoisonHook){window.__hvPoisonHook=true;const original=window.executeAbility;if(typeof original==='function')window.executeAbility=function(caster,idx,target){const speed=caster?.abilities?.[idx]?.speed||0,poison=caster?.statuses?.find(s=>s.status==='poison');if(poison?.value>0){damage(caster,speed,{caster,log:window.logMsg});poison.value--;if(poison.value<=0)caster.statuses=caster.statuses.filter(s=>s!==poison)}return original(caster,idx,target)}}}boot();
})();

/* ===== CONSOLIDATED: new-supports-1.js ===== */
// ===================== SUPORTES 1 =====================
(() => {
;

const units=()=>typeof allUnitsAll==='function'?allUnitsAll():[],alive=u=>u&&!u.dead&&u.life>0,foes=u=>units().filter(x=>alive(x)&&x.owner!==u.owner),friends=u=>units().filter(x=>alive(x)&&x.owner===u.owner),getStatus=(u,n)=>u?.statuses?.find(s=>s.status===n),status=(u,n,v=1,d=1)=>{u.statuses ||= [];const s=getStatus(u,n);if(s){s.value=v;s.duration=d}else u.statuses.push({status:n,value:v,duration:d})},heal=(u,n)=>{if(u)u.life=Math.min(u.maxLife??u.life+n,u.life+n),u.wasHealedThisTurn=true},dmg=(u,n,c)=>{if(u&&Engine?.applyDamage)Engine.applyDamage(u,Math.max(0,n),c?.log||window.logMsg,c?.caster)};
function boot(){if(typeof CARD_DB==='undefined'||typeof Engine==='undefined')return setTimeout(boot,100);const old=Engine.runEffects;Engine.runEffects=function(effects,ctx,log){const rest=[];for(const e of effects||[]){const c=ctx.caster;
if(e.type==='andressaHealShield'){const a=ctx.chosenTarget||friends(c)[0];if(a){heal(a,5);a.shield=(a.shield||{value:0}).value+5;if(c.partnerUid===a.uid){heal(c,5);c.shield=(c.shield||{value:0}).value+5}}continue}
if(e.type==='andressaGuard'){c.shield=(c.shield||{value:0}).value+10;status(c,'andressaShieldConversion',1,2);continue}
if(e.type==='donnaPlague'){const t=ctx.chosenTarget||foes(c)[0];if(t)status(t,'plague',e.value,9999);continue}
if(e.type==='donnaPlagueAll'){for(const t of foes(c))status(t,'plague',(getStatus(t,'plague')?.value||0)+e.value,9999);continue}
if(e.type==='donnaCleanPlague'){const t=ctx.chosenTarget||foes(c)[0];if(t){const p=getStatus(t,'plague');if(p)p.value=Math.max(0,p.value-3)}for(const a of friends(c))a.life=Math.min(a.maxLife,a.life+10);continue}
if(e.type==='neonHealHaste'){for(const a of friends(c)){heal(a,4);status(a,'speedBoost',3,1)}continue}
if(e.type==='neonAttackEcho'){status(c,'neonAttackEcho',1,2);continue}
if(e.type==='neonEndTurnAttacks'){status(c,'neonEndTurnAttacks',1,2);continue}
if(e.type==='vanessaAllyAttack'){const a=friends(c).find(x=>x!==c);if(a){const f=foes(c);if(f[0])dmg(f[0],6,{caster:a,log});dmg(c,3,{caster:a,log});for(const t of f.slice(1))dmg(t,6,{caster:a,log})}continue}
if(e.type==='vanessaTaunt'){status(c,'tauntAttacker',1,1);status(c,'vanessaHealOnDamage',1,1);continue}
if(e.type==='romuloTripleAttack'){const t=ctx.chosenTarget||foes(c)[0];if(t)for(const a of[c,...friends(c).filter(x=>x.role==='atacante'||x.role==='defensor')])dmg(t,3,{caster:a,log});continue}
if(e.type==='romuloBuffAttack'){for(const a of friends(c)){dmg(a,3,{caster:c,log});status(a,'romuloNextAttack',3,2)}continue}
if(e.type==='romuloHeal'){for(const a of friends(c)){heal(a,6);if(a.wasDamagedLastTurn)heal(a,6)}continue}
if(e.type==='darioAttack'){const t=ctx.chosenTarget||foes(c)[0];if(t){dmg(t,c.form==='sombra'?14:7,{caster:c,log});if(c.form==='senador')heal(friends(c)[0],7)}continue}
if(e.type==='darioShield'){const a=ctx.chosenTarget||friends(c)[0];if(a){if(c.form==='senador')a.shield=(a.shield||{value:0}).value*2;else if(c.form==='sombra'){const f=foes(c)[0];if(f){a.shield=(a.shield||{value:0}).value+(f.shield?.value||0);f.shield={value:0}}}else a.shield=(a.shield||{value:0}).value+5}continue}
if(e.type==='zeevDecayShield'){const t=ctx.chosenTarget||friends(c)[0];if(t){t.shield=(t.shield||{value:0}).value+8;status(t,'decay',4,99);status(t,'zeevDecayHeal',1,99)}continue}
if(e.type==='zeevAccelerateDecay'){const t=ctx.chosenTarget||foes(c)[0],d=getStatus(t,'decay');if(d)d.value+=2;continue}
if(e.type==='brendaNoCreate'){status(c,'noCreate',1,1);continue}if(e.type==='brendaTeamShield'){for(const a of friends(c))a.shield=(a.shield||{value:0}).value+7;continue}
if(e.type==='brendaAttack'){const t=ctx.chosenTarget||foes(c)[0];if(t)dmg(t,1+(c.brendaBonus||0),{caster:c,log});continue}
if(e.type==='brendaShieldDamage'){const a=ctx.chosenTarget||friends(c)[0];if(a){a.shield=(a.shield||{value:0}).value+15;dmg(a,5,{caster:c,log})}continue}
if(e.type==='jairoPeace'){status(c,'noDamageNextTurn',1,2);for(const a of friends(c))heal(a,5);continue}
if(e.type==='jairoMaxLife'){const t=ctx.chosenTarget||foes(c)[0];if(t){t.maxLife=Math.max(0,(t.maxLife||t.life)-8);t.life=Math.min(t.life,t.maxLife)}continue}
if(e.type==='jairoUntouchedHeal'){const n=foes(c).filter(t=>!t.wasDamagedThisTurn).length;if(n)heal(ctx.chosenTarget||friends(c)[0],6*n);continue}
if(e.type==='baraoToxina'){const targets=ctx.chosenTargets?.length?ctx.chosenTargets:ctx.chosenTarget?[ctx.chosenTarget]:foes(c);for(const t of targets)if(t)status(t,'toxina',c.toxinaPower||6,1);continue}
if(e.type==='baraoImprovedToxina'){c.toxinaPower=12;status(c,'toxinaImproved',1,99);continue}
rest.push(e)}if(rest.length)old(rest,ctx,log)};
if(!window.__hvSupportDamageHook){window.__hvSupportDamageHook=true;const od=Engine.applyDamage;Engine.applyDamage=function(unit,amount,log,source){const r=od(unit,amount,log,source);if(unit?.cardId==='andressa'&&unit.partnerUid){const p=units().find(x=>x.uid===unit.partnerUid);if(p&&amount>0)heal(p,Math.floor(amount/2))}if(unit?.cardId==='dario'&&source?.owner===unit.owner)unit.form='sombra';return r}};
window.__hvPlagueTick=()=>{for(const u of units()){const p=getStatus(u,'plague');if(p?.value>0)dmg(u,p.value,{caster:null,log:window.logMsg})}};
window.__hvZeevDecayTick=()=>{for(const u of units()){const d=getStatus(u,'decay');if(d?.value>0&&getStatus(u,'zeevDecayHeal')){heal(u,d.value);d.value=Math.max(0,d.value-1)}}};
}boot();
})();

/* ===== CONSOLIDATED: defender-expansion.js ===== */
// ===================== MECÂNICAS DOS NOVOS DEFENSORES =====================
(() => {
  const originalRunEffects = Engine.runEffects;
  let resolvingRedirect = false;
  let resolvingMoldar = false;
  let initialized = false;

  const alive = u => u && !u.dead && u.life > 0;
  const enemiesOf = u => allUnitsOf(1 - u.owner).filter(alive);
  const alliesOf = u => allUnitsOf(u.owner).filter(alive);
  const firstEnemy = u => enemiesOf(u).sort((a,b) => Engine.getCurrentLife(a) - Engine.getCurrentLife(b))[0] || null;
  const firstAlly = u => alliesOf(u).find(a => a.uid !== u.uid) || null;

  function ensureStateFields(u) {
    if (!u.counters) u.counters = {};
    if (!u.statuses) u.statuses = [];
  }
  function addStatus(u, status, value, duration) {
    ensureStateFields(u);
    const old = u.statuses.find(s => s.status === status);
    if (old) { old.value = value; old.duration = duration; }
    else u.statuses.push({ status, value, duration });
  }
  function removeStatus(u, status) { u.statuses = (u.statuses || []).filter(s => s.status !== status); }

  function damageAmount(eff) { return Number(eff.base) || 0; }

  function chooseTargetForAbility(caster, ability) {
    if (ability.effects.some(e => e.target === 'chooseEnemy' || e.target === 'lastTarget')) return firstEnemy(caster)?.uid || null;
    if (ability.effects.some(e => e.target === 'chooseAlly' || e.target === 'chooseAllyNotMovedYet')) return firstAlly(caster)?.uid || caster.uid;
    return null;
  }

  function useFastestEnemyAbility(caster, role, log) {
    const candidates = enemiesOf(caster).filter(u => u.role === role).sort((a,b) => {
      const aa = CARD_DB[a.cardId]?.abilities || [], bb = CARD_DB[b.cardId]?.abilities || [];
      const as = aa.length ? Math.min(...aa.map(x => x.speed)) : 999;
      const bs = bb.length ? Math.min(...bb.map(x => x.speed)) : 999;
      return as - bs;
    });
    const candidate = candidates[0];
    if (!candidate) { log(`Nenhum ${roleLabel(role).toLowerCase()} inimigo disponível para copiar.`); return; }
    const choices = (CARD_DB[candidate.cardId]?.abilities || []).map((ab, idx) => ({ab,idx})).filter(x => !(candidate.cooldowns[x.idx] > 0));
    if (!choices.length) { log(`${candidate.name} não tem Habilidades disponíveis.`); return; }
    choices.sort((a,b) => a.ab.speed - b.ab.speed);
    const chosen = choices[0];
    log(`${caster.name} usa a Habilidade mais rápida de ${candidate.name}.`);
    if (typeof executeAbility === 'function') executeAbility(candidate, chosen.idx, chooseTargetForAbility(candidate, chosen.ab));
  }

  function applyDamageWithHooks(target, amount, source, log) {
    if (!alive(target) || amount <= 0) return 0;
    ensureStateFields(target);
    if (source && source.owner !== target.owner && target.statuses.some(s => s.status === 'draakProtected')) {
      log(`${target.name} está protegido pela transformação de Draak.`);
      return 0;
    }

    const lizReflect = target.statuses.find(s => s.status === 'lizReflect');
    if (lizReflect && source && source.owner !== target.owner) amount += Number(lizReflect.value) || 0;

    const lizReduction = target.statuses.find(s => s.status === 'lizReduction');
    if (lizReduction && source && source.owner !== target.owner) {
      const reduced = amount - (Number(lizReduction.value) || 0);
      if (reduced <= 0) {
        Engine.applyHeal(target, Math.abs(reduced), log);
        return 0;
      }
      amount = reduced;
    }

    const redirect = target.statuses.find(s => s.status === 'lizRedirect' && s.targetUid);
    if (redirect && source && source.owner !== target.owner && !resolvingRedirect) {
      const ally = getUnit(redirect.targetUid);
      if (alive(ally)) {
        const redirected = Math.ceil(amount / 2);
        const ownDamage = amount - redirected;
        resolvingRedirect = true;
        if (redirected > 0) {
          const redirectedDealt = Engine.applyDamage(ally, redirected, log);
          if (redirectedDealt > 0) afterDamage(ally, redirectedDealt, source, log);
        }
        resolvingRedirect = false;
        const dealt = ownDamage > 0 ? Engine.applyDamage(target, ownDamage, log) : 0;
        if (dealt > 0) afterDamage(target, dealt, source, log);
        return dealt + redirected;
      }
    }

    const dealt = Engine.applyDamage(target, amount, log);
    if (dealt > 0) afterDamage(target, dealt, source, log);
    return dealt;
  }

  function afterDamage(target, dealt, source, log) {
    if (!target || dealt <= 0) return;
    ensureStateFields(target);
    target.damagedThisTurn = (target.damagedThisTurn || 0) + 1;

    if (target.cardId === 'uragi' && !target.dead) {
      target.counters.furia = (target.counters.furia || 0) + 1;
      log(`${target.name} ganha 1 Contador de Fúria (${target.counters.furia}).`);
    }

    const reflect = target.statuses.find(s => s.status === 'lizReflect');
    if (target.cardId === 'liz' && reflect && source && source.owner !== target.owner && !resolvingRedirect) {
      const enemy = firstEnemy(target);
      if (enemy) {
        log(`${target.name} revida com ${dealt} de dano.`);
        resolvingRedirect = true;
        const reflected = Engine.applyDamage(enemy, dealt, log);
        if (reflected > 0) afterDamage(enemy, reflected, target, log);
        resolvingRedirect = false;
      }
    }

    for (const moldar of allUnitsOf(target.owner).filter(u => alive(u) && u.cardId === 'moldar' && u.statuses.some(s => s.status === 'moldarRevenge'))) {
      if (moldar.uid === target.uid || resolvingMoldar) continue;
      const enemy = firstEnemy(moldar);
      if (enemy) {
        resolvingMoldar = true;
        log(`${moldar.name} revida!`);
        const reflected = Engine.applyDamage(enemy, 6, log);
        if (reflected > 0) afterDamage(enemy, reflected, moldar, log);
        resolvingMoldar = false;
      }
    }
  }

  function runCustomEffect(eff, ctx, log) {
    const caster = ctx.caster;
    ensureStateFields(caster);

    if (eff.type === 'useFastestEnemyAbility') { useFastestEnemyAbility(caster, eff.role, log); return true; }

    if (eff.type === 'healPerDamageTaken') {
      const times = Number(caster.damagedThisTurn || 0);
      if (times > 0) Engine.applyHeal(caster, (Number(eff.value) || 0) * times, log);
      else log(`${caster.name} não foi danificado neste turno.`);
      return true;
    }

    if (eff.type === 'armMoldarRevenge') {
      log(`${caster.name} mantém a reação armada até agir.`);
      return true;
    }

    if (eff.type === 'uragiFuryAttack') {
      const foes = enemiesOf(caster);
      if (!foes.length) return true;
      const first = ctx.chosenTarget && ctx.chosenTarget.owner !== caster.owner ? ctx.chosenTarget : foes[0];
      const second = foes.find(x => x.uid !== first.uid) || first;
      applyDamageWithHooks(first, 6, caster, log);
      applyDamageWithHooks(second, 3, caster, log);
      const fury = Number(caster.counters.furia || 0);
      if (fury >= 3 && alive(caster)) {
        caster.counters.furia = fury - 3;
        log(`${caster.name} consome 3 de Fúria e repete a habilidade.`);
        const again = enemiesOf(caster);
        if (again.length) {
          const a = again[0], b = again.find(x => x.uid !== a.uid) || a;
          applyDamageWithHooks(a, 6, caster, log);
          applyDamageWithHooks(b, 3, caster, log);
        }
      }
      return true;
    }

    if (eff.type === 'copyVentroxAbilityNextTurn') {
      const target = ctx.lastTarget || ctx.chosenTarget;
      if (alive(target)) {
        const ventroxAbility = CARD_DB[caster.cardId]?.abilities?.find(a => a.text?.startsWith('Eu causo 7 de dano'));
        if (ventroxAbility) target.ventroxCopy = { untilTurn: state.turn + 1, effects: JSON.parse(JSON.stringify(ventroxAbility.effects)), text: ventroxAbility.text, speed: ventroxAbility.speed };
        log(`${target.name} terá sua Habilidade do próximo turno transformada em uma cópia de ${caster.name}.`);
      }
      return true;
    }

    if (eff.type === 'chooseVentroxDefense') { showVentroxChoice(caster); return true; }
    return false;
  }

  function showVentroxChoice(caster) {
    const old = document.getElementById('hvVentroxChoice'); if (old) old.remove();
    const box = document.createElement('div'); box.id = 'hvVentroxChoice';
    box.innerHTML = `<div class="hv-def-choice-card"><div class="hv-def-choice-title">Ventrox — escolha uma defesa</div><button data-choice="life">♥ +7 VIDA</button><button data-choice="shield">◈ ESCUDO 14</button></div>`;
    document.body.appendChild(box);
    let chosen = false;
    const apply = kind => {
      if (chosen || !alive(caster)) return;
      chosen = true; box.remove();
      if (kind === 'life') { caster.maxLife += 7; caster.life += 7; logMsg(`${caster.name} ganha +7 de vida máxima.`); }
      else { caster.shield = { value: 14, duration: 1 }; logMsg(`${caster.name} ganha um Escudo de 14.`); }
      render();
    };
    box.querySelector('[data-choice="life"]').onclick = () => apply('life');
    box.querySelector('[data-choice="shield"]').onclick = () => apply('shield');
    setTimeout(() => { if (!chosen) apply('shield'); }, 3500);
  }

  function promptLizRedirect(liz) {
    const allies = alliesOf(liz).filter(a => a.uid !== liz.uid);
    if (!allies.length) return;
    const old = document.getElementById('hvLizChoice'); if (old) old.remove();
    const box = document.createElement('div'); box.id = 'hvLizChoice';
    box.innerHTML = `<div class="hv-def-choice-card"><div class="hv-def-choice-title">Liz — escolha quem recebe metade do seu dano</div>${allies.map(a => `<button data-uid="${a.uid}">${a.name}</button>`).join('')}</div>`;
    document.body.appendChild(box);
    const choose = uid => { const target = getUnit(uid); if (target && alive(target)) { addStatus(liz, 'lizRedirect', uid, 1); logMsg(`${liz.name} escolheu ${target.name} para receber metade do dano.`); } box.remove(); };
    box.querySelectorAll('button').forEach(b => b.onclick = () => choose(b.dataset.uid));
    setTimeout(() => { if (document.getElementById('hvLizChoice')) choose(allies[0].uid); }, 3500);
  }

  function turnMaintenance() {
    if (!state) return;
    const turn = state.turn;
    const firstRun = !turnMaintenance.lastTurn;
    if (!firstRun && turnMaintenance.lastTurn === turn) return;
    turnMaintenance.lastTurn = turn;

    for (const u of allUnitsAll()) {
      ensureStateFields(u);
      u.damagedThisTurn = 0;
      removeStatus(u, 'moldarRevenge');
      if (u.ventroxCopy && u.ventroxCopy.untilTurn < turn) delete u.ventroxCopy;
      if (u.cardId === 'moldar' && alive(u)) addStatus(u, 'moldarRevenge', 1, 1);
    }
    for (const liz of allUnitsAll().filter(u => alive(u) && u.cardId === 'liz')) promptLizRedirect(liz);
  }

  const wrappedRunEffects = function(effects, ctx, log) {
    if (!effects || !effects.length) return;
    const caster = ctx.caster;
    const chosen = ctx.chosenTarget;

    if (chosen && chosen.statuses?.some(s => s.status === 'daxenNullifyNext') && chosen.owner !== caster.owner) {
      chosen.statuses = chosen.statuses.filter(s => s.status !== 'daxenNullifyNext');
      log(`${chosen.name} anula a primeira Habilidade que o alveja.`);
      return;
    }

    if (chosen && chosen.statuses?.some(s => s.status === 'draakProtected') && chosen.owner !== caster.owner) {
      log(`${chosen.name} não pode ser alvejado durante a proteção de Draak.`);
      return;
    }

    const taunter = enemiesOf(caster).find(u => u.cardId === 'uragi' && u.statuses.some(s => s.status === 'uragiTauntAll'));
    const effectiveCtx = taunter ? { ...ctx, chosenTarget: taunter, lastTarget: taunter } : ctx;

    if (caster.ventroxCopy && caster.ventroxCopy.untilTurn === state.turn) {
      const copied = caster.ventroxCopy.effects;
      delete caster.ventroxCopy;
      log(`${caster.name} usa a Habilidade copiada de Ventrox.`);
      return wrappedRunEffects(copied, effectiveCtx, log);
    }

    // Moldar deixa de revidar exatamente quando chega sua própria ação.
    if (caster.cardId === 'moldar') removeStatus(caster, 'moldarRevenge');

    for (const eff of effects) {
      if (runCustomEffect(eff, effectiveCtx, log)) continue;
      if (eff.type === 'dealDamage') {
        const targets = Engine.resolveTargets(eff.target, effectiveCtx);
        const amount = damageAmount(eff);
        for (const target of targets) {
          if (target && target.owner !== caster.owner && target.statuses?.some(s => s.status === 'draakProtected')) {
            log(`${target.name} está protegido pela transformação de Draak.`);
            continue;
          }
          const dealt = applyDamageWithHooks(target, amount, caster, log);
          effectiveCtx.lastTarget = target;
          if (dealt > 0 && target.cardId === 'liz') target.lastHealAmount = dealt;
        }
        continue;
      }
      originalRunEffects([eff], effectiveCtx, log);
    }
  };

  Engine.runEffects = wrappedRunEffects;

  function boot() {
    if (initialized) return;
    if (typeof state === 'undefined') return setTimeout(boot, 100);
    initialized = true;
    setInterval(turnMaintenance, 100);
  }
  boot();
})();
