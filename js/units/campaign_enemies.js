// =============================================================
// ============ CAMPAIGN ENEMY ROSTER =============================
// =============================================================
// Enemies for Dário's Shadow campaign trail (CAMPAIGN_DESIGN.md §1/§6).
// Built the same way any other unit is — modern effects[] defs, generic
// verbs/statuses only, no engine changes — but with team: "enemy_only"
// so they're excluded from pickRandomEnemyDeck()/pickRandomEnemyOrder()'s
// `def.team === "player"` filters automatically: these can never be
// drafted by a player, never appear in Vs. AI or PVP, and only ever get
// spawned explicitly by js/campaign/nodes.js's battle rosters.
//
// Every roster handed to initCampaignBattle() needs exactly one
// defender/attacker/support (role is still fixed-slot, same as any
// battle — see ROLE_SLOT in units/core.js), so each "wave" below is
// authored as a matched trio, not a random mix-and-match pool.
//
// Uses the supplied election_mob bespoke builder (js/models/
// election_mob.js) for every enemy here — a single multi-archetype
// model file branching on `mobId`, not one bespoke file per character
// (see that file's own header for why: these are disposable
// rank-and-file mooks sharing a rig, not named heroes). Each entry
// below sets `shape: "election_mob"` and a `mobId` matching one of that
// file's archetype branches; the boss keeps its own fully bespoke
// js/models/dario_shadow.js file, since it's a named/unique fight.

const CAMPAIGN_UNIT_DEFS = {};

// ---- Wave 1: Rally Security (early-run, tuned low) ----------------------
CAMPAIGN_UNIT_DEFS.rally_barricade = {
  id: "rally_barricade", displayName: "Rally Barricade Guard", team: "enemy_only", role: "defender",
  color: 0x2a2e35, accentColor: 0xffcf4a, shape: "election_mob", mobId: "security",
  stats: { maxHP: 34, speed: 4 },
  abilities: [
    {
      id: "shove_back", name: "Shove Back", desc: "Deal 4 damage to an enemy and shield self for 4.",
      animKey: "skill1", speed: 4,
      effects: [
        { verb: "damage", target: "target", amount: 4 },
        { verb: "shield", target: "self", amount: 4 }
      ]
    },
    {
      id: "hold_the_line", name: "Hold the Line", desc: "Shield self for 8.",
      animKey: "skill2", speed: 6,
      targetType: "self",
      effects: [ { verb: "shield", target: "self", amount: 8 } ]
    }
  ]
};

CAMPAIGN_UNIT_DEFS.press_wrangler = {
  id: "press_wrangler", displayName: "Press Wrangler", team: "enemy_only", role: "attacker",
  color: 0x3a2a2a, accentColor: 0xff7a4a, shape: "election_mob", mobId: "pundit",
  stats: { maxHP: 26, speed: 5 },
  abilities: [
    {
      id: "shoulder_check", name: "Shoulder Check", desc: "Deal 6 damage to an enemy.",
      animKey: "skill1", speed: 5,
      effects: [ { verb: "damage", target: "target", amount: 6 } ]
    },
    {
      id: "clear_a_path", name: "Clear a Path", desc: "Deal 4 damage to an enemy, they act last this round.",
      animKey: "skill2", speed: 3,
      effects: [
        { verb: "damage", target: "target", amount: 4 },
        { verb: "applyStatus", target: "target", status: () => StatusLib.moveLast() }
      ]
    }
  ]
};

CAMPAIGN_UNIT_DEFS.staffer_intern = {
  id: "staffer_intern", displayName: "Overworked Intern", team: "enemy_only", role: "support",
  color: 0x2c3a2c, accentColor: 0x9fe08a, shape: "election_mob", mobId: "intern",
  stats: { maxHP: 22, speed: 7 },
  abilities: [
    {
      id: "hand_off_a_memo", name: "Hand Off a Memo", desc: "Heal an ally for 6.",
      animKey: "skill1", speed: 5, targetType: "ally",
      effects: [ { verb: "heal", target: "target", amount: 6 } ]
    },
    {
      id: "frantic_paperwork", name: "Frantic Paperwork", desc: "Shield an ally for 6.",
      animKey: "skill2", speed: 6, targetType: "ally",
      effects: [ { verb: "shield", target: "target", amount: 6 } ]
    }
  ]
};

