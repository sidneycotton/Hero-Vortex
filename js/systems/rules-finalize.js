/* Hero Vortex — final rule-order safety net.
   Keeps declarative cards intact and fixes effect ordering that a generic
   wrapper cannot safely express before delegating back to the existing engine. */
(() => {
  if (window.__hvRulesFinalizeInstalled) return;
  window.__hvRulesFinalizeInstalled = true;

  if (typeof Engine === 'undefined' || typeof Engine.runEffects !== 'function') return;

  const nativeRunEffects = Engine.runEffects;
  Engine.runEffects = function(effects, ctx, log) {
    const list = effects || [];
    const remaining = [];

    for (const original of list) {
      const eff = original && typeof original === 'object' ? { ...original } : original;
      if (!eff) continue;

      // Nira explicitly says "no próximo turno". Store a startTurn marker so
      // the cap cannot affect damage later in the turn in which it was applied.
      if (eff.type === 'applyStatus' && eff.status === 'damageCap' && eff.target) {
        const targets = Engine.resolveTargets(eff.target, ctx).filter(Boolean);
        for (const target of targets) {
          target.statuses = target.statuses.filter(s => s.status !== 'damageCap');
          target.statuses.push({
            status: 'damageCap',
            value: Number(eff.value) || 0,
            duration: 2,
            startTurn: state.turn + 1,
          });
          log(`${target.name} recebe limite de ${eff.value} de dano por instância a partir do próximo turno.`);
        }
        continue;
      }

      remaining.push(eff);
    }

    const isGrathThreshold = ctx?.caster?.cardId === 'grath'
      && remaining.some(e => e?.type === 'dealDamage' && e?.target === 'chooseEnemy')
      && remaining.some(e => e?.type === 'conditionalDamage' && e?.condition === 'targetLifeGTE:100');

    if (isGrathThreshold) {
      const first = remaining.find(e => e?.type === 'dealDamage' && e?.target === 'chooseEnemy');
      const second = remaining.find(e => e?.type === 'conditionalDamage' && e?.condition === 'targetLifeGTE:100');
      const initialLife = ctx.chosenTarget ? Engine.getCurrentLife(ctx.chosenTarget) : 0;

      nativeRunEffects([first], ctx, log);
      if (initialLife >= 100) nativeRunEffects([second], ctx, log);

      for (const extra of remaining) {
        if (extra !== first && extra !== second) nativeRunEffects([extra], ctx, log);
      }
      return;
    }

    return nativeRunEffects(remaining, ctx, log);
  };
})();
