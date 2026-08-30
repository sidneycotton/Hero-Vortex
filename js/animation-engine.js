// =============================================================
// ============ SECTION 3: ANIMATION PRIMITIVES =================
// =============================================================
// Generalized from the Babawibby Turret MVP's timeline/easing/
// particle system. These primitives know nothing about "damage"
// or "healing" — only about moving/scaling/spawning things.

const Easing = {
  linear: t => t,
  quadOut: t => 1 - (1 - t) * (1 - t),
  quadIn: t => t * t,
  cubicOut: t => 1 - Math.pow(1 - t, 3),
  cubicIn: t => t * t * t,
  backOut: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  elasticOut: t => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  sineInOut: t => -(Math.cos(Math.PI * t) - 1) / 2
};

// A single running "clip": duration, update(progress), optional onComplete.
class Clip {
  constructor(duration, update, onComplete) {
    this.duration = Math.max(duration, 0.0001);
    this.update = update;
    this.onComplete = onComplete;
    this.elapsed = 0;
    this.done = false;
  }
  tick(dt) {
    if (this.done) return;
    this.elapsed += dt;
    const t = Math.min(this.elapsed / this.duration, 1);
    this.update(t);
    if (t >= 1) {
      this.done = true;
      if (this.onComplete) this.onComplete();
    }
  }
}

// The AnimationRunner plays a queue of steps. Each step is either:
//  - a Clip-producing function -> runs and waits for completion (sequence)
//  - an array of step-defs -> runs all in parallel, waits for all (parallel)
//  - a plain function -> runs synchronously (instant callback / event marker)
//  - {wait: seconds} -> pause
// This mirrors the Babawibby MVP's "timeline -> event -> effect -> next event" chain.
class AnimationRunner {
  constructor() {
    this.activeClips = [];
  }

  tick(dt) {
    for (let i = this.activeClips.length - 1; i >= 0; i--) {
      this.activeClips[i].tick(dt);
      if (this.activeClips[i].done) this.activeClips.splice(i, 1);
    }
  }

  // Runs a list of step definitions in strict sequence, returns a Promise.
  async playSequence(steps) {
    for (const step of steps) {
      await this._runStep(step);
    }
  }

  async _runStep(step) {
    if (!step) return;
    if (typeof step === 'function') {
      // Instant callback / event marker (e.g. "GAMEPLAY DAMAGE EVENT")
      return step();
    }
    if (step.wait !== undefined) {
      return this._runClip(new Clip(step.wait, () => {}));
    }
    if (Array.isArray(step)) {
      // Parallel group
      return Promise.all(step.map(s => this._runStep(s)));
    }
    if (step.clip) {
      return this._runClip(step.clip);
    }
  }

  _runClip(clip) {
    return new Promise(resolve => {
      const originalOnComplete = clip.onComplete;
      clip.onComplete = () => { if (originalOnComplete) originalOnComplete(); resolve(); };
      this.activeClips.push(clip);
    });
  }
}

const animRunner = new AnimationRunner();

// --- Reusable primitive builders -------------------------------
// Each returns a "step" consumable by playSequence.

function moveTo(obj3d, toVec3, duration, easeFn = Easing.cubicOut) {
  return {
    clip: new Clip(duration, t => {
      const e = easeFn(t);
      obj3d.position.lerpVectors(obj3d.userData._moveFrom, toVec3, e);
    }, () => {})
  };
  // Note: caller must set obj3d.userData._moveFrom = obj3d.position.clone() before invoking.
}

function makeMove(obj3d, toVec3, duration, easeFn = Easing.cubicOut) {
  return () => {
    obj3d.userData._moveFrom = obj3d.position.clone();
    return moveTo(obj3d, toVec3, duration, easeFn);
  };
}

// Simpler helper: directly build a move step capturing "from" at call time.
function moveStep(obj3d, toVec3, duration, easeFn = Easing.cubicOut) {
  return {
    clip: (() => {
      const from = obj3d.position.clone();
      return new Clip(duration, t => {
        const e = easeFn(t);
        obj3d.position.lerpVectors(from, toVec3, e);
      });
    })()
  };
}

function scaleStep(obj3d, toScale, duration, easeFn = Easing.quadOut) {
  return {
    clip: (() => {
      const from = obj3d.scale.clone();
      const to = new THREE.Vector3(toScale, toScale, toScale);
      return new Clip(duration, t => {
        const e = easeFn(t);
        obj3d.scale.lerpVectors(from, to, e);
      });
    })()
  };
}

