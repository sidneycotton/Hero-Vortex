// =============================================================
// ============ DATA-DRIVEN UNIT DEFINITIONS ====================
// =============================================================
// Two ability formats are supported:
//  1) LEGACY:  { type:'attack'|'heal'|'shield', power, targetType }
//     -> auto-upgraded into a single-step effects[] at load time.
//  2) MODERN:  { effects:[ {verb:...}, ... ], targetType }
//     -> used directly. This is how "unique mechanic" cards are built.
//
// role: 'defender' | 'attacker' | 'support' — determines fixed slot
// (left / middle / right). Every team is exactly one of each.

const ROLE_SLOT = { defender: 0, attacker: 1, support: 2 };

function upgradeLegacyAbility(ability) {
  if (ability.effects) return ability; // already modern
  const step = {};
  if (ability.type === 'attack') {
    step.verb = 'damage'; step.target = 'target'; step.amount = ability.power;
  } else if (ability.type === 'heal') {
    step.verb = 'heal'; step.target = 'target'; step.amount = ability.power;
  } else if (ability.type === 'shield') {
    step.verb = 'shield'; step.target = 'target'; step.amount = ability.power;
  }
  return { ...ability, effects: [step] };
}

function upgradeUnitDef(def) {
  return { ...def, abilities: def.abilities.map(upgradeLegacyAbility) };
}

// =============================================================
// EXISTING ROSTER (legacy format, auto-upgraded, unchanged behavior)
// =============================================================

const LEGACY_UNIT_DEFS = {
  vanguard: {
    id: "vanguard", displayName: "Vanguard", team: "player", role: "defender",
    color: 0x4fd1c5, accentColor: 0x9df5ec, shape: "brute",
    stats: { maxHP: 34, speed: 4 },
    abilities: [
      { id: "strike", name: "Strike", desc: "Deal 7 dmg", type: "attack", power: 7, animKey: "skill1", speed: 5 },
      { id: "guard", name: "Guard", desc: "Shield 8", type: "shield", power: 8, animKey: "skill2", targetType: "ally", speed: 6 },
      { id: "cleave", name: "Cleave", desc: "Deal 9 dmg", type: "attack", power: 9, animKey: "skill3", speed: 3 }
    ]
  },
  brute: {
    id: "brute", displayName: "Brute", team: "player", role: "attacker",
    color: 0xffb84f, accentColor: 0xffe0a8, shape: "brute",
    stats: { maxHP: 30, speed: 3 },
    abilities: [
      { id: "smash", name: "Smash", desc: "Deal 8 dmg", type: "attack", power: 8, animKey: "skill1", speed: 4 },
      { id: "roar", name: "Roar", desc: "Deal 6 dmg", type: "attack", power: 6, animKey: "skill2", speed: 5 },
      { id: "execute", name: "Execute", desc: "Deal 13 dmg", type: "attack", power: 13, animKey: "skill3", speed: 1 }
    ]
  },
  raider: {
    id: "raider", displayName: "Raider", team: "enemy", role: "attacker",
    color: 0xff6b6b, accentColor: 0xffb0b0, shape: "brute",
    stats: { maxHP: 78, speed: 5 },
    abilities: [
      { id: "slash", name: "Slash", desc: "Deal 7 dmg", type: "attack", power: 7, animKey: "skill1", speed: 6 },
      { id: "gouge", name: "Gouge", desc: "Deal 9 dmg", type: "attack", power: 9, animKey: "skill2", speed: 4 },
      { id: "frenzy", name: "Frenzy", desc: "Deal 5 dmg", type: "attack", power: 5, animKey: "skill3", speed: 8 }
    ]
  },
  hexer: {
    id: "hexer", displayName: "Hexer", team: "enemy", role: "support",
    color: 0xb24fff, accentColor: 0xe0b0ff, shape: "caster",
    stats: { maxHP: 64, speed: 6 },
    abilities: [
      { id: "curse", name: "Curse", desc: "Deal 6 dmg", type: "attack", power: 6, animKey: "skill1", speed: 7 },
      { id: "leech", name: "Leech", desc: "Heal 8", type: "heal", power: 8, animKey: "skill2", targetType: "ally", speed: 5 },
      { id: "blight", name: "Blight", desc: "Deal 9 dmg", type: "attack", power: 9, animKey: "skill3", speed: 2 }
    ]
  },
  titan: {
    id: "titan", displayName: "Titan", team: "enemy", role: "defender",
    color: 0xff9d4f, accentColor: 0xffcfa0, shape: "brute",
    stats: { maxHP: 95, speed: 2 },
    abilities: [
      { id: "crush", name: "Crush", desc: "Deal 8 dmg", type: "attack", power: 8, animKey: "skill1", speed: 3 },
      { id: "bulwark", name: "Bulwark", desc: "Shield 10", type: "shield", power: 10, animKey: "skill2", targetType: "ally", speed: 4 },
      { id: "cataclysm", name: "Cataclysm", desc: "Deal 12 dmg", type: "attack", power: 12, animKey: "skill3", speed: 1 }
    ]
  }
};

// =============================================================
// NEW ROSTER — replaces vanguard/arcanist/brute on the player side
// with Ajax (defender), Yvrel (attacker), Mariana (support).
// Built with the modern effects[] pipeline to express their unique
// mechanics without any engine-side special-casing.
// =============================================================

