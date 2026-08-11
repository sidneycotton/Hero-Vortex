/* Deckbuilder interaction polish.
   Mobile-first long press:
   - quick taps remain the existing click interaction;
   - the hold UI starts only after HOLD_VISUAL_MS;
   - after HOLD_MS the card's real .click() method runs;
   - the programmatic click is allowed through, while only the later browser-generated
     click is suppressed. This distinction is important on Android. */
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
  let suppressClickUntil = 0;
  let suppressCard = null;
  let programmaticClick = false;

  function getCard(target){
    const el = target && target.closest ? target.closest('.hv-deck-card') : null;
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
    if(!card || card.disabled || card.classList.contains('is-disabled')) return;
    reset();
    activeCard=card;
    startX=x;
    startY=y;
    holdTriggered=false;

    visualTimer=setTimeout(function(){
      if(activeCard===card && !holdTriggered) card.classList.add('hv-long-pressing');
      visualTimer=null;
    },HOLD_VISUAL_MS);

    timer=setTimeout(function(){
      if(activeCard!==card) return;
      timer=null;
      holdTriggered=true;
      card.classList.remove('hv-long-pressing');

      /* Run the exact native DOM click handler used by a normal tap.
         Do NOT set suppressClick before this call: element.click() dispatches
         synchronously, so doing that would suppress our own activation. */
      programmaticClick=true;
      try {
        card.click();
      } finally {
        programmaticClick=false;
      }

      /* Android may emit an additional trusted click after touchend. */
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
      /* Prevent the browser's compatibility click where supported. */
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
    /* Our element.click() call is the actual activation. Let it reach the
       deckbuilder's own click handler. */
    if(!e.isTrusted && programmaticClick) return;

    if(!suppressCard || Date.now()>suppressClickUntil){
      suppressCard=null;
      return;
    }

    const card=getCard(e.target);
    if(card===suppressCard){
      e.preventDefault();
      e.stopImmediatePropagation();
      suppressCard=null;
    }
  },true);
})();
