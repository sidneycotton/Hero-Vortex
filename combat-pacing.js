// Combat pacing + action-toast presentation.
// Loaded after app.js so the existing combat engine remains the source of truth.
(function () {
  const EXTRA_ACTION_DELAY = 750;
  let installed = false;

  function install() {
    if (installed || typeof window.autoResolveStep !== 'function') return;
    installed = true;

    const originalStep = window.autoResolveStep;
    window.autoResolveStep = function pacedAutoResolveStep() {
      // Give the player a clear beat between actions. The original engine still
      // controls ordering and effects; this only inserts breathing room.
      window.setTimeout(() => {
        if (window.state && state.phase === 'resolve') originalStep();
      }, EXTRA_ACTION_DELAY);
    };

    // If a later script redefines the function, don't repeatedly wrap it.
    window.__hvPacingInstalled = true;
  }

  install();
  window.addEventListener('load', install, { once: true });
})();