// ---- Wave 2: Rival Campaign Staffers (mid-run, tuned +~20% over launch
// numbers so the campaign keeps pace with a party that's now picking up
// items — see CAMPAIGN_DESIGN.md follow-up "harder battles" pass) --------
CAMPAIGN_UNIT_DEFS.oppo_researcher = {
  id: "oppo_researcher", displayName: "Opposition Researcher", team: "enemy_only", role: "defender",
  color: 0x25272e, accentColor: 0x6ee7ff, shape: "election_mob", mobId: "whistleblower",
  stats: { maxHP: 58, speed: 4 },
  abilities: [
    {
      id: "dig_up_dirt", name: "Dig Up Dirt", desc: "Deal 9 damage to an enemy.",
      animKey: "skill1", speed: 5,
      effects: [ { verb: "damage", target: "target", amount: 9 } ]
    },
    {
      id: "damage_control", name: "Damage Control", desc: "Shield self for 12.",
      animKey: "skill2", speed: 6, targetType: "self",
      effects: [ { verb: "shield", target: "self", amount: 12 } ]
    }
  ]
};

CAMPAIGN_UNIT_DEFS.attack_ad_producer = {
  id: "attack_ad_producer", displayName: "Attack-Ad Producer", team: "enemy_only", role: "attacker",
  color: 0x3a1f22, accentColor: 0xff3b4a, shape: "election_mob", mobId: "staffer",
  stats: { maxHP: 46, speed: 6 },
  abilities: [
    {
      id: "thirty_second_spot", name: "Thirty-Second Spot", desc: "Deal 11 damage to an enemy.",
      animKey: "skill1", speed: 5,
      effects: [ { verb: "damage", target: "target", amount: 11 } ]
    },
    {
      id: "misleading_statistic", name: "Misleading Statistic", desc: "Deal 6 damage to an enemy, they are Slowed 2.",
      animKey: "skill2", speed: 3,
      effects: [
        { verb: "damage", target: "target", amount: 6 },
        { verb: "applyStatus", target: "target", status: (ctx) => StatusLib.slow(2, ctx.actor, "misleading_statistic") }
      ]
    }
  ]
};

CAMPAIGN_UNIT_DEFS.pollster = {
  id: "pollster", displayName: "Pollster", team: "enemy_only", role: "support",
  color: 0x2a2c3a, accentColor: 0xb08aff, shape: "election_mob", mobId: "pundit",
  stats: { maxHP: 38, speed: 7 },
  abilities: [
    {
      id: "favorable_sample", name: "Favorable Sample", desc: "Heal an ally for 11.",
      animKey: "skill1", speed: 5, targetType: "ally",
      effects: [ { verb: "heal", target: "target", amount: 11 } ]
    },
    {
      id: "margin_of_error", name: "Margin of Error", desc: "Shield an ally for 11.",
      animKey: "skill2", speed: 6, targetType: "ally",
      effects: [ { verb: "shield", target: "target", amount: 11 } ]
    }
  ]
};

// ---- Wave 3: Party Machine Insiders (late-run, tuned above battle_mid —
// fills the gap between the mid trio and Elite so the last couple of
// floors before the boss keep escalating instead of flattening out) ------
CAMPAIGN_UNIT_DEFS.super_pac_director = {
  id: "super_pac_director", displayName: "Super PAC Director", team: "enemy_only", role: "defender",
  color: 0x1c2430, accentColor: 0xffd23f, shape: "election_mob", mobId: "whistleblower", modelScale: 1.05,
  stats: { maxHP: 72, speed: 5 },
  abilities: [
    {
      id: "dark_money", name: "Dark Money", desc: "Deal 10 damage to an enemy and shield self for 8.",
      animKey: "skill1", speed: 5,
      effects: [
        { verb: "damage", target: "target", amount: 10 },
        { verb: "shield", target: "self", amount: 8 }
      ]
    },
    {
      id: "buy_the_airwaves", name: "Buy the Airwaves", desc: "Shield self for 16.",
      animKey: "skill2", speed: 7, targetType: "self",
      effects: [ { verb: "shield", target: "self", amount: 16 } ]
    }
  ]
};

CAMPAIGN_UNIT_DEFS.smear_specialist = {
  id: "smear_specialist", displayName: "Smear Specialist", team: "enemy_only", role: "attacker",
  color: 0x3a1520, accentColor: 0xff5577, shape: "election_mob", mobId: "staffer", modelScale: 1.05,
  stats: { maxHP: 54, speed: 6 },
  abilities: [
    {
      id: "hit_piece", name: "Hit Piece", desc: "Deal 13 damage to an enemy.",
      animKey: "skill1", speed: 5,
      effects: [ { verb: "damage", target: "target", amount: 13 } ]
    },
    {
      id: "leaked_footage", name: "Leaked Footage", desc: "Deal 7 damage to an enemy and inflict Sangramento (5/turno).",
      animKey: "skill2", speed: 3,
      effects: [
        { verb: "damage", target: "target", amount: 7 },
        { verb: "applyStatus", target: "target", status: () => StatusLib.bleed(5) }
      ]
    }
  ]
};

