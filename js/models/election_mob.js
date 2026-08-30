// =============================================================
// ============ ELECTION MOB — UNIVERSAL CAMPAIGN-TRAIL MOB MODEL ==
// =============================================================
// Supplied bespoke builder covering every non-boss campaign enemy
// archetype in one file, branching on `def.mobId` rather than one
// builder per character — a deliberate exception to the usual "one
// bespoke file per character" pattern, since these are disposable
// rank-and-file mooks reusing a shared rig, not named heroes. Register
// with `shape: "election_mob"` on any CAMPAIGN_UNIT_DEFS entry and set
// `mobId` to the archetype string this switches on (see Branch A/B
// below for the full list).
//
// Two branches: Branch A is animalistic hounds/beasts (quadruped rig),
// Branch B is demonic humanoids (staffers/fixers/donors/etc, the bulk
// of the roster) — chosen by `hound_*`/`beast_*` mobId prefix vs.
// everything else. Branch B's archetype table + per-type prop dressing
// (10 variants, each with its own scale profile and a hand-held/worn
// prop reinforcing the theme) is the richer of two supplied revisions —
// kept in full for the extra demonic flavor (horns + glowing eyes on
// every variant, distinct props per elite type) rather than the
// slimmer first pass.
//
// Fixes made versus both supplied revisions, both the same "r128 has no
// native CapsuleGeometry" class of issue (added upstream in r142; every
// other bespoke builder in js/models/ already works around this with
// the shared makeCapsule(radius, length, mat) helper — cylinder + two
// sphere caps in a Group):
//  - Branch A's quadruped torso/legs: swapped from raw
//    THREE.CapsuleGeometry to makeCapsule() (same as the original fix).
//  - Branch B's flat prop meshes (clipboard, fixer's sunglasses, riot
//    shield, spin-doctor's floating papers) originally used
//    THREE.BoxGeometry. r128 DOES have real BoxGeometry (unlike
//    CapsuleGeometry), so this wasn't a functional break — but every
//    other bespoke prop in this project builds flat/plate shapes out of
//    a scaled makeCapsule() rather than a raw Box, so these were
//    swapped for that same convention rather than left inconsistent.
//    Genuinely cylindrical props (baton, brass-knuckle torus, coffee
//    cup, megaphone, money bag) are unchanged — no cylinder/sphere/
//    torus/cone geometry in this file ever needed a fix.
function buildElectionMobModel(bodyGroup, mainMat, accentMat, def) {
  // Pale, ashen/sickly demonic skin.
  const skinMat = new THREE.MeshToonMaterial({ color: 0x858596, gradientMap: TOON_GRADIENT });
  const suitMat = mainMat.clone();
  const propMat = accentMat.clone();
  const darkMat = new THREE.MeshToonMaterial({ color: 0x0a0a0e, gradientMap: TOON_GRADIENT });

  // Demonic fiery red glow for eyes and core.
  const glowingEyesMat = new THREE.MeshToonMaterial({
    color: 0xff1122,
    gradientMap: TOON_GRADIENT,
    emissive: 0xff0011,
    emissiveIntensity: 2.5
  });
  const glowMat = new THREE.MeshToonMaterial({ color: 0xff3333, gradientMap: TOON_GRADIENT, emissive: 0xff1111, emissiveIntensity: 1.5 });

  const type = def.mobId || 'staffer';
  const isHound = type.startsWith('hound_') || type.startsWith('beast_');

  function add(mesh, name, parent = bodyGroup) {
    if (name) mesh.name = name;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // Small helper for the flat/plate-shaped props (clipboard, shield,
  // sunglasses, floating papers) that were originally raw BoxGeometry —
  // a capsule flattened on one axis and widened on another reads as a
  // thin plate close enough for toon-shaded silhouette read at this
  // scale, same trick every other bespoke builder in this project uses
  // for flat details. `scaleXYZ` lets each call widen/flatten/lengthen
  // independently after the base capsule shape is built.
  function makePlate(radius, length, mat, scaleXYZ) {
    const plate = makeCapsule(radius, length, mat);
    plate.scale.set(scaleXYZ[0], scaleXYZ[1], scaleXYZ[2]);
    return plate;
  }

  // ==========================================
  // BRANCH A: ANIMALISTIC HOUNDS & BEASTS
  // ==========================================
  if (isHound) {
    bodyGroup.scale.setScalar(0.9);
    if (type === 'elite_hound_enforcer') {
      suitMat.color.set(0x1a1a1a);
      bodyGroup.scale.setScalar(1.1);
    } else if (type === 'beast_propaganda') {
      suitMat.color.set(0x2a0845);
      bodyGroup.scale.setScalar(1.25);
    }

    // Low-slung quadruped body — makeCapsule() instead of raw
    // THREE.CapsuleGeometry (see file header). makeCapsule returns a
    // Group (cylinder + two sphere caps), same drop-in shape.
    const torso = makeCapsule(0.22, 0.6, suitMat);
    torso.position.set(0, 0.45, 0);
    torso.rotation.z = Math.PI / 2;
    torso.name = "torso";
    torso.castShadow = true;
    bodyGroup.add(torso);

    // Beast Head
    const headGroup = new THREE.Group();
    headGroup.position.set(0.55, 0.55, 0);
    headGroup.rotation.z = -0.2;
    add(headGroup, "headGroup");

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 12), suitMat);
    head.name = "head";
    headGroup.add(head);

    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 6), darkMat);
    snout.position.set(0.15, -0.05, 0);
    snout.rotation.z = -Math.PI / 2;
    headGroup.add(snout);

    // Glowing eyes
    [-0.08, 0.08].forEach(z => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), glowingEyesMat);
      eye.position.set(0.1, 0.05, z);
      headGroup.add(eye);
    });

    // Back Spikes / Armor Plates for Elites
    if (type === 'elite_hound_enforcer' || type === 'beast_propaganda') {
      for (let i = -2; i <= 2; i++) {
        const backSpike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.25, 4), darkMat);
        backSpike.position.set(i * 0.15, 0.7, 0);
        add(backSpike, "backSpike_" + i);
      }
    }

    // Four Quadruped Legs
    [-0.35, 0.35].forEach(x => {
      [-0.22, 0.22].forEach(z => {
        const legPivot = new THREE.Group();
        legPivot.position.set(x, 0.4, z);
        add(legPivot, "leg_" + (x < 0 ? "F_" : "B_") + (z < 0 ? "L" : "R"));

        const leg = makeCapsule(0.06, 0.35, suitMat);
        leg.position.set(0, -0.18, 0);
        legPivot.add(leg);
      });
    });

    const core = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 4), glowMat);
    core.position.set(0, 0.45, 0);
    core.visible = false;
    add(core, "core");

    return [torso, head];
  }

  // ==========================================
  // BRANCH B: DEMONIC HUMANOIDS (STAFFERS, FIXERS, ETC.)
  // ==========================================
  let scaleConfig = { torso: [1, 1, 0.8], arms: 1, legs: 1, posture: 0 };

  switch (type) {
    case 'security': scaleConfig = { torso: [1.3, 1.1, 0.9], arms: 1.2, legs: 1.1, posture: 0.1 }; break;
    case 'intern': scaleConfig = { torso: [0.8, 1, 0.7], arms: 0.9, legs: 0.9, posture: 0.4 }; break;
    case 'whistleblower': suitMat.color.set(0x4a3b32); break; // Darker, tattered trenchcoat
    case 'pundit': suitMat.color.set(0x1a3b6c); break; // Dark mystical blue suit
    case 'elite_debate': scaleConfig = { torso: [1.1, 1.4, 0.9], arms: 1.1, legs: 1.3, posture: -0.1 }; break;
    case 'elite_fixer': suitMat.color.set(0x050507); break;
    case 'elite_riot': scaleConfig = { torso: [1.4, 1.2, 1.1], arms: 1.3, legs: 1.2, posture: 0.2 }; suitMat.color.set(0x1a1a1a); break;
    case 'elite_spin': suitMat.color.set(0x2a0845); break;
    case 'elite_donor': scaleConfig = { torso: [1.8, 1.6, 1.8], arms: 0.8, legs: 1.2, posture: -0.2 }; suitMat.color.set(0x0e2413); break;
  }

  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), suitMat);
  pelvis.position.set(0, 0.4, 0);
  pelvis.scale.set(scaleConfig.torso[0] * 0.9, 1, scaleConfig.torso[2]);
  add(pelvis, "pelvis");

  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), suitMat);
  torso.position.set(0, 0.8, scaleConfig.posture * 0.2);
  torso.scale.set(...scaleConfig.torso);
  torso.rotation.x = scaleConfig.posture;
  add(torso, "torso");

  // Head & Demonic Features
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.2 + (scaleConfig.torso[1] * 0.1), scaleConfig.posture * 0.4);
  headGroup.rotation.x = scaleConfig.posture * 0.5;
  add(headGroup, "headGroup");

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 14), skinMat);
  head.name = "head";
  head.castShadow = true;
  headGroup.add(head);

  // Glowing Demonic Eyes + small horns on every variant.
  [-1, 1].forEach(side => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), glowingEyesMat);
    eye.position.set(side * 0.07, 0.04, 0.16);
    headGroup.add(eye);

    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 5), darkMat);
    horn.position.set(side * 0.1, 0.18, -0.02);
    horn.rotation.z = side * -0.3;
    horn.rotation.x = -0.2;
    headGroup.add(horn);
  });

  // Modular Rig Builder (clawed hands via a plain sphere hand mesh —
  // no separate claw geometry, matches the original supplied rig).
  function buildLimb(side, isLeg) {
    const pivot = new THREE.Group();
    if (isLeg) {
      pivot.position.set(side * 0.12 * scaleConfig.torso[0], 0.35, 0);
      add(pivot, "hip_" + (side < 0 ? "L" : "R"));
      const leg = makeCapsule(0.06 * scaleConfig.legs, 0.35 * scaleConfig.legs, suitMat);
      leg.position.set(0, -0.15, 0);
      pivot.add(leg);
    } else {
      pivot.position.set(side * 0.25 * scaleConfig.torso[0], 1.0, scaleConfig.posture * 0.2);
      add(pivot, "shoulder_" + (side < 0 ? "L" : "R"));
      const arm = makeCapsule(0.05 * scaleConfig.arms, 0.3 * scaleConfig.arms, suitMat);
      arm.position.set(0, -0.15, 0);
      pivot.add(arm);

      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06 * scaleConfig.arms, 10, 8), skinMat);
      hand.position.set(0, -0.3, 0);
      hand.name = side > 0 ? "weapon" : "handL";
      pivot.add(hand);
    }
    return pivot;
  }

  buildLimb(-1, true); buildLimb(1, true);
  const armL = buildLimb(-1, false);
  const armR = buildLimb(1, false);

  armR.rotation.set(-0.5, 0, 0);
  armL.rotation.set(-0.2, 0, 0);

  // Attach specific props based on mobId (with corrupted/demonic twists).
  const rightHand = armR.getObjectByName("weapon");

  if (type === 'staffer' || type === 'whistleblower') {
    // Clipboard — flattened makePlate() instead of raw BoxGeometry
    // (see file header).
    const board = makePlate(0.02, 1, propMat, [5, 6.25, 1]);
    board.position.set(0, -0.08, 0.05);
    rightHand.add(board);
  }
  else if (type === 'intern') {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.1), glowingEyesMat);
    cup.position.set(0, -0.05, 0.05);
    cup.rotation.x = Math.PI / 2;
    rightHand.add(cup); // Glowing cursed coffee cup
  }
  else if (type === 'pundit') {
    const mega = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.15, 8), propMat);
    mega.position.set(0, -0.05, 0.1);
    mega.rotation.x = -Math.PI / 2;
    rightHand.add(mega);
  }
  else if (type === 'elite_fixer') {
    // Sunglasses — flattened makePlate() instead of raw BoxGeometry.
    const shades = makePlate(0.025, 1, darkMat, [8.8, 2, 2]);
    shades.position.set(0, 0.05, 0.18);
    headGroup.add(shades);
    const knuckles = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.02, 8, 16), glowingEyesMat);
    knuckles.position.set(0, -0.05, 0.05);
    rightHand.add(knuckles);
  }
  else if (type === 'elite_debate') {
    // Podium/shield — flattened makePlate() instead of raw BoxGeometry.
    const podium = makePlate(0.1, 0.8, propMat, [6, 1, 2]);
    podium.position.set(0, 0.4, 0.4);
    add(podium, "podium_shield");
  }
  else if (type === 'elite_riot') {
    // Riot shield — flattened makePlate() instead of raw BoxGeometry.
    const shield = makePlate(0.02, 0.7, darkMat, [20, 1, 2.5]);
    shield.position.set(0, 0, 0.15);
    armL.getObjectByName("handL").add(shield);
    const baton = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4), glowingEyesMat);
    baton.position.set(0, -0.1, 0.05);
    baton.rotation.x = Math.PI / 2;
    rightHand.add(baton);
  }
  else if (type === 'elite_spin') {
    // Floating papers — flattened makePlate() instead of raw BoxGeometry.
    for (let i = 0; i < 4; i++) {
      const paper = makePlate(0.02, 0.15, glowingEyesMat, [5, 1, 0.5]);
      paper.position.set(Math.cos(i) * 0.4, 1 + Math.sin(i) * 0.2, Math.sin(i) * 0.4);
      add(paper, "floating_paper_" + i);
    }
  }
  else if (type === 'elite_donor') {
    const bag = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), new THREE.MeshToonMaterial({ color: 0x1e4d2b, emissive: 0x0a2612 }));
    bag.position.set(0, -0.1, 0.05);
    rightHand.add(bag);
  }

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 4), glowMat);
  core.position.set(0, 0.8, 0);
  core.visible = false;
  add(core, "core");

  return [torso, head];
}

BESPOKE_BUILDERS.election_mob = buildElectionMobModel;
