/* Deckbuilder long-press interaction — mobile first.
   IMPORTANT: the small catalog card is a focus/preview button, not the
   add/remove control. A hold therefore focuses the card first, waits for
   the deckbuilder to render its inspector, and then activates the actual
   "ESCOLHER CARTA" button. This uses the game's existing deck logic instead
   of trying to duplicate toggleDeckPick from outside its closure. */
(function(){
  const HOLD_MS = 420;
  const HOLD_VISUAL_MS = 150;
  const MOVE_CANCEL_PX = 12;

  let activeCard = null;
  let timer = null;
  let visualTimer = null;
  let startX = 0;
  let startY = 0;
  let holdTriggered = false;
  let suppressCard = null;
  let suppressClickUntil = 0;
  let internalAction = false;

  function getCard(target){
    const el = target && target.closest ? target.closest('[data-deck-card]') : null;
    return el && document.contains(el) ? el : null;
  }

  function clearTimers(){
    if(timer){clearTimeout(timer);timer=null;}
    if(visualTimer){clearTimeout(visualTimer);visualTimer=null;}
  }

  function reset(){
    clearTimers();
    if(activeCard) activeCard.classList.remove('hv-long-pressing');
    activeCard=null;
    holdTriggered=false;
  }

  function start(card,x,y){
    if(!card || card.disabled || card.hasAttribute('disabled')) return;
    reset();
    activeCard=card;
    startX=x;
    startY=y;

    visualTimer=setTimeout(function(){
      if(activeCard===card && !holdTriggered) card.classList.add('hv-long-pressing');
      visualTimer=null;
    },HOLD_VISUAL_MS);

    timer=setTimeout(function(){
      if(activeCard!==card) return;
      timer=null;
      holdTriggered=true;
      card.classList.remove('hv-long-pressing');

      const id=card.getAttribute('data-deck-card');
      if(!id) return;

      /* The micro card's normal click only focuses it. Focus first so the
         inspector is rendered with this exact card, then activate the real
         add/remove button from that freshly-rendered inspector. */
      internalAction=true;
      try {
        card.click();
        const selectButton=[...document.querySelectorAll('[data-select-card]')]
          .find(el=>el.getAttribute('data-select-card')===id);
        if(selectButton && !selectButton.disabled){
          selectButton.click();
        }
      } finally {
        internalAction=false;
      }

      /* Android may dispatch a compatibility click after touchend. Only
         suppress that old micro-card click; never suppress our inspector
         button click above. */
      suppressCard=card;
      suppressClickUntil=Date.now()+1200;
    },HOLD_MS);
  }

  function move(x,y){
    if(!activeCard) return;
    if(Math.abs(x-startX)>MOVE_CANCEL_PX || Math.abs(y-startY)>MOVE_CANCEL_PX) reset();
  }

  function finish(){
    const held=holdTriggered;
    reset();
    return held;
  }

  /* Native touch events are used intentionally for Android Chrome/WebView. */
  document.addEventListener('touchstart',function(e){
    if(e.touches.length!==1) return;
    const t=e.touches[0];
    const card=getCard(e.target);
    if(card) start(card,t.clientX,t.clientY);
  },{passive:true});

  document.addEventListener('touchmove',function(e){
    if(e.touches.length!==1) return;
    const t=e.touches[0];
    move(t.clientX,t.clientY);
  },{passive:true});

  document.addEventListener('touchend',function(e){
    const held=finish();
    if(held){
      e.preventDefault();
      e.stopPropagation();
    }
  },{passive:false});

  document.addEventListener('touchcancel',reset,{passive:true});

  /* Desktop fallback. */
  document.addEventListener('pointerdown',function(e){
    if(e.pointerType==='touch') return;
    if(e.button!==undefined && e.button!==0) return;
    const card=getCard(e.target);
    if(card) start(card,e.clientX,e.clientY);
  },{passive:true});

  document.addEventListener('pointermove',function(e){
    if(e.pointerType==='touch') return;
    move(e.clientX,e.clientY);
  },{passive:true});

  document.addEventListener('pointerup',function(e){
    if(e.pointerType==='touch') return;
    finish();
  },{passive:true});

  document.addEventListener('pointercancel',function(e){
    if(e.pointerType!=='touch') reset();
  },{passive:true});

  document.addEventListener('click',function(e){
    if(!suppressCard || Date.now()>suppressClickUntil){
      suppressCard=null;
      return;
    }
    const card=getCard(e.target);
    if(card===suppressCard && !internalAction){
      e.preventDefault();
      e.stopImmediatePropagation();
      suppressCard=null;
    }
  },true);
})();