CAMPAIGN_UNIT_DEFS.spin_doctor = {
  id: "spin_doctor", displayName: "Spin Doctor", team: "enemy_only", role: "support",
  color: 0x241c30, accentColor: 0xc08aff, shape: "election_mob", mobId: "pundit", modelScale: 1.05,
  stats: { maxHP: 44, speed: 8 },
  abilities: [
    {
      id: "reframe_the_narrative", name: "Reframe the Narrative", desc: "Heal an ally for 13.",
      animKey: "skill1", speed: 5, targetType: "ally",
      effects: [ { verb: "heal", target: "target", amount: 13 } ]
    },
    {
      id: "damage_liaison", name: "Damage-Control Liaison", desc: "Shield an ally for 13 and permanently deal +2 damage with every ability for this unit.",
      animKey: "skill2", speed: 6, targetType: "ally",
      effects: [
        { verb: "shield", target: "target", amount: 13 },
        { verb: "applyStatus", target: "self", status: () => StatusLib.teamDamageBonus(2, "thisRound") }
      ]
    }
  ]
};

// ---- Elite: Debate Stage Moderator (Elite Battle node) — tuned up and
// given a genuine third move so the fight has more shape than "big single
// target hit + shield" -----------------------------------------------------
CAMPAIGN_UNIT_DEFS.debate_moderator = {
  id: "debate_moderator", displayName: "The Moderator", team: "enemy_only", role: "attacker",
  color: 0x1a1a20, accentColor: 0xffffff, shape: "election_mob", mobId: "elite_debate", modelScale: 1.15,
  stats: { maxHP: 85, speed: 5 },
  abilities: [
    {
      id: "gotcha_question", name: "Gotcha Question", desc: "Deal 14 damage to an enemy.",
      animKey: "skill1", speed: 5,
      effects: [ { verb: "damage", target: "target", amount: 14 } ]
    },
    {
      id: "moderate_the_room", name: "Moderate the Room", desc: "Shield self for 16, deal 5 damage to a random enemy.",
      animKey: "skill2", speed: 4,
      effects: [
        { verb: "shield", target: "self", amount: 16 },
        {
          verb: "damage",
          target: (ctx) => {
            const enemies = ctx.playerUnits.filter(u => u.alive);
            return enemies.length ? enemies[Math.floor(Math.random() * enemies.length)] : null;
          },
          amount: 5
        }
      ]
    },
    {
      id: "cut_the_mic", name: "Cut the Mic", desc: "Deal 7 damage to an enemy, they act last this round.",
      animKey: "skill3", speed: 2,
      cooldown: 3,
      effects: [
        { verb: "damage", target: "target", amount: 7 },
        { verb: "applyStatus", target: "target", status: () => StatusLib.moveLast() }
      ]
    },
    {
      // New second special (cooldown, separate from Cut the Mic) so the
      // Elite fight has two distinct cooldown threats to track instead of
      // one, per the "give elites a second special" difficulty pass.
      id: "closing_statement", name: "Closing Statement", desc: "Deal 9 damage to every enemy.",
      animKey: "skill3", speed: 6,
      cooldown: 4,
      effects: [
        {
          verb: "damage",
          target: (ctx) => ctx.playerUnits.filter(u => u.alive),
          amount: 9
        }
      ]
    }
  ]
};

// ---- Rosters: hand-authored trios per node, keyed by roster id ---------
// (CAMPAIGN_DESIGN.md §5.3: "curated per-floor, not pickRandomEnemyDeck").
// js/campaign/nodes.js picks one of these by tier for a given Battle/Elite
// node rather than drawing randomly from the whole CAMPAIGN_UNIT_DEFS pool,
// so early fights don't accidentally roll a mid-run-tuned enemy.
// battle_late sits between battle_mid and elite in power, and is offered
// on the floors closest to the boss (see rosterForNode in
// js/campaign/nodes.js) so difficulty keeps climbing instead of
// flattening out for the last stretch before Dário's Shadow.
const CAMPAIGN_ROSTERS = {
  battle_early: ["rally_barricade", "press_wrangler", "staffer_intern"],
  battle_mid: ["oppo_researcher", "attack_ad_producer", "pollster"],
  battle_late: ["super_pac_director", "smear_specialist", "spin_doctor"],
  elite: ["oppo_researcher", "debate_moderator", "pollster"],
  // Solo boss fight (CAMPAIGN_DESIGN.md §6) — a single-entry roster works
  // fine with initCampaignBattle's existing enemyRoster.map(...) shape
  // (idx 0 -> slot 0, no change needed there).
  boss: ["dario_shadow"],
};
