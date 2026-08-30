MODERN_UNIT_DEFS.gavin = {
    id: "gavin", displayName: "Gavin, Mestre Insuper\u00e1vel", team: "player", role: "attacker",
    color: 0x2e3440, accentColor: 0xe8d9b0, shape: "gavin",
    stats: { maxHP: 62, speed: 6 },
    abilities: [
      {
        // Passive: never selectable/queued (see the global passive system —
        // Dário's kit is the other user of this pattern). Its effects[]
        // grants a permanent gavinFollowup marker at spawn; the actual
        // "an ally acted right after me -> 2 damage to all enemies" payoff
        // is generic engine logic in resolution.js that reads this marker.
        id: "presenca_ameacadora", name: "Presen\u00e7a Amea\u00e7adora",
        desc: "Sempre que um aliado utilizar uma Habilidade logo em seguida da minha, causo 2 de dano em todos os inimigos.",
        passive: true,
        effects: [
          { verb: "applyStatus", target: "self", status: () => StatusLib.gavinFollowup(2) }
        ]
      },
      {
        id: "ataque_e_cura", name: "Ataque e Cura",
        desc: "Cause 4 de dano em um inimigo, cure 4 de vida de um aliado. Essa Habilidade ocorre novamente neste turno, com 8 de Velocidade, Dano e Cura.",
        animKey: "skill1", speed: 4,
        // echoAllowSelf: the echo sub-flow lets the player retarget THIS
        // same ability at a new enemy, instead of picking a different
        // ability from the kit (see js/planning-ui.js's multiStepMode handling).
        promptsEcho: true, echoAllowSelf: true,
        effects: [
          { verb: "damage", target: "target", amount: 4 },
          {
            verb: "heal",
            target: (ctx) => {
              const allies = ctx.playerUnits.filter(u => u.alive);
              return allies.length ? allies.reduce((a, b) => (a.hp / a.maxHP) < (b.hp / b.maxHP) ? a : b) : ctx.actor;
            },
            amount: 4
          },
          {
            // The echo choice (if the player picked a new enemy target)
            // re-casts this SAME ability at 8/8/8 instead of 4/4. Falls
            // back to a random living enemy if no echo choice was made
            // (e.g. AI-controlled Gavin, which never goes through the
            // echo UI prompt). The echoed ability lives in def.subAbilities
            // (never in .abilities, never selectable/queued on its own —
            // see the subAbilities comment below).
            verb: "useAbilityOn",
            select: (ctx) => ctx.actor.subAbilities.find(a => a.id === "ataque_e_cura_eco"),
            target: (ctx) => {
              const enemies = (ctx.actor.team === 'player' ? ctx.enemyUnits : ctx.playerUnits).filter(u => u.alive);
              return enemies.length ? enemies[Math.floor(Math.random() * enemies.length)] : null;
            }
          }
        ]
      },
      {
        id: "golpe_gelado", name: "Golpe Gelado",
        desc: "Cause 2 de dano em um inimigo, ele fica Lento 2. Quando um inimigo Lento atacar neste turno, eu uso uma c\u00f3pia desta minha Habilidade em um alvo inimigo v\u00e1lido aleat\u00f3rio.",
        animKey: "skill2", speed: 2,
        effects: [
          { verb: "damage", target: "target", amount: 2 },
          {
            verb: "applyStatus", target: "target",
            status: (ctx) => StatusLib.slow(2, ctx.actor, "golpe_gelado")
          }
        ]
      }
    ],
    // Sub-abilities: never shown in the ability row, never selectable/
    // queued directly, never candidates for the AI, echo-flows, or
    // fastestAbilityOf — reachable only via a `useAbilityOn` step that
    // looks them up by id (see Ataque e Cura's useAbilityOn step above).
    // Any future "bigger version of my own ability, only reachable via a
    // sub-cast" card adds its entry here instead of patching `hidden: true`
    // filters into every UI/AI loop that reads .abilities.
    subAbilities: [
      {
        id: "ataque_e_cura_eco", name: "Ataque e Cura (Eco)",
        desc: "8 de dano em um inimigo, cura 8 de vida de um aliado.", animKey: "skill1", speed: 8,
        effects: [
          { verb: "damage", target: "target", amount: 8 },
          {
            verb: "heal",
            target: (ctx) => {
              const allies = ctx.playerUnits.filter(u => u.alive);
              return allies.length ? allies.reduce((a, b) => (a.hp / a.maxHP) < (b.hp / b.maxHP) ? a : b) : ctx.actor;
            },
            amount: 8
          }
        ]
      }
    ]
  };
