MODERN_UNIT_DEFS.ajax = {
    id: "ajax", displayName: "Ajax, o Ultra-Humano", team: "player", role: "defender",
    color: 0x6b7680, accentColor: 0xe8ecef, shape: "ajax", modelScale: 1.4,
    stats: { maxHP: 90, speed: 4 },
    abilities: [
      {
        id: "duel", name: "Duelo", desc: "Eu causo 15 e recebo 15 de volta.", animKey: "skill1", speed: 6,
        effects: [
          { verb: "damage", target: "target", amount: 15 },
          { verb: "damage", target: "self", amount: 15 }
        ]
      },
      {
        id: "bleedstrike", name: "Golpe Sangrento", desc: "10 dano + Sangramento (5/turno).", animKey: "skill2", speed: 8,
        effects: [
          { verb: "damage", target: "target", amount: 10 },
          { verb: "applyStatus", target: "target", status: () => StatusLib.bleed(5) }
        ]
      },
      {
        id: "chainstrike", name: "Corrente Fatal", desc: "10 dano, repete se Sangrando, repete de novo se eu \u226440 HP.", animKey: "skill3", speed: 6,
        effects: [
          { verb: "damage", target: "target", amount: 10 },
          {
            verb: "repeatIf",
            when: (ctx) => hasStatus(ctx.target, 'bleed'),
            effects: [
              { verb: "damage", target: "target", amount: 10 },
              {
                verb: "repeatIf",
                when: (ctx) => ctx.actor.hp <= 40,
                effects: [
                  { verb: "damage", target: "target", amount: 10 }
                ]
              }
            ]
          }
        ]
      }
    ]
  };
