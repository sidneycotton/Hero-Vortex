# Hero Vortex — Handoff

## What this is

Hero Vortex is a mobile card game prototype: 3v3 team battles where each side
plans a full round of abilities (one per unit), then the round resolves in
speed order with animated Three.js combat. This folder is the engine MVP,
evolved from a single-file demo into a small multi-file project so new cards
can be added mostly as **data**, not new engine code.

Every team is exactly one **Defender** (left slot), one **Attacker** (middle
slot), one **Support** (right slot). Cards are meant to be highly unique —
most cards should introduce at least one new mechanic — which is the whole
reason the effect system below exists.

## File layout

```
game.html            The app shell: Three.js scene, UI, animation choreography,
                      round orchestration glue. Open this file (via a local
                      server, not file://) to play.
js/effects.js         Generic effect-verb pipeline + status-effect framework.
                      This is the highest-leverage file in the project.
js/units.js           All card/unit data. This is what you edit 90% of the time.
js/combat-engine.js   Pure combat logic (no Three.js/DOM). Walks each ability's
                      effects[] through the verb pipeline. resolve()/apply()
                      stay split so animations can sync to the impact frame.
js/resolution.js      Round orchestrator: speed-sorts queued actions, handles
                      status-driven reordering/retargeting, splices in forced
                      actions, ticks end-of-round statuses (e.g. Bleed).
```

`game.html` loads `effects.js` → `units.js` → `combat-engine.js` before its
own inline script, and loads `resolution.js` after (it calls functions
defined in the inline script, like `renderOrderStrip` and `checkGameOver`).

## The core idea: cards are data, mechanics are verbs

Each ability has an `effects` array. Each entry is a "verb" the engine
already knows how to run:

```js
{
  id: "bleedstrike", name: "Golpe Sangrento", speed: 8, animKey: "skill2",
  effects: [
    { verb: "damage", target: "target", amount: 10 },
    { verb: "applyStatus", target: "target", status: () => StatusLib.bleed(5) }
  ]
}
```

Verbs currently implemented (`js/effects.js`):

