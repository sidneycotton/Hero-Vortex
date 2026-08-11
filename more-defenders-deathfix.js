// Conta também mortes de tokens/cópias que saem de allUnitsOf() assim que ficam mortas.
(() => {
  const counted = new Set();
  const timer = setInterval(() => {
    if (!state) return;
    state.totalDeaths ||= 0;
    for (const p of state.players) {
      for (const unit of p.extraUnits) {
        if (!unit.dead || counted.has(unit.uid)) continue;
        counted.add(unit.uid);
        state.totalDeaths++;
        for (const varghul of allUnitsOf(unit.owner).filter(u => !u.dead && u.cardId === 'varghul')) {
          const enemies = allUnitsOf(1 - varghul.owner).filter(u => !u.dead);
          const target = enemies[0];
          if (target) Engine.applyDamage(target, 6, logMsg, varghul);
        }
      }
    }
  }, 100);
})();
