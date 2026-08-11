/* Deckbuilder class navigation helpers.
   Keeps the existing deckbuilder renderer untouched while making the
   progress row and "COMPLETE ..." action useful navigation controls. */
(function () {
  const ROLE_ORDER = ['defensor', 'atacante', 'suporte'];

  function setupDeckNavigation() {
    const builder = document.querySelector('.hv-deckbuilder:not(.hv-initial-builder)');
    if (!builder) return;

    const progressItems = builder.querySelectorAll('.hv-deck-progress span');
    progressItems.forEach((item, index) => {
      if (item.dataset.deckNavBound === '1') return;
      item.dataset.deckNavBound = '1';
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.classList.add('hv-deck-progress-nav');

      const go = () => {
        const role = ROLE_ORDER[index];
        const tab = builder.querySelector(`[data-role-tab="${role}"]`);
        if (!tab || tab.disabled) return;
        tab.click();
      };

      item.addEventListener('click', go);
      item.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          go();
        }
      });
    });

    const next = builder.querySelector('#hvDeckNext');
    if (!next || next.dataset.deckNavBound === '1') return;
    next.dataset.deckNavBound = '1';

    // The existing renderer disables this button while the deck is incomplete.
    // Turn it into a navigation action instead: clicking "COMPLETE ATACANTE"
    // takes the player directly to that class. Once all six cards are selected,
    // the original "ESCOLHER TIME INICIAL" action remains untouched.
    const roleToComplete = ROLE_ORDER.find(role => {
      const item = builder.querySelector(`.hv-deck-progress span:nth-child(${ROLE_ORDER.indexOf(role) + 1})`);
      const count = item?.querySelector('b')?.textContent?.match(/\d+/)?.[0];
      return Number(count || 0) < 2;
    });

    if (!roleToComplete) return;

    next.disabled = false;
    next.removeAttribute('aria-disabled');
    next.classList.add('hv-deck-next-nav');
    next.onclick = event => {
      event.preventDefault();
      const tab = builder.querySelector(`[data-role-tab="${roleToComplete}"]`);
      if (tab && !tab.disabled) tab.click();
    };
  }

  const observer = new MutationObserver(setupDeckNavigation);
  observer.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
  setupDeckNavigation();
})();
