MODERN_UNIT_DEFS.carmelita_marquese = {
    id: "carmelita_marquese", displayName: "Carmelita Marquese", team: "player", role: "support",
    color: 0x6b1f34, accentColor: 0xdff5ef, shape: "carmelita_marquese",
    stats: { maxHP: 63, speed: 6 },
    abilities: [
      {
        id: "conceder_escudo", name: "Conceder Escudo", desc: "Conceda 12 de Escudo para um aliado. Coloque uma marca de Marquese nele.",
        animKey: "skill1", speed: 3, targetType: "ally",
        effects: [
          { verb: "shield", target: "target", amount: 12 },
          { verb: "applyStatus", target: "target", status: () => StatusLib.marqueseMark() }
        ]
      },
      {
        id: "convocar_marcados", name: "Convocar Marcados", desc: "Todos os aliados com a marca de Marquese utilizam uma habilidade aleatória. Remova a marca deles.",
        animKey: "skill2", speed: 12, targetType: "self",
        effects: [
          { verb: "useRandomAbilityOnMarked", markStatusId: "marquese_mark" }
        ]
      },
      {
        id: "restaurar_marcados", name: "Restaurar Marcados", desc: "Recupere 12 de vida de todos os aliados com a marca de Marquese.",
        animKey: "skill3", speed: 3, targetType: "self", cooldown: 2,
        effects: [
          { verb: "healMarked", side: "allies", markStatusId: "marquese_mark", amount: 12 }
        ]
      }
    ]
  };
