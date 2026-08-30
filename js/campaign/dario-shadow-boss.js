// =============================================================
// ============ DÁRIO'S SHADOW — APPROVAL RATING HOOK MODULE ======
// =============================================================
// CAMPAIGN_DESIGN.md §6, build-order step 7. Owns the boss-only
// `approvalRating` tracked value (0-100, starts at 50) and every phase
// change gated off it. Entirely additive/guarded, same pattern as the
// rest of the campaign layer: every hook no-ops the instant the current
// enemy roster doesn't contain the boss, so no other battle (Vs. AI,
// PVP, or any other campaign node) is affected.
//
// Does NOT touch resolution.js/combat-engine.js. It only:
//  - listens via the existing registerActionResolvedHook (effects.js)
//  - reads/writes plain fields on the boss Unit (_approvalRating)
//  - calls the already-generic applyStatusToUnit/removeStatusFromUnit
//  - occasionally calls CombatEngine.applyOne directly for the
//    telegraphed ultimate, the exact same way gavinFollowup's hook
//    (effects.js) already does for its own AOE payoff.
//
// HUD: exposes DarioShadowBoss.currentRating()/isActive() so index.html
// can render a small conditional Approval bar in #topbar — see the
// renderApprovalBar() call wired into refreshAllUnitUI() in
// planning-ui.js and the initial call in js/campaign/run.js's
// initCampaignBattle().

