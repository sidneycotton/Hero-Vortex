/* Hero Vortex startup guard.
   The main app can boot before the enhancement modules finish loading.
   If that race leaves #app empty, retry after every script has loaded. */
(() => {
  function retryHome() {
    const app = document.getElementById('app');
    if (!app || app.children.length) return;
    if (typeof renderTeamSelect !== 'function') return;
    try {
      renderTeamSelect();
    } catch (err) {
      console.error('[Hero Vortex] startup retry failed:', err);
      // Keep a usable entry screen instead of leaving a completely blank page.
      app.innerHTML = `
        <div class="hv-home">
          <div class="hv-emblem">${typeof HV_EMBLEM_SVG !== 'undefined' ? HV_EMBLEM_SVG : ''}</div>
          <h1 class="game-title">HERO <span class="game-title-accent">VORTEX</span></h1>
          <p class="setup-sub">Monte seu deck, escolha seu trio e entre na arena.</p>
          <div class="hv-primary-cta">
            <button class="btn-primary hv-main-play" id="hvEmergencyPlay">▶ JOGAR</button>
          </div>
        </div>`;
      document.getElementById('hvEmergencyPlay')?.addEventListener('click', () => {
        try { renderTeamSelect(); } catch (e) { console.error(e); }
      });
    }
  }
  window.addEventListener('load', () => setTimeout(retryHome, 0), { once: true });
  setTimeout(retryHome, 300);
})();
