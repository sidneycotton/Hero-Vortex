// =============================================================
// ============ UNIT/ABILITY I18N — gameplay content (EN layer) ==
// =============================================================
// Portuguese is the native language of gameplay content (character
// names, ability names/descriptions) — the def objects in js/units/*.js
// stay untouched, exactly as authored. This file adds an ENGLISH-ONLY
// overlay on top, keyed by unit id (for displayName) and
// "unitId.abilityId" (for ability/sub-ability name+desc), and exposes a
// small lookup API that render call sites use instead of reading
// def.displayName / ability.name / ability.desc directly.
//
// Scope (per the staged i18n plan in handoff.md): only displayName and
// each ability/sub-ability's name+desc are covered here. Combat-log
// sentences (addLogLine templates in effects.js/combat-engine.js/
// resolution.js/the unit files' own hook callbacks) and campaign
// narrative text (js/campaign/*.js) are NOT covered by this file — they
// stay Portuguese-only for now, a later pass.
//
// A few units already have English-authored def text (js/units/
// campaign_enemies.js's enemy_only roster, and js/units/dario_shadow.js)
// — those are intentionally absent from UNIT_TEXT_EN below; UnitText's
// helpers fall back to the def's own PT/already-English text whenever a
// unit or ability id isn't present in this overlay, so those units
// render identically in both languages without needing a redundant
// entry here.
//
// Usage from render call sites (planning-ui.js, team-select.js,
// starter-select.js):
//   UnitText.displayName(unit)              // unit = a Unit instance OR a raw def
//   UnitText.abilityName(unit, ability)
//   UnitText.abilityDesc(unit, ability)
// All three read I18n.getLang() live, so no separate re-render wiring is
// needed beyond whatever the call site already does on I18n.onChange —
// same as every other t() call in the codebase.

const UNIT_TEXT_EN = {
  ajax: {
    displayName: "Ajax, the Ultra-Human",
    abilities: {
      duel: { name: "Duel", desc: "I deal 15 and take 15 back." },
      bleedstrike: { name: "Bleeding Strike", desc: "10 damage + Bleed (5/turn)." },
      chainstrike: { name: "Deadly Chain", desc: "10 damage, repeats if Bleeding, repeats again if I'm \u226440 HP." }
    }
  },
  amelia: {
    displayName: "Amelia, Uncomfortable Ascendant",
    abilities: {
      retribuicao_atrasada: { name: "Delayed Retribution", desc: "Deal 15 damage to every enemy who has already used an ability this turn." },
      fluxo_do_tempo: { name: "Flow of Time", desc: "Your other allies are 5 faster next turn. Enemies are 3 faster next turn." },
      golpe_definitivo: { name: "Definitive Strike", desc: "Deal 18 damage to an enemy. The target acts immediately." }
    }
  },
  andressa: {
    displayName: "Andressa, Little Squire",
    abilities: {
      vinculo_escudeira: { name: "Squire's Bond", desc: "When I'm played, an ally becomes my Partner; whenever I'm damaged, half the damage becomes healing for them." },
      amparo_escudeira: { name: "Squire's Aid", desc: "Restore 5 HP to an ally and grant them a 5 HP shield. If the ally is my Partner, do the same to me." },
      vigilia_protegida: { name: "Guarded Vigil", desc: "Grant myself a 10 HP shield. While I have a shield, allied healing becomes maximum-HP growth for the target." }
    }
  },
  babawibby: {
    displayName: "Babawibby the Bestest of Good",
    abilities: {
      crie_maquina: { name: "Scrap Assembly", desc: "Creates an allied War Machine." },
      destrua_maquina: { name: "Explosive Sacrifice", desc: "Sacrifices an allied War Machine to deal 20 damage to an enemy." },
      recupere_vida: { name: "Quick Patch", desc: "Restores 8 HP to all allies." }
    }
  },
  carmelita_marquese: {
    displayName: "Carmelita Marquese",
    abilities: {
      conceder_escudo: { name: "Grant Shield", desc: "Grant 12 Shield to an ally. Place a Marquese mark on them." },
      convocar_marcados: { name: "Summon the Marked", desc: "Every ally with the Marquese mark uses a random ability. Remove their mark." },
      restaurar_marcados: { name: "Restore the Marked", desc: "Restore 12 HP to every ally with the Marquese mark." }
    }
  },
  dario: {
    displayName: "D\u00e1rio, the Senator and the Shadow",
    abilities: {
      senador_e_sombra: { name: "The Senator and the Shadow", desc: "When an ally heals me, I become the Senator. When an ally damages me, I become the Shadow." },
      golpe_dario: { name: "Senator's Strike", desc: "Deal 7 damage to an enemy. If I'm the Senator, heal a target for 7. If I'm the Shadow, deal 7 more damage." },
      escudo_dario: { name: "Protective Mantle", desc: "Grant 5 Shield to an ally. If I'm the Senator, double the Shield they have. If I'm the Shadow, steal an enemy's Shield." }
    }
  },
  daxen_ciris: {
    displayName: "Daxen-Ciris",
    abilities: {
      espelho_defensor: { name: "Defender's Mirror", desc: "I gain +7 HP, use the enemy Defender's fastest Ability (you choose the target)." },
      espelho_atacante: { name: "Attacker's Mirror", desc: "I deal 7 damage, use the enemy Attacker's fastest Ability (you choose the target)." },
      vigilia_final: { name: "Final Vigil", desc: "I gain +14 HP. Next turn, I nullify the first Ability that targets me." }
    }
  },
  gavin: {
    displayName: "Gavin, Unstoppable Master",
    abilities: {
      presenca_ameacadora: { name: "Threatening Presence", desc: "Whenever an ally uses an Ability right after mine, I deal 2 damage to every enemy." },
      ataque_e_cura: { name: "Attack and Heal", desc: "Deal 4 damage to an enemy, heal an ally for 4. This Ability happens again this turn, at 8 Speed, Damage, and Healing." },
      golpe_gelado: { name: "Icy Strike", desc: "Deal 2 damage to an enemy, they become Slowed 2. When a Slowed enemy acts this turn, I use a copy of this Ability on a random valid enemy target." }
    },
    subAbilities: {
      ataque_e_cura_eco: { name: "Attack and Heal (Echo)", desc: "8 damage to an enemy, heals an ally for 8." }
    }
  },
  maquina_de_guerra: {
    displayName: "War Machine",
    abilities: {
      cause_dano: { name: "Deal 5 damage.", desc: "Deals 5 damage." },
      cause_dano_2: { name: "Deal 5 damage.", desc: "Deals 5 damage." },
      cause_dano_3: { name: "Deal 5 damage.", desc: "Deals 5 damage." }
    }
  },
  mariana: {
    displayName: "Mariana, Touched by Light",
    abilities: {
      lightstrike: { name: "Light Strike", desc: "13 damage to an enemy. I gain Protection counters equal to the damage." },
      channelheal: { name: "Channel Protection", desc: "Spend all Protection counters to heal an ally." },
      hasten: { name: "Hasten", desc: "An ally acts immediately." }
    }
  },
  moldar: {
    displayName: "Moldar, Solar Patience",
    abilities: {
      moldar_solar: { name: "Solar Shaping", desc: "I gain +10 max HP. Repeats for each time I was damaged this turn." },
      paciencia: { name: "Patience", desc: "Do nothing. \u201cLosing your patience is losing the battle\u2026\u201d" },
      vigilia_solar: { name: "Solar Vigil", desc: "Until I act with another ability, whenever an ally is damaged, I retaliate for 6 damage to an enemy." }
    }
  },
  porteiro: {
    displayName: "The Doorman",
    abilities: {
      bom_dia: { name: "Good Morning", desc: "I deal 8 damage to an enemy. If they don't attack me this turn, I deal 8 more at turn's end. \u201cGood morning.\u201d" },
      purificar: { name: "Purify", desc: "Purify a unit." },
      provocar: { name: "Provoke", desc: "I Provoke an ally. Instead of damaging me, their damage heals me this turn." }
    }
  },
  sirius: {
    displayName: "Sirius, Writer of His Own Future",
    abilities: {
      reescrever: { name: "Rewrite", desc: "Gain a Rewrite Counter. Each counter adds +1 extra use to the next OTHER Ability I use this turn." },
      troca_de_destino: { name: "Trade of Fate", desc: "Swap positions with my team's Defender this turn. Gain +15 max HP permanently." },
      golpe_final: { name: "Final Strike", desc: "All Heroes' Abilities deal +2 damage this turn. Deals 8 damage to an enemy." }
    }
  },
  yvrel: {
    displayName: "Yvrel, the Light that Went Out",
    abilities: {
      silencingblow: { name: "Silencing Blow", desc: "13 damage. Target is untouchable this turn." },
      delayblow: { name: "Delaying Blow", desc: "10 damage. Target acts last." },
      echostrike: { name: "Echo Strike", desc: "23 damage. Then, choose another ability of mine (different from the last) to use on an ally." }
    }
  }
};

