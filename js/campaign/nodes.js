// =============================================================
// ============ CAMPAIGN NODES ====================================
// =============================================================
// Node-type resolvers (CAMPAIGN_DESIGN.md §5.3). Step 3 landed Battle/
// Elite (combat via Campaign.initCampaignBattle()); step 4 landed
// Chest/Healing/Shop/Event/Revival/Character Pick with a temporary
// flat-effect PLACEHOLDER_ITEMS pool. Step 5 (this pass) swaps that
// pool for the real js/campaign/items.js equip-slot system and wires
// a real item reward into Battle/Elite wins (§5.3's "Reward: gold +
// item choice" / "guaranteed item + more gold", not implemented until
// now).

const CampaignNodes = (() => {
  function enter(node, run) {
    switch (node.type) {
      case 'battle': return enterBattle(node, run, false);
      case 'elite': return enterBattle(node, run, true);
      case 'chest': return enterChest(node, run);
      case 'heal': return enterHeal(node, run);
      case 'shop': return enterShop(node, run);
      case 'training': return enterTraining(node, run);
      case 'revival': return enterRevival(node, run);
      case 'charPick': return enterCharacterPick(node, run);
      case 'event': return enterEvent(node, run);
      case 'boss': return enterBoss(node, run);
      default:
        console.log(`[campaign] node type "${node.type}" not implemented yet — returning to map.`);
        CampaignMap.show(run);
    }
  }

  function rosterForNode(node, isElite) {
    if (isElite) return CAMPAIGN_ROSTERS.elite;
    // Three-tier tuning by floor index — first third uses the low-tuned
    // wave, middle third the mid-tuned wave, final third (closest to the
    // boss) the late-tuned wave, so difficulty keeps climbing all the way
    // to the boss instead of flattening out at the midpoint
    // (CAMPAIGN_DESIGN.md §5.3, extended by the "harder battles" pass).
    const run = Campaign.getRun();
    const floorCount = run && run.mapGraph ? run.mapGraph.floors.length : 8;
    if (node.floorIndex < floorCount / 3) return CAMPAIGN_ROSTERS.battle_early;
    if (node.floorIndex < (2 * floorCount) / 3) return CAMPAIGN_ROSTERS.battle_mid;
    return CAMPAIGN_ROSTERS.battle_late;
  }

  function enterBattle(node, run, isElite) {
    const roster = rosterForNode(node, isElite);
    node._rewardGold = isElite ? 35 + Math.floor(Math.random() * 18) : 18 + Math.floor(Math.random() * 12);
    node._isElite = isElite;
    node._isBoss = false;
    Campaign.initCampaignBattle(roster);
  }

  // ---- Boss: Dário's Shadow (CAMPAIGN_DESIGN.md §6, step 7) --------------
  // Reuses initCampaignBattle exactly like Battle/Elite (§6.4: "no engine
  // change needed") — the only difference is what happens on win/loss,
  // handled in onBattleOverlayContinue's node._isBoss branch below, since
  // beating the boss ends the run in victory rather than returning to
  // the map for another node.
  function enterBoss(node, run) {
    node._isElite = false;
    node._isBoss = true;
    Campaign.initCampaignBattle(CAMPAIGN_ROSTERS.boss);
  }

  // Called by planning-ui.js's restart-btn listener when the campaign
  // overlay's Continue/Return button is clicked. Reads whether the just-
  // finished battle was won directly off the current roster state rather
  // than needing a separate flag threaded through showOverlay — the
  // enemy side being wiped IS the win condition here.
  function onBattleOverlayContinue() {
    const run = Campaign.getRun();
    const currentNode = run.mapGraph.byId[run.currentNodeId];
    const won = CombatEngine.isTeamDefeated(enemyUnits) && !CombatEngine.isTeamDefeated(playerUnits);

    if (!won) {
      // Full run loss (CAMPAIGN_DESIGN.md §5.4): no bench/revival left
      // (checkCampaignGameOver already guarantees that's the only way we
      // get here with won===false). Step 8: a real run-summary screen
      // instead of bouncing straight to the main menu.
      CampaignSummary.showDefeat(run, currentNode);
      return;
    }

    if (currentNode._isBoss) {
      // Beating Dário's Shadow ends the run in victory — no item choice,
      // no return to the map. Step 8's run-complete summary screen.
      DarioShadowBoss.onBattleEnd();
      CampaignSummary.showVictory(run);
      return;
    }

    run.gold += (currentNode._rewardGold || 0);
    // Item reward (§5.3: Battle = "gold + item choice", Elite =
    // "guaranteed item + more gold"). Battle offers 1-of-3 from the
    // full pool (mostly common); Elite offers 1-of-2 drawn only from
    // rare-or-better so the harder fight always pays off in a
    // meaningfully better item, not just more gold. If no item in the
    // run's pool is eligible for anyone alive (e.g. the whole party
    // already maxed on universal items with only the ability-swap item
    // left, or nobody alive matches it), this degrades to a no-op —
    // gold alone still made the fight worth it.
    const excludeRarities = currentNode._isElite ? ['common'] : [];
    const candidates = Items.poolFor(run, { excludeRarities });
    const offerCount = currentNode._isElite ? 2 : 3;
    const offered = Items.weightedSample(candidates, Math.min(offerCount, candidates.length));
    if (!offered.length) { CampaignMap.show(run); return; }
    showItemChoiceModal("Victory!", offered, run, () => CampaignMap.show(run));
  }

  // Character Pick offers a hero from OUTSIDE the current run's party/
  // bench — reuses the same draftable, non-summon-only pool TeamSelect
  // itself draws from, so the offer always reads like a real roster
  // member, never a campaign-only enemy def.
  function draftableBenchPool(run) {
    const takenIds = new Set([...run.party, ...run.deadUnits, ...(run.bench || [])].map(u => u.defId));
    return Object.values(UNIT_DEFS).filter(def =>
      def.team === "player" && !TeamSelect.SUMMON_ONLY_UNIT_IDS.has(def.id) && !takenIds.has(def.id)
    );
  }

  function renderPartyHpRows(units) {
    return units.map(u => `
      <div class="cnu-party-unit">
        <div class="cnu-party-unit-name">${u.displayName}</div>
        <div class="cnu-hp-bar-bg"><div class="cnu-hp-bar-fill" style="width:${Math.max(0, Math.round(100 * u.hp / u.maxHP))}%"></div></div>
      </div>
    `).join('');
  }

  // ---- Chest: choice of 1-of-3 items, no fight (§5.3) --------------------
  function enterChest(node, run) {
    if (!node._chestOffer) {
      const candidates = Items.poolFor(run);
      node._chestOffer = Items.weightedSample(candidates, Math.min(3, candidates.length));
    }
    const offered = node._chestOffer;
    if (!offered.length) {
      // Nobody alive is eligible for anything left in the pool — shouldn't
      // normally happen (universal items always qualify while anyone's
      // alive), but fail safe rather than show an empty chest modal.
      CampaignMap.show(run);
      return;
    }
    // Paid reroll: pay gold to swap the whole 3-item offer for a fresh
    // weighted draw, instead of committing to the first roll. Cached on
    // the node (node._chestOffer) so leaving/reopening the chest without
    // paying shows the same offer, not a free reroll.
    const REROLL_COST = 25;
    showItemChoiceModal(
      "A Chest", offered, run, () => CampaignMap.show(run),
      {
        extraButtonsHtml: `<button class="cnu-btn" id="cnu-chest-reroll" ${run.gold < REROLL_COST ? 'disabled' : ''}>Reroll Chest (${REROLL_COST}g)</button>`,
        onExtraMount(modalEl) {
          const btn = modalEl.querySelector('#cnu-chest-reroll');
          if (!btn) return;
          btn.addEventListener('click', () => {
            if (run.gold < REROLL_COST) return;
            run.gold -= REROLL_COST;
            const candidates = Items.poolFor(run);
            node._chestOffer = Items.weightedSample(candidates, Math.min(3, candidates.length));
            enterChest(node, run);
          });
        }
      }
    );
  }

  // Shared item-choice modal used by Chest and by Battle/Elite item
  // rewards (see onBattleOverlayContinue). Picking an item opens the
  // "who gets it?" follow-up, filtered to units the item is actually
  // eligible for (ability-swap items only fit whoever has that ability).
  // `extras` is optional: { extraButtonsHtml, onExtraMount(modalEl) } lets
  // a specific caller (currently only Chest, for its paid Reroll button)
  // add its own controls into the same modal without every other caller
  // (Battle/Elite reward) needing to know about them.
  function showItemChoiceModal(titleText, offered, run, onDone, extras = {}) {
    const choicesHtml = offered.map((item, i) => `
      <div class="cnu-choice-card" data-item-idx="${i}">
        <div class="cnu-choice-name">${item.name} <span class="cnu-choice-rarity cnu-rarity-${item.rarity}">${item.rarity}</span></div>
        <div class="cnu-choice-desc">${item.desc}</div>
      </div>
    `).join('');
    CampaignNodeUI.showModal(
      titleText,
      `<p>Pick one item. It equips to a party member of your choice.</p>
       <div class="cnu-choices">${choicesHtml}</div>
       ${extras.extraButtonsHtml ? `<div class="cnu-btn-row">${extras.extraButtonsHtml}</div>` : ''}`,
      (modalEl) => {
        modalEl.querySelectorAll('[data-item-idx]').forEach(card => {
          card.addEventListener('click', () => {
            const item = offered[Number(card.getAttribute('data-item-idx'))];
            promptTargetThenEquip(run, item, onDone);
          });
        });
        if (extras.onExtraMount) extras.onExtraMount(modalEl);
      }
    );
  }

  // Small follow-up modal: which eligible party member gets the item.
  // Only one item slot per unit (§7.1) — equipping over an existing item
  // auto-unequips the old one (Items.equipItem), so the picker flags that
  // up front rather than silently swapping it out.
  // Two-step: tap a card to select it (highlights, doesn't equip yet),
  // then tap Confirm to actually equip — avoids equipping on a stray/
  // accidental tap with no way to review the choice first.
  function promptTargetThenEquip(run, item, onDone) {
    const eligible = Items.eligibleUnitsFor(item, run);
    const rowsHtml = eligible.map((u, i) => `
      <div class="cnu-choice-card" data-unit-idx="${i}">
        <div class="cnu-choice-name">${u.displayName}</div>
        <div class="cnu-choice-desc">HP ${u.hp}/${u.maxHP}${u.equippedItem ? ` — replaces ${u.equippedItem.name}` : ''}</div>
      </div>
    `).join('');
    let selectedIdx = null;
    CampaignNodeUI.showModal(
      item.name,
      `<p>${item.desc}</p><div class="cnu-choices">${rowsHtml}</div>
       <div class="cnu-btn-row"><button class="cnu-btn" id="cnu-item-confirm" disabled>Confirm</button></div>`,
      (modalEl) => {
        const confirmBtn = modalEl.querySelector('#cnu-item-confirm');
        modalEl.querySelectorAll('[data-unit-idx]').forEach(card => {
          card.addEventListener('click', () => {
            selectedIdx = Number(card.getAttribute('data-unit-idx'));
            modalEl.querySelectorAll('[data-unit-idx]').forEach(c => c.classList.remove('cnu-choice-selected'));
            card.classList.add('cnu-choice-selected');
            confirmBtn.disabled = false;
          });
        });
        confirmBtn.addEventListener('click', () => {
          if (selectedIdx === null) return;
          Items.equipItem(eligible[selectedIdx], item);
          CampaignNodeUI.hide();
          onDone();
        });
      }
    );
  }

  // ---- Healing Station: flat % of missing HP, or spend gold for more ----
  function enterHeal(node, run) {
    const FREE_PCT = 0.3;
    const PAID_PCT = 0.6;
    const PAID_COST = 25;
    CampaignNodeUI.showModal(
      "Healing Station",
      `<p>Rest and recover.</p>
       <div class="cnu-party-row">${renderPartyHpRows(run.party.filter(u => u.alive))}</div>
       <div class="cnu-btn-row">
         <button class="cnu-btn" id="cnu-heal-free">Rest (heal ${Math.round(FREE_PCT*100)}% missing HP)</button>
         <button class="cnu-btn" id="cnu-heal-paid" ${run.gold < PAID_COST ? 'disabled' : ''}>Pay ${PAID_COST}g (heal ${Math.round(PAID_PCT*100)}%)</button>
       </div>`,
      (modalEl) => {
        modalEl.querySelector('#cnu-heal-free').addEventListener('click', () => {
          applyHeal(run, FREE_PCT);
          CampaignMap.show(run);
        });
        modalEl.querySelector('#cnu-heal-paid').addEventListener('click', () => {
          if (run.gold < PAID_COST) return;
          run.gold -= PAID_COST;
          applyHeal(run, PAID_PCT);
          CampaignMap.show(run);
        });
      }
    );
  }

  function applyHeal(run, pct) {
    run.party.filter(u => u.alive).forEach(u => {
      const missing = u.maxHP - u.hp;
      u.hp = Math.min(u.maxHP, u.hp + Math.round(missing * pct));
    });
  }

  // ---- Shop: spend gold on items and/or a full heal ----------------------
  // Shop's inventory excludes 'boss' rarity — that one's reserved for
  // Elite/Chest drops so it stays a genuine find, not something gold can
  // just buy every run (§7.1: "curated small inventory").
  // Shop stock is rolled once per node visit and cached on the node itself
  // (node._shopStock) so leaving and re-entering doesn't reroll for free —
  // only the paid Restock button below regenerates it.
  function rollShopStock(run) {
    const candidates = Items.poolFor(run, { excludeRarities: ['boss'] });
    // A curated shop shouldn't just be "everything eligible" once the pool
    // is 40+ items deep — sample a manageable storefront each visit/
    // restock instead, same weighted-by-rarity draw Chest/Battle use.
    return Items.weightedSample(candidates, Math.min(6, candidates.length));
  }

  function enterShop(node, run) {
    if (!node._shopStock) node._shopStock = rollShopStock(run);
    const stock = node._shopStock;
    const choicesHtml = stock.map((item, i) => `
      <div class="cnu-choice-card" data-item-idx="${i}" ${run.gold < item.price ? 'style="opacity:0.4;cursor:not-allowed;"' : ''}>
        <div class="cnu-choice-name">${item.name} <span class="cnu-choice-rarity cnu-rarity-${item.rarity}">${item.rarity}</span></div>
        <div class="cnu-choice-desc">${item.desc}</div>
        <div class="cnu-choice-price">${item.price}g</div>
      </div>
    `).join('');
    const FULL_HEAL_COST = 50;
    const RESTOCK_COST = 20;
    CampaignNodeUI.showModal(
      "Shop",
      `<p>Gold: ${run.gold}</p>
       <div class="cnu-choices">${choicesHtml}</div>
       <div class="cnu-btn-row">
         <button class="cnu-btn" id="cnu-shop-fullheal" ${run.gold < FULL_HEAL_COST ? 'disabled' : ''}>Full Heal Party (${FULL_HEAL_COST}g)</button>
         <button class="cnu-btn" id="cnu-shop-restock" ${run.gold < RESTOCK_COST ? 'disabled' : ''}>Restock Shelf (${RESTOCK_COST}g)</button>
         <button class="cnu-btn cnu-btn-secondary" id="cnu-shop-leave">Leave</button>
       </div>`,
      (modalEl) => {
        modalEl.querySelectorAll('[data-item-idx]').forEach(card => {
          card.addEventListener('click', () => {
            const item = stock[Number(card.getAttribute('data-item-idx'))];
            if (run.gold < item.price) return;
            run.gold -= item.price;
            promptTargetThenEquip(run, item, () => enterShop(node, run));
          });
        });
        modalEl.querySelector('#cnu-shop-fullheal').addEventListener('click', () => {
          if (run.gold < FULL_HEAL_COST) return;
          run.gold -= FULL_HEAL_COST;
          applyHeal(run, 1);
          enterShop(node, run);
        });
        modalEl.querySelector('#cnu-shop-restock').addEventListener('click', () => {
          if (run.gold < RESTOCK_COST) return;
          run.gold -= RESTOCK_COST;
          node._shopStock = rollShopStock(run);
          enterShop(node, run);
        });
        modalEl.querySelector('#cnu-shop-leave').addEventListener('click', () => CampaignMap.show(run));
      }
    );
  }

  // ---- Training Grounds: spend gold on a PERMANENT stat upgrade that does
  // NOT use the unit's one item slot (§7.1's slot is for items only) ------
  // A separate way to spend gold from the Shop: rather than an equip-slot
  // item, this directly and permanently mutates the unit's own base
  // stats/damage bonus, the same fields items themselves would adjust, so
  // a unit can take both a Training upgrade AND still hold a full item —
  // no competition between the two gold sinks.
  const TRAINING_OPTIONS = [
    { id: "train_hp", label: "+10 Max HP", cost: 30, apply(u) { u.maxHP += 10; u.hp += 10; } },
    { id: "train_speed", label: "Permanently +1 Speed", cost: 35, apply(u) { applyStatusToUnit(u, StatusLib.speedMod(1, 'permanent')); } },
    { id: "train_damage", label: "Permanently +2 damage with every ability", cost: 40, apply(u) { applyStatusToUnit(u, StatusLib.teamDamageBonus(2, 'permanent')); } },
  ];

  function enterTraining(node, run) {
    const alive = run.party.filter(u => u.alive);
    const renderUnitOptions = () => alive.map((u, ui) => `
      <div class="cnu-training-unit">
        <div class="cnu-choice-name">${u.displayName}</div>
        <div class="cnu-btn-row">
          ${TRAINING_OPTIONS.map((opt, oi) => `
            <button class="cnu-btn" data-train-unit="${ui}" data-train-opt="${oi}" ${run.gold < opt.cost ? 'disabled' : ''}>${opt.label} (${opt.cost}g)</button>
          `).join('')}
        </div>
      </div>
    `).join('');

    const render = () => {
      CampaignNodeUI.showModal(
        "Training Grounds",
        `<p>Gold: ${run.gold}. Permanent upgrades — don't use an item slot.</p>
         <div class="cnu-training-list">${renderUnitOptions()}</div>
         <div class="cnu-btn-row">
           <button class="cnu-btn cnu-btn-secondary" id="cnu-training-leave">Leave</button>
         </div>`,
        (modalEl) => {
          modalEl.querySelectorAll('[data-train-unit]').forEach(btn => {
            btn.addEventListener('click', () => {
              const unit = alive[Number(btn.getAttribute('data-train-unit'))];
              const opt = TRAINING_OPTIONS[Number(btn.getAttribute('data-train-opt'))];
              if (!unit || !unit.alive || run.gold < opt.cost) return;
              run.gold -= opt.cost;
              opt.apply(unit);
              render();
            });
          });
          modalEl.querySelector('#cnu-training-leave').addEventListener('click', () => CampaignMap.show(run));
        }
      );
    };
    render();
  }

  // ---- Revival Station: only rolled/shown if deadUnits is non-empty ------
  function enterRevival(node, run) {
    if (!run.deadUnits.length) {
      // Defensive fallback: map generation shouldn't roll this with an
      // empty deadUnits (§5.3), but if it somehow does, treat it as a
      // no-op rather than showing an empty, uselessly-confusing modal.
      CampaignMap.show(run);
      return;
    }
    const choicesHtml = run.deadUnits.map((u, i) => `
      <div class="cnu-choice-card" data-dead-idx="${i}">
        <div class="cnu-choice-name">${u.displayName}</div>
        <div class="cnu-choice-desc">Revive at 50% HP, no statuses/counters carried.</div>
      </div>
    `).join('');
    CampaignNodeUI.showModal(
      "Revival Station",
      `<p>Choose one fallen ally to bring back.</p><div class="cnu-choices">${choicesHtml}</div>`,
      (modalEl) => {
        modalEl.querySelectorAll('[data-dead-idx]').forEach(card => {
          card.addEventListener('click', () => {
            const idx = Number(card.getAttribute('data-dead-idx'));
            const unit = run.deadUnits.splice(idx, 1)[0];
            // Clean second life, not a resurrection-with-baggage (§5.3):
            // fresh statuses/counters/cooldowns, half HP, alive again.
            unit.alive = true;
            unit.hp = Math.max(1, Math.round(unit.maxHP * 0.5));
            unit.shield = 0;
            unit.statuses = [];
            unit.counters = {};
            unit.cooldowns = {};
            run.party.push(unit);
            CampaignMap.show(run);
          });
        });
      }
    );
  }

  // ---- Character Pick: offer a new hero for bench depth, not a battle slot
  function enterCharacterPick(node, run) {
    if (!run.bench) run.bench = [];
    const pool = draftableBenchPool(run);
    if (!pool.length) {
      // Every eligible hero already taken — nothing to offer.
      CampaignMap.show(run);
      return;
    }
    const shuffled = pool.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const offer = shuffled[0];
    CampaignNodeUI.showModal(
      "A New Recruit",
      `<div class="cnu-preview-canvas" id="cnu-char-preview"></div>
       <p><strong>${offer.displayName}</strong> (${offer.role}) offers to join your bench — battle slots are still just 3, but a bench member can replace a fallen ally at your next Character Pick or Revival Station.</p>
       <div class="cnu-btn-row">
         <button class="cnu-btn" id="cnu-char-accept">Recruit</button>
         <button class="cnu-btn cnu-btn-secondary" id="cnu-char-decline">Decline</button>
       </div>`,
      (modalEl) => {
        const preview = new CampaignNodeUI.MiniPreview(modalEl.querySelector('#cnu-char-preview'));
        preview.show(offer);
        modalEl.querySelector('#cnu-char-accept').addEventListener('click', () => {
          preview.dispose();
          const benchUnit = new Unit(UNIT_DEFS[offer.id], ROLE_SLOT[offer.role], "player");
          scene.remove(benchUnit.model); // not on the field until swapped in
          run.bench.push(benchUnit);
          CampaignMap.show(run);
        });
        modalEl.querySelector('#cnu-char-decline').addEventListener('click', () => {
          preview.dispose();
          CampaignMap.show(run);
        });
      }
    );
  }

  // ---- Event: short text scenario with 2-3 choices -----------------------
  // Data-driven per §5.3. Step 6 (js/campaign/events.js) landed the real
  // 8-event content pool, replacing this step's original 2-entry inline
  // placeholder — CampaignEvents.roll() below is that pool.
  function enterEvent(node, run) {
    const ev = CampaignEvents.roll();
    const choicesHtml = ev.choices.map((c, i) => `<button class="cnu-btn" data-choice-idx="${i}">${c.label}</button>`).join('');
    CampaignNodeUI.showModal(
      "A Campaign Event",
      `<p>${ev.text}</p><div class="cnu-btn-row">${choicesHtml}</div>`,
      (modalEl) => {
        modalEl.querySelectorAll('[data-choice-idx]').forEach(btn => {
          btn.addEventListener('click', () => {
            ev.choices[Number(btn.getAttribute('data-choice-idx'))].effect(run);
            CampaignMap.show(run);
          });
        });
      }
    );
  }

  return { enter, onBattleOverlayContinue };
})();
