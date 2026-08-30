MODERN_UNIT_DEFS.maquina_de_guerra = {
    id: "maquina_de_guerra", displayName: "M\u00e1quina de Guerra", team: "player", role: "attacker",
    color: 0x8C5230, accentColor: 0x4A4A4A, shape: "maquina_de_guerra",
    stats: { maxHP: 15, speed: 4 },
    abilities: [
      {
        id: "cause_dano", name: "Cause 5 de dano.", desc: "Causa 5 de dano.", animKey: "skill1", speed: 4,
        effects: [
          { verb: "damage", target: "target", amount: 5 }
        ]
      },
      {
        id: "cause_dano_2", name: "Cause 5 de dano.", desc: "Causa 5 de dano.", animKey: "skill2", speed: 4,
        effects: [{ verb: "damage", target: "target", amount: 5 }]
      },
      {
        id: "cause_dano_3", name: "Cause 5 de dano.", desc: "Causa 5 de dano.", animKey: "skill3", speed: 4,
        effects: [{ verb: "damage", target: "target", amount: 5 }]
      }
    ]
  };
