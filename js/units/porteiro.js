MODERN_UNIT_DEFS.porteiro = {
    id: "porteiro", displayName: "O Porteiro", team: "player", role: "defender",
    color: 0x8a8478, accentColor: 0x6fbf5a, shape: "porteiro", modelScale: 1.5,
    stats: { maxHP: 84, speed: 5 },
    abilities: [
      {
        id: "bom_dia", name: "Bom Dia", speed: 5, animKey: "skill1",
        desc: "Eu causo 8 de dano em um inimigo. Se ele n\u00e3o me atacar neste turno, causo mais 8 no fim do turno. \u201cBom dia.\u201d",
        effects: [
          { verb: "damage", target: "target", amount: 8 },
          { verb: "speechBubble", who: "self", text: "Bom dia." },
          // Marks the actor (O Porteiro) so the round-end tick can pay
          // off the extra 8 if nobody landed real damage on him this
          // round — see StatusLib.punishIfIgnored / tickRoundEndStatuses
          // in effects.js. The "shouted" line only fires if the payoff
          // actually lands.
          {
            verb: "applyStatus", target: "self",
            status: (ctx) => StatusLib.punishIfIgnored(ctx.target, 8, "Bom dia.", "BOM DIAAAA!!!")
          }
        ]
      },
      {
        id: "purificar", name: "Purificar", speed: 2, animKey: "skill2", targetType: "ally",
        desc: "Purifique uma unidade.",
        effects: [
          { verb: "purify", target: "target" }
        ]
      },
      {
        id: "provocar", name: "Provocar", speed: 3, animKey: "skill3", targetType: "ally", cooldown: 1,
        desc: "Eu Provoco um aliado. Ao inv\u00e9s de me danificar, o dano dele me cura neste turno.",
        effects: [
          // "Provoco um aliado": the target becomes the provoker for the
          // rest of this round — any enemy ability that would target the
          // provoked ally gets redirected onto O Porteiro instead (see
          // resolveTarget's provoke redirect in effects.js). "Todas as
          // partes alvejadas" is honored automatically since every effect
          // step funnels through resolveTarget.
          { verb: "applyStatus", target: "target", status: (ctx) => StatusLib.provoke(ctx.actor) },
          // "Ao inv\u00e9s de me danificar, o dano dele me cura neste turno":
          // O Porteiro himself gets a reactiveForm-style self-buff isn't
          // quite right here (that's a form flip, not a heal-instead-of-
          // damage swap) — instead this uses a dedicated redirectDamageAsHeal
          // status on O Porteiro naming the protected ally, so any damage
          // that WOULD land on O Porteiro because of the provoke redirect
          // above heals him instead. See combat-engine.js's applyOne damage
          // branch for the check.
          { verb: "applyStatus", target: "self", status: (ctx) => StatusLib.redirectDamageAsHeal(ctx.target) }
        ]
      }
    ]
  };
