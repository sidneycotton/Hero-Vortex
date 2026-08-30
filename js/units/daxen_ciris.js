MODERN_UNIT_DEFS.daxen_ciris = {
    id: "daxen_ciris", displayName: "Daxen-Ciris", team: "player", role: "defender",
    color: 0x8a1c1c, accentColor: 0xd4af37, shape: "daxen_ciris",
    stats: { maxHP: 85, speed: 4 },
    abilities: [
      {
        id: "espelho_defensor", name: "Espelho do Defensor", desc: "Eu ganho +7 de vida, uso a Habilidade mais r\u00e1pida do Defensor inimigo (voc\u00ea escolhe o alvo).", animKey: "skill1", speed: 4,
        // promptsMirror: like Yvrel's promptsEcho, but the ability being
        // copied is already fully determined (the fastest ability of the
        // enemy in `mirrorRole`) instead of player-chosen — the UI just
        // shows it and asks for a target. See beginMirrorFlow/
        // finalizeMultiStepPlan in js/planning-ui.js.
        promptsMirror: true, mirrorRole: 'defender',
        effects: [
          { verb: "heal", target: "self", amount: 7 },
          {
            verb: "useAbilityOn",
            target: (ctx) => findEnemyByRole(ctx, 'defender'),
            select: (ctx) => fastestAbilityOf(findEnemyByRole(ctx, 'defender'))
          }
        ]
      },
      {
        id: "espelho_atacante", name: "Espelho do Atacante", desc: "Causo 7 de dano, uso a Habilidade mais r\u00e1pida do Atacante inimigo (voc\u00ea escolhe o alvo).", animKey: "skill2", speed: 4,
        promptsMirror: true, mirrorRole: 'attacker',
        effects: [
          { verb: "damage", target: (ctx) => findEnemyByRole(ctx, 'attacker'), amount: 7 },
          {
            verb: "useAbilityOn",
            target: (ctx) => findEnemyByRole(ctx, 'attacker'),
            select: (ctx) => fastestAbilityOf(findEnemyByRole(ctx, 'attacker'))
          }
        ]
      },
      {
        id: "vigilia_final", name: "Vig\u00edlia Final", desc: "Eu ganho +14 de vida. No pr\u00f3ximo turno, anulo a primeira Habilidade que me alvejar.", animKey: "skill3", speed: 9,
        effects: [
          { verb: "heal", target: "self", amount: 14 },
          { verb: "applyStatus", target: "self", status: () => StatusLib.nullifyNext('thisRound') }
        ]
      }
    ]
  };
