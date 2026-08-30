// =============================================================
// ============ SECTION 4: PARTICLE / EFFECT SYSTEM =============
// =============================================================
// Lightweight pooled particle bursts (generalized from Babawibby's
// dust/impact/speed-streak particles). Kept cheap for mobile GPUs.

const activeParticles = [];

function spawnBurst({ position, color = 0xffffff, count = 10, spread = 0.5, speed = 2.5, size = 0.06, life = 0.5, gravity = -4 }) {
  if (isMobile) count = Math.ceil(count * 0.6);
  const geo = new THREE.SphereGeometry(size, 5, 5);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.position.copy(position);
    scene.add(mesh);
    const angle = Math.random() * Math.PI * 2;
    const upBias = Math.random() * 0.6 + 0.2;
    const vel = new THREE.Vector3(
      Math.cos(angle) * spread * speed * Math.random(),
      upBias * speed,
      Math.sin(angle) * spread * speed * Math.random()
    );
    activeParticles.push({ mesh, vel, life, age: 0, gravity });
  }
}

function spawnImpactRing(position, color = 0xffffff, size = 0.9) {
  const geo = new THREE.RingGeometry(0.05, size, 20);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(geo, mat);
  ring.position.copy(position);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.1;
  scene.add(ring);
  activeParticles.push({ mesh: ring, vel: new THREE.Vector3(0,0,0), life: 0.35, age: 0, gravity: 0, isRing: true, ringSize: size });
}

function spawnProjectileTrail(position, color) {
  const geo = new THREE.SphereGeometry(0.05, 4, 4);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position);
  scene.add(mesh);
  activeParticles.push({ mesh, vel: new THREE.Vector3(0,0,0), life: 0.3, age: 0, gravity: 0 });
}

function updateParticles(dt) {
  for (let i = activeParticles.length - 1; i >= 0; i--) {
    const p = activeParticles[i];
    p.age += dt;
    const t = p.age / p.life;
    if (t >= 1) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose(); p.mesh.material.dispose();
      activeParticles.splice(i, 1);
      continue;
    }
    if (p.isRing) {
      const s = 1 + t * 1.8;
      p.mesh.scale.set(s, s, s);
      p.mesh.material.opacity = 0.85 * (1 - t);
    } else {
      p.vel.y += p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.material.opacity = 1 - t;
      const sc = 1 - t * 0.5;
      p.mesh.scale.set(sc, sc, sc);
    }
  }
}


// =============================================================
// ============ SECTION 6: THE UNIT CLASS ========================
// =============================================================
// A Unit bundles: combat state (hp/shield/alive) + a Three.js model
// + a per-unit "animations" table {idle, hurt, dead, skill1..3}.
// Combat engine mutates hp/shield/alive. Animation engine only
// reads position/model and calls the animations table.

// Index 3 ("summon slot") is only ever used by units created mid-battle via
// the `summon` effect verb (e.g. Babawibby's Máquina de Guerra) — the normal
// 3-unit roster (defender/attacker/support at 0/1/2) never occupies it. Kept
// a bit further back/wide so it doesn't visually crowd the starting trio.
const SLOT_POSITIONS = {
  player: [ new THREE.Vector3(-2.6, 0, 3.6), new THREE.Vector3(0, 0, 4.4), new THREE.Vector3(2.6, 0, 3.6), new THREE.Vector3(0, 0, 6.2) ],
  enemy:  [ new THREE.Vector3(-2.6, 0, -3.6), new THREE.Vector3(0, 0, -4.4), new THREE.Vector3(2.6, 0, -3.6), new THREE.Vector3(0, 0, -6.2) ]
};

let unitIdCounter = 0;

class Unit {
  // `team` is which SIDE of the battle this unit is fighting on
  // ("player" | "enemy") — NOT necessarily def.team. def.team just means
  // "this hero is in the player-draftable pool"; since enemy rosters are
  // drawn from that same pool (see pickRandomEnemyOrder in js/units.js),
  // a unit's def.team can be "player" while it's actually fighting on the
  // enemy side. Slot position, facing, roster placement, and UI all need
  // the actual battle side, so it's passed in explicitly rather than
  // inferred from def.team.
  // `opts.skipSpawnHooks` — used only by initGame's starting-trio build:
  // all 3 Units on a side are constructed via one `.map()` call BEFORE the
  // resulting array is assigned to the global playerUnits/enemyUnits, so a
  // spawn hook firing mid-map (see onUnitSpawned in js/effects.js) would
  // see a stale/empty roster and miss teammates being created in the very
  // same call. initGame passes this flag, builds both full rosters first,
  // then runs the hooks itself once both arrays are actually assigned —
  // every OTHER spawn site (forced replacement, summons, campaign) already
  // pushes into a roster array that's accurate at construction time, so
  // they don't need this and can just let the hook fire immediately below.
  constructor(def, slotIndex, team, opts = {}) {
    this.defId = def.id;
    this.uid = "u" + (unitIdCounter++);
    this.displayName = def.displayName;
    this.team = team;
    this.abilities = def.abilities;
    // Sub-abilities: reachable only via a useAbilityOn step that looks
    // them up by id (see units.js's "SUB-ABILITIES" comment) — kept off
    // `this.abilities` entirely so no UI/AI loop needs a `.hidden` filter
    // to keep them out.
    this.subAbilities = def.subAbilities || [];
    this.maxHP = def.stats.maxHP;
    this.hp = def.stats.maxHP;
    this.shield = 0;
    this.statuses = [];   // active StatusLib effects (bleed, untargetable, moveLast, ...)
    this.counters = {};   // named resource counters (e.g. Mariana's "protecao")
    this.alive = true;
    this.slotIndex = slotIndex;
    // Campaign-only equip slot (js/campaign/items.js). Always present
    // (not just during a campaign run) so Items.equipItem/unequipItem
    // never need an existence check — stays null and unused in Vs.
    // AI/PVP, same guarded-additive pattern as the rest of the
    // campaign integration (CAMPAIGN_DESIGN.md §8).
    this.equippedItem = null;

    // Apply any passive abilities' constant effect immediately on spawn.
    // Passive abilities (ability.passive === true) have no speed, are never
    // selectable/queued as an action, and never appear in the ability row —
    // see renderAbilityRow()'s passive filter. Their `effects[]` is treated
    // as a one-time "grant this permanent status" application at spawn,
    // not a repeatable action. Generic — any future passive-kit character
    // reuses this same spawn-time hook, not just Dário's.
    for (const ability of this.abilities) {
      if (!ability.passive) continue;
      const ctx = { actor: this, target: this, originalTarget: this, ability, allUnits: [], playerUnits: [], enemyUnits: [], round: 0 };
      const results = runEffectChain(ability.effects, ctx);
      for (const er of results) {
        if (er.verb === 'applyStatus' && er.target === this) applyStatusToUnit(this, er.status);
      }
    }

    this.homePosition = SLOT_POSITIONS[team][slotIndex].clone();

    // For dual-model characters (e.g. Dário), the passive-applied status
    // above already carries the initial form — read it now so
    // buildUnitModel can show the matching half from the very first frame
    // instead of always defaulting to "senador" and flipping visibly.
    const initialForm = def.shape === 'dario' ? currentForm(this, 'dario_form') : undefined;
    const modelParts = buildUnitModel(def, initialForm);
    this.model = modelParts.root;
    this.body = modelParts.bodyGroup;
    this.core = modelParts.core;
    this.weapon = modelParts.weapon;
    this.model.position.copy(this.homePosition);
    // Face inward toward battlefield center
    this.model.rotation.y = team === "player" ? Math.PI : 0;

    scene.add(this.model);

    // Character-specific spawn flourish (e.g. Babawibby's pop-in + hop), if
    // this character has one. Fire-and-forget: doesn't block unit creation,
    // and idle takes over normally once it finishes.
    const spawnProfile = CHARACTER_ANIM_PROFILES[def.id];
    if (spawnProfile && spawnProfile.spawn) {
      const steps = spawnProfile.spawn(this);
      animRunner.playSequence(Array.isArray(steps) ? steps : [steps]);
    }

    this.idleClock = Math.random() * 10; // desync idle bobbing per unit
    this.idleActive = true;

    // ---- animations table: idle / hurt / dead / skill1-3 ----
    this.animations = buildUnitAnimations(this);

    // Generic unit-spawn hook point (js/effects.js) — see the flag comment
    // on the constructor signature above for why initGame opts out here.
    if (!opts.skipSpawnHooks) runUnitSpawnedHooks(this);
  }

  get position() { return this.model.position; }
  get hitPoint() { return this.model.position.clone().add(new THREE.Vector3(0, 1, 0)); }

  isValidTarget() { return this.alive; }

  // Dual-model characters only (currently just Dário): called whenever the
  // unit's reactiveForm status flips (see the flip hook in
  // combat-engine.js's apply()). Swaps which pre-built half is visible and
  // re-points this.core/this.weapon at the newly-active half's parts —
  // this.body itself never changes, only its children's visibility and
  // names, so animations.js's existing references stay valid without
  // rebuilding this.animations.
  refreshForm(form) {
    if (!this.body || !this.body.userData || !this.body.userData.darioForms) return;
    applyDarioFormVisibility(this.body, form);
    this.core = this.body.getObjectByName("core");
    this.weapon = this.body.getObjectByName("weapon");
  }
}