function squashStretchStep(obj3d, sx, sy, sz, duration, easeFn = Easing.backOut) {
  return {
    clip: (() => {
      const from = obj3d.scale.clone();
      const to = new THREE.Vector3(sx, sy, sz);
      return new Clip(duration, t => {
        const e = easeFn(t);
        obj3d.scale.lerpVectors(from, to, e);
      });
    })()
  };
}

function rotateStep(obj3d, toY, duration, easeFn = Easing.quadOut) {
  return {
    clip: (() => {
      const from = obj3d.rotation.y;
      return new Clip(duration, t => {
        const e = easeFn(t);
        obj3d.rotation.y = from + (toY - from) * e;
      });
    })()
  };
}

function waitStep(seconds) {
  return { wait: seconds };
}

function callbackStep(fn) {
  return fn;
}

// ---- Toon shading helper (from babawibby_zoom_v3.html reference) -----
// A 3-stop gradient map read by MeshToonMaterial to band the lighting into
// flat shade/mid/highlight steps instead of Standard's smooth PBR falloff.
// One shared gradient texture for every character (cheap, consistent look).
// Declared here (before MoveLibrary) since MoveLibrary's impact-plugin
// moves (boxingGlove/biteJaw) build MeshToonMaterial instances that need it.
function makeToonGradient(stops) {
  const canvas = document.createElement('canvas');
  canvas.width = stops.length; canvas.height = 1;
  const ctx = canvas.getContext('2d');
  stops.forEach((v, i) => { ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(i, 0, 1, 1); });
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.NearestFilter; tex.magFilter = THREE.NearestFilter;
  return tex;
}
const TOON_GRADIENT = makeToonGradient([70, 170, 255]);

// =============================================================
// ============ MOVE LIBRARY (generic, reusable per-move flourishes) ====
// =============================================================
// Layer above the raw step builders above. Every function here is a
// generic, parametrized animation move with NO character-specific logic —
// character personality comes from which moves a CHARACTER_ANIM_PROFILE
// picks and what parameters it passes, not from anything hardcoded here.
// Each function returns a "step" (or array of steps) consumable by
// animRunner.playSequence, same contract as moveStep/scaleStep/etc.

