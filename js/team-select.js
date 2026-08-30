// =============================================================
// ============ TEAM SELECT — standalone, scalable module ======
// =============================================================
// This is its own game piece: it owns its DOM (mounted into
// #team-select-mount), its own stylesheet (css/team-select.css), its own
// state, and its own Three.js renderer/scene/camera for the card preview
// (completely separate from the battle scene's renderer in index.html —
// they never touch each other). index.html only ever calls
// TeamSelect.open({ pool, roleOrder, onConfirm }) — it doesn't reach into
// this module's internals, and this module doesn't reach into index.html's
// globals except to call the two things it genuinely needs from the shared
// character-model system: `buildUnitModel(def)`. That's defined in
// index.html's inline script, which loads before this file, so it's safe
// to reference at call-time (this module never touches it at parse-time,
// only inside functions invoked later by `open()`).
//
// ---- Design: one card at a time, not a scrolling list ----
// Shows exactly ONE full character card at a time:
//   - Big 3D render of the character on the left (the same bespoke model
//     used in battle, idly animated).
//   - Full ability list on the right (name + desc for every ability).
//   - A summon showcase if any ability's effects include a `summon` verb
//     (mini preview of the summoned unit + its own quick stat line).
//   - Left/right screen-edge arrows cycle through the active role's pool.
//   - "Add to Deck" button confirms the current character for their role.
//   - A deck panel shows the 3 picks made so far, always visible.
// This scales to any roster size the same way a virtualized list does —
// only ONE character's model/DOM is ever built at a time, so cost per
// frame is flat regardless of whether a role's pool has 5 cards or 5,000.
// Search (by name AND ability text) narrows the pool the arrows cycle
// through; role tabs mean only one role's pool is ever relevant at once.

