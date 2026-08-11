/* Deckbuilder interaction polish.
   Long-press a catalog card to perform the same action as a normal click.
   Uses delegated pointer events so it also works after the deckbuilder rerenders. */
(function(){
  const HOLD_MS = 280;
  let timer = null;
  let activeCard = null;
  let activePointerId = null;
  let holdTriggered = false;
  const suppressClick = new WeakSet();

  function getCard(target){
    const el = target && target.closest ? target.closest('.hv-deck-card') : null;
    return el && document.contains(el) ? el : null;
  }

  function clearHold(){
    if (timer){
      clearTimeout(timer);
      timer = null;
    }
    if (activeCard) activeCard.classList.remove('hv-long-pressing');
    activeCard = null;
    activePointerId = null;
    holdTriggered = false;
  }

  function activate(card){
    if (!card || card.disabled || card.classList.contains('is-disabled')) return;

    holdTriggered = true;
    card.classList.remove('hv-long-pressing');
    suppressClick.add(card);

    /* Dispatch a bubbling click event instead of HTMLElement.click().
       This reaches both direct card listeners and delegated listeners used by
       the deckbuilder's render code. */
    card.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      buttons: 0,
    }));

    /* If a browser/platform does not emit a follow-up click, don't leave the
       suppression flag around long enough to affect a later normal click. */
    window.setTimeout(() => suppressClick.delete(card), 500);
  }

  document.addEventListener('pointerdown', function(e){
    if (e.button !== undefined && e.button !== 0) return;
    const card = getCard(e.target);
    if (!card) return;

    clearHold();
    activeCard = card;
    activePointerId = e.pointerId;
    holdTriggered = false;
    card.classList.add('hv-long-pressing');

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

    /* Keep the suppression flag when the hold already activated the card.
       The next trusted click is the browser's follow-up click. */
    if (card && !didHold) suppressClick.delete(card);
  }, {passive:true});

  document.addEventListener('pointercancel', clearHold, {passive:true});
  document.addEventListener('pointerleave', function(e){
    if (activePointerId === null || e.pointerId === activePointerId) clearHold();
  }, {passive:true});

  /* A trusted click immediately following a long-press is the browser's
     follow-up click. Prevent it from toggling the card a second time. */
  document.addEventListener('click', function(e){
    const card = getCard(e.target);
    if (!card || !suppressClick.has(card)) return;
    suppressClick.delete(card);
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
})();
