MODERN_UNIT_DEFS.yvrel = {
    id: "yvrel", displayName: "Yvrel, a Luz que se Apagou", team: "player", role: "attacker",
    color: 0xb2472f, accentColor: 0xffb07a, shape: "yvrel",
    stats: { maxHP: 74, speed: 6 },
    abilities: [
      {
        id: "silencingblow", name: "Golpe Silenciador", desc: "13 dano. Alvo intoc\u00e1vel neste turno.", animKey: "skill1", speed: 3,
        effects: [
          { verb: "damage", target: "target", amount: 13 },
          { verb: "applyStatus", target: "target", status: () => StatusLib.untargetable('thisRound') }
        ]
      },
      {
        id: "delayblow", name: "Golpe Atrasador", desc: "10 dano. Alvo se move por \u00faltimo.", animKey: "skill2", speed: 3,
        effects: [
          { verb: "damage", target: "target", amount: 10 },
          { verb: "applyStatus", target: "target", status: () => StatusLib.moveLast('thisRound') }
        ]
      },
      {
        id: "echostrike", name: "Golpe Eco", desc: "23 dano. Depois, escolha outra habilidade minha (diferente da \u00faltima) para usar em um aliado.", animKey: "skill3", speed: 4,
        promptsEcho: true,
        effects: [
          { verb: "damage", target: "target", amount: 23 },
          {
            verb: "useAbilityOn",
            target: (ctx) => {
              const allies = ctx.playerUnits.filter(u => u.alive);
              return allies[Math.floor(Math.random() * allies.length)];
            },
            select: (ctx) => {
              const last = CombatEngine.lastAbilityId(ctx.actor);
              const others = ctx.actor.abilities.filter(a => a.id !== 'echostrike' && a.id !== last);
              return others.length ? others[Math.floor(Math.random() * others.length)] : null;
            }
          }
        ]
      }
    ]
  };
