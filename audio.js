/* Hero Vortex synthesized audio: UI SFX + lightweight procedural menu music. */
(() => {
const css=`.hv-deck-card:active,.hv-target-option:active,.ability-btn:active{transform:translateY(1px) scale(.995)}.hv-battle-stage .hv-motion-card{animation:hvMotionEntry .18s cubic-bezier(.2,.8,.2,1)}@keyframes hvMotionEntry{from{opacity:.35;transform:scale(.94)}to{opacity:1;transform:scale(1)}}.hv-battle-stage .hv-hit-reaction{filter:brightness(1.18)}`;
const st=document.createElement('style');st.id='hv-audio-css';st.textContent=css;document.head.appendChild(st);
let ctx=null,master=null,enabled=true,musicEnabled=true,musicTimer=null,musicGain=null,lastMotionAt=0,lastImpactAt=0;
function ensure(){if(!enabled)return null;if(!ctx){const A=window.AudioContext||window.webkitAudioContext;if(!A)return null;ctx=new A();master=ctx.createGain();master.gain.value=.055;master.connect(ctx.destination)}if(ctx.state==='suspended')ctx.resume().catch(()=>{});return ctx}
function tone({freq=440,endFreq=freq,duration=.08,type='sine',volume=.4,delay=0,target=master}){const a=ensure();if(!a)return;const n=a.currentTime+delay,o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(freq,n);o.frequency.exponentialRampToValueAtTime(Math.max(35,endFreq),n+duration);g.gain.setValueAtTime(.0001,n);g.gain.exponentialRampToValueAtTime(Math.max(.0001,volume),n+.008);g.gain.exponentialRampToValueAtTime(.0001,n+duration);o.connect(g);g.connect(target||master);o.start(n);o.stop(n+duration+.015)}
function noise({duration=.12,volume=.35,filter=900,delay=0}){const a=ensure();if(!a)return;const n=a.currentTime+delay,b=a.createBuffer(1,a.sampleRate*duration,a.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);const s=a.createBufferSource(),f=a.createBiquadFilter(),g=a.createGain();f.type='lowpass';f.frequency.value=filter;g.gain.setValueAtTime(volume,n);g.gain.exponentialRampToValueAtTime(.0001,n+duration);s.buffer=b;s.connect(f);f.connect(g);g.connect(master);s.start(n)}
const sounds={
 tap:()=>tone({freq:520,endFreq:410,duration:.045,type:'sine',volume:.25}),
 select:()=>tone({freq:460,endFreq:700,duration:.09,type:'triangle',volume:.3}),
 attack:()=>{noise({duration:.09,volume:.28,filter:1200});tone({freq:170,endFreq:65,duration:.13,type:'sawtooth',volume:.3})},
 impact:()=>{noise({duration:.11,volume:.48,filter:700});tone({freq:95,endFreq:45,duration:.16,type:'square',volume:.2})},
 heal:()=>{tone({freq:420,endFreq:680,duration:.18,type:'sine',volume:.28});tone({freq:620,endFreq:900,duration:.2,type:'sine',volume:.18,delay:.07})},
 shield:()=>{tone({freq:260,endFreq:520,duration:.2,type:'triangle',volume:.25});tone({freq:780,endFreq:520,duration:.18,type:'sine',volume:.12,delay:.06})},
 status:()=>{tone({freq:300,endFreq:170,duration:.16,type:'triangle',volume:.18});tone({freq:560,endFreq:400,duration:.2,type:'sine',volume:.12,delay:.04})},
 buff:()=>{tone({freq:360,endFreq:760,duration:.22,type:'triangle',volume:.2});tone({freq:720,endFreq:980,duration:.18,type:'sine',volume:.1,delay:.08})},
 summon:()=>{tone({freq:180,endFreq:420,duration:.24,type:'sine',volume:.18});tone({freq:520,endFreq:760,duration:.18,type:'triangle',volume:.12,delay:.1})},
 field:()=>{tone({freq:120,endFreq:70,duration:.35,type:'sine',volume:.14});tone({freq:330,endFreq:180,duration:.28,type:'triangle',volume:.13,delay:.08})},
 taunt:()=>{tone({freq:140,endFreq:90,duration:.24,type:'sawtooth',volume:.18});noise({duration:.08,volume:.16,filter:500,delay:.03})},
 sacrifice:()=>tone({freq:240,endFreq:55,duration:.3,type:'sawtooth',volume:.2}),
 revive:()=>{tone({freq:190,endFreq:560,duration:.35,type:'sine',volume:.2});tone({freq:560,endFreq:820,duration:.2,type:'triangle',volume:.1,delay:.12})},
 defeat:()=>{tone({freq:190,endFreq:65,duration:.35,type:'sawtooth',volume:.28});noise({duration:.2,volume:.18,filter:500,delay:.04})},
 target:()=>tone({freq:720,endFreq:980,duration:.065,type:'triangle',volume:.2})
};
// Música ambiente curta e discreta, sintetizada no navegador — sem arquivo externo.
const melody=[261.63,329.63,392,329.63,293.66,349.23,440,349.23,261.63,329.63,392,523.25,392,329.63,293.66,261.63];
function startMusic(){const a=ensure();if(!a||!musicEnabled||musicTimer)return;if(!musicGain){musicGain=a.createGain();musicGain.gain.value=.035;musicGain.connect(a.destination)}let i=0;const tick=()=>{if(!musicEnabled||!ctx){musicTimer=null;return}tone({freq:melody[i%melody.length],endFreq:melody[i%melody.length]*1.002,duration:.48,type:'triangle',volume:.12,target:musicGain});if(i%4===0)tone({freq:melody[(i+2)%melody.length]/2,endFreq:melody[(i+2)%melody.length]/2,duration:.7,type:'sine',volume:.07,target:musicGain});i++;musicTimer=setTimeout(tick,620)};tick()}
function stopMusic(){if(musicTimer){clearTimeout(musicTimer);musicTimer=null}}
window.HVAudio={play:n=>sounds[n]?.(),toggle:v=>{enabled=v!==undefined?!!v:!enabled;return enabled},isEnabled:()=>enabled,toggleMusic:v=>{musicEnabled=v!==undefined?!!v:!musicEnabled;if(musicEnabled)startMusic();else stopMusic();return musicEnabled},isMusicEnabled:()=>musicEnabled,startMusic,stopMusic};
const gesture=()=>{ensure();startMusic()};['pointerdown','touchstart','keydown'].forEach(t=>document.addEventListener(t,gesture,{passive:true}));
document.addEventListener('click',e=>{if(e.target.closest('.hv-deck-card,.hv-target-option,.hv-initial-choice,.ability-btn,.class-choice,.deck-class-tab,button'))sounds.tap()},true);
const observer=new MutationObserver(ms=>{for(const m of ms){if(m.type==='childList')m.addedNodes.forEach(n=>{if(!(n instanceof Element))return;if(n.matches('.hv-motion-card')||n.querySelector('.hv-motion-card')){const now=performance.now();if(now-lastMotionAt>90){lastMotionAt=now;sounds.attack()}}});if(m.type==='attributes'){const e=m.target;if(!(e instanceof Element))continue;const c=e.classList;if(c.contains('hv-hit-reaction')){const now=performance.now();if(now-lastImpactAt>90){lastImpactAt=now;sounds.impact()}}if(c.contains('hv-target-marked'))sounds.target();if(c.contains('hv-defeated')||c.contains('hv-death-reaction'))sounds.defeat()}}});
observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
})();
