// =============================================================
// ============ CAMPAIGN ITEMS ====================================
// =============================================================
// Real item system (CAMPAIGN_DESIGN.md §7 / build-order step 5),
// replacing js/campaign/nodes.js's PLACEHOLDER_ITEMS. One item slot
// per party member: equipping calls onEquip; equipping over an
// existing item auto-unequips it first (calls its onUnequip), same
// as §7.1 describes. All effects are built from mechanisms that
// already exist elsewhere in the engine — stat boosts, a permanent
// StatusLib status via applyStatusToUnit, swapping one ability
// slot's def outright, or (for the small "borrowed trait" set added
// below) calling the same global helpers a character's own kit
// would use (summonUnitFor, applyStatusToUnit with a borrowed
// StatusLib status) — no new engine verbs are introduced anywhere
// in this file.
//
// A NOTE ON PERSISTENT STATUSES: applyStatusToUnit statuses are only
// auto-expired by effects.js's expireRoundScopedStatuses when their
// `duration` is 'thisRound' (removed) or 'nextRound' (aged forward
// one round then removed the round after). Any OTHER duration string
// is left alone forever, which is exactly what an equip-for-the-rest
// -of-the-run item needs — so permanent item statuses below use
// `duration: 'permanent'` (a plain marker string, not read anywhere
// else) rather than omitting duration, so it's clear at a glance this
// was intentional and not a forgotten field.
//
// A NOTE ON ABILITY-SWAP ITEMS: `unit.abilities` is assigned directly
// from `UNIT_DEFS[id].abilities` in the Unit constructor (js/planning-
// ui.js) — it is the SAME array object every Unit of that def shares,
// not a per-instance copy. Mutating it in place would silently
// corrupt every future instance of that character for the rest of the
// session, not just the equipped unit. ensureOwnAbilitiesArray() below
// clones the array onto the unit the first time anything tries to
// swap a slot in it, so the shared UNIT_DEFS entry is never touched.
//
// A NOTE ON "BORROWED TRAIT" ITEMS: a handful of items exist purely to
// give the party access to a mechanic that otherwise belongs to one
// specific named character's kit — inflicting Sangramento (Ajax's
// bleed), fielding a Máquina de Guerra without drafting one, granting
// a guard stance (Moldar's Vigília Solar), etc. These are built by
// directly reusing the exact same StatusLib entries / summonUnitFor
// helper those characters' abilities call — the item is just a
// different doorway into the same generic engine mechanism, per this
// file's existing "no new engine verbs" rule. They're flagged
// `flavorSource` (a display-only string, read only by this file's own
// desc text) purely so it's easy to see at a glance which items are
// riffs on an existing kit vs. original.
//
// A NOTE ON "onBattleStart" ITEMS: some items should apply their
// effect at the START OF EVERY BATTLE, not just once on equip (e.g.
// "inflict bleed on the enemy team at the start of each fight", or
// "gain shield every fight" rather than a one-time bonus). Rather than
// hook combat-engine.js itself, this reuses the one place all campaign
// items are already known to be equipped: Campaign.initCampaignBattle
// now calls Items.triggerAllBattleStart(units) once per side, right
// after the battle's rosters go live (see js/campaign/run.js) — so any
// item defining onBattleStart fires fresh at the top of every single
// fight, permanent-equip or not. Items that only want a one-time
// effect keep using onEquip exactly like the original 9 items did;
// items can define both if useful (rare here, but not disallowed).
//
// A NOTE ON ONE-SHOT vs ONGOING ITEMS: some items (heals, a single
// summon, a one-time bleed application) deliver their whole effect at
// the moment of onEquip/onBattleStart and have nothing to revert —
// they still occupy the unit's one item slot afterward (per §7.1),
// same as the original Campaign Button/Debate Podium Shield did.
// Ongoing items (stat/status buffs, ability swaps) revert cleanly via
// onEquip/onUnequip pairs so re-equipping something else never leaves
// stray state.

