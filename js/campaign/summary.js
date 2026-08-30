// =============================================================
// ============ CAMPAIGN RUN SUMMARY — victory / defeat ===========
// =============================================================
// Build-order step 8's remaining piece (CAMPAIGN_DESIGN.md §5.4): a
// real run-summary screen instead of bouncing straight back to the
// main menu on a run loss, plus the run-complete screen for beating
// Dário's Shadow. Reuses CampaignNodeUI.showModal for the shell (same
// self-contained pattern as every other campaign screen) rather than
// inventing new chrome.

const CampaignSummary = (() => {
  function floorsReached(run) {
    // visitedNodeIds includes the fixed floor-0 battle node itself, so
    // this reads as "how many nodes you cleared", which is what a
    // Slay-the-Spire-style summary means by "floors reached".
    return run.visitedNodeIds.size;
  }

  function survivorRows(run) {
    if (!run.party.length) return '<div class="cnu-choice-desc">No survivors.</div>';
    return run.party.map(u => `
      <div class="cnu-party-unit">
        <div class="cnu-party-unit-name">${u.displayName}</div>
        <div class="cnu-hp-bar-bg"><div class="cnu-hp-bar-fill" style="width:${Math.max(0, Math.round(100 * u.hp / u.maxHP))}%"></div></div>
      </div>
    `).join('');
  }

  function endAndReturnToMenu(run) {
    Campaign.endRun();
    CampaignNodeUI.hide();
    MainMenu.openModePicker();
  }

  function showDefeat(run, currentNode) {
    CampaignNodeUI.showModal(
      "Run Over",
      `<p>Your party has fallen${currentNode && currentNode._isBoss ? ', within sight of Dário\'s Shadow itself' : ''}.</p>
       <p><strong>Floors reached:</strong> ${floorsReached(run)}</p>
       <p><strong>Fallen allies:</strong> ${run.deadUnits.length}</p>
       <p><strong>Gold collected:</strong> ${run.gold}</p>
       <div class="cnu-btn-row"><button class="cnu-btn" id="cnu-summary-menu">Return to Menu</button></div>`,
      (modalEl) => {
        modalEl.querySelector('#cnu-summary-menu').addEventListener('click', () => endAndReturnToMenu(run));
      }
    );
  }

  function showVictory(run) {
    CampaignNodeUI.showModal(
      "Campaign Complete",
      `<p>Dário's Shadow has fallen. The election is decided.</p>
       <p><strong>Floors reached:</strong> ${floorsReached(run)}</p>
       <p><strong>Fallen allies:</strong> ${run.deadUnits.length}</p>
       <p><strong>Gold collected:</strong> ${run.gold}</p>
       <div class="cnu-choices">${survivorRows(run)}</div>
       <div class="cnu-btn-row"><button class="cnu-btn" id="cnu-summary-menu">Return to Menu</button></div>`,
      (modalEl) => {
        modalEl.querySelector('#cnu-summary-menu').addEventListener('click', () => endAndReturnToMenu(run));
      }
    );
  }

  return { showDefeat, showVictory };
})();