const MoveLibrary = {
  // Pop an object from scale 0 to a target scale with a springy overshoot.
  // Good for spawn-ins / sudden appearances (e.g. Babawibby popping into frame).
  popIn(obj3d, { scale = 1, duration = 0.32, easing = Easing.backOut } = {}) {
    return {
      clip: (() => {
        obj3d.scale.set(0, 0, 0);
        const to = new THREE.Vector3(scale, scale, scale);
        return new Clip(duration, t => {
          const e = easing(t);
          obj3d.scale.set(to.x * e, to.y * e, to.z * e);
        });
      })()
    };
  },

  // Cartoon squash & stretch toward (sx,sy,sz) and back to (1,1,1).
  // intensity scales how far from 1 the squash/stretch axes are pushed.
  squashStretch(obj3d, { intensity = 1, duration = 0.22, axis = 'y', easingOut = Easing.quadOut, easingBack = Easing.backOut } = {}) {
    const stretch = 1 + 0.22 * intensity;
    const squash = 1 - 0.22 * intensity;
    const sx = axis === 'x' ? stretch : squash;
    const sy = axis === 'y' ? stretch : squash;
    const sz = axis === 'z' ? stretch : squash;
    return [
      squashStretchStep(obj3d, sx, sy, sz, duration * 0.4, easingOut),
      squashStretchStep(obj3d, 1, 1, 1, duration * 0.6, easingBack)
    ];
  },

  // A quick vertical hop in place — pop up then land, with squash on landing.
  bounceHop(obj3d, { height = 0.25, duration = 0.3, squashOnLand = true } = {}) {
    const homeY = obj3d.position.y;
    const steps = [
      {
        clip: (() => {
          const fromY = obj3d.position.y;
          return new Clip(duration * 0.45, t => {
            obj3d.position.y = fromY + Math.sin(Easing.quadOut(t) * Math.PI * 0.5) * height;
          });
        })()
      },
      {
        clip: (() => {
          const fromY = obj3d.position.y;
          return new Clip(duration * 0.55, t => {
            const e = Easing.cubicIn(t);
            obj3d.position.y = fromY + (homeY - fromY) * e;
          }, () => { obj3d.position.y = homeY; });
        })()
      }
    ];
    if (squashOnLand) steps.push(squashStretchStep(obj3d, 1.15, 0.82, 1.15, 0.1, Easing.quadOut), squashStretchStep(obj3d, 1, 1, 1, 0.16, Easing.backOut));
    return steps;
  },

  // Oscillating tilt/rocking on one axis — good for a mischievous idle
  // flourish or a "settling" wobble after landing.
  wobble(obj3d, { axis = 'z', amount = 0.12, speed = 8, cycles = 2, duration = 0.5 } = {}) {
    return {
      clip: (() => {
        const from = obj3d.rotation[axis];
        return new Clip(duration, t => {
          const decay = 1 - t;
          obj3d.rotation[axis] = from + Math.sin(t * speed * cycles) * amount * decay;
        }, () => { obj3d.rotation[axis] = from; });
      })()
    };
  },

  // Fading/pulsing ground-contact shadow blob under a landing/spawning unit.
  // Expects a mesh (e.g. unit.groundShadow) with a material that has .opacity.
  groundShadowPulse(shadowMesh, { peakOpacity = 0.5, duration = 0.3 } = {}) {
    if (!shadowMesh) return callbackStep(() => {});
    return {
      clip: (() => {
        shadowMesh.material.transparent = true;
        return new Clip(duration, t => {
          const e = Math.sin(Math.min(1, t) * Math.PI);
          shadowMesh.material.opacity = peakOpacity * e;
        });
      })()
    };
  },

  // ---- Impact-moment "plug-in" visuals — fire at the frame gameplay lands ----
  // Reusable across any character/ability whose flavor matches; not tied to
  // whoever first needed them (Ajax uses both, but neither is Ajax-specific).

  // Generic fighting-type impact: a boxing-glove shape appears at the hit
  // point and the hit lands on the same beat.
  boxingGlove(hitPoint, { color = 0xdd3333, size = 0.32 } = {}) {
    return callbackStep(() => {
      const glove = new THREE.Group();
      const fist = new THREE.Mesh(new THREE.SphereGeometry(size * 0.5, 10, 8), new THREE.MeshToonMaterial({ color, gradientMap: TOON_GRADIENT }));
      fist.scale.set(1, 0.85, 1);
      glove.add(fist);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.28, size * 0.32, size * 0.35, 8), new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: TOON_GRADIENT }));
      cuff.position.y = -size * 0.4;
      glove.add(cuff);
      glove.position.copy(hitPoint);
      glove.scale.set(0.3, 0.3, 0.3);
      scene.add(glove);
      const start = performance.now();
      const anim = new Clip(1.0, t => {
        const e = Easing.backOut(Math.min(1, t / 0.5));
        const s = Math.min(1, t / 0.5) < 1 ? e : (1 - Easing.quadIn((t - 0.5) / 0.5));
        glove.scale.set(s, s, s);
      }, () => { scene.remove(glove); glove.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); });
      animRunner.activeClips.push(anim);
    });
  },

  // Generic monster-bite impact: two jaw shapes spawn over the target, snap
  // shut on the impact frame, then despawn.
  biteJaw(hitPoint, { color = 0xffffff, size = 0.3 } = {}) {
    return callbackStep(() => {
      const jawMat = new THREE.MeshToonMaterial({ color, gradientMap: TOON_GRADIENT });
      const upper = new THREE.Mesh(new THREE.ConeGeometry(size * 0.55, size * 0.5, 6), jawMat);
      const lower = new THREE.Mesh(new THREE.ConeGeometry(size * 0.55, size * 0.5, 6), jawMat.clone());
      upper.position.copy(hitPoint).add(new THREE.Vector3(0, size * 0.35, 0));
      lower.position.copy(hitPoint).add(new THREE.Vector3(0, -size * 0.35, 0));
      upper.rotation.x = Math.PI;
      scene.add(upper); scene.add(lower);
      const clip = new Clip(1.0, t => {
        const close = Easing.cubicIn(Math.min(1, t / 0.6));
        const openAmt = (1 - close) * size * 0.4;
        upper.position.y = hitPoint.y + size * 0.35 + openAmt - close * size * 0.1;
        lower.position.y = hitPoint.y - size * 0.35 - openAmt + close * size * 0.1;
        if (t > 0.6) {
          const fade = 1 - (t - 0.6) / 0.4;
          upper.scale.set(fade, fade, fade);
          lower.scale.set(fade, fade, fade);
        }
      }, () => {
        scene.remove(upper); scene.remove(lower);
        upper.geometry.dispose(); lower.geometry.dispose(); jawMat.dispose();
      });
      animRunner.activeClips.push(clip);
    });
  }
};

