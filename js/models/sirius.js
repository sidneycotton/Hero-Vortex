function buildSiriusModel(bodyGroup, mainMat, accentMat, def) {
  const skinMat = mainMat.clone();
  skinMat.color.set(0x7a4a2e); 
  const shirtMat = mainMat.clone();
  shirtMat.color.set(0xcbd1db); 
  const pantsMat = mainMat.clone();
  pantsMat.color.set(0x181a1f); 
  const hairMat = new THREE.MeshToonMaterial({ color: 0x14100e, gradientMap: TOON_GRADIENT }); 
  const metalMat = accentMat.clone();
  metalMat.color.set(0x9aa2aa); 
  const goldMat = accentMat.clone();
  goldMat.color.set(0xd4af37); 
  const glowMat = new THREE.MeshToonMaterial({ color: 0xffb066, gradientMap: TOON_GRADIENT, emissive: 0xff7a2e, emissiveIntensity: 0.9 }); 

  const hips = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), pantsMat);
  hips.scale.set(1.1, 0.6, 1.2);
  hips.position.y = 0.25;
  hips.castShadow = true;
  hips.name = "hips";
  bodyGroup.add(hips);

  const legL = makeCapsule(0.12, 0.35, pantsMat);
  legL.position.set(-0.16, 0.12, 0.2);
  legL.rotation.z = -1.35;
  legL.rotation.x = -0.2;
  bodyGroup.add(legL);

  const legR = makeCapsule(0.12, 0.35, pantsMat);
  legR.position.set(0.16, 0.12, 0.2);
  legR.rotation.z = 1.35;
  legR.rotation.x = -0.2;
  bodyGroup.add(legR);

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 14), shirtMat);
  chest.position.y = 0.72;
  chest.scale.set(1.05, 1.1, 0.9);
  chest.castShadow = true;
  chest.name = "torso";
  bodyGroup.add(chest);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 8, 14), shirtMat);
  collar.position.set(0, 0.94, 0.05);
  collar.rotation.x = Math.PI / 2.2;
  collar.name = "collar";
  bodyGroup.add(collar);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.15, 10), skinMat);
  neck.position.set(0, 1.02, 0);
  neck.name = "neck";
  bodyGroup.add(neck);

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), glowMat);
  core.position.set(0, 0.7, 0.26);
  core.name = "core"; 
  bodyGroup.add(core);

  const headGroup = new THREE.Group();
  headGroup.position.y = 1.32;
  headGroup.name = "headGroup";
  bodyGroup.add(headGroup);

  const head_ = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 16), skinMat);
  head_.castShadow = true;
  head_.name = "head";
  headGroup.add(head_);


  const afroBase = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 14), hairMat);
  afroBase.position.set(0, 0.12, -0.06);
  afroBase.scale.set(1.05, 0.95, 1.05);
  afroBase.name = "afroBase";
  headGroup.add(afroBase);

  const afroPositions = [
    [0, 0.32, -0.03], [0.2, 0.26, -0.06], [-0.2, 0.26, -0.06],
    [0.15, 0.34, -0.16], [-0.15, 0.34, -0.16], [0, 0.38, -0.06],
    [0.26, 0.14, -0.14], [-0.26, 0.14, -0.14], [0.18, 0.2, 0.08], [-0.18, 0.2, 0.08]
  ];
  afroPositions.forEach((p, i) => {
    const curl = new THREE.Mesh(new THREE.SphereGeometry(0.12 + (i % 3) * 0.015, 10, 8), hairMat);
    curl.position.set(p[0], p[1], p[2]);
    curl.name = "afroCurl_" + i;
    headGroup.add(curl);
  });

  const earring = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.008, 8, 12), goldMat);
  earring.position.set(-0.31, -0.02, 0);
  earring.rotation.y = Math.PI / 2;
  earring.name = "earring";
  headGroup.add(earring);

  function buildArm(side, rot) {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * 0.32, 0.88, 0);
    shoulderPivot.name = "shoulderPivot_" + (side < 0 ? "L" : "R");
    bodyGroup.add(shoulderPivot);

    const upperArm = makeCapsule(0.06, 0.18, shirtMat);
    upperArm.position.set(0, -0.1, 0);
    upperArm.name = "upperArm_" + (side < 0 ? "L" : "R");
    shoulderPivot.add(upperArm);

    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.022, 8, 12), shirtMat);
    cuff.position.set(0, -0.2, 0);
    cuff.rotation.x = Math.PI / 2;
    cuff.name = "sleeveCuff_" + (side < 0 ? "L" : "R");
    shoulderPivot.add(cuff);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.2, 0);
    elbowPivot.name = "elbowPivot_" + (side < 0 ? "L" : "R");
    shoulderPivot.add(elbowPivot);

    const forearm = makeCapsule(0.05, 0.18, skinMat);
    forearm.position.set(0, -0.1, 0);
    forearm.name = (side < 0 ? "armL" : "armR");
    elbowPivot.add(forearm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), skinMat);
    hand.position.set(0, -0.22, 0);
    hand.name = "hand_" + (side < 0 ? "L" : "R");
    elbowPivot.add(hand);

    shoulderPivot.rotation.set(rot.sx, rot.sy, rot.sz);
    elbowPivot.rotation.set(rot.ex, rot.ey, rot.ez);

    return { shoulderPivot, elbowPivot, hand };
  }

  const rigL = buildArm(-1, { sx: -0.6, sy: 0.2, sz: 0.1, ex: -0.8, ey: 0, ez: -0.2 });
  const rigR = buildArm(1, { sx: -0.65, sy: -0.2, sz: -0.1, ex: -0.9, ey: 0, ez: 0.2 });

  const swordGroup = new THREE.Group();
  swordGroup.name = "swordGroup";
  rigR.hand.add(swordGroup); 
  
  const swordGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 8), pantsMat);
  swordGrip.name = "swordGrip";
  swordGroup.add(swordGrip);

  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), goldMat);
  pommel.position.set(0, 0.09, 0);
  swordGroup.add(pommel);

  const crossGuard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 0.04), goldMat);
  crossGuard.position.set(0, -0.08, 0);
  swordGroup.add(crossGuard);

  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.65, 0.015), metalMat);
  blade.position.set(0, -0.42, 0);
  blade.name = "weapon"; 
  swordGroup.add(blade);

  swordGroup.rotation.x = Math.PI / 2;
  swordGroup.rotation.z = -0.2;
  swordGroup.position.set(0, -0.04, 0.08);

  return [chest, head_];
}

// Carmelita Marquese — pale sickly-skinned reader-of-fates support. Distinct
// silhouette: massive wind-swept red hair falling to one side, a popped
// asymmetric white collar framing a high-necked wine-purple dress, a
// hanging medallion, and — the single most identifying feature — a large
// open grimoire held in both hands in front of her torso (no other
// character in the roster holds a two-handed prop like this). Glow family:
// cold spectral teal-white (moon/skull card motif), distinct from every
// existing character's glow (Yvrel=cyan, Mariana=warm pale-gold,
// Ajax=pale-gold, Daxen-Ciris=void-black, Amelia=purple, Sirius=lime,
// Moldar=orange).

BESPOKE_BUILDERS.sirius = buildSiriusModel;