// =============================================================
// ============ MID-BATTLE ROSTER MUTATION (summons) ============
// =============================================================
// Generic support for the `summon` / `sacrificeAlly` effect verbs
// (js/effects.js). Any card can use these — not specific to one unit.
// Roster arrays (playerUnits/enemyUnits) and the live Three.js scene
// only exist here in game.html, so this is where the actual mutation
// has to happen; resolution.js just watches for the markers and calls in.

// Finds the first slot index not currently occupied by a living unit on
// that team, starting at 3 (index 0-2 are reserved for the starting trio).
// If every slot 3+ is somehow full (multiple summons), extends further.
function nextSummonSlot(team) {
  const roster = team === "player" ? playerUnits : enemyUnits;
  let idx = 3;
  while (roster.some(u => u.alive && u.slotIndex === idx)) idx++;
  // Extend SLOT_POSITIONS on the fly if we ever need slot 4+ (rare: would
  // require 2+ simultaneous summons on one team), reusing slot 3's position
  // offset further back so extra summons don't overlap on-screen.
  if (!SLOT_POSITIONS[team][idx]) {
    const base = SLOT_POSITIONS[team][3];
    SLOT_POSITIONS[team][idx] = new THREE.Vector3(base.x + (idx - 3) * 1.4, base.y, base.z + (idx - 3) * 0.6);
  }
  return idx;
}

// Instantiates a UNIT_DEFS entry as a live Unit, adds it to the correct
// roster array and the scene, and returns it. `summonedBy` and `tag` are
// stamped onto the new unit so a later `sacrificeAlly` step (optionally
// filtered by tag) can find it, and so UI/logging can attribute it.
function summonUnitFor(team, defId, tag, summonedBy) {
  const def = UNIT_DEFS[defId];
  if (!def) { console.warn('summonUnitFor: unknown defId', defId); return null; }
  const slotIndex = nextSummonSlot(team);
  const unit = new Unit(def, slotIndex, team);
  unit.summonTag = tag || defId;
  unit.summonedBy = summonedBy || null;
  if (team === "player") playerUnits.push(unit); else enemyUnits.push(unit);
  addLogLine(`${summonedBy ? summonedBy.displayName + ' invoca ' : ''}${unit.displayName}!`, 'info');
  refreshAllUnitUI();
  renderPartyRow();
  return unit;
}

// Auto-resolving banner (no click needed) used when a hand card is forced
// onto an empty battlefield slot between rounds. Returns a Promise that
// resolves once the banner has been visible long enough to read, so
// callers can await it before moving on to the next replacement/round.
function showReinforcementBanner(text, holdMs = 1400) {
  const el = document.getElementById('reinforcement-banner');
  el.textContent = text;
  el.classList.add('show');
  return new Promise(resolve => {
    setTimeout(() => {
      el.classList.remove('show');
      resolve();
    }, holdMs);
  });
}

// Generic "choose one living ally" prompt — for any future card whose
// passive/kit needs the PLAYER to pick a target outside the normal
// ability-targeting flow (e.g. Andressa's Vínculo da Escudeira picking a
// Partner the moment she takes the field — js/units/andressa.js). Only
// meant for the human side; AI-controlled sides should pick programmatically
// instead of calling this. Resolves to the chosen Unit, or immediately to
// null if `candidates` is empty (nothing to prompt). Self-contained inline
// styling, same lightweight-modal approach as js/starter-select.js.
function promptChooseAlly(title, candidates) {
  if (!candidates.length) return Promise.resolve(null);
  return new Promise(resolve => {
    const root = document.createElement('div');
    root.style.cssText = 'position:fixed; inset:0; z-index:60; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; background:rgba(3,4,8,0.92); padding:20px;';
    const heading = document.createElement('div');
    heading.textContent = title;
    heading.style.cssText = 'font-size:16px; font-weight:800; color:#e8eefc; letter-spacing:1px; text-align:center; max-width:640px;';
    root.appendChild(heading);
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; gap:16px; flex-wrap:wrap; justify-content:center; max-width:900px;';
    root.appendChild(row);
    candidates.forEach(unit => {
      const btn = document.createElement('button');
      btn.textContent = UnitText.displayName(unit);
      btn.style.cssText = 'background: var(--accent, #7dffb0); color:#05121a; border:none; border-radius:10px; padding:14px 20px; font-size:14px; font-weight:800; cursor:pointer;';
      btn.addEventListener('click', () => {
        document.body.removeChild(root);
        resolve(unit);
      });
      row.appendChild(btn);
    });
    document.body.appendChild(root);
  });
}

// Scans one side for empty role slots (0/1/2 — defender/attacker/support)
// with no LIVING unit currently in them, and forces a hand card into each
// one, in ROLE_ORDER, one at a time (sequential banner per slot so
// multiple deaths in the same round read clearly instead of all at once).
// If the hand has no card left for a given role, that slot just stays
// empty — no banner, no prompt, moves on to the next role. Mutates
// `units`/`hand` in place (push new Unit, splice the used hand entry) and
// returns nothing; caller re-checks game-over state after this runs.
async function resolveForcedReplacements(units, hand, team, sideLabel) {
  for (const role of TeamSelect.ROLE_ORDER) {
    const slotIndex = ROLE_SLOT[role];
    const filled = units.some(u => u.alive && u.slotIndex === slotIndex);
    if (filled) continue;

    const handIdx = hand.findIndex(c => c.role === role);
    if (handIdx === -1) continue; // no reinforcement available — slot stays empty permanently

    const [card] = hand.splice(handIdx, 1);
    const def = UNIT_DEFS[card.defId];
    const unit = new Unit(def, slotIndex, team);
    units.push(unit);
    refreshAllUnitUI();
    renderPartyRow();
    await showReinforcementBanner(I18n.t('pv.hud.reinforcementFell', {
      side: I18n.t(sideLabel),
      role: I18n.roleLabel(role),
      unit: UnitText.displayName(unit)
    }));
  }
}

// Role label for the reinforcement banner text now goes through
// I18n.roleLabel (see resolveForcedReplacements above) so it matches the
// translated Defender/Attacker/Support labels used everywhere else,
// instead of this module's own raw-capitalized-id version.

// Removes a summoned (or any) unit from its team's roster and scene. Marks
// it dead/not-alive first so any in-flight targeting/AI logic that filters
// on `.alive` stops seeing it immediately, then detaches its model next
// frame (small delay avoids yanking the mesh out mid-animation-callback).
function removeUnitFromRoster(unit) {
  if (!unit) return;
  unit.alive = false;
  unit.hp = 0;
  const roster = unit.team === "player" ? playerUnits : enemyUnits;
  const idx = roster.indexOf(unit);
  if (idx !== -1) roster.splice(idx, 1);
  setTimeout(() => { scene.remove(unit.model); }, 50);
  refreshAllUnitUI();
  renderPartyRow();
}

// --- Per-unit animation library ---------------------------------
// Generalizes the Babawibby "move -> arrive -> event -> effect"
// chain into reusable idle/hurt/dead/skill routines that operate
// relative to actor/target positions (Section 10 requirement).

function buildUnitAnimations(unit) {
  const facing = unit.team === "player" ? -1 : 1; // player units face -Z (toward enemy), enemy face +Z

  return {
    // ---- IDLE: subtle breathing/bob + core glow pulse ----
    idle: {
      // handled per-frame in the render loop (continuous), not a one-shot sequence
    },

    // ---- HURT: impact squash, recoil, recover ----
    async hurt(magnitude = 1) {
      unit.idleActive = false;
      const knockDir = new THREE.Vector3(0, 0, facing * -0.18 * magnitude);
      const homeY = unit.body.position.y;
      await animRunner.playSequence([
        [
          squashStretchStep(unit.body, 1.18, 0.8, 1.18, 0.09, Easing.quadOut),
          callbackStep(() => { unit.body.position.add(knockDir); })
        ],
        waitStep(0.05),
        [
          squashStretchStep(unit.body, 1, 1, 1, 0.22, Easing.backOut),
          callbackStep(() => { unit.body.position.z -= knockDir.z; })
        ]
      ]);
      unit.idleActive = true;
    },

    // ---- DEAD: collapse and fade ----
    async dead() {
      unit.idleActive = false;
      await animRunner.playSequence([
        [
          { clip: new Clip(0.35, t => {
              unit.body.rotation.x = Easing.cubicIn(t) * (Math.PI / 2.1);
            }) },
          { clip: new Clip(0.35, t => {
              unit.body.position.y = 0.0 - Easing.cubicIn(t) * 0.15;
            }) }
        ],
        { clip: new Clip(0.4, t => {
            unit.body.traverse(o => { if (o.material && o.material.opacity !== undefined) { o.material.transparent = true; o.material.opacity = 1 - t; } });
          }) }
      ]);
      unit.model.visible = false;
    },

    // ---- SKILL 1: direct melee/bolt attack ----
    async skill1(target, onImpact, abilityType, abilityId) {
      await runAttackAnimation(unit, target, { arc: false, color: 0xffffff, onImpact, abilityId });
    },

    // ---- SKILL 2: support (shield) or secondary attack depending on def ----
    async skill2(target, onImpact, abilityType, abilityId) {
      if (abilityType === "shield") {
        await runSupportAnimation(unit, target, { color: 0xffe27a, onImpact, kind: "shield" });
      } else if (abilityType === "heal") {
        await runSupportAnimation(unit, target, { color: 0x7dffb0, onImpact, kind: "heal" });
      } else {
        await runAttackAnimation(unit, target, { arc: true, color: 0xffdca8, onImpact, abilityId });
      }
    },

    // ---- SKILL 3: heavier attack with bigger wind-up/impact ----
    async skill3(target, onImpact, abilityType, abilityId) {
      await runAttackAnimation(unit, target, { arc: true, heavy: true, color: 0xff5a5a, onImpact, abilityId });
    }
  };
}