// =============================================================
// ============ CHARACTER ANIMATION PROFILES ====================
// =============================================================
// Per-character table of which MoveLibrary flourishes to layer at which
// choreography moment, with per-character parameters. A character with no
// entry here (or no entry for a given moment) just gets the existing
// generic behavior untouched — this is additive, not a replacement path.
//
// Moments used below:
//   spawn        — one-shot, called when a unit's model first appears
//   attackImpact(abilityId) — plug-in visual fired at the impact frame of
//                  runAttackAnimation, keyed by ability id so different
//                  skills on the same character can pick different moves
//   windup       — extra flourish layered onto the existing wind-up step
//   idle         — extra per-frame flourish layered onto updateIdle

const CHARACTER_ANIM_PROFILES = {
  // Comedic tone: bouncy, springy, "cute" easing throughout.
  babawibby: {
    spawn(unit) {
      return [
        MoveLibrary.popIn(unit.body, { scale: 1, duration: 0.36, easing: Easing.backOut }),
        ...MoveLibrary.bounceHop(unit.body, { height: 0.18, duration: 0.26 })
      ];
    },
    windup(unit) {
      return MoveLibrary.wobble(unit.body, { axis: 'z', amount: 0.1, speed: 10, duration: 0.3 });
    },
    idleExtra(unit, t) {
      // slightly more pronounced bob/sway than the generic idle, comedic wobble
      unit.body.rotation.z = Math.sin(t * 1.7) * 0.05;
    }
  },

  // Support tone: light, graceful windup — Mariana channels light rather
  // than swinging with force, so keep the procedural motion subtle.
  mariana: {
    windup(unit) {
      return MoveLibrary.squashStretch(unit.body, { intensity: 1.15, duration: 0.26, axis: 'y', easingOut: Easing.quadOut, easingBack: Easing.backOut });
    }
  },

  // Attacker tone: quick, sharp windup matching Yvrel's fast/precise kit.
  yvrel: {
    windup(unit) {
      return MoveLibrary.squashStretch(unit.body, { intensity: 1.25, duration: 0.18, axis: 'y', easingOut: Easing.cubicOut, easingBack: Easing.cubicOut });
    }
  },

  // Strong/impetuous tone: heavier squash/stretch, sharper cubicOut easing,
  // forceful wind-up/lunge, deliberately less bouncy/cute than Babawibby.
  ajax: {
    windup(unit) {
      return MoveLibrary.squashStretch(unit.body, { intensity: 1.4, duration: 0.24, axis: 'y', easingOut: Easing.cubicOut, easingBack: Easing.cubicOut });
    },
    // Keyed by ability id — see handoff.md's confirmed per-ability mapping.
    attackImpact(unit, target, abilityId) {
      if (abilityId === 'duel') {
        // skill1 "Duelo" — generic fighting-type impact
        return MoveLibrary.boxingGlove(target.hitPoint, { color: 0x3a5a7a, size: 0.34 });
      }
      if (abilityId === 'bleedstrike') {
        // skill2 "Golpe Sangrento" — generic monster-bite impact, jaw shapes
        // are separate meshes positioned at the target, not Ajax's own head
        return MoveLibrary.biteJaw(target.hitPoint, { color: 0xeaeaea, size: 0.3 });
      }
      return null; // chainstrike/skill3 keeps the existing dash-based visual as-is
    }
  }
};


