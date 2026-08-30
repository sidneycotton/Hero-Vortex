// =============================================================
// ============ STARTER SELECT — pick-your-opener modal ========
// =============================================================
// After team-select confirms a deck (2 unit ids per role — see
// js/team-select.js), both the player and the enemy AI go through this:
// for each role in turn (defender, attacker, support), choose ONE of the
// role's 2 cards to start on the battlefield; the other goes to that
// side's hand. This matters for future cards that care about "was I the
// one played first" or have effects while sitting in hand — see
// handoff.md's "deck/hand/battlefield system" plan.
//
// UI pattern: identical to js/campaign/draft.js's CampaignDraft (the
// "choose your character" screen from campaign mode) — both cards shown
// side by side at once, tap one to highlight/select it, then tap Confirm
// to lock it in. A small dot tracker under Confirm shows progress through
// the 3 roles. Kept as its own self-contained module (own DOM mount, own
// stylesheet, own MiniPreview) rather than routing through
// CampaignNodeUI, since Vs. AI and PVP must not depend on anything under
// js/campaign/ — the two visual languages just happen to match by design.
//
// Player side: StarterSelect.runForPlayer(deckByRole, allDefsById,
// roleOrder) shows 3 sequential modals, resolves when the human has
// clicked all 3 Confirms.
// Enemy side: StarterSelect.pickForAI(deckByRole, roleOrder) is
// synchronous, no UI — picks randomly from each pair. Kept as a separate,
// trivial function (not routed through the same modal) since there's no
// reason to animate a decision nobody is watching.

