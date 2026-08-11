/* Main menu entrypoint: make the game start action explicit and mobile-friendly. */
(() => {
  function upgradeHome() {
    const btn = document.getElementById('hvEnterBtn');
    if (!btn || document.querySelector('.hv-main-play')) return;
    btn.classList.add('hv-main-play');
    btn.innerHTML = '<span aria-hidden="true">▶</span> JOGAR';
    btn.setAttribute('aria-label', 'Jogar Hero Vortex');
    btn.setAttribute('title', 'Jogar Hero Vortex');
  }
  const style = document.createElement('style');
  style.textContent = `
    .hv-main-play{min-width:min(320px,82vw);min-height:58px;font-size:1.08rem;letter-spacing:.14em;display:inline-flex;align-items:center;justify-content:center;gap:.7rem;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
    .hv-main-play span{font-size:.85em;filter:drop-shadow(0 0 5px rgba(240,212,138,.35))}
    .hv-main-play:active{transform:translateY(1px) scale(.985)}
  `;
  document.head.appendChild(style);
  const observer = new MutationObserver(upgradeHome);
  observer.observe(document.body, { childList:true, subtree:true });
  upgradeHome();
})();