// =============================================================
// ============ ABILITY SHOWCASE (deck-select preview) ===========
// =============================================================
// Plays a character's per-ability windup + attack-impact flourish against
// its own model on the team-select 3D preview, where there's no real
// opponent to target. Reuses the exact same CHARACTER_ANIM_PROFILES /
// MoveLibrary pieces the battle scene uses, just aimed at a point in front
// of the model instead of a target unit's hitPoint. Exposed on `window` so
// js/team-select.js (loaded after this script) can call it.
//
// `scene` above is `let` specifically so this can redirect MoveLibrary's
// spawn calls into the preview's own separate THREE.Scene for the
// duration of the animation, then restore the battle scene.
let previewShowcaseRunning = false;
async function playAbilityShowcase(def, ability, previewRoot, previewScene) {
  if (previewShowcaseRunning) return; // ignore re-taps mid-animation
  const bodyGroup = previewRoot.getObjectByName("body");
  if (!bodyGroup) return;

  previewShowcaseRunning = true;
  const originalScene = scene;
  scene = previewScene; // MoveLibrary/spawnBurst/spawnImpactRing all read the module-level `scene`

  // Chest-height point directly on the model itself — matches the real
  // battle's `target.hitPoint` formula (model.position + (0,1,0)) exactly,
  // so impact plug-ins (boxing glove, bite jaw, ...) land squarely on the
  // character and read clearly against its own model, the same way they'd
  // read landing on a real opponent in battle.
  const hitPoint = previewRoot.position.clone().add(new THREE.Vector3(0, 1, 0));
  const pseudoActor = { model: previewRoot, body: bodyGroup, defId: def.id };
  const pseudoTarget = { model: previewRoot, body: bodyGroup, hitPoint };

  const profile = CHARACTER_ANIM_PROFILES[def.id];
  const heavy = ability.animKey === "skill3";
  const windupScale = heavy ? 1.22 : 1.1;
  const color = heavy ? 0xff5a5a : (ability.animKey === "skill1" ? 0xffffff : 0xffdca8);

  try {
    await animRunner.playSequence([
      squashStretchStep(bodyGroup, windupScale, 0.9, windupScale, heavy ? 0.22 : 0.14, Easing.quadOut),
      ...(profile && profile.windup ? [profile.windup(pseudoActor)] : []),
      [
        squashStretchStep(bodyGroup, 0.85, 1.15, 0.85, 0.09, Easing.quadOut)
      ],
      callbackStep(() => {
        spawnImpactRing(hitPoint, color, heavy ? 1.3 : 0.9);
        spawnBurst({ position: hitPoint, color, count: heavy ? 16 : 10, speed: heavy ? 3.2 : 2.4 });
      }),
      ...(() => {
        if (!profile || !profile.attackImpact) return [];
        const step = profile.attackImpact(pseudoActor, pseudoTarget, ability.id);
        return step ? [step] : [];
      })(),
      squashStretchStep(bodyGroup, 1, 1, 1, 0.18, Easing.backOut)
    ]);
  } finally {
    scene = originalScene;
    previewShowcaseRunning = false;
  }
}
window.playAbilityShowcase = playAbilityShowcase;

let shakeState = { time: 0, duration: 0, magnitude: 0 };
function triggerCameraShake(magnitude = 0.18, duration = 0.25) {
  if (isMobile) magnitude *= 0.7; // gentler on mobile
  shakeState = { time: 0, duration, magnitude };
}
function updateCameraShake(dt) {
  if (shakeState.time < shakeState.duration) {
    shakeState.time += dt;
    const decay = 1 - (shakeState.time / shakeState.duration);
    const mag = shakeState.magnitude * decay;
    camera.position.x = camera.baseX + (Math.random() - 0.5) * mag;
    camera.position.y = camera.baseY + (Math.random() - 0.5) * mag;
  } else if (camera.baseX !== undefined) {
    camera.position.x = camera.baseX;
    camera.position.y = camera.baseY;
  }
}
camera.baseX = camera.position.x;
camera.baseY = camera.position.y;

// =============================================================
// ============ IDLE CAMERA ORBIT (planning phase "show off") ===
// =============================================================
// While waiting on the player's input (planning phase), slowly orbit
// the camera around the battlefield, Pokemon-battle-style, so the new
// per-card models get shown off from a few angles. Snaps back to the
// exact home framing the instant the round starts resolving.
//
// Implemented as spherical coordinates around CAMERA_LOOK_AT, computed
// from the camera's own home position/target so it stays correct if
// the home framing (isMobile branch above) ever changes. Camera shake
// (used during hit impacts, always in the 'resolving' phase) still
// works on top of this: updateCameraShake offsets from camera.baseX/Y,
// and camera.baseX/Y are refreshed to the orbit-computed position each
// frame while orbiting so the two systems don't fight each other.

const cameraHome = (() => {
  const offset = camera.position.clone().sub(CAMERA_LOOK_AT);
  const radius = Math.hypot(offset.x, offset.z);
  return {
    radius,
    height: camera.position.y,
    angle: Math.atan2(offset.z, offset.x) // home azimuth, radians — player side, looking at the enemies
  };
})();

// Vantage points the idle camera cycles through, expressed as offsets from
// cameraHome so they stay correct if the home framing (isMobile branch
// above) ever changes. Sequential order (not random): front -> right side
// -> left side -> behind-the-enemy-lines -> back to front. The behind-
// enemy vantage sits near angleOffset = PI (home looks from the player's
// side toward the enemies at negative Z, so +PI swings the camera around
// to the enemies' side looking back across the board) with extra height
// to read as "looking down over their shoulders" rather than clipping
// into the enemy models. radiusScale pulls the camera in slightly on the
// tighter side vantages so each one reads as a deliberate reframe.
const CAMERA_VANTAGES = [
  { angleOffset: 0, heightOffset: 0, radiusScale: 1 },              // home / front
  { angleOffset: 0.85, heightOffset: 0.35, radiusScale: 0.92 },     // swing right
  { angleOffset: -0.85, heightOffset: 0.35, radiusScale: 0.92 },    // swing left
  { angleOffset: Math.PI, heightOffset: 0.9, radiusScale: 0.85 }    // behind enemy lines, looking back
];

