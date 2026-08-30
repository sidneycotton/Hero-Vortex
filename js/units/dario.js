MODERN_UNIT_DEFS.dario = {
    id: "dario", displayName: "Dário, o Senador e a Sombra", team: "player", role: "support",
    color: 0x2c2c30, accentColor: 0xdff5ef, shape: "dario",
    stats: { maxHP: 66, speed: 5 },
    abilities: [
      {
        // First passive ability in the game — see the global passive
        // system: `passive: true`, no `speed`, no `animKey` (never plays
        // an action animation), never shown as a selectable option (see
        // renderAbilityRow's passive branch in index.html), never queued
        // or used by the AI. Its effects[] runs exactly once, at spawn
        // (see Unit's constructor in index.html), granting the permanent
        // reactiveForm status that the constant effect actually lives on.
        // The status itself then flips automatically forever after,
        // generically, in combat-engine.js's apply() — not through this
        // ability being "used" again.
        id: "senador_e_sombra", name: "O Senador e a Sombra",
        desc: "Quando um aliado me curar, eu me torno o Senador. Quando um aliado me danificar, eu me torno a Sombra.",
        passive: true,
        effects: [
          { verb: "applyStatus", target: "self", status: () => StatusLib.reactiveForm("dario_form", "senador", "senador", "sombra") }
        ]
      },
      {
        id: "golpe_dario", name: "Golpe do Senador", desc: "Cause 7 de dano em um inimigo. Se eu for o Senador, cure 7 de vida de um alvo. Se eu for a Sombra, cause 7 de dano a mais.",
        animKey: "skill1", speed: 5,
        effects: [
          { verb: "damage", target: "target", amount: 7 },
          {
            verb: "repeatIf",
            when: (ctx) => currentForm(ctx.actor, "dario_form") === "sombra",
            effects: [
              { verb: "damage", target: "target", amount: 7 }
            ]
          },
          {
            verb: "repeatIf",
            when: (ctx) => currentForm(ctx.actor, "dario_form") === "senador",
            effects: [
              { verb: "heal", target: "target", amount: 7 }
            ]
          }
        ]
      },
      {
        id: "escudo_dario", name: "Manto Protetor", desc: "Conceda 5 de Escudo para um aliado. Se eu for o Senador, dobre o Escudo que ele tem. Se eu for a Sombra, roube o Escudo de um inimigo.",
        animKey: "skill2", speed: 6, targetType: "ally",
        effects: [
          { verb: "shield", target: "target", amount: 5 },
          {
            verb: "repeatIf",
            when: (ctx) => currentForm(ctx.actor, "dario_form") === "senador",
            effects: [
              { verb: "doubleShield", target: "target" }
            ]
          },
          {
            verb: "repeatIf",
            when: (ctx) => currentForm(ctx.actor, "dario_form") === "sombra",
            effects: [
              {
                verb: "stealShield",
                target: (ctx) => {
                  const enemies = (ctx.actor.team === 'player' ? ctx.enemyUnits : ctx.playerUnits).filter(u => u.alive && u.shield > 0);
                  return enemies.length ? enemies[Math.floor(Math.random() * enemies.length)] : null;
                },
                to: "self",
                amount: "all"
              }
            ]
          }
        ]
      }
    ]
  };