| verb | what it does |
|---|---|
| `damage` | deal damage; `ignoresShield: true` skips shield absorption |
| `heal` | restore HP; any heal auto-cleanses statuses with `cleanseOn: 'anyHeal'` |
| `shield` | grant shield points |
| `applyStatus` | attach a status object (bleed, untargetable, moveLast, or a new one) |
| `removeStatus` | strip a status by id |
| `gainCounter` / `spendCounters` | banked per-unit resource counters (e.g. Mariana's Proteção) |
| `forceImmediateAction` | flags a unit whose queued action should be spliced to run right now (handled by `resolution.js`) |
| `useAbilityOn` | sub-cast one of the actor's own abilities on a chosen target (pick logic via `select(ctx)`) |
| `repeatIf` | conditionally re-runs a nested `effects[]` block against the same target — used for chain/combo abilities |
| `note` | free-text log line with no numeric effect, for flavor/clarity |

`target` in a step can be `'target'`, `'self'`, or a function `(ctx) => unit`
for anything conditional (random ally, lowest-HP ally, etc.). `amount` can
similarly be a number or a function `(ctx) => number`.

**Old-format abilities still work.** Anything written as
`{ type: 'attack'|'heal'|'shield', power: N }` is auto-upgraded into a
single-step `effects[]` at load time in `units.js` (`upgradeLegacyAbility`).
You never need to convert old cards unless you want to add a second effect
to one.

## Adding a new card

1. Open `js/units.js`.
2. Add an entry to `MODERN_UNIT_DEFS` (or `LEGACY_UNIT_DEFS` if every ability
   is a single plain damage/heal/shield with no extra mechanic — either
   works, legacy is just less typing for simple cards).
3. Give it `id`, `displayName`, `team`, `role` (`defender`/`attacker`/`support`),
   visual fields (`color`, `accentColor`, `shape`), `stats.maxHP`, and 3
   abilities.
4. For each ability: `id`, `name`, `desc` (shown in the UI), `speed`,
   `animKey` (`skill1`/`skill2`/`skill3` — picks which choreography plays),
   and `effects: [...]`.
5. If the mechanic needs a **new verb** the pipeline doesn't have yet, add
   it to `EffectVerbs` in `effects.js` (keep it generic/reusable, not
   card-specific) and wire any round-level behavior it needs into
   `resolution.js` (see how `forceImmediateAction` and the status-tick /
   retarget logic work there as the pattern to follow).
6. Add the unit's id to `PLAYER_ORDER` or `ENEMY_ORDER` in the right slot
   position (index 0 = defender/left, 1 = attacker/middle, 2 = support/right).

Most new cards should NOT require touching `combat-engine.js` or
`resolution.js` at all — that's the point of the pipeline. If a card's
mechanic genuinely can't be expressed with the existing verbs, that's the
signal to add one new generic verb (not a one-off special case), so the next
five cards that want something similar can reuse it too.

## Status effects

Defined via `StatusLib` in `effects.js`. A status is:

```js
{ id, name, kind, data, tickTiming, cleanseOn, duration, stacking }
```

- `tickTiming: 'roundEnd'` — ticked once per unit at the end of the round by
  `resolution.js` (see `tickRoundEndStatuses`). Currently only `bleed` does
  this; add more `kind`s to `tickRoundEndStatuses` as needed (poison, regen,
  etc. all fit this same shape).
- `cleanseOn: 'anyHeal'` — auto-stripped the moment the unit receives any
  heal effect (`combat-engine.js` calls `cleanseOn(target, 'anyHeal')`
  inside the heal verb).
- `duration: 'thisRound'` — expired automatically at end of round via
  `expireRoundScopedStatuses`. Untargetable and moveLast use this.
- Applying a status that's already active refreshes it rather than
  stacking, unless you explicitly want stacking (add that behavior to
  `applyStatusToUnit` if a future card needs true stacks).

## Combat resolution flow (per round)

1. Player queues one action per living unit (planning phase).
2. AI (`AI.decideForActor`, still in `game.html`) queues one action per
   living enemy unit using the same weighted-candidate heuristic as before,
   now reading `primaryEffectType(ability)` instead of a raw `.type` field
   (since abilities can mix verbs, this derives a "flavor" — attack/heal/
   shield/other — for AI heuristics and animation choreography selection).
3. All actions are merged and sorted by ability speed (ties randomized).
4. Units with `moveLast` are pushed to the end of the order.
5. Actions resolve one at a time: dead or `untargetable` targets get
   re-routed via `retargetIfDead`; `forceImmediateAction` results splice the
   named unit's still-queued action to run immediately after the current one.
6. At round end, `roundEnd`-tick statuses (bleed) apply, then
   `thisRound`-scoped statuses expire.

## Known gaps / next steps

- **Visuals**: only two body archetypes exist (`brute`, `caster`) in
  `buildUnitModel` inside `game.html`. Ajax/Yvrel/Mariana currently borrow
  these with new colors — they don't yet visually read as a shark-brute,
  dark caster, and light caster. Worth a small library of ~5-6 parametrized
  archetypes before adding many more cards, so distinct silhouettes stay
  cheap instead of fully bespoke per card.
- **No stacking statuses yet** — reapplying a status refreshes it. Add
  stacking behavior in `applyStatusToUnit` if a future card wants stacks
  (e.g. multiple bleed instances).
- **`forceImmediateAction` only reorders within the current round's queue.**
  It can't currently grant a bonus action beyond what's already queued
  (per your ruling, it isn't supposed to — it just moves the existing
  queued action earlier).

## Known bugs (confirmed, not yet fixed)

- **Targeting sometimes needs several taps before a ring click registers.**
  Root cause: `renderTargetRingsThrottled()` in `game.html` re-runs
  `renderTargetRings()` every 6 animation frames (~100ms) while a unit/ability
  is selected. `renderTargetRings()` starts by deleting every existing
  `.targetable-ring`/`.selected-ring` element and creating fresh ones. If
  that wipe-and-recreate lands between a touch/click's `pointerdown` and
  `pointerup`/`click`, the DOM node the gesture started on no longer exists
  by the time the click would fire, so the tap is silently lost — the next
  tap then lands on a freshly (re)created ring and works. This is a
  pre-existing behavior from the original single-file demo, not something
  introduced by the recent refactor, but it's more noticeable now that we
  actually got a real bug report on it. Fix options, roughly in order of
  effort: (a) stop unconditionally recreating rings every throttle tick —
  only re-run `renderTargetRings()` when the camera has actually moved or
  `selectedUnit`/`selectedAbility` changed, since target positions barely
  move between frames in this game; (b) reposition existing ring elements
  in place instead of remove+recreate, only adding/removing elements when
  the target set itself changes; (c) as a stopgap, increase the throttle
  interval so the collision window is rarer (doesn't fix it, just hides it).
  Option (a) or (b) in `renderTargetRingsThrottled`/`renderTargetRings`
  (`game.html`) is the real fix.

- **Bleed (and any other status) has no persistent visual indicator, and
  neither do counters (e.g. Mariana's Proteção).** Root cause: `unit.statuses`
  and `unit.counters` are fully tracked in game state (see `js/effects.js`
  and `js/combat-engine.js`) and DO fire a one-shot floating-text pop when
  first applied/gained (`renderFloatingNumbers` in `game.html` handles the
  `applyStatus`/`gainCounter` verbs), but nothing renders them *persistently*
  the way `.shield-pip` renders ongoing shield value. Once the floating text
  fades (~1.1s), there's no way to see a unit is still bleeding or how many
  Proteção counters Mariana is holding, unless you check the combat log.
  Fix: extend the unit label template in `buildLabelLayer()` (`game.html`,
  same place `.shield-pip` is built) with a small status/counter row, and
  update `refreshAllUnitUI()` to populate it from `u.statuses` (show status
  `name`/icon, maybe a small tick count if stacking is ever added) and
  `u.counters` (show `counterName: value` for any non-zero counter). Keep it
  generic — reading directly off `u.statuses`/`u.counters` rather than
  hardcoding "bleed" and "protecao" — so it automatically covers whatever
  new statuses/counters future cards introduce.

## Planned: toon-shading visual pass (not started yet)

Vitor shared a reference file (`babawibby_zoom_v3.html`, a standalone Three.js
animation he built separately) showing a much stronger toon art style than
what's currently in `game.html`. Plan, before any code changes:

**1. Material/shading system — applies to all named characters (Ajax, Yvrel,
Mariana, Babawibby, Máquina de Guerra):**
- Swap the current materials for `THREE.MeshToonMaterial` + a canvas-based
  gradient map (see `makeToonGradient`/`toon()` helpers in the reference file).
- Replace the current outline pass (which only clones `torso`/`head`/
  sometimes `backpack` — see `outlineParts` handling in `game.html`) with a
  **per-mesh outline**: every individual part gets its own backface-scaled
  outline child, matching `addOutline`/`makeToonMesh` in the reference file.
  This also means the `makeCapsule()` helper added recently needs to route
  each of its 3 sub-meshes (cylinder + 2 caps) through the same per-mesh
  outline helper, the way the reference file's own `makeCapsule` does.

**2. Reusable animation-move library — architecture decided:**

The game already has most of the low-level primitives needed for this
(`Clip`, `Easing`, `AnimationRunner`/`animRunner`, and step builders like
`squashStretchStep`, `scaleStep`, `moveStep`, `waitStep`, `callbackStep` —
see around line 380-550 in `game.html`). What's missing is the layer above
them. Plan:

1. **`MoveLibrary`** — a set of generic, parametrized move functions built
   on top of the existing step builders (e.g. `popIn(obj, {scale, duration,
   easing})`, `squashStretch(obj, {intensity, duration})`, `bounceHop(obj,
   {height, duration})`, `wobble(obj, {axis, amount, speed})`,
   `groundShadowPulse(shadowMesh, {...})`). These are generic — no
   character-specific logic lives here.
2. **`CHARACTER_ANIM_PROFILES`** — a per-character table where each named
   character lists which library moves it uses for which moments (spawn,
   attack windup, impact, idle, etc.), each with its own parameter values.
   Characters that don't need a flourish at a given moment just don't
   list one there — falls back to the existing generic behavior.
3. **Hooks in the existing choreography functions** (`runAttackAnimation`,
   `runSupportAnimation`, `hurt`, `dead`, idle loop) so they check a unit's
   profile (if any) and layer the extra move(s) on top of/instead of the
   generic step, rather than every unit sharing identical animation code.

**First round of characters to cover in the library (not just Babawibby):**
- **Babawibby** — comedic tone. Candidates: pop-in with `easeOutBack`,
  squash & stretch, ground-contact shadow, maybe a little bounce/wobble.
- **Ajax** — strong/impetuous tone, deliberately different feel from
  Babawibby so the library proves it can span more than one personality
  from the start. General flavor: heavier squash/stretch (less bouncy,
  more weighty impact), more forceful wind-up/lunge, less "cute" easing
  (e.g. sharper `cubicOut` instead of `elasticOut`/`backOut`).

  Confirmed per-ability mapping (corrects an earlier draft of this plan):
  - **`duel` / skill1 ("Duelo")** — new reusable move: `boxingGlove`. A
    boxing-glove mesh appears over the point of impact on the target and
    the hit lands. This is meant to be a **generic fighting-type impact
    move**, not Ajax-specific — any future ability across characters that
    wants a "punch" impact can reuse it (parametrized by target position,
    glove size/color, timing).
  - **`bleedstrike` / skill2 ("Golpe Sangrento")** — new reusable move:
    `biteJaw`. Two separate mesh shapes (upper jaw, lower jaw — not the
    character's own head model) spawn positioned over the target, open,
    then snap shut on the impact frame, then despawn. Generic monster-bite
    move, reusable by any future monster-type character, not just Ajax.
  - Skill1 and skill2 **share the same approach/attack animation base**
    (wind-up → approach → attack), only swapping which impact-moment
    visual fires (glove vs jaw) — they shouldn't need two separate
    choreography functions, just two different impact-effect plug-ins
    into the same shared sequence.
  - **`chainstrike` / skill3 ("Corrente Fatal")** — dash-in/dash-out
    attack. Uses `repeatIf` already (see `js/units.js`) to potentially
    land 1–3 hits (bleed-triggered second hit, low-HP-triggered third
    hit). Each time a repeat fires, Ajax does a **full dash to the target
    and back** again (not just a faster/extra hit without the travel) —
    so up to 3 full dash-in/dash-out cycles can play in a single skill3
    use.

Yvrel/Mariana/Máquina de Guerra: material/outline upgrade only in this
pass (see above). Animation profiles for them come later, once the
library has proven itself on two contrasting characters.

**Not in scope for this pass:** the reference file's turret-building
choreography, camera shake, dust clouds, speed streaks, and caption system
are a one-off animation demo, not something being ported into the actual
game loop.

## Workflow going forward

- Batch simple cards (reusing existing verbs) together — cheap, mostly data.
- Bundle new-mechanic cards that need genuinely new verbs into the same
  session as the verb/engine work they require, rather than one-at-a-time.
- Point future conversations at the specific file that needs editing
  (usually just `js/units.js`) rather than pasting the whole project, unless
  the change is architectural (new verb, new round-resolution behavior).