const ORBIT_HOLD_SECONDS = 8;         // how long the camera lingers at each vantage
const ORBIT_GLIDE_SECONDS = 2.6;      // how long the slow glide to the next vantage takes
const ORBIT_SNAP_SECONDS = 0.45;      // how fast the camera eases back to home framing on battle start
const ORBIT_BOBBLE_AMOUNT = 0.06;     // gentle continuous idle sway, in world units
const ORBIT_BOBBLE_SPEED = 0.55;      // radians/sec for the bobble oscillation

let orbitEnabled = true;      // planning phase only; toggled by phase transitions below
let orbitSnapping = false;    // true while easing back to home after battle start
let orbitSnapT = 0;
let orbitSnapFrom = null;     // { angle, height } captured at the moment snap-back begins

// Sequencer state: currently holding at a vantage, or gliding between two.
let orbitVantageIndex = 0;
let orbitMode = 'hold';       // 'hold' | 'glide'
let orbitModeT = 0;           // seconds elapsed in the current hold/glide
let orbitGlideFrom = null;    // { angle, height, radiusScale } captured at glide start
let orbitGlideTo = null;
let orbitBobbleT = 0;         // free-running clock for the continuous idle bobble

function setCameraOrbitEnabled(enabled) {
  if (enabled === orbitEnabled) return;
  orbitEnabled = enabled;
  if (!enabled) {
    // Capture current framing and ease back to home instead of teleporting,
    // so the transition into battle reads as a deliberate "snap into
    // position" rather than a jarring pop.
    orbitSnapping = true;
    orbitSnapT = 0;
    orbitSnapFrom = { angle: currentOrbitAngle(), height: camera.position.y };
  } else {
    orbitSnapping = false;
    // Restart the sequence fresh each planning phase, always beginning
    // with a hold at the home/front vantage so the player's own turn
    // always opens on a familiar framing before it starts drifting.
    orbitVantageIndex = 0;
    orbitMode = 'hold';
    orbitModeT = 0;
  }
}

function currentOrbitAngle() {
  const offset = camera.position.clone().sub(CAMERA_LOOK_AT);
  return Math.atan2(offset.z, offset.x);
}

function setCameraFromPolar(angle, height, radiusScale = 1) {
  const radius = cameraHome.radius * radiusScale;
  camera.position.x = CAMERA_LOOK_AT.x + Math.cos(angle) * radius;
  camera.position.z = CAMERA_LOOK_AT.z + Math.sin(angle) * radius;
  camera.position.y = height;
  camera.lookAt(CAMERA_LOOK_AT);
  camera.baseX = camera.position.x;
  camera.baseY = camera.position.y;
}