// Shared "attack" choreography: wind-up -> approach -> attack -> impact event -> return.
async function runAttackAnimation(actor, target, opts) {
  const { color = 0xffffff, heavy = false, onImpact, abilityId } = opts;
  actor.idleActive = false;
  const startPos = actor.model.position.clone();
  const dir = new THREE.Vector3().subVectors(target.model.position, actor.model.position).normalize();
  const approachDist = heavy ? 1.7 : 1.4;
  const approachPos = new THREE.Vector3().copy(target.model.position).addScaledVector(dir, -0.9 * approachDist / 1.4 - 0.5);
  // simpler: stop short of target along the line from actor->target
  const stopShort = new THREE.Vector3().copy(target.model.position).addScaledVector(dir, -1.1);

  const windupScale = heavy ? 1.22 : 1.1;
  const profile = CHARACTER_ANIM_PROFILES[actor.defId];

  await animRunner.playSequence([
    // Wind-up
    squashStretchStep(actor.body, windupScale, 0.9, windupScale, heavy ? 0.22 : 0.14, Easing.quadOut),
    // Character-specific wind-up flourish layered on top, if this character has one
    ...(profile && profile.windup ? [profile.windup(actor)] : []),
    // Move toward target (relative targeting - uses live positions, not hard-coded coords)
    moveStep(actor.model, stopShort, heavy ? 0.32 : 0.24, Easing.cubicOut),
    // ATTACK EVENT: lunge + weapon swing
    [
      squashStretchStep(actor.body, 0.85, 1.15, 0.85, 0.09, Easing.quadOut),
      callbackStep(() => {
        if (actor.weapon) actor.weapon.rotation.x -= heavy ? 2.4 : 1.6;
      })
    ],
    // IMPACT EVENT — this is where gameplay effect fires, synced to the visual hit
    callbackStep(() => {
      spawnImpactRing(target.hitPoint, color, heavy ? 1.3 : 0.9);
      spawnBurst({ position: target.hitPoint, color, count: heavy ? 16 : 10, speed: heavy ? 3.2 : 2.4 });
      triggerCameraShake(heavy ? 0.22 : 0.1, heavy ? 0.28 : 0.16);
      if (onImpact) onImpact(); // <-- gameplay damage applied here, not on button press
    }),
    // Character+ability-specific impact plug-in visual (e.g. Ajax's boxing
    // glove / bite jaw), if this character/ability combination has one
    ...(() => {
      if (!profile || !profile.attackImpact) return [];
      const step = profile.attackImpact(actor, target, abilityId);
      return step ? [step] : [];
    })(),
    // Recovery + return home
    [
      squashStretchStep(actor.body, 1, 1, 1, 0.18, Easing.backOut),
      callbackStep(() => { if (actor.weapon) actor.weapon.rotation.x = 0; })
    ],
    moveStep(actor.model, startPos, heavy ? 0.3 : 0.22, Easing.cubicOut)
  ]);
  actor.idleActive = true;
}

// Shared "support" choreography for heal/shield: caster raises hands, projectile/beam travels, effect lands on ally.
async function runSupportAnimation(actor, target, opts) {
  const { color, onImpact, kind } = opts;
  actor.idleActive = false;
  await animRunner.playSequence([
    squashStretchStep(actor.body, 1.12, 1.08, 1.12, 0.18, Easing.quadOut),
    callbackStep(() => {
      spawnBurst({ position: actor.hitPoint, color, count: 6, speed: 1.2, spread: 0.3 });
    }),
    waitStep(0.12),
    callbackStep(() => {
      // traveling effect line rendered as a quick burst along the path
      const mid = new THREE.Vector3().addVectors(actor.hitPoint, target.hitPoint).multiplyScalar(0.5);
      spawnProjectileTrail(mid, color);
    }),
    waitStep(0.14),
    // Effect lands
    callbackStep(() => {
      spawnImpactRing(target.hitPoint, color, kind === "shield" ? 1.1 : 0.85);
      spawnBurst({ position: target.hitPoint, color, count: 14, speed: 2, gravity: kind === "heal" ? -1 : -3 });
      if (onImpact) onImpact();
    }),
    [
      squashStretchStep(actor.body, 1, 1, 1, 0.2, Easing.backOut),
      squashStretchStep(target.body, kind === "shield" ? 1.1 : 1.08, kind === "shield" ? 1.1 : 1.12, kind === "shield" ? 1.1 : 1.08, 0.16, Easing.backOut)
    ],
    waitStep(0.08),
    scaleStep(target.body, 1, 0.18, Easing.quadOut)
  ]);
  actor.idleActive = true;
}

// =============================================================
// ============ SECTION 7: COMBAT ENGINE =========================
// =============================================================
// Pure gameplay logic. Knows nothing about Three.js, animations,
// particles, or rendering. Produces "combat results" that the
// orchestrator (Section 9) hands to the animation engine.

// CombatEngine now loaded from js/combat-engine.js (effect-pipeline based)


// ============ SECTION 10: GAME STATE & FLOW ORCHESTRATION =====
// =============================================================

let playerUnits = [];
let enemyUnits = [];
// Cards not currently on the battlefield for each side — see
// js/starter-select.js and handoff.md's deck/hand/battlefield plan.
// Each entry: { defId, role }. No Unit instance/HP/position; purely data
// until played.
let playerHand = [];
let enemyHand = [];
let lastChosenPlayerDeck = null; // the { defender:[id,id], ... } deck from team-select, for restart-btn
let selectedUnit = null;      // which of MY units is currently being assigned an ability (planning phase)
let selectedAbility = null;   // ability chosen for selectedUnit, awaiting a target
let inputLocked = false;      // true while resolution phase is animating
let gameOver = false;
let phase = 'planning';       // 'planning' | 'resolving'

// Round plan: one entry per living player unit, filled in as the player assigns abilities.
// Each entry: { actor, ability, target, echo? }
// `echo` (optional): { ability, target } — the player's chosen secondary
// ability+target for abilities flagged `promptsEcho: true` (e.g. Yvrel's
// Golpe Eco). Consumed by the useAbilityOn effect step via ctx.echoChoice.
let playerPlan = [];

// ---------------------------------------------------------------
// Unified multi-step targeting state (replaces the old echoSubMode /
// secondTargetMode / mirrorSubMode trio — see architecture-upgrades.md
// item #3). All three were structurally the same thing: "primary target
// chosen, now prompt for N more targets/choices before finalizing the
// plan entry." An ability declares its extra steps declaratively via
// `ability.promptFlow` (built once, off the existing promptsEcho /
// promptsSecondTarget / promptsMirror flags — see abilityPromptFlow()
// below, so units.js needed zero changes) instead of the UI hand-rolling
// a different branch per flag.
//
// multiStepMode shape while a flow is active (null when not):
// {
//   actor,
//   primaryAbility,      // the ability the player originally picked
//   primaryTarget,       // its target (or actor itself for self-cast entries)
//   steps: [ { kind: 'ability-choice', ... } | { kind: 'target', targetType, filter? } ],
//   stepIndex,           // which step we're currently prompting for
//   chosen: []           // { ability?, target } accumulated per completed step
// }
//
// A step's `kind`:
//   'ability-choice' — player picks WHICH ability to use next (echo flow).
//       Optional `fixedAbility`: skip the choice UI and use this ability
//       directly (mirror flow, where the ability is already determined).
//   'target' — player picks a unit. `targetType` ('ally'/'enemy') and
//       optional `filter(unit)` narrow the valid pool.
let multiStepMode = null;

const labelLayer = document.getElementById('label-layer');
const partyRow = document.getElementById('party-row');
const abilityRow = document.getElementById('ability-row');
const statusLine = document.getElementById('status-line');
const turnIndicator = document.getElementById('turn-indicator');
const logPanel = document.getElementById('log-panel');
const logToggle = document.getElementById('log-toggle');
const overlay = document.getElementById('overlay');

// Apply translated text over the static English fallback markup baked into
// index.html (so the HUD isn't stuck in English until the first real
// status/turn update fires), and re-apply on every language switch. Only
// the idle/pre-battle defaults are touched here — anything reflecting
// live battle state (queued abilities, victory/defeat) is already handled
// at the point it's set above, so re-running this mid-battle would
// clobber real status with the idle default. Guard on gameOver/statusLine
// still being unset is unnecessary in practice since I18n.onChange only
// fires from an explicit language-toggle click, which players are far
// more likely to do from the idle state or main menu anyway.
function applyStaticHudText() {
  turnIndicator.textContent = I18n.t('pv.turn.plan');
  logToggle.textContent = logPanel.classList.contains('open') ? I18n.t('pv.log.open') : I18n.t('pv.log.closed');
  if (!statusLine.textContent || statusLine.dataset.i18nIdle === '1') {
    statusLine.textContent = I18n.t('pv.status.selectUnitDefault');
    statusLine.dataset.i18nIdle = '1';
  }
  const restartBtn = document.getElementById('restart-btn');
  if (restartBtn) restartBtn.textContent = I18n.t('pv.overlay.restartBattle');
  const loadingEl = document.getElementById('loading');
  if (loadingEl) loadingEl.textContent = I18n.t('pv.hud.loadingBattlefield');
}
applyStaticHudText();
I18n.onChange(() => {
  applyStaticHudText();
  // Re-render whichever battle UI is currently live so unit names/ability
  // text/labels switch language immediately instead of waiting for the
  // next natural re-render (a card queued, a target picked, etc). All
  // three are no-ops (empty arrays/no DOM) before a battle has started.
  if (typeof playerUnits !== 'undefined' && (playerUnits.length || enemyUnits.length)) {
    refreshAllUnitUI();
    renderPartyRow();
    renderAbilityRow();
    renderTargetRings();
  }
});

