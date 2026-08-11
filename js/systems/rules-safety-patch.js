/* Hero Vortex — post-rule safety patch. */
(() => {
  if (window.__hvRulesSafetyPatchInstalled) return;
  window.__hvRulesSafetyPatchInstalled = true;
  if (!window.Engine || !window.Engine.applyDamage) return;

  const nativeDamage = window.Engine.applyDamage;
  window.Engine.applyDamage = function(unit, amount, log, source = null) {
    if (unit?.statuses?.some(s => s.status === 'damageCap' && s.startTurn && state.turn < s.startTurn)) {
      const saved = unit.statuses;
      unit.statuses = saved.filter(s => !(s.status === 'damageCap' && s.startTurn && state.turn < s.startTurn));
      try { return nativeDamage(unit, amount, log, source); }
      finally { unit.statuses = saved; }
    }
    return nativeDamage(unit, amount, log, source);
  };
})();
