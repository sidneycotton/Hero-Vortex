// =============================================================
// ============ CAMPAIGN NODE UI HELPERS ==========================
// =============================================================
// Shared chrome for every "no fight, simple choice" campaign node type
// (Chest, Healing Station, Shop, Revival Station, Character Pick,
// Event — see CAMPAIGN_DESIGN.md §5.3's table). One generic modal
// mount + a minimal single-unit 3D preview (trimmed-down version of
// StarterSelect's MiniPreview — no multi-slot draft flow needed here),
// so each node resolver in js/campaign/nodes.js only has to supply its
// own content HTML and button wiring, not rebuild the modal shell each
// time.

const CampaignNodeUI = (() => {
  let root = null;

  function ensureRoot() {
    if (root) return root;
    root = document.getElementById('campaign-node-mount');
    return root;
  }

  // contentHtml: inner markup. onMount(container): called right after
  // it's in the DOM, for attaching listeners / starting previews.
  function showModal(titleText, contentHtml, onMount) {
    ensureRoot();
    root.innerHTML = `
      <div class="cnu-backdrop">
        <div class="cnu-modal">
          <div class="cnu-title">${titleText}</div>
          <div class="cnu-body">${contentHtml}</div>
        </div>
      </div>
    `;
    root.classList.add('show');
    if (onMount) onMount(root.querySelector('.cnu-modal'));
  }

  function hide() {
    if (root) { root.classList.remove('show'); root.innerHTML = ''; }
  }

  // ---- Minimal single-unit 3D preview (trimmed StarterSelect.MiniPreview) --
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
      if (root) { root.position.set(0, 0, 0); this.scene.add(root); this.currentRoot = root; }
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
      if (this._resizeObserver) this._resizeObserver.disconnect();
      this.renderer.dispose();
    }
  }

  return { showModal, hide, MiniPreview };
})();
