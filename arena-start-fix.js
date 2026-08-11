// Fix for the initial "ENTRAR NA ARENA" button.
// This deliberately uses the rendered initial-deploy screen instead of the
// deckbuilder's private closure state, so it remains reliable on mobile and
// after the UI has been redrawn.
(() => {
  const ROLES_FIX = ['defensor', 'atacante', 'suporte'];
  let starting = false;

  function selectedCard(player, role) {
    return document.querySelector(
      `[data-initial-player="${player}"][data-initial-role="${role}"].selected`
    )?.dataset.id || null;
  }

  function cardsForRole(role) {
    return Object.values(CARD_DB || {})
      .filter(c => c && !c.isToken && c.role === role)
      .map(c => c.id);
  }

  function makeBotDeck() {
    const result = { defensor: [], atacante: [], suporte: [] };
    for (const role of ROLES_FIX) {
      const pool = cardsForRole(role);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      result[role] = pool.slice(0, 2);
    }
    return result;
  }

  function startFromVisibleSelection(event) {
    const button = event.target.closest?.('#deployStartBtn');
    if (!button || starting) return;

    // We intentionally take over this click before the old closure handler.
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const p1Picks = { defensor: [], atacante: [], suporte: [] };
    const initialChoices = [
      { defensor: null, atacante: null, suporte: null },
      { defensor: null, atacante: null, suporte: null }
    ];

    for (const role of ROLES_FIX) {
      const selected = [...document.querySelectorAll(
        `[data-initial-player="0"][data-initial-role="${role}"]`
      )];
      p1Picks[role] = selected.map(el => el.dataset.id).filter(Boolean);
      initialChoices[0][role] = selected.find(el => el.classList.contains('selected'))?.dataset.id || null;
    }

    const valid = ROLES_FIX.every(role =>
      p1Picks[role].length === 2 && !!initialChoices[0][role]
    );
    if (!valid) return;

    const p2Picks = makeBotDeck();
    for (const role of ROLES_FIX) {
      initialChoices[1][role] = p2Picks[role][0];
    }

    starting = true;
    button.disabled = true;
    button.textContent = 'ENTRANDO...';

    try {
      if (typeof window.initGame !== 'function') {
        throw new Error('initGame não está disponível.');
      }
      window.initGame(p1Picks, p2Picks, true, initialChoices);
    } catch (error) {
      console.error('[Hero Vortex] Falha ao entrar na arena:', error);
      starting = false;
      button.disabled = false;
      button.textContent = 'ENTRAR NA ARENA';
      alert('Não foi possível iniciar a arena. Recarregue a página e tente novamente.');
    }
  }

  // Capture phase is important: the old inline/property handler is attached
  // directly to the button, so a normal bubbling listener can be too late.
  document.addEventListener('click', startFromVisibleSelection, true);
})();
