/* Deckbuilder interaction polish.
   Long-press a catalog card to add/remove it without needing a precise release click.
   The normal single click remains unchanged. */
(function(){
  const HOLD_MS = 280;
  let holdTimer = null;
  let activeCard = null;
  let holdTriggered = false;
  let suppressTrustedClick = false;

  function clearHold(){
    if (holdTimer){ clearTimeout(holdTimer); holdTimer = null; }
    if (activeCard){ activeCard.classList.remove('hv-long-pressing'); }
    activeCard = null;
  }

  function triggerCard(card){
    if (!card || card.disabled || card.classList.contains('is-disabled')) return;
    holdTriggered = true;
    suppressTrustedClick = true;
    card.classList.remove('hv-long-pressing');
    card.click();
    window.setTimeout(()=>{ suppressTrustedClick = false; }, 120);
  }

  function attach(root){
    root.querySelectorAll('.hv-deck-card:not([data-hv-hold])').forEach(card=>{
      card.dataset.hvHold = '1';
      card.addEventListener('pointerdown', function(e){
        if (e.button !== undefined && e.button !== 0) return;
        clearHold();
        activeCard = card;
        holdTriggered = false;
        card.classList.add('hv-long-pressing');
        holdTimer = window.setTimeout(()=>triggerCard(card), HOLD_MS);
      });
      ['pointerup','pointercancel','pointerleave'].forEach(type=>card.addEventListener(type, clearHold));
      card.addEventListener('click', function(e){
        if (holdTriggered && suppressTrustedClick && e.isTrusted){
          e.preventDefault();
          e.stopImmediatePropagation();
          holdTriggered = false;
        }
      }, true);
    });
  }

  attach(document);
  new MutationObserver(()=>attach(document)).observe(document.getElementById('app') || document.body,{childList:true,subtree:true});
})();
