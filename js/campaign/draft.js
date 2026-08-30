// =============================================================
// ============ CAMPAIGN DRAFT — 2 candidates per role, pick 1 =====
// =============================================================
// Campaign-only pre-run draft. Unlike Vs. AI/PVP's TeamSelect (browse
// the whole roster, 1-2 picks per role via search + nav arrows), the
// campaign draft rolls exactly 2 random candidates per role and the
// player picks one — three sequential modals (defender, attacker,
// support), same shape as StarterSelect's pair-pick flow. Does not
// touch js/team-select.js or js/starter-select.js at all.
//
// CampaignDraft.run(unitDefs, roleOrder) -> Promise<{ defender: id,
// attacker: id, support: id }>, exactly the flat shape Campaign.startRun()
// expects.

const CampaignDraft = (() => {

  function pickTwoRandom(list) {
    const pool = list.slice();
    const chosen = [];
    while (chosen.length < 2 && pool.length) {
      const i = Math.floor(Math.random() * pool.length);
      chosen.push(pool.splice(i, 1)[0]);
    }
    return chosen;
  }

  function roleLabel(role) {
    return I18n.roleLabel(role);
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s == null ? '' : String(s);
    return div.innerHTML;
  }

  // Resolves one role: shows a modal with 2 side-by-side cards (mini 3D
  // preview + name + role tag + ability names/descriptions), player taps
  // one to select (highlight only), then taps Confirm to lock it in —
  // same select-then-confirm pattern as the item picker in
  // js/campaign/nodes.js. `progress` ({ index, total }) drives the small
  // dot tracker under Confirm so the player can see how many picks are
  // left in the draft, not just which role this one is.
  function pickForRole(role, candidates, progress) {
    return new Promise((resolve) => {
      const cardsHtml = candidates.map((def, i) => `
        <div class="cd-card" data-idx="${i}">
          <div class="cd-preview-canvas" id="cd-preview-${i}"></div>
          <div class="cd-card-name">${escapeHtml(def.displayName)}</div>
          <div class="cd-card-role">${escapeHtml(roleLabel(def.role || role))}</div>
          <div class="cd-card-abilities">
            ${def.abilities.map(a => `
              <div class="cd-ability-name-row">
                <div class="cd-ability-name">${escapeHtml(a.name)}</div>
                ${a.passive
                  ? `<div class="cd-ability-speed cd-ability-speed-passive" title="Passive abilities have no speed and can't be selected">Passiva</div>`
                  : `<div class="cd-ability-speed" title="Turn-order speed for this ability">SPD ${escapeHtml(String(a.speed))}</div>`}
              </div>
              ${a.desc ? `<div class="cd-ability-desc">${escapeHtml(a.desc)}</div>` : ''}
            `).join('')}
          </div>
        </div>
      `).join('');

      const dotsHtml = progress ? `
        <div class="cd-progress">
          ${Array.from({ length: progress.total }).map((_, i) => `
            <div class="cd-progress-dot ${i < progress.index ? 'cd-progress-done' : ''} ${i === progress.index ? 'cd-progress-current' : ''}"></div>
          `).join('')}
        </div>
      ` : '';

      CampaignNodeUI.showModal(
        `Choose your ${roleLabel(role)}`,
        `<div class="cd-pair">${cardsHtml}</div>
         <div class="cnu-btn-row"><button class="cnu-btn" id="cd-confirm" disabled>Confirm</button></div>
         ${dotsHtml}`,
        (modalEl) => {
          const previews = candidates.map((def, i) => {
            const host = modalEl.querySelector(`#cd-preview-${i}`);
            const preview = new CampaignNodeUI.MiniPreview(host);
            preview.show(def);
            return preview;
          });

          let selectedIdx = null;
          const confirmBtn = modalEl.querySelector('#cd-confirm');
          const cards = modalEl.querySelectorAll('[data-idx]');
          cards.forEach(card => {
            card.addEventListener('click', () => {
              selectedIdx = Number(card.getAttribute('data-idx'));
              cards.forEach(c => c.classList.remove('cd-card-selected'));
              card.classList.add('cd-card-selected');
              confirmBtn.disabled = false;
            });
          });

          confirmBtn.addEventListener('click', () => {
            previews.forEach(p => p.dispose());
            resolve(candidates[selectedIdx].id);
          });
        }
      );
    });
  }

  // unitDefs: full UNIT_DEFS. roleOrder: e.g. TeamSelect.ROLE_ORDER.
  // Draft pool reuses TeamSelect.buildDraftPool so summon-only units stay
  // excluded, same as Vs. AI's draft.
  async function run(unitDefs, roleOrder) {
    const pool = TeamSelect.buildDraftPool(unitDefs);
    const draft = {};
    for (let i = 0; i < roleOrder.length; i++) {
      const role = roleOrder[i];
      const candidates = pickTwoRandom(pool[role] || []);
      draft[role] = await pickForRole(role, candidates, { index: i, total: roleOrder.length });
    }
    CampaignNodeUI.hide();
    return draft;
  }

  return { run };
})();
