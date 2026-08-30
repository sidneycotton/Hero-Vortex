MODERN_UNIT_DEFS.sirius = {
    id: "sirius", displayName: "Sirius, Escritor do Pr\u00f3prio Futuro", team: "player", role: "attacker",
    color: 0x1c2a4a, accentColor: 0xf2c14e, shape: "sirius",
    stats: { maxHP: 77, speed: 5 },
    abilities: [
      {
        id: "reescrever", name: "Reescrever", desc: "Ganho um Contador de Reescrita. Cada contador adiciona +1 uso extra \u00e0 pr\u00f3xima OUTRA habilidade que eu usar neste turno.", animKey: "skill1", speed: 1,
        targetType: "self",
        effects: [
          { verb: "applyStatus", target: "self", status: () => StatusLib.stackingBuff('rewrite', 'Contador de Reescrita') },
          { verb: "primeNextAbilityFromStacks", statusId: "rewrite", excludeAbilityIds: ["reescrever"] }
        ]
      },
      {
        id: "troca_de_destino", name: "Troca de Destino", desc: "Troco de posi\u00e7\u00e3o com o Defensor do meu time neste turno. Ganho +15 de vida m\u00e1xima permanente.", animKey: "skill2", speed: 5,
        targetType: "self",
        effects: [
          {
            verb: "swapRoleWithAlly",
            withTarget: (ctx) => (ctx.actor.team === 'player' ? ctx.playerUnits : ctx.enemyUnits)
              .find(u => u.slotIndex === ROLE_SLOT.defender && u.alive && u !== ctx.actor),
            actorTag: "defender", allyTag: "attacker"
          },
          { verb: "gainMaxHP", target: "self", amount: 15, healToFull: false }
        ]
      },
      {
        id: "golpe_final", name: "Golpe Final", desc: "Todas as Habilidades dos Her\u00f3is causam +2 de dano neste turno. Causa 8 de dano a um inimigo.", animKey: "skill3", speed: 5,
        effects: [
          { verb: "applyStatusToTeam", side: "allies", status: () => StatusLib.teamDamageBonus(2) },
          { verb: "damage", target: "target", amount: 8 }
        ]
      }
    ]
  };
