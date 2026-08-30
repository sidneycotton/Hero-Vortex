// =============================================================
// ============ CAMPAIGN EVENTS ===================================
// =============================================================
// Real content pass for the Event node (CAMPAIGN_DESIGN.md §5.3 /
// build-order step 6), replacing js/campaign/nodes.js's inline
// PLACEHOLDER_EVENTS (2 entries) with a proper themed pool.
//
// Shape per §5.3: `{ id, text, choices: [{ label, effect }] }`.
// `effect(run)` reuses the same generic mechanisms the rest of the
// campaign layer already uses — direct `run.gold`/`run.party` mutation
// for currency/HP, `applyStatusToUnit` + `StatusLib` for statuses —
// rather than inventing a bespoke "campaignEffect" verb, since plain
// function callbacks already cover every outcome type this pool needs.
//
// All 8 events are read-only story dressing on top of existing
// mechanisms: no new engine code, no new status kinds beyond what
// items.js already established (`duration: 'permanent'` marker for a
// lingering effect that should NOT auto-expire via
// expireRoundScopedStatuses, same convention as js/campaign/items.js).

const CampaignEvents = (() => {
  // ---- shared small helpers ------------------------------------------
  function livingParty(run) {
    return run.party.filter(u => u.alive);
  }

  function randomLivingUnit(run) {
    const pool = livingParty(run);
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function healPct(run, pct) {
    livingParty(run).forEach(u => {
      const missing = u.maxHP - u.hp;
      u.hp = Math.min(u.maxHP, u.hp + Math.round(missing * pct));
    });
  }

  function gainGold(run, amount) {
    run.gold = Math.max(0, run.gold + amount);
  }

  function livingWithItem(run) {
    return livingParty(run).filter(u => u.equippedItem);
  }

  function livingWithHero(run, heroId) {
    return livingParty(run).filter(u => u.defId === heroId);
  }

  function dealPctDamage(run, unit, pct) {
    const amount = Math.max(1, Math.round(unit.maxHP * pct));
    unit.hp = Math.max(0, unit.hp - amount);
    if (unit.hp <= 0) unit.alive = false;
  }

  // ---- the pool ---------------------------------------------------------
  // `condition(run)` is optional — omitted means "always eligible". When
  // present, CampaignEvents.roll() only offers the event if it returns
  // true, so a few events can be gated on run state (an equipped item, a
  // specific hero present) without the roll ever landing on a scenario
  // that can't actually apply to the current party.
  const EVENTS = [
    {
      id: 'rival_staffer_envelope',
      text: "A rival staffer slides an envelope across the table. \"Campaign secrets,\" she says. \"For a price.\"",
      choices: [
        {
          label: "Pay 20 gold",
          effect: (run) => { if (run.gold >= 20) { run.gold -= 20; gainGold(run, 45); } }
        },
        { label: "Walk away", effect: () => {} },
      ]
    },
    {
      id: 'old_ally_rest_stop',
      text: "An old ally offers you a quiet moment to recover before the next stop on the trail.",
      choices: [
        { label: "Rest a while", effect: (run) => healPct(run, 0.2) },
        { label: "Push on", effect: (run) => gainGold(run, 10) },
      ]
    },
    {
      id: 'town_hall_heckler',
      text: "A heckler in the crowd keeps interrupting the speech. Security wants to know how to handle it.",
      choices: [
        {
          label: "Let them finish shouting",
          effect: (run) => gainGold(run, 15)
        },
        {
          label: "Have them removed",
          effect: (run) => {
            const u = randomLivingUnit(run);
            if (u) applyStatusToUnit(u, StatusLib.speedMod(-2, 'permanent'));
          }
        },
      ]
    },
    {
      id: 'anonymous_donor',
      text: "An anonymous donor wires a large, suspiciously convenient sum to the campaign fund.",
      choices: [
        { label: "Accept the money", effect: (run) => gainGold(run, 60) },
        {
          label: "Refuse it, publicly",
          effect: (run) => {
            const u = randomLivingUnit(run);
            if (u) applyStatusToUnit(u, StatusLib.teamDamageBonus(3, 'permanent'));
          }
        },
      ]
    },
    {
      id: 'photo_op_gone_wrong',
      text: "A staged photo-op with local volunteers goes sideways — someone trips carrying the podium, right in front of the cameras.",
      choices: [
        {
          label: "Laugh it off on camera",
          effect: (run) => gainGold(run, 12)
        },
        {
          label: "Send them to the medic tent",
          effect: (run) => healPct(run, 0.15)
        },
      ]
    },
    {
      id: 'late_night_strategy_session',
      text: "The team stays up late war-gaming the next debate. It's exhausting, but it sharpens everyone's instincts.",
      choices: [
        {
          label: "Push through the night",
          effect: (run) => {
            const u = randomLivingUnit(run);
            if (u) applyStatusToUnit(u, StatusLib.speedMod(2, 'permanent'));
          }
        },
        { label: "Call it early, get some sleep", effect: (run) => healPct(run, 0.1) },
      ]
    },
    {
      id: 'street_vendor_merch',
      text: "A street vendor is selling bootleg campaign merch with your face slightly wrong. It's somehow selling well.",
      choices: [
        { label: "Buy out the stock, resell it properly", effect: (run) => gainGold(run, 25) },
        { label: "Let it slide — free publicity", effect: (run) => gainGold(run, 8) },
      ]
    },
    {
      id: 'whistleblower_hesitates',
      text: "A nervous staffer from the other campaign wants to talk, but they're having second thoughts about being seen with you.",
      choices: [
        {
          label: "Meet them anyway",
          effect: (run) => {
            if (Math.random() < 0.5) {
              gainGold(run, 40);
            } else {
              const u = randomLivingUnit(run);
              if (u) applyStatusToUnit(u, StatusLib.speedMod(-2, 'permanent'));
            }
          }
        },
        { label: "Too risky, decline", effect: () => {} },
      ]
    },

    // ---- new: risk-forward events (real chance of a bad outcome) --------
    {
      id: 'shady_pawnbroker',
      text: "A pawnbroker offers to appraise an ally's equipped item — for a cut. Sometimes the appraisal comes back... adjusted.",
      condition: (run) => livingWithItem(run).length > 0,
      choices: [
        {
          label: "Let them appraise it (70% chance of +20 gold, 30% chance the item is repossessed)",
          effect: (run) => {
            const candidates = livingWithItem(run);
            const u = candidates[Math.floor(Math.random() * candidates.length)];
            if (Math.random() < 0.7) {
              gainGold(run, 20);
            } else if (u && typeof Items !== 'undefined') {
              Items.unequipItem(u);
            }
          }
        },
        { label: "Keep the item, walk away", effect: () => {} },
      ]
    },
    {
      id: 'back_alley_wager',
      text: "A local organizer wants to bet on tomorrow's turnout numbers. The odds sound too good.",
      choices: [
        {
          label: "Take the bet (50/50: double or lose it)",
          effect: (run) => {
            const wager = Math.min(run.gold, 30);
            if (wager <= 0) return;
            run.gold -= wager;
            if (Math.random() < 0.5) gainGold(run, wager * 2);
          }
        },
        { label: "Decline, it's a scam", effect: () => {} },
      ]
    },
    {
      id: 'exhausting_double_rally',
      text: "Scheduling crammed two rallies into one day. The team can push through both, or protect their strength for what's ahead.",
      choices: [
        {
          label: "Push through both (gain 25 gold, one random ally takes 15% max HP damage)",
          effect: (run) => {
            gainGold(run, 25);
            const u = randomLivingUnit(run);
            if (u) dealPctDamage(run, u, 0.15);
          }
        },
        { label: "Cancel the second one", effect: (run) => healPct(run, 0.05) },
      ]
    },

    // ---- new: item-trading events ----------------------------------------
    {
      id: 'traveling_quartermaster',
      text: "A traveling quartermaster offers to swap an ally's equipped item for a mystery item from her bag — sealed, unlabeled.",
      condition: (run) => livingWithItem(run).length > 0 && typeof Items !== 'undefined',
      choices: [
        {
          label: "Make the trade",
          effect: (run) => {
            const candidates = livingWithItem(run);
            const u = candidates[Math.floor(Math.random() * candidates.length)];
            if (!u) return;
            const pool = Items.poolFor(run).filter(it => Items.isEligible(it, u));
            if (!pool.length) return;
            const newItem = pool[Math.floor(Math.random() * pool.length)];
            Items.equipItem(u, newItem);
          }
        },
        { label: "Not worth the risk", effect: () => {} },
      ]
    },
    {
      id: 'lost_and_found_bin',
      text: "Someone left a small chest of unclaimed items behind the stage. Nobody's come looking for it.",
      choices: [
        {
          label: "Take an item for free",
          effect: (run) => {
            const pool = Items.poolFor(run, { excludeRarities: ['boss'] });
            if (!pool.length) return;
            const item = pool[Math.floor(Math.random() * pool.length)];
            const eligible = Items.eligibleUnitsFor(item, run);
            const u = eligible[Math.floor(Math.random() * eligible.length)];
            if (u) Items.equipItem(u, item);
          }
        },
        { label: "Report it to lost & found (gain 10 gold, goodwill)", effect: (run) => gainGold(run, 10) },
      ]
    },

    // ---- new: hero-specific flavor events ---------------------------------
    {
      id: 'ajax_feeding_time',
      text: "Ajax hasn't eaten today and it shows. \"I fight better hungry,\" he insists, unconvincingly.",
      condition: (run) => livingWithHero(run, 'ajax').length > 0,
      choices: [
        {
          label: "Feed him properly (heal Ajax fully)",
          effect: (run) => {
            const units = livingWithHero(run, 'ajax');
            units.forEach(u => { u.hp = u.maxHP; });
          }
        },
        {
          label: "Let him fight hungry (permanently +3 damage, -8 Max HP for Ajax)",
          effect: (run) => {
            const units = livingWithHero(run, 'ajax');
            units.forEach(u => {
              applyStatusToUnit(u, StatusLib.teamDamageBonus(3, 'permanent'));
              u.maxHP -= 8; u.hp = Math.min(u.hp, u.maxHP);
            });
          }
        },
      ]
    },
    {
      id: 'babawibby_workshop_time',
      text: "Babawibby found scrap and a few spare hours. \"Could build something. Could blow something up. Same thing, really.\"",
      condition: (run) => livingWithHero(run, 'babawibby').length > 0,
      choices: [
        { label: "Let him build (gain 15 gold from selling the extras)", effect: (run) => gainGold(run, 15) },
        {
          label: "Let him blow something up (one random ally takes 10% max HP damage, gain 30 gold from the spectacle)",
          effect: (run) => {
            const u = randomLivingUnit(run);
            if (u) dealPctDamage(run, u, 0.10);
            gainGold(run, 30);
          }
        },
      ]
    },
    {
      id: 'dario_quiet_moment',
      text: "Dário stares at his own reflection a beat too long backstage. Neither face looks back the way he expects.",
      condition: (run) => livingWithHero(run, 'dario').length > 0,
      choices: [
        { label: "Give him space", effect: (run) => healPct(run, 0.08) },
        { label: "Talk it through with him", effect: (run) => gainGold(run, 18) },
      ]
    },
  ];

  function roll() {
    const eligible = EVENTS.filter(ev => !ev.condition || ev.condition(Campaign.getRun()));
    const pool = eligible.length ? eligible : EVENTS.filter(ev => !ev.condition);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  return { EVENTS, roll };
})();
