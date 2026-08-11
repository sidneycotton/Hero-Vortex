/* Deckbuilder interaction polish.
   A normal tap remains a normal click. A hold only becomes visually active
   after HOLD_VISUAL_MS, then toggles the card at HOLD_MS. Delegated pointer
   events make this survive deckbuilder rerenders and work on touch + mouse. */
(function(){
  const HOLD_MS = 420;
  const HOLD_VISUAL_MS = 150;
  let timer = null;
  let visualTimer = null;
  let activeCard = null;
  let activePointerId = null;
  let holdTriggered = false;
  const suppressClick = new WeakSet();

  function getCard(target){
    const el = target && target.closest ? target.closest('.hv-deck-card') : null;
    return el && document.contains(el) ? el : null;
  }

  function clearHold(){
    if (timer){ clearTimeout(timer); timer = null; }
    if (visualTimer){ clearTimeout(visualTimer); visualTimer = null; }
    if (activeCard) activeCard.classList.remove('hv-long-pressing');
    activeCard = null;
    activePointerId = null;
  }

  function activate(card){
    if (!card || card.disabled || card.classList.contains('is-disabled')) return;

    holdTriggered = true;
    card.classList.remove('hv-long-pressing');

    /* Let the existing deckbuilder click handler do the actual add/remove. */
    card.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      buttons: 0
    }));

    /* Suppress only a real follow-up browser click. */
    suppressClick.add(card);
    window.setTimeout(() => suppressClick.delete(card), 700);
  }

  document.addEventListener('pointerdown', function(e){
    if (e.button !== undefined && e.button !== 0) return;
    const card = getCard(e.target);
    if (!card) return;

    clearHold();
    activeCard = card;
    activePointerId = e.pointerId;
    holdTriggered = false;

    /* A quick tap has no hold animation. */
    visualTimer = window.setTimeout(() => {
      if (activeCard === card && !holdTriggered) {
        card.classList.add('hv-long-pressing');
      }
      visualTimer = null;
    }, HOLD_VISUAL_MS);

    timer = window.setTimeout(() => {
      if (activeCard === card) {
        timer = null;
        activate(card);
      }
    }, HOLD_MS);
  }, {passive:true});

  document.addEventListener('pointerup', function(e){
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    const card = activeCard;
    const didHold = holdTriggered;
    clearHold();
    if (card && !didHold) suppressClick.delete(card);
  }, {passive:true});

  document.addEventListener('pointercancel', clearHold, {passive:true});

  /* Synthetic click above has isTrusted === false and must pass through.
     Only suppress the platform's trusted follow-up click after a hold. */
  document.addEventListener('click', function(e){
    const card = getCard(e.target);
    if (!card || !suppressClick.has(card) || !e.isTrusted) return;
    suppressClick.delete(card);
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
})();