// Shared defender/attacker/support -> field slotIndex mapping used below
// (initGame, resolveForcedReplacements). Defined once, in js/units.js
// (const ROLE_SLOT — also used there by findEnemyByRole), which loads
// before this inline script, so it's already available here without
// redeclaring it. Slots 0-2 are always the 3 role slots; summon slots
// start at index 3 (see nextSummonSlot) so this mapping never collides
// with a mid-battle summon.

// `starterResult` shape: { field: {defender: id, attacker: id, support: id},
// hand: [{defId, role}] } — same shape StarterSelect.runForPlayer /
// pickForAI return. A role missing from `field` (shouldn't normally
// happen — every role's pair always has at least 1 pick, per
// team-select's "ready" gating) leaves that slot empty at battle start,
// same as a mid-battle death would.
function initGame(playerStarter, enemyStarter) {
  // Clear existing
  [...playerUnits, ...enemyUnits].forEach(u => scene.remove(u.model));

  // Rebuild the battlefield now — this is the actual "a match is
  // starting" moment. Doing it here (rather than relying on the
  // once-at-page-load build in js/scene.js) is what makes the "Choose
  // Battlefield" popup in main-menu.js actually take effect, since
  // window.FORCED_BATTLEFIELD is only ever set AFTER page load, once
  // the player picks it from that popup — long after js/scene.js's
  // top-level buildBattlefield() call already ran and picked randomly.
  const battlefieldRefs = rebuildBattlefield(scene, renderer);
  playerLight = battlefieldRefs.playerLight;
  enemyLight = battlefieldRefs.enemyLight;

  // Built with skipSpawnHooks: true (see the flag's comment on the Unit
  // constructor) — spawn hooks for the starting trio only run below, once
  // BOTH full rosters are actually assigned, so a hook like Andressa's
  // Partner-choice sees its real teammates instead of an empty/stale array.
  playerUnits = Object.entries(playerStarter.field).map(([role, id]) =>
    new Unit(UNIT_DEFS[id], ROLE_SLOT[role], "player", { skipSpawnHooks: true })
  );
  enemyUnits = Object.entries(enemyStarter.field).map(([role, id]) =>
    new Unit(UNIT_DEFS[id], ROLE_SLOT[role], "enemy", { skipSpawnHooks: true })
  );
  playerHand = playerStarter.hand.slice();
  enemyHand = enemyStarter.hand.slice();
  playerUnits.forEach(u => runUnitSpawnedHooks(u));
  enemyUnits.forEach(u => runUnitSpawnedHooks(u));

  selectedUnit = null;
  selectedAbility = null;
  multiStepMode = null;
  inputLocked = false;
  gameOver = false;
  phase = 'planning';
  setCameraOrbitEnabled(true);
  playerPlan = [];
  logPanel.innerHTML = '';
  overlay.classList.remove('show');
  setTurnIndicator('planning');
  buildLabelLayer();
  renderPartyRow();
  renderAbilityRow();
  updateStatus(I18n.t('pv.status.chooseAbilityForEach'));
}

function setTurnIndicator(who) {
  if (who === 'planning') { turnIndicator.textContent = I18n.t('pv.turn.plan'); turnIndicator.className = 'player-turn'; }
  else if (who === 'resolving') { turnIndicator.textContent = I18n.t('pv.turn.resolving'); turnIndicator.className = 'enemy-turn'; }
}

// =============================================================

// ============ PRE-GAME TEAM SELECT ==============================
// =============================================================
// The team-select screen is its own module (js/team-select.js) —
// a self-contained, infinitely-scalable draft UI: one full character card
// at a time (big 3D render + full ability list + summon showcase), role
// tabs, name/ability-text search, left/right nav arrows, and an always
// -visible deck panel — instead of the old fixed 3-stacked-list markup.
// It now returns a 2-per-role deck ({ defender: [id,id], attacker:
// [id,id], support: [id,id] }), not a single flat order — see
// handoff.md's "deck/hand/battlefield system" plan. After team-select
// confirms, both sides go through js/starter-select.js's "choose who
// plays first" ritual (player: real modal; enemy AI: instant random
// pick) before initGame() actually spawns anyone.
function openTeamSelect() {
  TeamSelect.open({
    pool: TeamSelect.buildDraftPool(UNIT_DEFS),
    allDefs: UNIT_DEFS,
    roleOrder: TeamSelect.ROLE_ORDER,
    onConfirm: async (playerDeck) => {
      lastChosenPlayerDeck = playerDeck;
      const enemyDeck = pickRandomEnemyDeck();
      const playerStarter = await StarterSelect.runForPlayer(playerDeck, UNIT_DEFS, TeamSelect.ROLE_ORDER);
      const enemyStarter = StarterSelect.pickForAI(enemyDeck, TeamSelect.ROLE_ORDER);
      initGame(playerStarter, enemyStarter);
    }
  });
}

function updateStatus(text) { statusLine.textContent = text; delete statusLine.dataset.i18nIdle; }

function addLogLine(msg, cls) {
  const div = document.createElement('div');
  div.className = cls;
  div.textContent = msg;
  logPanel.appendChild(div);
  logPanel.scrollTop = logPanel.scrollHeight;
}

const targetPreviewPanel = document.getElementById('target-preview-panel');

logToggle.addEventListener('click', () => {
  logPanel.classList.toggle('open');
  logToggle.textContent = logPanel.classList.contains('open') ? I18n.t('pv.log.open') : I18n.t('pv.log.closed');
  targetPreviewPanel.classList.toggle('below-log', logPanel.classList.contains('open'));
});

// --- Label layer: name/hp/shield tags + selection rings + target rings ---

// Creates (or returns the existing) label DOM element for a unit. Shared by
// buildLabelLayer (initial batch build) and refreshAllUnitUI (so units that
// take the field mid-battle — summons, forced replacements — get a label
// the first time they're refreshed, instead of silently having none).
function ensureUnitLabel(u) {
  let label = document.getElementById('label_' + u.uid);
  if (label) return label;
  label = document.createElement('div');
  label.className = 'unit-label';
  label.id = 'label_' + u.uid;
  label.innerHTML = `
    <div class="name">${UnitText.displayName(u)}</div>
    <div class="hp-bar-bg"><div class="hp-bar-fill ${u.team}" style="width:100%"></div></div>
    <div class="hp-text">${u.hp}/${u.maxHP}</div>
    <div class="shield-pip" style="display:none;"></div>
    <div class="status-row"></div>
  `;
  labelLayer.appendChild(label);
  return label;
}

function buildLabelLayer() {
  labelLayer.innerHTML = '';
  [...playerUnits, ...enemyUnits].forEach(u => ensureUnitLabel(u));
}

function worldToScreen(worldPos) {
  const v = worldPos.clone().project(camera);
  const rect = canvasWrap.getBoundingClientRect();
  return {
    x: (v.x * 0.5 + 0.5) * rect.width,
    y: (-(v.y * 0.5) + 0.5) * rect.height
  };
}

function updateLabelPositions() {
  [...playerUnits, ...enemyUnits].forEach(u => {
    const label = document.getElementById('label_' + u.uid);
    if (!label) return;
    if (!u.alive) { label.style.opacity = '0'; return; }
    label.style.opacity = '1';
    const screenPos = worldToScreen(u.model.position.clone().add(new THREE.Vector3(0, 1.9, 0)));
    label.style.left = screenPos.x + 'px';
    label.style.top = screenPos.y + 'px';
  });
}

// Persistent status/counter display under each unit's HP bar. Reads
// generically off u.statuses (array of StatusLib objects: {id, name, kind,
// data}) and u.counters (plain { counterId: value } map) — no hardcoding
// of "bleed" or "protecao" specifically, so any new status/counter a
// future card introduces shows up automatically.
function renderStatusRow(label, u) {
  const row = label.querySelector('.status-row');
  if (!row) return;
  row.innerHTML = '';

  (u.statuses || []).forEach(s => {
    const pip = document.createElement('div');
    pip.className = 'status-pip status-kind-' + (s.kind || 'other');
    let text = s.name || s.id;
    // Show a small hint of the status's payload when it's a per-tick
    // number (e.g. bleed's damagePerTick), so it's not just a bare label.
    if (s.data && typeof s.data.damagePerTick === 'number') {
      text += ' ' + s.data.damagePerTick;
    }
    // Same idea for stacking statuses (e.g. Sirius's Contador de Reescrita)
    // — without this the pip never showed how many stacks were actually
    // banked, reading as if the ability wasn't stacking at all.
    if (s.stacking && s.data && typeof s.data.stacks === 'number') {
      text += ' x' + s.data.stacks;
    }
    pip.textContent = text;
    row.appendChild(pip);
  });

  Object.entries(u.counters || {}).forEach(([counterId, value]) => {
    if (!value) return; // skip zeroed-out counters
    const pip = document.createElement('div');
    pip.className = 'status-pip counter-pip';
    const label_ = counterId.charAt(0).toUpperCase() + counterId.slice(1);
    pip.textContent = label_ + ': ' + value;
    row.appendChild(pip);
  });
}

