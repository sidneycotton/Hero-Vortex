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
// Self-contained the same way js/team-select.js is: owns its own DOM
// (mounted into #starter-select-mount), its own small stylesheet block
// (inlined below — this modal is simple enough not to need its own CSS
// file), and its own pair of CardPreview-style Three.js renderers. Only
// reaches into index.html for `buildUnitModel(def)`, exactly like
// TeamSelect does.
//
// Player side: StarterSelect.runForPlayer(deckByRole, allDefsById) shows
// 3 sequential modals, resolves when the human has clicked all 3.
// Enemy side: StarterSelect.pickForAI(deckByRole) is synchronous, no UI —
// picks randomly from each pair. Kept as a separate, trivial function
// (not routed through the same modal) since there's no reason to animate
// a decision nobody is watching; see handoff.md if that ever needs to
// change (e.g. an AI "thinking" flourish).

const StarterSelect = (() => {

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s == null ? '' : String(s);
    return div.innerHTML;
  }

  function roleLabel(role) {
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  // ---- Minimal reusable 3D preview, one instance per card slot ----
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
    }

    show(def) {
      if (this.currentRoot) { this.scene.remove(this.currentRoot); this.currentRoot = null; }
      const { root } = buildUnitModel(def);
      if (root) {
        root.position.set(0, 0, 0);
        this.scene.add(root);
        this.currentRoot = root;
      }
      this._startLoop();
    }

    _startLoop() {
      if (this._raf) return;
      const tick = () => {
        this._raf = requestAnimationFrame(tick);
        const t = this._clock.getElapsedTime();
        if (this.currentRoot) {
          this.currentRoot.rotation.y = Math.sin(t * 0.6) * 0.35;
          const bob = this.currentRoot.getObjectByName('body');
          if (bob) bob.position.y = Math.sin(t * 1.6) * 0.05;
        }
        this.renderer.render(this.scene, this.camera);
      };
      tick();
    }

    stopLoop() {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = null;
    }

    destroy() {
      this.stopLoop();
      if (this._resizeObserver) this._resizeObserver.disconnect();
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }

  let mounted = false;
  let previews = null; // { left: MiniPreview, right: MiniPreview }, built lazily on first open

  function ensureMounted() {
    if (mounted) return;
    const mount = document.getElementById('starter-select-mount');
    mount.innerHTML = `
      <div id="starter-select" class="ss-root">
        <div class="ss-header">
          <h1 id="ss-title">CHOOSE YOUR OPENER</h1>
          <div class="ss-role" id="ss-role"></div>
        </div>
        <div class="ss-pair">
          <div class="ss-card" id="ss-card-0">
            <div class="ss-card-render" id="ss-render-0"></div>
            <div class="ss-card-name" id="ss-name-0"></div>
            <div class="ss-card-abilities" id="ss-abilities-0"></div>
            <button class="ss-choose-btn" id="ss-choose-0">Play First</button>
          </div>
          <div class="ss-card" id="ss-card-1">
            <div class="ss-card-render" id="ss-render-1"></div>
            <div class="ss-card-name" id="ss-name-1"></div>
            <div class="ss-card-abilities" id="ss-abilities-1"></div>
            <button class="ss-choose-btn" id="ss-choose-1">Play First</button>
          </div>
        </div>
        <div class="ss-hint">The other card goes to your hand and can be played later.</div>
      </div>
    `;

    // Inline styles: this modal is simple enough not to warrant its own
    // css file the way team-select.css exists — kept here so the module
    // stays fully self-contained (drop the <script> tag in, it works).
    if (!document.getElementById('ss-inline-style')) {
      const style = document.createElement('style');
      style.id = 'ss-inline-style';
      style.textContent = `
        #starter-select-mount { position: absolute; inset: 0; z-index: 26; pointer-events: none; }
        .ss-root {
          position: absolute; inset: 0; display: none; flex-direction: column;
          align-items: center; justify-content: center; gap: 18px;
          background: rgba(3,4,8,0.97); pointer-events: auto;
          padding: 20px;
        }
        .ss-root.show { display: flex; }
        .ss-header { text-align: center; flex: 0 0 auto; }
        .ss-header h1 {
          font-size: 20px; letter-spacing: 1.5px; color: #e8eefc; margin: 0 0 4px;
        }
        .ss-role { font-size: 13px; letter-spacing: 1px; text-transform: uppercase; color: #7fd8ff; }
        .ss-pair { display: flex; gap: 24px; flex: 1 1 auto; min-height: 0; max-height: 70vh; width: 100%; max-width: 900px; justify-content: center; }
        .ss-card {
          flex: 1 1 0; min-width: 0; max-width: 380px;
          display: flex; flex-direction: column; align-items: center;
          border: 2px solid rgba(255,255,255,0.12); border-radius: 14px;
          background: rgba(255,255,255,0.03); padding: 14px;
        }
        .ss-card-render { width: 100%; flex: 1 1 auto; min-height: 160px; }
        .ss-card-render canvas { display: block; width: 100% !important; height: 100% !important; }
        .ss-card-name { font-size: 16px; font-weight: 800; color: #e8eefc; margin-top: 6px; }
        .ss-card-abilities { width: 100%; margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
        .ss-ability-row { font-size: 11.5px; color: #b9c8e6; }
        .ss-ability-row b { color: #e8eefc; }
        .ss-choose-btn {
          margin-top: 12px; width: 100%;
          background: var(--accent, #7dffb0); color: #05121a; border: none; border-radius: 10px;
          padding: 10px 8px; font-size: 13px; font-weight: 800; cursor: pointer;
        }
        .ss-hint { font-size: 11.5px; color: #7f8ba8; flex: 0 0 auto; }
        @media (max-width: 700px) {
          .ss-pair { flex-direction: column; max-height: none; overflow-y: auto; }
          .ss-card-render { min-height: 140px; }
        }
      `;
      document.head.appendChild(style);
    }

    previews = {
      left: new MiniPreview(document.getElementById('ss-render-0')),
      right: new MiniPreview(document.getElementById('ss-render-1'))
    };

    mounted = true;
  }

  function renderCardSlot(idx, def) {
    const nameEl = document.getElementById(`ss-name-${idx}`);
    const abilitiesEl = document.getElementById(`ss-abilities-${idx}`);
    nameEl.textContent = def.displayName;
    abilitiesEl.innerHTML = (def.abilities || []).map(a =>
      `<div class="ss-ability-row"><b>${escapeHtml(a.name)}</b> — ${escapeHtml(a.desc || '')}</div>`
    ).join('');
    (idx === 0 ? previews.left : previews.right).show(def);
  }

  // Shows one role's pair and resolves with the chosen def id once the
  // player clicks a "Play First" button. `pair` is an array of 1 or 2
  // unit ids (1 if a role's deck only had one card drafted — still
  // handled gracefully, just auto-resolves without needing a click).
  function showRoleChoice(role, pair, allDefsById) {
    return new Promise(resolve => {
      ensureMounted();
      const root = document.getElementById('starter-select');
      document.getElementById('ss-role').textContent = `${roleLabel(role)} — pick who plays first`;

      if (pair.length === 1) {
        // Nothing to choose — resolve immediately without showing the
        // modal at all, since a decision between one option isn't real.
        resolve(pair[0]);
        return;
      }

      const defs = pair.map(id => allDefsById[id]);
      renderCardSlot(0, defs[0]);
      renderCardSlot(1, defs[1]);

      root.classList.add('show');
      requestAnimationFrame(() => { previews.left.resize(); previews.right.resize(); });

      const btn0 = document.getElementById('ss-choose-0');
      const btn1 = document.getElementById('ss-choose-1');
      // Fresh listeners each call — clone-and-replace to strip whatever
      // was bound on the previous role's pass through this same modal.
      const freshBtn0 = btn0.cloneNode(true);
      const freshBtn1 = btn1.cloneNode(true);
      btn0.replaceWith(freshBtn0);
      btn1.replaceWith(freshBtn1);

      freshBtn0.addEventListener('click', () => { root.classList.remove('show'); resolve(defs[0].id); });
      freshBtn1.addEventListener('click', () => { root.classList.remove('show'); resolve(defs[1].id); });
    });
  }

  // Player flow: sequential modal per role, in ROLE_ORDER. Returns a
  // Promise resolving to { field: {defender, attacker, support}, hand:
  // [{ defId, role }] } once all 3 choices are made.
  async function runForPlayer(deckByRole, allDefsById, roleOrder) {
    const field = {};
    const hand = [];
    for (const role of roleOrder) {
      const pair = deckByRole[role] || [];
      const chosenId = await showRoleChoice(role, pair, allDefsById);
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
    const root = document.getElementById('starter-select');
    if (root) root.classList.remove('show');
  }

  return { runForPlayer, pickForAI, close };
})();
