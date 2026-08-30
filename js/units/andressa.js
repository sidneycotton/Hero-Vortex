MODERN_UNIT_DEFS.andressa = {
    id: "andressa", displayName: "Andressa, Pequena Escudeira", team: "player", role: "support",
    color: 0x8a5a3c, accentColor: 0xe7d9b8, shape: "andressa",
    stats: { maxHP: 50, speed: 5 },
    abilities: [
      {
        // Passive — see the two hooks registered below this def:
        // registerUnitSpawnedHook (the Partner-choice prompt, fired once
        // the instant she takes the field) and registerActionResolvedHook
        // (the damage-share-to-Partner payoff, checked every time she's
        // hit). Nothing here runs through the normal "grant myself a
        // status at spawn" passive path (this ability's own effects[] is
        // empty) since the actual behavior needs a player-facing CHOICE,
        // not just a status grant.
        id: "vinculo_escudeira", name: "Vínculo da Escudeira",
        desc: "Quando eu for Jogada, um aliado se torna meu Parceiro, sempre que eu for danificada, metade do dano vira cura para ele.",
        passive: true,
        effects: []
      },
      {
        id: "amparo_escudeira", name: "Amparo da Escudeira",
        desc: "Recupere 5 de vida de um aliado e o conceda um escudo de 5 de vida. Se o aliado for o meu parceiro, faça o mesmo em mim.",
        animKey: "skill1", speed: 3, targetType: "ally",
        effects: [
          { verb: "heal", target: "target", amount: 5 },
          { verb: "shield", target: "target", amount: 5 },
          {
            // Mirrors the same heal+shield onto Andressa herself, but only
            // when the chosen target IS her bonded Partner (see
            // _squirePartner, set by the spawn-choice hook below).
            verb: "repeatIf",
            when: (ctx) => !!ctx.actor._squirePartner && ctx.target === ctx.actor._squirePartner,
            effects: [
              { verb: "heal", target: "self", amount: 5 },
              { verb: "shield", target: "self", amount: 5 }
            ]
          }
        ]
      },
      {
        id: "vigilia_protegida", name: "Vigília Protegida",
        desc: "Conceda um escudo de 10 de vida para mim. Enquanto eu tiver um escudo, cura aliada se transforma em vida máxima para o alvo.",
        animKey: "skill2", speed: 5, cooldown: 3,
        effects: [
          { verb: "shield", target: "self", amount: 10 },
          // Grants the aura status once; the actual "am I currently
          // shielded" gate is re-checked live at every heal (see
          // combat-engine.js's applyOne) rather than being duration-based,
          // so re-casting this just re-tops the shield that keeps it on.
          { verb: "applyStatus", target: "self", status: () => StatusLib.healGrowthField() }
        ]
      }
    ]
  };

// =============================================================
// Vínculo da Escudeira — passive hooks
// =============================================================
// Two generic hook points (js/effects.js) drive this passive instead of
// the normal spawn-time "grant myself a status" path:
//
// 1. onUnitSpawned — fires the moment Andressa herself takes the field
//    (battle start OR a forced replacement after the previous support
//    died — both are just "quando eu for Jogada" from the card's own
//    point of view, no separate death-watching needed). Prompts the human
//    player to pick a living ally as Partner (AI picks at random,
//    instantly). One-shot: `_squireBondUsed` is set immediately whether or
//    not a Partner is actually found, so this never fires again for this
//    Andressa even after her Partner later dies.
//
// 2. onActionResolved — fires after every resolved action; whenever
//    Andressa takes real damage this round, half of it (rounded down)
//    heals her current Partner instead. Also lazily clears `_squirePartner`
//    once it notices the Partner has died, which is what makes "o vínculo
//    se desfaz" happen — nothing re-grants it afterward since the bond is
//    already one-shot per hook #1.

// Guarded the same way the rest of this project treats "runs in a context
// where a later-loaded global might not exist yet" (see e.g. isApprovalGated
// in js/units/core.js): tests/unit-data-check.js and
// tests/model-regression.js each load js/units/*.js in isolation, in a
// different order than index.html's real <script> tags (effects.js loads
// AFTER units there), so these two globals may not exist yet when this
// file's top level runs under those harnesses. In the real page, effects.js
// always loads first and both are always defined.
if (typeof registerUnitSpawnedHook === 'function') registerUnitSpawnedHook(async (unit) => {
  if (unit.defId !== 'andressa' || unit._squireBondUsed) return;
  unit._squireBondUsed = true;
  const roster = unit.team === 'player' ? playerUnits : enemyUnits;
  const candidates = roster.filter(u => u.alive && u !== unit);
  if (!candidates.length) return;
  const partner = unit.team === 'player'
    ? await promptChooseAlly(I18n.t('log.choosePartner', { unit: UnitText.displayName(unit) }), candidates)
    : candidates[Math.floor(Math.random() * candidates.length)];
  if (!partner || !partner.alive) return;
  unit._squirePartner = partner;
  applyStatusToUnit(partner, StatusLib.partnerBond(unit.displayName));
  addLogLine(I18n.t('log.becomesPartner', { partner: UnitText.displayName(partner), unit: UnitText.displayName(unit) }), 'info');
  refreshAllUnitUI();
});

if (typeof registerActionResolvedHook === 'function') registerActionResolvedHook((action, ctx) => {
  const hits = (ctx.result.applied || []).filter(a => a.verb === 'damage' && a.actualDamage > 0
    && a.target && a.target.defId === 'andressa' && a.target._squirePartner);
  for (const hit of hits) {
    const andressa = hit.target;
    const partner = andressa._squirePartner;
    if (!partner.alive) { andressa._squirePartner = null; continue; }
    const healAmount = Math.floor(hit.actualDamage / 2);
    if (healAmount <= 0) continue;
    const healResult = CombatEngine.applyOne({ verb: 'heal', target: partner, amount: healAmount }, ctx.result);
    if (healResult.actualHeal > 0) {
      addLogLine(I18n.t('log.sharesHeal', { unit: UnitText.displayName(andressa), amount: healResult.actualHeal, partner: UnitText.displayName(partner) }), 'heal');
      renderFloatingNumbers({ applied: [healResult] });
    }
  }
});