const Items = (() => {
  // ---- Ability-array safety (see note above) -----------------------------
  function ensureOwnAbilitiesArray(unit) {
    if (!unit._abilitiesOwnCopy) {
      unit.abilities = unit.abilities.slice();
      unit._abilitiesOwnCopy = true;
    }
  }

  function swapAbility(unit, abilityId, replacementAbility) {
    ensureOwnAbilitiesArray(unit);
    const idx = unit.abilities.findIndex(a => a.id === abilityId);
    if (idx === -1) return false;
    unit._itemSwappedAbility = { idx, original: unit.abilities[idx] };
    unit.abilities[idx] = replacementAbility;
    return true;
  }

  function restoreSwappedAbility(unit) {
    if (!unit._itemSwappedAbility) return;
    unit.abilities[unit._itemSwappedAbility.idx] = unit._itemSwappedAbility.original;
    unit._itemSwappedAbility = null;
  }

  // ---- Debuff cleanse helper (medalha_veterano/veterans_flag/etc) --------
  // "Cleanses one active debuff" needs some notion of which statuses count
  // as a debuff — nothing in effects.js tags statuses good/bad today, so
  // this keeps its own small, extensible list rather than guessing at every
  // status's intent. Extend DEBUFF_KINDS as new negative statuses are
  // added; speedMod is checked by sign since the same status id is used
  // for both a speed buff and a speed debuff.
  const DEBUFF_KINDS = new Set(['bleed', 'slow', 'moveLast']);
  function cleanseADebuff(unit) {
    if (!unit.statuses) return;
    const idx = unit.statuses.findIndex(s =>
      DEBUFF_KINDS.has(s.kind) || (s.kind === 'speedMod' && s.data && s.data.delta < 0)
    );
    if (idx !== -1) unit.statuses.splice(idx, 1);
  }

  // ---- Enemy-side helper for "apply to the whole enemy team" items -------
  // Reads the live enemyUnits array from game.html's global scope, same as
  // effects.js's own verbs do when they need the opposing roster. Safe to
  // no-op if called outside of an active battle.
  function livingEnemies() {
    return (typeof enemyUnits !== 'undefined' && enemyUnits) ? enemyUnits.filter(u => u.alive) : [];
  }
  function livingAllies() {
    return (typeof playerUnits !== 'undefined' && playerUnits) ? playerUnits.filter(u => u.alive) : [];
  }

  function triggerBattleStart(unit) {
    const item = unit.equippedItem;
    if (item && item.onBattleStart) item.onBattleStart(unit);
  }

  // ---- Item pool (CAMPAIGN_DESIGN.md §7.1 shape) -------------------------
  // rarity: 'common' | 'rare' | 'boss'. `price` is only read by the Shop
  // node; Chest/Battle/Elite rewards ignore it and sample by rarity weight
  // instead (see weightedSample below).
  const ITEM_POOL = [
    // =====================================================================
    // ---- COMMON: straightforward stat/sustain items ----------------------
    // =====================================================================
    {
      id: "medalha_veterano", name: "Medalha de Veterano", rarity: "common", price: 35,
      desc: "+8 Max HP (heals that much now). Cleanses one active debuff on equip.",
      onEquip(unit) { unit.maxHP += 8; unit.hp += 8; cleanseADebuff(unit); },
      onUnequip(unit) { unit.maxHP -= 8; unit.hp = Math.min(unit.hp, unit.maxHP); },
    },
    {
      id: "press_pass", name: "Press Pass", rarity: "common", price: 25,
      desc: "+6 Max HP (heals that much now).",
      onEquip(unit) { unit.maxHP += 6; unit.hp += 6; },
      onUnequip(unit) { unit.maxHP -= 6; unit.hp = Math.min(unit.hp, unit.maxHP); },
    },
    {
      id: "campaign_button", name: "Campaign Button", rarity: "common", price: 15,
      desc: "Heal 15 HP immediately.",
      onEquip(unit) { unit.hp = Math.min(unit.maxHP, unit.hp + 15); },
      onUnequip() {},
    },
    {
      id: "debate_podium_shield", name: "Debate Podium Shield", rarity: "common", price: 15,
      desc: "Gain 10 Shield immediately.",
      onEquip(unit) { unit.shield += 10; },
      onUnequip() {},
    },
    {
      id: "thermos_de_cafe", name: "Thermos de Café", rarity: "common", price: 30,
      desc: "Permanently +1 Speed.",
      onEquip(unit) { applyStatusToUnit(unit, StatusLib.speedMod(1, 'permanent')); },
      onUnequip(unit) { removeStatusFromUnit(unit, 'speedMod'); },
    },
    {
      id: "lucky_button_pin", name: "Pin da Sorte", rarity: "common", price: 20,
      desc: "+5 Max HP and +5 Shield immediately.",
      onEquip(unit) { unit.maxHP += 5; unit.hp += 5; unit.shield += 5; },
      onUnequip(unit) { unit.maxHP -= 5; unit.hp = Math.min(unit.hp, unit.maxHP); },
    },
    {
      id: "worn_running_shoes", name: "Tênis Surrados de Comício", rarity: "common", price: 22,
      desc: "Permanently +1 Speed. -4 Max HP (trades durability for tempo).",
      onEquip(unit) {
        applyStatusToUnit(unit, StatusLib.speedMod(1, 'permanent'));
        unit.maxHP -= 4; unit.hp = Math.min(unit.hp, unit.maxHP);
      },
      onUnequip(unit) { removeStatusFromUnit(unit, 'speedMod'); unit.maxHP += 4; },
    },
    {
      id: "sample_ballot", name: "Cédula de Amostra", rarity: "common", price: 18,
      desc: "Permanently deal +2 damage with every ability. -1 Speed.",
      onEquip(unit) {
        applyStatusToUnit(unit, StatusLib.teamDamageBonus(2, 'permanent'));
        applyStatusToUnit(unit, StatusLib.speedMod(-1, 'permanent'));
      },
      onUnequip(unit) { removeStatusFromUnit(unit, 'teamDamageBonus'); removeStatusFromUnit(unit, 'speedMod'); },
    },
    {
      id: "protest_sign", name: "Placa de Protesto", rarity: "common", price: 28,
      desc: "Gain 6 Shield at the start of every battle.",
      onBattleStart(unit) { unit.shield += 6; },
      onEquip() {}, onUnequip() {},
    },
    {
      id: "second_cup", name: "Segunda Xícara", rarity: "common", price: 32,
      desc: "Heal 8 HP at the start of every battle.",
      onBattleStart(unit) { unit.hp = Math.min(unit.maxHP, unit.hp + 8); },
      onEquip() {}, onUnequip() {},
    },
    {
      id: "spare_podium", name: "Púlpito Reserva", rarity: "common", price: 20,
      desc: "Gain 8 Shield at the start of every battle. Permanently -1 Speed.",
      onBattleStart(unit) { unit.shield += 8; },
      onEquip(unit) { applyStatusToUnit(unit, StatusLib.speedMod(-1, 'permanent')); },
      onUnequip(unit) { removeStatusFromUnit(unit, 'speedMod'); },
    },
    {
      id: "town_hall_key", name: "Chave do Salão Municipal", rarity: "common", price: 27,
      desc: "Cleanses one active debuff at the start of every battle.",
      onBattleStart(unit) { cleanseADebuff(unit); },
      onEquip() {}, onUnequip() {},
    },
    {
      id: "old_press_badge", name: "Crachá de Imprensa Vencido", rarity: "common", price: 24,
      flavorSource: "Press Wrangler (Clear a Path)",
      desc: "The lowest-HP living enemy acts last, at the start of every battle.",
      onBattleStart() {
        const enemies = livingEnemies();
        if (!enemies.length) return;
        const lowest = enemies.reduce((a, b) => a.hp < b.hp ? a : b);
        applyStatusToUnit(lowest, StatusLib.moveLast());
      },
      onEquip() {}, onUnequip() {},
    },
    {
      id: "marquese_ribbon", name: "Fita da Marquese", rarity: "common", price: 26,
      flavorSource: "Carmelita Marquese (Marca)",
      desc: "Mark this unit at the start of every battle (enables any Marca payoff effects on the team).",
      onBattleStart(unit) { applyStatusToUnit(unit, StatusLib.marqueseMark()); },
      onEquip() {}, onUnequip() {},
    },

    // =====================================================================
    // ---- RARE: bigger stat items, some with trade-offs --------------------
    // =====================================================================
    {
      id: "campaign_war_chest", name: "Campaign War Chest", rarity: "rare", price: 55,
      desc: "+15 Max HP (heals that much now).",
      onEquip(unit) { unit.maxHP += 15; unit.hp += 15; },
      onUnequip(unit) { unit.maxHP -= 15; unit.hp = Math.min(unit.hp, unit.maxHP); },
    },
    {
      id: "whistleblower_dossier", name: "Whistleblower Dossier", rarity: "rare", price: 60,
      desc: "Permanently deal +4 damage with every ability.",
      onEquip(unit) { applyStatusToUnit(unit, StatusLib.teamDamageBonus(4, 'permanent')); },
      onUnequip(unit) { removeStatusFromUnit(unit, 'teamDamageBonus'); },
    },
    {
      id: "veterans_flag", name: "Veteran's Flag", rarity: "rare", price: 55,
      desc: "Permanently +2 Speed. Cleanses one active debuff on equip.",
      onEquip(unit) { applyStatusToUnit(unit, StatusLib.speedMod(2, 'permanent')); cleanseADebuff(unit); },
      onUnequip(unit) { removeStatusFromUnit(unit, 'speedMod'); },
    },
    {
      id: "iron_endorsement", name: "Iron Endorsement", rarity: "rare", price: 50,
      desc: "+20 Max HP.",
      onEquip(unit) { unit.maxHP += 20; },
      onUnequip(unit) { unit.maxHP -= 20; unit.hp = Math.min(unit.hp, unit.maxHP); },
    },
    {
      id: "pollster_binoculars", name: "Pollster's Binoculars", rarity: "rare", price: 65,
      desc: "Permanently +1 Speed and deal +2 damage with every ability.",
      onEquip(unit) {
        applyStatusToUnit(unit, StatusLib.speedMod(1, 'permanent'));
        applyStatusToUnit(unit, StatusLib.teamDamageBonus(2, 'permanent'));
      },
      onUnequip(unit) { removeStatusFromUnit(unit, 'speedMod'); removeStatusFromUnit(unit, 'teamDamageBonus'); },
    },
    {
      id: "medalha_dourada", name: "Medalha Dourada", rarity: "rare", price: 70,
      desc: "+12 Max HP (heals that much now) and permanently deal +2 damage with every ability.",
      onEquip(unit) { unit.maxHP += 12; unit.hp += 12; applyStatusToUnit(unit, StatusLib.teamDamageBonus(2, 'permanent')); },
      onUnequip(unit) { unit.maxHP -= 12; unit.hp = Math.min(unit.hp, unit.maxHP); removeStatusFromUnit(unit, 'teamDamageBonus'); },
    },
    {
      id: "riot_shield", name: "Escudo Anti-Tumulto", rarity: "rare", price: 52,
      desc: "Gain 12 Shield at the start of every battle.",
      onBattleStart(unit) { unit.shield += 12; },
      onEquip() {}, onUnequip() {},
    },
    {
      id: "field_medic_kit", name: "Kit de Primeiros Socorros", rarity: "rare", price: 58,
      desc: "Heal 14 HP at the start of every battle.",
      onBattleStart(unit) { unit.hp = Math.min(unit.maxHP, unit.hp + 14); },
      onEquip() {}, onUnequip() {},
    },
    {
      id: "glass_cannon_mic", name: "Microfone de Vidro", rarity: "rare", price: 62,
      desc: "Permanently deal +7 damage with every ability. -15 Max HP.",
      onEquip(unit) {
        applyStatusToUnit(unit, StatusLib.teamDamageBonus(7, 'permanent'));
        unit.maxHP -= 15; unit.hp = Math.min(unit.hp, unit.maxHP);
      },
      onUnequip(unit) { removeStatusFromUnit(unit, 'teamDamageBonus'); unit.maxHP += 15; },
    },
    {
      id: "turtle_shell_briefcase", name: "Maleta-Casco", rarity: "rare", price: 56,
      desc: "+18 Max HP. Permanently -2 Speed (built like a bunker, moves like one too).",
      onEquip(unit) {
        unit.maxHP += 18; unit.hp += 18;
        applyStatusToUnit(unit, StatusLib.speedMod(-2, 'permanent'));
      },
      onUnequip(unit) { unit.maxHP -= 18; unit.hp = Math.min(unit.hp, unit.maxHP); removeStatusFromUnit(unit, 'speedMod'); },
    },
    {
      id: "adrenaline_flask", name: "Frasco de Adrenalina", rarity: "rare", price: 40,
      desc: "Heal 20 HP immediately. Permanently -6 Max HP (a stimulant, not a cure).",
      onEquip(unit) {
        unit.maxHP -= 6;
        unit.hp = Math.min(unit.maxHP, unit.hp + 20);
      },
      onUnequip(unit) { unit.maxHP += 6; },
    },
    {
      id: "opposition_binder", name: "Fichário de Oposição", rarity: "rare", price: 46,
      desc: "Permanently +3 Speed. -8 Max HP (thin, fast, fragile).",
      onEquip(unit) {
        applyStatusToUnit(unit, StatusLib.speedMod(3, 'permanent'));
        unit.maxHP -= 8; unit.hp = Math.min(unit.hp, unit.maxHP);
      },
      onUnequip(unit) { removeStatusFromUnit(unit, 'speedMod'); unit.maxHP += 8; },
    },
    {
      id: "bulletproof_podium", name: "Púlpito Blindado", rarity: "rare", price: 64,
      desc: "The first hit this unit takes each battle is fully nullified (whole ability cancelled). Resets every battle.",
      // "Fully cancel the next incoming ability" already exists exactly as
      // StatusLib.nullifyNext — reused verbatim rather than inventing a new
      // damage-reduction mechanic. Re-applied fresh every fight so it isn't
      // a one-time trinket.
      onBattleStart(unit) { applyStatusToUnit(unit, StatusLib.nullifyNext()); },
      onEquip() {}, onUnequip() {},
    },

    // =====================================================================
    // ---- RARE: borrowed-kit items (a named character's signature trait) --
    // =====================================================================
    {
      id: "ajaxs_dentures", name: "Dentadura do Ajax", rarity: "rare", price: 45,
      flavorSource: "Ajax, o Ultra-Humano (Golpe Sangrento)",
      desc: "Inflict Sangramento on every enemy at the start of every battle.",
      onBattleStart() { livingEnemies().forEach(e => applyStatusToUnit(e, StatusLib.bleed(5))); },
      onEquip() {}, onUnequip() {},
    },
    {
      id: "moldars_spare_shield", name: "Escudo Reserva do Moldar", rarity: "rare", price: 60,
      flavorSource: "Moldar, Paciência Solar (Vigília Solar)",
      desc: "At the start of every battle, stand guard: any ally taking damage triggers 4 retaliation damage against the attacker.",
      onBattleStart(unit) { applyStatusToUnit(unit, StatusLib.guardAllies(4, 'moldars_spare_shield', null)); },
      onEquip() {}, onUnequip() {},
    },
    {
      id: "porteiros_whistle", name: "Apito do Porteiro", rarity: "rare", price: 50,
      flavorSource: "O Porteiro (Provocar)",
      desc: "At the start of every battle, provoke — enemy abilities that would target an ally are redirected to this unit instead, for the round.",
      onBattleStart(unit) { livingAllies().filter(u => u !== unit).forEach(ally => applyStatusToUnit(ally, StatusLib.provoke(unit))); },
      onEquip() {}, onUnequip() {},
    },
    {
      id: "gavins_cold_shoulder", name: "Ombro Frio do Gavin", rarity: "rare", price: 48,
      flavorSource: "Gavin (Golpe Gelado)",
      desc: "Slow the entire enemy team by 2 at the start of every battle (they act later this round).",
      onBattleStart() { livingEnemies().forEach(e => applyStatusToUnit(e, StatusLib.slow(2))); },
      onEquip() {}, onUnequip() {},
    },
    {
      id: "sirius_notebook", name: "Caderno do Sirius", rarity: "rare", price: 44,
      flavorSource: "Sirius (Reescrever)",
      desc: "Gain a stack of Reescrever at the start of every battle (stacks carry over between battles until spent).",
      onBattleStart(unit) { applyStatusToUnit(unit, StatusLib.stackingBuff('sirius_stack', 'Reescrever', {})); },
      onEquip() {}, onUnequip() {},
    },
    {
      id: "yvrels_cracked_halo", name: "Halo Rachado do Yvrel", rarity: "rare", price: 47,
      flavorSource: "Yvrel, a Luz que se Apagou (Golpe Silenciador)",
      desc: "This unit is Intocável (untargetable) for the first round of every battle.",
      onBattleStart(unit) { applyStatusToUnit(unit, StatusLib.untargetable()); },
      onEquip() {}, onUnequip() {},
    },
    {
      id: "babawibbys_spare_bolt", name: "Parafuso Reserva do Babawibby", rarity: "boss", price: 88,
      flavorSource: "Babawibby (Montagem de Sucata / Sacrifício Explosivo)",
      desc: "Summon a Máquina de Guerra to your side at the start of every battle. Each fight's Máquina is fresh — none of the sacrifice combo carries over automatically.",
      onBattleStart(unit) {
        if (typeof summonUnitFor === 'function') summonUnitFor('player', 'maquina_de_guerra', 'babawibbys_spare_bolt', unit);
      },
      onEquip() {}, onUnequip() {},
    },
    {
      id: "marianas_spare_lantern", name: "Lanterna Reserva da Mariana", rarity: "rare", price: 42,
      flavorSource: "Mariana, Tocada Pela Luz (Golpe de Luz)",
      desc: "Gain 6 Proteção counters at the start of every battle (spend them however this unit's own kit lets you spend counters).",
      onBattleStart(unit) {
        if (!unit.counters) unit.counters = {};
        unit.counters.protecao = (unit.counters.protecao || 0) + 6;
      },
      onEquip() {}, onUnequip() {},
    },
    {
      id: "daxens_borrowed_mirror", name: "Espelho Emprestado do Daxen", rarity: "rare", price: 54,
      flavorSource: "Daxen-Ciris (Vigília Final)",
      desc: "The first ability that targets this unit each battle is fully nullified. +7 Max HP.",
      onEquip(unit) { unit.maxHP += 7; unit.hp += 7; },
      onUnequip(unit) { unit.maxHP -= 7; unit.hp = Math.min(unit.hp, unit.maxHP); },
      onBattleStart(unit) { applyStatusToUnit(unit, StatusLib.nullifyNext()); },
    },
    {
      id: "gilded_soapbox", name: "Palanque Dourado", rarity: "common", price: 16,
      desc: "Gain 4 Shield and heal 4 HP at the start of every battle.",
      onBattleStart(unit) { unit.shield += 4; unit.hp = Math.min(unit.maxHP, unit.hp + 4); },
      onEquip() {}, onUnequip() {},
    },
    {
      id: "recycled_flyers", name: "Panfletos Reciclados", rarity: "common", price: 19,
      desc: "Permanently deal +1 damage with every ability and +1 Speed.",
      onEquip(unit) {
        applyStatusToUnit(unit, StatusLib.teamDamageBonus(1, 'permanent'));
        applyStatusToUnit(unit, StatusLib.speedMod(1, 'permanent'));
      },
      onUnequip(unit) { removeStatusFromUnit(unit, 'teamDamageBonus'); removeStatusFromUnit(unit, 'speedMod'); },
    },
    {
      id: "focus_group_notes", name: "Notas do Grupo Focal", rarity: "rare", price: 49,
      desc: "+5 Speed for the first round of every battle (a strong tempo lead out of the gate).",
      // speedMod's default duration is 'nextRound' (ages forward once, then
      // clears) — exactly "affects the round that's about to be sorted",
      // which is what onBattleStart firing right before planning wants.
      onBattleStart(unit) { applyStatusToUnit(unit, StatusLib.speedMod(5)); },
      onEquip() {}, onUnequip() {},
    },

    // =====================================================================
    // ---- BOSS: rare high-impact items -------------------------------------
    // =====================================================================
    {
      id: "war_machine_beacon", name: "Farol da Máquina de Guerra", rarity: "boss", price: 85,
      flavorSource: "Máquina de Guerra (summon-only unit)",
      desc: "Summon a Máquina de Guerra to your side at the start of the run's next battle. One-time use — consumed after it triggers once.",
      onBattleStart(unit) {
        if (unit._warMachineBeaconUsed) return;
        unit._warMachineBeaconUsed = true;
        if (typeof summonUnitFor === 'function') summonUnitFor('player', 'maquina_de_guerra', 'war_machine_beacon', unit);
      },
      onEquip() {}, onUnequip() {},
    },
    {
      id: "dossie_da_sombra", name: "Dossiê da Sombra", rarity: "boss", price: 90,
      desc: "Only for Dário: Golpe do Senador deals/heals +3.",
      replacesAbilityId: "golpe_dario",
      replacementAbility: {
        id: "golpe_dario", name: "Golpe do Senador (Reforçado)",
        desc: "Cause 10 de dano em um inimigo (ou cure 10, como Senador; +10 a mais como Sombra).",
        animKey: "skill1", speed: 5,
        effects: [
          { verb: "damage", target: "target", amount: 10 },
          {
            verb: "repeatIf",
            when: (ctx) => currentForm(ctx.actor, "dario_form") === "sombra",
            effects: [{ verb: "damage", target: "target", amount: 10 }],
          },
          {
            verb: "repeatIf",
            when: (ctx) => currentForm(ctx.actor, "dario_form") === "senador",
            effects: [{ verb: "heal", target: "target", amount: 10 }],
          },
        ],
      },
      onEquip(unit) { swapAbility(unit, "golpe_dario", this.replacementAbility); },
      onUnequip(unit) { restoreSwappedAbility(unit); },
    },
    {
      id: "ajaxs_second_jaw", name: "Segunda Mandíbula do Ajax", rarity: "boss", price: 90,
      desc: "Only for Ajax: Golpe Sangrento's bleed ticks for +4 damage (9 instead of 5).",
      replacesAbilityId: "golpe_sangrento",
      replacementAbility: {
        id: "golpe_sangrento", name: "Golpe Sangrento (Reforçado)",
        desc: "Cause 7 de dano e aplica Sangramento reforçado (9/turno) no alvo.",
        animKey: "skill2", speed: 4,
        effects: [
          { verb: "damage", target: "target", amount: 7 },
          { verb: "applyStatus", target: "target", status: () => StatusLib.bleed(9) },
        ],
      },
      onEquip(unit) { swapAbility(unit, "golpe_sangrento", this.replacementAbility); },
      onUnequip(unit) { restoreSwappedAbility(unit); },
    },
  ];

  // ---- Eligibility ---------------------------------------------------
  // Ability-swap items only make sense on a unit that actually has the
  // ability being replaced; every other item is universal. Used both to
  // filter which units can be offered an item in the "who gets it?"
  // picker and to filter which items are even worth offering at all
  // given the run's current living party.
  function isEligible(item, unit) {
    if (item.replacesAbilityId) {
      return unit.abilities.some(a => a.id === item.replacesAbilityId);
    }
    return true;
  }

  function eligibleUnitsFor(item, run) {
    return run.party.filter(u => u.alive && isEligible(item, u));
  }

  function poolFor(run, { excludeRarities = [] } = {}) {
    return ITEM_POOL.filter(item =>
      !excludeRarities.includes(item.rarity) && eligibleUnitsFor(item, run).length > 0
    );
  }

  // ---- Rarity-weighted sampling (Chest/Battle/Elite rewards) -------------
  const RARITY_WEIGHTS = { common: 10, rare: 4, boss: 1 };
  function weightedSample(pool, count) {
    const bag = pool.slice();
    const picked = [];
    for (let i = 0; i < count && bag.length; i++) {
      const totalWeight = bag.reduce((sum, it) => sum + (RARITY_WEIGHTS[it.rarity] || 1), 0);
      let r = Math.random() * totalWeight;
      let idx = bag.length - 1;
      for (let j = 0; j < bag.length; j++) {
        r -= RARITY_WEIGHTS[bag[j].rarity] || 1;
        if (r <= 0) { idx = j; break; }
      }
      picked.push(bag.splice(idx, 1)[0]);
    }
    return picked;
  }

  // ---- Equip / unequip (one slot per unit, per §7.1) ---------------------
  function equipItem(unit, item) {
    if (unit.equippedItem) unequipItem(unit);
    unit.equippedItem = item;
    if (item.onEquip) item.onEquip(unit);
  }

  function unequipItem(unit) {
    const item = unit.equippedItem;
    if (!item) return;
    if (item.onUnequip) item.onUnequip(unit);
    unit.equippedItem = null;
  }

  // ---- Battle-start trigger --------------------------------------------
  // Called once per side from Campaign.initCampaignBattle (js/campaign/
  // run.js), right after that battle's rosters are live, so onBattleStart
  // items fire fresh at the top of every fight.
  function triggerAllBattleStart(units) {
    units.forEach(u => { if (u.alive) triggerBattleStart(u); });
  }

  return {
    ITEM_POOL, RARITY_WEIGHTS,
    isEligible, eligibleUnitsFor, poolFor, weightedSample,
    equipItem, unequipItem, triggerAllBattleStart,
  };
})();
