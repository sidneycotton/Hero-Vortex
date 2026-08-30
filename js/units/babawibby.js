MODERN_UNIT_DEFS.babawibby = {
    id: "babawibby", displayName: "Babawibby o Mais Melhor de Bom", team: "player", role: "support",
    color: 0xFF6600, accentColor: 0x5D8B43, shape: "babawibby",
    stats: { maxHP: 50, speed: 4 },
    abilities: [
      {
        id: "crie_maquina", name: "Montagem de Sucata", desc: "Cria uma M\u00e1quina de Guerra aliada.", animKey: "skill1", speed: 4, targetType: "self",
        effects: [
          { verb: "summon", defId: "maquina_de_guerra", tag: "maquina_de_guerra" },
          { verb: "note", text: "Montagem de Sucata." }
        ]
      },
      {
        id: "destrua_maquina", name: "Sacrif\u00edcio Explosivo", desc: "Sacrifica uma M\u00e1quina de Guerra aliada para causar 20 de dano num inimigo.", animKey: "skill2", speed: 5,
        targetType: "ally", targetFilter: (u) => u.summonTag === "maquina_de_guerra",
        promptsSecondTarget: "enemy",
        effects: [
          { verb: "sacrificeAlly", tag: "maquina_de_guerra", select: (candidates) => candidates[0] },
          { verb: "damage", target: (ctx) => ctx.secondTarget, amount: 20 }
        ]
      },
      {
        id: "recupere_vida", name: "Remendo R\u00e1pido", desc: "Recupera 8 de vida de todos os aliados.", animKey: "skill3", speed: 9, targetType: "ally",
        effects: [
          { verb: "healAllAllies", amount: 8 }
        ]
      }
    ]
  };
