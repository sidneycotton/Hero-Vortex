function buildMarianaModel(bodyGroup, mainMat, accentMat, def) {
  // Mariana, Tocada Pela Luz — Versão corrigida com a função add integrada
  const hairMat = mainMat.clone();
  hairMat.color.set(0xb8452a);
  const skinMat = mainMat.clone();
  skinMat.color.set(0xe8b89a);
  const robeMat = mainMat.clone();
  robeMat.color.set(0xf5efe0);
  const goldMat = accentMat.clone();
  goldMat.color.set(0xc9a13a);
  const collarGreenMat = new THREE.MeshToonMaterial({ color: 0x1a382b, gradientMap: TOON_GRADIENT });
  const glowMat = new THREE.MeshToonMaterial({ color: 0xfff0c0, gradientMap: TOON_GRADIENT, emissive: 0xffcf8f, emissiveIntensity: 1.2 });

  function add(mesh, name, parent = bodyGroup) {
    if (name) mesh.name = name;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // ---- Robe / Saia longa ----
  const skirt = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), robeMat);
  skirt.position.y = 0.42;
  skirt.scale.set(1, 1.25, 1);
  skirt.castShadow = true;
  skirt.name = "skirt";
  bodyGroup.add(skirt);

  const sash = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.05, 10, 20), goldMat);
  sash.rotation.x = Math.PI / 2;
  sash.position.y = 0.62;
  sash.name = "sash";
  bodyGroup.add(sash);

  // ---- Tronco e Peitoral Ornato ----
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 14), robeMat);
  chest.position.y = 0.86;
  chest.scale.set(1, 1.1, 0.92);
  chest.castShadow = true;
  chest.name = "torso";
  bodyGroup.add(chest);

  const highCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.12, 12), collarGreenMat);
  highCollar.position.set(0, 1.05, 0);
  bodyGroup.add(highCollar);

  const ornateChestplate = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 10), goldMat);
  ornateChestplate.scale.set(1.15, 0.8, 0.6);
  ornateChestplate.position.set(0, 0.96, 0.16);
  ornateChestplate.rotation.x = 0.2;
  add(ornateChestplate, "chestplate");

  const emblem = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), glowMat);
  emblem.scale.set(1, 1, 0.4);
  emblem.position.set(0, 0.96, 0.27);
  emblem.name = "emblem";
  bodyGroup.add(emblem);

  // ---- Cabeça e Cabelo Volumoso ----
  const headGroup = new THREE.Group();
  headGroup.position.y = 1.22;
  headGroup.name = "headGroup";
  bodyGroup.add(headGroup);

  const neck = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), skinMat);
  neck.scale.set(1, 0.6, 1);
  neck.position.y = 0.04;
  neck.name = "neck";
  headGroup.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 16), skinMat);
  head.position.y = 0.28;
  head.castShadow = true;
  head.name = "head";
  headGroup.add(head);

  const hairCrown = new THREE.Mesh(new THREE.SphereGeometry(0.41, 16, 12), hairMat);
  hairCrown.scale.set(1.05, 0.9, 1.05);
  hairCrown.position.set(0, 0.38, -0.02);
  hairCrown.name = "hairCrown";
  headGroup.add(hairCrown);

  const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), hairMat);
  hairBack.scale.set(1.15, 1.6, 0.95);
  hairBack.position.set(0, 0.08, -0.24);
  hairBack.name = "hairBack";
  headGroup.add(hairBack);

  [-1, 1].forEach(side => {
    const lock = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), hairMat);
    lock.scale.set(1.1, 4.5, 1.1);
    lock.position.set(side * 0.34, -0.12, 0.08);
    lock.rotation.z = side * 0.12;
    lock.name = "hairLock_" + (side < 0 ? "L" : "R");
    headGroup.add(lock);
  });

  const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), hairMat);
  fringe.scale.set(1.1, 0.45, 0.6);
  fringe.position.set(0, 0.6, 0.22);
  fringe.name = "fringe";
  headGroup.add(fringe);

  // ---- Braços Articulados e Orbs de Luz ----
  function buildArm(side) {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * 0.32, 1.0, 0.0);
    shoulderPivot.name = "shoulderPivot_" + (side < 0 ? "L" : "R");
    bodyGroup.add(shoulderPivot);

    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.32, 10), robeMat);
    upperArm.position.set(0, -0.16, 0);
    upperArm.name = "upperArm_" + (side < 0 ? "L" : "R");
    shoulderPivot.add(upperArm);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.32, 0);
    elbowPivot.name = "elbowPivot_" + (side < 0 ? "L" : "R");
    shoulderPivot.add(elbowPivot);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.045, 0.3, 10), robeMat);
    forearm.position.set(0, -0.15, 0);
    forearm.name = "forearm_" + (side < 0 ? "L" : "R");
    elbowPivot.add(forearm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), skinMat);
    hand.position.set(0, -0.32, 0.02);
    hand.name = (side < 0 ? "armL" : "armR");
    elbowPivot.add(hand);

    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), glowMat.clone());
    orb.material.transparent = true;
    orb.material.opacity = 0.9;
    orb.position.set(0, -0.46, 0.05);
    orb.name = "orb_" + (side < 0 ? "L" : "R");
    elbowPivot.add(orb);

    shoulderPivot.rotation.z = side * 0.25;
    elbowPivot.rotation.x = 0.15;

    return { shoulderPivot, elbowPivot };
  }

  const rigL = buildArm(-1);
  const rigR = buildArm(1);

  const weapon = rigR.elbowPivot.getObjectByName("orb_R");
  weapon.name = "weapon";

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), glowMat.clone());
  core.position.set(0, 0.98, 0.22);
  core.name = "core";
  bodyGroup.add(core);

  const head_ = headGroup.getObjectByName("head");
  return [chest, head_, skirt];
}

BESPOKE_BUILDERS.mariana = buildMarianaModel;
