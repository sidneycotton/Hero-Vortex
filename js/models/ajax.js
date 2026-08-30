function buildAjaxModel(bodyGroup, mainMat, accentMat, def) {
  // ============================================================
  // AJAX, O ULTRA-HUMANO (BRUTE REBUILD FINAL)
  //
  // Adjustments:
  //  - Belly patch pulled forward along Z so it's fully visible on the chest.
  //  - Belt position and scale adjusted to clear the heavy chest overhang.
  //  - Dorsal fin scaled up even larger for a more aggressive shark silhouette.
  // ============================================================

  const skinMat = mainMat;
  
  const bellyMat = mainMat.clone();
  bellyMat.color.lerp(new THREE.Color(0xffffff), 0.6); 
  
  const pantsMat = new THREE.MeshToonMaterial({ 
    color: 0x1a1c23, 
    gradientMap: TOON_GRADIENT 
  });
  
  const darkMouthMat = new THREE.MeshToonMaterial({ 
    color: 0x0a0b0e, 
    gradientMap: TOON_GRADIENT 
  });
  
  const toothMat = new THREE.MeshToonMaterial({ 
    color: 0xffffff, 
    gradientMap: TOON_GRADIENT 
  });

  function add(mesh, name, parent = bodyGroup) {
    if (name) mesh.name = name;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // ------------------------------------------------------------
  // LOWER BODY (PANTS & STANCE)
  // ------------------------------------------------------------
  
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 14), pantsMat);
  // Pull forward from 0.05 to 0.20
  pelvis.position.set(0, 0.3, 0.20); 
  // Increase Z-scale to 1.3 to push the belly of the shorts out
  pelvis.scale.set(1.2, 0.75, 1.3); 
  add(pelvis, "pelvis");

  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.04, 8, 16), pantsMat);
  // Pull forward from 0.08 to 0.24 to sit cleanly over the new shorts
  belt.position.set(0, 0.42, 0.24); 
  belt.rotation.x = Math.PI / 2;
  // Widen slightly to accommodate the larger pelvis
  belt.scale.set(1.15, 1.0, 1.15); 
  add(belt, "belt"); 

  [-1, 1].forEach(side => {
    const thigh = makeCapsule(0.16, 0.25, pantsMat);
    thigh.position.set(side * 0.22, 0.2, 0.05);
    thigh.rotation.z = side * 0.3; 
    thigh.rotation.x = -0.2;
    add(thigh, "thigh_" + (side < 0 ? "L" : "R"));

    const calf = makeCapsule(0.14, 0.22, skinMat);
    calf.position.set(side * 0.3, 0.0, 0.12);
    calf.rotation.z = side * 0.1;
    calf.rotation.x = 0.1;
    add(calf, "calf_" + (side < 0 ? "L" : "R"));

    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), skinMat);
    foot.position.set(side * 0.3, -0.12, 0.18);
    foot.scale.set(1.1, 0.6, 1.5);
    add(foot, "foot_" + (side < 0 ? "L" : "R"));
  });

  // ------------------------------------------------------------
  // TORSO (V-TAPER & BELLY)
  // ------------------------------------------------------------
  
  const abs = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 14), skinMat);
  abs.position.set(0, 0.58, 0.12);
  abs.scale.set(1.1, 0.9, 0.95);
  abs.rotation.x = 0.15;
  add(abs, "abs");

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), skinMat);
  chest.position.set(0, 0.86, 0.15);
  chest.scale.set(1.5, 1.05, 0.95); 
  chest.rotation.x = 0.3; 
  add(chest, "torso");

  const bellyPatch = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), bellyMat);
  // Pull it forward just enough to clear the chest surface
  bellyPatch.position.set(0, 0.72, 0.45); 
  // Make it wider (1.25) and much flatter on Z (0.28)
  bellyPatch.scale.set(1.25, 1.05, 0.28); 
  // Tilt it back slightly more to match the slope of his chest
  bellyPatch.rotation.x = 0.25; 
  add(bellyPatch, "belly");

  // ------------------------------------------------------------
  // DORSAL FIN (LARGER & HIGHER)
  // ------------------------------------------------------------
  
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.0, 12), skinMat);
  fin.position.set(0, 1.28, -0.27);
  fin.rotation.x = -0.42; 
  fin.scale.set(0.42, 1.3, 1.5); 
  add(fin, "dorsalFin");

  // ------------------------------------------------------------
  // HEAD
  // ------------------------------------------------------------
  
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.08, 0.32);
  headGroup.name = "headGroup";
  bodyGroup.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 14), skinMat);
  head.scale.set(0.72, 0.7, 1.6); 
  head.position.set(0, 0.05, 0.1);
  head.rotation.x = -0.15; 
  add(head, "head", headGroup);

  [-1, 1].forEach(side => {
    const brow = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), skinMat);
    brow.scale.set(1.3, 0.35, 2.2);
    brow.position.set(side * 0.16, 0.13, 0.22);
    brow.rotation.z = side * 0.35; 
    brow.rotation.y = side * 0.25;
    brow.rotation.x = 0.1; 
    add(brow, "brow_" + (side < 0 ? "L" : "R"), headGroup);
  });

  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), bellyMat);
  jaw.scale.set(0.85, 0.45, 1.35);
  jaw.position.set(0, -0.12, 0.05);
  jaw.rotation.x = 0.1; 
  add(jaw, "jaw", headGroup);

  const mouthDark = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), darkMouthMat);
  mouthDark.scale.set(0.8, 0.3, 1.3);
  mouthDark.position.set(0, -0.04, 0.1);
  add(mouthDark, "mouthDark", headGroup);

  for(let i = -3; i <= 3; i++) {
    const toothU = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), toothMat);
    toothU.position.set(i * 0.05, 0.02, 0.32 - Math.abs(i) * 0.03);
    toothU.scale.set(0.8, 2.0, 0.8);
    toothU.rotation.x = 0.2;
    add(toothU, "toothU_" + i, headGroup);
    
    const toothL = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), toothMat);
    toothL.position.set(i * 0.045, -0.08, 0.28 - Math.abs(i) * 0.03);
    toothL.scale.set(0.8, 2.0, 0.8);
    toothL.rotation.x = -0.2;
    add(toothL, "toothL_" + i, headGroup);
  }

  // ------------------------------------------------------------
  // ARMS
  // ------------------------------------------------------------
  
  function buildArm(side) {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * 0.62, 0.92, -0.05);
    shoulderPivot.name = "shoulderPivot_" + (side < 0 ? "L" : "R");
    bodyGroup.add(shoulderPivot);

    const upperArm = makeCapsule(0.18, 0.38, skinMat);
    upperArm.position.set(0, -0.16, 0);
    add(upperArm, "upperArm_" + (side < 0 ? "L" : "R"), shoulderPivot);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.38, 0);
    elbowPivot.name = "elbowPivot_" + (side < 0 ? "L" : "R");
    shoulderPivot.add(elbowPivot);

    const forearm = makeCapsule(0.15, 0.35, skinMat);
    forearm.position.set(0, -0.15, 0);
    add(forearm, "arm" + (side < 0 ? "L" : "R"), elbowPivot);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 12), skinMat);
    hand.position.set(0, -0.34, 0);
    hand.scale.set(1.1, 1.25, 0.95);
    add(hand, "hand_" + (side < 0 ? "L" : "R"), elbowPivot);

    shoulderPivot.rotation.z = side * 0.35;
    shoulderPivot.rotation.x = 0.45; 
    elbowPivot.rotation.x = -0.35;   
    elbowPivot.rotation.z = side * -0.15;

    return { shoulderPivot, elbowPivot, hand };
  }

  const rigL = buildArm(-1);
  const rigR = buildArm(1);

  // ------------------------------------------------------------
  // CORE & WEAPON HOOK
  // ------------------------------------------------------------
  
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), accentMat);
  // Pull Z back to 0.0 so it hides safely inside the torso mesh
  core.position.set(0, 0.78, 0.0); 
  add(core, "core");

  const weapon = new THREE.Group();
  weapon.position.set(0, -0.45, 0);
  add(weapon, "weapon", rigR.elbowPivot);

  const head_ = headGroup.getObjectByName("head");
  return [chest, abs, pelvis, head_];
}

BESPOKE_BUILDERS.ajax = buildAjaxModel;
