function buildYvrelModel(bodyGroup, mainMat, accentMat, def) {
  // ============================================================
  // YVREL — A LUZ QUE SE APAGOU (ROUNDED REBUILD)
  //
  // Rebuilt using smooth Spheres, Toruses, and Capsules to
  // align with the soft chibi-primitive art style, reducing
  // clutter while keeping his iconic horns, pauldrons, and pose.
  // ============================================================

  // ------------------------------------------------------------
  // MATERIALS
  // ------------------------------------------------------------

  const bronze = accentMat.clone();
  bronze.color.set(0x8f3f1f);

  const bronzeLight = accentMat.clone();
  bronzeLight.color.set(0xb86732);

  const bronzeBright = accentMat.clone();
  bronzeBright.color.set(0xd59655);

  const bronzeDark = accentMat.clone();
  bronzeDark.color.set(0x451812);

  const crimson = mainMat.clone();
  crimson.color.set(0x4a0e18);

  const skin = mainMat.clone();
  skin.color.set(0x667687);

  const skinDark = mainMat.clone();
  skinDark.color.set(0x3d4a58);

  const orangeGlow = new THREE.MeshToonMaterial({
    color: 0xffa51c,
    gradientMap: TOON_GRADIENT,
    emissive: 0xff4d00,
    emissiveIntensity: 3.0
  });

  const cyanGlow = new THREE.MeshToonMaterial({
    color: 0xbff8ff,
    gradientMap: TOON_GRADIENT,
    emissive: 0x19cfff,
    emissiveIntensity: 2.4,
    transparent: true,
    opacity: 0.82
  });

  const whiteGlow = new THREE.MeshToonMaterial({
    color: 0xffffff,
    gradientMap: TOON_GRADIENT,
    emissive: 0xffdca0,
    emissiveIntensity: 2.2,
    transparent: true,
    opacity: 0.8
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

  function capsule(radius, length, material) {
    return makeCapsule(radius, length, material);
  }

  // ------------------------------------------------------------
  // LOWER SILHOUETTE
  // ------------------------------------------------------------

  const robe = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 14, 10),
    crimson
  );
  robe.position.set(0, 0.42, 0);
  robe.scale.set(1.0, 1.6, 0.75);
  robe.name = "skirt";
  add(robe);

  // Rounded hanging center panel (replacing flat plate)
  const crimsonCenter = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 12, 10),
    bronzeLight
  );
  crimsonCenter.scale.set(0.9, 1.8, 0.3);
  crimsonCenter.position.set(0, 0.32, 0.25);
  add(crimsonCenter, "crimsonCenter");

  // ------------------------------------------------------------
  // LOWER BRONZE ARMOR (ROUNDED TISSETS)
  // ------------------------------------------------------------

  [-1, 1].forEach(side => {
    const x = side * 0.16;

    const tasset = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 12, 10),
      bronze
    );
    tasset.scale.set(0.8, 1.8, 0.6);
    tasset.position.set(x, 0.35, 0.22);
    tasset.rotation.z = side * -0.12;
    add(tasset, "tasset_" + (side < 0 ? "L" : "R"));
  });

  // ------------------------------------------------------------
  // HIPS / WAIST
  // ------------------------------------------------------------

  const torso = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 12, 10),
    bronzeDark
  );
  torso.position.set(0, 0.76, 0);
  torso.scale.set(1.0, 0.9, 0.75);
  torso.name = "torso";
  add(torso);

  const waistRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.022, 8, 18),
    bronzeBright
  );
  waistRing.position.set(0, 0.73, 0);
  waistRing.rotation.x = Math.PI / 2;
  add(waistRing, "waistRing");

  const waistCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 10, 10),
    cyanGlow
  );
  waistCore.position.set(0, 0.74, 0.18);
  add(waistCore, "waistCore");

  // ------------------------------------------------------------
  // CHEST
  // ------------------------------------------------------------

  const chestBase = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 16, 12),
    bronzeDark
  );
  chestBase.position.set(0, 1.02, 0);
  chestBase.scale.set(1.3, 1.1, 0.82);
  add(chestBase, "chest");

  // Rounded central breastplate
  const breastplate = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 14, 10),
    bronze
  );
  breastplate.scale.set(1.1, 1.0, 0.45);
  breastplate.position.set(0, 1.0, 0.24);
  add(breastplate, "breastplate");

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 12, 12),
    cyanGlow
  );
  core.position.set(0, 0.95, 0.35);
  core.name = "core";
  add(core);

  // ------------------------------------------------------------
  // PAULDRONS
  // ------------------------------------------------------------

  [-1, 1].forEach(side => {
    const shoulder = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, 14, 10),
      bronze
    );
    shoulder.position.set(side * 0.38, 1.08, 0);
    shoulder.scale.set(1.5, 0.85, 1.1);
    shoulder.rotation.z = side * 0.08;
    add(shoulder, "pauldron_" + (side < 0 ? "L" : "R"));

    const shoulderSpike = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 10, 8),
      bronzeBright
    );
    shoulderSpike.scale.set(0.6, 2.2, 0.6);
    shoulderSpike.position.set(side * 0.48, 1.18, -0.02);
    shoulderSpike.rotation.z = side * -0.6;
    add(shoulderSpike, "shoulderSpike_" + (side < 0 ? "L" : "R"));
  });

  // ------------------------------------------------------------
  // NECK & HEAD
  // ------------------------------------------------------------

  const neck = capsule(0.075, 0.16, skinDark);
  neck.position.set(0, 1.23, 0);
  add(neck, "neck");

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.36, 0.045);
  headGroup.name = "headGroup";
  bodyGroup.add(headGroup);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.21, 16, 14),
    skin
  );
  head.position.set(0, 0.04, 0.12);
  head.scale.set(0.8, 1.1, 0.8);
  head.name = "head";
  head.castShadow = true;
  headGroup.add(head);

  // Cowl back (rounded shell)
  const cowlBack = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.7),
    bronzeDark
  );
  cowlBack.position.set(0, 0.06, -0.035);
  cowlBack.scale.set(1.1, 1.15, 1.05);
  cowlBack.name = "cowlBack";
  headGroup.add(cowlBack);

  // Glowing orange eyes
  [-1, 1].forEach(side => {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 10, 8),
      orangeGlow
    );
    eye.position.set(side * 0.065, 0.04, 0.23);
    eye.scale.set(1.4, 0.5, 0.6);
    add(eye, "eye_" + (side < 0 ? "L" : "R"), headGroup);
  });

  // Crown Spikes (Rounded spheres scaled up)
  const centerSpike = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 10, 8),
    bronzeBright
  );
  centerSpike.scale.set(0.7, 3.2, 0.7);
  centerSpike.position.set(0, 0.35, 0.05);
  add(centerSpike, "crownCentral", headGroup);

  [-1, 1].forEach(side => {
    const templeSpike = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 10, 8),
      bronze
    );
    templeSpike.scale.set(0.7, 2.5, 0.7);
    templeSpike.position.set(side * 0.12, 0.28, 0.04);
    templeSpike.rotation.z = side * -0.25;
    add(templeSpike, "crownTemple_" + (side < 0 ? "L" : "R"), headGroup);
  });

  // ------------------------------------------------------------
  // SWEEPING HORNS (TUBE CURVE KEPT)
  // ------------------------------------------------------------

  function createHorn(side) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.16, 0.22, -0.01),
      new THREE.Vector3(side * 0.28, 0.32, -0.01),
      new THREE.Vector3(side * 0.39, 0.48, -0.015),
      new THREE.Vector3(side * 0.42, 0.66, -0.02),
      new THREE.Vector3(side * 0.35, 0.80, -0.02),
      new THREE.Vector3(side * 0.23, 0.88, -0.015)
    ]);

    const geometry = new THREE.TubeGeometry(curve, 16, 0.045, 7, false);
    const horn = new THREE.Mesh(geometry, bronze);
    horn.name = "horn_" + (side < 0 ? "L" : "R");
    horn.castShadow = true;
    headGroup.add(horn);
  }

  createHorn(-1);
  createHorn(1);

  // ------------------------------------------------------------
  // ARMS
  // ------------------------------------------------------------

  function buildArm(side, raised) {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * 0.43, 1.06, 0);
    shoulderPivot.name = "shoulderPivot_" + (side < 0 ? "L" : "R");
    bodyGroup.add(shoulderPivot);

    const upperArmor = capsule(0.065, 0.30, bronzeDark);
    upperArmor.position.set(0, -0.15, 0);
    upperArmor.name = "upperArm_" + (side < 0 ? "L" : "R");
    shoulderPivot.add(upperArmor);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.30, 0);
    elbowPivot.name = "elbowPivot_" + (side < 0 ? "L" : "R");
    shoulderPivot.add(elbowPivot);

    const forearm = capsule(0.06, 0.32, bronze);
    forearm.position.set(0, -0.16, 0);
    forearm.name = side < 0 ? "armL" : "armR";
    elbowPivot.add(forearm);

    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 12, 10),
      skin
    );
    hand.position.set(0, -0.36, 0.025);
    hand.scale.set(0.8, 1.1, 0.65);
    hand.name = "hand_" + (side < 0 ? "L" : "R");
    elbowPivot.add(hand);

    if (raised) {
      shoulderPivot.rotation.set(-1.02, -0.10, 0.72);
      elbowPivot.rotation.set(-0.72, 0.05, -0.10);
    } else {
      shoulderPivot.rotation.set(-0.08, 0.02, -0.38);
      elbowPivot.rotation.set(-0.14, 0, 0.12);
    }

    return { shoulderPivot, elbowPivot, hand };
  }

  const leftRig = buildArm(-1, false);
  const rightRig = buildArm(1, true);

  // ------------------------------------------------------------
  // SPELL CORE & HALO (REDUCED CLUTTER)
  // ------------------------------------------------------------

  const weapon = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 12, 12),
    cyanGlow
  );
  weapon.position.set(0, -0.44, 0.075);
  weapon.name = "weapon";
  rightRig.elbowPivot.add(weapon);

  // Clean single energy ring instead of multiple noisy arcs
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.02, 8, 32),
    whiteGlow
  );
  halo.position.set(0, 1.42, -0.18);
  halo.rotation.x = Math.PI / 2;
  halo.scale.set(0.85, 1.15, 1);
  halo.name = "celestialHalo";
  bodyGroup.add(halo);

  return [chestBase, head, robe];
}

BESPOKE_BUILDERS.yvrel = buildYvrelModel;
