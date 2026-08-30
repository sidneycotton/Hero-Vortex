
// Signature glow-family anchor color per bespoke character — the ONE
// emissive color used for that character's eyes/gems/energy accents (see
// handoff.md Step 2). Colocated here instead of "a human reading through
// every builder function and eyeballing hex codes in comments": adding a
// new bespoke character means adding one line here, and
// checkGlowFamilyCollisions() (below) flags a collision automatically
// instead of relying on someone remembering to check by hand.
//
// Values sourced directly from each builder's own glowMat/accentMat
// emissive definition. Characters that don't have a dedicated glow
// accent (Ajax uses plain accentMat, Máquina de Guerra is a summon-only
// unit, not a signature hero) are omitted — nothing to collide with.
const GLOW_FAMILIES = {
  yvrel: 0x19cfff,              // cyan
  mariana: 0xffcf8f,            // warm pale-gold
  babawibby: 0x8fdb1a,          // lime
  daxen_ciris: 0xff1525,        // void-red (eyes, against a black body)
  amelia: 0x9b42ff,             // purple
  sirius: 0xff7a2e,             // orange
  moldar: 0xffa43a,             // orange (Sirius/Moldar are close — see
                                 // note below)
  carmelita_marquese: 0x8fd9c9, // teal
  dario: 0xff2e3d,              // red (shadow form only)
  gavin: 0x5ab8ff,              // ice-blue
  porteiro: 0x6fbf5a,           // moss-green (eyes/core, growing on the stone —
                                 // shifted away from Carmelita's teal 0x8fd9c9,
                                 // which is close in hue even without a literal
                                 // hex collision)
  dario_shadow: 0x7a0000,       // blood-red (crater fissures, halo, core — the
                                 // "President Shadow" boss build; distinct hue
                                 // from Dário's own 0xff2e3d shadow-form red)
};

// checkGlowFamilyCollisions(): warns (returns a list, doesn't throw) if
// two different characters share the exact same glow-family hex. Doesn't
// try to fuzzy-match "close" colors (e.g. Sirius 0xff7a2e vs Moldar
// 0xffa43a are both orange but distinct hexes) — that judgment call is
// still a human one per handoff.md Step 2; this only catches the
// mechanical case of an literal copy-paste duplicate.
function checkGlowFamilyCollisions() {
  const collisions = [];
  const byColor = {};
  for (const [charId, hex] of Object.entries(GLOW_FAMILIES)) {
    if (!byColor[hex]) byColor[hex] = [];
    byColor[hex].push(charId);
  }
  for (const [hex, chars] of Object.entries(byColor)) {
    if (chars.length > 1) collisions.push({ hex: Number(hex), characters: chars });
  }
  return collisions;
}

// validateUnitModel(def): runs buildUnitModel(def) and asserts the mesh
// contract every bespoke builder is supposed to follow (handoff.md Step 3
// "Hard rules"). Returns { ok, errors, warnings, meshCount } rather than
// throwing, so a caller (e.g. tests/model-regression.js) can run it
// across every character and report all failures at once instead of
// stopping at the first one.
//
// Catches the real bug classes handoff.md documents:
//  - a required mesh name missing entirely (getObjectByName returns null)
//  - mesh count wildly outside the sane range other bespoke builds fall in
//    (too low = dead code from a copy-paste; too high = duplicated geometry)
//  - a material that lost its .color object (the "material clone losing
//    its color" class of bug) — checked structurally (is .color present
//    and does it look like a Color, not literally re-deriving the hex)
function validateUnitModel(def, { minMeshes = 8, maxMeshes = 80 } = {}) {
  const errors = [];
  const warnings = [];
  let result = null;

  try {
    result = buildUnitModel(def);
  } catch (e) {
    return { ok: false, errors: [`buildUnitModel threw: ${e.message}`], warnings: [], meshCount: 0 };
  }

  const { bodyGroup, torso, head, core, weapon } = result;

  // Required mesh names.
  if (!torso) errors.push('no mesh named "torso" found');
  if (!head) errors.push('no mesh named "head" found');
  if (!core) errors.push('no mesh named "core" found');
  if (!weapon) warnings.push('no mesh named "weapon" found (fine if this character has no weapon prop)');

  // Mesh count sanity — count every actual Mesh in the tree, excluding
  // the auto-generated per-mesh outline children (those roughly double
  // the count and aren't part of the "hand-authored parts" the range is
  // meant to sanity-check).
  let meshCount = 0;
  if (bodyGroup) {
    bodyGroup.traverse(o => {
      if (o.isMesh && !o.userData.isOutline) meshCount++;
    });
  }
  if (meshCount < minMeshes) errors.push(`mesh count (${meshCount}) suspiciously low — possible dead code from a copy-paste (expected >= ${minMeshes})`);
  if (meshCount > maxMeshes) warnings.push(`mesh count (${meshCount}) unusually high — check for duplicated geometry (expected <= ${maxMeshes})`);

  // Buried/lost-color material check: every mesh's material should have a
  // real Color object on .color (and .emissive, if set, should also be a
  // real Color object) — catches a `.clone()` that dropped the field
  // entirely, which is a silent invisible-mesh bug, not a crash.
  if (bodyGroup) {
    bodyGroup.traverse(o => {
      if (!o.isMesh || o.userData.isOutline) return;
      const mat = o.material;
      if (!mat) { errors.push(`mesh "${o.name || '(unnamed)'}" has no material`); return; }
      if (!mat.color || typeof mat.color.getHex !== 'function') {
        errors.push(`mesh "${o.name || '(unnamed)'}" material lost its .color object`);
      }
      if (mat.emissive !== undefined && typeof mat.emissive.getHex !== 'function') {
        errors.push(`mesh "${o.name || '(unnamed)'}" material has an .emissive field that isn't a real Color object`);
      }
    });
  }

  return { ok: errors.length === 0, errors, warnings, meshCount };
}


