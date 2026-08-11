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
    const isGrathThreshold = ctx?.caster?.cardId === 'grath'
      && list.some(e => e?.type === 'dealDamage' && e?.target === 'chooseEnemy')
      && list.some(e => e?.type === 'conditionalDamage' && e?.condition === 'targetLifeGTE:100');

    if (isGrathThreshold) {
      const first = list.find(e => e?.type === 'dealDamage' && e?.target === 'chooseEnemy');
      const second = list.find(e => e?.type === 'conditionalDamage' && e?.condition === 'targetLifeGTE:100');
      const initialLife = ctx.chosenTarget ? Engine.getCurrentLife(ctx.chosenTarget) : 0;

      nativeRunEffects([first], ctx, log);
      if (initialLife >= 100) nativeRunEffects([second], ctx, log);

      for (const extra of list) {
        if (extra !== first && extra !== second) nativeRunEffects([extra], ctx, log);
      }
      return;
    }

    return nativeRunEffects(list, ctx, log);
  };
})();
