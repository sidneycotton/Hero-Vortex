MODERN_UNIT_DEFS.amelia = {
    id: "amelia", displayName: "Amelia, Ascendente Inc\u00f4moda", team: "player", role: "attacker",
    color: 0x2b2440, accentColor: 0xb98cff, shape: "amelia",
    stats: { maxHP: 74, speed: 6 },
    abilities: [
      {
        id: "retribuicao_atrasada", name: "Retribui\u00e7\u00e3o Atrasada", desc: "Cause 15 de dano em todos os inimigos que j\u00e1 utilizaram uma habilidade neste turno.", animKey: "skill1", speed: 3,
        targetType: "enemy",
        effects: [
          { verb: "damageAllActedThisRound", amount: 15 }
        ]
      },
      {
        id: "fluxo_do_tempo", name: "Fluxo do Tempo", desc: "Seus outros aliados s\u00e3o mais r\u00e1pidos em 5 no pr\u00f3ximo turno. Inimigos s\u00e3o mais r\u00e1pidos em 3 no pr\u00f3ximo turno.", animKey: "skill2", speed: 3,
        targetType: "self",
        effects: [
          { verb: "applyStatusToTeam", side: "allies", excludeSelf: true, status: () => StatusLib.speedMod(5) },
          { verb: "applyStatusToTeam", side: "enemies", status: () => StatusLib.speedMod(3) }
        ]
      },
      {
        id: "golpe_definitivo", name: "Golpe Definitivo", desc: "Cause 18 de dano em um inimigo. O alvo age imediatamente.", animKey: "skill3", speed: 3,
        effects: [
          { verb: "damage", target: "target", amount: 18 },
          { verb: "forceImmediateAction", target: "target" }
        ]
      }
    ]
  };
