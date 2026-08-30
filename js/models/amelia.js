function buildAmeliaModel(bodyGroup, mainMat, accentMat, def) {
  // ============================================================
  // AMELIA — THE WITCH OF THE LAST SECOND (ROUNDED REBUILD)
  //
  // Rebuilt using exclusively Spheres, Toruses, and Capsules to
  // match the soft, spherical chibi-primitive style of Mariana
  // and Babawibby, eliminating all sharp extrusions and boxes.
  // ============================================================

  // ------------------------------------------------------------
  // MATERIALS
  // ------------------------------------------------------------

  const robeMat = mainMat.clone();
  robeMat.color.set(0x21152b);

  const robeLightMat = mainMat.clone();
  robeLightMat.color.set(0x49304f);

  const robeDarkMat = mainMat.clone();
  robeDarkMat.color.set(0x130c1a);

  const skinMat = mainMat.clone();
  skinMat.color.set(0xd8ad9c);

  const brassMat = accentMat.clone();
  brassMat.color.set(0x9a7040);

  const brassLightMat = accentMat.clone();
  brassLightMat.color.set(0xd1a866);

  const timeGlowMat = new THREE.MeshToonMaterial({
    color: 0xffffff,
    gradientMap: TOON_GRADIENT,
    emissive: 0x9b42ff,
    emissiveIntensity: 2.1,
    transparent: true,
    opacity: 0.82
  });

  const timeCoreMat = new THREE.MeshToonMaterial({
    color: 0xffffff,
    gradientMap: TOON_GRADIENT,
    emissive: 0xd6a5ff,
    emissiveIntensity: 2.8
  });

  // ------------------------------------------------------------
  // HELPERS
  // ------------------------------------------------------------

  function add(mesh, name, parent = bodyGroup) {
    if (name) mesh.name = name;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function clockRing(radius, tube, material, position, rotation, name, arc = Math.PI * 2) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, tube, 8, 32, arc),
      material
    );
    ring.position.set(position[0], position[1], position[2]);
    ring.rotation.set(rotation[0] || 0, rotation[1] || 0, rotation[2] || 0);
    return add(ring, name);
  }

  // ------------------------------------------------------------
  // LOWER ROBE / SKIRT
  // ------------------------------------------------------------

  const skirt = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.65),
    robeDarkMat
  );
  skirt.position.y = 0.42;
  skirt.scale.set(0.95, 1.4, 0.95);
  skirt.name = "skirt";
  add(skirt);

  const robeOverL = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
    robeMat
  );
  robeOverL.position.set(-0.06, 0.44, 0.02);
  robeOverL.scale.set(0.95, 1.25, 0.95);
  robeOverL.rotation.z = -0.12;
  add(robeOverL, "robeSweepL");

  const robeOverR = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
    robeMat
  );
  robeOverR.position.set(0.06, 0.44, 0.02);
  robeOverR.scale.set(0.95, 1.25, 0.95);
  robeOverR.rotation.z = 0.12;
  add(robeOverR, "robeSweepR");

  // ------------------------------------------------------------
  // WAIST & TORSO
  // ------------------------------------------------------------

  const waist = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), robeDarkMat);
  waist.position.y = 0.72;
  waist.scale.set(1.0, 0.9, 0.9);
  waist.name = "torso";
  add(waist);

  clockRing(0.21, 0.035, brassLightMat, [0, 0.72, 0], [Math.PI / 2, 0, 0], "belt");

  const chestBase = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 14), robeMat);
  chestBase.position.y = 0.92;
  chestBase.scale.set(1.15, 1.05, 0.85);
  chestBase.name = "chest";
  add(chestBase);

  // ------------------------------------------------------------
  // HOURGLASS CORE (ROUNDED)
  // ------------------------------------------------------------

  const hgTop = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), timeCoreMat);
  hgTop.position.set(0, 0.99, 0.26);
  hgTop.scale.set(1, 0.7, 0.35);
  add(hgTop, "hourglassTop");

  const hgBot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), timeCoreMat);
  hgBot.position.set(0, 0.85, 0.26);
  hgBot.scale.set(1, 0.7, 0.35);
  add(hgBot, "hourglassBottom");

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), timeCoreMat);
  core.position.set(0, 0.92, 0.28);
  core.name = "core";
  add(core);

  // ------------------------------------------------------------
  // SHOULDERS (ROUNDED PAULDRONS)
  // ------------------------------------------------------------

  [-1, 1].forEach(side => {
    const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), robeLightMat);
    pauldron.position.set(side * 0.32, 1.02, 0);
    pauldron.scale.set(1.1, 0.9, 1.1);
    add(pauldron, "shoulder_" + (side < 0 ? "L" : "R"));

    clockRing(
      0.11, 0.015, brassMat,
      [side * 0.34, 1.02, 0.06],
      [Math.PI / 2, 0, side * 0.25],
      "shoulderClock_" + (side < 0 ? "L" : "R"),
      Math.PI * 1.3
    );
  });

  // ------------------------------------------------------------
  // HOOD / HEAD
  // ------------------------------------------------------------

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.28, 0.05);
  headGroup.rotation.x = -0.06;
  headGroup.name = "headGroup";
  bodyGroup.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 18, 16), skinMat);
  head.position.set(0, 0, 0.08);
  head.scale.set(0.85, 1.1, 0.8);
  head.name = "head";
  headGroup.add(head);

  const hoodBack = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 14), robeDarkMat);
  hoodBack.position.set(0, 0.05, -0.04);
  hoodBack.scale.set(1.05, 1.15, 1);
  headGroup.add(hoodBack);

  const hoodWrap = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.07, 12, 18), robeMat);
  hoodWrap.position.set(0, 0.04, 0.08);
  hoodWrap.scale.set(0.95, 1.15, 0.85);
  headGroup.add(hoodWrap);

  const crownPoint = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 10), brassLightMat);
  crownPoint.position.set(0, 0.29, 0.02);
  crownPoint.scale.set(0.7, 2.2, 0.7);
  crownPoint.name = "temporalCrown";
  headGroup.add(crownPoint);

  // ------------------------------------------------------------
  // CLOCKWORK HALO (ROUNDED HANDS)
  // ------------------------------------------------------------

  const haloGroup = new THREE.Group();
  haloGroup.position.set(0, 1.30, -0.22);
  bodyGroup.add(haloGroup);

  clockRing(0.42, 0.014, brassLightMat, [0, 0, 0], [Math.PI / 2, 0, 0], "clockHaloOuter", Math.PI * 1.72).parent = haloGroup;
  clockRing(0.32, 0.012, timeGlowMat, [0, 0, 0], [Math.PI / 2, 0, 0], "clockHaloInner", Math.PI * 1.45).parent = haloGroup;

  const clockPin = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 10), timeCoreMat);
  haloGroup.add(clockPin);

  const handMinPivot = new THREE.Group();
  handMinPivot.rotation.z = -0.55;
  const handMinute = makeCapsule(0.014, 0.24, brassLightMat);
  handMinute.position.y = 0.12; 
  handMinPivot.add(handMinute);
  haloGroup.add(handMinPivot);

  const handHrPivot = new THREE.Group();
  handHrPivot.rotation.z = -2.1;
  const handHour = makeCapsule(0.016, 0.15, brassLightMat);
  handHour.position.y = 0.075;
  handHrPivot.add(handHour);
  haloGroup.add(handHrPivot);

  // ------------------------------------------------------------
  // ARMS
  // ------------------------------------------------------------

  function buildArm(side, casting) {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * 0.31, 1.02, 0);
    shoulderPivot.name = "shoulderPivot_" + (side < 0 ? "L" : "R");
    bodyGroup.add(shoulderPivot);

    const sleeve = makeCapsule(0.065, 0.28, robeMat);
    sleeve.position.set(0, -0.14, 0);
    shoulderPivot.add(sleeve);

    const sleeveBand = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 16), brassMat);
    sleeveBand.position.set(0, -0.27, 0);
    sleeveBand.rotation.x = Math.PI / 2;
    shoulderPivot.add(sleeveBand);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.32, 0);
    elbowPivot.name = "elbowPivot_" + (side < 0 ? "L" : "R");
    shoulderPivot.add(elbowPivot);

    const forearm = makeCapsule(0.048, 0.24, robeLightMat);
    forearm.position.set(0, -0.12, 0);
    elbowPivot.add(forearm);

    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.012, 8, 16), brassLightMat);
    cuff.position.set(0, -0.24, 0);
    cuff.rotation.x = Math.PI / 2;
    elbowPivot.add(cuff);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), skinMat);
    hand.position.set(0, -0.28, 0.015);
    hand.scale.set(0.85, 1.15, 0.7);
    hand.name = "hand_" + (side < 0 ? "L" : "R");
    elbowPivot.add(hand);

    for (let i = 0; i < 5; i++) {
      const finger = makeCapsule(0.009, i === 2 ? 0.12 : 0.1, skinMat);
      finger.position.set((i - 2) * 0.018, -0.35, 0.035);
      finger.rotation.z = (i - 2) * 0.15;
      elbowPivot.add(finger);
    }

    if (casting) {
      shoulderPivot.rotation.set(-1.10, -0.20, 0.48);
      elbowPivot.rotation.set(-0.72, 0.05, -0.10);
    } else {
      shoulderPivot.rotation.set(0.30, 0, -0.30);
      elbowPivot.rotation.set(0.20, 0, 0.12);
    }

    return { shoulderPivot, elbowPivot, hand };
  }

  buildArm(-1, false);
  const rightRig = buildArm(1, true);

  // ------------------------------------------------------------
  // TIME SPELL — RIGHT HAND
  // ------------------------------------------------------------

  const spellGroup = new THREE.Group();
  spellGroup.position.set(0, -0.38, 0.08);
  spellGroup.name = "weapon";
  rightRig.elbowPivot.add(spellGroup);

  const spellCore = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), timeCoreMat);
  spellGroup.add(spellCore);

  clockRing(0.105, 0.008, timeGlowMat, [0, 0, 0], [Math.PI / 2, 0, 0], "spellRingA").parent = spellGroup;
  clockRing(0.085, 0.006, brassLightMat, [0, 0, 0], [0.8, 0.3, 0.4], "spellRingB").parent = spellGroup;
  clockRing(0.065, 0.005, timeGlowMat, [0, 0, 0], [1.2, 0.6, 0], "spellRingC").parent = spellGroup;

  // ------------------------------------------------------------
  // FLOATING ORBS (ROUNDED SHARDS)
  // ------------------------------------------------------------

  const fragments = [
    [-0.37, 0.57, -0.17, 0.035],
    [ 0.40, 0.70, -0.19, 0.028],
    [-0.34, 0.91, -0.22, 0.022],
    [ 0.37, 1.04, -0.20, 0.030],
    [-0.28, 1.17, -0.22, 0.020],
    [ 0.31, 1.40, -0.21, 0.025]
  ];

  fragments.forEach((p, i) => {
    const shard = new THREE.Mesh(
      new THREE.SphereGeometry(p[3], 10, 10),
      i % 2 === 0 ? timeGlowMat : brassLightMat
    );
    shard.position.set(p[0], p[1], p[2]);
    add(shard, "timeFragment_" + i);
  });

  // ------------------------------------------------------------
  // TEMPORAL TRAILS
  // ------------------------------------------------------------

  const createTrail = (curvePts, name) => {
    const curve = new THREE.CatmullRomCurve3(curvePts);
    const trail = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 16, 0.010, 6, false),
      timeGlowMat
    );
    add(trail, name);
  };

  createTrail([
    new THREE.Vector3(-0.38, 0.42, -0.18),
    new THREE.Vector3(-0.47, 0.70, -0.19),
    new THREE.Vector3(-0.32, 0.98, -0.20),
    new THREE.Vector3(-0.45, 1.24, -0.19)
  ], "timeTrailL");

  createTrail([
    new THREE.Vector3(0.38, 0.43, -0.18),
    new THREE.Vector3(0.47, 0.68, -0.20),
    new THREE.Vector3(0.33, 0.96, -0.20),
    new THREE.Vector3(0.44, 1.23, -0.19)
  ], "timeTrailR");

  return [chestBase, head, skirt];
}

BESPOKE_BUILDERS.amelia = buildAmeliaModel;