const UnitText = (() => {
  function abilityDict(defId) {
    const entry = UNIT_TEXT_EN[defId];
    return entry ? entry.abilities || {} : {};
  }
  function subAbilityDict(defId) {
    const entry = UNIT_TEXT_EN[defId];
    return entry ? entry.subAbilities || {} : {};
  }

  // Accepts either a live Unit instance (has .defId) or a raw def object
  // (has .id) — render call sites use both depending on context (a
  // battle Unit vs. a team-select/starter-select draft pool entry).
  function idOf(unitOrDef) {
    return unitOrDef.defId || unitOrDef.id;
  }

  function displayName(unitOrDef) {
    if (I18n.getLang() === 'en') {
      const entry = UNIT_TEXT_EN[idOf(unitOrDef)];
      if (entry && entry.displayName) return entry.displayName;
    }
    return unitOrDef.displayName;
  }

  // `unitOrDef` identifies which unit the ability belongs to (for the
  // lookup key); `ability` is the ability/sub-ability object itself
  // (read for its own .id and as the PT/fallback source). Sub-abilities
  // are looked up in their own dict, falling back to the main abilities
  // dict — ability ids are unique per unit across both lists (verified
  // against every def in js/units/*.js), so no collision risk either way.
  function lookupEntry(unitOrDef, ability) {
    const id = idOf(unitOrDef);
    return subAbilityDict(id)[ability.id] || abilityDict(id)[ability.id];
  }

  function abilityName(unitOrDef, ability) {
    if (I18n.getLang() === 'en') {
      const entry = lookupEntry(unitOrDef, ability);
      if (entry && entry.name) return entry.name;
    }
    return ability.name;
  }

  function abilityDesc(unitOrDef, ability) {
    if (I18n.getLang() === 'en') {
      const entry = lookupEntry(unitOrDef, ability);
      if (entry && entry.desc) return entry.desc;
    }
    return ability.desc;
  }

  return { displayName, abilityName, abilityDesc };
})();
