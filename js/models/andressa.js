function buildAndressaModel(bodyGroup, mainMat, accentMat, def) {
  // ============================================================
  // ANDRESSA, PEQUENA ESCUDEIRA
  //
  // Rebuilt from scratch to focus entirely on the core silhouette:
  // a tiny huddled child propping up a massive, imposing shield.
  // The shield is updated to a golden/brown aesthetic with a hole
  // where Andressa fits perfectly inside.
  // ============================================================

  function add(mesh, name, parent = bodyGroup) {
    if (name) mesh.name = name;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // ------------------------------------------------------------
  // MATERIALS
  // ------------------------------------------------------------

  const skin = mainMat.clone();
  skin.color.set(0xe8b98f);

  const hair = mainMat.clone();
  hair.color.set(0xc24423); // Vibrant orange/red hair

  const hoodMat = mainMat.clone();
  hoodMat.color.set(0x4a3220); 

  const mantleMat = mainMat.clone();
  mantleMat.color.set(0x8e5b99); // Purple mantle

  const leatherMat = mainMat.clone();
  leatherMat.color.set(0x5c3a21); 

  const parchment = accentMat.clone();
  parchment.color.set(0xe7d9b8); // White/cream for sleeves

  const tealGlow = new THREE.MeshToonMaterial({
    color: 0xbdfff5, gradientMap: TOON_GRADIENT,
    emissive: 0x5fe8d9, emissiveIntensity: 2.2
  });

  // Updated Golden and Brown aesthetic for the shield
  const brownShield = new THREE.MeshToonMaterial({ color: 0x4a2c13, gradientMap: TOON_GRADIENT });
  const goldTrim = new THREE.MeshToonMaterial({ color: 0xcda23f, gradientMap: TOON_GRADIENT, emissive: 0x7a5c1c, emissiveIntensity: 0.4 });
  const bronzeTrim = new THREE.MeshToonMaterial({ color: 0x8c5e35, gradientMap: TOON_GRADIENT });

  // ------------------------------------------------------------
  // THE MASSIVE SHIELD (With a hole for her body)
  // ------------------------------------------------------------
  
  const shieldGroup = new THREE.Group();
  // Positioned so the inner hole perfectly encapsulates her huddled torso
  shieldGroup.position.set(0, 0.75, 0.35); 
  shieldGroup.rotation.x = -0.15; 
  bodyGroup.add(shieldGroup);

  // Extruded shape with a hole at the bottom center
  const shieldShape = new THREE.Shape();
  shieldShape.absarc(0, 0, 1.3, 0, Math.PI * 2, false); 
  const shieldHole = new THREE.Path();
  shieldHole.absarc(0, -0.45, 0.55, 0, Math.PI * 2, true); 
  shieldShape.holes.push(shieldHole);

  const extrudeSettings = { depth: 0.2, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04 };
  const shieldFace = new THREE.Mesh(new THREE.ExtrudeGeometry(shieldShape, extrudeSettings), brownShield);
  shieldFace.position.set(0, 0, -0.1); 
  add(shieldFace, "shieldFace", shieldGroup);

  const shieldOuterRim = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.1, 16, 48), goldTrim);
  add(shieldOuterRim, "shieldOuterRim", shieldGroup);

  const shieldInnerRim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.08, 16, 32), goldTrim);
  shieldInnerRim.position.set(0, -0.45, 0);
  add(shieldInnerRim, "shieldInnerRim", shieldGroup);

  const shieldGemBase = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.35), bronzeTrim);
  shieldGemBase.position.set(0, 0.8, 0.05);
  shieldGemBase.rotation.z = Math.PI / 4;
  add(shieldGemBase, "shieldGemBase", shieldGroup);

  const shieldGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), tealGlow);
  shieldGem.position.set(0, 0.8, 0.15);
  shieldGem.scale.set(1.0, 1.4, 0.5);
  add(shieldGem, "weapon", shieldGroup); 

  [-1, 1].forEach(side => {
    const rune = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.03, 8, 16), tealGlow);
    rune.position.set(side * 0.7, 0.2, 0.15);
    rune.rotation.x = 0.2;
    rune.rotation.y = side * 0.2;
    add(rune, "shieldRune_" + (side < 0 ? "L" : "R"), shieldGroup);
  });

  // ------------------------------------------------------------
  // ANDRESSA (The huddled child in the foreground)
  // ------------------------------------------------------------

  const hips = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), leatherMat);
  hips.scale.set(1.1, 0.8, 1.2);
  hips.position.set(0, 0.12, 0.35);
  add(hips, "hips");

  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), parchment); // White shirt matching concept
  torso.scale.set(0.95, 1.1, 0.85);
  torso.position.set(0, 0.3, 0.38);
  torso.rotation.x = 0.3; 
  torso.name = "torso";
  add(torso);

  const mantle = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), mantleMat);
  mantle.scale.set(1.1, 1.2, 1.05);
  mantle.position.set(0, 0.38, 0.38);
  mantle.rotation.x = 0.2;
  add(mantle, "mantle");

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 10), tealGlow);
  core.position.set(0, 0.4, 0.55);
  core.name = "core";
  add(core);

  [-1, 1].forEach(side => {
    const thigh = makeCapsule(0.065, 0.22, leatherMat);
    thigh.position.set(side * 0.1, 0.22, 0.48);
    thigh.rotation.x = -0.8;
    thigh.rotation.z = side * 0.1;
    add(thigh, "legUp_" + (side < 0 ? "L" : "R"));

    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), leatherMat);
    knee.position.set(side * 0.12, 0.32, 0.56);
    add(knee, "kneeLil_" + (side < 0 ? "L" : "R"));

    const shin = makeCapsule(0.055, 0.24, leatherMat);
    shin.position.set(side * 0.12, 0.16, 0.56);
    add(shin, "shinLil_" + (side < 0 ? "L" : "R"));

    const boot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), leatherMat);
    boot.scale.set(1.1, 0.7, 1.4);
    boot.position.set(side * 0.12, 0.04, 0.6);
    add(boot, "bootLil_" + (side < 0 ? "L" : "R"));
  });

  function buildArm(side) {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * 0.22, 0.42, 0.4);
    shoulderPivot.name = "shoulderPivot_" + (side < 0 ? "L" : "R");
    bodyGroup.add(shoulderPivot);

    const upperArm = makeCapsule(0.05, 0.2, parchment); // White sleeves
    upperArm.position.set(0, -0.1, 0);
    upperArm.name = "upperArm_" + (side < 0 ? "L" : "R");
    shoulderPivot.add(upperArm);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.2, 0);
    elbowPivot.name = "elbowPivot_" + (side < 0 ? "L" : "R");
    shoulderPivot.add(elbowPivot);

    const forearm = makeCapsule(0.045, 0.18, leatherMat);
    forearm.position.set(0, -0.09, 0);
    forearm.name = side < 0 ? "armL" : "armR";
    elbowPivot.add(forearm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), skin);
    hand.position.set(0, -0.19, 0);
    elbowPivot.add(hand);

    shoulderPivot.rotation.set(-1.0, 0, side * 0.2);
    elbowPivot.rotation.set(-1.2, side * -1.5, 0);

    return { shoulderPivot, elbowPivot, hand };
  }

  buildArm(-1);
  buildArm(1);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.54, 0.42);
  headGroup.rotation.x = 0.15; 
  headGroup.name = "headGroup";
  bodyGroup.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 14), skin);
  head.scale.set(0.95, 1.0, 0.95);
  head.name = "head";
  headGroup.add(head);

  // Exaggerated swept hair over one eye
  const hairSweep = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), hair);
  hairSweep.scale.set(1.05, 1.1, 0.6);
  hairSweep.position.set(-0.04, 0.02, 0.08);
  hairSweep.rotation.z = -0.3;
  hairSweep.rotation.y = 0.2;
  add(hairSweep, "hairSweep", headGroup);

  const hairLock = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), hair);
  hairLock.scale.set(1.0, 2.5, 0.8);
  hairLock.position.set(-0.12, -0.08, 0.12);
  hairLock.rotation.z = -0.4;
  add(hairLock, "hairLock", headGroup);

  const hoodShell = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 16, 14, 0, Math.PI * 2, 0, Math.PI * 0.7),
    mantleMat // Matching the cape color
  );
  hoodShell.position.set(0, 0.04, -0.03);
  hoodShell.scale.set(1.05, 1.1, 1.05);
  add(hoodShell, "hoodShell", headGroup);

  const hoodLining = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.6),
    parchment
  );
  hoodLining.position.set(0, 0.03, -0.01);
  hoodLining.scale.set(1.05, 1.1, 1.05);
  add(hoodLining, "hoodLining", headGroup);

  return [torso, head, hoodShell];
}

BESPOKE_BUILDERS.andressa = buildAndressaModel;