function refreshAllUnitUI() {
  [...playerUnits, ...enemyUnits].forEach(u => {
    const label = ensureUnitLabel(u);
    if (label) {
      const nameEl = label.querySelector('.name');
      if (nameEl) nameEl.textContent = UnitText.displayName(u);
      const pct = Math.max(0, (u.hp / u.maxHP) * 100);
      label.querySelector('.hp-bar-fill').style.width = pct + '%';
      label.querySelector('.hp-text').textContent = `${u.hp}/${u.maxHP}`;
      const shieldEl = label.querySelector('.shield-pip');
      if (u.shield > 0) { shieldEl.style.display = 'block'; shieldEl.textContent = '🛡' + u.shield; }
      else { shieldEl.style.display = 'none'; }
      if (!u.alive) label.classList.add('dead'); else label.classList.remove('dead');
      renderStatusRow(label, u);
    }
  });
  renderPartyRow();
  renderAbilityRow();
  renderTargetRings();
  // Approval Rating HUD (CAMPAIGN_DESIGN.md §6.2) — no-ops instantly
  // whenever the Shadow boss fight isn't active, same guarded-additive
  // pattern as the rest of the campaign layer.
  if (typeof DarioShadowBoss !== 'undefined') DarioShadowBoss.renderApprovalBar();
}

// --- Helpers for the planning queue ---
function planEntryFor(unit) { return playerPlan.find(p => p.actor === unit); }
function livingPlayerUnits() { return playerUnits.filter(u => u.alive); }
function allPlanned() { return livingPlayerUnits().every(u => planEntryFor(u)); }

// --- Bottom party row (unit selector during planning) ---
function renderPartyRow() {
  partyRow.innerHTML = '';
  // Dead units (including expired summons like Máquina de Guerra) are
  // dropped entirely instead of shown greyed-out — with summons the roster
  // can otherwise fill up fast with cards nobody can act on.
  playerUnits.filter(u => u.alive).forEach(u => {
    const card = document.createElement('div');
    const planned = planEntryFor(u);
    card.className = 'party-card'
      + (u === selectedUnit || (multiStepMode && u === multiStepMode.actor) ? ' selected' : '')
      + (planned && phase === 'planning' ? ' queued' : '');
    const pct = Math.max(0, (u.hp / u.maxHP) * 100);
    const queuedLine = planned ? `<div class="pc-hptext" style="color:#7dffb0;">✓ ${UnitText.abilityName(u, planned.ability)}</div>` : '';
    card.innerHTML = `
      <div class="pc-name">${UnitText.displayName(u)}</div>
      <div class="pc-hpwrap"><div class="pc-hpfill" style="width:${pct}%"></div></div>
      <div class="pc-hptext">${u.hp}/${u.maxHP}${u.shield > 0 ? ' 🛡' + u.shield : ''}</div>
      ${queuedLine}
    `;
    if (u.alive && phase === 'planning' && !gameOver) {
      card.addEventListener('click', () => selectUnit(u));
    }
    partyRow.appendChild(card);
  });

  // "Fight!" trigger card, shown once every living unit has a queued action
  if (phase === 'planning' && !gameOver && livingPlayerUnits().length > 0 && allPlanned()) {
    const fightCard = document.createElement('div');
    fightCard.className = 'party-card';
    fightCard.style.borderColor = '#7dffb0';
    fightCard.style.background = 'rgba(125,255,176,0.14)';
    fightCard.innerHTML = `<div class="pc-name" style="color:#7dffb0;">${I18n.t('pv.fight')}</div>`;
    // Call through window.beginResolutionPhase at click-time (not the
    // `beginResolutionPhase` const directly) — PVP mode reassigns
    // window.beginResolutionPhase to a wrapper that does the plan/seed
    // exchange with the opponent first (see js/net/pvp.js). Closing over
    // the const here would keep calling the original unwrapped function
    // forever, silently skipping the network exchange and falling back
    // to each side resolving locally against the AI.
    fightCard.addEventListener('click', () => window.beginResolutionPhase());
    partyRow.appendChild(fightCard);
  }
}

function selectUnit(u) {
  if (phase !== 'planning' || gameOver || !u.alive) return;
  cancelMultiStepMode();
  selectedUnit = u;
  selectedAbility = null;
  const existing = planEntryFor(u);
  updateStatus(existing
    ? I18n.t('pv.status.unitSetTo', { unit: UnitText.displayName(u), ability: UnitText.abilityName(u, existing.ability) })
    : I18n.t('pv.status.unitSelected', { unit: UnitText.displayName(u) }));
  renderPartyRow();
  renderAbilityRow();
  renderTargetRings();
}

// --- Ability row ---

// Renders a single ability button "locked" (already chosen, awaiting a
// target) — the shared treatment every step of the old echo/mirror/second-
// target flows used once their ability side was already decided.
function renderLockedAbilityButton(ability, ownerUnit) {
  const btn = document.createElement('div');
  btn.className = 'ability-btn queued';
  btn.style.borderColor = '#fff';
  btn.innerHTML = `<div>${UnitText.abilityName(ownerUnit, ability)} <span class="ab-speed">⚡${ability.speed}</span></div><div class="ab-desc">${UnitText.abilityDesc(ownerUnit, ability)}</div>`;
  abilityRow.appendChild(btn);
  for (let i = 0; i < 2; i++) {
    const empty = document.createElement('div');
    empty.className = 'ability-btn empty';
    abilityRow.appendChild(empty);
  }
}

function renderAbilityRow() {
  abilityRow.innerHTML = '';

  if (multiStepMode) {
    const step = multiStepMode.steps[multiStepMode.stepIndex];

    // 'ability-choice' step, not yet resolved: show the eligible abilities
    // to pick from (echo flow). If the step carries a `fixedAbility`
    // (mirror flow — the ability is already determined, no player choice),
    // fall straight through to showing it locked.
    if (step.kind === 'ability-choice' && !step.fixedAbility) {
      const actor = multiStepMode.actor;
      const eligible = step.eligible(actor);
      if (eligible.length === 0) {
        // No valid ability for this step (shouldn't normally happen with a
        // 3-ability kit, but guard anyway) — fizzle this step and finalize
        // the plan with just what's been chosen so far.
        finalizeMultiStepPlan(null, { fizzled: true });
        return;
      }
      eligible.forEach(ability => {
        const btn = document.createElement('div');
        btn.className = 'ability-btn';
        btn.innerHTML = `<div>${UnitText.abilityName(actor, ability)} <span class="ab-speed">⚡${ability.speed}</span></div><div class="ab-desc">${UnitText.abilityDesc(actor, ability)}</div>`;
        btn.addEventListener('click', () => chooseMultiStepAbility(ability));
        abilityRow.appendChild(btn);
      });
      return;
    }

    // Either a 'target' step, or an 'ability-choice' step whose ability is
    // fixed/already chosen — either way the ability side is decided, so
    // just show it locked while the player picks a target.
    const lockedAbility = step.kind === 'ability-choice' ? step.fixedAbility : currentStepAbility();
    renderLockedAbilityButton(lockedAbility, multiStepMode.actor);
    return;
  }

  if (!selectedUnit) {
    for (let i = 0; i < 3; i++) {
      const btn = document.createElement('div');
      btn.className = 'ability-btn empty';
      abilityRow.appendChild(btn);
    }
    return;
  }
  const existing = planEntryFor(selectedUnit);
  // Sub-abilities (unit.subAbilities) are never in .abilities at all, so
  // they never reach this render loop — no filter needed here anymore.
  selectedUnit.abilities.forEach(ability => {
    const btn = document.createElement('div');

    // Global passive-ability handling: shown in the row (so the player can
    // always see it), but never selectable, never queued, no speed shown,
    // no cooldown — its effect is constant from spawn, not something you
    // choose to trigger. See the spawn-time application in Unit's
    // constructor and combat-engine.js's reactive-form flip for how the
    // actual constant effect works.
    if (ability.passive) {
      btn.className = 'ability-btn disabled passive';
      btn.innerHTML = `<div>${UnitText.abilityName(selectedUnit, ability)} <span class="ab-speed">${I18n.t('pv.ability.passive')}</span></div><div class="ab-desc">${UnitText.abilityDesc(selectedUnit, ability)}</div>`;
      abilityRow.appendChild(btn);
      return;
    }

    const isQueued = existing && existing.ability === ability;
    const onCooldown = isOnCooldown(selectedUnit, ability);
    btn.className = 'ability-btn'
      + (ability === selectedAbility ? '' : '')
      + (phase !== 'planning' ? ' disabled' : '')
      + (onCooldown ? ' disabled' : '')
      + (isQueued ? ' queued' : '');
    const cdLabel = onCooldown ? ` <span class="ab-speed">⏳${selectedUnit.cooldowns[ability.id]}</span>` : '';
    btn.innerHTML = `<div>${UnitText.abilityName(selectedUnit, ability)} <span class="ab-speed">⚡${ability.speed}</span>${cdLabel}</div><div class="ab-desc">${UnitText.abilityDesc(selectedUnit, ability)}</div>`;
    if (phase === 'planning' && !onCooldown) {
      btn.addEventListener('click', () => selectAbility(ability));
      if (ability === selectedAbility) btn.style.borderColor = '#fff';
    }
    abilityRow.appendChild(btn);
  });
}

