MODERN_UNIT_DEFS.mariana = {
    id: "mariana", displayName: "Mariana, Tocada Pela Luz", team: "player", role: "support",
    color: 0xd94f6f, accentColor: 0xffe6b0, shape: "mariana",
    stats: { maxHP: 61, speed: 5 },
    abilities: [
      {
        id: "lightstrike", name: "Golpe de Luz", desc: "13 dano num inimigo. Ganho contadores de Prote\u00e7\u00e3o iguais ao dano.", animKey: "skill1", speed: 9,
        effects: [
          { verb: "damage", target: "target", amount: 13 },
          { verb: "gainCounter", target: "self", counter: "protecao", amount: (ctx) => 13 }
        ]
      },
      {
        id: "channelheal", name: "Canalizar Prote\u00e7\u00e3o", desc: "Gasta todos os contadores de Prote\u00e7\u00e3o para curar um aliado.", animKey: "skill2", speed: 1, targetType: "ally",
        effects: [
          { verb: "spendCounters", target: "self", counter: "protecao", amount: "all", into: "heal" },
          { verb: "heal", target: "target", amount: (ctx) => (ctx.actor.counters && ctx.actor.counters.protecao) || 0 }
        ]
      },
      {
        id: "hasten", name: "Acelerar", desc: "Um aliado age imediatamente.", animKey: "skill2", speed: 2, targetType: "ally",
        effects: [
          { verb: "forceImmediateAction", target: "target" }
        ]
      }
    ]
  };
