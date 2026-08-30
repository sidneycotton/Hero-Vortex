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
js/units/             All card/unit data, split one file per character (plus
                      core.js for shared helpers and index.js for roster
                      assembly). This is what you edit 90% of the time —
                      adding a card almost never means opening any other
                      character's file.
js/combat-engine.js   Pure combat logic (no Three.js/DOM). Walks each ability's
                      effects[] through the verb pipeline. resolve()/apply()
                      stay split so animations can sync to the impact frame.
js/resolution.js      Round orchestrator: speed-sorts queued actions, handles
                      status-driven reordering/retargeting, splices in forced
                      actions, ticks end-of-round statuses (e.g. Bleed).
js/team-select.js     Standalone pre-game team-select screen (own module,
                      own state, own DOM under #team-select-mount, own
                      Three.js renderer/scene/camera for the card preview
                      — fully separate from the battle scene's renderer).
                      Shows one full character card at a time: big 3D
                      render (idly animated, same bespoke model as battle)
                      + full ability list + a summon showcase (mini preview
                      of any unit a `summon` verb creates) + left/right nav
                      arrows to cycle the active role's pool + an always
                      -visible deck panel with an Add to Deck button. Scales
                      to any roster size since only ONE character's model
                      is ever built at a time; role tabs + name/ability
                      -text search narrow what the arrows cycle through.
                      index.html only calls TeamSelect.open({pool,
                      roleOrder, onConfirm}) — no shared globals either way,
                      except calling index.html's buildUnitModel(def) at
                      call-time to render the preview.
css/team-select.css   Styling for the above, kept separate so the module is
                      fully self-contained (index.html's own <style> block
                      no longer has any .ts-* rules).
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
single-step `effects[]` at load time in `units/core.js` (`upgradeLegacyAbility`).
You never need to convert old cards unless you want to add a second effect
to one.

## Adding a new card

1. Create `js/units/<your_char_id>.js`.
2. In it, assign an entry onto `MODERN_UNIT_DEFS` (or `LEGACY_UNIT_DEFS` if
   every ability is a single plain damage/heal/shield with no extra
   mechanic — either works, legacy is just less typing for simple cards):
   `MODERN_UNIT_DEFS.your_char_id = { ... };`. Use any existing file in
   `js/units/` (e.g. `ajax.js`) as the template for the exact shape.
   Then add `<script src="js/units/your_char_id.js"></script>` to
   `index.html`, placed after `js/units/core.js` and before
   `js/units/index.js`.
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

## Deck/hand/battlefield system (implemented)

Team-select and battle start have a real deckbuilding layer instead of
"draft one card per role and it's instantly on the field." Implemented in
four parts:

**1. Team-select: 2 picks per role**
`js/team-select.js`'s `state.picks[role]` is an array of up to 2 unit ids
per role. Deck panel UI shows 2 slots per role. `onConfirm` produces
`{ defender: [id, id], attacker: [id, id], support: [id, id] }` per side.

**2. "Choose your starter" modal at battle start**
`js/starter-select.js` — after team-select confirms, both the player AND
the enemy AI go through this: 3 sequential modals (defender pair →
attacker pair → support pair). Player clicks a card to choose; AI
auto-picks. The chosen unit spawns as a live `Unit` on the battlefield in
that role's slot; the other becomes a **hand-card record** — `{ defId,
role, side }`, no `Unit` instance, no HP/position, just data — pushed to
`playerHand`/`enemyHand` (populated in `initGame`, `js/planning-ui.js`).
This is groundwork for future cards that care about "was I the one played
first" or "affect cards while in hand."

**3. Death → forced replacement**
`resolveForcedReplacements()` (`js/planning-ui.js`, called from
`js/resolution.js` after each round resolves) scans both sides for empty
role slots. For each empty slot — sequential modal per slot if more than
one died in the same round, blocking until resolved — if a hand card
exists for that role, the player (or AI) is forced to play it: no
"decline" option. Spawns as a new `Unit` in that slot, removed from hand.
If no hand card remains for that role, the slot stays empty permanently —
no further prompts for it.

**4. Win/loss condition rework**
`isSideOut()` (`js/planning-ui.js`) replaces the old "is the 3-unit field
empty" check with "field AND hand are both empty" for that side:
`CombatEngine.isTeamDefeated(units) && hand.length === 0`. Wired into
`checkGameOver()`, checked at the same points as before (after a round's
actions resolve) plus again after forced replacement resolves, since a
side could have an empty slot with an empty hand (permanently short a
card) without otherwise being defeated.

**Not yet built on top of this:** no passive/hook effects for hand-cards
yet (e.g. "gains +X while in hand," "cheaper if played first") — only the
data structure to support wiring those in later, via the hook registry
(`Hooks` in `js/effects.js`) once that mechanic is designed. No stacking
statuses, no persistent status/counter UI, no toon-shading pass, no
`forceImmediateAction` bonus-action support — those remain open items.

## Workflow going forward

- Batch simple cards (reusing existing verbs) together — cheap, mostly data.
- Bundle new-mechanic cards that need genuinely new verbs into the same
  session as the verb/engine work they require, rather than one-at-a-time.
- Point future conversations at the specific file that needs editing
  (usually just `js/units.js`) rather than pasting the whole project, unless
  the change is architectural (new verb, new round-resolution behavior).

## Full guide: adding a new character to the game

This walks every step for taking a character from concept art to a fully
playable card with a bespoke 3D model — not just the data-entry part above.
Follow it in order; each step depends on the last.

### Step 1 — Read the concept art carefully, don't reuse another character's shape

Before writing any Three.js code, look at what's actually unique about the
silhouette: what's on the head (or isn't — some characters, like Daxen-Ciris,
have no head at all), how the torso/skirt reads, what the hands are doing,
what one or two silhouette elements exist on THIS character and nobody else
(a hanging medallion, an asymmetric skirt, a popped collar, a batwing sleeve).
**The single most common mistake is starting from a copy of an existing
builder function and only reskinning the palette.** That produces a model
that reads as "Yvrel but red" instead of its own character. Instead:

1. List the 4-6 silhouette features that make this character distinct.
2. For each one, decide which primitive (sphere, torus, cylinder) and which
   position/scale expresses it — don't reach for whatever the last character
   used at that body location just because it's convenient to copy-paste.
3. Only reuse ANOTHER character's code for genuinely generic infrastructure:
   the shoulderPivot/elbowPivot joint-chain pattern itself, `makeCapsule()`,
   material-cloning boilerplate. Never reuse another character's actual
   part-by-part geometry as a starting point for a "different" character.

### Step 2 — Decide the color/glow family

Every bespoke character gets its own 2-3 tone main/armor/accent palette,
plus ONE glow family (a color used only for emissive accents — eyes, gems,
energy effects). Check the `GLOW_FAMILIES` registry in `js/models/core.js`
before picking one — it should not collide with an existing character's
glow hex. Add your new character's hex to `GLOW_FAMILIES` there as part of
this step; `checkGlowFamilyCollisions()` (run automatically by
`tests/model-regression.js`) will fail the build if it collides with an
existing entry, so you don't have to eyeball every other character's file
by hand anymore.

### Step 3 — Write the bespoke builder function in `js/models/<your_char_id>.js`

Create the file with a `function build<Name>Model(bodyGroup, mainMat, accentMat, def) { ... }`
(use any existing file in `js/models/`, e.g. `yvrel.js`, as the template
for the neighborhood/shape). Hard rules, all learned from real bugs in this
project:

- **Geometry**: only `SphereGeometry` (scaled via `.scale.set()`) and
  `TorusGeometry`, plus `CylinderGeometry`/`makeCapsule()` for straight
  segments. No `BoxGeometry`, no sharp `ConeGeometry`.
- **Required mesh names**: somewhere in the hierarchy you MUST have a mesh
  named exactly `"torso"`, `"head"`, and `"core"`, plus usually `"weapon"`.
  These are read via `getObjectByName` by the shared animation system
  (squash/stretch, idle glow pulse, attack recoil) regardless of nesting
  depth. If your character is headless (like Daxen-Ciris), the `"head"`
  name still has to go on SOMETHING — pick whatever part should visually
  bob/react in its place (an orb, a floating gem, a collar ornament).
- **Arms are a real joint chain**, never a single static mesh positioned
  "to look right": `shoulderPivot` (Group) → pauldron/upperArm mesh
  children → `elbowPivot` (Group, child of shoulderPivot) → forearm/hand/
  claws/weapon mesh children (children of elbowPivot). Anything the hand
  holds gets parented to the elbowPivot (or a hand submesh), never placed
  as an independent sibling — otherwise rotating the shoulder sweeps it
  through the torso.
- **Buried geometry check**: for every "detail" mesh you add on top of a
  larger parent mesh (a collar hollow, a decorative gem, a cape fold),
  verify its `position` + half-thickness on the relevant axis actually
  reaches or exceeds the parent's radius. A detail mesh centered inside its
  parent at a similar radius is invisible, not just occluded — this has
  bitten every character built so far at least once.
- **Contrast check**: for any feature that needs to visually pop (a mouth
  line, an eye, a trim edge), use a real high-contrast material — a fresh
  near-black (`0x1c2226`-ish) or a genuine accent color — never
  `mainMat.clone(); .color.multiplyScalar(0.6)`. A 40% darken of a mid-tone
  base produces another mid-tone that's invisible in flat toon shading.
- Return `[primaryBodyMesh, headMesh]` at the end (see any existing builder
  for the exact pattern — it's usually `[chest, head_]` where `head_ =
  headGroup.getObjectByName("head")`).

### Step 4 — Register the builder

At the bottom of your new `js/models/<your_char_id>.js` file, register it
onto the shared registry (declared empty in `js/models/core.js`):

```js
BESPOKE_BUILDERS.your_new_char = buildYourNewCharModel;
```

Then add `<script src="js/models/your_char_id.js"></script>` to
`index.html`, placed after `js/models/core.js` and before
`js/models/index.js` (which defines `buildUnitModel`/`validateUnitModel`
and expects every builder already registered by the time it runs).

### Step 5 — Add the unit's data entry in `js/units/<your_char_id>.js`

Assign an entry onto `MODERN_UNIT_DEFS` (or `LEGACY_UNIT_DEFS` for simple
single-effect cards — see "Adding a new card" above for the full
data-format rules). The fields that connect to the model you just built:

- `id`: must match the key you used in `BESPOKE_BUILDERS`.
- `shape`: must be the exact same string as the `BESPOKE_BUILDERS` key
  (this is how `buildUnitModel(def)` finds and dispatches to your builder).
- `color` / `accentColor`: the base hex values passed into `mainMat`/
  `accentMat` before your builder clones and re-tints them per-part.
- `team`: `"player"` if this is a hero the person can draft into their own
  roster (shows up automatically in the team-select screen — see Step 7),
  `"enemy"` if it's a fixed opponent unit.
- `role`: `"defender" | "attacker" | "support"` — fixes which of the 3
  battle slots (left/middle/right) this unit occupies.
- `stats.maxHP`, `stats.speed`.
- `abilities`: 3 entries, each needs `id`, `name`, `desc` (shown in the
  UI), `speed`, `animKey` (`skill1`/`skill2`/`skill3`), and `effects: [...]`
  built from the verb pipeline (see "The core idea: cards are data,
  mechanics are verbs" above). If the mechanic needs a verb the pipeline
  doesn't have yet, add it generically to `EffectVerbs` in `effects.js`
  rather than special-casing it — see Daxen-Ciris's `nullifyNext` status
  and the `findEnemyByRole`/`fastestAbilityOf` helpers in `units/core.js`
  for a worked example of adding new generic building blocks for a new
  mechanic.

### Step 6 — Slot the unit into a roster order (only for fixed starters)

Enemy teams are drawn randomly from the same `team: "player"` pool (see
`pickRandomEnemyOrder`/`pickRandomEnemyDeck` in `js/units/index.js`), so
new units don't need any roster-order entry to show up as opponents.
`team: "player"` units do NOT go in `PLAYER_ORDER` (also in
`js/units/index.js`) unless you want them as one of the fixed starting
trio — normally you just leave them out and let the draft screen handle it
(next step). Summon-only units (never drafted directly) get added to the
`summonOnly` set inside both of those functions instead.

### Step 7 — Team-select screen (automatic — usually nothing to do here)

The pre-game draft screen (`TeamSelect.buildDraftPool()` in
`js/team-select.js`, called from `openTeamSelect()` in `index.html`)
automatically lists every `UNIT_DEFS` entry with `team: "player"`, grouped
by role, EXCEPT ids listed in `TeamSelect.SUMMON_ONLY_UNIT_IDS` (units that
only ever appear via the `summon` verb mid-battle, like Máquina de Guerra).
As long as Step 5 set `team: "player"` correctly, the new hero appears in
the draft picker with no extra wiring — the screen is a virtualized list
(see `js/team-select.js`), so it scales to any roster size without needing
per-character UI changes. Only touch `SUMMON_ONLY_UNIT_IDS` (in
`js/team-select.js`) if the new character should NOT be directly draftable
(i.e. it's a summon-only unit like Máquina de Guerra).

### Step 8 — Verify with the headless regression check before touching the real page

Don't eyeball it in the browser first. Run the committed test:

```
node tests/model-regression.js
```

This loads every file in `js/units/` + `js/models/` (in the same order as
their `<script>` tags in `index.html`) into a Node `vm` context against
`tests/fake_three.js` (a minimal fake-THREE stub) and calls
`validateUnitModel(def)` — from `js/models/index.js` — for every character
in `BESPOKE_BUILDERS`. It checks:

1. `buildUnitModel(def)` doesn't throw.
2. `torso`, `head`, `core` all resolve via `getObjectByName` (`weapon`
   warns rather than fails, since not every character has one).
3. Mesh count is sane (8-80) — a wildly low count usually means a
   copy-paste left dead code, a wildly high count usually means
   duplicated geometry.
4. No material anywhere in the tree lost its `.color`/`.emissive` Color
   object (the exact "material clone losing its color" bug class below).
5. `checkGlowFamilyCollisions()` — no two characters share the same
   `GLOW_FAMILIES` hex (see Step 2).

It re-checks every OTHER existing bespoke character too, in the same run,
so a new registration/edit that breaks something else fails immediately.

This catches null-reference crashes, naming regressions, and buried/
invisible geometry before ever loading the real page — much faster than
iterating in-browser, and it's caught several real bugs in this project
(a rotation method not stubbed correctly, a material clone losing its
color object, a detail mesh centered inside its own parent).

While you're in there: also run `node tests/unit-data-check.js`, which
does the equivalent sanity pass over `js/units/`'s ability data (every
`effects[].verb` resolves in `EffectVerbs`, every `select()`/`target()`
function runs without throwing against a synthetic multi-unit battle).
Cheap, and catches a broken ability edit before it ever reaches a real
match.

### Step 9 — Only then, load the real game and eyeball it

Once the headless check passes, open `index.html` via a local server (not
`file://`) and actually look at the character: silhouette from the front,
resting arm pose, and — if it has one — the weapon/effect readability
during an attack. This is also the point to sanity-check the color/glow
family doesn't clash with whichever units it'll typically stand next to.

### Step 10 — Animation profile (optional, later pass)

New characters don't need bespoke animation flourishes on day one — they
automatically get the generic attack/hurt/idle choreography. Only add an
entry to `CHARACTER_ANIM_PROFILES` (once that system is built out — see
"Planned: toon-shading visual pass" above) if/when the character's
personality specifically calls for a flourish the generic animation
doesn't capture. Don't block shipping a new card on this.