const DarioShadowBoss = (() => {
  const BOSS_ID = 'dario_shadow';
  const START_RATING = 50;
  const LANDSLIDE_THRESHOLD = 70;   // party dominating
  const SURGING_THRESHOLD = 30;     // shadow surging
  const PER_HIT_SWING = 4;          // §6.2's "-4 / +4 per hit"
  const SELF_CARE_SWING = 2;        // "+deceptive campaigning" on self-heal/shield

  let state = null; // { boss, warned } while the boss fight is active, else null

  function findBoss(units) {
    return (units || []).find(u => u.alive !== false && u.defId === BOSS_ID) || null;
  }

  // Called by initCampaignBattle right after enemyUnits is populated for
  // a node (a no-op the vast majority of the time — only the dedicated
  // Boss node's roster ever contains dario_shadow).
  function onBattleStart(enemyUnits) {
    const boss = findBoss(enemyUnits);
    if (!boss) { state = null; return; }
    state = { boss, warned: false };
    setRating(START_RATING, { silent: true });
  }

  function onBattleEnd() {
    state = null;
  }

  function isActive() {
    return !!state;
  }

  function currentRating() {
    return state ? state.boss._approvalRating : null;
  }

  function clamp(n) {
    return Math.max(0, Math.min(100, n));
  }

  // Central setter: clamps, stamps the value onto the boss unit (read by
  // isApprovalGated in js/units/core.js — that's the ONLY thing that
  // needs _approvalRating to exist, everything else here is bookkeeping
  // around it), applies/removes phase statuses, and refreshes the HUD.
  function setRating(next, opts = {}) {
    if (!state) return;
    const prev = typeof state.boss._approvalRating === 'number' ? state.boss._approvalRating : START_RATING;
    const clamped = clamp(next);
    state.boss._approvalRating = clamped;
    applyPhaseEffects(prev, clamped);
    if (!opts.silent) renderApprovalBar();
  }

  function shiftRating(delta) {
    if (!state) return;
    setRating(state.boss._approvalRating + delta);
  }

  // §6.2's four threshold effects. Applied/removed idempotently on every
  // change (not just the crossing) so a status never gets stuck if the
  // rating oscillates back across a threshold mid-fight.
  function applyPhaseEffects(prev, next) {
    const boss = state.boss;

    // Landslide (>=70): boss loses its hardest hit for now (handled by
    // AI simply never picking golpe_sombrio while this status name is
    // active — see the ability-filter tag below) and gains `slow` each
    // round. `slow` already has its own registerStatusAppliedHook logic
    // (effects.js) that copy-triggers on the granter's next attack; here
    // we just re-apply it every round it's still in Landslide range so
    // it doesn't lapse, same idempotent-refresh pattern applyStatusToUnit
    // already guarantees for non-stacking statuses.
    if (next >= LANDSLIDE_THRESHOLD) {
      if (!hasStatus(boss, 'landslide')) {
        applyStatusToUnit(boss, { id: 'landslide', name: 'Em Recuo', kind: 'landslide', data: {}, duration: 'wholeFight' });
        addLogLine(`${boss.displayName} está em recuo — Aprovação em Landslide!`, 'info');
      }
      applyStatusToUnit(boss, StatusLib.slow ? StatusLib.slow() : { id: 'slow', name: 'Lento', kind: 'slow', data: {}, duration: 'thisRound' });
    } else if (hasStatus(boss, 'landslide')) {
      removeStatusFromUnit(boss, 'landslide');
    }

    // Shadow surging (<=30): permanent-for-the-fight teamDamageBonus on
    // itself only (StatusLib.teamDamageBonus already reads actor.team,
    // so this only buffs the boss's own side, which is just the boss) +
    // Discurso de Campanha unlocks (isApprovalGated in units/core.js
    // reads _approvalRating directly — nothing else to flip here).
    if (next <= SURGING_THRESHOLD) {
      if (!hasStatus(boss, 'teamDamageBonus')) {
        applyStatusToUnit(boss, { ...StatusLib.teamDamageBonus(3), duration: 'wholeFight' });
        addLogLine(`${boss.displayName} está surgindo nas pesquisas — discurso de campanha liberado!`, 'info');
      }
    } else if (hasStatus(boss, 'teamDamageBonus')) {
      removeStatusFromUnit(boss, 'teamDamageBonus');
    }

    // Party wins (100): boss "concedes" every other round — re-apply
    // nullifyNext every time we're at 100 and it isn't already active;
    // nullifyNext is self-consuming (combat-engine.js) so this naturally
    // reads as "every other round" without any extra bookkeeping here.
    if (next >= 100 && !hasStatus(boss, 'nullifyNext')) {
      applyStatusToUnit(boss, StatusLib.nullifyNext('wholeFight'));
      addLogLine(`${boss.displayName} concede a rodada!`, 'hit');
    }

    // Shadow wins (0): one-round telegraphed warning, then the ultimate.
    // Only ever fires once per fight (state.warned guards it) — if the
    // party claws Approval back up before the warned round resolves, the
    // ultimate still lands as promised (it's a committed threat, not a
    // bluff, per §6.2's "meant to be a real threat, not a bluff").
    if (next <= 0 && !state.warned) {
      state.warned = true;
      addLogLine(`⚠️ ${boss.displayName} prepara "Vitória Landslide" — shield up!`, 'hit');
      applyStatusToUnit(boss, { id: 'landslideUltimateArmed', name: 'Vitória Landslide (carregando)', kind: 'landslideUltimateArmed', data: {}, duration: 'wholeFight' });
    }
  }

  // ---- Hooks: swing Approval off actual combat results -------------------
  // Fires after every resolved action in ANY battle (guarded to no-op
  // instantly when this isn't the boss fight — same convention as
  // js/campaign/run.js's own onPartyUnitDied hook).
  registerActionResolvedHook((action, ctx) => {
    if (!state) return;
    const boss = state.boss;
    const applied = ctx.result.applied || [];

    for (const a of applied) {
      if (a.verb !== 'damage' || !a.actualDamage || a.actualDamage <= 0) continue;
      if (a.target === boss && action.actor !== boss) {
        // Party damaged the boss — "winning the debate".
        shiftRating(PER_HIT_SWING);
      } else if (a.target && a.target.team === 'player' && action.actor === boss) {
        // Boss damaged a party member — "campaigning negatively".
        shiftRating(-PER_HIT_SWING);
      }
    }

    // Boss healing/shielding itself — "deceptive campaigning", a smaller
    // negative swing regardless of amount (flat, per §6.2 — not scaled
    // by heal size, since even a token heal is the same "spin" beat).
    if (action.actor === boss) {
      const selfCare = applied.some(a => (a.verb === 'heal' || a.verb === 'shield') && a.target === boss);
      if (selfCare) shiftRating(-SELF_CARE_SWING);
    }

    // The armed ultimate fires on the NEXT boss action after the warning
    // round (i.e. the round-end immediately after `landslideUltimateArmed`
    // was applied has already passed — this hook runs on the boss's own
    // subsequent queued action, giving the party exactly the "1-round
    // warning" §6.2 promises before it lands).
    if (action.actor === boss && hasStatus(boss, 'landslideUltimateArmed') && action._landslideResolvedRound) {
      fireLandslideUltimate(boss, ctx);
    }
  });

  // Marks which round the warning was armed in, so the hook above can
  // tell "this is the boss's first action AFTER the warning" apart from
  // "this is the same round the warning just got armed". Runs as its own
  // tiny hook rather than folding into the big one above, purely for
  // readability — same one-hook-per-concern style as effects.js's
  // reactive-mechanic section.
  registerActionResolvedHook((action, ctx) => {
    if (!state || action.actor !== state.boss) return;
    if (hasStatus(state.boss, 'landslideUltimateArmed')) {
      action._landslideResolvedRound = true;
    }
  });

  function fireLandslideUltimate(boss, ctx) {
    removeStatusFromUnit(boss, 'landslideUltimateArmed');
    addLogLine(`${boss.displayName} desencadeia "Vitória Landslide"!`, 'hit');
    const targets = (boss.team === 'player' ? ctx.enemyUnits : ctx.playerUnits).filter(u => u.alive);
    for (const t of targets) {
      const dmgResult = CombatEngine.applyOne({ verb: 'damage', target: t, amount: 16, dealtBy: boss }, ctx.result);
      if (dmgResult.actualDamage > 0) {
        renderFloatingNumbers({ type: 'attack', target: t, actualDamage: dmgResult.actualDamage });
        if (dmgResult.killed) t.animations && t.animations.dead && t.animations.dead();
      }
    }
    // Reset to neutral afterward so the fight doesn't just re-trigger the
    // same ultimate every subsequent round if the party still can't turn
    // the tide — one big threat, not a repeating death spiral.
    setRating(START_RATING);
    refreshAllUnitUI();
  }

  // ---- HUD ----------------------------------------------------------------
  // Small conditional bar in #topbar (index.html), only rendered while
  // this specific boss fight is active. No-ops harmlessly if the DOM
  // element isn't present (e.g. called once before index.html's own
  // bootstrap finishes building #topbar's children — shouldn't normally
  // happen since initCampaignBattle always runs after DOM ready, but
  // fails safe rather than throwing).
  function renderApprovalBar() {
    const el = document.getElementById('approval-bar-wrap');
    if (!el) return;
    if (!state) { el.classList.remove('show'); return; }
    const rating = state.boss._approvalRating;
    el.classList.add('show');
    const fill = el.querySelector('#approval-bar-fill');
    const label = el.querySelector('#approval-bar-label');
    if (fill) fill.style.width = `${rating}%`;
    if (label) label.textContent = I18n.t('pv.hud.approval', { rating });
    el.classList.toggle('approval-low', rating <= SURGING_THRESHOLD);
    el.classList.toggle('approval-high', rating >= LANDSLIDE_THRESHOLD);
  }

  return { onBattleStart, onBattleEnd, isActive, currentRating, renderApprovalBar };
})();
