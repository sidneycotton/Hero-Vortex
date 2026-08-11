/* Hero Vortex audio layer — synthesized locally, no external audio files. */
(() => {
  let ctx = null;
  let master = null;
  let enabled = true;
  let lastMotionAt = 0;
  let lastImpactAt = 0;

  function ensureAudio() {
    if (!enabled) return null;
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = 0.055;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function tone({freq=440,endFreq=freq,duration=.08,type='sine',volume=.4,delay=0}) {
    const ac=ensureAudio(); if(!ac)return;
    const now=ac.currentTime+delay,osc=ac.createOscillator(),gain=ac.createGain();
    osc.type=type; osc.frequency.setValueAtTime(freq,now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(35,endFreq),now+duration);
    gain.gain.setValueAtTime(.0001,now); gain.gain.exponentialRampToValueAtTime(Math.max(.0001,volume),now+.008); gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    osc.connect(gain);gain.connect(master);osc.start(now);osc.stop(now+duration+.015);
  }
  function noise({duration=.12,volume=.35,filter=900,delay=0}) {
    const ac=ensureAudio(); if(!ac)return;
    const now=ac.currentTime+delay,buffer=ac.createBuffer(1,ac.sampleRate*duration,ac.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);
    const source=ac.createBufferSource(),f=ac.createBiquadFilter(),gain=ac.createGain();
    f.type='lowpass';f.frequency.value=filter;gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    source.buffer=buffer;source.connect(f);f.connect(gain);gain.connect(master);source.start(now);
  }

  const sounds={
    tap(){tone({freq:520,endFreq:410,duration:.045,type:'sine',volume:.25});},
    select(){tone({freq:460,endFreq:700,duration:.09,type:'triangle',volume:.3});},
    attack(){noise({duration:.09,volume:.28,filter:1200});tone({freq:170,endFreq:65,duration:.13,type:'sawtooth',volume:.3});},
    impact(){noise({duration:.11,volume:.48,filter:700});tone({freq:95,endFreq:45,duration:.16,type:'square',volume:.2});},
    heal(){tone({freq:420,endFreq:680,duration:.18,type:'sine',volume:.28});tone({freq:620,endFreq:900,duration:.2,type:'sine',volume:.18,delay:.07});},
    shield(){tone({freq:260,endFreq:520,duration:.2,type:'triangle',volume:.25});tone({freq:780,endFreq:520,duration:.18,type:'sine',volume:.12,delay:.06});},
    status(){tone({freq:300,endFreq:170,duration:.16,type:'triangle',volume:.18});tone({freq:560,endFreq:400,duration:.2,type:'sine',volume:.12,delay:.04});},
    buff(){tone({freq:360,endFreq:760,duration:.22,type:'triangle',volume:.2});tone({freq:720,endFreq:980,duration:.18,type:'sine',volume:.1,delay:.08});},
    summon(){tone({freq:180,endFreq:420,duration:.24,type:'sine',volume:.18});tone({freq:520,endFreq:760,duration:.18,type:'triangle',volume:.12,delay:.1});},
    field(){tone({freq:120,endFreq:70,duration:.35,type:'sine',volume:.14});tone({freq:330,endFreq:180,duration:.28,type:'triangle',volume:.13,delay:.08});},
    taunt(){tone({freq:140,endFreq:90,duration:.24,type:'sawtooth',volume:.18});noise({duration:.08,volume:.16,filter:500,delay:.03});},
    sacrifice(){tone({freq:240,endFreq:55,duration:.3,type:'sawtooth',volume:.2});},
    revive(){tone({freq:190,endFreq:560,duration:.35,type:'sine',volume:.2});tone({freq:560,endFreq:820,duration:.2,type:'triangle',volume:.1,delay:.12});},
    defeat(){tone({freq:190,endFreq:65,duration:.35,type:'sawtooth',volume:.28});noise({duration:.2,volume:.18,filter:500,delay:.04});},
    target(){tone({freq:720,endFreq:980,duration:.065,type:'triangle',volume:.2});}
  };

  window.HVAudio={play(name){if(sounds[name])sounds[name]();},toggle(value){enabled=value!==undefined?!!value:!enabled;return enabled;},isEnabled(){return enabled;}};
  function firstGesture(){ensureAudio();}
  ['pointerdown','touchstart','keydown'].forEach(type=>document.addEventListener(type,firstGesture,{passive:true,once:false}));
  document.addEventListener('click',e=>{const card=e.target.closest('.hv-deck-card,.hv-target-option,.hv-initial-choice,.ability-btn');if(card)sounds.tap();},true);

  const observer=new MutationObserver(mutations=>{
    for(const m of mutations){
      if(m.type==='childList')m.addedNodes.forEach(node=>{
        if(!(node instanceof Element))return;
        if(node.matches('.hv-motion-card')||node.querySelector('.hv-motion-card')){const now=performance.now();if(now-lastMotionAt>90){lastMotionAt=now;sounds.attack();}}
      });
      if(m.type==='attributes'&&m.attributeName==='class'){
        const el=m.target;if(!(el instanceof Element))continue;const cls=el.classList;
        if(cls.contains('hv-hit-reaction')){const now=performance.now();if(now-lastImpactAt>90){lastImpactAt=now;sounds.impact();}}
        if(cls.contains('hv-target-marked'))sounds.target();
        if(cls.contains('hv-defeated')||cls.contains('hv-death-reaction'))sounds.defeat();
      }
    }
  });
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
})();