const MODERN_UNIT_DEFS = {
  ajax: {
    id: "ajax", displayName: "Ajax, o Ultra-Humano", team: "player", role: "defender",
    color: 0x2f6f8f, accentColor: 0x7fd8ff, shape: "ajax",
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
  },

  yvrel: {
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
  },

  mariana: {
    id: "mariana", displayName: "Mariana, Tocada Pela Luz", team: "player", role: "support",
    color: 0xd94f6f, accentColor: 0xffe6b0, shape: "mariana",
    stats: { maxHP: 61, speed: 5 },
    abilities: [
      {
        id: "lightstrike", name: "Golpe de Luz", desc: "13 dano num inimigo. Ganho contadores de Prote\u00e7\u00e3o iguais ao dano.", animKey: "skill1", speed: 9,
        effects: [
          { verb: "damage", target: "target", amount: 13 },
          { verb: "gainCounter", target: "self", counter: "protecao", amount: (ctx) => 13 }
        ]
      },
      {
        id: "channelheal", name: "Canalizar Prote\u00e7\u00e3o", desc: "Gasta todos os contadores de Prote\u00e7\u00e3o para curar um aliado.", animKey: "skill2", speed: 1, targetType: "ally",
        effects: [
          { verb: "spendCounters", target: "self", counter: "protecao", amount: "all", into: "heal" },
          { verb: "heal", target: "target", amount: (ctx) => (ctx.actor.counters && ctx.actor.counters.protecao) || 0 }
        ]
      },
      {
        id: "hasten", name: "Acelerar", desc: "Um aliado age imediatamente.", animKey: "skill2", speed: 2, targetType: "ally",
        effects: [
          { verb: "forceImmediateAction", target: "target" }
        ]
      }
    ]
  },

  babawibby: {
    id: "babawibby", displayName: "Babawibby o Mais Melhor de Bom", team: "player", role: "support",
    color: 0xFF6600, accentColor: 0x5D8B43, shape: "babawibby",
    stats: { maxHP: 50, speed: 4 },
    abilities: [
      {
        id: "crie_maquina", name: "Crie uma M\u00e1quina de Guerra.", desc: "Cria uma M\u00e1quina de Guerra aliada.", animKey: "skill1", speed: 4, targetType: "self",
        effects: [
          { verb: "summon", defId: "maquina_de_guerra", tag: "maquina_de_guerra" },
          { verb: "note", text: "Crie uma M\u00e1quina de Guerra." }
        ]
      },
      {
        id: "destrua_maquina", name: "Destrua uma M\u00e1quina de Guerra", desc: "Sacrifica uma M\u00e1quina de Guerra aliada para causar 20 de dano num inimigo.", animKey: "skill2", speed: 5,
        targetType: "ally", targetFilter: (u) => u.summonTag === "maquina_de_guerra",
        promptsSecondTarget: "enemy",
        effects: [
          { verb: "sacrificeAlly", tag: "maquina_de_guerra", select: (candidates) => candidates[0] },
          { verb: "damage", target: (ctx) => ctx.secondTarget, amount: 20 }
        ]
      },
      {
        id: "recupere_vida", name: "Recupere 8 de vida", desc: "Recupera 8 de vida de todos os aliados.", animKey: "skill3", speed: 9, targetType: "ally",
        effects: [
          { verb: "healAllAllies", amount: 8 }
        ]
      }
    ]
  },

  maquina_de_guerra: {
    id: "maquina_de_guerra", displayName: "M\u00e1quina de Guerra", team: "player", role: "attacker",
    color: 0x8C5230, accentColor: 0x4A4A4A, shape: "maquina_de_guerra",
    stats: { maxHP: 15, speed: 4 },
    abilities: [
      {
        id: "cause_dano", name: "Cause 5 de dano.", desc: "Causa 5 de dano.", animKey: "skill1", speed: 4,
        effects: [
          { verb: "damage", target: "target", amount: 5 }
        ]
      },
      {
        id: "cause_dano_2", name: "Cause 5 de dano.", desc: "Causa 5 de dano.", animKey: "skill2", speed: 4,
        effects: [{ verb: "damage", target: "target", amount: 5 }]
      },
      {
        id: "cause_dano_3", name: "Cause 5 de dano.", desc: "Causa 5 de dano.", animKey: "skill3", speed: 4,
        effects: [{ verb: "damage", target: "target", amount: 5 }]
      }
    ]
  }
};

const UNIT_DEFS = {};
for (const [id, def] of Object.entries(LEGACY_UNIT_DEFS)) UNIT_DEFS[id] = upgradeUnitDef(def);
for (const [id, def] of Object.entries(MODERN_UNIT_DEFS)) UNIT_DEFS[id] = upgradeUnitDef(def);

// Player roster now Ajax(defender) / Yvrel(attacker) / Mariana(support),
// in fixed slot order [defender, attacker, support] = [left, middle, right].
const PLAYER_ORDER = ["ajax", "yvrel", "mariana"];
const ENEMY_ORDER = ["titan", "raider", "hexer"]; // also reordered to [defender, attacker, support]