const StarterSelect = (() => {

  I18n.addDict({
    pt: {
      'ss.title': 'ESCOLHA QUEM COMEÇA',
      'ss.subtitle': '{role} \u2014 escolha quem joga primeiro',
      'ss.confirm': 'Confirmar',
      'ss.hint': 'A outra carta vai para sua mão e pode ser jogada depois.'
    },
    en: {
      'ss.title': 'CHOOSE YOUR OPENER',
      'ss.subtitle': '{role} \u2014 pick who plays first',
      'ss.confirm': 'Confirm',
      'ss.hint': 'The other card goes to your hand and can be played later.'
    }
  });

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s == null ? '' : String(s);
    return div.innerHTML;
  }

  function roleLabel(role) {
    return I18n.roleLabel(role);
  }

  // ---- Minimal reusable 3D preview, one instance per card slot ----
  // Same shape as CampaignNodeUI.MiniPreview: frames to the model's actual
  // bounding box so oversized characters (e.g. Ajax) don't spill past
  // their card, then idly rotates while shown.
  class MiniPreview {
    constructor(canvasHost) {
      this.host = canvasHost;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
      this.camera.position.set(0, 1.6, 4.2);
      this.camera.lookAt(0, 1, 0);

      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      canvasHost.appendChild(this.renderer.domElement);

      const key = new THREE.DirectionalLight(0xffffff, 1.1);
      key.position.set(2, 4, 3);
      this.scene.add(key);
      const rim = new THREE.DirectionalLight(0x6ee7ff, 0.5);
      rim.position.set(-3, 2, -2);
      this.scene.add(rim);
      this.scene.add(new THREE.AmbientLight(0x404040, 1.1));

      this.currentRoot = null;
      this._raf = null;
      this._clock = new THREE.Clock();
      this._resizeObserver = (typeof ResizeObserver !== 'undefined')
        ? new ResizeObserver(() => this.resize())
        : null;
      if (this._resizeObserver) this._resizeObserver.observe(canvasHost);
      else window.addEventListener('resize', () => this.resize());
      this.resize();
    }

    resize() {
      const w = this.host.clientWidth || 1;
      const h = this.host.clientHeight || 1;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      if (this.currentRoot) this._frameModel(this.currentRoot);
    }

    // Fits the camera to the model's actual bounding box instead of a
    // fixed camera distance, so a larger-than-average model doesn't
    // overflow its card. Same approach as TeamSelect.CardPreview and
    // CampaignNodeUI.MiniPreview.
    _frameModel(root) {
      const box = new THREE.Box3();
      let any = false;
      root.updateWorldMatrix(true, true);
      root.traverse(obj => {
        if (!obj.isMesh) return;
        let n = obj;
        while (n) { if (n.visible === false) return; n = n.parent; }
        box.expandByObject(obj);
        any = true;
      });
      if (!any || box.isEmpty()) return;
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      const margin = 1.35;
      const vFov = (this.camera.fov * Math.PI) / 180;
      const distForHeight = (size.y / 2) / Math.tan(vFov / 2);
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
      const distForWidth = (size.x / 2) / Math.tan(hFov / 2);
      const dist = Math.max(distForHeight, distForWidth) * margin;

      const dir = this.camera.position.clone().sub(this._lookTarget || new THREE.Vector3(0, 1, 0)).normalize();
      this.camera.position.copy(center).addScaledVector(dir, dist);
      this.camera.lookAt(center);
      this._lookTarget = center;
    }

    show(def) {
      if (this.currentRoot) { this.scene.remove(this.currentRoot); this.currentRoot = null; }
      const { root } = buildUnitModel(def);
      if (root) {
        root.position.set(0, 0, 0);
        this.scene.add(root);
        this.currentRoot = root;
        this._frameModel(root);
      }
      this._startLoop();
    }

    _startLoop() {
      if (this._raf) return;
      const tick = () => {
        this._raf = requestAnimationFrame(tick);
        const t = this._clock.getElapsedTime();
        if (this.currentRoot) this.currentRoot.rotation.y = Math.sin(t * 0.6) * 0.5;
        this.renderer.render(this.scene, this.camera);
      };
      tick();
    }

    dispose() {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = null;
      if (this._resizeObserver) this._resizeObserver.disconnect();
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }

  let mounted = false;

  function ensureMounted() {
    if (mounted) return;
    const mount = document.getElementById('starter-select-mount');

    if (!document.getElementById('ss-inline-style')) {
      const style = document.createElement('style');
      style.id = 'ss-inline-style';
      style.textContent = `
        #starter-select-mount { position: absolute; inset: 0; z-index: 26; display: none; }
        #starter-select-mount.show { display: block; }
        .ss-backdrop {
          position: absolute; inset: 0;
          background: rgba(3,4,8,0.92);
          display: flex; align-items: center; justify-content: center;
          padding: 16px; box-sizing: border-box;
        }
        .ss-modal {
          width: 100%; max-width: 460px; max-height: 90%;
          background: #12141c; border: 2px solid rgba(255,255,255,0.12);
          border-radius: 14px; padding: 16px;
          overflow-y: auto; overflow-x: hidden;
          box-sizing: border-box;
        }
        .ss-title {
          font-size: 16px; font-weight: 700; letter-spacing: 0.3px;
          color: #6ee7ff; margin-bottom: 2px; text-align: center;
        }
        .ss-subtitle {
          font-size: 11.5px; letter-spacing: 0.3px; text-transform: uppercase;
          color: #7f8db3; text-align: center; margin-bottom: 10px;
        }
        .ss-pair { display: flex; gap: 10px; margin-top: 8px; }
        .ss-card {
          flex: 1 1 0; min-width: 0; background: rgba(255,255,255,0.04);
          border: 2px solid rgba(255,255,255,0.12); border-radius: 10px;
          padding: 10px; cursor: pointer; text-align: center;
          transition: border-color 0.15s, background 0.15s;
          overflow: hidden;
        }
        .ss-card:hover { border-color: #6ee7ff; background: rgba(110,231,255,0.06); }
        .ss-card-selected { border-color: #6ee7ff; background: rgba(110,231,255,0.14); }
        /* overflow:hidden + canvas forced to 100%/100%: MiniPreview's
           renderer resizes the pixel buffer but not the element's CSS
           size, so this containment keeps the 3D model from spilling
           past the card border. */
        .ss-preview-canvas { width: 100%; height: 140px; overflow: hidden; }
        .ss-preview-canvas canvas { display: block; width: 100% !important; height: 100% !important; }
        .ss-card-name {
          font-weight: 700; font-size: 13px; color: #fff; margin-top: 6px;
          overflow-wrap: break-word; word-break: break-word; line-height: 1.3;
        }
        .ss-card-abilities { margin-top: 8px; text-align: left; }
        .ss-ability-name-row {
          display: flex; align-items: baseline; justify-content: space-between;
          gap: 6px; padding-left: 10px; position: relative;
        }
        .ss-ability-name-row::before {
          content: "\u2022"; position: absolute; left: 0; color: #6ee7ff;
        }
        .ss-ability-name {
          font-size: 11px; color: #b9c8e6; line-height: 1.5; font-weight: 700;
          overflow-wrap: break-word; word-break: break-word;
        }
        .ss-ability-desc {
          font-size: 10px; color: #7f8db3; line-height: 1.4;
          padding-left: 10px; margin-top: 1px; margin-bottom: 5px;
          overflow-wrap: break-word; word-break: break-word;
        }
        .ss-btn-row { display: flex; gap: 8px; margin-top: 14px; }
        .ss-confirm-btn {
          flex: 1 1 0;
          background: rgba(110,231,255,0.1); border: 2px solid #6ee7ff;
          border-radius: 8px; padding: 10px 8px;
          color: #6ee7ff; font-size: 13px; font-weight: 700;
          cursor: pointer; transition: background 0.15s;
        }
        .ss-confirm-btn:hover { background: rgba(110,231,255,0.22); }
        .ss-confirm-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .ss-progress { display: flex; justify-content: center; gap: 6px; margin-top: 12px; }
        .ss-progress-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: rgba(255,255,255,0.18); transition: background 0.15s;
        }
        .ss-progress-dot.ss-progress-done { background: #6ee7ff; }
        .ss-progress-dot.ss-progress-current { background: #fff; }
        .ss-hint { font-size: 11px; color: #7f8ba8; text-align: center; margin-top: 10px; }
      `;
      document.head.appendChild(style);
    }

    mounted = true;
  }

  // Resolves one role: shows a modal with the role's 2 candidates side by
  // side (mini 3D preview + name + full ability list), player taps one to
  // select (highlight only), then taps Confirm to lock in who starts on
  // the field — same select-then-confirm pattern as CampaignDraft.
  // `pair` is an array of 1 or 2 unit ids (1 auto-resolves without
  // showing anything, same as before). `progress` ({ index, total })
  // drives the dot tracker under Confirm.
  // Tracks the params of whatever showRoleChoice call currently has a
  // modal open, so I18n.onChange can re-render its text in place without
  // touching the in-flight Promise/selection state (there's no shared
  // `state` object like team-select.js's — this whole screen lives inside
  // showRoleChoice's own closure per call).
  let activeRoleChoice = null; // { role, defs, progress } | null

  function renderRoleChoiceText(role, defs, progress) {
    const mount = document.getElementById('starter-select-mount');
    if (!mount) return;
    const titleEl = mount.querySelector('.ss-title');
    if (titleEl) titleEl.textContent = I18n.t('ss.title');
    const subtitleEl = mount.querySelector('.ss-subtitle');
    if (subtitleEl) subtitleEl.textContent = I18n.t('ss.subtitle', { role: roleLabel(role) });
    const confirmBtn = mount.querySelector('#ss-confirm');
    if (confirmBtn) confirmBtn.textContent = I18n.t('ss.confirm');
    const hintEl = mount.querySelector('.ss-hint');
    if (hintEl) hintEl.textContent = I18n.t('ss.hint');
    mount.querySelectorAll('.ss-card').forEach((card, i) => {
      const def = defs[i];
      if (!def) return;
      const nameEl = card.querySelector('.ss-card-name');
      if (nameEl) nameEl.textContent = UnitText.displayName(def);
      const abilityRows = card.querySelectorAll('.ss-ability-name-row .ss-ability-name');
      const descRows = card.querySelectorAll('.ss-ability-desc');
      (def.abilities || []).forEach((a, j) => {
        if (abilityRows[j]) abilityRows[j].textContent = UnitText.abilityName(def, a);
        if (descRows[j]) descRows[j].textContent = UnitText.abilityDesc(def, a) || '';
      });
    });
  }

  function showRoleChoice(role, pair, allDefsById, progress) {
    return new Promise(resolve => {
      if (pair.length === 1) {
        resolve(pair[0]);
        return;
      }

      ensureMounted();
      const mount = document.getElementById('starter-select-mount');
      const defs = pair.map(id => allDefsById[id]);

      const cardsHtml = defs.map((def, i) => `
        <div class="ss-card" data-idx="${i}">
          <div class="ss-preview-canvas" id="ss-preview-${i}"></div>
          <div class="ss-card-name">${escapeHtml(UnitText.displayName(def))}</div>
          <div class="ss-card-abilities">
            ${(def.abilities || []).map(a => `
              <div class="ss-ability-name-row">
                <div class="ss-ability-name">${escapeHtml(UnitText.abilityName(def, a))}</div>
              </div>
              ${a.desc ? `<div class="ss-ability-desc">${escapeHtml(UnitText.abilityDesc(def, a))}</div>` : ''}
            `).join('')}
          </div>
        </div>
      `).join('');

      const dotsHtml = progress ? `
        <div class="ss-progress">
          ${Array.from({ length: progress.total }).map((_, i) => `
            <div class="ss-progress-dot ${i < progress.index ? 'ss-progress-done' : ''} ${i === progress.index ? 'ss-progress-current' : ''}"></div>
          `).join('')}
        </div>
      ` : '';

      mount.innerHTML = `
        <div class="ss-backdrop">
          <div class="ss-modal">
            <div class="ss-title">${I18n.t('ss.title')}</div>
            <div class="ss-subtitle">${I18n.t('ss.subtitle', { role: roleLabel(role) })}</div>
            <div class="ss-pair">${cardsHtml}</div>
            <div class="ss-btn-row"><button class="ss-confirm-btn" id="ss-confirm" disabled>${I18n.t('ss.confirm')}</button></div>
            ${dotsHtml}
            <div class="ss-hint">${I18n.t('ss.hint')}</div>
          </div>
        </div>
      `;
      mount.classList.add('show');
      activeRoleChoice = { role, defs, progress };

      const previews = defs.map((def, i) => {
        const host = mount.querySelector(`#ss-preview-${i}`);
        const preview = new MiniPreview(host);
        preview.show(def);
        return preview;
      });

      let selectedIdx = null;
      const confirmBtn = mount.querySelector('#ss-confirm');
      const cards = mount.querySelectorAll('[data-idx]');
      cards.forEach(card => {
        card.addEventListener('click', () => {
          selectedIdx = Number(card.getAttribute('data-idx'));
          cards.forEach(c => c.classList.remove('ss-card-selected'));
          card.classList.add('ss-card-selected');
          confirmBtn.disabled = false;
        });
      });

      confirmBtn.addEventListener('click', () => {
        previews.forEach(p => p.dispose());
        mount.classList.remove('show');
        mount.innerHTML = '';
        activeRoleChoice = null;
        resolve(defs[selectedIdx].id);
      });
    });
  }

  // Player flow: sequential modal per role, in roleOrder. Returns a
  // Promise resolving to { field: {defender, attacker, support}, hand:
  // [{ defId, role }] } once all 3 choices are made.
  async function runForPlayer(deckByRole, allDefsById, roleOrder) {
    const field = {};
    const hand = [];
    for (let i = 0; i < roleOrder.length; i++) {
      const role = roleOrder[i];
      const pair = deckByRole[role] || [];
      const chosenId = await showRoleChoice(role, pair, allDefsById, { index: i, total: roleOrder.length });
      field[role] = chosenId;
      pair.forEach(id => { if (id !== chosenId) hand.push({ defId: id, role }); });
    }
    return { field, hand };
  }

  // AI flow: no UI, resolves synchronously. Picks fully at random between
  // each role's pair (see handoff.md — smarter heuristics are a later,
  // separate task, not part of this pass).
  function pickForAI(deckByRole, roleOrder) {
    const field = {};
    const hand = [];
    for (const role of roleOrder) {
      const pair = deckByRole[role] || [];
      if (pair.length === 0) continue;
      const chosenId = pair[Math.floor(Math.random() * pair.length)];
      field[role] = chosenId;
      pair.forEach(id => { if (id !== chosenId) hand.push({ defId: id, role }); });
    }
    return { field, hand };
  }

  // Safe to call any time, including when no modal is currently open
  // (e.g. PVP.js calling this defensively on opponent-disconnect). Just
  // hides whatever's showing; does NOT resolve/reject the in-flight
  // showRoleChoice promise — callers that abort a match mid-draft rely on
  // PVP.js's own abort plumbing (registerAbort/abortAllPending) for that,
  // this only prevents the modal being stuck visible under the menu.
  function close() {
    const mount = document.getElementById('starter-select-mount');
    if (mount) { mount.classList.remove('show'); mount.innerHTML = ''; }
    activeRoleChoice = null;
  }

  I18n.onChange(() => {
    // Only re-render while a role-choice modal is actually open (per the
    // "only re-render if currently showing" heuristic — see
    // main-menu.js's I18n.onChange). This patches text in place; it does
    // NOT rebuild the DOM, so the in-flight Promise, selectedIdx closure,
    // and live MiniPreview instances are left completely alone.
    if (!activeRoleChoice) return;
    const { role, defs, progress } = activeRoleChoice;
    renderRoleChoiceText(role, defs, progress);
  });

  return { runForPlayer, pickForAI, close };
})();
