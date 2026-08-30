function buildCarmelitaMarqueseModel(bodyGroup, mainMat, accentMat, def) {
  const hairMat = mainMat.clone();
  hairMat.color.set(0xc23a2e);
  const skinMat = mainMat.clone();
  skinMat.color.set(0xcfe0d6); // pale sickly green-white
  const dressMat = mainMat.clone();
  dressMat.color.set(0x6b1f34); // wine-purple
  const collarMat = accentMat.clone();
  collarMat.color.set(0xe9e3d2); // off-white collar/blouse
  const bookMat = accentMat.clone();
  bookMat.color.set(0x8a5a2e); // worn leather
  const pageMat = new THREE.MeshToonMaterial({ color: 0xf2ead2, gradientMap: TOON_GRADIENT });
  const glowMat = new THREE.MeshToonMaterial({ color: 0xdff5ef, gradientMap: TOON_GRADIENT, emissive: 0x8fd9c9, emissiveIntensity: 1.0 });
  const markMat = new THREE.MeshToonMaterial({ color: 0x8a1c2b, gradientMap: TOON_GRADIENT, emissive: 0x8a1c2b, emissiveIntensity: 0.6 });

  function add(mesh, name, parent = bodyGroup) {
    if (name) mesh.name = name;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // ---- Long dress / skirt ----
  const skirt = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), dressMat);
  skirt.position.y = 0.4;
  skirt.scale.set(1, 1.3, 1);
  add(skirt, "skirt");

  // ---- Torso ----
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.27, 18, 14), dressMat);
  torso.position.y = 0.88;
  torso.scale.set(1, 1.05, 0.92);
  add(torso, "torso");

  // Popped asymmetric white collar (silhouette feature #1) — taller on
  // the actor's left, framing the neck like the card art.
  const collarBase = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.055, 10, 16), collarMat);
  collarBase.position.y = 1.08;
  collarBase.rotation.x = Math.PI / 2;
  add(collarBase, "collarBase");

  const collarPopL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10, 0, Math.PI), collarMat);
  collarPopL.position.set(-0.14, 1.18, -0.02);
  collarPopL.rotation.y = Math.PI / 2;
  collarPopL.rotation.z = -0.35;
  collarPopL.scale.set(1, 1.6, 0.5);
  add(collarPopL, "collarPopL");

  const collarPopR = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10, 0, Math.PI), collarMat);
  collarPopR.position.set(0.13, 1.13, -0.02);
  collarPopR.rotation.y = -Math.PI / 2;
  collarPopR.rotation.z = 0.3;
  collarPopR.scale.set(1, 1.2, 0.5);
  add(collarPopR, "collarPopR");

  // Hanging medallion
  const medallionChain = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12), bookMat);
  medallionChain.position.set(0, 0.98, 0.24);
  add(medallionChain, "medallionChain");
  const medallion = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), bookMat);
  medallion.scale.set(1, 1.2, 0.4);
  medallion.position.set(0, 0.9, 0.26);
  add(medallion, "medallion");

  // ---- Head + hair ----
  const headGroup = new THREE.Group();
  headGroup.position.y = 1.26;
  headGroup.name = "headGroup";
  bodyGroup.add(headGroup);

  const neck = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), skinMat);
  neck.scale.set(1, 0.6, 1);
  neck.position.y = 0.02;
  add(neck, "neck", headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.37, 20, 16), skinMat);
  head.position.y = 0.28;
  add(head, "head", headGroup);

  // Red mark on the forehead (from the card art)
  const forheadMark = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), markMat);
  forheadMark.scale.set(1, 1, 0.3);
  forheadMark.position.set(0, 0.42, 0.31);
  add(forheadMark, "forheadMark", headGroup);

  // Massive wind-swept hair (silhouette feature #2) — asymmetric, bigger
  // and more chaotic than Mariana's neat crown/back shape, sweeping to one
  // side rather than falling straight down.
  const hairCrown = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), hairMat);
  hairCrown.scale.set(1.08, 0.85, 1.05);
  hairCrown.position.set(0, 0.4, -0.03);
  add(hairCrown, "hairCrown", headGroup);

  const hairSweepBack = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), hairMat);
  hairSweepBack.scale.set(1.7, 1.9, 1.0);
  hairSweepBack.position.set(0.18, 0.18, -0.28);
  hairSweepBack.rotation.z = -0.3;
  add(hairSweepBack, "hairSweepBack", headGroup);

  const hairSweepFar = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), hairMat);
  hairSweepFar.scale.set(2.1, 1.2, 0.85);
  hairSweepFar.position.set(0.42, 0.32, -0.18);
  hairSweepFar.rotation.z = -0.5;
  add(hairSweepFar, "hairSweepFar", headGroup);

  [-1, 1].forEach(side => {
    const lock = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), hairMat);
    lock.scale.set(1.1, 4.2, 1.1);
    lock.position.set(side * 0.32, -0.14, 0.1);
    lock.rotation.z = side * 0.15 + (side < 0 ? 0 : -0.2);
    add(lock, "hairLock_" + (side < 0 ? "L" : "R"), headGroup);
  });

  const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), hairMat);
  fringe.scale.set(1.05, 0.4, 0.55);
  fringe.position.set(-0.03, 0.6, 0.2);
  add(fringe, "fringe", headGroup);

  // ---- Arms: real joint chain, both terminating at the book ----
  function buildArm(side) {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * 0.28, 1.0, 0.05);
    shoulderPivot.name = "shoulderPivot_" + (side < 0 ? "L" : "R");
    bodyGroup.add(shoulderPivot);

    const upperArm = makeCapsule(0.05, 0.3, dressMat);
    upperArm.position.set(0, -0.15, 0);
    add(upperArm, "upperArm_" + (side < 0 ? "L" : "R"), shoulderPivot);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.3, 0.05);
    elbowPivot.name = "elbowPivot_" + (side < 0 ? "L" : "R");
    shoulderPivot.add(elbowPivot);

    const forearm = makeCapsule(0.045, 0.26, collarMat);
    forearm.position.set(0, -0.13, 0.05);
    forearm.rotation.x = -0.4;
    add(forearm, "forearm_" + (side < 0 ? "L" : "R"), elbowPivot);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skinMat);
    hand.position.set(0, -0.26, 0.16);
    hand.name = (side < 0 ? "armL" : "armR");
    elbowPivot.add(hand);

    shoulderPivot.rotation.z = side * 0.35;
    elbowPivot.rotation.x = 0.2;

    return { shoulderPivot, elbowPivot, hand };
  }

  const rigL = buildArm(-1);
  const rigR = buildArm(1);

  // ---- The grimoire (silhouette feature #3 — unique two-handed prop) ----
  // Parented to the right hand so it rides the arm rig naturally; the left
  // hand rests near it for readability without being a separate joint.
  const bookGroup = new THREE.Group();
  bookGroup.name = "weapon"; // read by animation system as the "weapon" slot
  bookGroup.position.set(-0.08, -0.02, 0.06);
  bookGroup.rotation.x = -0.25;
  rigR.hand.add(bookGroup);

  const bookCoverL = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 4, 1, false, Math.PI / 4, Math.PI / 2), bookMat);
  bookCoverL.rotation.x = Math.PI / 2;
  bookCoverL.rotation.z = 0.42;
  bookCoverL.position.set(-0.1, 0, 0);
  add(bookCoverL, "bookCoverL", bookGroup);

  const bookCoverR = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 4, 1, false, Math.PI / 4, Math.PI / 2), bookMat);
  bookCoverR.rotation.x = Math.PI / 2;
  bookCoverR.position.set(0.1, 0, 0);
  bookCoverR.rotation.z = -0.42;
  add(bookCoverR, "bookCoverR", bookGroup);

  const bookPages = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 4, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.3), pageMat);
  bookPages.scale.set(1.35, 0.5, 1);
  bookPages.position.set(0, 0.01, 0.01);
  add(bookPages, "bookPages", bookGroup);

  // Glow rune floating just above the open pages — this doubles as the
  // "core" pulse anchor (read by the shared idle-glow animation).
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), glowMat);
  core.position.set(0, 0.09, 0.02);
  core.name = "core";
  bookGroup.add(core);

  return [torso, headGroup.getObjectByName("head"), skirt];
}

BESPOKE_BUILDERS.carmelita_marquese = buildCarmelitaMarqueseModel;
