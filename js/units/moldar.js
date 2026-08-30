MODERN_UNIT_DEFS.moldar = {
    id: "moldar", displayName: "Moldar, Paci\u00eancia Solar", team: "player", role: "defender",
    color: 0x8f96a3, accentColor: 0xcda54a, shape: "moldar",
    stats: { maxHP: 80, speed: 7 },
    abilities: [
      {
        id: "moldar_solar", name: "Moldar Solar", desc: "Eu ganho +10 de vida m\u00e1xima. Repita para cada vez que eu fui danificado neste turno.", animKey: "skill1", speed: 9,
        effects: [
          { verb: "gainMaxHP", target: "self", amount: 10, repeatPerDamageTaken: true }
        ]
      },
      {
        id: "paciencia", name: "Paci\u00eancia", desc: "N\u00e3o fa\u00e7a nada. \u201cPerder a paci\u00eancia \u00e9 perder a batalha...\u201d", animKey: "skill2", speed: 5, targetType: "self",
        effects: []
      },
      {
        id: "vigilia_solar", name: "Vig\u00edlia Solar", desc: "At\u00e9 eu agir com outra habilidade, quando um aliado for danificado, eu revido causando 6 de dano em um inimigo.", animKey: "skill3", speed: 7, targetType: "self",
        effects: [
          { verb: "applyStatus", target: "self", status: () => StatusLib.guardAllies(6, "vigilia_solar", "paciencia") }
        ]
      }
    ]
  };
