function buildBabawibbyModel(bodyGroup, mainMat, accentMat, def) {
  // Babawibby, o Mais Melhor de Bom — rebuilt from concept art (goblin
  // alchemist/scavenger reference). Silhouette features that make THIS
  // character distinct, per Step 1 of the character guide:
  //   1. Long, wide bat-like ears swept back and slightly drooping
  //   2. A too-wide manic grin with visible upper teeth, no lower jaw shape
  //   3. A criss-cross leather harness/strap rig over a bare-ish torso
  //      (not a solid vest block)
  //   4. A hanging potion vial on a cord at the hip — his signature prop,
  //      doubles as the glow family anchor
  //   5. A ragged, asymmetric loincloth/shorts hem (torn, not a clean skirt)
  //   6. A wide, low-to-the-ground stocky stance (short thick legs, long arms)
  // Glow family: sickly toxic-green (vial contents / eyes-when-scheming),
  // distinct from Yvrel's cyan, Mariana/Ajax's warm gold, and
  // Daxen-Ciris's void-black.
  const skinMat = mainMat.clone();
  skinMat.color.set(0x6d8f3f);
  const skinShadeMat = mainMat.clone();
  skinShadeMat.color.set(0x4e6b2b);
  const leatherMat = mainMat.clone();
  leatherMat.color.set(0x6b4a30);
  const leatherDarkMat = mainMat.clone();
  leatherDarkMat.color.set(0x4a3220);
  const clothMat = mainMat.clone();
  clothMat.color.set(0x8a5a38);
  const metalMat = mainMat.clone();
  metalMat.color.set(0x9a9a9a);
  const glowMat = new THREE.MeshToonMaterial({ color: 0xcfff5a, gradientMap: TOON_GRADIENT, emissive: 0x8fdb1a, emissiveIntensity: 0.9 });

  // ---- stocky bare torso, harness laid over it as separate strap meshes ----
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), skinMat);
  torso.scale.set(1.05, 1.05, 0.98);
  torso.position.y = 0.42;
  torso.castShadow = true;
  torso.name = "torso";
  bodyGroup.add(torso);

  // criss-cross harness: two diagonal capsule straps hugging the torso
  // surface (shortened + pulled closer to the sphere radius so they sit on
  // the skin instead of clipping through it), real torus buckle at center
  [-1, 1].forEach(side => {
    const strap = makeCapsule(0.024, 0.26, leatherMat);
    strap.position.set(side * 0.1, 0.44, 0.16);
    strap.rotation.z = side * 0.68;
    strap.rotation.x = -0.15;
    strap.name = "harnessStrap_" + (side < 0 ? "L" : "R");
    bodyGroup.add(strap);
  });
  const buckle = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.013, 8, 14), metalMat);
  buckle.position.set(0, 0.44, 0.26);
  buckle.name = "buckle";
  bodyGroup.add(buckle);

  // waist belt, a true torus ring around the torso base
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 8, 18), leatherDarkMat);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.26;
  belt.name = "belt";
  bodyGroup.add(belt);

  // ragged asymmetric loincloth hanging below the belt
  const loincloth = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), clothMat);
  loincloth.scale.set(1.1, 1.3, 0.85);
  loincloth.position.set(0.02, 0.14, 0.02);
  loincloth.rotation.z = 0.08;
  loincloth.name = "loincloth";
  bodyGroup.add(loincloth);

  // hanging potion vial at the hip — signature prop, glow-family anchor
  const vialCord = makeCapsule(0.012, 0.16, leatherDarkMat);
  vialCord.position.set(-0.22, 0.28, 0.1);
  vialCord.rotation.z = 0.3;
  vialCord.name = "vialCord";
  bodyGroup.add(vialCord);
  const vial = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), glowMat.clone());
  vial.material.transparent = true;
  vial.material.opacity = 0.9;
  vial.scale.set(0.85, 1.3, 0.85);
  vial.position.set(-0.26, 0.16, 0.12);
  vial.name = "vial";
  bodyGroup.add(vial);
  const vialCap = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), leatherDarkMat);
  vialCap.position.set(-0.26, 0.24, 0.12);
  vialCap.name = "vialCap";
  bodyGroup.add(vialCap);

  // ---- big head: wide grin, bat-ears, heavy brow ----
  const headGroup = new THREE.Group();
  headGroup.position.y = 0.86;
  headGroup.name = "headGroup";
  bodyGroup.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), skinMat);
  head.scale.set(1, 0.92, 1.02);
  head.castShadow = true;
  head.name = "head";
  headGroup.add(head);

  // No facial features (eyes/nose/mouth/brow) — kept faceless per the
  // shared character style used across all models.

  // wide bat-like ears, swept back and slightly drooping at the tip —
  // built from a scaled/rotated sphere so the tip reads well outside the
  // head radius (buried-geometry check: ear length 0.42 vs head radius 0.3)
  [-1, 1].forEach(side => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), skinMat);
    ear.scale.set(0.55, 2.6, 1);
    ear.position.set(side * 0.32, 0.08, -0.06);
    ear.rotation.z = side * 0.95;
    ear.rotation.y = side * -0.25;
    ear.name = "ear_" + (side < 0 ? "L" : "R");
    headGroup.add(ear);

    const earInner = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 6), skinShadeMat);
    earInner.scale.set(0.4, 2.2, 0.5);
    earInner.position.set(side * 0.34, 0.08, -0.01);
    earInner.rotation.z = side * 0.95;
    earInner.rotation.y = side * -0.25;
    earInner.name = "earInner_" + (side < 0 ? "L" : "R");
    headGroup.add(earInner);
  });

  // ---- ARMS: real joint-chain rig, both arms outstretched per the art ----
  function buildArm(side) {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * 0.26, 0.56, 0.02);
    shoulderPivot.name = "shoulderPivot_" + (side < 0 ? "L" : "R");
    bodyGroup.add(shoulderPivot);

    // Limb meshes are built pointing straight down (-Y) with no rotation
    // of their own — the shoulder/elbow pivot groups do all the posing.
    // Rotating both the pivot AND the mesh (as before) compounded into a
    // twisted, self-intersecting arm; this keeps a single source of truth.
    const upperArm = makeCapsule(0.06, 0.3, skinMat);
    upperArm.position.set(0, -0.15, 0);
    upperArm.name = "upperArm_" + (side < 0 ? "L" : "R");
    shoulderPivot.add(upperArm);

    // leather arm-wrap band, a torus ring around the upper arm
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.02, 8, 12), leatherMat);
    wrap.rotation.x = Math.PI / 2;
    wrap.position.set(0, -0.18, 0);
    wrap.name = "armWrap_" + (side < 0 ? "L" : "R");
    shoulderPivot.add(wrap);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.3, 0);
    elbowPivot.name = "elbowPivot_" + (side < 0 ? "L" : "R");
    shoulderPivot.add(elbowPivot);

    const forearm = makeCapsule(0.05, 0.28, skinMat);
    forearm.position.set(0, -0.14, 0);
    forearm.name = (side < 0 ? "armL" : "armR");
    elbowPivot.add(forearm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), skinMat);
    hand.position.set(0, -0.28, 0);
    hand.name = "hand_" + (side < 0 ? "L" : "R");
    elbowPivot.add(hand);

    if (side > 0) {
      // pointing finger on the right hand, doubles as the recoil-animation
      // hook so attack impacts travel with the actual pointing gesture
      const finger = makeCapsule(0.016, 0.09, skinMat);
      finger.position.set(0, -0.34, 0.02);
      finger.rotation.x = Math.PI / 2;
      finger.name = "weapon";
      elbowPivot.add(finger);
    }

    // Relaxed idle pose (not a T-pose): shoulders angled down and slightly
    // forward, elbows bent in — arms read as hanging/gesturing rather than
    // stuck straight out to the sides.
    shoulderPivot.rotation.z = side * 0.35;
    shoulderPivot.rotation.x = 0.12;
    elbowPivot.rotation.x = -0.5;
    elbowPivot.rotation.z = side * -0.15;

    return { shoulderPivot, elbowPivot };
  }

  const rigL = buildArm(-1);
  const rigR = buildArm(1);

  // ---- short thick legs, stocky low stance, bare clawed feet ----
  [-1, 1].forEach(side => {
    const leg = makeCapsule(0.1, 0.22, skinMat);
    leg.position.set(side * 0.13, 0.06, 0);
    leg.name = "leg_" + (side < 0 ? "L" : "R");
    bodyGroup.add(leg);

    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), skinShadeMat);
    foot.scale.set(1, 0.6, 1.5);
    foot.position.set(side * 0.13, -0.09, 0.06);
    foot.name = "foot_" + (side < 0 ? "L" : "R");
    bodyGroup.add(foot);

    for (let t = -1; t <= 1; t++) {
      const toe = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 6), skinShadeMat);
      toe.scale.set(1, 0.8, 1.6);
      toe.position.set(side * 0.13 + t * 0.045, -0.1, 0.17);
      toe.name = "toe_" + (side < 0 ? "L" : "R") + "_" + (t + 1);
      bodyGroup.add(toe);
    }
  });

  // core: the glow anchor read by the shared idle/attack animation system —
  // a second, smaller vial-glow bead tucked at the belt line
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), glowMat.clone());
  core.position.set(0.16, 0.27, 0.18);
  core.name = "core";
  bodyGroup.add(core);

  const head_ = headGroup.getObjectByName("head");
  return [torso, head_, vial];
}

BESPOKE_BUILDERS.babawibby = buildBabawibbyModel;