function selectAbility(ability) {
  if (phase !== 'planning' || gameOver) return;
  if (ability.passive) return;
  if (isOnCooldown(selectedUnit, ability)) return;
  selectedAbility = ability;

  if (ability.promptsMirror) {
    beginMirrorFlow(ability);
    return;
  }

  const targetType = ability.targetType || 'enemy';

  if (targetType === 'self') {
    // No target prompt needed — the ability always acts on its own caster
    // (e.g. Babawibby's "Crie uma Máquina de Guerra"). Finalize immediately.
    queuePlayerAction(selectedUnit);
    return;
  }

  updateStatus(targetType === 'ally'
    ? I18n.t('pv.status.chooseAllyFor', { ability: UnitText.abilityName(selectedUnit, ability) })
    : I18n.t('pv.status.chooseEnemyFor', { ability: UnitText.abilityName(selectedUnit, ability) }));
  renderAbilityRow();
  renderTargetRings();
}

// ---------------------------------------------------------------
// Declarative promptFlow construction. Given the primary ability + its
// already-picked primary target, builds the `steps` array for
// multiStepMode based on whichever of promptsEcho / promptsSecondTarget
// the ability declares (promptsMirror has no primary-target step at all —
// see beginMirrorFlow — so it isn't handled here).
function abilityPromptFlow(ability, actor) {
  if (ability.promptsEcho) {
    const last = CombatEngine.lastAbilityId(actor);
    // echoAllowSelf abilities (e.g. Gavin's Ataque e Cura) repeat
    // THEMSELVES against a new target instead of switching to a different
    // ability from the kit.
    const eligibleFn = ability.echoAllowSelf
      ? () => [ability]
      : (a) => a.abilities.filter(x => x.id !== ability.id && x.id !== last && !x.passive);
    return [
      { kind: 'ability-choice', eligible: eligibleFn,
        // Echoed abilities normally target an ally regardless of their own
        // default targetType (e.g. Yvrel's echo re-casts on a teammate).
        // echoAllowSelf abilities use their own targetType instead.
        targetTypeFor: (chosenAbility) => chosenAbility.echoAllowSelf ? (chosenAbility.targetType || 'enemy') : 'ally' },
      { kind: 'target' }
    ];
  }
  if (ability.promptsSecondTarget) {
    return [
      { kind: 'target', targetType: ability.promptsSecondTarget }
    ];
  }
  return [];
}

// Returns the ability that should be shown "locked" while prompting for
// the current step's target — the just-chosen echo ability, the fixed
// mirror ability, or (second-target flow) the primary ability itself.
function currentStepAbility() {
  if (!multiStepMode) return null;
  const abilityChoiceStep = multiStepMode.steps.find(s => s.kind === 'ability-choice');
  if (abilityChoiceStep) {
    return abilityChoiceStep.fixedAbility || (multiStepMode.chosen[0] && multiStepMode.chosen[0].ability);
  }
  return multiStepMode.primaryAbility;
}

// --- Target rings drawn over valid targets ---
// Tracks the ring DOM elements currently on screen so renderTargetRings()
// can reposition them in place on most calls, instead of unconditionally
// deleting and recreating every element. Recreating elements every ~100ms
// was the root cause of the "targeting needs several taps" bug: if a
// wipe-and-recreate landed between a touch's pointerdown and pointerup/
// click, the DOM node the gesture started on no longer existed by the
// time the click would fire, silently dropping the tap.
let targetRingState = {
  selectedUnit: null,
  selectedAbility: null,
  selRingEl: null,
  targetRingEls: new Map() // unit.uid -> ring element
};

function renderTargetRings() {
  // Resolve the "effective" unit/ability/targetType driving ring display —
  // either the normal selection, or whichever step of multiStepMode is
  // currently pending a target — so target rings can be shown for
  // whichever pick is next, reusing all the same DOM/click logic.
  let effectiveUnit, effectiveAbility, targetType, effectiveFilter = null;

  if (multiStepMode) {
    const step = multiStepMode.steps[multiStepMode.stepIndex];
    effectiveUnit = multiStepMode.actor;
    if (step.kind === 'target') {
      effectiveAbility = currentStepAbility();
      targetType = step.targetType || (effectiveAbility ? (effectiveAbility.targetType || 'enemy') : null);
      effectiveFilter = step.filter || null;
    } else {
      // 'ability-choice' step not yet resolved (or fixed-ability step
      // still shown while awaiting its own subsequent target step) —
      // no target prompt yet.
      effectiveAbility = null;
      targetType = null;
    }
  } else {
    effectiveUnit = selectedUnit;
    effectiveAbility = selectedAbility;
    targetType = effectiveAbility ? (effectiveAbility.targetType || 'enemy') : null;
  }

  if (!effectiveUnit || phase !== 'planning') {
    clearTargetRings();
    hideTargetPreviewCards();
    return;
  }

  let pool = effectiveAbility ? (targetType === 'ally' ? playerUnits : enemyUnits).filter(u => u.alive) : [];
  // Some abilities only make sense against a subset of that pool (e.g.
  // Babawibby's "Destrua uma Máquina de Guerra" should only ever be aimed
  // at a summoned Máquina de Guerra, not any ally). `targetFilter` on the
  // ability def, if present, narrows the pool further — only for the plain
  // (non-multi-step) selection; a step's own `filter` takes over during a
  // multi-step target step instead.
  if (effectiveAbility) {
    if (multiStepMode && effectiveFilter) pool = pool.filter(u => effectiveFilter(u));
    else if (!multiStepMode && effectiveAbility.targetFilter) pool = pool.filter(u => effectiveAbility.targetFilter(u));
  }

  renderTargetPreviewCards(effectiveAbility, pool, targetType);

  // Only tear down and rebuild the ring SET when the selection itself
  // changed (different unit, different ability, or the living-target
  // pool changed e.g. someone died). Otherwise just reposition the
  // existing elements — cheap, and never removes a node mid-gesture.
  const selectionChanged = targetRingState.selectedUnit !== effectiveUnit
    || targetRingState.selectedAbility !== effectiveAbility
    || targetRingState.targetRingEls.size !== pool.length
    || pool.some(u => !targetRingState.targetRingEls.has(u.uid));

  if (selectionChanged) {
    clearTargetRings();
    targetRingState.selectedUnit = effectiveUnit;
    targetRingState.selectedAbility = effectiveAbility;

    const ring = document.createElement('div');
    ring.className = 'selected-ring';
    labelLayer.appendChild(ring);
    targetRingState.selRingEl = ring;

    if (effectiveAbility) {
      pool.forEach(u => {
        const tRing = document.createElement('div');
        tRing.className = 'targetable-ring';
        tRing.addEventListener('click', () => queuePlayerAction(u));
        labelLayer.appendChild(tRing);
        targetRingState.targetRingEls.set(u.uid, tRing);
      });
    }
  }

  // Reposition (every call): target positions can drift slightly during
  // hit-shake etc., so keep coordinates fresh without touching the DOM
  // node identity.
  const selPos = worldToScreen(effectiveUnit.model.position.clone().add(new THREE.Vector3(0, 0.05, 0)));
  targetRingState.selRingEl.style.left = selPos.x + 'px';
  targetRingState.selRingEl.style.top = selPos.y + 'px';

  pool.forEach(u => {
    const el = targetRingState.targetRingEls.get(u.uid);
    if (!el) return;
    const pos = worldToScreen(u.model.position.clone().add(new THREE.Vector3(0, 0.05, 0)));
    el.style.left = pos.x + 'px';
    el.style.top = pos.y + 'px';
  });
}

function clearTargetRings() {
  document.querySelectorAll('.targetable-ring, .selected-ring').forEach(el => el.remove());
  targetRingState.selectedUnit = null;
  targetRingState.selectedAbility = null;
  targetRingState.selRingEl = null;
  targetRingState.targetRingEls.clear();
}

// ---- Target preview cards: small panel below the log button listing every
// currently-valid target for the selected ability, with a portrait swatch,
// name, and HP bar. Purely a convenience readout — clicking a card queues
// the same action as clicking that unit's in-scene target ring, via the
// same queuePlayerAction() used everywhere else, so there's exactly one
// code path for "a target was chosen" regardless of which UI element
// triggered it.
let targetPreviewState = {
  selectedAbility: null,
  targetType: null,
  cardEls: new Map() // unit.uid -> card element
};

