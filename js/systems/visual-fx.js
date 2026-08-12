/* Hero Vortex — ambient visual polish: ember particles, button ripple,
   3D card tilt, and screen-transition cues. Purely presentational; never
   touches game state. */
(() => {

  /* ---------- floating ember field ---------- */
  function buildEmberField() {
    if (document.getElementById('hv-ember-field')) return;
    const field = document.createElement('div');
    field.id = 'hv-ember-field';
    field.setAttribute('aria-hidden', 'true');
    const count = window.innerWidth < 640 ? 10 : 20;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'hv-ember-particle';
      const size = 2 + Math.random() * 3;
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.left = Math.random() * 100 + 'vw';
      p.style.setProperty('--drift', (Math.random() * 80 - 40) + 'px');
      p.style.animationDuration = (14 + Math.random() * 16) + 's';
      p.style.animationDelay = (Math.random() * 20) + 's';
      field.appendChild(p);
    }
    document.body.appendChild(field);
  }

  /* ---------- ripple on interactive controls ---------- */
  function attachRipple(el, evt) {
    const rect = el.getBoundingClientRect();
    const ripple = document.createElement('span');
    const size = Math.max(rect.width, rect.height) * 1.2;
    ripple.className = 'hv-ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    const x = (evt.clientX ?? rect.left + rect.width / 2) - rect.left - size / 2;
    const y = (evt.clientY ?? rect.top + rect.height / 2) - rect.top - size / 2;
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    el.appendChild(ripple);
    setTimeout(() => ripple.remove(), 650);
  }
  document.addEventListener('click', e => {
    const el = e.target.closest('.btn-primary,.btn-secondary,.hv-select-detail,.hv-deck-card,.hv-role-tab,.hv-initial-card');
    if (!el || el.disabled) return;
    attachRipple(el, e);
  }, true);

  /* ---------- gentle 3D tilt on hoverable cards (desktop only) ---------- */
  const TILT_SELECTOR = '.hv-deck-card, .hv-battle-stage .unit-card, .hv-declare-card-wrap .unit-card';
  const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (isFinePointer && !reducedMotion) {
    document.addEventListener('pointermove', e => {
      const card = e.target.closest(TILT_SELECTOR);
      document.querySelectorAll(TILT_SELECTOR + '.hv-tilting').forEach(c => {
        if (c !== card) { c.style.transform = ''; c.classList.remove('hv-tilting'); }
      });
      if (!card) return;
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      card.classList.add('hv-tilting');
      card.style.transform = `perspective(900px) rotateX(${(-py * 6).toFixed(2)}deg) rotateY(${(px * 7).toFixed(2)}deg) translateY(-3px)`;
    }, { passive: true });
    document.addEventListener('pointerleave', e => {
      const card = e.target.closest && e.target.closest(TILT_SELECTOR);
      if (card) { card.style.transform = ''; card.classList.remove('hv-tilting'); }
    }, true);
  }

  /* ---------- home screen ambience taglines ---------- */
  function enhanceHome() {
    const home = document.querySelector('.hv-home');
    if (!home || home.querySelector('.hv-home-taglines')) return;
    const cta = home.querySelector('.hv-primary-cta');
    if (!cta) return;
    const bar = document.createElement('div');
    bar.className = 'hv-home-taglines';
    bar.innerHTML = `
      <span>${svg('sword')} Combate por turnos</span>
      <span>${svg('shield')} Estratégia de equipe</span>
      <span>${svg('spark')} Habilidades únicas</span>`;
    cta.insertAdjacentElement('afterend', bar);
  }
  function svg(name) {
    const icons = {
      sword: '<svg class="hv-svg-icon" viewBox="0 0 24 24"><path d="m5 19 6.5-6.5M8.5 20H5v-3.5M13 4l7 7M15.5 3.5l5 5-2 2-5-5 2-2Z"/></svg>',
      shield: '<svg class="hv-svg-icon" viewBox="0 0 24 24"><path d="M12 3 19 6v5c0 4.7-2.8 8-7 10-4.2-2-7-5.3-7-10V6l7-3Z"/></svg>',
      spark: '<svg class="hv-svg-icon" viewBox="0 0 24 24"><path d="m12 2 1.8 7.2L21 11l-7.2 1.8L12 20l-1.8-7.2L3 11l7.2-1.8L12 2Z"/></svg>'
    };
    return icons[name] || '';
  }

  /* ---------- page-enter transition whenever #app content is replaced ---------- */
  let transitionTimer = null;
  function pulseTransition() {
    const app = document.getElementById('app');
    if (!app) return;
    app.classList.remove('hv-page-enter');
    void app.offsetWidth; // restart animation
    app.classList.add('hv-page-enter');
    enhanceHome();
    clearTimeout(transitionTimer);
    transitionTimer = setTimeout(() => app.classList.remove('hv-page-enter'), 500);
  }

  function boot() {
    buildEmberField();
    const app = document.getElementById('app');
    if (!app) { setTimeout(boot, 60); return; }
    enhanceHome();
    let lastPhase = null;
    const obs = new MutationObserver(() => {
      const marker = app.firstElementChild ? app.firstElementChild.className : '';
      if (marker !== lastPhase) { lastPhase = marker; pulseTransition(); }
    });
    obs.observe(app, { childList: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
