# Tests

Headless, no-browser sanity checks. Both exit non-zero on failure, so
either can be wired into a pre-commit hook or CI later — nothing here
depends on `document`/WebGL/a real server.

```
node tests/model-regression.js
node tests/unit-data-check.js
node tests/item-data-check.js
```

## `model-regression.js`

Runs `validateUnitModel(def)` (defined in `js/models/index.js`) against every
character in `BESPOKE_BUILDERS`, using `fake_three.js` as a stand-in for
`window.THREE`. Checks required mesh names (`torso`/`head`/`core`),
sane mesh count, and that no material lost its `.color`/`.emissive`
object. Also runs `checkGlowFamilyCollisions()` against the
`GLOW_FAMILIES` registry.

Run this after adding or editing any bespoke character model (see
handoff.md's Step 8).

## `unit-data-check.js`

Loads `js/units/` + `js/effects.js` + `js/combat-engine.js` and, for
every ability/sub-ability on every `UNIT_DEFS` entry: checks the shape
(`id`/`name`/`speed`/`effects[]`), confirms every `effects[].verb`
resolves in `EffectVerbs`, and actually RUNS `runEffectChain` against a
synthetic full-roster battle (so any `select()`/`target()` function that
throws is caught, not just shape-checked).

Run this after adding or editing any ability's data.

## `item-data-check.js`

Loads `js/campaign/items.js` (plus `js/units/` + `js/effects.js` for real
`UNIT_DEFS`/`StatusLib`) and, for every entry in `Items.ITEM_POOL`: checks
shape (`id`/`name`/`desc`/`rarity`/`price`/`onEquip`/`onUnequip`, and for
ability-swap items that `replacesAbilityId` matches a real ability
somewhere in `UNIT_DEFS` and `replacementAbility.effects[]` only uses real
`EffectVerbs`), then actually equips + unequips it on a synthetic unit and
confirms `maxHP`/`hp`/`statuses`/`equippedItem` all land back exactly
where they started — and that `def.abilities` (the real `UNIT_DEFS` entry)
was never mutated in place, only a per-unit copy. Also checks that
equipping a second item over an existing one cleanly unequips the first.

Run this after adding or editing any campaign item.

## `fake_three.js`

Not a real three.js reimplementation — only the surface area the
bespoke builders in `js/models/` actually call (`Group`/`Mesh`/
`Vector3`/`Color`/materials/geometries/`.add()`/`.getObjectByName()`/
`.traverse()`). If a builder calls something this stub doesn't support,
that's usually a sign the stub needs a small addition, not that the
builder is wrong — but double check against real three.js's actual
signature first (see the `.add()` comment in this file for why that
matters: a stub that's too forgiving can hide a real bug).