function renderTargetPreviewCards(effectiveAbility, pool, targetType) {
  if (!effectiveAbility || pool.length === 0) {
    hideTargetPreviewCards();
    return;
  }

  const selectionChanged = targetPreviewState.selectedAbility !== effectiveAbility
    || targetPreviewState.targetType !== targetType
    || targetPreviewState.cardEls.size !== pool.length
    || pool.some(u => !targetPreviewState.cardEls.has(u.uid));

  if (!selectionChanged) {
    // Just refresh HP/shield readouts in place — no DOM churn mid-gesture.
    pool.forEach(u => updateTargetPreviewCard(targetPreviewState.cardEls.get(u.uid), u));
    return;
  }

  targetPreviewPanel.innerHTML = '';
  targetPreviewState.cardEls.clear();
  targetPreviewState.selectedAbility = effectiveAbility;
  targetPreviewState.targetType = targetType;

  pool.forEach(u => {
    const card = document.createElement('div');
    card.className = 'target-preview-card' + (u.team === 'enemy' ? ' enemy' : '');
    const def = UNIT_DEFS[u.defId];
    const swatchColor = def ? '#' + def.accentColor.toString(16).padStart(6, '0') : '#888';
    card.innerHTML = `
      <div class="tp-portrait" style="background:${swatchColor};"></div>
      <div class="tp-info">
        <div class="tp-name">${UnitText.displayName(u)}</div>
        <div class="tp-hpwrap"><div class="tp-hpfill" style="width:${Math.max(0, (u.hp / u.maxHP) * 100)}%"></div></div>
        <div class="tp-hptext">${u.hp}/${u.maxHP}${u.shield > 0 ? ' 🛡' + u.shield : ''}</div>
      </div>
    `;
    card.addEventListener('click', () => queuePlayerAction(u));
    targetPreviewPanel.appendChild(card);
    targetPreviewState.cardEls.set(u.uid, card);
  });

  targetPreviewPanel.classList.add('show');
}

function updateTargetPreviewCard(card, u) {
  if (!card) return;
  const fill = card.querySelector('.tp-hpfill');
  const text = card.querySelector('.tp-hptext');
  if (fill) fill.style.width = Math.max(0, (u.hp / u.maxHP) * 100) + '%';
  if (text) text.textContent = `${u.hp}/${u.maxHP}${u.shield > 0 ? ' 🛡' + u.shield : ''}`;
}

function hideTargetPreviewCards() {
  targetPreviewPanel.classList.remove('show');
  targetPreviewPanel.innerHTML = '';
  targetPreviewState.selectedAbility = null;
  targetPreviewState.targetType = null;
  targetPreviewState.cardEls.clear();
}

// --- Queue (not execute) the player's chosen action for this unit ---
function queuePlayerAction(target) {
  if (phase !== 'planning' || gameOver) return;

  // Mid multi-step flow: this target completes the CURRENT step. Record
  // it, advance, and either prompt the next step or finalize the plan
  // entry once every step is done.
  if (multiStepMode) {
    multiStepMode.chosen.push({ target });
    multiStepMode.stepIndex++;
    if (multiStepMode.stepIndex >= multiStepMode.steps.length) {
      finalizeMultiStepPlan(target);
    } else {
      const nextStep = multiStepMode.steps[multiStepMode.stepIndex];
      updateStatus(nextStep.kind === 'ability-choice'
        ? I18n.t('pv.status.echoChooseAbility', { unit: UnitText.displayName(multiStepMode.actor) })
        : (nextStep.targetType === 'ally'
          ? I18n.t('pv.status.echoChooseTargetAlly', { ability: UnitText.abilityName(multiStepMode.actor, currentStepAbility()) })
          : I18n.t('pv.status.echoChooseTargetEnemy', { ability: UnitText.abilityName(multiStepMode.actor, currentStepAbility()) })));
      renderPartyRow(); renderAbilityRow(); renderTargetRings();
    }
    return;
  }

  if (!selectedUnit || !selectedAbility) return;
  const actor = selectedUnit, ability = selectedAbility;

  const flow = abilityPromptFlow(ability, actor);
  if (flow.length > 0) {
    // Don't finalize the plan entry yet — stash the primary choice and
    // enter the multi-step flow for whatever extra ability/target steps
    // this ability declares.
    multiStepMode = { actor, primaryAbility: ability, primaryTarget: target, steps: flow, stepIndex: 0, chosen: [] };
    selectedUnit = null; selectedAbility = null;
    const firstStep = flow[0];
    updateStatus(firstStep.kind === 'ability-choice'
      ? I18n.t('pv.status.willHitEchoChoose', { ability: UnitText.abilityName(actor, ability), unit: UnitText.displayName(actor) })
      : (firstStep.targetType === 'ally'
        ? I18n.t('pv.status.echoChooseTargetAlly', { ability: UnitText.abilityName(actor, ability) })
        : I18n.t('pv.status.echoChooseTargetEnemy', { ability: UnitText.abilityName(actor, ability) })));
    renderPartyRow(); renderAbilityRow(); renderTargetRings();
    return;
  }

  // Replace any existing plan entry for this actor
  playerPlan = playerPlan.filter(p => p.actor !== actor);
  playerPlan.push({ actor, ability, target });

  selectedUnit = null; selectedAbility = null;
  const remaining = livingPlayerUnits().filter(u => !planEntryFor(u));
  updateStatus(remaining.length > 0
    ? I18n.t('pv.status.queuedNextUnit', { ability: UnitText.abilityName(actor, ability) })
    : I18n.t('pv.status.allReadyFight'));
  renderPartyRow(); renderAbilityRow(); renderTargetRings();
}

// Called once every step in multiStepMode.steps has been resolved (or a
// step fizzled with nothing eligible), assembling the final plan entry
// from the primary choice plus whatever was accumulated in `chosen`.
// This is the one place that maps the generic step results back onto the
// plan-entry shape resolution.js/effects.js already expect
// ({ echo: {ability,target} } for an ability-choice-then-target flow,
// { secondTarget } for a plain second target) — see the comment at
// abilityPromptFlow() for why the shape stays the same downstream.
function finalizeMultiStepPlan(lastTarget, { fizzled = false } = {}) {
  const { actor, primaryAbility, primaryTarget, steps, chosen } = multiStepMode;
  playerPlan = playerPlan.filter(p => p.actor !== actor);

  const abilityStepIdx = steps.findIndex(s => s.kind === 'ability-choice');
  let entry;
  if (fizzled) {
    entry = { actor, ability: primaryAbility, target: primaryTarget };
    updateStatus(I18n.t('pv.status.noEchoQueuedWithout', { unit: UnitText.displayName(actor), ability: UnitText.abilityName(actor, primaryAbility) }));
  } else if (abilityStepIdx !== -1) {
    // Echo/mirror-shaped flow: an ability-choice step followed by a target
    // step. The chosen ability is either what the player picked (echo) or
    // the step's fixedAbility (mirror); the target is whatever was queued
    // for the final 'target' step.
    const abilityStep = steps[abilityStepIdx];
    const chosenAbility = abilityStep.fixedAbility || chosen[abilityStepIdx].ability;
    entry = { actor, ability: primaryAbility, target: primaryTarget, echo: { ability: chosenAbility, target: lastTarget } };
    // chosenAbility may belong to a mirrored enemy unit rather than
    // `actor` (see beginMirrorFlow) — those defs are already authored in
    // English, so looking it up under `actor` still resolves correctly
    // via UnitText's fallback path when there's no overlay match.
    updateStatus(I18n.t('pv.status.echoComboQueued', { ability: UnitText.abilityName(actor, primaryAbility), ability2: UnitText.abilityName(actor, chosenAbility) }));
  } else {
    // Plain fixed-type second target, no ability re-choice (Babawibby's
    // sacrifice-then-damage).
    entry = { actor, ability: primaryAbility, target: primaryTarget, secondTarget: lastTarget };
    updateStatus(I18n.t('pv.status.queuedNextUnit', { ability: UnitText.abilityName(actor, primaryAbility) }));
  }

  playerPlan.push(entry);
  multiStepMode = null;
  selectedUnit = null; selectedAbility = null;
  const remaining = livingPlayerUnits().filter(u => !planEntryFor(u));
  if (remaining.length === 0) updateStatus(I18n.t('pv.status.allReadyFight'));
  renderPartyRow(); renderAbilityRow(); renderTargetRings();
}

// Called when the player picks a `promptsMirror` ability (e.g. Daxen-
// Ciris's Espelho do Defensor/Atacante). Unlike promptsEcho, the ability
// to cast is already fully determined (fastest ability of the enemy in
// `ability.mirrorRole`) before any target is picked at all, so this builds
// multiStepMode directly instead of going through abilityPromptFlow (which
// only builds steps AFTER a primary target already exists).
function beginMirrorFlow(ability) {
  const actor = selectedUnit;
  const ctx = { actor, playerUnits, enemyUnits };
  const mirroredUnit = ability.mirrorRole ? findEnemyByRole(ctx, ability.mirrorRole) : null;
  const mirroredAbility = mirroredUnit ? fastestAbilityOf(mirroredUnit) : null;

  if (!mirroredUnit || !mirroredAbility) {
    // Nothing valid to mirror (that enemy role is dead/missing) — queue
    // the ability as-is. Its own fixed effects (the heal/damage step)
    // still apply; the useAbilityOn step simply no-ops with nothing to copy.
    playerPlan = playerPlan.filter(p => p.actor !== actor);
    playerPlan.push({ actor, ability, target: actor });
    selectedUnit = null; selectedAbility = null;
    updateStatus(I18n.t('pv.status.mirrorNoTarget', { ability: UnitText.abilityName(actor, ability) }));
    renderPartyRow(); renderAbilityRow(); renderTargetRings();
    return;
  }

  multiStepMode = {
    actor, primaryAbility: ability, primaryTarget: actor,
    steps: [{ kind: 'ability-choice', fixedAbility: mirroredAbility }, { kind: 'target', targetType: mirroredAbility.targetType || 'enemy' }],
    stepIndex: 1, // ability side is already decided — jump straight to the target step
    chosen: [{ ability: mirroredAbility }]
  };
  selectedUnit = null; selectedAbility = null;
  updateStatus(I18n.t('pv.status.mirrorWillCopy', { ability: UnitText.abilityName(actor, ability), mirroredAbility: UnitText.abilityName(mirroredUnit, mirroredAbility), mirroredUnit: UnitText.displayName(mirroredUnit) }));
  renderPartyRow(); renderAbilityRow(); renderTargetRings();
}

