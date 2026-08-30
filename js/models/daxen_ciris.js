function buildDaxenCirisModel(bodyGroup, mainMat, accentMat, def) {
  // ============================================================
  // DAXEN-CIRIS — THE VOID SORCERER (ROUNDED REBUILD)
  //
  // Rebuilt using exclusively Spheres, Toruses, and Capsules.
  // Matched to the concept art: white inner shirt, draped red
  // cowl, wide cuffs, and a black-hole "accretion disk" visual
  // effect around the floating void orb.
  // ============================================================

  // ------------------------------------------------------------
  // MATERIALS
  // ------------------------------------------------------------

  const redRobeMat = mainMat.clone();
  redRobeMat.color.set(0x8f1c22); // Deep rich crimson

  const darkSkirtMat = mainMat.clone();
  darkSkirtMat.color.set(0x18151a); // Near-black void cloth

  const whiteShirtMat = mainMat.clone();
  whiteShirtMat.color.set(0xedece8); // Antique white

  const goldMat = accentMat.clone();
  goldMat.color.set(0xd4af37);
  goldMat.emissiveIntensity = 0.2;

  const skinMat = new THREE.MeshToonMaterial({ 
    color: 0x0c0c0e, 
    gradientMap: TOON_GRADIENT 
  }); // Pitch black skin/hands

  const voidCoreMat = new THREE.MeshToonMaterial({ 
    color: 0x000000, 
    gradientMap: TOON_GRADIENT 
  }); // Pure light-absorbing black for the singularity

  const voidAuraMat = new THREE.MeshToonMaterial({ 
    color: 0xffffff, 
    gradientMap: TOON_GRADIENT, 
    emissive: 0xff1525, 
    emissiveIntensity: 2.5,
    transparent: true,
    opacity: 0.85
  }); // Burning red/white energy aura

  // ------------------------------------------------------------
  // HELPERS
  // ------------------------------------------------------------

  function add(mesh, name, parent = bodyGroup) {
    if (name) mesh.name = name;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function ring(radius, tube, material, position, rotation, name, arc = Math.PI * 2) {
    const r = new THREE.Mesh(
      new THREE.TorusGeometry(radius, tube, 8, 32, arc),
      material
    );
    r.position.set(position[0], position[1], position[2]);
    r.rotation.set(rotation[0] || 0, rotation[1] || 0, rotation[2] || 0);
    return add(r, name);
  }

  // ------------------------------------------------------------
  // LOWER ROBE / SKIRT
  // ------------------------------------------------------------

  // Base dark bell skirt
  const skirt = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.65),
    darkSkirtMat
  );
  skirt.position.y = 0.42;
  skirt.scale.set(0.95, 1.4, 0.95);
  skirt.name = "skirt";
  add(skirt);

  // Red center tabard draping down the front
  const tabard = new THREE.Mesh(
    new THREE.SphereGeometry(0.39, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.35),
    redRobeMat
  );
  tabard.position.set(0, 0.42, 0.02);
  tabard.scale.set(0.4, 1.4, 0.95);
  add(tabard, "tabard");

  // Gold trim running down the edges of the tabard
  [-1, 1].forEach(side => {
    ring(
      0.39, 0.012, goldMat, 
      [side * 0.08, 0.42, 0.03], 
      [Math.PI / 2, side * 0.1, 0], 
      "tabardTrim_" + (side < 0 ? "L" : "R"), 
      Math.PI * 0.45
    );
  });

  // ------------------------------------------------------------
  // WAIST & BELT
  // ------------------------------------------------------------

  const waist = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), redRobeMat);
  waist.position.y = 0.72;
  waist.scale.set(1.0, 0.9, 0.9);
  waist.name = "torso";
  add(waist);

  // Wide ornate gold belt (stacked rings)
  ring(0.23, 0.035, goldMat, [0, 0.72, 0], [Math.PI / 2, 0, 0], "beltMain");
  ring(0.235, 0.015, redRobeMat, [0, 0.72, 0], [Math.PI / 2, 0, 0], "beltStripe");

  // Hanging teardrop buckle medallion (spherical overlap)
  const buckleBase = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), goldMat);
  buckleBase.position.set(0, 0.72, 0.23);
  buckleBase.scale.set(1.2, 1, 0.5);
  add(buckleBase, "buckle");
  
  const buckleDrop = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), goldMat);
  buckleDrop.position.set(0, 0.65, 0.23);
  buckleDrop.scale.set(1, 1.4, 0.5);
  add(buckleDrop, "buckleDrop");

  // ------------------------------------------------------------
  // TORSO & COWL
  // ------------------------------------------------------------

  // White inner shirt
  const chestBase = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 14), whiteShirtMat);
  chestBase.position.y = 0.92;
  chestBase.scale.set(1.15, 1.05, 0.85);
  chestBase.name = "chest";
  add(chestBase);

  // Red robe wrapping around the sides
  const robeSideL = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 12), redRobeMat);
  robeSideL.position.set(-0.06, 0.92, 0.02);
  robeSideL.scale.set(1, 1.05, 0.9);
  add(robeSideL, "robeSideL");

  const robeSideR = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 12), redRobeMat);
  robeSideR.position.set(0.06, 0.92, 0.02);
  robeSideR.scale.set(1, 1.05, 0.9);
  add(robeSideR, "robeSideR");

  // Draped red cowl resting over the shoulders and chest
  const cowlDrape = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 14), redRobeMat);
  cowlDrape.position.set(0, 1.08, 0);
  cowlDrape.scale.set(1.25, 0.6, 1.05);
  add(cowlDrape, "cowlDrape");

  // Gold trim running along the edge of the cowl
  ring(0.315, 0.02, goldMat, [0, 1.06, 0.01], [Math.PI / 2, 0, 0], "cowlTrim");

  // ------------------------------------------------------------
  // NECK & HEAD (THE VOID SINGULARITY)
  // ------------------------------------------------------------

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.25, 0.05);
  headGroup.name = "headGroup";
  bodyGroup.add(headGroup);

  // Tall dark empty collar
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.22, 16), darkSkirtMat);
  collar.position.y = 0.05;
  headGroup.add(collar);
  
  ring(0.18, 0.025, goldMat, [0, 0.16, 0], [Math.PI / 2, 0, 0], "collarTop", Math.PI * 2).parent = headGroup;
  ring(0.16, 0.025, goldMat, [0, -0.06, 0], [Math.PI / 2, 0, 0], "collarBase", Math.PI * 2).parent = headGroup;

  // Dark hollow interior to sell the "headless" look
  const collarHollow = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), skinMat);
  collarHollow.scale.set(1, 0.3, 1);
  collarHollow.position.y = 0.15;
  headGroup.add(collarHollow);

  // The Void Orb (Singularity)
  const voidOrb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 16), voidCoreMat);
  voidOrb.position.y = 0.52;
  voidOrb.name = "head"; // Important for animation targeting
  headGroup.add(voidOrb);

  // --- SPECIAL EFFECT: Black Hole Accretion Disk ---
  // Tilted, glowing rings of energy orbiting the singularity
  const accretion1 = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.012, 8, 24), voidAuraMat);
  accretion1.position.y = 0.52;
  accretion1.rotation.set(1.2, 0.3, 0);
  headGroup.add(accretion1);

  const accretion2 = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.008, 8, 24), voidAuraMat);
  accretion2.position.y = 0.52;
  accretion2.rotation.set(-1.0, 0.5, 0.8);
  headGroup.add(accretion2);

  // Floating ambient energy motes being pulled into the void
  const motes = [
    [-0.2, 0.35,  0.1, 0.02],
    [ 0.25, 0.45, -0.1, 0.015],
    [-0.22, 0.65, -0.15, 0.025],
    [ 0.18, 0.7,   0.1, 0.018],
    [ 0.0,  0.75,  0.2, 0.02]
  ];
  motes.forEach((p, i) => {
    const mote = new THREE.Mesh(new THREE.SphereGeometry(p[3], 8, 8), voidAuraMat);
    mote.position.set(p[0], p[1], p[2]);
    headGroup.add(mote);
  });

  // ------------------------------------------------------------
  // ARMS & HANDS
  // ------------------------------------------------------------

  function buildArm(side, casting) {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * 0.32, 1.05, 0);
    shoulderPivot.name = "shoulderPivot_" + (side < 0 ? "L" : "R");
    bodyGroup.add(shoulderPivot);

    // Wide draped red sleeve
    const upperSleeve = makeCapsule(0.08, 0.28, redRobeMat);
    upperSleeve.position.set(0, -0.12, 0);
    shoulderPivot.add(upperSleeve);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.28, 0);
    elbowPivot.name = "elbowPivot_" + (side < 0 ? "L" : "R");
    shoulderPivot.add(elbowPivot);

    const lowerSleeve = makeCapsule(0.075, 0.22, redRobeMat);
    lowerSleeve.position.set(0, -0.1, 0);
    elbowPivot.add(lowerSleeve);

    // Prominent white cuff at the end of the sleeve
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 8, 16), whiteShirtMat);
    cuff.position.set(0, -0.21, 0);
    cuff.rotation.x = Math.PI / 2;
    elbowPivot.add(cuff);

    // Gold trim on the cuff
    const cuffTrim = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.01, 8, 16), goldMat);
    cuffTrim.position.set(0, -0.23, 0);
    cuffTrim.rotation.x = Math.PI / 2;
    elbowPivot.add(cuffTrim);

    // Dark clawed hand
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), skinMat);
    hand.position.set(0, -0.26, 0.01);
    hand.scale.set(0.9, 1.2, 0.8);
    hand.name = "hand_" + (side < 0 ? "L" : "R");
    elbowPivot.add(hand);

    // Spread claw-like fingers
    for (let i = 0; i < 4; i++) {
      const finger = makeCapsule(0.012, i === 1 || i === 2 ? 0.12 : 0.09, skinMat);
      finger.position.set((i - 1.5) * 0.022, -0.32, 0.02);
      finger.rotation.z = (i - 1.5) * 0.2;
      finger.rotation.x = 0.1;
      elbowPivot.add(finger);
    }

    // Pose to match concept art: right hand raised to cast, left lowered
    if (casting) {
      shoulderPivot.rotation.set(-0.8, -0.2, 0.7);
      elbowPivot.rotation.set(-0.6, 0.1, -0.2);
    } else {
      shoulderPivot.rotation.set(0.15, 0, -0.4);
      elbowPivot.rotation.set(-0.1, 0, 0.15);
    }

    return { shoulderPivot, elbowPivot, hand };
  }

  const leftRig = buildArm(-1, false);
  const rightRig = buildArm(1, true);

  // ------------------------------------------------------------
  // WEAPON HOOK & CORE
  // ------------------------------------------------------------
  
  // Weapon hook: A swirling dark flame in his raised right hand for casting animations
  const weapon = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), voidAuraMat);
  weapon.position.set(0, -0.42, 0.05);
  weapon.name = "weapon";
  rightRig.elbowPivot.add(weapon);
  
  // Dark core in the center of the flame
  const weaponCore = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), voidCoreMat);
  weapon.add(weaponCore);

  // Body core for shared targeting
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), voidAuraMat);
  core.position.set(0, 0.9, 0.28);
  core.name = "core";
  bodyGroup.add(core);

  // Return main outline targets
  const head_ = headGroup.getObjectByName("head");
  return [chestBase, head_, skirt, cowlDrape];
}

BESPOKE_BUILDERS.daxen_ciris = buildDaxenCirisModel;