function vantageToAbsolute(v) {
  return {
    angle: cameraHome.angle + v.angleOffset,
    height: cameraHome.height + v.heightOffset,
    radiusScale: v.radiusScale
  };
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function updateCameraOrbit(dt) {
  if (orbitSnapping) {
    orbitSnapT = Math.min(1, orbitSnapT + dt / ORBIT_SNAP_SECONDS);
    const e = 1 - Math.pow(1 - orbitSnapT, 3); // ease-out cubic
    const angle = orbitSnapFrom.angle + (cameraHome.angle - orbitSnapFrom.angle) * e;
    const height = orbitSnapFrom.height + (cameraHome.height - orbitSnapFrom.height) * e;
    setCameraFromPolar(angle, height);
    if (orbitSnapT >= 1) orbitSnapping = false;
    return;
  }

  if (!orbitEnabled) return;

  // Freeze the orbit (holds/glides/bobble all stop advancing) while the
  // player is choosing a target for a queued ability — the camera
  // drifting mid-decision makes target rings harder to track. This is a
  // pure early-return, not a mode change: orbitModeT/orbitBobbleT simply
  // don't accumulate this frame, so the orbit resumes exactly where it
  // left off the instant selectedAbility clears (ability queued or
  // selection cancelled), with no separate pause/resume bookkeeping
  // needed at each of the several places that clear selectedAbility.
  if (selectedAbility) return;

  orbitModeT += dt;
  orbitBobbleT += dt;

  // Continuous gentle idle sway, layered on top of wherever the sequencer
  // currently has the camera — active during holds AND glides alike, so
  // the camera never sits perfectly still even mid-transition.
  const bobbleAngle = Math.sin(orbitBobbleT * ORBIT_BOBBLE_SPEED) * ORBIT_BOBBLE_AMOUNT;
  const bobbleHeight = Math.sin(orbitBobbleT * ORBIT_BOBBLE_SPEED * 0.7 + 1.7) * ORBIT_BOBBLE_AMOUNT * 0.6;

  if (orbitMode === 'hold') {
    const v = vantageToAbsolute(CAMERA_VANTAGES[orbitVantageIndex]);
    setCameraFromPolar(v.angle + bobbleAngle, v.height + bobbleHeight, v.radiusScale);
    if (orbitModeT >= ORBIT_HOLD_SECONDS) {
      // Deterministic hold -> glide -> hold -> glide sequence through the
      // vantage list in order (no randomness), matching a predictable
      // "move to a spot, wait, glide to the next, wait" rhythm.
      const nextIndex = (orbitVantageIndex + 1) % CAMERA_VANTAGES.length;
      orbitGlideFrom = v;
      orbitGlideTo = vantageToAbsolute(CAMERA_VANTAGES[nextIndex]);
      orbitVantageIndex = nextIndex;
      orbitMode = 'glide';
      orbitModeT = 0;
    }
  } else { // 'glide'
    const t = Math.min(1, orbitModeT / ORBIT_GLIDE_SECONDS);
    const e = easeInOutCubic(t);
    const angle = orbitGlideFrom.angle + (orbitGlideTo.angle - orbitGlideFrom.angle) * e;
    const height = orbitGlideFrom.height + (orbitGlideTo.height - orbitGlideFrom.height) * e;
    const radiusScale = orbitGlideFrom.radiusScale + (orbitGlideTo.radiusScale - orbitGlideFrom.radiusScale) * e;
    setCameraFromPolar(angle + bobbleAngle, height + bobbleHeight, radiusScale);
    if (t >= 1) {
      orbitMode = 'hold';
      orbitModeT = 0;
    }
  }
}


// =============================================================
// ============ SECTION 9: ANIMATION ENGINE (ORCHESTRATOR) ======
// =============================================================
// This is the bridge: combat.resolve() -> animation plays ->
// impact event fires -> combat.apply() -> UI updates -> hurt/dead.
// Same function is called for BOTH player actions and AI actions.

const AnimationEngine = {
  async play({ actor, ability, target, playerUnits, enemyUnits, round, echo, secondTarget }) {
    const result = CombatEngine.resolve(actor, ability, target, { playerUnits, enemyUnits, round, echoChoice: echo || null, secondTarget: secondTarget || null });

    const applyAndReact = async () => {
      CombatEngine.apply(result);
      renderFloatingNumbers(result);
      refreshAllUnitUI();
      logResult(result);

      // Multi-effect abilities (e.g. Ajax's Duelo hits both sides, Corrente
      // Fatal can hit 2-3 times) trigger a hurt/dead reaction on EVERY
      // unit that actually took damage this action, not just `target`.
      const damageHits = (result.applied || []).filter(a => a.verb === 'damage' && a.actualDamage > 0);
      const reactedUnits = new Set();
      for (const hit of damageHits) {
        const victim = hit.target;
        if (!victim || reactedUnits.has(victim)) continue;
        reactedUnits.add(victim);
        if (hit.killed) {
          await victim.animations.hurt(1.4);
          await victim.animations.dead();
        } else {
          await victim.animations.hurt(hit.actualDamage >= 9 ? 1.3 : 0.9);
        }
      }
    };

    const animKey = ability.animKey || "skill1";
    if (animKey === "skill2") {
      await actor.animations.skill2(target, applyAndReact, primaryEffectType(ability), ability.id);
    } else if (animKey === "skill3") {
      await actor.animations.skill3(target, applyAndReact, primaryEffectType(ability), ability.id);
    } else {
      await actor.animations.skill1(target, applyAndReact, primaryEffectType(ability), ability.id);
    }

    return result;
  }
};

function renderFloatingNumbers(result) {
  // Walks every applied effect (not just a single "primary" one) so multi-hit
  // abilities (Ajax's Duelo/Corrente Fatal) and multi-verb abilities (damage +
  // status, gainCounter, etc.) all get appropriate floating text.
  for (const a of (result.applied || [])) {
    if (!a.target) continue;
    const screenPos = worldToScreen(a.target.hitPoint);
    if (a.verb === 'damage' && a.actualDamage > 0) {
      spawnFloatText(screenPos, "-" + a.actualDamage, "dmg");
      if (a.absorbedByShield) {
        spawnFloatText({ x: screenPos.x, y: screenPos.y - 16 }, "🛡" + a.absorbedByShield, "shield");
      }
    } else if (a.verb === 'heal' && a.actualHeal > 0) {
      spawnFloatText(screenPos, "+" + a.actualHeal, "heal");
    } else if (a.verb === 'shield') {
      spawnFloatText(screenPos, "+" + a.amount + " 🛡", "shield");
    } else if (a.verb === 'gainCounter') {
      spawnFloatText(screenPos, "+" + a.amount + " ✦", "shield");
    } else if (a.verb === 'applyStatus') {
      spawnFloatText(screenPos, StatusText.name(a.status), "shield");
    } else if (a.verb === 'purify' && (a.hadStatuses || a.hadCounters)) {
      spawnFloatText(screenPos, I18n.t('fx.purified'), "heal");
    } else if (a.verb === 'speechBubble' && a.who) {
      spawnSpeechBubble(a.who, a.text, { cls: a.cls || '' });
    }
  }
}

function spawnFloatText(screenPos, text, cls) {
  const el = document.createElement('div');
  el.className = 'float-text ' + cls;
  el.style.left = screenPos.x + 'px';
  el.style.top = screenPos.y + 'px';
  el.textContent = text;
  document.getElementById('label-layer').appendChild(el);
  setTimeout(() => el.remove(), 1150);
}

// Generic speech-bubble popup above a unit's head (reuses the same
// worldToScreen/label-layer plumbing as spawnFloatText, just a different
// visual treatment — a cartoon bubble instead of floating combat text).
// `unit` needs a live .model (for position) same as spawnFloatText's
// callers use via .hitPoint. `cls` optionally adds a modifier class (e.g.
// 'shout' for a bigger, angrier variant) on top of the base 'speech-bubble'.
// durationMs lets a "shouted" line linger a bit longer than a quiet one.
function spawnSpeechBubble(unit, text, { cls = '', durationMs = 1600 } = {}) {
  if (!unit || !unit.model) return;
  const headPos = unit.model.position.clone().add(new THREE.Vector3(0, 2.15, 0));
  const screenPos = worldToScreen(headPos);
  const el = document.createElement('div');
  el.className = 'speech-bubble' + (cls ? ' ' + cls : '');
  el.style.left = screenPos.x + 'px';
  el.style.top = screenPos.y + 'px';
  el.textContent = text;
  document.getElementById('label-layer').appendChild(el);
  setTimeout(() => el.remove(), durationMs);
}

function logResult(result) {
  const a = UnitText.displayName(result.actor), ab = UnitText.abilityName(result.actor, result.ability);
  addLogLine(I18n.t('log.actorUsesAbilityShort', { unit: a, ability: ab }), 'info');
  for (const eff of (result.applied || [])) {
    const t = eff.target ? UnitText.displayName(eff.target) : '?';
    if (eff.verb === 'damage' && eff.actualDamage > 0) {
      let msg = I18n.t('log.takesDamage', { target: t, amount: eff.actualDamage });
      if (eff.absorbedByShield) msg += I18n.t('log.absorbedByShield', { amount: eff.absorbedByShield });
      if (eff.killed) msg += I18n.t('log.defeated');
      addLogLine(msg, 'hit');
    } else if (eff.verb === 'heal' && eff.actualHeal > 0) {
      addLogLine(I18n.t('log.healedFor', { target: t, amount: eff.actualHeal }), 'heal');
    } else if (eff.verb === 'shield') {
      addLogLine(I18n.t('log.shieldedFor', { target: t, amount: eff.amount }), 'heal');
    } else if (eff.verb === 'applyStatus') {
      addLogLine(I18n.t('log.gainsStatus', { target: t, status: StatusText.name(eff.status) }), 'info');
    } else if (eff.verb === 'gainCounter') {
      addLogLine(I18n.t('log.gainsCounter', { target: t, amount: eff.amount, counter: StatusText.counter(eff.counter), total: eff.newTotal }), 'info');
    } else if (eff.verb === 'spendCounters') {
      addLogLine(I18n.t('log.spendsCounter', { target: t, amount: eff.spent, counter: StatusText.counter(eff.counter) }), 'info');
    } else if (eff.verb === 'note') {
      addLogLine(I18n.t('log.note', { text: StatusText.note(result.actor.defId, result.ability.id, eff.text) }), 'info');
    } else if (eff.verb === 'purify') {
      addLogLine(eff.hadStatuses || eff.hadCounters ? I18n.t('log.purified', { target: t }) : I18n.t('log.nothingToPurify', { target: t }), 'info');
    }
  }
}

