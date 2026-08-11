/* Deckbuilder interaction polish.
   Long-press a catalog card to perform the same action as a normal click.
   Uses delegated pointer events so it also works after the deckbuilder rerenders. */
(function(){
  const HOLD_MS = 280;
  let timer = null;
  let activeCard = null;
  let activePointerId = null;
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
  }

  function activate(card){
    if (!card || card.disabled || card.classList.contains('is-disabled')) return;

    card.classList.remove('hv-long-pressing');
    suppressClick.add(card);

    /* Dispatch a real bubbling click event instead of HTMLElement.click().
       This reaches both direct card listeners and delegated listeners used by
       the deckbuilder's render code. */
    card.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      buttons: 0,
    }));

    /* The browser may still emit the physical click after pointerup. */
    window.setTimeout(() => suppressClick.delete(card), 500);
  }

  document.addEventListener('pointerdown', function(e){
    if (e.button !== undefined && e.button !== 0) return;
    const card = getCard(e.target);
    if (!card) return;

    clearHold();
    activeCard = card;
    activePointerId = e.pointerId;
    card.classList.add('hv-long-pressing');

    timer = window.setTimeout(() => {
      if (activeCard === card) {
        activate(card);
        timer = null;
      }
    }, HOLD_MS);
  }, {passive:true});

  document.addEventListener('pointerup', function(e){
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    const card = activeCard;
    const wasHolding = !!timer;
    clearHold();

    /* If the hold already performed the action, consume the browser's normal
       click so the card is not added/removed twice. */
    if (card && !wasHolding && suppressClick.has(card)) {
      suppressClick.delete(card);
    }
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