const TeamSelect = (() => {

  // ---- Pool building (moved here from index.html's old openTeamSelect) ----
  const SUMMON_ONLY_UNIT_IDS = new Set(["maquina_de_guerra"]);
  const ROLE_ORDER = ["defender", "attacker", "support"];

  function buildDraftPool(unitDefs) {
    const pool = { defender: [], attacker: [], support: [] };
    for (const def of Object.values(unitDefs)) {
      if (def.team !== "player") continue;
      if (SUMMON_ONLY_UNIT_IDS.has(def.id)) continue;
      if (pool[def.role]) pool[def.role].push(def);
    }
    return pool;
  }

  // Finds the def a `summon` verb points at, from anywhere in an ability's
  // effects (including nested blocks, e.g. inside `repeatIf` — walks
  // generically rather than assuming depth 1, so it stays correct if a
  // future card nests a summon deeper).
  function findSummonedDefId(ability, allDefsById) {
    function scan(effects) {
      if (!effects) return null;
      for (const step of effects) {
        if (step.verb === "summon" && step.defId) return step.defId;
        if (step.effects) {
          const nested = scan(step.effects);
          if (nested) return nested;
        }
      }
      return null;
    }
    const foundId = scan(ability.effects);
    return foundId && allDefsById[foundId] ? foundId : null;
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s == null ? '' : String(s);
    return div.innerHTML;
  }

  function roleLabel(role) {
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  // ---- Standalone 3D preview renderer ----
  // Fully separate THREE.Scene/Camera/WebGLRenderer from the battle scene.
  // Constructed lazily on first open() so index.html's THREE/
  // buildUnitModel globals are guaranteed to already exist by call-time.
  class CardPreview {
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
      // Aspect ratio changing (e.g. resizing the browser window on PC)
      // changes how much vertical/horizontal room is actually available,
      // so re-frame whatever's currently shown rather than leaving the
      // old framing to go stale.
      if (this.currentRoot) this._frameModel(this.currentRoot);
    }

    // Fits the camera to whatever model is currently in the scene,
    // regardless of that character's def.modelScale or how tall/wide its
    // particular pose is (e.g. Ajax's 1.4x scale, or Dário's Sombra form
    // reaching claws out further than his Senador form). Computes the
    // model's actual world-space bounding box with THREE.Box3, centers the
    // camera's look target on the box's middle, and backs the camera off
    // along its existing viewing direction until the box's full height
    // AND width both fit inside the current viewport's FOV — whichever of
    // the two needs more room wins. A margin factor keeps a comfortable
    // gutter instead of touching the frame's edge exactly. Re-run this any
    // time the shown model or its shape changes (show(), resize(),
    // toggleForm()) — never assume a fixed camera distance works for
    // every character.
    _frameModel(root) {
      // r128's Box3.setFromObject traverses every child regardless of
      // `.visible` — which would wrongly include Dário's currently-hidden
      // half (both Senador and Sombra bodies always exist in the
      // hierarchy; only one is shown at a time, see applyDarioFormVisibility
      // in models.js) and make the camera back off further than the
      // visible model actually needs. Build the box from only the meshes
      // that are actually visible (walking up the parent chain, since a
      // mesh can be visible=true while an ancestor group is hidden).
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

      const margin = 1.35; // >1 = extra breathing room around the model
      const vFov = (this.camera.fov * Math.PI) / 180;
      const distForHeight = (size.y / 2) / Math.tan(vFov / 2);
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
      const distForWidth = (size.x / 2) / Math.tan(hFov / 2);
      const dist = Math.max(distForHeight, distForWidth) * margin;

      // Keep the existing horizontal/vertical viewing ANGLE (the slight
      // elevated 3/4 look established in the constructor) — only rescale
      // how far back the camera sits along that same direction, and
      // re-center on the model's actual midpoint instead of a hardcoded
      // (0, 1, 0) that only happened to work for average-height models.
      const dir = this.camera.position.clone().sub(this._lookTarget || new THREE.Vector3(0, 1, 0)).normalize();
      this.camera.position.copy(center).addScaledVector(dir, dist);
      this.camera.lookAt(center);
      this._lookTarget = center;
    }

    // Shows `def`'s bespoke model centered. The summoned token's own model
    // is no longer shown here — it now lives in its own popup, opened by
    // clicking the summon badge (see openTokenPopup / closeTokenPopup).
    show(def) {
      if (this.currentRoot) { this.scene.remove(this.currentRoot); this.currentRoot = null; }

      // buildUnitModel returns { root, bodyGroup, torso, head, core, weapon }
      // — root is the single top-level Group to add/remove as a unit.
      const { root } = buildUnitModel(def);
      if (root) {
        root.position.set(0, 0, 0);
        this.scene.add(root);
        this.currentRoot = root;
        this._frameModel(root);
      }
      this.currentDef = def;

      this._startLoop();
    }

    // Plays a tapped ability's unique windup + impact flourish (the same
    // ones used in battle) against the currently-shown model. See
    // playAbilityShowcase in index.html's inline script.
    playAbility(ability) {
      if (!this.currentRoot || !this.currentDef) return;
      window.playAbilityShowcase(this.currentDef, ability, this.currentRoot, this.scene);
    }

    // Dário-only: flips which pre-built half (Senador/Sombra) is visible
    // on the currently-shown preview model. Reuses the exact same
    // applyDarioFormVisibility() helper the live battle uses when his
    // reactiveForm status actually flips (js/models.js), so the deck-
    // builder preview and in-battle swap are guaranteed to look identical
    // — no separate preview-only logic to keep in sync.
    toggleForm() {
      if (!this.currentRoot || !this.currentDef || this.currentDef.id !== 'dario') return;
      const bodyGroup = this.currentRoot.getObjectByName('body');
      if (!bodyGroup || !bodyGroup.userData || !bodyGroup.userData.darioForms) return;
      const forms = bodyGroup.userData.darioForms;
      const nextForm = forms.senador.group.visible ? 'sombra' : 'senador';
      applyDarioFormVisibility(bodyGroup, nextForm);
      this._frameModel(this.currentRoot);
    }

    _startLoop() {
      if (this._raf) return; // already looping
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

  // ---- Module state for the currently-open session ----
  let state = null; // { pool, roleOrder, allDefsById, onConfirm, picks, activeRole, search, filtered, index, preview, _lastShown, _summonDefId }
  let mounted = false;
  let tokenPreview = null; // CardPreview instance for the token popup, built lazily

  // ---- Token popup: shows a summon token's own model + full ability list ----
  function openTokenPopup(defId) {
    const sDef = state.allDefsById[defId];
    if (!sDef) return;

    document.getElementById('ts-token-popup-name').textContent = sDef.displayName;
    document.getElementById('ts-token-popup-meta').textContent =
      `${roleLabel(sDef.role)} \u00b7 HP ${sDef.stats.maxHP}`;

    const abilityListEl = document.getElementById('ts-token-popup-abilities');
    abilityListEl.innerHTML = '';
    // sDef.subAbilities are never listed here — they're a separate array
    // from sDef.abilities now, so no filter is needed to keep them out.
    (sDef.abilities || []).forEach(a => {
      const row = document.createElement('div');
      row.className = 'ts-ability-row';
      row.innerHTML = `
        <div class="ts-ability-name-row">
          <div class="ts-ability-name">${escapeHtml(a.name)}</div>
          <div class="ts-ability-speed" title="Turn-order speed for this ability">SPD ${escapeHtml(String(a.speed))}</div>
        </div>
        <div class="ts-ability-desc">${escapeHtml(a.desc || '')}</div>
      `;
      abilityListEl.appendChild(row);
    });

    const popup = document.getElementById('ts-token-popup');
    popup.classList.add('show');

    if (!tokenPreview) {
      tokenPreview = new CardPreview(document.getElementById('ts-token-popup-render'));
    }
    tokenPreview.resize();
    tokenPreview.show(sDef);
  }

  function closeTokenPopup() {
    const popup = document.getElementById('ts-token-popup');
    if (popup) popup.classList.remove('show');
    if (tokenPreview) tokenPreview.stopLoop();
  }

  function ensureMounted() {
    if (mounted) return;
    const mount = document.getElementById('team-select-mount');
    mount.innerHTML = `
      <div id="team-select" class="ts-root">
        <div class="ts-header">
          <h1>CHOOSE YOUR TEAM</h1>
          <div class="ts-tabs" id="ts-tabs"></div>
          <div class="ts-search-wrap">
            <input id="ts-search" class="ts-search" type="text" placeholder="Search name or ability text..." autocomplete="off" />
          </div>
        </div>

        <div class="ts-body">
          <div class="ts-stage">
            <button class="ts-arrow ts-arrow-left" id="ts-arrow-left" aria-label="Previous character">&#10094;</button>

            <div class="ts-card" id="ts-card">
              <div class="ts-model-panel" id="ts-model-panel">
                <div class="ts-card-render" id="ts-card-render"></div>
              </div>
              <div class="ts-ability-panel" id="ts-ability-panel">
                <div class="ts-card-name" id="ts-card-name"></div>
                <div class="ts-card-meta" id="ts-card-meta"></div>
                <div class="ts-ability-list" id="ts-ability-list"></div>
                <div class="ts-summon-note" id="ts-summon-note"></div>
                <button id="ts-add-btn" class="ts-add-btn">Add to Deck</button>
              </div>
            </div>

            <button class="ts-arrow ts-arrow-right" id="ts-arrow-right" aria-label="Next character">&#10095;</button>
            <div class="ts-empty" id="ts-empty">No characters match your search.</div>
            <div class="ts-position" id="ts-position"></div>
          </div>

          <div class="ts-deck" id="ts-deck">
            <div class="ts-deck-title">Your Deck</div>
            <div class="ts-deck-slots" id="ts-deck-slots"></div>
            <button id="team-select-confirm" class="ts-confirm">Start Battle</button>
          </div>
        </div>
      </div>

      <div class="ts-token-popup" id="ts-token-popup">
        <div class="ts-token-popup-card">
          <button class="ts-token-popup-close" id="ts-token-popup-close" aria-label="Close">&#10005;</button>
          <div class="ts-token-popup-render" id="ts-token-popup-render"></div>
          <div class="ts-token-popup-info">
            <div class="ts-card-name" id="ts-token-popup-name"></div>
            <div class="ts-card-meta" id="ts-token-popup-meta"></div>
            <div class="ts-ability-list" id="ts-token-popup-abilities"></div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('ts-summon-note').addEventListener('click', () => {
      if (state && state._summonDefId) openTokenPopup(state._summonDefId);
    });
    document.getElementById('ts-token-popup-close').addEventListener('click', closeTokenPopup);
    document.getElementById('ts-token-popup').addEventListener('click', (e) => {
      if (e.target.id === 'ts-token-popup') closeTokenPopup(); // click on backdrop
    });

    document.getElementById('ts-search').addEventListener('input', (e) => {
      state.search = e.target.value.trim().toLowerCase();
      recomputeFiltered();
      renderCard();
    });
    document.getElementById('ts-arrow-left').addEventListener('click', () => step(-1));
    document.getElementById('ts-arrow-right').addEventListener('click', () => step(1));
    document.getElementById('ts-add-btn').addEventListener('click', addCurrentToDeck);
    document.getElementById('team-select-confirm').addEventListener('click', () => {
      if (!state.roleOrder.every(role => (state.picks[role] || []).length === state.maxPicksPerRole)) return;
      // New payload shape: { defender: [id, id], attacker: [id, id],
      // support: [id, id] } instead of the old flat 3-id array — there
      // are 2 picks per role now, so a flat array can no longer represent
      // a full deck. NOTE: initGame()'s onConfirm consumer in index.html
      // still expects the OLD flat-array shape as of this change and
      // hasn't been updated yet (that's a separate, not-yet-built step —
      // see handoff.md's "choose your starter" modal plan) — starting an
      // actual battle from this screen will not work correctly until that
      // lands.
      const deck = {};
      state.roleOrder.forEach(role => { deck[role] = state.picks[role].slice(); });
      close();
      state.onConfirm(deck);
    });

    // Keyboard support (desktop testing / external keyboards on tablets)
    document.addEventListener('keydown', (e) => {
      const root = document.getElementById('team-select');
      if (!state || !root || !root.classList.contains('show')) return;
      const popup = document.getElementById('ts-token-popup');
      if (popup && popup.classList.contains('show')) {
        if (e.key === 'Escape') closeTokenPopup();
        return;
      }
      if (document.activeElement === document.getElementById('ts-search')) return; // don't hijack typing
      if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'Enter') addCurrentToDeck();
    });

    mounted = true;
  }

  function open({ pool, allDefs, roleOrder, onConfirm, maxPicksPerRole = 2 }) {
    ensureMounted();

    // allDefsById is used to resolve summon-token previews and deck-slot
    // lookups. It's seeded from the full roster (allDefs) when the caller
    // provides it, so units that are summon-only (e.g. Máquina de Guerra —
    // excluded from `pool` on purpose since they're not directly
    // draftable) can still be looked up for the summon showcase. Falls
    // back to deriving it from `pool` alone if the caller doesn't pass
    // allDefs, so this stays backward-compatible with any other caller.
    const allDefsById = {};
    if (allDefs) {
      Object.values(allDefs).forEach(def => { allDefsById[def.id] = def; });
    } else {
      Object.values(pool).forEach(list => list.forEach(def => { allDefsById[def.id] = def; }));
    }

    state = {
      pool,
      roleOrder,
      allDefsById,
      onConfirm,
      maxPicksPerRole,
      picks: {},
      activeRole: roleOrder[0],
      search: '',
      filtered: [],
      index: 0,
      preview: state && state.preview ? state.preview : null,
      _lastShown: null
    };

    if (!state.preview) {
      state.preview = new CardPreview(document.getElementById('ts-card-render'));
    }

    document.getElementById('ts-search').value = '';
    renderTabs();
    renderDeck();
    recomputeFiltered();
    renderCard();

    document.getElementById('team-select').classList.add('show');
    // Renderer was sized while hidden (display:none gives clientWidth 0) —
    // force one resize once the layout is actually visible.
    requestAnimationFrame(() => state.preview.resize());
  }

  function close() {
    document.getElementById('team-select').classList.remove('show');
    if (state && state.preview) state.preview.stopLoop();
    closeTokenPopup();
  }

  function recomputeFiltered() {
    const roleDefs = state.pool[state.activeRole] || [];
    const q = state.search;
    state.filtered = q
      ? roleDefs.filter(d => matchesSearch(d, q))
      : roleDefs.slice();
    // Keep pointing at the same character if it's still in the filtered
    // set (typing a search shouldn't jump away from what's on screen if it
    // still matches); otherwise snap to the first result.
    const currentDef = state._lastShown;
    const stillThereIdx = currentDef ? state.filtered.indexOf(currentDef) : -1;
    state.index = stillThereIdx !== -1 ? stillThereIdx : 0;
  }

  function matchesSearch(def, q) {
    if (def.displayName.toLowerCase().includes(q)) return true;
    return (def.abilities || []).some(a =>
      (a.name && a.name.toLowerCase().includes(q)) ||
      (a.desc && a.desc.toLowerCase().includes(q))
    );
  }

  function step(dir) {
    if (!state.filtered.length) return;
    state.index = (state.index + dir + state.filtered.length) % state.filtered.length;
    renderCard();
  }

  function addCurrentToDeck() {
    const def = state.filtered[state.index];
    if (!def) return;
    const picks = state.picks[state.activeRole] || (state.picks[state.activeRole] = []);
    const existingIdx = picks.indexOf(def.id);
    if (existingIdx !== -1) {
      // Already in the deck for this role — tapping again removes it,
      // freeing the slot back up.
      picks.splice(existingIdx, 1);
    } else if (picks.length < 2) {
      picks.push(def.id);
    }
    // If the role already has 2 picks and this card isn't one of them,
    // do nothing — renderCard()'s button state reflects the role being
    // full so this is just a no-op tap, not a silent swap.
    renderTabs();
    renderDeck();
    renderCard(); // refresh "in deck" state on the button
  }

  function renderTabs() {
    const tabsEl = document.getElementById('ts-tabs');
    tabsEl.innerHTML = '';
    state.roleOrder.forEach(role => {
      const tab = document.createElement('button');
      tab.className = 'ts-tab' + (role === state.activeRole ? ' active' : '');
      const rolePicks = state.picks[role] || [];
      const cap = state.maxPicksPerRole;
      tab.textContent = roleLabel(role) + (rolePicks.length === cap ? ' \u2713' : rolePicks.length >= 1 ? ` (${rolePicks.length}/${cap})` : '');
      tab.addEventListener('click', () => {
        state.activeRole = role;
        state.search = '';
        document.getElementById('ts-search').value = '';
        state._lastShown = null;
        renderTabs();
        recomputeFiltered();
        renderCard();
      });
      tabsEl.appendChild(tab);
    });
  }

  function renderDeck() {
    const slotsEl = document.getElementById('ts-deck-slots');
    slotsEl.innerHTML = '';
    state.roleOrder.forEach(role => {
      const group = document.createElement('div');
      group.className = 'ts-deck-role-group';
      const header = document.createElement('div');
      header.className = 'ts-deck-role-header';
      header.textContent = roleLabel(role);
      group.appendChild(header);

      const pair = document.createElement('div');
      pair.className = 'ts-deck-pair';
      const rolePicks = state.picks[role] || [];
      for (let i = 0; i < 2; i++) {
        const pickId = rolePicks[i];
        const def = pickId ? state.allDefsById[pickId] : null;
        const slot = document.createElement('div');
        slot.className = 'ts-deck-slot' + (def ? ' filled' : '');
        slot.innerHTML = `
          <div class="ts-deck-name">${def ? escapeHtml(def.displayName) : 'Empty'}</div>
          ${def ? `<div class="ts-deck-hp">HP ${def.stats.maxHP}</div>` : ''}
        `;
        if (def) {
          slot.classList.add('clickable');
          slot.addEventListener('click', () => {
            state.activeRole = role;
            state.search = '';
            document.getElementById('ts-search').value = '';
            state._lastShown = def;
            renderTabs();
            recomputeFiltered();
            renderCard();
          });
        }
        pair.appendChild(slot);
      }
      group.appendChild(pair);
      slotsEl.appendChild(group);
    });
    const ready = state.roleOrder.every(role => (state.picks[role] || []).length === state.maxPicksPerRole);
    document.getElementById('team-select-confirm').classList.toggle('ready', ready);
  }

  function renderCard() {
    const empty = document.getElementById('ts-empty');
    const card = document.getElementById('ts-card');
    const posEl = document.getElementById('ts-position');
    const leftArrow = document.getElementById('ts-arrow-left');
    const rightArrow = document.getElementById('ts-arrow-right');

    if (!state.filtered.length) {
      card.style.display = 'none';
      leftArrow.style.visibility = 'hidden';
      rightArrow.style.visibility = 'hidden';
      empty.style.display = 'flex';
      posEl.textContent = '';
      return;
    }

    empty.style.display = 'none';
    card.style.display = 'flex';
    leftArrow.style.visibility = state.filtered.length > 1 ? 'visible' : 'hidden';
    rightArrow.style.visibility = state.filtered.length > 1 ? 'visible' : 'hidden';

    const def = state.filtered[state.index];
    state._lastShown = def;

    posEl.textContent = `${state.index + 1} / ${state.filtered.length}`;

    document.getElementById('ts-card-name').textContent = def.displayName;
    document.getElementById('ts-card-meta').textContent =
      `${roleLabel(def.role)} \u00b7 HP ${def.stats.maxHP}`;

    const abilityListEl = document.getElementById('ts-ability-list');
    abilityListEl.innerHTML = '';
    let summonDefId = null;
    // def.subAbilities (e.g. Gavin's echo-only "Ataque e Cura (Eco)") are a
    // separate array from def.abilities and never reach this loop at all —
    // they're an internal implementation detail (only ever run via a
    // useAbilityOn step), not something the player picks.
    (def.abilities || []).forEach(a => {
      const row = document.createElement('div');
      const isPassive = !!a.passive;
      row.className = 'ts-ability-row ts-ability-row-playable' + (isPassive ? ' ts-ability-row-passive' : '');
      row.title = isPassive
        ? (def.id === 'dario' ? 'Tap to preview his other form' : 'Passive \u2014 always active')
        : 'Tap to preview this ability\u2019s animation';
      const speedBadge = isPassive
        ? `<div class="ts-ability-speed" title="Passive abilities have no speed and can't be selected">Passiva</div>`
        : `<div class="ts-ability-speed" title="Turn-order speed for this ability">SPD ${escapeHtml(String(a.speed))}</div>`;
      row.innerHTML = `
        <div class="ts-ability-name-row">
          <div class="ts-ability-name">${escapeHtml(a.name)}</div>
          ${speedBadge}
        </div>
        <div class="ts-ability-desc">${escapeHtml(a.desc || '')}</div>
      `;
      if (isPassive && def.id === 'dario') {
        // Dário-specific: tapping his passive row swaps the previewed
        // model between Senador and Sombra (see CardPreview.toggleForm).
        // Generic passives on other future characters just show the
        // "always active" tooltip above and don't play/toggle anything.
        row.addEventListener('click', () => state.preview.toggleForm());
      } else if (!isPassive) {
        row.addEventListener('click', () => state.preview.playAbility(a));
      }
      abilityListEl.appendChild(row);
      if (!summonDefId) {
        const found = findSummonedDefId(a, state.allDefsById);
        if (found) summonDefId = found;
      }
    });

    const summonNoteEl = document.getElementById('ts-summon-note');
    state._summonDefId = summonDefId;
    if (summonDefId) {
      const sDef = state.allDefsById[summonDefId];
      summonNoteEl.style.display = 'flex';
      summonNoteEl.innerHTML = `
        <div class="ts-summon-badge">\u2726 Summons a token</div>
        <div class="ts-summon-name">${escapeHtml(sDef.displayName)} \u00b7 HP ${sDef.stats.maxHP}</div>
      `;
    } else {
      summonNoteEl.style.display = 'none';
      summonNoteEl.innerHTML = '';
    }

    state.preview.show(def);

    const addBtn = document.getElementById('ts-add-btn');
    const rolePicks = state.picks[state.activeRole] || [];
    const isCurrentPick = rolePicks.includes(def.id);
    const cap = state.maxPicksPerRole;
    const roleFull = rolePicks.length >= cap;
    addBtn.textContent = isCurrentPick ? 'In Deck \u2713 (tap to remove)' : (roleFull ? `Role Full (${cap}/${cap})` : 'Add to Deck');
    addBtn.classList.toggle('active-pick', isCurrentPick);
    addBtn.classList.toggle('disabled-pick', !isCurrentPick && roleFull);
  }

  return { open, close, buildDraftPool, ROLE_ORDER, SUMMON_ONLY_UNIT_IDS };
})();
