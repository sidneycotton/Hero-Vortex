// =============================================================
// ============ DÁRIO'S SHADOW — CAMPAIGN BOSS ====================
// =============================================================
// The Act 1 boss (CAMPAIGN_DESIGN.md §6). `team: "enemy_only"`, same
// exclusion convention js/units/campaign_enemies.js already uses — this
// keeps the boss out of pickRandomEnemyDeck()/pickRandomEnemyOrder()'s
// `def.team === "player"` filters automatically, so it can never be
// drafted or drawn into a Vs. AI/PVP battle, and it's additionally kept
// out of any CAMPAIGN_ROSTERS wave (only ever spawned by the dedicated
// Boss node resolver in js/campaign/nodes.js).
//
// §6.3's baseline kit, built entirely from existing generic verbs — no
// engine change needed for the base abilities themselves. The Approval
// Rating phase-swap logic that gates "Discurso de Campanha" and drives
// the boss's other phase changes lives in js/campaign/dario-shadow-boss.js
// (a campaign-only hook module), not here — this file only owns the
// static unit data, same separation of concerns as every other card.
//
// Bespoke model: js/models/dario_shadow.js (the supplied "President
// Shadow" build, wired in per CAMPAIGN_DESIGN.md §6.4's noted scope
// delta — see that file's header for what changed from the original
// supplied version).
MODERN_UNIT_DEFS.dario_shadow = {
  id: "dario_shadow", displayName: "A Sombra de Dário", team: "enemy_only", role: "attacker",
  color: 0x1a1014, accentColor: 0x8a1622, shape: "dario_shadow",
  modelScale: 0.55, // the bespoke build (js/models/dario_shadow.js) is
                     // authored at a much larger absolute scale than
                     // every other unit (a deliberately towering boss
                     // silhouette) — scaled back down at the root so it
                     // reads as "huge next to the party" rather than
                     // "off the edge of the battlefield". Presentational
                     // only; doesn't touch any of the model's internal
                     // joint-pivot math.
  stats: { maxHP: 140, speed: 6 },
  abilities: [
    {
      // §6.3 ability 1 — baseline single-target threat.
      id: "golpe_sombrio", name: "Golpe Sombrio", desc: "Deal 11 damage to an enemy.",
      animKey: "skill1", speed: 6,
      effects: [
        { verb: "damage", target: "target", amount: 11 }
      ]
    },
    {
      // §6.3 ability 2 — self-shield + a "draining" pair of steps
      // (damage a random party member, heal self by the same amount) —
      // mechanically just the existing damage/heal verbs, no new verb.
      id: "manto_do_medo", name: "Manto do Medo", desc: "Shield self for 10. Deal 6 damage to a random enemy and heal self for 6.",
      animKey: "skill2", speed: 5,
      effects: [
        { verb: "shield", target: "self", amount: 10 },
        {
          verb: "damage",
          target: (ctx) => {
            const enemies = ctx.playerUnits.filter(u => u.alive);
            return enemies.length ? enemies[Math.floor(Math.random() * enemies.length)] : null;
          },
          amount: 6
        },
        { verb: "heal", target: "self", amount: 6 }
      ]
    },
    {
      // §6.3 ability 3 — "Discurso de Campanha" ("Campaign Speech"), the
      // "Shadow surging" phase-gated bonus ability. Only usable when
      // approvalRating <= 30. The gate itself is read the same way any
      // other runtime-conditional ability check already works in this
      // engine (cooldown-style filtering, both in the player's ability-
      // row and in AI.js's candidate list) — here it's an Approval check
      // instead of a cooldown, applied campaign-side via
      // js/campaign/dario-shadow-boss.js rather than a new engine
      // concept. inflicts the lingering `smearCampaign` debuff (a plain
      // speedMod status with duration:'wholeFight' — CAMPAIGN_DESIGN.md
      // §6.2 — not a new status kind, just a new duration string that
      // expireRoundScopedStatuses already leaves alone forever, same
      // convention as items.js's 'permanent').
      id: "discurso_de_campanha", name: "Discurso de Campanha", desc: "Only usable while Approval is low. Deal 8 damage to a random enemy and slow them for the rest of the fight.",
      animKey: "skill3", speed: 3,
      // approvalGated marks this ability as conditionally available —
      // read by dario-shadow-boss.js's phase-swap logic (js/campaign/
      // dario-shadow-boss.js), which is the only thing that ever adds
      // or removes this ability from the boss's active kit. Left as
      // plain data here so the gate condition is documented right next
      // to the ability it gates, per handoff.md's "cards are data"
      // philosophy.
      approvalGated: { threshold: 30, direction: "atOrBelow" },
      effects: [
        {
          verb: "damage",
          target: (ctx) => pickSmearTarget(ctx),
          amount: 8
        },
        {
          verb: "applyStatus",
          target: (ctx) => pickSmearTarget(ctx),
          status: () => StatusLib.speedMod(-3, 'wholeFight')
        }
      ]
    }
  ]
};

// Both effect steps on "Discurso de Campanha" need to land on the SAME
// random party member (deal damage to them AND slow them) rather than
// two independent random picks. Cached on ctx for the duration of this
// single ability resolution — cleared implicitly each time a fresh ctx
// is built for the next cast (combat-engine.js builds a new ctx per
// resolve() call, so nothing needs manual resetting here).
function pickSmearTarget(ctx) {
  if (ctx._smearTarget !== undefined) return ctx._smearTarget;
  const enemies = ctx.playerUnits.filter(u => u.alive);
  ctx._smearTarget = enemies.length ? enemies[Math.floor(Math.random() * enemies.length)] : null;
  return ctx._smearTarget;
}
