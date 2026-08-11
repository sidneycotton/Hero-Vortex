/* Hero Vortex audio routing: switches the synthesized soundtrack with the active screen. */
(() => {
  let lastMode = null;
  function detectMode() {
    const root = document.getElementById('app');
    if (!root) return 'menu';
    return root.querySelector('.hv-battle-screen') ? 'arena' : 'menu';
  }
  function sync() {
    const mode = detectMode();
    if (mode === lastMode) return;
    lastMode = mode;
    if (window.HVAudio?.setMusicMode) window.HVAudio.setMusicMode(mode);
  }
  const start = () => {
    sync();
    const root = document.getElementById('app');
    if (root) new MutationObserver(sync).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