function buildUnitModel(def, initialForm) {
  const root = new THREE.Group();
  root.name = def.id + "_root";

  const bodyGroup = new THREE.Group();
  bodyGroup.name = "body";
  root.add(bodyGroup);

  const mainMat = new THREE.MeshToonMaterial({ color: def.color, gradientMap: TOON_GRADIENT });
  const accentMat = new THREE.MeshToonMaterial({ color: def.accentColor, gradientMap: TOON_GRADIENT, emissive: def.accentColor, emissiveIntensity: 0.35 });

  let torso, head, core;
  let outlineParts = null;

  const bespokeBuilder = BESPOKE_BUILDERS[def.shape];
  if (bespokeBuilder) {
    outlineParts = def.shape === 'dario'
      ? bespokeBuilder(bodyGroup, mainMat, accentMat, def, initialForm)
      : bespokeBuilder(bodyGroup, mainMat, accentMat, def);
    torso = bodyGroup.getObjectByName("torso");
    head = bodyGroup.getObjectByName("head");
    core = bodyGroup.getObjectByName("core");
  } else if (def.shape === "brute") {
    torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.6), mainMat);
    torso.position.y = 0.75;
    torso.castShadow = true;
    torso.name = "torso";
    bodyGroup.add(torso);

    head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mainMat);
    head.position.y = 1.55;
    head.castShadow = true;
    head.name = "head";
    bodyGroup.add(head);

    // shoulder pads
    [-1, 1].forEach(side => {
      const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), accentMat);
      shoulder.position.set(side * 0.55, 1.15, 0);
      shoulder.name = "shoulder_" + (side < 0 ? "L" : "R");
      bodyGroup.add(shoulder);
    });

    // arms (named for animation targeting)
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.75, 8), mainMat);
    armL.position.set(-0.62, 0.75, 0);
    armL.name = "armL";
    armL.castShadow = true;
    bodyGroup.add(armL);

    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.75, 8), mainMat);
    armR.position.set(0.62, 0.75, 0);
    armR.name = "armR";
    armR.castShadow = true;
    bodyGroup.add(armR);

    // weapon (right hand)
    const weapon = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 6), accentMat);
    weapon.rotation.x = Math.PI;
    weapon.position.set(0.62, 0.15, 0);
    weapon.name = "weapon";
    bodyGroup.add(weapon);

    core = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), accentMat);
    core.position.set(0, 0.85, 0.32);
    core.name = "core";
    bodyGroup.add(core);

  } else { // caster
    torso = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.3, 8), mainMat);
    torso.position.y = 0.75;
    torso.castShadow = true;
    torso.name = "torso";
    bodyGroup.add(torso);

    head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), mainMat);
    head.position.y = 1.55;
    head.castShadow = true;
    head.name = "head";
    bodyGroup.add(head);

    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8), mainMat);
    armL.position.set(-0.42, 0.85, 0);
    armL.rotation.z = 0.5;
    armL.name = "armL";
    bodyGroup.add(armL);

    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8), mainMat);
    armR.position.set(0.42, 0.85, 0);
    armR.rotation.z = -0.5;
    armR.name = "armR";
    bodyGroup.add(armR);

    // floating orb "weapon"
    const weapon = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), accentMat);
    weapon.position.set(0.55, 1.05, 0.15);
    weapon.name = "weapon";
    bodyGroup.add(weapon);

    core = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), accentMat);
    core.position.set(0, 0.95, 0.28);
    core.name = "core";
    bodyGroup.add(core);

    // ring collar
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 8, 16), accentMat);
    collar.position.y = 1.25;
    collar.rotation.x = Math.PI / 2;
    collar.name = "collar";
    bodyGroup.add(collar);
  }

  // Per-mesh toon outline (from babawibby_zoom_v3.html's addOutline/
  // makeToonMesh pattern): every individual mesh in the body gets its own
  // backface-scaled outline CHILD (not a separate top-level clone), so it
  // inherits that mesh's own transform automatically as parts move/animate.
  // This replaces the old torso/head-only outline, which left most bespoke
  // parts (fins, ears, backpack, halo, etc.) with no outline at all.
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
  const OUTLINE_SCALE = 1.06;
  bodyGroup.traverse(o => {
    if (o.isMesh && !o.userData.isOutline) {
      const outline = new THREE.Mesh(o.geometry, outlineMat);
      outline.scale.multiplyScalar(OUTLINE_SCALE);
      outline.name = (o.name || "part") + "_outline";
      outline.userData.isOutline = true;
      o.add(outline);
    }
  });

  // Optional per-character overall size multiplier (e.g. Ajax reading too
  // small next to the others at the default per-mesh dimensions). Applied
  // to root, not bodyGroup, so it scales the whole unit uniformly without
  // touching any of the joint-pivot math inside the bespoke builders.
  if (def.modelScale && def.modelScale !== 1) {
    root.scale.multiplyScalar(def.modelScale);
  }

  return { root, bodyGroup, torso, head, core, weapon: bodyGroup.getObjectByName("weapon") };
}