// Called when the player taps an ability button while mid multi-step flow
// on an 'ability-choice' step (picking WHICH ability to echo, before
// picking its target).
function chooseMultiStepAbility(ability) {
  if (!multiStepMode) return;
  const step = multiStepMode.steps[multiStepMode.stepIndex];
  if (!step || step.kind !== 'ability-choice' || step.fixedAbility) return;
  multiStepMode.chosen[multiStepMode.stepIndex] = { ability };
  multiStepMode.stepIndex++;
  const targetType = step.targetTypeFor ? step.targetTypeFor(ability) : (ability.targetType || 'enemy');
  // Stash the resolved targetType onto the (now current) target step so
  // renderTargetRings/queuePlayerAction don't need to re-derive it.
  multiStepMode.steps[multiStepMode.stepIndex].targetType = targetType;
  updateStatus(targetType === 'ally'
    ? I18n.t('pv.status.chooseAllyEchoed', { ability: UnitText.abilityName(multiStepMode.actor, ability) })
    : I18n.t('pv.status.chooseEnemyEchoed', { ability: UnitText.abilityName(multiStepMode.actor, ability) }));
  renderAbilityRow();
  renderTargetRings();
}

// Cancels the multi-step flow entirely (e.g. player selects a different
// unit mid-flow), discarding the primary choice too since it was never queued.
function cancelMultiStepMode() {
  multiStepMode = null;
}

// =============================================================
// ============ SPEED-ORDERED RESOLUTION PHASE ===================
// =============================================================
// Both sides' actions (already fully decided) are merged into one
// list and sorted by ability speed (higher speed = acts first).
// Each entry still runs through the SAME AnimationEngine.play()
// pipeline, whether it originated from the player's plan or the AI.

// beginResolutionPhase / retargetIfDead now loaded from js/resolution.js (v2)
// Assigned onto window explicitly (not just `const`) because js/net/pvp.js
// needs to read AND reassign this as a real window property to install its
// PVP-aware wrapper — a bare top-level `const` only creates a binding in
// this script's module-level scope, not an actual `window.*` property, so
// `window.beginResolutionPhase` would silently read back as undefined and
// pvp.js's wrapper would crash calling it (TypeError: originalBeginResolutionPhase
// is not a function) the moment a real PVP round tried to resolve.
window.beginResolutionPhase = () => beginResolutionPhaseV2();

// A side loses when it has nothing left at all: no living unit on the
// field AND no card left in hand to replace one with. Field-only used to
// be enough (isTeamDefeated), but that's no longer correct now that a
// dead role slot can be refilled from hand between rounds (see
// resolveForcedReplacements in resolution.js) — a field wipe mid-round
// isn't a loss by itself if reinforcements are still waiting in hand.
function isSideOut(units, hand) {
  return CombatEngine.isTeamDefeated(units) && hand.length === 0;
}

function checkGameOver() {
  // Campaign has its own win/loss rule (bench/revival-aware permadeath —
  // CAMPAIGN_DESIGN.md §5.4), not the hand-based isSideOut() below.
  if (typeof Campaign !== 'undefined' && Campaign.isActive()) {
    const result = Campaign.checkCampaignGameOver();
    if (result === 'victory') { showOverlay(true); return true; }
    if (result === 'defeat') { showOverlay(false); return true; }
    return false;
  }
  if (isSideOut(playerUnits, playerHand)) {
    showOverlay(false);
    return true;
  }
  if (isSideOut(enemyUnits, enemyHand)) {
    showOverlay(true);
    return true;
  }
  return false;
}

function showOverlay(won) {
  gameOver = true;
  inputLocked = true;
  const title = document.getElementById('overlay-title');
  const sub = document.getElementById('overlay-sub');
  const restartBtn = document.getElementById('restart-btn');
  title.textContent = won ? I18n.t('pv.overlay.victory') : I18n.t('pv.overlay.defeat');
  title.className = won ? 'win' : 'lose';
  const isPvp = typeof PVP !== 'undefined' && PVP.isActive();
  // Campaign: distinct copy from Vs. AI/PVP, and the restart button below
  // is repointed to CampaignNodes.onBattleOverlayContinue instead of a
  // fresh draft — see that click listener's campaign branch.
  const isCampaign = typeof Campaign !== 'undefined' && Campaign.isActive();
  if (isCampaign) {
    sub.textContent = won ? I18n.t('pv.overlay.campaign.won') : I18n.t('pv.overlay.campaign.lost');
    restartBtn.textContent = won ? I18n.t('pv.overlay.campaign.continue') : I18n.t('pv.overlay.campaign.returnToMenu');
  } else {
    sub.textContent = won
      ? (isPvp ? I18n.t('pv.overlay.pvp.won') : I18n.t('pv.overlay.ai.won'))
      : (isPvp ? I18n.t('pv.overlay.pvp.lost') : I18n.t('pv.overlay.ai.lost'));
    restartBtn.textContent = isPvp ? I18n.t('pv.overlay.backToMenu') : I18n.t('pv.overlay.restartBattle');
  }
  overlay.classList.add('show');
}

document.getElementById('restart-btn').addEventListener('click', async () => {
  // Campaign: neither a fresh draft (Vs. AI) nor a match-leave (PVP) is
  // correct here — hand off to the campaign module, which knows whether
  // this was a win (return to map, collect node reward) or a loss
  // (permadeath check / run-over screen). See js/campaign/nodes.js.
  if (typeof Campaign !== 'undefined' && Campaign.isActive()) {
    overlay.classList.remove('show');
    CampaignNodes.onBattleOverlayContinue();
    return;
  }
  // LAN PVP: re-drafting locally and restarting would silently desync the
  // two clients (each side would pick a different random/human deck with
  // no way to agree on it without going through the connection again) —
  // safest is to end the match cleanly and return both players to the
  // menu, where they can host/join a fresh room if they want a rematch.
  if (typeof PVP !== 'undefined' && PVP.isActive()) {
    PVP.leaveMatch();
    overlay.classList.remove('show');
    MainMenu.openModePicker();
    return;
  }
  if (!lastChosenPlayerDeck) { openTeamSelect(); return; }
  const enemyDeck = pickRandomEnemyDeck();
  const playerStarter = await StarterSelect.runForPlayer(lastChosenPlayerDeck, UNIT_DEFS, TeamSelect.ROLE_ORDER);
  const enemyStarter = StarterSelect.pickForAI(enemyDeck, TeamSelect.ROLE_ORDER);
  initGame(playerStarter, enemyStarter);
});

// =============================================================
// ============ SECTION 11: IDLE ANIMATION LOOP + RENDER =========
// =============================================================

const clockObj = new THREE.Clock();

function updateIdle(unit, elapsed) {
  if (!unit.alive || !unit.idleActive) return;
  const t = elapsed + unit.idleClock;
  const bob = Math.sin(t * 2.2) * 0.045;
  unit.body.position.y = bob;
  unit.body.rotation.y = Math.sin(t * 1.3) * 0.06;
  if (unit.core) {
    const pulse = 0.35 + Math.sin(t * 3) * 0.15;
    if (unit.core.material) unit.core.material.emissiveIntensity = pulse;
  }
  if (unit.weapon) {
    unit.weapon.position.y += Math.sin(t * 2.6) * 0.0015;
  }
  // Character-specific idle flourish layered on top of the generic bob/pulse
  // above, if this character has one. Runs after so it can override rotation
  // axes the generic idle doesn't touch (e.g. Babawibby's extra sway).
  const profile = CHARACTER_ANIM_PROFILES[unit.defId];
  if (profile && profile.idleExtra) profile.idleExtra(unit, t);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clockObj.getDelta(), 0.05);
  const elapsed = clockObj.getElapsedTime();

  animRunner.tick(dt);
  updateParticles(dt);
  updateCameraOrbit(dt);
  updateCameraShake(dt);

  [...playerUnits, ...enemyUnits].forEach(u => updateIdle(u, elapsed));

  updateLabelPositions();
  if (!inputLocked) renderTargetRingsThrottled();

  renderer.render(scene, camera);
}

// Ring positions are recomputed every frame now (cheap: renderTargetRings
// repositions existing DOM nodes rather than recreating them, see the
// selectionChanged guard inside it). This used to be throttled to every
// 6th frame under the assumption the camera was static during planning,
// but that's no longer true now that the camera idly orbits during
// planning — throttling would make rings visibly lag behind their units.
function renderTargetRingsThrottled() {
  if (selectedUnit || document.querySelectorAll('.targetable-ring').length) {
    renderTargetRings();
  }
}

